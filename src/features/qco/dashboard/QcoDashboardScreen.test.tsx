import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../../App";
import { saveSession } from "../../../auth/session";
import { sessionFor } from "../../../test/tokens";
import { REFRESH_MS } from "./useQcoDashboard";

const AS_OF = "2026-10-04T08:30:00Z";

const BODIES: Record<string, unknown> = {
  summary: {
    dataAsOf: AS_OF,
    today: { pending: 4, cleared: 11, failed: 2, onHold: 1 },
    range: { pending: 4, cleared: 11, failed: 2, onHold: 1 },
  },
  deviations: { dataAsOf: AS_OF, checkpoints: [{ checkpoint: "Lab", count: 3 }] },
  trend: {
    dataAsOf: AS_OF,
    points: [{ date: "2026-10-04", productLine: "DY", batchCount: 8, clearedCount: 6, failedCount: 2, failRate: 0.25 }],
  },
  "failure-reasons": { dataAsOf: AS_OF, reasons: [{ reasonCode: "LOW_FAT", count: 2 }] },
  "marginal-societies": {
    dataAsOf: AS_OF,
    societies: [],
    source: "upstream snapshots",
    coverage: "Societies that contributed to a batch",
  },
  "recent-failures": {
    dataAsOf: AS_OF,
    batches: [
      {
        batchId: "277-DY-A",
        batchReference: "WR-20261004-01",
        productLine: "DY",
        facility: "FACTORY-01",
        failedAt: AS_OF,
        reasonCodes: ["LOW_FAT", "PhLow", "SensoryAbnormal", "TemperatureHigh"],
        tracePath: "/trace/277-DY-A",
      },
    ],
  },
};

function stubFetch(failing: string[] = []) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const endpoint = new URL(String(input)).pathname.split("/").pop() ?? "";

    if (failing.includes(endpoint)) {
      return new Response(JSON.stringify({ title: "Projection store unavailable." }), { status: 503 });
    }

    return new Response(JSON.stringify(BODIES[endpoint]), { status: 200 });
  });
}

function openDashboard(path = "/qco") {
  saveSession(sessionFor("QualityControlOfficer"));
  window.history.pushState({}, "", path);
  render(<App />);
}

function panel(title: string) {
  return screen.getByRole("region", { name: title });
}

function setHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  setHidden(false);
  saveSession(null);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function endpoints(fetch: ReturnType<typeof stubFetch>): string[] {
  return fetch.mock.calls.map(([input]) => new URL(String(input)).pathname.split("/").pop() ?? "").sort();
}

