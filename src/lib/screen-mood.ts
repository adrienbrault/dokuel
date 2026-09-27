import type { AtmosphereMood } from "./atmosphere.ts";

/**
 * The union of App's screen names. Kept structural so App can pass
 * `screen.name` without importing a shared type back from the router.
 */
export type ScreenName =
  | "landing"
  | "difficulty"
  | "solo"
  | "daily"
  | "multiplayer"
  | "join"
  | "stats"
  | "notFound";

const GAME_SCREENS = new Set<ScreenName>(["solo", "daily", "multiplayer"]);

/**
 * Screens where a board is actually in play get the focused "game"
 * ambience; menus, lobbies and meta screens get the calmer "menu" one.
 */
export function moodForScreen(name: ScreenName): AtmosphereMood {
  return GAME_SCREENS.has(name) ? "game" : "menu";
}