// Pedestrians: Solmar Bay's people. They walk the sidewalks, cross at
// corners, and run when shots ring out.

import { resolveCircle } from './world.js';

const SHIRTS = ['#c94f43', '#3f6fb5', '#7fb069', '#e8c53a', '#8a6fb5', '#d97b29', '#e8e2c8'];
const SKINS = ['#e8b98a', '#c98d5e', '#a06b42', '#f0c8a0'];

export function createPed(G, x, y) {
  return {
    x, y,
    angle: G.rng.range(0, Math.PI * 2),
    speed: 55 + G.rng.range(0, 35),
    shirt: G.rng.pick(SHIRTS),
    skin: G.rng.pick(SKINS),
    state: 'walk',
    turnTimer: G.rng.range(1, 4),
    fleeTimer: 0,
  };
}

export function spawnPeds(G, count) {
  for (let i = 0; i < count; i += 1) {
    const x = G.rng.range(120, G.city.width - 120);
    const y = G.rng.range(120, G.city.height - 120);
    G.peds.push(createPed(G, x, y));
  }
}

export function updatePeds(G, dt) {
  const px = G.player.x;
  const py = G.player.y;
  const shooting = (G.bullets.length > 0) || (G.wanted && G.wanted.stars > 0);
  for (const ped of G.peds) {
    const dPlayer = Math.hypot(ped.x - px, ped.y - py);
    if (shooting && dPlayer < 320) {
      ped.state = 'flee';
      ped.fleeTimer = 2.5;
    }
    if (ped.fleeTimer > 0) {
      ped.fleeTimer -= dt;
      if (ped.fleeTimer <= 0) ped.state = 'walk';
    }
    if (ped.state === 'flee') {
      const a = Math.atan2(ped.y - py, ped.x - px);
      ped.angle = a;
      const nx = ped.x + Math.cos(a) * 170 * dt;
      const ny = ped.y + Math.sin(a) * 170 * dt;
      const fixed = resolveCircle(G.city, nx, ny, 9);
      ped.x = fixed.x;
      ped.y = fixed.y;
      continue;
    }
    // Walk: drift along, turning at random or at a wall.
    ped.turnTimer -= dt;
    if (ped.turnTimer <= 0) {
      ped.turnTimer = G.rng.range(2, 6);
      ped.angle += G.rng.pick([-Math.PI / 2, Math.PI / 2, 0, 0, Math.PI]);
    }
    const nx = ped.x + Math.cos(ped.angle) * ped.speed * dt;
    const ny = ped.y + Math.sin(ped.angle) * ped.speed * dt;
    const fixed = resolveCircle(G.city, nx, ny, 9);
    if (fixed.hit) {
      ped.angle += Math.PI / 2;
    } else {
      ped.x = fixed.x;
      ped.y = fixed.y;
    }
  }
}
