export interface Society {
  id: string;
  code: string;
  name: string;
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
