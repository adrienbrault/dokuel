import { STORAGE_KEYS } from "../lib/constants.ts";
import type { AssistLevel } from "../lib/types.ts";
import { useLocalStorage } from "./useLocalStorage.ts";

const VALID_LEVELS: AssistLevel[] = ["paper", "standard", "full"];

function isAssistLevel(v: string): v is AssistLevel {
  return VALID_LEVELS.includes(v as AssistLevel);
}

export function useAssistLevel() {
  const [level, setLevel] = useLocalStorage<AssistLevel>(
    STORAGE_KEYS.ASSIST_LEVEL,
    "standard",
    isAssistLevel,
  );

  return { level, setLevel };
}
