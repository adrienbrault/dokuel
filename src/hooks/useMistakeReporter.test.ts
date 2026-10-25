import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useMistakeReporter } from "./useMistakeReporter.ts";
import { useSudoku } from "./useSudoku.ts";

const SOLVED =
  "534678912" +
  "672195348" +
  "198342567" +
  "859761423" +
  "426853791" +
  "713924856" +
  "961537284" +
  "287419635" +
  "345286179";
// Holes at indices 0, 1 and 2 (5, 3 and 4).
const PUZZLE = `...${SOLVED.slice(3)}`;

describe("useMistakeReporter", () => {
  it("reports each wrong digit we place, once", () => {
    const onMistake = vi.fn();
    const { result } = renderHook(() => {
      const game = useSudoku(PUZZLE, SOLVED);
      useMistakeReporter(game.lastMove, SOLVED, onMistake);
      return game;
    });

    act(() => result.current.selectCell(0, 0));
    act(() => result.current.placeNumber(9));
    act(() => result.current.erase());
    act(() => result.current.placeNumber(5));

    expect(onMistake).toHaveBeenCalledOnce();
  });
});
