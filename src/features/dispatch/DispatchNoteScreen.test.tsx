import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionProvider } from "../../auth/SessionContext";
import { NavigationProvider } from "../../app/navigation";
import { SyncProvider } from "../sync/SyncProvider";
import { emptyQueue } from "../sync/queue";
import { DispatchNoteScreen } from "./DispatchNoteScreen";

const session = {
  accessToken: "test-token",
  expiresAtUtc: new Date(Date.now() + 3_600_000).toISOString(),
  userName: "k.perera",
};

const tanks = [
  {
    code: "T1",
    name: "Primary Cooler",
    capacityLitres: 5000,
    totalQuantityLitres: 4500,
    totalQuantityKg: 4635,
    availableQuantityLitres: 500,
    consignmentCount: 6,
    fillNumber: 3,
    lastClosedAtUtc: null,
  },
  {
    code: "T3",
    name: "Empty Tank",
    capacityLitres: 5000,
    totalQuantityLitres: 0,
    totalQuantityKg: 0,
    availableQuantityLitres: 5000,
    consignmentCount: 0,
    fillNumber: 1,
    lastClosedAtUtc: null,
  },
];

let posted: Record<string, unknown> | null = null;

function stubFetch() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

    if (url.includes("/api/tanks")) {
      return new Response(JSON.stringify(tanks), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.includes("/api/dispatch-notes") && init?.method === "POST") {
      posted = JSON.parse(String(init.body)) as Record<string, unknown>;

      return new Response(
        JSON.stringify({
          reference: "DISP-9872",
          bowserRegistration: "WP-LC-8832",
          driverName: "Thomas R.",
          dispatchedAtLocal: "2026-09-03T09:30:00",
          totalQuantityLitres: 1200,
          fatPercent: 3.8,
          snf: 8.5,
          kqColour: "Blue",
          stabilityGrade: "MarginallyStable",
          temperatureCelsius: 3.2,
          remarks: null,
          dispatchedBy: "k.perera",
          recordedAtUtc: "2026-09-03T04:00:00Z",
          sources: [
            { tankCode: "T1", tankName: "Primary Cooler", quantityLitres: 1200, contributingConsignments: [] },
          ],
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      );
    }

    throw new Error(`Unexpected request: ${init?.method ?? "GET"} ${url}`);
  });
}

function renderScreen() {
  return render(
    <NavigationProvider>
      <SessionProvider initialSession={session}>
        <SyncProvider initialQueue={emptyQueue()}>
          <DispatchNoteScreen />
        </SyncProvider>
      </SessionProvider>
    </NavigationProvider>,
  );
}

async function fillNote(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText("Bowser No"), "WP-LC-8832");
  await user.type(screen.getByLabelText("Driver Name"), "Thomas R.");

  await user.click(screen.getByRole("button", { name: /Select Source Tanks/ }));
  const picker = await screen.findByRole("dialog", { name: "Select Source Tanks" });
  await user.click(within(picker).getByRole("checkbox", { name: /Primary Cooler/ }));
  await user.click(within(picker).getByRole("button", { name: /Confirm Selection/ }));

  await user.type(await screen.findByLabelText("Dispatch Qty (Litres)"), "1200");
  await user.type(screen.getByLabelText("Temp °C"), "3.2");
  await user.type(screen.getByLabelText("Fat %"), "3.8");
  await user.type(screen.getByLabelText("SNF %"), "8.5");
  await user.click(screen.getByRole("radio", { name: /Excellent/ }));
}

beforeEach(() => {
  posted = null;
  window.history.replaceState({ depth: 0 }, "", "/dispatch");
  vi.stubGlobal("fetch", stubFetch());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("recording a dispatch note", () => {
  it("will not submit until the panel and a source tank are complete", async () => {
    renderScreen();

    expect(await screen.findByRole("button", { name: /Submit Dispatch/ })).toBeDisabled();
  });

  it("does not offer a tank with nothing in it", async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(await screen.findByRole("button", { name: /Select Source Tanks/ }));

    const picker = await screen.findByRole("dialog", { name: "Select Source Tanks" });
    expect(within(picker).getByRole("checkbox", { name: /Empty Tank/ })).toBeDisabled();
  });

  it("sends the per-tank draws rather than a total, because the service derives it", async () => {
    const user = userEvent.setup();
    renderScreen();

    await fillNote(user);
    await user.click(screen.getByRole("button", { name: /Submit Dispatch/ }));

    await screen.findByText(/Dispatch Recorded/);

    expect(posted).toMatchObject({
      bowserRegistration: "WP-LC-8832",
      driverName: "Thomas R.",
      draws: [{ tankCode: "T1", quantityLitres: 1200 }],
      fatPercent: 3.8,
      snf: 8.5,
      temperatureCelsius: 3.2,
      kqColour: "Blue",
    });
    expect(posted).not.toHaveProperty("totalQuantityLitres");
  });

  it("sends the grade the alcohol switches settle on", async () => {
    const user = userEvent.setup();
    renderScreen();

    await fillNote(user);
    await user.click(screen.getByRole("switch", { name: /80% Alcohol/ }));
    await user.click(screen.getByRole("button", { name: /Submit Dispatch/ }));

    await screen.findByText(/Dispatch Recorded/);

    expect(posted).toMatchObject({ stabilityGrade: "MarginallyStable" });
  });

  it("warns when a draw is more than the tank is holding", async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(await screen.findByRole("button", { name: /Select Source Tanks/ }));
    const picker = await screen.findByRole("dialog", { name: "Select Source Tanks" });
    await user.click(within(picker).getByRole("checkbox", { name: /Primary Cooler/ }));
    await user.click(within(picker).getByRole("button", { name: /Confirm Selection/ }));

    await user.type(await screen.findByLabelText("Dispatch Qty (Litres)"), "9999");

    expect(screen.getByText(/only holds 4500.0 L/)).toBeInTheDocument();
  });

  it("confirms with the slip number the service allocated", async () => {
    const user = userEvent.setup();
    renderScreen();

    await fillNote(user);
    await user.click(screen.getByRole("button", { name: /Submit Dispatch/ }));

    expect(await screen.findByText(/DISP-9872/)).toBeInTheDocument();
  });
});
