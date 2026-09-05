import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProgressBar } from "./ProgressBar.tsx";

describe("ProgressBar", () => {
  it("reads out how many cells are left beside the percentage", () => {
    // A percentage is an abstraction; "41 left" is the number a player
    // actually races against, and the room already syncs it.
    render(
      <ProgressBar
        label="Opponent"
        percent={29}
        remaining={41}
        color="bg-opponent"
      />,
    );

    expect(screen.getByText(/29%/)).toHaveTextContent("29% · 41 left");
  });

  it("shows the percentage alone when no count is given", () => {
    render(<ProgressBar label="You" percent={12} color="bg-accent" />);

    expect(screen.getByText(/12%/)).toHaveTextContent("12%");
    expect(screen.queryByText(/left/)).toBeNull();
  });
});
