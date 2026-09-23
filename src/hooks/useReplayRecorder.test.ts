import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { parsePuzzle } from "../lib/sudoku.ts";
import type { Board } from "../lib/types.ts";
import { useReplayRecorder } from "./useReplayRecorder.ts";

const PUZZLE =
  "53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79";

function withValue(board: Board, row: number, col: number, value: number) {
  const next = board.map((r) => r.map((c) => ({ ...c })));
  next[row]![col]!.value = value;
  return next;
}

function setup(share: boolean) {
  let clock = 0;
  const onShare = vi.fn();
  const start = parsePuzzle(PUZZLE);
  const hook = renderHook(
    (props: { board: Board; gameNumber: number; share: boolean }) =>
      useReplayRecorder({
        puzzle: PUZZLE,
        board: props.board,
        gameNumber: props.gameNumber,
        startOffsetMs: 0,
        share: props.share,
        onShare,
        now: () => clock,
      }),
    { initialProps: { board: start, gameNumber: 1, share } },
  );
  return {
    ...hook,
    start,
    onShare,
    tickTo(ms: number) {
      clock = ms;
    },
  };
}

describe("useReplayRecorder", () => {
  it("shares nothing while the game is on", () => {
    const { rerender, start, onShare, tickTo } = setup(false);
    tickTo(1_000);
    rerender({ board: withValue(start, 0, 2, 4), gameNumber: 1, share: false });

    expect(onShare).not.toHaveBeenCalled();
  });

  it("shares every recorded change once allowed, and keeps sharing", () => {
    const { rerender, start, onShare, tickTo } = setup(false);
    tickTo(1_000);
    const placed = withValue(start, 0, 2, 4);
    rerender({ board: placed, gameNumber: 1, share: false });

    rerender({ board: placed, gameNumber: 1, share: true });
    expect(onShare).toHaveBeenLastCalledWith([[1_000, 2, 4]]);

    tickTo(3_000);
    rerender({
      board: withValue(placed, 0, 3, 6),
      gameNumber: 1,
      share: true,
    });
    expect(onShare).toHaveBeenLastCalledWith([
      [1_000, 2, 4],
      [3_000, 3, 6],
    ]);
  });

  it("starts a fresh recording for a new game", () => {
    const { rerender, start, onShare, tickTo } = setup(false);
    tickTo(1_000);
    rerender({ board: withValue(start, 0, 2, 4), gameNumber: 1, share: false });

    tickTo(60_000);
    rerender({ board: start, gameNumber: 2, share: false });
    tickTo(62_000);
    rerender({ board: withValue(start, 0, 3, 6), gameNumber: 2, share: true });

    expect(onShare).toHaveBeenLastCalledWith([[2_000, 3, 6]]);
  });
});
