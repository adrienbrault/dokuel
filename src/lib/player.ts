import { generateId } from "./id.ts";
import { generatePlayerName } from "./name-generator.ts";

const ID_KEY = "sudoku_player_id";
const NAME_KEY = "sudoku_player_name";

/**
 * The local player's stable id. Persisted in localStorage; recovered
 * from a sessionStorage copy (reconnect identity) before a fresh one is
 * minted. There are no accounts — identity is purely client-side.
 */
export function getPlayerId(): string {
  let id = localStorage.getItem(ID_KEY);
  if (!id) {
    id = sessionStorage.getItem(ID_KEY) ?? generateId();
    localStorage.setItem(ID_KEY, id);
  }
  return id;
}

/** The local player's display name, auto-generated on first use. */
export function getPlayerName(): string {
  let name = localStorage.getItem(NAME_KEY);
  if (!name) {
    name = sessionStorage.getItem(NAME_KEY) ?? generatePlayerName();
    localStorage.setItem(NAME_KEY, name);
  }
  return name;
}

/** Persist an edited display name. */
export function setPlayerName(name: string): void {
  localStorage.setItem(NAME_KEY, name);
}
