import { useSyncExternalStore } from "react";
import type { NumPadLayout } from "../lib/types.ts";

/**
 * Auto-detects the best numpad layout based on viewport.
 * - Landscape phones: always grid (sidebar layout)
 * - Portrait: grid when enough vertical space, row when tight
 */

const landscapeQuery =
  typeof window !== "undefined"
    ? window.matchMedia("(orientation: landscape) and (max-height: 500px)")
    : null;

// Portrait with enough room for 3×3 grid below board + controls
// ~630px needed: header(40) + board(360) + controls(48) + grid(160) + gaps(20)
const tallPortraitQuery =
  typeof window !== "undefined"
    ? window.matchMedia(
        "(orientation: portrait) and (min-height: 640px) and (max-width: 768px)",
      )
    : null;

// Desktop/tablet: always grid
const desktopQuery =
  typeof window !== "undefined"
    ? window.matchMedia("(min-width: 769px)")
    : null;

function subscribe(cb: () => void) {
  landscapeQuery?.addEventListener("change", cb);
  tallPortraitQuery?.addEventListener("change", cb);
  desktopQuery?.addEventListener("change", cb);
  return () => {
    landscapeQuery?.removeEventListener("change", cb);
    tallPortraitQuery?.removeEventListener("change", cb);
    desktopQuery?.removeEventListener("change", cb);
  };
}

function getLayout(): NumPadLayout {
  if (landscapeQuery?.matches) return "grid";
  if (desktopQuery?.matches) return "row"; // desktop uses the vertical column
  if (tallPortraitQuery?.matches) return "grid";
  return "row";
}

function getServerLayout(): NumPadLayout {
  return "row";
}

export function useNumPadLayout(): NumPadLayout {
  return useSyncExternalStore(subscribe, getLayout, getServerLayout);
}
