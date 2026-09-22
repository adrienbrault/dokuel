import { useSyncExternalStore } from "react";
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
