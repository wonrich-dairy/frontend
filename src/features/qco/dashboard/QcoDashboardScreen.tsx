import { useId, useState, type FormEvent, type ReactNode } from "react";
import { useNavigation } from "../../../app/navigationStore";
import { useSession } from "../../../auth/sessionStore";
import { SlidersIcon } from "../../../components/icons";
import type { QcoTab } from "../../../components/qco/QcoAppShell";
import { ErrorNotice } from "../../../components/ui/Feedback";
import { PRODUCT_LINES, type ProductLine } from "../../../api/traceability/dashboard";
import { formatColombo } from "../../../utils/time";
import {
  describeFilters,
  filtersFromQuery,
  filtersToQuery,
  isToday,
  rangeError,
  toRequestFilters,
  type QcoFilters,
} from "./filters";
import { dataAsOf, useQcoDashboard, type DashboardPanels, type PanelKey } from "./useQcoDashboard";
import {
  DeviationsPanel,
  FailureReasonsPanel,
  MarginalSocietiesPanel,
  RecentFailuresPanel,
  StatusPanel,
  TrendPanel,
} from "./panels";

// What each tab shows, grouped by the question the QCO is asking. The panel list drives both
// what is fetched and what is drawn, so a tab never loads data it does not show.
const SECTIONS: Record<QcoTab, { panels: PanelKey[]; render: (panels: DashboardPanels, filters: QcoFilters) => ReactNode }> = {
  // What is happening now.
  overview: {
    panels: ["summary", "recentFailures"],
    render: (panels, filters) => (
      <>
        <StatusPanel panel={panels.summary} showRange={!isToday(filters)} />
        <RecentFailuresPanel panel={panels.recentFailures} />
      </>
    ),
  },
  // Is a problem developing.
  trends: {
    panels: ["trend"],
    render: (panels, filters) => <TrendPanel panel={panels.trend} fixedLine={filters.productLine} />,
  },
  // Why batches fail, and at which checkpoint.
  causes: {
    panels: ["failureReasons", "deviations"],
    render: (panels) => (
      <>
        <FailureReasonsPanel panel={panels.failureReasons} />
        <DeviationsPanel panel={panels.deviations} />
      </>
    ),
  },
  // Where the risk comes from.
  societies: {
    panels: ["marginalSocieties"],
    render: (panels) => <MarginalSocietiesPanel panel={panels.marginalSocieties} />,
  },
};

// Read-only: the QCO has no write action anywhere in the module (SCRUM-136).
export function QcoDashboardScreen({ section = "overview" }: { section?: QcoTab }) {
  const { session } = useSession();
  const { path, query, replace } = useNavigation();
  const token = session?.accessToken ?? null;

  const filters = filtersFromQuery(query);
  const { panels: shown, render } = SECTIONS[section];
  const panels = useQcoDashboard(toRequestFilters(filters), token, shown);
  const asOf = dataAsOf(panels);
  const queryString = filtersToQuery(filters);

  return (
    <>
      <header className="qcohead">
        <h1 className="panelhead__title">Quality Dashboard</h1>
        <p className="qcohead__fresh" aria-live="polite">
          {asOf ? `Last updated ${formatColombo(asOf)}` : "Waiting for the first update"}
        </p>
      </header>

      {/* Keyed on the applied filters, so back and forward reset the form to what is shown. */}
      <FilterForm key={queryString} applied={filters} onApply={(next) => replace(`${path}${filtersToQuery(next)}`)} />

      <div className="qcogrid">{render(panels, filters)}</div>
    </>
  );
}

function FilterForm({ applied, onApply }: { applied: QcoFilters; onApply: (filters: QcoFilters) => void }) {
  const [draft, setDraft] = useState(applied);
  const [error, setError] = useState<string | null>(null);
  // On a phone the form folds into one line, so it does not push the panels down on every tab.
  // The form is keyed on the applied filters, so applying them folds it again.
  const [open, setOpen] = useState(false);
  const formId = useId();

  const set = (patch: Partial<QcoFilters>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setError(null);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const problem = rangeError(draft);

    if (problem) {
      setError(problem);
      return;
    }

    onApply(draft);
  };

  return (
    <>
      <button
        type="button"
        className="qcofilters__toggle"
        aria-expanded={open}
        aria-controls={formId}
        onClick={() => setOpen((value) => !value)}
      >
        <SlidersIcon />
        <span className="qcofilters__summary">{describeFilters(applied)}</span>
        <span className="qcofilters__action">{open ? "Hide" : "Change"}</span>
      </button>

      {/* noValidate: min and max only steer the date pickers; rangeError gives the message, so it
          reads the same in every browser instead of as a native bubble. */}
      <form
        id={formId}
        className={`qcofilters${open ? "" : " qcofilters--folded"}`}
        onSubmit={submit}
        aria-label="Dashboard filters"
        noValidate
      >
        <label className="field">
          <span className="field__label">Facility</span>
          <input
            type="text"
            value={draft.facility}
            placeholder="All facilities"
            onChange={(event) => set({ facility: event.target.value })}
          />
        </label>

        <label className="field">
          <span className="field__label">Product line</span>
          <select value={draft.productLine} onChange={(event) => set({ productLine: event.target.value as ProductLine | "" })}>
            <option value="">All lines</option>
            {PRODUCT_LINES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field__label">From</span>
          <input type="date" value={draft.from} max={draft.to || undefined} onChange={(event) => set({ from: event.target.value })} />
        </label>

        <label className="field">
          <span className="field__label">To</span>
          <input type="date" value={draft.to} min={draft.from || undefined} onChange={(event) => set({ to: event.target.value })} />
        </label>

        <div className="qcofilters__actions">
          {error ? <ErrorNotice>{error}</ErrorNotice> : null}
          <button type="submit" className="button button--wide">
            Apply
          </button>
        </div>
      </form>
    </>
  );
}
