import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionProvider } from "../../auth/SessionContext";
import { SyncProvider } from "../sync/SyncProvider";
import { emptyQueue } from "../sync/queue";
import { PourScreen } from "./PourScreen";

const tanks = [
  {
    code: "T1",
    name: "Primary Cooler",
    capacityLitres: 5000,
    totalQuantityLitres: 1200,
    totalQuantityKg: 1236,
    consignmentCount: 3,
  },
  {
    code: "T2",
    name: "Secondary Holding",
    capacityLitres: 3500,
    totalQuantityLitres: 0,
    totalQuantityKg: 0,
    consignmentCount: 0,
  },
];

const pourable = [
  {
    reference: "MCC-20260830-KG-01",
    societyCode: "KG",
    societyName: "Kobeigane",
    totalQuantityLitres: 200,
    totalQuantityKg: 206,
  },
  {
    reference: "MCC-20260830-MG-01",
    societyCode: "MG",
    societyName: "Maningamuwa",
    totalQuantityLitres: 100,
    totalQuantityKg: 103,
  },
];

const session = {
  accessToken: "test-token",
  expiresAtUtc: new Date(Date.now() + 3_600_000).toISOString(),
  userName: "k.perera",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

function stubFetch(pour?: () => Response | Promise<Response>) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

    if (url.includes("/api/tanks/pourable")) {
      return json(pourable);
    }

    if (url.includes("/pours") && init?.method === "POST") {
      return pour ? pour() : json({ tank: tanks[0], entries: [] }, 201);
    }

    if (url.includes("/api/tanks")) {
      return json(tanks);
    }

    throw new Error(`Unexpected request: ${url}`);
  });
}

function setOnline(value: boolean) {
  Object.defineProperty(navigator, "onLine", { value, configurable: true });
}

function renderScreen() {
  return render(
    <SessionProvider initialSession={session}>
      <SyncProvider initialQueue={emptyQueue()}>
        <PourScreen />
      </SyncProvider>
    </SessionProvider>,
  );
}

beforeEach(() => {
  setOnline(true);
  localStorage.clear();
  fetchMock = stubFetch();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("choosing a tank", () => {
  it("lists the tanks with what each is holding", async () => {
    renderScreen();

    expect(await screen.findByText("Primary Cooler")).toBeInTheDocument();
    expect(screen.getByText("Secondary Holding")).toBeInTheDocument();
    expect(screen.getByText(/24% full/)).toBeInTheDocument();
  });
});

describe("pouring", () => {
  it("records one pour per consignment, because the service takes one at a time", async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(await screen.findByRole("button", { name: /Primary Cooler/ }));
    await user.click(await screen.findByRole("checkbox", { name: /KG-01/ }));
    await user.click(screen.getByRole("checkbox", { name: /MG-01/ }));

    await user.click(screen.getByRole("button", { name: /Confirm pour of 2 consignments/ }));

    await waitFor(() => expect(pourCalls()).toHaveLength(2));

    expect(JSON.parse(String(pourCalls()[0][1].body))).toEqual({
      consignmentReference: "MCC-20260830-KG-01",
    });
    expect(String(pourCalls()[0][0])).toContain("/api/tanks/T1/pours");
    expect(await screen.findByText("Poured")).toBeInTheDocument();
  });

  it("totals the litres of what has been selected", async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(await screen.findByRole("button", { name: /Primary Cooler/ }));
    await user.click(await screen.findByRole("checkbox", { name: /KG-01/ }));

    const total = screen.getByLabelText("Pour total");
    expect(total).toHaveTextContent("200.0");
  });

  it("shows the service's refusal rather than a generic failure", async () => {
    vi.stubGlobal(
      "fetch",
      (fetchMock = stubFetch(() =>
        json(
          {
            status: 409,
            title: "Consignment already poured",
            detail: "Consignment MCC-20260830-KG-01 has already been poured and cannot be poured again.",
            code: "consignment_already_poured",
          },
          409,
        ),
      )),
    );

    const user = userEvent.setup();
    renderScreen();

    await user.click(await screen.findByRole("button", { name: /Primary Cooler/ }));
    await user.click(await screen.findByRole("checkbox", { name: /KG-01/ }));
    await user.click(screen.getByRole("button", { name: /Confirm pour/ }));

    expect(await screen.findByText(/has already been poured/)).toBeInTheDocument();
  });
});

describe("pouring with no network", () => {
  it("offers what the device last saw, and says the list may have moved on", async () => {
    const { unmount } = renderScreen();
    await screen.findByText("Primary Cooler");
    unmount();

    setOnline(false);
    renderScreen();

    expect(await screen.findByText("Primary Cooler")).toBeInTheDocument();
    expect(screen.getByText(/Showing what the device last saw/)).toBeInTheDocument();
  });

  it("queues one record per consignment instead of failing", async () => {
    const { unmount } = renderScreen();
    await screen.findByText("Primary Cooler");
    unmount();

    setOnline(false);
    const user = userEvent.setup();
    renderScreen();

    await user.click(await screen.findByRole("button", { name: /Primary Cooler/ }));
    await user.click(await screen.findByRole("checkbox", { name: /KG-01/ }));
    await user.click(screen.getByRole("button", { name: /Confirm pour/ }));

    expect(await screen.findByText("Saved on this device")).toBeInTheDocument();
    expect(pourCalls()).toHaveLength(0);

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem("wonrich.sync.queue") ?? "{}");
      expect(stored.records).toHaveLength(1);
      expect(stored.records[0].kind).toBe("PourToTank");
      expect(stored.records[0].pour).toEqual({
        tankCode: "T1",
        consignmentReference: "MCC-20260830-KG-01",
      });
    });
  });
});

function pourCalls(): [RequestInfo | URL, RequestInit][] {
  const calls = fetchMock.mock.calls as unknown as [RequestInfo | URL, RequestInit | undefined][];

  return calls
    .filter((call) => String(call[0]).includes("/pours") && call[1]?.method === "POST")
    .map((call) => [call[0], call[1] as RequestInit]);
}
