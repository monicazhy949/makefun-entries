// Pedestrians: they stroll the sidewalks, cross at corners, scatter when shots
// ring out, and get knocked down when a car hits them (which the cops notice).
// They scatter from gunfire in every mission, including the Warehouse Raid.
import { resolveCircle, randomSidewalkPoint } from './world.js';

const SHIRTS = ['#d94f3d', '#3d7bd9', '#e8c53a', '#7fb069', '#b06fb8', '#e8e4da', '#4fb0a5', '#d97b29', '#5a5a6a', '#e88fb0'];

export function createPed(city, rng, x, y) {
  return {
    x, y,
    angle: rng.range(0, Math.PI * 2),
    speed: rng.range(34, 62),
    shirt: rng.pick(SHIRTS),
    skin: rng.pick(['#f2c9a0', '#d9a06b', '#a06b3f', '#8a5a30', '#f7dcc0']),
    state: 'walk', // walk | flee | down
    target: null,
    timer: 0,
    panic: 0,
    down: 0,
  };
}

function pickStrollTarget(G, ped) {
  const p = randomSidewalkPoint(G.rng, G.city);
  ped.target = p;
}

export function scarePeds(G, x, y, radius) {
  for (const ped of G.peds) {
    if (ped.state === 'down') continue;
    const d = Math.hypot(ped.x - x, ped.y - y);
    if (d < radius) {
      ped.state = 'flee';
      ped.panic = 1;
      const away = Math.atan2(ped.y - y, ped.x - x);
      ped.target = {
        x: ped.x + Math.cos(away) * 260,
        y: ped.y + Math.sin(away) * 260,
      };
      ped.timer = 0;
    }
  }
}

/** Knock a pedestrian down. Only the player's own doing raises the heat:
 *  traffic running someone over is the city's chaos, not the player's crime. */
export function knockDown(G, ped, blame = false) {
  if (ped.state === 'down') return;
  ped.state = 'down';
  ped.down = 4;
  ped.timer = 0;
  if (blame) {
    G.addHeat(10, 'pedestrian down');
    G.stats.kills += 1;
  }
}

export function updatePeds(G, dt) {
  const px = G.player.x;
  const py = G.player.y;
  for (let i = G.peds.length - 1; i >= 0; i -= 1) {
    const ped = G.peds[i];
    if (ped.state === 'down') {
      ped.down -= dt;
      if (ped.down <= 0) {
        ped.state = 'walk';
        ped.target = null;
      }
      continue;
    }
    if (!ped.target) pickStrollTarget(G, ped);
    const dx = ped.target.x - ped.x;
    const dy = ped.target.y - ped.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 14) {
      ped.target = null;
      if (ped.state === 'flee') {
        ped.state = 'walk';
        ped.panic = 0;
      }
      continue;
    }
    const want = Math.atan2(dy, dx);
    let diff = want - ped.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    ped.angle += Math.max(-3 * dt, Math.min(3 * dt, diff));
    const speed = ped.state === 'flee' ? ped.speed * 2.6 : ped.speed;
    const nx = ped.x + Math.cos(ped.angle) * speed * dt;
    const ny = ped.y + Math.sin(ped.angle) * speed * dt;
    const fixed = resolveCircle(G.city, nx, ny, 10);
    ped.x = fixed.x;
    ped.y = fixed.y;
    // Run over by a fast car — blamed on the player only when it is their car.
    for (const car of G.cars) {
      if (car.dead || Math.abs(car.speed) < 60) continue;
      if (Math.hypot(car.x - ped.x, car.y - ped.y) < 26) {
        knockDown(G, ped, car.driver === 'player');
        break;
      }
    }
    // Thin out far-away peds; the spawner tops them up.
    if (Math.hypot(ped.x - px, ped.y - py) > 1500) {
      G.peds.splice(i, 1);
    }
  }
  // Keep the streets busy near the player.
  let guard = 0;
  while (G.peds.length < 55 && guard < 30) {
    guard += 1;
    const p = randomSidewalkPoint(G.rng, G.city);
    const d = Math.hypot(p.x - px, p.y - py);
    if (d < 420 || d > 1300) continue;
    G.peds.push(createPed(G.city, G.rng, p.x, p.y));
  }
}
