import { request } from "./http";
import type { QueuedRecord } from "../features/sync/queue";

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

export function toOperations(records: QueuedRecord[]) {
  return records.map((record) => ({
    clientRecordId: record.clientRecordId,
    sequence: record.sequence,
    kind: record.kind,
    consignment: record.consignment,
    // The panel keeps the time the officer took it offline, so the record and its
    // ConsignmentTested event are not dated at the upload (SCRUM-141).
    qualityTest: record.qualityTest ? { ...record.qualityTest, testedAtUtc: record.createdAt } : undefined,
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
