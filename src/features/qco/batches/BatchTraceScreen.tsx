import type { BatchLinksDto, BatchRecordDto, CheckpointSectionDto } from "../../../api/traceability/batches";
import { useSession } from "../../../auth/sessionStore";
import { DeviationBadge } from "../../../components/ui/Feedback";
import { formatColombo } from "../../../utils/time";
import { BatchLoaded, CompletenessIndicator, DeviationDetail, MissingNotice, StatusBadge } from "./parts";
import { useBatchRecord } from "./useBatchRecord";
import {
  CHECKPOINT_LABELS,
  checkpointsWithoutData,
  firstDeviation,
  missingReason,
  rankSocieties,
  rankTanks,
  upstreamReason,
  type FirstDeviation,
} from "./trace";

function litres(value: number): string {
  return `${value.toFixed(1)} L`;
}

function share(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

// The backward trace (SCRUM-137, FR7): from the lab result back through every checkpoint to the
// tanks and societies whose milk went in, with the earliest deviation picked out as the lead.
export function BatchTraceScreen({ batchId }: { batchId: string }) {
  const { session } = useSession();
  const load = useBatchRecord(batchId, session?.accessToken ?? null);

  return (
    <BatchLoaded batchId={batchId} load={load}>
      {(batch) => {
        const first = firstDeviation(batch);
        // Back from the lab: the order the trace is read in, not the order the milk moved.
        const chain = [...batch.checkpoints].reverse();

        return (
          <>
            <header className="batchhead">
              <div className="batchhead__line">
                <h1 className="pagehead__title">Trace {batch.batchId}</h1>
                <StatusBadge batch={batch} />
              </div>
              <CompletenessIndicator batch={batch} />
            </header>

            <Lead batch={batch} first={first} />

            <h2 className="sectiontitle">Chain, back from the lab</h2>
            <ol className="chain" aria-label="Checkpoints, back from the lab">
              {chain.map((section) => (
                <ChainStep key={section.checkpoint} section={section} batch={batch} first={first} />
              ))}
            </ol>

            {batch.links ? (
              <Contributors links={batch.links} />
            ) : (
              <>
                <h2 className="sectiontitle">Contributing tanks and societies</h2>
                <MissingNotice title="Not resolved" reason={upstreamReason(batch)} />
              </>
            )}
          </>
        );
      }}
    </BatchLoaded>
  );
}

// The root-cause lead. With no deviation it says which checkpoints that cannot speak for, so a
// trace with gaps never reads as a clean one.
function Lead({ batch, first }: { batch: BatchRecordDto; first: FirstDeviation | null }) {
  if (first) {
    return (
      <section className="lead lead--deviation" aria-label="First deviation">
        <div className="lead__head">
          <DeviationBadge label="First deviation" />
          <span className="lead__where">
            {CHECKPOINT_LABELS[first.checkpoint]} · <time dateTime={first.deviation.occurredAt}>{formatColombo(first.deviation.occurredAt)}</time>
          </span>
        </div>
        <DeviationDetail deviation={first.deviation} />
      </section>
    );
  }

  const gaps = checkpointsWithoutData(batch).map((checkpoint) => CHECKPOINT_LABELS[checkpoint]);

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

function ChainStep({ section, batch, first }: { section: CheckpointSectionDto; batch: BatchRecordDto; first: FirstDeviation | null }) {
  const reason = missingReason(section, batch);
  const isFirst = first?.checkpoint === section.checkpoint;
  const others = section.deviations.filter((deviation) => deviation !== first?.deviation);

  return (
    <li className={`chain__step${isFirst ? " chain__step--first" : section.deviations.length > 0 ? " chain__step--deviation" : ""}`}>
      <div className="chain__head">
        <h3 className="chain__title">{CHECKPOINT_LABELS[section.checkpoint]}</h3>
        {isFirst ? (
          <DeviationBadge label="First deviation" />
        ) : section.deviations.length > 0 ? (
          <DeviationBadge label={section.deviations.length === 1 ? "Deviation" : `${section.deviations.length} deviations`} />
        ) : null}
      </div>

      {section.checkpoint === "Lab" && section.state === "Recorded" ? (
        <p className="chain__meta">Lab result: {batch.labResult}</p>
      ) : null}

      {section.firstRecordedAt ? (
        <p className="chain__meta">
          {section.records.length} record{section.records.length === 1 ? "" : "s"},{" "}
          {section.firstRecordedAt === section.lastRecordedAt
            ? formatColombo(section.firstRecordedAt)
            : `${formatColombo(section.firstRecordedAt)} to ${formatColombo(section.lastRecordedAt)}`}
        </p>
      ) : null}

      {reason ? <MissingNotice reason={reason} /> : null}

      {isFirst && first ? <DeviationDetail deviation={first.deviation} /> : null}
      {others.map((deviation, index) => (
        <DeviationDetail key={index} deviation={deviation} />
      ))}
    </li>
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
