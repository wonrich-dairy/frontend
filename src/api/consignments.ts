import { request } from "./http";
import type { Consignment } from "./types";

export interface RegisterConsignmentRequest {
  societyId: string;
  cans: { canNumber: number; quantityKg: number }[];
}

/**
 * Registers the can sheet. The reference, the arrival time and the litres are all allocated by
 * the service — litres are derived from the weighed kilograms and are never submitted.
 */
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

/**
 * Registered consignments, newest page first. The gate screen uses this to offer the deliveries
 * still waiting on a verdict — a consignment is tested once, so anything already accepted or
 * rejected is filtered out by its status.
 */
export function searchConsignments(
  token: string | null,
  signal?: AbortSignal,
  pageSize = 100,
): Promise<PagedResult<Consignment>> {
  return request<PagedResult<Consignment>>(`/api/consignments?pageSize=${pageSize}`, { token, signal });
}
