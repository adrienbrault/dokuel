import { generatePlayerName } from "./name-generator.ts";

export function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

export function getPlayerId(): string {
  let id = localStorage.getItem("sudoku_player_id");
  if (!id) {
    id = sessionStorage.getItem("sudoku_player_id");
    if (!id) {
      id = generateId();
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
