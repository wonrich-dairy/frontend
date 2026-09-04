import { useEffect, useMemo, useState } from "react";
import { ApiError } from "../../api/http";
import { recordDispatchNote, type DispatchNote } from "../../api/dispatch";
import { listTanks, type Tank } from "../../api/tanks";
import type { KqColour } from "../../api/qualityTests";
import { useSession } from "../../auth/sessionStore";
import { useNavigation } from "../../app/navigationStore";
import { PlusCircleIcon, SendIcon, TrashIcon, WarningIcon } from "../../components/icons";
import { KqScaleCard } from "../qualityTests/KqScaleCard";
import { Modal } from "../../components/ui/Modal";
import { ErrorNotice, Loading, SaveConfirmation } from "../../components/ui/Feedback";
import { STRENGTHS, gradeFrom, humanGrade, type Strength } from "./grade";

interface Draw {
  tankCode: string;
  quantityLitres: string;
}

export function DispatchNoteScreen() {
  const { session } = useSession();
  const { navigate } = useNavigation();
  const token = session?.accessToken ?? null;

  const [tanks, setTanks] = useState<Tank[] | null>(null);
  const [picking, setPicking] = useState(false);

  const [bowser, setBowser] = useState("");
  const [driver, setDriver] = useState("");
  const [timeOut, setTimeOut] = useState("");
  const [draws, setDraws] = useState<Draw[]>([]);
  const [fat, setFat] = useState("");
  const [snf, setSnf] = useState("");
  const [temperature, setTemperature] = useState("");
  const [kqColour, setKqColour] = useState<KqColour | null>(null);
  const [alcohol, setAlcohol] = useState<Record<Strength, boolean>>({ a80: false, a75: false, a68: false });
  const [remarks, setRemarks] = useState("");

  const [failure, setFailure] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState<DispatchNote | null>(null);

  useEffect(() => {
    const abort = new AbortController();

    listTanks(token, abort.signal)
      .then(setTanks)
      .catch((error: unknown) => {
        if (abort.signal.aborted) {
          return;
        }

        setTanks([]);
        setFailure(error instanceof ApiError ? error.message : "The tanks could not be loaded.");
      });

    return () => abort.abort();
  }, [token]);

  const chosen = useMemo(
    () =>
      draws
        .map((draw) => ({ draw, tank: tanks?.find((one) => one.code === draw.tankCode) }))
        .filter((pair): pair is { draw: Draw; tank: Tank } => Boolean(pair.tank)),
    [draws, tanks],
  );

  const totalLitres = draws.reduce((total, draw) => total + (Number(draw.quantityLitres) || 0), 0);

  const complete =
    bowser.trim() !== "" &&
    driver.trim() !== "" &&
    draws.length > 0 &&
    draws.every((draw) => Number(draw.quantityLitres) > 0) &&
    fat.trim() !== "" &&
    snf.trim() !== "" &&
    temperature.trim() !== "" &&
    kqColour !== null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!complete || submitting || !kqColour) {
      return;
    }

    setSubmitting(true);
    setFailure(null);

    try {
      const note = await recordDispatchNote(
        {
          bowserRegistration: bowser.trim(),
          driverName: driver.trim(),
          dispatchedAtLocal: timeOut === "" ? undefined : todayAt(timeOut),
          draws: draws.map((draw) => ({
            tankCode: draw.tankCode,
            quantityLitres: Number(draw.quantityLitres),
          })),
          fatPercent: Number(fat),
          snf: Number(snf),
          kqColour,
          stabilityGrade: gradeFrom(alcohol),
          temperatureCelsius: Number(temperature),
          remarks: remarks.trim() === "" ? null : remarks.trim(),
        },
        token,
      );

      setSaved(note);
    } catch (error: unknown) {
      setFailure(
        error instanceof ApiError ? error.message : "The dispatch note could not be recorded.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (saved) {
    return (
      <SaveConfirmation
        title="Dispatch Recorded"
        detail={`Slip ${saved.reference} covers ${saved.totalQuantityLitres.toFixed(1)} L across ${saved.sources.length} ${saved.sources.length === 1 ? "tank" : "tanks"}.`}
        primaryLabel="Return to Dashboard"
        onPrimary={() => navigate("/")}
        secondaryLabel="Trace this batch later"
        onSecondary={() => navigate("/trace")}
      />
    );
  }

  if (tanks === null) {
    return <Loading label="Loading the tanks..." />;
  }

  return (
    <form onSubmit={submit} noValidate>
      <header className="pagehead">
        <h1 className="pagehead__title">Dispatch Details</h1>
      </header>

      {failure ? <ErrorNotice>{failure}</ErrorNotice> : null}

      <section className="card">
        <p className="readonlyfield">
          <span className="microlabel">Slip No</span>
          <strong>Issued when you submit</strong>
        </p>

        <p className="readonlyfield">
          <span className="microlabel">Date</span>
          <strong>{formatToday()}</strong>
        </p>

        <label className="field">
          <span className="field__label">Bowser No</span>
          <input
            value={bowser}
            disabled={submitting}
            placeholder="WP-LC-8832"
            onChange={(event) => setBowser(event.target.value)}
          />
        </label>

        <label className="field">
          <span className="field__label">Driver Name</span>
          <input
            value={driver}
            disabled={submitting}
            placeholder="Thomas R."
            onChange={(event) => setDriver(event.target.value)}
          />
        </label>

        <label className="field">
          <span className="field__label">Time Out</span>
          <input
            type="time"
            value={timeOut}
            disabled={submitting}
            onChange={(event) => setTimeOut(event.target.value)}
          />
          <span className="field__hint">Left blank, the service stamps the current time.</span>
        </label>
      </section>

      <section className="section" aria-label="Source tanks">
        <div className="section__head">
          <h2 className="section__title">Source Tanks</h2>
          <span className="section__count">{draws.length} selected</span>
        </div>

        <button
          type="button"
          className="addcan"
          disabled={submitting}
          onClick={() => setPicking(true)}
        >
          <PlusCircleIcon />
          Select Source Tanks
        </button>

        {chosen.map(({ draw, tank }) => (
          <article key={draw.tankCode} className="card">
            <header className="drawrow__head">
              <span>
                <strong>{tank.name}</strong>
                <span className="drawrow__meta">
                  {tank.code} &middot; holding {tank.totalQuantityLitres.toFixed(0)} L
                </span>
              </span>
              <button
                type="button"
                className="iconbutton"
                disabled={submitting}
                onClick={() =>
                  setDraws((current) => current.filter((one) => one.tankCode !== draw.tankCode))
                }
                title={`Remove ${tank.name}`}
              >
                <TrashIcon width={18} height={18} />
                <span className="sr-only">Remove {tank.name}</span>
              </button>
            </header>

            <label className="field">
              <span className="field__label">Dispatch Qty (Litres)</span>
              <input
                value={draw.quantityLitres}
                inputMode="decimal"
                disabled={submitting}
                placeholder="0.0"
                onChange={(event) =>
                  setDraws((current) =>
                    current.map((one) =>
                      one.tankCode === draw.tankCode
                        ? { ...one, quantityLitres: event.target.value }
                        : one,
                    ),
                  )
                }
              />
              {Number(draw.quantityLitres) > tank.totalQuantityLitres ? (
                <span className="field__hint field__hint--warning">
                  <WarningIcon width={13} height={13} />
                  The tank only holds {tank.totalQuantityLitres.toFixed(1)} L.
                </span>
              ) : null}
            </label>
          </article>
        ))}
      </section>

      <section className="card" aria-label="Dispatch panel">
        <h3 className="card__title">Panel at loading</h3>

        <div className="fieldgrid">
          <label className="field">
            <span className="field__label">Temp &deg;C</span>
            <input
              value={temperature}
              inputMode="decimal"
              disabled={submitting}
              placeholder="0.0"
              onChange={(event) => setTemperature(event.target.value)}
            />
          </label>

          <label className="field">
            <span className="field__label">Fat %</span>
            <input
              value={fat}
              inputMode="decimal"
              disabled={submitting}
              placeholder="0.0"
              onChange={(event) => setFat(event.target.value)}
            />
          </label>

          <label className="field">
            <span className="field__label">SNF %</span>
            <input
              value={snf}
              inputMode="decimal"
              disabled={submitting}
              placeholder="0.0"
              onChange={(event) => setSnf(event.target.value)}
            />
          </label>
        </div>
      </section>

      <KqScaleCard
        selected={kqColour}
        disabled={submitting}
        onSelect={(colour) => setKqColour(colour)}
      />

      <section className="card" aria-label="Alcohol test">
        <h3 className="card__title">Alcohol Test</h3>
        <p className="card__footnote">
          Switch on each strength the load clotted at. The service stores the grade this settles
          on, hardest strength first.
        </p>

        {STRENGTHS.map((strength) => (
          <label key={strength.key} className="toggle">
            <span className="toggle__label">{strength.label}</span>
            <input
              type="checkbox"
              role="switch"
              checked={alcohol[strength.key]}
              disabled={submitting}
              onChange={(event) =>
                setAlcohol((current) => ({ ...current, [strength.key]: event.target.checked }))
              }
            />
            <span className="toggle__track" aria-hidden="true" />
          </label>
        ))}

        <p className="card__footnote">
          Grade: <strong>{humanGrade(gradeFrom(alcohol))}</strong>
        </p>
      </section>

      <section className="card" aria-label="Remarks">
        <label className="field">
          <span className="field__label">Remarks</span>
          <textarea
            value={remarks}
            rows={3}
            disabled={submitting}
            placeholder="Enter any specific observations or notes here..."
            onChange={(event) => setRemarks(event.target.value)}
          />
        </label>
      </section>

      <section className="total" aria-label="Dispatch total">
        <span className="microlabel">Total to dispatch</span>
        <p className="total__value">
          {totalLitres.toFixed(1)}
          <small>L</small>
        </p>

        <button type="submit" className="button button--onDark" disabled={!complete || submitting}>
          <SendIcon />
          {submitting ? "Submitting..." : "Submit Dispatch"}
        </button>
      </section>

      {picking ? (
        <SelectSourceTanks
          tanks={tanks}
          chosen={draws.map((draw) => draw.tankCode)}
          onClose={() => setPicking(false)}
          onConfirm={(codes) => {
            setDraws((current) =>
              codes.map(
                (code) =>
                  current.find((draw) => draw.tankCode === code) ?? { tankCode: code, quantityLitres: "" },
              ),
            );
            setPicking(false);
          }}
        />
      ) : null}
    </form>
  );
}

