// The world: the thief, the guards, the loot and the alarm, advanced in fixed
// steps. One step moves the thief, runs the patrols and cameras, fills or
// drains the alarm, and reports what happened as event flags, so the loop can
// play the right sound and the renderer can flash the right banner.

import {
  ALARM,
  CAUGHT_FREEZE,
  FIELD,
  GUARD,
  LIVES,
  ROOM_CLEAR_BONUS,
  STARTING_CASH,
  STEP,
  THIEF,
} from './config.js';
import { LEVELS } from './levels.js';
import {
  clampToField,
  createCamera,
  createGuard,
  detectionRate,
  endChase,
  startChase,
  updateCamera,
  updateGuard,
} from './guards.js';
import { updateTools } from './tools.js';

export const EVENT_LOOT = 1;
export const EVENT_TARGET = 2;
export const EVENT_CAUGHT = 4;
export const EVENT_CLEAR = 8;
export const EVENT_WIN = 16;
export const EVENT_OVER = 32;
export const EVENT_ALERT = 64;
export const EVENT_TOOL = 128;

export function createWorld(random) {
  const world = {
    random,
    state: null,
    reset() {
      this.state = freshState();
      this.startRoom(0);
    },
    /** Begin a room: fresh patrols, fresh loot, the thief at the door. */
    startRoom(index) {
      const state = this.state;
      const level = LEVELS[index];
      state.levelIndex = index;
      state.level = level;
      state.thief = {
        x: level.spawn.x,
        y: level.spawn.y,
        angle: 0,
        sneaking: false,
        moving: false,
      };
      state.guards = level.guards.map((spec, i) => createGuard(spec, i));
      state.cameras = level.cameras.map((spec, i) => createCamera(spec, i));
      state.loot = level.loot.map((item) => ({ ...item, taken: false }));
      state.targetTaken = false;
      state.exitOpen = false;
      state.alarm = 0;
      state.alert = false;
      state.alertCount = state.alertCount ?? 0;
      state.coins = [];
      state.smoke = [];
      state.caughtFreeze = 0;
      state.banner = null;
      state.bannerTtl = 0;
      state.roomTime = 0;
    },
    /**
     * Advance the world one fixed step. `move` is the thief's wanted direction
     * {x, y} (each -1..1) and `sneak` slows the thief to a creep. Returns the
     * event flags for this step.
     */
    step(dt, move, sneak) {
      const state = this.state;
      if (!state) return 0;
      state.time += dt;
      state.roomTime += dt;
      if (state.bannerTtl > 0) {
        state.bannerTtl -= dt;
        if (state.bannerTtl <= 0) state.banner = null;
      }
      if (state.caughtFreeze > 0) {
        state.caughtFreeze -= dt;
        if (state.caughtFreeze <= 0) {
          if (state.lives <= 0) return EVENT_OVER;
          this.startRoom(state.levelIndex);
          state.banner = 'Caught! Back to the door — quieter this time.';
          state.bannerTtl = 2.2;
        }
        return 0;
      }
      let events = 0;
      updateTools(state, dt);
      moveThief(state, move, sneak, dt);
      for (const guard of state.guards) updateGuard(guard, dt, state.time, state.thief, state.alert, state.level.walls);
      for (const camera of state.cameras) updateCamera(camera, dt, state.time);

      // The alarm fills while any watcher sees the thief, and drains in the dark.
      const rate = detectionRate(state);
      if (rate > 0) {
        state.alarm = Math.min(ALARM.max, state.alarm + rate * dt);
        if (state.alert) {
          for (const guard of state.guards) {
            if (guard.seesThief) guard.lastSeen = { x: state.thief.x, y: state.thief.y };
          }
        }
      } else {
        state.alarm = Math.max(0, state.alarm - (state.alert ? ALARM.alertDecay : ALARM.decay) * dt);
      }
      if (!state.alert && state.alarm >= ALARM.trigger) {
        state.alert = true;
        state.alertCount += 1;
        startChase(state);
        events |= EVENT_ALERT;
      } else if (state.alert && state.alarm <= ALARM.standDown) {
        state.alert = false;
        endChase(state);
      }

      // A guard close enough to grab the thief ends the run, alert or not.
      for (const guard of state.guards) {
        if (Math.hypot(guard.x - state.thief.x, guard.y - state.thief.y) < GUARD.catchDistance) {
          return events | this.catchThief();
        }
      }

      // Loot: walk over it to pocket it.
      for (const item of state.loot) {
        if (!item.taken && Math.hypot(item.x - state.thief.x, item.y - state.thief.y) < THIEF.radius + 14) {
          item.taken = true;
          state.score += itemValue(item);
          state.lootTaken += 1;
          events |= EVENT_LOOT;
        }
      }
      if (!state.targetTaken && Math.hypot(state.level.target.x - state.thief.x, state.level.target.y - state.thief.y) < THIEF.radius + 18) {
        state.targetTaken = true;
        state.exitOpen = true;
        state.score += state.level.target.value;
        state.banner = `${state.level.target.name} secured — get to the exit!`;
        state.bannerTtl = 2.5;
        events |= EVENT_TARGET;
      }

      // The exit only opens once the room's prize is taken.
      if (state.exitOpen) {
        const exit = state.level.exit;
        if (pointInRect(state.thief.x, state.thief.y, exit)) {
          return events | this.clearRoom();
        }
      }
      return events;
    },
    /** The thief is caught: lose a life and freeze on the moment. */
    catchThief() {
      const state = this.state;
      state.lives -= 1;
      state.caughtFreeze = CAUGHT_FREEZE;
      state.banner = state.lives > 0 ? 'CAUGHT!' : 'CAUGHT! The job is blown.';
      state.bannerTtl = CAUGHT_FREEZE;
      return EVENT_CAUGHT;
    },
    /** The room is cleared: bonus, then the next room, or the getaway. */
    clearRoom() {
      const state = this.state;
      const timeBonus = Math.max(0, Math.round(300 - state.roomTime * 2));
      state.score += ROOM_CLEAR_BONUS + timeBonus;
      if (state.levelIndex + 1 >= LEVELS.length) {
        return EVENT_WIN;
      }
      this.startRoom(state.levelIndex + 1);
      state.banner = `${LEVELS[state.levelIndex].name} — ${LEVELS[state.levelIndex].brief}`;
      state.bannerTtl = 3;
      return EVENT_CLEAR;
    },
  };
  world.reset();
  return world;
}

