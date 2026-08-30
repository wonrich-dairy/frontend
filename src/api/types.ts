/** Shapes returned by the MCC & Intake Service (SCRUM-6, SCRUM-51). */

export interface Society {
  id: string;
  code: string;
  name: string;
  /** Printed on the cans, e.g. "KG" for Kobeigane. */
  canLabelPrefix: string;
  contactPerson: string | null;
  contactNumber: string | null;
  isActive: boolean;
}

export interface ConsignmentCan {
  canLabel: string;
  canNumber: number;
  quantityKg: number;
  quantityLitres: number;
}

export interface Consignment {
  id: string;
  reference: string;
  societyId: string;
  societyCode: string;
  societyName: string;
  arrivalAtLocal: string;
  arrivalDate: string;
  status: string;
  totalQuantityKg: number;
  totalQuantityLitres: number;
  canCount: number;
  registeredAtUtc: string;
  registeredBy: string | null;
  cans: ConsignmentCan[];
}

/**
 * RFC 9457 body the service returns for every refusal. `code` is the field to branch on —
 * `detail` is prose meant for the officer, and `errors` is present on model validation failures.
 */
export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  code?: string;
  errors?: Record<string, string[]>;
  cutoff?: string;
  arrivalTime?: string;
}