describe("the QCO dashboard", () => {
  it("shows what is happening now on the overview, with the server's freshness time in Colombo", async () => {
    const fetch = stubFetch();
    vi.stubGlobal("fetch", fetch);
    openDashboard();

    expect(await within(panel("Recent failures")).findByText("277-DY-A")).toBeInTheDocument();
    const reasons = within(panel("Recent failures")).getByLabelText("Failure reasons");
    expect(within(reasons).getByText("Fat % below minimum")).toHaveClass("badge--bad");
    expect(within(reasons).getByText("pH low")).toHaveClass("badge--bad");
    expect(within(reasons).getByText("Sensory abnormal")).toHaveClass("badge--bad");
    expect(within(reasons).getByText("Temperature high")).toHaveClass("badge--bad");
    expect(within(panel("Batch status")).getByText("11")).toBeInTheDocument();
    expect(screen.getByText("Last updated 04/10/2026, 14:00")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Failure reasons" })).not.toBeInTheDocument();
    expect(endpoints(fetch)).toEqual(["recent-failures", "summary"]);
  });

  it("puts each group of panels on its own tab, and loads only what that tab shows", async () => {
    const tabs: [string, string, string, string[]][] = [
      ["/qco/trends", "Fail rate by day", "25.0%", ["trend"]],
      ["/qco/causes", "Failure reasons", "Fat % below minimum", ["deviations", "failure-reasons"]],
      ["/qco/societies", "Most marginal societies", "No society data in this range.", ["marginal-societies"]],
    ];

    for (const [path, title, text, expected] of tabs) {
      const fetch = stubFetch();
      vi.stubGlobal("fetch", fetch);
      openDashboard(path);

      expect(await within(panel(title)).findByText(text)).toBeInTheDocument();
      expect(screen.queryByRole("region", { name: "Batch status" })).not.toBeInTheDocument();
      expect(endpoints(fetch)).toEqual(expected);

      cleanup();
    }
  });

  it("keeps the other panel when one endpoint fails", async () => {
    vi.stubGlobal("fetch", stubFetch(["deviations"]));
    openDashboard("/qco/causes");

    expect(await within(panel("Deviations by checkpoint")).findByRole("alert")).toHaveTextContent(
      "Projection store unavailable.",
    );
    expect(within(panel("Failure reasons")).getByText("Fat % below minimum")).toBeInTheDocument();
  });

  it("lists a failed batch with its batch reference", async () => {
    vi.stubGlobal("fetch", stubFetch());
    openDashboard();

    expect(await within(panel("Recent failures")).findByText(/WR-20261004-01 · DY · FACTORY-01/)).toBeInTheDocument();
  });

  it("gives the fail rate out of all the day's batches, pending ones included", async () => {
    const body = {
      dataAsOf: AS_OF,
      points: [
        // Nothing decided yet: none of the two has failed.
        { date: "2026-10-03", productLine: "DY", batchCount: 2, clearedCount: 0, failedCount: 0, failRate: 0 },
        // One failed of four, with two still pending.
        { date: "2026-10-04", productLine: "DY", batchCount: 4, clearedCount: 1, failedCount: 1, failRate: 0.25 },
      ],
    };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })));
    openDashboard("/qco/trends");

    const rows = within(await screen.findByRole("table")).getAllByRole("row").slice(1);

    expect(rows[0]).toHaveTextContent("0 / 2");
    expect(rows[0]).toHaveTextContent("0.0%");
    expect(rows[1]).toHaveTextContent("1 / 4");
    expect(rows[1]).toHaveTextContent("25.0%");
    expect(rows[1]).not.toHaveTextContent("50.0%");
  });

  it("opens a failed batch's timeline from its code", async () => {
    vi.stubGlobal("fetch", stubFetch());
    openDashboard();

    fireEvent.click(await screen.findByRole("button", { name: "277-DY-A" }));

    expect(window.location.pathname).toBe("/qco/batches/277-DY-A");
  });

  it("ranks the marginal societies, showing unscored entries and uppercase measure labels", async () => {
    const body = {
      dataAsOf: AS_OF,
      source: "upstream snapshots",
      coverage: "societies that contributed to a batch in range",
      societies: [
        { societyCode: "VS002", societyName: "Lake Farmers", consignmentCount: 1, batchCount: 1, tightestMargin: 0.01, tightestMeasure: "Snf" },
        { societyCode: "VS003", societyName: null, consignmentCount: 2, batchCount: 1, tightestMargin: null, tightestMeasure: null },
      ],
    };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })));
    openDashboard("/qco/societies");

    const rows = within(await screen.findByRole("table")).getAllByRole("row").slice(1);

    expect(rows[0]).toHaveTextContent("Lake Farmers");
    expect(rows[0]).toHaveTextContent("0.01");
    expect(rows[0]).toHaveTextContent("SNF");
    expect(rows[1]).toHaveTextContent("VS003");
    expect(rows[1]).toHaveTextContent("Not scored");
    expect(panel("Most marginal societies")).not.toHaveTextContent("Source:");
  });

  it("names the MCC checkpoint as the service sends it", async () => {
    const body = { dataAsOf: AS_OF, checkpoints: [{ checkpoint: "Mcc", count: 2 }] };
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes("/deviations")
        ? new Response(JSON.stringify(body), { status: 200 })
        : new Response(JSON.stringify(BODIES["failure-reasons"]), { status: 200 }),
    ));
    openDashboard("/qco/causes");

    expect(await within(panel("Deviations by checkpoint")).findByRole("rowheader", { name: "MCC" })).toBeInTheDocument();
  });

  it("keeps the filters in the link when switching tabs, and sends them with every request", async () => {
    const fetch = stubFetch();
    vi.stubGlobal("fetch", fetch);
    const filters = "?facility=FACTORY-01&productLine=DY&from=2026-09-01&to=2026-09-30";
    openDashboard(`/qco${filters}`);
    await screen.findByText("277-DY-A");

    const nav = screen.getByRole("navigation", { name: "Quality Control Sections" });
    expect(within(nav).getAllByRole("button").map((tab) => tab.textContent)).toEqual([
      "OVERVIEW",
      "TRENDS",
      "CAUSES",
      "SOCIETIES",
      "BATCHES",
    ]);

    fireEvent.click(within(nav).getByRole("button", { name: "TRENDS" }));

    expect(window.location.pathname + window.location.search).toBe(
      "/qco/trends?productLine=DY&from=2026-09-01&to=2026-09-30",
    );
    // The product line is filtered to DY, so the trend shows DY without its own line picker.
    expect(await within(panel("Fail rate by day")).findByText("25.0%")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Trend product line" })).not.toBeInTheDocument();

    for (const [input] of fetch.mock.calls) {
      const params = new URL(String(input)).searchParams;

      expect(params.has("facility")).toBe(false);
      expect(params.get("productLine")).toBe("DY");
      expect(params.get("from")).toBe("2026-09-01");
      expect(params.get("to")).toBe("2026-09-30");
    }

    // The batch screens take no dashboard filters, so the Batches tab does not carry them.
    fireEvent.click(within(nav).getByRole("button", { name: "BATCHES" }));

    expect(window.location.pathname + window.location.search).toBe("/qco/batches");
  });

  it("folds the filters into one line on a phone, which opens the form", async () => {
    vi.stubGlobal("fetch", stubFetch());
    openDashboard();

    const toggle = screen.getByRole("button", { name: /Today · All lines/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("form", { name: "Dashboard filters" })).toHaveClass("qcofilters--folded");

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("form", { name: "Dashboard filters" })).not.toHaveClass("qcofilters--folded");
  });

  it("writes applied filters to the URL and refuses a backwards range", async () => {
    vi.stubGlobal("fetch", stubFetch());
    openDashboard();
    await screen.findByText("277-DY-A");

    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-09-30" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-09-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(screen.getByRole("alert")).toHaveTextContent("on or before");
    expect(window.location.search).toBe("");

    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-10-02" } });
    fireEvent.change(screen.getByLabelText("Product line"), { target: { value: "SK" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(window.location.search).toBe("?productLine=SK&from=2026-09-30&to=2026-10-02");
  });

  it("refreshes on an interval, and not while the page is hidden", async () => {
    const fetch = stubFetch();
    vi.stubGlobal("fetch", fetch);
    openDashboard();
    await screen.findByText("277-DY-A");
    expect(fetch).toHaveBeenCalledTimes(2);

    await act(() => vi.advanceTimersByTimeAsync(REFRESH_MS));
    expect(fetch).toHaveBeenCalledTimes(4);

    act(() => setHidden(true));
    await act(() => vi.advanceTimersByTimeAsync(REFRESH_MS * 3));
    expect(fetch).toHaveBeenCalledTimes(4);

    act(() => setHidden(false));
    expect(fetch).toHaveBeenCalledTimes(6);
  });
});
