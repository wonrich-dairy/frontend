import { DropletIcon, PlusIcon, TrashIcon, WarningIcon } from "../../components/icons";
import type { CanEntry, CanEntryErrors } from "./canSheet";
import { isBlank } from "./canSheet";

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

  return (
    <div className={`canrow${invalid ? " canrow--invalid" : ""}`}>
      <span className="canrow__icon">{empty ? <PlusIcon /> : <DropletIcon />}</span>

      <span className="canrow__field">
        <label className="microlabel" htmlFor={labelId}>
          Can label
        </label>
        <input
          id={labelId}
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
        type="button"
        className="canrow__menu"
        onClick={onRemove}
        disabled={disabled}
        title={`Remove can ${index + 1}`}
      >
        <TrashIcon />
        <span className="sr-only">Remove can {index + 1}</span>
      </button>

      {invalid ? (
        <p className="canrow__error" id={errorId}>
          <WarningIcon />
          <span>{errors?.label ?? errors?.quantityKg}</span>
        </p>
      ) : null}
    </div>
  );
}
