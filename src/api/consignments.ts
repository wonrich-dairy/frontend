import { request } from "./http";
import type { Consignment } from "./types";

export interface RegisterConsignmentRequest {
  societyId: string;
  cans: { canNumber: number; quantityKg: number }[];
}

export function registerConsignment(
  body: RegisterConsignmentRequest,
  token: string | null,
): Promise<Consignment> {
  return request<Consignment>("/api/consignments", { method: "POST", body, token });
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export function searchConsignments(
  token: string | null,
  signal?: AbortSignal,
  pageSize = 100,
): Promise<PagedResult<Consignment>> {
  return request<PagedResult<Consignment>>(`/api/consignments?pageSize=${pageSize}`, { token, signal });
}
