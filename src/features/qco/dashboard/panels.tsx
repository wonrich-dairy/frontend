import { useId, useState, type ReactNode } from "react";
import { EmptyState, ErrorNotice, Loading } from "../../../components/ui/Feedback";
import { REASON_CODES } from "../../../api/qualityLab/determinations";
import {
  PRODUCT_LINES,
  type DashboardSummaryDto,
  type DeviationsDto,
  type FailureReasonsDto,
  type MarginalSocietiesDto,
  type ProductLine,
  type RecentFailuresDto,
  type StatusCounts,
  type TrendDto,
} from "../../../api/traceability/dashboard";
import { formatColombo } from "../../../utils/time";
import type { Panel } from "./useQcoDashboard";

// Every chart here is a table with an inline bar, so the figures are always there as text
// (SCRUM-136: charts have a text or table alternative).

function PanelFrame<T>({
  title,
  panel,
  isEmpty,
  empty,
  full,
  children,
}: {
  title: string;
  panel: Panel<T>;
  isEmpty: (data: T) => boolean;
  empty: string;
  full?: boolean;
  children: (data: T) => ReactNode;
}) {
  const id = useId();

  return (
    <section className={`qcopanel${full ? " qcopanel--full" : ""}`} aria-labelledby={id}>
      <h2 id={id} className="qcopanel__title">
        {title}
      </h2>
      {panel.status === "loading" ? <Loading /> : null}
      {panel.status === "error" ? <ErrorNotice>{panel.message}</ErrorNotice> : null}
      {panel.status === "ready" ? (isEmpty(panel.data) ? <EmptyState>{empty}</EmptyState> : children(panel.data)) : null}
    </section>
  );
}

function Bar({ value, max, tone }: { value: number; max: number; tone?: "failed" }) {
  const percent = max > 0 ? Math.min(100, (value / max) * 100) : 0;

  return (
    <span className="bar" aria-hidden="true">
      <span className={`bar__fill${tone ? ` bar__fill--${tone}` : ""}`} style={{ width: `${percent}%` }} />
    </span>
  );
}

