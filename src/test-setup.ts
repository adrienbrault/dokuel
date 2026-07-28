import "@testing-library/jest-dom/vitest";

// jsdom does no layout, so it ships no elementFromPoint. Give it a
// null-returning stub so tests can vi.spyOn it — a spy requires the
// property to exist, and spies (unlike raw assignment) are undone by
// restoreMocks even when the test fails mid-body.
if (typeof document !== "undefined" && !document.elementFromPoint) {
  document.elementFromPoint = () => null;
}

// jsdom ships no matchMedia; useDarkMode reads it for the system theme.
// Tests that care about a specific preference override this themselves.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}
