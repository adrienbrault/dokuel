# Dokuel - Implementation Guide

## Commands

```bash
bun run dev          # Start Vite dev server
bun run test         # Run tests once (vitest run)
bun run test:watch   # Run tests in watch mode
bun run lint         # Check lint + format (biome check)
bun run lint:fix     # Auto-fix lint + format (biome check --write)
bun run typecheck    # TypeScript check (tsc --noEmit -p tsconfig.app.json)
bun run ci           # Full CI: lint + typecheck + test (parallel)
bun run diff-coverage # Check test coverage on git-changed lines
```

## Hooks & Feedback Loops

Hooks in `.claude/settings.json` automate quality checks — **do not duplicate their work manually**:

- **PostToolUse (Edit/Write/NotebookEdit)**: Auto-formats with Biome (`biome format`, not `check` — lint is deferred to CI) and runs the related test file in parallel. No need to manually run tests after editing — just check the hook output.
- **PreToolUse (Edit/Write)**: Blocks writes to `.env`, secrets, keys.
- **Stop**: Runs `bun run ci` (lint, typecheck, test in parallel) — blocks stopping if any check fails. Then runs `bun run diff-coverage` — reports which changed lines lack test coverage (advisory, does not block). Review the output and add tests for important code paths.

**What this means for workflow**: Edit a file → hook formats it and runs its tests → you see pass/fail immediately. Only run `bun run ci` or `bun run test` manually when you need the full suite or coverage.

## Architecture

- **Frontend**: Vite + React 19 + Tailwind CSS 4
- **Multiplayer**: Peer-to-peer via Yjs + y-webrtc (no server needed)
- **Testing**: Vitest + React Testing Library
- **Lint/Format**: Biome (2-space indent, double quotes, semicolons)

See `spec.md` for full product specification.

## Deployment

The frontend deploys automatically on push to `main`. Multiplayer uses WebRTC peer-to-peer — only a lightweight signaling server is needed for peer discovery.

### Frontend (Cloudflare Pages)
- **Project**: `sudoku` on Cloudflare Pages, connected to `adrienbrault/dokuel` on GitHub
- **Build**: `bun install && bun run build` → `dist/`
- **URL**: https://dokuel.com (custom domain), https://sudoku-4cc.pages.dev (default)
- Deploys are triggered automatically by GitHub pushes (Cloudflare Pages GitHub integration)

### Signaling Server (Cloudflare Worker)
- **Project**: `dokuel-signaling` Worker with Durable Objects
- **URL**: https://signal.dokuel.com (custom domain)
- **Deploy**: Auto-deploys via GitHub Actions on push to `main` when `signaling/` changes
- **Secrets**: `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` in GitHub repo secrets
- See `signaling/README.md` for full setup instructions

### DNS (Cloudflare)
- `dokuel.com` → CNAME to `sudoku-4cc.pages.dev` (Cloudflare Pages)
- `signal.dokuel.com` → managed by Cloudflare Worker Custom Domain (automatic)

## Git Workflow — MANDATORY

### What "Atomic" Means

A commit is atomic when it contains **one logical change**. Ask yourself: "Can I describe this commit in one sentence without using 'and'?" If not, split it.

**One commit = one reason to change.** A bug fix is not a refactor. A refactor is not a performance improvement. A new utility extraction is not a test fix. Even if you discover all of these while working on the same file, they are separate commits.

Concrete rules:
- **One bug fix per commit.** If you find 3 bugs, that's 3 commits, each with its own `fix(<scope>)`.
- **One refactor per commit.** Extracting a utility is one commit. Memoizing a component is another. Changing a data structure is another.
- **Performance changes are `perf`, not `refactor`.** They have different motivations and risk profiles.
- **Never combine fix + refactor + perf.** Even if they touch the same file, they are separate commits with separate types.
- **Config/tooling changes are their own commits.** Changing hooks, linter config, or CI settings is `chore(<scope>)`, not a fixup of whatever feature they support.

### Conventional Commits Format

