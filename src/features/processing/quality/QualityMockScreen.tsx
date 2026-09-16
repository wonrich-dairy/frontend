import { useEffect, useState, useMemo } from "react";
import { ApiError } from "../../../api/http";
import { listPendingQualityTests, startQualityTest, submitQualityResult, type QualityStatusDto, type SubmitQualityResultRequest } from "../../../api/processing/qualityTests";
import { useSession } from "../../../auth/sessionStore";
import { KQ_COLOURS, calculateSnf, calculateTs, validateCascade, deriveAlcoholResult, deriveProductLine, determineVerdict, type AlcoholCascade, type AlcoholOutcome } from "./cascade";

export function QualityMockScreen() {
  const { session } = useSession();
  const token = (session as any)?.accessToken ?? null;

  const [tests, setTests] = useState<QualityStatusDto[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selected, setSelected] = useState<QualityStatusDto | null>(null);
  const [saving, setSaving] = useState(false);

  const [fatPercent, setFatPercent] = useState("3.85");
  const [rawClr, setRawClr] = useState("28.5");
  const [temperature, setTemperature] = useState("27");
  const [waterPercent, setWaterPercent] = useState("0");
  const [kqColour, setKqColour] = useState("Blue");

  const [alcohol80, setAlcohol80] = useState<AlcoholOutcome | "">("");
  const [alcohol75, setAlcohol75] = useState<AlcoholOutcome | "">("");
  const [alcohol68, setAlcohol68] = useState<AlcoholOutcome | "">("");
  const [cob, setCob] = useState<AlcoholOutcome | "">("");

  const [smellOk, setSmellOk] = useState(true);
  const [colourOk, setColourOk] = useState(true);
  const [tasteOk, setTasteOk] = useState(true);
  const [manualVerdict, setManualVerdict] = useState<"Accept" | "Reject" | "">("");

  const cascade: AlcoholCascade = useMemo(() => ({
    Alcohol80: alcohol80 || null,
    Alcohol75: alcohol75 || null,
    Alcohol68: alcohol68 || null,
    Cob: cob || null,
  }), [alcohol80, alcohol75, alcohol68, cob]);

  const fatNum = Number(fatPercent);
  const rawClrNum = Number(rawClr);
  const tempNum = Number(temperature);
  const waterNum = Number(waterPercent);

  const clr = useMemo(() => rawClrNum, [rawClrNum]);

  const snf = useMemo(() => {
    if (!Number.isFinite(fatNum) || !Number.isFinite(clr)) return 0;
    return calculateSnf(fatNum, clr);
  }, [fatNum, clr]);

  const ts = useMemo(() => calculateTs(snf, fatNum), [snf, fatNum]);

  const cascadeError = useMemo(() => validateCascade(cascade), [cascade]);

  const autoVerdictResult = useMemo(() => {
    if (cascadeError) return null;
    if (!alcohol80) return null;
    return determineVerdict({
      smellOk,
      colourOk,
      tasteOk,
      cascade,
      fatPercent: fatNum,
      snf,
      waterPercent: waterNum,
      clr,
      kqColour,
    });
  }, [smellOk, colourOk, tasteOk, cascade, fatNum, snf, waterNum, clr, kqColour, cascadeError]);

  // Lab tech can override auto verdict - Accept/Reject selection is lab tech responsibility
  const finalVerdict = manualVerdict || autoVerdictResult?.verdict || "Accept";

  const alcoholResult = useMemo(() => {
    if (cascadeError || !alcohol80) return "";
    return deriveAlcoholResult(cascade);
  }, [cascade, cascadeError, alcohol80]);

  const productLine = useMemo(() => {
    if (cascadeError || !alcohol80) return "";
    return deriveProductLine(cascade);
  }, [cascade, cascadeError, alcohol80]);

  const load = () => {
    const abort = new AbortController();
    listPendingQualityTests(token, abort.signal)
      .then((loaded) => {
        setTests(loaded);
        setFailure(null);
      })
      .catch((e) => { if (!abort.signal.aborted) setFailure(e instanceof ApiError ? e.message : "Could not load tests"); });
    return () => abort.abort();
  };

  useEffect(() => { return load(); }, [token]);

  const resetForm = () => {
    setFatPercent("3.85");
    setRawClr("28.5");
    setTemperature("27");
    setWaterPercent("0");
    setKqColour("Blue");
    setAlcohol80("");
    setAlcohol75("");
    setAlcohol68("");
    setCob("");
    setSmellOk(true);
    setColourOk(true);
    setTasteOk(true);
    setManualVerdict("");
  };

  const handleStart = async (dispatchNumber: string) => {
    setSaving(true); setFailure(null); setSuccess(null);
    try {
      await startQualityTest(dispatchNumber, token);
      setSuccess(`Quality test for ${dispatchNumber} started`);
      setTests(null);
      load();
    } catch (e: any) { setFailure(e.message); } finally { setSaving(false); }
  };

  const handleSubmit = async () => {
    if (!selected) return;
    if (cascadeError) {
      setFailure(cascadeError);
      return;
    }
    if (!alcohol80) {
      setFailure("Alcohol 80% test is required first");
      return;
    }

    setSaving(true); setFailure(null); setSuccess(null);
    try {
      const body: SubmitQualityResultRequest = {
        fatPercent: fatNum,
        rawLactometerReading: rawClrNum,
        temperatureCelsius: tempNum,
        waterPercent: waterNum,
        kqColour: kqColour,
        alcoholOutcomesJson: JSON.stringify(cascade),
        alcoholResult: alcoholResult,
        smellOk,
        colourOk,
        tasteOk,
        verdict: finalVerdict,
        failedParameter: finalVerdict === "Reject" ? (autoVerdictResult?.failedParameter ?? "Manual Reject") : undefined,
        failedValue: finalVerdict === "Reject" ? (autoVerdictResult?.failedValue ?? "Lab tech rejected") : undefined,
        snf: snf,
        ts: ts,
        ph: 6.7,
      };
      const result = await submitQualityResult(selected.dispatchNumber, body, token);
      setSuccess(`Quality for ${selected.dispatchNumber}: ${result.verdict} - ${alcoholResult} - SNF ${snf.toFixed(2)} TS ${ts.toFixed(2)}`);
      setSelected(null);
      resetForm();
      setTests(null);
      load();
      setTimeout(() => setSuccess(null), 8000);
    } catch (e: any) { setFailure(e.message); } finally { setSaving(false); }
  };

  const selectedKqMeta = KQ_COLOURS.find(k => k.value === kqColour);

  return (
    <>
      <div className="pagehead">
        <h1 className="pagehead__title">Quality Lab</h1>
        <p className="pagehead__detail">Alcohol cascade 80%→75%→68%→COB, KQ 7 colours, CLR instrument reading, lab tech decides Accept/Reject</p>
      </div>

      {failure && <p className="notice notice--error">{failure}</p>}
      {success && <p className="notice" style={{ background: "#e6f4ea", border: "1px solid #b7e4c7", color: "#15803d", padding: 12, borderRadius: 8, whiteSpace: "pre-wrap" }}>{success}</p>}

      {!tests && <p className="loading">Loading...</p>}
      {tests?.length === 0 && <p className="emptystate">No unloads awaiting lab</p>}

      {tests?.map((t) => (
        <article key={t.dispatchNumber} className="tankrow">
          <header className="tankrow__head">
            <h2 className="tankrow__name">{t.dispatchNumber}</h2>
            <span className={`badge ${t.qualityTestStatus === "Passed" ? "badge--good" : t.qualityTestStatus === "Failed" ? "badge--bad" : ""}`}>{t.qualityTestStatus}</span>
          </header>
          <p className="tankrow__status">{t.storingTankCode} - {t.quantityKg.toFixed(0)} KG - {t.processingState}</p>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            {t.qualityTestStatus === "Pending" && (
              <button type="button" className="button button--small" disabled={saving} onClick={() => handleStart(t.dispatchNumber)}>Start Test</button>
            )}
            {(t.qualityTestStatus === "InProgress" || t.qualityTestStatus === "Pending") && (
              <button type="button" className="button button--small button--ghost" onClick={() => { setSelected(t); resetForm(); }}>Enter Results</button>
            )}
            {t.verdict && <span className="microlabel" style={{ alignSelf: "center" }}>Verdict: {t.verdict}</span>}
          </div>
        </article>
      ))}

      {selected && (
        <div className="scrim" onClick={() => { setSelected(null); resetForm(); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420, width: "100%", maxHeight: "92vh", overflowY: "auto", boxSizing: "border-box" }}>
            <div className="modal__head">
              <h3 className="modal__title">Lab Results - {selected.dispatchNumber}</h3>
              <button type="button" className="iconbutton" onClick={() => { setSelected(null); resetForm(); }}>X</button>
            </div>
            <div className="modal__body">
              <div style={{ padding: 10, background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, marginBottom: 12 }}>
                <span className="field__label" style={{ fontWeight: 700 }}>Sensory</span>
                <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}><input type="checkbox" checked={smellOk} onChange={(e) => setSmellOk(e.target.checked)} /> Smell OK</label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}><input type="checkbox" checked={colourOk} onChange={(e) => setColourOk(e.target.checked)} /> Colour OK</label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}><input type="checkbox" checked={tasteOk} onChange={(e) => setTasteOk(e.target.checked)} /> Taste OK</label>
              </div>

              <div style={{ padding: 10, background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: 8, marginBottom: 12 }}>
                <span className="field__label" style={{ fontWeight: 700 }}>Alcohol Cascade</span>
                <label className="field">
                  <span className="field__label">80% Alcohol</span>
                  <select value={alcohol80} onChange={(e) => { setAlcohol80(e.target.value as any); if (e.target.value === "Negative") { setAlcohol75(""); setAlcohol68(""); setCob(""); } }}>
                    <option value="">Select...</option>
                    <option value="Negative">Negative - GOOD → STOP</option>
                    <option value="Positive">Positive - BAD → 75%</option>
                  </select>
                </label>

                {alcohol80 === "Positive" && (
                  <label className="field">
                    <span className="field__label">75% Alcohol</span>
                    <select value={alcohol75} onChange={(e) => { setAlcohol75(e.target.value as any); if (e.target.value === "Negative") { setAlcohol68(""); setCob(""); } }}>
                      <option value="">Select 75%...</option>
                      <option value="Negative">Negative → STOP</option>
                      <option value="Positive">Positive → 68%</option>
                    </select>
                  </label>
                )}

                {alcohol75 === "Positive" && (
                  <label className="field">
                    <span className="field__label">68% Alcohol</span>
                    <select value={alcohol68} onChange={(e) => { setAlcohol68(e.target.value as any); if (e.target.value === "Negative") { setCob(""); } }}>
                      <option value="">Select 68%...</option>
                      <option value="Negative">Negative → STOP</option>
                      <option value="Positive">Positive → COB</option>
                    </select>
                  </label>
                )}

                {alcohol68 === "Positive" && (
                  <label className="field">
                    <span className="field__label">COB</span>
                    <select value={cob} onChange={(e) => setCob(e.target.value as any)}>
                      <option value="">Select COB...</option>
                      <option value="Negative">Negative - GOOD</option>
                      <option value="Positive">Positive - REJECT</option>
                    </select>
                  </label>
                )}

                {alcoholResult && (
                  <div style={{ marginTop: 8, padding: 8, background: "white", borderRadius: 6 }}>
                    <span className="microlabel">{alcoholResult} - {productLine}</span>
                  </div>
                )}

                {cascadeError && <p className="notice notice--error" style={{ marginTop: 8 }}>{cascadeError}</p>}
              </div>

              <div style={{ padding: 10, background: "#f5f3ff", border: "1px solid #c4b5fd", borderRadius: 8, marginBottom: 12 }}>
                <span className="field__label" style={{ fontWeight: 700 }}>KQ - 7 colours</span>
                <label className="field">
                  <span className="field__label">KQ Colour</span>
                  <select value={kqColour} onChange={(e) => setKqColour(e.target.value)}>
                    {KQ_COLOURS.map((k) => (
                      <option key={k.value} value={k.value}>{k.value} - {k.meaning}</option>
                    ))}
                  </select>
                </label>
                {selectedKqMeta && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                    <div style={{ width: 24, height: 24, background: selectedKqMeta.hex, border: "1px solid #ccc", borderRadius: 4 }} />
                    <span className="microlabel">{selectedKqMeta.value} - {selectedKqMeta.meaning}</span>
                  </div>
                )}
              </div>

              <div style={{ padding: 10, background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, marginBottom: 12 }}>
                <span className="field__label" style={{ fontWeight: 700 }}>Physical Parameters</span>
                <label className="field"><span className="field__label">Fat %</span><input value={fatPercent} onChange={(e) => setFatPercent(e.target.value)} inputMode="decimal" /></label>
                <label className="field"><span className="field__label">CLR (instrument reading)</span><input value={rawClr} onChange={(e) => setRawClr(e.target.value)} inputMode="decimal" /></label>
                <label className="field"><span className="field__label">Temperature °C</span><input value={temperature} onChange={(e) => setTemperature(e.target.value)} inputMode="decimal" /></label>
                <label className="field"><span className="field__label">Water %</span><input value={waterPercent} onChange={(e) => setWaterPercent(e.target.value)} inputMode="decimal" /></label>
              </div>

              <div style={{ padding: 10, background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8, marginBottom: 12 }}>
                <span className="field__label" style={{ fontWeight: 700 }}>Calculated</span>
                <p className="card__footnote">SNF = (Fat x 0.22) + (CLR x 0.25) + 0.72</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
                  <div><span className="microlabel">CLR</span><p style={{ margin: "4px 0 0", fontWeight: 700 }}>{clr.toFixed(2)}</p></div>
                  <div><span className="microlabel">SNF %</span><p style={{ margin: "4px 0 0", fontWeight: 700 }}>{snf.toFixed(2)}</p></div>
                  <div><span className="microlabel">TS %</span><p style={{ margin: "4px 0 0", fontWeight: 700 }}>{ts.toFixed(2)}</p></div>
                  <div><span className="microlabel">Fat %</span><p style={{ margin: "4px 0 0", fontWeight: 700 }}>{fatNum.toFixed(2)}</p></div>
                </div>
              </div>

              {autoVerdictResult && (
                <div style={{ padding: 10, background: autoVerdictResult.verdict === "Accept" ? "#e6f4ea" : "#fef2f2", border: `1px solid ${autoVerdictResult.verdict === "Accept" ? "#b7e4c7" : "#fecaca"}`, borderRadius: 8, marginBottom: 12 }}>
                  <span className="field__label" style={{ fontWeight: 700 }}>Auto Verdict</span>
                  <p style={{ margin: "8px 0 0", fontWeight: 700, color: autoVerdictResult.verdict === "Accept" ? "#15803d" : "#dc2626" }}>
                    {autoVerdictResult.verdict} - {autoVerdictResult.reason}
                  </p>
                  {autoVerdictResult.failedParameter && (
                    <p className="microlabel" style={{ marginTop: 4 }}>Failed: {autoVerdictResult.failedParameter} - {autoVerdictResult.failedValue}</p>
                  )}
                </div>
              )}

              <div style={{ padding: 10, background: "#eff6ff", border: "2px solid #3b82f6", borderRadius: 8 }}>
                <span className="field__label" style={{ fontWeight: 700 }}>Lab Tech Decision - Accept or Reject</span>
                <label className="field">
                  <span className="field__label">Final Verdict</span>
                  <select value={manualVerdict} onChange={e => setManualVerdict(e.target.value as any)}>
                    <option value="">Use Auto Verdict ({autoVerdictResult?.verdict ?? "Accept"})</option>
                    <option value="Accept">Accept - Pass this milk for allocation</option>
                    <option value="Reject">Reject - Fail this milk, hold consignment</option>
                  </select>
                </label>
                <p className="microlabel" style={{ marginTop: 8, fontWeight: 600 }}>Submitting as: {finalVerdict} {manualVerdict ? "(manual override)" : "(auto)"}</p>
              </div>
            </div>
            <div className="modal__foot">
              <button type="button" className="button button--wide" disabled={saving || !!cascadeError || !alcohol80} onClick={handleSubmit}>
                {saving ? "Saving..." : `Submit ${finalVerdict}`}
              </button>
              <button type="button" className="button button--ghost button--wide" style={{ marginTop: 8 }} onClick={() => { setSelected(null); resetForm(); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
