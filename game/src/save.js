// Solmar Bay: saving. Progress (money, finished missions) autosaves to
// localStorage after every mission, and the title screen can continue it.
const KEY = 'solmar-bay-save-v1';

export function saveGame(G) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        money: G.player.money,
        done: G.missions.done,
        current: G.missions.current,
        health: G.player.health,
      }),
    );
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function applySave(G, save) {
  if (!save) return false;
  if (typeof save.money === 'number') G.player.money = save.money;
  if (Array.isArray(save.done)) G.missions.done = save.done;
  if (typeof save.current === 'number') G.missions.current = save.current;
  if (typeof save.health === 'number') G.player.health = save.health;
  return true;
}

export function clearSave() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) window.localStorage.removeItem(KEY);
  } catch (e) {
    // Ignore.
  }
}
