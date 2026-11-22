// Cars: arcade driving physics, traffic that follows the road grid and stops at
// red lights, and damage with smoke, fire and explosion. Police steering is set
// by police.js; this file only moves metal.
import { CAR_TYPES, CAR_COLORS } from './config.js';
import { resolveCircle, roadAt, nearestRoadPoint, randomRoadPoint, lightState } from './world.js';

let nextId = 1;

export function createCar(city, rng, type, x, y, angle, driver) {
  const def = CAR_TYPES[type] || CAR_TYPES.sedan;
  return {
    id: nextId,
    type,
    x, y,
    angle,
    speed: 0,
    steer: 0,
    throttle: 0,
    color: type === 'police' ? '#20242c' : type === 'taxi' ? '#f2c230' : rng.pick(CAR_COLORS),
    health: 100,
    driver, // 'player' | 'traffic' | 'police' | null (parked)
    route: [],
    routeI: 0,
    wait: 0,
    stuck: 0,
    siren: false,
    sirenPhase: rng.next() * Math.PI * 2,
    hurtAt: -10, // last collision damage, so a scrape is one hit, not sixty
    dead: false,
    w: def.w,
    h: def.h,
    brakeLight: false,
  };
}

function defOf(car) {
  return CAR_TYPES[car.type] || CAR_TYPES.sedan;
}

/** One physics step for a car with a throttle (-1..1) and steer (-1..1). */
export function driveCar(G, car, dt, throttle, steer, handbrake) {
  const def = defOf(car);
  const city = G.city;
  const forward = car.speed >= 0 ? 1 : -1;
  // Steering only bites while moving; handbrake slides the tail out.
  const grip = handbrake ? def.grip * 0.45 : def.grip;
  car.angle += steer * grip * Math.min(1, Math.abs(car.speed) / 140) * forward * dt;
  if (throttle > 0) car.speed += def.accel * throttle * dt;
  else if (throttle < 0) {
    if (car.speed > 5) car.speed += def.accel * 1.6 * throttle * dt; // brake
    else car.speed += def.accel * 0.55 * throttle * dt; // reverse
  }
  // Drag and rolling resistance; handbrake scrubs speed hard.
  car.speed -= car.speed * (handbrake ? 1.6 : 0.35) * dt;
  car.speed -= Math.sign(car.speed) * 12 * dt;
  if (Math.abs(car.speed) < 4 && throttle === 0) car.speed = 0;
  car.speed = Math.max(-def.maxSpeed * 0.35, Math.min(def.maxSpeed, car.speed));
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  // Collide as a circle at the car's centre plus a nose check, so cars slide
  // along walls instead of stopping dead.
  const r = Math.max(car.w, car.h) * 0.42;
  const fixed = resolveCircle(city, nx, ny, r);
  const hitWall = fixed.x !== nx || fixed.y !== ny;
  if (hitWall && Math.abs(car.speed) > 120) {
    // One hit per scrape, not one per frame: a wall graze must not total a car.
    if (G.time - car.hurtAt > 0.6) {
      damageCar(G, car, Math.abs(car.speed) * 0.02);
      car.hurtAt = G.time;
    }
    car.speed *= 0.35;
  } else if (hitWall) {
    car.speed *= 0.7;
  }
  car.x = fixed.x;
  car.y = fixed.y;
  car.brakeLight = throttle < 0 || handbrake;
  // Skid marks when sliding sideways at speed.
  if (handbrake && Math.abs(car.speed) > 180 && G.skids.length < 400) {
    G.skids.push({ x: car.x, y: car.y, angle: car.angle, life: 6 });
  }
}

/** Car-to-car collision: circles that push apart and trade speed. */
export function collideCars(G, a, b) {
  const ra = Math.max(a.w, a.h) * 0.42;
  const rb = Math.max(b.w, b.h) * 0.42;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d2 = dx * dx + dy * dy;
  const min = ra + rb;
  if (d2 >= min * min || d2 < 0.01) return;
  const d = Math.sqrt(d2);
  const push = (min - d) / 2;
  const nx = dx / d;
  const ny = dy / d;
  a.x -= nx * push;
  a.y -= ny * push;
  b.x += nx * push;
  b.y += ny * push;
  const rel = Math.abs(a.speed - b.speed);
  if (rel > 90) {
    if (G.time - a.hurtAt > 0.6) {
      damageCar(G, a, rel * 0.02);
      a.hurtAt = G.time;
    }
    if (G.time - b.hurtAt > 0.6) {
      damageCar(G, b, rel * 0.02);
      b.hurtAt = G.time;
    }
    a.speed *= 0.6;
    b.speed *= 0.6;
    spark(G, (a.x + b.x) / 2, (a.y + b.y) / 2);
  } else {
    const avg = (a.speed + b.speed) / 2;
    a.speed = avg;
    b.speed = avg;
  }
}

export function spark(G, x, y) {
  for (let i = 0; i < 6; i += 1) {
    G.particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 160,
      vy: (Math.random() - 0.5) * 160,
      life: 0.35, maxLife: 0.35, size: 2.5, color: '#ffd76a', kind: 'spark',
    });
  }
}

export function damageCar(G, car, amount) {
  if (car.dead) return;
  car.health -= amount;
  if (car.health <= 0) {
    car.health = 0;
    car.dead = true;
    // The explosion itself lives in combat.js, called from the main update.
    // Blame follows the driver: only the player's car exploding is their crime.
    G.explodeQueue.push({ x: car.x, y: car.y, radius: 90, blame: car.driver === 'player' });
    if (car.driver === 'player') G.player.car = null;
  }
}

