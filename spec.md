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

**Gesture demo (first-timers only)** — a small card above the actions
that plays a game by itself on the real board and numpad, scaled down
and non-interactive, with a fingertip and a one-line caption per step.
It is how new players learn the numpad (there is no separate
tutorial). One loop of the script (`src/lib/landing-demo.ts`, about
16 seconds):
1. Tap a cell to select it, then tap a number to fill it in
2. Hold a number to pencil a note, hold another to stack a second note
3. Slide along the pad: each digit is highlighted board-wide
4. Slide up off the pad into a drag: hovering a cell's top half
   previews the value, the bottom half previews a note; letting go on
   the top half places it
5. Tap a wrong number: the clash turns red (soft validation)

Every step runs through the same digit rules as a real game, so the
demo cannot show a gesture that behaves differently in play. Rules:
- Shown until the device has finished any game (solo, daily or duel,
  won or lost); returning players go straight to the actions
- On short screens (iPhone SE class) it hides while a first game is in
  progress, so Continue and the four actions stay above the fold
- `prefers-reduced-motion`: one still frame beside a terse list of
  every gesture
- Pauses (no timers) while the tab is hidden or the card is off screen;
  no sounds, haptics or storage writes

### Difficulty Selection
Available before every game (solo or multiplayer):
- Easy (~45 clues)
- Medium (~35 clues) — technique-graded ceiling: pairs and locked
  candidates at most, never triples, X-wings, or guessing
- Hard (~28 clues) — technique-graded: demands at least triples or an
  X-wing, may go up to quads, XY-wings, and swordfish, and is
  guaranteed solvable start to finish without chains or guessing
- Expert (~22 clues) — technique-graded: the full ladder (through
  quads, XY-wings, and swordfish) runs dry with 40+ cells still open;
  chains or trial-and-error required

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
- "Beat my time" async challenges, for when a live 1v1 is not practical:
  - The win modal offers "Challenge a friend", which shares the board URL
    plus the finisher's time and name (`/solo/<difficulty>/<key>?t=<seconds>&by=<name>`,
    `&h=1` when hints were used) through the Web Share API, falling back
    to copying the invite line and link to the clipboard
  - Opening such a link shows a small "<name>'s time 4:32" pill under the
    header while playing; the challenge is saved with the game, so it
    survives a refresh or a resume from the landing list
  - On the win the result compares: "You beat <name> by 0:41",
    "<name> was 0:12 faster" or "Dead heat with <name>", notes who used
    hints if anyone did, and offers "Challenge back" with the player's
    own time
  - Link values are untrusted: the time is clamped (1 second to just under
    a day), the name trimmed, stripped of control characters and capped;
    a link without a usable time is a plain solo board
  - Not offered on the daily challenge: `/daily` resolves to the viewer's
    local date, so a link opened later could land on a different board

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
- The match result opens for BOTH players as soon as the game is decided,
  winner with confetti; the loser sees how far they got
- "Keep solving" lets a loser who wants to finish set the result aside; a
  banner brings it back, and it returns on its own once their board is done
- Running score for the room ("2–1 vs Brave Otter"), from the local match
  history plus the game that just ended
- Rematch is a handshake: the first tap asks ("Waiting for Bob…"), the
  opponent sees "Bob wants a rematch!" and "Accept rematch", and the board
  is dealt to both once both asked. Votes are per player in their own Yjs
  map (crossing taps both survive), tied to the game number and difficulty
  they were cast for; the vote completing the set deals in the same
  transaction, and the host also deals on seeing all votes
- The host picks the next game's difficulty right in the result (the guest
  sees it read-only); changing it asks both players to agree again
- Watch the replay of both boards; "Leave room" goes back to landing
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

## Telemetry

Anonymous, and only from deployed builds (never dev servers, tests or a
preview served from localhost). No accounts, cookies, IP addresses,
player names or room codes are collected.

- **Page views**: Cloudflare Web Analytics (cookieless), injected only
  when the build sets `VITE_CF_BEACON_TOKEN`.
- **Errors**: uncaught errors, unhandled promise rejections and errors
  caught by the error screen. Each report carries the message, a
  truncated stack and the route shape (`/:room`, `/solo/hard/:game`),
  never the room code. Each distinct error is sent once per page load,
  at most 10 per page load.
- **Multiplayer connection events**:
  - room mounts with the existing last-hour reload count (the iOS
    reload diagnostic)
  - where the relay config came from: build config, a fresh TURN mint,
    the cache, or none
  - time from opening a room to the first reachable opponent
  - the ICE candidate types the first peer connected over (relay vs
    direct)
  - connect timeouts after 20 s with a reason: `signaling_timeout` (the
    signaling socket never opened) or `peer_timeout` (a joiner on
    signaling but no reachable opponent)

Events are grouped by a random id generated per page load and never
stored, then batched and sent with `sendBeacon` (falling back to a
keepalive `fetch`) to the signaling worker's `POST /events`, which
validates them against a fixed schema and writes them to Workers
Analytics Engine. Telemetry failures never surface in the app.

## Backlog

Speced or desired, deliberately not built yet:

- **Board Sharing mechanic** — social catch-up for multiplayer: either
  player offers their filled cells; on accept they become given cells on
  BOTH boards (notes not shared). One-sentence pitch: "Share your filled
  cells as hints for both players."
- **Service worker / offline play** — the manifest already makes the app
  installable; offline caching needs careful interplay with live WebRTC
  rooms before it ships
- **Technique-graded easy** — medium, hard, and expert are graded by
  the techniques they require (see Difficulty Selection); easy still
  relies on its clue band alone, which in practice already yields
  singles-only boards
