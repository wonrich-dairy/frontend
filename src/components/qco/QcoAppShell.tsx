import type { ReactNode } from "react";
import { ArrowLeftIcon, HomeIcon, LogoMark, PersonIcon, TrendIcon, UsersIcon, WarningIcon } from "../icons";
import { useNavigation } from "../../app/navigationStore";

// A tab is added only once its screen exists; an inert tab is worse than a missing one.
// Each tab is a route showing a few of the dashboard panels, so a phone is not scrolled
// through all six to reach the one wanted.
export type QcoTab = "overview" | "trends" | "causes" | "societies";

const tabs: { id: QcoTab; label: string; path: string; icon: ReactNode }[] = [
  { id: "overview", label: "Overview", path: "/qco", icon: <HomeIcon /> },
  { id: "trends", label: "Trends", path: "/qco/trends", icon: <TrendIcon /> },
  { id: "causes", label: "Causes", path: "/qco/causes", icon: <WarningIcon /> },
  { id: "societies", label: "Societies", path: "/qco/societies", icon: <UsersIcon /> },
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
  // The filters live in the query string and apply to every tab, so switching tabs keeps them.
  const search = query.toString() ? `?${query.toString()}` : "";

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
          <span className="topbar__brand">
            <LogoMark />
            <span>
              Wonrich
              <br />
              Quality Control
            </span>
          </span>
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
        <nav className="tabbar" aria-label="Quality Control Sections">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`tabbar__item${current === tab.id ? " tabbar__item--current" : ""}`}
              aria-current={current === tab.id ? "page" : undefined}
              onClick={() => navigate(`${tab.path}${search}`)}
            >
              <span className="tabbar__icon">{tab.icon}</span>
              {tab.label.toUpperCase()}
            </button>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
