import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../../App";
import type { BatchSearchPageDto, BatchSearchRowDto } from "../../../api/traceability/batches";
import { saveSession } from "../../../auth/session";
import { sessionFor } from "../../../test/tokens";

const FILE_NAME = "batches_status-Failed_line-FM_exported-2026-10-13.csv";

function row(n: number, overrides: Partial<BatchSearchRowDto> = {}): BatchSearchRowDto {
  return {
    batchId: `262-FM-${n}`,
    dispatchRef: `DN-20260919-${n}`,
    batchReference: null,
    productLine: "FM",
    facility: "FACTORY-01",
    status: "Failed",
    completeness: "Partial",
    firstEventAt: "2026-09-19T05:00:00Z",
    lastEventAt: "2026-09-19T11:00:00Z",
    labResult: "Failed",
    upstreamStatus: "Resolved",
    tanks: ["T1"],
    societies: [{ code: "VS001", name: "Galle" }],
    users: ["analyst-1"],
    deviationCount: 1,
    reasonCodes: ["LOW_FAT"],
    labParameters: [],
    ...overrides,
  };
}

// The search answers `total` batches, 50 to a page; the export answers a CSV naming them.
function stubService(options: { total?: number; exportStatus?: number } = {}) {
  const total = options.total ?? 2;

  // init is read back by the export test, for the Authorization header.
  const fetch = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = new URL(String(input));

    if (url.pathname === "/api/batches/search") {
      const page = Number(url.searchParams.get("page"));
      const first = (page - 1) * 50;
      const count = Math.max(0, Math.min(50, total - first));
      const body: BatchSearchPageDto = {
        items: Array.from({ length: count }, (_, i) => row(first + i + 1)),
        page,
        pageSize: 50,
        totalCount: total,
        totalPages: Math.ceil(total / 50),
        message: total === 0 ? "No batches match these filters. Remove or change a filter and search again." : null,
        filters: {},
      };
      return new Response(JSON.stringify(body), { status: 200 });
    }

    if (url.pathname === "/api/batches/export") {
      if (options.exportStatus) {
        return new Response("", { status: options.exportStatus });
      }

      return new Response("﻿Batch ID\r\n262-FM-1\r\n", {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename=${FILE_NAME}; filename*=UTF-8''${FILE_NAME}`,
          "X-Batch-Count": String(total),
        },
      });
    }

    // The lookup and the dashboard are not what these tests are about.
    return new Promise<Response>(() => {});
  });

  vi.stubGlobal("fetch", fetch);
  return fetch;
}

function calls(fetch: ReturnType<typeof stubService>, path: string): URL[] {
  return fetch.mock.calls.map(([input]) => new URL(String(input))).filter((url) => url.pathname === path);
}

function openAt(path: string) {
  saveSession(sessionFor("QualityControlOfficer"));
  window.history.pushState({}, "", path);
  render(<App />);
}

function filterForm() {
  return within(screen.getByRole("form", { name: "Batch filters" }));
}

beforeEach(() => {
  // jsdom has no object URLs and does not follow a download link.
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:export"), revokeObjectURL: vi.fn() }));
});

afterEach(() => {
  cleanup();
  saveSession(null);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("filtering batches (SCRUM-139)", () => {
  it("searches nothing until the filters are applied", () => {
    const fetch = stubService();
    openAt("/qco/batches");

    expect(screen.getByRole("heading", { name: "Filter batches" })).toBeInTheDocument();
    expect(calls(fetch, "/api/batches/search")).toHaveLength(0);
  });

  it("asks for the filters given and lists the batches with the total", async () => {
    const fetch = stubService();
    openAt("/qco/batches");

    const form = filterForm();
    fireEvent.change(form.getByLabelText("Status"), { target: { value: "Failed" } });
    fireEvent.change(form.getByLabelText("Product line"), { target: { value: "FM" } });
    fireEvent.change(form.getByLabelText("Society"), { target: { value: " VS001 " } });
    fireEvent.change(form.getByLabelText("User"), { target: { value: "analyst-1" } });
    fireEvent.click(form.getByRole("button", { name: "Show batches" }));

    const results = await screen.findByRole("region", { name: "Filtered batches" });
    expect(within(results).getByText("2 batches, newest first.")).toBeInTheDocument();
    expect(within(results).getByRole("button", { name: /262-FM-1/ })).toHaveTextContent("Reasons LOW_FAT");

    const [request] = calls(fetch, "/api/batches/search");
    expect(Object.fromEntries(request.searchParams)).toEqual({
      status: "Failed",
      productLine: "FM",
      society: "VS001",
      user: "analyst-1",
      page: "1",
    });
    expect(window.location.search).toBe("?status=Failed&productLine=FM&society=VS001&user=analyst-1&page=1");
  });

  it("opens a batch from the results", async () => {
    stubService();
    openAt("/qco/batches?status=Failed&page=1");

    fireEvent.click(await screen.findByRole("button", { name: /262-FM-2/ }));

    expect(window.location.pathname).toBe("/qco/batches/262-FM-2");
  });

  it("runs the search in the URL on arrival, with the form showing it", async () => {
    const fetch = stubService({ total: 120 });
    openAt("/qco/batches?status=OnHold&tank=T1&page=2");

    expect(await screen.findByText("Showing 51–100 of 120 batches, newest first.")).toBeInTheDocument();
    expect(calls(fetch, "/api/batches/search")[0].searchParams.get("page")).toBe("2");
    expect(filterForm().getByLabelText("Status")).toHaveValue("OnHold");
    expect(filterForm().getByLabelText("Tank")).toHaveValue("T1");
  });

  it("pages through the results 50 at a time", async () => {
    const fetch = stubService({ total: 120 });
    openAt("/qco/batches?productLine=FM&page=1");

    const pages = await screen.findByRole("navigation", { name: "Pages" });
    expect(within(pages).getByText("Page 1 of 3")).toBeInTheDocument();
    expect(within(pages).getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getAllByRole("button", { name: /^262-FM-/ })).toHaveLength(50);

    fireEvent.click(within(pages).getByRole("button", { name: "Next" }));

    expect(await screen.findByText("Showing 51–100 of 120 batches, newest first.")).toBeInTheDocument();
    expect(calls(fetch, "/api/batches/search").at(-1)?.searchParams.get("page")).toBe("2");
    expect(window.location.search).toBe("?productLine=FM&page=2");
  });

  it("says plainly when nothing matches, without an error or an export", async () => {
    stubService({ total: 0 });
    openAt("/qco/batches?status=Failed&productLine=SY&page=1");

    expect(await screen.findByText(/No batches match these filters\./)).toHaveAttribute("role", "status");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Export/ })).not.toBeInTheDocument();
  });

  it("checks the date range before asking the service", () => {
    const fetch = stubService();
    openAt("/qco/batches");

    const form = filterForm();
    fireEvent.change(form.getByLabelText("From"), { target: { value: "2026-10-02" } });
    fireEvent.change(form.getByLabelText("To"), { target: { value: "2026-10-01" } });
    fireEvent.click(form.getByRole("button", { name: "Show batches" }));

    expect(form.getByRole("alert")).toHaveTextContent("The start date must be on or before the end date.");
    expect(calls(fetch, "/api/batches/search")).toHaveLength(0);
  });

  it("clears the form without searching", () => {
    stubService();
    openAt("/qco/batches?status=Failed&society=VS001&page=1");

    const form = filterForm();
    fireEvent.click(form.getByRole("button", { name: "Clear filters" }));

    expect(form.getByLabelText("Status")).toHaveValue("");
    expect(form.getByLabelText("Society")).toHaveValue("");
    expect(window.location.search).toBe("?status=Failed&society=VS001&page=1");
  });

  it("gives way to a lookup by batch ID or reference", async () => {
    stubService();
    openAt("/qco/batches?status=Failed&page=1");
    await screen.findByRole("region", { name: "Filtered batches" });

    fireEvent.change(screen.getByLabelText(/Batch ID, dispatch reference or WR- batch reference/), {
      target: { value: "DN-20260919-02" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(window.location.search).toBe("?q=DN-20260919-02");
    expect(screen.queryByRole("region", { name: "Filtered batches" })).not.toBeInTheDocument();
  });
});

describe("exporting batches (SCRUM-139)", () => {
  it("downloads every match as CSV under the name the service gives it", async () => {
    const fetch = stubService({ total: 120 });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    openAt("/qco/batches?status=Failed&productLine=FM&page=2");

    fireEvent.click(await screen.findByRole("button", { name: "Export all 120 to CSV" }));

    expect(await screen.findByText(`Exported 120 batches to ${FILE_NAME}.`)).toBeInTheDocument();

    // Every match: the filters without the page.
    const [request] = calls(fetch, "/api/batches/export");
    expect(Object.fromEntries(request.searchParams)).toEqual({ status: "Failed", productLine: "FM" });
    const init = fetch.mock.calls.find(([input]) => String(input).includes("/api/batches/export"))?.[1];
    expect(new Headers(init?.headers).get("Authorization")).toMatch(/^Bearer /);

    expect(click).toHaveBeenCalledTimes(1);
    const link = click.mock.contexts[0] as HTMLAnchorElement;
    expect(link.download).toBe(FILE_NAME);
    expect(link.href).toBe("blob:export");
  });

  it("shows a refused export as an error and saves nothing", async () => {
    stubService({ exportStatus: 403 });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    openAt("/qco/batches?status=Failed&page=1");

    fireEvent.click(await screen.findByRole("button", { name: "Export all 2 to CSV" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Your role does not allow this.");
    await waitFor(() => expect(screen.getByRole("button", { name: "Export all 2 to CSV" })).toBeEnabled());
    expect(click).not.toHaveBeenCalled();
  });
});
