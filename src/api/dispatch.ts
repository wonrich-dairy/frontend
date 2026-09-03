import { request } from "./http";

/** Bowser dispatch notes (SCRUM-8). A note is read-only once submitted. */

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

export function listDispatchNotes(
  token: string | null,
  signal?: AbortSignal,
  date?: string,
): Promise<DispatchNote[]> {
  const query = date ? `?date=${encodeURIComponent(date)}` : "";

  return request<DispatchNote[]>(`/api/dispatch-notes${query}`, { token, signal });
}

export function getDispatchNote(
  reference: string,
  token: string | null,
  signal?: AbortSignal,
): Promise<DispatchNote> {
  return request<DispatchNote>(`/api/dispatch-notes/${encodeURIComponent(reference)}`, {
    token,
    signal,
  });
}

/**
 * Records the note. The total is derived by the service from the per-tank quantities, and a tank
 * cannot give up more than its current fill holds, so the litres are not sent as a total.
 */
export function recordDispatchNote(
  body: RecordDispatchNoteRequest,
  token: string | null,
): Promise<DispatchNote> {
  return request<DispatchNote>("/api/dispatch-notes", { method: "POST", body, token });
}
