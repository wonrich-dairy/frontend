import { request } from "./http";

/** The centre's chilling tanks and their manifests (SCRUM-52). */

export interface Tank {
  code: string;
  name: string;
  capacityLitres: number;
  totalQuantityLitres: number;
  totalQuantityKg: number;
  consignmentCount: number;
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

export function listTanks(token: string | null, signal?: AbortSignal): Promise<Tank[]> {
  return request<Tank[]>("/api/tanks", { token, signal });
}

/** Accepted at the gate and not already in a tank. Rejected and untested milk never appears. */
export function listPourable(
  token: string | null,
  signal?: AbortSignal,
): Promise<PourableConsignment[]> {
  return request<PourableConsignment[]>("/api/tanks/pourable", { token, signal });
}

/** One consignment into one tank. The service allocates nothing here; the pour is the record. */
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
