import { describe, expect, it } from "vitest";
import { fileNameOf } from "../../../api/http";
import {
  describePage,
  emptyFilters,
  filtersFromQuery,
  filtersToQuery,
  hasFilterSearch,
  rangeError,
  toRequestFilters,
} from "./filters";

describe("batch filters in the URL (SCRUM-139)", () => {
  it("has no filter search until a page is in the URL", () => {
    expect(hasFilterSearch(new URLSearchParams(""))).toBe(false);
    expect(hasFilterSearch(new URLSearchParams("q=262-FM-B"))).toBe(false);
    expect(hasFilterSearch(new URLSearchParams("page=1"))).toBe(true);
  });

  it("round-trips every filter and the page", () => {
    const filters = {
      ...emptyFilters(),
      status: "Failed" as const,
      productLine: "FM" as const,
      from: "2026-09-01",
      to: "2026-09-30",
      society: "VS001",
      tank: "T1",
      user: "qa.officer",
      reasonCode: "LOW_FAT",
      facility: "FACTORY-01",
    };

    const query = filtersToQuery(filters, 3);

    expect(query).toBe(
      "?status=Failed&productLine=FM&from=2026-09-01&to=2026-09-30&society=VS001&tank=T1&user=qa.officer&reasonCode=LOW_FAT&facility=FACTORY-01&page=3",
    );
    expect(filtersFromQuery(new URLSearchParams(query))).toEqual({ filters, page: 3 });
  });

  it("puts only the page in the URL when nothing is filtered, and trims text", () => {
    expect(filtersToQuery(emptyFilters())).toBe("?page=1");
    expect(filtersToQuery({ ...emptyFilters(), society: "  VS001 " })).toBe("?society=VS001&page=1");
  });

  it("drops what a hand-edited link gets wrong instead of failing", () => {
    const { filters, page } = filtersFromQuery(
      new URLSearchParams("status=Rejected&productLine=fm&from=2026-02-30&to=2026-09-01&page=-2"),
    );

    expect(filters.status).toBe("");
    expect(filters.productLine).toBe("FM");
    expect(filters.from).toBe("");
    expect(filters.to).toBe("2026-09-01");
    expect(page).toBe(1);
  });

  it("drops a backwards range from a link", () => {
    const { filters } = filtersFromQuery(new URLSearchParams("from=2026-10-02&to=2026-10-01&page=1"));

    expect([filters.from, filters.to]).toEqual(["", ""]);
  });

  it("sends only the filters given", () => {
    expect(toRequestFilters({ ...emptyFilters(), tank: " T2 ", status: "OnHold" })).toEqual({ status: "OnHold", tank: "T2" });
    expect(toRequestFilters(emptyFilters())).toEqual({});
  });
});

describe("the date range", () => {
  it("allows either date alone, or none", () => {
    expect(rangeError({ from: "", to: "" })).toBeNull();
    expect(rangeError({ from: "2026-09-01", to: "" })).toBeNull();
    expect(rangeError({ from: "", to: "2026-09-01" })).toBeNull();
  });

  it("refuses from after to, and a part-typed date", () => {
    expect(rangeError({ from: "2026-10-02", to: "2026-10-01" })).toBe("The start date must be on or before the end date.");
    expect(rangeError({ from: "2026-10", to: "" })).toBe("Enter a whole date, or leave it empty.");
  });
});

describe("the results line", () => {
  it("says which rows of how many are shown", () => {
    expect(describePage(1, 50, 50, 123)).toBe("Showing 1–50 of 123 batches, newest first.");
    expect(describePage(3, 50, 23, 123)).toBe("Showing 101–123 of 123 batches, newest first.");
    expect(describePage(1, 50, 4, 4)).toBe("4 batches, newest first.");
    expect(describePage(1, 50, 1, 1)).toBe("1 batch, newest first.");
  });
});

describe("the export's file name", () => {
  it("is read from Content-Disposition, preferring the encoded name", () => {
    expect(fileNameOf("attachment; filename=batches_all_exported-2026-10-13.csv; filename*=UTF-8''batches_all_exported-2026-10-13.csv")).toBe(
      "batches_all_exported-2026-10-13.csv",
    );
    expect(fileNameOf('attachment; filename="batches_status-Failed_exported-2026-10-13.csv"')).toBe(
      "batches_status-Failed_exported-2026-10-13.csv",
    );
    expect(fileNameOf("attachment")).toBeNull();
    expect(fileNameOf(null)).toBeNull();
  });
});
