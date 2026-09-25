import { useEffect, useRef } from "react";

/**
 * Modal focus management: move focus onto the primary action when the
 * dialog opens (this is also what makes screen readers announce it),
 * restore it when the dialog goes away, and keep Tab cycling inside —
 * without this, Tab walked the covered board.
 */
export function useDialogFocus() {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const primary = panelRef.current?.querySelector<HTMLElement>("button");
    primary?.focus();
    return () => {
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, []);
  const trapTab = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusable = Array.from(
      panel.querySelectorAll<HTMLElement>("button, [href], [tabindex]"),
    ).filter((el) => !el.hasAttribute("disabled"));
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  return { panelRef, trapTab };
}
