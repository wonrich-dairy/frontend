import { describe, expect, it } from "vitest";
import type { TestPreview } from "../../api/qualityTests";
import {
  emptyPanel,
  firstBreach,
  hasErrors,
  toReadings,
  toRecordRequest,
  validatePanel,
  verdictOf,
  type PanelForm,
} from "./panel";

const sound = (): PanelForm => ({
  fatPercent: "4.1",
  rawLactometerReading: "28.5",
  temperatureCelsius: "29.0",
  waterPercent: "0",
  kqColour: "Blue",
  alcohol: { Alcohol80: "Negative" },
  smellOk: true,
  colourOk: true,
  tasteOk: true,
});

const preview = (over: Partial<TestPreview> = {}): TestPreview => ({
  correctedClr: 28.9,
  snf: 8.53,
  totalSolids: 12.63,
  stabilityGrade: "Stable",
  passedAlcoholAt: "Alcohol80",
  clotOnBoiling: false,
  measures: [
    { measure: "FatPercent", value: "4.10", isOutsideThreshold: false, detail: null },
    { measure: "Snf", value: "8.53", isOutsideThreshold: false, detail: null },
  ],
  meetsStandard: true,
  ...over,
});

describe("validating the panel", () => {
  it("accepts a complete panel", () => {
    expect(hasErrors(validatePanel(sound()))).toBe(false);
  });

  it("asks for every reading before anything is evaluated", () => {
    const errors = validatePanel(emptyPanel());

    expect(errors.fatPercent).toBe("Enter a reading.");
    expect(errors.rawLactometerReading).toBe("Enter a reading.");
    expect(errors.temperatureCelsius).toBe("Enter a reading.");
    expect(errors.waterPercent).toBe("Enter a reading.");
    expect(errors.kqColour).toBe("Select the shade the dye settled at.");
    expect(errors.alcohol).toBe("Work through the alcohol cascade.");
  });

  it("holds readings to the ranges the service accepts", () => {
    expect(validatePanel({ ...sound(), fatPercent: "16" }).fatPercent).toContain("0 and 15");
    expect(validatePanel({ ...sound(), rawLactometerReading: "41" }).rawLactometerReading).toContain(
      "0 and 40",
    );
    expect(validatePanel({ ...sound(), temperatureCelsius: "51" }).temperatureCelsius).toContain(
      "0 and 50",
    );
  });

  it("will not evaluate a cascade that has not run its course", () => {
    const halfway = { ...sound(), alcohol: { Alcohol80: "Positive" } as const };

    expect(validatePanel(halfway).alcohol).toBe("Work through the alcohol cascade.");
    expect(toReadings(halfway)).toBeNull();
  });
});

describe("the readings sent for evaluation", () => {
  it("sends the numbers and only the stages that ran", () => {
    expect(toReadings(sound())).toEqual({
      fatPercent: 4.1,
      rawLactometerReading: 28.5,
      temperatureCelsius: 29,
      waterPercent: 0,
      kqColour: "Blue",
      alcoholOutcomes: { Alcohol80: "Negative" },
      smellOk: true,
      colourOk: true,
      tasteOk: true,
    });
  });

  it("carries what the officer's senses found", () => {
    const readings = toReadings({ ...sound(), smellOk: false })!;

    expect(readings.smellOk).toBe(false);
    expect(readings.colourOk).toBe(true);
    expect(readings.tasteOk).toBe(true);
  });

  it("carries no SNF or TS, because the service derives them", () => {
    const readings = toReadings(sound())!;

    expect(readings).not.toHaveProperty("snf");
    expect(readings).not.toHaveProperty("totalSolids");
    expect(readings).not.toHaveProperty("correctedClr");
  });
});

describe("the verdict", () => {
  it("accepts a panel with nothing out of range", () => {
    expect(verdictOf(preview())).toBe("Accept");
  });

  it("rejects a panel with a measure outside its limit", () => {
    expect(verdictOf(preview({ meetsStandard: false }))).toBe("Reject");
  });

  it("rejects a curdled sample even when every measure is in range", () => {
    expect(verdictOf(preview({ clotOnBoiling: true }))).toBe("Reject");
  });
});

describe("recording the panel", () => {
  it("submits an acceptance with no failure named", () => {
    const request = toRecordRequest(toReadings(sound())!, preview());

    expect(request.verdict).toBe("Accept");
    expect(request.failedParameter).toBeUndefined();
    expect(request.failedValue).toBeUndefined();
  });

  it("names the failing measure and its value, which a rejection must carry", () => {
    const failing = preview({
      meetsStandard: false,
      measures: [
        { measure: "FatPercent", value: "4.10", isOutsideThreshold: false, detail: null },
        { measure: "Snf", value: "7.90", isOutsideThreshold: true, detail: "SNF is below 8.30." },
      ],
    });

    const request = toRecordRequest(toReadings(sound())!, failing);

    expect(request.verdict).toBe("Reject");
    expect(request.failedParameter).toBe("Snf");
    expect(request.failedValue).toBe("7.90");
  });

  it("pins a curdled sample on the boiling test when no measure is flagged", () => {
    const request = toRecordRequest(toReadings(sound())!, preview({ clotOnBoiling: true }));

    expect(request.verdict).toBe("Reject");
    expect(request.failedParameter).toBe("ClotOnBoiling");
  });

  it("reports the first breach, which is what the officer is shown", () => {
    const failing = preview({
      meetsStandard: false,
      measures: [
        { measure: "CorrectedClr", value: "23.00", isOutsideThreshold: true, detail: "CLR is low." },
        { measure: "Snf", value: "7.90", isOutsideThreshold: true, detail: "SNF is below 8.30." },
      ],
    });

    expect(firstBreach(failing)?.measure).toBe("CorrectedClr");
  });
});
