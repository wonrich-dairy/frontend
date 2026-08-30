import { useCallback, useEffect, useMemo, useState } from "react";
import { registerConsignment } from "../../api/consignments";
import { ApiError } from "../../api/http";
import { listSocieties } from "../../api/societies";
import type { Consignment, Society } from "../../api/types";
import { ArrowRightIcon, CheckIcon, CloudOffIcon, PlusCircleIcon, WarningIcon } from "../../components/icons";
import { useSession } from "../../auth/sessionStore";
import { useSync } from "../sync/syncStore";
import { CanRow } from "./CanRow";
import { SocietyPicker } from "./SocietyPicker";
import {
  completedEntries,
  hasErrors,
  newEntry,
  suggestLabel,
  toCanRequests,
  totalKg,
  validateSheet,
  type CanEntry,
  type SheetErrors,
} from "./canSheet";

const emptySheet = (): CanEntry[] => [newEntry()];

export function RegisterConsignmentScreen({
  onProceedToQualityTest,
}: {
  /** Offered on the confirmation once the quality panel screen exists to receive it (SCRUM-54). */
  onProceedToQualityTest?: (reference: string) => void;
} = {}) {
  const { session, signOut } = useSession();
  const { online, enqueue: queueRecord } = useSync();
  const token = session?.accessToken ?? null;

  const [societies, setSocieties] = useState<Society[]>([]);
  const [loadFailure, setLoadFailure] = useState<string | null>(null);
  const [society, setSociety] = useState<Society | null>(null);
  const [entries, setEntries] = useState<CanEntry[]>(emptySheet);

  // Held back until the officer submits, so the sheet does not scold them mid-entry.
  const [errors, setErrors] = useState<SheetErrors | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [saved, setSaved] = useState<Consignment | null>(null);
  const [queued, setQueued] = useState(false);

  useEffect(() => {
    const abort = new AbortController();

    listSocieties(token, abort.signal)
      .then((loaded) => setSocieties(loaded.filter((candidate) => candidate.isActive)))
      .catch((error: unknown) => {
        if (!abort.signal.aborted) {
          setLoadFailure(error instanceof ApiError ? error.message : "Could not load the societies.");
        }
      });

    return () => abort.abort();
  }, [token]);

  const total = useMemo(() => totalKg(entries), [entries]);
  const filledCount = useMemo(() => completedEntries(entries).length, [entries]);

  const reset = useCallback(() => {
    setSociety(null);
    setEntries(emptySheet());
    setErrors(null);
    setFailure(null);
    setSaved(null);
    setQueued(false);
  }, []);

  const updateEntry = (updated: CanEntry) => {
    setEntries((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
    setErrors((current) => (current ? { ...current, cans: withoutEntry(current.cans, updated.id) } : current));
  };

  const removeEntry = (id: string) => {
    setEntries((current) => {
      const remaining = current.filter((entry) => entry.id !== id);

      return remaining.length > 0 ? remaining : emptySheet();
    });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    const found = validateSheet(society, entries);
    setErrors(found);
    setFailure(null);

    // AC3: nothing is sent while a required field is missing or a value is out of range.
    if (hasErrors(found) || !society) {
      return;
    }

    const body = { societyId: society.id, cans: toCanRequests(society, entries) };

    // AC1: with no network the sheet is taken anyway, held on the device and uploaded later.
    if (!online) {
      queueSheet(society.name, body);
      return;
    }

    setSubmitting(true);

    try {
      const consignment = await registerConsignment(body, token);

      setSaved(consignment);
    } catch (error: unknown) {
      // The service being unreachable is not a refusal: the sheet joins the queue rather than
      // being lost, which is the same outcome as having been offline all along.
      if (error instanceof ApiError && error.status === 0) {
        queueSheet(society.name, body);
        return;
      }

      const message =
        error instanceof ApiError ? error.message : "The consignment could not be registered. Try again.";

      setFailure(message);

      if (error instanceof ApiError && error.status === 401) {
        signOut();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const queueSheet = (societyName: string, body: { societyId: string; cans: { canNumber: number; quantityKg: number }[] }) => {
    queueRecord({
      kind: "RegisterConsignment",
      summary: `${societyName} - ${body.cans.length} can${body.cans.length === 1 ? "" : "s"}`,
      consignment: { societyId: body.societyId, cans: body.cans, arrivalAtLocal: localNow() },
    });

    setSubmitting(false);
    setQueued(true);
  };

  // AC4 and AC5: the officer is told the record landed, and the sheet starts clean for the
  // next delivery rather than leaving the previous one on screen to be submitted twice.
  // AC2 and AC5: held on the device with a pending mark, and once uploaded it reads like any
  // other record — the officer is told which of the two happened.
  if (queued) {
    return <QueuedConfirmation onRegisterAnother={reset} />;
  }

  if (saved) {
    return (
      <SavedConfirmation
        consignment={saved}
        onRegisterAnother={reset}
        onProceedToQualityTest={onProceedToQualityTest}
      />
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      {loadFailure ? (
        <p className="notice notice--error" role="alert">
          <WarningIcon />
          {loadFailure}
        </p>
      ) : null}

      <SocietyPicker
        societies={societies}
        selected={society}
        onSelect={(next) => {
          setSociety(next);
          setErrors(null);
        }}
        disabled={submitting}
        error={errors?.society}
      />

      <section className="section" aria-label="Milk cans">
        <div className="section__head">
          <h2 className="section__title">Milk Cans</h2>
          <span className="section__count">
            {filledCount} {filledCount === 1 ? "entry" : "entries"}
          </span>
        </div>

        <div className="cansheet">
          {entries.map((entry, index) => (
            <CanRow
              key={entry.id}
              entry={entry}
              index={index}
              placeholder={society ? suggestLabel(society.canLabelPrefix, entries.slice(0, index)) : "Select a society"}
              errors={errors?.cans[entry.id]}
              disabled={submitting || !society}
              onChange={updateEntry}
              onRemove={() => removeEntry(entry.id)}
            />
          ))}
        </div>

        {errors?.sheet ? (
          <p className="notice notice--error" role="alert">
            <WarningIcon />
            {errors.sheet}
          </p>
        ) : null}

        <button
          type="button"
          className="addcan"
          disabled={submitting || !society}
          onClick={() => setEntries((current) => [...current, newEntry()])}
        >
          <PlusCircleIcon />
          Add another can
        </button>
      </section>

      <section className="total" aria-label="Consignment total">
        <span className="microlabel">Total consignment</span>
        <p className="total__value">
          {total.toFixed(1)}
          <small>kg</small>
        </p>
        <p className="total__hint">Litres are calculated by the service from the weight recorded here.</p>

        {failure ? (
          <p className="notice notice--error" role="alert" style={{ marginTop: 0 }}>
            <WarningIcon />
            {failure}
          </p>
        ) : null}

        <button type="submit" className="button button--onDark" disabled={submitting}>
          {submitting ? "Registering..." : "Register consignment"}
          {submitting ? null : <ArrowRightIcon />}
        </button>
      </section>
    </form>
  );
}

function QueuedConfirmation({ onRegisterAnother }: { onRegisterAnother: () => void }) {
  return (
    <section className="saved" aria-live="polite">
      <span className="saved__mark saved__mark--pending">
        <CloudOffIcon width={40} height={40} />
      </span>

      <h2 className="saved__title">Saved on this device</h2>
      <p className="saved__detail">
        There is no connection right now. The sheet is queued and uploads by itself when the
        network returns; its reference is issued then.
      </p>

      <button type="button" className="button" style={{ marginTop: "var(--space-6)" }} onClick={onRegisterAnother}>
        Register another consignment
      </button>
    </section>
  );
}

function SavedConfirmation({
  consignment,
  onRegisterAnother,
  onProceedToQualityTest,
}: {
  consignment: Consignment;
  onRegisterAnother: () => void;
  onProceedToQualityTest?: (reference: string) => void;
}) {
  return (
    <section className="saved" aria-live="polite">
      <span className="saved__mark">
        <CheckIcon width={40} height={40} />
      </span>

      <h2 className="saved__title">Saved successfully</h2>
      <p className="saved__detail">
        The consignment from {consignment.societyName} has been recorded at the gate.
      </p>

      <p className="saved__reference">{consignment.reference}</p>
      <p className="saved__totals">
        {consignment.canCount} {consignment.canCount === 1 ? "can" : "cans"} &middot;{" "}
        {consignment.totalQuantityKg.toFixed(1)} kg &middot; {consignment.totalQuantityLitres.toFixed(1)} L
      </p>

      {onProceedToQualityTest ? (
        <button
          type="button"
          className="button"
          onClick={() => onProceedToQualityTest(consignment.reference)}
        >
          Proceed to Quality Test
        </button>
      ) : null}

      <button
        type="button"
        className={onProceedToQualityTest ? "button button--ghost" : "button"}
        style={onProceedToQualityTest ? { marginTop: "var(--space-3)" } : undefined}
        onClick={onRegisterAnother}
      >
        Register another consignment
      </button>
    </section>
  );
}

function withoutEntry(
  cans: SheetErrors["cans"],
  id: string,
): SheetErrors["cans"] {
  const { [id]: _removed, ...rest } = cans;

  return rest;
}

/** The device's wall clock, which is the arrival time an offline record has to carry. */
function localNow(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");

  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  );
}
