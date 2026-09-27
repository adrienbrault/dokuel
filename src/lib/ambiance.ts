/**
 * The seam between the game and the 3D ambiance scene. Game code emits
 * what just happened on the board; the scene (lazy-loaded, WebGL, far
 * from React) subscribes and turns it into light. Nothing here knows
 * about three.js, so emitting costs nothing when the scene is off.
 */

export type AmbianceEvent =
  /** A value landed on the board. */
  | { type: "place"; row: number; col: number; digit: number }
  /** A value landed and clashes with the board (or the solution). */
  | { type: "conflict"; row: number; col: number }
  /** A row, column or box just became full and clean. */
  | { type: "unit"; kind: "row" | "col" | "box"; index: number }
  /** The opponent filled a cell on their own board. */
  | { type: "rival" }
  /** The local board is solved. */
  | { type: "victory" };

/** Menus frame the world wide; a game looks down on the board. */
export type AmbianceScene = "menu" | "game";

export type AmbianceState = {
  scene: AmbianceScene;
  /** Share of the empty cells filled so far, 0..1. */
  progress: number;
};

type Listener = (event: AmbianceEvent) => void;

export type AmbianceChannel = {
  emit: (event: AmbianceEvent) => void;
  subscribe: (listener: Listener) => () => void;
  getState: () => AmbianceState;
  setScene: (scene: AmbianceScene) => void;
  setProgress: (progress: number) => void;
};

export function createAmbianceChannel(): AmbianceChannel {
  const listeners = new Set<Listener>();
  let state: AmbianceState = { scene: "menu", progress: 0 };
  return {
    getState: () => state,
    setScene(scene) {
      // A board's progress means nothing once the player leaves it.
      state = { scene, progress: scene === "menu" ? 0 : state.progress };
    },
    setProgress(progress) {
      state = { ...state, progress };
    },
    emit(event) {
      for (const listener of listeners) listener(event);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** The app-wide channel the game emits on and the scene listens to. */
export const ambiance = createAmbianceChannel();
