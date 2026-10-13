import { useEffect, useState } from "react";
import { ApiError } from "../../../api/http";
import { getAuditCoverage, type AuditCoverageDto } from "../../../api/traceability/audit";
import { useNavigation } from "../../../app/navigationStore";
import { useSession } from "../../../auth/sessionStore";
import { ErrorNotice, Loading } from "../../../components/ui/Feedback";
import { CHECKPOINT_LABELS, humanise } from "../batches/trace";
import { AUDIT_PATH, auditFiltersToQuery, emptyAuditFilters, SOURCE_LABELS } from "./filters";

type CoverageLoad =
  | { status: "loading" }
  | { status: "failed"; message: string }
  | { status: "done"; coverage: AuditCoverageDto };

// Which actions the audit trail covers and which it does not, with the reason (SCRUM-138). Read
// from the service, which keeps the same list with its code, so this page never claims more than
// the trail shows.
export function AuditCoverageScreen() {
  const { session } = useSession();
  const { navigate } = useNavigation();
  const token = session?.accessToken ?? null;
  const [load, setLoad] = useState<CoverageLoad>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();

    getAuditCoverage(token, controller.signal)
      .then((coverage) => setLoad({ status: "done", coverage }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setLoad({
            status: "failed",
            message: error instanceof ApiError ? error.message : "The coverage list could not be loaded. Try again.",
          });
        }
      });

    return () => controller.abort();
  }, [token]);

  return (
    <>
      <header className="pagehead">
        <h1 className="pagehead__title">What the audit trail covers</h1>
        <p className="pagehead__detail">
          The trail is built from the events this service receives and the copy of each batch&apos;s MCC and intake
          records it keeps. So it covers the actions that have events, listed first, and nothing done without one.
        </p>
      </header>

      {load.status === "loading" ? <Loading label="Loading the coverage list..." /> : null}
      {load.status === "failed" ? <ErrorNotice>{load.message}</ErrorNotice> : null}

      {load.status === "done" ? (
        <>
          <section className="coverage" aria-labelledby="coverage-covered">
            <h2 id="coverage-covered" className="coverage__title">
              Covered ({load.coverage.covered.length})
            </h2>
            <table className="audittable">
              <thead>
                <tr>
                  <th scope="col">Action</th>
                  <th scope="col">Checkpoint</th>
                  <th scope="col">Source</th>
                  <th scope="col">What the entry records</th>
                </tr>
              </thead>
              <tbody>
                {load.coverage.covered.map((covered) => (
                  <tr key={covered.action}>
                    <td data-label="Action">
                      {/* Opens the trail on just this action. */}
                      <button
                        type="button"
                        className="linkbutton audittable__batch"
                        onClick={() => navigate(`${AUDIT_PATH}${auditFiltersToQuery({ ...emptyAuditFilters(), action: covered.action })}`)}
                      >
                        {humanise(covered.action)}
                      </button>
                      <span className="audittable__detail">{covered.action}</span>
                    </td>
                    <td data-label="Checkpoint" className={covered.checkpoint === null ? "audittable__missing" : undefined}>
                      {covered.checkpoint === null ? "None" : CHECKPOINT_LABELS[covered.checkpoint]}
                    </td>
                    <td data-label="Source">{SOURCE_LABELS[covered.source]}</td>
                    <td data-label="Records">{covered.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="coverage" aria-labelledby="coverage-gaps">
            <h2 id="coverage-gaps" className="coverage__title">
              Not covered ({load.coverage.notCovered.length})
            </h2>
            <ul className="coverage__gaps">
              {load.coverage.notCovered.map((gap) => (
                <li key={gap.action} className="coverage__gap">
                  <strong>{gap.action}</strong>
                  <p>{gap.reason}</p>
                </li>
              ))}
            </ul>
          </section>

          <p className="coverage__source">
            The same list is kept with the traceability service in <code>{load.coverage.documentation}</code>, which the
            traceability matrix links to.
          </p>
        </>
      ) : null}
    </>
  );
}
