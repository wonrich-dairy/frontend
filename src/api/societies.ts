import { request } from "./http";
import type { Society } from "./types";

export interface SaveSocietyRequest {
  code: string;
  name: string;
  canLabelPrefix: string;
  contactPerson?: string | null;
  contactNumber?: string | null;
}

export function listSocieties(token: string | null, signal?: AbortSignal): Promise<Society[]> {
  return request<Society[]>("/api/societies", { token, signal });
}

export function getSociety(
  id: string,
  token: string | null,
  signal?: AbortSignal,
): Promise<Society> {
  return request<Society>(`/api/societies/${encodeURIComponent(id)}`, { token, signal });
}

export function createSociety(
  body: SaveSocietyRequest,
  token: string | null,
): Promise<Society> {
  return request<Society>("/api/societies", { method: "POST", body, token });
}

export function updateSociety(
  id: string,
  body: SaveSocietyRequest,
  token: string | null,
): Promise<Society> {
  return request<Society>(`/api/societies/${encodeURIComponent(id)}`, {
    method: "PUT",
    body,
    token,
  });
}


