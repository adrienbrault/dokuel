import { useCallback, useState } from "react";

export function useLocalStorage<T>(
  key: string,
  initial: T,
  parse: (raw: string) => T | null,
): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        const parsed = parse(raw);
        if (parsed !== null) return parsed;
      }
    } catch {
      // localStorage not available
    }
    return initial;
  });

  const set = useCallback(
    (next: T) => {
      setValue(next);
      try {
        localStorage.setItem(key, String(next));
      } catch {
        // localStorage not available
      }
    },
    [key],
  );

  return [value, set];
}
