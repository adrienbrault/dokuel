import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CellOverlay } from "../../lib/guides/types.ts";
import { cellKey } from "../../lib/sudoku.ts";
import { DemoOverlays } from "./DemoOverlays.tsx";

describe("DemoOverlays", () => {
  it("renders a badge showing the eliminated digits for an eliminate overlay", () => {
    const overlays = new Map<number, CellOverlay[]>([
      [cellKey(2, 3), [{ kind: "eliminate", digits: [4, 7] }]],
    ]);
    render(<DemoOverlays overlays={overlays} />);
    expect(screen.getByText("−4,7")).toBeDefined();
  });
});
