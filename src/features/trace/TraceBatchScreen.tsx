import { useState } from "react";
import { ApiError } from "../../api/http";
import { traceBatch, type BatchTrace } from "../../api/trace";
import { useSession } from "../../auth/sessionStore";
import { DropletIcon, SearchIcon, TraceIcon, TruckIcon, ClipboardIcon } from "../../components/icons";
import { Accordion, EmptyState, ErrorNotice } from "../../components/ui/Feedback";

/**
 * Resolving a factory batch back through its dispatch note, its tanks and the consignments that
 * filled them (SCRUM-12). Each link is its own section because a recall works backwards one hop
 * at a time, and the officer needs to see where the trail stops.
 */
export function TraceBatchScreen() {
  const { session } = useSession();
  const token = session?.accessToken ?? null;

  const [term, setTerm] = useState("");
  const [trace, setTrace] = useState<BatchTrace | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  const search = async (event: React.FormEvent) => {
    event.preventDefault();

    const reference = term.trim();

    if (reference === "" || searching) {
      return;
    }

    setSearching(true);
    setFailure(null);
    setTrace(null);

    try {
      setTrace(await traceBatch(reference, token));
    } catch (error: unknown) {
      setFailure(
        error instanceof ApiError && error.status === 404
          ? `No batch carries the reference "${reference}".`
          : error instanceof ApiError
            ? error.message
            : "That batch could not be traced.",
      );
    } finally {
      setSearching(false);
    }
  };

  return (
    <>
      <header className="pagehead">
        <h1 className="pagehead__title">Trace a Batch</h1>
      </header>

      <form className="search" onSubmit={search}>
        <SearchIcon className="search__icon" />
        <label className="sr-only" htmlFor="trace-search">
          Batch reference
        </label>
        <input
          id="trace-search"
          type="search"
          value={term}
          disabled={searching}
          placeholder="Search batch reference, e.g. BAT-782-991"
          onChange={(event) => setTerm(event.target.value)}
        />
      </form>

      {failure ? <ErrorNotice>{failure}</ErrorNotice> : null}

      {!trace && !failure ? (
        <EmptyState>
          Enter a factory batch reference to follow it back to the societies that supplied it.
        </EmptyState>
      ) : null}

      {trace ? (
        <>
          {trace.missing.length > 0 ? (
            <ErrorNotice>
              The trail is incomplete: {trace.missing.join(", ")}.
            </ErrorNotice>
          ) : null}

          <Accordion
            icon={<TraceIcon width={16} height={16} />}
            title="Factory Batch"
            defaultOpen
          >
            <Facts
              rows={[
                ["Batch reference", trace.batchReference],
                ["Batch date", trace.batchDate],
                ["Arrival timestamp", formatDateTime(trace.arrivedAtLocal)],
                ["Screened by", trace.screenedBy ?? "-"],
                ["Total volume", `${trace.totalDispatchedLitres.toFixed(1)} L`],
              ]}
            />
          </Accordion>

          <Accordion icon={<TruckIcon width={16} height={16} />} title="Dispatch Note" defaultOpen>
            <Facts
              rows={[
                ["Dispatch ref", trace.dispatchNoteReference],
                ["Timestamp", formatDateTime(trace.dispatchedAtLocal)],
                ["Driver name", trace.driverName],
                ["Bowser no", trace.bowserRegistration],
                ["Dispatched by", trace.dispatchedBy ?? "-"],
              ]}
            />
          </Accordion>

          <Accordion icon={<DropletIcon width={16} height={16} />} title="Source Tanks">
            {trace.tanks.length === 0 ? (
              <EmptyState>No tank on this note could be resolved.</EmptyState>
            ) : (
              trace.tanks.map((tank) => (
                <div key={tank.tankCode}>
                  <Facts
                    rows={[
                      ["Tank", `${tank.tankName} (${tank.tankCode})`],
                      ["Drawn", `${tank.quantityDrawnLitres.toFixed(1)} L`],
                      ["Consignments", String(tank.consignments.length)],
                    ]}
                  />

                  {tank.missing.length > 0 ? (
                    <p className="tracerow__breach">{tank.missing.join(" ")}</p>
                  ) : null}
                </div>
              ))
            )}
          </Accordion>

          <Accordion
            icon={<ClipboardIcon width={16} height={16} />}
            title="Source Consignments"
            defaultOpen
          >
            {trace.tanks.flatMap((tank) => tank.consignments).length === 0 ? (
              <EmptyState>No consignment could be resolved for this batch.</EmptyState>
            ) : (
              trace.tanks.flatMap((tank) =>
                tank.consignments.map((consignment) => (
                  <article key={consignment.reference} className="tracerow">
                    <header className="tracerow__head">
                      <strong>{consignment.reference}</strong>
                      {/*
                        The verdict is the gate's own, not something inferred here. `missing` is
                        the trail's gaps - an unresolved society, no panel on record - so it says
                        the trace is incomplete, never that the milk failed.
                      */}
                      <span
                        className={`badge${
                          consignment.qualityTest === null
                            ? ""
                            : consignment.qualityTest.verdict === "Reject"
                              ? " badge--bad"
                              : " badge--good"
                        }`}
                      >
                        {consignment.qualityTest?.verdict ?? "Not tested"}
                      </span>
                    </header>

                    <p className="tracerow__society">{consignment.societyName}</p>
                    <p className="tracerow__meta">
                      <span>Cans: {consignment.canLabels.join(", ") || "-"}</span>
                      <span>{consignment.quantityLitres.toFixed(0)} L</span>
                    </p>

                    {consignment.missing.length > 0 ? (
                      <p className="tracerow__breach">{consignment.missing.join(" ")}</p>
                    ) : null}
                  </article>
                )),
              )
            )}
          </Accordion>

          {trace.societiesByMargin.length > 0 ? (
            <Accordion title="Societies by tightest margin">
              {trace.societiesByMargin.map((society) => (
                <Facts
                  key={society.societyCode}
                  rows={[
                    ["Society", `${society.societyName} (${society.societyCode})`],
                    ["Tightest margin", society.tightestMargin.toFixed(2)],
                    ["On", society.tightestMeasure ?? "Nothing tested"],
                    ["Consignments", String(society.consignmentCount)],
                  ]}
                />
              ))}
            </Accordion>
          ) : null}
        </>
      ) : null}
    </>
  );
}

function Facts({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="facts">
      {rows.map(([label, value]) => (
        <div key={label} className="facts__row">
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function formatDateTime(value: string): string {
  const at = new Date(value);

  return Number.isNaN(at.getTime()) ? value : at.toLocaleString();
}
