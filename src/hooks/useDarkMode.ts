import { useCallback, useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

function getSystemPreference(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

// Hex matches --color-bg-primary from src/index.css. Kept in sync manually
// because <meta name="theme-color"> needs a parseable color, and JSDOM's
// getComputedStyle does not convert oklch for us to read at runtime.
const THEME_COLOR_LIGHT = "#fdfbf9";
const THEME_COLOR_DARK = "#0b0906";

function syncThemeColorMeta(theme: Theme, isDark: boolean) {
  // System mode is handled by the media-query <meta> tags in index.html.
  // For manual overrides we add a non-media tag, which takes precedence and
  // keeps the iOS browser chrome aligned with the in-app toggle even when it
  // disagrees with prefers-color-scheme.
  const existing = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]:not([media])',
  );
  if (theme === "system") {
    existing?.remove();
    return;
  }
  const color = isDark ? THEME_COLOR_DARK : THEME_COLOR_LIGHT;
  if (existing) {
    existing.content = color;
    return;
  }
  const meta = document.createElement("meta");
  meta.name = "theme-color";
  meta.content = color;
  document.head.appendChild(meta);
}

function applyTheme(theme: Theme) {
  const isDark =
    theme === "dark" || (theme === "system" && getSystemPreference());
  document.documentElement.classList.toggle("dark", isDark);
  syncThemeColorMeta(theme, isDark);
}

export function useDarkMode() {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem("sudoku_theme") as Theme | null;
    return stored || "system";
  });

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Listen for system preference changes when in system mode
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    localStorage.setItem("sudoku_theme", t);
    setThemeState(t);
  }, []);

  const toggle = useCallback(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "light" : "dark");
  }, [setTheme]);

  return {
    theme,
    setTheme,
    toggle,
    isDark: document.documentElement.classList.contains("dark"),
  };
}
