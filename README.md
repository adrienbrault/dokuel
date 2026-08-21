# Dokuel

1v1 sudoku duel — real-time, peer-to-peer, no account needed.

**[Play now at dokuel.com](https://dokuel.com)**

<!-- hero-screenshots:start -->
<table align="center">
  <tr>
    <td align="center" valign="top"><img src="https://adrienbrault.github.io/dokuel/landing--iPhone-14.png" alt="Landing page" width="220" /></td>
    <td align="center" valign="top"><img src="https://adrienbrault.github.io/dokuel/solo-game--iPhone-14.png" alt="Solo game" width="220" /></td>
    <td align="center" valign="top"><img src="https://adrienbrault.github.io/dokuel/solo-game-dark--iPhone-14.png" alt="Solo game in dark mode" width="220" /></td>
  </tr>
</table>
<!-- hero-screenshots:end -->

> Screenshots are deployed to GitHub Pages on every push to `main` by `.github/workflows/screenshots.yml`. To refresh them locally run `bun run screenshots:readme`.

## Features

### Solo Play

- Four difficulty levels: Easy, Medium, Hard, Expert
- Three assistance levels — Paper (no help), Standard (highlights conflicts, auto-clears resolved notes), Full (also shows remaining-digit counts on the numpad); switchable mid-game from the settings popover
- Pencil notes with a 3x3 mini-grid per cell
- Multi-cell selection — drag across cells to place or erase notes in bulk
- Multi-level undo
- Hint system — surfaces the next logical step (naked or hidden single), explains the reasoning, and highlights the cells that prove it
- Pause with board overlay; also auto-pauses when the browser tab loses focus
- Soft validation — conflicts are surfaced visually but never block a move (off at the Paper assist level)
- Auto-save — resume in-progress games across browser sessions
- Personal best time shown near the timer; PB indicator on win (hint-assisted games are excluded)
- Per-difficulty stats — best time, average, games played — tracked separately per assist level
- Confetti celebration with haptic feedback, sound, and a share button

### Daily Challenge

- One shared medium puzzle per day — same board for everyone, everywhere
- Deterministic generation via seeded RNG — same date, same board, any device
- Streak tracking — current streak on the landing page, current and longest on the Stats screen

### 1v1 Multiplayer

- Peer-to-peer via WebRTC — no game server, state syncs directly between players
- Auto-generated fun player names (adjective + animal) with inline editing in the lobby
- Create a room, share the link, race to solve the same puzzle
- Live opponent progress bar (cells remaining, completion %)
- Resilient to refreshes and brief drops — the synced game is persisted locally via IndexedDB
- 60-second disconnect countdown, then claim the win if the opponent doesn't return
- Rematch without leaving the room
- Win/loss record, win rate, and recent-match history on the Stats screen

### Mobile-First UX

- Touch-optimized with 44px+ tap targets
- Numpad gestures — tap to enter a value, press-and-hold to pencil a note, or drag a digit onto the board (drop high for a value, low for a note)
- Tap a numpad digit with no cell selected to highlight every matching digit on the board
- Haptic feedback (vibration patterns for place, erase, conflict, completion)
- Synthesized sound effects via Web Audio API (toggleable)
- Movable numpad — Bottom (default), Left, or Right — configurable via settings popover
- Safe area support for notched devices
- Dark mode with system preference detection + manual toggle
- Installable — web app manifest with home-screen icons; invite links unfurl with a rich preview card

### Desktop Support

- Full keyboard controls: arrow keys to navigate, 1–9 to place, N to toggle notes, Backspace/Delete to erase, Ctrl/Cmd+Z to undo, Esc to deselect
- Responsive side-by-side layout with board and numpad on wide screens

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI | React 19, Tailwind CSS 4 |
| Build | Vite, TypeScript, Bun |
| Multiplayer | Yjs CRDTs + y-webrtc (peer-to-peer WebRTC) |
| Signaling | Cloudflare Worker + Durable Objects |
| Testing | Vitest, React Testing Library, Playwright |
| Lint & Format | Biome |

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (v1.0+)

### Install & Run

```bash
# Install dependencies
bun install

# Start the dev server
bun run dev
```

The app will be available at `http://localhost:5173`.

### Build for Production

```bash
bun run build
```

Output is written to `dist/`.

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start Vite dev server |
| `bun run build` | Production build |
| `bun run preview` | Preview production build locally |
| `bun run test` | Run tests once |
| `bun run test:watch` | Run tests in watch mode |
| `bun run test:coverage` | Run tests with a coverage report |
| `bun run diff-coverage` | Report test coverage on git-changed lines |
| `bun run lint` | Check lint + formatting |
| `bun run lint:fix` | Auto-fix lint + formatting |
| `bun run typecheck` | TypeScript type checking |
| `bun run ci` | Full CI pipeline (lint + typecheck + test) |
| `bun run screenshots` | Capture Playwright screenshots across 4 viewports |
| `bun run screenshots:combine` | Rebuild combined contact sheets from existing PNGs |
| `bun run screenshots:readme` | Re-capture screenshots and rewrite the README screenshot sections |
| `bun run e2e` | Run all Playwright tests |

## Architecture

```
src/
├── App.tsx         # Root component + client-side router
├── components/     # React UI components
│   ├── Landing, DifficultyPicker, AssistLevelPicker, JoinScreen, Stats
│   ├── SoloGame, DailyGame, GameLayout, GameControls, GameResult, HintBanner
│   ├── Board, Cell, NumPad, NumPadPositionToggle, DigitDragIndicator, Timer
│   ├── MultiplayerScreen, MultiplayerGame, MultiplayerBoard, Lobby
│   ├── MultiplayerHeaderExtra, ProgressBar
│   └── DarkModeToggle, SoundToggle, ToggleSwitch, SlidingRadioGroup, Toast
├── hooks/          # React state hooks + multiplayer logic
│   ├── useSudoku, useResumableSudoku, useKeyboard, useAssistLevel
│   ├── useNumPadPosition, useDarkMode, useLocalStorage, useDelayedFlag
│   ├── useDigitHighlight, useDigitGesture (the gesture recognizer), useDragSelect
│   ├── useYjsMultiplayer, useOpponentProgressVisible, useRecordMultiplayerMatch
│   └── p2p-room (Yjs CRDT room), mp-snapshot, mp-telemetry
├── lib/            # Pure logic — no React dependency
│   ├── sudoku, board-engine, hint-engine, game-completion (engine)
│   ├── digit-intent (what a digit does), numpad-gesture (gesture geometry)
│   ├── types, constants, format, id, storage
│   ├── daily (seeded RNG), daily-streak, stats, multiplayer-stats, game-storage
│   └── room-code, name-generator, game-feedback, haptics, sounds
```

### Key Design Decisions

- **Peer-to-peer multiplayer** — game state syncs via Yjs CRDTs over WebRTC. A self-hosted Cloudflare Worker at `signal.dokuel.com` handles peer discovery; all game data flows directly between players
- **React hooks only** — `useReducer` for game state, no external state library
- **Soft validation** — conflicts are visual feedback, not hard constraints. The board is complete only when fully filled with no violations
- **No accounts** — auto-generated fun names (adjective + animal), persisted in localStorage so the same identity survives reloads and reconnects
- **Colocated tests** — `*.test.ts` / `*.test.tsx` files sit next to the code they test

## Deployment

Both the frontend and signaling server deploy automatically on push to `main`.

| Service | Platform | URL |
|---------|----------|-----|
| Frontend | Cloudflare Pages | [dokuel.com](https://dokuel.com) |
| Signaling | Cloudflare Worker | [signal.dokuel.com](https://signal.dokuel.com) |

## Screenshots

Every scene captured across iPhone SE, iPhone 14, iPad Mini, and Desktop viewports. PNGs are deployed to GitHub Pages by the screenshots workflow and never land in `main`'s history. Click any thumbnail for the full-size image.

<!-- screenshot-matrix:start -->
### Per-device

Each device gets two sheets: menus & entry (landing, difficulty, daily challenge, join, solo entry, multiplayer lobby) and active gameplay (in-progress, win modal, settings popover, numpad variants, multiplayer progress).

<table>
  <thead>
    <tr>
      <th align="left">Device</th>
      <th align="center">Menus & entry</th>
      <th align="center">Active gameplay</th>
    </tr>
  </thead>
  <tbody>
  <tr>
    <th align="left">iPhone SE</th>
    <td align="center"><a href="https://adrienbrault.github.io/dokuel/combined/device--iPhone-SE--a.png"><img src="https://adrienbrault.github.io/dokuel/combined/device--iPhone-SE--a.png" width="320" alt="iPhone SE · Menus & entry" /></a></td>
    <td align="center"><a href="https://adrienbrault.github.io/dokuel/combined/device--iPhone-SE--b.png"><img src="https://adrienbrault.github.io/dokuel/combined/device--iPhone-SE--b.png" width="320" alt="iPhone SE · Active gameplay" /></a></td>
  </tr>
  <tr>
    <th align="left">iPhone 14</th>
    <td align="center"><a href="https://adrienbrault.github.io/dokuel/combined/device--iPhone-14--a.png"><img src="https://adrienbrault.github.io/dokuel/combined/device--iPhone-14--a.png" width="320" alt="iPhone 14 · Menus & entry" /></a></td>
    <td align="center"><a href="https://adrienbrault.github.io/dokuel/combined/device--iPhone-14--b.png"><img src="https://adrienbrault.github.io/dokuel/combined/device--iPhone-14--b.png" width="320" alt="iPhone 14 · Active gameplay" /></a></td>
  </tr>
  <tr>
    <th align="left">iPad Mini</th>
    <td align="center"><a href="https://adrienbrault.github.io/dokuel/combined/device--iPad-Mini--a.png"><img src="https://adrienbrault.github.io/dokuel/combined/device--iPad-Mini--a.png" width="320" alt="iPad Mini · Menus & entry" /></a></td>
    <td align="center"><a href="https://adrienbrault.github.io/dokuel/combined/device--iPad-Mini--b.png"><img src="https://adrienbrault.github.io/dokuel/combined/device--iPad-Mini--b.png" width="320" alt="iPad Mini · Active gameplay" /></a></td>
  </tr>
  <tr>
    <th align="left">Desktop</th>
    <td align="center"><a href="https://adrienbrault.github.io/dokuel/combined/device--Desktop--a.png"><img src="https://adrienbrault.github.io/dokuel/combined/device--Desktop--a.png" width="320" alt="Desktop · Menus & entry" /></a></td>
    <td align="center"><a href="https://adrienbrault.github.io/dokuel/combined/device--Desktop--b.png"><img src="https://adrienbrault.github.io/dokuel/combined/device--Desktop--b.png" width="320" alt="Desktop · Active gameplay" /></a></td>
  </tr>
  </tbody>
</table>

### Per-feature

Each feature sheet shows related scenes across all 4 devices (devices as rows).

#### Onboarding & landing

<a href="https://adrienbrault.github.io/dokuel/combined/feature--onboarding.png"><img src="https://adrienbrault.github.io/dokuel/combined/feature--onboarding.png" width="800" alt="Onboarding & landing" /></a>

#### Solo gameplay

<a href="https://adrienbrault.github.io/dokuel/combined/feature--solo.png"><img src="https://adrienbrault.github.io/dokuel/combined/feature--solo.png" width="800" alt="Solo gameplay" /></a>

#### Numpad positions

<a href="https://adrienbrault.github.io/dokuel/combined/feature--numpad.png"><img src="https://adrienbrault.github.io/dokuel/combined/feature--numpad.png" width="800" alt="Numpad positions" /></a>

#### Multiplayer

<a href="https://adrienbrault.github.io/dokuel/combined/feature--multiplayer.png"><img src="https://adrienbrault.github.io/dokuel/combined/feature--multiplayer.png" width="800" alt="Multiplayer" /></a>

#### Dark-mode pairs (landing & solo)

<a href="https://adrienbrault.github.io/dokuel/combined/feature--dark-mode-a.png"><img src="https://adrienbrault.github.io/dokuel/combined/feature--dark-mode-a.png" width="800" alt="Dark-mode pairs (landing & solo)" /></a>

#### Dark-mode pairs (difficulty & multiplayer)

<a href="https://adrienbrault.github.io/dokuel/combined/feature--dark-mode-b.png"><img src="https://adrienbrault.github.io/dokuel/combined/feature--dark-mode-b.png" width="800" alt="Dark-mode pairs (difficulty & multiplayer)" /></a>
<!-- screenshot-matrix:end -->

## License

[MIT](LICENSE)
