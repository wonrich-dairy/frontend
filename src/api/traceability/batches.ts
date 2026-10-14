import { download, request } from "../http";

// The unified batch record (SCRUM-133). Read-only, like the rest of the QCO module: GET only.

// ── Types ────────────────────────────────────────────────────────────────────

export type BatchStatus = "Chilling" | "Processing" | "OnHold" | "AwaitingLab" | "Cleared" | "Failed";

// Partial while a checkpoint has not reported or the upstream snapshot has not resolved.
export type TraceCompleteness = "Partial" | "Complete";

export type LabResult = "Pending" | "Cleared" | "Failed";

export type BatchCheckpoint = "Mcc" | "Intake" | "Processing" | "Lab";

// Recorded: the checkpoint has data. NotYetReached: no data, and the batch has not got that far.
// NoDataReceived: no data although the batch is past this point, so a gap in the trace.
export type CheckpointState = "Recorded" | "NotYetReached" | "NoDataReceived";

export type ResolutionStatus = "PendingRetry" | "Resolved" | "Unavailable";

export interface BatchSummaryDto {
  batchId: string;
  dispatchRef: string | null;
  batchReference: string | null;
  productLine: string;
  facility: string;
  status: BatchStatus;
  completeness: TraceCompleteness;
  firstEventAt: string;
  lastEventAt: string;
  labResult: LabResult;
}

export interface CheckpointRecordDto {
  // The upstream event type for Processing and Lab, or DispatchCreated, ConsignmentRegistered
  // or ArrivalScreened from the MCC and Intake snapshot.
  kind: string;
  occurredAt: string;
  // Null for an event raised by a system rather than a person.
  recordedBy: string | null;
  data: Record<string, unknown>;
  sourceEventId: string | null;
}

export interface DeviationDto {
  occurredAt: string;
  reasonCode: string | null;
  parameter: string | null;
  observedValue: number | null;
  limit: number | null;
  description: string | null;
}

export interface CheckpointSectionDto {
  checkpoint: BatchCheckpoint;
  state: CheckpointState;
  firstRecordedAt: string | null;
  lastRecordedAt: string | null;
  records: CheckpointRecordDto[];
  deviations: DeviationDto[];
}

export interface UpstreamStatusDto {
  status: ResolutionStatus;
  attemptCount: number;
  lastAttemptAt: string | null;
  resolvedAt: string | null;
  failureReason: string | null;
}

export interface SocietyLinkDto {
  code: string;
  name: string | null;
}

export interface ConsignmentLinkDto {
  reference: string;
  volumeLitres: number;
  society: SocietyLinkDto;
}

export interface TankLinkDto {
  code: string;
  quantityDrawnLitres: number;
  consignments: ConsignmentLinkDto[];
}

export interface DispatchLinkDto {
  reference: string;
  dispatchedAt: string;
  bowserRegistration: string | null;
  totalLitres: number;
}

export interface BatchLinksDto {
  dispatch: DispatchLinkDto;
  tanks: TankLinkDto[];
}

export interface BatchRecordDto extends BatchSummaryDto {
  // Null when the batch has no upstream snapshot row yet.
  upstream: UpstreamStatusDto | null;
  // Always four, in stage order: Mcc, Intake, Processing, Lab.
  checkpoints: CheckpointSectionDto[];
  // Null until the upstream snapshot resolves.
  links: BatchLinksDto | null;
}

// The backward trace (SCRUM-134). WithinSpec and Deviation: the checkpoint has data. MissingData:
// none although the batch is past it, a gap. NotYetReached: none, and the batch has not got there.
export type TraceCheckpointStatus = "WithinSpec" | "Deviation" | "MissingData" | "NotYetReached";

export interface TraceDeviationDto extends DeviationDto {
  checkpoint: BatchCheckpoint;
  sourceEventId: string;
}

export interface TraceCheckpointDto {
  checkpoint: BatchCheckpoint;
  status: TraceCheckpointStatus;
  firstRecordedAt: string | null;
  lastRecordedAt: string | null;
  // Why the data is missing, for MissingData. Null otherwise.
  missingReason: string | null;
  deviations: TraceDeviationDto[];
}

export interface TraceHoldDto {
  holdId: string;
  raisedAt: string;
  raisedBy: string | null;
  reason: string | null;
  failedParameter: string | null;
  failedValue: string | null;
  isOpen: boolean;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolution: string | null;
}

export interface BatchTraceDto extends BatchSummaryDto {
  hasDeviation: boolean;
  // The service picks the origin (the earliest checkpoint in stage order with a deviation), so
  // the rule lives in one place. Both null with no deviation.
  originCheckpoint: BatchCheckpoint | null;
  origin: TraceDeviationDto | null;
  // Always four, back from the lab: Lab, Processing, Intake, Mcc.
  chain: TraceCheckpointDto[];
  holds: TraceHoldDto[];
  links: BatchLinksDto | null;
  societies: SocietyLinkDto[];
}

