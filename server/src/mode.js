// Mock / Real. Rule 19: runtime server-side mode, POST /api/mode with exactly {source}, GET /api/info
// returns {source, realAvailable, realReason}. Default: Real if configured, else Mock.
// Real = your own PingOne tenant mints the standing-pattern credential (owner-configured Worker);
// the JIT-vs-standing attack comparison runs identically. The shared ~/Development/.env carries the
// credentials; the secret is write-only, never returned.
import { loadSharedEnv } from './env.js';

export const MODES = ['mock', 'real'];

export function realConfigured(env = process.env) {
  const e = { ...env, ...loadSharedEnv() };
  return Boolean(e.PINGONE_ENVIRONMENT_ID && (e.PINGONE_WORKER_CLIENT_ID || e.PINGONE_WORKER_ID) && (e.PINGONE_WORKER_CLIENT_SECRET || e.PINGONE_WORKER_SECRET));
}

export const NO_REAL = 'Real mode is not configured. Set PINGONE_ENVIRONMENT_ID and the Worker app client id + secret in ~/Development/.env, then restart the lab. Agents never use live credentials; the owner sets them.';

export function createMode({ env = process.env, forceMock = false } = {}) {
  const canReal = !forceMock && realConfigured(env);
  const state = { source: canReal ? 'real' : 'mock' };
  return {
    info: () => ({ source: state.source, realAvailable: canReal, realReason: canReal ? null : NO_REAL }),
    source: () => state.source,
    set: (source) => { state.source = source; },
  };
}
