export const STRENGTHS = [
  { key: "a80", label: "80% Alcohol" },
  { key: "a75", label: "75% Alcohol" },
  { key: "a68", label: "68% Alcohol" },
] as const;

export type Strength = (typeof STRENGTHS)[number]["key"];

export function gradeFrom(alcohol: Record<Strength, boolean>): string {
  if (!alcohol.a80) {
    return "Stable";
  }

  if (!alcohol.a75) {
    return "MarginallyStable";
  }

  return alcohol.a68 ? "SeverelyUnstable" : "Unstable";
}

export function humanGrade(grade: string): string {
  return grade.replace(/([a-z])([A-Z])/g, "$1 $2");
}
