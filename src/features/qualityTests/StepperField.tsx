import { MinusIcon, PlusIcon, WarningIcon } from "../../components/icons";

/**
 * A reading entered with the stepper the design uses, or typed straight in. The officer is at a
 * bench with wet hands, so nudging by a step is the primary gesture; the field stays editable for
 * anyone who would rather type the number.
 */
export function StepperField({
  id,
  label,
  value,
  step,
  min,
  max,
  error,
  warning,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  step: number;
  min: number;
  max: number;
  error?: string;
  /** The service's word for a reading that is out of range but still enterable, e.g. "Low". */
  warning?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const nudge = (by: number) => {
    const current = Number(value.trim() === "" ? 0 : value);
    const next = Number.isFinite(current) ? current + by : 0;
    const clamped = Math.min(max, Math.max(min, next));

    // Steps are tenths, and floating point would otherwise show 4.199999999999999.
    onChange(clamped.toFixed(decimalsIn(step)));
  };

  const flagged = Boolean(error) || Boolean(warning);

  return (
    <div className={`stepper${flagged ? " stepper--flagged" : ""}`}>
      <div className="stepper__head">
        <label className="stepper__label" htmlFor={id}>
          {label}
        </label>
        {warning ? (
          <span className="stepper__warning">
            <WarningIcon width={13} height={13} />
            {warning}
          </span>
        ) : null}
      </div>

      <div className="stepper__control">
        <button
          type="button"
          className="stepper__button"
          onClick={() => nudge(-step)}
          disabled={disabled}
          aria-label={`Decrease ${label}`}
        >
          <MinusIcon />
        </button>

        <input
          id={id}
          className="stepper__value"
          value={value}
          inputMode="decimal"
          disabled={disabled}
          placeholder="0.0"
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => onChange(event.target.value)}
        />

        <button
          type="button"
          className="stepper__button"
          onClick={() => nudge(step)}
          disabled={disabled}
          aria-label={`Increase ${label}`}
        >
          <PlusIcon />
        </button>
      </div>

      {error ? (
        <p className="stepper__error" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

function decimalsIn(step: number): number {
  const text = String(step);
  const point = text.indexOf(".");

  return point === -1 ? 0 : text.length - point - 1;
}
