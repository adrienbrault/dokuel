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
- Pencil notes with a 3x3 mini-grid per cell (board ring indicator when active)
- Multi-level undo with move count badge
- Hint system — reveal one cell's correct value
- Pause with board overlay
- Soft validation — conflicts are highlighted in real time but never blocked (toggleable during gameplay)
- Auto-save — resume in-progress games across browser sessions
- Personal best time shown near timer; PB indicator on win
- Timer tracking with per-difficulty stats (best time, average, games played)
- Confetti celebration with haptic feedback, sound, and share button

### Daily Challenge

- Same puzzle for everyone, every day
- Deterministic generation via seeded RNG — same date, same board, any device
- Streak tracking with current/longest streak shown on landing page

### 1v1 Multiplayer

- Peer-to-peer via WebRTC — no server needed, game state syncs directly between players
- Auto-generated fun player names (adjective + animal) with inline editing in lobby
- Create a room, share the link, race to solve the same puzzle
- Live opponent progress bar (cells remaining, completion %)
- 60-second disconnect countdown with option to claim win
- Rematch without leaving the room

### Mobile-First UX

- Touch-optimized with 44px+ tap targets
- Haptic feedback (vibration patterns for place, erase, conflict, completion)
- Synthesized sound effects via Web Audio API (toggleable)
- Movable numpad — Bottom (default), Left, or Right — configurable via settings popover
- Safe area support for notched devices
- Dark mode with system preference detection + manual toggle

### Desktop Support

- Full keyboard controls: arrow keys to navigate, 1–9 to place, N for notes, Delete to erase, Ctrl+Z to undo
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
| `bun run lint` | Check lint + formatting |
| `bun run lint:fix` | Auto-fix lint + formatting |
| `bun run typecheck` | TypeScript type checking |
| `bun run ci` | Full CI pipeline (lint + typecheck + test) |
| `bun run screenshots` | Capture Playwright screenshots across 4 viewports |
| `bun run screenshots:readme` | Re-capture screenshots and rewrite the README screenshot sections |
| `bun run e2e` | Run all Playwright tests |

## Architecture

```
src/
├── components/     # React UI components
│   ├── Board, Cell, NumPad, NumPadPositionToggle
│   ├── SoloGame, MultiplayerGame, MultiplayerBoard, Lobby, Landing
│   ├── GameLayout, GameControls, GameResult, Stats, DifficultyPicker, Timer
│   ├── DarkModeToggle, SoundToggle, ToggleSwitch, Toast
│   └── App (router)
├── hooks/          # State management
│   ├── useSudoku, useYjsMultiplayer, useKeyboard
│   └── useNumPadPosition, useDarkMode
├── lib/            # Pure logic — no React dependency
│   ├── sudoku (engine), types, p2p-room (Yjs CRDT), room-code
│   ├── daily (seeded RNG), daily-streak, stats, game-storage
│   └── name-generator, haptics, sounds, format, constants
```

### Key Design Decisions

- **Peer-to-peer multiplayer** — game state syncs via Yjs CRDTs over WebRTC. A self-hosted Cloudflare Worker at `signal.dokuel.com` handles peer discovery; all game data flows directly between players
- **React hooks only** — `useReducer` for game state, no external state library
- **Soft validation** — conflicts are visual feedback, not hard constraints. The board is complete only when fully filled with no violations
- **No accounts** — auto-generated fun names (adjective + animal), persisted in localStorage; session identity in sessionStorage for reconnect
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
<details>
<summary>All 14 contact sheets (8 per-device · 6 per-feature)</summary>

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

</details>
<!-- screenshot-matrix:end -->

## License

[MIT](LICENSE)
