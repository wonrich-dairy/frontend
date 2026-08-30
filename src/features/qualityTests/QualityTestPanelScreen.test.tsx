import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionProvider } from "../../auth/SessionContext";
import { SyncProvider } from "../sync/SyncProvider";
import { emptyQueue } from "../sync/queue";
import { QualityTestPanelScreen } from "./QualityTestPanelScreen";

const consignment = {
  id: "c1",
  reference: "MCC-20260830-KG-01",
  societyId: "s1",
  societyCode: "KG",
  societyName: "Kobeigane",
  arrivalAtLocal: "2026-08-30T07:40:00",
  arrivalDate: "2026-08-30",
  status: "Registered",
  totalQuantityKg: 40,
  totalQuantityLitres: 38.8,
  canCount: 1,
  registeredAtUtc: "2026-08-30T02:10:00Z",
  registeredBy: "k.perera",
  cans: [],
};

const soundPreview = {
  correctedClr: 28.9,
  snf: 8.53,
  totalSolids: 12.63,
  stabilityGrade: "Stable",
  passedAlcoholAt: "Alcohol80",
  clotOnBoiling: false,
  measures: [{ measure: "Snf", value: "8.53", isOutsideThreshold: false, detail: null }],
  meetsStandard: true,
};

const failingPreview = {
  ...soundPreview,
  snf: 7.84,
  totalSolids: 11.34,
  correctedClr: 23.4,
  measures: [
    {
      measure: "CorrectedClr",
      value: "23.40",
      isOutsideThreshold: true,
      detail: "Low CLR detected. Fails standard parameters.",
    },
  ],
  meetsStandard: false,
};

const session = {
  accessToken: "test-token",
  expiresAtUtc: new Date(Date.now() + 3_600_000).toISOString(),
  userName: "k.perera",
};

let fetchMock: ReturnType<typeof vi.fn>;

function stubFetch(preview: unknown, record?: () => Response) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

    if (url.includes("/api/consignments?")) {
      return json({ items: [consignment], page: 1, pageSize: 100, totalCount: 1, totalPages: 1 });
    }

    if (url.includes("/quality-test/preview")) {
      return json(preview);
    }

    if (url.includes("/quality-test") && init?.method === "POST") {
      return record ? record() : json({ ...soundPreview, verdict: "Accept" }, 201);
    }

    throw new Error(`Unexpected request: ${url}`);
  });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function renderScreen() {
  return render(
    <SessionProvider initialSession={session}>
      <SyncProvider initialQueue={emptyQueue()}>
        <QualityTestPanelScreen />
      </SyncProvider>
    </SessionProvider>,
  );
}

async function pickConsignment(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: /MCC-20260830-KG-01/ }));
}

async function enterReadings(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Fat %"), "4.1");
  await user.type(screen.getByLabelText("CLR (Lactometer)"), "28.5");
  await user.type(screen.getByLabelText("Added Water %"), "0");
  await user.type(screen.getByLabelText("Temp °C"), "29");
}

