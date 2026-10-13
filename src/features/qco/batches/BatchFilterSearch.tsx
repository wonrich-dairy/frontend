import { useEffect, useId, useState, type FormEvent } from "react";
import { REASON_CODES } from "../../../api/qualityLab/determinations";
import { ApiError } from "../../../api/http";
import {
  exportBatches,
  searchBatchPage,
  type BatchSearchPageDto,
  type BatchSearchRowDto,
} from "../../../api/traceability/batches";
import { PRODUCT_LINES, type ProductLine } from "../../../api/traceability/dashboard";
import { useNavigation } from "../../../app/navigationStore";
import { useSession } from "../../../auth/sessionStore";
import { ChevronRightIcon, DownloadIcon } from "../../../components/icons";
import { ErrorNotice, Loading } from "../../../components/ui/Feedback";
import { formatColombo } from "../../../utils/time";
import { saveFile } from "../../../utils/saveFile";
import {
  BATCH_STATUSES,
  describePage,
  emptyFilters,
  filtersFromQuery,
  filtersToQuery,
  hasFilterSearch,
  rangeError,
  toRequestFilters,
  type BatchFilters,
} from "./filters";
import { CompletenessBadge, Pager, StatusBadge } from "./parts";
import { batchPath } from "./search";
import { STATUS_LABELS } from "./trace";

type PageLoad =
  | { status: "loading" }
  | { status: "failed"; message: string }
  | { status: "done"; page: BatchSearchPageDto };

const SEARCH_PATH = "/qco/batches";

function messageOf(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

// Filter batches by status, product line, dates, society, tank, user and reason, page through
// them and export every match as CSV (SCRUM-139). The filters and page live in the URL; nothing is
// searched until the officer applies them.
export function BatchFilterSearch() {
  const { query, replace } = useNavigation();
  const active = hasFilterSearch(query);
  const { filters, page } = filtersFromQuery(query);
  // The applied search, as a string: the form and the fetch both follow it.
  const applied = filtersToQuery(filters, page);

  return (
    <section className="batchfilter" aria-labelledby="batch-filter-title">
      <header className="batchfilter__head">
        <h2 id="batch-filter-title" className="batchfilter__title">
          Filter batches
        </h2>
        <p className="pagehead__detail">By status, product line, dates, society, tank, user or reason. Export what you find as CSV.</p>
      </header>

      {/* Both keyed on the applied search: back and forward reset the form to what is shown, and
          each search or page is fetched once. Prefixed, since siblings need different keys. */}
      <FilterForm
        key={`form${applied}`}
        applied={filters}
        onApply={(next) => replace(`${SEARCH_PATH}${filtersToQuery(next, 1)}`)}
      />

      {active ? (
        <FilterResults
          key={`results${applied}`}
          filters={filters}
          page={page}
          onPage={(next) => replace(`${SEARCH_PATH}${filtersToQuery(filters, next)}`)}
        />
      ) : null}
    </section>
  );
}

function FilterForm({ applied, onApply }: { applied: BatchFilters; onApply: (filters: BatchFilters) => void }) {
  const [draft, setDraft] = useState(applied);
  const [error, setError] = useState<string | null>(null);
  const reasonListId = useId();

  const set = (patch: Partial<BatchFilters>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setError(null);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const problem = rangeError(draft);

    if (problem) {
      setError(problem);
      return;
    }

    onApply(draft);
  };

  const text = (key: "society" | "tank" | "user", label: string, placeholder: string) => (
    <label className="field">
      <span className="field__label">{label}</span>
      <input
        type="text"
        value={draft[key]}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => set({ [key]: event.target.value } as Partial<BatchFilters>)}
      />
    </label>
  );

  // noValidate: rangeError gives the date message, so it reads the same in every browser.
  return (
    <form className="qcofilters batchfilters" onSubmit={submit} aria-label="Batch filters" noValidate>
      <label className="field">
        <span className="field__label">Status</span>
        <select value={draft.status} onChange={(event) => set({ status: event.target.value as BatchFilters["status"] })}>
          <option value="">All statuses</option>
          {BATCH_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span className="field__label">Product line</span>
        <select value={draft.productLine} onChange={(event) => set({ productLine: event.target.value as ProductLine | "" })}>
          <option value="">All lines</option>
          {PRODUCT_LINES.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span className="field__label">From</span>
        <input type="date" value={draft.from} max={draft.to || undefined} onChange={(event) => set({ from: event.target.value })} />
      </label>

      <label className="field">
        <span className="field__label">To</span>
        <input type="date" value={draft.to} min={draft.from || undefined} onChange={(event) => set({ to: event.target.value })} />
      </label>

      {text("society", "Society", "Code or name, e.g. VS001")}
      {text("tank", "Tank", "e.g. T1")}
      {text("user", "User", "User ID")}

      <label className="field">
        <span className="field__label">Reason</span>
        <input
          type="text"
          list={reasonListId}
          value={draft.reasonCode}
          placeholder="Any reason, e.g. LOW_FAT"
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => set({ reasonCode: event.target.value })}
        />
        <datalist id={reasonListId}>
          {REASON_CODES.map((reason) => (
            <option key={reason.code} value={reason.code}>
              {reason.label}
            </option>
          ))}
        </datalist>
      </label>

      <div className="qcofilters__actions batchfilters__actions">
        {error ? <ErrorNotice>{error}</ErrorNotice> : null}
        <button type="submit" className="button">
          Show batches
        </button>
        <button type="button" className="button button--ghost" onClick={() => set(emptyFilters())}>
          Clear filters
        </button>
      </div>
    </form>
  );
}

function FilterResults({ filters, page, onPage }: { filters: BatchFilters; page: number; onPage: (page: number) => void }) {
  const { session } = useSession();
  const { navigate } = useNavigation();
  const token = session?.accessToken ?? null;
  const [load, setLoad] = useState<PageLoad>({ status: "loading" });

  // Keyed on the applied search by the parent, so this runs once per search and page.
  useEffect(() => {
    const controller = new AbortController();

    searchBatchPage(toRequestFilters(filters), page, token, controller.signal)
      .then((result) => setLoad({ status: "done", page: result }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setLoad({ status: "failed", message: messageOf(error, "The batches could not be loaded. Try again.") });
        }
      });

    return () => controller.abort();
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- once per applied search; the parent keys this on it
  }, []);

  if (load.status === "loading") {
    return <Loading label="Searching..." />;
  }

  if (load.status === "failed") {
    return <ErrorNotice>{load.message}</ErrorNotice>;
  }

  const result = load.page;

  // No match is an answer, not a failure: the service's message, without the error styling.
  if (result.totalCount === 0) {
    return (
      <p className="notice notice--info" role="status">
        {result.message ?? "No batches match these filters."}
      </p>
    );
  }

  if (result.items.length === 0) {
    return (
      <>
        <p className="notice notice--info" role="status">
          There is no page {result.page}; the results end at page {result.totalPages}.
        </p>
        <button type="button" className="linkbutton" onClick={() => onPage(1)}>
          Go to the first page
        </button>
      </>
    );
  }

  return (
    <section className="batchresults" aria-label="Filtered batches">
      <div className="batchresults__bar">
        <p className="batchresults__count" role="status">
          {describePage(result.page, result.pageSize, result.items.length, result.totalCount)}
        </p>
        <ExportButton filters={filters} total={result.totalCount} />
      </div>

      <ul className="batchresults__list">
        {result.items.map((batch) => (
          <li key={batch.batchId}>
            <FilteredBatch batch={batch} onOpen={() => navigate(batchPath(batch.batchId))} />
          </li>
        ))}
      </ul>

      <Pager page={result.page} totalPages={result.totalPages} onPage={onPage} />
    </section>
  );
}

