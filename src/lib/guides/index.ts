import { NAKED_SINGLES } from "./naked-singles.ts";
import { SCANNING } from "./scanning.ts";
import type { Guide } from "./types.ts";

export const GUIDES: Guide[] = [SCANNING, NAKED_SINGLES];

export function findGuide(id: string): Guide | null {
  return GUIDES.find((g) => g.id === id) ?? null;
}
