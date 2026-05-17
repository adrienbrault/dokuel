import type { NumPadLayout } from "../lib/types.ts";
import { useLocalStorage } from "./useLocalStorage.ts";

const STORAGE_KEY = "sudoku-numpad-layout";

function parseNumPadLayout(raw: string): NumPadLayout | null {
  return raw === "linear" || raw === "grid" ? raw : null;
}

export function useNumPadLayout() {
  const [layout, setLayout] = useLocalStorage<NumPadLayout>(
    STORAGE_KEY,
    "linear",
    parseNumPadLayout,
  );
  return { layout, setLayout };
}
