import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError } from "../../../api/http";
import type { BatchSummaryDto } from "../../../api/traceability/batches";
import { useNavigation } from "../../../app/navigationStore";
import { useSession } from "../../../auth/sessionStore";
import { ChevronRightIcon, SearchIcon } from "../../../components/icons";
import { ErrorNotice, Loading } from "../../../components/ui/Feedback";
import { formatColombo } from "../../../utils/time";
import { CompletenessBadge, StatusBadge } from "./parts";
import { batchPath, classifySearch, searchBatches, SEARCH_KIND_LABELS, type SearchTerm } from "./search";

type Outcome =
  | { status: "idle" }
  | { status: "searching" }
  | { status: "invalid"; message: string }
  | { status: "failed"; message: string }
  | { status: "done"; term: SearchTerm; batches: BatchSummaryDto[] };

// Find a batch by its ID, its MCC dispatch reference or factory intake's WR- reference (SCRUM-137).
// The term is kept in the URL, so coming back from a batch shows the same results.
export function BatchSearchScreen() {
  const { session } = useSession();
  const { query, replace, navigate } = useNavigation();
  const token = session?.accessToken ?? null;

  const initial = query.get("q") ?? "";
  const [term, setTerm] = useState(initial);
  // A term in the URL is searched for on arrival, so the screen starts out searching for it.
  const [outcome, setOutcome] = useState<Outcome>(() =>
    initial.trim() === "" || "error" in classifySearch(initial) ? { status: "idle" } : { status: "searching" },
  );
  const controller = useRef<AbortController | null>(null);

  const lookUp = async (parsed: SearchTerm, openSingle: boolean) => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;

    try {
      const batches = await searchBatches(parsed, token, current.signal);

      if (current.signal.aborted) {
        return;
      }

      // Only straight after a search: opening the batch again on the way back would trap the
      // officer on it.
      if (openSingle && batches.length === 1) {
        navigate(batchPath(batches[0].batchId));
        return;
      }

      setOutcome({ status: "done", term: parsed, batches });
    } catch (error: unknown) {
      if (!current.signal.aborted) {
        setOutcome({
          status: "failed",
          message: error instanceof ApiError ? error.message : "The search could not be run. Try again.",
        });
      }
    }
  };

  // Searches for the term the URL came with, on arrival only; later searches come from the form.
  useEffect(() => {
    const parsed = classifySearch(initial);

    if (!("error" in parsed)) {
      void lookUp(parsed, false);
    }

    return () => controller.current?.abort();
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- once, for the term the screen opened with
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();

    if (outcome.status === "searching") {
      return;
    }

    const parsed = classifySearch(term);

    if ("error" in parsed) {
      setOutcome({ status: "invalid", message: parsed.error });
      return;
    }

    replace(`/qco/batches?q=${encodeURIComponent(parsed.value)}`);
    setOutcome({ status: "searching" });
    void lookUp(parsed, true);
  };

  return (
    <>
      <header className="pagehead">
        <h1 className="pagehead__title">Find a batch</h1>
        <p className="pagehead__detail">Open its timeline, then trace it back to the tanks and societies.</p>
      </header>

      <form className="batchsearch" role="search" aria-label="Find a batch" onSubmit={submit} noValidate>
        <label className="field__label" htmlFor="batch-search">
          Batch ID, dispatch reference or WR- batch reference
        </label>
        <div className="batchsearch__row">
          <div className="search">
            <SearchIcon className="search__icon" />
            <input
              id="batch-search"
              type="search"
              value={term}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="262-FM-B, DN-20260919-02, WR-20260919-02"
              onChange={(event) => setTerm(event.target.value)}
            />
          </div>
          <button type="submit" className="button" disabled={outcome.status === "searching"}>
            Search
          </button>
        </div>
      </form>

      <Results outcome={outcome} onOpen={(batchId) => navigate(batchPath(batchId))} />
    </>
  );
}

function Results({ outcome, onOpen }: { outcome: Outcome; onOpen: (batchId: string) => void }) {
  switch (outcome.status) {
    case "idle":
      return null;
    case "searching":
      return <Loading label="Searching..." />;
    case "invalid":
    case "failed":
      return <ErrorNotice>{outcome.message}</ErrorNotice>;
  }

  const { term, batches } = outcome;

  // No match is an answer, not a failure: said plainly, without the error styling.
  if (batches.length === 0) {
    return (
      <p className="notice notice--info" role="status">
        No batch matches the {SEARCH_KIND_LABELS[term.kind]} {term.value}. Check it and search again.
      </p>
    );
  }

  return (
    <section className="batchresults" aria-label="Matching batches">
      <p className="batchresults__count" role="status">
        {batches.length === 1
          ? `1 batch matches ${term.value}.`
          : `${batches.length} batches match ${term.value}: one dispatch can be split across several batches.`}
      </p>
      <ul className="batchresults__list">
        {batches.map((batch) => (
          <li key={batch.batchId}>
            <button type="button" className="batchresult" onClick={() => onOpen(batch.batchId)}>
              <span className="batchresult__main">
                <span className="batchresult__id">{batch.batchId}</span>
                <span className="batchresult__meta">
                  {batch.productLine} · {batch.facility} · {formatColombo(batch.firstEventAt)}
                </span>
                <span className="batchresult__badges">
                  <StatusBadge batch={batch} />
                  <CompletenessBadge completeness={batch.completeness} />
                </span>
              </span>
              <ChevronRightIcon width={18} height={18} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
