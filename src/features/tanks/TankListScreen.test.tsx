import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionProvider } from "../../auth/SessionContext";
import { NavigationProvider } from "../../app/navigation";
import { SyncProvider } from "../sync/SyncProvider";
import { emptyQueue } from "../sync/queue";
import { TankListScreen } from "./TankListScreen";
import { percentFull } from "./fill";

const session = {
  accessToken: "test-token",
  expiresAtUtc: new Date(Date.now() + 3_600_000).toISOString(),
  userName: "k.perera",
};

function tank(overrides: Record<string, unknown> = {}) {
  return {
    code: "T1",
    name: "Primary Cooler",
    capacityLitres: 5000,
    totalQuantityLitres: 4100,
    totalQuantityKg: 4223,
    availableQuantityLitres: 900,
    consignmentCount: 6,
    fillNumber: 3,
    lastClosedAtUtc: null,
    ...overrides,
  };
}

function stubFetch(tanks: unknown[]) {
  return vi.fn(async () =>
    new Response(JSON.stringify(tanks), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function renderScreen() {
  return render(
    <NavigationProvider>
      <SessionProvider initialSession={session}>
        <SyncProvider initialQueue={emptyQueue()}>
          <TankListScreen />
        </SyncProvider>
      </SessionProvider>
    </NavigationProvider>,
  );
}

beforeEach(() => {
  window.history.replaceState({ depth: 0 }, "", "/tanks");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("how full a tank is", () => {
  it("is the fill as a percentage of capacity", () => {
    expect(percentFull(tank({ totalQuantityLitres: 4100, capacityLitres: 5000 }))).toBe(82);
  });

  it("does not divide by a capacity of zero", () => {
    expect(percentFull(tank({ capacityLitres: 0, totalQuantityLitres: 10 }))).toBe(0);
  });

  it("clamps an over-fill, so the bar cannot run past its track", () => {
    expect(percentFull(tank({ totalQuantityLitres: 6000, capacityLitres: 5000 }))).toBe(100);
  });
});

describe("the tank list", () => {
  it("shows each tank with what it holds and how full it is", async () => {
    vi.stubGlobal("fetch", stubFetch([tank()]));

    renderScreen();

    expect(await screen.findByText("Primary Cooler")).toBeInTheDocument();
    expect(screen.getByText("4100")).toBeInTheDocument();
    expect(screen.getByText("82%")).toBeInTheDocument();
    expect(screen.getByText(/6 consignments in\s+fill 3/)).toBeInTheDocument();
  });

  it("opens a tank", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", stubFetch([tank()]));

    renderScreen();

    await user.click(await screen.findByRole("button", { name: /Primary Cooler/ }));

    expect(window.location.pathname).toBe("/tanks/T1");
  });

  it("says so when the centre has no tanks rather than showing an empty page", async () => {
    vi.stubGlobal("fetch", stubFetch([]));

    renderScreen();

    expect(await screen.findByText(/No chilling tanks are configured/)).toBeInTheDocument();
  });
});
