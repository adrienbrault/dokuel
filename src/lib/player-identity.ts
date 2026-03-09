import { STORAGE_KEYS } from "./constants.ts";
import { generatePlayerName } from "./name-generator.ts";

export function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

export function getPlayerId(): string {
  let id = localStorage.getItem(STORAGE_KEYS.PLAYER_ID);
  if (!id) {
    id = sessionStorage.getItem(STORAGE_KEYS.PLAYER_ID);
    if (!id) {
      id = generateId();
    }
    localStorage.setItem(STORAGE_KEYS.PLAYER_ID, id);
  }
  return id;
}

export function getPlayerName(): string {
  let name = localStorage.getItem(STORAGE_KEYS.PLAYER_NAME);
  if (!name) {
    name = sessionStorage.getItem(STORAGE_KEYS.PLAYER_NAME);
    if (!name) {
      name = generatePlayerName();
    }
    localStorage.setItem(STORAGE_KEYS.PLAYER_NAME, name);
  }
  return name;
}

export function persistPlayerName(name: string): void {
  localStorage.setItem(STORAGE_KEYS.PLAYER_NAME, name);
}
