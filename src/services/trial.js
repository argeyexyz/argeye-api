import { anthropic, MODEL } from '../lib/clients.js';
import { safeJSON, textOf } from '../lib/json.js';

// Small helper around the messages API that asks for JSON and parses it.
async function ask({ system, user, maxTokens = 1024, fallback }) {
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
  });
  return safeJSON(textOf(msg), fallback);
}

// ── STEP 1 ───────────────────────────────────────────────
// Turn raw input (a tweet, a headline, a rambling thesis) into a clean,
// testable claim + entities + a resolution horizon.
export async function normalizeThesis(rawInput) {
  const system =
    'You are the intake module of ARGEYE, a terminal that tests opinions. ' +
    'Extract the single core, falsifiable claim from the user input and the ' +
    'entities involved. Respond with ONLY a JSON object, no prose, no code fences. ' +
    'Schema: {"claim": string, "entities": string[], "domain": "crypto"|"macro"|"politics"|"sports"|"tech"|"other", ' +
    '"horizon": string, "is_testable": boolean}. ' +
    '"claim" must be a crisp single sentence. "horizon" is a rough timeframe the claim resolves in (e.g. "by Q3 2026").';

  return ask({
    system,
    user: `Input:\n"""${rawInput}"""`,
    maxTokens: 512,
    fallback: { claim: rawInput, entities: [], domain: 'other', horizon: 'unspecified', is_testable: true },
  });
}

// ── STEP 2 ───────────────────────────────────────────────
// Two independent passes: one builds the strongest case FOR, one the
// strongest case AGAINST. Run in parallel for speed.
async function buildCase(claim, side) {
  const stance = side === 'for'
    ? 'You are an ADVOCATE. Build the strongest honest case that this claim WILL come true.'
    : 'You are a SKEPTIC. Build the strongest honest case that this claim will NOT come true.';

  const system =
    `You are a reasoning module inside ARGEYE. ${stance} ` +
    'Be concrete and specific. Do NOT fabricate statistics or sources — if you are ' +
    'reasoning from general knowledge, frame it as reasoning, not as a cited fact. ' +
    'Respond with ONLY a JSON object, no prose, no code fences. ' +
    'Schema: {"signals": [{"point": string, "strength": "weak"|"moderate"|"strong"}], "summary": string}. ' +
    'Provide 3–5 signals.';

  return ask({
    system,
    user: `Claim under trial:\n"""${claim}"""`,
    maxTokens: 768,
    fallback: { signals: [], summary: '' },
  });
}

// ── STEP 3 ───────────────────────────────────────────────
// The judge weighs both sides, returns a conviction score + what must be true.
async function judge(claim, horizon, caseFor, caseAgainst) {
  const system =
    'You are the JUDGE module of ARGEYE. You are given a claim and the case for ' +
    'and against it. Weigh them honestly and calibrate. A high conviction score ' +
    'means the FOR case is strong AND the key assumptions are likely to hold. ' +
    'Be skeptical of crowded / consensus views. Respond with ONLY a JSON object, ' +
    'no prose, no code fences. Schema: ' +
    '{"conviction": number (0-100), "verdict": "strong"|"lean"|"coin-flip"|"unlikely", ' +
    '"what_must_be_true": string[], "key_risk": string, "rationale": string}. ' +
    '"what_must_be_true" lists 2–4 assumptions that must hold for the claim to win.';

  const user =
    `CLAIM: ${claim}\nHORIZON: ${horizon}\n\n` +
    `CASE FOR:\n${JSON.stringify(caseFor)}\n\n` +
    `CASE AGAINST:\n${JSON.stringify(caseAgainst)}`;

  return ask({
    system,
    user,
    maxTokens: 768,
    fallback: { conviction: 50, verdict: 'coin-flip', what_must_be_true: [], key_risk: '', rationale: '' },
  });
}

// ── ORCHESTRATOR ─────────────────────────────────────────
export async function runTrial(rawInput) {
  const t0 = Date.now();

  const norm = await normalizeThesis(rawInput);
  const claim = norm?.claim || rawInput;
  const horizon = norm?.horizon || 'unspecified';

  // parallel advocate + skeptic
  const [caseFor, caseAgainst] = await Promise.all([
    buildCase(claim, 'for'),
    buildCase(claim, 'against'),
  ]);

  const verdict = await judge(claim, horizon, caseFor, caseAgainst);

  return {
    input: rawInput,
    claim,
    entities: norm?.entities || [],
    domain: norm?.domain || 'other',
    horizon,
    is_testable: norm?.is_testable !== false,
    case_for: caseFor,
    case_against: caseAgainst,
    conviction: verdict?.conviction ?? 50,
    verdict: verdict?.verdict || 'coin-flip',
    what_must_be_true: verdict?.what_must_be_true || [],
    key_risk: verdict?.key_risk || '',
    rationale: verdict?.rationale || '',
    // Markets + ledger come in later phases — surfaced as a stub so the
    // frontend can render the panel placeholders today.
    markets: { status: 'coming_soon', predictions: [], perps: [], options: [] },
    elapsed_ms: Date.now() - t0,
  };
}
