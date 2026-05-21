import { runTrial } from '../services/trial.js';
import { looksLikeUrl, extractFromUrl } from '../services/extract.js';
import { supabase } from '../lib/clients.js';

export default async function trialRoutes(fastify) {
  fastify.post('/api/trial', {
    config: {
      rateLimit: {
        max: 3,
        timeWindow: '1 day',
        keyGenerator: (req) => req.ipHash || req.ip,
      },
    },
    schema: {
      body: {
        type: 'object',
        required: ['input'],
        properties: {
          input: { type: 'string', minLength: 3, maxLength: 4000 },
        },
      },
    },
  }, async (req, reply) => {
    let input = req.body.input.trim();
    let source_url = null;
    let source_title = null;

    // If it's a link, fetch & extract first.
    if (looksLikeUrl(input)) {
      source_url = input;
      const { ok, text, title } = await extractFromUrl(input);
      if (ok && text.length > 80) {
        source_title = title;
        input = `Source: ${title}\n\n${text}`;
      }
      // if fetch fails we just trial the URL string itself — graceful degrade
    }

    let result;
    try {
      result = await runTrial(input);
    } catch (err) {
      req.log.error({ err }, 'trial failed');
      return reply.code(502).send({ error: 'trial_engine_failed', message: 'The eye blinked. Try again.' });
    }

    result.source_url = source_url;
    result.source_title = source_title;

    // Persist (best-effort; never blocks the response)
    if (supabase) {
      supabase.from('argeye_trials').insert({
        ip_hash: req.ipHash,
        input: result.input.slice(0, 2000),
        claim: result.claim,
        domain: result.domain,
        conviction: result.conviction,
        verdict: result.verdict,
        payload: result,
        source_url,
      }).then(({ error }) => {
        if (error) req.log.warn({ error }, 'supabase insert failed');
      });
    }

    return reply.send(result);
  });

  // Pulse stub — most-trialed claims (powers the Pulse panel later)
  fastify.get('/api/pulse', async (req, reply) => {
    if (!supabase) return reply.send({ trending: [] });
    const { data, error } = await supabase
      .from('argeye_trials')
      .select('claim, domain, conviction, verdict, created_at')
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) return reply.send({ trending: [] });
    return reply.send({ trending: data || [] });
  });
}
