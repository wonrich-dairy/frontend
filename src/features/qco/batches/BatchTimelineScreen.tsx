import type { BatchCheckpoint, BatchRecordDto, CheckpointSectionDto } from "../../../api/traceability/batches";
import { useNavigation } from "../../../app/navigationStore";
import { useSession } from "../../../auth/sessionStore";
import { TraceIcon } from "../../../components/icons";
import { DeviationBadge } from "../../../components/ui/Feedback";
import { formatColombo } from "../../../utils/time";
import { batchPath } from "./search";
import { BatchHeader, BatchLoaded, DeviationDetail, MissingNotice } from "./parts";
import { useBatchRecord } from "./useBatchRecord";
import { CHECKPOINT_LABELS, deviationCount, humanise, missingReason, recordFacts, timelineItems, type TimelineItem } from "./trace";

const STATE_LABELS: Record<CheckpointSectionDto["state"], string> = {
  Recorded: "Recorded",
  NotYetReached: "Not reached yet",
  NoDataReceived: "Missing",
};

const STATE_TONES: Record<CheckpointSectionDto["state"], string> = {
  Recorded: "badge--good",
  NotYetReached: "badge--pending",
  NoDataReceived: "badge--warn",
};

// One batch's full timeline (SCRUM-137, FR8): every checkpoint in the order the milk passed it,
// each record in the order it happened, deviations marked where they were reported.
export function BatchTimelineScreen({ batchId }: { batchId: string }) {
  const { session } = useSession();
  const { navigate } = useNavigation();
  const load = useBatchRecord(batchId, session?.accessToken ?? null);

  return (
    <BatchLoaded batchId={batchId} load={load}>
      {(batch) => (
        <>
          <BatchHeader batch={batch}>
            <TraceAction batch={batch} onTrace={() => navigate(`${batchPath(batch.batchId)}/trace`)} />
          </BatchHeader>

          <h2 className="sectiontitle">Timeline</h2>
          <ol className="timeline">
            {batch.checkpoints.map((section) => (
              <CheckpointGroup key={section.checkpoint} section={section} batch={batch} />
            ))}
          </ol>
        </>
      )}
    </BatchLoaded>
  );
}

// Offered on every batch, but a failed one is what it is for, so there it leads.
function TraceAction({ batch, onTrace }: { batch: BatchRecordDto; onTrace: () => void }) {
  const deviations = deviationCount(batch);
  const failed = batch.status === "Failed" || batch.labResult === "Failed";

  return (
    <div className="traceaction">
      <p className="traceaction__summary">
        {deviations === 0
          ? "No deviation in the data received."
          : `${deviations} deviation${deviations === 1 ? "" : "s"} recorded.`}
      </p>
      <button type="button" className={`button button--wide${failed ? "" : " button--ghost"}`} onClick={onTrace}>
        <TraceIcon width={18} height={18} />
        Trace backward
      </button>
    </div>
  );
}

function CheckpointGroup({ section, batch }: { section: CheckpointSectionDto; batch: BatchRecordDto }) {
  const reason = missingReason(section, batch);
  const items = timelineItems(section);
  const headingId = `checkpoint-${section.checkpoint}`;

  return (
    <li className={`timeline__group${section.deviations.length > 0 ? " timeline__group--deviation" : ""}`}>
      <section aria-labelledby={headingId}>
        <header className="timeline__head">
          <h3 id={headingId} className="timeline__title">
            {CHECKPOINT_LABELS[section.checkpoint]}
          </h3>
          <span className={`badge ${STATE_TONES[section.state]}`}>{STATE_LABELS[section.state]}</span>
        </header>

        {reason ? <MissingNotice title={STATE_LABELS[section.state]} reason={reason} /> : null}

        {/* Not only when recorded: a checkpoint can have deviations but no records, e.g. MCC
            deviations while the upstream lookup has not resolved, and they are never hidden. */}
        {items.length > 0 ? (
          <ol className="timeline__events">
            {items.map((item, index) => (
              <TimelineEntry key={index} item={item} checkpoint={section.checkpoint} />
            ))}
          </ol>
        ) : null}
      </section>
    </li>
  );
}

function TimelineEntry({ item, checkpoint }: { item: TimelineItem; checkpoint: BatchCheckpoint }) {
  if (item.type === "deviation") {
    return (
      <li className="event event--deviation">
        <div className="event__head">
          <span className="event__kind">Deviation reported</span>
          <DeviationBadge />
        </div>
        <p className="event__meta">
          <span>{CHECKPOINT_LABELS[checkpoint]}</span>
          <time dateTime={item.at}>{formatColombo(item.at)}</time>
        </p>
        <DeviationDetail deviation={item.deviation} />
      </li>
    );
  }

  const { record, deviations } = item;
  const facts = recordFacts(record.data);
  // Processing and Lab events come from a system when they carry no user; the MCC and Intake
  // records always have a person behind them, so there a missing user is missing data.
  const user = record.recordedBy ?? (checkpoint === "Processing" || checkpoint === "Lab" ? "System" : null);

  return (
    <li className={`event${deviations.length > 0 ? " event--deviation" : ""}`}>
      <div className="event__head">
        <span className="event__kind">{humanise(record.kind)}</span>
        {deviations.length > 0 ? <DeviationBadge /> : null}
      </div>
      <p className="event__meta">
        <span>{CHECKPOINT_LABELS[checkpoint]}</span>
        <time dateTime={record.occurredAt}>{formatColombo(record.occurredAt)}</time>
        <span className={user === null ? "facts__missing" : undefined}>{user ?? "User not recorded"}</span>
      </p>
      {deviations.map((deviation, index) => (
        <DeviationDetail key={index} deviation={deviation} />
      ))}
      {facts.length > 0 ? (
        <details className="event__details">
          <summary>Details</summary>
          <dl className="facts facts--compact">
            {facts.map(([label, value]) => (
              <div key={label} className="facts__row">
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </details>
      ) : null}
    </li>
  );
}
