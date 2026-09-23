import { useEffect, useRef } from "react";
import { type ReplayFrame, recordFrame } from "../lib/replay.ts";
import { parsePuzzle } from "../lib/sudoku.ts";
import type { Board } from "../lib/types.ts";

type Options = {
  puzzle: string;
  board: Board;
  /** Bumps on every new game; a new game starts a new recording. */
  gameNumber: number;
  /**
   * Game time already on the clock when this component mounted, for a
   * game resumed after a reload. Only the first game reads it: a
   * rematch always starts from zero.
   */
  startOffsetMs: number;
  /** Whether the recording may leave this client yet. */
  share: boolean;
  /** Receives the whole recording, again after every change while sharing. */
  onShare: (frames: ReplayFrame[]) => void;
  now?: () => number;
};

function matchesPuzzle(board: Board, puzzle: string): boolean {
  return board.every((row, r) =>
    row.every((cell, c) => cell.isGiven === (puzzle[r * 9 + c] !== ".")),
  );
}

/**
 * Keeps a replay of the local player's board. It records board states,
 * not actions, so it needs nothing from the reducer: every change the
 * player sees becomes a frame. A board resumed from autosave lands as
 * one frame at the resume instant, since the moves before the reload
 * were never seen.
 */
export function useReplayRecorder({
  puzzle,
  board,
  gameNumber,
  startOffsetMs,
  share,
  onShare,
  now = () => performance.now(),
}: Options) {
  const nowRef = useRef(now);
  nowRef.current = now;
  const onShareRef = useRef(onShare);
  onShareRef.current = onShare;

  const recording = useRef<{
    gameNumber: number;
    startedAt: number;
    last: Board;
    frames: ReplayFrame[];
  } | null>(null);

  useEffect(() => {
    let current = recording.current;
    if (!current || current.gameNumber !== gameNumber) {
      current = {
        gameNumber,
        startedAt: nowRef.current() - (current ? 0 : startOffsetMs),
        last: parsePuzzle(puzzle),
        frames: [],
      };
      recording.current = current;
    }
    // On a rematch the new game number arrives one commit before the
    // reducer resets: that board still belongs to the old puzzle.
    if (!matchesPuzzle(board, puzzle)) return;
    const frame = recordFrame(
      current.last,
      board,
      nowRef.current() - current.startedAt,
    );
    current.last = board;
    if (frame) current.frames = [...current.frames, frame];
    // Shared even when empty: "no moves" is an answer, "nothing
    // published" is a player who never got to the end screen.
    if (share) onShareRef.current(current.frames);
  }, [board, gameNumber, puzzle, share, startOffsetMs]);
}
