import { request } from "./http";

export const KQ_COLOURS = [
  "Blue",
  "LightBlue",
  "Purple",
  "PurplePink",
  "LightPink",
  "Pink",
  "White",
] as const;

export type KqColour = (typeof KQ_COLOURS)[number];

export const ALCOHOL_STAGES = ["Alcohol80", "Alcohol75", "Alcohol68", "ClotOnBoiling"] as const;

export type AlcoholStage = (typeof ALCOHOL_STAGES)[number];

export type StageOutcome = "Negative" | "Positive";

export interface QualityTestReadings {
  fatPercent: number;
  rawLactometerReading: number;
  temperatureCelsius: number;
  waterPercent: number;
  kqColour: KqColour;
  alcoholOutcomes: Partial<Record<AlcoholStage, StageOutcome>>;
  smellOk: boolean;
  colourOk: boolean;
  tasteOk: boolean;
}

export interface Measure {
  measure: string;
  value: string;
  isOutsideThreshold: boolean;
  detail: string | null;
}

export interface TestPreview {
  correctedClr: number;
  snf: number;
  totalSolids: number;
  stabilityGrade: string;
  passedAlcoholAt: string;
  clotOnBoiling: boolean;
  measures: Measure[];
  meetsStandard: boolean;
}

export interface QualityTestView {
  id: string;
  consignmentId: string;
  consignmentReference: string;
  fatPercent: number;
  rawLactometerReading: number;
  temperatureCelsius: number;
  waterPercent: number;
  kqColour: string;
  smellOk: boolean;
  colourOk: boolean;
  tasteOk: boolean;
  correctedClr: number;
  snf: number;
  totalSolids: number;
  stabilityGrade: string;
  passedAlcoholAt: string;
  alcoholStages: { stage: string; outcome: string }[];
  verdict: string;
  failedParameter: string | null;
  failedValue: string | null;
  testedBy: string | null;
  testedAtUtc: string;
}

export interface RecordQualityTestRequest extends QualityTestReadings {
  verdict: "Accept" | "Reject";
  failedParameter?: string;
  failedValue?: string;
}

export function previewQualityTest(
  reference: string,
  readings: QualityTestReadings,
  token: string | null,
  signal?: AbortSignal,
): Promise<TestPreview> {
  return request<TestPreview>(`/api/consignments/${encodeURIComponent(reference)}/quality-test/preview`, {
    method: "POST",
    body: { ...readings, verdict: "Accept" },
    token,
    signal,
  });
}

export function recordQualityTest(
  reference: string,
  body: RecordQualityTestRequest,
  token: string | null,
): Promise<QualityTestView> {
  return request<QualityTestView>(`/api/consignments/${encodeURIComponent(reference)}/quality-test`, {
    method: "POST",
    body,
    token,
  });
}
