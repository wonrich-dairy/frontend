import { fireEvent, render, screen, within } from "@testing-library/react";
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

function labTabs() {
  const nav = screen.getByRole("navigation", { name: "Quality Lab Sections" });

  return within(nav)
    .getAllByRole("button")
    .map((button) => button.textContent);
}

let fetchMock: ReturnType<typeof vi.fn>;

function calledConsignments(): boolean {
  return fetchMock.mock.calls.some(([input]) => String(input).includes("/api/consignments"));
}

beforeEach(() => {
  fetchMock = vi.fn(() => new Promise(() => {}));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  saveSession(null);
  vi.unstubAllGlobals();
});

describe("the Quality Lab module", () => {
  it("sends a Lab Technician from / to the panels, with the lab's own tabs", () => {
    openAs("QualityAnalyst", "/");

    expect(window.location.pathname).toBe("/quality-lab/panels");
    expect(labTabs()).toEqual(["PANELS", "SPECS", "SETTINGS"]);
    expect(screen.queryByRole("navigation", { name: "Sections" })).not.toBeInTheDocument();
  });

  it("gives the administrator the lab tabs, not the MCC ones", () => {
    openAs("SystemAdministrator", "/quality-lab/specs");

    expect(labTabs()).toEqual(["PANELS", "SPECS", "SETTINGS"]);
    expect(screen.getByRole("button", { name: "SPECS" })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("button", { name: /CONSIGNMENTS/ })).not.toBeInTheDocument();
  });

  it("shows a Production Manager no tab bar, since the specs are the only lab screen they may open", () => {
    openAs("ProductionManager", "/quality-lab/specs");

    expect(screen.queryByRole("navigation", { name: "Quality Lab Sections" })).not.toBeInTheDocument();
    expect(screen.queryByText("Not available to you")).not.toBeInTheDocument();
    expect(screen.getByText(/Quality Lab/)).toBeInTheDocument();
  });

  it("opens the profile inside the lab shell, without the MCC intake count", () => {
    openAs("QualityAnalyst", "/quality-lab/panels");

    fireEvent.click(screen.getByRole("button", { name: "Profile" }));

    expect(window.location.pathname).toBe("/quality-lab/profile");
    expect(screen.getByRole("heading", { name: "Quality Analyst" })).toBeInTheDocument();
    expect(labTabs()).toEqual(["PANELS", "SPECS", "SETTINGS"]);
    expect(screen.queryByRole("navigation", { name: "Sections" })).not.toBeInTheDocument();
    expect(screen.queryByText("Intake Count")).not.toBeInTheDocument();
    expect(calledConsignments()).toBe(false);
  });

  it("lets a Production Manager open their profile from the specs page", () => {
    openAs("ProductionManager", "/quality-lab/specs");

    fireEvent.click(screen.getByRole("button", { name: "Profile" }));

    expect(window.location.pathname).toBe("/quality-lab/profile");
    expect(screen.queryByText("Not available to you")).not.toBeInTheDocument();
  });

  it("refuses a Processing Technician inside the lab shell, not the factory one", () => {
    openAs("ProcessingTechnician", "/quality-lab/panels");

    expect(screen.getByText("Not available to you")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Factory Sections" })).not.toBeInTheDocument();
  });
});
