# Sudoku 1v1 - Product Specification

## Overview

Premium, mobile-first web app for solo and real-time 1v1 sudoku. No accounts required. Touch-first, frictionless, beautiful.

## Core Principles

- Mobile/touch first — portrait, one-handed play
- No account required — nickname + random color
- Minimal friction — instant start, join by link
- Beautiful visual hierarchy — "Apple Notes meets NYT Games"
- Very fast input latency
- Real-time multiplayer with resilient reconnect

## User Flows

### Landing Page
Three primary actions, always visible:
1. **Start Solo** — immediately pick difficulty, start playing
2. **Create Game** — create a 1v1 room, get a share link
3. **Join Game** — join from invite link (or manual room code)

### Difficulty Selection
Available before every game (solo or multiplayer):
- Easy (~45 clues)
- Medium (~35 clues)
- Hard (~28 clues)
- Expert (~22 clues)

### Solo Game
- Standard sudoku with timer
- Notes mode, erase, undo
- Soft validation: conflicts shown, not blocked
- Completion when all cells filled and valid

### Create Game Flow
1. User taps "Create Game"
2. Selects difficulty
3. Lobby opens with shareable link
4. User shares link (Web Share API or copy)
5. When opponent joins and both ready, host starts

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
- **Notes toggle**: Switch between place mode and notes mode
- **Erase**: Clear selected non-given cell (value + notes)
- **Undo**: Revert last action (multi-level)

### Number Pad
Core UX differentiator. Three layout positions:
- **Bottom** (default): Horizontal row of 1-9
- **Left**: Vertical column on left side of board
- **Right**: Vertical column on right side of board

Purpose of side layouts: enable two-finger mobile play — one finger holds numpad number, other taps cells.

Each number shows remaining count (how many of that number are left to place).

Setting persists in localStorage across sessions.

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
- Room-based sessions via PartyKit (Cloudflare Durable Objects)
- Server-authoritative: server holds solution, validates completion
- Client never sees solution until game ends

### Opponent Visibility
- Nickname + assigned color
- Cells remaining count
- Completion percentage
- Online/reconnecting status indicator

### Reconnect Handling
- sessionStorage stores playerId + roomId
- On reconnect, server sends full current state
- "Reconnecting..." overlay during reconnect
- Opponent sees "Opponent reconnecting..." status

### Disconnect Handling
- Opponent disconnect shows status indicator
- 60-second grace period for reconnect
- After grace period: option to claim win

### Post-Game
- Winner announcement
- Stats: time, cells filled
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
- Subtle animations with restraint
- Dark mode from day one (system preference + manual toggle)
- Large touch targets (minimum 44px)
- Safe area support (iPhone notch/home indicator)
- Haptic feedback where supported (number place, erase, note toggle, conflict, completion)

### Color Palette
- Neutral backgrounds
- Blue accent for selection/highlights
- Red for conflicts
- Green for completion/success

## Technical Constraints

- Bun runtime
- Vite + React 19 + Tailwind CSS 4
- PartyKit for real-time
- Deploy to Cloudflare Workers
- Biome for lint/format
- Vitest for testing
- Strict TDD: every feature gets tests first
