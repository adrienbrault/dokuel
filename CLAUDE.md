# Sudoku 1v1 - Implementation Guide

## Commands

```bash
bun run dev          # Start Vite dev server
bun run test         # Run tests once (vitest run)
bun run test:watch   # Run tests in watch mode
bun run lint         # Check lint + format (biome check)
bun run lint:fix     # Auto-fix lint + format (biome check --write)
bun run typecheck    # TypeScript check (tsc --noEmit)
bun run ci           # Full CI: lint + typecheck + test
```

## Architecture

- **Frontend**: Vite + React 19 + Tailwind CSS 4
- **Real-time server**: PartyKit (Cloudflare Durable Objects)
- **Testing**: Vitest + React Testing Library
- **Lint/Format**: Biome (tabs, double quotes, semicolons)

See `spec.md` for full product specification.

## Git Workflow — MANDATORY

### Atomic Conventional Commits

Every commit is atomic and follows [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short summary>

<why this change was made — motivation, context, trade-offs>
<what it enables or unblocks>
```

The **subject line** says what changed. The **body** says why.
Every commit MUST have a body unless it is a trivial fixup. The body explains the reasoning, not a restatement of the diff.

Types: `feat`, `fix`, `test`, `refactor`, `chore`, `docs`, `style`, `ci`

Scopes: `engine`, `board`, `numpad`, `controls`, `solo`, `multiplayer`, `lobby`, `ui`, `hooks`, `server`, `types`

Examples:
```
test(engine): add puzzle generation and solving tests

Validates that generated puzzles have correct clue counts per
difficulty, solutions preserve given clues, and every row/column
contains digits 1-9. These tests define the contract for the
sudoku engine before implementation.
```
```
feat(engine): implement puzzle generation and solving

Uses the `sudoku` npm package (0-8 based) and maps to our 1-9
format. Difficulty controls clue count by randomly removing
givens from the generated puzzle. Conflict detection scans
row/col/box for duplicate values.
```
```
fixup! feat(engine): implement puzzle generation and solving

Fix off-by-one in difficulty clue range — expert was generating
puzzles with too many clues.
```

### Commit Cadence — After Every TDD Cycle

Commit **immediately** after each RED/GREEN/REFACTOR iteration completes:

1. **RED** → write failing test(s) → commit: `test(<scope>): <what is being tested>`
2. **GREEN** → write minimum passing code → commit: `feat(<scope>): <what was implemented>`
3. **REFACTOR** → clean up → commit: `refactor(<scope>): <what was improved>`

If the refactor step has no changes, skip that commit. The point is: every passing state gets committed.

### Fixup Commits

When a change logically belongs to a previous commit (typo, rename, lint fix, missed edge case):

- Use `git commit --fixup=<sha>` to create a fixup commit
- Fixup commits still get a description body explaining *why* the fixup is needed
- This keeps history clean and allows `git rebase --autosquash` later
- For renames, style fixes, import reordering — always fixup the originating commit
- Never amend published commits; always append fixup commits

### Commit Hygiene

- Each commit must leave the project in a **passing state**: lint + typecheck + tests green
- Stage specific files, never `git add -A` or `git add .`
- Never commit `.env`, secrets, or `node_modules`
- Use `BACKLOG.md` transitions as part of the relevant feature commit (not separate commits)

## Task Tracking — BACKLOG.md

All tasks are tracked in `BACKLOG.md` at the project root. This file is git-tracked and serves as the single source of truth for project status.

Update `BACKLOG.md` as part of the commit that completes or starts work on a task — not as a separate commit.

## TDD Workflow — MANDATORY

Every feature follows strict Red/Green/Refactor:

1. **RED**: Write a failing test first in `*.test.ts` / `*.test.tsx`
2. **GREEN**: Write minimum code to make the test pass
3. **REFACTOR**: Clean up while tests stay green

Never write implementation code without a corresponding test. Tests go next to the file they test.

## Project Conventions

### File Structure
- Components: `src/components/ComponentName.tsx` — React functional components
- Hooks: `src/hooks/useHookName.ts` — custom React hooks
- Library: `src/lib/` — pure logic, no React dependency
- Server: `src/party/` — PartyKit server code
- Tests: colocated as `*.test.ts` / `*.test.tsx`

### Code Style (enforced by Biome)
- Tabs for indentation
- Double quotes for strings
- Semicolons always
- Organize imports automatically

### Component Patterns
- Functional components only
- Props typed inline or with `type` (not `interface`)
- Tailwind classes for styling — no CSS modules, no styled-components
- Use `className` composition, not conditional class libraries (keep deps minimal)

### State Management
- React hooks (useState, useReducer) — no external state library
- `useSudoku` hook owns all game state for a single board
- `useMultiplayer` hook manages PartyKit connection and room state

### Types
- All shared types in `src/lib/types.ts`
- Use `type` over `interface`
- Discriminated unions for message types

## Key Design Decisions

- **Soft validation**: Conflicts shown visually, not blocked. Board complete only when all filled + valid.
- **Server-authoritative**: Server holds puzzle solution, validates completion. Client never sees solution.
- **Board sharing**: Sharer's cells become locked/given on both boards. Notes not shared.
- **Numpad positions**: Bottom (default), Left, Right. Persisted in localStorage.
- **No accounts**: Nickname + random color. sessionStorage for reconnect identity.
