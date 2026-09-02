import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionProvider } from "../../auth/SessionContext";
import { RegisterConsignmentScreen } from "./RegisterConsignmentScreen";

const society = {
  id: "6f0f6f1a-0001-4a2b-9c3d-000000000001",
  code: "KG",
  name: "Kobeigane",
  canLabelPrefix: "KG",
  contactPerson: "Sunil Perera",
  contactNumber: null,
  isActive: true,
};

const registered = {
  id: "b1a1",
  reference: "MCC-20260830-KG-01",
  societyId: society.id,
  societyCode: "KG",
  societyName: "Kobeigane",
  arrivalAtLocal: "2026-08-30T07:40:00",
  arrivalDate: "2026-08-30",
  status: "Registered",
  totalQuantityKg: 40.5,
  totalQuantityLitres: 39.32,
  canCount: 1,
  registeredAtUtc: "2026-08-30T02:10:00Z",
  registeredBy: "k.perera",
  cans: [{ canLabel: "KG 01", canNumber: 1, quantityKg: 40.5, quantityLitres: 39.32 }],
};

const session = {
  accessToken: "test-token",
  expiresAtUtc: new Date(Date.now() + 3_600_000).toISOString(),
  userName: "k.perera",
};

/** Answers the societies GET; the POST is set per test so each can choose its outcome. */
function stubFetch(post: () => Promise<Response> | Response) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

    if (url.includes("/api/societies")) {
      return new Response(JSON.stringify([society]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.includes("/api/consignments") && init?.method === "POST") {
      return post();
    }

    throw new Error(`Unexpected request: ${init?.method ?? "GET"} ${url}`);
  });
}

function renderScreen() {
  return render(
    <SessionProvider initialSession={session}>
      <RegisterConsignmentScreen />
    </SessionProvider>,
  );
}

async function chooseSociety(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText("Search society name or tag"), "Kobei");
  await user.click(await screen.findByRole("button", { name: /Kobeigane/ }));
}

async function fillFirstCan(user: ReturnType<typeof userEvent.setup>, label: string, kg: string) {
  const labels = screen.getAllByLabelText("Can label");
  const weights = screen.getAllByLabelText("Kilograms");

  await user.clear(labels[0]);
  await user.type(labels[0], label);
  await user.clear(weights[0]);
  await user.type(weights[0], kg);
}

let fetchMock: ReturnType<typeof stubFetch>;

