import {
  BarChart3,
  Calendar,
  Check,
  ChevronRight,
  Flame,
  Globe,
  Hash,
  Play,
  Swords,
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
    <div className="screen-content gap-5 sm:gap-7">
      <div className="flex flex-col items-center gap-3">
        <BrandMark />
        <h1 className="heading-xl">Dokuel</h1>
        {!isReturningUser && (
          <p className="text-sm text-text-secondary text-center">
            1v1 sudoku duel — no account needed.
          </p>
        )}
      </div>

      {!isReturningUser && (
        <div className="card flex flex-col w-full divide-y divide-border-default">
          <FeatureRow
            icon={<Zap size={18} aria-hidden="true" />}
            text="Real-time 1v1 — race a friend peer-to-peer"
          />
          <FeatureRow
            icon={<Calendar size={18} aria-hidden="true" />}
            text="Daily challenge — same puzzle for everyone"
          />
          <FeatureRow
            icon={<Globe size={18} aria-hidden="true" />}
            text="Mobile & desktop — dark mode, haptics, sounds"
          />
        </div>
      )}

      <div className="flex flex-col gap-5 w-full">
        {savedGames.length > 0 && (
          <Section label="Continue">
            {savedGames.map((game) => (
              <ContinueButton
                key={game.key}
                game={game}
                onClick={() => onContinue(game.key, game.difficulty)}
                onDelete={() => handleDelete(game.key)}
              />
            ))}
          </Section>
        )}

        <Section label="Solo">
          <button
            type="button"
            className="btn btn-lg btn-primary w-full flex items-center justify-center gap-2.5"
            onClick={onSolo}
          >
            <Play size={20} fill="currentColor" aria-hidden="true" />
            Start Solo
          </button>
          <DailyChallengeButton
            onClick={onDaily}
            completed={completed}
            streak={streak.currentStreak}
            dateLabel={formatShortDate(today)}
            progress={dailyProgress}
          />
        </Section>

        <Section label="Multiplayer">
          <RowButton
            icon={<Swords size={20} aria-hidden="true" />}
            title="Create Game"
            subtitle="Start a room and invite a friend"
            onClick={onCreate}
          />
          <RowButton
            icon={<Hash size={20} aria-hidden="true" />}
            title="Join Game"
            subtitle="Enter a room code to duel"
            onClick={onJoin}
          />
        </Section>
      </div>

      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          className="btn-ghost flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:text-accent transition-colors"
          onClick={onStats}
        >
          <BarChart3 size={16} aria-hidden="true" />
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

function BrandMark() {
  // Diagonal of filled cells reads as a sudoku grid in miniature.
  const filled = new Set([0, 4, 8]);
  return (
    <div
      className="grid grid-cols-3 gap-[3px] rounded-2xl p-2.5"
      style={{
        backgroundImage:
          "linear-gradient(to bottom right, oklch(0.6 0.13 168), oklch(0.46 0.11 168))",
        boxShadow: "0 10px 22px -10px oklch(0.52 0.13 168 / 0.45)",
      }}
      aria-hidden="true"
    >
      {Array.from({ length: 9 }, (_, i) => (
        <span
          key={i}
          className={`h-3 w-3 rounded-[3px] ${
            filled.has(i) ? "bg-white" : "bg-white/25"
          }`}
        />
      ))}
    </div>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <span className="label px-1">{label}</span>
      {children}
    </div>
  );
}

function FeatureRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3 px-3.5 py-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-light text-accent">
        {icon}
      </span>
      <span className="text-sm text-text-secondary">{text}</span>
    </div>
  );
}

function IconChip({
  children,
  accent = false,
}: {
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <span
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
        accent ? "text-text-on-accent" : "bg-accent-light text-accent"
      }`}
      style={
        accent
          ? {
              backgroundImage:
                "linear-gradient(to bottom right, oklch(0.58 0.13 168), oklch(0.48 0.115 168))",
            }
          : undefined
      }
      aria-hidden="true"
    >
      {children}
    </span>
  );
}

function RowButton({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="card flex items-center gap-3 w-full px-3.5 py-3 text-left press-spring-soft hover:bg-bg-raised transition-colors"
      onClick={onClick}
    >
      <IconChip>{icon}</IconChip>
      <span className="flex flex-col min-w-0 flex-1">
        <span className="font-semibold text-text-primary">{title}</span>
        <span className="text-xs text-text-muted truncate">{subtitle}</span>
      </span>
      <ChevronRight
        size={18}
        className="text-text-muted shrink-0"
        aria-hidden="true"
      />
    </button>
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
    ? `${dateLabel} · completed`
    : progress !== null
      ? `${dateLabel} · ${progress}% done`
      : dateLabel;

  return (
    <button
      type="button"
      className="card flex items-center gap-3 w-full px-3.5 py-3 text-left press-spring-soft hover:bg-bg-raised transition-colors"
      onClick={onClick}
    >
      <IconChip>
        <Calendar size={20} aria-hidden="true" />
      </IconChip>
      <span className="flex flex-col min-w-0 flex-1">
        <span className="flex items-center gap-1.5 font-semibold text-text-primary">
          Daily Challenge
          {completed && (
            <Check
              size={16}
              className="text-success"
              strokeWidth={3}
              aria-label="Completed"
            />
          )}
        </span>
        <span className="text-xs text-text-muted truncate">{subtitle}</span>
      </span>
      {streak > 0 && (
        <span className="flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-400 shrink-0">
          <Flame size={12} fill="currentColor" aria-hidden="true" />
          {streak}
        </span>
      )}
      <ChevronRight
        size={18}
        className="text-text-muted shrink-0"
        aria-hidden="true"
      />
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
    <div className="flex gap-2 w-full">
      <button
        type="button"
        className="card flex items-center gap-3 flex-1 min-w-0 px-3.5 py-3 text-left press-spring-soft hover:bg-bg-raised transition-colors"
        onClick={onClick}
      >
        <IconChip accent>
          <Play size={20} fill="currentColor" aria-hidden="true" />
        </IconChip>
        <span className="flex flex-col min-w-0 flex-1">
          <span className="font-semibold text-text-primary">Continue</span>
          <span className="text-xs text-text-muted truncate">
            {DIFFICULTY_LABELS[game.difficulty]} · {pct}% ·{" "}
            {formatTime(game.timer)}
          </span>
          <span className="mt-1.5 h-1.5 w-full rounded-full bg-bg-raised overflow-hidden">
            <span
              className="block h-full rounded-full bg-accent"
              style={{ width: `${pct}%` }}
            />
          </span>
        </span>
      </button>
      <button
        type="button"
        className="btn btn-secondary px-3 shrink-0 flex items-center justify-center"
        onClick={onDelete}
        aria-label="Delete saved game"
      >
        <Trash2 size={18} aria-hidden="true" />
      </button>
    </div>
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
