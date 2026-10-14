import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "../../../auth/sessionStore";
import {
  PRODUCT_LINES,
  PRODUCT_LINE_LABEL,
  isLiquid,
  type ProductLine,
} from "../../../api/qualityLab/panels";
import {
  REASON_CODES,
  REASON_LABEL,
  exportLabResults,
  getLabResultsSummary,
  searchLabResults,
  type LabResultFilters,
  type LabResultOutOfSpec,
  type LabResultRow,
  type LabResultsPage,
  type LabResultsSummary,
} from "../../../api/qualityLab/labResults";
import "./LabHistoryScreen.css";

const NOT_APPLICABLE = "N/A";

const EMPTY_FILTERS: LabResultFilters = { productLine: "", from: "", to: "", result: "", reasonCode: "" };

/** Maps the API's out-of-spec parameter names to the table column they belong to. */
const PARAMETER_COLUMN: Record<string, string> = {
  fatpercent: "fat",
  ph: "ph",
  snf: "snf",
  correctedclr: "clr",
};

function flagFor(row: LabResultRow, column: string): LabResultOutOfSpec | undefined {
  return row.outOfSpec.find((f) => PARAMETER_COLUMN[f.parameter.toLowerCase()] === column);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function limitText(flag: LabResultOutOfSpec): string {
  return `${flag.limit === "Min" ? "min" : "max"} ${flag.limitValue}`;
}

export function LabHistoryScreen() {
  const { session } = useSession();
  const token = session?.accessToken ?? null;

  const [draft, setDraft] = useState<LabResultFilters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<LabResultFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);

  const [data, setData] = useState<LabResultsPage | null>(null);
  const [summary, setSummary] = useState<LabResultsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    Promise.all([
      searchLabResults(applied, page, token, controller.signal),
      getLabResultsSummary(applied, token, controller.signal),
    ])
      .then(([results, totals]) => {
        setData(results);
        setSummary(totals);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setData(null);
        setSummary(null);
        setError(err instanceof Error ? err.message : "Could not load lab results.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [applied, page, token]);

  const onApply = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      setPage(1);
      setApplied({ ...draft });
    },
    [draft],
  );

  const onReset = () => {
    setDraft(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    setPage(1);
  };

  const onExport = async () => {
    setExporting(true);
    setError(null);
    try {
      const { blob, fileName } = await exportLabResults(applied, token);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName ?? "lab-results.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not export lab results.");
    } finally {
      setExporting(false);
    }
  };

  // A reason code only exists on a failed determination, so the filters cannot be combined otherwise.
  const reasonDisabled = draft.result === "Pass" || draft.result === "Pending";

  const maxReasonCount = useMemo(
    () => Math.max(1, ...(summary?.reasonCounts.map((r) => r.count) ?? [1])),
    [summary],
  );

  const set = <K extends keyof LabResultFilters>(key: K, value: LabResultFilters[K]) =>
    setDraft((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "result" && (value === "Pass" || value === "Pending")) next.reasonCode = "";
      return next;
    });

  return (
    <div className="lab-history">
      <header className="lab-history__header">
        <div>
          <h1 className="lab-history__title">Lab History</h1>
          <p className="lab-history__subtitle">
            Read-only record of chemical panels, sensory grades and determinations.
          </p>
        </div>
        <button
          type="button"
          id="lab-history-export"
          className="lab-history__btn lab-history__btn--primary"
          onClick={onExport}
          disabled={exporting || loading || !data || data.total === 0}
        >
          {exporting ? "Exporting…" : "Export CSV"}
        </button>
      </header>

      <form className="lab-history__filters" onSubmit={onApply} aria-label="Lab result filters">
        <label className="lab-history__filter">
          <span>Product line</span>
          <select
            id="lab-history-product-line"
            value={draft.productLine ?? ""}
            onChange={(e) => set("productLine", e.target.value as ProductLine | "")}
          >
            <option value="">All lines</option>
            {PRODUCT_LINES.map((line) => (
              <option key={line} value={line}>
                {line} · {PRODUCT_LINE_LABEL[line]}
              </option>
            ))}
          </select>
        </label>

        <label className="lab-history__filter">
          <span>From</span>
          <input
            id="lab-history-from"
            type="date"
            value={draft.from ?? ""}
            max={draft.to || undefined}
            onChange={(e) => set("from", e.target.value)}
          />
        </label>

        <label className="lab-history__filter">
          <span>To</span>
          <input
            id="lab-history-to"
            type="date"
            value={draft.to ?? ""}
            min={draft.from || undefined}
            onChange={(e) => set("to", e.target.value)}
          />
        </label>

        <label className="lab-history__filter">
          <span>Result</span>
          <select
            id="lab-history-result"
            value={draft.result ?? ""}
            onChange={(e) => set("result", e.target.value as LabResultFilters["result"])}
          >
            <option value="">Any</option>
            <option value="Pass">Pass</option>
            <option value="Fail">Fail</option>
            <option value="Pending">Pending</option>
          </select>
        </label>

        <label className="lab-history__filter">
          <span>Failure reason</span>
          <select
            id="lab-history-reason"
            value={draft.reasonCode ?? ""}
            disabled={reasonDisabled}
            title={reasonDisabled ? "Reasons only apply to failed batches" : undefined}
            onChange={(e) => set("reasonCode", e.target.value)}
          >
            <option value="">Any</option>
            {REASON_CODES.map((r) => (
              <option key={r.code} value={r.code}>
                {r.label}
              </option>
            ))}
          </select>
        </label>

        <div className="lab-history__filter-actions">
          <button type="submit" id="lab-history-apply" className="lab-history__btn lab-history__btn--primary">
            Apply
          </button>
          <button type="button" id="lab-history-reset" className="lab-history__btn" onClick={onReset}>
            Reset
          </button>
        </div>
      </form>

      {error && (
        <div className="lab-history__error" role="alert">
          {error}
        </div>
      )}

      {summary && !error && (
        <section className="lab-history__summary" aria-label="Summary of filtered results">
          <div className="lab-history__stats">
            <Stat label="Batches" value={summary.total} />
            <Stat label="Passed" value={summary.passed} tone="pass" />
            <Stat label="Failed" value={summary.failed} tone="fail" />
            <Stat label="Pending" value={summary.pending} tone="pending" />
          </div>

          <div className="lab-history__reasons">
            <h2 className="lab-history__section-title">Failures by reason</h2>
            {summary.reasonCounts.length === 0 ? (
              <p className="lab-history__muted">No failures in this selection.</p>
            ) : (
              <ul className="lab-history__reason-list">
                {summary.reasonCounts.map((r) => (
                  <li key={r.code} className="lab-history__reason">
                    <span className="lab-history__reason-name">{REASON_LABEL[r.code] ?? r.code}</span>
                    <span className="lab-history__reason-bar" aria-hidden="true">
                      <span style={{ width: `${(r.count / maxReasonCount) * 100}%` }} />
                    </span>
                    <span className="lab-history__reason-count">{r.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {loading && <p className="lab-history__loading">Loading results…</p>}

      {!loading && !error && data && data.total === 0 && (
        <p className="lab-history__empty" role="status">
          No results found for these filters.
        </p>
      )}

      {!loading && !error && data && data.total > 0 && (
        <>
          <div className="lab-history__table-wrap">
            <table className="lab-history__table">
              <thead>
                <tr>
                  <th>Batch</th>
                  <th>Dispatch</th>
                  <th>Line</th>
                  <th>Tested at</th>
                  <th className="num">Fat %</th>
                  <th className="num">pH</th>
                  <th className="num">SNF</th>
                  <th className="num">TS</th>
                  <th>Taste</th>
                  <th>Smell</th>
                  <th>Colour</th>
                  <th>Appearance</th>
                  <th>Texture</th>
                  <th>Determination</th>
                  <th>Out of spec</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => (
                  <ResultRow key={`${row.batchCode}-${row.panelVersion}`} row={row} />
                ))}
              </tbody>
            </table>
          </div>

          <nav className="lab-history__pager" aria-label="Pagination">
            <span className="lab-history__muted">
              {data.total} result{data.total === 1 ? "" : "s"} · page {data.page} of {data.totalPages}
            </span>
            <div className="lab-history__btn-group">
              <button
                type="button"
                className="lab-history__btn"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <button
                type="button"
                className="lab-history__btn"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </nav>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "pass" | "fail" | "pending" }) {
  return (
    <div className={`lab-history__stat ${tone ? `lab-history__stat--${tone}` : ""}`}>
      <span className="lab-history__stat-value">{value}</span>
      <span className="lab-history__stat-label">{label}</span>
    </div>
  );
}

function NaCell({ title }: { title: string }) {
  return (
    <td className="na" title={title}>
      {NOT_APPLICABLE}
    </td>
  );
}

function ResultRow({ row }: { row: LabResultRow }) {
  const liquid = isLiquid(row.productLine);
  const fat = flagFor(row, "fat");
  const ph = flagFor(row, "ph");
  const snf = flagFor(row, "snf");

  return (
    <tr>
      <td className="strong">{row.batchCode}</td>
      <td>{row.dispatchNumber}</td>
      <td>
        <span className={`lab-history__chip lab-history__chip--${liquid ? "liquid" : "fermented"}`}>
          {row.productLine}
        </span>
      </td>
      <td>{formatDate(row.testedAtUtc)}</td>
      <MeasureCell value={row.fatPercent} flag={fat} />
      <MeasureCell value={row.ph} flag={ph} />
      {row.notApplicable.includes("snf") ? (
        <NaCell title="SNF is not measured on this product line" />
      ) : (
        <MeasureCell value={row.snf} flag={snf} />
      )}
      {row.notApplicable.includes("ts") ? (
        <NaCell title="TS is not measured on this product line" />
      ) : (
        <MeasureCell value={row.ts} />
      )}
      <GradeCell value={row.taste} recorded={row.sensoryRecorded} />
      <GradeCell value={row.smell} recorded={row.sensoryRecorded} />
      <GradeCell value={row.colour} recorded={row.sensoryRecorded} />
      <GradeCell value={row.appearance} recorded={row.sensoryRecorded} />
      {row.notApplicable.includes("texture") ? (
        <NaCell title="Texture is not graded on this product line" />
      ) : (
        <GradeCell value={row.texture} recorded={row.sensoryRecorded} />
      )}
      <td>
        <span className={`lab-history__badge lab-history__badge--${row.determination.toLowerCase()}`}>
          {row.determination}
        </span>
        {row.reasonCodes.length > 0 && (
          <div className="lab-history__reason-tags">
            {row.reasonCodes.map((code) => (
              <span key={code} className="lab-history__tag">
                {REASON_LABEL[code] ?? code}
              </span>
            ))}
          </div>
        )}
      </td>
      <td>
        {row.outOfSpec.length === 0 ? (
          <span className="lab-history__muted">—</span>
        ) : (
          <ul className="lab-history__oos">
            {row.outOfSpec.map((f) => (
              <li key={`${f.parameter}-${f.limit}`}>
                {f.parameter} {f.value} ({limitText(f)})
              </li>
            ))}
          </ul>
        )}
      </td>
    </tr>
  );
}

function MeasureCell({ value, flag }: { value: number | null; flag?: LabResultOutOfSpec }) {
  if (value === null || value === undefined) return <td className="num">—</td>;
  if (!flag) return <td className="num">{value}</td>;
  return (
    <td className="num flagged" title={`Out of spec: ${limitText(flag)} was in force when tested`}>
      {value}
      <span className="flagged__limit">{limitText(flag)}</span>
    </td>
  );
}

function GradeCell({ value, recorded }: { value: string | null; recorded: boolean }) {
  if (!recorded || !value) return <td className="lab-history__muted">Not recorded</td>;
  return (
    <td>
      <span className={`lab-history__grade lab-history__grade--${value.toLowerCase()}`}>{value}</span>
    </td>
  );
}
