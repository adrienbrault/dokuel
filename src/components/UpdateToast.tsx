import { useSyncExternalStore } from "react";
import type { Screen } from "../App.tsx";
import { type SwUpdates, swUpdates } from "../lib/sw-updates.ts";
import { Toast } from "./Toast.tsx";

/**
 * Non-blocking "new version" prompt. Only the player's tap reloads;
 * the app never swaps builds on its own.
 */
export function UpdateToast({ updates = swUpdates }: { updates?: SwUpdates }) {
  const ready = useSyncExternalStore(updates.subscribe, updates.isUpdateReady);
  if (!ready) return null;
  return (
    <Toast
      tone="info"
      message="Update available"
      action={{ label: "Reload", onClick: updates.applyUpdate }}
    />
  );
}

// Never over a board: it would cover the timer, and a reload
// mid-match drops the player from the room. Games end on menus.
const UPDATE_PROMPT_SCREENS = new Set<Screen["name"]>([
  "landing",
  "difficulty",
  "join",
  "stats",
  "notFound",
]);

export function offersUpdates(screen: Screen): boolean {
  return UPDATE_PROMPT_SCREENS.has(screen.name);
}
