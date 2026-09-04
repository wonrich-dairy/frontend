import { describe, expect, it } from "vitest";
import {
  answerStage,
  forcesRejection,
  isComplete,
  nextUnanswered,
  stagesRun,
  visibleStages,
  type CascadeAnswers,
} from "./cascade";

describe("which stage the officer is asked next", () => {
  it("starts at 80%, the harshest challenge", () => {
    expect(visibleStages({})).toEqual(["Alcohol80"]);
    expect(nextUnanswered({})).toBe("Alcohol80");
  });

  it("stops there when the sample does not clot", () => {
    const answers: CascadeAnswers = { Alcohol80: "Negative" };

    expect(visibleStages(answers)).toEqual(["Alcohol80"]);
    expect(isComplete(answers)).toBe(true);
  });

  it("steps down to 75% only once 80% has clotted", () => {
    const answers: CascadeAnswers = { Alcohol80: "Positive" };

    expect(visibleStages(answers)).toEqual(["Alcohol80", "Alcohol75"]);
    expect(nextUnanswered(answers)).toBe("Alcohol75");
    expect(isComplete(answers)).toBe(false);
  });

  it("works down to boiling when every alcohol stage clots", () => {
    const answers: CascadeAnswers = {
      Alcohol80: "Positive",
      Alcohol75: "Positive",
      Alcohol68: "Positive",
    };

    expect(visibleStages(answers)).toEqual([
      "Alcohol80",
      "Alcohol75",
      "Alcohol68",
      "ClotOnBoiling",
    ]);
    expect(nextUnanswered(answers)).toBe("ClotOnBoiling");
  });

  it("is finished once boiling has been answered, either way", () => {
    const clotted: CascadeAnswers = {
      Alcohol80: "Positive",
      Alcohol75: "Positive",
      Alcohol68: "Positive",
      ClotOnBoiling: "Positive",
    };

    expect(isComplete(clotted)).toBe(true);
    expect(isComplete({ ...clotted, ClotOnBoiling: "Negative" })).toBe(true);
  });
});

describe("what is sent to the service", () => {
  it("sends only the stages the cascade actually ran", () => {
    const answers: CascadeAnswers = { Alcohol80: "Negative", Alcohol75: "Positive" };

    expect(stagesRun(answers)).toEqual({ Alcohol80: "Negative" });
  });

  it("sends the whole ladder when the sample clotted throughout", () => {
    const answers: CascadeAnswers = {
      Alcohol80: "Positive",
      Alcohol75: "Positive",
      Alcohol68: "Positive",
      ClotOnBoiling: "Positive",
    };

    expect(stagesRun(answers)).toEqual(answers);
  });
});

describe("changing an answer", () => {
  it("clears the stages the earlier answer no longer justifies", () => {
    const answers: CascadeAnswers = {
      Alcohol80: "Positive",
      Alcohol75: "Positive",
      Alcohol68: "Negative",
    };

    expect(answerStage(answers, "Alcohol80", "Negative")).toEqual({ Alcohol80: "Negative" });
  });

  it("keeps the stages above the one being answered", () => {
    const answers: CascadeAnswers = { Alcohol80: "Positive", Alcohol75: "Positive" };

    expect(answerStage(answers, "Alcohol75", "Negative")).toEqual({
      Alcohol80: "Positive",
      Alcohol75: "Negative",
    });
  });
});

describe("clot on boiling", () => {
  it("forces a rejection, because the milk is already curdled", () => {
    expect(forcesRejection({ ClotOnBoiling: "Positive" })).toBe(true);
    expect(forcesRejection({ ClotOnBoiling: "Negative" })).toBe(false);
    expect(forcesRejection({ Alcohol80: "Positive" })).toBe(false);
  });
});
