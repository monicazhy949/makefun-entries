// The screenshot scenes behind ?shot=plan|cover|escape|caught. Each one plays
// the real rules forward from a fresh world for a fixed number of steps,
// steered by a waypoint autopilot that sneaks, ducks into shadow when the
// alarm climbs and uses the gadgets, so the frame is what a real game looks
// like and the same seed always gives the same frame.

import { STEP } from './config.js';
import { EVENT_CAUGHT, EVENT_WIN } from './world.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { canAfford, useTool } from './tools.js';

const SAMPLE = STEP;
const MAX_SECONDS = 240;

/** Waypoints per scene, in field coordinates, chosen clear of walls. */
const PATHS = {
  cover: [
    { x: 200, y: 620 },
    { x: 420, y: 560 },
    { x: 450, y: 400 },
    { x: 520, y: 560 },
    { x: 600, y: 600 },
    { x: 760, y: 600 },
  ],
  escape: [
    { x: 200, y: 420 },
    { x: 500, y: 550 },
    { x: 620, y: 620 },
    { x: 850, y: 470 },
    { x: 850, y: 300 },
    { x: 850, y: 470 },
    { x: 500, y: 550 },
    { x: 350, y: 420 },
    { x: 200, y: 200 },
  ],
};

/**
 * A waypoint autopilot: sneak toward the current waypoint, drop smoke when
 * the alarm climbs, duck into the nearest shadow patch when there is no smoke
 * to hide in, and sidestep when stuck against a wall. Returns the move vector
 * and whether to sneak.
 */
function createAutopilot(waypoints) {
  let index = 0;
  let hiding = false;
  let stuckSteps = 0;
  let sidestep = 0;
  let lastX = 0;
  let lastY = 0;
  return {
    done() {
      return index >= waypoints.length;
    },
    move(state) {
      const thief = state.thief;
      if (Math.hypot(thief.x - lastX, thief.y - lastY) < 0.4) stuckSteps += 1;
      else stuckSteps = 0;
      lastX = thief.x;
      lastY = thief.y;
      if (stuckSteps > 90 && sidestep <= 0) {
        sidestep = 30;
        stuckSteps = 0;
      }
      const inSmoke = state.smoke.some((cloud) => Math.hypot(cloud.x - thief.x, cloud.y - thief.y) < cloud.radius);
      // Smoke early, while the alarm is still climbing: a cloud breaks every
      // watcher's line of sight, so the chase loses the trail.
      if ((state.alert || state.alarm > 25) && !inSmoke && canAfford(state, 'smoke')) {
        useTool(state, 'smoke', thief.x, thief.y);
      }
      // On alert the thief runs — walking outruns a chasing guard, sneaking does not.
      // Otherwise, hide in shadow while the alarm is high and no smoke covers the thief.
      const running = state.alert;
      if (state.alarm > 45 && !inSmoke && !running) hiding = true;
      if (state.alarm < 20 || inSmoke || running) hiding = false;
      let goal = waypoints[index];
      if (hiding) {
        let best = null;
        let bestDistance = Infinity;
        for (const patch of state.level.cover) {
          const cx = patch.x + patch.width / 2;
          const cy = patch.y + patch.height / 2;
          const distance = Math.hypot(cx - thief.x, cy - thief.y);
          if (distance < bestDistance) {
            bestDistance = distance;
            best = { x: cx, y: cy };
          }
        }
        if (best) goal = best;
      }
      if (!goal) return { x: 0, y: 0, sneak: !running };
      const dx = goal.x - thief.x;
      const dy = goal.y - thief.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 14) {
        if (goal === waypoints[index]) index += 1;
        return { x: 0, y: 0, sneak: !running };
      }
      let mx = dx / distance;
      let my = dy / distance;
      // Never walk into a guard: push away from any guard close by, so the
      // thief steers around the body even when the cone never saw it coming.
      for (const guard of state.guards) {
        const gx = thief.x - guard.x;
        const gy = thief.y - guard.y;
        const guardDistance = Math.hypot(gx, gy);
        if (guardDistance < 90 && guardDistance > 0.01) {
          const push = ((90 - guardDistance) / 90) * 1.6;
          mx += (gx / guardDistance) * push;
          my += (gy / guardDistance) * push;
        }
      }
      const magnitude = Math.hypot(mx, my) || 1;
      mx /= magnitude;
      my /= magnitude;
      if (sidestep > 0) {
        sidestep -= 1;
        const tx = mx;
        mx = -my;
        my = tx;
      }
      return { x: mx, y: my, sneak: !running };
    },
  };
}

