import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "../../../auth/sessionStore";
import {
  getWorkQueue,
  createBatch,
  recordPanel,
  isLiquid,
  PRODUCT_LINES,
  PRODUCT_LINE_LABEL,
  type BatchWorkItemDto,
  type ChemicalPanelDto,
  type ProductLine,
} from "../../../api/qualityLab/panels";
import { getSensory, type SensoryEvaluationDto } from "../../../api/qualityLab/sensory";
import { SensoryEvaluationForm } from "../sensory/SensoryEvaluationForm";
import "./QualityLabPanelScreen.css";

export function QualityLabPanelScreen() {
  const { session } = useSession();
  const token = session?.accessToken ?? null;

  const [queue, setQueue] = useState<BatchWorkItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected batch for panel recording
  const [selectedBatch, setSelectedBatch] = useState<BatchWorkItemDto | null>(null);

  // New batch form
  const [showNewBatch, setShowNewBatch] = useState(false);
  const [newBatchCode, setNewBatchCode] = useState("");
  const [newDispatch, setNewDispatch] = useState("");
  const [newProductLine, setNewProductLine] = useState<ProductLine>("FM");
  const [newTank, setNewTank] = useState("");
  const [creating, setCreating] = useState(false);

  // Panel form
  const [fatPercent, setFatPercent] = useState("");
  const [lactometerReading, setLactometerReading] = useState("");
  const [temperatureCelsius, setTemperatureCelsius] = useState("");
  const [ph, setPh] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [panelResult, setPanelResult] = useState<ChemicalPanelDto | null>(null);
  const [existingSensory, setExistingSensory] = useState<SensoryEvaluationDto | null>(null);

  const abortRef = useRef<AbortController | undefined>(undefined);

  const fetchQueue = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);
    try {
      const items = await getWorkQueue(token, ctrl.signal);
      setQueue(items);
    } catch (err: any) {
      if (err.name !== "AbortError") setError(err.message ?? "Failed to load work queue.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchQueue();
    return () => abortRef.current?.abort();
  }, [fetchQueue]);

  const handleCreateBatch = async () => {
    if (!newBatchCode.trim() || !newDispatch.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await createBatch(
        { batchCode: newBatchCode.trim(), dispatchNumber: newDispatch.trim(), productLine: newProductLine, storingTankCode: newTank.trim() || undefined },
        token,
      );
      setShowNewBatch(false);
      setNewBatchCode("");
      setNewDispatch("");
      setNewTank("");
      await fetchQueue();
    } catch (err: any) {
      setError(err.message ?? "Failed to create batch.");
    } finally {
      setCreating(false);
    }
  };

  const handleRecordPanel = async () => {
    if (!selectedBatch) return;
    setSubmitting(true);
    setError(null);
    setPanelResult(null);
    try {
      const liquid = isLiquid(selectedBatch.productLine);
      const body: any = {
        fatPercent: parseFloat(fatPercent),
        ph: parseFloat(ph),
      };
      if (liquid) {
        body.lactometerReading = parseFloat(lactometerReading);
        body.temperatureCelsius = parseFloat(temperatureCelsius);
      }
      const result = await recordPanel(selectedBatch.batchCode, body, token);
      setPanelResult(result);
      await fetchQueue();
    } catch (err: any) {
      setError(err.message ?? "Failed to record panel.");
    } finally {
      setSubmitting(false);
    }
  };

  const selectBatch = async (batch: BatchWorkItemDto) => {
    setSelectedBatch(batch);
    setPanelResult(null);
    setFatPercent("");
    setLactometerReading("");
    setTemperatureCelsius("");
    setPh("");
    setError(null);
    // Load existing sensory for this batch
    try {
      const s = await getSensory(batch.batchCode, token);
      setExistingSensory(s);
    } catch {
      setExistingSensory(null);
    }
  };

  const liquid = selectedBatch ? isLiquid(selectedBatch.productLine) : false;

  return (
    <div className="ql-panel-screen">
      <div className="ql-panel-screen__header">
        <h1 className="ql-panel-screen__title">🔬 Quality Lab — Chemical Panels</h1>
        <p className="ql-panel-screen__subtitle">
          Record final product chemical test results per batch
        </p>
      </div>

      {error && <div className="ql-panel-screen__error">{error}</div>}

      <div className="ql-panel-screen__layout">
        {/* ── Work Queue ───────────────────────────────────────── */}
        <div className="ql-panel-screen__queue">
          <div className="ql-panel-screen__queue-header">
            <h2>Work Queue</h2>
            <button
              className="ql-panel-screen__btn ql-panel-screen__btn--secondary"
              onClick={() => setShowNewBatch(!showNewBatch)}
            >
              {showNewBatch ? "Cancel" : "+ Add Batch"}
            </button>
          </div>

          {showNewBatch && (
            <div className="ql-panel-screen__new-batch">
              <input placeholder="Batch Code (e.g. 265-FM-A)" value={newBatchCode} onChange={(e) => setNewBatchCode(e.target.value)} />
              <input placeholder="Dispatch Number" value={newDispatch} onChange={(e) => setNewDispatch(e.target.value)} />
              <select value={newProductLine} onChange={(e) => setNewProductLine(e.target.value as ProductLine)}>
                {PRODUCT_LINES.map((pl) => (
                  <option key={pl} value={pl}>
                    {PRODUCT_LINE_LABEL[pl]}
                  </option>
                ))}
              </select>
              <input placeholder="Storing Tank (optional)" value={newTank} onChange={(e) => setNewTank(e.target.value)} />
              <button className="ql-panel-screen__btn ql-panel-screen__btn--primary" onClick={handleCreateBatch} disabled={creating}>
                {creating ? "Creating…" : "Create"}
              </button>
            </div>
          )}

          {loading ? (
            <p className="ql-panel-screen__loading">Loading work queue…</p>
          ) : queue.length === 0 ? (
            <p className="ql-panel-screen__empty">No batches in the work queue.</p>
          ) : (
            <ul className="ql-panel-screen__queue-list">
              {queue.map((batch) => (
                <li
                  key={batch.id}
                  className={`ql-panel-screen__queue-item ${selectedBatch?.id === batch.id ? "ql-panel-screen__queue-item--selected" : ""}`}
                  onClick={() => selectBatch(batch)}
                >
                  <div className="ql-panel-screen__queue-item-main">
                    <strong>{batch.batchCode}</strong>
                    <span className={`ql-panel-screen__badge ql-panel-screen__badge--${batch.status.toLowerCase()}`}>
                      {batch.status}
                    </span>
                  </div>
                  <div className="ql-panel-screen__queue-item-detail">
                    <span>{PRODUCT_LINE_LABEL[batch.productLine]}</span>
                    <span>·</span>
                    <span>{batch.dispatchNumber}</span>
                    {batch.storingTankCode && (
                      <>
                        <span>·</span>
                        <span>Tank {batch.storingTankCode}</span>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Panel Form ──────────────────────────────────────── */}
        <div className="ql-panel-screen__form-area">
          {!selectedBatch ? (
            <div className="ql-panel-screen__placeholder">
              <p>← Select a batch from the queue to record a chemical panel</p>
            </div>
          ) : (
            <>
              <h2>
                Record Panel: {selectedBatch.batchCode}{" "}
                <span className="ql-panel-screen__product-badge">{PRODUCT_LINE_LABEL[selectedBatch.productLine]}</span>
              </h2>
              <p className="ql-panel-screen__form-info">
                {liquid
                  ? "Liquid line — fields: Fat%, Lactometer Reading, Temperature, pH → CLR, SNF, TS derived"
                  : "Fermented line — fields: Fat%, pH only"}
              </p>

              <div className="ql-panel-screen__form">
                <label>
                  Fat %
                  <input type="number" step="0.01" min="0" max="15" placeholder="e.g. 3.8" value={fatPercent} onChange={(e) => setFatPercent(e.target.value)} />
                </label>

                {liquid && (
                  <>
                    <label>
                      Lactometer Reading
                      <input type="number" step="0.01" min="0" max="40" placeholder="e.g. 29.0" value={lactometerReading} onChange={(e) => setLactometerReading(e.target.value)} />
                    </label>
                    <label>
                      Temperature (°C)
                      <input type="number" step="0.1" min="-3" max="50" placeholder="e.g. 27.0" value={temperatureCelsius} onChange={(e) => setTemperatureCelsius(e.target.value)} />
                    </label>
                  </>
                )}

                <label>
                  pH
                  <input type="number" step="0.01" min="2.5" max="9.0" placeholder={liquid ? "e.g. 6.7" : "e.g. 4.4"} value={ph} onChange={(e) => setPh(e.target.value)} />
                </label>

                <button
                  className="ql-panel-screen__btn ql-panel-screen__btn--primary ql-panel-screen__btn--submit"
                  onClick={handleRecordPanel}
                  disabled={submitting}
                >
                  {submitting ? "Saving…" : selectedBatch.hasPanels ? "Record Re-test" : "Record Panel"}
                </button>
              </div>

              {/* ── Result ──────────────────────────────────────── */}
              {panelResult && (
                <div className="ql-panel-screen__result">
                  <h3>✅ Panel Recorded (Version {panelResult.version})</h3>
                  <table className="ql-panel-screen__result-table">
                    <tbody>
                      <tr><td>Fat %</td><td>{panelResult.fatPercent}</td></tr>
                      {panelResult.lactometerReading != null && <tr><td>Lactometer</td><td>{panelResult.lactometerReading}</td></tr>}
                      {panelResult.temperatureCelsius != null && <tr><td>Temperature</td><td>{panelResult.temperatureCelsius} °C</td></tr>}
                      <tr><td>pH</td><td>{panelResult.ph}</td></tr>
                      {panelResult.correctedClr != null && <tr><td>Corrected CLR</td><td>{panelResult.correctedClr}</td></tr>}
                      {panelResult.snf != null && <tr><td>SNF</td><td>{panelResult.snf}</td></tr>}
                      {panelResult.ts != null && <tr><td>TS</td><td>{panelResult.ts}</td></tr>}
                      <tr><td>Tested By</td><td>{panelResult.testedBy}</td></tr>
                      <tr><td>Tested At</td><td>{new Date(panelResult.testedAtUtc).toLocaleString()}</td></tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* Sensory evaluation — show when batch has panels */}
              {selectedBatch.hasPanels && (
                <SensoryEvaluationForm
                  batchCode={selectedBatch.batchCode}
                  productLine={selectedBatch.productLine}
                  existing={existingSensory}
                  onComplete={async () => {
                    await fetchQueue();
                    try {
                      const s = await getSensory(selectedBatch.batchCode, token);
                      setExistingSensory(s);
                    } catch {
                      setExistingSensory(null);
                    }
                  }}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
