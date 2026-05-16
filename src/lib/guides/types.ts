import type { Position } from "../types.ts";

export type Level = "beginner" | "intermediate" | "advanced";

export type TechniqueId =
  | "scanning"
  | "naked-singles"
  | "hidden-singles"
  | "naked-pairs"
  | "hidden-pairs"
  | "pointing-pairs"
  | "x-wing"
  | "swordfish"
  | "y-wing";

export type HighlightKind = "unit" | "focus" | "eliminate" | "solution";

export type CellOverlay = {
  kind: HighlightKind;
  digits?: number[];
};

export type DemoStep = {
  caption: string;
  overlays: Map<number, CellOverlay[]>;
  candidates?: Map<number, Set<number>>;
  placements?: Map<number, number>;
  holdMs?: number;
};

export type Demo = {
  id: string;
  title: string;
  puzzle: string;
  initialCandidates: Map<number, Set<number>>;
  steps: DemoStep[];
};

export type GuideSection = {
  heading?: string;
  body: string;
};

export type Guide = {
  id: TechniqueId;
  title: string;
  level: Level;
  summary: string;
  sections: GuideSection[];
  demos: Demo[];
};

export type CellCoord = Position | [number, number];
