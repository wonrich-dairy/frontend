import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { searchConsignments } from "../../api/consignments";
import { ApiError } from "../../api/http";
import {
  previewQualityTest,
  recordQualityTest,
  type AlcoholStage,
  type KqColour,
  type QualityTestView,
  type StageOutcome,
  type TestPreview,
} from "../../api/qualityTests";
import type { Consignment } from "../../api/types";
import { useSession } from "../../auth/sessionStore";
import { CheckIcon, SearchIcon, WarningIcon } from "../../components/icons";
import { AlcoholCascadeCard } from "./AlcoholCascadeCard";
import { KqScaleCard } from "./KqScaleCard";
import { StepperField } from "./StepperField";
import { answerStage, forcesRejection } from "./cascade";
import {
  emptyPanel,
  firstBreach,
  hasErrors,
  toReadings,
  toRecordRequest,
  validatePanel,
  verdictOf,
  type PanelForm,
} from "./panel";

/** Long enough that stepping through a value does not fire a request per tap. */
const PREVIEW_DEBOUNCE_MS = 350;

export function QualityTestPanelScreen({
  initialReference,
}: {
  /** Set when the officer came straight from registering a delivery (SCRUM-53). */
  initialReference?: string;
} = {}) {
  const { session, signOut } = useSession();
  const token = session?.accessToken ?? null;

  const [untested, setUntested] = useState<Consignment[]>([]);
  const [search, setSearch] = useState("");
  const [consignment, setConsignment] = useState<Consignment | null>(null);

  const [form, setForm] = useState<PanelForm>(emptyPanel);
  const [showErrors, setShowErrors] = useState(false);

  const [preview, setPreview] = useState<TestPreview | null>(null);
  const [previewFailure, setPreviewFailure] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [recorded, setRecorded] = useState<QualityTestView | null>(null);

  const errors = useMemo(() => validatePanel(form), [form]);
  const readings = useMemo(() => toReadings(form), [form]);
  const readingsKey = readings ? JSON.stringify(readings) : null;

  useEffect(() => {
    const abort = new AbortController();

    searchConsignments(token, abort.signal)
      .then((page) => {
        const waiting = page.items.filter((item) => item.status === "Registered");
        setUntested(waiting);

        // Arriving from a registration goes straight to that delivery's panel.
        if (initialReference) {
          const arrived = waiting.find((item) => item.reference === initialReference);

          if (arrived) {
            setConsignment(arrived);
          }
        }
      })
      .catch(() => {
        if (!abort.signal.aborted) {
          setFailure("Could not load the consignments waiting to be tested.");
        }
      });

    return () => abort.abort();
  }, [token, initialReference]);

  /**
   * Every derived figure comes from the service, which evaluates with the shared panel library
   * (SCRUM-50). Computing SNF or TS here would let the gate and the lab drift apart on the same
   * readings, which is the whole reason that library exists.
   */
  const previewToken = useRef(0);

  useEffect(() => {
    if (!consignment || !readingsKey) {
      return;
    }

    const abort = new AbortController();
    const attempt = ++previewToken.current;

    const timer = setTimeout(() => {
      previewQualityTest(consignment.reference, JSON.parse(readingsKey), token, abort.signal)
        .then((result) => {
          if (attempt === previewToken.current) {
            setPreview(result);
            setPreviewFailure(null);
          }
        })
        .catch((error: unknown) => {
          if (abort.signal.aborted || attempt !== previewToken.current) {
            return;
          }

          setPreview(null);
          setPreviewFailure(
            error instanceof ApiError ? error.message : "Could not evaluate these readings.",
          );
        });
    }, PREVIEW_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [consignment, readingsKey, token]);

  // A changed reading invalidates what the service last said, so the stale verdict goes with it.
  const update = useCallback((patch: Partial<PanelForm>) => {
    setForm((current) => ({ ...current, ...patch }));
    setPreview(null);
  }, []);

  const onAnswerStage = (stage: AlcoholStage, outcome: StageOutcome) => {
    setForm((current) => ({ ...current, alcohol: answerStage(current.alcohol, stage, outcome) }));
    setPreview(null);
  };

  const reset = () => {
    setConsignment(null);
    setForm(emptyPanel());
    setPreview(null);
    setPreviewFailure(null);
    setShowErrors(false);
    setFailure(null);
    setRecorded(null);
    setSearch("");
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setShowErrors(true);
    setFailure(null);

    if (!consignment || hasErrors(errors) || !readings) {
      return;
    }

    // Complete readings, but the service has not answered yet. Saying so beats a dead button.
    if (!preview) {
      setFailure("Still evaluating these readings. Try again in a moment.");
      return;
    }

    setSubmitting(true);

    try {
      setRecorded(await recordQualityTest(consignment.reference, toRecordRequest(readings, preview), token));
    } catch (error: unknown) {
      setFailure(
        error instanceof ApiError ? error.message : "The panel could not be recorded. Try again.",
      );

      if (error instanceof ApiError && error.status === 401) {
        signOut();
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (recorded) {
    return <RecordedConfirmation test={recorded} onTestAnother={reset} />;
  }

  if (!consignment) {
    return (
      <ConsignmentPicker
        consignments={untested}
        search={search}
        onSearch={setSearch}
        onPick={setConsignment}
        failure={failure}
      />
    );
  }

  const shown = showErrors ? errors : {};
  const locked = submitting;

  return (
    <form onSubmit={submit} noValidate>
      <header className="panelhead">
        <h2 className="panelhead__title">Quality Test Panel</h2>
        <p className="panelhead__subtitle">
          Consignment ID: <strong>{consignment.reference}</strong> &middot; {consignment.societyName}
        </p>
        <button type="button" className="panelhead__change" onClick={reset} disabled={locked}>
          Choose a different consignment
        </button>
      </header>

      <section className="card" aria-label="Physical parameters">
        <h3 className="card__title">Physical Parameters</h3>

        <StepperField
          id="fat"
          label="Fat %"
          value={form.fatPercent}
          step={0.1}
          min={0}
          max={15}
          error={shown.fatPercent}
          warning={warningFor(preview, "Fat")}
          disabled={locked}
          onChange={(value) => update({ fatPercent: value })}
        />

        <StepperField
          id="clr"
          label="CLR (Lactometer)"
          value={form.rawLactometerReading}
          step={0.1}
          min={0}
          max={40}
          error={shown.rawLactometerReading}
          warning={warningFor(preview, "CorrectedClr", "Clr")}
          disabled={locked}
          onChange={(value) => update({ rawLactometerReading: value })}
        />

        <StepperField
          id="water"
          label="Added Water %"
          value={form.waterPercent}
          step={0.1}
          min={0}
          max={100}
          error={shown.waterPercent}
          warning={warningFor(preview, "Water")}
          disabled={locked}
          onChange={(value) => update({ waterPercent: value })}
        />

        <StepperField
          id="temp"
          label="Temp °C"
          value={form.temperatureCelsius}
          step={0.1}
          min={0}
          max={50}
          error={shown.temperatureCelsius}
          disabled={locked}
          onChange={(value) => update({ temperatureCelsius: value })}
        />
      </section>

      <section className="derived" aria-label="Calculated values">
        <div>
          <span className="microlabel">Calculated SNF %</span>
          <p className="derived__value">{format(preview?.snf)}</p>
        </div>
        <div>
          <span className="microlabel">Calculated TS %</span>
          <p className="derived__value">{format(preview?.totalSolids)}</p>
        </div>
      </section>

      {preview ? (
        <p className="derived__note">
          Corrected lactometer reading {preview.correctedClr.toFixed(2)} &middot; calculated by the
          service from the readings above.
        </p>
      ) : (
        <p className="derived__note">SNF and TS are calculated once every reading is entered.</p>
      )}

      <AlcoholCascadeCard
        answers={form.alcohol}
        disabled={locked}
        error={shown.alcohol}
        onAnswer={onAnswerStage}
      />

      <KqScaleCard
        selected={form.kqColour}
        disabled={locked}
        error={shown.kqColour}
        onSelect={(colour: KqColour) => update({ kqColour: colour })}
      />

      {previewFailure ? (
        <p className="notice notice--error" role="alert">
          <WarningIcon />
          {previewFailure}
        </p>
      ) : null}

      <VerdictPanel preview={preview} curdled={forcesRejection(form.alcohol)} />

      {failure ? (
        <p className="notice notice--error" role="alert">
          <WarningIcon />
          {failure}
        </p>
      ) : null}

      {/* Never disabled on an incomplete panel: the officer needs to be told what is missing. */}
      <button type="submit" className="button" disabled={locked}>
        {submitting ? "Saving..." : "Confirm & Save Test"}
      </button>
    </form>
  );
}

/**
 * The verdict, as the service would settle it. Shown as soon as the readings are complete rather
 * than after submitting, so the officer sees what they are about to record.
 */
function VerdictPanel({ preview, curdled }: { preview: TestPreview | null; curdled: boolean }) {
  if (!preview) {
    return (
      <section className="verdict verdict--pending" aria-live="polite">
        <span className="microlabel">Verdict</span>
        <p className="verdict__title">Awaiting readings</p>
      </section>
    );
  }

  const verdict = verdictOf(preview);
  const breach = firstBreach(preview);

  if (verdict === "Accept") {
    return (
      <section className="verdict verdict--pass" aria-live="polite">
        <CheckIcon width={22} height={22} />
        <div>
          <p className="verdict__title">Accepted</p>
          <p className="verdict__detail">
            Every measure is within limits. Stability: {preview.stabilityGrade}.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="verdict verdict--fail" aria-live="polite">
      <WarningIcon width={22} height={22} />
      <div>
        <p className="verdict__title">Rejected</p>
        <p className="verdict__detail">
          {curdled
            ? "The sample clotted on boiling, so the milk cannot be taken in."
            : breach?.detail ?? `${breach?.measure ?? "A measure"} is outside its limit.`}
        </p>
      </div>
    </section>
  );
}

function ConsignmentPicker({
  consignments,
  search,
  onSearch,
  onPick,
  failure,
}: {
  consignments: Consignment[];
  search: string;
  onSearch: (value: string) => void;
  onPick: (consignment: Consignment) => void;
  failure: string | null;
}) {
  const term = search.trim().toLowerCase();
  const matches = term
    ? consignments.filter(
        (item) =>
          item.reference.toLowerCase().includes(term) ||
          item.societyName.toLowerCase().includes(term),
      )
    : consignments;

  return (
    <section aria-label="Choose a consignment">
      <header className="panelhead">
        <h2 className="panelhead__title">Quality Test Panel</h2>
        <p className="panelhead__subtitle">Choose the consignment being tested.</p>
      </header>

      <div className="search">
        <SearchIcon className="search__icon" />
        <label className="sr-only" htmlFor="consignment-search">
          Search consignment ID
        </label>
        <input
          id="consignment-search"
          type="search"
          value={search}
          placeholder="Search Consignment ID..."
          onChange={(event) => onSearch(event.target.value)}
        />
      </div>

      {failure ? (
        <p className="notice notice--error" role="alert">
          <WarningIcon />
          {failure}
        </p>
      ) : null}

      <ul className="societylist">
        {matches.length === 0 ? (
          <li>
            <p style={{ margin: 0, padding: 12, color: "var(--ink-muted)", fontSize: 13 }}>
              No consignment is waiting to be tested.
            </p>
          </li>
        ) : (
          matches.map((item) => (
            <li key={item.id}>
              <button type="button" className="societylist__item" onClick={() => onPick(item)}>
                <span className="tag">{item.societyCode}</span>
                <span>
                  <strong style={{ display: "block", color: "var(--navy-900)" }}>{item.reference}</strong>
                  <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                    {item.societyName} &middot; {item.totalQuantityLitres.toFixed(1)} L
                  </span>
                </span>
              </button>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}

function RecordedConfirmation({
  test,
  onTestAnother,
}: {
  test: QualityTestView;
  onTestAnother: () => void;
}) {
  const accepted = test.verdict === "Accept";

  return (
    <section className="saved" aria-live="polite">
      <span className={`saved__mark${accepted ? "" : " saved__mark--fail"}`}>
        {accepted ? <CheckIcon width={40} height={40} /> : <WarningIcon width={40} height={40} />}
      </span>

      <h2 className="saved__title">{accepted ? "Accepted" : "Rejected"}</h2>
      <p className="saved__detail">
        The panel for {test.consignmentReference} has been recorded and cannot be changed.
      </p>

      <p className="saved__reference">
        SNF {test.snf.toFixed(2)}% &middot; TS {test.totalSolids.toFixed(2)}%
      </p>
      <p className="saved__totals">
        {accepted
          ? `Stability: ${test.stabilityGrade}`
          : `${test.failedParameter} recorded at ${test.failedValue}`}
      </p>

      <button type="button" className="button" onClick={onTestAnother}>
        Test another consignment
      </button>
    </section>
  );
}

function format(value: number | undefined): string {
  return value === undefined ? "—" : `${value.toFixed(2)}%`;
}

/** The service's own word for a measure it flagged, shown against the field it belongs to. */
function warningFor(preview: TestPreview | null, ...measures: string[]): string | undefined {
  const breach = preview?.measures.find(
    (measure) =>
      measure.isOutsideThreshold &&
      measures.some((name) => measure.measure.toLowerCase().includes(name.toLowerCase())),
  );

  return breach ? "Out of range" : undefined;
}
