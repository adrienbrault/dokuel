import { useCallback } from "react";
import { STORAGE_KEYS } from "../lib/constants.ts";
import { useLocalStorage } from "./useLocalStorage.ts";

type BoolStr = "true" | "false";

function isBoolStr(v: string): v is BoolStr {
  return v === "true" || v === "false";
}

export function useOpponentProgressVisible() {
  const [raw, setRaw] = useLocalStorage<BoolStr>(
    STORAGE_KEYS.OPPONENT_PROGRESS,
    "true",
    isBoolStr,
  );

  const visible = raw !== "false";

  const toggle = useCallback(() => {
    setRaw(visible ? "false" : "true");
  }, [visible, setRaw]);

  return { visible, toggle };
}
