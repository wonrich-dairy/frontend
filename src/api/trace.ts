import { request } from "./http";

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
  missing: string[];
}

export interface TracedTank {
  tankCode: string;
  tankName: string;
  quantityDrawnLitres: number;
  consignments: TracedConsignment[];
  missing: string[];
}

export interface SocietyRisk {
  societyCode: string;
  societyName: string;
  consignmentCount: number;
  tightestMargin: number;
  tightestMeasure: string | null;
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