function freshState() {
  return {
    time: 0,
    roomTime: 0,
    levelIndex: 0,
    level: null,
    thief: null,
    guards: [],
    cameras: [],
    loot: [],
    targetTaken: false,
    exitOpen: false,
    alarm: 0,
    alert: false,
    alertCount: 0,
    coins: [],
    smoke: [],
    lives: LIVES,
    score: STARTING_CASH,
    spent: 0,
    lootTaken: 0,
    caughtFreeze: 0,
    banner: null,
    bannerTtl: 0,
    tool: 'coin',
  };
}

function itemValue(item) {
  return item.kind === 'gold' ? 200 : item.kind === 'gem' ? 100 : 50;
}

function pointInRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

/** Move the thief, sliding along walls instead of through them. */
function moveThief(state, move, sneak, dt) {
  const thief = state.thief;
  thief.sneaking = sneak;
  const length = Math.hypot(move.x, move.y);
  thief.moving = length > 0.01;
  if (!thief.moving) return;
  const speed = sneak ? THIEF.sneakSpeed : THIEF.walkSpeed;
  const dx = (move.x / length) * speed * dt;
  const dy = (move.y / length) * speed * dt;
  thief.angle = Math.atan2(move.y, move.x);
  // Move each axis on its own, so a wall stops one direction but not the other.
  thief.x += dx;
  resolveWalls(state);
  thief.y += dy;
  resolveWalls(state);
  clampToField(thief, THIEF.radius);
}

/** Push the thief out of any wall it overlaps. */
function resolveWalls(state) {
  const thief = state.thief;
  for (const wall of state.level.walls) {
    const nearestX = Math.max(wall.x, Math.min(thief.x, wall.x + wall.width));
    const nearestY = Math.max(wall.y, Math.min(thief.y, wall.y + wall.height));
    const dx = thief.x - nearestX;
    const dy = thief.y - nearestY;
    const distance = Math.hypot(dx, dy);
    if (distance < THIEF.radius) {
      if (distance === 0) {
        thief.y = wall.y - THIEF.radius;
      } else {
        thief.x = nearestX + (dx / distance) * THIEF.radius;
        thief.y = nearestY + (dy / distance) * THIEF.radius;
      }
    }
  }
}

/** The rank the getaway screen awards, from how often the alarm tripped. */
export function rankForRun(alertCount, livesLost) {
  if (alertCount === 0 && livesLost === 0) return 'GHOST — never seen, never heard';
  if (alertCount <= 1 && livesLost === 0) return 'SHADOW — one close call';
  if (livesLost === 0) return 'SMOOTH OPERATOR — loud, but clean';
  return 'SMASH & GRAB — messy, but rich';
}

export { STEP };
