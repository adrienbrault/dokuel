import { useEffect, useMemo, useRef, useState } from "react";
import { formatTime } from "../lib/format.ts";
import {
  changedCellsAt,
  progressTimeline,
  type ReplayFrame,
  replayAt,
  replayDuration,
} from "../lib/replay.ts";
import { ReplayBoard } from "./ReplayBoard.tsx";
import { ReplayTimeline } from "./ReplayTimeline.tsx";

export type ReplayPlayer = {
  id: string;
  name: string;
  color: string;
  won: boolean;
  /** Null until this player's client has shared its replay. */
  frames: ReplayFrame[] | null;
};

type MatchReplayProps = {
  puzzle: string;
  solution: string | null;
  /** Left of the compare divider first, right second. */
  players: [ReplayPlayer, ReplayPlayer];
  onClose: () => void;
};

const SPEEDS = [4, 16, 64];
const DEFAULT_SPEED = 16;

function usePlayback(duration: number) {
  // Opens on the finished boards: the end is what both players just
  // lived through, and the scrubber is right there to go back.
  const [t, setT] = useState(duration);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(DEFAULT_SPEED);

  useEffect(() => {
    if (!playing) return;
    let last: number | null = null;
    let id = requestAnimationFrame(function step(now) {
      if (last !== null) {
        const dt = (now - last) * speed;
        setT((prev) => Math.min(duration, prev + dt));
      }
      last = now;
      id = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(id);
  }, [playing, speed, duration]);

  useEffect(() => {
    if (playing && t >= duration) setPlaying(false);
  }, [playing, t, duration]);

  return {
    t,
    playing,
    speed,
    scrub(next: number) {
      setPlaying(false);
      setT(next);
    },
    toggle() {
      if (!playing && t >= duration) setT(0);
      setPlaying(!playing);
    },
    cycleSpeed() {
      setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]!);
    },
  };
}

/**
 * Both players' games side by side in time: one board, split by a
 * divider the player drags to wipe between their board and the
 * opponent's, over a scrubber that charts the race.
 */
export function MatchReplay({
  puzzle,
  solution,
  players,
  onClose,
}: MatchReplayProps) {
  const duration = Math.max(
    ...players.map((p) => (p.frames ? replayDuration(p.frames) : 0)),
  );
  const playback = usePlayback(duration);
  const total = useMemo(
    () => puzzle.split("").filter((c) => c === ".").length,
    [puzzle],
  );
  const series = useMemo(
    () =>
      players.flatMap((p) =>
        p.frames
          ? [
              {
                id: p.id,
                color: p.color,
                points: progressTimeline(puzzle, p.frames),
              },
            ]
          : [],
      ),
    [players, puzzle],
  );
  const [left, right] = players;
  const shared = players.filter((p) => p.frames !== null);
  const waiting = players.filter((p) => p.frames === null);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-bg-primary animate-modal-content"
      style={{
        paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)",
      }}
    >
      <div className="mx-auto flex w-full max-w-[min(100vw-2rem,28rem)] flex-col gap-3">
        <div className="flex items-center justify-between">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            ← Results
          </button>
          <h2 className="heading">Replay</h2>
          <span className="w-20" aria-hidden="true" />
        </div>

        <div className="flex items-center justify-between gap-2">
          {players.map((p) => (
            <PlayerChip
              key={p.id}
              player={p}
              filled={
                p.frames ? filledAt(puzzle, p.frames, playback.t) : undefined
              }
              total={total}
            />
          ))}
        </div>

        {shared.length === 2 ? (
          <CompareBoards
            puzzle={puzzle}
            solution={solution}
            left={left}
            right={right}
            t={playback.t}
          />
        ) : (
          shared.map((p) => (
            <ReplayBoard
              key={p.id}
              board={replayAt(puzzle, p.frames ?? [], playback.t)}
              solution={solution}
              changed={changedCellsAt(p.frames ?? [], playback.t)}
              label={`Board: ${p.name}`}
            />
          ))
        )}
        {waiting.map((p) => (
          <p key={p.id} className="caption text-center">
            Waiting for {p.name}'s replay…
          </p>
        ))}

        <ReplayTimeline
          series={series}
          total={total}
          duration={duration}
          t={playback.t}
          onScrub={playback.scrub}
        />
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            className="btn btn-md btn-primary min-w-20"
            onClick={playback.toggle}
          >
            {playback.playing ? "Pause" : "Play"}
          </button>
          <span className="whitespace-nowrap font-mono tabular-nums text-xs text-text-secondary sm:text-sm">
            {formatTime(Math.floor(playback.t / 1000))} /{" "}
            {formatTime(Math.floor(duration / 1000))}
          </span>
          <button
            type="button"
            className="btn btn-md btn-secondary min-w-14"
            aria-label={`Playback speed ${playback.speed}×`}
            onClick={playback.cycleSpeed}
          >
            {playback.speed}×
          </button>
        </div>
      </div>
    </div>
  );
}

