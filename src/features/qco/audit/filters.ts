import type { AuditSource, AuditTrailEntryDto, AuditTrailFilters } from "../../../api/traceability/audit";
import { isValidDate } from "../dashboard/filters";
import { rangeError } from "../batches/filters";

// The audit trail (SCRUM-138) keeps its filters and page in the URL, so coming back from a batch,
// refreshing or sharing the link shows the same entries. Pure, with the labels both audit screens
// use: the screens only read and write the query string and render.

export interface AuditFilters {
  user: string;
  action: string;
  from: string;
  to: string;
  batchId: string;
}

export const AUDIT_PATH = "/qco/audit";

const TEXT_KEYS = ["user", "action", "batchId"] as const;

// The service refuses longer text, so the form says so before asking.
export const MAX_TEXT_LENGTH = 100;

export { rangeError };

export function emptyAuditFilters(): AuditFilters {
  return { user: "", action: "", from: "", to: "", batchId: "" };
}

// Anything unreadable in a hand-edited link is dropped rather than failing the page.
export function auditFiltersFromQuery(query: URLSearchParams): { filters: AuditFilters; page: number } {
  const from = query.get("from") ?? "";
  const to = query.get("to") ?? "";
  const page = Number(query.get("page") ?? 1);

  const filters: AuditFilters = {
    ...emptyAuditFilters(),
    from: isValidDate(from) ? from : "",
    to: isValidDate(to) ? to : "",
  };

  for (const key of TEXT_KEYS) {
    const value = (query.get(key) ?? "").trim();
    filters[key] = value.length <= MAX_TEXT_LENGTH ? value : "";
  }

  if (rangeError(filters)) {
    filters.from = "";
    filters.to = "";
  }

  return { filters, page: Number.isInteger(page) && page >= 1 ? page : 1 };
}

// Only the filters given go in the URL; page 1 is left out, so the plain path is the first page.
export function auditFiltersToQuery(filters: AuditFilters, page = 1): string {
  const query = new URLSearchParams();

  for (const [name, value] of Object.entries(toAuditRequest(filters))) {
    if (value) {
      query.set(name, value);
    }
  }

  if (page > 1) {
    query.set("page", String(page));
  }

  const text = query.toString();
  return text ? `?${text}` : "";
}

export function toAuditRequest(filters: AuditFilters): AuditTrailFilters {
  const request: AuditTrailFilters = {};

  // In form order, so the URL reads as the form does.
  for (const key of ["user", "action", "from", "to", "batchId"] as const) {
    const value = filters[key].trim();

    if (value) {
      request[key] = value;
    }
  }

  return request;
}

// The dates first, as the batch search checks them, then any text too long to be a stored value.
export function auditFilterError(filters: AuditFilters): string | null {
  const range = rangeError(filters);

  if (range) {
    return range;
  }

  const labels: Record<(typeof TEXT_KEYS)[number], string> = { user: "User", action: "Action", batchId: "Batch ID" };
  const tooLong = TEXT_KEYS.find((key) => filters[key].trim().length > MAX_TEXT_LENGTH);

  return tooLong ? `${labels[tooLong]} can be at most ${MAX_TEXT_LENGTH} characters.` : null;
}

export function hasAuditFilters(filters: AuditFilters): boolean {
  return Object.keys(toAuditRequest(filters)).length > 0;
}

// "Showing 51–100 of 123 entries, newest first."
export function describeAuditPage(page: number, pageSize: number, shown: number, total: number): string {
  const first = (page - 1) * pageSize + 1;
  const noun = total === 1 ? "entry" : "entries";

  return shown === total ? `${total} ${noun}, newest first.` : `Showing ${first}–${first + shown - 1} of ${total} ${noun}, newest first.`;
}

export const SOURCE_LABELS: Record<AuditSource, string> = {
  ConsumedEvent: "Event",
  UpstreamSnapshot: "Upstream snapshot",
  Traceability: "Traceability",
};

// What identifies the record at its source, and for an export, how much it held.
export function entryDetail(entry: AuditTrailEntryDto): string | null {
  const rowCount = entry.details?.rowCount;
  const rows = typeof rowCount === "number" ? ` (${rowCount === 1 ? "1 batch" : `${rowCount} batches`})` : "";

  switch (entry.source) {
    case "ConsumedEvent":
      return entry.reference ? `Event ${entry.reference}` : null;
    case "UpstreamSnapshot":
      return entry.reference;
    case "Traceability":
      // The reference of an opened batch is the batch itself, already in its own column.
      return entry.batchId === null && entry.reference ? `${entry.reference}${rows}` : null;
  }
}
