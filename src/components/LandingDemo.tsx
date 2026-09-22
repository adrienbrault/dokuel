import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { DigitDragState } from "../hooks/useDigitDrag.ts";
import { liftForPointerType } from "../hooks/useDigitDrag.ts";
import { DIGITS } from "../lib/constants.ts";
import {
  type DemoFrame,
  demoFrame,
  LANDING_DEMO_PUZZLE,
  LANDING_DEMO_SCRIPT,
} from "../lib/landing-demo.ts";
import { Board } from "./Board.tsx";
import { NumPad } from "./NumPad.tsx";

const SCRIPT = LANDING_DEMO_SCRIPT;
const noop = () => {};

// A fingertip in stage pixels: about one numpad key wide, like a thumb.
const FINGER_PX = 60;
// A touch drag aims above the fingertip (see useDigitDrag); the demo
// finger sits that far below the cell it is dropping on, like a real one.
const TOUCH_LIFT_PX = liftForPointerType("touch");

function remainingCounts(frame: DemoFrame): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const n of DIGITS) counts[n] = 9;
  for (const row of frame.board) {
    for (const cell of row) {
      if (cell.value !== null) counts[cell.value] = counts[cell.value]! - 1;
    }
  }
  return counts;
}

function dragStateOf(frame: DemoFrame): DigitDragState | null {
  if (!frame.drag) return null;
  const { digit, row, col, mode } = frame.drag;
  return {
    digit,
    source: { kind: "numpad" },
    x: 0,
    y: 0,
    target: { row, col },
    invalidTarget: false,
    mode,
    lift: TOUCH_LIFT_PX,
  };
}

/**
 * Where the finger should sit for a frame, in unscaled stage pixels,
 * or null before layout (jsdom, first paint).
 */
function fingerPoint(
  stage: HTMLElement,
  frame: DemoFrame,
): { x: number; y: number } | null {
  const { finger } = frame;
  const target =
    finger.kind === "key"
      ? stage.querySelector(`[data-numpad-digit="${finger.digit}"]`)
      : stage.querySelector(
          `[data-row="${finger.row}"][data-col="${finger.col}"]`,
        );
  if (!target) return null;
  const stageRect = stage.getBoundingClientRect();
  const scale = stageRect.width / (stage.offsetWidth || 1);
  if (!scale) return null;
  const rect = target.getBoundingClientRect();
  const x = (rect.left - stageRect.left + rect.width / 2) / scale;
  let y = (rect.top - stageRect.top + rect.height / 2) / scale;
  if (finger.kind === "cell" && finger.half) {
    const quarter = rect.height / 4 / scale;
    y += (finger.half === "top" ? -quarter : quarter) + TOUCH_LIFT_PX;
  }
  return { x, y };
}

/**
 * The landing's self-playing tutorial: the real Board and NumPad,
 * scaled down and inert, driven by LANDING_DEMO_SCRIPT while a soft
 * fingertip shows each gesture and a caption names it.
 *
 * It never takes input: the stage is inert and pointer-transparent, so
 * no gesture hook fires (no sounds, no haptics) and nothing is saved.
 */
export function LandingDemo() {
  const [step, setStep] = useState(0);
  const frame = useMemo(
    () => demoFrame(SCRIPT, LANDING_DEMO_PUZZLE, step),
    [step],
  );

  useEffect(() => {
    const id = setTimeout(
      () => setStep((s) => (s + 1) % SCRIPT.length),
      SCRIPT[step]!.ms,
    );
    return () => clearTimeout(id);
  }, [step]);

  // Scale the full-size stage into the card's box. Measured, not fixed:
  // the real components pick their own layout per breakpoint.
  const boxRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<{ scale: number; height: number } | null>(
    null,
  );
  useLayoutEffect(() => {
    const box = boxRef.current;
    const stage = stageRef.current;
    if (!box || !stage) return;
    const update = () => {
      const w = stage.offsetWidth;
      if (!w || !box.clientWidth) return;
      const scale = box.clientWidth / w;
      setFit({ scale, height: stage.offsetHeight * scale });
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(box);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  const fingerRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const stage = stageRef.current;
    const finger = fingerRef.current;
    if (!stage || !finger || !fit) return;
    const point = fingerPoint(stage, frame);
    if (!point) return;
    finger.style.transform = `translate(${point.x - FINGER_PX / 2}px, ${point.y - FINGER_PX / 2}px)`;
    finger.style.opacity = "1";
  }, [frame, fit]);

  const pressing = frame.drag !== null || frame.finger.kind === "key";

  return (
    <div className="card w-full flex items-center gap-3.5 p-3 short:p-2.5 lg:flex-col lg:items-stretch">
      <div
        ref={boxRef}
        className="relative shrink-0 w-36 short:w-28 [@media(max-height:600px)]:w-24 sm:w-40 lg:w-60 lg:self-center overflow-hidden rounded-lg pointer-events-none"
        style={{ height: fit?.height ?? 0 }}
        aria-hidden="true"
        inert
      >
        <div
          ref={stageRef}
          className="absolute top-0 left-0 origin-top-left flex flex-col lg:flex-row items-center gap-2 lg:gap-4 w-max p-1"
          style={{
            transform: `scale(${fit?.scale ?? 0})`,
          }}
        >
          {/* The width a phone/tablet/desktop game board really has,
              so the viewport-sized digits keep their real proportions. */}
          <div className="w-[22rem] sm:w-[30rem] lg:w-[26rem]">
            <Board
              board={frame.board}
              selectedCell={frame.selectedCell}
              conflicts={frame.conflicts}
              highlightedDigit={frame.highlightedDigit}
              onSelectCell={noop}
              chargingDigit={frame.chargingDigit}
              dragState={dragStateOf(frame)}
            />
          </div>
          <NumPad
            position="bottom"
            remainingCounts={remainingCounts(frame)}
            selectedValue={frame.activeKey}
            showRemainingCounts={false}
            disableCompleted
            onTapNumber={noop}
          />
          <div
            ref={fingerRef}
            data-testid="landing-demo-finger"
            className="absolute top-0 left-0 rounded-full transition-[transform,opacity] duration-300 ease-out opacity-0"
            style={{ width: FINGER_PX, height: FINGER_PX }}
          >
            <span
              className={`absolute inset-0 rounded-full border-[3px] border-accent bg-accent/30 ring-2 ring-bg-primary/80 shadow-lg shadow-accent/40 transition-transform duration-150 ${pressing ? "scale-90" : "scale-100"}`}
            />
            <span
              key={step}
              className="absolute inset-0 rounded-full border-[3px] border-accent animate-demo-tap"
            />
          </div>
        </div>
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <span className="label">How to play</span>
        <p
          data-testid="landing-demo-caption"
          className="text-sm font-semibold leading-snug text-balance text-text-primary min-h-[2lh]"
          aria-hidden="true"
        >
          {frame.caption}
        </p>
        <span
          className="h-1 w-full rounded-full bg-bg-inset overflow-hidden"
          aria-hidden="true"
        >
          <span
            className="block h-full rounded-full bg-accent transition-[width] duration-300"
            style={{ width: `${((step + 1) / SCRIPT.length) * 100}%` }}
          />
        </span>
      </div>
    </div>
  );
}
