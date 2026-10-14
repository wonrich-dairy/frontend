import type { BatchLinksDto, BatchTraceDto, TraceCheckpointDto, TraceHoldDto } from "../../../api/traceability/batches";
import { useSession } from "../../../auth/sessionStore";
import { DeviationBadge } from "../../../components/ui/Feedback";
import { formatColombo } from "../../../utils/time";
import { BatchLoaded, CompletenessBadge, DeviationDetail, MissingNotice, StatusBadge } from "./parts";
import { useBatchTrace } from "./useBatchRecord";
import { CHECKPOINT_LABELS, humanise, rankSocieties, rankTanks, STATUS_LABELS } from "./trace";

function litres(value: number): string {
  return `${value.toFixed(1)} L`;
}

function share(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

function hasData(step: TraceCheckpointDto): boolean {
  return step.status === "WithinSpec" || step.status === "Deviation";
}

// The backward trace (SCRUM-137, FR7): from the lab result back through every checkpoint to the
// tanks and societies whose milk went in, with the origin deviation picked out as the lead. It
// reads GET /api/batches/{id}/trace (SCRUM-134), so the service picks the origin and audits the
// open (SCRUM-138, SCRUM-144); nothing about the trace is worked out here.
export function BatchTraceScreen({ batchId }: { batchId: string }) {
  const { session } = useSession();
  const load = useBatchTrace(batchId, session?.accessToken ?? null);

  return (
    <BatchLoaded batchId={batchId} load={load}>
      {(trace) => (
        <>
          <header className="batchhead">
            <div className="batchhead__line">
              <h1 className="pagehead__title">Trace {trace.batchId}</h1>
              <StatusBadge batch={trace} />
            </div>
            <Completeness trace={trace} />
          </header>

          <Lead trace={trace} />

          <h2 className="sectiontitle">Chain, back from the lab</h2>
          <ol className="chain" aria-label="Checkpoints, back from the lab">
            {trace.chain.map((step) => (
              <ChainStep key={step.checkpoint} step={step} trace={trace} />
            ))}
          </ol>

          {trace.holds.length > 0 ? <Holds holds={trace.holds} /> : null}

          {trace.links ? (
            <Contributors links={trace.links} />
          ) : (
            <>
              <h2 className="sectiontitle">Contributing tanks and societies</h2>
              <MissingNotice title="Not resolved" reason={unresolvedReason(trace)} />
            </>
          )}
        </>
      )}
    </BatchLoaded>
  );
}

// The completeness badge, and what makes a partial trace partial.
function Completeness({ trace }: { trace: BatchTraceDto }) {
  const recorded = trace.chain.filter(hasData).length;
  const gaps = [
    `${recorded} of ${trace.chain.length} checkpoints recorded`,
    trace.links === null ? "tanks and societies not resolved" : null,
  ].filter(Boolean);

  return (
    <p className="completeness">
      <CompletenessBadge completeness={trace.completeness} />
      <span className="completeness__detail">{gaps.join("; ")}</span>
    </p>
  );
}

// The root-cause lead. With no deviation it says which checkpoints that cannot speak for, so a
// trace with gaps never reads as a clean one.
function Lead({ trace }: { trace: BatchTraceDto }) {
  const { origin, originCheckpoint } = trace;

  if (origin && originCheckpoint) {
    return (
      <section className="lead lead--deviation" aria-label="First deviation">
        <div className="lead__head">
          <DeviationBadge label="First deviation" />
          <span className="lead__where">
            {CHECKPOINT_LABELS[originCheckpoint]} · <time dateTime={origin.occurredAt}>{formatColombo(origin.occurredAt)}</time>
          </span>
        </div>
        <DeviationDetail deviation={origin} />
      </section>
    );
  }

  // In stage order, the way the gaps were always listed: MCC first.
  const gaps = [...trace.chain]
    .reverse()
    .filter((step) => !hasData(step))
    .map((step) => CHECKPOINT_LABELS[step.checkpoint]);

  return (
    <section className="lead" aria-label="First deviation">
      <p className="lead__none">No deviation was recorded in the data received.</p>
      {gaps.length > 0 ? (
        <MissingNotice
          title="Cannot be ruled out"
          reason={`${gaps.join(", ")} ${gaps.length === 1 ? "has" : "have"} no data, so a deviation there would not show here.`}
        />
      ) : null}
    </section>
  );
}

function stepReason(step: TraceCheckpointDto, trace: BatchTraceDto): string | null {
  if (step.status === "NotYetReached") {
    return `Not reached yet: the batch is ${STATUS_LABELS[trace.status].toLowerCase()}.`;
  }

  if (step.status === "MissingData") {
    return step.missingReason ?? "No data was received for this checkpoint.";
  }

  return null;
}

// Tanks and societies come from the same MCC and Intake lookup, so its reason applies to them too.
function unresolvedReason(trace: BatchTraceDto): string {
  const mcc = trace.chain.find((step) => step.checkpoint === "Mcc");

  return mcc?.missingReason ?? "The MCC and Intake records have not been resolved yet.";
}

function ChainStep({ step, trace }: { step: TraceCheckpointDto; trace: BatchTraceDto }) {
  const reason = stepReason(step, trace);
  const isOrigin = trace.originCheckpoint === step.checkpoint;
  const others = step.deviations.filter((deviation) => deviation.sourceEventId !== trace.origin?.sourceEventId);

  return (
    <li className={`chain__step${isOrigin ? " chain__step--first" : step.deviations.length > 0 ? " chain__step--deviation" : ""}`}>
      <div className="chain__head">
        <h3 className="chain__title">{CHECKPOINT_LABELS[step.checkpoint]}</h3>
        {isOrigin ? (
          <DeviationBadge label="First deviation" />
        ) : step.deviations.length > 0 ? (
          <DeviationBadge label={step.deviations.length === 1 ? "Deviation" : `${step.deviations.length} deviations`} />
        ) : null}
      </div>

      {step.checkpoint === "Lab" && hasData(step) ? <p className="chain__meta">Lab result: {trace.labResult}</p> : null}

      {step.firstRecordedAt ? (
        <p className="chain__meta">
          {step.firstRecordedAt === step.lastRecordedAt
            ? formatColombo(step.firstRecordedAt)
            : `${formatColombo(step.firstRecordedAt)} to ${formatColombo(step.lastRecordedAt)}`}
        </p>
      ) : null}

      {reason ? <MissingNotice reason={reason} /> : null}

      {isOrigin && trace.origin ? <DeviationDetail deviation={trace.origin} /> : null}
      {others.map((deviation) => (
        <DeviationDetail key={deviation.sourceEventId} deviation={deviation} />
      ))}
    </li>
  );
}

// Processing holds, in the order they were raised.
function Holds({ holds }: { holds: TraceHoldDto[] }) {
  return (
    <>
      <h2 className="sectiontitle">Processing holds</h2>
      <ol className="ranked" aria-label="Processing holds">
        {holds.map((hold) => (
          <li key={hold.holdId} className="ranked__item">
            <span className="ranked__main">
              <strong>{hold.reason ?? "Hold"}</strong>
              <span className="ranked__meta">
                Raised {formatColombo(hold.raisedAt)}
                {hold.raisedBy ? ` by ${hold.raisedBy}` : ""}
                {hold.failedParameter ? ` · ${humanise(hold.failedParameter)} ${hold.failedValue ?? ""}`.trimEnd() : ""}
              </span>
              {hold.isOpen ? null : (
                <span className="ranked__meta">
                  Resolved {formatColombo(hold.resolvedAt)}
                  {hold.resolvedBy ? ` by ${hold.resolvedBy}` : ""}
                  {hold.resolution ? `: ${hold.resolution}` : ""}
                </span>
              )}
            </span>
            <span className={`badge ${hold.isOpen ? "badge--warn" : "badge--good"}`}>{hold.isOpen ? "Open" : "Resolved"}</span>
          </li>
        ))}
      </ol>
    </>
  );
}

function Contributors({ links }: { links: BatchLinksDto }) {
  const tanks = rankTanks(links);
  const societies = rankSocieties(links);

  return (
    <>
      <h2 className="sectiontitle">Dispatch</h2>
      <p className="chain__meta">
        {links.dispatch.reference} · {links.dispatch.bowserRegistration ?? "Bowser not recorded"} ·{" "}
        {formatColombo(links.dispatch.dispatchedAt)} · {litres(links.dispatch.totalLitres)}
      </p>

      <h2 className="sectiontitle">Contributing tanks</h2>
      {tanks.length === 0 ? (
        <MissingNotice reason="The dispatch note lists no source tank." />
      ) : (
        <ol className="ranked" aria-label="Contributing tanks, most drawn first">
          {tanks.map(({ tank, share: fraction }, index) => (
            <li key={tank.code} className="ranked__item">
              <span className="ranked__rank">{index + 1}</span>
              <span className="ranked__main">
                <strong>{tank.code}</strong>
                <span className="ranked__meta">
                  {tank.consignments.length} consignment{tank.consignments.length === 1 ? "" : "s"}
                  {tank.consignments.length > 0 ? `: ${tank.consignments.map((c) => c.reference).join(", ")}` : ""}
                </span>
                {tank.consignments.length === 0 ? (
                  <MissingNotice reason="No consignment could be resolved for this tank." />
                ) : null}
              </span>
              <span className="ranked__qty">
                {litres(tank.quantityDrawnLitres)}
                <span className="ranked__share">{share(fraction)} drawn</span>
              </span>
            </li>
          ))}
        </ol>
      )}

      <h2 className="sectiontitle">Contributing societies</h2>
      {societies.length === 0 ? (
        <MissingNotice reason="No society could be resolved: the tanks list no consignment." />
      ) : (
        <ol className="ranked" aria-label="Contributing societies, largest share first">
          {societies.map((society, index) => (
            <li key={society.code} className="ranked__item">
              <span className="ranked__rank">{index + 1}</span>
              <span className="ranked__main">
                <strong>{society.name ?? society.code}</strong>
                <span className="ranked__meta">
                  {society.name ? `${society.code} · ` : ""}
                  {society.consignments.length} consignment{society.consignments.length === 1 ? "" : "s"} via{" "}
                  {society.tanks.join(", ")}
                </span>
              </span>
              <span className="ranked__qty">
                {litres(society.litres)}
                <span className="ranked__share">{share(society.share)} of supplied milk</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
