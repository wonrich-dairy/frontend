import { useEffect, useMemo, useState } from "react";
import { ApiError } from "../../api/http";
import {
  listProcessingTanks,
  listUnloads,
  recordUnload,
  type ProcessingTank,
  type Unload,
} from "../../api/processing";
import { useSession } from "../../auth/sessionStore";
import { useNavigation } from "../../app/navigationStore";
import { can, roleFromToken } from "../../auth/permissions";
import { DropletIcon, SendIcon, ThermometerIcon, TruckIcon } from "../../components/icons";
import { EmptyState, ErrorNotice, Loading, SaveConfirmation } from "../../components/ui/Feedback";

export function UnloadScreen() {
  const { session } = useSession();
  const { navigate } = useNavigation();
  const token = session?.accessToken ?? null;
  const mayRecord = can(roleFromToken(token), "recordUnloads");

  const [tanks, setTanks] = useState<ProcessingTank[] | null>(null);
  const [unloads, setUnloads] = useState<Unload[]>([]);
  const [failure, setFailure] = useState<string | null>(null);
  const [saved, setSaved] = useState<Unload | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reloads, setReloads] = useState(0);

  const [draft, setDraft] = useState({
    dispatchNoteReference: "",
    storingTankCode: "",
    quantityLitres: "",
    temperatureCelsius: "",
  });

  useEffect(() => {
    const abort = new AbortController();

    Promise.all([
      listProcessingTanks(token, abort.signal, "Storing"),
      listUnloads(token, abort.signal),
    ])
      .then(([loadedTanks, loadedUnloads]) => {
        setTanks(loadedTanks);
        setUnloads(loadedUnloads);
      })
      .catch((error: unknown) => {
        if (abort.signal.aborted) {
          return;
        }

        setTanks([]);
        setFailure(error instanceof ApiError ? error.message : "The bay could not be loaded.");
      });

    return () => abort.abort();
  }, [token, reloads]);

  const available = useMemo(
    () => (tanks ?? []).filter((tank) => tank.status === "Active"),
    [tanks],
  );

  const litres = Number(draft.quantityLitres);
  const celsius = Number(draft.temperatureCelsius);
  const chosen = available.find((tank) => tank.code === draft.storingTankCode) ?? null;

  const complete =
    draft.dispatchNoteReference.trim() !== "" &&
    draft.storingTankCode !== "" &&
    Number.isFinite(litres) &&
    litres > 0 &&
    draft.temperatureCelsius.trim() !== "" &&
    Number.isFinite(celsius);

  const overfills = chosen !== null && Number.isFinite(litres) && litres > chosen.availableLitres;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!complete || overfills || submitting) {
      return;
    }

    setSubmitting(true);
    setFailure(null);

    try {
      setSaved(
        await recordUnload(
          {
            dispatchNoteReference: draft.dispatchNoteReference.trim().toUpperCase(),
            storingTankCode: draft.storingTankCode,
            quantityLitres: litres,
            temperatureCelsius: celsius,
          },
          token,
        ),
      );
    } catch (error: unknown) {
      setFailure(error instanceof ApiError ? error.message : "That load could not be recorded.");
    } finally {
      setSubmitting(false);
    }
  };

  if (saved) {
    return (
      <SaveConfirmation
        title="Load Recorded"
        detail={`${saved.reference} put ${saved.quantityLitres.toFixed(0)} L from ${saved.dispatchNoteReference} into ${saved.storingTankName}.`}
        primaryLabel="Record another load"
        onPrimary={() => {
          setSaved(null);
          setDraft({
            dispatchNoteReference: "",
            storingTankCode: "",
            quantityLitres: "",
            temperatureCelsius: "",
          });
          setReloads((count) => count + 1);
        }}
        secondaryLabel="Back to tanks"
        onSecondary={() => navigate("/processing/tanks")}
      />
    );
  }

  if (tanks === null) {
    return <Loading label="Loading the bay..." />;
  }

  return (
    <>
      {failure ? <ErrorNotice>{failure}</ErrorNotice> : null}

      {mayRecord ? (
        <form onSubmit={submit} noValidate>
          <section className="card">
            <h2 className="card__title">
              <TruckIcon />
              Unload a Bowser
            </h2>

            <label className="field">
              <span className="field__label">Dispatch Note</span>
              <span className="field__wrap">
                <TruckIcon className="field__icon" />
                <input
                  value={draft.dispatchNoteReference}
                  disabled={submitting}
                  placeholder="e.g. DN-20260904-01"
                  maxLength={40}
                  onChange={(event) =>
                    setDraft({ ...draft, dispatchNoteReference: event.target.value })
                  }
                />
              </span>
              <span className="field__hint">
                The note the bowser arrived against, raised at the chilling centre.
              </span>
            </label>

            <label className="field">
              <span className="field__label">Storing Tank</span>
              <select
                value={draft.storingTankCode}
                disabled={submitting || available.length === 0}
                onChange={(event) => setDraft({ ...draft, storingTankCode: event.target.value })}
              >
                <option value="">Choose a tank...</option>
                {available.map((tank) => (
                  <option key={tank.code} value={tank.code}>
                    {tank.name} ({tank.code}) &middot; {tank.availableLitres.toFixed(0)} L free
                  </option>
                ))}
              </select>
              {available.length === 0 ? (
                <span className="field__hint">
                  No storing tank is in service. Configure one before recording a load.
                </span>
              ) : null}
            </label>

            <label className="field">
              <span className="field__label">Quantity measured (Liters)</span>
              <span className="field__wrap">
                <DropletIcon className="field__icon" />
                <input
                  value={draft.quantityLitres}
                  disabled={submitting}
                  inputMode="decimal"
                  placeholder="e.g. 11800"
                  onChange={(event) => setDraft({ ...draft, quantityLitres: event.target.value })}
                />
              </span>
              <span className="field__hint">
                What the factory measured, not what the note claims.
              </span>
            </label>

            <label className="field">
              <span className="field__label">Arrival temperature (°C)</span>
              <span className="field__wrap">
                <ThermometerIcon className="field__icon" />
                <input
                  value={draft.temperatureCelsius}
                  disabled={submitting}
                  inputMode="decimal"
                  placeholder="e.g. 4.2"
                  onChange={(event) =>
                    setDraft({ ...draft, temperatureCelsius: event.target.value })
                  }
                />
              </span>
            </label>

            {overfills && chosen ? (
              <ErrorNotice>
                {chosen.name} has {chosen.availableLitres.toFixed(0)} L free. That load would
                overfill it.
              </ErrorNotice>
            ) : null}

            <button
              type="submit"
              className="button button--onDark button--wide"
              disabled={!complete || overfills || submitting}
            >
              <SendIcon />
              {submitting ? "Recording..." : "Record Unload"}
            </button>
          </section>
        </form>
      ) : null}

      <section className="section" aria-label="Recent unloads">
        <div className="section__head">
          <h2 className="section__title">Recent Unloads</h2>
          <span className="section__count">{unloads.length}</span>
        </div>

        {unloads.length === 0 ? (
          <EmptyState>Nothing has been unloaded at this factory yet.</EmptyState>
        ) : (
          unloads.map((unload) => (
            <article key={unload.reference} className="deliveryrow">
              <header className="deliveryrow__head">
                <strong>{unload.reference}</strong>
                <span className="badge">{unload.storingTankCode}</span>
              </header>

              <p className="deliveryrow__society">{unload.dispatchNoteReference}</p>

              <p className="deliveryrow__meta">
                <span>{unload.quantityLitres.toFixed(0)} L</span>
                <span>{unload.temperatureCelsius.toFixed(1)} °C</span>
                <span>{unload.unloadDate}</span>
                <span>{unload.unloadedBy ?? "-"}</span>
              </p>
            </article>
          ))
        )}
      </section>
    </>
  );
}
