import { useEffect, useState } from "react";
import { ApiError } from "../../api/http";
import {
  createProcessingTank,
  listProcessingTanks,
  TANK_KINDS,
  updateProcessingTank,
  type ProcessingTank,
  type TankKind,
} from "../../api/processing";
import { useSession } from "../../auth/sessionStore";
import { useNavigation } from "../../app/navigationStore";
import { DropletIcon, SaveIcon, TankIcon } from "../../components/icons";
import { ErrorNotice, Loading } from "../../components/ui/Feedback";

export function ProcessingTankFormScreen({ code }: { code?: string }) {
  const { session } = useSession();
  const { navigate } = useNavigation();
  const token = session?.accessToken ?? null;
  const editing = Boolean(code);

  const [tank, setTank] = useState<ProcessingTank | null>(null);
  const [loading, setLoading] = useState(editing);
  const [draft, setDraft] = useState<{
    code: string;
    name: string;
    kind: TankKind;
    capacityLitres: string;
  }>({ code: "", name: "", kind: "Storing", capacityLitres: "" });
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!code) {
      return;
    }

    const abort = new AbortController();

    listProcessingTanks(token, abort.signal)
      .then((tanks) => {
        const found = tanks.find((one) => one.code === code) ?? null;

        setTank(found);
        setLoading(false);

        if (found) {
          setDraft({
            code: found.code,
            name: found.name,
            kind: found.kind,
            capacityLitres: String(found.capacityLitres),
          });
        } else {
          setFailure(`No factory tank is registered under code "${code}".`);
        }
      })
      .catch((error: unknown) => {
        if (abort.signal.aborted) {
          return;
        }

        setLoading(false);
        setFailure(error instanceof ApiError ? error.message : "That tank could not be loaded.");
      });

    return () => abort.abort();
  }, [code, token]);

  const capacity = Number(draft.capacityLitres);
  const complete =
    draft.name.trim() !== "" &&
    Number.isFinite(capacity) &&
    capacity > 0 &&
    (editing || draft.code.trim() !== "");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!complete || saving) {
      return;
    }

    setSaving(true);
    setFailure(null);

    const body = {
      code: draft.code.trim().toUpperCase(),
      name: draft.name.trim(),
      kind: draft.kind,
      capacityLitres: capacity,
    };

    try {
      if (code) {
        await updateProcessingTank(code, body, token);
      } else {
        await createProcessingTank(body, token);
      }

      navigate("/processing/tanks");
    } catch (error: unknown) {
      setFailure(error instanceof ApiError ? error.message : "That tank could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Loading label="Loading the tank..." />;
  }

  if (editing && !tank) {
    return <ErrorNotice>{failure ?? "That tank could not be found."}</ErrorNotice>;
  }

  return (
    <form onSubmit={submit} noValidate>
      <header className="pagehead">
        <h1 className="pagehead__title">{editing ? "Edit Tank" : "Add Factory Tank"}</h1>
        <p className="pagehead__detail">
          {editing
            ? "The code and the kind are fixed. An unload names a storing tank and an allocation names a mixing one, so a tank that changed either would make its own history unreadable."
            : "Storing tanks take what a bowser brings. Mixing tanks take allocations from them."}
        </p>
      </header>

      {failure ? <ErrorNotice>{failure}</ErrorNotice> : null}

      <section className="card">
        <label className="field">
          <span className="field__label">Tank Code</span>
          <span className="field__wrap">
            <TankIcon className="field__icon" />
            <input
              value={draft.code}
              disabled={editing || saving}
              readOnly={editing}
              placeholder="e.g. ST1"
              maxLength={10}
              onChange={(event) => setDraft({ ...draft, code: event.target.value })}
            />
          </span>
        </label>

        <label className="field">
          <span className="field__label">Tank Name</span>
          <span className="field__wrap">
            <TankIcon className="field__icon" />
            <input
              value={draft.name}
              disabled={saving}
              placeholder="e.g. Storing Tank 1"
              maxLength={100}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
          </span>
        </label>

        <label className="field">
          <span className="field__label">Kind</span>
          <select
            value={draft.kind}
            disabled={editing || saving}
            onChange={(event) => setDraft({ ...draft, kind: event.target.value as TankKind })}
          >
            {TANK_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {kind}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field__label">Capacity (Liters)</span>
          <span className="field__wrap">
            <DropletIcon className="field__icon" />
            <input
              value={draft.capacityLitres}
              disabled={saving}
              inputMode="decimal"
              placeholder="e.g. 10000"
              onChange={(event) => setDraft({ ...draft, capacityLitres: event.target.value })}
            />
          </span>
        </label>

        <button type="submit" className="button button--wide" disabled={!complete || saving}>
          <SaveIcon />
          {saving ? "Saving..." : "Save Tank"}
        </button>
      </section>
    </form>
  );
}
