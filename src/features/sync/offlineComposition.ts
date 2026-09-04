export const CALIBRATION_TEMPERATURE_C = 27;

export const CORRECTION_PER_DEGREE = 0.2;

export interface Composition {
  fatPercent: number;
  correctedClr: number;
  snf: number;
  totalSolids: number;
}

export function correctedClr(rawLactometerReading: number, temperatureCelsius: number): number {
  return round2(
    rawLactometerReading + CORRECTION_PER_DEGREE * (temperatureCelsius - CALIBRATION_TEMPERATURE_C),
  );
}

export function snf(fatPercent: number, clr: number): number {
  return round2(fatPercent * 0.22 + clr * 0.25 + 0.72);
}

export function totalSolids(solidsNotFat: number, fatPercent: number): number {
  return round2(solidsNotFat + fatPercent);
}

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

function round2(value: number): number {
  const scaled = value * 100;
  const nudged = Number(scaled.toPrecision(12));
  const rounded = nudged < 0 ? -Math.round(-nudged) : Math.round(nudged);

  return rounded / 100;
}
