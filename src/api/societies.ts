import { request } from "./http";
import type { Society } from "./types";

/** Registered supplying societies (SCRUM-51). Reads need a token; maintenance needs a manager. */

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

/**
 * Societies are never deleted. Retiring one keeps it resolvable from historical consignments
 * while taking it out of the list the officer can pick at the gate.
 */
export function deactivateSociety(id: string, token: string | null): Promise<Society> {
  return request<Society>(`/api/societies/${encodeURIComponent(id)}/deactivate`, {
    method: "POST",
    token,
  });
}

export function reactivateSociety(id: string, token: string | null): Promise<Society> {
  return request<Society>(`/api/societies/${encodeURIComponent(id)}/reactivate`, {
    method: "POST",
    token,
  });
}
