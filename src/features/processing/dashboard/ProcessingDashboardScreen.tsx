import { useEffect, useState } from "react";
import { useSession } from "../../../auth/sessionStore";
import { useNavigation } from "../../../app/navigationStore";
import { listTanks, type ProcessingTank } from "../../../api/processing/tanks";
import { ApiError } from "../../../api/http";

export function ProcessingDashboardScreen() {
  const { session } = useSession();
  const { navigate } = useNavigation();
  const token = (session as any)?.accessToken ?? null;

  const [tanks, setTanks] = useState<ProcessingTank[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    const abort = new AbortController();
    listTanks(token, abort.signal)
      .then(setTanks)
      .catch((e) => {
        if (!abort.signal.aborted) setFailure(e instanceof ApiError ? e.message : "Could not load tanks");
      });
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
        <p className="pagehead__detail">Today's overview - {new Date().toLocaleDateString()}</p>
      </div>

      {failure && <p className="notice notice--error">{failure}</p>}

      <div className="stats">
        <div className="stat">
          <p className="stat__label">Storing Tanks</p>
          <p className="stat__value">{storing.length}</p>
        </div>
        <div className="stat">
          <p className="stat__label">Mixing Tanks</p>
          <p className="stat__value">{mixing.length}</p>
        </div>
        <div className="stat">
          <p className="stat__label">Milk Held</p>
          <p className="stat__value">{totalRemaining.toFixed(0)} KG</p>
        </div>
        <div className="stat">
          <p className="stat__label">Free Space</p>
          <p className="stat__value">{freeSpace.toFixed(0)} KG</p>
        </div>
      </div>

      <div className="section">
        <div className="section__head">
          <h2 className="section__title">Quick Actions</h2>
        </div>
        <div className="actions">
          <button type="button" className="action" onClick={() => navigate("/processing/tanks")}>
            <span className="action__icon">ST</span>
            <span className="action__body">
              <span className="action__title">Manage Tanks</span>
              <span className="action__detail">Storing and mixing tanks, capacity in KG, ST-01 format</span>
            </span>
          </button>
          <button type="button" className="action" onClick={() => navigate("/processing/unloads")}>
            <span className="action__icon">UL</span>
            <span className="action__body">
              <span className="action__title">Record Unload</span>
              <span className="action__detail">Bowser arrival, sensory check, dispatch ID</span>
            </span>
          </button>
        </div>
      </div>

      <div className="section">
        <div className="section__head">
          <h2 className="section__title">Tanks Status</h2>
          <span className="section__count">{tanks?.length ?? 0} tanks</span>
        </div>
        {tanks?.length === 0 && <p className="emptystate">No tanks configured. Seed has 3 storing + 3 mixing.</p>}
        {tanks?.map((tank) => (
          <div key={tank.id} className="tankcard" onClick={() => navigate(`/processing/tanks/${tank.code}`)}>
            <div className="tankcard__head">
              <div>
                <span className="tankcard__code">{tank.code}</span>
                <span className="tankcard__name">{tank.name}</span>
              </div>
              <span className={`pill ${tank.status === "Active" ? "" : "pill--offline"}`}>{tank.status}</span>
            </div>
            <span className="tankcard__figure">{tank.remainingKg.toFixed(0)} KG / {tank.capacityKg.toFixed(0)} KG</span>
            <span className="tankcard__bar"><span className="tankcard__fill" style={{ width: `${Math.min(100, (tank.remainingKg / tank.capacityKg) * 100)}%` }} /></span>
            <span className="tankcard__foot">{tank.availableKg.toFixed(0)} KG free • {tank.kind}</span>
          </div>
        ))}
      </div>
    </>
  );
}
