import { describe, expect, it } from "vitest";
import { match, normalise } from "./navigationStore";

describe("route matching", () => {
  it("treats a trailing slash as the same route", () => {
    expect(normalise("/tanks/")).toBe("/tanks");
    expect(normalise("/")).toBe("/");
    expect(normalise("")).toBe("/");
  });

  it("matches a literal path", () => {
    expect(match("/tanks", "/tanks")).toEqual({});
    expect(match("/tanks", "/dispatch")).toBeNull();
  });

  it("captures a named segment", () => {
    expect(match("/tanks/:code", "/tanks/T1")).toEqual({ code: "T1" });
    expect(match("/settings/societies/:id", "/settings/societies/abc-123")).toEqual({
      id: "abc-123",
    });
  });

  it("does not let a one-segment pattern swallow a deeper path", () => {
    expect(match("/tanks/:code", "/tanks/T1/pour")).toBeNull();
  });

  it("prefers nothing over a partial match", () => {
    expect(match("/tanks/:code", "/tanks")).toBeNull();
    expect(match("/settings/tanks/new", "/settings/tanks/T1")).toBeNull();
  });

  it("decodes a captured segment", () => {
    expect(match("/tanks/:code", "/tanks/T%201")).toEqual({ code: "T 1" });
  });
});
