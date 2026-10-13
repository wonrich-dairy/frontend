import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../../../App";
import type { AuditCoverageDto, AuditTrailEntryDto, AuditTrailPageDto } from "../../../api/traceability/audit";
import { saveSession } from "../../../auth/session";
import type { Role } from "../../../auth/permissions";
import { sessionFor } from "../../../test/tokens";

const ENTRIES: AuditTrailEntryDto[] = [
  {
    id: "audit-2",
    occurredAt: "2026-10-13T04:00:00Z",
    user: "qco-1",
    action: "BatchSearchExported",
    checkpoint: null,
    batchId: null,
    facility: null,
    source: "Traceability",
    reference: "batches_all_exported-2026-10-13.csv",
    details: { rowCount: 12, role: "QualityControlOfficer" },
  },
  {
    id: "event-9",
    occurredAt: "2026-09-20T06:00:00Z",
    user: "proc.tech-1",
    action: "ProcessingHoldRaised",
    checkpoint: "Processing",
    batchId: "262-FM-B",
    facility: "FACTORY-01",
    source: "ConsumedEvent",
    reference: "7f8e5a8c-0000-4000-8000-000000000009",
  },
  {
    id: "event-8",
    occurredAt: "2026-09-19T06:00:00Z",
    user: null,
    action: "ProcessingStageRecorded",
    checkpoint: "Processing",
    batchId: "262-FM-B",
    facility: "FACTORY-01",
    source: "ConsumedEvent",
    reference: "7f8e5a8c-0000-4000-8000-000000000008",
  },
  {
    id: "dispatch-3",
    occurredAt: "2026-09-19T02:00:00Z",
    user: "mcc.manager-1",
    action: "MilkDispatched",
    checkpoint: "Mcc",
    batchId: "262-FM-B",
    facility: "FACTORY-01",
    source: "UpstreamSnapshot",
    reference: "DN-20260919-02",
  },
];

const COVERAGE: AuditCoverageDto = {
  covered: [
    { action: "MilkDispatched", checkpoint: "Mcc", source: "UpstreamSnapshot", description: "The dispatch note. User: who dispatched it." },
    { action: "ProcessingHoldRaised", checkpoint: "Processing", source: "ConsumedEvent", description: "A hold raised. User: who raised it." },
    { action: "BatchTraceOpened", checkpoint: null, source: "Traceability", description: "A backward trace opened." },
  ],
  notCovered: [
    { action: "Edits made in Processing or Quality Lab without an event", reason: "Only events reach Traceability." },
    { action: "Users, roles and society master data", reason: "Managed elsewhere, with no events." },
  ],
  documentation: "docs/audit-trail.md",
};

// The trail answers `total` entries, 50 to a page, cycling through ENTRIES; the coverage list
// answers COVERAGE. A status makes either fail instead.
function stubService(options: { total?: number; auditStatus?: number; coverageStatus?: number } = {}) {
  const total = options.total ?? ENTRIES.length;

  const fetch = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = new URL(String(input));

    if (url.pathname === "/api/audit") {
      if (options.auditStatus) {
        return new Response(JSON.stringify({ title: "The audit trail is unavailable." }), { status: options.auditStatus });
      }

      const page = Number(url.searchParams.get("page"));
      const first = (page - 1) * 50;
      const count = Math.max(0, Math.min(50, total - first));
      const body: AuditTrailPageDto = {
        items: Array.from({ length: count }, (_, i) => ({ ...ENTRIES[(first + i) % ENTRIES.length], id: `entry-${first + i}` })),
        page,
        pageSize: 50,
        totalCount: total,
        totalPages: Math.ceil(total / 50),
        message: total === 0 ? "No audit entries match these filters. Remove or change a filter and search again." : null,
        filters: {},
      };
      return new Response(JSON.stringify(body), { status: 200 });
    }

    if (url.pathname === "/api/audit/coverage") {
      return options.coverageStatus
        ? new Response("", { status: options.coverageStatus })
        : new Response(JSON.stringify(COVERAGE), { status: 200 });
    }

    return new Promise<Response>(() => {});
  });

  vi.stubGlobal("fetch", fetch);
  return fetch;
}

