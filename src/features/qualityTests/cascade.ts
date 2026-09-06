import { ALCOHOL_STAGES, type AlcoholStage, type StageOutcome } from "../../api/qualityTests";

export type CascadeAnswers = Partial<Record<AlcoholStage, StageOutcome>>;

export const OUTCOME_LABEL: Record<StageOutcome, string> = {
  Positive: "Fail",
  Negative: "Pass",
};

export const STAGE_LABEL: Record<AlcoholStage, string> = {
  Alcohol80: "80% Alcohol Test",
  Alcohol75: "75% Alcohol Test",
  Alcohol68: "68% Alcohol Test",
  ClotOnBoiling: "COB Test",
};

export function visibleStages(answers: CascadeAnswers): AlcoholStage[] {
  const visible: AlcoholStage[] = [];

  for (const stage of ALCOHOL_STAGES) {
    visible.push(stage);

    if (answers[stage] !== "Positive") {
      break;
    }
  }

  return visible;
}

export function nextUnanswered(answers: CascadeAnswers): AlcoholStage | null {
  return visibleStages(answers).find((stage) => answers[stage] === undefined) ?? null;
}

export function isComplete(answers: CascadeAnswers): boolean {
  return nextUnanswered(answers) === null;
}

export function stagesRun(answers: CascadeAnswers): CascadeAnswers {
  const run: CascadeAnswers = {};

  for (const stage of visibleStages(answers)) {
    const outcome = answers[stage];

    if (outcome !== undefined) {
      run[stage] = outcome;
    }
  }

  return run;
}

export function answerStage(
  answers: CascadeAnswers,
  stage: AlcoholStage,
  outcome: StageOutcome,
): CascadeAnswers {
  const index = ALCOHOL_STAGES.indexOf(stage);
  const kept: CascadeAnswers = {};

  for (const earlier of ALCOHOL_STAGES.slice(0, index)) {
    if (answers[earlier] !== undefined) {
      kept[earlier] = answers[earlier];
    }
  }

  kept[stage] = outcome;

  return kept;
}

export function forcesRejection(answers: CascadeAnswers): boolean {
  return answers.ClotOnBoiling === "Positive";
}
