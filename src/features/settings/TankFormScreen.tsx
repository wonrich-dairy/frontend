import { useEffect, useState } from "react";
import { ApiError } from "../../api/http";
import { createTank, listTanks, updateTank, type Tank } from "../../api/tanks";
import { useSession } from "../../auth/sessionStore";
import { useNavigation } from "../../app/navigationStore";
import { DropletIcon, SaveIcon, TankIcon } from "../../components/icons";
import { ErrorNotice, Loading } from "../../components/ui/Feedback";

export function TankFormScreen({ code }: { code?: string }) {
  const { session } = useSession();
  const { navigate } = useNavigation();
  const token = session?.accessToken ?? null;
  const editing = Boolean(code);

  const [tank, setTank] = useState<Tank | null>(null);
  const [loading, setLoading] = useState(editing);
  const [draft, setDraft] = useState({ code: "", name: "", capacityLitres: "" });
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!code) {
      return;
    }

    const abort = new AbortController();

    listTanks(token, abort.signal)
      .then((tanks) => {
        const found = tanks.find((one) => one.code === code) ?? null;

        setTank(found);
        setLoading(false);

        if (found) {
          setDraft({
            code: found.code,
            name: found.name,
            capacityLitres: String(found.capacityLitres),
          });
        } else {
          setFailure(`No chilling tank is registered under code "${code}".`);
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
      capacityLitres: capacity,
    };

    try {
      if (code) {
        await updateTank(code, body, token);
      } else {
        await createTank(body, token);
      }

      navigate("/settings");
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
        <h1 className="pagehead__title">{editing ? "Edit Tank" : "Add New Tank"}</h1>
        <p className="pagehead__detail">
          {editing
            ? "The code is painted on the plant and stamped on every record this tank appears in, so it cannot be changed."
            : "Give the tank the code painted on it and its working volume."}
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
              placeholder="e.g. T4"
              maxLength={10}
              onChange={(event) => setDraft({ ...draft, code: event.target.value })}
            />
          </span>
        </label>

        <label className="field">
          <span className="field__label">Tank Name/Number</span>
          <span className="field__wrap">
            <TankIcon className="field__icon" />
            <input
              value={draft.name}
              disabled={saving}
              placeholder="e.g. Chilling Tank 4"
              maxLength={100}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
          </span>
        </label>

        <label className="field">
          <span className="field__label">Capacity (Liters)</span>
          <span className="field__wrap">
            <DropletIcon className="field__icon" />
            <input
              value={draft.capacityLitres}
              disabled={saving}
              inputMode="decimal"
              placeholder="e.g. 5000"
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
