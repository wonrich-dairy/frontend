import { request } from "../http";

export interface CreateUnloadRequest {
  dispatchNumber: string;
  storingTankId: string;
  quantityKg: number;
  temperatureC: number;
  smellOk: boolean;
  colourOk: boolean;
  tasteOk: boolean;
}

export interface ProcessingRunDto {
  id: string;
  dispatchNumber: string;
  storingTankId: string;
  storingTankCode?: string;
  storingTankName?: string;
  quantityKg: number;
  temperatureC: number;
  isTemperatureDeviation: boolean;
  state: string;
  qualityTestStatus: string;
  holdReason?: string;
  batchCode?: string;
  createdAtUtc: string;
  updatedAtUtc: string;
  createdBy: string;
  hasQualityPanel?: boolean;
  qualityVerdict?: string;
}

export function listRuns(token: string | null, signal?: AbortSignal) {
  return request<ProcessingRunDto[]>(`/api/processing-runs`, { token, signal, service: "processing" });
}

export function getRunByDispatch(dispatchNumber: string, token: string | null, signal?: AbortSignal) {
  return request<ProcessingRunDto>(`/api/processing-runs/${encodeURIComponent(dispatchNumber)}`, { token, signal, service: "processing" });
}

export function createUnload(body: CreateUnloadRequest, token: string | null) {
  return request<ProcessingRunDto>(`/api/processing-runs/unload`, { method: "POST", body, token, service: "processing" });
}
