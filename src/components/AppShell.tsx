import type { ReactNode } from "react";
import { ClipboardIcon, DropletIcon, HomeIcon, LogoMark, PersonIcon, SettingsIcon } from "./icons";

/**
 * The phone frame every screen in the design sits inside: the branded top bar with its sync
 * pill, and the four-item tab bar. Only Consignments has a screen behind it so far, so the
 * other tabs are present but inert rather than pretending to navigate.
 */
export function AppShell({
  children,
  userName,
  onSignOut,
}: {
  children: ReactNode;
  userName?: string;
  onSignOut?: () => void;
}) {
  return (
    <div className="shell">
      <header className="topbar">
        <span className="topbar__brand">
          <LogoMark />
          Wonrich
          <br />
          Dairy
        </span>

        <span className="topbar__spacer" />

        <span className="pill">
          <span className="pill__dot" />
          Cloud Sync Active
        </span>

        {onSignOut ? (
          <button type="button" className="iconbutton" onClick={onSignOut} title={`Sign out ${userName ?? ""}`.trim()}>
            <PersonIcon />
            <span className="sr-only">Sign out</span>
          </button>
        ) : null}
      </header>

      <main className="shell__body">{children}</main>

      <nav className="tabbar" aria-label="Sections">
        <Tab label="Home" icon={<HomeIcon />} />
        <Tab label="Consignments" icon={<ClipboardIcon />} current />
        <Tab label="Tanks" icon={<DropletIcon />} />
        <Tab label="Settings" icon={<SettingsIcon />} />
      </nav>
    </div>
  );
}

function Tab({ label, icon, current = false }: { label: string; icon: ReactNode; current?: boolean }) {
  return (
    <button
      type="button"
      className="tabbar__item"
      aria-current={current ? "page" : undefined}
      disabled={!current}
    >
      {icon}
      {label.toUpperCase()}
    </button>
  );
}
