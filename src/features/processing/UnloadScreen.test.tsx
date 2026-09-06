import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionProvider } from "../../auth/SessionContext";
import { NavigationProvider } from "../../app/navigation";
import { sessionFor } from "../../test/tokens";
import { UnloadScreen } from "./UnloadScreen";

const tanks = [
  {
    code: "ST1",
    name: "Storing Tank 1",
    kind: "Storing",
    capacityLitres: 10000,
    heldLitres: 1500,
    availableLitres: 8500,
    status: "Active",
  },
  {
    code: "ST2",
    name: "Storing Tank 2",
    kind: "Storing",
    capacityLitres: 500,
    heldLitres: 400,
    availableLitres: 100,
    status: "Active",
  },
  {
    code: "ST3",
    name: "Storing Tank 3",
    kind: "Storing",
    capacityLitres: 5000,
    heldLitres: 0,
    availableLitres: 5000,
    status: "UnderMaintenance",
  },
];

const unloads = [
  {
    reference: "UNL-20260904-01",
    dispatchNoteReference: "DN-20260904-01",
    storingTankCode: "ST1",
    storingTankName: "Storing Tank 1",
    quantityLitres: 1500,
    temperatureCelsius: 4.2,
    unloadedAtLocal: "2026-09-04T08:45:00",
    unloadDate: "2026-09-04",
    unloadedBy: "f.silva",
    recordedAtUtc: "2026-09-04T03:15:00Z",
  },
];

function stubFetch(post?: () => Promise<Response> | Response) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

    if (init?.method === "POST") {
      return post
        ? post()
        : new Response(
            JSON.stringify({ ...unloads[0], reference: "UNL-20260904-02" }),
            { status: 201, headers: { "Content-Type": "application/json" } },
          );
    }

    const body = url.includes("/tanks") ? tanks : unloads;

    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
}

function renderScreen(role: Parameters<typeof sessionFor>[0] = "FactoryIntakeOfficer") {
  return render(
    <NavigationProvider>
      <SessionProvider initialSession={sessionFor(role)}>
        <UnloadScreen />
      </SessionProvider>
    </NavigationProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the unloading bay", () => {
  it("asks the processing service, not the intake service", async () => {
    const fetchMock = stubFetch();
    vi.stubGlobal("fetch", fetchMock);
    renderScreen();

    await screen.findByText("UNL-20260904-01");

    const asked = fetchMock.mock.calls.map(([input]) => String(input));
    expect(asked.every((url) => url.includes(":5239"))).toBe(true);
    expect(asked.some((url) => url.includes("/api/processing/tanks?kind=Storing"))).toBe(true);
  });

  it("offers only the storing tanks that are in service", async () => {
    vi.stubGlobal("fetch", stubFetch());
    renderScreen();

    await screen.findByText("UNL-20260904-01");

    const options = [...screen.getByLabelText(/^Storing Tank/).querySelectorAll("option")].map(
      (option) => option.textContent,
    );

    expect(options.some((text) => text?.includes("Storing Tank 1"))).toBe(true);
    expect(options.some((text) => text?.includes("Storing Tank 3"))).toBe(false);
  });

  it("sends what the factory measured", async () => {
    const user = userEvent.setup();
    const fetchMock = stubFetch();
    vi.stubGlobal("fetch", fetchMock);
    renderScreen();

    await screen.findByText("UNL-20260904-01");

    await user.type(screen.getByLabelText(/^Dispatch Note/), "dn-20260904-02");
    await user.selectOptions(screen.getByLabelText(/^Storing Tank/), "ST1");
    await user.type(screen.getByLabelText(/^Quantity measured/), "1200");
    await user.type(screen.getByLabelText("Arrival temperature (°C)"), "4.5");
    await user.click(screen.getByRole("button", { name: /Record Unload/ }));

    const post = fetchMock.mock.calls.find(([, init]) => (init as RequestInit)?.method === "POST");
    expect(JSON.parse(String((post![1] as RequestInit).body))).toEqual({
      dispatchNoteReference: "DN-20260904-02",
      storingTankCode: "ST1",
      quantityLitres: 1200,
      temperatureCelsius: 4.5,
    });
  });

  it("refuses a load that would overfill the chosen tank before sending it", async () => {
    const user = userEvent.setup();
    const fetchMock = stubFetch();
    vi.stubGlobal("fetch", fetchMock);
    renderScreen();

    await screen.findByText("UNL-20260904-01");

    await user.type(screen.getByLabelText(/^Dispatch Note/), "DN-X");
    await user.selectOptions(screen.getByLabelText(/^Storing Tank/), "ST2");
    await user.type(screen.getByLabelText(/^Quantity measured/), "200");
    await user.type(screen.getByLabelText("Arrival temperature (°C)"), "4.0");

    expect(await screen.findByRole("alert")).toHaveTextContent(/would overfill it/);
    expect(screen.getByRole("button", { name: /Record Unload/ })).toBeDisabled();

    expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit)?.method === "POST")).toBe(
      false,
    );
  });

  it("confirms with the reference the service allocated", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", stubFetch());
    renderScreen();

    await screen.findByText("UNL-20260904-01");

    await user.type(screen.getByLabelText(/^Dispatch Note/), "DN-B");
    await user.selectOptions(screen.getByLabelText(/^Storing Tank/), "ST1");
    await user.type(screen.getByLabelText(/^Quantity measured/), "900");
    await user.type(screen.getByLabelText("Arrival temperature (°C)"), "4.0");
    await user.click(screen.getByRole("button", { name: /Record Unload/ }));

    expect(await screen.findByText(/UNL-20260904-02/)).toBeInTheDocument();
  });

  it("shows the service's refusal rather than a generic failure", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      stubFetch(
        () =>
          new Response(
            JSON.stringify({
              code: "dispatch_already_unloaded",
              detail: "Dispatch note DN-B has already been unloaded.",
            }),
            { status: 409, headers: { "Content-Type": "application/problem+json" } },
          ),
      ),
    );
    renderScreen();

    await screen.findByText("UNL-20260904-01");

    await user.type(screen.getByLabelText(/^Dispatch Note/), "DN-B");
    await user.selectOptions(screen.getByLabelText(/^Storing Tank/), "ST1");
    await user.type(screen.getByLabelText(/^Quantity measured/), "900");
    await user.type(screen.getByLabelText("Arrival temperature (°C)"), "4.0");
    await user.click(screen.getByRole("button", { name: /Record Unload/ }));

    expect(
      await screen.findByText("Dispatch note DN-B has already been unloaded."),
    ).toBeInTheDocument();
  });

  it("lets an analyst read the bay without offering the form", async () => {
    vi.stubGlobal("fetch", stubFetch());
    renderScreen("QualityAnalyst");

    expect(await screen.findByText("UNL-20260904-01")).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Dispatch Note/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Record Unload/ })).not.toBeInTheDocument();
  });
});
