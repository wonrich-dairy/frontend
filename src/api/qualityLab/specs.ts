import { request } from "../http";
import type { ProductLine } from "./panels";

// ── Types ────────────────────────────────────────────────────────────────────

export interface SpecThresholdDto {
  id: string;
  productLine: ProductLine;
  minFatPercent: number | null;
  maxFatPercent: number | null;
  minPh: number | null;
  maxPh: number | null;
  minSnf: number | null;
  minCorrectedClr: number | null;
  updatedBy: string;
  updatedAtUtc: string;
}

export interface UpdateSpecRequest {
  minFatPercent?: number | null;
  maxFatPercent?: number | null;
  minPh?: number | null;
  maxPh?: number | null;
  minSnf?: number | null;
  minCorrectedClr?: number | null;
}

export interface OutOfSpecFlag {
  parameter: string;
  actualValue: number;
  limit: string;
  limitValue: number;
}

export interface SpecEvaluationResult {
  batchCode: string;
  hasOutOfSpecFlags: boolean;
  flags: OutOfSpecFlag[];
}

// ── API calls ────────────────────────────────────────────────────────────────

export function getAllSpecs(token: string | null, signal?: AbortSignal) {
  return request<SpecThresholdDto[]>("/api/specs", {
    token,
    signal,
    service: "qualityLab",
  });
}

export function getSpec(productLine: string, token: string | null, signal?: AbortSignal) {
  return request<SpecThresholdDto>(`/api/specs/${encodeURIComponent(productLine)}`, {
    token,
    signal,
    service: "qualityLab",
  });
}

export function updateSpec(productLine: string, body: UpdateSpecRequest, token: string | null) {
  return request<SpecThresholdDto>(`/api/specs/${encodeURIComponent(productLine)}`, {
    method: "PUT",
    body,
    token,
    service: "qualityLab",
  });
}

export function evaluatePanel(batchCode: string, token: string | null) {
  return request<SpecEvaluationResult>(`/api/specs/evaluate/${encodeURIComponent(batchCode)}`, {
    method: "POST",
    token,
    service: "qualityLab",
  });
}
