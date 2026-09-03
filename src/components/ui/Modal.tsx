import { useEffect, type ReactNode } from "react";
import { CloseIcon } from "../icons";

/**
 * The modal container from the design: a titled card over a scrim. Escape and the scrim both
 * dismiss it, because the officer is one-handed at the gate and the close control is small.
 */
export function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", onKey);

    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="scrim" role="presentation" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal__head">
          <h2 className="modal__title">{title}</h2>
          <button type="button" className="iconbutton" onClick={onClose} title="Close">
            <CloseIcon width={18} height={18} />
            <span className="sr-only">Close</span>
          </button>
        </header>

        <div className="modal__body">{children}</div>

        {footer ? <footer className="modal__foot">{footer}</footer> : null}
      </div>
    </div>
  );
}

/**
 * The confirmation card. Destructive by default because every frame drawn for it is a deletion,
 * and the confirming action is named for what it does rather than "OK".
 */
export function ConfirmDialog({
  title,
  subject,
  detail,
  confirmLabel,
  icon,
  onConfirm,
  onCancel,
  busy = false,
}: {
  title: string;
  subject?: string;
  detail: string;
  confirmLabel: string;
  icon?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  return (
    <div className="scrim" role="presentation" onClick={onCancel}>
      <div
        className="confirm"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="confirm__head">
          {icon ? <span className="confirm__mark">{icon}</span> : null}
          <h2 className="confirm__title">{title}</h2>
        </div>

        <div className="confirm__body">
          {subject ? <p className="confirm__subject">{subject}</p> : null}
          <p className="confirm__detail">{detail}</p>
        </div>

        <div className="confirm__actions">
          <button
            type="button"
            className="button button--danger"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Working..." : confirmLabel}
          </button>
          <button type="button" className="button button--ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/** The bottom sheet the row menus open, listing the actions for one row. */
export function ActionSheet({
  eyebrow,
  title,
  onClose,
  children,
}: {
  eyebrow?: string;
  title?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="scrim scrim--bottom" role="presentation" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title ?? eyebrow ?? "Actions"}
        onClick={(event) => event.stopPropagation()}
      >
        <span className="sheet__grip" aria-hidden="true" />

        {eyebrow ? <p className="sheet__eyebrow">{eyebrow}</p> : null}
        {title ? <p className="sheet__title">{title}</p> : null}

        <div className="sheet__actions">{children}</div>

        <button type="button" className="button button--ghost" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export function SheetAction({
  icon,
  label,
  danger = false,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`sheetaction${danger ? " sheetaction--danger" : ""}`}
      onClick={onClick}
    >
      <span className="sheetaction__icon">{icon}</span>
      {label}
    </button>
  );
}
