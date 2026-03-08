import { useSyncExternalStore } from "react";
import type { NumPadPosition } from "../lib/types.ts";

const wideQuery =
  typeof window !== "undefined"
    ? window.matchMedia("(min-width: 540px)")
    : null;

function useIsWide(): boolean {
  return useSyncExternalStore(
    (cb) => {
      wideQuery?.addEventListener("change", cb);
      return () => wideQuery?.removeEventListener("change", cb);
    },
    () => wideQuery?.matches ?? false,
  );
}

export function useEffectivePosition(position: NumPadPosition): NumPadPosition {
  const isWide = useIsWide();
  if (!isWide && position !== "bottom") return "bottom";
  return position;
}
