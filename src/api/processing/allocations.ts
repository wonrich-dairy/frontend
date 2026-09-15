import { request } from "../http";

export type ProductType = "SY" | "SK" | "FM" | "FLM" | "DK";

export interface CreateAllocationRequest {
  sourceStoringTankId: string;
  destinationMixingTankId: string;
  quantityKg: number;
  productType: ProductType;
  overrideReason?: string;
  processingRunId?: string;
}

export interface TankAllocationDto {
  id: string;
  batchCode: string;
  batchNumber: number;
  batchLetter: string;
  productType: string;
  quantityKg: number;
  sourceStoringTankId: string;
  sourceStoringTankCode?: string;
  destinationMixingTankId: string;
  destinationMixingTankCode?: string;
  processingRunId: string;
  dispatchNumber?: string;
  alcoholResult?: string;
  allocatedAtUtc: string;
  createdAtUtc: string;
  createdBy: string;
  overrideReason?: string;
}

export interface StoringTankRunDto {
  id: string;
  allocationId?: string;
  dispatchNumber: string;
  quantityKg: number; // quantity in THIS tank (allocation quantity), not total run quantity
  totalRunQuantityKg?: number; // total for dispatch across tanks
  state: string;
  qualityTestStatus: string;
  alcoholResult?: string;
  verdict?: string;
  createdAtUtc: string;
  canAllocate: boolean;
}

export function listAllocations(token: string | null, signal?: AbortSignal) {
  return request<TankAllocationDto[]>(`/api/tank-allocations`, { token, signal, service: "processing" });
}

export function getAllocationByBatchCode(batchCode: string, token: string | null, signal?: AbortSignal) {
  return request<TankAllocationDto>(`/api/tank-allocations/${encodeURIComponent(batchCode)}`, { token, signal, service: "processing" });
}

export function createAllocation(body: CreateAllocationRequest, token: string | null) {
  return request<TankAllocationDto>(`/api/tank-allocations`, { method: "POST", body, token, service: "processing" });
}

export function getRunsInStoringTank(storingTankId: string, token: string | null, signal?: AbortSignal) {
  return request<StoringTankRunDto[]>(`/api/tank-allocations/storing/${encodeURIComponent(storingTankId)}/runs`, { token, signal, service: "processing" });
}
