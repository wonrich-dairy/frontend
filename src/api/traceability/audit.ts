import { request } from "../http";
import type { BatchCheckpoint } from "./batches";

// The consolidated audit trail (SCRUM-138). Read-only: the service has no endpoint to add, change
// or remove an entry, so neither does this.

// ── Types ────────────────────────────────────────────────────────────────────

// ConsumedEvent: an event Processing or Quality Lab sent. UpstreamSnapshot: a record in the batch's
// copy of what the MCC and Intake Service knows. Traceability: something done in this module, such
// as opening a batch or exporting.
export type AuditSource = "ConsumedEvent" | "UpstreamSnapshot" | "Traceability";

// Every filter is optional; the ones given must all match. User and action ignore case. Dates are
// factory days (Colombo) the entry happened on.
export interface AuditTrailFilters {
  user?: string;
  action?: string;
  from?: string;
  to?: string;
  batchId?: string;
}

export interface AuditTrailEntryDto {
  // Stable across requests, e.g. event-42 or audit-7.
  id: string;
  occurredAt: string;
  // Null when the upstream service recorded no user.
  user: string | null;
  action: string;
  // Null for Traceability's own actions.
  checkpoint: BatchCheckpoint | null;
  // Null for an export, which covers many batches.
  batchId: string | null;
  facility: string | null;
  source: AuditSource;
  // The upstream event ID, dispatch or consignment reference, batch opened, or export file name.
  reference: string | null;
  // Traceability's own entries only, e.g. an export's filters, row count and role.
  details?: Record<string, unknown>;
}

export interface AuditTrailPageDto {
  // At most pageSize, newest first.
  items: AuditTrailEntryDto[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  // Set when nothing matches: an answer to show as it is, not an error.
  message: string | null;
  filters: AuditTrailFilters;
}

export interface CoveredActionDto {
  action: string;
  checkpoint: BatchCheckpoint | null;
  source: AuditSource;
  description: string;
}

export interface UncoveredActionDto {
  action: string;
  reason: string;
}

export interface AuditCoverageDto {
  covered: CoveredActionDto[];
  notCovered: UncoveredActionDto[];
  // Where the same list is kept with the service's code.
  documentation: string;
}

// ── API calls ────────────────────────────────────────────────────────────────

// One page of 50, newest first. No match is a 200 with a message; a bad filter is a 400 naming it.
export function getAuditPage(filters: AuditTrailFilters, page: number, token: string | null, signal?: AbortSignal) {
  const query = new URLSearchParams();

  for (const [name, value] of Object.entries(filters)) {
    if (typeof value === "string" && value.trim() !== "") {
      query.set(name, value.trim());
    }
  }

  query.set("page", String(page));

  return request<AuditTrailPageDto>(`/api/audit?${query.toString()}`, {
    token,
    signal,
    service: "traceability",
  });
}

export function getAuditCoverage(token: string | null, signal?: AbortSignal) {
  return request<AuditCoverageDto>("/api/audit/coverage", {
    token,
    signal,
    service: "traceability",
  });
}
