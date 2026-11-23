// Screenshot scenes behind ?shot=chase|drive|foot|title. Each one sets the
// game to a real situation — a police chase, a downtown drive, a walk with a
// mission ahead, the title over the live city — then plays the real rules
// forward for a fixed number of steps with a simple autopilot, so the frame is
// what playing really looks like and the same seed always gives the same frame.
// The scenes stage the early missions; the later ones play by the same rules.
import { STEP, MISSIONS } from './config.js';
import { stepGame } from './game.js';
import { createCar } from './vehicles.js';

/** Steer a car along a loop of road points, braking for the car ahead and
 *  reversing out when wedged (a stuck car reverses for a second, then retries). */
function makeDriver(waypoints) {
  let i = 0;
  let stuckTime = 0;
  let reverseTime = 0;
  return (G) => {
    const car = G.player.car;
    if (!car) return { throttle: 0, steer: 0, handbrake: false };
    const target = waypoints[i % waypoints.length];
    const dx = target.x - car.x;
    const dy = target.y - car.y;
    if (Math.hypot(dx, dy) < 70) i += 1;
    const want = Math.atan2(dy, dx);
    let diff = want - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, diff * 2.2));
    // Stuck against a wall: reverse out, steering the other way.
    if (reverseTime > 0) {
      reverseTime -= STEP;
      return { throttle: -1, steer: -steer, handbrake: false };
    }
    if (Math.abs(car.speed) < 15) {
      stuckTime += STEP;
      if (stuckTime > 1.2) {
        stuckTime = 0;
        reverseTime = 0.9;
        return { throttle: -1, steer: -steer, handbrake: false };
      }
    } else {
      stuckTime = 0;
    }
    let throttle = Math.abs(diff) > 1.2 ? 0.55 : 0.9;
    if (Math.abs(car.speed) < 60) throttle = 1; // launch hard out of a slow turn
    // Brake for the car ahead.
    const fx = Math.cos(car.angle);
    const fy = Math.sin(car.angle);
    for (const other of G.cars) {
      if (other === car || other.dead) continue;
      const ox = other.x - car.x;
      const oy = other.y - car.y;
      const along = ox * fx + oy * fy;
      const side = Math.abs(-ox * fy + oy * fx);
      if (along > 0 && along < 80 && side < 28) {
        throttle = -0.7;
        break;
      }
    }
    return { throttle, steer, handbrake: false };
  };
}

/** Walk a list of waypoints in order, then stop. */
function makeWalker(waypoints) {
  let i = 0;
  return (G) => {
    if (i >= waypoints.length) return { mx: 0, my: 0 };
    const target = waypoints[i];
    const dx = target.x - G.player.x;
    const dy = target.y - G.player.y;
    if (Math.hypot(dx, dy) < 24) {
      i += 1;
      return { mx: 0, my: 0 };
    }
    const d = Math.hypot(dx, dy) || 1;
    return { mx: dx / d, my: dy / d };
  };
}

function putPlayerInCar(G, type, x, y, angle, color) {
  const car = createCar(G.city, G.rng, type, x, y, angle, 'player');
  if (color) car.color = color;
  G.cars.push(car);
  G.player.car = car;
  G.player.x = x;
  G.player.y = y;
  G.player.angle = angle;
  return car;
}

function runSteps(G, seconds, keepAlive) {
  const n = Math.round(seconds / STEP);
  for (let i = 0; i < n; i += 1) {
    stepGame(G, STEP, 'play');
    if (keepAlive) keepAlive(G);
    if (G.player.dead) break;
  }
}

/** Keep the hero car alive through staging: top its health up, and if a
 *  pile-up still killed it, put the player back behind its wheel. */
function keepHeroCar(G, car, minHealth) {
  if (car.dead) {
    car.dead = false;
    car.health = 100;
    car.driver = 'player';
    G.player.car = car;
    G.player.x = car.x;
    G.player.y = car.y;
  } else if (car.health < minHealth) {
    car.health = minHealth;
  }
}

/** Clear every cop from the scene (a clean drive, not a chase). */
function clearCops(G) {
  for (let i = G.cars.length - 1; i >= 0; i -= 1) {
    if (G.cars[i].driver === 'police') G.cars.splice(i, 1);
  }
  G.cops.length = 0;
}

/** True when the player's car is mid-block (away from intersections). */
function midBlock(G) {
  const car = G.player.car;
  if (!car) return false;
  let best = Infinity;
  for (const rx of G.city.roadsV) {
    for (const ry of G.city.roadsH) {
      const d = Math.hypot(car.x - rx, car.y - ry);
      if (d < best) best = d;
    }
  }
  return best > 130;
}

/** Play forward in one-second chunks until the frame looks right (the car at
 *  speed, mid-block) or the cap runs out: still the real rules, just the
 *  photo taken at a good moment. */
