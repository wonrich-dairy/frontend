import { request } from "./http";
import type { QueuedRecord } from "../features/sync/queue";

/**
 * Uploading an offline queue (SCRUM-10). The endpoint answers 200 whenever the request itself is
 * well formed — the per-record statuses carry the outcomes, so one refused record never sinks the
 * queue behind it.
 */

export type SyncStatus = "Applied" | "Duplicate" | "Failed";

export interface SyncResult {
  clientRecordId: string;
  status: SyncStatus;
  reference: string | null;
  error: string | null;
}

export interface SyncBatchResult {
  results: SyncResult[];
  applied: number;
  duplicates: number;
  failed: number;
}

/** The queue as the service takes it: identity, position, kind, and the payload for that kind. */
export function toOperations(records: QueuedRecord[]) {
  return records.map((record) => ({
    clientRecordId: record.clientRecordId,
    sequence: record.sequence,
    kind: record.kind,
    consignment: record.consignment,
    qualityTest: record.qualityTest,
    pour: record.pour,
  }));
}

export function uploadQueue(
  records: QueuedRecord[],
  token: string | null,
  signal?: AbortSignal,
): Promise<SyncBatchResult> {
  return request<SyncBatchResult>("/api/sync", {
    method: "POST",
    body: { operations: toOperations(records) },
    token,
    signal,
  });
}
