import { useDialogFocus } from "../hooks/useDialogFocus.ts";
import {
  DIFFICULTY_BADGE_CLASSES,
  DIFFICULTY_LABELS,
  DIFFICULTY_OPTIONS,
} from "../lib/constants.ts";
import type { RoomScore } from "../lib/multiplayer-stats.ts";
import { formatCredits } from "../lib/teams.ts";
import type { Credit, Difficulty } from "../lib/types.ts";
import { SlidingRadioGroup } from "./SlidingRadioGroup.tsx";

/**
 * Where the rematch stands from our side: nobody asked yet, we asked
 * and wait on the opponent, or the opponent asked and waits on us.
 */
export type RematchState = "idle" | "waiting" | "invited";

/** Everything the result needs to get both players into the next game. */
export type NextGame = {
  rematch: RematchState;
  /** The difficulty the rematch will be dealt on. */
  difficulty: Difficulty;
  /** Host only: omitted, the next difficulty is shown read-only. */
  onDifficultyChange?: ((level: Difficulty) => void) | undefined;
  onRematch: () => void;
  /** Who has yet to ask, in a room bigger than two. */
  waitingFor?: string | undefined;
  /** Who already asked, in a room bigger than two. */
  askedBy?: string | undefined;
};

type MatchResultProps = {
  won: boolean;
  /** Every other player, as one readable list. */
  opponentName: string;
  /** Who finished first; falls back to the opponent in a 1v1. */
  winnerName?: string | undefined;
  /** Our finish time, null when the opponent won before we finished. */
  time: string | null;
  /** How much of our board we filled; shown when there is no time. */
  progressPercent: number;
  /** The difficulty of the game that just ended. */
  difficulty: Difficulty;
  score: RoomScore;
  next: NextGame;
  /** The opponent's presence is gone, so a rematch may never come. */
  opponentAway: boolean;
  /** Omitted, the modal offers no replay. */
  onWatchReplay?: (() => void) | undefined;
  /** The room solved one board together: no winner, no score. */
  coop?: boolean | undefined;
  /** Each teammate's correct digits on a shared board. */
  credits?: Credit[] | undefined;
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
  winnerName,
  time,
  progressPercent,
  difficulty,
  score,
  next,
  opponentAway,
  onWatchReplay,
  onKeepSolving,
  coop = false,
  credits,
  onLeave,
}: MatchResultProps) {
  const { panelRef, trapTab } = useDialogFocus();
  const opponent = opponentName || "Opponent";
  const { rematch } = next;

  return (
    <div className="modal-overlay p-4">
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
        // Scrolls rather than clipping its title on the shortest phones.
        className="modal-panel gap-4 px-5 py-6 sm:p-8 max-w-sm sm:max-w-md w-full max-h-full overflow-y-auto relative"
      >
        <div className="flex flex-col items-center gap-2">
          <span
            className={`flex items-center justify-center w-12 h-12 rounded-full text-2xl animate-emoji-bounce ${
              won ? "bg-accent-light" : "bg-bg-inset"
            }`}
          >
            {won ? "🎉" : "👏"}
          </span>
          <h2 id="match-result-title" className="heading">
            {coop
              ? "Solved together!"
              : won
                ? "You won!"
                : `${winnerName || opponent} won`}
          </h2>
          <span
            className={`text-xs font-bold px-3 py-1 rounded-full ${DIFFICULTY_BADGE_CLASSES[difficulty]}`}
          >
            {DIFFICULTY_LABELS[difficulty]}
          </span>
        </div>

        <div
          // The credits list needs more room for names than a time does.
          className={`grid gap-2.5 w-full text-center ${coop ? "grid-cols-[2fr_3fr]" : "grid-cols-2"}`}
        >
          <div className="flex flex-col justify-center gap-1 rounded-2xl bg-bg-inset py-3">
            <span className="text-3xl font-mono font-extrabold tabular-nums text-text-primary leading-none">
              {time ?? <span>{progressPercent}%</span>}
            </span>
            <span className="text-xs text-text-muted">
              {coop ? "Time" : time ? "Your time" : "Solved"}
            </span>
          </div>
          {coop && credits ? (
            <div
              role="group"
              aria-label="Digits placed"
              className="flex flex-col justify-center gap-1 rounded-2xl bg-bg-inset py-3 px-4"
            >
              {credits.map((c) => (
                <div
                  key={c.name}
                  className="flex justify-between gap-2 text-sm"
                >
                  <span className="truncate text-text-secondary">{c.name}</span>
                  <span className="font-mono font-bold tabular-nums text-text-primary">
                    {c.count}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div
              role="group"
              aria-label="Score"
              className="flex flex-col justify-center gap-1 rounded-2xl bg-bg-inset py-3"
            >
              <span className="text-3xl font-mono font-extrabold tabular-nums text-text-primary leading-none">
                {score.wins}–{score.losses}
              </span>
              <span className="text-xs text-text-muted truncate px-2">
                vs {opponent}
              </span>
            </div>
          )}
        </div>

        {!coop && credits && (
          <p
            role="note"
            aria-label="Digits placed"
            className="caption text-center -mt-1"
          >
            {formatCredits(credits)}
          </p>
        )}

        <div className="flex flex-col gap-2 w-full">
          {next.onDifficultyChange ? (
            <>
              <span className="label">Next game</span>
              <SlidingRadioGroup
                options={DIFFICULTY_OPTIONS}
                value={next.difficulty}
                onChange={next.onDifficultyChange}
                name="next-difficulty"
                ariaLabel="Next game difficulty"
              />
            </>
          ) : (
            <p className="caption text-center">
              Next game:{" "}
              <span className="font-semibold text-text-primary">
                {DIFFICULTY_LABELS[next.difficulty]}
              </span>
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3 w-full">
          {rematch === "invited" && (
            <p className="text-sm font-semibold text-accent text-center animate-modal-content">
              {next.askedBy || opponent} wants a rematch!
            </p>
          )}
          <button
            type="button"
            className={`btn w-full py-3 text-lg ${
              rematch === "waiting"
                ? "btn-secondary text-text-secondary"
                : "btn-primary"
            }`}
            onClick={next.onRematch}
            disabled={rematch === "waiting"}
          >
            {rematch === "waiting"
              ? `Waiting for ${next.waitingFor || opponent}…`
              : rematch === "invited"
                ? "Accept rematch"
                : "Rematch"}
          </button>
          {rematch === "waiting" && opponentAway && (
            <p className="caption text-center -mt-1">
              {opponent} seems to have left the room.
            </p>
          )}
          {(onKeepSolving || onWatchReplay) && (
            <div className="flex gap-2.5 w-full">
              {onKeepSolving && (
                <button
                  type="button"
                  className="btn btn-secondary flex-1 py-2.5 px-2 text-sm whitespace-nowrap"
                  onClick={onKeepSolving}
                >
                  Keep solving
                </button>
              )}
              {onWatchReplay && (
                <button
                  type="button"
                  className="btn btn-secondary flex-1 py-2.5 px-2 text-sm whitespace-nowrap"
                  onClick={onWatchReplay}
                >
                  Watch Replay
                </button>
              )}
            </div>
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
