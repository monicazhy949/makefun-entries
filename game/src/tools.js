// The thief's gadgets, each bought with loot: a coin to send a guard looking
// the other way, a smoke cloud that blinds every watcher, and an EMP that
// knocks the cameras out. A gadget is only spent when it is used.

import { TOOLS } from './config.js';
import { sendGuardToCoin } from './guards.js';

export const TOOL_ORDER = ['coin', 'smoke', 'emp'];

/** The gadget the thief has in hand, or null when none is selected. */
export function selectedTool(state) {
  return state.tool;
}

/** Can the thief afford this gadget right now? */
export function canAfford(state, name) {
  return state.score >= TOOLS[name].cost;
}

/**
 * Use the selected gadget at (x, y): a coin lands there and draws the nearest
 * guard, smoke blooms there and blinds watchers, an EMP kills every camera.
 * Returns true when it was used (and paid for).
 */
export function useTool(state, name, x, y) {
  const tool = TOOLS[name];
  if (!tool || state.score < tool.cost) return false;
  state.score -= tool.cost;
  state.spent += tool.cost;
  if (name === 'coin') {
    state.coins.push({ x, y, ttl: tool.linger });
    sendGuardToCoin(state, x, y);
    return true;
  }
  if (name === 'smoke') {
    state.smoke.push({ x, y, radius: tool.radius, ttl: tool.linger });
    return true;
  }
  // EMP: every camera goes dark for a while.
  for (const camera of state.cameras) {
    camera.disabledUntil = state.time + tool.linger;
  }
  return true;
}

/** Tick the gadgets' timers down; a spent coin or a faded cloud is gone. */
export function updateTools(state, dt) {
  for (let i = state.coins.length - 1; i >= 0; i -= 1) {
    state.coins[i].ttl -= dt;
    if (state.coins[i].ttl <= 0) state.coins.splice(i, 1);
  }
  for (let i = state.smoke.length - 1; i >= 0; i -= 1) {
    state.smoke[i].ttl -= dt;
    if (state.smoke[i].ttl <= 0) state.smoke.splice(i, 1);
  }
}
