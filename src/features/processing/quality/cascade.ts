/**
 * Real lab process - Alcohol Test Cascade + Calculated Values
 * Never lose this logic - per user 2026-09-15
 * 
 * Terminology:
 * - Positive = clotted = BAD/FAIL
 * - Negative = not clotted = GOOD/PASS
 */

export type AlcoholOutcome = "Negative" | "Positive";
export type AlcoholStage = "80" | "75" | "68" | "COB";

export interface AlcoholCascade {
  Alcohol80: AlcoholOutcome | null; // always required first
  Alcohol75: AlcoholOutcome | null; // only if 80 Positive
  Alcohol68: AlcoholOutcome | null; // only if 75 Positive
  Cob: AlcoholOutcome | null; // only if 68 Positive (all three failed)
}

export const KQ_COLOURS = [
  { value: "Blue", label: "Blue", hex: "#3b82f6", meaning: "Excellent" },
  { value: "Light Blue", label: "Light Blue", hex: "#60a5fa", meaning: "Very Good" },
  { value: "Purple", label: "Purple", hex: "#a855f7", meaning: "Good" },
  { value: "Purple Pink", label: "Purple Pink", hex: "#d946ef", meaning: "Fair" },
  { value: "Light Pink", label: "Light Pink", hex: "#f9a8d4", meaning: "Poor" },
  { value: "Pink", label: "Pink", hex: "#ec4899", meaning: "Very Poor" },
  { value: "White", label: "White", hex: "#ffffff", meaning: "Fail" },
] as const;

export type KqColourValue = typeof KQ_COLOURS[number]["value"];

export function getKqMeta(colour: string) {
  return KQ_COLOURS.find(c => c.value.toLowerCase() === colour.trim().toLowerCase()) ?? null;
}

// Calculated values - never entered manually
export function calculateCorrectedClr(rawClr: number, temperature: number): number {
  // Corrected CLR = raw CLR + 0.2 x (temperature - 27)
  return rawClr + 0.2 * (temperature - 27);
}

export function calculateSnf(fatPercent: number, correctedClr: number): number {
  // SNF % = (Fat x 0.22) + (Corrected CLR x 0.25) + 0.72
  return (fatPercent * 0.22) + (correctedClr * 0.25) + 0.72;
}

export function calculateTs(snf: number, fatPercent: number): number {
  // TS % = SNF % + Fat %
  return snf + fatPercent;
}

// Validate cascade sequence per real process
export function validateCascade(cascade: AlcoholCascade): string | null {
  const isValid = (v: any) => v === "Negative" || v === "Positive";

  if (!cascade.Alcohol80 || !isValid(cascade.Alcohol80)) {
    return "Alcohol 80% test is required and must be Negative (good, no clot) or Positive (bad, clotted)";
  }

  if (cascade.Alcohol80 === "Negative") {
    if (cascade.Alcohol75 || cascade.Alcohol68 || cascade.Cob) {
      return "Cascade violation: 80% Negative means STOP - 75%,68%,COB must not be tested";
    }
    return null;
  }

  // 80 Positive -> 75 required
  if (!cascade.Alcohol75 || !isValid(cascade.Alcohol75)) {
    return "Cascade: 80% Positive (clotted) requires retest at 75%";
  }

  if (cascade.Alcohol75 === "Negative") {
    if (cascade.Alcohol68 || cascade.Cob) {
      return "Cascade violation: 75% Negative means STOP - 68%,COB must not be tested";
    }
    return null;
  }

  if (!cascade.Alcohol68 || !isValid(cascade.Alcohol68)) {
    return "Cascade: 75% Positive requires retest at 68%";
  }

  if (cascade.Alcohol68 === "Negative") {
    if (cascade.Cob) {
      return "Cascade violation: 68% Negative means STOP - COB must not be tested";
    }
    return null;
  }

  if (!cascade.Cob || !isValid(cascade.Cob)) {
    return "Cascade: 80%,75%,68% all Positive requires COB (Clot-on-Boiling) as final test - COB ONLY after all three failed";
  }

  return null;
}

