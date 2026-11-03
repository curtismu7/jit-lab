// Builds content-pack.json from the tool data.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { tools } = JSON.parse(fs.readFileSync(path.join(ROOT, 'server/data/scenarios.json'), 'utf8'));
const { version } = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const src = (id, title, use) => ({ id, title, url: `https://www.rfc-editor.org/rfc/${id}`, kind: 'standard', use, status: 'read', checked: '2026-11-03' });

export function buildPack() {
  return {
    schema: 'demo-content-pack/1',
    id: 'jit-lab',
    title: 'JIT Ephemeral Credentials LAB',
    version,
    demo: { id: 'jit-lab', name: 'JIT Ephemeral Credentials LAB', catalog: 'D112', baseUrl: 'http://localhost:7570', doctor: '/api/health', tags: ['jit', 'ephemeral-credentials', 'token-lifetime', 'tool-binding', 'agent-controls', 'mock', 'real'] },
    glossary: [
      { id: 'standing', term: 'Standing credential', definition: 'One long-lived token the agent holds for days or weeks. A captured copy stays useful until it expires - the standing risk.' },
      { id: 'jit', term: 'Just-in-time (JIT) credential', definition: 'A credential minted at request time for one call: short TTL, tool-bound scope. A captured copy is dead within minutes.' },
      { id: 'tool-binding', term: 'Tool binding', definition: 'The credential names the one tool it may call. Even within its short life it cannot be replayed against a different tool.' },
      { id: 'ttl', term: 'TTL', definition: 'Time to live: how long a credential works. The lab compares 30 days (standing) against 300 seconds (JIT) at capture + minutes-to-hours.' },
      { id: 'capture', term: 'Captured credential', definition: 'A token an attacker copied at time T. The only question that matters: is it still useful at T + N? Short TTLs shrink that window to nothing.' },
      { id: 'revocation', term: 'Tool revocation', definition: 'Revoking a tool at the issuer refuses even a fresh JIT credential for it - revocation and TTL are independent controls.' },
    ],
    cards: tools.map((t) => ({ id: `tool-${t.id}`, label: t.id, description: `scope ${t.scope}`, group: 'try-it', action: { type: 'route', href: '/' } })),
    sources: [
      src('8693', 'RFC 8693 Token Exchange', 'the delegation the delegated token rides on'),
      src('9449', 'RFC 9449 DPoP', 'what sender-constraining adds on top of a short TTL'),
    ],
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  fs.writeFileSync(path.join(ROOT, 'content-pack.json'), JSON.stringify(buildPack(), null, 2) + '\n');
  console.log('content-pack.json written');
}
