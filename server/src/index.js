import { installNetguard } from './netguard.js';
import { createApp } from './app.js';
import { allPassed, runChecks } from './doctor.js';
import { assertBindAllowed, bindHost, resolvePort } from './safety.js';

installNetguard(); // before anything else can open a socket

const checks = await runChecks();
if (!allPassed(checks)) {
  for (const c of checks.filter((x) => x.level === 'fail')) console.error(`[jit-lab] refusing to start: ${c.id}: ${c.detail}`);
  process.exit(1);
}
const host = assertBindAllowed(bindHost(), process.env);
const port = resolvePort();
const server = createApp().listen(port, host, () => {
  console.log(`[jit-lab] credentials lab at http://${host}:${port} (loopback; the credentials broker is SIMULATED in Mock mode, no outbound network)`);
  console.log(`[jit-lab] health: /api/health | catalog: /api/catalog | mint: POST /api/mint | attack: POST /api/attack`);
});
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.close(() => process.exit(0)));
