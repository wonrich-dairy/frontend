import { describe, expect, it } from "vitest";
import type { QueuedRecord } from "../features/sync/queue";
import { toOperations } from "./sync";

function record(overrides: Partial<QueuedRecord>): QueuedRecord {
  return {
    clientRecordId: "r-1",
    sequence: 1,
    kind: "RecordQualityTest",
    summary: "test",
    createdAt: "2026-10-15T03:12:00.000Z",
    status: "pending",
    ...overrides,
  } as QueuedRecord;
}

describe("toOperations", () => {
  // SCRUM-141: the server dates the panel and its ConsignmentTested event with this time.
  it("sends an offline panel with the time it was taken", () => {
    const [operation] = toOperations([
      record({ qualityTest: { consignmentReference: "MCC-20261015-KC-01" } as QueuedRecord["qualityTest"] }),
    ]);

    expect(operation.qualityTest).toMatchObject({
      consignmentReference: "MCC-20261015-KC-01",
      testedAtUtc: "2026-10-15T03:12:00.000Z",
    });
  });

  it("leaves records without a panel as they were", () => {
    const [operation] = toOperations([record({ kind: "PourToTank", pour: { tankCode: "T-01", consignmentReference: "R" } as QueuedRecord["pour"] })]);

    expect(operation.qualityTest).toBeUndefined();
    expect(operation.pour).toEqual({ tankCode: "T-01", consignmentReference: "R" });
  });
});
