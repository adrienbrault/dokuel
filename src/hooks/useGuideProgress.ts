import { useCallback, useMemo } from "react";
import type { TechniqueId } from "../lib/guides/types.ts";
import { useLocalStorage } from "./useLocalStorage.ts";

const STORAGE_KEY = "dokuel:guides:viewed";

function parseRaw(raw: string): string | null {
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr) && arr.every((x) => typeof x === "string")) {
      return raw;
    }
  } catch {
    // fall through
  }
  return null;
}

export type GuideProgress = {
  viewed: Set<TechniqueId>;
  isViewed: (id: TechniqueId) => boolean;
  isNew: (id: TechniqueId) => boolean;
  markViewed: (id: TechniqueId) => void;
};

export function useGuideProgress(): GuideProgress {
  const [raw, setRaw] = useLocalStorage<string>(STORAGE_KEY, "[]", parseRaw);

  const viewed = useMemo<Set<TechniqueId>>(() => {
    try {
      return new Set(JSON.parse(raw) as TechniqueId[]);
    } catch {
      return new Set();
    }
  }, [raw]);

  const markViewed = useCallback(
    (id: TechniqueId) => {
      if (viewed.has(id)) return;
      setRaw(JSON.stringify([...viewed, id]));
    },
    [viewed, setRaw],
  );

  return {
    viewed,
    isViewed: (id: TechniqueId) => viewed.has(id),
    isNew: (id: TechniqueId) => !viewed.has(id),
    markViewed,
  };
}