function FilteredBatch({ batch, onOpen }: { batch: BatchSearchRowDto; onOpen: () => void }) {
  const upstream =
    batch.upstreamStatus === "Resolved"
      ? [
          batch.tanks.length > 0 ? `Tanks ${batch.tanks.join(", ")}` : null,
          batch.societies.length > 0 ? `Societies ${batch.societies.map((s) => s.code).join(", ")}` : null,
        ].filter(Boolean).join(" · ")
      : "Tanks and societies not resolved";

  return (
    <button type="button" className="batchresult" onClick={onOpen}>
      <span className="batchresult__main">
        <span className="batchresult__id">{batch.batchId}</span>
        <span className="batchresult__meta">
          {batch.productLine} · {batch.facility} · {formatColombo(batch.firstEventAt)}
        </span>
        <span className="batchresult__badges">
          <StatusBadge batch={batch} />
          <CompletenessBadge completeness={batch.completeness} />
        </span>
        {upstream ? <span className="batchresult__meta">{upstream}</span> : null}
        {batch.reasonCodes.length > 0 ? (
          <span className="batchresult__meta batchresult__reasons">Reasons {batch.reasonCodes.join(", ")}</span>
        ) : null}
      </span>
      <ChevronRightIcon width={18} height={18} />
    </button>
  );
}

type ExportState = { status: "idle" } | { status: "exporting" } | { status: "done"; message: string } | { status: "failed"; message: string };

// Every match, not only this page. The service writes the file, names it after the filters and
// the date, and audits the export; this only asks for it and hands it to the browser.
function ExportButton({ filters, total }: { filters: BatchFilters; total: number }) {
  const { session } = useSession();
  const token = session?.accessToken ?? null;
  const [state, setState] = useState<ExportState>({ status: "idle" });

  const run = async () => {
    setState({ status: "exporting" });

    try {
      const file = await exportBatches(toRequestFilters(filters), token);
      saveFile(file.blob, file.fileName);
      const count = file.batchCount === 1 ? "1 batch" : `${file.batchCount} batches`;
      setState({ status: "done", message: `Exported ${count} to ${file.fileName}.` });
    } catch (error: unknown) {
      setState({ status: "failed", message: messageOf(error, "The export could not be made. Try again.") });
    }
  };

  return (
    <div className="batchexport">
      <button
        type="button"
        className="button button--ghost button--small batchexport__button"
        disabled={state.status === "exporting"}
        onClick={() => void run()}
      >
        <DownloadIcon />
        {state.status === "exporting" ? "Exporting..." : `Export ${total === 1 ? "1 batch" : `all ${total}`} to CSV`}
      </button>
      {state.status === "done" ? (
        <p className="batchexport__done" role="status">
          {state.message}
        </p>
      ) : null}
      {state.status === "failed" ? <ErrorNotice>{state.message}</ErrorNotice> : null}
    </div>
  );
}
