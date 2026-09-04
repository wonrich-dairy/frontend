import { useEffect, useState } from "react";
import { ApiError } from "../../api/http";
import { createSociety, getSociety, updateSociety } from "../../api/societies";
import type { Society } from "../../api/types";
import { useSession } from "../../auth/sessionStore";
import { useNavigation } from "../../app/navigationStore";
import { ArrowLeftIcon, LockIcon, PersonIcon, SaveIcon, WarningIcon } from "../../components/icons";
import { ErrorNotice, Loading, SaveConfirmation } from "../../components/ui/Feedback";

interface Draft {
  name: string;
  leader: string;
  tag: string;
  contactNumber: string;
}

const blank: Draft = { name: "", leader: "", tag: "", contactNumber: "" };

export function SocietyFormScreen({ id }: { id?: string }) {
  const { session } = useSession();
  const { navigate, back } = useNavigation();
  const token = session?.accessToken ?? null;
  const editing = Boolean(id);

  const [draft, setDraft] = useState<Draft>(blank);
  const [existing, setExisting] = useState<Society | null>(null);
  const [loading, setLoading] = useState(editing);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!id) {
      return;
    }

    const abort = new AbortController();

    getSociety(id, token, abort.signal)
      .then((society) => {
        setExisting(society);
        setDraft({
          name: society.name,
          leader: society.contactPerson ?? "",
          tag: society.canLabelPrefix,
          contactNumber: society.contactNumber ?? "",
        });
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (abort.signal.aborted) {
          return;
        }

        setLoading(false);
        setFailure(error instanceof ApiError ? error.message : "That society could not be loaded.");
      });

    return () => abort.abort();
  }, [id, token]);

  const tag = draft.tag.trim().toUpperCase();
  const complete = draft.name.trim() !== "" && tag !== "";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!complete || saving) {
      return;
    }

    setSaving(true);
    setFailure(null);

    const body = {
      code: tag,
      name: draft.name.trim(),
      canLabelPrefix: tag,
      contactPerson: draft.leader.trim() === "" ? null : draft.leader.trim(),
      contactNumber: draft.contactNumber.trim() === "" ? null : draft.contactNumber.trim(),
    };

    try {
      await (id ? updateSociety(id, body, token) : createSociety(body, token));

      setSaved(true);
    } catch (error: unknown) {
      setFailure(
        error instanceof ApiError ? error.message : "The society could not be saved. Try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <SaveConfirmation
        title={editing ? "Changes Saved" : "Society Registered"}
        detail={
          editing
            ? "The society's details have been updated."
            : "The society can now be chosen when registering a consignment."
        }
        primaryLabel="Back to Settings"
        onPrimary={() => navigate("/settings")}
      />
    );
  }

  if (loading) {
    return <Loading label="Loading the society..." />;
  }

  return (
    <form onSubmit={submit} noValidate>
      <header className="pagehead pagehead--back">
        <button type="button" className="iconbutton" onClick={() => back("/settings")} title="Back">
          <ArrowLeftIcon width={20} height={20} />
          <span className="sr-only">Back</span>
        </button>
        <h1 className="pagehead__title">{editing ? "Edit Society" : "Add New Society"}</h1>
      </header>

      {editing ? (
        <p className="pagehead__detail">Update the primary contact details for this consignment group.</p>
      ) : null}

      {failure ? <ErrorNotice>{failure}</ErrorNotice> : null}

      <section className="card">
        <label className="field">
          <span className="field__label">Society Name</span>
          <input
            value={draft.name}
            disabled={saving || editing}
            placeholder="e.g. Kobeigane"
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
          />
        </label>

        <label className="field">
          <span className="field__label">
            Society Tag {editing ? <LockIcon width={12} height={12} /> : null}
          </span>
          <input
            value={draft.tag}
            disabled={saving || editing}
            placeholder="E.G. KG"
            maxLength={10}
            onChange={(event) => setDraft((current) => ({ ...current, tag: event.target.value }))}
          />
          {editing ? null : (
            <span className="field__hint field__hint--warning">
              <WarningIcon width={13} height={13} />
              This tag cannot be changed later.
            </span>
          )}
        </label>

        <label className="field">
          <span className="field__label">Leader's Name</span>
          <span className="field__wrap">
            <PersonIcon className="field__icon" />
            <input
              value={draft.leader}
              disabled={saving}
              placeholder="e.g. Sunil Perera"
              onChange={(event) =>
                setDraft((current) => ({ ...current, leader: event.target.value }))
              }
            />
          </span>
          <span className="field__hint">Primary point of contact for daily pickups.</span>
        </label>

        <label className="field">
          <span className="field__label">Contact Number</span>
          <input
            value={draft.contactNumber}
            disabled={saving}
            inputMode="tel"
            placeholder="Optional"
            onChange={(event) =>
              setDraft((current) => ({ ...current, contactNumber: event.target.value }))
            }
          />
        </label>

        <button type="submit" className="button button--onDark button--wide" disabled={!complete || saving}>
          <SaveIcon />
          {saving ? "Saving..." : editing ? "Save Changes" : "Save Society"}
        </button>
      </section>

      {existing && !existing.isActive ? (
        <p className="card__footnote">
          This society is retired, so it is not offered at the gate. Historical consignments still
          resolve to it.
        </p>
      ) : null}
    </form>
  );
}
