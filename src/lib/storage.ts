export function readJson<T>(
  key: string,
  fallback: T,
  validate?: (value: unknown) => T | null,
): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (validate) {
      const validated = validate(parsed);
      return validated === null ? fallback : validated;
    }
    return parsed as T;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // storage full or unavailable
    return false;
  }
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // storage unavailable
  }
}
