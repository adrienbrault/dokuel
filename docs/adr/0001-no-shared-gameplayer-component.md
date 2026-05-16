# Keep SoloGame and MultiplayerBoard as separate components

**Status**: accepted (2026-05-16)

## Context

`src/components/SoloGame.tsx` (~260 lines) and
`src/components/MultiplayerBoard.tsx` (~205 lines) both wire up a
playable Sudoku board: they each consume the `useSudoku` engine and
render `Board` + `NumPad` + `GameControls` + `Timer` inside the
shared `GameLayout`. A natural reading of the two files suggests
extracting a `<GamePlayer>` component to deduplicate.

## Decision

Do not extract a shared `GamePlayer`. Keep SoloGame and
MultiplayerBoard as parallel components.

## Rationale

Measured against the actual code, the shared surface is small and
the divergent surface is large:

- **Shared (~35 lines per file)**: `NumPad` prop block, `Board` prop
  block, the `handleNumber` closure, `useDelayedFlag` reveal/result
  flags, `timerSecondsRef`, the conflicts-vs-`EMPTY_CONFLICTS`
  ternary keyed on assist level.
- **Solo-only (~150 lines)**: `useResumableSudoku` integration, pause
  + tab-visibility auto-pause, hint banner + hint-cell highlighting,
  hint button, keyboard shortcuts (`useKeyboard`), personal-best /
  streak display, tip dismissal, history-aware back confirmation,
  the richer `GameResult` shape.
- **Multiplayer-only (~120 lines)**: `useOpponentProgressVisible`,
  progress callback (`useEffect` watching `cellsRemaining`),
  completion callback, externally-driven `gameOver` prop, opponent
  progress bar in `headerExtra`, the sparser `GameResult` shape.

A `<GamePlayer>` covering both would need 6–8 optional slot props
(hint banner, pause overlay, opponent bar, footer, header extra,
settings extra, keyboard toggle, completion source). At that point
the interface is nearly as complex as the implementation — a shallow
seam. Applying the deletion test: removing such a component would
inline ~35 lines back into each caller, not collapse complexity
across many sites. The abstraction earns very little.

The duplication that does exist sits well below the threshold where
sharing pays back. "Three similar lines is better than a premature
abstraction" (CLAUDE.md).

## Considered alternatives

- **Smaller helper (`buildGameSurfaceProps` or `<GameSurface>` for
  Board + NumPad only)**: would save 20–40 lines per file. Rejected
  as not worth a new abstraction; the existing inline code is
  readable and the prop computations differ enough (selected-value
  optional chaining, paused-vs-not state in Solo) that even this
  smaller seam would need conditionals.
- **Full `<GamePlayer>` with slots**: rejected for the leaky-seam
  reason above.

## Consequences

- Bug fixes touching board/numpad wiring (e.g. how `assistLevel`
  gates conflict display) may need to land in both files. This is
  acceptable because the shared formula is one line per file.
- New game modes (e.g. co-op, async race) should be built as their
  own component, not by widening a shared abstraction.
- If a third game mode appears that is *closely* shaped like one of
  the existing two, extract from THAT pair, not from all three.

## Revisit if

- A third game mode arrives whose lifecycle matches Solo or
  Multiplayer almost exactly.
- The shared boilerplate grows past ~75 lines per file, or the
  divergent lifecycle shrinks (e.g. multiplayer gains pause/hints).
