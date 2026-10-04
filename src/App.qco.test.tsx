import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { saveSession } from "./auth/session";
import type { Role } from "./auth/permissions";
import { sessionFor } from "./test/tokens";

function openAs(role: Role, path: string) {
  saveSession(sessionFor(role));
  window.history.pushState({}, "", path);
  render(<App />);
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
});

afterEach(() => {
  saveSession(null);
  vi.unstubAllGlobals();
});

describe("the QCO module (SCRUM-136)", () => {
  it("sends a Quality Control Officer from / to the dashboard", () => {
    openAs("QualityControlOfficer", "/");

    expect(window.location.pathname).toBe("/qco");
    expect(screen.getByRole("heading", { name: "Quality Dashboard" })).toBeInTheDocument();
  });

  it("opens /qco for the Quality Control Officer and the administrator", () => {
    for (const role of ["QualityControlOfficer", "SystemAdministrator"] as const) {
      openAs(role, "/qco");

      expect(screen.getByRole("heading", { name: "Quality Dashboard" })).toBeInTheDocument();
      expect(screen.queryByText("Not available to you")).not.toBeInTheDocument();

      cleanup();
    }
  });

  it("takes the administrator from the service chooser to the dashboard", () => {
    openAs("SystemAdministrator", "/select-service");

    fireEvent.click(screen.getByRole("button", { name: /Quality Control/ }));

    expect(window.location.pathname).toBe("/qco");
    expect(screen.getByRole("heading", { name: "Quality Dashboard" })).toBeInTheDocument();
  });

  it("opens the profile inside the QCO shell, not the MCC one", () => {
    openAs("QualityControlOfficer", "/qco");

    fireEvent.click(screen.getByRole("button", { name: "Profile" }));

    expect(window.location.pathname).toBe("/qco/profile");
    expect(screen.getByRole("heading", { name: "Quality Control Officer" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Sections" })).not.toBeInTheDocument();
    expect(screen.queryByText("Intake Count")).not.toBeInTheDocument();
  });

  it("refuses a Lab Technician who navigates straight to /qco", () => {
    openAs("QualityAnalyst", "/qco");

    expect(screen.getByText("Not available to you")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Quality Dashboard" })).not.toBeInTheDocument();
  });

  it("refuses a Lab Technician on every dashboard tab, not only the overview", () => {
    for (const path of ["/qco/trends", "/qco/causes", "/qco/societies"]) {
      openAs("QualityAnalyst", path);

      expect(screen.getByText("Not available to you")).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Quality Dashboard" })).not.toBeInTheDocument();

      cleanup();
    }
  });

  it("refuses a Processing Technician inside the QCO shell, not the factory one", () => {
    openAs("ProcessingTechnician", "/qco");

    expect(screen.getByText("Not available to you")).toBeInTheDocument();
    expect(screen.getByText(/Quality Control/)).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Factory Sections" })).not.toBeInTheDocument();
  });
});