/** A route along the road grid: a few road points joined by straight runs. */
function makeRoute(rng, city, from) {
  const points = [];
  let p = { x: from.x, y: from.y };
  for (let i = 0; i < 4; i += 1) {
    const target = randomRoadPoint(rng, city);
    // Go along one axis, then the other: cars stay on roads.
    if (rng.chance(0.5)) {
      points.push({ x: target.x, y: p.y });
      points.push({ x: target.x, y: target.y });
    } else {
      points.push({ x: p.x, y: target.y });
      points.push({ x: target.x, y: target.y });
    }
    p = target;
  }
  return points;
}

function carAhead(G, car, dist) {
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  for (const other of G.cars) {
    if (other === car || other.dead) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const along = dx * fx + dy * fy;
    if (along < 0 || along > dist) continue;
    const side = Math.abs(-dx * fy + dy * fx);
    if (side < 26) return other;
  }
  return null;
}

function redLightAhead(G, car) {
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  const movingV = Math.abs(fy) > Math.abs(fx);
  for (const light of G.city.lights) {
    const dx = light.x - car.x;
    const dy = light.y - car.y;
    const along = dx * fx + dy * fy;
    if (along < 0 || along > 90) continue;
    const side = Math.abs(-dx * fy + dy * fx);
    if (side > 30) continue;
    const state = lightState(light, G.time);
    if ((movingV && state === 'ew') || (!movingV && state === 'ns')) return true;
  }
  return false;
}

function driveTraffic(G, car, dt) {
  if (car.route.length === 0 || car.routeI >= car.route.length) {
    car.route = makeRoute(G.rng, G.city, car);
    car.routeI = 0;
  }
  const target = car.route[car.routeI];
  const dx = target.x - car.x;
  const dy = target.y - car.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 26) {
    car.routeI += 1;
    return;
  }
  const want = Math.atan2(dy, dx);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 2.2));
  let throttle = 0.55;
  if (Math.abs(diff) > 1.1) throttle = 0.25;
  if (carAhead(G, car, 70) || redLightAhead(G, car)) throttle = -0.6;
  // Stuck against something: pick a fresh route after a few seconds.
  if (Math.abs(car.speed) < 8 && throttle > 0) {
    car.stuck += dt;
    if (car.stuck > 3) {
      car.route = [];
      car.stuck = 0;
    }
  } else {
    car.stuck = 0;
  }
  driveCar(G, car, dt, throttle, steer, false);
}

/** Keep traffic topped up near the player and thin far away. */
export function maintainTraffic(G) {
  const px = G.player.x;
  const py = G.player.y;
  let traffic = 0;
  for (let i = G.cars.length - 1; i >= 0; i -= 1) {
    const car = G.cars[i];
    if (car.driver !== 'traffic') continue;
    traffic += 1;
    const d = Math.hypot(car.x - px, car.y - py);
    if (d > 1700 || car.dead) {
      G.cars.splice(i, 1);
      traffic -= 1;
    }
  }
  const want = 30;
  let guard = 0;
  while (traffic < want && guard < 40) {
    guard += 1;
    const p = randomRoadPoint(G.rng, G.city);
    const d = Math.hypot(p.x - px, p.y - py);
    if (d < 500 || d > 1500) continue;
    const dir = roadAt(G.city, p.x, p.y);
    const angle = dir === 'v' ? (G.rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (G.rng.chance(0.5) ? 0 : Math.PI);
    const type = G.rng.pick(['sedan', 'sedan', 'coupe', 'taxi', 'van', 'truck', 'limo']);
    const car = createCar(G.city, G.rng, type, p.x, p.y, angle, 'traffic');
    car.speed = G.rng.range(120, 220);
    G.cars.push(car);
    traffic += 1;
  }
}

export function updateVehicles(G, dt) {
  for (const car of G.cars) {
    if (car.dead) continue;
    if (car.driver === 'traffic') {
      driveTraffic(G, car, dt);
    } else if (car.driver === 'police') {
      // Police steering is set by police.js into throttle/steer each frame.
      driveCar(G, car, dt, car.throttle, car.steer, false);
    } else if (car.driver === 'player') {
      // Driven from player.js.
    } else if (car.speed !== 0) {
      // Parked cars roll to a stop.
      driveCar(G, car, dt, 0, 0, false);
    }
    // Smoke and fire as health falls.
    if (car.health < 55 && !car.dead && G.rng.chance(dt * (car.health < 25 ? 14 : 6))) {
      G.particles.push({
        x: car.x + Math.cos(car.angle) * car.w * 0.3,
        y: car.y + Math.sin(car.angle) * car.w * 0.3,
        vx: G.rng.range(-14, 14), vy: G.rng.range(-30, -12),
        life: 0.9, maxLife: 0.9, size: G.rng.range(5, 10),
        color: car.health < 25 ? '#ff7a2a' : '#5a5a5a', kind: 'smoke',
      });
    }
  }
  // Pairwise car collisions (small N, brute force is fine).
  for (let i = 0; i < G.cars.length; i += 1) {
    for (let j = i + 1; j < G.cars.length; j += 1) {
      const a = G.cars[i];
      const b = G.cars[j];
      if (a.dead || b.dead) continue;
      if (Math.abs(a.x - b.x) > 70 || Math.abs(a.y - b.y) > 70) continue;
      collideCars(G, a, b);
    }
  }
  maintainTraffic(G);
}
