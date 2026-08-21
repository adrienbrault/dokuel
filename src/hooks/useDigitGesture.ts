import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { haptics } from "../lib/haptics.ts";
import {
  cellHitFromPoint,
  classifyPan,
  type DigitDropMode,
  digitButtonAt,
  HOLD_MS,
  liftForPointerType,
  skimDigitOf,
  skimHandoffDigit,
} from "../lib/numpad-gesture.ts";
import type { NumPadPosition, Position } from "../lib/types.ts";

/** Where the digit a drag carries was picked up. */
export type DigitDragSource =
  | { kind: "numpad" }
  | { kind: "cell"; row: number; col: number };

export type DigitDragState = {
  digit: number;
  source: DigitDragSource;
  x: number;
  y: number;
  target: Position | null;
  invalidTarget: boolean;
  /** Which slot the current pointer position would land in. */
  mode: DigitDropMode;
  /**
   * Hit-test/chip offset above the pointer, in CSS pixels. Non-zero
   * only for touch — see liftForPointerType.
   */
  lift: number;
};

/** A completed drop, in the terms digitIntent asks about. */
export type DigitDrop = {
  digit: number;
  /** Which half of the cell the digit landed in. */
  mode: DigitDropMode;
  target: Position;
  /** The cell the digit was dragged from, or null for the numpad. */
  from: Position | null;
};

/** Pointer handlers one digit button must spread onto itself. */
export type NumPadKeyProps = {
  onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerUp: () => void;
  onPointerLeave: () => void;
  onPointerCancel: () => void;
  onClick: () => void;
};

type Options = {
  /** Which edge of the screen the numpad sits on; sets the pad's axis. */
  position: NumPadPosition;
  /** When true (paused, game over, ...), drag-starts and drops no-op. */
  disabled?: boolean | undefined;
  /** A quick tap — pointerup before the hold threshold, or an AT click. */
  onTap: (n: number) => void;
  /** Fires after HOLD_MS while still pressed. */
  onHold?: ((n: number) => void) | undefined;
  // An absent onSkim means the skim is not recognized at all: every
  // classified pan then resolves to a drag.
  /** An along-axis skim crossed onto `n`. */
  onSkim?: ((n: number) => void) | undefined;
  /** The press is over: pointerup/cancel/leave, or a promotion to a drag. */
  onEnd?: (() => void) | undefined;
  /** Which cells a carried digit may land in. */
  isDroppable: (row: number, col: number, digit: number) => boolean;
  /** A drag released over a droppable cell. */
  onDrop: (drop: DigitDrop) => void;
};

/** Which pointer the document listeners follow, and in which phase. */
type Tracking = { pointerId: number; phase: "skim" | "drag" };

/** Everything a drag needs to know at the moment it takes over. */
type DragStart = {
  digit: number;
  source: DigitDragSource;
  x: number;
  y: number;
  pointerId: number;
  pointerType: string;
};

/**
 * The gesture recognizer: one module for the whole life of a pressed
 * digit. A press resolves into a tap, a hold, an along-axis skim, or a
 * drag toward the board; a skim that leaves the pad is PROMOTED to a
 * drag; a numpad-sourced drag brought back over the digits is DEMOTED
 * to a skim; a drag released over a droppable cell lands a `DigitDrop`.
 * `startCellDrag` enters the same machine from a filled board cell.
 *
 * It lives at the game level rather than inside the numpad, because
 * the digit's journey does not stop at the pad's edge: recognizing the
 * promotion in one place and the demotion in another turned a single
 * transition of a single gesture into a React imperative ref between a
 * hook and a component.
 *
 * Caller contract: spread `keyProps(n)` on digit button `n`, marked
 * `data-numpad-digit={n}` (skim and demote hit-test that attribute and
 * skip `disabled` buttons); attach `groupRef` to the wrapper around the
 * digit buttons, or the promotion never fires (its board-facing edge is
 * the promotion boundary); render `pressedDigit` as the press visual —
 * it follows the finger across skim transitions, and is null while a
 * drag carries the digit. Board cells are found by `data-row`/
 * `data-col`.
 *
 * Callbacks are read at event time, so they need not be stable; every
 * returned function is.
 */
