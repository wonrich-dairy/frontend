import type { Society } from "../../api/types";

export interface CanEntry {
  id: string;
  label: string;
  quantityKg: string;
}

export interface CanEntryErrors {
  label?: string;
  quantityKg?: string;
}

export interface SheetErrors {
  society?: string;
  sheet?: string;
  cans: Record<string, CanEntryErrors>;
}

export const MAX_CAN_NUMBER = 999;
export const MAX_CAN_KG = 1000;

let sequence = 0;

export function newEntry(): CanEntry {
  sequence += 1;

  return { id: `can-${sequence}`, label: "", quantityKg: "" };
}

export function formatCanLabel(prefix: string, canNumber: number): string {
  return `${prefix}-${String(canNumber).padStart(2, "0")}`;
}

export function suggestLabel(prefix: string, entries: CanEntry[]): string {
  const highest = entries
    .map((entry) => canNumberOf(entry.label, prefix))
    .filter((value): value is number => value !== null)
    .reduce((max, value) => Math.max(max, value), 0);

  return formatCanLabel(prefix, Math.min(highest + 1, MAX_CAN_NUMBER));
}

export function canNumberOf(label: string, prefix: string): number | null {
  const match = label.trim().toUpperCase().match(/^([A-Z]+)\s*-?\s*(\d{1,3})$/);

  if (!match || match[1] !== prefix.trim().toUpperCase()) {
    return null;
  }

  const canNumber = Number(match[2]);

  return canNumber >= 1 && canNumber <= MAX_CAN_NUMBER ? canNumber : null;
}

export function isBlank(entry: CanEntry): boolean {
  return entry.label.trim() === "" && entry.quantityKg.trim() === "";
}

export function parseKg(quantityKg: string): number | null {
  const trimmed = quantityKg.trim();

  if (trimmed === "") {
    return null;
  }

  const value = Number(trimmed);

  return Number.isFinite(value) ? value : null;
}

export function totalKg(entries: CanEntry[]): number {
  return entries.reduce((total, entry) => total + (parseKg(entry.quantityKg) ?? 0), 0);
}

export function completedEntries(entries: CanEntry[]): CanEntry[] {
  return entries.filter((entry) => !isBlank(entry));
}

export function validateSheet(society: Society | null, entries: CanEntry[]): SheetErrors {
  const errors: SheetErrors = { cans: {} };

  if (!society) {
    errors.society = "Select the supplying society.";
  }

  const filled = completedEntries(entries);

  if (filled.length === 0) {
    errors.sheet = "Record at least one can.";
  }

  const seen = new Map<number, string>();

  for (const entry of filled) {
    const entryErrors: CanEntryErrors = {};
    const prefix = society?.canLabelPrefix ?? "";

    if (entry.label.trim() === "") {
      entryErrors.label = "Enter the can label.";
    } else if (society) {
      const canNumber = canNumberOf(entry.label, prefix);

      if (canNumber === null) {
        entryErrors.label = startsWithOtherTag(entry.label, prefix)
          ? `Label must start with society tag (${prefix})`
          : `Label must be the society tag and a can number, e.g. ${formatCanLabel(prefix, 1)}.`;
      } else if (seen.has(canNumber)) {
        entryErrors.label = `Can ${formatCanLabel(prefix, canNumber)} is already on this sheet.`;
      } else {
        seen.set(canNumber, entry.id);
      }
    }

    const kg = parseKg(entry.quantityKg);

    if (kg === null) {
      entryErrors.quantityKg = "Enter the weight in kilograms.";
    } else if (kg <= 0) {
      entryErrors.quantityKg = "Weight must be more than zero.";
    } else if (kg > MAX_CAN_KG) {
      entryErrors.quantityKg = `A can cannot weigh more than ${MAX_CAN_KG} kg.`;
    }

    if (Object.keys(entryErrors).length > 0) {
      errors.cans[entry.id] = entryErrors;
    }
  }

  return errors;
}

export function hasErrors(errors: SheetErrors): boolean {
  return Boolean(errors.society) || Boolean(errors.sheet) || Object.keys(errors.cans).length > 0;
}

export function toCanRequests(
  society: Society,
  entries: CanEntry[],
): { canNumber: number; quantityKg: number }[] {
  return completedEntries(entries).map((entry) => ({
    canNumber: canNumberOf(entry.label, society.canLabelPrefix) ?? 0,
    quantityKg: parseKg(entry.quantityKg) ?? 0,
  }));
}

function startsWithOtherTag(label: string, prefix: string): boolean {
  const match = label.trim().toUpperCase().match(/^([A-Z]+)\s*-?\s*(\d{1,3})$/);

  return Boolean(match) && match![1] !== prefix.trim().toUpperCase();
}
