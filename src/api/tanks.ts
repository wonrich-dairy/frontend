import { request } from "./http";

export const TANK_STATUSES = ["Active", "UnderMaintenance"] as const;

export type TankStatus = (typeof TANK_STATUSES)[number];

export interface TankTemperature {
  celsius: number;
  recordedBy: string | null;
  recordedAtUtc: string;
  fillNumber: number;
}

export interface Tank {
  code: string;
  name: string;
  capacityLitres: number;
  totalQuantityLitres: number;
  totalQuantityKg: number;
  availableQuantityLitres: number;
  consignmentCount: number;
  fillNumber: number;
  lastClosedAtUtc: string | null;
  status: TankStatus;
  latestTemperature: TankTemperature | null;
}

export interface SaveTankRequest {
  code: string;
  name: string;
  capacityLitres: number;
}

export interface PourableConsignment {
  reference: string;
  societyCode: string;
  societyName: string;
  totalQuantityLitres: number;
  totalQuantityKg: number;
}

export interface ManifestEntry {
  consignmentReference: string;
  societyCode: string;
  societyName: string;
  quantityLitres: number;
  quantityKg: number;
  pouredAtUtc: string;
  pouredBy: string | null;
}

export interface TankManifest {
  tank: Tank;
  entries: ManifestEntry[];
}

export function getTankManifest(
  tankCode: string,
  token: string | null,
  signal?: AbortSignal,
  date?: string,
): Promise<TankManifest> {
  const query = date ? `?date=${encodeURIComponent(date)}` : "";

  return request<TankManifest>(
    `/api/tanks/${encodeURIComponent(tankCode)}/manifest${query}`,
    { token, signal },
  );
}

export function listTanks(token: string | null, signal?: AbortSignal): Promise<Tank[]> {
  return request<Tank[]>("/api/tanks", { token, signal });
}

export function listPourable(
  token: string | null,
  signal?: AbortSignal,
): Promise<PourableConsignment[]> {
  return request<PourableConsignment[]>("/api/tanks/pourable", { token, signal });
}

export function pourIntoTank(
  tankCode: string,
  consignmentReference: string,
  token: string | null,
): Promise<TankManifest> {
  return request<TankManifest>(`/api/tanks/${encodeURIComponent(tankCode)}/pours`, {
    method: "POST",
    body: { consignmentReference },
    token,
  });
}

export function createTank(body: SaveTankRequest, token: string | null): Promise<Tank> {
  return request<Tank>("/api/tanks", { method: "POST", body, token });
}

export function updateTank(
  code: string,
  body: SaveTankRequest,
  token: string | null,
): Promise<Tank> {
  return request<Tank>(`/api/tanks/${encodeURIComponent(code)}`, {
    method: "PUT",
    body,
    token,
  });
}

export function setTankInService(
  code: string,
  inService: boolean,
  token: string | null,
): Promise<Tank> {
  const action = inService ? "reactivate" : "deactivate";

  return request<Tank>(`/api/tanks/${encodeURIComponent(code)}/${action}`, {
    method: "POST",
    token,
  });
}

export function logTankTemperature(
  code: string,
  celsius: number,
  token: string | null,
): Promise<TankTemperature> {
  return request<TankTemperature>(`/api/tanks/${encodeURIComponent(code)}/temperatures`, {
    method: "POST",
    body: { celsius },
    token,
  });
}

export function listTankTemperatures(
  code: string,
  token: string | null,
  signal?: AbortSignal,
  limit = 20,
): Promise<TankTemperature[]> {
  return request<TankTemperature[]>(
    `/api/tanks/${encodeURIComponent(code)}/temperatures?limit=${limit}`,
    { token, signal },
  );
}
