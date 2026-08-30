import { ALCOHOL_STAGES, type AlcoholStage, type StageOutcome } from "../../api/qualityTests";

/**
 * The alcohol cascade as the officer works through it at the bench: 80% first, and a gentler
 * challenge only when the sample clotted at the one before.
 *
 * A sample that does not clot is stable at that strength, and every remaining rung is gentler, so
 * the result there is a foregone conclusion — running it would waste reagent and the officer's
 * time. The service replays the same rule and discards anything recorded past the first negative,
 * so what this decides to ask and what the service is willing to store agree.
 */

export type CascadeAnswers = Partial<Record<AlcoholStage, StageOutcome>>;

/** How the design words the two outcomes: a clotted sample is a failed stage. */
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

/**
 * The stages worth showing: everything answered so far, plus the next one to ask. A stage is only
 * asked once the one before it clotted.
 */
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

/** The stage the officer still has to answer, or null when the cascade has run its course. */
export function nextUnanswered(answers: CascadeAnswers): AlcoholStage | null {
  return visibleStages(answers).find((stage) => answers[stage] === undefined) ?? null;
}

/** The cascade is done once a stage came back negative, or boiling has been answered either way. */
export function isComplete(answers: CascadeAnswers): boolean {
  return nextUnanswered(answers) === null;
}

/**
 * Only the stages the cascade actually ran. Answering 80% negative after having clotted through
 * to boiling would otherwise leave stale answers behind that the service would discard anyway.
 */
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

/** Answering a stage clears anything below it, which the earlier answer no longer justifies. */
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

/**
 * Clotting all the way through boiling curdles the milk, which the service refuses to accept —
 * the screen says so rather than letting the officer choose.
 */
export function forcesRejection(answers: CascadeAnswers): boolean {
  return answers.ClotOnBoiling === "Positive";
}
