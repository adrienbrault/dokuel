const SHORTCUTS = [
  { keys: "1–9", label: "Place number" },
  { keys: "←→↑↓", label: "Navigate" },
  { keys: "N", label: "Toggle notes" },
  { keys: "Del", label: "Erase" },
  { keys: "⌘Z", label: "Undo" },
  { keys: "Esc", label: "Deselect" },
];

export function KeyboardShortcuts() {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="label mb-0.5">Keyboard</span>
      {SHORTCUTS.map((s) => (
        <div key={s.keys} className="flex items-center gap-2">
          <kbd className="inline-flex items-center justify-center min-w-[2.5rem] px-1.5 py-0.5 rounded bg-bg-raised border border-border-default text-xs font-mono text-text-secondary">
            {s.keys}
          </kbd>
          <span className="text-xs text-text-muted">{s.label}</span>
        </div>
      ))}
    </div>
  );
}