Every commit follows [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short summary>

<why this change was made — motivation, context, trade-offs>
<what it enables or unblocks>
```

The **subject line** says what changed. The **body** says why.
Every commit MUST have a body. The body explains the reasoning, not a restatement of the diff.

Types: `feat`, `fix`, `test`, `refactor`, `perf`, `chore`, `docs`, `style`, `ci`

Scopes: `engine`, `board`, `numpad`, `controls`, `solo`, `multiplayer`, `lobby`, `ui`, `hooks`, `p2p`, `types`

### Anti-Patterns — NEVER Do These

**The kitchen-sink commit.** "refactor: fix bugs and improve code quality across codebase" is not a commit message — it's a confession that you batched unrelated changes. If the summary needs "and" or covers multiple categories, split the commit.

**The fake fixup.** `fixup!` means "this change is part of the parent commit and should be squashed into it." It does NOT mean "this is a follow-up change in the same area." A fixup must pass this test: if you squashed it into the parent commit right now, would the parent's commit message still accurately describe the result? If not, it's a new commit, not a fixup.

Examples of real fixups:
- Typo in code introduced by the parent commit
- Lint fix for code introduced by the parent commit
- Missing edge case in a function introduced by the parent commit

Examples of things that are NOT fixups (make them standalone commits):
- Adding new CI hooks or tooling config → `chore(hooks): ...`
- Updating CLAUDE.md workflow instructions → `docs: ...` or `chore: ...`
- Changing behavior that was already working → `fix(...)` or `refactor(...)`
- Performance optimization of existing code → `perf(...)`

**The over-scoped refactor.** A commit that touches 13 files across components, hooks, lib, and tests is almost certainly not atomic. Refactors should be narrow: one extraction, one structural change, one migration pattern.

### Good Examples

```
fix(solo): replace setTimeout-during-render with useEffect

The old code fired a new setTimeout on every re-render while
status was "completed", queueing multiple state updates.
useEffect runs once when status transitions.
```
```
perf(hooks): derive conflicts via useMemo instead of reducer state

Eliminates sync burden across 4 reducer actions. Conflicts are
now computed from board state, removing the possibility of
stale conflict data.
```
```
refactor(ui): extract formatTime utility from Timer and SoloGame

Both components had identical duration formatting logic.
Shared utility in src/lib/format.ts.
```
```
chore(hooks): add biome auto-format on file save

PostToolUse hook runs biome check --write on the edited file,
keeping formatting consistent without manual steps.
```

### Commit Cadence — Automatic, After Every Completed Change

**Always commit automatically** — do not wait for the user to ask. This applies to ALL work, not just TDD cycles. Any time you complete a logical change and the project is in a passing state, commit immediately.

**During TDD cycles:**

1. **RED** → write ONE failing test → commit: `test(<scope>): <what is being tested>`
2. **GREEN** → write minimum passing code → commit: `feat(<scope>): <what was implemented>`
3. **REFACTOR** → clean up → commit: `refactor(<scope>): <what was improved>`

**Never batch multiple tests before implementing.** See `.claude/skills/tdd/SKILL.md` for the full TDD workflow.

**Outside TDD — same rule applies.** Editing docs? Commit. Updating config? Commit. Fixing a bug? Commit. Extracting a helper? Commit. Every completed logical change gets its own commit immediately — no waiting for the user to say "commit", no batching "while you're at it" changes.

### Fixup Commits

Fixup commits are ONLY for changes that logically belong to a previous commit — where the parent commit's message would still be accurate after squashing.

- Use `git commit --fixup=<sha>` only when the change corrects or completes the parent commit
- Fixup commits still get a description body explaining *why* the fixup is needed
- **When in doubt, make it a standalone commit.** A standalone commit with the right type is always better than a wrong fixup.
- Never amend published commits; always append fixup commits

### Commit Hygiene

- Each commit must leave the project in a **passing state**: lint + typecheck + tests green
- Stage specific files, never `git add -A` or `git add .`
- Never commit `.env`, secrets, or `node_modules`

## TDD Workflow — MANDATORY

Follow the TDD skill in `.claude/skills/tdd/SKILL.md`. Key rules:

- **Vertical slices only**: ONE test → ONE implementation → repeat. Never batch tests.
- **Plan first**: Confirm interface and behaviors with the user before coding.
- **Test behavior, not implementation**: Tests use public interfaces, survive refactors.
- **Don't test what the type system catches**: If TypeScript already enforces a constraint (e.g. argument types, return types, exhaustive switches), don't write a test for it. Tests should cover runtime behavior that types cannot guarantee.
- **Mock only at system boundaries**: See `.claude/skills/tdd/mocking.md`.
- Never write implementation code without a corresponding test.
- Tests go next to the file they test (`*.test.ts` / `*.test.tsx`).

## Project Conventions

### File Structure
- Components: `src/components/` — React functional components (Board, Cell, NumPad, NumPadPositionToggle, SoloGame, DailyGame, MultiplayerGame, MultiplayerBoard, MultiplayerScreen, Landing, Lobby, JoinScreen, GameLayout, GameControls, GameResult, HintBanner, Stats, DifficultyPicker, AssistLevelPicker, Timer, DarkModeToggle, SoundToggle, ToggleSwitch, Toast, LandingIcons)
- Hooks: `src/hooks/` — custom React hooks (useSudoku, sudokuReducer, sudokuActions, useYjsMultiplayer, useKeyboard, useNumPadPosition, useDarkMode, useAssistLevel, useOpponentProgressVisible)
- Library: `src/lib/` — pure logic, no React dependency (sudoku engine, types, p2p-room, room-code, daily challenge, daily-streak, stats, game-storage, hint-engine, hint-hidden-single, name-generator, haptics, sounds, format, constants)
- Tests: colocated as `*.test.ts` / `*.test.tsx`

### Code Style (enforced by Biome)
- 2-space indentation
- Double quotes for strings
- Semicolons always
- Organize imports automatically

### Component Patterns
- Functional components only
- Props typed inline or with `type` (not `interface`)
- Tailwind classes for styling — no CSS modules, no styled-components
- Use `className` composition, not conditional class libraries (keep deps minimal)

### Design System
- **Semantic tokens** defined in `src/index.css` `@theme` block — use `text-text-primary`, `bg-bg-raised`, `border-border-default`, etc. instead of raw gray scales + `dark:` variants
- **Component classes** defined in `src/index.css` — use `btn btn-lg btn-primary`, `card`, `heading`, `screen`, `modal-overlay`, etc.
- **Never hardcode `dark:` for common text/bg colors** — use semantic tokens so dark mode is handled in one place
- **Override with Tailwind** when needed — e.g., `btn btn-primary w-full` adds width on top of the base class
- **Token reference**: surfaces (`bg-primary`, `bg-inset`, `bg-raised`, `bg-overlay`), text (`text-primary`, `text-secondary`, `text-muted`, `text-on-accent`), borders (`border-default`), interactive (`bg-disabled`, `text-disabled`)
- **Class reference**: buttons (`btn`, `btn-lg`, `btn-md`, `btn-primary`, `btn-secondary`, `btn-ghost`), surfaces (`card`, `modal-overlay`, `modal-panel`, `screen`, `screen-content`), typography (`heading-xl`, `heading`, `label`, `caption`, `text-mono`)

### State Management
- React hooks (useState, useReducer) — no external state library
- `useSudoku` hook owns all game state for a single board
- `useYjsMultiplayer` hook manages P2P WebRTC connection and room state via Yjs

### Types
- All shared types in `src/lib/types.ts`
- Use `type` over `interface`
- Discriminated unions for message types

## Visual Testing with Playwright Screenshots — MANDATORY

**Always use screenshots to verify UI changes.** This is how you catch layout, spacing, and visual issues that code review alone cannot reveal.

### Setup
- Playwright config: `playwright.config.ts`
- Screenshot tests: `e2e/screenshots.spec.ts`
- Output directory: `e2e/screenshots/` (gitignored)
- Devices tested: iPhone SE, iPhone 14, iPad Mini, Desktop (1280x800)

### Commands
```bash
bun run screenshots   # Run screenshot tests, saves PNGs to e2e/screenshots/
bun run e2e           # Run all Playwright tests
```

### Workflow for UI Changes
1. **Before making changes**: run `bun run screenshots` and review the current state using the Read tool on the PNGs
2. **After making changes**: run `bun run screenshots` again and review the new PNGs
3. **Compare across viewports**: always check iPhone SE (smallest), iPhone 14, iPad Mini, and Desktop
4. **Iterate**: if something looks wrong, fix it and re-screenshot until it looks right

### Adding New Screenshot Tests
When adding new screens or significant UI features, add a test case to `e2e/screenshots.spec.ts` that navigates to the new screen and captures it. Each test saves PNGs named `{screen}--{device}.png`.

### Key Principle
You cannot judge visual quality from code alone. **Always screenshot, always review the images.** This catches: misalignment, overflow, wrong spacing, broken responsive layouts, elements off-screen, text truncation, and more.

## Key Design Decisions

- **Assist levels**: Three levels — Paper (no highlights), Standard (conflict highlighting + auto-clear notes), Full (conflicts + row/column highlighting). Configurable at difficulty selection and during gameplay. Board complete only when all filled + valid.
- **Peer-to-peer**: No server needed. Game state syncs via Yjs CRDTs over WebRTC. Self-hosted signaling server at signal.dokuel.com for peer discovery.
- **Board sharing**: Sharer's cells become locked/given on both boards. Notes not shared.
- **Numpad positions**: Bottom (default), Left, Right. Persisted in localStorage. Configured via settings popover.
- **No accounts**: Auto-generated fun names (adjective + animal). Name persisted in localStorage, editable in lobby. sessionStorage for reconnect identity.
- **Daily challenge**: Deterministic puzzle via seeded RNG — same date, same board, any device. Streak tracking (current + longest). Progress indicator on landing page.
- **Stats tracking**: Per-difficulty game history (best time, average, games played) in localStorage. Personal best shown during gameplay.
- **Game persistence**: Auto-save in-progress games to localStorage. Resume on return.
- **Hints**: Reveal one cell's correct value (solo only). Hint-assisted games excluded from PB tracking. Hint engine with technique explanations (naked-single, hidden-single).
- **Sound effects**: Synthesized via Web Audio API, toggleable.
