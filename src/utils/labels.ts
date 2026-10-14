export function normalizeSnf(value: string): string {
  return value.replace(/\bsnf\b/gi, "SNF");
}
