import { useEffect, useState, type FormEvent } from "react";
import { ApiError } from "../../../api/http";
import {
  getAuditPage,
  type AuditTrailEntryDto,
  type AuditTrailFilters,
  type AuditTrailPageDto,
} from "../../../api/traceability/audit";
import type { BatchCheckpoint } from "../../../api/traceability/batches";
import { useNavigation } from "../../../app/navigationStore";
import { useSession } from "../../../auth/sessionStore";
import { ErrorNotice, Loading } from "../../../components/ui/Feedback";
import { formatColombo } from "../../../utils/time";
import { Pager } from "../batches/parts";
import { CHECKPOINT_LABELS, humanise } from "../batches/trace";

const AUDIT_PATH = "/qco/audit";
const MAX_TEXT_LENGTH = 100;

interface AuditFilters {
  user: string;
  action: string;
  from: string;
  to: string;
  batchId: string;
}

type PageLoad =
  | { status: "loading" }
  | { status: "failed"; message: string }
  | { status: "done"; page: AuditTrailPageDto };

const CHECKPOINT_NAMES: Record<BatchCheckpoint, string> = CHECKPOINT_LABELS;
const SOURCE_NAMES = {
  ConsumedEvent: "Event",
  UpstreamSnapshot: "Upstream snapshot",
  Traceability: "Traceability",
} as const;

function filtersFromQuery(query: URLSearchParams): { filters: AuditFilters; page: number } {
  const text = (key: "user" | "action" | "batchId") => {
    const value = (query.get(key) ?? "").trim();
    return value.length <= MAX_TEXT_LENGTH ? value : "";
  };
  const from = query.get("from") ?? "";
  const to = query.get("to") ?? "";

  return {
    filters: {
      user: text("user"),
      action: text("action"),
      from: validDate(from) ? from : "",
      to: validDate(to) ? to : "",
      batchId: text("batchId"),
    },
    page: Math.max(1, Number.isInteger(Number(query.get("page"))) ? Number(query.get("page")) : 1),
  };
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function toQuery(filters: AuditFilters, page = 1): string {
  const query = new URLSearchParams();
  for (const key of ["user", "action", "from", "to", "batchId"] as const) {
    const value = filters[key].trim();
    if (value) query.set(key, value);
  }
  if (page > 1) query.set("page", String(page));
  const text = query.toString();
  return text ? `?${text}` : "";
}

function toRequest(filters: AuditFilters): AuditTrailFilters {
  const request: AuditTrailFilters = {};
  for (const key of ["user", "action", "from", "to", "batchId"] as const) {
    const value = filters[key].trim();
    if (value) request[key] = value;
  }
  return request;
}

function dateRangeError(filters: AuditFilters): string | null {
  if ((filters.from && !validDate(filters.from)) || (filters.to && !validDate(filters.to))) {
    return "Enter a valid date.";
  }
  if (filters.from && filters.to && filters.from > filters.to) {
    return "The start date must be on or before the end date.";
  }
  return null;
}

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : "The audit trail could not be loaded. Try again.";
}

export function AuditTrailScreen() {
  const { query, replace } = useNavigation();
  const { session } = useSession();
  const { filters, page } = filtersFromQuery(query);
  const token = session?.accessToken ?? null;
  const applied = toQuery(filters, page);

  return (
    <>
      <header className="pagehead">
        <h1 className="pagehead__title">Audit trail</h1>
        <p className="pagehead__detail">
          Who recorded or did what, and when, across the facility. This read-only trail shows events received by this
          service.
        </p>
      </header>

      <AuditFilterForm
        key={`form${applied}`}
        applied={filters}
        onApply={(next) => replace(`${AUDIT_PATH}${toQuery(next)}`)}
      />
      <AuditResults
        key={`results${applied}`}
        filters={filters}
        page={page}
        token={token}
        onPage={(next) => replace(`${AUDIT_PATH}${toQuery(filters, next)}`)}
      />
    </>
  );
}

