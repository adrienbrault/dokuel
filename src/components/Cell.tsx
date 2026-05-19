import { type CSSProperties, memo } from "react";
import { DIGITS } from "../lib/constants.ts";
import type { AssistLevel, Cell as CellType } from "../lib/types.ts";

// Distance from the cell center to a note's sub-cell center, as a
// percentage of the cell's own width. Centers of the 3x3 sub-cell grid
// sit at 1/6, 1/2, and 5/6 of the cell width — so the offset from the
// cell center for col 0 / 1 / 2 is -33.33% / 0% / +33.33%. Same for rows.
const NOTE_OFFSETS = ["-33.333%", "0%", "33.333%"] as const;

type CellProps = {
  cell: CellType;
  row: number;
  col: number;
  isSelected: boolean;
  isMultiSelected: boolean;
  isHighlighted: boolean;
  isSameNumber: boolean;
  isConflict: boolean;
  isHintRelated?: boolean | undefined;
  isSameNumberRowCol?: boolean | undefined;
  assistLevel?: AssistLevel | undefined;
  onSelect: (row: number, col: number) => void;
  revealDelay?: number | undefined;
  /**
   * When set, render the digit as a centered overlay that animates
   * from note-size to value-size over the long-press window — gives
   * the user in-cell feedback that holding will commit the value.
   */
  chargingDigit?: number | undefined;
  /** True when this cell is the source of an in-flight digit drag. */
  isDragSource?: boolean | undefined;
  /** "valid" or "invalid" while the pointer hovers this cell with a drag. */
  dropTargetState?: "valid" | "invalid" | null | undefined;
  /**
   * Which slot in this cell the drop will land in, when the cell is a
   * valid drop target. Drives the diagonal tint so the user sees
   * which half is the active landing zone before releasing.
   */
  dropMode?: "value" | "note" | undefined;
};

export const Cell = memo(function Cell({
  cell,
  row,
  col,
  isSelected,
  isMultiSelected,
  isHighlighted,
  isSameNumber,
  isConflict,
  isHintRelated,
  isSameNumberRowCol,
  assistLevel = "standard",
  onSelect,
  revealDelay,
  chargingDigit,
  isDragSource,
  dropTargetState,
  dropMode,
}: CellProps) {
  const isPaper = assistLevel === "paper";
  const bgClass =
    isSelected || isMultiSelected
      ? isPaper
        ? "bg-cell-bg"
        : "bg-cell-selected"
      : isConflict
        ? "bg-cell-conflict-bg"
        : isHintRelated
          ? "bg-amber-100 dark:bg-amber-900/40"
          : isSameNumber
            ? "bg-cell-same-number"
            : isHighlighted
              ? "bg-cell-highlight"
              : isSameNumberRowCol
                ? "bg-cell-match-row-col"
                : "bg-cell-bg";

  const textClass = cell.isGiven
    ? "text-cell-given font-bold"
    : isConflict
      ? "text-cell-conflict font-semibold"
      : "text-cell-user font-semibold";

  return (
    <button
      type="button"
      className={`
					relative flex items-center justify-center
					aspect-square w-full
					${bgClass}
					transition-colors duration-100
					select-none touch-none
					outline-none focus-visible:ring-2 focus-visible:ring-accent
					${isSelected || isMultiSelected ? (isPaper ? "ring-2 ring-accent ring-inset" : "cell-selected-glow") : ""}
					${revealDelay !== undefined ? "animate-cell-reveal" : ""}
				`}
      style={
        revealDelay !== undefined
          ? { animationDelay: `${revealDelay}ms` }
          : undefined
      }
      data-row={row}
      data-col={col}
      data-drag-source={isDragSource ? "true" : undefined}
      data-drop-target={dropTargetState ?? undefined}
      data-drop-mode={
        dropTargetState === "valid" ? (dropMode ?? undefined) : undefined
      }
      onClick={() => onSelect(row, col)}
      aria-label={`Cell row ${row + 1} column ${col + 1}${cell.value ? `, value ${cell.value}` : ", empty"}`}
    >
      {cell.value ? (
        <span
          key={cell.value}
          className={`text-[clamp(1.2578125rem,5.75vw,2.15625rem)] leading-none ${textClass} ${!cell.isGiven ? "animate-pop-in" : ""}`}
        >
          {cell.value}
        </span>
      ) : cell.notes.size > 0 ? (
        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 p-[1px]">
          {DIGITS.map((n) => (
            <span
              key={n}
              className="flex items-center justify-center text-[clamp(0.80859375rem,3.1625vw,1.078125rem)] text-text-secondary font-medium leading-none"
            >
              {cell.notes.has(n) && chargingDigit !== n ? n : ""}
            </span>
          ))}
        </div>
      ) : null}
      {dropTargetState === "valid" && (
        <span
          data-testid="drop-preview"
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
        >
          {/* Two triangles meeting on the top-left → bottom-right
              diagonal. The active half is tinted with the accent; the
              inactive half stays nearly transparent so the user can
              see at a glance which mode they're committing.
              Bottom-left triangle commits a note, top-right commits
              the value. */}
          <span
            className={`absolute inset-0 transition-colors ${
              dropMode === "note"
                ? "bg-accent/30"
                : "bg-accent/8 dark:bg-accent/12"
            }`}
            style={{ clipPath: "polygon(0% 0%, 0% 100%, 100% 100%)" }}
          />
          <span
            className={`absolute inset-0 transition-colors ${
              dropMode === "value"
                ? "bg-accent/30"
                : "bg-accent/8 dark:bg-accent/12"
            }`}
            style={{ clipPath: "polygon(0% 0%, 100% 0%, 100% 100%)" }}
          />
          {/* Hair-line diagonal divider so the split reads clearly
              even when the two halves are similar shades — the
              gradient is perpendicular to the top-left → bottom-right
              diagonal so its midpoint draws a 1px line along it. */}
          <span
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to bottom left, transparent calc(50% - 0.5px), var(--color-accent) calc(50% - 0.5px), var(--color-accent) calc(50% + 0.5px), transparent calc(50% + 0.5px))",
              opacity: 0.55,
            }}
          />
        </span>
      )}
      {cell.value === null && chargingDigit !== undefined && (
        <span
          data-testid="note-charge"
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center text-[clamp(1.2578125rem,5.75vw,2.15625rem)] font-semibold text-cell-user leading-none pointer-events-none animate-note-charge"
          style={
            {
              "--charge-dx": NOTE_OFFSETS[(chargingDigit - 1) % 3]!,
              "--charge-dy": NOTE_OFFSETS[Math.floor((chargingDigit - 1) / 3)]!,
            } as CSSProperties
          }
        >
          {chargingDigit}
        </span>
      )}
    </button>
  );
});
