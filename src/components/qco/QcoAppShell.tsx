import type { ReactNode } from "react";
import { ArrowLeftIcon, ClipboardIcon, HomeIcon, PersonIcon, TraceIcon, TrendIcon, UsersIcon, WarningIcon } from "../icons";
import { useNavigation } from "../../app/navigationStore";
import { TopbarBrand } from "../TopbarBrand";

// A tab is added only once its screen exists; an inert tab is worse than a missing one.
// Each dashboard tab is a route showing a few of the dashboard panels, so a phone is not scrolled
// through all six to reach the one wanted. Batches is the search, timeline and trace (SCRUM-137);
// Audit is the consolidated read-only event trail (SCRUM-138).
export type QcoTab = "overview" | "trends" | "causes" | "societies" | "batches" | "audit";

const tabs: { id: QcoTab; label: string; path: string; icon: ReactNode; filtered: boolean }[] = [
  { id: "overview", label: "Overview", path: "/qco", icon: <HomeIcon />, filtered: true },
  { id: "trends", label: "Trends", path: "/qco/trends", icon: <TrendIcon />, filtered: true },
  { id: "causes", label: "Causes", path: "/qco/causes", icon: <WarningIcon />, filtered: true },
  { id: "societies", label: "Societies", path: "/qco/societies", icon: <UsersIcon />, filtered: true },
  { id: "batches", label: "Batches", path: "/qco/batches", icon: <TraceIcon />, filtered: false },
  { id: "audit", label: "Audit", path: "/qco/audit", icon: <ClipboardIcon />, filtered: false },
];

export function QcoAppShell({
  children,
  current,
  title,
  onBack,
}: {
  children: ReactNode;
  // Optional: a screen such as the profile belongs to no tab.
  current?: QcoTab;
  title?: string;
  onBack?: () => void;
}) {
  const { navigate, path, query } = useNavigation();
  const showTabs = tabs.length > 1;
  // The filters live in the query string and apply to every dashboard tab, so switching between
  // those keeps them. The batch screens take no filters, and their own query (the search term)
  // is not a filter, so it is carried nowhere.
  const onDashboard = tabs.some((tab) => tab.filtered && tab.path === path);
  const dashboardQuery = new URLSearchParams(query);
  dashboardQuery.delete("facility");
  const search = onDashboard && dashboardQuery.toString() ? `?${dashboardQuery.toString()}` : "";

  return (
    <div className={`shell${showTabs ? " shell--nav" : ""}`}>
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
          <TopbarBrand service="Quality Control" />
          <span className="topbar__spacer" />
          <button
            type="button"
            className="iconbutton iconbutton--round"
            onClick={() => navigate("/qco/profile")}
            aria-current={path === "/qco/profile" ? "page" : undefined}
            title="Profile"
          >
            <PersonIcon width={18} height={18} />
            <span className="sr-only">Profile</span>
          </button>
        </header>
      )}

      {/* The dashboard is also used at a desk, so it always takes the width. */}
      <main className="shell__body shell__body--wide">{children}</main>

      {/* A bar with a single tab would only link to the page already open. */}
      {showTabs ? (
        <nav className="tabbar tabbar--dense" aria-label="Quality Control Sections">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`tabbar__item${current === tab.id ? " tabbar__item--current" : ""}`}
              aria-current={current === tab.id ? "page" : undefined}
              onClick={() => navigate(`${tab.path}${tab.filtered ? search : ""}`)}
            >
              <span className="tabbar__icon">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
