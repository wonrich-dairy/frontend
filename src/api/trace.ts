import { request } from "./http";

/** Resolving a factory batch back to the tanks and consignments behind it (SCRUM-12). */

export interface TracedQualityTest {
  fatPercent: number;
  snf: number;
  correctedClr: number;
  totalSolids: number;
  waterPercent: number;
  kqColour: string;
  stabilityGrade: string;
  verdict: string;
  testedBy: string | null;
}

export interface TracedConsignment {
  reference: string;
  societyCode: string;
  societyName: string;
  canLabels: string[];
  quantityLitres: number;
  quantityKg: number;
  arrivalAtLocal: string;
  registeredBy: string | null;
  registeredAtUtc: string;
  pouredAtUtc: string;
  pouredBy: string | null;
  qualityTest: TracedQualityTest | null;
  tightestMargin: number;
  breaches: string[];
}

export interface TracedTank {
  tankCode: string;
  tankName: string;
  quantityLitres: number;
  fillNumber: number;
  consignments: TracedConsignment[];
}

export interface SocietyRisk {
  societyCode: string;
  societyName: string;
  tightestMargin: number;
  consignmentReferences: string[];
}

export interface BatchTrace {
  batchReference: string;
  batchDate: string;
  createdAtUtc: string;
  arrivedAtLocal: string;
  screenedBy: string | null;
  screenedAtUtc: string;
  dispatchNoteReference: string;
  bowserRegistration: string;
  driverName: string;
  dispatchedAtLocal: string;
  dispatchedBy: string | null;
  dispatchRecordedAtUtc: string;
  totalDispatchedLitres: number;
  tanks: TracedTank[];
  societiesByMargin: SocietyRisk[];
  /** Links the trace could not resolve, named so the gap is visible rather than silent. */
  missing: string[];
}

export function traceBatch(
  batchReference: string,
  token: string | null,
  signal?: AbortSignal,
): Promise<BatchTrace> {
  return request<BatchTrace>(
    `/api/factory/batches/${encodeURIComponent(batchReference)}/trace`,
    { token, signal },
  );
}

export interface FactoryBatch {
  reference: string;
  batchDate: string;
  dispatchNoteReference: string;
  arrivedAtLocal: string;
  totalQuantityLitres: number;
  screenedBy: string | null;
  screenedAtUtc: string;
}

export function listBatches(token: string | null, signal?: AbortSignal): Promise<FactoryBatch[]> {
  return request<FactoryBatch[]>("/api/factory/batches", { token, signal });
}
