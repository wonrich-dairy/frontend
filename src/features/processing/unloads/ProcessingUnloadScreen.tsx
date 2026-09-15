import { useEffect, useState } from "react";
import { ApiError } from "../../../api/http";
import { listTanks, type ProcessingTank } from "../../../api/processing/tanks";
import { useSession } from "../../../auth/sessionStore";

export function ProcessingUnloadScreen() {
  const { session } = useSession();
  const token = (session as any)?.accessToken ?? null;

  const [tanks, setTanks] = useState<ProcessingTank[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    const abort = new AbortController();
    listTanks(token, abort.signal, "Storing", true).then(setTanks).catch((e) => { if (!abort.signal.aborted) setFailure(e instanceof ApiError ? e.message : "Could not load tanks"); });
    return () => abort.abort();
  }, [token]);

  return (
    <>
      <div className="pagehead">
        <h1 className="pagehead__title">Unloading Bay</h1>
        <p className="pagehead__detail">Bowser arrival, sensory check, dispatch ID, unload to storing tank in KG</p>
      </div>

      {failure && <p className="notice notice--error">{failure}</p>}

      <section className="card">
        <h3 style={{ margin: 0, fontSize: 14 }}>Unload a Bowser</h3>
        <p className="card__footnote">Coming in SCRUM-62: sensory smell/taste/color BEFORE unload, temp 1-3C deviation flag, capacity check RemainingKg transactional.</p>

        <label className="field">
          <span className="field__label">Dispatch Note (MCC dispatch ID must exist)</span>
          <div className="field__wrap"><input placeholder="DISP-2024-001" /></div>
        </label>

        <label className="field">
          <span className="field__label">Storing Tank (Active only)</span>
          <select>
            <option>Choose a tank...</option>
            {tanks?.map((t) => (<option key={t.id} value={t.id}>{t.code} - {t.name} - {t.availableKg.toFixed(0)} KG free</option>))}
          </select>
          {tanks?.length === 0 && <span className="field__hint">No storing tank is in service. Configure one before recording a load.</span>}
        </label>

        <label className="field">
          <span className="field__label">Quantity measured (KG)</span>
          <div className="field__wrap"><input inputMode="decimal" placeholder="2500" /></div>
        </label>

        <label className="field">
          <span className="field__label">Arrival temperature (C)</span>
          <div className="field__wrap"><input inputMode="decimal" placeholder="4" /></div>
        </label>

        <button type="button" className="button button--wide" style={{ marginTop: 12 }} disabled>Record Unload (62)</button>
      </section>

      <div className="section">
        <div className="section__head"><h2 className="section__title">Recent Unloads</h2></div>
        <p className="emptystate">Nothing has been unloaded at this factory yet.</p>
      </div>
    </>
  );
}
