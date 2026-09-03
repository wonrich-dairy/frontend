/**
 * The alcohol strengths a dispatch slip records, hardest first.
 */
export const STRENGTHS = [
  { key: "a80", label: "80% Alcohol" },
  { key: "a75", label: "75% Alcohol" },
  { key: "a68", label: "68% Alcohol" },
] as const;

export type Strength = (typeof STRENGTHS)[number]["key"];

/**
 * The cascade halts at the first strength the load survives, so the grade is the first switch
 * left off. Clotting at all three is the worst grade this form can express — the boiling test the
 * gate panel runs is not on the dispatch slip.
 */
export function gradeFrom(alcohol: Record<Strength, boolean>): string {
  if (!alcohol.a80) {
    return "Stable";
  }

  if (!alcohol.a75) {
    return "MarginallyStable";
  }

  return alcohol.a68 ? "SeverelyUnstable" : "Unstable";
}

/** "MarginallyStable" reads as "Marginally Stable" on screen. */
export function humanGrade(grade: string): string {
  return grade.replace(/([a-z])([A-Z])/g, "$1 $2");
}
