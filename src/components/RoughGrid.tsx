import { memo, useLayoutEffect, useRef } from "react";
import rough from "roughjs";

type RoughGridProps = {
  /** Side length of one sudoku cell, in pixels. */
  cellPx: number;
  /** Padding between the board edge and the cell grid, in pixels. */
  pad: number;
};

/**
 * The 9×9 sudoku grid, hand-drawn with Rough.js as an SVG overlay.
 * Cell lines are thin; every third line and the outer border are drawn
 * heavier to mark the 3×3 boxes. Strokes use `currentColor` so dark
 * mode is handled by the `text-board-border` class with no redraw. A
 * fixed per-line seed keeps the sketch stable across re-renders and
 * resizes so the grid doesn't shimmer.
 */
export const RoughGrid = memo(function RoughGrid({
  cellPx,
  pad,
}: RoughGridProps) {
  const ref = useRef<SVGSVGElement>(null);
  const gridPx = cellPx * 9;
  const size = gridPx + pad * 2;

  useLayoutEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    svg.replaceChildren();
    const rc = rough.svg(svg);
    const lineAt = (i: number) => pad + i * cellPx;

    const base = {
      stroke: "currentColor",
      roughness: 1.6,
      bowing: 1.2,
    };
    const thin = { ...base, strokeWidth: Math.max(1, cellPx * 0.028) };
    const thick = {
      ...base,
      roughness: 1.8,
      bowing: 0.8,
      strokeWidth: Math.max(1.8, cellPx * 0.052),
    };

    // Internal lines 1..8 — every third one is a 3×3 box separator.
    for (let i = 1; i < 9; i++) {
      const opts = i % 3 === 0 ? thick : thin;
      svg.appendChild(
        rc.line(lineAt(i), pad, lineAt(i), pad + gridPx, {
          ...opts,
          seed: i + 1,
        }),
      );
      svg.appendChild(
        rc.line(pad, lineAt(i), pad + gridPx, lineAt(i), {
          ...opts,
          seed: i + 41,
        }),
      );
    }
    // Outer border last so its corners sit above the cell lines.
    svg.appendChild(
      rc.rectangle(pad, pad, gridPx, gridPx, { ...thick, seed: 81 }),
    );
  }, [cellPx, pad, gridPx]);

  return (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="pointer-events-none absolute inset-0 text-board-border"
      aria-hidden="true"
    />
  );
});
