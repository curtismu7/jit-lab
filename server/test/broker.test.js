import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, TOOLS, STANDING_TTL_S, JIT_TTL_S } from '../src/broker.js';
import { jwtDecode } from './decode.js';

test('standing credential: 30-day TTL, minted once and reused', async () => {
  const w = createWorld();
  const a = await w.standing();
  assert.equal(a.claims.exp - a.claims.iat, STANDING_TTL_S);
  const b = await w.standing();
  assert.equal(b.token, a.token, 'the standing credential is reused - that is the risk');
  assert.equal(b.reused, true);
});

test('JIT credential: 300 s TTL, per call, tool-bound scope', async () => {
  const w = createWorld();
  const a = await w.jit('get_balance');
  assert.equal(a.claims.exp - a.claims.iat, JIT_TTL_S);
  assert.equal(a.claims.scope, 'checking:read');
  assert.equal(a.claims.tool, 'get_balance');
  const b = await w.jit('transfer');
  assert.notEqual(b.token, a.token, 'every call mints a fresh credential');
  assert.equal(b.claims.scope, 'transfer:write');
});

test('the attack: standing survives capture + 1 h; JIT is dead', async () => {
  const w = createWorld();
  const s = await w.attack('standing', 'get_balance', { captureAgeS: 3600 });
  assert.equal(s.accepted, true);
  assert.match(s.why, /still valid/);
  const j = await w.attack('jit', 'get_balance', { captureAgeS: 3600 });
  assert.equal(j.accepted, false);
  assert.match(j.why, /expired/);
});

test('revoked tool refuses even a fresh JIT credential', async () => {
  const w = createWorld();
  w.revokeTool('transfer');
  const r = await w.attack('jit', 'transfer', { captureAgeS: 0 });
  assert.equal(r.accepted, false);
  assert.match(r.why, /revoked/);
});

test('decoded JIT claims name the one tool', async () => {
  const w = createWorld();
  const j = await w.jit('list_transactions');
  const claims = jwtDecode(j.token);
  assert.equal(claims.tool, 'list_transactions');
  assert.equal(claims.cdm, 'jit');
});
