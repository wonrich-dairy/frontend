import { request } from "./http";
import type { Society } from "./types";

/** Active societies, for the picker at the gate. Reads stay open to any signed-in officer. */
export function listSocieties(token: string | null, signal?: AbortSignal): Promise<Society[]> {
  return request<Society[]>("/api/societies", { token, signal });
}
