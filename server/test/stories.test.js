import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { cast } from '../src/cast.js';

test('stories: three vertical packs, every {{token}} is defined by the cast + tools', () => {
  const { verticals } = JSON.parse(fs.readFileSync(new URL('../data/stories.json', import.meta.url), 'utf8'));
  assert.equal(Object.keys(verticals).length, 3);
  const c = cast();
  const defined = {
    '{{cast.brand}}': c.brand, '{{cast.personName}}': c.personName, '{{cast.agentId}}': c.agentId, '{{cast.host}}': c.host,
    '{{tool.get_balance}}': 'get_balance', '{{tool.list_transactions}}': 'list_transactions', '{{tool.transfer}}': 'transfer',
  };
  for (const [name, v] of Object.entries(verticals)) {
    for (const field of ['brand', 'person', 'captureStory']) {
      for (const [token, value] of Object.entries(defined)) {
        if (String(v[field]).includes(token)) assert.ok(value !== undefined, `${name}/${field}: undefined token ${token}`);
      }
    }
    assert.match(v.captureStory, /\S/, `${name}: empty capture story`);
  }
});
