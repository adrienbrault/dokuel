import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MatchReplay, type ReplayPlayer } from "./MatchReplay.tsx";

const PUZZLE =
  "53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79";
const SOLUTION =
  "534678912672195348198342567859761423426853791713924856961537284287419635345286179";

const me: ReplayPlayer = {
  id: "p1",
  name: "You",
  color: "#3B82F6",
  won: true,
  frames: [
    [1_000, 2, 4],
    [60_000, 3, 6],
  ],
};
const opponent: ReplayPlayer = {
  id: "p2",
  name: "Bob",
  color: "#EF4444",
  won: false,
  frames: [
    [2_000, 2, 1],
    [30_000, 2, 0b1000 << 4],
  ],
};

function cell(board: string, label: string) {
  return within(screen.getByRole("group", { name: board })).getByLabelText(
    label,
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe("MatchReplay", () => {
  it("shows both boards as they stood at the scrubbed instant", () => {
    render(
      <MatchReplay
        puzzle={PUZZLE}
        solution={SOLUTION}
        players={[me, opponent]}
        onClose={() => {}}
      />,
    );

    fireEvent.change(screen.getByLabelText("Replay time"), {
      target: { value: "2500" },
    });

    expect(cell("Board: You", "Row 1 column 3, value 4")).toBeTruthy();
    expect(cell("Board: Bob", "Row 1 column 3, value 1")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Replay time"), {
      target: { value: "40000" },
    });

    expect(cell("Board: Bob", "Row 1 column 3, notes 4")).toBeTruthy();
  });

  it("starts at the end, with both finished boards", () => {
    render(
      <MatchReplay
        puzzle={PUZZLE}
        solution={SOLUTION}
        players={[me, opponent]}
        onClose={() => {}}
      />,
    );

    expect(cell("Board: You", "Row 1 column 4, value 6")).toBeTruthy();
    expect(screen.getByText("01:00 / 01:00")).toBeTruthy();
  });

  it("plays the match forward from the start", () => {
    vi.useFakeTimers();
    render(
      <MatchReplay
        puzzle={PUZZLE}
        solution={SOLUTION}
        players={[me, opponent]}
        onClose={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(cell("Board: You", "Row 1 column 3, empty")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(cell("Board: You", "Row 1 column 3, value 4")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Pause" })).toBeTruthy();
  });

  it("waits for an opponent who has not shared a replay yet", () => {
    render(
      <MatchReplay
        puzzle={PUZZLE}
        solution={SOLUTION}
        players={[me, { ...opponent, frames: null }]}
        onClose={() => {}}
      />,
    );

    expect(screen.getByText("Waiting for Bob's replay…")).toBeTruthy();
    expect(screen.queryByLabelText("Compare boards")).toBeNull();
  });

  it("goes back to the results", () => {
    const onClose = vi.fn();
    render(
      <MatchReplay
        puzzle={PUZZLE}
        solution={SOLUTION}
        players={[me, opponent]}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Results/ }));

    expect(onClose).toHaveBeenCalled();
  });
});
