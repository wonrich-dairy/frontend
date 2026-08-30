import { KQ_COLOURS, type KqColour } from "../../api/qualityTests";

/**
 * The KQ card the officer holds against the sample. The dye keeps its colour in fresh milk and is
 * reduced through to white as microbial activity rises, so the scale runs best to worst.
 *
 * The order is the service's enum order, not the swatch order drawn in Figma: the numeric values
 * are stored against panels and compared across checkpoints, so the shade in position five has to
 * be the shade the service calls position five.
 */
const SHADES: Record<KqColour, { swatch: string; grade: string }> = {
  Blue: { swatch: "#3b82f6", grade: "Excellent" },
  LightBlue: { swatch: "#60a5fa", grade: "Very Good" },
  Purple: { swatch: "#a855f7", grade: "Good" },
  PurplePink: { swatch: "#d946ef", grade: "Fair" },
  LightPink: { swatch: "#f9a8d4", grade: "Poor" },
  Pink: { swatch: "#ec4899", grade: "Very Poor" },
  White: { swatch: "#ffffff", grade: "Fail" },
};

export function KqScaleCard({
  selected,
  disabled,
  error,
  onSelect,
}: {
  selected: KqColour | null;
  disabled: boolean;
  error?: string;
  onSelect: (colour: KqColour) => void;
}) {
  return (
    <section className="card" aria-label="KQ test">
      <h3 className="card__title">KQ Test</h3>

      <div className="kqgrid" role="radiogroup" aria-label="KQ shade">
        {KQ_COLOURS.map((colour) => {
          const shade = SHADES[colour];

          return (
            <button
              key={colour}
              type="button"
              role="radio"
              aria-checked={selected === colour}
              className={`kqswatch${selected === colour ? " kqswatch--chosen" : ""}`}
              disabled={disabled}
              onClick={() => onSelect(colour)}
            >
              <span className="kqswatch__colour" style={{ background: shade.swatch }} />
              <span className="kqswatch__grade">{shade.grade}</span>
            </button>
          );
        })}
      </div>

      {error ? (
        <p className="card__error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
