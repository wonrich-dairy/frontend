import type { ReactNode } from "react";
import { ArrowLeftIcon, FlaskIcon, LogoMark, PersonIcon, SettingsIcon, SlidersIcon } from "../icons";
import { useNavigation } from "../../app/navigationStore";
import { can, type Permission, type Role } from "../../auth/permissions";

export type QualityLabTab = "panels" | "specs" | "labSettings";

// Each tab carries the permission its route checks, so a role is never shown a tab that
// would only refuse it (a Production Manager may read the specs but not record panels).
const tabs: { id: QualityLabTab; label: string; path: string; needs: Permission; icon: ReactNode }[] = [
  { id: "panels", label: "Panels", path: "/quality-lab/panels", needs: "recordLabPanels", icon: <FlaskIcon /> },
  { id: "specs", label: "Specs", path: "/quality-lab/specs", needs: "viewLabSpecs", icon: <SlidersIcon /> },
  { id: "labSettings", label: "Settings", path: "/quality-lab/settings", needs: "recordLabPanels", icon: <SettingsIcon /> },
];

export function QualityLabAppShell({
  children,
  current,
  role,
  title,
  onBack,
  wide = false,
}: {
  children: ReactNode;
  current: QualityLabTab;
  role: Role | null;
  title?: string;
  onBack?: () => void;
  wide?: boolean;
}) {
  const { navigate, path } = useNavigation();
  const shown = tabs.filter((tab) => can(role, tab.needs));
  // A bar with a single tab only links to the page already open.
  const showTabs = shown.length > 1;

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
              Quality Lab
            </span>
          </span>
          <span className="topbar__spacer" />
          <button
            type="button"
            className="iconbutton iconbutton--round"
            onClick={() => navigate("/quality-lab/profile")}
            aria-current={path === "/quality-lab/profile" ? "page" : undefined}
            title="Profile"
          >
            <PersonIcon width={18} height={18} />
            <span className="sr-only">Profile</span>
          </button>
        </header>
      )}

      <main className={`shell__body${wide ? " shell__body--wide" : ""}`}>{children}</main>

      {showTabs ? (
        <nav className="tabbar" aria-label="Quality Lab Sections">
          {shown.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`tabbar__item${current === tab.id ? " tabbar__item--current" : ""}`}
              aria-current={current === tab.id ? "page" : undefined}
              onClick={() => navigate(tab.path)}
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
