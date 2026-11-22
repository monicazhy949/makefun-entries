// Guards and cameras: patrols, vision cones, detection and the chase. A guard
// walks its route, pauses at each waypoint to sweep its cone, investigates a
// thrown coin, and chases the thief while the alarm is up. A camera sweeps a
// fixed arc from its wall mount. Nothing here draws; render.js paints the cones.

import { CAMERA, FIELD, GUARD, THIEF } from './config.js';

const TAU = Math.PI * 2;

/** Smallest signed angle from `from` to `to`, in (-PI, PI]. */
export function angleDelta(from, to) {
  let d = (to - from) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d <= -Math.PI) d += TAU;
  return d;
}

/** True when the segment (x1,y1)-(x2,y2) crosses the rectangle. */
export function segmentHitsRect(x1, y1, x2, y2, rect) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tMin = 0;
  let tMax = 1;
  if (dx === 0) {
    if (x1 < rect.x || x1 > rect.x + rect.width) return false;
  } else {
    let t1 = (rect.x - x1) / dx;
    let t2 = (rect.x + rect.width - x1) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  }
  if (dy === 0) {
    if (y1 < rect.y || y1 > rect.y + rect.height) return false;
  } else {
    let t1 = (rect.y - y1) / dy;
    let t2 = (rect.y + rect.height - y1) / dy;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  }
  return true;
}

