export const ROLES = [
  "SystemAdministrator",
  "MccManager",
  "IntakeOfficer",
  "QualityAnalyst",
  "FactoryIntakeOfficer",
  "ProductionManager",
] as const;

export type Role = (typeof ROLES)[number];

export type Permission =
  | "manageSocieties"
  | "registerConsignments"
  | "recordQualityTests"
  | "pourToTanks"
  | "recordDispatchNotes"
  | "traceBatches"
  | "manageTanks";

const ROLE_CLAIM = "http://schemas.microsoft.com/ws/2008/06/identity/claims/role";

const GRANTS: Record<Permission, readonly Role[]> = {
  manageSocieties: ["SystemAdministrator", "MccManager"],
  registerConsignments: ["SystemAdministrator", "MccManager", "IntakeOfficer"],
  recordQualityTests: ["SystemAdministrator", "MccManager", "IntakeOfficer", "QualityAnalyst"],
  pourToTanks: ["SystemAdministrator", "MccManager", "IntakeOfficer"],
  recordDispatchNotes: ["SystemAdministrator", "MccManager"],
  traceBatches: ["SystemAdministrator", "ProductionManager", "QualityAnalyst"],
  manageTanks: ["SystemAdministrator", "MccManager"],
};

export function roleFromToken(accessToken: string | null | undefined): Role | null {
  if (!accessToken) {
    return null;
  }

  const payload = accessToken.split(".")[1];

  if (!payload) {
    return null;
  }

  try {
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const claims = JSON.parse(json) as Record<string, unknown>;
    const claimed = claims[ROLE_CLAIM] ?? claims.role;
    const role = Array.isArray(claimed) ? claimed[0] : claimed;

    return ROLES.includes(role as Role) ? (role as Role) : null;
  } catch {
    return null;
  }
}

export function can(role: Role | null, permission: Permission): boolean {
  return role !== null && GRANTS[permission].includes(role);
}
