import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RoughGrid } from "./RoughGrid.tsx";

describe("RoughGrid", () => {
  it("hand-draws the grid as SVG path elements", () => {
    const { container } = render(<RoughGrid cellPx={36} pad={8} />);
    expect(container.querySelector("svg")).not.toBeNull();
    expect(container.querySelectorAll("svg path").length).toBeGreaterThan(0);
  });

  it("draws the 3×3 box separators heavier than the cell lines", () => {
    // The thin cell lines and the thick box/border strokes must use
    // different widths so the 3×3 structure reads at a glance.
    const { container } = render(<RoughGrid cellPx={48} pad={8} />);
    const widths = new Set(
      Array.from(container.querySelectorAll("path"), (p) =>
        p.getAttribute("stroke-width"),
      ),
    );
    expect(widths.size).toBeGreaterThanOrEqual(2);
  });
});
