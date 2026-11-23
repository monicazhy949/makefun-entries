// Vehicles: cars to drive, steal and crash. A car's id is unique and
// increasing; its steer/throttle are set by the driver (player input or
// the autopilot) and applied here.

import { CAR_MAX_SPEED, CAR_ACCEL, CAR_BRAKE, COLORS } from './config.js';
import { resolveCircle, nearestRoadPoint } from './world.js';

let nextId = 1;

export const CAR_KINDS = {
  sedan: { max: CAR_MAX_SPEED, accel: 330, color: COLORS.sedan },
  taxi: { max: 280, accel: 350, color: COLORS.taxi },
  sport: { max: 310, accel: 380, color: COLORS.orange },
  truck: { max: 220, accel: CAR_MAX_SPEED, color: COLORS.green },
  police: { max: 285, accel: 360, color: COLORS.police },
};

export function createCar(city, rng, kind, x, y, angle, driver) {
  const spec = CAR_KINDS[kind] || CAR_KINDS.sedan;
  const car = {
    id: nextId,
    kind,
    x,
    y,
    angle,
    speed: 0,
    steer: 0,
    throttle: 0,
    health: 100,
    hp: 100,
    dead: false,
    driver: driver || null,
    color: spec.color,
    maxSpeed: spec.max,
    accel: spec.accel,
    siren: kind === 'police',
    sirenPhase: 0,
    cruise: 120 + (rng ? rng.range(0, 60) : 0),
    turnAt: 0,
    hitCooldown: 0,
  };
  nextId += 1;
  return car;
}

// One physics step for a single car. Steering follows the driver's
// convention: positive steer turns the car toward a smaller heading
// angle, which is the way the headless autopilot steers. The turn rate
// is modest and falls off at speed so the car stays controllable, and
// a wall hit scrubs speed and only dents the car when it is really fast.
export function stepCar(G, car, dt) {
  if (car.dead) return;
  const city = G.city;
  car.hitCooldown = Math.max(0, (car.hitCooldown || 0) - dt);
  if (car.throttle > 0) car.speed += car.accel * car.throttle * dt;
  else if (car.throttle < 0) car.speed += CAR_BRAKE * car.throttle * dt;
  else {
    const drag = 140 * dt;
    if (Math.abs(car.speed) <= drag) car.speed = 0;
    else car.speed -= Math.sign(car.speed) * drag;
  }
  if (car.speed > car.maxSpeed) car.speed = car.maxSpeed;
  if (car.speed < -80) car.speed = -80;
  const grip = Math.min(1, Math.abs(car.speed) / 30);
  const speedFactor = 1 - 0.5 * Math.min(1, Math.abs(car.speed) / car.maxSpeed);
  car.angle -= car.steer * Math.abs(car.steer) * 1.5 * dt * grip * (car.speed < 0 ? -1 : 1);
  // Keep the heading in [0, 2PI) so west reads as +PI: the autopilot's
  // (angle - want) then picks the short way round to the target.
  car.angle = ((car.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const fixed = { x: Math.max(30, Math.min(2770, nx)), y: Math.max(30, Math.min(2050, ny)) };
  if (fixed.hit) {
    if (Math.abs(car.speed) > 120 && car.hitCooldown <= 0) {
      car.health -= 3;
      car.hp = car.health;
      car.hitCooldown = 0.5;
      if (car.health <= 0) {
        car.health = 0;
        car.hp = 0;
        car.dead = true;
        if (G.explodeQueue) G.explodeQueue.push({ x: car.x, y: car.y, radius: 90, blame: false });
      }
    }
    car.speed *= 1;
  }
  car.x = fixed.x;
  car.y = fixed.y;
  if (car.siren) car.sirenPhase += dt * 10;
}

// Traffic cars cruise along roads and pick a new direction at crossings.
function driveTraffic(G, car, dt) {
  const city = G.city;
  const rng = G.rng;
  car.throttle = 1;
  // Near a crossing, sometimes turn onto the other road.
  const nearV = city.roadsV.some((r) => Math.abs(car.x - r) < 26);
  const nearH = city.roadsH.some((r) => Math.abs(car.y - r) < 26);
  if (nearV && nearH && rng.chance(dt * 0.25)) {
    const dirs = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
    const want = rng.pick(dirs);
    car.targetAngle = want;
  }
  if (car.targetAngle !== undefined) {
    let diff = car.targetAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    // Traffic steers with the same sign convention as the player car.
    car.steer = Math.max(-1, Math.min(1, -diff * 2));
    if (Math.abs(diff) < 0.15) car.targetAngle = undefined;
  } else {
    car.steer = 0;
  }
  // Slow down for a car right ahead.
  for (const other of G.cars) {
    if (other === car || other.dead) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const d = Math.hypot(dx, dy);
    if (d < 70 && Math.abs(Math.atan2(dy, dx) - car.angle) < 0.6) {
      car.throttle = 0;
      break;
    }
  }
  stepCar(G, car, dt);
}

// Keep cars from overlapping each other.
function separateCars(G) {
  const cars = G.cars;
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i];
      const b = cars[j];
      if (a.dead || b.dead) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.01 && d < 34) {
        const push = (34 - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
      }
    }
  }
}

export function updateVehicles(G, dt) {
  for (const car of G.cars) {
    if (car.dead) continue;
    if (car.driver === 'traffic') driveTraffic(G, car, dt);
    else if (car.driver === 'police') {
      // Police steering is set by the police update; just move the car.
      stepCar(G, car, dt);
    } else if (car.driver === 'player') {
      stepCar(G, car, dt);
    } else {
      // Parked: no throttle, but still resolve overlaps.
      car.throttle = 0;
      car.steer = 0;
      stepCar(G, car, dt);
    }
    car.hp = car.health;
  }
  separateCars(G);
  // Prune the dead and the far away, except the player's car.
  for (let i = G.cars.length - 1; i >= 0; i -= 1) {
    const car = G.cars[i];
    if (car.dead && car.driver !== 'player') G.cars.splice(i, 1);
  }
}

export function spawnTraffic(G, count) {
  const kinds = ['sedan', 'sedan', 'taxi', 'sport', 'truck'];
  for (let i = 0; i < count; i += 1) {
    const p = nearestRoadPoint(G.rng, G.city);
    const angle = G.rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
    const car = createCar(G.city, G.rng, G.rng.pick(kinds), p.x, p.y, angle, 'traffic');
    car.speed = car.cruise;
    G.cars.push(car);
  }
}

export function nearestCar(G, x, y, maxDist) {
  let best = null;
  let bd = maxDist;
  for (const car of G.cars) {
    if (car.dead) continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bd) { bd = d; best = car; }
  }
  return best;
}
