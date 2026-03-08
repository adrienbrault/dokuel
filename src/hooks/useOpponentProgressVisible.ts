import { useCallback, useState } from "react";

const STORAGE_KEY = "sudoku-opponent-progress-visible";

function getInitial(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "false") return false;
  } catch {
    // localStorage not available
  }
  return true;
}

export function useOpponentProgressVisible() {
  const [visible, setVisible] = useState<boolean>(getInitial);

  const toggle = useCallback(() => {
    setVisible((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // localStorage not available
      }
      return next;
    });
  }, []);

  return { visible, toggle };
}
