import type { ReactNode } from "react";
import {
  ArrowLeftIcon,
  ClipboardIcon,
  CloudOffIcon,
  DropletIcon,
  HomeIcon,
  LogoMark,
  PersonIcon,
  SettingsIcon,
} from "./icons";
import { useSync } from "../features/sync/syncStore";
import { useNavigation } from "../app/navigationStore";

export type Tab = "home" | "consignments" | "tanks" | "settings";

const tabs: { id: Tab; label: string; path: string; icon: ReactNode }[] = [
  { id: "home", label: "Home", path: "/", icon: <HomeIcon /> },
  { id: "consignments", label: "Consignments", path: "/consignments", icon: <ClipboardIcon /> },
  { id: "tanks", label: "Tanks", path: "/tanks", icon: <DropletIcon /> },
  { id: "settings", label: "Settings", path: "/settings", icon: <SettingsIcon /> },
];

/**
 * The phone frame every screen sits inside: the branded top bar with its sync pill and the tab
 * bar beneath. The pill is the design's "Cloud Sync Active" chip made honest — it reports whether
 * there is a connection and how much is still waiting on the device (SCRUM-10, AC3).
 *
 * A screen pushed on top of a tab (adding a tank, a profile) passes `title`, which swaps the
 * brand bar for the compact back bar those frames are drawn with.
 */
export function AppShell({
  children,
  current,
  title,
  onBack,
}: {
  children: ReactNode;
  current: Tab;
  title?: string;
  onBack?: () => void;
}) {
  const { online, syncing, pendingCount } = useSync();
  const { navigate, path } = useNavigation();

  return (
    <div className="shell">
      {title ? (
        <header className="topbar topbar--compact">
          <button type="button" className="iconbutton" onClick={onBack} title="Back">
            <ArrowLeftIcon width={20} height={20} />
            <span className="sr-only">Back</span>
          </button>
          <h1 className="topbar__title">{title}</h1>
          <span className="iconbutton iconbutton--ghost" aria-hidden="true" />
        </header>
      ) : (
        <header className="topbar">
          <span className="topbar__brand">
            <LogoMark />
            <span>
              Wonrich
              <br />
              Dairy
            </span>
          </span>

          <span className="topbar__spacer" />

          <SyncPill online={online} syncing={syncing} pendingCount={pendingCount} />

          <button
            type="button"
            className="iconbutton iconbutton--round"
            onClick={() => navigate("/profile")}
            aria-current={path === "/profile" ? "page" : undefined}
            title="Your profile"
          >
            <PersonIcon width={18} height={18} />
            <span className="sr-only">Your profile</span>
          </button>
        </header>
      )}

      <main className="shell__body">{children}</main>

      <nav className="tabbar" aria-label="Sections">
        {tabs.map((tab) => (
          <TabButton
            key={tab.id}
            label={tab.label}
            icon={tab.icon}
            badge={tab.id === "home" ? pendingCount : 0}
            current={current === tab.id}
            onClick={() => navigate(tab.path)}
          />
        ))}
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
      className={`tabbar__item${current ? " tabbar__item--current" : ""}`}
      aria-current={current ? "page" : undefined}
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
