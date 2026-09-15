import { useEffect, useState } from "react";
import { useSession } from "../../../auth/sessionStore";
import { useNavigation } from "../../../app/navigationStore";
import { listTanks, type ProcessingTank } from "../../../api/processing/tanks";
import { listActiveBatches, listStagesByMixingTank, type ActiveBatchDto, type ProcessingStageDto } from "../../../api/processing/stages";
import { formatColombo } from "../../../utils/time";
import { ApiError } from "../../../api/http";

const STAGE_ORDER = ["Heating", "Homogeniser", "Pasteuriser", "Cooling"] as const;

function getNextStage(stages: ProcessingStageDto[]): string | null {
  if (stages.length === 0) return "Heating";
  const active = stages.find(s => !s.endTimeUtc);
  if (active) return null; // in progress
  const lastEnded = [...stages].reverse().find(s => s.endTimeUtc);
  if (!lastEnded) return "Heating";
  const idx = STAGE_ORDER.indexOf(lastEnded.stageType as any);
  if (idx < 0 || idx >= STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[idx + 1];
}

export function ProcessingDashboardScreen() {
  const { session } = useSession();
  const { navigate } = useNavigation();
  const token = (session as any)?.accessToken ?? null;

  const [tanks, setTanks] = useState<ProcessingTank[] | null>(null);
  const [activeBatches, setActiveBatches] = useState<ActiveBatchDto[] | null>(null);
  const [stagesMap, setStagesMap] = useState<Record<string, ProcessingStageDto[]>>({});
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    const abort = new AbortController();
    listTanks(token, abort.signal)
      .then(setTanks)
      .catch((e) => {
        if (!abort.signal.aborted) setFailure(e instanceof ApiError ? e.message : "Could not load tanks");
      });
    
    listActiveBatches(token, abort.signal).then(async batches => {
      setActiveBatches(batches);
      // Fetch stages for each active batch mixing tank
      const map: Record<string, ProcessingStageDto[]> = {};
      for (const b of batches) {
        try {
          const stages = await listStagesByMixingTank(b.mixingTankId, token, abort.signal);
          map[b.mixingTankId] = stages;
        } catch {
          map[b.mixingTankId] = [];
        }
      }
      setStagesMap(map);
    }).catch(() => setActiveBatches([]));
    
    return () => abort.abort();
  }, [token]);

  const storing = tanks?.filter((t) => t.kind === "Storing") ?? [];
  const mixing = tanks?.filter((t) => t.kind === "Mixing") ?? [];
  const totalRemaining = tanks?.reduce((sum, t) => sum + t.remainingKg, 0) ?? 0;
  const totalCapacity = tanks?.reduce((sum, t) => sum + t.capacityKg, 0) ?? 0;
  const freeSpace = totalCapacity - totalRemaining;

  return (
    <>
      <div className="pagehead">
        <h1 className="pagehead__title">Factory Floor</h1>
        <p className="pagehead__detail">Today {new Date().toLocaleDateString()} - {totalRemaining.toFixed(0)} KG held</p>
      </div>

      {failure && <p className="notice notice--error">{failure}</p>}

      <div className="stats">
        <div className="stat">
          <p className="stat__label">Storing</p>
          <p className="stat__value">{storing.length}</p>
        </div>
        <div className="stat">
          <p className="stat__label">Mixing</p>
          <p className="stat__value">{mixing.length}</p>
        </div>
        <div className="stat">
          <p className="stat__label">Held</p>
          <p className="stat__value">{totalRemaining.toFixed(0)} KG</p>
        </div>
        <div className="stat">
          <p className="stat__label">Free</p>
          <p className="stat__value">{freeSpace.toFixed(0)} KG</p>
        </div>
      </div>

      <div className="section" style={{ marginTop: 16 }}>
        <div className="section__head">
          <h2 className="section__title">Batches Processing Now</h2>
        </div>
        {activeBatches == null ? (
          <p className="loading">Loading batches...</p>
        ) : activeBatches.length === 0 ? (
          <p className="emptystate">No active batches - pour from storing to mixing to start</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {activeBatches.map(b => {
              const stages = stagesMap[b.mixingTankId] ?? [];
              const active = stages.find(s => !s.endTimeUtc);
              const next = getNextStage(stages);
              return (
                <div
                  key={b.id}
                  onClick={() => navigate(`/processing/tanks/${b.mixingTankCode}`)}
                  style={{ padding: 12, background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: 8, cursor: "pointer" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{b.batchCode} · {b.productType} · {b.quantityKg.toFixed(0)} KG</span>
                    <span className="badge badge--good">{b.mixingTankCode}</span>
                  </div>
                  <p className="microlabel" style={{ marginTop: 4 }}>{b.dispatchNumber} · {b.sourceStoringTankCode} → {b.mixingTankCode} · {formatColombo(b.allocatedAtUtc)}</p>
                  {active && <p className="microlabel" style={{ marginTop: 4, color: "#15803d", fontWeight: 600 }}>{active.stageType} in progress since {formatColombo(active.startTimeUtc)}</p>}
                  {!active && next && <p className="microlabel" style={{ marginTop: 4, color: "#b45309" }}>Ready to start {next}</p>}
                  {!active && !next && <p className="microlabel" style={{ marginTop: 4, color: "#15803d" }}>Completed - ready for final storage</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="section">
        <div className="section__head">
          <h2 className="section__title">Quick Actions</h2>
        </div>
        <div className="actions">
          <button type="button" className="action" onClick={() => navigate("/processing/tanks")}>
            <span className="action__icon">ST</span>
            <span className="action__body">
              <span className="action__title">Tanks</span>
              <span className="action__detail">ST and MT, {totalRemaining.toFixed(0)} KG held</span>
            </span>
          </button>
          <button type="button" className="action" onClick={() => navigate("/processing/unloads")}>
            <span className="action__icon">UL</span>
            <span className="action__body">
              <span className="action__title">Unload</span>
              <span className="action__detail">Bowser arrival, dispatch ID</span>
            </span>
          </button>
        </div>
      </div>
    </>
  );
}
