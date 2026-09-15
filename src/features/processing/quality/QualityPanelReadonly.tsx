import type { QualityPanelDto, QualityStatusDto } from "../../../api/processing/qualityTests";
import { KQ_COLOURS, calculateCorrectedClr } from "./cascade";

interface Props {
  status: QualityStatusDto | null;
  panel: QualityPanelDto | null;
}

export function QualityPanelReadonly({ status, panel }: Props) {
  if (!status) {
    return <p className="emptystate">No quality test info for this dispatch.</p>;
  }

  const statusColor =
    status.qualityTestStatus === "Passed" ? "badge--good" :
    status.qualityTestStatus === "Failed" ? "badge--bad" : "";

  let cascade: any = null;
  try {
    if (panel?.alcoholOutcomesJson) {
      cascade = JSON.parse(panel.alcoholOutcomesJson);
    }
  } catch {}

  const kqMeta = panel ? KQ_COLOURS.find(k => k.value.toLowerCase() === panel.kqColour.toLowerCase()) : null;
  const correctedClr = panel ? calculateCorrectedClr(panel.rawLactometerReading, panel.temperatureCelsius) : 0;

  return (
    <section className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0, fontSize: 14 }}>Quality Test - {status.dispatchNumber}</h3>
        <span className={`badge ${statusColor}`}>{status.qualityTestStatus}</span>
      </div>

      <dl style={{ marginTop: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
          <dt className="microlabel">Dispatch</dt>
          <dd style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>{status.dispatchNumber}</dd>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
          <dt className="microlabel">Storing Tank</dt>
          <dd style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>{status.storingTankCode ?? status.storingTankId}</dd>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
          <dt className="microlabel">Quantity</dt>
          <dd style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>{status.quantityKg.toFixed(2)} KG</dd>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
          <dt className="microlabel">Verdict</dt>
          <dd style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>{panel?.verdict ?? status.verdict ?? "Awaiting result"}</dd>
        </div>
      </dl>

      {!panel && (
        <p className="card__footnote" style={{ marginTop: 12 }}>
          {status.qualityTestStatus === "Pending" && "Quality test not started yet. Waiting for lab. Auto-refresh every 5s."}
          {status.qualityTestStatus === "InProgress" && "Lab is testing the sample... Auto-refresh every 5s."}
          {status.qualityTestStatus === "Passed" && "Result should be available shortly."}
          {status.qualityTestStatus === "Failed" && "Sample failed quality."}
        </p>
      )}

      {panel && (
        <>
          <h4 style={{ margin: "16px 0 8px", fontSize: 13, fontWeight: 700 }}>Lab Results - Real Process (Read-only)</h4>

          {/* Alcohol Cascade */}
          <div style={{ padding: 10, background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: 8, marginBottom: 10 }}>
            <span className="microlabel" style={{ fontWeight: 700 }}>Alcohol Cascade (Positive=clotted=BAD, Negative=good)</span>
            <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <div><span className="microlabel">80%</span><p style={{ margin: "2px 0 0", fontWeight: 700, fontSize: 13 }}>{cascade?.Alcohol80 ?? cascade?.["80"] ?? "Not tested"}</p></div>
              <div><span className="microlabel">75%</span><p style={{ margin: "2px 0 0", fontWeight: 700, fontSize: 13 }}>{cascade?.Alcohol75 ?? cascade?.["75"] ?? (cascade?.Alcohol80 === "Negative" ? "STOP - not needed" : "Not tested")}</p></div>
              <div><span className="microlabel">68%</span><p style={{ margin: "2px 0 0", fontWeight: 700, fontSize: 13 }}>{cascade?.Alcohol68 ?? cascade?.["68"] ?? (cascade?.Alcohol75 === "Negative" || cascade?.Alcohol80 === "Negative" ? "STOP - not needed" : "Not tested")}</p></div>
              <div><span className="microlabel">COB</span><p style={{ margin: "2px 0 0", fontWeight: 700, fontSize: 13 }}>{cascade?.Cob ?? cascade?.["COB"] ?? (cascade?.Alcohol68 === "Negative" || cascade?.Alcohol75 === "Negative" || cascade?.Alcohol80 === "Negative" ? "STOP - not needed" : "Not tested")}</p></div>
            </div>
            <p style={{ margin: "8px 0 0", fontWeight: 600, fontSize: 12 }}>Result: {panel.alcoholResult}</p>
            <p className="card__footnote" style={{ marginTop: 4 }}>COB only if 80%,75%,68% all Positive. COB Positive overrides all and rejects.</p>
          </div>

          {/* KQ */}
          <div style={{ padding: 10, background: "#f5f3ff", border: "1px solid #c4b5fd", borderRadius: 8, marginBottom: 10 }}>
            <span className="microlabel" style={{ fontWeight: 700 }}>KQ Keeping Quality</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
              {kqMeta && <div style={{ width: 20, height: 20, background: kqMeta.hex, border: "1px solid #ccc", borderRadius: 4 }} />}
              <span style={{ fontWeight: 700, fontSize: 13 }}>{panel.kqColour} {kqMeta ? `- ${kqMeta.meaning} - ${kqMeta.hex}` : ""}</span>
            </div>
          </div>

          {/* Physical + Calculated */}
          <div style={{ padding: 10, background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, marginBottom: 10 }}>
            <span className="microlabel" style={{ fontWeight: 700 }}>Milk Quality Parameters</span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
              <div><span className="microlabel">Fat % (entered)</span><p style={{ margin: "4px 0 0", fontWeight: 700 }}>{panel.fatPercent.toFixed(2)}</p></div>
              <div><span className="microlabel">Raw CLR (entered)</span><p style={{ margin: "4px 0 0", fontWeight: 700 }}>{panel.rawLactometerReading.toFixed(2)}</p></div>
              <div><span className="microlabel">Temp C (entered)</span><p style={{ margin: "4px 0 0", fontWeight: 700 }}>{panel.temperatureCelsius.toFixed(2)}</p></div>
              <div><span className="microlabel">Water % (entered)</span><p style={{ margin: "4px 0 0", fontWeight: 700 }}>{panel.waterPercent.toFixed(2)}</p></div>
              <div><span className="microlabel">Corrected CLR (calc)</span><p style={{ margin: "4px 0 0", fontWeight: 700 }}>{correctedClr.toFixed(2)}</p><span className="microlabel">raw + 0.2*(temp-27)</span></div>
              <div><span className="microlabel">SNF % (calc)</span><p style={{ margin: "4px 0 0", fontWeight: 700 }}>{panel.snf.toFixed(2)}</p><span className="microlabel">(Fat*0.22)+(CLR*0.25)+0.72</span></div>
              <div><span className="microlabel">TS % (calc)</span><p style={{ margin: "4px 0 0", fontWeight: 700 }}>{panel.ts.toFixed(2)}</p><span className="microlabel">SNF+Fat</span></div>
              <div><span className="microlabel">pH</span><p style={{ margin: "4px 0 0", fontWeight: 700 }}>{panel.ph.toFixed(2)}</p></div>
            </div>
            <div style={{ marginTop: 10, display: "flex", gap: 12 }}>
              <span className="microlabel">Smell: {panel.smellOk ? "OK" : "Fail"}</span>
              <span className="microlabel">Colour: {panel.colourOk ? "OK" : "Fail"}</span>
              <span className="microlabel">Taste: {panel.tasteOk ? "OK" : "Fail"}</span>
            </div>
          </div>

          {panel.failedParameter && (
            <p className="notice notice--error" style={{ marginTop: 12 }}>
              Failed: {panel.failedParameter} - {panel.failedValue}
            </p>
          )}

          <p className="card__footnote" style={{ marginTop: 12 }}>
            Tested by {panel.confirmedBy ?? "lab"} at {new Date(panel.createdAtUtc).toLocaleString()}<br />
            Verdict auto-derived: sensory fail OR COB Positive OR physical out of range → Reject else Accept. COB Positive overrides all.
          </p>
        </>
      )}
    </section>
  );
}