function AuditFilterForm({
  applied,
  onApply,
}: {
  applied: AuditFilters;
  onApply: (filters: AuditFilters) => void;
}) {
  const [draft, setDraft] = useState(applied);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<AuditFilters>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setError(null);
  };
  const textField = (key: "user" | "action" | "batchId", label: string, placeholder: string) => (
    <label className="field">
      <span className="field__label">{label}</span>
      <input
        type="text"
        value={draft[key]}
        placeholder={placeholder}
        maxLength={MAX_TEXT_LENGTH}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => set({ [key]: event.target.value })}
      />
    </label>
  );
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const problem = dateRangeError(draft);
    if (problem) {
      setError(problem);
      return;
    }
    onApply(draft);
  };

  return (
    <form className="qcofilters batchfilters" onSubmit={submit} aria-label="Audit trail filters" noValidate>
      {textField("user", "User", "User ID")}
      {textField("action", "Action", "Any action")}
      <label className="field">
        <span className="field__label">From</span>
        <input type="date" value={draft.from} max={draft.to || undefined} onChange={(event) => set({ from: event.target.value })} />
      </label>
      <label className="field">
        <span className="field__label">To</span>
        <input type="date" value={draft.to} min={draft.from || undefined} onChange={(event) => set({ to: event.target.value })} />
      </label>
      {textField("batchId", "Batch ID", "e.g. 262-FM-B")}
      <div className="qcofilters__actions batchfilters__actions">
        {error ? <ErrorNotice>{error}</ErrorNotice> : null}
        <button type="submit" className="button">Show entries</button>
        <button type="button" className="button button--ghost" onClick={() => set({ user: "", action: "", from: "", to: "", batchId: "" })}>
          Clear filters
        </button>
      </div>
    </form>
  );
}

function AuditResults({
  filters,
  page,
  token,
  onPage,
}: {
  filters: AuditFilters;
  page: number;
  token: string | null;
  onPage: (page: number) => void;
}) {
  const { navigate } = useNavigation();
  const [load, setLoad] = useState<PageLoad>({ status: "loading" });
  const filterQuery = toQuery(filters);

  useEffect(() => {
    const controller = new AbortController();
    getAuditPage(toRequest(filters), page, token, controller.signal)
      .then((result) => setLoad({ status: "done", page: result }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setLoad({ status: "failed", message: messageOf(error) });
      });
    return () => controller.abort();
  }, [filterQuery, page, token]);

  if (load.status === "loading") return <Loading label="Loading the audit trail..." />;
  if (load.status === "failed") return <ErrorNotice>{load.message}</ErrorNotice>;

  const result = load.page;
  if (result.totalCount === 0) {
    return <p className="notice notice--info" role="status">{result.message ?? "No audit entries match these filters."}</p>;
  }
  if (result.items.length === 0) {
    return (
      <>
        <p className="notice notice--info" role="status">There is no page {result.page}; the results end at page {result.totalPages}.</p>
        <button type="button" className="linkbutton" onClick={() => onPage(1)}>Go to the first page</button>
      </>
    );
  }

  return (
    <section className="auditresults" aria-label="Audit entries">
      <p className="batchresults__count" role="status">
        {result.totalCount === 1 ? "1 entry" : `${(result.page - 1) * result.pageSize + 1}-${(result.page - 1) * result.pageSize + result.items.length} of ${result.totalCount} entries`}, newest first. Times are in Colombo.
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
            <th scope="col">Reference</th>
          </tr>
        </thead>
        <tbody>
          {result.items.map((entry) => (
            <AuditRow key={entry.id} entry={entry} onBatch={() => entry.batchId && navigate(`/qco/batches/${encodeURIComponent(entry.batchId)}`)} />
          ))}
        </tbody>
      </table>
      <Pager page={result.page} totalPages={result.totalPages} onPage={onPage} />
    </section>
  );
}

function AuditRow({ entry, onBatch }: { entry: AuditTrailEntryDto; onBatch: () => void }) {
  const checkpoint = entry.checkpoint ? CHECKPOINT_NAMES[entry.checkpoint] : null;
  return (
    <tr>
      <td data-label="When" className="audittable__when">{formatColombo(entry.occurredAt)}</td>
      <td data-label="User">{entry.user ?? <span className="audittable__missing">System</span>}</td>
      <td data-label="Action">
        <span className="audittable__action">{humanise(entry.action)}</span>
        <span className="audittable__detail">{entry.action}</span>
      </td>
      <td data-label="Checkpoint">{checkpoint ?? <span className="audittable__missing">None</span>}</td>
      <td data-label="Batch">
        {entry.batchId ? (
          <button type="button" className="linkbutton audittable__batch" onClick={onBatch}>{entry.batchId}</button>
        ) : <span className="audittable__missing">Several or none</span>}
      </td>
      <td data-label="Source">{SOURCE_NAMES[entry.source]}</td>
      <td data-label="Reference">{entry.reference ?? <span className="audittable__missing">None</span>}</td>
    </tr>
  );
}
