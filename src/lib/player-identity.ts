import { generatePlayerName } from "./name-generator.ts";
import { ADJECTIVES, NOUNS } from "./room-code.ts";

export function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function pick(arr: readonly string[]): string {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function generatePlayerId(): string {
  const num = Math.floor(Math.random() * 90 + 10);
  return `${pick(ADJECTIVES)}-${pick(NOUNS)}-${num}`;
}

export function getPlayerId(): string {
  let id = localStorage.getItem("sudoku_player_id");
  // Migrate old-format IDs (no dashes) to human-readable format
  if (id && !id.includes("-")) {
    localStorage.removeItem("sudoku_player_id");
    id = null;
  }
  if (!id) {
    id = sessionStorage.getItem("sudoku_player_id");
    if (!id || !id.includes("-")) {
      id = generatePlayerId();
    }
    localStorage.setItem("sudoku_player_id", id);
  }
  return id;
}

export function getPlayerName(): string {
  let name = localStorage.getItem("sudoku_player_name");
  if (!name) {
    name = sessionStorage.getItem("sudoku_player_name");
    if (!name) {
      name = generatePlayerName();
    }
    localStorage.setItem("sudoku_player_name", name);
  }
  return name;
}

export function persistPlayerName(name: string): void {
  localStorage.setItem("sudoku_player_name", name);
}
