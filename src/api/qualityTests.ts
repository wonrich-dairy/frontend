import { request } from "./http";

/**
 * The quality panel endpoints (SCRUM-7). Every derived figure — the corrected lactometer reading,
 * SNF, TS, the stability grade, and whether the sample meets the standard — comes from the
 * service, which computes them with the shared panel library (SCRUM-50). Recomputing any of it in
 * the browser would reintroduce exactly the drift between gate and lab that the library exists to
 * prevent, so the screen asks and displays rather than calculates.
 */

/** The seven-shade KQ scale. The numeric values are the stored contract; order is best to worst. */
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

/** The cascade runs hardest first and stops at the first sample that does not clot. */
export const ALCOHOL_STAGES = ["Alcohol80", "Alcohol75", "Alcohol68", "ClotOnBoiling"] as const;

export type AlcoholStage = (typeof ALCOHOL_STAGES)[number];

/** "Positive" means the sample clotted, which the officer reads as a failed stage. */
export type StageOutcome = "Negative" | "Positive";

export interface QualityTestReadings {
  fatPercent: number;
  rawLactometerReading: number;
  temperatureCelsius: number;
  waterPercent: number;
  kqColour: KqColour;
  alcoholOutcomes: Partial<Record<AlcoholStage, StageOutcome>>;
}

/** One measure as the service judged it. */
export interface Measure {
  measure: string;
  value: string;
  isOutsideThreshold: boolean;
  detail: string | null;
}

/** What the officer sees before committing to a verdict; nothing is stored. */
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

/** Evaluates readings without recording anything. */
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

/** Records the panel and settles the consignment's verdict. A consignment is tested once. */
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
