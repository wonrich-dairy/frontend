import { afterEach, describe, expect, it, vi } from "vitest";
import { classifySearch, searchBatches } from "./search";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("classifySearch", () => {
  it("takes a WR- term as factory intake's batch reference", () => {
    expect(classifySearch("WR-20260919-02")).toEqual({ kind: "batchReference", value: "WR-20260919-02" });
  });

  it("takes a batch code as a batch ID", () => {
    expect(classifySearch("262-FM-B")).toEqual({ kind: "batchId", value: "262-FM-B" });
    expect(classifySearch("277-FLM-A")).toEqual({ kind: "batchId", value: "277-FLM-A" });
  });

  it("takes anything else as a dispatch reference", () => {
    expect(classifySearch("DN-20260919-02")).toEqual({ kind: "dispatchRef", value: "DN-20260919-02" });
  });

  it("trims the term and reads it in capitals, as the references are written", () => {
    expect(classifySearch("  wr-20260919-02 ")).toEqual({ kind: "batchReference", value: "WR-20260919-02" });
    expect(classifySearch("262-fm-b")).toEqual({ kind: "batchId", value: "262-FM-B" });
  });

  it("refuses an empty term and a bare WR- prefix", () => {
    expect(classifySearch("   ")).toEqual({ error: expect.stringContaining("Enter a batch ID") });
    expect(classifySearch("WR-")).toEqual({ error: expect.stringContaining("whole batch reference") });
  });
});

describe("searchBatches", () => {
  function stub(status: number, body: unknown) {
    const fetch = vi.fn(async () => new Response(JSON.stringify(body), { status }));
    vi.stubGlobal("fetch", fetch);
    return fetch;
  }

  function calledPath(fetch: ReturnType<typeof stub>): string {
    const url = new URL(String((fetch.mock.calls[0] as unknown[])[0]));
    return `${url.pathname}${url.search}`;
  }

  it("looks a batch ID up directly", async () => {
    const fetch = stub(200, { batchId: "262-FM-B" });

    await expect(searchBatches({ kind: "batchId", value: "262-FM-B" }, "token")).resolves.toEqual([{ batchId: "262-FM-B" }]);
    expect(calledPath(fetch)).toBe("/api/batches/262-FM-B");
  });

  it("turns an unknown batch ID into no match, not an error", async () => {
    stub(404, { title: "Batch not found" });

    await expect(searchBatches({ kind: "batchId", value: "999-FM-Z" }, "token")).resolves.toEqual([]);
  });

  it("looks references up by their own filter", async () => {
    let fetch = stub(200, []);
    await searchBatches({ kind: "batchReference", value: "WR-20260919-02" }, "token");
    expect(calledPath(fetch)).toBe("/api/batches?batchReference=WR-20260919-02");

    fetch = stub(200, []);
    await searchBatches({ kind: "dispatchRef", value: "DN-20260919-02" }, "token");
    expect(calledPath(fetch)).toBe("/api/batches?dispatchRef=DN-20260919-02");
  });

  it("passes any other failure on", async () => {
    stub(503, { title: "Projection store unavailable." });

    await expect(searchBatches({ kind: "batchId", value: "262-FM-B" }, "token")).rejects.toMatchObject({ status: 503 });
  });
});
