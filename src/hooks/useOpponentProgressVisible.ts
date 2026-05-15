import { useCallback } from "react";
import { useLocalStorage } from "./useLocalStorage.ts";

const STORAGE_KEY = "sudoku-opponent-progress-visible";

function parseVisible(raw: string): boolean | null {
  return raw === "false" ? false : null;
}

export function useOpponentProgressVisible() {
  const [visible, setVisible] = useLocalStorage<boolean>(
    STORAGE_KEY,
    true,
    parseVisible,
  );
  const toggle = useCallback(() => setVisible(!visible), [visible, setVisible]);
  return { visible, toggle };
}
