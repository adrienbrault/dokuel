export type AtmosphereCue =
  | "place"
  | "erase"
  | "note"
  | "hint"
  | "conflict"
  | "complete";

export type AtmosphereMood = "menu" | "game";

export type AtmosphereEvent =
  | { kind: "cue"; cue: AtmosphereCue }
  | { kind: "mood"; mood: AtmosphereMood };

export type RingHue = "accent" | "danger" | "gold";

export type AtmosphereRing = { strength: number; hue: RingHue };

export type AtmosphereState = {
  mood: AtmosphereMood;
  /** Steady ambient intensity the scene drifts toward. */
  ambient: number;
  /** Transient intensity from cues, decays back to 0. */
  energy: number;
  /** Camera trauma, decays fast. */
  shake: number;
  /** Full-screen tint pulse, decays fast. */
  flash: number;
  flashHue: RingHue;
  /** Sustained celebration after completion. */
  victory: number;
};

type Listener = (event: AtmosphereEvent) => void;

const listeners = new Set<Listener>();

export function subscribeAtmosphere(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitAtmosphere(event: AtmosphereEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      // A broken atmosphere listener must never break gameplay input.
    }
  }
}

const AMBIENT_BY_MOOD: Record<AtmosphereMood, number> = {
  menu: 0.35,
  game: 0.55,
};

/** How many rings the queue holds when nothing drains it (a stalled
 *  renderer would otherwise grow it forever). */
const MAX_RINGS = 12;

const decay = (value: number, dt: number, timeConstant: number): number =>
  value * Math.exp(-dt / timeConstant);

/** One-pole lerp toward a target, frame-rate independent. */
const approach = (
  value: number,
  target: number,
  dt: number,
  timeConstant: number,
): number => target + (value - target) * Math.exp(-dt / timeConstant);

const CUE_EFFECTS: Record<
  AtmosphereCue,
  {
    energy: number;
    shake: number;
    flash: number;
    flashHue: RingHue;
    victory: number;
    rings: AtmosphereRing[];
  }
> = {
  place: {
    energy: 0.3,
    shake: 0,
    flash: 0,
    flashHue: "accent",
    victory: 0,
    rings: [{ strength: 0.5, hue: "accent" }],
  },
  erase: {
    energy: 0.2,
    shake: 0,
    flash: 0,
    flashHue: "accent",
    victory: 0,
    rings: [{ strength: 0.35, hue: "accent" }],
  },
  note: {
    energy: 0.15,
    shake: 0,
    flash: 0,
    flashHue: "accent",
    victory: 0,
    rings: [{ strength: 0.25, hue: "accent" }],
  },
  hint: {
    energy: 0.35,
    shake: 0,
    flash: 0.3,
    flashHue: "gold",
    victory: 0,
    rings: [{ strength: 0.6, hue: "gold" }],
  },
  conflict: {
    energy: 0.25,
    shake: 0.6,
    flash: 1,
    flashHue: "danger",
    victory: 0,
    rings: [{ strength: 0.4, hue: "danger" }],
  },
  complete: {
    energy: 1,
    shake: 0.8,
    flash: 1,
    flashHue: "gold",
    victory: 1,
    rings: [
      { strength: 1, hue: "gold" },
      { strength: 0.7, hue: "gold" },
      { strength: 0.5, hue: "accent" },
    ],
  },
};

export type AtmosphereDirector = {
  read(): AtmosphereState;
  apply(event: AtmosphereEvent): void;
  tick(seconds: number): void;
  /** Drains queued rings for the scene to spawn. */
  takeRings(): AtmosphereRing[];
};

export function createAtmosphereDirector(): AtmosphereDirector {
  const state: AtmosphereState = {
    mood: "menu",
    ambient: AMBIENT_BY_MOOD.menu,
    energy: 0,
    shake: 0,
    flash: 0,
    flashHue: "accent",
    victory: 0,
  };
  let rings: AtmosphereRing[] = [];
  // Victory rides a hold window through the celebration, then eases off.
  let victoryHold = 0;
  const VICTORY_HOLD_SECONDS = 1.8;

  return {
    read: () => ({ ...state }),
    apply: (event) => {
      if (event.kind === "mood") {
        state.mood = event.mood;
        return;
      }
      const cue = CUE_EFFECTS[event.cue];
      state.energy = Math.min(1, state.energy + cue.energy);
      state.shake = Math.max(state.shake, cue.shake);
      state.flash = Math.max(state.flash, cue.flash);
      state.flashHue = cue.flashHue;
      if (cue.victory > state.victory) {
        state.victory = cue.victory;
        victoryHold = VICTORY_HOLD_SECONDS;
      }
      rings = [...rings, ...cue.rings].slice(-MAX_RINGS);
    },
    tick: (seconds) => {
      const dt = Math.max(0, seconds);
      state.ambient = approach(
        state.ambient,
        AMBIENT_BY_MOOD[state.mood],
        dt,
        0.8,
      );
      state.energy = decay(state.energy, dt, 0.7);
      state.shake = decay(state.shake, dt, 0.35);
      state.flash = decay(state.flash, dt, 0.5);
      if (victoryHold > 0) {
        victoryHold = Math.max(0, victoryHold - dt);
      } else {
        state.victory = decay(state.victory, dt, 1.6);
      }
    },
    takeRings: () => {
      const drained = rings;
      rings = [];
      return drained;
    },
  };
}
