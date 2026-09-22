import { useState } from "react";
import { useSession } from "../../../auth/sessionStore";
import {
  recordSensory,
  updateSensory,
  SENSORY_GRADES,
  type SensoryEvaluationDto,
  type SensoryGrade,
} from "../../../api/qualityLab/sensory";
import { type ProductLine, isFermented } from "../../../api/qualityLab/panels";
import "./SensoryEvaluationForm.css";

interface Props {
  batchCode: string;
  productLine: ProductLine;
  existing: SensoryEvaluationDto | null;
  onComplete: () => void;
}

interface AttributeState {
  grade: SensoryGrade | "";
  note: string;
}

const ATTRIBUTES = ["taste", "smell", "colour", "appearance"] as const;

export function SensoryEvaluationForm({ batchCode, productLine, existing, onComplete }: Props) {
  const { session } = useSession();
  const token = session?.accessToken ?? null;
  const fermented = isFermented(productLine);
  const isUpdate = existing !== null;
  const locked = existing?.isLocked ?? false;

  const init = (attr: string): AttributeState => {
    if (!existing) return { grade: "", note: "" };
    const g = (existing as any)[attr] as SensoryGrade;
    const n = (existing as any)[`${attr}Note`] as string | null;
    return { grade: g, note: n ?? "" };
  };

  const [taste, setTaste] = useState<AttributeState>(init("taste"));
  const [smell, setSmell] = useState<AttributeState>(init("smell"));
  const [colour, setColour] = useState<AttributeState>(init("colour"));
  const [appearance, setAppearance] = useState<AttributeState>(init("appearance"));
  const [texture, setTexture] = useState<AttributeState>(init("texture"));

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const fields: Record<string, [AttributeState, (s: AttributeState) => void]> = {
    taste: [taste, setTaste],
    smell: [smell, setSmell],
    colour: [colour, setColour],
    appearance: [appearance, setAppearance],
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    setSuccess(false);

    const body: any = {};
    for (const attr of ATTRIBUTES) {
      const [state] = fields[attr];
      body[attr] = state.grade;
      if (state.note) body[`${attr}Note`] = state.note;
    }
    if (fermented) {
      body.texture = texture.grade;
      if (texture.note) body.textureNote = texture.note;
    }

    try {
      if (isUpdate) {
        await updateSensory(batchCode, body, token);
      } else {
        await recordSensory(batchCode, body, token);
      }
      setSuccess(true);
      onComplete();
    } catch (err: any) {
      setError(err.message ?? "Failed to save sensory evaluation.");
    } finally {
      setSubmitting(false);
    }
  };

  const renderAttribute = (label: string, key: string, state: AttributeState, setter: (s: AttributeState) => void) => {
    const needsNote = state.grade && state.grade !== "Acceptable";
    return (
      <div className="sensory-form__attribute" key={key}>
        <label className="sensory-form__label">{label}</label>
        <div className="sensory-form__grade-group">
          {SENSORY_GRADES.map((g) => (
            <button
              key={g}
              type="button"
              className={`sensory-form__grade-btn sensory-form__grade-btn--${g.toLowerCase()} ${state.grade === g ? "sensory-form__grade-btn--active" : ""}`}
              onClick={() => setter({ ...state, grade: g })}
              disabled={locked}
            >
              {g}
            </button>
          ))}
        </div>
        {needsNote && (
          <input
            className="sensory-form__note"
            placeholder={`Note required for ${state.grade}`}
            value={state.note}
            onChange={(e) => setter({ ...state, note: e.target.value })}
            disabled={locked}
          />
        )}
      </div>
    );
  };

  return (
    <div className="sensory-form">
      <h3 className="sensory-form__title">
        {locked ? "🔒 Sensory Evaluation (Locked)" : isUpdate ? "✏️ Edit Sensory Evaluation" : "🧪 Sensory Evaluation"}
      </h3>

      {error && <div className="sensory-form__error">{error}</div>}
      {success && <div className="sensory-form__success">✅ Sensory evaluation saved successfully.</div>}

      {renderAttribute("Taste", "taste", taste, setTaste)}
      {renderAttribute("Smell", "smell", smell, setSmell)}
      {renderAttribute("Colour", "colour", colour, setColour)}
      {renderAttribute("Appearance", "appearance", appearance, setAppearance)}
      {fermented && renderAttribute("Texture", "texture", texture, setTexture)}

      {!locked && (
        <button
          className="sensory-form__submit"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? "Saving…" : isUpdate ? "Update Evaluation" : "Record Evaluation"}
        </button>
      )}
    </div>
  );
}