/** Play the world forward with the autopilot until it finishes its path. */
function runPath(world, waypoints, stopWhen) {
  const pilot = createAutopilot(waypoints);
  const limit = MAX_SECONDS / SAMPLE;
  for (let i = 0; i < limit; i += 1) {
    const move = pilot.move(world.state);
    const events = world.step(SAMPLE, { x: move.x, y: move.y }, move.sneak);
    if (events & EVENT_CAUGHT) return 'caught';
    if (events & EVENT_WIN) return 'win';
    if (stopWhen && stopWhen(world.state)) return 'stopped';
    if (pilot.done()) return 'done';
  }
  return 'timeout';
}

/** Set `world` to the named scene and return the screen to draw over it. */
export function stageShot(name, world) {
  if (name === 'plan') {
    world.reset();
    for (let i = 0; i < 5 / SAMPLE; i += 1) world.step(SAMPLE, { x: 0, y: 0 }, false);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'caught') {
    world.reset();
    // Phase one: step into the nearest guard's cone, face to face, until the
    // alarm is nearly full. Phase two: walk into the guard and get caught.
    for (let i = 0; i < MAX_SECONDS / SAMPLE; i += 1) {
      const thief = world.state.thief;
      let guard = null;
      let best = Infinity;
      for (const candidate of world.state.guards) {
        const distance = Math.hypot(candidate.x - thief.x, candidate.y - thief.y);
        if (distance < best) {
          best = distance;
          guard = candidate;
        }
      }
      let goal;
      if (world.state.alarm < 90) {
        goal = { x: guard.x + Math.cos(guard.angle) * 100, y: guard.y + Math.sin(guard.angle) * 100 };
      } else {
        goal = { x: guard.x, y: guard.y };
      }
      const dx = goal.x - thief.x;
      const dy = goal.y - thief.y;
      const distance = Math.hypot(dx, dy) || 1;
      const move = distance > 12 ? { x: dx / distance, y: dy / distance } : { x: 0, y: 0 };
      const events = world.step(SAMPLE, move, false);
      if (events & EVENT_CAUGHT) {
        // Freeze on the caught moment: one more step paints the banner.
        world.step(SAMPLE, { x: 0, y: 0 }, false);
        return { screen: SCREEN_PLAY, best: 0 };
      }
    }
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'escape') {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      world.reset();
      world.startRoom(2);
      const exit = world.state.level.exit;
      const exitCentre = { x: exit.x + exit.width / 2, y: exit.y + exit.height / 2 };
      const outcome = runPath(world, PATHS.escape, (state) => {
        if (!state.targetTaken) return false;
        return Math.hypot(state.thief.x - exitCentre.x, state.thief.y - exitCentre.y) < 170;
      });
      if (outcome === 'stopped' || outcome === 'done') return { screen: SCREEN_PLAY, best: 0 };
    }
    return { screen: SCREEN_PLAY, best: 0 };
  }
  // cover: the money shot — room two, mid-heist, every element in one frame.
  // The thief stops short of the Sapphire, so the prize stays visible, then
  // steps into a guard's cone until the alarm reads about half full, keeping
  // a safe gap so the guard cannot touch the thief.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    world.reset();
    world.startRoom(1);
    const outcome = runPath(world, PATHS.cover);
    if (outcome !== 'done' && outcome !== 'stopped') continue;
    let caught = false;
    for (let i = 0; i < 12 / SAMPLE && world.state.alarm < 35; i += 1) {
      const thief = world.state.thief;
      let guard = null;
      let best = Infinity;
      for (const candidate of world.state.guards) {
        const distance = Math.hypot(candidate.x - thief.x, candidate.y - thief.y);
        if (distance < best) {
          best = distance;
          guard = candidate;
        }
      }
      let goal;
      if (best < 50) {
        // Too close: back away from the guard instead of closing in.
        goal = { x: thief.x + (thief.x - guard.x), y: thief.y + (thief.y - guard.y) };
      } else {
        // Step into the cone from the side: 110 ahead of the guard and 60 to
        // the side the thief is already on, so the walk there never crosses
        // the guard's body.
        const facingX = Math.cos(guard.angle);
        const facingY = Math.sin(guard.angle);
        const side = (thief.x - guard.x) * -facingY + (thief.y - guard.y) * facingX >= 0 ? 1 : -1;
        goal = {
          x: guard.x + facingX * 110 + -facingY * 60 * side,
          y: guard.y + facingY * 110 + facingX * 60 * side,
        };
      }
      const dx = goal.x - thief.x;
      const dy = goal.y - thief.y;
      const distance = Math.hypot(dx, dy) || 1;
      const move = distance > 20 ? { x: dx / distance, y: dy / distance } : { x: 0, y: 0 };
      const events = world.step(SAMPLE, move, true);
      if (events & EVENT_CAUGHT) {
        caught = true;
        break;
      }
    }
    if (!caught) return { screen: SCREEN_PLAY, best: 0 };
  }
  return { screen: SCREEN_PLAY, best: 0 };
}
