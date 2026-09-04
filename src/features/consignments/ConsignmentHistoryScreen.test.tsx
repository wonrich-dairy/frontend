import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionProvider } from "../../auth/SessionContext";
import { NavigationProvider } from "../../app/navigation";
import { sessionFor } from "../../test/tokens";
import { ConsignmentHistoryScreen } from "./ConsignmentHistoryScreen";

const session = sessionFor("IntakeOfficer");

function consignment(reference: string, status: string, societyName: string) {
  return {
    id: reference,
    reference,
    societyId: "s1",
    societyCode: reference.slice(0, 2),
    societyName,
    arrivalAtLocal: "2026-09-04T07:40:00",
    arrivalDate: "2026-09-04",
    status,
    totalQuantityKg: 40.5,
    totalQuantityLitres: 39.3,
    canCount: 2,
    registeredAtUtc: "2026-09-04T02:10:00Z",
    registeredBy: "k.perera",
    cans: [],
  };
}

const rows = [
  consignment("MCC-20260904-KC-01", "Accepted", "Kandy Co-operative"),
  consignment("MCC-20260904-NW-01", "Rejected", "Nuwara Eliya Highland"),
  consignment("MCC-20260904-BD-01", "Registered", "Badulla Uva"),
];

/** Answers the way the service does: the status query narrows the rows and the total. */
function stubFetch() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), "http://localhost");
    const status = url.searchParams.get("status");
    const items = status === null ? rows : rows.filter((one) => one.status === status);

    return new Response(
      JSON.stringify({ items, page: 1, pageSize: 100, totalCount: items.length, totalPages: 1 }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  });
}

function renderScreen() {
  return render(
    <NavigationProvider>
      <SessionProvider initialSession={session}>
        <ConsignmentHistoryScreen />
      </SessionProvider>
    </NavigationProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("reviewing deliveries", () => {
  it("lists every consignment until a status is chosen", async () => {
    vi.stubGlobal("fetch", stubFetch());
    renderScreen();

    expect(await screen.findByText("MCC-20260904-KC-01")).toBeInTheDocument();
    expect(screen.getByText("MCC-20260904-NW-01")).toBeInTheDocument();
    expect(screen.getByText("MCC-20260904-BD-01")).toBeInTheDocument();
  });

  it("asks the service for one status rather than filtering in the browser", async () => {
    const user = userEvent.setup();
    const fetchMock = stubFetch();
    vi.stubGlobal("fetch", fetchMock);
    renderScreen();

    await screen.findByText("MCC-20260904-KC-01");
    await user.click(screen.getByRole("button", { name: "Rejected" }));

    expect(await screen.findByText("MCC-20260904-NW-01")).toBeInTheDocument();
    expect(screen.queryByText("MCC-20260904-KC-01")).not.toBeInTheDocument();

    const asked = fetchMock.mock.calls.map(([input]) => String(input));
    expect(asked.some((url) => url.includes("status=Rejected"))).toBe(true);
  });

  it("returns to everything when the filter is cleared", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", stubFetch());
    renderScreen();

    await user.click(await screen.findByRole("button", { name: "Accepted" }));
    await screen.findByText("MCC-20260904-KC-01");

    await user.click(screen.getByRole("button", { name: "All" }));

    expect(await screen.findByText("MCC-20260904-NW-01")).toBeInTheDocument();
  });

  it("marks which filter is on", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", stubFetch());
    renderScreen();

    await screen.findByText("MCC-20260904-KC-01");

    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "Accepted" }));

    expect(screen.getByRole("button", { name: "Accepted" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "false");
  });

  it("searches the loaded rows by reference or society", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", stubFetch());
    renderScreen();

    await screen.findByText("MCC-20260904-KC-01");
    await user.type(screen.getByLabelText("Search reference or society"), "Nuwara");

    expect(screen.getByText("MCC-20260904-NW-01")).toBeInTheDocument();
    expect(screen.queryByText("MCC-20260904-KC-01")).not.toBeInTheDocument();
  });

  it("offers the panel only on a consignment still awaiting one", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", stubFetch());
    renderScreen();

    await screen.findByText("MCC-20260904-BD-01");
    expect(screen.getAllByRole("button", { name: "Record the panel" })).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Accepted" }));
    await screen.findByText("MCC-20260904-KC-01");

    expect(screen.queryByRole("button", { name: "Record the panel" })).not.toBeInTheDocument();
  });

  it("says so when the service refuses", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 500 })));
    renderScreen();

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});