function calls(fetch: ReturnType<typeof stubService>, path: string): URL[] {
  return fetch.mock.calls.map(([input]) => new URL(String(input))).filter((url) => url.pathname === path);
}

function openAt(path: string, role: Role = "QualityControlOfficer") {
  saveSession(sessionFor(role));
  window.history.pushState({}, "", path);
  render(<App />);
}

function filterForm() {
  return within(screen.getByRole("form", { name: "Audit trail filters" }));
}

afterEach(() => {
  cleanup();
  saveSession(null);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the audit trail screen (SCRUM-138)", () => {
  it("opens on the first page of every entry, newest first", async () => {
    const fetch = stubService();
    openAt("/qco/audit");

    expect(screen.getByRole("heading", { name: "Audit trail" })).toBeInTheDocument();
    const results = await screen.findByRole("region", { name: "Audit entries" });
    expect(within(results).getByText("4 entries, newest first. Times are in Colombo.")).toBeInTheDocument();

    const [request] = calls(fetch, "/api/audit");
    expect(Object.fromEntries(request.searchParams)).toEqual({ page: "1" });
  });

  it("shows time, user, action, checkpoint, batch and source for each entry", async () => {
    stubService();
    openAt("/qco/audit");

    const rows = within(await screen.findByRole("table")).getAllByRole("row");
    const hold = rows.find((row) => row.textContent?.includes("Processing hold raised"))!;

    // 06:00 UTC is 11:30 in Colombo.
    expect(within(hold).getByText(/20\/09\/2026.*11:30/)).toBeInTheDocument();
    expect(within(hold).getByText("proc.tech-1")).toBeInTheDocument();
    expect(within(hold).getByText("Processing", { selector: "td" })).toBeInTheDocument();
    expect(within(hold).getByRole("button", { name: "262-FM-B" })).toBeInTheDocument();
    expect(within(hold).getByText("FACTORY-01")).toBeInTheDocument();
    expect(within(hold).getByText("Event", { selector: "td" })).toBeInTheDocument();
    expect(within(hold).getByText("Event 7f8e5a8c-0000-4000-8000-000000000009")).toBeInTheDocument();

    const dispatch = rows.find((row) => row.textContent?.includes("Milk dispatched"))!;
    expect(within(dispatch).getByText("MCC")).toBeInTheDocument();
    expect(within(dispatch).getByText("Upstream snapshot")).toBeInTheDocument();
    expect(within(dispatch).getByText("DN-20260919-02")).toBeInTheDocument();
  });

  it("never leaves a cell blank: a user, checkpoint or batch not recorded says so", async () => {
    stubService();
    openAt("/qco/audit");

    const rows = within(await screen.findByRole("table")).getAllByRole("row");
    const stage = rows.find((row) => row.textContent?.includes("Processing stage recorded"))!;
    expect(within(stage).getByText("Not recorded")).toBeInTheDocument();

    const exported = rows.find((row) => row.textContent?.includes("Batch search exported"))!;
    expect(within(exported).getByText("None")).toBeInTheDocument();
    expect(within(exported).getByText("Several batches")).toBeInTheDocument();
    expect(within(exported).getByText("batches_all_exported-2026-10-13.csv (12 batches)")).toBeInTheDocument();
    expect(within(exported).getByText("Traceability", { selector: "td" })).toBeInTheDocument();
  });

  it("asks for the filters given and keeps them in the URL", async () => {
    const fetch = stubService();
    openAt("/qco/audit");
    await screen.findByRole("region", { name: "Audit entries" });

    const form = filterForm();
    fireEvent.change(form.getByLabelText("User"), { target: { value: " proc.tech-1 " } });
    fireEvent.change(form.getByLabelText("Action"), { target: { value: "ProcessingHoldRaised" } });
    fireEvent.change(form.getByLabelText("From"), { target: { value: "2026-09-19" } });
    fireEvent.change(form.getByLabelText("To"), { target: { value: "2026-09-21" } });
    fireEvent.change(form.getByLabelText("Batch ID"), { target: { value: "262-FM-B" } });
    fireEvent.click(form.getByRole("button", { name: "Show entries" }));

    await waitFor(() => expect(calls(fetch, "/api/audit")).toHaveLength(2));
    expect(Object.fromEntries(calls(fetch, "/api/audit")[1].searchParams)).toEqual({
      user: "proc.tech-1",
      action: "ProcessingHoldRaised",
      from: "2026-09-19",
      to: "2026-09-21",
      batchId: "262-FM-B",
      page: "1",
    });
    expect(window.location.search).toBe("?user=proc.tech-1&action=ProcessingHoldRaised&from=2026-09-19&to=2026-09-21&batchId=262-FM-B");
  });

  it("opens with the filters in the link already applied", async () => {
    const fetch = stubService({ total: 120 });
    openAt("/qco/audit?user=qco-1&page=2");

    await screen.findByRole("region", { name: "Audit entries" });
    expect(Object.fromEntries(calls(fetch, "/api/audit")[0].searchParams)).toEqual({ user: "qco-1", page: "2" });
    expect(filterForm().getByLabelText("User")).toHaveValue("qco-1");
  });

  it("suggests the covered actions in the action filter", async () => {
    stubService();
    openAt("/qco/audit");

    const input = filterForm().getByLabelText("Action");
    const list = document.getElementById(input.getAttribute("list")!)!;
    await waitFor(() => expect(list.querySelectorAll("option")).toHaveLength(COVERAGE.covered.length));
    expect(list.querySelector('option[value="ProcessingHoldRaised"]')).toHaveTextContent("Processing hold raised");
  });

  it("still filters when the action suggestions cannot be read", async () => {
    stubService({ coverageStatus: 500 });
    openAt("/qco/audit");

    expect(await screen.findByRole("region", { name: "Audit entries" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("refuses a range that ends before it starts, without asking", async () => {
    const fetch = stubService();
    openAt("/qco/audit");
    await screen.findByRole("region", { name: "Audit entries" });

    const form = filterForm();
    fireEvent.change(form.getByLabelText("From"), { target: { value: "2026-09-21" } });
    fireEvent.change(form.getByLabelText("To"), { target: { value: "2026-09-19" } });
    fireEvent.click(form.getByRole("button", { name: "Show entries" }));

    expect(form.getByText("The start date must be on or before the end date.")).toBeInTheDocument();
    expect(calls(fetch, "/api/audit")).toHaveLength(1);
  });

  it("says plainly when nothing matches", async () => {
    stubService({ total: 0 });
    openAt("/qco/audit?user=nobody");

    expect(await screen.findByText(/No audit entries match these filters/)).toHaveAttribute("role", "status");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("pages through the entries, fifty at a time", async () => {
    const fetch = stubService({ total: 120 });
    openAt("/qco/audit?action=BatchFailed");

    const results = await screen.findByRole("region", { name: "Audit entries" });
    expect(within(results).getByText("Showing 1–50 of 120 entries, newest first. Times are in Colombo.")).toBeInTheDocument();

    fireEvent.click(within(results).getByRole("button", { name: "Next" }));

    expect(await screen.findByText("Showing 51–100 of 120 entries, newest first. Times are in Colombo.")).toBeInTheDocument();
    expect(Object.fromEntries(calls(fetch, "/api/audit").at(-1)!.searchParams)).toEqual({ action: "BatchFailed", page: "2" });
    expect(window.location.search).toBe("?action=BatchFailed&page=2");
  });

  it("opens an entry's batch timeline", async () => {
    stubService();
    openAt("/qco/audit");

    const rows = within(await screen.findByRole("table")).getAllByRole("row");
    fireEvent.click(within(rows.find((row) => row.textContent?.includes("Milk dispatched"))!).getByRole("button", { name: "262-FM-B" }));

    expect(window.location.pathname).toBe("/qco/batches/262-FM-B");
  });

  it("shows the service's error when the trail cannot be loaded", async () => {
    stubService({ auditStatus: 503 });
    openAt("/qco/audit");

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("only reads: nothing on the screen edits or removes an entry", async () => {
    const fetch = stubService();
    openAt("/qco/audit");
    await screen.findByRole("table");

    expect(screen.queryByRole("button", { name: /edit|delete|remove/i })).not.toBeInTheDocument();
    expect(fetch.mock.calls.every(([, init]) => (init?.method ?? "GET") === "GET")).toBe(true);
  });

  it("is a tab in the QCO shell", async () => {
    stubService();
    openAt("/qco/batches");

    fireEvent.click(screen.getByRole("button", { name: "AUDIT" }));

    expect(window.location.pathname).toBe("/qco/audit");
    expect(await screen.findByRole("heading", { name: "Audit trail" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "AUDIT" })).toHaveAttribute("aria-current", "page");
  });
});

describe("the audit coverage page (SCRUM-138)", () => {
  it("is linked from the audit trail", async () => {
    stubService();
    openAt("/qco/audit");

    fireEvent.click(screen.getByRole("button", { name: "What the audit trail covers, and what it does not" }));

    expect(window.location.pathname).toBe("/qco/audit/coverage");
    expect(await screen.findByRole("heading", { name: "What the audit trail covers" })).toBeInTheDocument();
  });

  it("lists each covered action with its checkpoint, source and what it records", async () => {
    stubService();
    openAt("/qco/audit/coverage");

    const covered = await screen.findByRole("region", { name: "Covered (3)" });
    const hold = within(covered).getAllByRole("row").find((row) => row.textContent?.includes("ProcessingHoldRaised"))!;
    expect(within(hold).getByRole("button", { name: "Processing hold raised" })).toBeInTheDocument();
    expect(within(hold).getByText("Processing", { selector: "td" })).toBeInTheDocument();
    expect(within(hold).getByText("Event")).toBeInTheDocument();
    expect(within(hold).getByText("A hold raised. User: who raised it.")).toBeInTheDocument();

    const opened = within(covered).getAllByRole("row").find((row) => row.textContent?.includes("BatchTraceOpened"))!;
    expect(within(opened).getByText("None")).toBeInTheDocument();
  });

  it("lists what is not covered, with the reason", async () => {
    stubService();
    openAt("/qco/audit/coverage");

    const gaps = await screen.findByRole("region", { name: "Not covered (2)" });
    expect(within(gaps).getByText("Edits made in Processing or Quality Lab without an event")).toBeInTheDocument();
    expect(within(gaps).getByText("Only events reach Traceability.")).toBeInTheDocument();
    expect(screen.getByText("docs/audit-trail.md")).toBeInTheDocument();
  });

  it("opens the trail on one covered action", async () => {
    stubService();
    openAt("/qco/audit/coverage");

    fireEvent.click(await screen.findByRole("button", { name: "Milk dispatched" }));

    expect(window.location.pathname).toBe("/qco/audit");
    expect(window.location.search).toBe("?action=MilkDispatched");
  });

  it("goes back to the trail", async () => {
    stubService();
    openAt("/qco/audit/coverage");

    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(window.location.pathname).toBe("/qco/audit");
  });

  it("shows an error when the list cannot be loaded", async () => {
    stubService({ coverageStatus: 500 });
    openAt("/qco/audit/coverage");

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});

describe("who may read the audit trail", () => {
  it("opens both pages for the administrator", async () => {
    stubService();
    openAt("/qco/audit", "SystemAdministrator");
    expect(await screen.findByRole("heading", { name: "Audit trail" })).toBeInTheDocument();
    cleanup();

    openAt("/qco/audit/coverage", "SystemAdministrator");
    expect(await screen.findByRole("heading", { name: "What the audit trail covers" })).toBeInTheDocument();
  });

  it("refuses every other role on both pages, without asking the service", () => {
    const fetch = stubService();

    for (const role of ["QualityAnalyst", "ProductionManager", "ProcessingTechnician", "MccManager"] as const) {
      for (const path of ["/qco/audit", "/qco/audit/coverage"]) {
        openAt(path, role);

        expect(screen.getByText("Not available to you")).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "Audit trail" })).not.toBeInTheDocument();

        cleanup();
      }
    }

    expect(calls(fetch, "/api/audit")).toHaveLength(0);
    expect(calls(fetch, "/api/audit/coverage")).toHaveLength(0);
  });
});
