import { request } from "../http";

export interface MccDispatchDto {
  reference: string;
  bowserRegistration: string;
  dispatchDate: string;
  totalQuantityLitres: number;
  dispatchedBy: string;
  recordedAtUtc: string;
}

export interface DispatchValidationDto {
  dispatchNumber: string;
  exists: boolean;
  validFormat: boolean;
  message: string;
  bowser?: string;
  quantityLitres?: number;
  dispatchDate?: string;
  alreadyUnloadedKg?: number;
  remainingKg?: number;
  isFullyUnloaded?: boolean;
}

export function validateDispatch(dispatchNumber: string, token: string | null, signal?: AbortSignal) {
  return request<DispatchValidationDto>(`/api/mcc-dispatches/validate/${encodeURIComponent(dispatchNumber)}`, { token, signal, service: "processing" });
}

export function listRecentDispatches(token: string | null, signal?: AbortSignal, take = 10) {
  return request<MccDispatchDto[]>(`/api/mcc-dispatches/recent?take=${take}`, { token, signal, service: "processing" });
}