export function deriveAlcoholResult(cascade: AlcoholCascade): string {
  if (cascade.Alcohol80 === "Negative") return "Passed 80%";
  if (cascade.Alcohol75 === "Negative") return "Passed 75%";
  if (cascade.Alcohol68 === "Negative") return "Passed 68%";
  if (cascade.Cob === "Negative") return "Passed COB";
  if (cascade.Cob === "Positive") return "Failed COB";
  return "Unknown";
}

export function deriveProductLine(cascade: AlcoholCascade): string {
  if (cascade.Alcohol80 === "Negative") return "Fresh / Flavoured (Best quality)";
  if (cascade.Alcohol75 === "Negative") return "Yogurt (Acceptable)";
  if (cascade.Alcohol68 === "Negative") return "Yogurt (Acceptable)";
  if (cascade.Cob === "Negative") return "Yogurt (Last resort - still accepted)";
  if (cascade.Cob === "Positive") return "REJECT - COB Positive overrides all";
  return "Pending";
}

export interface VerdictResult {
  verdict: "Accept" | "Reject";
  failedParameter?: string;
  failedValue?: string;
  reason: string;
}

export function determineVerdict(params: {
  smellOk: boolean;
  colourOk: boolean;
  tasteOk: boolean;
  cascade: AlcoholCascade;
  fatPercent: number;
  snf: number;
  waterPercent: number;
  correctedClr: number;
  kqColour: string;
}): VerdictResult {
  const { smellOk, colourOk, tasteOk, cascade, fatPercent, snf, waterPercent, correctedClr, kqColour } = params;

  if (!smellOk) return { verdict: "Reject", failedParameter: "Smell", failedValue: "Not OK", reason: "Sensory smell failed - immediate reject" };
  if (!colourOk) return { verdict: "Reject", failedParameter: "Colour", failedValue: "Not OK", reason: "Sensory colour failed - immediate reject" };
  if (!tasteOk) return { verdict: "Reject", failedParameter: "Taste", failedValue: "Not OK", reason: "Sensory taste failed - immediate reject" };

  if (cascade.Cob === "Positive") {
    return { verdict: "Reject", failedParameter: "COB", failedValue: "Positive - clotted on boiling", reason: "COB Positive overrides every other measurement, even if fat/SNF fine" };
  }

  // KQ White = Fail
  if (kqColour.trim().toLowerCase() === "white") {
    return { verdict: "Reject", failedParameter: "KQ", failedValue: "White - Fail", reason: "KQ White means Fail per 7-colour scale" };
  }

  if (fatPercent < 3.0) return { verdict: "Reject", failedParameter: "FatPercent", failedValue: `${fatPercent.toFixed(2)} < 3.0 min`, reason: "Fat below minimum 3.0%" };
  if (fatPercent > 6.0) return { verdict: "Reject", failedParameter: "FatPercent", failedValue: `${fatPercent.toFixed(2)} > 6.0 max`, reason: "Fat above maximum 6.0%" };
  if (snf < 8.0) return { verdict: "Reject", failedParameter: "SNF", failedValue: `${snf.toFixed(2)} < 8.0 min`, reason: `SNF ${snf.toFixed(2)} below minimum 8.0% (Fat ${fatPercent} + CLR ${correctedClr.toFixed(2)})` };
  if (waterPercent > 1.0) return { verdict: "Reject", failedParameter: "WaterPercent", failedValue: `${waterPercent.toFixed(2)} > 1.0 max`, reason: "Added water above 1.0% max" };
  if (correctedClr < 26 || correctedClr > 32) return { verdict: "Reject", failedParameter: "CorrectedCLR", failedValue: `${correctedClr.toFixed(2)} out of 26-32`, reason: `Corrected CLR ${correctedClr.toFixed(2)} out of typical 26-32 range` };

  return { verdict: "Accept", reason: `All checks passed - ${deriveAlcoholResult(cascade)} - ${deriveProductLine(cascade)}` };
}
