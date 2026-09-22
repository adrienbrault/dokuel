import { generateId } from "./id.ts";
import { generatePlayerName } from "./name-generator.ts";

// Storage access is guarded and the write happens best-effort: these
// run from render-phase initializers (identity must exist before the
// first render), so a throwing localStorage (blocked storage) must not
// crash the screen, and StrictMode's double render makes the writes
// idempotent by construction — the second pass reads the value the
// first one stored.
export function getPlayerId() {
  try {
    let id = localStorage.getItem("sudoku_player_id");
    if (!id) {
      id = generateId();
      localStorage.setItem("sudoku_player_id", id);
    }
    return id;
  } catch {
    return generateId();
  }
}

export function getPlayerName() {
  try {
    let name = localStorage.getItem("sudoku_player_name");
    if (!name) {
      name = generatePlayerName();
      localStorage.setItem("sudoku_player_name", name);
    }
    return name;
  } catch {
    return generatePlayerName();
  }
}

export function persistPlayerName(name: string) {
  try {
    localStorage.setItem("sudoku_player_name", name);
  } catch {
    // Storage unavailable — the rename still applies for this session.
  }
}
