import { useCallback, useSyncExternalStore } from "react";
import type { NumPadLayout } from "../lib/types.ts";

const STORAGE_KEY = "sudoku-numpad-layout";

function getStored(): NumPadLayout {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "row" || stored === "grid") {
      return stored;
    }
  } catch {
    // localStorage not available
  }
  return "row";
}

const landscapeQuery =
  typeof window !== "undefined"
    ? window.matchMedia("(orientation: landscape) and (max-height: 500px)")
    : null;

function subscribeLandscape(cb: () => void) {
  landscapeQuery?.addEventListener("change", cb);
  return () => landscapeQuery?.removeEventListener("change", cb);
}

function getIsLandscape() {
  return landscapeQuery?.matches ?? false;
}

function getIsLandscapeServer() {
  return false;
}

let currentLayout = getStored();
const listeners = new Set<() => void>();

function subscribeLayout(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getLayout() {
  return currentLayout;
}

function setStoredLayout(l: NumPadLayout) {
  currentLayout = l;
  try {
    localStorage.setItem(STORAGE_KEY, l);
  } catch {
    // localStorage not available
  }
  for (const cb of listeners) cb();
}

export function useNumPadLayout() {
  const layout = useSyncExternalStore(subscribeLayout, getLayout, getStored);
  const isLandscape = useSyncExternalStore(
    subscribeLandscape,
    getIsLandscape,
    getIsLandscapeServer,
  );

  const setLayout = useCallback((l: NumPadLayout) => {
    setStoredLayout(l);
  }, []);

  const effectiveLayout: NumPadLayout = isLandscape ? "grid" : layout;

  return { layout, effectiveLayout, setLayout };
}