export interface BatchLookup {
  dispatchRef?: string;
  batchReference?: string;
}

// ── Batch search and export (SCRUM-139) ─────────────────────────────────────

// Every filter is optional; the ones given must all match. Dates are factory days (Colombo) of
// the batch's first event. Society is a code or a name; society, tank and user ignore case.
export interface BatchSearchFilters {
  status?: BatchStatus;
  productLine?: string;
  from?: string;
  to?: string;
  society?: string;
  tank?: string;
  user?: string;
  reasonCode?: string;
}

// NotApplicable: the product line does not measure it (SNF and CLR on fermented lines, texture
// on liquid ones). Never left out of a row, so a gap is never mistaken for a missed test.
export type LabParameterState = "NotApplicable" | "Pending" | "NoDeviation" | "OutOfSpec";

export interface LabParameterDto {
  // FatPercent, Ph, SNF, CorrectedCLR or Texture, always in that order.
  parameter: string;
  state: LabParameterState;
  observedValue: number | null;
  limit: number | null;
}

export interface BatchSearchRowDto extends BatchSummaryDto {
  // Null when the batch has no snapshot row yet; tanks and societies are known once Resolved.
  upstreamStatus: ResolutionStatus | null;
  tanks: string[];
  societies: SocietyLinkDto[];
  users: string[];
  deviationCount: number;
  reasonCodes: string[];
  labParameters: LabParameterDto[];
}

export interface BatchSearchPageDto {
  // At most pageSize, newest first. A batch appears once however many filters it matches twice.
  items: BatchSearchRowDto[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  // Set when nothing matches: an answer to show as it is, not an error.
  message: string | null;
  filters: BatchSearchFilters;
}

export interface BatchExportFile {
  blob: Blob;
  fileName: string;
  batchCount: number;
}

// ── API calls ────────────────────────────────────────────────────────────────

// 404 when no batch carries that ID.
export function getBatch(batchId: string, token: string | null, signal?: AbortSignal) {
  return request<BatchRecordDto>(`/api/batches/${encodeURIComponent(batchId)}`, {
    token,
    signal,
    service: "traceability",
  });
}

// The backward trace. The service records each call as BatchTraceOpened in the audit trail
// (SCRUM-138), so the trace screen reads this rather than working the trace out from getBatch.
export function getBatchTrace(batchId: string, token: string | null, signal?: AbortSignal) {
  return request<BatchTraceDto>(`/api/batches/${encodeURIComponent(batchId)}/trace`, {
    token,
    signal,
    service: "traceability",
  });
}

// Always a list, oldest first: one dispatch can be split across several batches. No match is an
// empty list, not a 404.
export function findBatches(lookup: BatchLookup, token: string | null, signal?: AbortSignal) {
  const query = new URLSearchParams();

  if (lookup.dispatchRef) {
    query.set("dispatchRef", lookup.dispatchRef);
  }

  if (lookup.batchReference) {
    query.set("batchReference", lookup.batchReference);
  }

  return request<BatchSummaryDto[]>(`/api/batches?${query.toString()}`, {
    token,
    signal,
    service: "traceability",
  });
}

function searchQuery(filters: BatchSearchFilters): URLSearchParams {
  const query = new URLSearchParams();

  for (const [name, value] of Object.entries(filters)) {
    if (typeof value === "string" && value.trim() !== "") {
      query.set(name, value.trim());
    }
  }

  return query;
}

// One page of 50, newest first. No match is a 200 with a message; a bad filter is a 400 naming it.
export function searchBatchPage(filters: BatchSearchFilters, page: number, token: string | null, signal?: AbortSignal) {
  const query = searchQuery(filters);
  query.set("page", String(page));

  return request<BatchSearchPageDto>(`/api/batches/search?${query.toString()}`, {
    token,
    signal,
    service: "traceability",
  });
}

// Every matching batch as CSV, not only one page. The service names the file after the filters
// and the export date, and audits the export.
export async function exportBatches(filters: BatchSearchFilters, token: string | null, signal?: AbortSignal): Promise<BatchExportFile> {
  const query = searchQuery(filters).toString();
  const file = await download(`/api/batches/export${query ? `?${query}` : ""}`, { token, signal, service: "traceability" });

  return {
    blob: file.blob,
    fileName: file.fileName ?? "batches.csv",
    batchCount: Number(file.headers.get("X-Batch-Count") ?? 0),
  };
}
