import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProgressBar } from "./ProgressBar.tsx";

describe("ProgressBar", () => {
  it("renders label and percentage", () => {
    render(<ProgressBar label="You" percent={42} color="bg-accent" />);
    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.getByText("42%")).toBeInTheDocument();
  });

  it("sets the bar width via inline style", () => {
    const { container } = render(
      <ProgressBar label="You" percent={75} color="bg-accent" />,
    );
    const bar = container.querySelector("[style]");
    expect(bar).toHaveStyle({ width: "75%" });
  });

  it("renders without label when none provided", () => {
    render(<ProgressBar percent={50} color="bg-accent" />);
    expect(screen.getByText("50%")).toBeInTheDocument();
  });
});
