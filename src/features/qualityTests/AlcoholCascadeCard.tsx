import { ALCOHOL_STAGES, type AlcoholStage, type StageOutcome } from "../../api/qualityTests";
import { STAGE_LABEL, visibleStages, type CascadeAnswers } from "./cascade";

export function AlcoholCascadeCard({
  answers,
  disabled,
  error,
  onAnswer,
}: {
  answers: CascadeAnswers;
  disabled: boolean;
  error?: string;
  onAnswer: (stage: AlcoholStage, outcome: StageOutcome) => void;
}) {
  const asked = visibleStages(answers);

  return (
    <section className="card" aria-label="Alcohol test cascade">
      <h3 className="card__title">Alcohol Test Cascade</h3>

      {ALCOHOL_STAGES.map((stage) => {
        const active = asked.includes(stage);
        const answer = answers[stage];

        return (
          <div
            key={stage}
            className={`cascaderow${active ? "" : " cascaderow--waiting"}${
              answer === "Positive" ? " cascaderow--failed" : ""
            }`}
          >
            <span className="cascaderow__label" id={`stage-${stage}`}>
              {STAGE_LABEL[stage]}
            </span>

            <div className="cascaderow__choices" role="group" aria-labelledby={`stage-${stage}`}>
              <Choice
                stage={stage}
                outcome="Positive"
                label="Fail"
                chosen={answer === "Positive"}
                disabled={disabled || !active}
                onAnswer={onAnswer}
              />
              <Choice
                stage={stage}
                outcome="Negative"
                label="Pass"
                chosen={answer === "Negative"}
                disabled={disabled || !active}
                onAnswer={onAnswer}
              />
            </div>
          </div>
        );
      })}

      {error ? (
        <p className="card__error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function Choice({
  stage,
  outcome,
  label,
  chosen,
  disabled,
  onAnswer,
}: {
  stage: AlcoholStage;
  outcome: StageOutcome;
  label: string;
  chosen: boolean;
  disabled: boolean;
  onAnswer: (stage: AlcoholStage, outcome: StageOutcome) => void;
}) {
  return (
    <button
      type="button"
      className={`choice choice--${label.toLowerCase()}${chosen ? " choice--chosen" : ""}`}
      aria-pressed={chosen}
      disabled={disabled}
      onClick={() => onAnswer(stage, outcome)}
    >
      {label}
      <span className="sr-only"> {STAGE_LABEL[stage]}</span>
    </button>
  );
}
