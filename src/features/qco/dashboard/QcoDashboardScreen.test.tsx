import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../../App";
import { saveSession } from "../../../auth/session";
import { sessionFor } from "../../../test/tokens";
import { REFRESH_MS } from "./useQcoDashboard";

const AS_OF = "2026-10-04T08:30:00Z";

const BODIES: Record<string, unknown> = {
  summary: {
    dataAsOfUtc: AS_OF,
    today: { pending: 4, cleared: 11, failed: 2, onHold: 1 },
    range: { pending: 4, cleared: 11, failed: 2, onHold: 1 },
  },
  deviations: { dataAsOfUtc: AS_OF, checkpoints: [{ checkpoint: "Lab", count: 3 }] },
  trend: {
    dataAsOfUtc: AS_OF,
    points: [{ date: "2026-10-04", productLine: "DY", batchCount: 8, failedCount: 2, failRate: 0.25 }],
  },
  "failure-reasons": { dataAsOfUtc: AS_OF, reasons: [{ reasonCode: "LOW_FAT", count: 2 }] },
  "marginal-societies": {
    dataAsOfUtc: AS_OF,
    societies: [],
    dataSource: "Intake quality tests",
    coverage: "Societies that contributed to a batch",
  },
  "recent-failures": {
    dataAsOfUtc: AS_OF,
    batches: [
      {
        batchCode: "277-DY-A",
        productLine: "DY",
        facility: "FACTORY-01",
        failedAtUtc: AS_OF,
        reasonCodes: ["LOW_FAT"],
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

  it("shows a failed batch as plain text, not a link to a trace the QCO cannot open", async () => {
    vi.stubGlobal("fetch", stubFetch());
    openDashboard();

    const code = await screen.findByText("277-DY-A");

    expect(code.closest("a")).toBeNull();
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
    ]);

    fireEvent.click(within(nav).getByRole("button", { name: "TRENDS" }));

    expect(window.location.pathname + window.location.search).toBe(`/qco/trends${filters}`);
    // The product line is filtered to DY, so the trend shows DY without its own line picker.
    expect(await within(panel("Fail rate by day")).findByText("25.0%")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Trend product line" })).not.toBeInTheDocument();

    for (const [input] of fetch.mock.calls) {
      const params = new URL(String(input)).searchParams;

      expect(params.get("facility")).toBe("FACTORY-01");
      expect(params.get("productLine")).toBe("DY");
      expect(params.get("from")).toBe("2026-09-01");
      expect(params.get("to")).toBe("2026-09-30");
    }
  });

  it("folds the filters into one line on a phone, which opens the form", async () => {
    vi.stubGlobal("fetch", stubFetch());
    openDashboard();

    const toggle = screen.getByRole("button", { name: /Today · All lines · All facilities/ });
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
