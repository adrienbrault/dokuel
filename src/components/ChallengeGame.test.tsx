import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ChallengeGame } from "./ChallengeGame.tsx";

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

it("shows the target before starting and compares a completed puzzle under fixed assistance", () => {
  const challenge = {
    version: 1 as const,
    puzzle:
      ".34678912672195348198342567859761423426853791713924856961537284287419635345286179",
    difficulty: "easy" as const,
    assistLevel: "standard" as const,
    timeSeconds: 222,
    hintsUsed: 0,
  };
  render(<ChallengeGame challenge={challenge} onBack={vi.fn()} />);
  expect(screen.getByRole("heading", { name: "Beat 03:42" })).toBeTruthy();
  expect(screen.queryByRole("region", { name: "Sudoku board" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Start challenge" }));
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  expect(screen.queryByRole("radio", { name: /Full/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Close settings" }));
  fireEvent.click(screen.getByLabelText(/Cell row 1 column 1, empty/));
  fireEvent.keyDown(window, { key: "5" });
  act(() => vi.advanceTimersByTime(500));
  expect(screen.getByText(/You beat the target by/)).toBeTruthy();
});