function filledAt(puzzle: string, frames: ReplayFrame[], t: number): number {
  let filled = 0;
  for (const p of progressTimeline(puzzle, frames)) {
    if (p.t > t) break;
    filled = p.filled;
  }
  return filled;
}

function PlayerChip({
  player,
  filled,
  total,
}: {
  player: ReplayPlayer;
  filled: number | undefined;
  total: number;
}) {
  return (
    <div className="flex min-w-0 flex-1 basis-0 items-center gap-1.5 rounded-full bg-bg-inset px-2.5 py-1 text-sm last:justify-end">
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: player.color }}
        aria-hidden="true"
      />
      <span className="truncate font-semibold text-text-primary">
        {player.name}
      </span>
      {player.won && (
        <span role="img" aria-label="winner" className="shrink-0">
          🏆
        </span>
      )}
      {filled !== undefined && (
        <span className="shrink-0 font-mono tabular-nums text-text-muted">
          {filled}/{total}
        </span>
      )}
    </div>
  );
}

/**
 * The two boards stacked, the right-hand player's clipped to the right
 * of the divider. Dragging anywhere on the board moves the divider;
 * a visually hidden range input carries it for keyboards and screen
 * readers.
 */
function CompareBoards({
  puzzle,
  solution,
  left,
  right,
  t,
}: {
  puzzle: string;
  solution: string | null;
  left: ReplayPlayer;
  right: ReplayPlayer;
  t: number;
}) {
  const [wipe, setWipe] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const wipeTo = (clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setWipe(Math.min(100, Math.max(0, pct)));
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full touch-pan-y select-none cursor-ew-resize"
      onPointerDown={(e) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        wipeTo(e.clientX);
      }}
      onPointerMove={(e) => {
        if (dragging.current) wipeTo(e.clientX);
      }}
      onPointerUp={() => {
        dragging.current = false;
      }}
      onPointerCancel={() => {
        dragging.current = false;
      }}
    >
      <ReplayBoard
        board={replayAt(puzzle, left.frames ?? [], t)}
        solution={solution}
        changed={changedCellsAt(left.frames ?? [], t)}
        label={`Board: ${left.name}`}
      />
      <div
        className="absolute inset-0"
        style={{ clipPath: `inset(0 0 0 ${wipe}%)` }}
      >
        <ReplayBoard
          board={replayAt(puzzle, right.frames ?? [], t)}
          solution={solution}
          changed={changedCellsAt(right.frames ?? [], t)}
          label={`Board: ${right.name}`}
        />
      </div>
      <div
        className="pointer-events-none absolute inset-y-0 w-[3px] -translate-x-1/2"
        style={{
          left: `${wipe}%`,
          background: `linear-gradient(to right, ${left.color} 50%, ${right.color} 50%)`,
        }}
        aria-hidden="true"
      >
        <span className="absolute top-1/2 left-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border-default bg-surface text-xs text-text-secondary shadow-md">
          ⇆
        </span>
      </div>
      <input
        type="range"
        aria-label="Compare boards"
        min={0}
        max={100}
        value={Math.round(wipe)}
        onChange={(e) => setWipe(Number(e.target.value))}
        className="sr-only"
      />
    </div>
  );
}
