import type { ReactNode } from "react";
import {
  ClipboardIcon,
  CloudOffIcon,
  DropletIcon,
  FlaskIcon,
  LogoMark,
  PersonIcon,
  SettingsIcon,
} from "./icons";
import { useSync } from "../features/sync/syncStore";

export type Tab = "register" | "quality" | "tanks" | "queue";

/**
 * The phone frame every screen in the design sits inside: the branded top bar with its sync pill,
 * and the tab bar. The pill is the design's "Cloud Sync Active" chip made honest — it reports
 * whether there is a connection and how much is still waiting on the device (SCRUM-10, AC3).
 */
export function AppShell({
  children,
  userName,
  current,
  onNavigate,
  onSignOut,
}: {
  children: ReactNode;
  userName?: string;
  current: Tab;
  onNavigate: (tab: Tab) => void;
  onSignOut?: () => void;
}) {
  const { online, syncing, pendingCount } = useSync();

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

        <SyncPill online={online} syncing={syncing} pendingCount={pendingCount} />

        {onSignOut ? (
          <button
            type="button"
            className="iconbutton"
            onClick={onSignOut}
            title={`Sign out ${userName ?? ""}`.trim()}
          >
            <PersonIcon />
            <span className="sr-only">Sign out</span>
          </button>
        ) : null}
      </header>

      <main className="shell__body">{children}</main>

      <nav className="tabbar" aria-label="Sections">
        <TabButton
          label="Consignments"
          icon={<ClipboardIcon />}
          current={current === "register"}
          onClick={() => onNavigate("register")}
        />
        <TabButton
          label="Testing"
          icon={<FlaskIcon />}
          current={current === "quality"}
          onClick={() => onNavigate("quality")}
        />
        <TabButton
          label="Tanks"
          icon={<DropletIcon />}
          current={current === "tanks"}
          onClick={() => onNavigate("tanks")}
        />
        <TabButton
          label="Queue"
          icon={<SettingsIcon />}
          badge={pendingCount}
          current={current === "queue"}
          onClick={() => onNavigate("queue")}
        />
      </nav>
    </div>
  );
}

function SyncPill({
  online,
  syncing,
  pendingCount,
}: {
  online: boolean;
  syncing: boolean;
  pendingCount: number;
}) {
  if (!online) {
    return (
      <span className="pill pill--offline" aria-live="polite">
        <CloudOffIcon width={13} height={13} />
        {pendingCount > 0 ? `Offline - ${pendingCount} waiting` : "Offline"}
      </span>
    );
  }

  if (syncing) {
    return (
      <span className="pill" aria-live="polite">
        <span className="pill__dot" />
        Syncing...
      </span>
    );
  }

  if (pendingCount > 0) {
    return (
      <span className="pill pill--waiting" aria-live="polite">
        <span className="pill__dot pill__dot--waiting" />
        {pendingCount} waiting
      </span>
    );
  }

  return (
    <span className="pill" aria-live="polite">
      <span className="pill__dot" />
      Cloud Sync Active
    </span>
  );
}

function TabButton({
  label,
  icon,
  current = false,
  badge = 0,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  current?: boolean;
  badge?: number;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className="tabbar__item"
      aria-current={current ? "page" : undefined}
      disabled={!onClick}
      onClick={onClick}
    >
      <span className="tabbar__icon">
        {icon}
        {badge > 0 ? <span className="tabbar__badge">{badge}</span> : null}
      </span>
      {label.toUpperCase()}
    </button>
  );
}
