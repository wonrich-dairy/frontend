import { useEffect, useState } from "react";
import { ApiError } from "../../../api/http";
import { listTanks, TANK_KINDS, type ProcessingTank, type TankKind } from "../../../api/processing/tanks";
import { useSession } from "../../../auth/sessionStore";
import { useNavigation } from "../../../app/navigationStore";
import { can, roleFromToken } from "../../../auth/permissions";
import { ProcessingTankPopup } from "./ProcessingTankPopup";

export function ProcessingTanksScreen() {
  const { session } = useSession();
  const { navigate } = useNavigation();
  const token = (session as any)?.accessToken ?? null;
  const role = roleFromToken(token);
  const mayManage = can(role, "manageProcessingTanks");

  const [kind, setKind] = useState<TankKind | null>(null);
  const [tanks, setTanks] = useState<ProcessingTank[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [selectedTank, setSelectedTank] = useState<ProcessingTank | null>(null);
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    const abort = new AbortController();
    listTanks(token, abort.signal, kind ?? undefined)
      .then((loaded) => { setTanks(loaded); setFailure(null); })
      .catch((e) => { if (!abort.signal.aborted) { setTanks([]); setFailure(e instanceof ApiError ? e.message : "Tanks could not be loaded"); } });
    return () => abort.abort();
  }, [token, kind, reloads]);

  return (
    <>
      <div className="pagehead">
        <h1 className="pagehead__title">Factory Tanks</h1>
        <p className="pagehead__detail">Storing tanks take bowser milk. Mixing tanks take allocations. Capacity in KG.</p>
      </div>

      <div className="filterbar">
        <button type="button" className={`chip${kind === null ? " chip--on" : ""}`} onClick={() => setKind(null)}>All</button>
        {TANK_KINDS.map((k) => (<button key={k} type="button" className={`chip${kind === k ? " chip--on" : ""}`} onClick={() => setKind(k)}>{k}</button>))}
      </div>

      {failure && <p className="notice notice--error">{failure}</p>}
      {!tanks && <p className="loading">Loading tanks...</p>}
      {tanks?.length === 0 && !failure && (<p className="emptystate">{kind ? `No ${kind.toLowerCase()} tank configured` : "No tank configured yet. Seed has 3 storing + 3 mixing."}</p>)}

      {tanks?.map((tank) => (
        <article key={tank.id} className="tankrow">
          <header className="tankrow__head">
            <h2 className="tankrow__name">{tank.name}</h2>
            {mayManage && (<button type="button" className="iconbutton" onClick={() => setSelectedTank(tank)} title={`Options for ${tank.code}`}>...</button>)}
          </header>
          <p className="tankrow__status"><span className={tank.status === "Active" ? "dot dot--active" : "dot"} />{tank.status}<span className="tankrow__code">{tank.code} - {tank.kind}</span></p>
          <dl className="tankrow__facts"><div><dt className="microlabel">Capacity</dt><dd>{tank.capacityKg.toFixed(0)} KG</dd></div><div><dt className="microlabel">Holding</dt><dd>{tank.remainingKg.toFixed(0)} KG - {tank.availableKg.toFixed(0)} KG free</dd></div></dl>
          <div className="meter" style={{ marginTop: 8 }}><span className="meter__fill" style={{ width: `${Math.min(100, (tank.remainingKg / tank.capacityKg) * 100)}%` }} /></div>
        </article>
      ))}

      <ProcessingTankPopup
        tank={selectedTank}
        token={token}
        onClose={() => setSelectedTank(null)}
        onStatusChanged={() => setReloads((c) => c + 1)}
        onDeleted={() => setReloads((c) => c + 1)}
        onEdit={(code) => { setSelectedTank(null); navigate(`/processing/tanks/${code}`); }}
        onError={(msg) => setFailure(msg)}
      />
    </>
  );
}