function SelectSourceTanks({
  tanks,
  chosen,
  onClose,
  onConfirm,
}: {
  tanks: Tank[];
  chosen: string[];
  onClose: () => void;
  onConfirm: (codes: string[]) => void;
}) {
  const [picked, setPicked] = useState<string[]>(chosen);

  const total = tanks
    .filter((tank) => picked.includes(tank.code))
    .reduce((sum, tank) => sum + tank.totalQuantityLitres, 0);

  return (
    <Modal
      title="Select Source Tanks"
      onClose={onClose}
      footer={
        <>
          <p className="modal__total">
            <span className="microlabel">Total selected</span>
            <strong>{total.toFixed(0)} L</strong>
          </p>
          <button type="button" className="button button--onDark" onClick={() => onConfirm(picked)}>
            Confirm Selection
          </button>
        </>
      }
    >
      <ul className="picklist">
        {tanks.map((tank) => {
          const empty = tank.totalQuantityLitres <= 0;

          return (
            <li key={tank.code}>
              <label className={`picklist__item${empty ? " picklist__item--disabled" : ""}`}>
                <input
                  type="checkbox"
                  checked={picked.includes(tank.code)}
                  disabled={empty}
                  onChange={(event) =>
                    setPicked((current) =>
                      event.target.checked
                        ? [...current, tank.code]
                        : current.filter((code) => code !== tank.code),
                    )
                  }
                />
                <span className="picklist__body">
                  <strong>{tank.name}</strong>
                  <span className="picklist__meta">
                    {empty ? "Empty" : `Vol: ${tank.totalQuantityLitres.toFixed(0)} L`}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}

function todayAt(time: string): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${time}:00`;
}

function formatToday(): string {
  const now = new Date();
  const months = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");

  return `${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
}
