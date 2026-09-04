import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { HintBanner } from "./HintBanner.tsx";

it("announces a hint explanation without moving keyboard focus", () => {
  render(
    <HintBanner
      hint={{
        technique: "naked-single",
        explanation: "Only 4 fits in row 2, column 3.",
        relatedCells: [{ row: 1, col: 2 }],
        position: { row: 1, col: 2 },
        value: 4,
      }}
      onDismiss={vi.fn()}
    />,
  );
  expect(screen.getByRole("status")).toHaveTextContent("Only 4 fits");
  expect(screen.getByRole("status")).toHaveAttribute("aria-atomic", "true");
  expect(document.activeElement).toBe(document.body);
});
