import {
  BarChart3,
  CalendarDays,
  Check,
  ChevronRight,
  Flame,
  LogIn,
  Play,
  Smartphone,
  Swords,
  X,
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
    <div className="screen-content gap-6 sm:gap-7">
      <header className="flex flex-col items-center gap-3">
        <BrandMark />
        <div className="flex flex-col items-center gap-1.5">
          <h1 className="heading-xl">Dokuel</h1>
          {!isReturningUser && (
            <p className="text-sm text-text-muted text-center">
              1v1 sudoku duel — no account needed.
            </p>
          )}
        </div>
      </header>

      {!isReturningUser && (
        <div className="grid grid-cols-3 gap-2 w-full">
          <FeatureChip icon={<Zap size={17} />} label="Real-time 1v1" />
          <FeatureChip icon={<CalendarDays size={17} />} label="Daily puzzle" />
          <FeatureChip icon={<Smartphone size={17} />} label="Any device" />
        </div>
      )}

      <div className="flex flex-col gap-2.5 w-full">
        {savedGames.length > 0 && (
          <div className="flex flex-col gap-2.5">
            <span className="label">Continue</span>
            {savedGames.map((game) => (
              <ContinueCard
                key={game.key}
                game={game}
                onClick={() => onContinue(game.key, game.difficulty)}
                onDelete={() => handleDelete(game.key)}
              />
            ))}
          </div>
        )}

        <MenuRow
          primary
          icon={
            <Play size={20} fill="currentColor" className="translate-x-px" />
          }
          title="Start Solo"
          subtitle="Pick a difficulty and play"
          onClick={onSolo}
        />

        <DailyChallengeCard
          onClick={onDaily}
          completed={completed}
          streak={streak.currentStreak}
          dateLabel={formatShortDate(today)}
          progress={dailyProgress}
        />

        <MenuRow
          icon={<Swords size={19} />}
          title="Create Game"
          subtitle="Host a real-time 1v1 duel"
          onClick={onCreate}
        />
        <MenuRow
          icon={<LogIn size={19} />}
          title="Join Game"
          subtitle="Enter a friend's room code"
          onClick={onJoin}
        />
      </div>

      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          className="btn-ghost flex items-center gap-1.5"
          onClick={onStats}
        >
          <BarChart3 size={15} aria-hidden="true" />
          View Stats
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
    </div>
  );
}

function GitHubIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

const MARK_CELLS = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];

function BrandMark() {
  return (
    <div
      className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[oklch(0.62_0.13_166)] to-[oklch(0.47_0.12_172)]"
      style={{ boxShadow: "var(--shadow-accent)" }}
      aria-hidden="true"
    >
      <div className="grid grid-cols-3 gap-[3px]">
        {MARK_CELLS.map((cell, i) => (
          <span
            key={cell}
            className="h-1.5 w-1.5 rounded-[2px] bg-white"
            style={{ opacity: i % 2 === 0 ? 1 : 0.5 }}
          />
        ))}
      </div>
    </div>
  );
}

function FeatureChip({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-xl bg-bg-raised border border-border-default px-1.5 py-3 text-center">
      <span className="text-accent" aria-hidden="true">
        {icon}
      </span>
      <span className="text-[11px] font-medium leading-tight text-text-secondary">
        {label}
      </span>
    </div>
  );
}

function MenuRow({
  icon,
  title,
  subtitle,
  onClick,
  primary = false,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
  primary?: boolean;
}) {
  if (primary) {
    return (
      <button
        type="button"
        className="btn btn-primary flex items-center gap-3.5 w-full px-3.5 py-3 text-left"
        onClick={onClick}
      >
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15"
          aria-hidden="true"
        >
          {icon}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-lg font-bold leading-tight">{title}</span>
          <span className="block text-[13px] font-medium text-white/75">
            {subtitle}
          </span>
        </span>
        <ChevronRight
          size={20}
          className="text-white/55 shrink-0"
          aria-hidden="true"
        />
      </button>
    );
  }
  return (
    <button
      type="button"
      className="card flex items-center gap-3.5 w-full px-3.5 py-3 text-left press-spring-soft"
      onClick={onClick}
    >
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent"
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-base font-semibold leading-tight text-text-primary">
          {title}
        </span>
        <span className="block text-[13px] text-text-muted">{subtitle}</span>
      </span>
      <ChevronRight
        size={20}
        className="text-text-muted shrink-0"
        aria-hidden="true"
      />
    </button>
  );
}

function DailyChallengeCard({
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
    ? `${dateLabel} · Completed`
    : progress !== null
      ? `${dateLabel} · ${progress}% done`
      : `${dateLabel} · One puzzle, everyone`;

  return (
    <button
      type="button"
      className="card flex items-center gap-3.5 w-full px-3.5 py-3 text-left press-spring-soft"
      onClick={onClick}
    >
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent"
        aria-hidden="true"
      >
        <CalendarDays size={19} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-1.5">
          <span className="text-base font-semibold leading-tight text-text-primary">
            Daily Challenge
          </span>
          {completed && (
            <Check size={15} className="text-success" aria-label="Completed" />
          )}
        </span>
        <span className="block text-[13px] text-text-muted">{subtitle}</span>
      </span>
      {streak > 0 ? (
        <span className="flex items-center gap-1 rounded-full bg-accent/12 px-2 py-1 text-xs font-bold text-accent shrink-0">
          <Flame size={13} aria-hidden="true" />
          {streak}
        </span>
      ) : (
        <ChevronRight
          size={20}
          className="text-text-muted shrink-0"
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

function ContinueCard({
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
    <div className="card relative flex items-center gap-2 w-full pl-3.5 pr-2 py-3 overflow-hidden">
      <button
        type="button"
        className="flex flex-1 items-center gap-3.5 min-w-0 text-left press-spring-soft"
        onClick={onClick}
      >
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent"
          aria-hidden="true"
        >
          <Play size={18} fill="currentColor" className="translate-x-px" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-base font-semibold leading-tight text-text-primary">
            Continue
          </span>
          <span className="block text-[13px] text-text-muted">
            {DIFFICULTY_LABELS[game.difficulty]} · {pct}% ·{" "}
            {formatTime(game.timer)}
          </span>
        </span>
      </button>
      <button
        type="button"
        className="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg text-text-muted hover:bg-bg-inset hover:text-text-primary transition-colors touch-manipulation"
        onClick={onDelete}
        aria-label="Delete saved game"
      >
        <X size={16} aria-hidden="true" />
      </button>
      <span
        aria-hidden="true"
        className="absolute left-0 bottom-0 h-[3px] bg-accent rounded-full"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
