import { request } from "../http";

export const TANK_KINDS = ["Storing", "Mixing"] as const;
export type TankKind = (typeof TANK_KINDS)[number];

export const TANK_STATUSES = ["Active", "Inactive", "UnderMaintenance"] as const;
export type TankStatus = (typeof TANK_STATUSES)[number];

export interface ProcessingTank {
  id: string;
  code: string;
  name: string;
  kind: TankKind;
  kindName: string;
  capacityKg: number;
  remainingKg: number;
  availableKg: number;
  status: TankStatus;
  statusName: string;
  rowVersion: string;
  createdAtUtc: string;
  updatedAtUtc: string;
  createdBy: string;
}

export interface CreateTankRequest {
  code: string;
  kind: TankKind;
  capacityKg: number;
}

export interface UpdateTankRequest {
  capacityKg: number;
  rowVersion?: string;
}

export function normalizeTankCode(input: string): string {
  if (!input || input.trim() === "") throw new Error("Tank number is required");
  const cleaned = input.trim().replace(/-/g, "").toUpperCase();
  if (cleaned.length < 3) throw new Error(`Code "${input}" too short. Use ST1 format`);
  const letters = cleaned.replace(/[^A-Z]/g, "");
  const numbers = cleaned.replace(/[^0-9]/g, "");
  if (!letters || !numbers) throw new Error(`Code "${input}" invalid. Use ST1`);
  const num = parseInt(numbers, 10);
  return `${letters}-${num.toString().padStart(2, "0")}`;
}

export function previewTankCode(input: string): string {
  try { return normalizeTankCode(input); } catch { return input.toUpperCase(); }
}

export function isValidTankCode(input: string): boolean {
  try { normalizeTankCode(input); return true; } catch { return false; }
}

export function listTanks(token: string | null, signal?: AbortSignal, kind?: TankKind | null, activeOnly = false): Promise<ProcessingTank[]> {
  const params = new URLSearchParams();
  if (kind) params.set("kind", kind);
  if (activeOnly) params.set("activeOnly", "true");
  const query = params.toString() ? `?${params.toString()}` : "";
  return request<ProcessingTank[]>(`/api/tanks${query}`, { token, signal, service: "processing" });
}

export function getTank(id: string, token: string | null): Promise<ProcessingTank> {
  return request<ProcessingTank>(`/api/tanks/${encodeURIComponent(id)}`, { token, service: "processing" });
}

export function getTankByCode(code: string, token: string | null, signal?: AbortSignal): Promise<ProcessingTank> {
  return listTanks(token, signal).then((tanks) => {
    const found = tanks.find((t) => t.code === code);
    if (!found) throw new Error(`Tank ${code} not found`);
    return found;
  });
}

export function createTank(body: CreateTankRequest, token: string | null): Promise<ProcessingTank> {
  return request<ProcessingTank>("/api/tanks", { method: "POST", body, token, service: "processing" });
}

export function updateTank(id: string, body: UpdateTankRequest, token: string | null): Promise<ProcessingTank> {
  return request<ProcessingTank>(`/api/tanks/${encodeURIComponent(id)}`, { method: "PUT", body, token, service: "processing" });
}

export function changeTankStatus(id: string, status: TankStatus, rowVersion: string | undefined, token: string | null): Promise<ProcessingTank> {
  return request<ProcessingTank>(`/api/tanks/${encodeURIComponent(id)}/status`, { method: "PUT", body: { status, rowVersion }, token, service: "processing" });
}

export function deleteTank(id: string, token: string | null): Promise<void> {
  return request<void>(`/api/tanks/${encodeURIComponent(id)}`, { method: "DELETE", token, service: "processing" });
}

export const listProcessingTanks = listTanks;
