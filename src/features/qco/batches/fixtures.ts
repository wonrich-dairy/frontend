import type { BatchRecordDto, BatchSummaryDto, BatchTraceDto, TraceCheckpointStatus } from "../../../api/traceability/batches";

// A failed batch fed from two tanks, shaped like the demo batch 262-FM-B in the service's sample
// data: 12.40 C leaving the MCC against a 4.00 C limit, three checkpoints before the lab fails it.
export function failedBatch(overrides: Partial<BatchRecordDto> = {}): BatchRecordDto {
  return {
    batchId: "262-FM-B",
    dispatchRef: "DN-20260919-02",
    batchReference: "WR-20260919-02",
    productLine: "FM",
    facility: "FACTORY-01",
    status: "Failed",
    completeness: "Complete",
    firstEventAt: "2026-09-19T01:00:00Z",
    lastEventAt: "2026-09-19T09:00:00Z",
    labResult: "Failed",
    upstream: {
      status: "Resolved",
      attemptCount: 1,
      lastAttemptAt: "2026-09-19T04:00:00Z",
      resolvedAt: "2026-09-19T04:00:00Z",
      failureReason: null,
    },
    checkpoints: [
      {
        checkpoint: "Mcc",
        state: "Recorded",
        firstRecordedAt: "2026-09-19T01:00:00Z",
        lastRecordedAt: "2026-09-19T02:00:00Z",
        records: [
          {
            kind: "ConsignmentRegistered",
            occurredAt: "2026-09-19T01:00:00Z",
            recordedBy: "n.silva",
            data: { reference: "C-001", society: { code: "VS014", name: "Hill Dairy" }, volumeLitres: 600 },
            sourceEventId: null,
          },
          {
            kind: "DispatchCreated",
            occurredAt: "2026-09-19T02:00:00Z",
            recordedBy: null,
            data: { reference: "DN-20260919-02", totalLitres: 1500 },
            sourceEventId: null,
          },
        ],
        deviations: [
          {
            occurredAt: "2026-09-19T02:00:00Z",
            reasonCode: "TemperatureHigh",
            parameter: "TemperatureC",
            observedValue: 12.4,
            limit: 4,
            description: null,
          },
        ],
      },
      {
        checkpoint: "Intake",
        state: "Recorded",
        firstRecordedAt: "2026-09-19T04:00:00Z",
        lastRecordedAt: "2026-09-19T04:00:00Z",
        records: [
          {
            kind: "ArrivalScreened",
            occurredAt: "2026-09-19T04:00:00Z",
            recordedBy: "r.fernando",
            data: { batchReference: "WR-20260919-02", temperatureC: 9.1 },
            sourceEventId: null,
          },
        ],
        deviations: [],
      },
      {
        checkpoint: "Processing",
        state: "Recorded",
        firstRecordedAt: "2026-09-19T05:00:00Z",
        lastRecordedAt: "2026-09-19T05:00:00Z",
        records: [
          {
            kind: "ProcessingStageRecorded",
            occurredAt: "2026-09-19T05:00:00Z",
            recordedBy: null,
            data: { stage: "Pasteuriser" },
            sourceEventId: "8a7f3f5e-2f1d-4b6a-9d7c-1e2f3a4b5c6d",
          },
        ],
        deviations: [],
      },
      {
        checkpoint: "Lab",
        state: "Recorded",
        firstRecordedAt: "2026-09-19T09:00:00Z",
        lastRecordedAt: "2026-09-19T09:00:00Z",
        records: [
          {
            kind: "BatchFailed",
            occurredAt: "2026-09-19T09:00:00Z",
            recordedBy: "a.jayasuriya",
            data: { reasonCodes: ["LOW_PH"] },
            sourceEventId: "1b2c3d4e-5f60-4718-9a0b-c1d2e3f40516",
          },
        ],
        deviations: [
          {
            occurredAt: "2026-09-19T09:00:00Z",
            reasonCode: "LOW_PH",
            parameter: "pH",
            observedValue: 6.41,
            limit: 6.6,
            description: null,
          },
        ],
      },
    ],
    links: {
      dispatch: {
        reference: "DN-20260919-02",
        dispatchedAt: "2026-09-19T02:00:00Z",
        bowserRegistration: "WP-LB-4471",
        totalLitres: 1500,
      },
      tanks: [
        {
          code: "T-02",
          quantityDrawnLitres: 500,
          consignments: [{ reference: "C-003", volumeLitres: 500, society: { code: "VS021", name: "Lake Farmers" } }],
        },
        {
          code: "T-01",
          quantityDrawnLitres: 1000,
          consignments: [
            { reference: "C-001", volumeLitres: 600, society: { code: "VS014", name: "Hill Dairy" } },
            { reference: "C-002", volumeLitres: 400, society: { code: "VS021", name: "Lake Farmers" } },
          ],
        },
      ],
    },
    ...overrides,
  };
}

// The same batch before the MCC and Intake lookup has resolved: no MCC or Intake records, no links.
export function unresolvedBatch(): BatchRecordDto {
  const batch = failedBatch();

  return {
    ...batch,
    completeness: "Partial",
    batchReference: null,
    upstream: {
      status: "Unavailable",
      attemptCount: 5,
      lastAttemptAt: "2026-09-19T08:00:00Z",
      resolvedAt: null,
      failureReason: "MCC and Intake Service has no dispatch DN-20260919-02.",
    },
    checkpoints: batch.checkpoints.map((section) =>
      section.checkpoint === "Mcc" || section.checkpoint === "Intake"
        ? { ...section, state: "NoDataReceived", records: [], firstRecordedAt: null, lastRecordedAt: null }
        : section,
    ),
    links: null,
  };
}

export function summaryOf(batch: BatchRecordDto): BatchSummaryDto {
  const { upstream: _upstream, checkpoints: _checkpoints, links: _links, ...summary } = batch;

  return summary;
}

// What GET /api/batches/{id}/trace returns for a batch, as the service builds it: the chain back
// from the lab, and the origin at the earliest checkpoint in stage order with a deviation.
export function traceOf(batch: BatchRecordDto, holds: BatchTraceDto["holds"] = []): BatchTraceDto {
  const sections = batch.checkpoints.map((section, index) => {
    const status: TraceCheckpointStatus =
      section.state === "NotYetReached"
        ? "NotYetReached"
        : section.state === "NoDataReceived"
          ? "MissingData"
          : section.deviations.length > 0
            ? "Deviation"
            : "WithinSpec";

    return {
      checkpoint: section.checkpoint,
      status,
      firstRecordedAt: section.firstRecordedAt,
      lastRecordedAt: section.lastRecordedAt,
      missingReason: status === "MissingData" ? `${section.checkpoint} returned no records.` : null,
      deviations: section.deviations.map((deviation, n) => ({
        ...deviation,
        checkpoint: section.checkpoint,
        sourceEventId: `00000000-0000-4000-8000-00000000${index}${n}0`,
      })),
    };
  });
  const origin = sections.find((section) => section.deviations.length > 0);

  return {
    ...summaryOf(batch),
    hasDeviation: origin !== undefined,
    originCheckpoint: origin?.checkpoint ?? null,
    origin: origin?.deviations[0] ?? null,
    chain: [...sections].reverse(),
    holds,
    links: batch.links,
    societies: [],
  };
}
