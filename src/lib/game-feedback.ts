import { emitAtmosphere } from "./atmosphere.ts";
import { haptics } from "./haptics.ts";
import { sounds } from "./sounds.ts";

export type GameFeedback = {
  onPlace: () => void;
  onErase: () => void;
  onToggleNotes: () => void;
  onHint: () => void;
  onConflict: () => void;
  onComplete: () => void;
};

export const gameFeedback: GameFeedback = {
  onPlace: () => {
    haptics.tap();
    sounds.place();
    emitAtmosphere({ kind: "cue", cue: "place" });
  },
  onErase: () => {
    haptics.tap();
    sounds.erase();
    emitAtmosphere({ kind: "cue", cue: "erase" });
  },
  onToggleNotes: () => {
    haptics.light();
    sounds.note();
    emitAtmosphere({ kind: "cue", cue: "note" });
  },
  onHint: () => {
    haptics.tap();
    emitAtmosphere({ kind: "cue", cue: "hint" });
  },
  onConflict: () => {
    haptics.conflict();
    sounds.conflict();
    emitAtmosphere({ kind: "cue", cue: "conflict" });
  },
  onComplete: () => {
    haptics.success();
    sounds.complete();
    emitAtmosphere({ kind: "cue", cue: "complete" });
  },
};
