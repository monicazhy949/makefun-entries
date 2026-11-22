// Save and load through localStorage: money, story progress, the player's spot
// and kit. A save that fails to parse (or storage that is off) just means no save.
import { SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null || typeof data.money !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function saveGame(state) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Ignore.
  }
}
