import { useEffect, useMemo, useState } from "react";
import { applyStepToBoard } from "../../lib/guides/apply-step.ts";
import type { Demo } from "../../lib/guides/types.ts";
import { Board } from "../Board.tsx";
import { DemoOverlays } from "./DemoOverlays.tsx";

const EMPTY_SET = new Set<number>();
const DEFAULT_HOLD_MS = 2500;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type TechniqueDemoProps = {
  demo: Demo;
};

export function TechniqueDemo({ demo }: TechniqueDemoProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const step = demo.steps[stepIndex]!;

  const board = useMemo(() => applyStepToBoard(demo, step), [demo, step]);
  const hintCells = useMemo(() => {
    const set = new Set<number>();
    for (const [key, overlays] of step.overlays) {
      if (overlays.some((o) => o.kind === "focus")) set.add(key);
    }
    return set;
  }, [step]);

  const goNext = () => setStepIndex((i) => (i + 1) % demo.steps.length);
  const goPrev = () =>
    setStepIndex((i) => (i - 1 + demo.steps.length) % demo.steps.length);

  useEffect(() => {
    if (!playing || prefersReducedMotion()) return;
    const t = setTimeout(
      () => setStepIndex((i) => (i + 1) % demo.steps.length),
      step.holdMs ?? DEFAULT_HOLD_MS,
    );
    return () => clearTimeout(t);
  }, [playing, stepIndex, step.holdMs, demo.steps.length]);

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="relative w-full max-w-lg mx-auto pointer-events-none">
        <Board
          board={board}
          selectedCell={null}
          conflicts={EMPTY_SET}
          hintCells={hintCells}
          onSelectCell={NOOP}
        />
        <DemoOverlays overlays={step.overlays} />
      </div>
      <p
        className="text-sm text-text-secondary leading-relaxed text-center"
        aria-live="polite"
      >
        {step.caption}
      </p>
      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={goPrev}
          aria-label="Previous step"
        >
          Prev
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? "Pause" : "Play"}
        </button>
        <span className="caption tabular-nums">
          {stepIndex + 1} / {demo.steps.length}
        </span>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={goNext}
          aria-label="Next step"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function NOOP() {}
