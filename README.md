# Sudoku 1v1

Premium, mobile-first Sudoku with real-time 1v1 multiplayer. No accounts required.

**[Play now at sudoku.brage.fr](https://sudoku.brage.fr)**

## Features

### Solo Play

- Four difficulty levels: Easy, Medium, Hard, Expert
- Pencil notes with a 3x3 mini-grid per cell
- Multi-level undo
- Soft validation — conflicts are highlighted in real time but never blocked
- Timer tracking with per-difficulty stats (best time, average, games played)
- Completion celebration with haptic feedback and sound

### Daily Challenge

- Same puzzle for everyone, every day
- Deterministic generation via seeded RNG — same date, same board, any device

### 1v1 Multiplayer

- Peer-to-peer via WebRTC — no server needed, game state syncs directly between players
- Create a room, share the link, race to solve the same puzzle
- Live opponent progress bar (cells remaining, completion %)
- Disconnect resilience with reconnect grace period
- Rematch without leaving the room

### Mobile-First UX

- Touch-optimized with 44px+ tap targets
- Haptic feedback (vibration patterns for place, erase, conflict, completion)
- Synthesized sound effects via Web Audio API (toggleable)
- Movable numpad — Bottom (default), Left, or Right for two-finger play
- Safe area support for notched devices
- Dark mode with system preference detection

### Desktop Support

- Full keyboard controls: arrow keys to navigate, 1–9 to place, N for notes, Delete to erase, Ctrl+Z to undo
- Same feature set as mobile

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI | React 19, Tailwind CSS 4 |
| Build | Vite, TypeScript, Bun |
| Multiplayer | Yjs CRDTs + y-webrtc (peer-to-peer, no server) |
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
| `bun run e2e` | Run all Playwright tests |

## Architecture

```
src/
├── components/     # React UI components (Board, NumPad, Lobby, etc.)
├── hooks/          # State management (useSudoku, useYjsMultiplayer, useKeyboard, etc.)
├── lib/            # Pure logic — puzzle generation, validation, P2P room, types
```

### Key Design Decisions

- **Peer-to-peer multiplayer** — game state syncs via Yjs CRDTs over WebRTC. Public signaling servers handle peer discovery only; no custom backend needed
- **React hooks only** — `useReducer` for game state, no external state library
- **Soft validation** — conflicts are visual feedback, not hard constraints. The board is complete only when fully filled with no violations
- **No accounts** — nickname + random color, stored in sessionStorage for reconnect identity
- **Colocated tests** — `*.test.ts` / `*.test.tsx` files sit next to the code they test

## Deployment

The frontend deploys automatically on push to `main` via Cloudflare Pages. No server infrastructure needed — multiplayer is fully peer-to-peer.

| Service | Platform | URL |
|---------|----------|-----|
| Frontend | Cloudflare Pages | [sudoku.brage.fr](https://sudoku.brage.fr) |

## License

[MIT](LICENSE)
