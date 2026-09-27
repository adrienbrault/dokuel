import type { Color } from "three";
import { diffBoards } from "../board-events.ts";
import type { Board, Cell, CellVisual } from "../types.ts";
import {
  celebrate,
  clearBurst,
  conflictShake,
  placeBurst,
  reveal,
  unitWave,
} from "./choreography.ts";
import type { BoardScene } from "./scene.ts";
import type { BoardTheme } from "./theme.ts";
import type { Pulse, Tile } from "./tile.ts";

export type BoardSceneState = {
  board: Board;
  visuals: CellVisual[];
  completed: boolean;
  paper: boolean;
  reveal: boolean;
};

/** Beyond this many changed cells at once, a new puzzle arrived. */
const NEW_PUZZLE_THRESHOLD = 12;

function inkFor(cell: Cell, conflict: boolean, theme: BoardTheme) {
  const d = cell.value ?? 0;
  switch (theme.digitMode) {
    case "digits":
    case "colors":
      return theme.digitColors[d]!;
    case "emoji":
      return null;
    default:
      if (cell.isGiven) return theme.given;
      return conflict ? theme.conflict : theme.user;
  }
}

/** Same precedence as the DOM cell's background classes. */
function surfaceFor(v: CellVisual, paper: boolean, theme: BoardTheme) {
  if (v.isSelected || v.isMultiSelected) {
    return paper ? theme.cellBg : theme.selected;
  }
  if (v.dropTargetState === "valid") return theme.selected;
  if (v.dropTargetState === "invalid") return theme.conflictBg;
  if (v.isConflict) return theme.conflictBg;
  if (v.isHintRelated) return theme.hint;
  if (v.isSameNumber) return theme.sameNumber;
  if (v.isHighlighted) return theme.highlight;
  if (v.isSameNumberRowCol) return theme.matchRowCol;
  return theme.cellBg;
}

function liftFor(v: CellVisual, hovered: boolean, depth: number) {
  if (v.dropTargetState === "invalid") return -depth * 0.3;
  if (v.isSelected) return depth * 2.2;
  if (v.dropTargetState === "valid") return depth * 2;
  if (v.isMultiSelected) return depth * 1.4;
  if (v.isSameNumber) return depth * 0.9;
  if (hovered) return depth * 0.8;
  if (v.isHighlighted) return depth * 0.25;
  return 0;
}

function growFor(v: CellVisual, hovered: boolean) {
  if (v.isSelected) return 1.07;
  if (v.dropTargetState === "valid") return 1.06;
  if (v.isMultiSelected || hovered) return 1.03;
  return 1;
}

function pulseFor(v: CellVisual, cell: Cell, paper: boolean): Pulse {
  if (v.isSelected && !paper) return "selected";
  if (v.isConflict && cell.value !== null) return "conflict";
  if (v.isHintRelated) return "hint";
  if (v.isSameNumber) return "same";
  return "none";
}

function pulseColor(pulse: Pulse, theme: BoardTheme): Color {
  if (pulse === "conflict") return theme.conflict;
  if (pulse === "hint") return theme.hint;
  return theme.accent;
}

function paintTile(
  scene: BoardScene,
  tile: Tile,
  cell: Cell,
  v: CellVisual,
  state: BoardSceneState,
  animate: boolean,
) {
  const { theme, depth } = scene.stage;
  if (cell.value !== null) {
    const key = `${cell.value}:${cell.isGiven}`;
    if (tile.shownKey !== key) {
      tile.valueMaterial.map = scene.glyphs.value(cell.value, cell.isGiven);
      tile.valueMaterial.needsUpdate = true;
      tile.shownKey = key;
      tile.shownDigit = cell.value;
    }
    tile.pop.target = 1;
    const ink = inkFor(cell, v.isConflict, theme);
    if (ink) tile.valueMaterial.color.copy(ink);
    else tile.valueMaterial.color.setRGB(1, 1, 1);
  } else {
    tile.pop.target = 0;
  }
  tile.fade.target = v.isDragSource ? 0.3 : 1;

  const notesKey =
    cell.value === null ? [...cell.notes].sort((a, b) => a - b).join("") : "";
  if (notesKey !== tile.notesKey) {
    if (notesKey) scene.glyphs.drawNotes(tile.notesTexture, cell.notes);
    if (animate && notesKey.length > tile.notesKey.length) {
      tile.notesPop.value = 0.82;
    }
    tile.notesKey = notesKey;
  }
  tile.notes.visible = notesKey !== "";

  tile.targetColor.copy(surfaceFor(v, state.paper, theme));
  const hovered = scene.hovered === tile.index;
  tile.lift.target = liftFor(v, hovered, depth);
  tile.grow.target = growFor(v, hovered);
  tile.pulse = pulseFor(v, cell, state.paper);
  tile.pulseColor.copy(pulseColor(tile.pulse, theme));
}

/**
 * Pushes one render's worth of board state into the scene: resting
 * targets for every tile, then the one-shot effects for whatever
 * changed since the previous state.
 */
export function applyState(
  scene: BoardScene,
  state: BoardSceneState,
  animate: boolean,
) {
  const stage = scene.stage;
  const prev = scene.prev;
  let selected = -1;
  for (const tile of stage.tiles) {
    const cell = state.board[Math.floor(tile.index / 9)]![tile.index % 9]!;
    const v = state.visuals[tile.index]!;
    paintTile(scene, tile, cell, v, state, animate);
    if (v.isSelected) selected = tile.index;
  }

  const cursor = scene.cursor;
  if (selected >= 0) {
    const tile = stage.tiles[selected]!;
    if (cursor.scale.target === 0) {
      cursor.x.snap(tile.group.position.x);
      cursor.y.snap(tile.group.position.y);
    }
    cursor.x.target = tile.group.position.x;
    cursor.y.target = tile.group.position.y;
    cursor.z.target = tile.lift.target;
    cursor.scale.target = 1;
  } else {
    cursor.scale.target = 0;
  }

  if (prev === null) {
    for (const tile of stage.tiles) tile.snapAll();
    for (const s of [cursor.x, cursor.y, cursor.z, cursor.scale]) {
      s.snap(s.target);
    }
    if (state.reveal) reveal(stage);
    return;
  }
  if (!animate) return;

  const events = diffBoards(prev.board, state.board);
  if (events.placed.length + events.cleared.length > NEW_PUZZLE_THRESHOLD) {
    reveal(stage);
    return;
  }
  for (const i of events.placed) placeBurst(stage, i);
  for (const i of events.cleared) clearBurst(stage, i);
  if (state.completed && !prev.completed) {
    celebrate(stage);
  } else {
    for (const u of events.completedUnits) unitWave(stage, u);
  }
  state.visuals.forEach((v, i) => {
    const cell = state.board[Math.floor(i / 9)]![i % 9]!;
    if (v.isConflict && !prev.visuals[i]!.isConflict && cell.value !== null) {
      conflictShake(stage, i);
    }
  });
}
