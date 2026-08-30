import { describe, expect, it } from "vitest";
import type { Society } from "../../api/types";
import {
  canNumberOf,
  formatCanLabel,
  hasErrors,
  suggestLabel,
  toCanRequests,
  totalKg,
  validateSheet,
  type CanEntry,
} from "./canSheet";

const kobeigane: Society = {
  id: "6f0f6f1a-0001-4a2b-9c3d-000000000001",
  code: "KG",
  name: "Kobeigane",
  canLabelPrefix: "KG",
  contactPerson: "Sunil Perera",
  contactNumber: null,
  isActive: true,
};

const entry = (label: string, quantityKg: string, id = label || "blank"): CanEntry => ({
  id,
  label,
  quantityKg,
});

describe("can labels", () => {
  it("prints the society tag and a two digit can number", () => {
    expect(formatCanLabel("KG", 1)).toBe("KG-01");
    expect(formatCanLabel("KG", 42)).toBe("KG-42");
  });

  it("reads the can number out of a label written any of the usual ways", () => {
    expect(canNumberOf("KG-01", "KG")).toBe(1);
    expect(canNumberOf("kg-7", "KG")).toBe(7);
    expect(canNumberOf("KG 12", "KG")).toBe(12);
  });

  it("refuses a label carrying another society's tag", () => {
    expect(canNumberOf("PP-99", "KG")).toBeNull();
  });

  it("refuses a can number outside the range the service accepts", () => {
    expect(canNumberOf("KG-0", "KG")).toBeNull();
    expect(canNumberOf("KG-1000", "KG")).toBeNull();
  });

  it("suggests the next number after the highest already on the sheet", () => {
    expect(suggestLabel("KG", [entry("KG-01", "40"), entry("KG-04", "40")])).toBe("KG-05");
    expect(suggestLabel("KG", [])).toBe("KG-01");
  });
});

describe("validating the sheet", () => {
  it("passes a sheet with a society and one good can", () => {
    const errors = validateSheet(kobeigane, [entry("KG-01", "40.5")]);

    expect(hasErrors(errors)).toBe(false);
  });

  it("requires a society", () => {
    const errors = validateSheet(null, [entry("KG-01", "40")]);

    expect(errors.society).toBe("Select the supplying society.");
    expect(hasErrors(errors)).toBe(true);
  });

  it("requires at least one can", () => {
    const errors = validateSheet(kobeigane, [entry("", "")]);

    expect(errors.sheet).toBe("Record at least one can.");
  });

  it("reports the design's message when the label carries another society's tag", () => {
    const errors = validateSheet(kobeigane, [entry("PP-99", "40")]);

    expect(errors.cans["PP-99"].label).toBe("Label must start with society tag (KG)");
  });

  it("rejects the same can twice, which the service refuses as well", () => {
    const errors = validateSheet(kobeigane, [
      entry("KG-01", "40", "first"),
      entry("KG-01", "38", "second"),
    ]);

    expect(errors.cans.second.label).toContain("already on this sheet");
    expect(errors.cans.first).toBeUndefined();
  });

  it("requires a weight, and one the service would accept", () => {
    expect(validateSheet(kobeigane, [entry("KG-01", "")]).cans["KG-01"].quantityKg).toBe(
      "Enter the weight in kilograms.",
    );
    expect(validateSheet(kobeigane, [entry("KG-01", "0")]).cans["KG-01"].quantityKg).toBe(
      "Weight must be more than zero.",
    );
    expect(validateSheet(kobeigane, [entry("KG-01", "1001")]).cans["KG-01"].quantityKg).toContain(
      "1000 kg",
    );
  });

  it("ignores a row the officer has not started", () => {
    const errors = validateSheet(kobeigane, [entry("KG-01", "40"), entry("", "", "untouched")]);

    expect(hasErrors(errors)).toBe(false);
  });
});

describe("what is sent to the service", () => {
  it("sends can numbers and kilograms, never labels or litres", () => {
    const requests = toCanRequests(kobeigane, [entry("KG-01", "40.5"), entry("KG-02", "38")]);

    expect(requests).toEqual([
      { canNumber: 1, quantityKg: 40.5 },
      { canNumber: 2, quantityKg: 38 },
    ]);
  });

  it("leaves out rows the officer never started", () => {
    expect(toCanRequests(kobeigane, [entry("KG-01", "40"), entry("", "", "blank")])).toHaveLength(1);
  });

  it("totals the kilograms entered so far", () => {
    expect(totalKg([entry("KG-01", "40.5"), entry("KG-02", "38.25")])).toBeCloseTo(78.75);
    expect(totalKg([entry("KG-01", "40"), entry("KG-02", "")])).toBe(40);
  });
});
