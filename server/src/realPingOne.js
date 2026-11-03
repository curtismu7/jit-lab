// Real mode: your PingOne tenant mints the standing-pattern credential (client credentials for the
// agent, TTL as configured on the app). The captured-credential replay comparison then runs the
// same way as in Mock: the standing token is still alive at capture + 1 h - the risk, shown for real.
// The JIT pattern is mock-only teaching: per-call tool-bound minting is the lab's own broker.
import { loadSharedEnv } from './env.js';
import crypto from 'node:crypto';

const form = (obj) => new URLSearchParams(obj).toString();

export async function realStanding({ fetchFn = fetch, env = process.env } = {}) {
  const e = { ...env, ...loadSharedEnv() };
  const envId = e.PINGONE_ENVIRONMENT_ID;
  const clientId = e.PINGONE_WORKER_CLIENT_ID || e.PINGONE_WORKER_ID;
  const secret = e.PINGONE_WORKER_CLIENT_SECRET || e.PINGONE_WORKER_SECRET;
  const key = `${clientId}:${secret}`;
  const r = await fetchFn(`https://auth.pingone.com/${envId}/as/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: `Basic ${Buffer.from(key).toString('base64')}` },
    body: form({ grant_type: 'client_credentials', scope: e.JIT_LAB_AGENT_SCOPE || 'agent:identity' }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`PingOne answered HTTP ${r.status}: ${j.error ?? ''} ${j.error_description ?? ''}`.trim());
  const sha8 = (t) => `sha256 ${crypto.createHash('sha256').update(t).digest('hex').slice(0, 8)} (hash only)`;
  return {
    ok: true, real: true,
    tokenSha: sha8(j.access_token), tokenBody: null,
    claims: { expires_in: j.expires_in, scope: j.scope, token_type: j.token_type },
    ttlSeconds: j.expires_in,
  };
}
