import type { QualityPanelDto, QualityStatusDto } from "../../../api/processing/qualityTests";
import { KQ_COLOURS } from "./cascade";

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
          {status.qualityTestStatus === "Pending" && "Quality test not started yet. Waiting for lab."}
          {status.qualityTestStatus === "InProgress" && "Lab is testing the sample..."}
          {status.qualityTestStatus === "Passed" && "Result should be available shortly."}
          {status.qualityTestStatus === "Failed" && "Sample failed quality."}
        </p>
      )}

      {panel && (
        <>
          <h4 style={{ margin: "16px 0 8px", fontSize: 13, fontWeight: 700 }}>Lab Results</h4>

          <div style={{ padding: 10, background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: 8, marginBottom: 10 }}>
            <span className="microlabel" style={{ fontWeight: 700 }}>Alcohol Cascade</span>
            <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <div><span className="microlabel">80%</span><p style={{ margin: "2px 0 0", fontWeight: 700, fontSize: 13 }}>{cascade?.Alcohol80 ?? "Not tested"}</p></div>
              <div><span className="microlabel">75%</span><p style={{ margin: "2px 0 0", fontWeight: 700, fontSize: 13 }}>{cascade?.Alcohol75 ?? (cascade?.Alcohol80 === "Negative" ? "STOP" : "Not tested")}</p></div>
              <div><span className="microlabel">68%</span><p style={{ margin: "2px 0 0", fontWeight: 700, fontSize: 13 }}>{cascade?.Alcohol68 ?? (cascade?.Alcohol75 === "Negative" || cascade?.Alcohol80 === "Negative" ? "STOP" : "Not tested")}</p></div>
              <div><span className="microlabel">COB</span><p style={{ margin: "2px 0 0", fontWeight: 700, fontSize: 13 }}>{cascade?.Cob ?? (cascade?.Alcohol68 === "Negative" ? "STOP" : "Not tested")}</p></div>
            </div>
            <p style={{ margin: "8px 0 0", fontWeight: 600, fontSize: 12 }}>{panel.alcoholResult}</p>
          </div>

          <div style={{ padding: 10, background: "#f5f3ff", border: "1px solid #c4b5fd", borderRadius: 8, marginBottom: 10 }}>
            <span className="microlabel" style={{ fontWeight: 700 }}>KQ - 7 colours</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
              {kqMeta && <div style={{ width: 20, height: 20, background: kqMeta.hex, border: "1px solid #ccc", borderRadius: 4 }} />}
              <span style={{ fontWeight: 700, fontSize: 13 }}>{panel.kqColour} {kqMeta ? `- ${kqMeta.meaning}` : ""}</span>
            </div>
          </div>

          <div style={{ padding: 10, background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, marginBottom: 10 }}>
            <span className="microlabel" style={{ fontWeight: 700 }}>Physical + Calculated</span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
              <div><span className="microlabel">Fat %</span><p style={{ margin: "4px 0 0", fontWeight: 700 }}>{panel.fatPercent.toFixed(2)}</p></div>
              <div><span className="microlabel">CLR (reading)</span><p style={{ margin: "4px 0 0", fontWeight: 700 }}>{panel.rawLactometerReading.toFixed(2)}</p></div>
              <div><span className="microlabel">Temp C</span><p style={{ margin: "4px 0 0", fontWeight: 700 }}>{panel.temperatureCelsius.toFixed(2)}</p></div>
              <div><span className="microlabel">Water %</span><p style={{ margin: "4px 0 0", fontWeight: 700 }}>{panel.waterPercent.toFixed(2)}</p></div>
              <div><span className="microlabel">SNF %</span><p style={{ margin: "4px 0 0", fontWeight: 700 }}>{panel.snf.toFixed(2)}</p></div>
              <div><span className="microlabel">TS %</span><p style={{ margin: "4px 0 0", fontWeight: 700 }}>{panel.ts.toFixed(2)}</p></div>
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
            Tested by {panel.confirmedBy ?? "lab"} at {new Date(panel.createdAtUtc).toLocaleString()}
          </p>
        </>
      )}
    </section>
  );
}
