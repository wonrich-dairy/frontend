import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../../../App";
import type { BatchRecordDto } from "../../../api/traceability/batches";
import { saveSession } from "../../../auth/session";
import type { Role } from "../../../auth/permissions";
import { sessionFor } from "../../../test/tokens";
import { failedBatch, summaryOf, unresolvedBatch } from "./fixtures";

// Answers the batch endpoints from a set of batches, the way the traceability service would.
function stubService(batches: BatchRecordDto[], options: { failWith?: number; recentFailures?: unknown[] } = {}) {
  const fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));

    if (options.failWith) {
      return new Response(JSON.stringify({ title: "Projection store unavailable." }), { status: options.failWith });
    }

    const id = url.pathname.match(/^\/api\/batches\/([^/]+)$/)?.[1];

    if (id) {
      const batch = batches.find((b) => b.batchId === decodeURIComponent(id));
      return batch
        ? new Response(JSON.stringify(batch), { status: 200 })
        : new Response(JSON.stringify({ title: "Batch not found" }), { status: 404 });
    }

    if (url.pathname === "/api/batches") {
      const dispatchRef = url.searchParams.get("dispatchRef");
      const batchReference = url.searchParams.get("batchReference");
      const matches = batches.filter(
        (b) => (!dispatchRef || b.dispatchRef === dispatchRef) && (!batchReference || b.batchReference === batchReference),
      );
      return new Response(JSON.stringify(matches.map(summaryOf)), { status: 200 });
    }

    // The overview's panels settle together, so the summary is answered along with the failures.
    if (options.recentFailures) {
      if (url.pathname === "/api/dashboard/recent-failures") {
        return new Response(JSON.stringify({ dataAsOf: null, batches: options.recentFailures }), { status: 200 });
      }

      if (url.pathname === "/api/dashboard/summary") {
        const none = { pending: 0, cleared: 0, failed: 0, onHold: 0 };
        return new Response(JSON.stringify({ dataAsOf: null, today: none, range: none }), { status: 200 });
      }
    }

    // The dashboard panels otherwise never resolve: these tests are not about them.
    return new Promise<Response>(() => {});
  });

  vi.stubGlobal("fetch", fetch);
  return fetch;
}

function openAs(role: Role, path: string) {
  saveSession(sessionFor(role));
  window.history.pushState({}, "", path);
  render(<App />);
}

function search(term: string) {
  fireEvent.change(screen.getByLabelText(/Batch ID, dispatch reference or WR- batch reference/), { target: { value: term } });
  fireEvent.click(screen.getByRole("button", { name: "Search" }));
}

afterEach(() => {
  saveSession(null);
  vi.unstubAllGlobals();
});

