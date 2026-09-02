import { useEffect, useRef } from "react";
import { PencilIcon, TrashIcon } from "../../components/icons";

/**
 * The bottom sheet behind a can row's three-dots button. Deleting a can is one tap away in the
 * design but not on the row itself, so a thumb reaching for the weight column cannot wipe a
 * recorded can by accident — the sheet names the row it is about before offering the action.
 */
export function CanActionSheet({
  rowTitle,
  amount,
  onEdit,
  onDelete,
  onClose,
}: {
  rowTitle: string;
  amount: string;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const firstAction = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstAction.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="sheet">
      {/* The backdrop dismisses the sheet; every action it offers is also on a real button. */}
      <div className="sheet__backdrop" onClick={onClose} aria-hidden="true" />

      <div className="sheet__panel" role="dialog" aria-modal="true" aria-label={`Can ${rowTitle}`}>
        <span className="sheet__grip" aria-hidden="true" />

        <div className="sheet__head">
          <span className="sheet__body">
            <span className="microlabel">Consignment row</span>
            <strong className="sheet__row">{rowTitle}</strong>
          </span>
          <span className="sheet__amount">{amount}</span>
        </div>

        <button ref={firstAction} type="button" className="sheet__item" onClick={onEdit}>
          <PencilIcon />
          Edit Entry
        </button>

        <button type="button" className="sheet__item sheet__item--danger" onClick={onDelete}>
          <TrashIcon />
          Delete Entry
        </button>
      </div>
    </div>
  );
}
