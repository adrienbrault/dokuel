import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "sudoku_sketch_mode";

function applySketchMode(enabled: boolean) {
  document.documentElement.classList.toggle("sketch", enabled);
}

export function useSketchMode() {
  const [enabled, setEnabledState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    applySketchMode(enabled);
  }, [enabled]);

  const setEnabled = useCallback((value: boolean) => {
    setEnabledState(value);
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // Silent fail
    }
  }, []);

  const toggle = useCallback(() => {
    setEnabled(!enabled);
  }, [enabled, setEnabled]);

  return { enabled, setEnabled, toggle };
}
