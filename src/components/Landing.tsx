import {
  BarChart3,
  CalendarDays,
  Check,
  ChevronRight,
  Flame,
  Globe,
  LogIn,
  Play,
  Plus,
  Trash2,
  Zap,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { DIFFICULTY_LABELS } from "../lib/constants.ts";
import { getDailyStreak, isDailyCompleted } from "../lib/daily-streak.ts";
import { formatShortDate, formatTime } from "../lib/format.ts";
import {
  deleteGame,
  listSavedGames,
  loadGame,
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
  const dailyProgress = useMemo(() => {
    if (completed) return null;
    const dailyKey = `daily-${today}-medium`;
    const game = loadGame(dailyKey);
    if (!game) return null;
    const givenCells = game.puzzle.split("").filter((c) => c !== ".").length;
    const filledCells = game.values.split("").filter((c) => c !== ".").length;
    const remaining = 81 - givenCells;
    if (remaining === 0) return null;
    const pct = Math.round(((filledCells - givenCells) / remaining) * 100);
    return pct > 0 ? pct : null;
  }, [today, completed]);

  const handleDelete = useCallback((key: string) => {
    deleteGame(key);
    setSavedGames((prev) => prev.filter((g) => g.key !== key));
  }, []);
  const isReturningUser = useMemo(
    () => savedGames.length > 0 || getStats().length > 0,
    [savedGames],
  );

  return (
    <div className="screen-content gap-7">
      <div className="flex flex-col items-center gap-4">
        <Logo />
        <div className="flex flex-col items-center gap-1.5">
          <h1 className="heading-xl">Dokuel</h1>
          {!isReturningUser && (
            <p className="caption text-center">
              1v1 sudoku duel — no account needed.
            </p>
          )}
        </div>
      </div>

      {!isReturningUser && (
        <div className="card w-full divide-y divide-border-default">
          <FeatureRow
            icon={<Zap size={18} aria-hidden="true" />}
            title="Real-time 1v1"
            text="Race a friend peer-to-peer"
          />
          <FeatureRow
            icon={<CalendarDays size={18} aria-hidden="true" />}
            title="Daily challenge"
            text="Same puzzle for everyone"
          />
          <FeatureRow
            icon={<Globe size={18} aria-hidden="true" />}
            title="Mobile & desktop"
            text="Dark mode, haptics, sounds"
          />
        </div>
      )}

      <div className="flex w-full flex-col gap-6">
        {savedGames.length > 0 && (
          <div className="flex flex-col gap-2.5">
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
        <div className="flex flex-col gap-2.5">
          <span className="label">Solo</span>
          <ActionButton
            label="Start Solo"
            icon={<Play size={18} aria-hidden="true" />}
            onClick={onSolo}
            primary
          />
          <DailyChallengeButton
            onClick={onDaily}
            completed={completed}
            streak={streak.currentStreak}
            dateLabel={formatShortDate(today)}
            progress={dailyProgress}
          />
        </div>
        <div className="flex flex-col gap-2.5">
          <span className="label">Multiplayer</span>
          <ActionButton
            label="Create Game"
            icon={<Plus size={18} aria-hidden="true" />}
            onClick={onCreate}
          />
          <ActionButton
            label="Join Game"
            icon={<LogIn size={18} aria-hidden="true" />}
            onClick={onJoin}
          />
        </div>
      </div>

      <button
        type="button"
        className="btn-ghost flex items-center gap-1.5 touch-manipulation"
        onClick={onStats}
      >
        <BarChart3 size={16} aria-hidden="true" />
        View Stats
      </button>
      <a
        href="https://github.com/adrienbrault/sudoku"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-xs text-text-muted transition-colors hover:text-accent"
      >
        <GitHubIcon />
        <span>Open source</span>
      </a>
    </div>
  );
}

function Logo() {
  return (
    <div
      className="flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg shadow-accent/30"
      style={{
        backgroundImage:
          "linear-gradient(to bottom right, var(--color-accent), var(--color-accent-strong))",
      }}
      aria-hidden="true"
    >
      <div className="grid grid-cols-3 gap-1">
        {Array.from({ length: 9 }, (_, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: static decorative grid
            key={i}
            className={`h-2 w-2 rounded-[3px] ${
              i === 0 || i === 4 || i === 8 || i === 5
                ? "bg-white"
                : "bg-white/35"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function FeatureRow({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="flex items-center gap-3.5 px-4 py-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
        {icon}
      </span>
      <span className="flex flex-col">
        <span className="text-sm font-semibold text-text-primary">{title}</span>
        <span className="text-xs text-text-muted">{text}</span>
      </span>
    </div>
  );
}

function DailyChallengeButton({
  onClick,
  completed,
  streak,
  dateLabel,
  progress,
}: {
  onClick: () => void;
  completed: boolean;
  streak: number;
  dateLabel: string;
  progress: number | null;
}) {
  const subtitle = completed
    ? "Completed today"
    : progress !== null
      ? `${dateLabel} · ${progress}% done`
      : dateLabel;

  return (
    <button
      type="button"
      className="btn btn-secondary flex w-full items-center gap-3.5 px-4 py-3 text-left"
      onClick={onClick}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
        <CalendarDays size={20} aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-semibold text-text-primary">Daily Challenge</span>
        <span className="truncate text-xs font-normal text-text-muted">
          {subtitle}
        </span>
      </span>
      {completed ? (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-text-on-accent">
          <Check size={14} strokeWidth={3} aria-label="Completed" />
        </span>
      ) : streak > 0 ? (
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-accent/10 px-2 py-1 text-xs font-bold text-accent">
          <Flame size={12} aria-hidden="true" />
          {streak}
        </span>
      ) : (
        <ChevronRight
          size={18}
          className="shrink-0 text-text-muted"
          aria-hidden="true"
        />
      )}
    </button>
  );
}

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
  const pct = progressPercent(game);
  return (
    <div className="flex w-full items-stretch gap-2">
      <button
        type="button"
        className="card press-spring-soft flex min-w-0 flex-1 flex-col gap-2 px-4 py-3 text-left ring-1 ring-accent/30 ring-inset"
        onClick={onClick}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 font-semibold text-text-primary">
            <Play size={15} className="text-accent" aria-hidden="true" />
            Continue
          </span>
          <span className="text-xs text-text-muted">
            {DIFFICULTY_LABELS[game.difficulty]} · {formatTime(game.timer)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-inset">
            <div
              className="h-full rounded-full bg-accent transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="w-9 shrink-0 text-right font-mono text-xs tabular-nums text-text-secondary">
            {pct}%
          </span>
        </div>
      </button>
      <button
        type="button"
        className="icon-btn w-12 shrink-0 border border-border-default bg-bg-raised"
        onClick={onDelete}
        aria-label="Delete saved game"
      >
        <Trash2 size={18} aria-hidden="true" />
      </button>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  icon,
  primary = false,
}: {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      className={`btn btn-lg flex w-full items-center justify-center gap-2.5 ${
        primary ? "btn-primary" : "btn-secondary"
      }`}
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
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
