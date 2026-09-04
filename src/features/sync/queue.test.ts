import { describe, expect, it } from "vitest";
import {
  applyOutcomes,
  discard,
  emptyQueue,
  enqueue,
  failed,
  pending,
  pendingCount,
  retry,
  type NewRecord,
  type SyncQueue,
} from "./queue";

const consignment = (society = "s1"): NewRecord => ({
  kind: "RegisterConsignment",
  summary: "Kobeigane - 1 can",
  consignment: { societyId: society, cans: [{ canNumber: 1, quantityKg: 40 }] },
});

const panel = (reference: string): NewRecord => ({
  kind: "RecordQualityTest",
  summary: `${reference} - accepted`,
  qualityTest: {
    consignmentReference: reference,
    fatPercent: 4.1,
    rawLactometerReading: 28.5,
    temperatureCelsius: 29,
    waterPercent: 0,
    kqColour: "Blue",
    alcoholOutcomes: { Alcohol80: "Negative" },
    verdict: "Accept",
  },
});

function queueOf(...records: NewRecord[]): SyncQueue {
  return records.reduce((queue, record) => enqueue(queue, record), emptyQueue());
}

describe("capturing records", () => {
  it("stamps each record with an identifier and its place in the queue", () => {
    const queue = queueOf(consignment(), panel("MCC-1"));
    const [first, second] = queue.records;

    expect(first.sequence).toBe(1);
    expect(second.sequence).toBe(2);
    expect(first.clientRecordId).not.toBe(second.clientRecordId);
    expect(first.status).toBe("pending");
  });

  it("keeps climbing the sequence after the queue has drained", () => {
    const queue = queueOf(consignment());
    const drained = applyOutcomes(queue, [
      { clientRecordId: queue.records[0].clientRecordId, status: "Applied", reference: "MCC-1" },
    ]);

    expect(pending(drained)).toHaveLength(0);
    expect(enqueue(drained, panel("MCC-1")).records[0].sequence).toBe(2);
  });

  it("lists what is waiting in the order it was created", () => {
    const queue = queueOf(consignment(), panel("MCC-1"), consignment("s2"));

    expect(pending(queue).map((record) => record.sequence)).toEqual([1, 2, 3]);
    expect(pendingCount(queue)).toBe(3);
  });
});

describe("folding an upload's outcomes back in", () => {
  it("takes applied records off the device", () => {
    const queue = queueOf(consignment());
    const after = applyOutcomes(queue, [
      { clientRecordId: queue.records[0].clientRecordId, status: "Applied", reference: "MCC-1" },
    ]);

    expect(after.records).toHaveLength(0);
  });

  it("treats a duplicate as done, because the service already holds it", () => {
    const queue = queueOf(consignment());
    const after = applyOutcomes(queue, [
      { clientRecordId: queue.records[0].clientRecordId, status: "Duplicate", reference: "MCC-1" },
    ]);

    expect(after.records).toHaveLength(0);
  });

  it("keeps a refused record, with the reason, rather than discarding it", () => {
    const queue = queueOf(consignment());
    const after = applyOutcomes(queue, [
      {
        clientRecordId: queue.records[0].clientRecordId,
        status: "Failed",
        error: "Society 's1' was not found.",
      },
    ]);

    expect(pending(after)).toHaveLength(0);
    expect(failed(after)).toHaveLength(1);
    expect(failed(after)[0].error).toBe("Society 's1' was not found.");
  });

  it("leaves records the upload did not mention alone", () => {
    const queue = queueOf(consignment(), panel("MCC-1"));
    const after = applyOutcomes(queue, [
      { clientRecordId: queue.records[0].clientRecordId, status: "Applied", reference: "MCC-1" },
    ]);

    expect(pending(after).map((record) => record.sequence)).toEqual([2]);
  });

  it("carries a failure reason even when the service gave none", () => {
    const queue = queueOf(consignment());
    const after = applyOutcomes(queue, [
      { clientRecordId: queue.records[0].clientRecordId, status: "Failed", error: null },
    ]);

    expect(failed(after)[0].error).toBe("The record was refused.");
  });
});

describe("what the officer can do with a refused record", () => {
  it("puts it back in the queue to try again", () => {
    const queue = queueOf(consignment());
    const id = queue.records[0].clientRecordId;
    const refused = applyOutcomes(queue, [{ clientRecordId: id, status: "Failed", error: "No such society." }]);

    const again = retry(refused, id);

    expect(pending(again)).toHaveLength(1);
    expect(pending(again)[0].error).toBeUndefined();
    expect(pending(again)[0].clientRecordId).toBe(id);
  });

  it("discards it only when asked", () => {
    const queue = queueOf(consignment());
    const id = queue.records[0].clientRecordId;

    expect(discard(queue, id).records).toHaveLength(0);
  });
});
