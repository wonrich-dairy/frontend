import { useEffect, useMemo, useState } from "react";
import { ApiError } from "../../api/http";
import {
  CONSIGNMENT_STATUSES,
  searchConsignments,
  type ConsignmentStatus,
} from "../../api/consignments";
import type { Consignment } from "../../api/types";
import { useSession } from "../../auth/sessionStore";
import { useNavigation } from "../../app/navigationStore";
import { SearchIcon } from "../../components/icons";
import { EmptyState, ErrorNotice, Loading } from "../../components/ui/Feedback";

const LABELS: Record<ConsignmentStatus, string> = {
  Registered: "Awaiting test",
  Accepted: "Accepted",
  Rejected: "Rejected",
};

export function ConsignmentHistoryScreen() {
  const { session } = useSession();
  const { navigate } = useNavigation();
  const token = session?.accessToken ?? null;

  const [status, setStatus] = useState<ConsignmentStatus | null>(null);
  const [term, setTerm] = useState("");
  const [loaded, setLoaded] = useState<{
    status: ConsignmentStatus | null;
    items: Consignment[];
    total: number;
    failure: string | null;
  } | null>(null);

  useEffect(() => {
    const abort = new AbortController();

    searchConsignments(token, abort.signal, { status })
      .then((page) => setLoaded({ status, items: page.items, total: page.totalCount, failure: null }))
      .catch((error: unknown) => {
        if (abort.signal.aborted) {
          return;
        }

        setLoaded({
          status,
          items: [],
          total: 0,
          failure:
            error instanceof ApiError ? error.message : "The deliveries could not be loaded.",
        });
      });

    return () => abort.abort();
  }, [token, status]);

  const settled = loaded?.status === status ? loaded : null;
  const consignments = settled?.items ?? null;
  const total = settled?.total ?? 0;
  const failure = settled?.failure ?? null;

  const shown = useMemo(() => {
    const needle = term.trim().toLowerCase();

    if (needle === "") {
      return consignments ?? [];
    }

    return (consignments ?? []).filter(
      (one) =>
        one.reference.toLowerCase().includes(needle) ||
        one.societyName.toLowerCase().includes(needle) ||
        one.societyCode.toLowerCase().includes(needle),
    );
  }, [consignments, term]);

  return (
    <>
      <p className="pagehead__detail pagehead__detail--lead">
        {status === null
          ? `${total} recorded at this centre.`
          : `${total} ${LABELS[status].toLowerCase()}.`}
      </p>

      <div className="search">
        <SearchIcon className="search__icon" />
        <label className="sr-only" htmlFor="history-search">
          Search reference or society
        </label>
        <input
          id="history-search"
          type="search"
          value={term}
          placeholder="Search reference or society..."
          onChange={(event) => setTerm(event.target.value)}
        />
      </div>

      <div className="filterbar" role="group" aria-label="Filter by status">
        <button
          type="button"
          className={`chip${status === null ? " chip--on" : ""}`}
          aria-pressed={status === null}
          onClick={() => setStatus(null)}
        >
          All
        </button>

        {CONSIGNMENT_STATUSES.map((candidate) => (
          <button
            key={candidate}
            type="button"
            className={`chip${status === candidate ? " chip--on" : ""}`}
            aria-pressed={status === candidate}
            onClick={() => setStatus(candidate)}
          >
            {LABELS[candidate]}
          </button>
        ))}
      </div>

      {failure ? <ErrorNotice>{failure}</ErrorNotice> : null}

      {consignments === null ? <Loading label="Loading the deliveries..." /> : null}

      {consignments !== null && shown.length === 0 && !failure ? (
        <EmptyState>
          {term.trim() !== ""
            ? "Nothing here matches that reference or society."
            : status === null
              ? "No consignment has been registered at this centre yet."
              : `Nothing is ${LABELS[status].toLowerCase()} right now.`}
        </EmptyState>
      ) : null}

      {shown.map((one) => (
        <article key={one.reference} className="deliveryrow">
          <header className="deliveryrow__head">
            <strong>{one.reference}</strong>
            <span
              className={`badge${
                one.status === "Rejected"
                  ? " badge--bad"
                  : one.status === "Accepted"
                    ? " badge--good"
                    : ""
              }`}
            >
              {LABELS[one.status as ConsignmentStatus] ?? one.status}
            </span>
          </header>

          <p className="deliveryrow__society">{one.societyName}</p>

          <p className="deliveryrow__meta">
            <span>
              {one.canCount} {one.canCount === 1 ? "can" : "cans"}
            </span>
            <span>{one.totalQuantityLitres.toFixed(1)} L</span>
            <span>{one.arrivalDate}</span>
          </p>

          {one.status === "Registered" ? (
            <button
              type="button"
              className="button button--ghost button--small"
              onClick={() =>
                navigate(
                  `/consignments/quality-test?reference=${encodeURIComponent(one.reference)}`,
                )
              }
            >
              Record the panel
            </button>
          ) : null}
        </article>
      ))}
    </>
  );
}
