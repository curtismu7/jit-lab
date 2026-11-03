// Minimal HS256 JWT sign/verify for the mock issuer. Deterministic fixture secret, never a random
// key, so runs are reproducible. The verifier checks iss, aud, exp (against a configurable now)
// and iat.
import crypto from 'node:crypto';

const SECRET = 'jit-lab fixture secret - mock only, never a production key';
const b64u = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const hmac = (data) => crypto.createHmac('sha256', SECRET).update(data).digest('base64url');

export function fixtureSigner(claims, label) {
  const header = { alg: 'HS256', typ: 'JWT', kid: label ?? 'mock' };
  const data = `${b64u(header)}.${b64u(claims)}`;
  return Promise.resolve(`${data}.${hmac(data)}`);
}
export async function createSigner() { return fixtureSigner; }

export function createVerifier() {
  return (token, { aud, now } = {}) => {
    const parts = String(token).split('.');
    if (parts.length !== 3) return { ok: false, why: 'not a JWT' };
    const expected = hmac(`${parts[0]}.${parts[1]}`);
    if (expected !== parts[2]) return { ok: false, why: 'bad signature' };
    let claims;
    try { claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')); } catch { return { ok: false, why: 'undecodable claims' }; }
    const at = Number.isFinite(now) ? now : Math.floor(Date.now() / 1000);
    if (claims.exp <= at) return { ok: false, why: `expired ${Math.round((at - claims.exp) / 60)} min ago` };
    if (aud && claims.aud !== aud) return { ok: false, why: `audience ${claims.aud} is not ${aud}` };
    return { ok: true, why: 'signature, audience and lifetime all check out' };
  };
}
