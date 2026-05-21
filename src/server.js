import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { createHash } from 'node:crypto';
import trialRoutes from './routes/trial.js';

const fastify = Fastify({
  logger: { level: process.env.LOG_LEVEL || 'info' },
  trustProxy: true, // Railway sits behind a proxy
});

await fastify.register(cors, {
  origin: (process.env.ALLOWED_ORIGINS || 'https://argeye.xyz,http://localhost:3000,http://localhost:5500')
    .split(',')
    .map((s) => s.trim()),
  methods: ['GET', 'POST'],
});

await fastify.register(rateLimit, {
  global: false,
  max: 60,
  timeWindow: '1 minute',
  keyGenerator: (req) => req.ipHash || req.ip,
});

// Privacy-friendly per-IP identity for rate limiting + dedupe (never store raw IP).
fastify.addHook('onRequest', async (req) => {
  const ip = req.ip || 'unknown';
  req.ipHash = createHash('sha256').update(ip + (process.env.IP_SALT || 'argeye')).digest('hex').slice(0, 16);
});

fastify.get('/', async () => ({
  service: 'ARGEYE Trial Engine',
  status: 'watching',
  eyes: 100,
  version: '0.1.0',
}));

fastify.get('/health', async () => ({ ok: true, ts: Date.now() }));

await fastify.register(trialRoutes);

const port = process.env.PORT || 3000;
fastify.listen({ port, host: '0.0.0.0' })
  .then(() => fastify.log.info(`👁  ARGEYE watching on :${port}`))
  .catch((err) => { fastify.log.error(err); process.exit(1); });
