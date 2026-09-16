import { useEffect, useState, useMemo } from "react";
import { ApiError } from "../../../api/http";
import { getTank, listTanks, createTemperatureLog, listTemperatureLogs, getLastTemperatureLog, type ProcessingTank, type TankTemperatureLogDto } from "../../../api/processing/tanks";
import { createAllocation, getRunsInStoringTank, type ProductType, type StoringTankRunDto } from "../../../api/processing/allocations";
import { listStagesByMixingTank, listActiveBatches, startStage, endStage, type ProcessingStageDto, type ActiveBatchDto, type StageType } from "../../../api/processing/stages";
import { formatColombo, formatLiveElapsed } from "../../../utils/time";
import { useSession } from "../../../auth/sessionStore";
import { useNavigation } from "../../../app/navigationStore";

const PRODUCT_OPTIONS: { value: ProductType; label: string }[] = [
  { value: "FM", label: "FM" },
  { value: "FLM", label: "FLM" },
  { value: "SY", label: "SY" },
  { value: "SK", label: "SK" },
  { value: "DY", label: "DY" },
];

const STAGE_ORDER: StageType[] = ["Heating", "Homogeniser", "Pasteuriser", "Cooling"];

function getPreSelected(alcoholResult?: string): ProductType[] {
  if (!alcoholResult) return ["SY", "SK", "FM", "FLM", "DY"];
  if (alcoholResult.includes("80%")) return ["FM", "FLM"];
  if (alcoholResult.includes("75%") || alcoholResult.includes("68%") || alcoholResult.includes("COB")) return ["SY", "SK", "DY"];
  return ["SY", "SK", "FM", "FLM", "DY"];
}

