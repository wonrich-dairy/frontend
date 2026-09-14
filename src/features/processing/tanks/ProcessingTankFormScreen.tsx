import { useEffect, useState } from "react";
import { ApiError } from "../../../api/http";
import { getTank, createTank, updateTank, listTanks, normalizeTankCode, previewTankCode, isValidTankCode, TANK_KINDS, type TankKind } from "../../../api/processing/tanks";
import { useSession } from "../../../auth/sessionStore";
import { useNavigation } from "../../../app/navigationStore";

interface Props {
  code?: string;
  id?: string;
}

export function ProcessingTankFormScreen({ code, id }: Props) {
  const { session } = useSession();
  const { navigate } = useNavigation();
  const token = (session as any)?.accessToken ?? null;
  const identifier = id ?? code;
  const editing = Boolean(identifier);

  const [loading, setLoading] = useState(editing);
  const [draft, setDraft] = useState<{ code: string; kind: TankKind; capacityKg: string }>({ code: "", kind: "Storing", capacityKg: "" });
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [rowVersion, setRowVersion] = useState<string | undefined>(undefined);
  const [realId, setRealId] = useState<string | undefined>(undefined);
  const [realCode, setRealCode] = useState<string>("");

  useEffect(() => {
    if (!identifier) { setLoading(false); return; }
    const isGuid = identifier.length >= 32;
    const load = isGuid ? getTank(identifier, token) : listTanks(token).then((tanks) => {
      const found = tanks.find((t) => t.code === identifier);
      if (!found) throw new Error(`Tank ${identifier} not found`);
      return found;
    });
    load.then((tank) => {
      setDraft({ code: tank.code, kind: tank.kind, capacityKg: String(tank.capacityKg) });
      setRowVersion(tank.rowVersion);
      setRealId(tank.id);
      setRealCode(tank.code);
      setLoading(false);
    }).catch((e) => { setLoading(false); setFailure(e instanceof ApiError ? e.message : "Tank could not be found"); });
  }, [identifier, token]);

  const normalizedPreview = draft.code ? previewTankCode(draft.code) : "";
  const validCode = draft.code ? isValidTankCode(draft.code) : false;
  const capacity = Number(draft.capacityKg);
  const complete = (editing || (draft.code.trim() !== "" && validCode)) && Number.isFinite(capacity) && capacity > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complete || saving) return;
    setSaving(true); setFailure(null);
    try {
      const normalized = normalizeTankCode(draft.code);
      if (editing && realId) { await updateTank(realId, { capacityKg: capacity, rowVersion }, token); }
      else if (editing && identifier) { await updateTank(identifier, { capacityKg: capacity, rowVersion }, token); }
      else { await createTank({ code: normalized, kind: draft.kind, capacityKg: capacity }, token); }
      navigate("/processing/tanks");
    } catch (err: any) { setFailure(err.message); } finally { setSaving(false); }
  };

  if (loading) return <p className="loading">Loading tank...</p>;

  return (
    <form onSubmit={submit} noValidate>
      <div className="pagehead">
        <h1 className="pagehead__title">{editing ? `Edit ${realCode || draft.code || "Tank"}` : "Add Factory Tank"}</h1>
        <p className="pagehead__detail">{editing ? "Only capacity in KG is editable. Code and kind are fixed." : "Code ST-01, type st1 to ST-01, dash default, uppercase stored. KG not litres."}</p>
      </div>
      {failure && <p className="notice notice--error">{failure}</p>}
      <section className="card">
        <label className="field">
          <span className="field__label">Tank Code (e.g. st1 to ST-01)</span>
          <div className="field__wrap"><input value={draft.code} disabled={editing || saving} placeholder="ST1" maxLength={10} onChange={(e) => setDraft({ ...draft, code: e.target.value })} /></div>
          {draft.code && !editing && (<span className={`field__hint ${validCode ? "" : "field__hint--warning"}`}>Preview: {normalizedPreview} {validCode ? "OK" : "Use ST1 format"}</span>)}
          {editing && <span className="field__hint">Code {realCode} - not editable</span>}
        </label>
        <label className="field">
          <span className="field__label">Kind</span>
          <select value={draft.kind} disabled={editing || saving} onChange={(e) => setDraft({ ...draft, kind: e.target.value as TankKind })}>{TANK_KINDS.map((k) => (<option key={k} value={k}>{k} tank</option>))}</select>
        </label>
        <label className="field">
          <span className="field__label">Capacity (KG)</span>
          <div className="field__wrap"><input value={draft.capacityKg} disabled={saving} inputMode="decimal" placeholder="5000" onChange={(e) => setDraft({ ...draft, capacityKg: e.target.value })} /></div>
          <span className="field__hint">KG not litres. Must be positive.</span>
        </label>
        <button type="submit" className="button button--wide" disabled={!complete || saving}>{saving ? "Saving..." : editing ? "Update Capacity" : "Save Tank"}</button>
      </section>
    </form>
  );
}
