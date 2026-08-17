# Dokuel - Product Specification

## Overview

Premium, mobile-first web app for solo and real-time 1v1 sudoku. No accounts required. Touch-first, frictionless, beautiful.

## Core Principles

- Mobile/touch first — portrait, one-handed play
- No account required — auto-generated fun name (adjective + animal) + random color
- Minimal friction — instant start, join by link
- Beautiful visual hierarchy — "Apple Notes meets NYT Games"
- Very fast input latency
- Real-time multiplayer with resilient reconnect

## User Flows

### Landing Page
Four primary actions, always visible:
1. **Start Solo** — immediately pick difficulty, start playing
2. **Daily Challenge** — same puzzle for everyone, every day (seeded RNG)
3. **Create Game** — create a 1v1 room, get a share link
4. **Join Game** — join from invite link (or manual room code)

Plus contextual entries:
- **Continue** — resume the most recent in-progress solo game
- **View Stats** — per-difficulty solo stats and multiplayer match history
- Current daily streak indicator

### Difficulty Selection
Available before every game (solo or multiplayer):
- Easy (~45 clues)
- Medium (~35 clues)
- Hard (~28 clues)
- Expert (~22 clues)

**Assistance selector** (three levels, also switchable mid-game from the
settings popover):
- **Paper** — no help at all: no conflict marks, no auto-cleared notes
- **Standard** — conflicts highlighted, resolved pencil notes auto-cleared
- **Full** — Standard plus remaining-digit counts on the numpad and
  row/column/box halos for the highlighted digit

### Solo Game
- Standard sudoku with timer
- Notes mode (with subtle board ring indicator when active), erase, undo (with move count badge)
- Hint system — surfaces the next logical step (naked or hidden single) with
  an explanation and the proving cells highlighted; if the board contains a
  wrong entry, the hint points at the mistake first. Falls back to revealing
  the selected cell's correct value when no deduction applies.
- Pause functionality — overlay hides the board while paused; auto-pauses
  when the tab is hidden
- Soft validation: conflicts shown, not blocked (per the assist level)
- Auto-save — game progress persists across browser sessions via localStorage
- Shareable board URLs — `/solo/<difficulty>/<key>` seeds generation, so the
  same link reproduces the same board on any device
- Personal best time shown near timer during gameplay; PB indicator on win
  (hint-assisted games are excluded from PB tracking)
- Completion when all cells filled and valid
- Per-difficulty stats tracking (best time, average, games played) in
  localStorage, kept per assist level
- Win modal with stats summary, personal best indicator, and share button
- Confetti celebration animation on completion

### Daily Challenge
- Same puzzle for everyone, every day
- Deterministic generation via seeded RNG — same date produces same board on any device
- Medium difficulty
- Streak tracking — current streak and longest streak shown on landing page

### Create Game Flow
1. User taps "Create Game"
2. Selects difficulty
3. Lobby opens with shareable link and room code (tap to copy)
4. User shares link (Web Share API or copy)
5. When opponent joins, either player can start the game

### Join Game Flow
1. Recipient opens invite link (`/{roomId}`) — codes are normalized to
   lowercase, so links mangled by messaging apps still land in the room
2. Joins the lobby directly under their auto-generated name (rename inline)
3. If room full: "Game is full" screen
4. If nothing answers within ~12 seconds: "Still trying to connect…" screen
   with Retry and Back — the room may have ended or the network can't get
   through
5. Junk paths never open rooms: only room-code-shaped URLs boot the
   multiplayer stack; anything else is a 404 page

### 1v1 Race Mode
- Both players get the same puzzle
- Each has their own separate board
- First to valid completion wins
- Live opponent progress visible (completion %), hideable via settings

## Game Board

### Interactions
- Tap cell to select
- Selected cell highlights entire row, column, and 3x3 box
- Same-number highlighting across board
- Conflicts marked in red with a wavy underline (soft validation — not
  blocked; the underline keeps the state readable without color)
- Given cells visually distinct (bold, darker color), non-editable
- Notes rendered as small 3x3 grid within cell
- Drag across cells to select a range for bulk note placement/erase
- Dragging from a filled cell carries its digit to another cell

### Controls
- **Notes toggle**: Switch between place mode and notes mode (board ring indicator when active)
- **Erase**: Clear selected non-given cell (value + notes)
- **Undo**: Revert last action (multi-level), with move count badge
- **Hint**: Reveal the next logical step (solo only)
- **Settings popover**: numpad position, assistance level, dark mode, sound

### Number Pad
Core UX differentiator. Three layout positions:
- **Bottom** (default): Horizontal row of 1-9
- **Left**: Vertical column on left side of board
- **Right**: Vertical column on right side of board

Purpose of side layouts: enable two-finger mobile play — one finger holds numpad number, other taps cells.

Setting persists in localStorage across sessions. Position is configurable via a settings popover accessed from the game header.

