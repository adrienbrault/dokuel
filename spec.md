# Sudoku 1v1 - Product Specification

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

### Difficulty Selection
Available before every game (solo or multiplayer):
- Easy (~45 clues)
- Medium (~35 clues)
- Hard (~28 clues)
- Expert (~22 clues)

Optional **show conflicts** toggle — when off, conflict highlighting is disabled for a harder experience.

### Solo Game
- Standard sudoku with timer
- Notes mode (with subtle board ring indicator when active), erase, undo (with move count badge)
- Hint system — lightbulb button reveals one cell's correct value
- Pause functionality — overlay hides the board while paused
- Soft validation: conflicts shown, not blocked (can be toggled during gameplay)
- Auto-save — game progress persists across browser sessions via localStorage
- Personal best time shown near timer during gameplay; PB indicator on win
- Completion when all cells filled and valid
- Per-difficulty stats tracking (best time, average, games played) in localStorage
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
1. Recipient opens invite link (`/{roomId}`)
2. Enters nickname
3. Joins lobby directly
4. If room full: "Game is full" screen
5. If room expired: "Game ended" with "Create New" button

### 1v1 Race Mode
- Both players get the same puzzle
- Each has their own separate board
- First to valid completion wins
- Live opponent progress visible (cells remaining, completion %)

## Game Board

### Interactions
- Tap cell to select
- Tap numpad number to place/toggle note
- Selected cell highlights entire row, column, and 3x3 box
- Same-number highlighting across board
- Conflicts shown in red background (soft validation — not blocked)
- Given cells visually distinct (bold, darker color), non-editable
- Notes rendered as small 3x3 grid within cell

### Controls
- **Notes toggle**: Switch between place mode and notes mode (board ring indicator when active)
- **Erase**: Clear selected non-given cell (value + notes)
- **Undo**: Revert last action (multi-level), with move count badge
- **Hint**: Reveal the correct value for the selected cell (solo only)
- **Errors toggle**: Show/hide conflict highlighting during gameplay

### Number Pad
Core UX differentiator. Three layout positions:
- **Bottom** (default): Horizontal row of 1-9
- **Left**: Vertical column on left side of board
- **Right**: Vertical column on right side of board

Purpose of side layouts: enable two-finger mobile play — one finger holds numpad number, other taps cells.

Setting persists in localStorage across sessions. Position is configurable via a settings popover accessed from the game header.

**Fill mode**: Tap a number on the pad, then tap multiple cells to place that number. Tap the number again or another number to change.

## Board Sharing Mechanic

Social catch-up mechanic for multiplayer games:
1. Either player taps "Share Progress"
2. Opponent sees accept/decline prompt
3. If accepted: sharer's filled cells become locked (given) cells on BOTH boards
4. Notes are NOT shared
5. Event logged in match timeline (e.g. "Adrien shared progress")

One-sentence explanation: "Share your filled cells as hints for both players."

## Real-time Multiplayer

### Architecture
- Peer-to-peer via Yjs CRDTs + y-webrtc — no server needed
- Public WebRTC signaling servers used only for peer discovery
- Game state syncs directly between players via CRDTs

### Player Identity
- Auto-generated fun names (adjective + animal, e.g. "Swift Panda")
- Inline name editing in lobby — players can rename themselves
- Player names persisted in localStorage across sessions

### Opponent Visibility
- Nickname + assigned color
- Cells remaining count
- Completion percentage
- Online/reconnecting status indicator

### Reconnect Handling
- sessionStorage stores playerId + roomId
- On reconnect, Yjs CRDT state merges automatically
- "Reconnecting..." overlay during reconnect
- Opponent sees "Opponent reconnecting..." status

### Disconnect Handling
- Opponent disconnect shows status indicator
- 60-second grace period for reconnect
- After grace period: option to claim win

### Post-Game
- Winner announcement with confetti celebration
- Stats: time, cells filled, personal best indicator
- Share result button
- "Rematch" button (same players, new puzzle, same difficulty)
- "New Game" button (back to landing)

## Validation Rules

**Soft validation** (default):
- Conflicting moves highlighted visually (red background)
- Moves are NOT blocked
- Player can leave wrong numbers
- Completion only accepted when board is fully valid and all cells filled

## Design Direction

- Minimalist, clean, modern game UI
- Soft surfaces, clear typography, high contrast
- Subtle animations with restraint (cell reveal, spring press, glow, confetti)
- Dark mode from day one (system preference + manual toggle)
- Responsive desktop layout — side-by-side board and numpad on wide screens
- Large touch targets (minimum 44px)
- Safe area support (iPhone notch/home indicator)
- Haptic feedback where supported (number place, erase, note toggle, conflict, completion)
- Synthesized sound effects via Web Audio API (toggleable)
- URL reflects current screen state (solo, daily, join) for bookmarking and refresh

### Color Palette
- Neutral backgrounds
- Blue accent for selection/highlights
- Red for conflicts
- Green for completion/success

## Technical Constraints

- Bun runtime
- Vite + React 19 + Tailwind CSS 4
- Yjs + y-webrtc for peer-to-peer multiplayer
- Deploy to Cloudflare Pages
- Biome for lint/format
- Vitest for testing
- Strict TDD: every feature gets tests first
