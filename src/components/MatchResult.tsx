import { useDialogFocus } from "../hooks/useDialogFocus.ts";
import {
  DIFFICULTY_BADGE_CLASSES,
  DIFFICULTY_LABELS,
  DIFFICULTY_OPTIONS,
} from "../lib/constants.ts";
import type { RoomScore } from "../lib/multiplayer-stats.ts";
import type { Difficulty } from "../lib/types.ts";
import { SlidingRadioGroup } from "./SlidingRadioGroup.tsx";

/**
 * Where the rematch stands from our side: nobody asked yet, we asked
 * and wait on the opponent, or the opponent asked and waits on us.
 */
export type RematchState = "idle" | "waiting" | "invited";

type MatchResultProps = {
  won: boolean;
  opponentName: string;
  /** Our finish time, null when the opponent won before we finished. */
  time: string | null;
  /** How much of our board we filled; shown when there is no time. */
  progressPercent: number;
  /** The difficulty of the game that just ended. */
  difficulty: Difficulty;
  score: RoomScore;
  /** The difficulty the rematch will be dealt on. */
  nextDifficulty: Difficulty;
  /** Host only: omitted, the next difficulty is shown read-only. */
  onNextDifficultyChange?: ((level: Difficulty) => void) | undefined;
  rematch: RematchState;
  /** The opponent's presence is gone, so a rematch may never come. */
  opponentAway: boolean;
  onRematch: () => void;
  /** Omitted, the modal offers no replay. */
  onWatchReplay?: (() => void) | undefined;
  /** Offered to a player who lost before finishing their own board. */
  onKeepSolving?: (() => void) | undefined;
  onLeave: () => void;
};

/**
 * The end of one game in a multiplayer room, built around getting both
 * players into the next one: the score so far, the rematch handshake,
 * and the next game's difficulty, without leaving the room.
 */
export function MatchResult({
  won,
  opponentName,
  time,
  progressPercent,
  difficulty,
  score,
  nextDifficulty,
  onNextDifficultyChange,
  rematch,
  opponentAway,
  onRematch,
  onWatchReplay,
  onKeepSolving,
  onLeave,
}: MatchResultProps) {
  const { panelRef, trapTab } = useDialogFocus();
  const opponent = opponentName || "Opponent";

  return (
    <div className="modal-overlay p-6">
      {won && (
        <div className="confetti-container">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      )}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="match-result-title"
        onKeyDown={trapTab}
        ref={panelRef}
        className="modal-panel gap-4 max-w-sm sm:max-w-md w-full relative"
      >
        <div className="flex flex-col items-center gap-2">
          <span
            className={`flex items-center justify-center w-14 h-14 rounded-full text-3xl animate-emoji-bounce ${
              won ? "bg-accent-light" : "bg-bg-inset"
            }`}
          >
            {won ? "🎉" : "👏"}
          </span>
          <h2 id="match-result-title" className="heading">
            {won ? "You won!" : `${opponent} won`}
          </h2>
          <span
            className={`text-xs font-bold px-3 py-1 rounded-full ${DIFFICULTY_BADGE_CLASSES[difficulty]}`}
          >
            {DIFFICULTY_LABELS[difficulty]}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5 w-full text-center">
          <div className="flex flex-col justify-center gap-1 rounded-2xl bg-bg-inset py-3">
            <span className="text-3xl font-mono font-extrabold tabular-nums text-text-primary leading-none">
              {time ?? <span>{progressPercent}%</span>}
            </span>
            <span className="text-xs text-text-muted">
              {time ? "Your time" : "Solved"}
            </span>
          </div>
          <div
            role="group"
            aria-label="Score"
            className="flex flex-col justify-center gap-1 rounded-2xl bg-bg-inset py-3"
          >
            <span className="text-3xl font-mono font-extrabold tabular-nums text-text-primary leading-none">
              {score.wins}–{score.losses}
            </span>
            <span className="text-xs text-text-muted truncate px-2">
              You vs {opponent}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2 w-full">
          {onNextDifficultyChange ? (
            <>
              <span className="label">Next game</span>
              <SlidingRadioGroup
                options={DIFFICULTY_OPTIONS}
                value={nextDifficulty}
                onChange={onNextDifficultyChange}
                name="next-difficulty"
                ariaLabel="Next game difficulty"
              />
            </>
          ) : (
            <p className="caption text-center">
              Next game:{" "}
              <span className="font-semibold text-text-primary">
                {DIFFICULTY_LABELS[nextDifficulty]}
              </span>
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3 w-full">
          {rematch === "invited" && (
            <p className="text-sm font-semibold text-accent text-center animate-modal-content">
              {opponent} wants a rematch!
            </p>
          )}
          <button
            type="button"
            className="btn btn-primary w-full py-3 text-lg"
            onClick={onRematch}
            disabled={rematch === "waiting"}
          >
            {rematch === "waiting"
              ? `Waiting for ${opponent}…`
              : rematch === "invited"
                ? "Accept rematch"
                : "Rematch"}
          </button>
          {rematch === "waiting" && opponentAway && (
            <p className="caption text-center -mt-1">
              {opponent} seems to have left the room.
            </p>
          )}
          {onKeepSolving && (
            <button
              type="button"
              className="btn btn-secondary w-full py-3 text-lg"
              onClick={onKeepSolving}
            >
              Keep solving
            </button>
          )}
          {onWatchReplay && (
            <button
              type="button"
              className="btn btn-secondary w-full py-3 text-lg"
              onClick={onWatchReplay}
            >
              Watch Replay
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost w-full py-2"
            onClick={onLeave}
          >
            Leave room
          </button>
        </div>
      </div>
    </div>
  );
}