function percent(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`;
}

const REASON_LABELS: Record<string, string> = Object.fromEntries(REASON_CODES.map((r) => [r.code, r.label]));

function reasonLabel(code: string): string {
  return REASON_LABELS[code] ?? code;
}

// ── Status counts ────────────────────────────────────────────────────────────

const STATUSES: { key: keyof StatusCounts; label: string; tone: string }[] = [
  { key: "pending", label: "Pending", tone: "pending" },
  { key: "cleared", label: "Cleared", tone: "cleared" },
  { key: "failed", label: "Failed", tone: "failed" },
  { key: "onHold", label: "On hold", tone: "hold" },
];

function StatusGroup({ label, counts }: { label: string; counts: StatusCounts }) {
  return (
    <div className="statusgroup">
      <h3 className="statusgroup__label">{label}</h3>
      <dl className="statusgrid">
        {STATUSES.map((status) => (
          <div key={status.key} className={`statustile statustile--${status.tone}`}>
            <dt>{status.label}</dt>
            <dd>{counts[status.key]}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function StatusPanel({ panel, showRange }: { panel: Panel<DashboardSummaryDto>; showRange: boolean }) {
  return (
    <PanelFrame title="Batch status" panel={panel} isEmpty={() => false} empty="" full>
      {(data) => (
        <>
          <StatusGroup label="Today" counts={data.today} />
          {showRange ? <StatusGroup label="Selected range" counts={data.range} /> : null}
        </>
      )}
    </PanelFrame>
  );
}

// ── Fail-rate trend ──────────────────────────────────────────────────────────

// Six lines on one chart cannot be read at 360px, so the trend shows one product line at a time.
export function TrendPanel({ panel, fixedLine }: { panel: Panel<TrendDto>; fixedLine: ProductLine | "" }) {
  const [picked, setPicked] = useState<ProductLine | null>(null);

  return (
    <PanelFrame title="Fail rate by day" panel={panel} isEmpty={(data) => data.points.length === 0} empty="No batches in this range.">
      {(data) => {
        const firstWithData = PRODUCT_LINES.find((code) => data.points.some((point) => point.productLine === code));
        const line = fixedLine || picked || firstWithData || PRODUCT_LINES[0];
        const points = data.points
          .filter((point) => point.productLine === line)
          .sort((a, b) => a.date.localeCompare(b.date));
        const max = Math.max(0, ...points.map((point) => point.failRate));

        return (
          <>
            {fixedLine ? null : (
              <fieldset className="linepicker" aria-label="Trend product line">
                {PRODUCT_LINES.map((code) => (
                  <button key={code} type="button" aria-pressed={code === line} onClick={() => setPicked(code)}>
                    {code}
                  </button>
                ))}
              </fieldset>
            )}
            {points.length === 0 ? (
              <EmptyState>No {line} batches in this range.</EmptyState>
            ) : (
              <table className="bartable">
                <caption className="sr-only">Daily fail rate for {line}</caption>
                <thead>
                  <tr>
                    <th scope="col">Day</th>
                    <th scope="col" className="bartable__num">Failed</th>
                    <th scope="col" className="bartable__num">Rate</th>
                    <th scope="col" className="bartable__bar">
                      <span className="sr-only">Bar</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {points.map((point) => (
                    <tr key={point.date}>
                      <th scope="row" className="bartable__date">
                        {point.date}
                      </th>
                      <td className="bartable__num">
                        {point.failedCount} / {point.batchCount}
                      </td>
                      <td className="bartable__num">{percent(point.failRate)}</td>
                      <td className="bartable__bar">
                        <Bar value={point.failRate} max={max} tone="failed" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        );
      }}
    </PanelFrame>
  );
}

// ── Deviations per checkpoint ────────────────────────────────────────────────

export function DeviationsPanel({ panel }: { panel: Panel<DeviationsDto> }) {
  return (
    <PanelFrame title="Deviations by checkpoint" panel={panel} isEmpty={(data) => data.checkpoints.length === 0} empty="No deviations recorded.">
      {(data) => {
        const max = Math.max(0, ...data.checkpoints.map((c) => c.count));

        return (
          <table className="bartable">
            <thead>
              <tr>
                <th scope="col">Checkpoint</th>
                <th scope="col" className="bartable__num">Deviations</th>
                <th scope="col" className="bartable__bar">
                  <span className="sr-only">Bar</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.checkpoints.map((c) => (
                <tr key={c.checkpoint}>
                  <th scope="row">{c.checkpoint}</th>
                  <td className="bartable__num">{c.count}</td>
                  <td className="bartable__bar">
                    <Bar value={c.count} max={max} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      }}
    </PanelFrame>
  );
}

// ── Failure reasons ──────────────────────────────────────────────────────────

export function FailureReasonsPanel({ panel }: { panel: Panel<FailureReasonsDto> }) {
  return (
    <PanelFrame title="Failure reasons" panel={panel} isEmpty={(data) => data.reasons.length === 0} empty="No failures in this range.">
      {(data) => {
        const reasons = [...data.reasons].sort((a, b) => b.count - a.count);
        const max = Math.max(0, ...reasons.map((r) => r.count));

        return (
          <table className="bartable">
            <thead>
              <tr>
                <th scope="col">Reason</th>
                <th scope="col" className="bartable__num">Batches</th>
                <th scope="col" className="bartable__bar">
                  <span className="sr-only">Bar</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {reasons.map((r) => (
                <tr key={r.reasonCode}>
                  <th scope="row">{reasonLabel(r.reasonCode)}</th>
                  <td className="bartable__num">{r.count}</td>
                  <td className="bartable__bar">
                    <Bar value={r.count} max={max} tone="failed" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      }}
    </PanelFrame>
  );
}

// ── Marginal societies ───────────────────────────────────────────────────────

export function MarginalSocietiesPanel({ panel }: { panel: Panel<MarginalSocietiesDto> }) {
  return (
    <PanelFrame title="Most marginal societies" panel={panel} isEmpty={(data) => data.societies.length === 0} empty="No society data in this range.">
      {(data) => (
        <>
          <table className="bartable">
            <thead>
              <tr>
                <th scope="col">Society</th>
                <th scope="col" className="bartable__num">Margin</th>
                <th scope="col">Closest measure</th>
              </tr>
            </thead>
            <tbody>
              {data.societies.map((s) => (
                <tr key={s.societyCode}>
                  <th scope="row">
                    {s.societyName}
                    <span className="failurelist__meta">
                      {s.societyCode} · {s.consignmentCount} consignments
                    </span>
                  </th>
                  <td className="bartable__num">{s.tightestMargin.toFixed(2)}</td>
                  <td>{s.tightestMeasure ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="qcopanel__note">
            Source: {data.dataSource}. Coverage: {data.coverage}.
          </p>
        </>
      )}
    </PanelFrame>
  );
}

// ── Recent failures ──────────────────────────────────────────────────────────

// Batch codes stay plain text until SCRUM-137 builds a trace route the QCO can open; the
// existing /trace screen needs traceBatches, which the QCO does not hold.
export function RecentFailuresPanel({ panel }: { panel: Panel<RecentFailuresDto> }) {
  return (
    <PanelFrame title="Recent failures" panel={panel} isEmpty={(data) => data.batches.length === 0} empty="No failed batches in this range." full>
      {(data) => (
        <ul className="failurelist">
          {data.batches.map((b) => (
            <li key={b.batchCode}>
              <span className="failurelist__code">{b.batchCode}</span>
              <span className="failurelist__meta">
                {b.productLine} · {b.facility} · {formatColombo(b.failedAtUtc)}
              </span>
              {b.reasonCodes.length > 0 ? (
                <span className="failurelist__reasons">{b.reasonCodes.map(reasonLabel).join(", ")}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </PanelFrame>
  );
}
