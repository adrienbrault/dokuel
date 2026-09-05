import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getTechniqueProgress,
  recordTechniquePractice,
} from "./learning-progress.ts";

describe("learning progress", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("tracks technique practice without requiring a game time", () => {
    expect(getTechniqueProgress()["naked-single"]).toEqual({
      attempts: 0,
      solved: 0,
    });

    recordTechniquePractice("naked-single", false);
    recordTechniquePractice("naked-single", true);

    expect(getTechniqueProgress()["naked-single"]).toEqual({
      attempts: 2,
      solved: 1,
    });
  });
});
