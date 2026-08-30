import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionProvider } from "../../auth/SessionContext";
import { SyncProvider } from "./SyncProvider";
import { PendingQueueScreen } from "./PendingQueueScreen";
import { emptyQueue, enqueue, type NewRecord, type SyncQueue } from "./queue";
import { useSync } from "./syncStore";

const session = {
  accessToken: "test-token",
  expiresAtUtc: new Date(Date.now() + 3_600_000).toISOString(),
  userName: "k.perera",
};

const sheet = (summary = "Kobeigane - 1 can"): NewRecord => ({
  kind: "RegisterConsignment",
  summary,
  consignment: { societyId: "s1", cans: [{ canNumber: 1, quantityKg: 40 }] },
});

function queueOf(...records: NewRecord[]): SyncQueue {
  return records.reduce((queue, record) => enqueue(queue, record), emptyQueue());
}

/** Drives the browser's own notion of connectivity, which the provider listens to. */
function setOnline(value: boolean) {
  Object.defineProperty(navigator, "onLine", { value, configurable: true });
  window.dispatchEvent(new Event(value ? "online" : "offline"));
}

let fetchMock: ReturnType<typeof vi.fn>;

function renderQueue(initialQueue: SyncQueue) {
  return render(
    <SessionProvider initialSession={session}>
      <SyncProvider initialQueue={initialQueue}>
        <PendingQueueScreen />
      </SyncProvider>
    </SessionProvider>,
  );
}

beforeEach(() => {
  setOnline(false);
  localStorage.clear();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("the queue while offline", () => {
  it("lists what is waiting, with a count", async () => {
    renderQueue(queueOf(sheet("Kobeigane - 1 can"), sheet("Maningamuwa - 2 cans")));

    expect(await screen.findByText("Kobeigane - 1 can")).toBeInTheDocument();
    expect(screen.getByText("Maningamuwa - 2 cans")).toBeInTheDocument();

    const waiting = screen.getByLabelText("Waiting to upload");
    expect(waiting).toHaveTextContent("2");
  });

  it("does not try to upload while there is no network", () => {
    renderQueue(queueOf(sheet()));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Upload now/ })).toBeDisabled();
  });
});

describe("reconnecting", () => {
  it("uploads the queue on its own, in creation order", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ results: [], applied: 0, duplicates: 0, failed: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    renderQueue(queueOf(sheet("first"), sheet("second")));

    await act(async () => {
      setOnline(true);
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(body.operations.map((operation: { sequence: number }) => operation.sequence)).toEqual([1, 2]);
    expect(body.operations[0].kind).toBe("RegisterConsignment");
  });

  it("clears records the service applied", async () => {
    const queue = queueOf(sheet("first"));
    const id = queue.records[0].clientRecordId;

    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [{ clientRecordId: id, status: "Applied", reference: "MCC-1", error: null }],
          applied: 1,
          duplicates: 0,
          failed: 0,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    renderQueue(queue);

    await act(async () => {
      setOnline(true);
    });

    expect(await screen.findByText(/Nothing is waiting/)).toBeInTheDocument();
  });

  it("keeps a refused record for review rather than dropping it", async () => {
    const queue = queueOf(sheet("first"));
    const id = queue.records[0].clientRecordId;

    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            { clientRecordId: id, status: "Failed", reference: null, error: "Society was not found." },
          ],
          applied: 0,
          duplicates: 0,
          failed: 1,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    renderQueue(queue);

    await act(async () => {
      setOnline(true);
    });

    expect(await screen.findByLabelText("Needs review")).toBeInTheDocument();
    expect(screen.getByText("Society was not found.")).toBeInTheDocument();
  });

  it("leaves the queue alone when the service is still unreachable", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    renderQueue(queueOf(sheet("first")));

    await act(async () => {
      setOnline(true);
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    // Nothing lost, nothing marked failed: the next window tries again.
    expect(screen.getByText("first")).toBeInTheDocument();
    expect(screen.queryByLabelText("Needs review")).toBeNull();
  });
});

describe("a record that keeps its identity", () => {
  it("sends the same client record id when the queue is uploaded again", async () => {
    const queue = queueOf(sheet("first"));
    const id = queue.records[0].clientRecordId;

    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValue(
      new Response(JSON.stringify({ results: [], applied: 0, duplicates: 0, failed: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    renderQueue(queue);

    await act(async () => {
      setOnline(true);
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Upload now/ }));

    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(1));

    // The identifier is what lets the service apply a replayed record once.
    for (const call of fetchMock.mock.calls) {
      const body = JSON.parse(String(call[1].body));
      expect(body.operations[0].clientRecordId).toBe(id);
    }
  });
});

describe("what survives a reload", () => {
  it("writes the queue to storage so a captured record outlives the tab", async () => {
    function Capture() {
      const { enqueue: add, pendingCount } = useSync();

      return (
        <button type="button" onClick={() => add(sheet("held"))}>
          add ({pendingCount})
        </button>
      );
    }

    render(
      <SessionProvider initialSession={session}>
        <SyncProvider initialQueue={emptyQueue()}>
          <Capture />
        </SyncProvider>
      </SessionProvider>,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /add/ }));

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem("wonrich.sync.queue") ?? "{}");
      expect(stored.records).toHaveLength(1);
      expect(stored.records[0].summary).toBe("held");
    });
  });
});
