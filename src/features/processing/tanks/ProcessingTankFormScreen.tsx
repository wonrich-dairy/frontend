import { useEffect, useState } from "react";
import { ApiError } from "../../../api/http";
import { getTank, createTank, updateTank, listTanks, normalizeTankCode, previewTankCode, isValidTankCode, TANK_KINDS, type TankKind, type ProcessingTank } from "../../../api/processing/tanks";
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

  const [existingTanks, setExistingTanks] = useState<ProcessingTank[] | null>(null);

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

  useEffect(() => {
    if (editing) return;
    let cancelled = false;
    const controller = new AbortController();
    listTanks(token, controller.signal)
      .then((tanks) => { if (!cancelled) setExistingTanks(tanks); })
      .catch(() => { if (!cancelled) setExistingTanks([]); });
    return () => { cancelled = true; controller.abort(); };
  }, [token, editing]);

  const normalizedPreview = draft.code ? previewTankCode(draft.code) : "";
  const validCode = draft.code ? isValidTankCode(draft.code) : false;

  const normalizedForCheck = (() => {
    if (!draft.code || !validCode) return null;
    try { return normalizeTankCode(draft.code); } catch { return null; }
  })();

  const isDuplicate = !editing && normalizedForCheck ? (existingTanks?.some(t => t.code === normalizedForCheck) ?? false) : false;

  // Auto-derive kind from code prefix ST/MT
  const derivedKind: TankKind | null = (() => {
    if (!normalizedForCheck) return null;
    if (normalizedForCheck.startsWith("ST-")) return "Storing";
    if (normalizedForCheck.startsWith("MT-")) return "Mixing";
    return null;
  })();

  // Auto-set kind when code changes and is valid
  useEffect(() => {
    if (editing) return;
    if (derivedKind && draft.kind !== derivedKind) {
      setDraft((prev) => ({ ...prev, kind: derivedKind }));
    }
  }, [derivedKind, editing]);

  const capacity = Number(draft.capacityKg);
  const complete = (editing || (draft.code.trim() !== "" && validCode && !isDuplicate)) && Number.isFinite(capacity) && capacity > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complete || saving) return;
    setSaving(true); setFailure(null);
    try {
      const normalized = normalizeTankCode(draft.code);
      // Safety check for mismatch (should not happen due to auto-derive)
      if (normalized.startsWith("ST-") && draft.kind !== "Storing") {
        throw new Error("ST code must be Storing tank");
      }
      if (normalized.startsWith("MT-") && draft.kind !== "Mixing") {
        throw new Error("MT code must be Mixing tank");
      }
      if (editing && realId) { await updateTank(realId, { capacityKg: capacity, rowVersion }, token); }
      else if (editing && identifier) { await updateTank(identifier, { capacityKg: capacity, rowVersion }, token); }
      else { await createTank({ code: normalized, kind: draft.kind, capacityKg: capacity }, token); }
      navigate("/processing/tanks");
    } catch (err: any) { setFailure(err.message); } finally { setSaving(false); }
  };

  if (loading) return <p className="loading">Loading tank...</p>;

  const kindDisabled = !editing && derivedKind !== null;

  return (
    <form onSubmit={submit} noValidate>
      <div className="pagehead">
        <h1 className="pagehead__title">{editing ? `Edit ${realCode || draft.code || "Tank"}` : "Add Factory Tank"}</h1>
        <p className="pagehead__detail">{editing ? "Only capacity in KG is editable. Code and kind are fixed." : "Code ST-01 = Storing Tank 01, MT-01= Mixing Tank 01. Type st1 to ST-01."}</p>
      </div>
      {failure && <p className="notice notice--error">{failure}</p>}
      <section className="card">
        <label className="field">
          <span className="field__label">Tank Code (e.g. st1 to ST-01, mt2 to MT-02)</span>
          <div className="field__wrap"><input value={draft.code} disabled={editing || saving} placeholder="ST1 or MT2" maxLength={10} onChange={(e) => setDraft({ ...draft, code: e.target.value })} /></div>
          {draft.code && !editing && (
            isDuplicate ? (
              <span className="field__hint field__hint--warning">Tank {normalizedForCheck} already exists - choose different code</span>
            ) : (
              <span className={`field__hint ${validCode ? "" : "field__hint--warning"}`}>
                Preview: {normalizedPreview} {validCode ? `- ${derivedKind} - available` : "Use ST1 or MT2 format"}
              </span>
            )
          )}
          {editing && <span className="field__hint">Code {realCode} - not editable</span>}
        </label>
        <label className="field">
          <span className="field__label">Kind</span>
          <select value={draft.kind} disabled={editing || saving || kindDisabled} onChange={(e) => setDraft({ ...draft, kind: e.target.value as TankKind })}>
            {TANK_KINDS.map((k) => (<option key={k} value={k}>{k} tank</option>))}
          </select>
          {kindDisabled && <span className="field__hint">Auto-set from code: ST = Storing, MT = Mixing</span>}
          {!kindDisabled && !editing && <span className="field__hint">Type ST code for Storing, MT for Mixing</span>}
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
