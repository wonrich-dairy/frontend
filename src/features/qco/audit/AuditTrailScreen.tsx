import { useEffect, useId, useState, type FormEvent } from "react";
import { ApiError } from "../../../api/http";
import {
  getAuditCoverage,
  getAuditPage,
  type AuditTrailEntryDto,
  type AuditTrailPageDto,
  type CoveredActionDto,
} from "../../../api/traceability/audit";
import { useNavigation } from "../../../app/navigationStore";
import { useSession } from "../../../auth/sessionStore";
import { ChevronRightIcon } from "../../../components/icons";
import { ErrorNotice, Loading } from "../../../components/ui/Feedback";
import { formatColombo } from "../../../utils/time";
import { Pager } from "../batches/parts";
import { batchPath } from "../batches/search";
import { CHECKPOINT_LABELS, humanise } from "../batches/trace";
import {
  AUDIT_PATH,
  auditFilterError,
  auditFiltersFromQuery,
  auditFiltersToQuery,
  describeAuditPage,
  emptyAuditFilters,
  entryDetail,
  hasAuditFilters,
  MAX_TEXT_LENGTH,
  SOURCE_LABELS,
  toAuditRequest,
  type AuditFilters,
} from "./filters";

type PageLoad =
  | { status: "loading" }
  | { status: "failed"; message: string }
  | { status: "done"; page: AuditTrailPageDto };

function messageOf(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

// The consolidated audit trail (SCRUM-138): who recorded or did what, and when, across every
// facility, newest first. Read only: there is nothing here to change or remove an entry. The
// filters and page live in the URL, so the trail opens on its first page and coming back from a
// batch shows the same entries.
export function AuditTrailScreen() {
  const { query, replace } = useNavigation();
  const { filters, page } = auditFiltersFromQuery(query);
  const applied = auditFiltersToQuery(filters, page);
  const actions = useCoveredActions();

  return (
    <>
      <header className="pagehead">
        <h1 className="pagehead__title">Audit trail</h1>
        <p className="pagehead__detail">
          Who recorded or did what, and when, across every facility. Built from the events this service receives, so an
          action done in another service without an event is not here.
        </p>
      </header>

      {/* Both keyed on the applied search: back and forward reset the form to what is shown, and
          each search or page is fetched once. Prefixed, since siblings need different keys. */}
      <AuditFilterForm
        key={`form${applied}`}
        applied={filters}
        actions={actions}
        onApply={(next) => replace(`${AUDIT_PATH}${auditFiltersToQuery(next, 1)}`)}
      />

      <AuditResults
        key={`results${applied}`}
        filters={filters}
        page={page}
        onPage={(next) => replace(`${AUDIT_PATH}${auditFiltersToQuery(filters, next)}`)}
      />
    </>
  );
}

// The actions the trail can show, for the action filter's suggestions. Only a convenience: if the
// list cannot be read, the filter still takes any action typed.
function useCoveredActions(): CoveredActionDto[] {
  const { session } = useSession();
  const token = session?.accessToken ?? null;
  const [actions, setActions] = useState<CoveredActionDto[]>([]);

  useEffect(() => {
    const controller = new AbortController();

    getAuditCoverage(token, controller.signal)
      .then((coverage) => setActions(coverage.covered))
      .catch(() => {});

    return () => controller.abort();
  }, [token]);

  return actions;
}

function AuditFilterForm({
  applied,
  actions,
  onApply,
}: {
  applied: AuditFilters;
  actions: CoveredActionDto[];
  onApply: (filters: AuditFilters) => void;
}) {
  const [draft, setDraft] = useState(applied);
  const [error, setError] = useState<string | null>(null);
  const actionListId = useId();

  const set = (patch: Partial<AuditFilters>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setError(null);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const problem = auditFilterError(draft);

    if (problem) {
      setError(problem);
      return;
    }

    onApply(draft);
  };

  const text = (key: "user" | "batchId", label: string, placeholder: string) => (
    <label className="field">
      <span className="field__label">{label}</span>
      <input
        type="text"
        value={draft[key]}
        placeholder={placeholder}
        maxLength={MAX_TEXT_LENGTH}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => set({ [key]: event.target.value } as Partial<AuditFilters>)}
      />
    </label>
  );

  // noValidate: auditFilterError gives the date message, so it reads the same in every browser.
  return (
    <form className="qcofilters batchfilters" onSubmit={submit} aria-label="Audit trail filters" noValidate>
      {text("user", "User", "User ID, e.g. proc.tech-1")}

      <label className="field">
        <span className="field__label">Action</span>
        <input
          type="text"
          list={actionListId}
          value={draft.action}
          placeholder="Any action, e.g. ProcessingHoldRaised"
          maxLength={MAX_TEXT_LENGTH}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => set({ action: event.target.value })}
        />
      </label>
      {/* Outside the label, so its options are not read as part of the field's name. */}
      <datalist id={actionListId}>
        {actions.map((covered) => (
          <option key={covered.action} value={covered.action}>
            {humanise(covered.action)}
          </option>
        ))}
      </datalist>

      <label className="field">
        <span className="field__label">From</span>
        <input type="date" value={draft.from} max={draft.to || undefined} onChange={(event) => set({ from: event.target.value })} />
      </label>

      <label className="field">
        <span className="field__label">To</span>
        <input type="date" value={draft.to} min={draft.from || undefined} onChange={(event) => set({ to: event.target.value })} />
      </label>

      {text("batchId", "Batch ID", "e.g. 262-FM-B")}

      <div className="qcofilters__actions batchfilters__actions">
        {error ? <ErrorNotice>{error}</ErrorNotice> : null}
        <button type="submit" className="button">
          Show entries
        </button>
        <button type="button" className="button button--ghost" onClick={() => set(emptyAuditFilters())}>
          Clear filters
        </button>
      </div>
    </form>
  );
}

