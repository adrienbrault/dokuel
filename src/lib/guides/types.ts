import type { Position } from "../types.ts";

export type Level = "beginner" | "intermediate" | "advanced";

export type TechniqueId =
  | "scanning"
  | "naked-singles"
  | "hidden-singles"
  | "naked-pairs"
  | "hidden-pairs"
  | "naked-triples"
  | "hidden-triples"
  | "pointing-pairs"
  | "claiming"
  | "x-wing"
  | "swordfish"
  | "jellyfish"
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

export type ChallengeQuestion =
  | { kind: "place"; cell: Position; value: number }
  | { kind: "select-cells"; cells: Position[] }
  | { kind: "eliminate"; cell: Position; digits: number[] };

export type Challenge = {
  id: string;
  prompt: string;
  puzzle: string;
  initialCandidates: Map<number, Set<number>>;
  question: ChallengeQuestion;
  explanation: string;
};

export type Guide = {
  id: TechniqueId;
  title: string;
  level: Level;
  summary: string;
  sections: GuideSection[];
  demos: Demo[];
  challenges?: Challenge[];
};

export type CellCoord = Position | [number, number];