function runUntil(G, maxSeconds, minSpeed, keepAlive) {
  const chunks = Math.round(maxSeconds);
  for (let c = 0; c < chunks; c += 1) {
    runSteps(G, 1, keepAlive);
    const car = G.player.car;
    if (car && Math.abs(car.speed) > minSpeed && midBlock(G)) return;
    if (G.player.dead) return;
  }
}

function stageChase(G) {
  // Three stars, downtown, mission 3's delivery on the board, three cruisers
  // already on the tail.
  G.player.money = 1250;
  G.player.health = 100;
  const car = putPlayerInCar(G, 'sports', 1500, 840, 0, '#c94f43');
  car.speed = 380;
  G.wanted.heat = 58;
  G.wanted.stars = 3;
  G.missions.active = { def: MISSIONS[2], step: 1, timer: 0, data: {} };
  // Cruisers already on the tail, all on the same road behind the player.
  const spots = [
    { x: 1320, y: 840 },
    { x: 1240, y: 840 },
    { x: 1400, y: 840 },
  ];
  for (const s of spots) {
    const cop = createCar(G.city, G.rng, 'police', s.x, s.y, 0, 'police');
    cop.siren = true;
    cop.speed = 360;
    G.cars.push(cop);
  }
  G.message('★ ★ ★  Wanted — the drop is hot', '#ff8a7a');
  // A downtown loop on road centres only (roads run at 200 + 320k).
  G.autopilot = makeDriver([
    { x: 1800, y: 840 }, { x: 1800, y: 1160 }, { x: 1160, y: 1160 },
    { x: 1160, y: 520 }, { x: 2120, y: 520 }, { x: 2120, y: 840 },
  ]);
  runUntil(G, 45, 300, () => keepHeroCar(G, car, 55));
  G.autopilot = null;
  // The chase may have raised the heat past three stars; set the frame back.
  G.wanted.heat = 58;
  G.wanted.stars = 3;
  G.player.health = 100;
  return 'play';
}

function stageDrive(G) {
  // A taxi fare through downtown: traffic, pedestrians, the casino ahead.
  G.player.money = 540;
  const car = putPlayerInCar(G, 'taxi', 1480, 1480, -Math.PI / 2, '#f2c230');
  car.speed = 240;
  G.missions.active = { def: MISSIONS[0], step: 2, timer: 0, data: {} };
  G.message('Client aboard — the Casino, please.', '#8fb8e8');
  // A Harbor loop, away from the Casino, so the delivery stays the objective
  // and the frame still shows the drive (all on road centres).
  G.autopilot = makeDriver([
    { x: 1480, y: 1800 }, { x: 840, y: 1800 }, { x: 840, y: 1160 },
    { x: 1160, y: 1160 }, { x: 1160, y: 1480 }, { x: 1480, y: 1480 },
  ]);
  runUntil(G, 30, 250, () => keepHeroCar(G, car, 70));
  G.autopilot = null;
  G.wanted.heat = 0;
  G.wanted.stars = 0;
  G.player.health = 100;
  clearCops(G);
  return 'play';
}

function stageFoot(G) {
  // On foot in Old Town, pistol out, Pier 9 on the objective line.
  G.player.money = 860;
  G.player.weapon = 'pistol';
  G.player.ammo.pistol = 48;
  // On the sidewalk in Old Town, gun out, walking south toward Pier 9.
  G.player.x = 680;
  G.player.y = 880;
  G.player.angle = Math.PI / 2;
  G.missions.active = { def: MISSIONS[4], step: 0, timer: 0, data: {} };
  G.scriptedAim = Math.PI / 2;
  G.message('Vera: the deal at Pier 9 is a setup. Go in loud.', '#ffd76a');
  G.autopilot = makeWalker([
    { x: 520, y: 880 }, { x: 520, y: 1800 },
  ]);
  runSteps(G, 11, null);
  G.autopilot = null;
  G.scriptedAim = Math.PI / 2;
  G.wanted.heat = 0;
  G.wanted.stars = 0;
  G.player.health = 100;
  clearCops(G);
  return 'play';
}

function stageTitle(G) {
  // The title over downtown with the city alive behind it.
  G.camera.x = 1150;
  G.camera.y = 420;
  const n = Math.round(8 / STEP);
  for (let i = 0; i < n; i += 1) stepGame(G, STEP, 'attract');
  G.camera.x = 1150;
  G.camera.y = 420;
  return 'title';
}

/** Set G to the named scene and return the screen to draw. */
export function stageShot(name, G) {
  if (name === 'chase') return stageChase(G);
  if (name === 'drive') return stageDrive(G);
  if (name === 'foot') return stageFoot(G);
  return stageTitle(G);
}
