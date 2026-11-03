// The JIT credential broker, mock only in Mock mode. The comparison the lab teaches:
//
//   STANDING credential: the agent holds one long-lived token (TTL 30 days). Minted once.
//   JIT credential:      per-call, tool-bound, TTL 300 s by default. Minted at request time,
//                        names the one tool it may call, dies within minutes.
//
// Same attack run against both: a credential captured at T is replayed at T + CAPTURE_AGE_S.
// The standing token still works (the whole problem); the JIT token is dead. Real mode issues
// the standing pattern against your own PingOne tenant for comparison (owner-configured); the
// per-call pattern is a mock-only teaching shape because PingOne's JIT story is the exchange
// with a tight TTL, which the mock engine demonstrates exactly.
import { fixtureSigner, createVerifier } from './jwt.js';
import { cast } from './cast.js';

const ISSUER = 'https://mock-as.invalid';
const now = () => Math.floor(Date.now() / 1000);

export const TOOLS = [
  { id: 'get_balance', scope: 'checking:read' },
  { id: 'list_transactions', scope: 'checking:read' },
  { id: 'transfer', scope: 'transfer:write' },
];

export const STANDING_TTL_S = 30 * 24 * 3600; // 30 days: the standing risk
export const JIT_TTL_S = 300;                 // five minutes

export function createWorld() {
  const state = { minted: [], runs: [], revokedTools: new Set() };
  const verifier = createVerifier();
  const mint = async (claims) => fixtureSigner(claims, 'mock');
  return {
    state,
    reset() { state.minted = []; state.runs = []; state.revokedTools = new Set(); },
    revokeTool(id) { state.revokedTools.add(id); },
    // Mint the standing credential once (or reuse it - that is the point).
    async standing() {
      if (state.standingToken && state.standingClaims.exp > now() + 60) return { token: state.standingToken, claims: state.standingClaims, reused: true };
      const iat = now();
      const c = cast();
      const claims = {
        iss: ISSUER, sub: 'agent.007', aud: `https://api.${c.host}.example`, client_id: c.agentId,
        scope: TOOLS.map((t) => t.scope).join(' '), iat, exp: iat + STANDING_TTL_S, cdm: 'standing',
      };
      const token = await mint(claims);
      state.standingToken = token; state.standingClaims = claims;
      state.minted.push({ kind: 'standing', at: iat });
      return { token, claims, reused: false };
    },
    // Mint a JIT credential: one call, one tool, 300 s.
    async jit(toolId) {
      const tool = TOOLS.find((t) => t.id === toolId);
      if (!tool) throw new Error(`unknown tool ${toolId}`);
      const iat = now();
      const c = cast();
      const claims = {
        iss: ISSUER, sub: 'agent.007', aud: `https://api.${c.host}.example`, client_id: c.agentId,
        scope: tool.scope, iat, exp: iat + JIT_TTL_S, cdm: 'jit', tool: tool.id,
      };
      const token = await mint(claims);
      state.minted.push({ kind: 'jit', tool: tool.id, at: iat });
      return { token, claims };
    },
    // The attack: replay a captured token after CAPTURE_AGE_S. The mock clock advances the token
    // deterministically (exp pushed into the past) rather than sleeping.
    async attack(kind, toolId, { captureAgeS = 3600 } = {}) {
      const tool = TOOLS.find((t) => t.id === toolId) ?? TOOLS[0];
      let token, claims;
      if (kind === 'standing') { const s = await this.standing(); token = s.token; claims = s.claims; }
      else { const j = await this.jit(tool.id); token = j.token; claims = j.claims; }
      const replayed = { ...claims, iat: claims.iat, exp: claims.iat + captureAgeS < claims.exp ? claims.exp : claims.iat + captureAgeS };
      // replay at now + captureAgeS: shift exp by simulating the clock. For the JIT token
      // (300 s) an hour later it is long dead; for the standing token (30 days) it is fine.
      const replayToken = await fixtureSigner({ ...claims, iat: claims.iat - captureAgeS, exp: claims.exp - captureAgeS }, 'replay');
      const v = verifier(replayToken, { aud: claims.aud, now: claims.iat + captureAgeS });
      const vFresh = verifier(token, { aud: claims.aud });
      const revokedTool = kind === 'jit' && state.revokedTools.has(tool.id);
      const accepted = kind === 'standing' ? vFresh.ok : (v.ok && !revokedTool);
      const why = kind === 'standing'
        ? 'still valid: 30 days remain. This is the standing risk - the captured credential is as good as the original.'
        : revokedTool
          ? `dead twice over: the 300 s TTL expired ${Math.round((captureAgeS - JIT_TTL_S) / 60)} min before the replay, and the tool was revoked.`
          : `dead: the 300 s TTL expired ${Math.round((captureAgeS - JIT_TTL_S) / 60)} min before the replay.`;
      const run = { kind, tool: tool.id, captureAgeS, accepted, why, capturedExp: claims.exp, replayedAt: claims.iat + captureAgeS };
      state.runs.push(run);
      return run;
    },
  };
}
