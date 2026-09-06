import { describe, expect, it } from "vitest";
import { gradeFrom } from "./grade";

describe("stability grade from the alcohol switches", () => {
  it("is Stable when the load survives the harshest challenge", () => {
    expect(gradeFrom({ a80: false, a75: false, a68: false })).toBe("Stable");
  });

  it("ignores anything recorded past the first strength that held", () => {
    expect(gradeFrom({ a80: false, a75: true, a68: true })).toBe("Stable");
  });

  it("is MarginallyStable when it clotted at 80% but held at 75%", () => {
    expect(gradeFrom({ a80: true, a75: false, a68: false })).toBe("MarginallyStable");
  });

  it("is Unstable when it clotted through 75% but held at 68%", () => {
    expect(gradeFrom({ a80: true, a75: true, a68: false })).toBe("Unstable");
  });

  it("is SeverelyUnstable when it clotted at every strength", () => {
    expect(gradeFrom({ a80: true, a75: true, a68: true })).toBe("SeverelyUnstable");
  });
});
