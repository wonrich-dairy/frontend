import type {
  KqColour,
  Measure,
  QualityTestReadings,
  RecordQualityTestRequest,
  TestPreview,
} from "../../api/qualityTests";
import { isComplete, stagesRun, type CascadeAnswers } from "./cascade";

/** The readings as typed, so a half-entered field can be held without being coerced to a number. */
export interface PanelForm {
  fatPercent: string;
  rawLactometerReading: string;
  temperatureCelsius: string;
  waterPercent: string;
  kqColour: KqColour | null;
  alcohol: CascadeAnswers;
  /** The officer confirms what is wrong, not what is right, so these start sound. */
  smellOk: boolean;
  colourOk: boolean;
  tasteOk: boolean;
}

export interface PanelErrors {
  fatPercent?: string;
  rawLactometerReading?: string;
  temperatureCelsius?: string;
  waterPercent?: string;
  kqColour?: string;
  alcohol?: string;
}

export const emptyPanel = (): PanelForm => ({
  fatPercent: "",
  rawLactometerReading: "",
  temperatureCelsius: "",
  waterPercent: "",
  kqColour: null,
  alcohol: {},
  smellOk: true,
  colourOk: true,
  tasteOk: true,
});

/** The ranges the service accepts, so an out-of-range reading is caught at the bench. */
const RANGES = {
  fatPercent: { min: 0, max: 15, label: "Fat must be between 0 and 15 percent." },
  rawLactometerReading: { min: 0, max: 40, label: "The lactometer reading must be between 0 and 40." },
  temperatureCelsius: { min: 0, max: 50, label: "The reading temperature must be between 0 and 50 °C." },
  waterPercent: { min: 0, max: 100, label: "Added water must be between 0 and 100 percent." },
} as const;

type NumericField = keyof typeof RANGES;

export function parseReading(value: string): number | null {
  const trimmed = value.trim();

  if (trimmed === "") {
    return null;
  }

  const parsed = Number(trimmed);

  return Number.isFinite(parsed) ? parsed : null;
}

export function validatePanel(form: PanelForm): PanelErrors {
  const errors: PanelErrors = {};

  for (const field of Object.keys(RANGES) as NumericField[]) {
    const value = parseReading(form[field]);

    if (value === null) {
      errors[field] = "Enter a reading.";
    } else if (value < RANGES[field].min || value > RANGES[field].max) {
      errors[field] = RANGES[field].label;
    }
  }

  if (!form.kqColour) {
    errors.kqColour = "Select the shade the dye settled at.";
  }

  if (!isComplete(form.alcohol)) {
    errors.alcohol = "Work through the alcohol cascade.";
  }

  return errors;
}

export function hasErrors(errors: PanelErrors): boolean {
  return Object.keys(errors).length > 0;
}

/**
 * The readings the service needs to evaluate the panel. Returns null while anything is missing,
 * which is also the signal that there is nothing worth previewing yet.
 */
export function toReadings(form: PanelForm): QualityTestReadings | null {
  if (hasErrors(validatePanel(form))) {
    return null;
  }

  return {
    fatPercent: parseReading(form.fatPercent)!,
    rawLactometerReading: parseReading(form.rawLactometerReading)!,
    temperatureCelsius: parseReading(form.temperatureCelsius)!,
    waterPercent: parseReading(form.waterPercent)!,
    kqColour: form.kqColour!,
    alcoholOutcomes: stagesRun(form.alcohol),
    smellOk: form.smellOk,
    colourOk: form.colourOk,
    tasteOk: form.tasteOk,
  };
}

/**
 * The panel as it is recorded. A rejection has to name what failed and its value, so those are
 * taken from the first measure the service flagged rather than left to the officer to retype.
 */
export function toRecordRequest(
  readings: QualityTestReadings,
  preview: TestPreview,
): RecordQualityTestRequest {
  if (preview.meetsStandard && !preview.clotOnBoiling) {
    return { ...readings, verdict: "Accept" };
  }

  const failed = firstBreach(preview);

  return {
    ...readings,
    verdict: "Reject",
    failedParameter: failed?.measure ?? "ClotOnBoiling",
    failedValue: failed?.value ?? "Positive",
  };
}

/** The measure the rejection is pinned to: the first one outside its limit. */
export function firstBreach(preview: TestPreview): Measure | undefined {
  return preview.measures.find((measure) => measure.isOutsideThreshold);
}

/**
 * Whether the panel would be accepted. Clotting on boiling curdles the milk, which is refused
 * outright rather than weighed against the other measures.
 */
export function verdictOf(preview: TestPreview): "Accept" | "Reject" {
  return preview.meetsStandard && !preview.clotOnBoiling ? "Accept" : "Reject";
}
