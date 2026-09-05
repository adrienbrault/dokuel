import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpponentReaction } from "./OpponentReaction.tsx";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("OpponentReaction", () => {
  it("shows nothing until the opponent sends one", () => {
    render(<OpponentReaction reaction={null} />);

    expect(screen.queryByRole("status")).toBeNull();
  });

  it("floats the emoji and clears it after a couple of seconds", () => {
    const { rerender } = render(<OpponentReaction reaction={null} />);

    rerender(
      <OpponentReaction reaction={{ emoji: "🔥", at: 1, nonce: "n1" }} />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("🔥");

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows the same emoji again when it is sent again", () => {
    // Presence is last-write-wins state: a repeat only differs by its
    // nonce, and it still has to land as a new reaction.
    const { rerender } = render(
      <OpponentReaction reaction={{ emoji: "🔥", at: 1, nonce: "n1" }} />,
    );
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    rerender(
      <OpponentReaction reaction={{ emoji: "🔥", at: 9, nonce: "n2" }} />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("🔥");
  });

  it("ignores a fresh copy of a reaction it has already shown", () => {
    // Awareness hands back a new object on every remote update, and
    // the opponent's silhouette updates several times a second. The
    // same nonce arriving in a new wrapper is not a new reaction.
    const { rerender } = render(
      <OpponentReaction reaction={{ emoji: "🔥", at: 1, nonce: "n1" }} />,
    );
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    rerender(
      <OpponentReaction reaction={{ emoji: "🔥", at: 1, nonce: "n1" }} />,
    );

    expect(screen.queryByRole("status")).toBeNull();
  });

  it("clears the emoji when the opponent's presence goes away", () => {
    // A peer drop inside the two-second window removes their awareness
    // entry; the emoji must not stay pinned until their next reaction.
    const { rerender } = render(
      <OpponentReaction reaction={{ emoji: "🔥", at: 1, nonce: "n1" }} />,
    );

    rerender(<OpponentReaction reaction={null} />);

    expect(screen.queryByRole("status")).toBeNull();
  });
});
