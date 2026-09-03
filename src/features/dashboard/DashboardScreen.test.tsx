import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionProvider } from "../../auth/SessionContext";
import { NavigationProvider } from "../../app/navigation";
import { SyncProvider } from "../sync/SyncProvider";
import { emptyQueue } from "../sync/queue";
import { DashboardScreen } from "./DashboardScreen";

const session = {
  accessToken: "test-token",
  expiresAtUtc: new Date(Date.now() + 3_600_000).toISOString(),
  userName: "k.perera",
};

/** The device's local date, which is what the service dates arrivals by. */
function today(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function consignment(overrides: Record<string, unknown> = {}) {
  return {
    id: "c1",
    reference: "MCC-KG-01",
    societyId: "s1",
    societyCode: "KG",
    societyName: "Kobeigane",
    arrivalAtLocal: `${today()}T07:40:00`,
    arrivalDate: today(),
    status: "Accepted",
    totalQuantityKg: 400,
    totalQuantityLitres: 400,
    canCount: 1,
    registeredAtUtc: `${today()}T02:10:00Z`,
    registeredBy: "k.perera",
    cans: [],
    ...overrides,
  };
}

function stubFetch(items: unknown[]) {
  return vi.fn(async (input: RequestInfo | URL) => {
    if (String(input).includes("/api/consignments")) {
      return new Response(
        JSON.stringify({ items, page: 1, pageSize: 100, totalCount: items.length, totalPages: 1 }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    throw new Error(`Unexpected request: ${String(input)}`);
  });
}

function renderScreen() {
  return render(
    <NavigationProvider>
      <SessionProvider initialSession={session}>
        <SyncProvider initialQueue={emptyQueue()}>
          <DashboardScreen />
        </SyncProvider>
      </SessionProvider>
    </NavigationProvider>,
  );
}

beforeEach(() => {
  window.history.replaceState({ depth: 0 }, "", "/");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the dashboard", () => {
  it("counts today's intake from the consignments the service returns", async () => {
    vi.stubGlobal(
      "fetch",
      stubFetch([
        consignment({ id: "a", totalQuantityLitres: 1200, status: "Accepted" }),
        consignment({ id: "b", totalQuantityLitres: 800, status: "Accepted" }),
        consignment({ id: "c", totalQuantityLitres: 500, status: "Rejected" }),
      ]),
    );

    renderScreen();

    const stats = await screen.findByLabelText("Today at this centre");

    // 2,500 L over three consignments, two of them accepted.
    expect(within(stats).getByText("2.5 kL")).toBeInTheDocument();
    expect(within(stats).getByText("3")).toBeInTheDocument();
    expect(within(stats).getByText("2")).toBeInTheDocument();
    expect(within(stats).getByText("1")).toBeInTheDocument();
  });

  it("leaves out deliveries from an earlier day", async () => {
    vi.stubGlobal(
      "fetch",
      stubFetch([
        consignment({ id: "a", totalQuantityLitres: 1000 }),
        consignment({ id: "old", arrivalDate: "2020-01-01", totalQuantityLitres: 9000 }),
      ]),
    );

    renderScreen();

    const stats = await screen.findByLabelText("Today at this centre");

    expect(within(stats).getByText("1.0 kL")).toBeInTheDocument();
  });

  it("still offers the quick actions when the figures cannot be loaded", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 500 })));

    renderScreen();

    // The tiles are a summary; losing them must not cost the officer the actions.
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Register Consignment/ })).toBeInTheDocument();
  });

  it("opens the screen behind a quick action", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", stubFetch([]));

    renderScreen();

    await user.click(await screen.findByRole("button", { name: /Chilling Tanks/ }));

    expect(window.location.pathname).toBe("/tanks");
  });
});