describe("the batch search form (SCRUM-137)", () => {
  it("opens the batch straight away when a batch ID matches", async () => {
    stubService([failedBatch()]);
    openAs("QualityControlOfficer", "/qco/batches");

    search("262-fm-b");

    expect(await screen.findByRole("heading", { name: "262-FM-B" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/qco/batches/262-FM-B");
  });

  it("opens the batch from a WR- batch reference", async () => {
    const fetch = stubService([failedBatch()]);
    openAs("QualityControlOfficer", "/qco/batches");

    search("WR-20260919-02");

    expect(await screen.findByRole("heading", { name: "262-FM-B" })).toBeInTheDocument();
    expect(fetch.mock.calls.some(([input]) => String(input).includes("batchReference=WR-20260919-02"))).toBe(true);
  });

  it("lists every batch a split dispatch fed, for the officer to pick", async () => {
    const second = failedBatch({ batchId: "262-FM-C", status: "Cleared", labResult: "Cleared" });
    stubService([failedBatch(), second]);
    openAs("QualityControlOfficer", "/qco/batches");

    search("DN-20260919-02");

    const results = await screen.findByRole("region", { name: "Matching batches" });
    expect(within(results).getByText(/2 batches match DN-20260919-02/)).toBeInTheDocument();

    fireEvent.click(within(results).getByRole("button", { name: /262-FM-C/ }));

    expect(window.location.pathname).toBe("/qco/batches/262-FM-C");
  });

  it("says plainly when nothing matches, without an error", async () => {
    stubService([failedBatch()]);
    openAs("QualityControlOfficer", "/qco/batches");

    search("999-FM-Z");

    expect(await screen.findByText(/No batch matches the batch ID 999-FM-Z/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("asks for a term rather than searching for nothing", () => {
    const fetch = stubService([]);
    openAs("QualityControlOfficer", "/qco/batches");

    search("   ");

    expect(screen.getByRole("alert")).toHaveTextContent("Enter a batch ID, a dispatch reference or a WR- batch reference.");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("shows a failing service as an error", async () => {
    stubService([], { failWith: 503 });
    openAs("QualityControlOfficer", "/qco/batches");

    search("DN-20260919-02");

    expect(await screen.findByRole("alert")).toHaveTextContent("Projection store unavailable.");
  });

  it("shows the results again on the way back from a batch, without reopening it", async () => {
    stubService([failedBatch()]);
    openAs("QualityControlOfficer", "/qco/batches?q=262-FM-B");

    expect(await screen.findByText("1 batch matches 262-FM-B.")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/qco/batches");
  });
});

describe("the batch timeline", () => {
  it("lists every record by checkpoint with its user, time and deviation badge", async () => {
    stubService([failedBatch()]);
    openAs("QualityControlOfficer", "/qco/batches/262-FM-B");

    const mcc = await screen.findByRole("region", { name: "MCC" });
    const events = within(mcc).getAllByRole("listitem");

    expect(events.map((e) => within(e).getByText(/registered|created/).textContent)).toEqual([
      "Consignment registered",
      "Dispatch created",
    ]);
    expect(within(events[0]).getByText("n.silva")).toBeInTheDocument();
    expect(within(events[0]).queryByText("Deviation")).not.toBeInTheDocument();
    expect(within(events[1]).getByText("Deviation")).toBeInTheDocument();
    expect(within(events[1]).getByText("Threshold failed")).toBeInTheDocument();
    expect(within(events[1]).getByText("Temperature C 12.40 against a limit of 4.00")).toBeInTheDocument();
    // The MCC records always have a person behind them, so a missing one is shown as missing.
    expect(within(events[1]).getByText("User not recorded")).toBeInTheDocument();

    const processing = screen.getByRole("region", { name: "Processing" });
    expect(within(processing).getByText("System")).toBeInTheDocument();

    expect(screen.getByText("Trace complete")).toBeInTheDocument();
  });

  it("marks missing checkpoints as missing, with the reason", async () => {
    stubService([unresolvedBatch()]);
    openAs("QualityControlOfficer", "/qco/batches/262-FM-B");

    const intake = await screen.findByRole("region", { name: "Factory intake" });
    const notice = within(intake).getByRole("note");

    expect(notice).toHaveTextContent("Missing");
    expect(notice).toHaveTextContent("The MCC and Intake Service could not supply the records.");
    expect(notice).toHaveTextContent("has no dispatch DN-20260919-02");

    // The MCC deviation is still listed, even though its records are missing.
    const mcc = screen.getByRole("region", { name: "MCC" });
    expect(within(mcc).getByText("Deviation reported")).toBeInTheDocument();

    expect(screen.getByText("Trace partial")).toBeInTheDocument();
    expect(screen.getByText(/2 of 4 checkpoints recorded; tanks and societies not resolved/)).toBeInTheDocument();
    expect(screen.getByText("Not resolved")).toBeInTheDocument();
  });

  it("says when no batch has the ID", async () => {
    stubService([]);
    openAs("QualityControlOfficer", "/qco/batches/999-FM-Z");

    expect(await screen.findByText("No batch exists with the ID 999-FM-Z.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("the backward trace", () => {
  it("opens from the timeline and highlights the first deviation", async () => {
    stubService([failedBatch()]);
    openAs("QualityControlOfficer", "/qco/batches/262-FM-B");

    fireEvent.click(await screen.findByRole("button", { name: "Trace backward" }));

    const lead = await screen.findByRole("region", { name: "First deviation" });
    expect(window.location.pathname).toBe("/qco/batches/262-FM-B/trace");
    expect(lead).toHaveTextContent("MCC");
    expect(lead).toHaveTextContent("Temperature high");
    expect(lead).toHaveTextContent("12.40 against a limit of 4.00");

    // The chain reads back from the lab, and the MCC step carries the lead.
    const steps = within(screen.getByRole("list", { name: "Checkpoints, back from the lab" })).getAllByRole("heading", { level: 3 });
    expect(steps.map((s) => s.textContent)).toEqual(["Quality lab", "Processing", "Factory intake", "MCC"]);
    expect(steps[3].closest("li")).toHaveClass("chain__step--first");
  });

  it("ranks the contributing tanks and societies by quantity", async () => {
    stubService([failedBatch()]);
    openAs("QualityControlOfficer", "/qco/batches/262-FM-B/trace");

    const tanks = await screen.findByRole("list", { name: "Contributing tanks, most drawn first" });
    expect(within(tanks).getAllByRole("listitem").map((t) => within(t).getByText(/^T-0/).textContent)).toEqual(["T-01", "T-02"]);
    expect(within(tanks).getByText("1000.0 L")).toBeInTheDocument();
    expect(within(tanks).getByText("67% drawn")).toBeInTheDocument();

    const societies = screen.getByRole("list", { name: "Contributing societies, largest share first" });
    expect(within(societies).getAllByRole("listitem").map((s) => s.querySelector("strong")?.textContent)).toEqual([
      "Lake Farmers",
      "Hill Dairy",
    ]);
    expect(within(societies).getByText("900.0 L")).toBeInTheDocument();
  });

  it("shows unresolved tanks and societies as missing, and does not call a gappy trace clean", async () => {
    const batch = unresolvedBatch();
    batch.checkpoints.forEach((s) => (s.deviations = []));
    stubService([batch]);
    openAs("QualityControlOfficer", "/qco/batches/262-FM-B/trace");

    expect(await screen.findByText("No deviation was recorded in the data received.")).toBeInTheDocument();
    expect(screen.getByText(/MCC, Factory intake have no data, so a deviation there would not show here/)).toBeInTheDocument();
    expect(screen.getByText("Not resolved")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: /Contributing tanks/ })).not.toBeInTheDocument();
  });
});

describe("access to the batch screens", () => {
  const paths = ["/qco/batches", "/qco/batches/262-FM-B", "/qco/batches/262-FM-B/trace"];

  it("opens them for the Quality Control Officer and the administrator", async () => {
    for (const role of ["QualityControlOfficer", "SystemAdministrator"] as const) {
      for (const path of paths) {
        stubService([failedBatch()]);
        openAs(role, path);

        expect(screen.queryByText("Not available to you")).not.toBeInTheDocument();
        await waitFor(() => expect(screen.queryByText(/Loading/)).not.toBeInTheDocument());

        cleanup();
      }
    }
  });

  it("refuses every other role, without asking the service", () => {
    for (const role of ["QualityAnalyst", "ProcessingTechnician", "ProductionManager", "IntakeOfficer"] as const) {
      for (const path of paths) {
        const fetch = stubService([failedBatch()]);
        openAs(role, path);

        expect(screen.getByText("Not available to you")).toBeInTheDocument();
        expect(fetch.mock.calls.some(([input]) => String(input).includes("/api/batches"))).toBe(false);

        cleanup();
      }
    }
  });

  it("is reached from the Batches tab", () => {
    stubService([failedBatch()]);
    openAs("QualityControlOfficer", "/qco");

    fireEvent.click(screen.getByRole("button", { name: /batches/i }));

    expect(window.location.pathname).toBe("/qco/batches");
    expect(screen.getByRole("heading", { name: "Find a batch" })).toBeInTheDocument();
  });

  it("is reached from a recent failure on the dashboard", async () => {
    stubService([failedBatch()], {
      recentFailures: [
        { batchId: "262-FM-B", batchReference: "WR-20260919-02", productLine: "FM", facility: "FACTORY-01", failedAt: "2026-09-19T09:00:00Z", reasonCodes: ["LOW_PH"], tracePath: "/api/batches/262-FM-B" },
      ],
    });
    openAs("QualityControlOfficer", "/qco");

    fireEvent.click(await screen.findByRole("button", { name: "262-FM-B" }));

    expect(window.location.pathname).toBe("/qco/batches/262-FM-B");
    expect(await screen.findByRole("heading", { name: "262-FM-B" })).toBeInTheDocument();
  });
});
