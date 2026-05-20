type LogoProps = {
  size?: number;
  className?: string;
};

// A rounded gradient tile holding a 3×3 dot grid — an abstract sudoku
// board with a lit diagonal "solved path". Used as the Dokuel brand mark.
export function Logo({ size = 44, className = "" }: LogoProps) {
  const cols = [14, 24, 34];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <title>Dokuel</title>
      <defs>
        <linearGradient id="logo-tile" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" style={{ stopColor: "var(--color-accent)" }} />
          <stop
            offset="100%"
            style={{ stopColor: "var(--color-accent-strong)" }}
          />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="13" fill="url(#logo-tile)" />
      {cols.map((cx) =>
        cols.map((cy) => (
          <circle
            key={`${cx}-${cy}`}
            cx={cx}
            cy={cy}
            r="3.4"
            fill="#fff"
            opacity={cx === cy ? 1 : 0.4}
          />
        )),
      )}
    </svg>
  );
}
