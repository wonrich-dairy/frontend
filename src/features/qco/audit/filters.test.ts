import { describe, expect, it } from "vitest";
import type { AuditTrailEntryDto } from "../../../api/traceability/audit";
import {
  auditFilterError,
  auditFiltersFromQuery,
  auditFiltersToQuery,
  describeAuditPage,
  emptyAuditFilters,
  entryDetail,
  hasAuditFilters,
  toAuditRequest,
} from "./filters";

function entry(overrides: Partial<AuditTrailEntryDto>): AuditTrailEntryDto {
  return {
    id: "event-1",
    occurredAt: "2026-09-19T06:00:00Z",
    user: "proc.tech-1",
    action: "ProcessingStageRecorded",
    checkpoint: "Processing",
    batchId: "262-FM-B",
    facility: "FACTORY-01",
    source: "ConsumedEvent",
    reference: "7f8e5a8c-0000-4000-8000-000000000001",
    ...overrides,
  };
}

describe("the audit trail's filters in the URL (SCRUM-138)", () => {
  it("reads every filter and the page", () => {
    const { filters, page } = auditFiltersFromQuery(
      new URLSearchParams("user=proc.tech-1&action=BatchFailed&from=2026-09-01&to=2026-09-30&batchId=262-FM-B&page=3"),
    );

    expect(filters).toEqual({ user: "proc.tech-1", action: "BatchFailed", from: "2026-09-01", to: "2026-09-30", batchId: "262-FM-B" });
    expect(page).toBe(3);
  });

  it("starts on the first page with nothing filtered", () => {
    expect(auditFiltersFromQuery(new URLSearchParams())).toEqual({ filters: emptyAuditFilters(), page: 1 });
  });

  it("drops what a hand-edited link cannot mean", () => {
    const { filters, page } = auditFiltersFromQuery(
      new URLSearchParams(`from=2026-13-40&to=yesterday&user=${"x".repeat(101)}&page=-2`),
    );

    expect(filters).toEqual(emptyAuditFilters());
    expect(page).toBe(1);
  });

  it("drops a range that ends before it starts", () => {
    const { filters } = auditFiltersFromQuery(new URLSearchParams("from=2026-09-30&to=2026-09-01&user=qco-1"));

    expect(filters).toEqual({ ...emptyAuditFilters(), user: "qco-1" });
  });

  it("writes only the filters given, trimmed, and leaves page 1 out", () => {
    const filters = { ...emptyAuditFilters(), user: " qco-1 ", from: "2026-09-01" };

    expect(auditFiltersToQuery(filters)).toBe("?user=qco-1&from=2026-09-01");
    expect(auditFiltersToQuery(filters, 2)).toBe("?user=qco-1&from=2026-09-01&page=2");
    expect(auditFiltersToQuery(emptyAuditFilters())).toBe("");
  });

  it("round-trips through the URL", () => {
    const filters = { user: "qco-1", action: "BatchTraceOpened", from: "2026-09-01", to: "2026-09-02", batchId: "262-FM-B" };

    expect(auditFiltersFromQuery(new URLSearchParams(auditFiltersToQuery(filters, 4)))).toEqual({ filters, page: 4 });
  });

  it("asks the service for the filters given only", () => {
    expect(toAuditRequest({ ...emptyAuditFilters(), action: " BatchFailed ", batchId: "  " })).toEqual({ action: "BatchFailed" });
    expect(hasAuditFilters(emptyAuditFilters())).toBe(false);
    expect(hasAuditFilters({ ...emptyAuditFilters(), to: "2026-09-01" })).toBe(true);
  });
});

describe("checking the audit filters before asking", () => {
  it("accepts no filters, and one day", () => {
    expect(auditFilterError(emptyAuditFilters())).toBeNull();
    expect(auditFilterError({ ...emptyAuditFilters(), from: "2026-09-19", to: "2026-09-19" })).toBeNull();
  });

  it("refuses a range that ends before it starts", () => {
    expect(auditFilterError({ ...emptyAuditFilters(), from: "2026-09-20", to: "2026-09-19" })).toBe(
      "The start date must be on or before the end date.",
    );
  });

  it("refuses text longer than the service accepts, naming the field", () => {
    expect(auditFilterError({ ...emptyAuditFilters(), batchId: "x".repeat(101) })).toBe("Batch ID can be at most 100 characters.");
    expect(auditFilterError({ ...emptyAuditFilters(), user: "x".repeat(100) })).toBeNull();
  });
});

describe("describing an audit page", () => {
  it("counts entries, newest first", () => {
    expect(describeAuditPage(1, 50, 1, 1)).toBe("1 entry, newest first.");
    expect(describeAuditPage(1, 50, 7, 7)).toBe("7 entries, newest first.");
    expect(describeAuditPage(2, 50, 50, 123)).toBe("Showing 51–100 of 123 entries, newest first.");
  });
});

describe("an entry's reference", () => {
  it("names the upstream event of a consumed event", () => {
    expect(entryDetail(entry({}))).toBe("Event 7f8e5a8c-0000-4000-8000-000000000001");
  });

  it("names the dispatch or consignment of a snapshot record", () => {
    expect(entryDetail(entry({ source: "UpstreamSnapshot", action: "MilkDispatched", reference: "DN-20260919-02" }))).toBe(
      "DN-20260919-02",
    );
  });

  it("names an export's file and how many batches it held", () => {
    const exported = entry({
      source: "Traceability",
      action: "BatchSearchExported",
      checkpoint: null,
      batchId: null,
      facility: null,
      reference: "batches_all_exported-2026-10-13.csv",
      details: { rowCount: 12, role: "QualityControlOfficer" },
    });

    expect(entryDetail(exported)).toBe("batches_all_exported-2026-10-13.csv (12 batches)");
    expect(entryDetail({ ...exported, details: { rowCount: 1 } })).toBe("batches_all_exported-2026-10-13.csv (1 batch)");
  });

  it("adds nothing for an opened batch, which its batch column already names", () => {
    expect(entryDetail(entry({ source: "Traceability", action: "BatchTraceOpened", checkpoint: null, reference: "262-FM-B" }))).toBeNull();
  });
});
