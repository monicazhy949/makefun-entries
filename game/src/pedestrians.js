// Solmar Bay: pedestrians. They stroll between intersections and run when a
// car bears down on them or shots ring out.
import { PED_WALK_SPEED } from './config.js';
import { ROADS_V, ROADS_H } from './world.js';

const SHIRT_COLORS = ['#e86a6a', '#6aa5e8', '#7ed07e', '#e8c96a', '#c97ee8', '#e8e8e8', '#6ad0c9'];

export function spawnPeds(G, count) {
  for (let i = 0; i < count; i += 1) {
    const x = G.rng.pick(ROADS_V) + G.rng.range(-40, 40);
    const y = G.rng.pick(ROADS_H) + G.rng.range(-40, 40);
    G.peds.push({
      x, y,
      angle: G.rng.range(0, Math.PI * 2),
      speed: PED_WALK_SPEED,
      health: 100,
      down: 0,
      tx: x,
      ty: y,
      color: G.rng.pick(SHIRT_COLORS),
    });
  }
}

function pickTarget(G, ped) {
  ped.tx = G.rng.pick(ROADS_V) + G.rng.range(-30, 30);
  ped.ty = G.rng.pick(ROADS_H) + G.rng.range(-30, 30);
}

export function updatePeds(G, dt) {
  for (const ped of G.peds) {
    if (ped.down > 0) continue;
    const dPlayer = Math.hypot(G.player.x - ped.x, G.player.y - ped.y);
    let tx = ped.tx;
    let ty = ped.ty;
    let speed = ped.speed;
    const scared = dPlayer < 130 && (G.player.car || G.combat.shotsFired > 0);
    if (scared) {
      // Run away from the player.
      const away = Math.atan2(ped.y - G.player.y, ped.x - G.player.x);
      tx = ped.x + Math.cos(away) * 200;
      ty = ped.y + Math.sin(away) * 200;
      speed = 130;
    } else if (Math.hypot(tx - ped.x, ty - ped.y) < 24) {
      pickTarget(G, ped);
      tx = ped.tx;
      ty = ped.ty;
    }
    const dx = tx - ped.x;
    const dy = ty - ped.y;
    const d = Math.hypot(dx, dy) || 1;
    ped.x += (dx / d) * speed * dt;
    ped.y += (dy / d) * speed * dt;
    ped.angle = Math.atan2(dy, dx);
    ped.x = Math.max(40, Math.min(G.city.w - 40, ped.x));
    ped.y = Math.max(40, Math.min(G.city.h - 40, ped.y));
  }
}
