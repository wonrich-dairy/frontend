import type { AlcoholStage, KqColour, StageOutcome } from "../../api/qualityTests";

/**
 * The officer's offline queue (SCRUM-10). Records captured with no signal are held here in the
 * order they were created and uploaded when connectivity returns.
 *
 * Two rules the service depends on, and this model exists to keep:
 *
 * - `clientRecordId` never changes once assigned. A handheld that drops connectivity mid-upload
 *   cannot know whether the server took a record, so its only safe move is to send the queue
 *   again; the identifier is what lets the server recognise it and apply it once.
 * - `sequence` only ever climbs, so records apply in the order the officer created them. A pour
 *   sent before the consignment it pours would fail for want of a reference that does not exist
 *   yet.
 */

export type QueuedKind = "RegisterConsignment" | "RecordQualityTest" | "PourToTank";

/** Pending is waiting for a window to upload; failed was refused and is held for review. */
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
  /** What the officer sees in the queue list, so a record is recognisable without decoding it. */
  summary: string;
  createdAt: string;
  status: QueuedStatus;
  /** The service's reason, when it refused the record. */
  error?: string;
  consignment?: QueuedConsignment;
  qualityTest?: QueuedQualityTest;
  pour?: QueuedPour;
}

export interface SyncQueue {
  /** Climbs for the life of the device, so ordering survives the queue draining to empty. */
  nextSequence: number;
  records: QueuedRecord[];
}

export const emptyQueue = (): SyncQueue => ({ nextSequence: 1, records: [] });

export type NewRecord = Omit<
  QueuedRecord,
  "clientRecordId" | "sequence" | "createdAt" | "status" | "error"
>;

/** Adds a record to the back of the queue, stamping it with its identity and position. */
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

/** Everything still to upload, in the order it was created. */
export function pending(queue: SyncQueue): QueuedRecord[] {
  return queue.records
    .filter((record) => record.status === "pending")
    .sort((a, b) => a.sequence - b.sequence);
}

/** Records the service refused, kept for someone to look at rather than dropped. */
export function failed(queue: SyncQueue): QueuedRecord[] {
  return queue.records
    .filter((record) => record.status === "failed")
    .sort((a, b) => a.sequence - b.sequence);
}

/** What the pending badge counts: work the officer still has sitting on the device. */
export function pendingCount(queue: SyncQueue): number {
  return pending(queue).length;
}

export interface RecordOutcome {
  clientRecordId: string;
  status: "Applied" | "Duplicate" | "Failed";
  reference?: string | null;
  error?: string | null;
}

/**
 * Folds an upload's outcomes back into the queue.
 *
 * Applied and Duplicate both mean the service holds the record, so it leaves the device — a
 * duplicate is the expected answer when a previous upload landed but its response never arrived.
 * Failed stays, marked with the reason, because a record the officer captured is never discarded
 * on the client's say-so.
 */
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

/** Puts a failed record back in the queue, for the officer who has fixed what was wrong upstream. */
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

/** Drops a failed record. Only ever at the officer's request — sync never discards. */
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
