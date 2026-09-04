import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionProvider } from "../../auth/SessionContext";
import { TraceBatchScreen } from "./TraceBatchScreen";
import { sessionFor } from "../../test/tokens";

const session = sessionFor("QualityAnalyst");

const trace = {
  batchReference: "BAT-782-991",
  batchDate: "2026-08-30",
  createdAtUtc: "2026-08-30T03:15:00Z",
  arrivedAtLocal: "2026-08-30T08:45:00",
  screenedBy: "f.silva",
  screenedAtUtc: "2026-08-30T03:20:00Z",
  dispatchNoteReference: "DSP-4421-A",
  bowserRegistration: "WP-LC-8832",
  driverName: "Thomas R.",
  dispatchedAtLocal: "2026-08-30T06:15:00",
  dispatchedBy: "m.perera",
  dispatchRecordedAtUtc: "2026-08-30T00:45:00Z",
  totalDispatchedLitres: 12500,
  tanks: [
    {
      tankCode: "T1",
      tankName: "Primary Cooler",
      quantityDrawnLitres: 4500,
      missing: [],
      consignments: [
        {
          reference: "CON-9921",
          societyCode: "KG",
          societyName: "Valley Co-op Society",
          canLabels: ["KG-01", "KG-02"],
          quantityLitres: 450,
          quantityKg: 463.5,
          arrivalAtLocal: "2026-08-30T07:10:00",
          registeredBy: "k.perera",
          registeredAtUtc: "2026-08-30T01:40:00Z",
          pouredAtUtc: "2026-08-30T02:05:00Z",
          pouredBy: "k.perera",
          tightestMargin: 0.35,
          missing: [],
          qualityTest: {
            fatPercent: 4.1,
            rawLactometerReading: 28.5,
            temperatureCelsius: 29,
            waterPercent: 0,
            kqColour: "Blue",
            correctedClr: 28.9,
            snf: 8.85,
            totalSolids: 12.95,
            stabilityGrade: "Stable",
            passedAlcoholAt: "Alcohol80",
            verdict: "Accept",
            testedBy: "k.perera",
          },
        },
        {
          reference: "CON-9922",
          societyCode: "MG",
          societyName: "Hillside Dairy",
          canLabels: ["MG-01"],
          quantityLitres: 300,
          quantityKg: 309,
          arrivalAtLocal: "2026-08-30T07:25:00",
          registeredBy: "k.perera",
          registeredAtUtc: "2026-08-30T01:55:00Z",
          pouredAtUtc: "2026-08-30T02:10:00Z",
          pouredBy: "k.perera",
          tightestMargin: 0,
          missing: ["No gate quality test is recorded for this consignment."],
          qualityTest: null,
        },
      ],
    },
  ],
  societiesByMargin: [
    {
      societyCode: "KG",
      societyName: "Valley Co-op Society",
      consignmentCount: 3,
      tightestMargin: 0.35,
      tightestMeasure: "Snf",
    },
  ],
  missing: [],
};

function stubFetch(body: unknown, status = 200) {
  return vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
  );
}

function renderScreen() {
  return render(
    <SessionProvider initialSession={session}>
      <TraceBatchScreen />
    </SessionProvider>,
  );
}

async function searchFor(user: ReturnType<typeof userEvent.setup>, reference: string) {
  await user.type(screen.getByLabelText("Batch reference"), reference);
  await user.keyboard("{Enter}");
}

async function expand(user: ReturnType<typeof userEvent.setup>, section: string | RegExp) {
  await user.click(await screen.findByRole("button", { name: section }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("tracing a batch", () => {
  it("resolves a batch through its dispatch note, tanks and consignments", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", stubFetch(trace));
    renderScreen();

    await searchFor(user, "BAT-782-991");

    expect(await screen.findByText("DSP-4421-A")).toBeInTheDocument();
    expect(screen.getByText("WP-LC-8832")).toBeInTheDocument();

    await expand(user, /Source Tanks/);

    expect(screen.getByText("4500.0 L")).toBeInTheDocument();

    expect(screen.getByText("CON-9921")).toBeInTheDocument();
    expect(screen.getByText("Cans: KG-01, KG-02")).toBeInTheDocument();
  });

  it("shows the gate's own verdict, and does not invent one where no panel was recorded", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", stubFetch(trace));
    renderScreen();

    await searchFor(user, "BAT-782-991");

    expect(await screen.findByText("Accept")).toBeInTheDocument();

    expect(screen.getByText("Not tested")).toBeInTheDocument();
    expect(
      screen.getByText("No gate quality test is recorded for this consignment."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Breached")).not.toBeInTheDocument();
  });

  it("counts a society's consignments and names the measure that ran closest", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", stubFetch(trace));
    renderScreen();

    await searchFor(user, "BAT-782-991");
    await expand(user, /Societies by tightest margin/);

    expect(await screen.findByText("0.35")).toBeInTheDocument();
    expect(screen.getByText("Snf")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("says which reference was not found rather than reporting a generic failure", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", stubFetch({ status: 404, title: "Batch not found" }, 404));
    renderScreen();

    await searchFor(user, "BAT-000-000");

    expect(await screen.findByText(/No batch carries the reference "BAT-000-000"/)).toBeInTheDocument();
  });
});
