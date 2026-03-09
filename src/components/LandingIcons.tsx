export function FeatureRow({
  icon,
  text,
}: {
  icon: React.ReactNode;
  text: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-accent shrink-0">{icon}</span>
      <span className="text-sm text-text-secondary">{text}</span>
    </div>
  );
}

export function ActionButton({
  label,
  onClick,
  primary = false,
}: {
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      className={`btn btn-lg w-full ${primary ? "btn-primary" : "btn-secondary"}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

export function ZapIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

export function CalendarIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

export function GlobeIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <ellipse cx="12" cy="12" rx="4" ry="10" />
    </svg>
  );
}

export function StatsIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 20V10" />
      <path d="M12 20V4" />
      <path d="M6 20v-6" />
    </svg>
  );
}

const MINI_CELLS = [
  { r: 0, c: 0, v: "5", d: 0.0, p: "a" },
  { r: 0, c: 2, v: "3", d: 0.3, p: "b" },
  { r: 0, c: 3, v: "9", d: 0, p: "g" },
  { r: 1, c: 1, v: "7", d: 0.6, p: "a" },
  { r: 1, c: 3, v: "1", d: 0.5, p: "b" },
  { r: 2, c: 0, v: "4", d: 0.8, p: "b" },
  { r: 2, c: 2, v: "8", d: 0.9, p: "a" },
  { r: 3, c: 1, v: "6", d: 0, p: "g" },
  { r: 3, c: 3, v: "2", d: 1.2, p: "a" },
  { r: 3, c: 0, v: "9", d: 1.1, p: "b" },
];

export function MiniBoard() {
  const size = 4;
  const cellSize = 36;
  const gap = 2;
  const total = size * (cellSize + gap) - gap;

  return (
    <svg
      width={total}
      height={total}
      viewBox={`0 0 ${total} ${total}`}
      role="img"
      aria-label="Game preview"
      className="mx-auto"
    >
      {/* Grid cells */}
      {Array.from({ length: size * size }, (_, i) => {
        const r = Math.floor(i / size);
        const c = i % size;
        return (
          <rect
            key={i}
            x={c * (cellSize + gap)}
            y={r * (cellSize + gap)}
            width={cellSize}
            height={cellSize}
            rx={4}
            className="fill-bg-raised"
          />
        );
      })}
      {/* Animated numbers */}
      {MINI_CELLS.map(({ r, c, v, d, p }) => (
        <text
          key={`${r}-${c}`}
          x={c * (cellSize + gap) + cellSize / 2}
          y={r * (cellSize + gap) + cellSize / 2 + 1}
          textAnchor="middle"
          dominantBaseline="central"
          className={`text-sm font-semibold ${p === "g" ? "fill-text-secondary" : p === "a" ? "fill-accent" : "fill-rose-400 dark:fill-rose-300"}`}
          style={{
            opacity: p === "g" ? 1 : 0,
            animation:
              p === "g"
                ? "none"
                : `mini-cell-in 0.3s ease-out ${d + 0.5}s forwards`,
          }}
        >
          {v}
        </text>
      ))}
    </svg>
  );
}

export function GitHubIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}
