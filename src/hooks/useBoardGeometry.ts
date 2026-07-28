import { type RefObject, useLayoutEffect, useState } from "react";

/**
 * Grid geometry, in device pixels.
 *
 * The grid has no cell borders — it paints its rules by letting the
 * container background show through gaps between the cells. A hairline
 * separates cells inside a 3x3 box; a heavier rule separates the boxes
 * from each other and frames the whole grid.
 *
 * The board is snapped to a size where all of these land on whole device
 * pixels: a sub-pixel cell width makes adjacent gaps anti-alias to
 * different widths, so some rules render 1px and others 2px and the grid
 * looks subtly warped.
 */
export const THIN_GAP_PX = 1;
export const BOX_GAP_PX = 3;
export const FRAME_PX = 3;
const MIN_CELL_PX = 20;

/** Every pixel of a rendered board that is not a cell: 2 outer frame
 *  edges + 2 box gaps + 6 hairlines per axis. */
export const BOARD_FRAME_PX = FRAME_PX * 2 + BOX_GAP_PX * 2 + THIN_GAP_PX * 6;

/**
 * Measures the board's container and derives a cell size that keeps every
 * cell and every rule on a whole device pixel.
 */
export function useBoardGeometry(containerRef: RefObject<HTMLElement | null>) {
  const [cellPx, setCellPx] = useState(32);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      if (w === 0) return;
      setCellPx(Math.max(MIN_CELL_PX, Math.floor((w - BOARD_FRAME_PX) / 9)));
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [containerRef]);

  return {
    cellPx,
    boxPx: cellPx * 3 + THIN_GAP_PX * 2,
    boardPx: cellPx * 9 + BOARD_FRAME_PX,
  };
}
