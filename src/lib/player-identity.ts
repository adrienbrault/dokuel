import { generateId } from "./id.ts";
import { generatePlayerName } from "./name-generator.ts";

const ID_KEY = "sudoku_player_id";
const NAME_KEY = "sudoku_player_name";

// Storage access is guarded and the writes happen best-effort: these
// run from render-phase initializers (identity must exist before the
// first render), so a throwing localStorage (blocked storage) must not
// crash the screen, and StrictMode's double render makes the writes
// idempotent by construction - the second pass reads the value the
// first one stored.
function readOrCreate(key: string, create: () => string): string {
  try {
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const created = create();
    localStorage.setItem(key, created);
    return created;
  } catch {
    return create();
  }
}

/** The player's stable anonymous id, minted on first use. */
export function getPlayerId(): string {
  return readOrCreate(ID_KEY, generateId);
}

/**
 * The player's display name, minted on first use. Shared by the
 * multiplayer lobby and solo challenge links so a friend sees the same
 * name wherever it is attributed.
 */
export function getPlayerName(): string {
  return readOrCreate(NAME_KEY, generatePlayerName);
}

export function setPlayerName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // Storage unavailable - the rename still applies for this session.
  }
}
