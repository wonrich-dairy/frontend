import type { ReactNode } from "react";
import type { BatchRecordDto, DeviationDto, TraceCompleteness } from "../../../api/traceability/batches";
import { useNavigation } from "../../../app/navigationStore";
import { WarningIcon } from "../../../components/icons";
import { EmptyState, ErrorNotice, Loading } from "../../../components/ui/Feedback";
import { formatColombo } from "../../../utils/time";
import { describeDeviation, deviationTitle, STATUS_LABELS, STATUS_TONES } from "./trace";
import type { BatchLoad } from "./useBatchRecord";

// Loading, not found and failure look the same on every batch screen; only a loaded record
// reaches the screen's own content.
export function BatchLoaded({
  batchId,
  load,
  children,
}: {
  batchId: string;
  load: BatchLoad;
  children: (batch: BatchRecordDto) => ReactNode;
}) {
  const { navigate } = useNavigation();

  if (load.status === "loading") {
    return <Loading label="Loading the batch..." />;
  }

  if (load.status === "error") {
    return <ErrorNotice>{load.message}</ErrorNotice>;
  }

  if (load.status === "notFound") {
    return (
      <>
        <EmptyState>No batch exists with the ID {batchId}.</EmptyState>
        <button type="button" className="button button--wide" onClick={() => navigate("/qco/batches")}>
          Search for a batch
        </button>
      </>
    );
  }

  return <>{children(load.batch)}</>;
}

export function StatusBadge({ batch }: { batch: Pick<BatchRecordDto, "status"> }) {
  return <span className={`badge ${STATUS_TONES[batch.status]}`}>{STATUS_LABELS[batch.status]}</span>;
}

const COMPLETENESS: Record<TraceCompleteness, { label: string; tone: string }> = {
  Complete: { label: "Trace complete", tone: "badge--good" },
  Partial: { label: "Trace partial", tone: "badge--warn" },
};

export function CompletenessBadge({ completeness }: { completeness: TraceCompleteness }) {
  const { label, tone } = COMPLETENESS[completeness];

  return <span className={`badge ${tone}`}>{label}</span>;
}

// The completeness badge, and on a full record, what makes a partial trace partial.
export function CompletenessIndicator({ batch }: { batch: BatchRecordDto }) {
  const recorded = batch.checkpoints.filter((section) => section.state === "Recorded").length;
  const gaps = [
    `${recorded} of ${batch.checkpoints.length} checkpoints recorded`,
    batch.links === null ? "tanks and societies not resolved" : null,
  ].filter(Boolean);

  return (
    <p className="completeness">
      <CompletenessBadge completeness={batch.completeness} />
      <span className="completeness__detail">{gaps.join("; ")}</span>
    </p>
  );
}

export function BatchHeader({ batch, children }: { batch: BatchRecordDto; children?: ReactNode }) {
  return (
    <header className="batchhead">
      <div className="batchhead__line">
        <h1 className="pagehead__title">{batch.batchId}</h1>
        <StatusBadge batch={batch} />
      </div>
      <CompletenessIndicator batch={batch} />
      <dl className="facts">
        <Fact label="Lab result" value={batch.labResult} />
        <Fact label="Product line" value={batch.productLine} />
        <Fact label="Facility" value={batch.facility} />
        <Fact label="Dispatch ref" value={batch.dispatchRef} missing="Not received" />
        <Fact label="Batch reference" value={batch.batchReference} missing="Not resolved" />
        <Fact label="First event" value={formatColombo(batch.firstEventAt)} />
        <Fact label="Last event" value={formatColombo(batch.lastEventAt)} />
      </dl>
      {children}
    </header>
  );
}

// A missing value says so, in its own style, rather than leaving the row blank.
export function Fact({ label, value, missing = "Not recorded" }: { label: string; value: string | null; missing?: string }) {
  return (
    <div className="facts__row">
      <dt>{label}</dt>
      <dd className={value === null ? "facts__missing" : undefined}>{value ?? missing}</dd>
    </div>
  );
}

// A checkpoint or link with no data: marked missing, with the reason, never left blank.
export function MissingNotice({ title, reason }: { title?: string; reason: string }) {
  return (
    <div className="missing" role="note">
      <span className="missing__label">
        <WarningIcon width={14} height={14} />
        {title ?? "Missing"}
      </span>
      <p className="missing__reason">{reason}</p>
    </div>
  );
}

export function DeviationDetail({ deviation }: { deviation: DeviationDto }) {
  const reading = describeDeviation(deviation);
  const thresholdFailed = deviation.observedValue !== null && deviation.limit !== null;

  return (
    <div className="deviationdetail">
      {thresholdFailed ? <span className="deviationdetail__status">Threshold failed</span> : null}
      <strong>{deviationTitle(deviation)}</strong>
      <span>{reading}</span>
      {deviation.description && deviation.description !== reading ? <span>{deviation.description}</span> : null}
    </div>
  );
}

// Previous and next through a paged result; nothing when it all fits on one page.
export function Pager({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (page: number) => void }) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav className="pager" aria-label="Pages">
      <button type="button" className="button button--ghost button--small" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </button>
      <span className="pager__where">
        Page {page} of {totalPages}
      </span>
      <button
        type="button"
        className="button button--ghost button--small"
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
      >
        Next
      </button>
    </nav>
  );
}
