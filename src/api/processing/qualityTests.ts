import { request } from "../http";

export type QualityTestStatus = "Pending" | "InProgress" | "Passed" | "Failed";

export interface QualityPanelDto {
  id: string;
  processingRunId: string;
  dispatchNumber: string;
  fatPercent: number;
  rawLactometerReading: number;
  temperatureCelsius: number;
  waterPercent: number;
  correctedClr?: number;
  snf: number;
  ts: number;
  ph: number;
  kqColour: string;
  alcoholOutcomesJson: string;
  alcoholResult: string;
  smellOk: boolean;
  colourOk: boolean;
  tasteOk: boolean;
  verdict: string;
  failedParameter?: string;
  failedValue?: string;
  createdAtUtc: string;
  confirmedBy?: string;
  confirmedAtUtc?: string;
  isSmellConfirmed?: boolean;
  isTasteConfirmed?: boolean;
}

export interface QualityStatusDto {
  dispatchNumber: string;
  processingRunId: string;
  storingTankId: string;
  storingTankCode?: string;
  quantityKg: number;
  qualityTestStatus: QualityTestStatus;
  processingState: string;
  hasResult: boolean;
  verdict?: string;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface SubmitQualityResultRequest {
  fatPercent: number;
  rawLactometerReading: number;
  temperatureCelsius: number;
  waterPercent: number;
  kqColour: string;
  alcoholOutcomesJson: string;
  alcoholResult: string;
  smellOk: boolean;
  colourOk: boolean;
  tasteOk: boolean;
  verdict: string;
  failedParameter?: string;
  failedValue?: string;
  snf: number;
  ts: number;
  ph: number;
}

export function getQualityStatus(dispatchNumber: string, token: string | null, signal?: AbortSignal) {
  return request<QualityStatusDto>(`/api/quality-tests/${encodeURIComponent(dispatchNumber)}/status`, { token, signal, service: "processing" });
}

export function getQualityResult(dispatchNumber: string, token: string | null, signal?: AbortSignal) {
  return request<QualityPanelDto>(`/api/quality-tests/${encodeURIComponent(dispatchNumber)}`, { token, signal, service: "processing" });
}

export function listPendingQualityTests(token: string | null, signal?: AbortSignal) {
  return request<QualityStatusDto[]>(`/api/quality-tests/pending`, { token, signal, service: "processing" });
}

export function startQualityTest(dispatchNumber: string, token: string | null) {
  return request<{ message: string; status: string }>(`/api/quality-tests/${encodeURIComponent(dispatchNumber)}/start`, { method: "POST", token, service: "processing" });
}

export function submitQualityResult(dispatchNumber: string, body: SubmitQualityResultRequest, token: string | null) {
  return request<QualityPanelDto>(`/api/quality-tests/${encodeURIComponent(dispatchNumber)}/result`, { method: "POST", body, token, service: "processing" });
}
