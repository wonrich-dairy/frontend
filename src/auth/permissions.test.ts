import { describe, expect, it } from "vitest";
import { can, roleFromToken } from "./permissions";

function tokenFor(claims: Record<string, unknown>): string {
  const body = btoa(JSON.stringify(claims))
    .split("+").join("-")
    .split("/").join("_");

  return "header." + body + ".signature";
}

const ROLE_CLAIM = "http://schemas.microsoft.com/ws/2008/06/identity/claims/role";

describe("reading the role off the access token", () => {
  it("reads the role claim the auth service issues", () => {
    expect(roleFromToken(tokenFor({ [ROLE_CLAIM]: "MccManager" }))).toBe("MccManager");
  });

  it("accepts the short claim name as well", () => {
    expect(roleFromToken(tokenFor({ role: "IntakeOfficer" }))).toBe("IntakeOfficer");
  });

  it("returns null for a role the services do not define", () => {
    expect(roleFromToken(tokenFor({ role: "Caretaker" }))).toBeNull();
  });

  it("returns null rather than throwing on a token it cannot read", () => {
    expect(roleFromToken(null)).toBeNull();
    expect(roleFromToken("not-a-token")).toBeNull();
    expect(roleFromToken("header.@@@.signature")).toBeNull();
  });
});

describe("what a role is allowed to do", () => {
  it("matches the intake service policies", () => {
    expect(can("IntakeOfficer", "registerConsignments")).toBe(true);
    expect(can("IntakeOfficer", "manageSocieties")).toBe(false);
    expect(can("IntakeOfficer", "recordDispatchNotes")).toBe(false);
    expect(can("IntakeOfficer", "traceBatches")).toBe(false);

    expect(can("MccManager", "manageSocieties")).toBe(true);
    expect(can("MccManager", "recordDispatchNotes")).toBe(true);
    expect(can("MccManager", "traceBatches")).toBe(false);

    expect(can("QualityAnalyst", "recordQualityTests")).toBe(true);
    expect(can("QualityAnalyst", "traceBatches")).toBe(true);
    expect(can("QualityAnalyst", "pourToTanks")).toBe(false);
  });

  it("allows the administrator everything", () => {
    const every = [
      "manageSocieties",
      "registerConsignments",
      "recordQualityTests",
      "pourToTanks",
      "recordDispatchNotes",
      "traceBatches",
    ] as const;

    for (const permission of every) {
      expect(can("SystemAdministrator", permission)).toBe(true);
    }
  });

  it("allows a signed-out user nothing", () => {
    expect(can(null, "registerConsignments")).toBe(false);
    expect(can(null, "traceBatches")).toBe(false);
  });
});
