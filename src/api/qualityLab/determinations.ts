import { request } from "../http";

// ── Types ────────────────────────────────────────────────────────────────────

export interface DeterminationDto {
  id: string;
  batchCode: string;
  result: "Pass" | "Fail";
  reasonCodes: string[];
  overrideReason: string | null;
  notes: string | null;
  determinedBy: string;
  determinedAtUtc: string;
  supersededDeterminationId: string | null;
  supersededById: string | null;
  isActive: boolean;
}

export interface SubmitDeterminationRequest {
  result: "Pass" | "Fail";
  reasonCodes?: string[];
  overrideReason?: string;
  notes?: string;
}

export const REASON_CODES = [
  { code: "LOW_FAT", label: "Fat % below minimum" },
  { code: "HIGH_FAT", label: "Fat % above maximum" },
  { code: "LOW_PH", label: "pH below minimum" },
  { code: "HIGH_PH", label: "pH above maximum" },
  { code: "LOW_SNF", label: "SNF below minimum" },
  { code: "LOW_CLR", label: "CLR below minimum" },
  { code: "SENSORY_TASTE", label: "Sensory: Taste issue" },
  { code: "SENSORY_SMELL", label: "Sensory: Smell issue" },
  { code: "SENSORY_COLOUR", label: "Sensory: Colour issue" },
  { code: "SENSORY_APPEARANCE", label: "Sensory: Appearance issue" },
  { code: "SENSORY_TEXTURE", label: "Sensory: Texture issue" },
  { code: "OUT_OF_SPEC", label: "Out of specification" },
  { code: "CONTAMINATION", label: "Contamination detected" },
  { code: "OTHER", label: "Other" },
] as const;

// ── API calls ────────────────────────────────────────────────────────────────

export function submitDetermination(batchCode: string, body: SubmitDeterminationRequest, token: string | null) {
  return request<DeterminationDto>(`/api/panels/${encodeURIComponent(batchCode)}/determination`, {
    method: "POST",
    body,
    token,
    service: "qualityLab",
  });
}

export function getDetermination(batchCode: string, token: string | null, signal?: AbortSignal) {
  return request<DeterminationDto>(`/api/panels/${encodeURIComponent(batchCode)}/determination`, {
    token,
    signal,
    service: "qualityLab",
  });
}

export function supersedeDetermination(batchCode: string, body: SubmitDeterminationRequest, token: string | null) {
  return request<DeterminationDto>(`/api/panels/${encodeURIComponent(batchCode)}/determination/supersede`, {
    method: "POST",
    body,
    token,
    service: "qualityLab",
  });
}

export function getDeterminationHistory(batchCode: string, token: string | null, signal?: AbortSignal) {
  return request<DeterminationDto[]>(`/api/panels/${encodeURIComponent(batchCode)}/determination/history`, {
    token,
    signal,
    service: "qualityLab",
  });
}
