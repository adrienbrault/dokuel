import {
  type PointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
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
}: GameLayoutProps) {
  const handleBackgroundPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!onDeselectCell) return;
    const target = e.target as HTMLElement;
    if (target.closest("button, [role='region']")) return;
    onDeselectCell();
  };

  return (
    <div
      className="flex flex-col items-center min-h-dvh bg-white dark:bg-gray-950 py-4 px-4 animate-screen-enter"
      onPointerDown={handleBackgroundPointerDown}
    >
      {title && (
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
          {title}
        </p>
      )}

      {/* Header */}
      <div
        className={`flex items-center justify-between w-full ${headerClassName} mb-4`}
      >
        <button
          type="button"
          className="text-sm text-gray-400 dark:text-gray-500 touch-manipulation"
          onClick={onBack}
        >
          ← Back
        </button>
        {timer}
        <SettingsButton
          position={position}
          onPositionChange={onPositionChange}
        />
      </div>

      {headerExtra}

      {/* Main game area — mobile: respects position; desktop: always side-by-side */}
      <div
        className={`
          flex gap-3 w-full justify-center flex-1
          lg:flex-row lg:items-start lg:max-w-4xl lg:mx-auto lg:gap-6
          ${position === "left" ? "flex-row items-center max-w-lg mx-auto lg:max-w-4xl" : ""}
          ${position === "right" ? "flex-row-reverse items-center max-w-lg mx-auto lg:max-w-4xl lg:flex-row" : ""}
          ${position === "bottom" ? "flex-col items-center lg:flex-row lg:items-start" : ""}
        `}
      >
        {/* Mobile: show numpad in position (left/right) */}
        <div className="lg:hidden">{position !== "bottom" && numPad}</div>
        <div
          className={`flex flex-col items-center gap-3 lg:max-w-xl lg:w-full ${position === "bottom" ? "flex-1 justify-center w-full" : "flex-1 min-w-0"} ${boardClassName}`}
        >
          {board}
          <div className="flex flex-col items-center gap-3 w-full">
            {controls}
            {/* Mobile: show numpad at bottom if position=bottom */}
            <div className="lg:hidden w-full">
              {position === "bottom" && numPad}
            </div>
          </div>
        </div>
        {/* Desktop: always show numpad on the right */}
        <div className="hidden lg:flex lg:flex-col lg:gap-3 lg:pt-2">
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
}: {
  position: NumPadPosition;
  onPositionChange: (position: NumPadPosition) => void;
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
        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors touch-manipulation"
        onClick={() => setOpen((v) => !v)}
        aria-label="Settings"
        aria-expanded={open}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M8.34 1.804A1 1 0 019.32 1h1.36a1 1 0 01.98.804l.295 1.473a7.04 7.04 0 011.2.694l1.42-.508a1 1 0 011.12.358l.68 1.178a1 1 0 01-.14 1.162l-1.126.965a7.09 7.09 0 010 1.388l1.125.965a1 1 0 01.141 1.162l-.68 1.178a1 1 0 01-1.12.358l-1.42-.508a7.04 7.04 0 01-1.2.694l-.294 1.473a1 1 0 01-.98.804H9.32a1 1 0 01-.98-.804l-.295-1.473a7.04 7.04 0 01-1.2-.694l-1.42.508a1 1 0 01-1.12-.358l-.68-1.178a1 1 0 01.14-1.162l1.126-.965a7.09 7.09 0 010-1.388l-1.125-.965a1 1 0 01-.141-1.162l.68-1.178a1 1 0 011.12-.358l1.42.508a7.04 7.04 0 011.2-.694l.294-1.473zM10 13a3 3 0 100-6 3 3 0 000 6z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-3 z-50 animate-fade-in">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium">
            Numpad position
          </p>
          <NumPadPositionToggle
            position={position}
            onChange={onPositionChange}
          />
        </div>
      )}
    </div>
  );
}
