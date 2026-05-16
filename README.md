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
<summary>All 18 scenes × 4 devices</summary>

| Scene | iPhone SE | iPhone 14 | iPad Mini | Desktop |
| --- | --- | --- | --- | --- |
| **Daily challenge** | <a href="https://adrienbrault.github.io/dokuel/daily-challenge--iPhone-SE.png"><img src="https://adrienbrault.github.io/dokuel/daily-challenge--iPhone-SE.png" width="160" alt="Daily challenge on iPhone SE" /></a> | <a href="https://adrienbrault.github.io/dokuel/daily-challenge--iPhone-14.png"><img src="https://adrienbrault.github.io/dokuel/daily-challenge--iPhone-14.png" width="160" alt="Daily challenge on iPhone 14" /></a> | <a href="https://adrienbrault.github.io/dokuel/daily-challenge--iPad-Mini.png"><img src="https://adrienbrault.github.io/dokuel/daily-challenge--iPad-Mini.png" width="160" alt="Daily challenge on iPad Mini" /></a> | <a href="https://adrienbrault.github.io/dokuel/daily-challenge--Desktop.png"><img src="https://adrienbrault.github.io/dokuel/daily-challenge--Desktop.png" width="160" alt="Daily challenge on Desktop" /></a> |
| **Difficulty picker** | <a href="https://adrienbrault.github.io/dokuel/difficulty--iPhone-SE.png"><img src="https://adrienbrault.github.io/dokuel/difficulty--iPhone-SE.png" width="160" alt="Difficulty picker on iPhone SE" /></a> | <a href="https://adrienbrault.github.io/dokuel/difficulty--iPhone-14.png"><img src="https://adrienbrault.github.io/dokuel/difficulty--iPhone-14.png" width="160" alt="Difficulty picker on iPhone 14" /></a> | <a href="https://adrienbrault.github.io/dokuel/difficulty--iPad-Mini.png"><img src="https://adrienbrault.github.io/dokuel/difficulty--iPad-Mini.png" width="160" alt="Difficulty picker on iPad Mini" /></a> | <a href="https://adrienbrault.github.io/dokuel/difficulty--Desktop.png"><img src="https://adrienbrault.github.io/dokuel/difficulty--Desktop.png" width="160" alt="Difficulty picker on Desktop" /></a> |
| **Difficulty picker (dark)** | <a href="https://adrienbrault.github.io/dokuel/difficulty-dark--iPhone-SE.png"><img src="https://adrienbrault.github.io/dokuel/difficulty-dark--iPhone-SE.png" width="160" alt="Difficulty picker (dark) on iPhone SE" /></a> | <a href="https://adrienbrault.github.io/dokuel/difficulty-dark--iPhone-14.png"><img src="https://adrienbrault.github.io/dokuel/difficulty-dark--iPhone-14.png" width="160" alt="Difficulty picker (dark) on iPhone 14" /></a> | <a href="https://adrienbrault.github.io/dokuel/difficulty-dark--iPad-Mini.png"><img src="https://adrienbrault.github.io/dokuel/difficulty-dark--iPad-Mini.png" width="160" alt="Difficulty picker (dark) on iPad Mini" /></a> | <a href="https://adrienbrault.github.io/dokuel/difficulty-dark--Desktop.png"><img src="https://adrienbrault.github.io/dokuel/difficulty-dark--Desktop.png" width="160" alt="Difficulty picker (dark) on Desktop" /></a> |
| **Join game** | <a href="https://adrienbrault.github.io/dokuel/join-game--iPhone-SE.png"><img src="https://adrienbrault.github.io/dokuel/join-game--iPhone-SE.png" width="160" alt="Join game on iPhone SE" /></a> | <a href="https://adrienbrault.github.io/dokuel/join-game--iPhone-14.png"><img src="https://adrienbrault.github.io/dokuel/join-game--iPhone-14.png" width="160" alt="Join game on iPhone 14" /></a> | <a href="https://adrienbrault.github.io/dokuel/join-game--iPad-Mini.png"><img src="https://adrienbrault.github.io/dokuel/join-game--iPad-Mini.png" width="160" alt="Join game on iPad Mini" /></a> | <a href="https://adrienbrault.github.io/dokuel/join-game--Desktop.png"><img src="https://adrienbrault.github.io/dokuel/join-game--Desktop.png" width="160" alt="Join game on Desktop" /></a> |
| **Landing** | <a href="https://adrienbrault.github.io/dokuel/landing--iPhone-SE.png"><img src="https://adrienbrault.github.io/dokuel/landing--iPhone-SE.png" width="160" alt="Landing on iPhone SE" /></a> | <a href="https://adrienbrault.github.io/dokuel/landing--iPhone-14.png"><img src="https://adrienbrault.github.io/dokuel/landing--iPhone-14.png" width="160" alt="Landing on iPhone 14" /></a> | <a href="https://adrienbrault.github.io/dokuel/landing--iPad-Mini.png"><img src="https://adrienbrault.github.io/dokuel/landing--iPad-Mini.png" width="160" alt="Landing on iPad Mini" /></a> | <a href="https://adrienbrault.github.io/dokuel/landing--Desktop.png"><img src="https://adrienbrault.github.io/dokuel/landing--Desktop.png" width="160" alt="Landing on Desktop" /></a> |
| **Landing (dark)** | <a href="https://adrienbrault.github.io/dokuel/landing-dark--iPhone-SE.png"><img src="https://adrienbrault.github.io/dokuel/landing-dark--iPhone-SE.png" width="160" alt="Landing (dark) on iPhone SE" /></a> | <a href="https://adrienbrault.github.io/dokuel/landing-dark--iPhone-14.png"><img src="https://adrienbrault.github.io/dokuel/landing-dark--iPhone-14.png" width="160" alt="Landing (dark) on iPhone 14" /></a> | <a href="https://adrienbrault.github.io/dokuel/landing-dark--iPad-Mini.png"><img src="https://adrienbrault.github.io/dokuel/landing-dark--iPad-Mini.png" width="160" alt="Landing (dark) on iPad Mini" /></a> | <a href="https://adrienbrault.github.io/dokuel/landing-dark--Desktop.png"><img src="https://adrienbrault.github.io/dokuel/landing-dark--Desktop.png" width="160" alt="Landing (dark) on Desktop" /></a> |
| **Multiplayer · lobby** | <a href="https://adrienbrault.github.io/dokuel/multiplayer-lobby--iPhone-SE.png"><img src="https://adrienbrault.github.io/dokuel/multiplayer-lobby--iPhone-SE.png" width="160" alt="Multiplayer · lobby on iPhone SE" /></a> | <a href="https://adrienbrault.github.io/dokuel/multiplayer-lobby--iPhone-14.png"><img src="https://adrienbrault.github.io/dokuel/multiplayer-lobby--iPhone-14.png" width="160" alt="Multiplayer · lobby on iPhone 14" /></a> | <a href="https://adrienbrault.github.io/dokuel/multiplayer-lobby--iPad-Mini.png"><img src="https://adrienbrault.github.io/dokuel/multiplayer-lobby--iPad-Mini.png" width="160" alt="Multiplayer · lobby on iPad Mini" /></a> | <a href="https://adrienbrault.github.io/dokuel/multiplayer-lobby--Desktop.png"><img src="https://adrienbrault.github.io/dokuel/multiplayer-lobby--Desktop.png" width="160" alt="Multiplayer · lobby on Desktop" /></a> |
| **Multiplayer · progress bars** | <a href="https://adrienbrault.github.io/dokuel/multiplayer-progress-bars--iPhone-SE.png"><img src="https://adrienbrault.github.io/dokuel/multiplayer-progress-bars--iPhone-SE.png" width="160" alt="Multiplayer · progress bars on iPhone SE" /></a> | <a href="https://adrienbrault.github.io/dokuel/multiplayer-progress-bars--iPhone-14.png"><img src="https://adrienbrault.github.io/dokuel/multiplayer-progress-bars--iPhone-14.png" width="160" alt="Multiplayer · progress bars on iPhone 14" /></a> | <a href="https://adrienbrault.github.io/dokuel/multiplayer-progress-bars--iPad-Mini.png"><img src="https://adrienbrault.github.io/dokuel/multiplayer-progress-bars--iPad-Mini.png" width="160" alt="Multiplayer · progress bars on iPad Mini" /></a> | <a href="https://adrienbrault.github.io/dokuel/multiplayer-progress-bars--Desktop.png"><img src="https://adrienbrault.github.io/dokuel/multiplayer-progress-bars--Desktop.png" width="160" alt="Multiplayer · progress bars on Desktop" /></a> |
| **Multiplayer · progress bars (dark)** | <a href="https://adrienbrault.github.io/dokuel/multiplayer-progress-bars-dark--iPhone-SE.png"><img src="https://adrienbrault.github.io/dokuel/multiplayer-progress-bars-dark--iPhone-SE.png" width="160" alt="Multiplayer · progress bars (dark) on iPhone SE" /></a> | <a href="https://adrienbrault.github.io/dokuel/multiplayer-progress-bars-dark--iPhone-14.png"><img src="https://adrienbrault.github.io/dokuel/multiplayer-progress-bars-dark--iPhone-14.png" width="160" alt="Multiplayer · progress bars (dark) on iPhone 14" /></a> | <a href="https://adrienbrault.github.io/dokuel/multiplayer-progress-bars-dark--iPad-Mini.png"><img src="https://adrienbrault.github.io/dokuel/multiplayer-progress-bars-dark--iPad-Mini.png" width="160" alt="Multiplayer · progress bars (dark) on iPad Mini" /></a> | <a href="https://adrienbrault.github.io/dokuel/multiplayer-progress-bars-dark--Desktop.png"><img src="https://adrienbrault.github.io/dokuel/multiplayer-progress-bars-dark--Desktop.png" width="160" alt="Multiplayer · progress bars (dark) on Desktop" /></a> |
| **Multiplayer · progress hidden** | <a href="https://adrienbrault.github.io/dokuel/multiplayer-progress-hidden--iPhone-SE.png"><img src="https://adrienbrault.github.io/dokuel/multiplayer-progress-hidden--iPhone-SE.png" width="160" alt="Multiplayer · progress hidden on iPhone SE" /></a> | <a href="https://adrienbrault.github.io/dokuel/multiplayer-progress-hidden--iPhone-14.png"><img src="https://adrienbrault.github.io/dokuel/multiplayer-progress-hidden--iPhone-14.png" width="160" alt="Multiplayer · progress hidden on iPhone 14" /></a> | <a href="https://adrienbrault.github.io/dokuel/multiplayer-progress-hidden--iPad-Mini.png"><img src="https://adrienbrault.github.io/dokuel/multiplayer-progress-hidden--iPad-Mini.png" width="160" alt="Multiplayer · progress hidden on iPad Mini" /></a> | <a href="https://adrienbrault.github.io/dokuel/multiplayer-progress-hidden--Desktop.png"><img src="https://adrienbrault.github.io/dokuel/multiplayer-progress-hidden--Desktop.png" width="160" alt="Multiplayer · progress hidden on Desktop" /></a> |
| **Multiplayer · settings toggle** | <a href="https://adrienbrault.github.io/dokuel/multiplayer-settings-toggle--iPhone-SE.png"><img src="https://adrienbrault.github.io/dokuel/multiplayer-settings-toggle--iPhone-SE.png" width="160" alt="Multiplayer · settings toggle on iPhone SE" /></a> | <a href="https://adrienbrault.github.io/dokuel/multiplayer-settings-toggle--iPhone-14.png"><img src="https://adrienbrault.github.io/dokuel/multiplayer-settings-toggle--iPhone-14.png" width="160" alt="Multiplayer · settings toggle on iPhone 14" /></a> | <a href="https://adrienbrault.github.io/dokuel/multiplayer-settings-toggle--iPad-Mini.png"><img src="https://adrienbrault.github.io/dokuel/multiplayer-settings-toggle--iPad-Mini.png" width="160" alt="Multiplayer · settings toggle on iPad Mini" /></a> | <a href="https://adrienbrault.github.io/dokuel/multiplayer-settings-toggle--Desktop.png"><img src="https://adrienbrault.github.io/dokuel/multiplayer-settings-toggle--Desktop.png" width="160" alt="Multiplayer · settings toggle on Desktop" /></a> |
| **Solo game** | <a href="https://adrienbrault.github.io/dokuel/solo-game--iPhone-SE.png"><img src="https://adrienbrault.github.io/dokuel/solo-game--iPhone-SE.png" width="160" alt="Solo game on iPhone SE" /></a> | <a href="https://adrienbrault.github.io/dokuel/solo-game--iPhone-14.png"><img src="https://adrienbrault.github.io/dokuel/solo-game--iPhone-14.png" width="160" alt="Solo game on iPhone 14" /></a> | <a href="https://adrienbrault.github.io/dokuel/solo-game--iPad-Mini.png"><img src="https://adrienbrault.github.io/dokuel/solo-game--iPad-Mini.png" width="160" alt="Solo game on iPad Mini" /></a> | <a href="https://adrienbrault.github.io/dokuel/solo-game--Desktop.png"><img src="https://adrienbrault.github.io/dokuel/solo-game--Desktop.png" width="160" alt="Solo game on Desktop" /></a> |
| **Solo game (dark)** | <a href="https://adrienbrault.github.io/dokuel/solo-game-dark--iPhone-SE.png"><img src="https://adrienbrault.github.io/dokuel/solo-game-dark--iPhone-SE.png" width="160" alt="Solo game (dark) on iPhone SE" /></a> | <a href="https://adrienbrault.github.io/dokuel/solo-game-dark--iPhone-14.png"><img src="https://adrienbrault.github.io/dokuel/solo-game-dark--iPhone-14.png" width="160" alt="Solo game (dark) on iPhone 14" /></a> | <a href="https://adrienbrault.github.io/dokuel/solo-game-dark--iPad-Mini.png"><img src="https://adrienbrault.github.io/dokuel/solo-game-dark--iPad-Mini.png" width="160" alt="Solo game (dark) on iPad Mini" /></a> | <a href="https://adrienbrault.github.io/dokuel/solo-game-dark--Desktop.png"><img src="https://adrienbrault.github.io/dokuel/solo-game-dark--Desktop.png" width="160" alt="Solo game (dark) on Desktop" /></a> |
| **Solo · in progress** | <a href="https://adrienbrault.github.io/dokuel/solo-in-progress--iPhone-SE.png"><img src="https://adrienbrault.github.io/dokuel/solo-in-progress--iPhone-SE.png" width="160" alt="Solo · in progress on iPhone SE" /></a> | <a href="https://adrienbrault.github.io/dokuel/solo-in-progress--iPhone-14.png"><img src="https://adrienbrault.github.io/dokuel/solo-in-progress--iPhone-14.png" width="160" alt="Solo · in progress on iPhone 14" /></a> | <a href="https://adrienbrault.github.io/dokuel/solo-in-progress--iPad-Mini.png"><img src="https://adrienbrault.github.io/dokuel/solo-in-progress--iPad-Mini.png" width="160" alt="Solo · in progress on iPad Mini" /></a> | <a href="https://adrienbrault.github.io/dokuel/solo-in-progress--Desktop.png"><img src="https://adrienbrault.github.io/dokuel/solo-in-progress--Desktop.png" width="160" alt="Solo · in progress on Desktop" /></a> |
| **Solo · numpad left** | <a href="https://adrienbrault.github.io/dokuel/solo-numpad-left--iPhone-SE.png"><img src="https://adrienbrault.github.io/dokuel/solo-numpad-left--iPhone-SE.png" width="160" alt="Solo · numpad left on iPhone SE" /></a> | <a href="https://adrienbrault.github.io/dokuel/solo-numpad-left--iPhone-14.png"><img src="https://adrienbrault.github.io/dokuel/solo-numpad-left--iPhone-14.png" width="160" alt="Solo · numpad left on iPhone 14" /></a> | <a href="https://adrienbrault.github.io/dokuel/solo-numpad-left--iPad-Mini.png"><img src="https://adrienbrault.github.io/dokuel/solo-numpad-left--iPad-Mini.png" width="160" alt="Solo · numpad left on iPad Mini" /></a> | <a href="https://adrienbrault.github.io/dokuel/solo-numpad-left--Desktop.png"><img src="https://adrienbrault.github.io/dokuel/solo-numpad-left--Desktop.png" width="160" alt="Solo · numpad left on Desktop" /></a> |
| **Solo · numpad right** | <a href="https://adrienbrault.github.io/dokuel/solo-numpad-right--iPhone-SE.png"><img src="https://adrienbrault.github.io/dokuel/solo-numpad-right--iPhone-SE.png" width="160" alt="Solo · numpad right on iPhone SE" /></a> | <a href="https://adrienbrault.github.io/dokuel/solo-numpad-right--iPhone-14.png"><img src="https://adrienbrault.github.io/dokuel/solo-numpad-right--iPhone-14.png" width="160" alt="Solo · numpad right on iPhone 14" /></a> | <a href="https://adrienbrault.github.io/dokuel/solo-numpad-right--iPad-Mini.png"><img src="https://adrienbrault.github.io/dokuel/solo-numpad-right--iPad-Mini.png" width="160" alt="Solo · numpad right on iPad Mini" /></a> | <a href="https://adrienbrault.github.io/dokuel/solo-numpad-right--Desktop.png"><img src="https://adrienbrault.github.io/dokuel/solo-numpad-right--Desktop.png" width="160" alt="Solo · numpad right on Desktop" /></a> |
| **Solo · settings popover** | <a href="https://adrienbrault.github.io/dokuel/solo-settings-popover--iPhone-SE.png"><img src="https://adrienbrault.github.io/dokuel/solo-settings-popover--iPhone-SE.png" width="160" alt="Solo · settings popover on iPhone SE" /></a> | <a href="https://adrienbrault.github.io/dokuel/solo-settings-popover--iPhone-14.png"><img src="https://adrienbrault.github.io/dokuel/solo-settings-popover--iPhone-14.png" width="160" alt="Solo · settings popover on iPhone 14" /></a> | <a href="https://adrienbrault.github.io/dokuel/solo-settings-popover--iPad-Mini.png"><img src="https://adrienbrault.github.io/dokuel/solo-settings-popover--iPad-Mini.png" width="160" alt="Solo · settings popover on iPad Mini" /></a> | <a href="https://adrienbrault.github.io/dokuel/solo-settings-popover--Desktop.png"><img src="https://adrienbrault.github.io/dokuel/solo-settings-popover--Desktop.png" width="160" alt="Solo · settings popover on Desktop" /></a> |
| **Solo · win modal** | <a href="https://adrienbrault.github.io/dokuel/solo-win-modal--iPhone-SE.png"><img src="https://adrienbrault.github.io/dokuel/solo-win-modal--iPhone-SE.png" width="160" alt="Solo · win modal on iPhone SE" /></a> | <a href="https://adrienbrault.github.io/dokuel/solo-win-modal--iPhone-14.png"><img src="https://adrienbrault.github.io/dokuel/solo-win-modal--iPhone-14.png" width="160" alt="Solo · win modal on iPhone 14" /></a> | <a href="https://adrienbrault.github.io/dokuel/solo-win-modal--iPad-Mini.png"><img src="https://adrienbrault.github.io/dokuel/solo-win-modal--iPad-Mini.png" width="160" alt="Solo · win modal on iPad Mini" /></a> | <a href="https://adrienbrault.github.io/dokuel/solo-win-modal--Desktop.png"><img src="https://adrienbrault.github.io/dokuel/solo-win-modal--Desktop.png" width="160" alt="Solo · win modal on Desktop" /></a> |

</details>
<!-- screenshot-matrix:end -->

## License

[MIT](LICENSE)
