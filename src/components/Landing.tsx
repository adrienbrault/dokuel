type LandingProps = {
  onSolo: () => void;
  onDaily: () => void;
  onCreate: () => void;
  onJoin: () => void;
};

export function Landing({ onSolo, onDaily, onCreate, onJoin }: LandingProps) {
  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-sm px-6">
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-5xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
          Sudoku
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Free multiplayer sudoku — no account needed.
        </p>
      </div>
      <div className="flex flex-col gap-3 w-full">
        <FeatureRow
          icon={<ZapIcon />}
          text="Real-time 1v1 — race a friend peer-to-peer"
        />
        <FeatureRow
          icon={<CalendarIcon />}
          text="Daily challenge — same puzzle for everyone"
        />
        <FeatureRow
          icon={<GlobeIcon />}
          text="Mobile & desktop — dark mode, haptics, sounds"
        />
      </div>
      <div className="flex flex-col gap-6 w-full">
        <div className="flex flex-col gap-3">
          <span className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            Solo
          </span>
          <ActionButton label="Start Solo" onClick={onSolo} primary />
          <ActionButton label="Daily Challenge" onClick={onDaily} />
        </div>
        <div className="flex flex-col gap-3">
          <span className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            Multiplayer
          </span>
          <ActionButton label="Create Game" onClick={onCreate} />
          <ActionButton label="Join Game" onClick={onJoin} />
        </div>
      </div>
      <a
        href="https://github.com/adrienbrault/sudoku"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-accent dark:hover:text-accent transition-colors"
      >
        <GitHubIcon />
        <span>Open source</span>
      </a>
    </div>
  );
}

function FeatureRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-accent shrink-0">{icon}</span>
      <span className="text-sm text-gray-500 dark:text-gray-400">{text}</span>
    </div>
  );
}

function ActionButton({
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
      className={`
				w-full py-4 rounded-xl text-lg font-semibold
				press-spring-soft select-none touch-manipulation
				${
          primary
            ? "bg-accent text-white shadow-lg shadow-accent/20"
            : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200"
        }
			`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function ZapIcon() {
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

function CalendarIcon() {
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

function GlobeIcon() {
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

function GitHubIcon() {
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
