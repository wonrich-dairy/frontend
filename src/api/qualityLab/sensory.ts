import { request } from "../http";

// ── Types ────────────────────────────────────────────────────────────────────

export type SensoryGrade = "Acceptable" | "Borderline" | "Unacceptable";
export const SENSORY_GRADES: SensoryGrade[] = ["Acceptable", "Borderline", "Unacceptable"];

export interface SensoryEvaluationDto {
  id: string;
  batchWorkItemId: string;
  taste: SensoryGrade;
  tasteNote: string | null;
  smell: SensoryGrade;
  smellNote: string | null;
  colour: SensoryGrade;
  colourNote: string | null;
  appearance: SensoryGrade;
  appearanceNote: string | null;
  texture: SensoryGrade | null;
  textureNote: string | null;
  evaluatedBy: string;
  evaluatedAtUtc: string;
  isLocked: boolean;
}

export interface RecordSensoryRequest {
  taste: string;
  tasteNote?: string;
  smell: string;
  smellNote?: string;
  colour: string;
  colourNote?: string;
  appearance: string;
  appearanceNote?: string;
  texture?: string;
  textureNote?: string;
}

// ── API calls ────────────────────────────────────────────────────────────────

export function recordSensory(batchCode: string, body: RecordSensoryRequest, token: string | null) {
  return request<SensoryEvaluationDto>(`/api/panels/${encodeURIComponent(batchCode)}/sensory`, {
    method: "POST",
    body,
    token,
    service: "qualityLab",
  });
}

export function updateSensory(batchCode: string, body: RecordSensoryRequest, token: string | null) {
  return request<SensoryEvaluationDto>(`/api/panels/${encodeURIComponent(batchCode)}/sensory`, {
    method: "PUT",
    body,
    token,
    service: "qualityLab",
  });
}

export function getSensory(batchCode: string, token: string | null, signal?: AbortSignal) {
  return request<SensoryEvaluationDto>(`/api/panels/${encodeURIComponent(batchCode)}/sensory`, {
    token,
    signal,
    service: "qualityLab",
  });
}
