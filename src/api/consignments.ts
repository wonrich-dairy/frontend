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

export const CONSIGNMENT_STATUSES = ["Registered", "Accepted", "Rejected"] as const;

export type ConsignmentStatus = (typeof CONSIGNMENT_STATUSES)[number];

export interface ConsignmentSearch {
  status?: ConsignmentStatus | null;
  societyCode?: string | null;
  date?: string | null;
  reference?: string | null;
  page?: number;
  pageSize?: number;
}

export function searchConsignments(
  token: string | null,
  signal?: AbortSignal,
  search: ConsignmentSearch | number = {},
): Promise<PagedResult<Consignment>> {
  const options: ConsignmentSearch = typeof search === "number" ? { pageSize: search } : search;
  const query = new URLSearchParams();

  query.set("pageSize", String(options.pageSize ?? 100));

  if (options.page && options.page > 1) {
    query.set("page", String(options.page));
  }

  if (options.status) {
    query.set("status", options.status);
  }

  if (options.societyCode) {
    query.set("societyCode", options.societyCode);
  }

  if (options.date) {
    query.set("date", options.date);
  }

  if (options.reference) {
    query.set("reference", options.reference);
  }

  return request<PagedResult<Consignment>>(`/api/consignments?${query}`, { token, signal });
}
