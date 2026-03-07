# Backlog

## Done

- [x] Project bootstrap: Bun + Vite + React + Tailwind + Biome + Vitest
- [x] CI pipeline: lint + typecheck + test on push/PR
- [x] Claude hooks: typecheck + test on file edits
- [x] Spec + CLAUDE.md: product spec and implementation guide
- [x] Shared types: all game, room, and message types
- [x] Sudoku engine: generation, solving, parsing, conflict detection, completion
- [x] useSudoku hook: full game state — place, erase, undo, notes, fill mode, conflicts
- [x] Board component: 9x9 grid with selection, highlighting, conflict, notes rendering
- [x] Cell component: touch-optimized with given/user/conflict styling
- [x] NumPad component: 3 positions (bottom/left/right), remaining counts, active number
- [x] GameControls component: Undo, Erase, Notes toggle
- [x] Timer component: elapsed time display
- [x] NumPadPositionToggle: switch pad position, persisted to localStorage
- [x] DifficultyPicker: Easy/Medium/Hard/Expert selection
- [x] Landing page: Start Solo / Create Game / Join Game
- [x] GameResult modal: completion with time and new game
- [x] SoloGame screen: wires board + numpad + controls + timer
- [x] useNumPadPosition hook: localStorage persistence
- [x] PartyKit server: room management, game lifecycle, completion validation
- [x] useMultiplayer hook: PartySocket connection, reconnect, room state sync
- [x] Lobby screen: share link, player list, ready state, difficulty select, start
- [x] Join-by-link: URL routing for `/{roomId}`, full/expired room handling
- [x] Multiplayer game screen: opponent progress, board sharing, game result + rematch
- [x] Haptic feedback: number place, erase, note toggle, conflict, completion
- [x] Dark mode toggle (currently system-preference only)
- [x] Animated transitions: cell selection, number placement, numpad position switch
- [x] Completion celebration animation
- [x] Reconnect handling: sessionStorage identity, server state resync, overlay
- [x] Opponent disconnect: status indicator, grace period, claim win
- [x] Error states: network banner, room not found, room full, expired
- [x] Keyboard support for desktop
- [x] Rematch flow in solo (new puzzle, same difficulty)
- [x] Daily challenge / seeded puzzles
- [x] Stats history (localStorage)
- [x] Sound effects toggle
- [x] Spectator mode

## In Progress

## Backlog (prioritized)

(empty — all tasks complete)
