# ARGEYE — Trial Engine API 👁

The hundred-eyed terminal's backend. Takes a thesis or a link, runs it through a
two-sided reasoning pipeline (advocate vs skeptic vs judge), and returns a
conviction score with what-must-be-true. Built on Fastify + Claude + Supabase.

## Pipeline

```
input (thesis OR url)
   │  (if url) → fetch + extract readable text
   ▼
normalize   → core claim + entities + horizon          (Claude)
   ▼
┌─ advocate → strongest case FOR  ──┐                   (Claude, parallel)
└─ skeptic  → strongest case AGAINST┘                   (Claude, parallel)
   ▼
judge       → conviction 0–100 + verdict + risks        (Claude)
   ▼
persist to Supabase  →  return JSON to frontend
```

Markets (Polymarket / Hyperliquid / Deribit) and the on-chain Ledger are
stubbed for Phase 1 and surface as `markets.status = "coming_soon"`.

## Run locally

```bash
cp .env.example .env      # add your ANTHROPIC_API_KEY
npm install
npm run dev
```

## Endpoints

- `GET  /`            → service banner
- `GET  /health`      → `{ ok: true }`
- `POST /api/trial`   → body `{ "input": "BTC hits 150k by Q4 2026" }` (or a URL)
- `GET  /api/pulse`   → most recent trialed claims (powers the Pulse panel)

Rate limit: 20 trials / IP / day (beta). IPs are hashed, never stored raw.

## Deploy (Railway)

1. Push to `github.com/argeyexyz/argeye-api`.
2. New Railway project → deploy from repo.
3. Set env vars from `.env.example` (real `ANTHROPIC_API_KEY`, Supabase creds, `IP_SALT`).
4. Run `schema.sql` in the Supabase SQL editor.
5. Point the frontend's `API_BASE` at the Railway URL.

## Frontend wiring

```js
const API_BASE = "https://argeye-api-production.up.railway.app";
const r = await fetch(`${API_BASE}/api/trial`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ input: thesis }),
});
const trial = await r.json();
// trial.conviction, trial.case_for, trial.case_against, trial.what_must_be_true ...
```
