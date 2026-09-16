import { useEffect, useRef, useState, useMemo } from "react";
import { ApiError } from "../../../api/http";
import { listTanks, type ProcessingTank } from "../../../api/processing/tanks";
import { validateDispatch, listRecentDispatches, type DispatchValidationDto, type MccDispatchDto } from "../../../api/processing/mccDispatches";
import { createUnload, listRuns, type ProcessingRunDto } from "../../../api/processing/runs";
import { getQualityStatus, getQualityResult, type QualityStatusDto, type QualityPanelDto } from "../../../api/processing/qualityTests";
import { useSession } from "../../../auth/sessionStore";
import { useNavigation } from "../../../app/navigationStore";
import { QualityPanelReadonly } from "../quality/QualityPanelReadonly";

export function ProcessingUnloadScreen() {
  const { session } = useSession();
  const { query, navigate } = useNavigation();
  const token = (session as any)?.accessToken ?? null;

  const [tanks, setTanks] = useState<ProcessingTank[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form
  const [dispatchId, setDispatchId] = useState("");
  const [dispatchValidation, setDispatchValidation] = useState<DispatchValidationDto | null>(null);
  const [dispatchChecking, setDispatchChecking] = useState(false);
  const [recentDispatches, setRecentDispatches] = useState<MccDispatchDto[] | null>(null);
  const [storingTankId, setStoringTankId] = useState("");
  const [quantityKg, setQuantityKg] = useState("");
  const [temperatureC, setTemperatureC] = useState("");
  const [smellOk, setSmellOk] = useState(false);
  const [colourOk, setColourOk] = useState(false);
  const [tasteOk, setTasteOk] = useState(false);
  const [saving, setSaving] = useState(false);

  const [recentRuns, setRecentRuns] = useState<ProcessingRunDto[] | null>(null);

  // Auto-refresh for Problem 3
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [statusChangedNotification, setStatusChangedNotification] = useState<string | null>(null);
  const prevStatusRef = useRef<string | null>(null);

  // Selected dispatch quality view
  const selectedDispatchParam = query.get("dispatch");
  const [qualityStatus, setQualityStatus] = useState<QualityStatusDto | null>(null);
  const [qualityPanel, setQualityPanel] = useState<QualityPanelDto | null>(null);
  const [qualityLoading, setQualityLoading] = useState(false);
  const [qualityFailure, setQualityFailure] = useState<string | null>(null);

  // Load tanks
  useEffect(() => {
    const abort = new AbortController();
    listTanks(token, abort.signal, "Storing", true)
      .then(setTanks)
      .catch((e) => { if (!abort.signal.aborted) setFailure(e instanceof ApiError ? e.message : "Could not load tanks"); });
    return () => abort.abort();
  }, [token]);

  // Load recent MCC dispatches
  const loadRecentDispatches = () => {
    const abort = new AbortController();
    listRecentDispatches(token, abort.signal, 20)
      .then(setRecentDispatches)
      .catch(() => setRecentDispatches([]));
    return () => abort.abort();
  };

  useEffect(() => { return loadRecentDispatches(); }, [token]);

  // Load recent unloads
  const loadRuns = () => {
    const abort = new AbortController();
    listRuns(token, abort.signal)
      .then((runs) => {
        setRecentRuns(runs);
        setLastRefresh(new Date());
      })
      .catch(() => setRecentRuns([]));
    return () => abort.abort();
  };

  useEffect(() => { return loadRuns(); }, [token]);

  // Problem 3 FIX: Auto-refresh polling every 10s for recent unloads + recent dispatches
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadRuns();
      loadRecentDispatches();
    }, 10000);
    return () => clearInterval(interval);
  }, [token, autoRefresh]);

  // Calculate already unloaded per dispatch from recentRuns for partial unload support
  const unloadedByDispatch = useMemo(() => {
    const map = new Map<string, number>();
    recentRuns?.forEach(r => {
      const key = r.dispatchNumber.toUpperCase();
      map.set(key, (map.get(key) ?? 0) + r.quantityKg);
    });
    return map;
  }, [recentRuns]);

  // Live dispatch validation with debounce + PARTIAL UNLOAD support
  useEffect(() => {
    if (!dispatchId.trim()) {
      setDispatchValidation(null);
      return;
    }
    const normalized = dispatchId.trim().toUpperCase();
    if (normalized.length < 3) {
      setDispatchValidation(null);
      return;
    }
    const controller = new AbortController();
    setDispatchChecking(true);
    const timer = setTimeout(async () => {
      try {
        const res = await validateDispatch(normalized, token, controller.signal);
        setDispatchValidation(res);
      } catch (e) {
        if (!controller.signal.aborted) {
          setDispatchValidation({
            dispatchNumber: normalized,
            exists: false,
            validFormat: false,
            message: e instanceof ApiError ? e.message : "Could not validate dispatch",
          });
        }
      } finally {
        setDispatchChecking(false);
      }
    }, 400);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [dispatchId, token]);

  // Load quality status for selected dispatch
  const loadQualityForSelected = (showLoading = true) => {
    if (!selectedDispatchParam) return;
    const dispatch = selectedDispatchParam.trim().toUpperCase();
    if (showLoading) setQualityLoading(true);
    setQualityFailure(null);

    const abort = new AbortController();
    getQualityStatus(dispatch, token, abort.signal)
      .then((status) => {
        if (prevStatusRef.current && prevStatusRef.current !== status.qualityTestStatus) {
          setStatusChangedNotification(`Quality status for ${status.dispatchNumber} changed: ${prevStatusRef.current} → ${status.qualityTestStatus}`);
          setTimeout(() => setStatusChangedNotification(null), 6000);
        }
        prevStatusRef.current = status.qualityTestStatus;
        setQualityStatus(status);
        if (status.hasResult) {
          return getQualityResult(dispatch, token, abort.signal)
            .then(setQualityPanel)
            .catch((e) => {
              if (status.qualityTestStatus === "Pending" || status.qualityTestStatus === "InProgress") {
                setQualityPanel(null);
              } else {
                setQualityFailure(e instanceof ApiError ? e.message : "Could not load quality result");
              }
            });
        } else {
          setQualityPanel(null);
        }
      })
      .catch((e) => {
        if (!abort.signal.aborted) {
          setQualityFailure(e instanceof ApiError ? e.message : "Quality test not found for this dispatch");
        }
      })
      .finally(() => { if (showLoading) setQualityLoading(false); });

    return () => abort.abort();
  };

  useEffect(() => {
    if (!selectedDispatchParam) {
      setQualityStatus(null);
      setQualityPanel(null);
      setQualityFailure(null);
      prevStatusRef.current = null;
      return;
    }
    return loadQualityForSelected(true);
  }, [selectedDispatchParam, token]);

  useEffect(() => {
    if (!selectedDispatchParam || !autoRefresh) return;
    const interval = setInterval(() => {
      loadQualityForSelected(false);
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedDispatchParam, token, autoRefresh]);

  const selectedTank = tanks?.find((t) => t.id === storingTankId) ?? null;
  const quantity = Number(quantityKg);
  const temperature = Number(temperatureC);

  // Partial unload logic
  const alreadyUnloadedKg = dispatchValidation?.alreadyUnloadedKg ?? unloadedByDispatch.get(dispatchId.trim().toUpperCase()) ?? 0;
  const remainingKg = dispatchValidation?.remainingKg;
  const isFullyUnloaded = dispatchValidation?.isFullyUnloaded ?? false;
  const totalDispatchKg = dispatchValidation?.quantityLitres ?? 0;

  const dispatchValid = dispatchValidation?.exists && dispatchValidation?.validFormat && !isFullyUnloaded;
  const sensoryOk = smellOk && colourOk && tasteOk;
  const tankOk = !!storingTankId && !!selectedTank;
  const quantityOk = Number.isFinite(quantity) && quantity > 0 && (!selectedTank || quantity <= selectedTank.availableKg) && (remainingKg == null || quantity <= remainingKg + 0.01);
  const tempOk = temperatureC.trim() !== "" && Number.isFinite(temperature);

  const complete = dispatchValid && sensoryOk && tankOk && quantityOk && tempOk;

  // Fix button remaining: should show remaining AFTER this unload, not before
  const remainingAfter = remainingKg != null && Number.isFinite(quantity) && quantity > 0 ? Math.max(0, remainingKg - quantity) : remainingKg;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complete || saving) return;
    setSaving(true);
    setFailure(null);
    setSuccess(null);
    try {
      const run = await createUnload(
        {
          dispatchNumber: dispatchId.trim().toUpperCase(),
          storingTankId,
          quantityKg: quantity,
          temperatureC: temperature,
          smellOk,
          colourOk,
          tasteOk,
        },
        token
      );
      const remainingAfter = remainingKg != null ? remainingKg - quantity : null;
      const remainingMsg = remainingAfter != null && remainingAfter > 0.01 ? ` - Remaining for ${run.dispatchNumber}: ${remainingAfter.toFixed(0)} KG can still be unloaded to another tank` : ` - Fully unloaded`;
      setSuccess(`Unloaded ${run.dispatchNumber} to ${selectedTank?.code} - ${quantity.toFixed(0)} KG - Quality status: ${run.qualityTestStatus}${remainingMsg}`);
      setDispatchId("");
      setDispatchValidation(null);
      setStoringTankId("");
      setQuantityKg("");
      setTemperatureC("");
      setSmellOk(false);
      setColourOk(false);
      setTasteOk(false);
      loadRuns();
      loadRecentDispatches();
      navigate(`/processing/unloads?dispatch=${encodeURIComponent(run.dispatchNumber)}`);
    } catch (err: any) {
      setFailure(err.message);
    } finally {
      setSaving(false);
    }
  };

  const clearSelectedDispatch = () => {
    navigate("/processing/unloads");
  };

  return (
    <>
      <div className="pagehead">
        <h1 className="pagehead__title">Unloading Bay</h1>
        <p className="pagehead__detail">Bowser arrival, sensory BEFORE unload, dispatch ID must exist in MCC, unload to storing tank in KG - supports splitting one dispatch across multiple tanks</p>
      </div>

      {failure && <p className="notice notice--error">{failure}</p>}
      {success && <p className="notice" style={{ background: "#e6f4ea", border: "1px solid #b7e4c7", color: "#15803d", padding: 12, borderRadius: 8 }}>{success}</p>}

      {statusChangedNotification && (
        <p className="notice" style={{ background: "#eff6ff", border: "1px solid #3b82f6", color: "#1e40af", padding: 12, borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{statusChangedNotification}</span>
          <button type="button" className="button button--ghost button--small" onClick={() => setStatusChangedNotification(null)}>Dismiss</button>
        </p>
      )}

      {selectedDispatchParam && (
        <section className="card" style={{ marginBottom: 16, border: "1.5px solid var(--navy-800)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0, fontSize: 14 }}>Selected Unload: {selectedDispatchParam.toUpperCase()}</h3>
            <button type="button" className="iconbutton" onClick={clearSelectedDispatch} title="Close">X</button>
          </div>

          {qualityLoading && <p className="loading" style={{ marginTop: 12 }}>Loading quality status...</p>}

          {qualityFailure && (
            <div style={{ marginTop: 12 }}>
              <p className="notice notice--error">{qualityFailure}</p>
              <p className="card__footnote">This dispatch has no quality test yet. It may still be Pending.</p>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button type="button" className="button button--ghost button--small" onClick={clearSelectedDispatch}>Close</button>
              </div>
            </div>
          )}

          {qualityStatus && !qualityLoading && (
            <>
              {qualityStatus.qualityTestStatus === "Pending" && (
                <p className="notice" style={{ marginTop: 12, background: "#fffbeb", border: "1px solid #fcd34d", color: "#92400e", padding: 12, borderRadius: 8 }}>
                  Quality test not yet started for {qualityStatus.dispatchNumber}. Lab has not opened this card yet. Status: Pending - waiting for quality technician. Auto-refresh every 5s.
                </p>
              )}
              {qualityStatus.qualityTestStatus === "InProgress" && (
                <p className="notice" style={{ marginTop: 12, background: "#eff6ff", border: "1px solid #93c5fd", color: "#1e40af", padding: 12, borderRadius: 8 }}>
                  Lab is currently testing {qualityStatus.dispatchNumber}. Status: In Progress - please wait. Auto-refresh every 5s.
                </p>
              )}
              <div style={{ marginTop: 12 }}>
                <QualityPanelReadonly status={qualityStatus} panel={qualityPanel} />
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button type="button" className="button button--ghost button--small" onClick={clearSelectedDispatch}>Close</button>
              </div>
            </>
          )}
        </section>
      )}

      <form onSubmit={submit} noValidate>
        <section className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0, fontSize: 14 }}>Unload a Bowser - SCRUM 62 + Partial Unload</h3>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
              <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
              Auto-refresh {lastRefresh ? `(${lastRefresh.toLocaleTimeString()})` : ""}
            </label>
          </div>
          <p className="card__footnote">Sensory must PASS before unload. Dispatch ID live validated against MCC with remaining quantity. Supports splitting one dispatch across multiple tanks if tank capacity exceeded. Auto-refresh every 10s.</p>

          <label className="field">
            <span className="field__label">Dispatch Note (MCC Reference like DN-20260910-02)</span>
            <div className="field__wrap">
              <input
                value={dispatchId}
                placeholder="DN-20260910-02"
                onChange={(e) => setDispatchId(e.target.value)}
                disabled={saving}
                list="recent-dispatches"
              />
              <datalist id="recent-dispatches">
                {recentDispatches?.map((d) => (
                  <option key={d.reference} value={d.reference}>{d.bowserRegistration} - {d.totalQuantityLitres}L - {d.reference}</option>
                ))}
              </datalist>
            </div>
            {dispatchId && (
              dispatchChecking ? (
                <span className="field__hint">Checking MCC...</span>
              ) : dispatchValidation ? (
                <span className={`field__hint ${dispatchValidation.exists && !isFullyUnloaded ? "" : "field__hint--warning"}`}>
                  {dispatchValidation.message}
                  {alreadyUnloadedKg > 0 && totalDispatchKg > 0 && !isFullyUnloaded && ` - You can unload up to ${remainingKg?.toFixed(0)} KG more to another tank`}
                </span>
              ) : (
                <span className="field__hint">Type dispatch ID like DN-20260910-02</span>
              )
            )}
            {!dispatchId && recentDispatches && recentDispatches.length > 0 && (
              <span className="field__hint">Available MCC dispatches (not fully unloaded): {recentDispatches.slice(0, 3).map((d) => d.reference).join(", ")} - Auto-refresh every 10s - Supports partial unload</span>
            )}
            {!dispatchId && recentDispatches?.length === 0 && (
              <span className="field__hint">No available MCC dispatches - all have been fully unloaded or none in mccdb</span>
            )}
          </label>

          {alreadyUnloadedKg > 0 && remainingKg != null && remainingKg > 0.01 && !isFullyUnloaded && (
            <div style={{ marginTop: 12, padding: 10, background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: 8 }}>
              <span className="field__label" style={{ fontWeight: 700 }}>Partial Unload Detected</span>
              <p className="microlabel" style={{ marginTop: 4 }}>
                Dispatch {dispatchId.toUpperCase()} - Total: {totalDispatchKg.toFixed(0)} KG, Already unloaded: {alreadyUnloadedKg.toFixed(0)} KG, Remaining: {remainingKg?.toFixed(0)} KG
              </p>
              <p className="card__footnote" style={{ marginTop: 4 }}>This dispatch was previously split. You can unload remaining {remainingKg?.toFixed(0)} KG to another tank. If tank capacity exceeded, split again.</p>
            </div>
          )}
          {isFullyUnloaded && alreadyUnloadedKg > 0 && (
            <div style={{ marginTop: 12, padding: 10, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8 }}>
              <span className="field__label" style={{ fontWeight: 700, color: "#dc2626" }}>Fully Unloaded</span>
              <p className="microlabel" style={{ marginTop: 4, color: "#dc2626" }}>
                Dispatch {dispatchId.toUpperCase()} - Total: {totalDispatchKg.toFixed(0)} KG, Already unloaded: {alreadyUnloadedKg.toFixed(0)} KG, Remaining: 0 KG - Cannot unload again
              </p>
            </div>
          )}

          <div style={{ marginTop: 16, padding: 12, border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface-sunken)" }}>
            <span className="field__label">Sensory Checks BEFORE Unload (must all pass)</span>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
              <input type="checkbox" checked={smellOk} onChange={(e) => setSmellOk(e.target.checked)} disabled={saving} />
              <span style={{ fontSize: 14 }}>Smell OK</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
              <input type="checkbox" checked={colourOk} onChange={(e) => setColourOk(e.target.checked)} disabled={saving} />
              <span style={{ fontSize: 14 }}>Colour OK</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
              <input type="checkbox" checked={tasteOk} onChange={(e) => setTasteOk(e.target.checked)} disabled={saving} />
              <span style={{ fontSize: 14 }}>Taste OK</span>
            </label>
            {!sensoryOk && <span className="field__hint field__hint--warning" style={{ marginTop: 8, display: "block" }}>All 3 sensory must pass before unload per real process</span>}
          </div>

          <label className="field" style={{ marginTop: 16 }}>
            <span className="field__label">Storing Tank (Active only, must have free space)</span>
            <select value={storingTankId} onChange={(e) => setStoringTankId(e.target.value)} disabled={saving}>
              <option value="">Choose a tank...</option>
              {tanks?.map((t) => (
                <option key={t.id} value={t.id}>{t.code} - {t.name} - {t.availableKg.toFixed(0)} KG free / {t.capacityKg.toFixed(0)} KG</option>
              ))}
            </select>
            {tanks?.length === 0 && <span className="field__hint field__hint--warning">No storing tank is in service. Add one in Settings.</span>}
            {selectedTank && <span className="field__hint">Selected {selectedTank.code} - {selectedTank.availableKg.toFixed(0)} KG free {remainingKg != null ? ` - Dispatch remaining ${remainingKg.toFixed(0)} KG` : ""}</span>}
          </label>

          <label className="field">
            <span className="field__label">Quantity measured (KG) - 2 decimal {remainingKg != null ? `- Max ${remainingKg.toFixed(0)} KG remaining` : ""}</span>
            <div className="field__wrap"><input value={quantityKg} inputMode="decimal" placeholder={remainingKg != null ? remainingKg.toFixed(0) : "1500"} onChange={(e) => setQuantityKg(e.target.value)} disabled={saving} /></div>
            {selectedTank && quantityKg && !quantityOk && (
              <span className="field__hint field__hint--warning">
                {quantity > selectedTank.availableKg ? `Exceeds free space ${selectedTank.availableKg.toFixed(0)} KG - split to another tank` : remainingKg != null && quantity > remainingKg ? `Exceeds dispatch remaining ${remainingKg.toFixed(0)} KG` : ""}
              </span>
            )}
          </label>

          <label className="field">
            <span className="field__label">Arrival temperature (C) - 1-3°C ideal, deviation flagged</span>
            <div className="field__wrap"><input value={temperatureC} inputMode="decimal" placeholder="2.5" onChange={(e) => setTemperatureC(e.target.value)} disabled={saving} /></div>
            {temperatureC && Number.isFinite(temperature) && (temperature < 1 || temperature > 3) && (
              <span className="field__hint field__hint--warning">Deviation flagged: {temperature}°C not in 1-3°C ideal, but not blocked</span>
            )}
          </label>

          <button type="submit" className="button button--wide" style={{ marginTop: 12 }} disabled={!complete || saving}>
            {saving ? "Recording..." : remainingKg != null && alreadyUnloadedKg > 0 ? `Record Partial Unload - ${quantityKg || "0"} KG to ${selectedTank?.code || "tank"} (Remaining ${remainingAfter?.toFixed(0) ?? remainingKg.toFixed(0)} KG after)` : remainingKg != null ? `Record Unload - ${quantityKg || "0"} KG (Remaining ${remainingAfter?.toFixed(0) ?? remainingKg.toFixed(0)} KG after)` : "Record Unload"}
          </button>
        </section>
      </form>

      <div className="section" style={{ marginTop: 24 }}>
        <div className="section__head">
          <h2 className="section__title">Recent Unloads</h2>
          <span className="section__count">{recentRuns?.length ?? 0} {lastRefresh ? `• ${lastRefresh.toLocaleTimeString()}` : ""}</span>
        </div>
        {!recentRuns && <p className="loading">Loading...</p>}
        {recentRuns?.length === 0 && <p className="emptystate">Nothing unloaded yet. Use dispatch IDs DN-20260910-01 to 04 from mccdb.</p>}
        {recentRuns?.map((r) => {
          const totalForThisDispatch = unloadedByDispatch.get(r.dispatchNumber.toUpperCase()) ?? r.quantityKg;
          const isPartial = totalForThisDispatch !== r.quantityKg;
          return (
            <article key={r.id} className="tankrow" onClick={() => navigate(`/processing/unloads?dispatch=${encodeURIComponent(r.dispatchNumber)}`)} style={{ cursor: "pointer" }}>
              <header className="tankrow__head">
                <h2 className="tankrow__name">{r.dispatchNumber} {isPartial ? "(Split)" : ""}</h2>
                <span className={`badge ${r.qualityTestStatus === "Passed" ? "badge--good" : r.qualityTestStatus === "Failed" ? "badge--bad" : ""}`}>{r.qualityTestStatus}</span>
              </header>
              <p className="tankrow__status">{r.quantityKg.toFixed(0)} KG to {r.storingTankCode ?? "tank"} - {r.state} - {new Date(r.createdAtUtc).toLocaleString()} {isPartial ? ` - Total for ${r.dispatchNumber}: ${totalForThisDispatch.toFixed(0)} KG across tanks` : ""}</p>
              <p className="microlabel" style={{ marginTop: 4 }}>Click to view quality status and readonly panel - auto-refresh every 10s {isPartial ? "- This dispatch was split across multiple tanks" : ""}</p>
            </article>
          );
        })}
      </div>
    </>
  );
}
