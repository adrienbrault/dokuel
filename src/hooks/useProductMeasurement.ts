import { useEffect, useRef } from "react";
import { todayLocalISO } from "../lib/date.ts";
import type { Screen } from "../lib/navigation.ts";
import { type ProductMode, trackProductEvent } from "../lib/product-events.ts";

/** Entry counts are aggregate funnel signals, never user tracking. */
export function useProductMeasurement(screen: Screen): void {
  const seen = useRef(new Set<string>());
  useEffect(() => {
    let key: string;
    let mode: ProductMode;
    if (screen.name === "solo") {
      key = screen.gameKey;
      mode = "solo";
    } else if (screen.name === "daily") {
      key = `daily:${screen.date ?? todayLocalISO()}`;
      mode = "daily";
    } else if (screen.name === "landing") {
      if (!seen.current.has("visit")) {
        seen.current.add("visit");
        trackProductEvent("visit");
      }
      return;
    } else return;
    if (seen.current.has(key)) return;
    seen.current.add(key);
    trackProductEvent("game_start", mode);
  }, [screen]);
}
