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
