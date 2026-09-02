import { useRef, useState } from "react";
import { DropletIcon, MoreIcon, PlusIcon, WarningIcon } from "../../components/icons";
import { CanActionSheet } from "./CanActionSheet";
import type { CanEntry, CanEntryErrors } from "./canSheet";
import { isBlank, parseKg } from "./canSheet";

/**
 * One line of the can sheet. The label and the weight are edited in place, as they are in the
 * design, so the sheet reads like the paper one it replaces. Removing a can lives behind the
 * row's three-dots button rather than on the row itself, so it takes a deliberate second tap.
 *
 * The column captures kilograms rather than the litres the Figma frame shows: the gate weighs
 * cans, the service takes `quantityKg`, and it derives litres itself from the centre's configured
 * density — a figure the API does not publish, so the screen cannot convert faithfully.
 */
export function CanRow({
  entry,
  index,
  placeholder,
  errors,
  disabled,
  onChange,
  onRemove,
}: {
  entry: CanEntry;
  index: number;
  placeholder: string;
  errors?: CanEntryErrors;
  disabled: boolean;
  onChange: (entry: CanEntry) => void;
  onRemove: () => void;
}) {
  const invalid = Boolean(errors?.label || errors?.quantityKg);
  const empty = isBlank(entry);
  const labelId = `can-${entry.id}-label`;
  const kgId = `can-${entry.id}-kg`;
  const errorId = `can-${entry.id}-error`;

  const [sheetOpen, setSheetOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const labelInput = useRef<HTMLInputElement>(null);

  const kg = parseKg(entry.quantityKg);
  const rowTitle = entry.label.trim() === "" ? `Can ${index + 1}` : entry.label.trim();

  const closeSheet = () => {
    setSheetOpen(false);
    menuButton.current?.focus();
  };

  return (
    <div className={`canrow${invalid ? " canrow--invalid" : ""}`}>
      <span className="canrow__icon">{empty ? <PlusIcon /> : <DropletIcon />}</span>

      <span className="canrow__field">
        <label className="microlabel" htmlFor={labelId}>
          Can label
        </label>
        <input
          id={labelId}
          ref={labelInput}
          value={entry.label}
          disabled={disabled}
          placeholder={placeholder}
          aria-invalid={Boolean(errors?.label) || undefined}
          aria-describedby={errors?.label ? errorId : undefined}
          onChange={(event) => onChange({ ...entry, label: event.target.value })}
        />
      </span>

      <span className="canrow__field canrow__field--kg">
        <label className="microlabel" htmlFor={kgId}>
          Kilograms
        </label>
        <input
          id={kgId}
          value={entry.quantityKg}
          disabled={disabled}
          inputMode="decimal"
          placeholder="0.0"
          aria-invalid={Boolean(errors?.quantityKg) || undefined}
          aria-describedby={errors?.quantityKg ? errorId : undefined}
          onChange={(event) => onChange({ ...entry, quantityKg: event.target.value })}
        />
      </span>

      <button
        ref={menuButton}
        type="button"
        className="canrow__menu"
        onClick={() => setSheetOpen(true)}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={sheetOpen}
        title={`Actions for can ${index + 1}`}
      >
        <MoreIcon />
        <span className="sr-only">Actions for can {index + 1}</span>
      </button>

      {invalid ? (
        <p className="canrow__error" id={errorId}>
          <WarningIcon />
          <span>{errors?.label ?? errors?.quantityKg}</span>
        </p>
      ) : null}

      {sheetOpen ? (
        <CanActionSheet
          rowTitle={rowTitle}
          amount={kg === null ? "No weight yet" : `${kg.toFixed(1)} kg`}
          onEdit={() => {
            setSheetOpen(false);
            labelInput.current?.focus();
            labelInput.current?.select();
          }}
          onDelete={() => {
            setSheetOpen(false);
            onRemove();
          }}
          onClose={closeSheet}
        />
      ) : null}
    </div>
  );
}
