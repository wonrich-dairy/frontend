/**
 * The composition calculations, so a panel entered with no signal still shows the officer its
 * corrected CLR, SNF and TS (SCRUM-10, AC8).
 *
 * These are a deliberate second implementation of `Wonrich.QualityPanel.MilkComposition`, and the
 * duplication is the point of risk: two copies of a formula drift. Three things contain it.
 *
 * 1. What is *stored* is never computed here. An offline panel queues its readings, and the
 *    service recomputes on upload with the shared library — so the figures on record always come
 *    from the one authority, exactly as they do online.
 * 2. What is computed here is only ever shown, and only while the service cannot be reached.
 * 3. `offlineComposition.test.ts` pins these against the values the .NET library's own tests
 *    assert, so a change on either side fails a build rather than quietly shifting a reading.
 *
 * A browser cannot run the .NET library, so a port is the only way to satisfy the acceptance
 * criterion. Publishing the panel as WebAssembly would remove the duplication outright and is
 * worth its own ticket.
 */

/** The lactometer is calibrated at 27 °C; a reading taken elsewhere means nothing uncorrected. */
export const CALIBRATION_TEMPERATURE_C = 27;

/** CLR degrees added per °C above calibration, subtracted per °C below. */
export const CORRECTION_PER_DEGREE = 0.2;

export interface Composition {
  fatPercent: number;
  correctedClr: number;
  snf: number;
  totalSolids: number;
}

/**
 * Corrects a raw lactometer reading for the sample's temperature. Warmer milk is less dense, so it
 * reads low and the correction adds; colder milk reads high and it subtracts.
 */
export function correctedClr(rawLactometerReading: number, temperatureCelsius: number): number {
  return round2(
    rawLactometerReading + CORRECTION_PER_DEGREE * (temperatureCelsius - CALIBRATION_TEMPERATURE_C),
  );
}

/** Solids-not-fat: (FAT x 0.22) + (CLR x 0.25) + 0.72, from the corrected CLR. */
export function snf(fatPercent: number, clr: number): number {
  return round2(fatPercent * 0.22 + clr * 0.25 + 0.72);
}

export function totalSolids(solidsNotFat: number, fatPercent: number): number {
  return round2(solidsNotFat + fatPercent);
}

/**
 * The whole chain from raw readings. SNF is derived from the *corrected* CLR — feeding it the raw
 * reading is the easy mistake, and it shifts every figure downstream without complaining.
 */
export function compositionFrom(
  fatPercent: number,
  rawLactometerReading: number,
  temperatureCelsius: number,
): Composition {
  const clr = correctedClr(rawLactometerReading, temperatureCelsius);
  const solidsNotFat = snf(fatPercent, clr);

  return {
    fatPercent,
    correctedClr: clr,
    snf: solidsNotFat,
    totalSolids: totalSolids(solidsNotFat, fatPercent),
  };
}

/**
 * Two decimals, halves away from zero — matching decimal.Round(value, 2, MidpointRounding
 * .AwayFromZero) on the service. JavaScript's Math.round breaks ties towards positive infinity,
 * which disagrees on negatives, and binary floating point puts values like 8.545 fractionally
 * under the tie, so the scaling is nudged before rounding.
 */
function round2(value: number): number {
  const scaled = value * 100;
  const nudged = Number(scaled.toPrecision(12));
  const rounded = nudged < 0 ? -Math.round(-nudged) : Math.round(nudged);

  return rounded / 100;
}
