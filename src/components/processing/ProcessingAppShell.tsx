import type { ReactNode } from "react";
import { ArrowLeftIcon, HomeIcon, DropletIcon, ClipboardIcon, SettingsIcon, LogoMark, PersonIcon } from "../icons";
import { useNavigation } from "../../app/navigationStore";

export type ProcessingTab = "factory" | "processingTanks" | "unloads" | "processingSettings";

const tabs: { id: ProcessingTab; label: string; path: string; icon: ReactNode }[] = [
  { id: "factory", label: "Factory", path: "/processing", icon: <HomeIcon /> },
  { id: "processingTanks", label: "Tanks", path: "/processing/tanks", icon: <DropletIcon /> },
  { id: "unloads", label: "Unloads", path: "/processing/unloads", icon: <ClipboardIcon /> },
  { id: "processingSettings", label: "Settings", path: "/processing/settings", icon: <SettingsIcon /> },
];

export function ProcessingAppShell({
  children,
  current,
  title,
  onBack,
}: {
  children: ReactNode;
  current: ProcessingTab;
  title?: string;
  onBack?: () => void;
}) {
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
              Factory
            </span>
          </span>
          <span className="topbar__spacer" />
          <span className="pill" aria-live="polite">
            <span className="pill__dot" />
            Factory Active
          </span>
          <button
            type="button"
            className="iconbutton iconbutton--round"
            onClick={() => navigate("/processing/settings")}
            aria-current={path === "/processing/settings" ? "page" : undefined}
            title="Settings"
          >
            <PersonIcon width={18} height={18} />
            <span className="sr-only">Settings</span>
          </button>
        </header>
      )}

      <main className="shell__body">{children}</main>

      <nav className="tabbar" aria-label="Factory Sections">
        {tabs.map((tab) => (
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
    </div>
  );
}
