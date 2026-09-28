/**
 * Hit-testing for boards that are not made of DOM cells.
 *
 * The pointer hooks find a cell by asking the browser what is under the
 * cursor and walking up to a `[data-row]` element. A WebGL board has no
 * such element: the canvas covers the grid, so the browser reports the
 * canvas and the walk fails. Rather than teach every hook about the
 * renderer, a live scene registers a resolver here and the hooks fall
 * back to it, keeping one code path for mouse, touch and stylus.
 */

export type CellHit = {
  row: number;
  col: number;
  /** Zero at the top of the cell, one at the bottom. */
  localY: number;
};

export type CellHitResolver = (x: number, y: number) => CellHit | null;

const resolvers: CellHitResolver[] = [];

/**
 * Registers a resolver for as long as its board is mounted. Returns the
 * unregister function; calling it more than once is harmless.
 */
export function registerCellHitResolver(resolver: CellHitResolver): () => void {
  resolvers.push(resolver);
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    const index = resolvers.indexOf(resolver);
    if (index !== -1) resolvers.splice(index, 1);
  };
}

/**
 * Resolves a pointer position to a cell, preferring the most recently
 * registered board. Boards whose resolver reports nothing are skipped,
 * so a board with no tiles to hit does not hide one behind it.
 */
export function resolveCellHit(x: number, y: number): CellHit | null {
  for (let i = resolvers.length - 1; i >= 0; i--) {
    const hit = resolvers[i]!(x, y);
    if (hit) return hit;
  }
  return null;
}
