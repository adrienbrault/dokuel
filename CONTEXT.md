# Dokuel

A Sudoku game played solo or as a two-player race over a peer-to-peer
connection. This glossary is the shared language for the puzzle, the input
gestures, and the multiplayer room. Definitions say what a term *is*; how it
is built lives in code and ADRs.

## Language

### Puzzle

**Given**:
A clue cell from the original puzzle. Immutable for the whole game.
_Avoid_: clue, fixed cell, locked cell

**Note**:
A candidate digit pencilled into a cell's 3×3 sub-grid. Toggled, never
overwritten by another note.
_Avoid_: pencil mark, candidate, mark

**Conflict**:
The same digit appearing twice in a row, column, or box. Computed from the
board alone; it says nothing about the solution.
_Avoid_: mistake, error

**Error**:
A player digit that disagrees with the known solution. Stricter than a
conflict.
_Avoid_: wrong cell, conflict

**Assist level**:
How much the game helps: `paper` (nothing), `standard`, or `full`. Gates
conflict display, peer-note elimination, remaining counts, and the row/column/
box halo.
_Avoid_: difficulty, help mode, validation mode

**Peer**:
One of the 20 cells sharing a row, column, or box with a given cell. Peer-note
elimination strips a placed digit from its peers' notes.

**Remaining count**:
How many of a digit 1–9 are still unplaced. A digit at zero is complete.

**Hint**:
Selecting a deducible cell and explaining why. A hint never writes a value.

**Daily**:
The deterministic puzzle for a calendar date — the same board on any device.
_Avoid_: daily challenge, puzzle of the day

**Streak**:
Consecutive days on which the daily was completed.

**Game key**:
The identity of one playable game; also the seed for a shareable solo puzzle.

### Input

**Selection**:
The cell(s) the player is acting on. A single selected cell is the cursor.

**Range**:
A multi-cell selection built by dragging across empty cells. A range is
*armed* while it exists; a tap while a range is armed pencils a note into
every cell of the range.
_Avoid_: multi-select, group

**Primary cell**:
The one cell in a range that acts as the cursor.

**Highlighted digit**:
A board-wide spotlight on every occurrence of one digit, toggled from the
numpad with nothing selected.
_Avoid_: filter, focus digit

**Digit-entry intent**:
The single answer to "what does digit *n* do right now" — given the current
gesture (tap, hold, drop, key) and selection — and the label the numpad shows
for it. Behaviour and label come from the same answer.
_Avoid_: tap action, numpad mode

**Gesture recognizer**:
The module that owns the whole life of a pressed digit: it resolves one press
into a tap, hold, skim, or drag, promotes and demotes between skim and drag,
and reports the drop that ends it. It lives at the game level rather than
inside the numpad, because the gesture does not end at the pad's edge — the
numpad is a view over it, supplying only the digit row it hit-tests.
_Avoid_: press handler, skim hook, pointer logic

**Skim**:
Sliding a finger along the numpad's axis across digits, highlighting each as
it is crossed.
_Avoid_: scrub, swipe

**Drag (digit drag)**:
Carrying a digit from the numpad onto a board cell. Dropping on the top half of
the cell enters a value; on the bottom half, a note.
_Avoid_: drag-and-drop, chip drag

**Promote / demote**:
Skim → drag when the finger leaves the pad toward the board; drag → skim when
it returns.

**Drag cone**:
The ±30° wedge perpendicular to the numpad. A pan inside it is a drag; outside
it, a skim.

**Slop**:
The distance a pointer must travel from the press point before a gesture is
classified.
_Avoid_: threshold, dead zone

**Lift**:
The upward offset of the touch hit-point and dragged chip so a fingertip does
not hide the aimed cell. Zero for mouse and pen.

**Charging digit**:
The digit being held on the numpad, animated into its note slot in the
selected cell.

### Multiplayer

**Room**:
One multiplayer match space, identified by a room code, holding the players,
the current game, and the rules for starting, finishing, and rematching. The
room's rules do not depend on how peers are connected.
_Avoid_: session, lobby (the lobby is the screen shown before a game starts),
channel

**Room code**:
The `word-word-xxxx` invite text that identifies a room. It is also the room's
only credential.
_Avoid_: room id (in prose), invite code, join code

**Connection**:
How a room's state reaches its peers and survives reloads: signaling, the
peer-to-peer link, the relay fallback, and local persistence. Every name
derived from a room code (signaling address, local store name, shard) belongs
to the connection.
_Avoid_: transport, provider, network layer

**Creator / joiner**:
The player who opened the room with a chosen difficulty, and the player who
arrived by code. The creator initialises the room; the joiner learns
everything from sync.
_Avoid_: host/guest (host is narrower, see below)

**Host**:
The creator's standing claim in the room. Only gates who may change the
difficulty in the lobby; either seated player may start.

**Seat**:
A player's position in the room's agreed ordering. Every peer must agree on
seat order because it decides who is the overflow.

**Overflow**:
A third entry surviving a concurrent join. The overflow player evicts itself
so the seated pair keeps a startable lobby.
_Avoid_: extra player, room full (that is what the overflow player sees)

**Presence**:
Whether the opponent is currently reachable. Distinct from being seated, which
persists across disconnects.
_Avoid_: awareness, online status

**Absence**:
This client's own record of having gone away. A remote forfeit claim is
honoured only if this record backs it.

**Solved claim / forfeit claim**:
A win claim carrying the completed board (verified against the solution by the
receiver) versus one asserting the opponent vanished. A verified solved claim
displaces a forfeit claim.

**Game number**:
The room's monotonic counter of started games; every start and rematch bumps
it.

**Rematch**:
Starting a new game in the same room with the same seats.

**Snapshot**:
The synchronous local mirror of a room's state kept for crash and reload
recovery. Not the projected room state used for rendering — call that *room
state*.

**Hydration grace window**:
The short wait before a snapshot is applied to an empty room so live peer
state gets first chance.

**Match record**:
The stored result of one finished multiplayer game, identified by room and
game number.

**Shard**:
The per-room signaling endpoint the connection addresses for that room.
