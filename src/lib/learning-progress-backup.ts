import {
  getTechniqueProgress,
  type TechniqueProgressMap,
} from "./learning-progress.ts";
import { writeJson } from "./storage.ts";
import type { HintTechnique } from "./types.ts";

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

export function exportLearningProgress(): TechniqueProgressMap {
  return cloneProgress(getTechniqueProgress());
}

export function validateLearningProgress(
  value: unknown,
): TechniqueProgressMap | null {
  const parsed = typeof value === "string" ? parseJson(value) : value;
  if (!isRecord(parsed)) return null;
  const progress = {} as TechniqueProgressMap;
  for (const key of Object.keys(parsed)) {
    if (!TECHNIQUES.includes(key as HintTechnique)) return null;
  }
  for (const technique of TECHNIQUES) {
    const entry = parsed[technique];
    if (!isRecord(entry)) return null;
    const attempts = entry.attempts;
    const solved = entry.solved;
    if (!isCount(attempts) || !isCount(solved) || solved > attempts) {
      return null;
    }
    progress[technique] = { attempts, solved };
  }
  return progress;
}

export function importLearningProgress(value: unknown): boolean {
  const progress = validateLearningProgress(value);
  return progress ? writeJson(STORAGE_KEY, progress) : false;
}

function cloneProgress(progress: TechniqueProgressMap): TechniqueProgressMap {
  const clone = {} as TechniqueProgressMap;
  for (const technique of TECHNIQUES) {
    clone[technique] = { ...progress[technique] };
  }
  return clone;
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
