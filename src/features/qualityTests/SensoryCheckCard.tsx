export function SensoryCheckCard({
  smellOk,
  colourOk,
  tasteOk,
  disabled,
  onChange,
}: {
  smellOk: boolean;
  colourOk: boolean;
  tasteOk: boolean;
  disabled: boolean;
  onChange: (patch: { smellOk?: boolean; colourOk?: boolean; tasteOk?: boolean }) => void;
}) {
  return (
    <section className="card" aria-label="Sensory check">
      <h3 className="card__title">Sensory Check</h3>

      <Sense
        id="smell"
        label="Smell OK"
        checked={smellOk}
        disabled={disabled}
        onChange={(value) => onChange({ smellOk: value })}
      />
      <Sense
        id="colour"
        label="Colour OK"
        checked={colourOk}
        disabled={disabled}
        onChange={(value) => onChange({ colourOk: value })}
      />
      <Sense
        id="taste"
        label="Taste OK"
        checked={tasteOk}
        disabled={disabled}
        onChange={(value) => onChange({ tasteOk: value })}
      />
    </section>
  );
}

function Sense({
  id,
  label,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className={`sense${checked ? "" : " sense--failed"}`}>
      <label className="sense__label" htmlFor={`sense-${id}`}>
        {label}
      </label>

      <input
        id={`sense-${id}`}
        className="sense__toggle"
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
    </div>
  );
}
