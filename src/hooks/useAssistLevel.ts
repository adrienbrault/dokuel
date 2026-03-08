import { useCallback, useState } from "react";
import type { AssistLevel } from "../lib/types.ts";

const STORAGE_KEY = "sudoku_assist_level";

function getInitial(): AssistLevel {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "paper" || stored === "standard" || stored === "full") {
      return stored;
    }
  } catch {
    // localStorage not available
  }
  return "standard";
}

export function useAssistLevel() {
  const [level, setLevelState] = useState<AssistLevel>(getInitial);

  const setLevel = useCallback((l: AssistLevel) => {
    setLevelState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // localStorage not available
    }
  }, []);

  return { level, setLevel };
}
