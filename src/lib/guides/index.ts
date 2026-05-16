import { SCANNING } from "./scanning.ts";
import type { Guide } from "./types.ts";

export const GUIDES: Guide[] = [SCANNING];

export function findGuide(id: string): Guide | null {
  return GUIDES.find((g) => g.id === id) ?? null;
}
