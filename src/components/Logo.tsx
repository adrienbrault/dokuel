/**
 * The Dokuel mark: a 3x3 box with the diagonal filled — the smallest
 * shape that still reads as "sudoku" at favicon size, and the one part of
 * the brand that is not just a typeface.
 */
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <title>Dokuel</title>
      <rect
        x="2"
        y="2"
        width="44"
        height="44"
        rx="11"
        className="fill-accent"
      />
      {[0, 1, 2].map((row) =>
        [0, 1, 2].map((col) => (
          <rect
            key={`${row}-${col}`}
            x={9 + col * 11}
            y={9 + row * 11}
            width="8"
            height="8"
            rx="2.5"
            fill="white"
            opacity={row === col ? 1 : 0.32}
          />
        )),
      )}
    </svg>
  );
}
