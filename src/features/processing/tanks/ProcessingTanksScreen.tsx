import { useEffect, useState } from "react";
import { ApiError } from "../../../api/http";
import { listTanks, changeTankStatus, deleteTank, TANK_KINDS, type ProcessingTank, type TankKind } from "../../../api/processing/tanks";
import { useSession } from "../../../auth/sessionStore";
import { useNavigation } from "../../../app/navigationStore";
import { can, roleFromToken } from "../../../auth/permissions";

export function ProcessingTanksScreen() {
  const { session } = useSession();
  const { navigate } = useNavigation();
  const token = (session as any)?.accessToken ?? null;
  const role = roleFromToken(token);
  const mayManage = can(role, "manageProcessingTanks");

  const [kind, setKind] = useState<TankKind | null>(null);
  const [tanks, setTanks] = useState<ProcessingTank[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [menu, setMenu] = useState<ProcessingTank | null>(null);
  const [changing, setChanging] = useState<ProcessingTank | null>(null);
  const [deleting, setDeleting] = useState<ProcessingTank | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
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

      {mayManage && (<button type="button" className="button button--onDark button--wide" onClick={() => navigate("/processing/tanks/new")}>+ Add Tank (ST-01 format)</button>)}

      {failure && <p className="notice notice--error">{failure}</p>}
      {!tanks && <p className="loading">Loading tanks...</p>}
      {tanks?.length === 0 && !failure && (<p className="emptystate">{kind ? `No ${kind.toLowerCase()} tank configured` : "No tank configured yet. Seed has 3 storing + 3 mixing."}</p>)}

      {tanks?.map((tank) => (
        <article key={tank.id} className="tankrow">
          <header className="tankrow__head">
            <h2 className="tankrow__name">{tank.name}</h2>
            {mayManage && (<button type="button" className="iconbutton" onClick={() => setMenu(tank)} title={`Options for ${tank.code}`}>...</button>)}
          </header>
          <p className="tankrow__status"><span className={tank.status === "Active" ? "dot dot--active" : "dot"} />{tank.status}<span className="tankrow__code">{tank.code} - {tank.kind}</span></p>
          <dl className="tankrow__facts"><div><dt className="microlabel">Capacity</dt><dd>{tank.capacityKg.toFixed(0)} KG</dd></div><div><dt className="microlabel">Holding</dt><dd>{tank.remainingKg.toFixed(0)} KG - {tank.availableKg.toFixed(0)} KG free</dd></div></dl>
          <div className="meter" style={{ marginTop: 8 }}><span className="meter__fill" style={{ width: `${Math.min(100, (tank.remainingKg / tank.capacityKg) * 100)}%` }} /></div>
        </article>
      ))}

      {menu && (
        <div className="scrim scrim--bottom" onClick={() => setMenu(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <span className="sheet__grip" />
            <p className="sheet__eyebrow">{menu.code}</p>
            <h3 className="sheet__title">Tank Options</h3>
            <div className="sheet__actions">
              <button type="button" className="sheetaction" onClick={() => { const c = menu.code; setMenu(null); navigate(`/processing/tanks/${c}`); }}>Edit Capacity</button>
              <button type="button" className="sheetaction" onClick={() => { setChanging(menu); setMenu(null); }}>{menu.status === "Active" ? "Take Out of Service" : "Put Back in Service"}</button>
              <button type="button" className="sheetaction sheetaction--danger" onClick={() => { setDeleting(menu); setMenu(null); setDeleteConfirm(""); }}>Delete Tank</button>
            </div>
            <button type="button" className="button button--ghost" onClick={() => setMenu(null)}>Cancel</button>
          </div>
        </div>
      )}

      {changing && (
        <div className="scrim"><div className="confirm"><div className="confirm__head"><h3 className="confirm__title">{changing.status === "Active" ? "Take out of service?" : "Put back in service?"}</h3></div><div className="confirm__body"><p className="confirm__subject">{changing.code} - {changing.name}</p><p className="confirm__detail">{changing.status === "Active" ? `Nothing can go into it until back. ${changing.remainingKg > 0 ? `Tank still holds ${changing.remainingKg} KG - empty first.` : ""}` : "It will start accepting milk again."}</p></div><div className="confirm__actions"><button type="button" className="button" onClick={async () => { const t = changing; setChanging(null); try { await changeTankStatus(t.id, t.status === "Active" ? "Inactive" : "Active", t.rowVersion, token); setReloads((c) => c + 1); } catch (e: any) { setFailure(e.message); } }}>Confirm</button><button type="button" className="button button--ghost" onClick={() => setChanging(null)}>Cancel</button></div></div></div>
      )}

      {deleting && (
        <div className="scrim"><div className="confirm"><div className="confirm__head"><div className="confirm__mark">!</div><h3 className="confirm__title">Delete Tank? Cannot be undone</h3></div><div className="confirm__body"><p className="confirm__subject">{deleting.code}</p><p className="confirm__detail">This process cannot be undone. Type <strong>DELETE {deleting.code}</strong> to confirm.</p><div className="field" style={{ marginTop: 12 }}><input value={deleteConfirm} placeholder={`Type DELETE ${deleting.code}`} onChange={(e) => setDeleteConfirm(e.target.value)} /></div></div><div className="confirm__actions"><button type="button" className="button button--danger" disabled={deleteConfirm !== `DELETE ${deleting.code}`} onClick={async () => { const t = deleting; setDeleting(null); try { await deleteTank(t.id, token); setReloads((c) => c + 1); } catch (e: any) { setFailure(e.message); } }}>Delete</button><button type="button" className="button button--ghost" onClick={() => setDeleting(null)}>Cancel</button></div></div></div>
      )}
    </>
  );
}
