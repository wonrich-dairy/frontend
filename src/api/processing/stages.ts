import { request } from "../http";

export type StageType = "Heating" | "Homogeniser" | "Pasteuriser" | "Cooling";

export interface ProcessingStageDto {
  id: string;
  processingRunId: string;
  mixingTankId: string;
  mixingTankCode?: string;
  stageType: string;
  startTimeUtc: string;
  endTimeUtc?: string | null;
  endTemperatureC: number;
  isDeviation: boolean;
  durationMinutes?: number | null;
  cultureAdded: boolean;
  createdBy: string;
  createdAtUtc: string;
}

export interface ActiveBatchDto {
  id: string;
  batchCode: string;
  productType: string;
  quantityKg: number;
  mixingTankId: string;
  mixingTankCode?: string;
  sourceStoringTankCode?: string;
  dispatchNumber?: string;
  allocatedAtUtc: string;
  createdAtUtc: string;
}

export function listStagesByMixingTank(mixingTankId: string, token: string | null, signal?: AbortSignal) {
  return request<ProcessingStageDto[]>(`/api/processing-stages/mixing-tank/${encodeURIComponent(mixingTankId)}`, { token, signal, service: "processing" });
}

export function listActiveStages(token: string | null, signal?: AbortSignal) {
  return request<ProcessingStageDto[]>(`/api/processing-stages/active`, { token, signal, service: "processing" });
}

export function listActiveBatches(token: string | null, signal?: AbortSignal) {
  return request<ActiveBatchDto[]>(`/api/processing-stages/active-batches`, { token, signal, service: "processing" });
}

export function startStage(body: { mixingTankId: string; processingRunId: string; stageType: StageType }, token: string | null) {
  return request<ProcessingStageDto>(`/api/processing-stages/start`, { method: "POST", body, token, service: "processing" });
}

export function endStage(stageId: string, body: { endTemperatureC: number; cultureAdded?: boolean }, token: string | null) {
  return request<ProcessingStageDto>(`/api/processing-stages/${encodeURIComponent(stageId)}/end`, { method: "POST", body, token, service: "processing" });
}
