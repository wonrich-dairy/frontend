import { request } from "../http";

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

export interface BatchLookup {
  dispatchRef?: string;
  batchReference?: string;
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
