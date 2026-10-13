import { describe, expect, it } from "vitest";
import type { CheckpointSectionDto } from "../../../api/traceability/batches";
import { failedBatch, unresolvedBatch } from "./fixtures";
import {
  checkpointsWithoutData,
  describeDeviation,
  deviationTitle,
  firstDeviation,
  humanise,
  missingReason,
  rankSocieties,
  rankTanks,
  timelineItems,
} from "./trace";

function section(batch: ReturnType<typeof failedBatch>, checkpoint: CheckpointSectionDto["checkpoint"]) {
  return batch.checkpoints.find((s) => s.checkpoint === checkpoint)!;
}

describe("missingReason", () => {
  it("is null for a recorded checkpoint", () => {
    const batch = failedBatch();

    expect(missingReason(section(batch, "Lab"), batch)).toBeNull();
  });

  it("gives the upstream failure for MCC and Intake with no data", () => {
    const batch = unresolvedBatch();
    const reason = missingReason(section(batch, "Mcc"), batch);

    expect(reason).toMatch(/^No data received\./);
    expect(reason).toContain("could not supply the records");
    expect(reason).toContain("has no dispatch DN-20260919-02");
  });

  it("says the lookup has not run when there is no upstream row", () => {
    const batch = { ...unresolvedBatch(), upstream: null };

    expect(missingReason(section(batch, "Intake"), batch)).toContain("has not run yet");
  });

  it("says a pending lookup will be retried, with the attempts so far", () => {
    const batch = unresolvedBatch();
    batch.upstream = { ...batch.upstream!, status: "PendingRetry", attemptCount: 2, failureReason: null };

    expect(missingReason(section(batch, "Mcc"), batch)).toContain("has not resolved yet (2 attempts); it will be retried.");
  });

  it("says a checkpoint not reached yet is not a gap", () => {
    const batch = failedBatch({ status: "Processing" });
    const lab: CheckpointSectionDto = { ...section(batch, "Lab"), state: "NotYetReached", records: [], deviations: [] };

    expect(missingReason(lab, batch)).toBe("Not reached yet: the batch is in processing.");
  });

  it("flags a Processing gap behind a later checkpoint", () => {
    const batch = failedBatch();
    const processing: CheckpointSectionDto = { ...section(batch, "Processing"), state: "NoDataReceived", records: [] };

    expect(missingReason(processing, batch)).toContain("No Processing event has arrived");
  });

  it("lists the checkpoints without data", () => {
    expect(checkpointsWithoutData(unresolvedBatch())).toEqual(["Mcc", "Intake"]);
    expect(checkpointsWithoutData(failedBatch())).toEqual([]);
  });
});

describe("timelineItems", () => {
  it("puts records in time order and attaches the deviation reported with each", () => {
    const items = timelineItems(section(failedBatch(), "Mcc"));

    expect(items.map((item) => item.type === "record" && item.record.kind)).toEqual([
      "ConsignmentRegistered",
      "DispatchCreated",
    ]);
    expect(items[0].type === "record" && items[0].deviations).toEqual([]);
    expect(items[1].type === "record" && items[1].deviations).toHaveLength(1);
  });

  it("matches times written with and without a zone", () => {
    const mcc = section(failedBatch(), "Mcc");
    mcc.deviations[0].occurredAt = "2026-09-19T02:00:00";

    const items = timelineItems(mcc);

    expect(items).toHaveLength(2);
    expect(items[1].type === "record" && items[1].deviations).toHaveLength(1);
  });

  it("keeps a deviation that matches no record as an entry of its own", () => {
    const mcc = section(unresolvedBatch(), "Mcc");
    const items = timelineItems(mcc);

    expect(items).toHaveLength(1);
    expect(items[0].type).toBe("deviation");
  });
});

describe("firstDeviation", () => {
  it("is the earliest deviation on the batch, wherever it was reported", () => {
    const first = firstDeviation(failedBatch());

    expect(first?.checkpoint).toBe("Mcc");
    expect(first?.deviation.parameter).toBe("TemperatureC");
  });

  it("goes to the earlier checkpoint on a tie", () => {
    const batch = failedBatch();
    section(batch, "Lab").deviations[0].occurredAt = "2026-09-19T02:00:00Z";

    expect(firstDeviation(batch)?.checkpoint).toBe("Mcc");
  });

  it("is null when nothing deviated", () => {
    const batch = failedBatch();
    batch.checkpoints.forEach((s) => (s.deviations = []));

    expect(firstDeviation(batch)).toBeNull();
  });
});

describe("deviation wording", () => {
  it("gives the reading against its limit", () => {
    expect(describeDeviation(section(failedBatch(), "Mcc").deviations[0])).toBe(
      "Temperature C 12.40 against a limit of 4.00",
    );
  });

  it("falls back to the description, then to a plain flag", () => {
    const bare = { occurredAt: "", reasonCode: null, parameter: null, observedValue: null, limit: null, description: null };

    expect(describeDeviation({ ...bare, description: "Off smell" })).toBe("Off smell");
    expect(describeDeviation(bare)).toBe("Flagged as a deviation; no reading was given.");
  });

  it("uses the lab's labels for its reason codes", () => {
    expect(deviationTitle(section(failedBatch(), "Lab").deviations[0])).toBe("pH below minimum");
    expect(deviationTitle(section(failedBatch(), "Mcc").deviations[0])).toBe("Temperature high");
  });

  it("spells out event names", () => {
    expect(humanise("MilkAllocatedToMixingTankEvent")).toBe("Milk allocated to mixing tank");
    expect(humanise("ArrivalScreened")).toBe("Arrival screened");
  });
});

describe("contributors", () => {
  it("ranks the tanks by litres drawn, with their share", () => {
    const ranked = rankTanks(failedBatch().links!);

    expect(ranked.map((r) => r.tank.code)).toEqual(["T-01", "T-02"]);
    expect(ranked.map((r) => r.share)).toEqual([1000 / 1500, 500 / 1500]);
  });

  it("ranks the societies by litres supplied, counting one across two tanks once", () => {
    const ranked = rankSocieties(failedBatch().links!);

    expect(ranked.map((s) => [s.code, s.litres])).toEqual([
      ["VS021", 900],
      ["VS014", 600],
    ]);
    expect(ranked[0].tanks).toEqual(["T-02", "T-01"]);
    expect(ranked[0].consignments).toEqual(["C-003", "C-002"]);
  });
});
