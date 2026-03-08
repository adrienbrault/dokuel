import type { ReactNode } from "react";
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
  headerClassName = "max-w-lg",
}: GameLayoutProps) {
  return (
    <div className="flex flex-col items-center min-h-dvh bg-white dark:bg-gray-950 py-4 px-4 animate-screen-enter">
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
        <NumPadPositionToggle position={position} onChange={onPositionChange} />
      </div>

      {headerExtra}

      {/* Main game area */}
      <div
        className={`
          flex gap-3 w-full justify-center flex-1
          ${position === "left" ? "flex-row items-center max-w-lg mx-auto" : ""}
          ${position === "right" ? "flex-row-reverse items-center max-w-lg mx-auto" : ""}
          ${position === "bottom" ? "flex-col items-center" : ""}
        `}
      >
        {position !== "bottom" && numPad}
        <div
          className={`flex flex-col items-center gap-3 ${position === "bottom" ? "flex-1 justify-center w-full" : "flex-1 min-w-0"} ${boardClassName}`}
        >
          {board}
          <div className="flex flex-col items-center gap-3 w-full">
            {controls}
            {position === "bottom" && numPad}
          </div>
        </div>
      </div>

      {footer}
    </div>
  );
}
