import { request } from "./http";

export interface DispatchSource {
  tankCode: string;
  tankName: string;
  quantityLitres: number;
  contributingConsignments: string[];
}

export interface DispatchNote {
  reference: string;
  bowserRegistration: string;
  driverName: string;
  dispatchedAtLocal: string;
  totalQuantityLitres: number;
  fatPercent: number;
  snf: number;
  kqColour: string;
  stabilityGrade: string;
  temperatureCelsius: number;
  remarks: string | null;
  dispatchedBy: string | null;
  recordedAtUtc: string;
  sources: DispatchSource[];
}

export interface RecordDispatchNoteRequest {
  bowserRegistration: string;
  driverName: string;
  dispatchedAtLocal?: string;
  draws: { tankCode: string; quantityLitres: number }[];
  fatPercent: number;
  snf: number;
  kqColour: string;
  stabilityGrade: string;
  temperatureCelsius: number;
  remarks?: string | null;
}



export function recordDispatchNote(
  body: RecordDispatchNoteRequest,
  token: string | null,
): Promise<DispatchNote> {
  return request<DispatchNote>("/api/dispatch-notes", { method: "POST", body, token });
}
