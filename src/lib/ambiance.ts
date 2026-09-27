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

type Listener = (event: AmbianceEvent) => void;

export type AmbianceChannel = {
  emit: (event: AmbianceEvent) => void;
  subscribe: (listener: Listener) => () => void;
};

export function createAmbianceChannel(): AmbianceChannel {
  const listeners = new Set<Listener>();
  return {
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
