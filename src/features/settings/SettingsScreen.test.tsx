import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionProvider } from "../../auth/SessionContext";
import { NavigationProvider } from "../../app/navigation";
import { SyncProvider } from "../sync/SyncProvider";
import { emptyQueue } from "../sync/queue";
import { SettingsScreen } from "./SettingsScreen";

const session = {
  accessToken: "test-token",
  expiresAtUtc: new Date(Date.now() + 3_600_000).toISOString(),
  userName: "k.perera",
};

const societies = [
  {
    id: "s1",
    code: "KG",
    name: "Kobeigane",
    canLabelPrefix: "KG",
    contactPerson: "Sunil Perera",
    contactNumber: null,
    isActive: true,
  },
  {
    id: "s2",
    code: "MG",
    name: "Maningamuwa",
    canLabelPrefix: "MG",
    contactPerson: null,
    contactNumber: null,
    isActive: false,
  },
];

const tanks = [
  {
    code: "T1",
    name: "Primary Cooler",
    capacityLitres: 5000,
    totalQuantityLitres: 4100,
    totalQuantityKg: 4223,
    availableQuantityLitres: 900,
    consignmentCount: 6,
    fillNumber: 3,
    lastClosedAtUtc: null,
  },
];

function stubFetch() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const body = url.includes("/api/societies") ? societies : url.includes("/api/tanks") ? tanks : null;

    if (!body) {
      throw new Error(`Unexpected request: ${url}`);
    }

    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
}

function renderScreen() {
  return render(
    <NavigationProvider>
      <SessionProvider initialSession={session}>
        <SyncProvider initialQueue={emptyQueue()}>
          <SettingsScreen />
        </SyncProvider>
      </SessionProvider>
    </NavigationProvider>,
  );
}

beforeEach(() => {
  window.history.replaceState({ depth: 0 }, "", "/settings");
  vi.stubGlobal("fetch", stubFetch());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("settings", () => {
  it("lists the societies with their tag and leader", async () => {
    renderScreen();

    expect(await screen.findByText("Kobeigane")).toBeInTheDocument();
    expect(screen.getByText("Sunil Perera")).toBeInTheDocument();
    expect(screen.getByText("KG")).toBeInTheDocument();
  });

  it("names a society with no leader rather than leaving the row blank", async () => {
    renderScreen();

    expect(await screen.findByText("Not recorded")).toBeInTheDocument();
  });

  it("marks a retired society, because it is still resolvable but not offered at the gate", async () => {
    renderScreen();

    expect(await screen.findByText("Retired")).toBeInTheDocument();
  });

  it("opens the form for a society being edited", async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(await screen.findByRole("button", { name: /Edit Kobeigane/ }));

    expect(window.location.pathname).toBe("/settings/societies/s1");
  });

  it("opens the empty form from Add Society", async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(await screen.findByRole("button", { name: /Add Society/ }));

    expect(window.location.pathname).toBe("/settings/societies/new");
  });

  it("shows a tank's capacity and how full it is", async () => {
    renderScreen();

    expect(await screen.findByText("5000 L")).toBeInTheDocument();
    expect(screen.getByText("4100 L (82%)")).toBeInTheDocument();
  });

  it("offers no tank actions the service cannot carry out", async () => {
    renderScreen();

    await screen.findByText("Primary Cooler");

    expect(screen.queryByRole("button", { name: /Options for Primary Cooler/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add Tank/ })).not.toBeInTheDocument();
  });

  it("shows no settings rows with nothing behind them", async () => {
    renderScreen();

    await screen.findByText("Primary Cooler");

    expect(screen.queryByRole("button", { name: /App Preferences/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Notification Settings/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Help & Support/ })).not.toBeInTheDocument();
  });
});
