import { ChevronLeft, Settings, X } from "lucide-react";
import {
  type PointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { KEYBOARD_SHORTCUTS } from "../hooks/useKeyboard.ts";
import type { NumPadPosition } from "../lib/types.ts";
import { NumPadPositionToggle } from "./NumPadPositionToggle.tsx";

type GameLayoutProps = {
  onBack: () => void;
  timer: ReactNode;
  numPad: ReactNode;
  board: ReactNode;
  controls: ReactNode;
  position: NumPadPosition;
  onPositionChange: (position: NumPadPosition) => void;
  title?: string | undefined;
  headerExtra?: ReactNode | undefined;
  footer?: ReactNode | undefined;
  boardClassName?: string | undefined;
  headerClassName?: string | undefined;
  onDeselectCell?: (() => void) | undefined;
  settingsExtra?: ReactNode | undefined;
};

export function GameLayout({
  onBack,
  timer,
  numPad,
  board,
  controls,
  position,
  onPositionChange,
  title,
  headerExtra,
  footer,
  boardClassName = "",
  headerClassName = "max-w-lg lg:max-w-4xl",
  onDeselectCell,
  settingsExtra,
}: GameLayoutProps) {
  const handleBackgroundPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!onDeselectCell) return;
    const target = e.target as HTMLElement;
    if (target.closest("button, [role='region']")) return;
    onDeselectCell();
  };

  return (
    <div
      className="flex flex-col items-center min-h-dvh app-surface py-4 px-4 animate-screen-enter"
      onPointerDown={handleBackgroundPointerDown}
    >
      {title && (
        <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
          {title}
        </p>
      )}

      {/* Header */}
      <div
        className={`flex items-center justify-between w-full ${headerClassName} mb-4`}
      >
        <button
          type="button"
          className="w-10 h-10 flex items-center justify-center rounded-full bg-bg-raised border border-border-default text-text-secondary hover:text-text-primary press-spring-soft touch-manipulation"
          onClick={onBack}
          aria-label="Back"
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        {timer}
        <SettingsButton
          position={position}
          onPositionChange={onPositionChange}
          extra={settingsExtra}
        />
      </div>

      {headerExtra}

      {/* Main game area — mobile: respects position; desktop: always side-by-side.
          On mobile we align to the bottom so the grid + controls + numpad sit
          close to the thumbs; any slack opens up between header and board. */}
      <div
        className={`
          flex gap-3 w-full justify-center flex-1
          lg:flex-row lg:items-start lg:max-w-4xl lg:mx-auto lg:gap-6
          ${position === "left" ? "flex-row items-end lg:items-start lg:max-w-4xl lg:mx-auto" : ""}
          ${position === "right" ? "flex-row-reverse items-end lg:items-start lg:max-w-4xl lg:mx-auto lg:flex-row" : ""}
          ${position === "bottom" ? "flex-col items-center lg:flex-row lg:items-start" : ""}
        `}
      >
        {/* Mobile: show numpad in position (left/right) */}
        <div className="lg:hidden">{position !== "bottom" && numPad}</div>
        <div
          className={`flex flex-col items-center gap-3 lg:max-w-2xl lg:w-full ${position === "bottom" ? "flex-1 justify-end lg:justify-center w-full" : "flex-1 min-w-0"} ${boardClassName}`}
        >
          <div className="flex flex-col items-center gap-3 w-full">
            {controls}
          </div>
          <div
            style={{
              width:
                position === "bottom"
                  ? "calc(100% + 1rem)"
                  : "calc(100% + 0.5rem)",
            }}
            className={`flex justify-center lg:!w-full lg:mx-0 ${
              position === "bottom"
                ? "-mx-2"
                : position === "left"
                  ? "-mr-2"
                  : "-ml-2"
            }`}
          >
            {board}
          </div>
          {/* Mobile: show numpad at bottom if position=bottom.
              Widened to match the board so the digit row spans the grid. */}
          <div className="lg:hidden flex justify-center -mx-2 w-[calc(100%+1rem)]">
            {position === "bottom" && numPad}
          </div>
        </div>
        {/* Desktop: numpad as a 3×3 grid, vertically centered beside the board */}
        <div className="hidden lg:flex lg:flex-col lg:gap-3 lg:self-center">
          {numPad}
        </div>
      </div>

      {footer}
    </div>
  );
}

function SettingsButton({
  position,
  onPositionChange,
  extra,
}: {
  position: NumPadPosition;
  onPositionChange: (position: NumPadPosition) => void;
  extra?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", handleClick);
    return () => document.removeEventListener("pointerdown", handleClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="w-10 h-10 flex items-center justify-center rounded-full bg-bg-raised border border-border-default text-text-secondary hover:text-text-primary press-spring-soft touch-manipulation"
        onClick={() => setOpen((v) => !v)}
        aria-label="Settings"
        aria-expanded={open}
      >
        <Settings size={18} aria-hidden="true" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 bg-bg-overlay border border-border-default rounded-xl shadow-lg p-3 z-50 animate-fade-in w-72 max-w-[calc(100vw-2rem)]">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-text-muted font-medium">
              Numpad position
            </p>
            <button
              type="button"
              className="w-6 h-6 flex items-center justify-center rounded text-text-muted hover:text-text-primary transition-colors"
              onClick={() => setOpen(false)}
              aria-label="Close settings"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
          <NumPadPositionToggle
            position={position}
            onChange={onPositionChange}
          />
          {extra && (
            <div className="mt-3 pt-3 border-t border-border-default">
              {extra}
            </div>
          )}
          <div className="hidden lg:block mt-3 pt-3 border-t border-border-default">
            <p className="text-xs text-text-muted mb-2 font-medium">
              Keyboard shortcuts
            </p>
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              {KEYBOARD_SHORTCUTS.map((s) => (
                <Shortcut key={s.label} keys={s.keys} label={s.label} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Shortcut({ keys, label }: { keys: string; label: string }) {
  return (
    <>
      <kbd className="font-mono text-text-primary bg-bg-raised px-1 rounded text-center">
        {keys}
      </kbd>
      <span className="text-text-muted">{label}</span>
    </>
  );
}
