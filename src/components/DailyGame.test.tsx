import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DailyGame } from "./DailyGame.tsx";

describe("DailyGame", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("holds a placeholder until the frozen board has loaded", async () => {
    // The board table is a dynamic import, so the first paint has no
    // puzzle to show. It must say so rather than mounting an empty
    // grid that jumps once the chunk lands.
    render(<DailyGame onBack={vi.fn()} />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    expect(
      await screen.findByLabelText(/^Cell row 1 column 1/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
  });
});