beforeEach(() => {
  fetchMock = stubFetch(
    () =>
      new Response(JSON.stringify(registered), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
  );

  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe("registering a consignment", () => {
  it("only offers societies once the officer searches", async () => {
    const user = userEvent.setup();
    renderScreen();

    const search = await screen.findByLabelText("Search society name or tag");
    expect(screen.queryByRole("button", { name: /Kobeigane/ })).not.toBeInTheDocument();

    await user.type(search, "KG");

    expect(await screen.findByRole("button", { name: /Kobeigane/ })).toBeInTheDocument();
  });

  it("keeps the search and the can sheet on screen after a society is chosen", async () => {
    const user = userEvent.setup();
    renderScreen();

    await chooseSociety(user);

    // The card sits under the search rather than replacing it, so the sheet below does not move.
    expect(screen.getByLabelText("Search society name or tag")).toBeInTheDocument();
    expect(screen.getByLabelText("Can label")).toBeEnabled();
    expect(screen.getByRole("button", { name: /Add another can/ })).toBeEnabled();
  });

  it("removes a can from the sheet through the row action sheet", async () => {
    const user = userEvent.setup();
    renderScreen();

    await chooseSociety(user);
    await fillFirstCan(user, "KG-01", "40.5");
    await user.click(screen.getByRole("button", { name: /Add another can/ }));

    // The row carries no delete icon of its own; the three-dots opens the sheet that holds it.
    await user.click(screen.getAllByRole("button", { name: /Actions for can 1/ })[0]);

    const sheet = await screen.findByRole("dialog", { name: /KG-01/ });
    expect(sheet).toHaveTextContent("40.5 kg");

    await user.click(screen.getByRole("button", { name: /Delete Entry/ }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getAllByLabelText("Can label")[0]).toHaveValue("");
  });

  it("sends the officer back to the label when the sheet offers to edit the row", async () => {
    const user = userEvent.setup();
    renderScreen();

    await chooseSociety(user);
    await fillFirstCan(user, "KG-01", "40.5");
    await user.click(screen.getByRole("button", { name: /Actions for can 1/ }));
    await user.click(await screen.findByRole("button", { name: /Edit Entry/ }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Can label")).toHaveFocus();
  });

  it("does not submit while the society is missing", async () => {
    const user = userEvent.setup();
    renderScreen();

    await screen.findByLabelText("Search society name or tag");
    await user.click(screen.getByRole("button", { name: /Register consignment/ }));

    expect(await screen.findByText("Select the supplying society.")).toBeInTheDocument();
    expect(postCount()).toBe(0);
  });

  it("does not submit while the can sheet is empty", async () => {
    const user = userEvent.setup();
    renderScreen();

    await chooseSociety(user);
    await user.click(screen.getByRole("button", { name: /Register consignment/ }));

    expect(await screen.findByText("Record at least one can.")).toBeInTheDocument();
    expect(postCount()).toBe(0);
  });

  it("refuses a can label belonging to another society", async () => {
    const user = userEvent.setup();
    renderScreen();

    await chooseSociety(user);
    await fillFirstCan(user, "PP-99", "40");
    await user.click(screen.getByRole("button", { name: /Register consignment/ }));

    expect(await screen.findByText("Label must start with society tag (KG)")).toBeInTheDocument();
    expect(postCount()).toBe(0);
  });

  it("refuses a weight the service would reject", async () => {
    const user = userEvent.setup();
    renderScreen();

    await chooseSociety(user);
    await fillFirstCan(user, "KG-01", "0");
    await user.click(screen.getByRole("button", { name: /Register consignment/ }));

    expect(await screen.findByText("Weight must be more than zero.")).toBeInTheDocument();
    expect(postCount()).toBe(0);
  });

  it("keeps a running total of the kilograms entered", async () => {
    const user = userEvent.setup();
    renderScreen();

    await chooseSociety(user);
    await fillFirstCan(user, "KG-01", "40.5");

    const total = screen.getByLabelText("Consignment total");
    expect(within(total).getByText(/40\.5/)).toBeInTheDocument();
  });

  it("sends can numbers and kilograms, and confirms with the allocated reference", async () => {
    const user = userEvent.setup();
    renderScreen();

    await chooseSociety(user);
    await fillFirstCan(user, "KG-01", "40.5");
    await user.click(screen.getByRole("button", { name: /Register consignment/ }));

    expect(await screen.findByText("Saved successfully")).toBeInTheDocument();
    expect(screen.getByText("MCC-20260830-KG-01")).toBeInTheDocument();

    const body = JSON.parse(String(postCall()![1]!.body));
    expect(body).toEqual({
      societyId: society.id,
      cans: [{ canNumber: 1, quantityKg: 40.5 }],
    });
  });

  it("clears the sheet for the next delivery once the record has landed", async () => {
    const user = userEvent.setup();
    renderScreen();

    await chooseSociety(user);
    await fillFirstCan(user, "KG-01", "40.5");
    await user.click(screen.getByRole("button", { name: /Register consignment/ }));

    await user.click(await screen.findByRole("button", { name: /Register another consignment/ }));

    // Back to an empty sheet with no society chosen, so the previous delivery cannot be sent twice.
    expect(await screen.findByLabelText("Search society name or tag")).toHaveValue("");
    expect(screen.queryByRole("button", { name: /Kobeigane/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Can label")).toHaveValue("");
    expect(screen.getByLabelText("Kilograms")).toHaveValue("");
  });

  it("shows the refusal from the service rather than a generic failure", async () => {
    vi.stubGlobal(
      "fetch",
      (fetchMock = stubFetch(
        () =>
          new Response(
            JSON.stringify({
              status: 422,
              title: "Intake closed for the day",
              detail:
                "Milk intake closes at 16:00. This consignment arrived at 21:13 and cannot be registered for that day.",
              code: "intake_cutoff_exceeded",
              cutoff: "16:00",
              arrivalTime: "21:13",
            }),
            { status: 422, headers: { "Content-Type": "application/problem+json" } },
          ),
      )),
    );

    const user = userEvent.setup();
    renderScreen();

    await chooseSociety(user);
    await fillFirstCan(user, "KG-01", "40.5");
    await user.click(screen.getByRole("button", { name: /Register consignment/ }));

    expect(await screen.findByText(/Milk intake closes at 16:00/)).toBeInTheDocument();

    // The sheet is left as it was, so the officer can correct and resubmit.
    expect(screen.getByLabelText("Can label")).toHaveValue("KG-01");
  });

  it("says so plainly when the service cannot be reached", async () => {
    vi.stubGlobal(
      "fetch",
      (fetchMock = stubFetch(() => Promise.reject(new TypeError("Failed to fetch")))),
    );

    const user = userEvent.setup();
    renderScreen();

    await chooseSociety(user);
    await fillFirstCan(user, "KG-01", "40.5");
    await user.click(screen.getByRole("button", { name: /Register consignment/ }));

    await waitFor(() =>
      expect(screen.getByText(/Cannot reach the intake service/)).toBeInTheDocument(),
    );
  });
});

function postCall() {
  return fetchMock.mock.calls.find(
    (call) => String(call[0]).includes("/api/consignments") && call[1]?.method === "POST",
  );
}

function postCount() {
  return fetchMock.mock.calls.filter(
    (call) => String(call[0]).includes("/api/consignments") && call[1]?.method === "POST",
  ).length;
}
