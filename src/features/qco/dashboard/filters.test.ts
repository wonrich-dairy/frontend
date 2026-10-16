import { describe, expect, it } from "vitest";
import {
  defaultFilters,
  describeFilters,
  filtersFromQuery,
  filtersToQuery,
  isValidDate,
  rangeError,
  todayInColombo,
  toRequestFilters,
} from "./filters";

// 20:00 UTC on 3 October is already 01:30 on 4 October in Colombo.
const LATE_EVENING_UTC = new Date("2026-10-03T20:00:00Z");

describe("the default range", () => {
  it("runs from 1 August to today in Colombo, not in the browser's time zone", () => {
    expect(todayInColombo(LATE_EVENING_UTC)).toBe("2026-10-04");
    expect(defaultFilters(LATE_EVENING_UTC)).toEqual({
      productLine: "",
      from: "2026-08-01",
      to: "2026-10-04",
    });
  });

  it("opens on last year's 1 August before this year's has come", () => {
    expect(defaultFilters(new Date("2026-03-10T06:00:00Z")).from).toBe("2025-08-01");
    expect(defaultFilters(new Date("2026-07-31T06:00:00Z")).from).toBe("2025-08-01");
  });

  it("opens on today itself on 1 August", () => {
    expect(defaultFilters(new Date("2026-08-01T06:00:00Z"))).toMatchObject({ from: "2026-08-01", to: "2026-08-01" });
  });
});

describe("reading filters from the URL", () => {
  it("uses the default for an empty query", () => {
    expect(filtersFromQuery(new URLSearchParams(), LATE_EVENING_UTC)).toEqual(defaultFilters(LATE_EVENING_UTC));
  });

  it("reads the dashboard filters and ignores legacy facility filters", () => {
    const query = new URLSearchParams("facility=MCC-KANDY&productLine=FLM&from=2026-09-01&to=2026-09-30");

    expect(filtersFromQuery(query, LATE_EVENING_UTC)).toEqual({
      productLine: "FLM",
      from: "2026-09-01",
      to: "2026-09-30",
    });
  });

  it("ignores a product line the plant does not make", () => {
    expect(filtersFromQuery(new URLSearchParams("productLine=XX"), LATE_EVENING_UTC).productLine).toBe("");
  });

  it("ignores a date that does not exist", () => {
    const filters = filtersFromQuery(new URLSearchParams("from=2026-02-30&to=2026-12-01"), LATE_EVENING_UTC);

    expect(filters.from).toBe("2026-08-01");
    expect(filters.to).toBe("2026-12-01");
  });

  it("falls back to the default range when the link's range is backwards", () => {
    const filters = filtersFromQuery(new URLSearchParams("from=2026-09-30&to=2026-09-01"), LATE_EVENING_UTC);

    expect(filters.from).toBe("2026-08-01");
    expect(filters.to).toBe("2026-10-04");
  });
});

describe("writing filters to the URL", () => {
  it("writes nothing for the default view", () => {
    expect(filtersToQuery(defaultFilters(LATE_EVENING_UTC), LATE_EVENING_UTC)).toBe("");
  });

  it("writes both dates once the range moves off the default", () => {
    const filters = { ...defaultFilters(LATE_EVENING_UTC), from: "2026-09-01" };

    expect(filtersToQuery(filters, LATE_EVENING_UTC)).toBe("?from=2026-09-01&to=2026-10-04");
  });

  it("round-trips through the query string", () => {
    const filters = { productLine: "DY" as const, from: "2026-09-01", to: "2026-09-30" };
    const query = new URLSearchParams(filtersToQuery(filters, LATE_EVENING_UTC));

    expect(filtersFromQuery(query, LATE_EVENING_UTC)).toEqual(filters);
  });
});

describe("the date range check", () => {
  it("accepts a single day and a forward range", () => {
    expect(rangeError({ from: "2026-09-01", to: "2026-09-01" })).toBeNull();
    expect(rangeError({ from: "2026-09-01", to: "2026-09-30" })).toBeNull();
  });

  it("refuses a backwards range", () => {
    expect(rangeError({ from: "2026-09-30", to: "2026-09-01" })).toMatch(/on or before/);
  });

  it("refuses a missing date", () => {
    expect(rangeError({ from: "", to: "2026-09-01" })).toMatch(/both dates/);
    expect(isValidDate("2026-13-01")).toBe(false);
  });
});

describe("the one-line summary on a phone", () => {
  it("names the season to date for the default view", () => {
    expect(describeFilters(defaultFilters(LATE_EVENING_UTC), LATE_EVENING_UTC)).toBe(
      "1 Aug to 4 Oct · All lines",
    );
  });

  it("says Today when the range is just today", () => {
    const today = { ...defaultFilters(LATE_EVENING_UTC), from: "2026-10-04" };

    expect(describeFilters(today, LATE_EVENING_UTC)).toBe("Today · All lines");
  });

  it("names a range and the product line", () => {
    const filters = { productLine: "SK" as const, from: "2026-09-28", to: "2026-10-04" };

    expect(describeFilters(filters, LATE_EVENING_UTC)).toBe("28 Sep to 4 Oct · SK");
  });

  it("names a single day, with the year once it is not this year", () => {
    const day = { ...defaultFilters(LATE_EVENING_UTC), from: "2026-09-30", to: "2026-09-30" };
    const lastYear = { ...defaultFilters(LATE_EVENING_UTC), from: "2025-12-30", to: "2026-01-02" };

    expect(describeFilters(day, LATE_EVENING_UTC)).toBe("30 Sep · All lines");
    expect(describeFilters(lastYear, LATE_EVENING_UTC)).toBe("30 Dec 2025 to 2 Jan 2026 · All lines");
  });
});

describe("the request the panels send", () => {
  it("leaves out blank filters", () => {
    expect(toRequestFilters(defaultFilters(LATE_EVENING_UTC))).toEqual({
      productLine: undefined,
      from: "2026-08-01",
      to: "2026-10-04",
    });
  });
});
