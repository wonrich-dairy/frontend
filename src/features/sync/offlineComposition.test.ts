import { describe, expect, it } from "vitest";
import {
  CALIBRATION_TEMPERATURE_C,
  CORRECTION_PER_DEGREE,
  compositionFrom,
  correctedClr,
  snf,
  totalSolids,
} from "./offlineComposition";

describe("correcting the lactometer reading", () => {
  it("leaves a reading taken at the calibration temperature alone", () => {
    expect(correctedClr(28.0, 27.0)).toBe(28.0);
  });

  it.each([
    [28.0, 30.0, 28.6],
    [28.0, 28.0, 28.2],
    [26.5, 32.0, 27.5],
    [30.0, 37.0, 32.0],
  ])("adds above calibration: %s at %s °C is %s", (raw, temperature, expected) => {
    expect(correctedClr(raw, temperature)).toBe(expected);
  });

  it.each([
    [28.0, 24.0, 27.4],
    [28.0, 26.0, 27.8],
    [29.5, 22.0, 28.5],
    [30.0, 17.0, 28.0],
  ])("subtracts below calibration: %s at %s °C is %s", (raw, temperature, expected) => {
    expect(correctedClr(raw, temperature)).toBe(expected);
  });
});

describe("solids", () => {
  it.each([
    [4.0, 28.0, 8.6],
    [3.5, 26.0, 7.99],
    [6.0, 30.0, 9.54],
    [0.0, 0.0, 0.72],
  ])("SNF from fat %s and CLR %s is %s", (fat, clr, expected) => {
    expect(snf(fat, clr)).toBe(expected);
  });

  it.each([
    [8.6, 4.0, 12.6],
    [7.99, 3.5, 11.49],
    [9.54, 6.0, 15.54],
  ])("TS is SNF %s plus fat %s: %s", (solidsNotFat, fat, expected) => {
    expect(totalSolids(solidsNotFat, fat)).toBe(expected);
  });

  it("carries results to two decimals, halves away from zero", () => {
    expect(snf(3.33, 27.77)).toBe(8.4);
  });
});

describe("the full chain", () => {
  it("derives SNF from the corrected CLR, not the raw reading", () => {
    const result = compositionFrom(4.0, 28.0, 30.0);

    expect(result.correctedClr).toBe(28.6);
    expect(result.snf).toBe(8.75);
    expect(result.totalSolids).toBe(12.75);
    expect(result.fatPercent).toBe(4.0);
  });

  it("agrees with the individual calculations", () => {
    const chained = compositionFrom(4.2, 27.5, 25.0);
    const clr = correctedClr(27.5, 25.0);
    const solidsNotFat = snf(4.2, clr);

    expect(chained.correctedClr).toBe(clr);
    expect(chained.snf).toBe(solidsNotFat);
    expect(chained.totalSolids).toBe(totalSolids(solidsNotFat, 4.2));
  });

  it("uses the documented calibration constants", () => {
    expect(CALIBRATION_TEMPERATURE_C).toBe(27);
    expect(CORRECTION_PER_DEGREE).toBe(0.2);
  });
});
