import { useCallback, useMemo, useState } from "react";
import { getDailyStreak, isDailyCompleted } from "../lib/daily-streak.ts";
import { formatShortDate, formatTime } from "../lib/format.ts";
import {
  deleteGame,
  listSavedGames,
  type SavedGameSummary,
} from "../lib/game-storage.ts";
import { getStats } from "../lib/stats.ts";

type LandingProps = {
  onSolo: () => void;
  onDaily: () => void;
  onCreate: () => void;
  onJoin: () => void;
  onContinue: (gameKey: string, difficulty: string) => void;
  onStats: () => void;
};

export function Landing({
  onSolo,
  onDaily,
  onCreate,
  onJoin,
  onContinue,
  onStats,
}: LandingProps) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const completed = useMemo(() => isDailyCompleted(today), [today]);
  const streak = useMemo(() => getDailyStreak(), []);
  const [savedGames, setSavedGames] = useState(() => listSavedGames());

  const handleDelete = useCallback((key: string) => {
    deleteGame(key);
    setSavedGames((prev) => prev.filter((g) => g.key !== key));
  }, []);
  const isReturningUser = useMemo(
    () => savedGames.length > 0 || getStats().length > 0,
    [savedGames],
  );

  return (
    <div className="screen-content gap-4 sm:gap-8">
      <div className="flex flex-col items-center gap-1 sm:gap-2">
        <h1 className="heading-xl">Dokuel</h1>
        {!isReturningUser && (
          <p className="text-sm text-text-muted">
            1v1 sudoku duel — no account needed.
          </p>
        )}
      </div>
      {!isReturningUser && (
        <div className="flex flex-col gap-1.5 sm:gap-3 w-full">
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
      )}
      <div className="flex flex-col gap-3 sm:gap-6 w-full">
        {savedGames.length > 0 && (
          <div className="flex flex-col gap-3">
            <span className="label">Continue</span>
            {savedGames.map((game) => (
              <ContinueButton
                key={game.key}
                game={game}
                onClick={() => onContinue(game.key, game.difficulty)}
                onDelete={() => handleDelete(game.key)}
              />
            ))}
          </div>
        )}
        <div className="flex flex-col gap-3">
          <span className="label">Solo</span>
          <ActionButton label="Start Solo" onClick={onSolo} primary />
          <DailyChallengeButton
            onClick={onDaily}
            completed={completed}
            streak={streak.currentStreak}
            dateLabel={formatShortDate(today)}
          />
        </div>
        <div className="flex flex-col gap-3">
          <span className="label">Multiplayer</span>
          <ActionButton label="Create Game" onClick={onCreate} />
          <ActionButton label="Join Game" onClick={onJoin} />
        </div>
      </div>
      <button type="button" className="btn btn-ghost text-sm" onClick={onStats}>
        <span className="flex items-center gap-1.5">
          <StatsIcon />
          View Stats
        </span>
      </button>
      <a
        href="https://github.com/adrienbrault/sudoku"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-xs text-text-muted hover:text-accent transition-colors"
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
      <span className="text-sm text-text-muted">{text}</span>
    </div>
  );
}

function DailyChallengeButton({
  onClick,
  completed,
  streak,
  dateLabel,
}: {
  onClick: () => void;
  completed: boolean;
  streak: number;
  dateLabel: string;
}) {
  return (
    <button
      type="button"
      className="btn btn-lg btn-secondary w-full relative"
      onClick={onClick}
    >
      <span className="flex items-center justify-center gap-2">
        Daily Challenge
        <span className="text-sm font-normal text-text-muted">
          — {dateLabel}
        </span>
        {completed && (
          <svg
            className="w-5 h-5 text-emerald-500"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-label="Completed"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </span>
      {streak > 0 && (
        <span className="text-xs font-medium text-accent mt-0.5 block">
          {streak}-day streak
        </span>
      )}
    </button>
  );
}

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  expert: "Expert",
};

function progressPercent(game: SavedGameSummary): number {
  const remaining = 81 - game.givenCells;
  if (remaining === 0) return 100;
  const filled = game.filledCells - game.givenCells;
  return Math.round((filled / remaining) * 100);
}

function ContinueButton({
  game,
  onClick,
  onDelete,
}: {
  game: SavedGameSummary;
  onClick: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex gap-2 w-full">
      <button
        type="button"
        className="btn btn-lg btn-primary flex-1 min-w-0"
        onClick={onClick}
      >
        <span className="flex items-center justify-center gap-2">
          Continue
          <span className="text-sm font-normal opacity-80">
            {DIFFICULTY_LABELS[game.difficulty] ?? game.difficulty} ·{" "}
            {progressPercent(game)}% · {formatTime(game.timer)}
          </span>
        </span>
      </button>
      <button
        type="button"
        className="btn btn-lg btn-secondary px-3 shrink-0"
        onClick={onDelete}
        aria-label="Delete saved game"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 6L6 18" />
          <path d="M6 6l12 12" />
        </svg>
      </button>
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
      className={`btn btn-lg w-full ${primary ? "btn-primary" : "btn-secondary"}`}
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

function StatsIcon() {
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
