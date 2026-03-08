import { useCallback, useState } from "react";
import type { NumPadPosition } from "../lib/types.ts";

const STORAGE_KEY = "sudoku-numpad-position";

function getInitial(): NumPadPosition {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "left" || stored === "right" || stored === "bottom") {
      return stored;
    }
  } catch {
    // localStorage not available
  }
  return "bottom";
}

export function useNumPadPosition() {
  const [position, setPositionState] = useState<NumPadPosition>(getInitial);

  const setPosition = useCallback((pos: NumPadPosition) => {
    setPositionState(pos);
    try {
      localStorage.setItem(STORAGE_KEY, pos);
    } catch {
      // localStorage not available
    }
  }, []);

  return { position, setPosition };
}