beforeEach(() => {
  Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
  fetchMock = stubFetch(soundPreview);
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe("choosing what to test", () => {
  it("offers the consignments still waiting on a verdict", async () => {
    renderScreen();

    expect(await screen.findByRole("button", { name: /MCC-20260830-KG-01/ })).toBeInTheDocument();
  });

  it("shows the chosen consignment on the panel", async () => {
    const user = userEvent.setup();
    renderScreen();
    await pickConsignment(user);

    expect(screen.getByText(/Consignment ID:/)).toHaveTextContent("MCC-20260830-KG-01");
  });
});

describe("the alcohol cascade", () => {
  it("asks 75% only once 80% has clotted", async () => {
    const user = userEvent.setup();
    renderScreen();
    await pickConsignment(user);

    const cascade = screen.getByLabelText("Alcohol test cascade");
    const at75 = within(cascade).getByRole("group", { name: "75% Alcohol Test" });

    // Present but inert until the rung above it fails.
    expect(within(at75).getByRole("button", { name: /Fail/ })).toBeDisabled();

    const at80 = within(cascade).getByRole("group", { name: "80% Alcohol Test" });
    await user.click(within(at80).getByRole("button", { name: /Fail/ }));

    expect(within(at75).getByRole("button", { name: /Fail/ })).toBeEnabled();
  });

  it("stops asking once a stage passes", async () => {
    const user = userEvent.setup();
    renderScreen();
    await pickConsignment(user);

    const cascade = screen.getByLabelText("Alcohol test cascade");
    const at80 = within(cascade).getByRole("group", { name: "80% Alcohol Test" });
    await user.click(within(at80).getByRole("button", { name: /Pass/ }));

    const at75 = within(cascade).getByRole("group", { name: "75% Alcohol Test" });
    expect(within(at75).getByRole("button", { name: /Fail/ })).toBeDisabled();
  });
});

describe("the derived values", () => {
  it("shows the SNF and TS the service calculated, not figures typed in", async () => {
    const user = userEvent.setup();
    renderScreen();
    await pickConsignment(user);

    await enterReadings(user);
    await user.click(
      within(screen.getByRole("group", { name: "80% Alcohol Test" })).getByRole("button", {
        name: /Pass/,
      }),
    );
    await user.click(screen.getByRole("radio", { name: /Excellent/ }));

    const derived = await screen.findByLabelText("Calculated values");
    await waitFor(() => expect(within(derived).getByText("8.53%")).toBeInTheDocument());
    expect(within(derived).getByText("12.63%")).toBeInTheDocument();

    // There is no SNF or TS input for the officer to type into.
    expect(screen.queryByLabelText(/^SNF/)).toBeNull();
    expect(screen.queryByLabelText(/^TS/)).toBeNull();
  });

  it("shows the verdict as soon as the readings are complete", async () => {
    const user = userEvent.setup();
    renderScreen();
    await pickConsignment(user);

    await enterReadings(user);
    await user.click(
      within(screen.getByRole("group", { name: "80% Alcohol Test" })).getByRole("button", {
        name: /Pass/,
      }),
    );
    await user.click(screen.getByRole("radio", { name: /Excellent/ }));

    expect(await screen.findByText("Accepted")).toBeInTheDocument();
  });

  it("names the failing measure when the panel does not meet the standard", async () => {
    vi.stubGlobal("fetch", (fetchMock = stubFetch(failingPreview)));

    const user = userEvent.setup();
    renderScreen();
    await pickConsignment(user);

    await enterReadings(user);
    await user.click(
      within(screen.getByRole("group", { name: "80% Alcohol Test" })).getByRole("button", {
        name: /Pass/,
      }),
    );
    await user.click(screen.getByRole("radio", { name: /Excellent/ }));

    expect(await screen.findByText("Rejected")).toBeInTheDocument();
    expect(screen.getByText(/Low CLR detected/)).toBeInTheDocument();
  });
});

describe("recording the panel", () => {
  it("does not submit while the panel is incomplete", async () => {
    const user = userEvent.setup();
    renderScreen();
    await pickConsignment(user);

    await user.click(screen.getByRole("button", { name: /Confirm & Save Test/ }));

    expect(await screen.findByText("Select the shade the dye settled at.")).toBeInTheDocument();
    expect(recordCalls()).toHaveLength(0);
  });

  it("sends the verdict and the stages that ran", async () => {
    const user = userEvent.setup();
    renderScreen();
    await pickConsignment(user);

    await enterReadings(user);
    await user.click(
      within(screen.getByRole("group", { name: "80% Alcohol Test" })).getByRole("button", {
        name: /Pass/,
      }),
    );
    await user.click(screen.getByRole("radio", { name: /Excellent/ }));

    await screen.findByText("Accepted");
    await user.click(screen.getByRole("button", { name: /Confirm & Save Test/ }));

    await waitFor(() => expect(recordCalls()).toHaveLength(1));

    const body = JSON.parse(String(recordCalls()[0][1].body));
    expect(body.verdict).toBe("Accept");
    expect(body.kqColour).toBe("Blue");
    expect(body.alcoholOutcomes).toEqual({ Alcohol80: "Negative" });
    expect(body).not.toHaveProperty("snf");
  });
});

function recordCalls(): [RequestInfo | URL, RequestInit][] {
  const calls = fetchMock.mock.calls as unknown as [RequestInfo | URL, RequestInit | undefined][];

  return calls
    .filter(
      (call) =>
        String(call[0]).includes("/quality-test") &&
        !String(call[0]).includes("/preview") &&
        call[1]?.method === "POST",
    )
    .map((call) => [call[0], call[1] as RequestInit]);
}