function AuditResults({ filters, page, onPage }: { filters: AuditFilters; page: number; onPage: (page: number) => void }) {
  const { session } = useSession();
  const { navigate } = useNavigation();
  const token = session?.accessToken ?? null;
  const [load, setLoad] = useState<PageLoad>({ status: "loading" });

  // Keyed on the applied search by the parent, so this runs once per search and page.
  useEffect(() => {
    const controller = new AbortController();

    getAuditPage(toAuditRequest(filters), page, token, controller.signal)
      .then((result) => setLoad({ status: "done", page: result }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setLoad({ status: "failed", message: messageOf(error, "The audit trail could not be loaded. Try again.") });
        }
      });

    return () => controller.abort();
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- once per applied search; the parent keys this on it
  }, []);

  if (load.status === "loading") {
    return <Loading label="Loading the audit trail..." />;
  }

  if (load.status === "failed") {
    return <ErrorNotice>{load.message}</ErrorNotice>;
  }

  const result = load.page;

  // No match is an answer, not a failure: the service's message, without the error styling.
  if (result.totalCount === 0) {
    return (
      <p className="notice notice--info" role="status">
        {result.message ?? (hasAuditFilters(filters) ? "No audit entries match these filters." : "The audit trail is empty.")}
      </p>
    );
  }

  if (result.items.length === 0) {
    return (
      <>
        <p className="notice notice--info" role="status">
          There is no page {result.page}; the entries end at page {result.totalPages}.
        </p>
        <button type="button" className="linkbutton" onClick={() => onPage(1)}>
          Go to the first page
        </button>
      </>
    );
  }

  return (
    <section className="auditresults" aria-label="Audit entries">
      <p className="batchresults__count" role="status">
        {describeAuditPage(result.page, result.pageSize, result.items.length, result.totalCount)} Times are in Colombo.
      </p>

      <table className="audittable">
        <thead>
          <tr>
            <th scope="col">When</th>
            <th scope="col">User</th>
            <th scope="col">Action</th>
            <th scope="col">Checkpoint</th>
            <th scope="col">Batch</th>
            <th scope="col">Source</th>
          </tr>
        </thead>
        <tbody>
          {result.items.map((entry) => (
            <AuditRow key={entry.id} entry={entry} onOpenBatch={(batchId) => navigate(batchPath(batchId))} />
          ))}
        </tbody>
      </table>

      <Pager page={result.page} totalPages={result.totalPages} onPage={onPage} />
    </section>
  );
}

// No cell is left blank: a value the source did not record says so, so a gap is never mistaken
// for a missing column.
function AuditRow({ entry, onOpenBatch }: { entry: AuditTrailEntryDto; onOpenBatch: (batchId: string) => void }) {
  const detail = entryDetail(entry);
  const { batchId } = entry;

  return (
    <tr>
      <td data-label="When" className="audittable__when">
        {formatColombo(entry.occurredAt)}
      </td>
      <td data-label="User" className={entry.user === null ? "audittable__missing" : undefined}>
        {entry.user ?? "Not recorded"}
      </td>
      <td data-label="Action">
        <span className="audittable__action">{humanise(entry.action)}</span>
        {detail ? <span className="audittable__detail">{detail}</span> : null}
      </td>
      <td data-label="Checkpoint" className={entry.checkpoint === null ? "audittable__missing" : undefined}>
        {entry.checkpoint === null ? "None" : CHECKPOINT_LABELS[entry.checkpoint]}
      </td>
      <td data-label="Batch">
        {batchId === null ? (
          <span className="audittable__missing">{entry.source === "Traceability" ? "Several batches" : "None"}</span>
        ) : (
          <button type="button" className="linkbutton audittable__batch" onClick={() => onOpenBatch(batchId)}>
            {batchId}
            <ChevronRightIcon width={14} height={14} />
          </button>
        )}
        {entry.facility ? <span className="audittable__detail">{entry.facility}</span> : null}
      </td>
      <td data-label="Source">{SOURCE_LABELS[entry.source]}</td>
    </tr>
  );
}
