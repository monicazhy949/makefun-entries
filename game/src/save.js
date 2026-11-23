// Save and load: one slot in localStorage. Every call is guarded, so
// a browser without storage and the headless game both keep working.

const KEY = 'solmar-bay-save-v1';

export function saveGame(G) {
  if (typeof localStorage === 'undefined') return false;
  try {
    const data = {
      money: G.player.money,
      health: G.player.health,
      armor: G.player.armor,
      done: G.missions.done.slice(),
      x: Math.round(G.player.x),
      y: Math.round(G.player.y),
      time: Math.round(G.time),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data.money !== 'number') return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function clearSave() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(KEY);
  } catch (e) {
    // Storage is best effort.
  }
}