Gesture model (`tap = enter · hold = note · drag = place`):
- **Tap** a digit with a cell selected: commit the value
- **Tap** with a multi-cell selection: pencil the digit as a note into
  every selected cell, then release the selection and highlight the
  noted digit board-wide (same semantics as dropping a note from a
  drag) — the next tap toggles another digit's highlight
- **Tap** with no cell selected: toggle board-wide highlight of that digit
- **Hold** a digit: pencil it as a note into the selected cell(s),
  keeping the selection — the stacking gesture for pairs/triples
- **Drag** a digit onto the board: drop on the top half of a cell to commit
  the value, bottom half to add a note; dragging back over the numpad
  resumes skimming

## Real-time Multiplayer

### Architecture
- Peer-to-peer via Yjs CRDTs + y-webrtc — game data flows directly between players
- Self-hosted Cloudflare Worker at `signal.dokuel.com` used only for WebRTC
  peer discovery; each room is sharded to its own Durable Object via the
  URL path
- Game state syncs directly between players via CRDTs
- TURN relay for symmetric-NAT traversal (cellular <-> wifi games):
  the signaling worker mints ephemeral Cloudflare Realtime TURN
  credentials at `GET /turn-credentials`, fetched by the client before
  connecting (cached per page session, 3s timeout). Build-time env
  (`VITE_TURN_URL` / `VITE_TURN_USERNAME` / `VITE_TURN_CREDENTIAL`)
  overrides it with static credentials; with neither, STUN-only

### Player Identity
- Auto-generated fun names (adjective + animal, e.g. "Swift Panda")
- Inline name editing in lobby — players can rename themselves
- Player id and name persisted in localStorage

### Opponent Visibility
- Nickname + assigned color
- Completion percentage progress bar (toggleable in settings)
- Online/reconnecting status indicator

### Reconnect Handling
- The synced game is persisted locally (IndexedDB) plus a synchronous
  localStorage snapshot flushed on tab-hide, so a refresh or iOS tab
  eviction resumes cleanly
- On reconnect, Yjs CRDT state merges automatically
- Presence is re-announced after every reconnect cycle
- Opponent sees "Opponent (reconnecting...)" on the progress bar

### Disconnect Handling
- Opponent disconnect shows a non-blocking status banner — the board stays
  fully playable underneath
- 60-second countdown, then the remaining player may claim the win
- Claim validation: a remote forfeit claim is only honored if this client
  actually witnessed its own absence (connection drop/hidden tab), with a
  2-minute trust window after returning — a fabricated claim from devtools
  is ignored

### Post-Game
- Winner announcement with confetti celebration
- Stats: time, personal best indicator
- Share result button
- "Rematch" button (same players, new puzzle, same difficulty)
- "New Game" button (back to landing)
- Match recorded to multiplayer history (opponent, outcome, time) shown on
  the Stats screen

## Validation Rules

**Soft validation** (default):
- Conflicting moves highlighted visually (red + wavy underline)
- Moves are NOT blocked
- Player can leave wrong numbers
- Completion only accepted when board is fully valid and all cells filled

## Design Direction

- Minimalist, clean, modern game UI
- Soft surfaces, clear typography, high contrast
- Subtle animations with restraint (cell reveal, spring press, glow, confetti);
  disabled under `prefers-reduced-motion`
- Dark mode from day one (system preference + manual toggle)
- Responsive desktop layout — side-by-side board and numpad on wide screens
- Large touch targets (minimum 44px)
- Safe area support (iPhone notch/home indicator)
- Haptic feedback where supported (number place, erase, note toggle, conflict, completion)
- Synthesized sound effects via Web Audio API (toggleable)
- URL reflects current screen state (solo, daily, join) for bookmarking and refresh
- Installable: web app manifest + home-screen icons; invite links unfurl
  with a rich preview card (og:image)

### Color Palette
- Warm neutral backgrounds (cream light theme, deep charcoal dark theme)
- Teal accent for selection/highlights and primary actions
- Red for conflicts
- Semantic tokens defined once in CSS; no per-component dark variants

## Technical Constraints

- Bun runtime
- Vite + React 19 + Tailwind CSS 4
- Yjs + y-webrtc for peer-to-peer multiplayer
- Deploy to Cloudflare Pages
- Biome for lint/format
- Vitest for testing
- Strict TDD: every feature gets tests first

## Backlog

Speced or desired, deliberately not built yet:

- **Board Sharing mechanic** — social catch-up for multiplayer: either
  player offers their filled cells; on accept they become given cells on
  BOTH boards (notes not shared). One-sentence pitch: "Share your filled
  cells as hints for both players."
- **Service worker / offline play** — the manifest already makes the app
  installable; offline caching needs careful interplay with live WebRTC
  rooms before it ships
- **Technique-graded difficulty** — grade generated puzzles by the solving
  techniques they require instead of clue count; needs a versioned rollout
  because the daily challenge pins golden vectors for reproducibility
