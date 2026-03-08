type SketchModeToggleProps = {
  enabled: boolean;
  onToggle: () => void;
};

export function SketchModeToggle({ enabled, onToggle }: SketchModeToggleProps) {
  return (
    <button
      type="button"
      className={`p-2 rounded-lg transition-colors touch-manipulation ${
        enabled
          ? "text-accent bg-accent-light"
          : "text-text-muted hover:bg-bg-raised"
      }`}
      onClick={onToggle}
      aria-label={enabled ? "Disable sketch mode" : "Enable sketch mode"}
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <title>Pencil</title>
        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
        <path d="m15 5 4 4" />
      </svg>
    </button>
  );
}
