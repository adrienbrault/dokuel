import { readJson, writeJson } from "./storage.ts";
import type { HintTechnique } from "./types.ts";

export type TechniqueProgress = {
  attempts: number;
  solved: number;
};

export type TechniqueProgressMap = Record<HintTechnique, TechniqueProgress>;

const STORAGE_KEY = "sudoku_learning_progress";
const TECHNIQUES: readonly HintTechnique[] = [
  "naked-single",
  "hidden-single",
  "locked-candidates",
  "naked-pair",
  "hidden-pair",
  "naked-triple",
  "hidden-triple",
  "naked-quad",
  "hidden-quad",
  "x-wing",
  "xy-wing",
  "swordfish",
  "mistake",
  "reveal",
];

function emptyProgress(): TechniqueProgressMap {
  const progress = {} as TechniqueProgressMap;
  for (const technique of TECHNIQUES) {
    progress[technique] = { attempts: 0, solved: 0 };
  }
  return progress;
}

function validProgress(value: unknown): TechniqueProgressMap | null {
  if (typeof value !== "object" || value === null) return null;
  const source = value as Record<string, unknown>;
  const progress = emptyProgress();
  for (const technique of TECHNIQUES) {
    const entry = source[technique];
    if (entry === undefined) continue;
    if (typeof entry !== "object" || entry === null) return null;
    const { attempts, solved } = entry as Record<string, unknown>;
    if (
      typeof attempts !== "number" ||
      !Number.isSafeInteger(attempts) ||
      attempts < 0 ||
      typeof solved !== "number" ||
      !Number.isSafeInteger(solved) ||
      solved < 0 ||
      solved > attempts
    ) {
      return null;
    }
    progress[technique] = { attempts, solved };
  }
  return progress;
}

export function getTechniqueProgress(): TechniqueProgressMap {
  return readJson(STORAGE_KEY, emptyProgress(), validProgress) ?? emptyProgress();
}

export function recordTechniquePractice(
  technique: HintTechnique,
  solved: boolean,
): void {
  const progress = getTechniqueProgress();
  const current = progress[technique];
  if (!current) return;
  progress[technique] = {
    attempts: current.attempts + 1,
    solved: current.solved + (solved ? 1 : 0),
  };
  writeJson(STORAGE_KEY, progress);
}