/** True when the segment (x1,y1)-(x2,y2) crosses the circle. */
export function segmentHitsCircle(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return (x1 - cx) ** 2 + (y1 - cy) ** 2 <= r * r;
  let t = ((cx - x1) * dx + (cy - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const px = x1 + t * dx;
  const py = y1 + t * dy;
  return (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
}

/** Line of sight: true when no wall and no smoke cloud stands between the two points. */
export function hasLineOfSight(x1, y1, x2, y2, walls, smoke) {
  for (const wall of walls) {
    if (segmentHitsRect(x1, y1, x2, y2, wall)) return false;
  }
  for (const cloud of smoke) {
    if (segmentHitsCircle(x1, y1, x2, y2, cloud.x, cloud.y, cloud.radius)) return false;
  }
  return true;
}

/** True when the thief stands inside the watcher's cone (range, angle and sight). */
export function watcherSeesThief(watcher, range, halfAngle, thief, walls, smoke) {
  const dx = thief.x - watcher.x;
  const dy = thief.y - watcher.y;
  const distance = Math.hypot(dx, dy);
  if (distance > range) return false;
  if (Math.abs(angleDelta(watcher.angle, Math.atan2(dy, dx))) > halfAngle) return false;
  return hasLineOfSight(watcher.x, watcher.y, thief.x, thief.y, walls, smoke);
}

/** A guard built from its route: starts at the first waypoint, facing the second. */
export function createGuard(spec, index) {
  const first = spec.route[0];
  const second = spec.route[1] ?? spec.route[0];
  return {
    x: first.x,
    y: first.y,
    route: spec.route,
    leg: 1,
    angle: Math.atan2(second.y - first.y, second.x - first.x),
    pause: 0,
    sweepPhase: index * 1.7,
    mode: 'patrol',
    investigate: null,
    investigateWait: 0,
    lastSeen: null,
    seesThief: false,
  };
}

/** A camera built from its mount: sweeps around its base angle. The phase is
 * fixed by the camera's index, never random, so a staged scene repeats. */
export function createCamera(spec, index) {
  return {
    x: spec.x,
    y: spec.y,
    baseAngle: spec.baseAngle,
    angle: spec.baseAngle,
    phase: index * 2.1,
    disabledUntil: 0,
    seesThief: false,
  };
}

/**
 * Move one guard a step. In patrol it walks its route and sweeps at waypoints;
 * in investigate it walks to the coin and looks around; in chase it runs at
 * the thief's last seen spot. Returns nothing; the guard is mutated.
 */
export function updateGuard(guard, dt, time, thief, alert, walls) {
  guard.seesThief = false;
  if (guard.mode === 'chase') {
    const goal = guard.lastSeen ?? { x: thief.x, y: thief.y };
    moveToward(guard, goal, GUARD.chaseSpeed, dt);
    if (Math.hypot(goal.x - guard.x, goal.y - guard.y) < 14) {
      guard.mode = 'patrol';
      guard.lastSeen = null;
    }
    return;
  }
  if (guard.mode === 'investigate' && guard.investigate) {
    if (guard.investigateWait > 0) {
      guard.investigateWait -= dt;
      guard.angle += Math.sin(time * 2.2 + guard.sweepPhase) * 0.9 * dt;
      if (guard.investigateWait <= 0) {
        guard.mode = 'patrol';
        guard.investigate = null;
      }
      return;
    }
    moveToward(guard, guard.investigate, GUARD.patrolSpeed, dt);
    if (Math.hypot(guard.investigate.x - guard.x, guard.investigate.y - guard.y) < 14) {
      guard.investigateWait = 2;
    }
    return;
  }
  // Patrol: walk the route, pause and sweep at each waypoint.
  if (guard.pause > 0) {
    guard.pause -= dt;
    guard.angle += Math.sin(time * 1.6 + guard.sweepPhase) * 0.8 * dt;
    return;
  }
  const goal = guard.route[guard.leg];
  const reached = moveToward(guard, goal, GUARD.patrolSpeed, dt);
  if (reached) {
    guard.leg = (guard.leg + 1) % guard.route.length;
    guard.pause = GUARD.waypointPause;
  }
}

/** Walk `mover` toward `goal` at `speed`; returns true when it arrives. */
function moveToward(mover, goal, speed, dt) {
  const dx = goal.x - mover.x;
  const dy = goal.y - mover.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 2) return true;
  const step = Math.min(distance, speed * dt);
  mover.x += (dx / distance) * step;
  mover.y += (dy / distance) * step;
  mover.angle = Math.atan2(dy, dx);
  return step >= distance - 0.01;
}

/** Sweep one camera a step; a disabled camera holds still and sees nothing. */
export function updateCamera(camera, dt, time) {
  camera.seesThief = false;
  if (time < camera.disabledUntil) return;
  camera.phase += dt * CAMERA.sweepSpeed;
  camera.angle = camera.baseAngle + Math.sin(camera.phase) * CAMERA.sweepRange;
}

/**
 * How fast the alarm fills this step (points per second), from every watcher
 * that can see the thief right now. Closer is faster; sneaking and shadow
 * slow it down.
 */
export function detectionRate(state) {
  const thief = state.thief;
  let rate = 0;
  const inCover = state.level.cover.some(
    (patch) => thief.x >= patch.x && thief.x <= patch.x + patch.width && thief.y >= patch.y && thief.y <= patch.y + patch.height,
  );
  const stealth = (thief.sneaking ? THIEF.sneakFactor : 1) * (inCover ? THIEF.coverFactor : 1);
  for (const guard of state.guards) {
    const seen = watcherSeesThief(guard, GUARD.coneRange, GUARD.coneHalfAngle, thief, state.level.walls, state.smoke);
    guard.seesThief = seen;
    if (seen) {
      const distance = Math.hypot(thief.x - guard.x, thief.y - guard.y);
      rate += GUARD.seeRate * (1.5 - distance / GUARD.coneRange) * stealth;
      guard.lastSeen = { x: thief.x, y: thief.y };
    }
  }
  for (const camera of state.cameras) {
    if (state.time < camera.disabledUntil) continue;
    const seen = watcherSeesThief(camera, CAMERA.coneRange, CAMERA.coneHalfAngle, thief, state.level.walls, state.smoke);
    camera.seesThief = seen;
    if (seen) {
      const distance = Math.hypot(thief.x - camera.x, thief.y - camera.y);
      rate += CAMERA.seeRate * (1.5 - distance / CAMERA.coneRange) * stealth;
    }
  }
  return rate;
}

/** Send the nearest patrolling guard to look at a coin that landed at (x, y). */
export function sendGuardToCoin(state, x, y) {
  let best = null;
  let bestDistance = Infinity;
  for (const guard of state.guards) {
    if (guard.mode !== 'patrol') continue;
    const distance = Math.hypot(guard.x - x, guard.y - y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = guard;
    }
  }
  if (best && bestDistance <= 340) {
    best.mode = 'investigate';
    best.investigate = { x, y };
    best.investigateWait = 0;
    best.pause = 0;
  }
}

/** Put every guard on the chase (the alarm just tripped). */
export function startChase(state) {
  for (const guard of state.guards) {
    guard.mode = 'chase';
    guard.lastSeen = { x: state.thief.x, y: state.thief.y };
    guard.investigate = null;
    guard.pause = 0;
  }
}

/** Stand the chase down: guards go back to their routes. */
export function endChase(state) {
  for (const guard of state.guards) {
    if (guard.mode === 'chase') {
      guard.mode = 'patrol';
      guard.lastSeen = null;
    }
  }
}

/** Keep a point inside the play area (inside the border walls). */
export function clampToField(point, radius) {
  point.x = Math.min(FIELD.width - 16 - radius, Math.max(16 + radius, point.x));
  point.y = Math.min(FIELD.height - 16 - radius, Math.max(FIELD.hudHeight + 8 + radius, point.y));
}
