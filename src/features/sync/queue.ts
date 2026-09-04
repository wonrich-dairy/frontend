import type { AlcoholStage, KqColour, StageOutcome } from "../../api/qualityTests";

export type QueuedKind = "RegisterConsignment" | "RecordQualityTest" | "PourToTank";

export type QueuedStatus = "pending" | "failed";

export interface QueuedConsignment {
  societyId: string;
  cans: { canNumber: number; quantityKg: number }[];
  arrivalAtLocal?: string;
}

export interface QueuedQualityTest {
  consignmentReference: string;
  fatPercent: number;
  rawLactometerReading: number;
  temperatureCelsius: number;
  waterPercent: number;
  kqColour: KqColour;
  alcoholOutcomes: Partial<Record<AlcoholStage, StageOutcome>>;
  verdict: "Accept" | "Reject";
  failedParameter?: string;
  failedValue?: string;
}

export interface QueuedPour {
  tankCode: string;
  consignmentReference: string;
}

export interface QueuedRecord {
  clientRecordId: string;
  sequence: number;
  kind: QueuedKind;
  summary: string;
  createdAt: string;
  status: QueuedStatus;
  error?: string;
  consignment?: QueuedConsignment;
  qualityTest?: QueuedQualityTest;
  pour?: QueuedPour;
}

export interface SyncQueue {
  nextSequence: number;
  records: QueuedRecord[];
}

export const emptyQueue = (): SyncQueue => ({ nextSequence: 1, records: [] });

export type NewRecord = Omit<
  QueuedRecord,
  "clientRecordId" | "sequence" | "createdAt" | "status" | "error"
>;

export function enqueue(queue: SyncQueue, record: NewRecord, now = new Date()): SyncQueue {
  const queued: QueuedRecord = {
    ...record,
    clientRecordId: newRecordId(),
    sequence: queue.nextSequence,
    createdAt: now.toISOString(),
    status: "pending",
  };

  return {
    nextSequence: queue.nextSequence + 1,
    records: [...queue.records, queued],
  };
}

export function pending(queue: SyncQueue): QueuedRecord[] {
  return queue.records
    .filter((record) => record.status === "pending")
    .sort((a, b) => a.sequence - b.sequence);
}

export function failed(queue: SyncQueue): QueuedRecord[] {
  return queue.records
    .filter((record) => record.status === "failed")
    .sort((a, b) => a.sequence - b.sequence);
}

export function pendingCount(queue: SyncQueue): number {
  return pending(queue).length;
}

export interface RecordOutcome {
  clientRecordId: string;
  status: "Applied" | "Duplicate" | "Failed";
  reference?: string | null;
  error?: string | null;
}

export function applyOutcomes(queue: SyncQueue, outcomes: RecordOutcome[]): SyncQueue {
  const byId = new Map(outcomes.map((outcome) => [outcome.clientRecordId, outcome]));

  const records = queue.records.flatMap((record) => {
    const outcome = byId.get(record.clientRecordId);

    if (!outcome) {
      return [record];
    }

    if (outcome.status === "Failed") {
      return [{ ...record, status: "failed" as const, error: outcome.error ?? "The record was refused." }];
    }

    return [];
  });

  return { ...queue, records };
}

export function retry(queue: SyncQueue, clientRecordId: string): SyncQueue {
  return {
    ...queue,
    records: queue.records.map((record) =>
      record.clientRecordId === clientRecordId
        ? { ...record, status: "pending" as const, error: undefined }
        : record,
    ),
  };
}

export function discard(queue: SyncQueue, clientRecordId: string): SyncQueue {
  return {
    ...queue,
    records: queue.records.filter((record) => record.clientRecordId !== clientRecordId),
  };
}

function newRecordId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `r-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}