function getNextStage(stages: ProcessingStageDto[]): StageType | null {
  if (stages.length === 0) return "Heating";
  const lastEnded = [...stages].reverse().find(s => s.endTimeUtc);
  if (!lastEnded) return null; // active in progress
  const idx = STAGE_ORDER.indexOf(lastEnded.stageType as StageType);
  if (idx < 0 || idx >= STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[idx + 1];
}

interface Props {
  code?: string;
  id?: string;
}

export function ProcessingTankDetailScreen({ code, id }: Props) {
  const { session } = useSession();
  const { navigate } = useNavigation();
  const token = (session as any)?.accessToken ?? null;
  const identifier = id ?? code;

  const [tank, setTank] = useState<ProcessingTank | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [tempC, setTempC] = useState("");
  const [note, setNote] = useState("");
  const [tempSaving, setTempSaving] = useState(false);
  const [lastLog, setLastLog] = useState<TankTemperatureLogDto | null>(null);
  const [logs, setLogs] = useState<TankTemperatureLogDto[] | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const [showPour, setShowPour] = useState(false);
  const [mixingTanks, setMixingTanks] = useState<ProcessingTank[] | null>(null);
  const [runsInTank, setRunsInTank] = useState<StoringTankRunDto[] | null>(null);
  const [destTankId, setDestTankId] = useState("");
  const [quantityKg, setQuantityKg] = useState("");
  const [productType, setProductType] = useState<ProductType>("FM");
  const [overrideReason, setOverrideReason] = useState("");
  const [selectedRunId, setSelectedRunId] = useState("");
  const [pourSaving, setPourSaving] = useState(false);

  // MT processing
  const [activeBatch, setActiveBatch] = useState<ActiveBatchDto | null>(null);
  const [stages, setStages] = useState<ProcessingStageDto[] | null>(null);
  const [endTemp, setEndTemp] = useState("");
  const [stageSaving, setStageSaving] = useState(false);
  const [liveNow, setLiveNow] = useState(Date.now());

  useEffect(() => {
    const i = setInterval(() => setLiveNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    if (!identifier) { setLoading(false); return; }
    const isGuid = identifier.length >= 32;
    const load = isGuid ? getTank(identifier, token) : listTanks(token).then(tanks => {
      const found = tanks.find(t => t.code === identifier || t.id === identifier);
      if (!found) throw new Error(`Tank ${identifier} not found`);
      return found;
    });

    load.then(t => {
      setTank(t);
      setLoading(false);
      getLastTemperatureLog(t.id, token).then(setLastLog).catch(() => setLastLog(null));
      listTemperatureLogs(t.id, token).then(setLogs).catch(() => setLogs([]));
      if (t.kind === "Storing") {
        getRunsInStoringTank(t.id, token).then(runs => {
          setRunsInTank(runs);
          const can = runs.find(r => r.canAllocate);
          if (can) {
            setSelectedRunId(can.id);
            const pre = getPreSelected(can.alcoholResult);
            if (pre.length > 0) setProductType(pre[0] as ProductType);
          }
        }).catch(() => setRunsInTank([]));
        listTanks(token, undefined, "Mixing", true).then(setMixingTanks).catch(() => setMixingTanks([]));
      } else {
        // Mixing tank - load active batch and stages
        listActiveBatches(token).then(batches => {
          const batch = batches.find(b => b.mixingTankId === t.id) ?? null;
          setActiveBatch(batch);
        }).catch(() => setActiveBatch(null));
        listStagesByMixingTank(t.id, token).then(setStages).catch(() => setStages([]));
      }
    }).catch(e => { setLoading(false); setFailure(e instanceof ApiError ? e.message : "Tank not found"); });
  }, [identifier, token]);

  const selectedRun = runsInTank?.find(r => r.id === selectedRunId) ?? null;
  const destTank = mixingTanks?.find(t => t.id === destTankId) ?? null;
  const quantity = Number(quantityKg);
  const preSelected = useMemo(() => getPreSelected(selectedRun?.alcoholResult), [selectedRun]);
  const isOverride = !preSelected.includes(productType);
  const dayOfYear = Math.floor((new Date().getTime() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const batchPreview = `${dayOfYear}-${productType}-A`;

  const tempComplete = tempC.trim() !== "" && Number.isFinite(Number(tempC));
  const pourComplete = destTankId && !!destTank && destTank.remainingKg <= 0.01 && Number.isFinite(quantity) && quantity > 0 && !!selectedRun && selectedRun.canAllocate && (!isOverride || overrideReason.trim().length >= 5) && tank && quantity <= selectedRun.quantityKg;

  const activeStage = stages?.find(s => !s.endTimeUtc) ?? null;
  const nextStage = stages ? getNextStage(stages) : "Heating";

  const submitTemp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempComplete || !tank) return;
    setTempSaving(true);
    setFailure(null);
    try {
      const log = await createTemperatureLog(tank.id, { temperatureC: Number(tempC), note: note || undefined }, token);
      setLastLog(log);
      setLogs(prev => prev ? [log, ...prev] : [log]);
      setTempC("");
      setNote("");
      setSuccess(`${tank.code} ${log.temperatureC.toFixed(1)}°C`);
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setFailure(err.message);
    } finally {
      setTempSaving(false);
    }
  };

  const submitPour = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pourComplete || !tank) return;
    setPourSaving(true);
    setFailure(null);
    try {
      const alloc = await createAllocation(
        {
          sourceStoringTankId: tank.id,
          destinationMixingTankId: destTankId,
          quantityKg: quantity,
          productType,
          overrideReason: isOverride ? overrideReason : undefined,
          processingRunId: selectedRunId || undefined,
        },
        token
      );
      setSuccess(`${alloc.quantityKg.toFixed(0)}KG ${alloc.sourceStoringTankCode}→${alloc.destinationMixingTankCode} ${alloc.batchCode}`);
      setShowPour(false);
      setQuantityKg("");
      setOverrideReason("");
      const updated = await getTank(tank.id, token);
      setTank(updated);
      listTanks(token, undefined, "Mixing", true).then(setMixingTanks);
      getRunsInStoringTank(tank.id, token).then(setRunsInTank);
      setTimeout(() => setSuccess(null), 6000);
    } catch (err: any) {
      setFailure(err.message);
    } finally {
      setPourSaving(false);
    }
  };

  const handleStartStage = async () => {
    if (!tank || !nextStage || !activeBatch) return;
    setStageSaving(true);
    setFailure(null);
    try {
      // Need processingRunId - get from active batch id? We need run id, use first stage's run or fetch allocation
      // For now use activeBatch.id as allocation id, need to get run id via API? We'll fetch stages to get run id from first stage or use activeBatch's processingRunId via backend list
      // Backend start requires ProcessingRunId - we have it from active batch? activeBatch doesn't have run id, but we can get from stages or fetch allocation details
      // Workaround: use stages[0]?.processingRunId or if no stages, fetch via tank allocations
      let runId = stages?.[0]?.processingRunId;
      if (!runId) {
        // fetch active batches includes run? we need to get from allocation - for now use activeBatch.id as placeholder and backend will resolve via mixing tank latest run
        // Actually backend requires ProcessingRunId, so we need to store it - let's get from listActiveBatches extended or fetch from tank allocations
        // Quick fix: call listActiveBatches already has dispatch, but not run id - we will need to fetch from backend active batch endpoint that returns run id
        // For now, try to use first stage's run id or fail
        const { listAllocations } = await import("../../../api/processing/allocations");
        const allocs = await listAllocations(token);
        const alloc = allocs.find(a => a.batchCode === activeBatch.batchCode && a.destinationMixingTankId === tank.id);
        runId = alloc?.processingRunId;
      }
      if (!runId) throw new Error("ProcessingRun not found for batch");
      const stage = await startStage({ mixingTankId: tank.id, processingRunId: runId, stageType: nextStage }, token);
      setStages(prev => prev ? [...prev, stage] : [stage]);
      setSuccess(`${nextStage} started in ${tank.code}`);
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setFailure(err.message);
    } finally {
      setStageSaving(false);
    }
  };

  const handleEndStage = async () => {
    if (!activeStage || !endTemp) return;
    setStageSaving(true);
    setFailure(null);
    try {
      const stage = await endStage(activeStage.id, { endTemperatureC: Number(endTemp) }, token);
      setStages(prev => prev ? prev.map(s => s.id === stage.id ? stage : s) : [stage]);
      setEndTemp("");
      setSuccess(`${stage.stageType} ended ${stage.endTemperatureC}°C ${stage.isDeviation ? "deviation" : ""}`);
      setTimeout(() => setSuccess(null), 4000);
      // Refresh tank (if cooling ended, tank might be freed later)
      if (stage.stageType === "Cooling") {
        const updated = await getTank(tank!.id, token);
        setTank(updated);
        setActiveBatch(null);
      }
    } catch (err: any) {
      setFailure(err.message);
    } finally {
      setStageSaving(false);
    }
  };

  if (loading) return <p className="loading">Loading...</p>;
  if (!tank) return <p className="notice notice--error">{failure ?? "Not found"}</p>;

  const isStoring = tank.kind === "Storing";

  return (
    <>
      <div className="pagehead">
        <h1 className="pagehead__title">{tank.code}</h1>
        <p className="pagehead__detail">{tank.kind} · {tank.status} · {tank.remainingKg.toFixed(0)} KG / {tank.capacityKg.toFixed(0)} KG</p>
      </div>

      {failure && <p className="notice notice--error">{failure}</p>}
      {success && <p className="notice" style={{ background: "#e6f4ea", border: "1px solid #b7e4c7", color: "#15803d", padding: 12, borderRadius: 8 }}>{success}</p>}

      <section className="card">
        <h3 style={{ margin: 0, fontSize: 14 }}>Temperature</h3>
        <form onSubmit={submitTemp} noValidate style={{ marginTop: 12 }}>
          <label className="field">
            <span className="field__label">Temperature °C</span>
            <div className="field__wrap"><input value={tempC} inputMode="decimal" placeholder="4.0" onChange={(e) => setTempC(e.target.value)} disabled={tempSaving} /></div>
          </label>
          <label className="field">
            <span className="field__label">Note</span>
            <div className="field__wrap"><input value={note} placeholder="Optional" onChange={(e) => setNote(e.target.value)} disabled={tempSaving} /></div>
          </label>
          <button type="submit" className="button button--wide" disabled={!tempComplete || tempSaving} style={{ marginTop: 8 }}>
            {tempSaving ? "..." : "Save"}
          </button>
        </form>

        {lastLog && (
          <div style={{ marginTop: 12, padding: 10, background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8 }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{lastLog.temperatureC.toFixed(1)}°C · {formatColombo(lastLog.recordedAtUtc)}</p>
            {lastLog.note && <p className="microlabel" style={{ marginTop: 4 }}>{lastLog.note} · {lastLog.recordedBy}</p>}
            {!lastLog.note && <p className="microlabel" style={{ marginTop: 4 }}>{lastLog.recordedBy}</p>}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button type="button" className="button button--ghost button--small" onClick={() => setShowHistory(!showHistory)}>
            {showHistory ? "Hide" : `History (${logs?.length ?? 0})`}
          </button>
          <button type="button" className="button button--ghost button--small" onClick={() => navigate("/processing/tanks")}>Back</button>
        </div>

        {showHistory && logs && (
          <div style={{ marginTop: 12, maxHeight: 280, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8 }}>
            {logs.length === 0 && <p className="emptystate" style={{ padding: 12 }}>No logs</p>}
            {logs.map(l => (
              <div key={l.id} style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{l.temperatureC.toFixed(1)}°C {l.note ? `· ${l.note}` : ""}</span>
                <span className="microlabel">{formatColombo(l.recordedAtUtc)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {isStoring && (
        <section className="card" style={{ marginTop: 16 }}>
          <h3 style={{ margin: 0, fontSize: 14 }}>{tank.code} · {tank.remainingKg.toFixed(0)} KG</h3>
          {tank.remainingKg <= 0.01 && <p className="emptystate">Empty</p>}
          {tank.remainingKg > 0.01 && (
            <>
              {runsInTank ? (
                runsInTank.length === 0 ? (
                  <p className="emptystate" style={{ marginTop: 12 }}>No milk</p>
                ) : (
                  <div style={{ marginTop: 12 }}>
                    {runsInTank.map(r => (
                      <div
                        key={r.allocationId ?? r.id}
                        onClick={() => r.canAllocate && setSelectedRunId(r.id)}
                        style={{
                          padding: 12,
                          marginTop: 8,
                          background: r.id === selectedRunId ? "#dcfce7" : "white",
                          borderRadius: 8,
                          border: r.id === selectedRunId ? "2px solid #15803d" : "1px solid #e5e7eb",
                          cursor: r.canAllocate ? "pointer" : "not-allowed",
                          opacity: r.canAllocate ? 1 : 0.5,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 14, fontWeight: 700 }}>{r.dispatchNumber}</span>
                          <span className={`badge ${r.qualityTestStatus === "Passed" ? "badge--good" : "badge--bad"}`}>{r.qualityTestStatus}</span>
                        </div>
                        <p style={{ margin: "6px 0 0", fontSize: 13 }}>{r.quantityKg.toFixed(0)} KG · {r.alcoholResult ?? ""} · {r.verdict ?? ""}</p>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <p className="loading" style={{ marginTop: 12 }}>Loading...</p>
              )}
              <button type="button" className="button button--wide" style={{ marginTop: 12 }} onClick={() => setShowPour(true)} disabled={!selectedRunId}>
                Pour to Mixing Tank
              </button>
            </>
          )}
        </section>
      )}

      {!isStoring && (
        <>
          <section className="card" style={{ marginTop: 16 }}>
            <h3 style={{ margin: 0, fontSize: 14 }}>{tank.code} · {tank.remainingKg.toFixed(0)} KG</h3>
            {tank.remainingKg <= 0.01 ? (
              <p className="emptystate" style={{ marginTop: 8 }}>Empty</p>
            ) : activeBatch ? (
              <div style={{ marginTop: 12, padding: 12, background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: 8 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 16 }}>{activeBatch.batchCode} · {activeBatch.productType} · {activeBatch.quantityKg.toFixed(0)} KG</p>
                <p className="microlabel" style={{ marginTop: 4 }}>{activeBatch.dispatchNumber} · {activeBatch.sourceStoringTankCode} → {activeBatch.mixingTankCode}</p>
                <p className="microlabel" style={{ marginTop: 2, fontWeight: 600 }}>{formatColombo(activeBatch.allocatedAtUtc)}</p>
              </div>
            ) : (
              <div style={{ marginTop: 12, padding: 12, background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 8 }}>
                <p style={{ margin: 0, fontSize: 13 }}>{tank.remainingKg.toFixed(0)} KG in tank - no batch info</p>
              </div>
            )}
          </section>

          <section className="card" style={{ marginTop: 16 }}>
            <h3 style={{ margin: 0, fontSize: 14 }}>Processing</h3>
            {stages == null ? (
              <p className="loading" style={{ marginTop: 12 }}>Loading stages...</p>
            ) : (
              <>
                {stages.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    {stages.map(s => {
                      const isActive = !s.endTimeUtc;
                      return (
                        <div key={s.id} style={{ padding: 10, marginTop: 8, background: isActive ? "#dcfce7" : "white", border: isActive ? "2px solid #15803d" : "1px solid #e5e7eb", borderRadius: 8 }}>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ fontWeight: 700, fontSize: 14 }}>{s.stageType}</span>
                            <span className={`badge ${s.endTimeUtc ? "badge--good" : "badge--warn"}`}>{s.endTimeUtc ? `${s.durationMinutes ?? 0}min ${s.endTemperatureC}°C` : `${formatLiveElapsed(s.startTimeUtc, liveNow)} live`}</span>
                          </div>
                          <p className="microlabel" style={{ marginTop: 4 }}>{formatColombo(s.startTimeUtc)} → {s.endTimeUtc ? formatColombo(s.endTimeUtc) : "in progress"} {s.isDeviation ? "· deviation" : ""}</p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {activeStage ? (
                  <div style={{ marginTop: 12 }}>
                    <label className="field">
                      <span className="field__label">End Temperature °C - {activeStage.stageType} {activeStage.stageType === "Heating" ? "(40-65)" : activeStage.stageType === "Pasteuriser" ? "(80-85)" : ""}</span>
                      <input value={endTemp} inputMode="decimal" placeholder={activeStage.stageType === "Heating" ? "55" : activeStage.stageType === "Pasteuriser" ? "82" : "4"} onChange={e => setEndTemp(e.target.value)} />
                    </label>
                    <button type="button" className="button button--wide" disabled={!endTemp || stageSaving} onClick={handleEndStage} style={{ marginTop: 8 }}>
                      {stageSaving ? "..." : `End ${activeStage.stageType} → ${nextStage ?? "Complete"}`}
                    </button>
                  </div>
                ) : nextStage ? (
                  <button type="button" className="button button--wide" disabled={stageSaving || !activeBatch} onClick={handleStartStage} style={{ marginTop: 12 }}>
                    {stageSaving ? "..." : `Start ${nextStage}`}
                  </button>
                ) : stages.length > 0 && stages.every(s => s.endTimeUtc) ? (
                  <p className="notice" style={{ marginTop: 12, background: "#e6f4ea", border: "1px solid #b7e4c7", color: "#15803d", padding: 12, borderRadius: 8 }}>Batch {activeBatch?.batchCode} completed - Cooling done, ready for final storage</p>
                ) : (
                  <p className="emptystate" style={{ marginTop: 12 }}>No active batch - pour from storing tank first</p>
                )}
              </>
            )}
          </section>
        </>
      )}

      {showPour && (
        <div className="scrim" onClick={() => setShowPour(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400, width: "100%", maxHeight: "90vh", overflowY: "auto", boxSizing: "border-box" }}>
            <div className="modal__head">
              <h3 className="modal__title">{tank.code} → MT · {batchPreview}</h3>
              <button type="button" className="iconbutton" onClick={() => setShowPour(false)}>X</button>
            </div>
            <div className="modal__body">
              {selectedRun && <p className="card__footnote">{selectedRun.dispatchNumber} · {selectedRun.quantityKg.toFixed(0)} KG · {selectedRun.alcoholResult}</p>}
              <label className="field">
                <span className="field__label">Mixing Tank</span>
                <select value={destTankId} onChange={e => setDestTankId(e.target.value)}>
                  <option value="">Select</option>
                  {mixingTanks?.map(t => (
                    <option key={t.id} value={t.id}>{t.code} · {t.remainingKg <= 0.01 ? "Empty" : `${t.remainingKg.toFixed(0)}KG`}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field__label">Quantity KG · Max {selectedRun?.quantityKg.toFixed(0) ?? tank.remainingKg.toFixed(0)}</span>
                <input value={quantityKg} inputMode="decimal" placeholder={selectedRun?.quantityKg.toFixed(0)} onChange={e => setQuantityKg(e.target.value)} />
              </label>
              <label className="field">
                <span className="field__label">Product</span>
                <select value={productType} onChange={e => setProductType(e.target.value as ProductType)}>
                  {PRODUCT_OPTIONS.map(p => (
                    <option key={p.value} value={p.value}>{p.value} {preSelected.includes(p.value) ? "" : "(override)"}</option>
                  ))}
                </select>
              </label>
              {isOverride && (
                <label className="field">
                  <span className="field__label">Override Reason</span>
                  <input value={overrideReason} placeholder="Required" onChange={e => setOverrideReason(e.target.value)} />
                </label>
              )}
              <div style={{ marginTop: 12, padding: 10, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8 }}>
                <span className="field__label">Batch</span>
                <p style={{ margin: "4px 0 0", fontWeight: 700, fontSize: 15 }}>{batchPreview}</p>
              </div>
            </div>
            <div className="modal__foot">
              <button type="button" className="button button--wide" disabled={!pourComplete || pourSaving} onClick={submitPour}>
                {pourSaving ? "..." : `Pour ${quantityKg || "0"} KG → ${destTank?.code || "MT"}`}
              </button>
              <button type="button" className="button button--ghost button--wide" style={{ marginTop: 8 }} onClick={() => setShowPour(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
