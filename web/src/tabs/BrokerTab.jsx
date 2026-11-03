// One screen: mint standing vs JIT, replay the captured credential at capture + N, and the tools
// table of who holds what. The standing credential is reused on every mint - visibly, that is the risk.
import { useState } from "react";
import { mint, attack, revokeTool } from "../lib/api.js";

const TTL = (s) => (s >= 86400 ? `${Math.round(s / 86400)} days` : `${s}s`);
const OUTCOME = (accepted) => (accepted ? "ACCEPTED" : "REFUSED");

function Row({ r }) {
  return (
    <tr data-testid="attack-row" data-outcome={r.accepted ? "accepted" : "refused"}>
      <td>{r.kind === "standing" ? "Standing (30 days)" : "JIT (300 s)"}</td>
      <td>{r.tool}</td>
      <td>{Math.round(r.captureAgeS / 60)} min</td>
      <td><span className="pill" data-state={r.accepted ? "ok" : "bad"}>{OUTCOME(r.accepted)}</span></td>
      <td className="muted small">{r.why}</td>
    </tr>
  );
}

export default function BrokerTab({ catalog, history, setHistory, busy, setBusy, error, setError, onNotify, source }) {
  const [tool, setTool] = useState(catalog?.tools?.[0]?.id ?? "get_balance");
  const [captureAgeS, setCaptureAgeS] = useState(3600);
  const [standing, setStanding] = useState(null);
  const [jit, setJit] = useState(null);
  const doMint = async (kind) => {
    setBusy(true); setError(null);
    try {
      const r = await mint(kind, tool);
      if (kind === "standing") setStanding(r); else setJit(r);
      onNotify?.(`${kind} credential minted (TTL ${TTL(r.ttlS)}).`);
    } catch (e) { setError(e.message); }
    setBusy(false);
  };
  const doAttack = async (kind) => {
    setBusy(true); setError(null);
    try {
      const r = await attack(kind, tool, captureAgeS);
      setHistory((h) => [r, ...h].slice(0, 12));
      onNotify?.(`${kind}: ${OUTCOME(r.accepted)} at capture + ${Math.round(captureAgeS / 60)} min.`);
    } catch (e) { setError(e.message); }
    setBusy(false);
  };
  const doRevoke = async () => {
    setBusy(true);
    try { await revokeTool(tool); onNotify?.(`${tool} revoked at the issuer.`); }
    catch (e) { setError(e.message); }
    setBusy(false);
  };
  const tools = catalog?.tools ?? [];
  return (
    <section aria-label="Credential broker" className="stack">
      <div className="field">
        <label htmlFor="tool">Tool the agent is about to call</label>
        <select id="tool" value={tool} onChange={(e) => setTool(e.target.value)} data-testid="tool-pick">
          {tools.map((t) => <option key={t.id} value={t.id}>{t.id} ({t.scope})</option>)}
        </select>
      </div>
      <div className="head__tools">
        <button type="button" className="btn" onClick={() => doMint("standing")} disabled={busy} data-testid="mint-standing">Mint standing credential ({TTL(catalog?.standingTtlS ?? 2592000)})</button>
        <button type="button" className="btn primary" onClick={() => doMint("jit")} disabled={busy} data-testid="mint-jit">Mint JIT credential ({TTL(catalog?.jitTtlS ?? 300)})</button>
        <button type="button" className="btn" onClick={doRevoke} disabled={busy} data-testid="revoke-tool">Revoke this tool at the issuer</button>
      </div>
      {standing ? (
        <div className="card" data-testid="standing-card">
          <h4>Standing credential {standing.reused ? "(reused - minted once, held ever since)" : "(freshly minted, held from now on)"}</h4>
          <p className="muted small">scope: {standing.claims?.scope} · TTL {TTL(standing.ttlS)} · {source === "real" ? "sha256/8 only" : standing.token?.slice(0, 40) + "…"}</p>
        </div>
      ) : null}
      {jit ? (
        <div className="card" data-testid="jit-card">
          <h4>JIT credential for {jit.claims?.tool}</h4>
          <p className="muted small">scope: {jit.claims?.scope} · TTL {TTL(jit.ttlS)} · {source === "real" ? "sha256/8 only" : jit.token?.slice(0, 40) + "…"}</p>
        </div>
      ) : null}
      <div className="field">
        <label htmlFor="capture">Attacker replays the captured credential after: {Math.round(captureAgeS / 60)} min</label>
        <input id="capture" type="range" min="0" max="86400" step="300" value={captureAgeS}
          onChange={(e) => setCaptureAgeS(Number(e.target.value))} data-testid="capture-slider" />
      </div>
      <div className="head__tools">
        <button type="button" className="btn" onClick={() => doAttack("standing")} disabled={busy} data-testid="attack-standing">Replay the standing credential</button>
        <button type="button" className="btn" onClick={() => doAttack("jit")} disabled={busy} data-testid="attack-jit">Replay the JIT credential</button>
      </div>
      {error ? <p className="alert" role="alert">{error}</p> : null}
      {history.length ? (
        <table className="bakeoff" data-testid="attack-table">
          <thead><tr><th scope="col">Credential</th><th scope="col">Tool</th><th scope="col">Captured</th><th scope="col">Replay</th><th scope="col">Why</th></tr></thead>
          <tbody>{history.map((r, i) => <Row key={`${r.kind}-${i}`} r={r} />)}</tbody>
        </table>
      ) : <p className="muted" role="status">Mint both, then replay each at capture + 1 h: one is still accepted, the other died {Math.round((3600 - (catalog?.jitTtlS ?? 300)) / 60)} minutes earlier.</p>}
    </section>
  );
}
