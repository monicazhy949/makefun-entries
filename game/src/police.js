// Solmar Bay: the wanted system and the police.
// Heat rises with crime and cools off when the player is out of sight.
// Stars follow heat; patrol cars chase, foot cops close in and make the bust.
import { COP_MAX_SPEED, FOOT_COP_SPEED } from './config.js';
import { angleDiff } from './random.js';
import { createCar } from './vehicles.js';
import { ROADS_V, ROADS_H, nearestRoadPoint } from './world.js';

export function addHeat(G, n) {
  G.wanted.heat = Math.max(0, Math.min(120, G.wanted.heat + n));
}

export function starsForHeat(heat) {
  if (heat >= 90) return 5;
  if (heat >= 65) return 4;
  if (heat >= 45) return 3;
  if (heat >= 25) return 2;
  if (heat >= 8) return 1;
  return 0;
}

function spawnCopCar(G) {
  for (let tries = 0; tries < 24; tries += 1) {
    const x = G.rng.pick(ROADS_V);
    const y = G.rng.pick(ROADS_H);
    const d = Math.hypot(x - G.player.x, y - G.player.y);
    if (d > 650 && d < 1000) {
      const car = createCar(G, 'Interceptor', x, y, 0, 'police');
      car.health = 99999;
      car.speed = 120;
      G.cars.push(car);
      return car;
    }
  }
  const p = nearestRoadPoint(G.player.x + 800, G.player.y);
  const car = createCar(G, 'Interceptor', p.x, p.y, 0, 'police');
  car.health = 99999;
  car.speed = 120;
  G.cars.push(car);
  return car;
}

function spawnFootCop(G) {
  for (let tries = 0; tries < 16; tries += 1) {
    const a = G.rng.range(0, Math.PI * 2);
    const d = G.rng.range(300, 450);
    const x = G.player.x + Math.cos(a) * d;
    const y = G.player.y + Math.sin(a) * d;
    if (x < 60 || x > G.city.w - 60 || y < 60 || y > G.city.h - 60) continue;
    const cop = { x, y, angle: 0, health: 100, down: 0, closeT: 0 };
    G.footCops.push(cop);
    return cop;
  }
  return null;
}

function bustPlayer(G) {
  G.screen = 'busted';
  G.wanted.heat = 0;
  G.wanted.stars = 0;
  G.footCops.length = 0;
  G.bustGrace = 5;
  if (G.audio && G.audio.busted) G.audio.busted();
}

export function updatePolice(G, dt) {
  if (G.bustGrace > 0) G.bustGrace -= dt;
  const w = G.wanted;
  let cops = G.cars.filter((c) => c.driver === 'police' && !c.dead);
  let nearest = Infinity;
  for (const c of cops) nearest = Math.min(nearest, Math.hypot(c.x - G.player.x, c.y - G.player.y));
  for (const f of G.footCops) nearest = Math.min(nearest, Math.hypot(f.x - G.player.x, f.y - G.player.y));
  const decay = cops.length === 0 && G.footCops.length === 0
    ? 3.0
    : nearest > 800
      ? 3.0
      : nearest > 400
        ? 2.2
        : 0.8;
  w.heat = Math.max(0, w.heat - decay * dt);
  w.stars = starsForHeat(w.heat);

  // Patrol cars: one per star, at most three.
  const wantCars = w.stars > 0 ? Math.min(w.stars, 3) : 0;
  while (cops.length < wantCars) {
    const car = spawnCopCar(G);
    if (car) cops.push(car);
    else break;
  }
  while (cops.length > wantCars) {
    const car = cops.pop();
    const idx = G.cars.indexOf(car);
    if (idx >= 0) G.cars.splice(idx, 1);
  }
  // Chase the player.
  for (const car of cops) {
    const p = G.player;
    const d = Math.hypot(p.x - car.x, p.y - car.y);
    if (!p.car && d < 110) {
      // On foot: the patrol car holds off and the foot cops move in.
      car.speed += (0 - car.speed) * Math.min(1, 4 * dt);
    } else {
      const want = Math.atan2(p.y - car.y, p.x - car.x);
      const diff = angleDiff(car.angle, want);
      const steer = Math.max(-1, Math.min(1, diff * 2.2));
      car.angle += steer * 2.8 * dt * (car.speed >= 0 ? 1 : -1);
      car.speed += (COP_MAX_SPEED - car.speed) * Math.min(1, 1.6 * dt);
    }
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.x = Math.max(40, Math.min(G.city.w - 40, car.x));
    car.y = Math.max(40, Math.min(G.city.h - 40, car.y));
    if (p.car && d < 54) {
      // Ram: shove the player's car, never wreck it.
      p.car.speed *= 0.995;
      car.speed *= 0.9;
    }
  }
  G.cops = cops;

  // Foot cops: only when the player is on foot and wanted.
  const wantFoot = w.stars > 0 && !G.player.car ? Math.min(w.stars, 2) : 0;
  while (G.footCops.length < wantFoot) {
    if (!spawnFootCop(G)) break;
  }
  while (G.footCops.length > wantFoot) G.footCops.pop();
  for (const f of G.footCops) {
    const d = Math.hypot(G.player.x - f.x, G.player.y - f.y);
    if (d > 1) {
      f.x += ((G.player.x - f.x) / d) * FOOT_COP_SPEED * dt;
      f.y += ((G.player.y - f.y) / d) * FOOT_COP_SPEED * dt;
      f.angle = Math.atan2(G.player.y - f.y, G.player.x - f.x);
    }
    if (d < 30) f.closeT += dt;
    else f.closeT = 0;
    if (f.closeT > 4.0 && G.bustGrace <= 0) {
      bustPlayer(G);
      break;
    }
  }
}

// The player is wasted: drop them at the hospital, healthy, on foot.
export function wastePlayer(G) {
  const p = G.player;
  p.dead = false;
  p.health = 100;
  p.armor = 0;
  if (p.car) {
    p.car.driver = null;
    p.car = null;
  }
  const h = G.city.spots.hospital;
  p.x = h.x;
  p.y = h.y;
  p.angle = 0;
  G.screen = 'wasted';
  G.footCops.length = 0;
  addHeat(G, -15);
  if (G.audio && G.audio.wasted) G.audio.wasted();
}