export function useDigitGesture(options: Options) {
  // Press visual — not CSS :active, which sticks after capture release.
  const [pressedDigit, setPressedDigit] = useState<number | null>(null);
  const [dragState, setDragState] = useState<DigitDragState | null>(null);
  // The one gesture the document listeners below follow, if any.
  const [tracking, setTracking] = useState<Tracking | null>(null);
  // The digit-button row; its board-facing edge promotes a skim.
  const groupRef = useRef<HTMLDivElement>(null);

  // Latest options, so listeners never go stale and every export is
  // stable: nothing below reads a prop except through this ref.
  const cbRef = useRef(options);
  cbRef.current = options;

  const pressRef = useRef<{
    digit: number;
    timer: ReturnType<typeof setTimeout> | null;
    originX: number;
    originY: number;
    pointerId: number;
    button: HTMLButtonElement;
    // No "drag": the promotion forgets the press, so a live one is
    // either still unclassified or skimming.
    gestureMode: "none" | "skim";
    holdFired: boolean;
    /** Whether the press owns the pointer — see beginPress. */
    captured: boolean;
  } | null>(null);
  // Suppresses the synthetic click after pointerup, so onTap fires once.
  const pointerFiredRef = useRef(false);
  // Last digit the finger was over while skimming, seeded to the pressed
  // digit so onSkim doesn't re-fire for the digit it started on.
  const skimDigitRef = useRef<number | null>(null);
  // pointerType of the live gesture: it decides the touch lift, and a
  // promotion carries it from the press into the drag.
  const pointerTypeRef = useRef("touch");
  // Live mirror of `dragState` for the document listeners (and the drop
  // logic), updated at every transition rather than on render: a final
  // pointermove and the pointerup can land inside one React batch, and
  // a render-synced ref would still hold the previous target then.
  const dragRef = useRef<DigitDragState | null>(null);
  // Latches true once the drag's finger has been seen off the numpad.
  // Only then does a return over the numpad demote the drag — a drag
  // classified while the finger still covers its numpad button would
  // otherwise cancel itself on the very next move.
  const leftNumpadRef = useRef(false);

  const applyDrag = useCallback(
    (updater: (prev: DigitDragState | null) => DigitDragState | null): void => {
      const next = updater(dragRef.current);
      dragRef.current = next;
      setDragState(next);
    },
    [],
  );

  const cancelTimer = useCallback(() => {
    if (pressRef.current?.timer) {
      clearTimeout(pressRef.current.timer);
      pressRef.current.timer = null;
    }
  }, []);

  /** Arms document-level skim tracking for `digit` under `pointerId`. */
  const beginSkim = useCallback((digit: number, pointerId: number) => {
    skimDigitRef.current = digit;
    setTracking({ pointerId, phase: "skim" });
  }, []);

  /**
   * Hands the gesture to a drag, or answers false when the game is not
   * accepting one — paused or over. On success the document listeners
   * follow the same pointer in the drag phase.
   */
  const startDrag = useCallback(
    ({ digit, source, x, y, pointerId, pointerType }: DragStart): boolean => {
      if (cbRef.current.disabled) return false;
      const lift = liftForPointerType(pointerType);
      pointerTypeRef.current = pointerType;
      leftNumpadRef.current = false;
      const hit = cellHitFromPoint(x, y, lift);
      const invalid =
        hit !== null &&
        !cbRef.current.isDroppable(hit.position.row, hit.position.col, digit);
      applyDrag(() => ({
        digit,
        source,
        x,
        y,
        target: hit?.position ?? null,
        invalidTarget: invalid,
        mode: hit?.mode ?? "value",
        lift,
      }));
      setTracking({ pointerId, phase: "drag" });
      return true;
    },
    [applyDrag],
  );

  const endDrag = useCallback(
    (commit: boolean) => {
      // Side effects stay OUT of setState: updaters are double-invoked
      // under StrictMode, and a note drop is a toggle — calling onDrop
      // inside the updater made dropped pencil marks vanish in dev
      // builds.
      const current = dragRef.current;
      applyDrag(() => null);
      if (!commit || !current?.target || current.invalidTarget) return;
      // The game can go away mid-drag (a pause, a win): nothing lands.
      if (cbRef.current.disabled) return;
      cbRef.current.onDrop({
        digit: current.digit,
        mode: current.mode,
        target: current.target,
        from:
          current.source.kind === "cell"
            ? { row: current.source.row, col: current.source.col }
            : null,
      });
    },
    [applyDrag],
  );

  const endSkim = useCallback(() => {
    skimDigitRef.current = null;
    setPressedDigit(null);
    cbRef.current.onEnd?.();
  }, []);

  /**
   * Folds a drag that has been brought back over the digits into a live
   * skim: highlights `digit`, restores the press visual, and re-arms
   * document-level tracking under the same pointer.
   */
  const resumeSkim = useCallback(
    (digit: number, pointerId: number) => {
      setPressedDigit(digit);
      cbRef.current.onSkim?.(digit);
      haptics.tap();
      beginSkim(digit, pointerId);
    },
    [beginSkim],
  );

  const trackSkim = useCallback(
    (e: PointerEvent, ownPointerId: number) => {
      const btn = digitButtonAt(e.clientX, e.clientY);

      // Off the digit row toward the board: promote the skim into a
      // drag, so one continuous gesture picks a digit and drops it.
      const handoff = skimHandoffDigit(
        btn !== null,
        groupRef.current,
        skimDigitRef.current,
        cbRef.current.position,
        e.clientX,
        e.clientY,
      );
      if (handoff !== null) {
        skimDigitRef.current = null;
        // The drag ghost now shows the digit; the key stops claiming it.
        setPressedDigit(null);
        haptics.tap();
        const started = startDrag({
          digit: handoff,
          source: { kind: "numpad" },
          x: e.clientX,
          y: e.clientY,
          pointerId: ownPointerId,
          pointerType: pointerTypeRef.current,
        });
        if (!started) setTracking(null);
        cbRef.current.onEnd?.();
        return;
      }

      const digit = skimDigitOf(btn);
      if (digit === null || digit === skimDigitRef.current) return;
      skimDigitRef.current = digit;
      setPressedDigit(digit);
      haptics.light();
      cbRef.current.onSkim?.(digit);
    },
    [startDrag],
  );

  const trackDrag = useCallback(
    (e: PointerEvent, ownPointerId: number) => {
      const current = dragRef.current;
      if (!current) return;

      // A numpad-sourced drag brought back over the numpad digits —
      // after having left them — is demoted: cancel the drag and resume
      // the skim, so the finger goes on highlighting. The raw pointer
      // point, not the lifted aim point: re-entry is decided by the
      // finger itself, not by the cell it points at.
      if (current.source.kind === "numpad") {
        const numpadDigit = skimDigitOf(digitButtonAt(e.clientX, e.clientY));
        if (numpadDigit === null) {
          leftNumpadRef.current = true;
        } else if (leftNumpadRef.current) {
          endDrag(false);
          resumeSkim(numpadDigit, ownPointerId);
          return;
        }
      }

      const hit = cellHitFromPoint(e.clientX, e.clientY, current.lift);
      const invalid =
        hit !== null &&
        !cbRef.current.isDroppable(
          hit.position.row,
          hit.position.col,
          current.digit,
        );
      applyDrag((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          x: e.clientX,
          y: e.clientY,
          target: hit?.position ?? null,
          invalidTarget: invalid,
          mode: hit?.mode ?? "value",
        };
      });
    },
    [applyDrag, endDrag, resumeSkim],
  );

  // ONE set of document listeners for the whole gesture: the skim and
  // the drag are two phases of the same press, and a promotion or
  // demotion just re-keys this effect onto the other phase.
  useEffect(() => {
    if (tracking === null) return;
    const { pointerId: ownPointerId, phase } = tracking;

    const finish = (commit: boolean) => {
      if (phase === "drag") endDrag(commit);
      else endSkim();
      setTracking(null);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== ownPointerId) return;
      e.preventDefault();
      if (phase === "drag") trackDrag(e, ownPointerId);
      else trackSkim(e, ownPointerId);
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerId === ownPointerId) finish(true);
    };
    const onCancel = (e: PointerEvent) => {
      if (e.pointerId === ownPointerId) finish(false);
    };
    // Escape abandons a carried digit; a skim has nothing to abandon.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && phase === "drag") finish(false);
    };

    document.addEventListener("pointermove", onMove, { passive: false });
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onCancel);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onCancel);
      document.removeEventListener("keydown", onKey);
    };
  }, [tracking, trackDrag, trackSkim, endDrag, endSkim]);

  const beginPress = useCallback(
    (n: number, e: ReactPointerEvent<HTMLButtonElement>) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      cancelTimer();
      pointerFiredRef.current = true;
      setPressedDigit(n);
      pointerTypeRef.current = e.pointerType;
      const btn = e.currentTarget;
      // Claim the pointer for the whole unclassified phase. A mouse gets
      // no implicit capture, so a press landing near a key's edge would
      // otherwise cross the boundary within the slop, and the button's
      // pointerleave would cancel a gesture that had not been read yet.
      // Classification hands the pointer back so document-level tracking
      // can follow the gesture across the pad.
      let captured = false;
      if (typeof btn.setPointerCapture === "function") {
        try {
          btn.setPointerCapture(e.pointerId);
          captured = true;
        } catch {
          // ignore — the pointer may already be gone
        }
      }
      const timer = cbRef.current.onHold
        ? setTimeout(() => {
            const press = pressRef.current;
            if (press) {
              press.timer = null;
              press.holdFired = true;
            }
            haptics.tap();
            cbRef.current.onHold?.(n);
          }, HOLD_MS)
        : null;
      pressRef.current = {
        digit: n,
        timer,
        originX: e.clientX,
        originY: e.clientY,
        pointerId: e.pointerId,
        button: btn,
        gestureMode: "none",
        holdFired: false,
        captured,
      };
    },
    [cancelTimer],
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      const press = pressRef.current;
      if (!press || press.gestureMode !== "none") return;
      if (e.pointerId !== press.pointerId) return;
      const mode = classifyPan({
        dx: e.clientX - press.originX,
        dy: e.clientY - press.originY,
        position: cbRef.current.position,
        skimEnabled: cbRef.current.onSkim !== undefined,
        // The recognizer owns the drop, so a drag is always available.
        dragEnabled: true,
      });
      if (mode === null) return;

      cancelTimer();
      // pointerFiredRef stays set: a gesture released back over the key
      // it started on still ends with a browser click on that key, and
      // that click is the tail of THIS gesture, not an AT activation —
      // handleClick must swallow it rather than tap.
      // Release pointer capture so document-level listeners can see moves
      // outside this button.
      try {
        press.button.releasePointerCapture(e.pointerId);
      } catch {
        // ignore — some browsers don't capture by default
      }
      haptics.tap();

      if (mode === "drag") {
        // The drag owns the gesture from here, and the press is over.
        // Forgetting it now — the same thing endPress does for a skim —
        // keeps the release the button still receives from ending a
        // press that has already ended.
        pressRef.current = null;
        setPressedDigit(null);
        const started = startDrag({
          digit: press.digit,
          source: { kind: "numpad" },
          x: e.clientX,
          y: e.clientY,
          pointerId: e.pointerId,
          pointerType: e.pointerType,
        });
        if (!started) setTracking(null);
        cbRef.current.onEnd?.();
      } else {
        press.gestureMode = "skim";
        beginSkim(press.digit, e.pointerId);
      }
    },
    [beginSkim, cancelTimer, startDrag],
  );

  // End-of-press cleanup. `commit` is true only for pointerup: a release
  // that never became a hold, drag, or skim commits the tapped value; a
  // pointerleave/cancel is a cancel. A skim's end is owned by the
  // document listeners above, so we only detach button state here.
  const endPress = useCallback(
    (commit: boolean) => {
      const press = pressRef.current;
      if (!press) return;
      if (press.gestureMode === "skim") {
        pressRef.current = null;
        return;
      }
      cancelTimer();
      if (commit && !press.holdFired && press.gestureMode === "none") {
        cbRef.current.onTap(press.digit);
      }
      pressRef.current = null;
      setPressedDigit(null);
      cbRef.current.onEnd?.();
    },
    [cancelTimer],
  );

  // A capturing browser cannot send this while the press is still
  // unclassified — every move keeps targeting the pressed button until
  // classification releases the pointer. Ignoring it states that
  // invariant; where capture is unavailable the leave still cancels.
  const handlePointerLeave = useCallback(() => {
    const press = pressRef.current;
    if (press?.captured && press.gestureMode === "none") return;
    endPress(false);
  }, [endPress]);

  const handleClick = useCallback((n: number) => {
    if (pointerFiredRef.current) {
      pointerFiredRef.current = false;
      return;
    }
    // Keyboard/AT activation: no pointer events fired, so honor click.
    cbRef.current.onTap(n);
  }, []);

  const keyProps = useCallback(
    (n: number): NumPadKeyProps => ({
      onPointerDown: (e) => beginPress(n, e),
      onPointerMove: handlePointerMove,
      onPointerUp: () => endPress(true),
      onPointerLeave: handlePointerLeave,
      onPointerCancel: () => endPress(false),
      onClick: () => handleClick(n),
    }),
    [beginPress, handlePointerMove, endPress, handlePointerLeave, handleClick],
  );

  /** The other way in: a long-press on a filled cell carries its digit. */
  const startCellDrag = useCallback(
    (args: {
      digit: number;
      from: Position;
      x: number;
      y: number;
      pointerId: number;
      pointerType: string;
    }) => {
      startDrag({
        digit: args.digit,
        source: { kind: "cell", row: args.from.row, col: args.from.col },
        x: args.x,
        y: args.y,
        pointerId: args.pointerId,
        pointerType: args.pointerType,
      });
    },
    [startDrag],
  );

  return { keyProps, groupRef, pressedDigit, dragState, startCellDrag };
}
