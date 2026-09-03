import { useState, type ReactNode } from "react";
import { CheckIcon, ChevronDownIcon, WarningIcon } from "../icons";

/** The "Saved Successfully" frame, reused by every screen that records something. */
export function SaveConfirmation({
  title = "Saved Successfully",
  detail = "The record has been securely uploaded and synced.",
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: {
  title?: string;
  detail?: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  return (
    <section className="saved" aria-live="polite">
      <span className="saved__mark">
        <CheckIcon width={40} height={40} />
      </span>

      <h2 className="saved__title">{title}</h2>
      <p className="saved__detail">{detail}</p>

      <button type="button" className="button" onClick={onPrimary}>
        {primaryLabel}
      </button>

      {secondaryLabel && onSecondary ? (
        <button type="button" className="linkbutton" onClick={onSecondary}>
          {secondaryLabel}
        </button>
      ) : null}
    </section>
  );
}

/** A collapsible section, as the trace screen stacks them. */
export function Accordion({
  icon,
  title,
  defaultOpen = false,
  children,
}: {
  icon?: ReactNode;
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="accordion">
      {icon ? <span className="accordion__badge">{icon}</span> : null}

      <div className="accordion__card">
        <button
          type="button"
          className="accordion__head"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          <span className="accordion__title">{title}</span>
          <ChevronDownIcon
            width={20}
            height={20}
            className={open ? "accordion__chevron accordion__chevron--open" : "accordion__chevron"}
          />
        </button>

        {open ? <div className="accordion__body">{children}</div> : null}
      </div>
    </section>
  );
}

export function ErrorNotice({ children }: { children: ReactNode }) {
  return (
    <p className="notice notice--error" role="alert">
      <WarningIcon />
      <span>{children}</span>
    </p>
  );
}

/** Shown while a screen's first load is in flight, so the frame is never briefly empty. */
export function Loading({ label = "Loading..." }: { label?: string }) {
  return (
    <p className="loading" role="status">
      {label}
    </p>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="emptystate">{children}</p>;
}
