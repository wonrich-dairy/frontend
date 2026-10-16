import { useEffect, useId, useState } from "react";
import { useSession } from "../../../auth/sessionStore";
import { useNavigation } from "../../../app/navigationStore";
import { ClipboardIcon, DropletIcon } from "../../../components/icons";
import { EmptyState, ErrorNotice, Loading } from "../../../components/ui/Feedback";
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
  const tanksId = useId();
  const batchesId = useId();
  const actionsId = useId();

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
      <header className="qcohead">
        <h1 className="panelhead__title">Factory Floor</h1>
        <p className="qcohead__fresh">Today {new Date().toLocaleDateString()} - {totalRemaining.toFixed(0)} KG held</p>
      </header>

      <div className="qcogrid">
        <section className="qcopanel qcopanel--full" aria-labelledby={tanksId}>
          <h2 id={tanksId} className="qcopanel__title">
            Tanks
          </h2>
          {failure ? <ErrorNotice>{failure}</ErrorNotice> : null}
          {tanks == null ? (
            failure ? null : <Loading label="Loading tanks..." />
          ) : (
            <dl className="statusgrid">
              <Stat label="Storing" value={String(storing.length)} />
              <Stat label="Mixing" value={String(mixing.length)} />
              <Stat label="Held" value={`${totalRemaining.toFixed(0)} KG`} />
              <Stat label="Free" value={`${freeSpace.toFixed(0)} KG`} />
            </dl>
          )}
        </section>

        <section className="qcopanel qcopanel--full" aria-labelledby={batchesId}>
          <h2 id={batchesId} className="qcopanel__title">
            Batches processing now
          </h2>
          {activeBatches == null ? (
            <Loading label="Loading batches..." />
          ) : activeBatches.length === 0 ? (
            <EmptyState>No active batches - pour from storing to mixing to start</EmptyState>
          ) : (
            <ul className="failurelist">
              {activeBatches.map(b => {
                const stages = stagesMap[b.mixingTankId] ?? [];
                const active = stages.find(s => !s.endTimeUtc);
                const next = getNextStage(stages);
                return (
                  <li key={b.id}>
                    <button
                      type="button"
                      className="failurelist__code failurelist__link"
                      onClick={() => navigate(`/processing/tanks/${b.mixingTankCode}`)}
                    >
                      {b.batchCode}
                    </button>
                    <span className="failurelist__meta">
                      {b.productType} · {b.quantityKg.toFixed(0)} KG · {b.dispatchNumber} · {b.sourceStoringTankCode} → {b.mixingTankCode} · {formatColombo(b.allocatedAtUtc)}
                    </span>
                    <span className="failurelist__reasons">
                      {active && <span className="badge badge--pending">{active.stageType} in progress since {formatColombo(active.startTimeUtc)}</span>}
                      {!active && next && <span className="badge badge--warn">Ready to start {next}</span>}
                      {!active && !next && <span className="badge badge--good">Completed - ready for final storage</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="qcopanel qcopanel--full" aria-labelledby={actionsId}>
          <h2 id={actionsId} className="qcopanel__title">
            Quick actions
          </h2>
          <div className="actions">
            <button type="button" className="action" onClick={() => navigate("/processing/tanks")}>
              <span className="action__icon">
                <DropletIcon width={20} height={20} />
              </span>
              <span className="action__body">
                <span className="action__title">Tanks</span>
                <span className="action__detail">ST and MT, {totalRemaining.toFixed(0)} KG held</span>
              </span>
            </button>
            <button type="button" className="action" onClick={() => navigate("/processing/unloads")}>
              <span className="action__icon">
                <ClipboardIcon width={20} height={20} />
              </span>
              <span className="action__body">
                <span className="action__title">Unload</span>
                <span className="action__detail">Bowser arrival, dispatch ID</span>
              </span>
            </button>
          </div>
        </section>
      </div>
    </>
  );
}

// The QCO dashboard's status tile, so a count reads the same in every module's home.
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="statustile statustile--neutral">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
