import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionProvider } from "../../auth/SessionContext";
import { NavigationProvider } from "../../app/navigation";
import { sessionFor } from "../../test/tokens";
import { TankFormScreen } from "./TankFormScreen";

const session = sessionFor("MccManager");

const tank = {
  code: "T1",
  name: "Primary Cooler",
  capacityLitres: 5000,
  totalQuantityLitres: 4100,
  totalQuantityKg: 4223,
  availableQuantityLitres: 900,
  consignmentCount: 6,
  fillNumber: 3,
  lastClosedAtUtc: null,
  status: "Active",
  latestTemperature: null,
};

function stubFetch(save?: () => Promise<Response> | Response) {
  return vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    const method = init?.method ?? "GET";

    if (method === "GET") {
      return new Response(JSON.stringify([tank]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return save
      ? save()
      : new Response(JSON.stringify(tank), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
  });
}

function renderScreen(code?: string) {
  return render(
    <NavigationProvider>
      <SessionProvider initialSession={session}>
        <TankFormScreen code={code} />
      </SessionProvider>
    </NavigationProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("adding a tank", () => {
  it("sends the code, name and capacity", async () => {
    const user = userEvent.setup();
    const fetchMock = stubFetch();
    vi.stubGlobal("fetch", fetchMock);
    renderScreen();

    await user.type(screen.getByLabelText("Tank Code"), "T4");
    await user.type(screen.getByLabelText("Tank Name/Number"), "Chilling Tank 4");
    await user.type(screen.getByLabelText("Capacity (Liters)"), "5000");
    await user.click(screen.getByRole("button", { name: /Save Tank/ }));

    const post = fetchMock.mock.calls.find(([, init]) => (init as RequestInit)?.method === "POST");
    expect(JSON.parse(String((post![1] as RequestInit).body))).toEqual({
      code: "T4",
      name: "Chilling Tank 4",
      capacityLitres: 5000,
    });
  });

  it("will not save until the tank is described", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", stubFetch());
    renderScreen();

    expect(screen.getByRole("button", { name: /Save Tank/ })).toBeDisabled();

    await user.type(screen.getByLabelText("Tank Code"), "T4");
    await user.type(screen.getByLabelText("Tank Name/Number"), "Chilling Tank 4");

    await user.type(screen.getByLabelText("Capacity (Liters)"), "0");
    expect(screen.getByRole("button", { name: /Save Tank/ })).toBeDisabled();

    await user.clear(screen.getByLabelText("Capacity (Liters)"));
    await user.type(screen.getByLabelText("Capacity (Liters)"), "4000");
    expect(screen.getByRole("button", { name: /Save Tank/ })).toBeEnabled();
  });

  it("shows the service's refusal rather than a generic failure", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      stubFetch(
        () =>
          new Response(JSON.stringify({ code: "duplicate_code", detail: "T1 is already in use." }), {
            status: 409,
            headers: { "Content-Type": "application/problem+json" },
          }),
      ),
    );
    renderScreen();

    await user.type(screen.getByLabelText("Tank Code"), "T1");
    await user.type(screen.getByLabelText("Tank Name/Number"), "Duplicate");
    await user.type(screen.getByLabelText("Capacity (Liters)"), "5000");
    await user.click(screen.getByRole("button", { name: /Save Tank/ }));

    expect(await screen.findByText("T1 is already in use.")).toBeInTheDocument();
  });
});

describe("editing a tank", () => {
  it("loads the tank and holds its code fixed", async () => {
    vi.stubGlobal("fetch", stubFetch());
    renderScreen("T1");

    expect(await screen.findByLabelText("Tank Name/Number")).toHaveValue("Primary Cooler");
    expect(screen.getByLabelText("Capacity (Liters)")).toHaveValue("5000");

    expect(screen.getByLabelText("Tank Code")).toHaveValue("T1");
    expect(screen.getByLabelText("Tank Code")).toBeDisabled();
  });

  it("sends the amendment as a PUT against the existing code", async () => {
    const user = userEvent.setup();
    const fetchMock = stubFetch(
      () =>
        new Response(JSON.stringify(tank), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderScreen("T1");

    const name = await screen.findByLabelText("Tank Name/Number");
    await user.clear(name);
    await user.type(name, "Renamed Cooler");
    await user.click(screen.getByRole("button", { name: /Save Tank/ }));

    const put = fetchMock.mock.calls.find(([, init]) => (init as RequestInit)?.method === "PUT");
    expect(String(put![0])).toContain("/api/tanks/T1");
    expect(JSON.parse(String((put![1] as RequestInit).body)).name).toBe("Renamed Cooler");
  });

  it("says so when the tank is not there", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );
    renderScreen("T9");

    expect(await screen.findByRole("alert")).toHaveTextContent(/No chilling tank is registered/);
  });
});
