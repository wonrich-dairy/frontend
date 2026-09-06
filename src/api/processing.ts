import { request } from "./http";

export const TANK_KINDS = ["Storing", "Mixing"] as const;

export type TankKind = (typeof TANK_KINDS)[number];

export type ProcessingTankStatus = "Active" | "UnderMaintenance";

export interface ProcessingTank {
  code: string;
  name: string;
  kind: TankKind;
  capacityLitres: number;
  heldLitres: number;
  availableLitres: number;
  status: ProcessingTankStatus;
}

export interface SaveProcessingTankRequest {
  code: string;
  name: string;
  kind: TankKind;
  capacityLitres: number;
}

export interface Unload {
  reference: string;
  dispatchNoteReference: string;
  storingTankCode: string;
  storingTankName: string;
  quantityLitres: number;
  temperatureCelsius: number;
  unloadedAtLocal: string;
  unloadDate: string;
  unloadedBy: string | null;
  recordedAtUtc: string;
}

export interface RecordUnloadRequest {
  dispatchNoteReference: string;
  storingTankCode: string;
  quantityLitres: number;
  temperatureCelsius: number;
  unloadedAtLocal?: string;
}

export function listProcessingTanks(
  token: string | null,
  signal?: AbortSignal,
  kind?: TankKind,
): Promise<ProcessingTank[]> {
  const query = kind ? `?kind=${kind}` : "";

  return request<ProcessingTank[]>(`/api/processing/tanks${query}`, {
    token,
    signal,
    service: "processing",
  });
}

export function createProcessingTank(
  body: SaveProcessingTankRequest,
  token: string | null,
): Promise<ProcessingTank> {
  return request<ProcessingTank>("/api/processing/tanks", {
    method: "POST",
    body,
    token,
    service: "processing",
  });
}

export function updateProcessingTank(
  code: string,
  body: SaveProcessingTankRequest,
  token: string | null,
): Promise<ProcessingTank> {
  return request<ProcessingTank>(`/api/processing/tanks/${encodeURIComponent(code)}`, {
    method: "PUT",
    body,
    token,
    service: "processing",
  });
}

export function setProcessingTankInService(
  code: string,
  inService: boolean,
  token: string | null,
): Promise<ProcessingTank> {
  const action = inService ? "reactivate" : "deactivate";

  return request<ProcessingTank>(`/api/processing/tanks/${encodeURIComponent(code)}/${action}`, {
    method: "POST",
    token,
    service: "processing",
  });
}

export function listUnloads(
  token: string | null,
  signal?: AbortSignal,
  date?: string | null,
): Promise<Unload[]> {
  const query = date ? `?date=${encodeURIComponent(date)}` : "";

  return request<Unload[]>(`/api/processing/unloads${query}`, {
    token,
    signal,
    service: "processing",
  });
}

export function recordUnload(
  body: RecordUnloadRequest,
  token: string | null,
): Promise<Unload> {
  return request<Unload>("/api/processing/unloads", {
    method: "POST",
    body,
    token,
    service: "processing",
  });
}
