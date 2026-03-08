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
- **Multiplayer**: Peer-to-peer via Yjs + y-webrtc (no server needed)
- **Testing**: Vitest + React Testing Library
- **Lint/Format**: Biome (tabs, double quotes, semicolons)

See `spec.md` for full product specification.

## Deployment

The frontend deploys automatically on push to `main`. No server infrastructure needed — multiplayer uses WebRTC peer-to-peer.

### Frontend (Cloudflare Pages)
- **Project**: `sudoku` on Cloudflare Pages, connected to `adrienbrault/sudoku` on GitHub
- **Build**: `bun install && bun run build` → `dist/`
- **URL**: https://sudoku.brage.fr (custom domain), https://sudoku-4cc.pages.dev (default)
- Deploys are triggered automatically by GitHub pushes (Cloudflare Pages GitHub integration)

### DNS (Cloudflare)
- `sudoku.brage.fr` → CNAME to `sudoku-4cc.pages.dev` (Cloudflare Pages)

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
- Use `BACKLOG.md` transitions as part of the relevant feature commit (not separate commits)

## Task Tracking — BACKLOG.md

All tasks are tracked in `BACKLOG.md` at the project root. This file is git-tracked and serves as the single source of truth for project status.

Update `BACKLOG.md` as part of the commit that completes or starts work on a task — not as a separate commit.

## TDD Workflow — MANDATORY

Follow the TDD skill in `.claude/skills/tdd/SKILL.md`. Key rules:

- **Vertical slices only**: ONE test → ONE implementation → repeat. Never batch tests.
- **Plan first**: Confirm interface and behaviors with the user before coding.
- **Test behavior, not implementation**: Tests use public interfaces, survive refactors.
- **Mock only at system boundaries**: See `.claude/skills/tdd/mocking.md`.
- Never write implementation code without a corresponding test.
- Tests go next to the file they test (`*.test.ts` / `*.test.tsx`).

## Project Conventions

### File Structure
- Components: `src/components/ComponentName.tsx` — React functional components
- Hooks: `src/hooks/useHookName.ts` — custom React hooks
- Library: `src/lib/` — pure logic, no React dependency
- P2P: `src/lib/p2p-room.ts` — Yjs-based peer-to-peer room logic
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

- **Soft validation**: Conflicts shown visually, not blocked. Board complete only when all filled + valid.
- **Peer-to-peer**: No server needed. Game state syncs via Yjs CRDTs over WebRTC. Public signaling servers used only for peer discovery.
- **Board sharing**: Sharer's cells become locked/given on both boards. Notes not shared.
- **Numpad positions**: Bottom (default), Left, Right. Persisted in localStorage.
- **No accounts**: Nickname + random color. sessionStorage for reconnect identity.

<!-- rtk-instructions v2 -->
# RTK (Rust Token Killer) - Token-Optimized Commands

## Golden Rule

**Always prefix commands with `rtk`**. If RTK has a dedicated filter, it uses it. If not, it passes through unchanged. This means RTK is always safe to use.

**Important**: Even in command chains with `&&`, use `rtk`:
```bash
# ❌ Wrong
git add . && git commit -m "msg" && git push

# ✅ Correct
rtk git add . && rtk git commit -m "msg" && rtk git push
```

## RTK Commands by Workflow

### Build & Compile (80-90% savings)
```bash
rtk cargo build         # Cargo build output
rtk cargo check         # Cargo check output
rtk cargo clippy        # Clippy warnings grouped by file (80%)
rtk tsc                 # TypeScript errors grouped by file/code (83%)
rtk lint                # ESLint/Biome violations grouped (84%)
rtk prettier --check    # Files needing format only (70%)
rtk next build          # Next.js build with route metrics (87%)
```

### Test (90-99% savings)
```bash
rtk cargo test          # Cargo test failures only (90%)
rtk vitest run          # Vitest failures only (99.5%)
rtk playwright test     # Playwright failures only (94%)
rtk test <cmd>          # Generic test wrapper - failures only
```

### Git (59-80% savings)
```bash
rtk git status          # Compact status
rtk git log             # Compact log (works with all git flags)
rtk git diff            # Compact diff (80%)
rtk git show            # Compact show (80%)
rtk git add             # Ultra-compact confirmations (59%)
rtk git commit          # Ultra-compact confirmations (59%)
rtk git push            # Ultra-compact confirmations
rtk git pull            # Ultra-compact confirmations
rtk git branch          # Compact branch list
rtk git fetch           # Compact fetch
rtk git stash           # Compact stash
rtk git worktree        # Compact worktree
```

Note: Git passthrough works for ALL subcommands, even those not explicitly listed.

### GitHub (26-87% savings)
```bash
rtk gh pr view <num>    # Compact PR view (87%)
rtk gh pr checks        # Compact PR checks (79%)
rtk gh run list         # Compact workflow runs (82%)
rtk gh issue list       # Compact issue list (80%)
rtk gh api              # Compact API responses (26%)
```

### JavaScript/TypeScript Tooling (70-90% savings)
```bash
rtk pnpm list           # Compact dependency tree (70%)
rtk pnpm outdated       # Compact outdated packages (80%)
rtk pnpm install        # Compact install output (90%)
rtk npm run <script>    # Compact npm script output
rtk npx <cmd>           # Compact npx command output
rtk prisma              # Prisma without ASCII art (88%)
```

### Files & Search (60-75% savings)
```bash
rtk ls <path>           # Tree format, compact (65%)
rtk read <file>         # Code reading with filtering (60%)
rtk grep <pattern>      # Search grouped by file (75%)
rtk find <pattern>      # Find grouped by directory (70%)
```

### Analysis & Debug (70-90% savings)
```bash
rtk err <cmd>           # Filter errors only from any command
rtk log <file>          # Deduplicated logs with counts
rtk json <file>         # JSON structure without values
rtk deps                # Dependency overview
rtk env                 # Environment variables compact
rtk summary <cmd>       # Smart summary of command output
rtk diff                # Ultra-compact diffs
```

### Infrastructure (85% savings)
```bash
rtk docker ps           # Compact container list
rtk docker images       # Compact image list
rtk docker logs <c>     # Deduplicated logs
rtk kubectl get         # Compact resource list
rtk kubectl logs        # Deduplicated pod logs
```

### Network (65-70% savings)
```bash
rtk curl <url>          # Compact HTTP responses (70%)
rtk wget <url>          # Compact download output (65%)
```

### Meta Commands
```bash
rtk gain                # View token savings statistics
rtk gain --history      # View command history with savings
rtk discover            # Analyze Claude Code sessions for missed RTK usage
rtk proxy <cmd>         # Run command without filtering (for debugging)
rtk init                # Add RTK instructions to CLAUDE.md
rtk init --global       # Add RTK to ~/.claude/CLAUDE.md
```

## Token Savings Overview

| Category | Commands | Typical Savings |
|----------|----------|-----------------|
| Tests | vitest, playwright, cargo test | 90-99% |
| Build | next, tsc, lint, prettier | 70-87% |
| Git | status, log, diff, add, commit | 59-80% |
| GitHub | gh pr, gh run, gh issue | 26-87% |
| Package Managers | pnpm, npm, npx | 70-90% |
| Files | ls, read, grep, find | 60-75% |
| Infrastructure | docker, kubectl | 85% |
| Network | curl, wget | 65-70% |

Overall average: **60-90% token reduction** on common development operations.
<!-- /rtk-instructions -->