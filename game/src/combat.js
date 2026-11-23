// Solmar Bay: combat. The player shoots where they aim; rivals shoot back.
// A kill only counts toward the mission when the active step is a kill step.
import { addHeat } from './police.js';

const BULLET_SPEED = 3900;
const BULLET_HIT_RADIUS = 40;
const RIVAL_BULLET_SPEED = 520;
const FIRE_INTERVAL = 0.18;

export function playerShoot(G) {
  const now = G.time;
  if (now - (G.combat.lastShot || -99) < FIRE_INTERVAL) return false;
  G.combat.lastShot = now;
  G.combat.shotsFired = (G.combat.shotsFired || 0) + 1;
  const p = G.player;
  const a = p.aimAngle;
  G.bullets.push({
    x: p.x + Math.cos(a) * 22,
    y: p.y + Math.sin(a) * 22,
    vx: Math.cos(a) * BULLET_SPEED,
    vy: Math.sin(a) * BULLET_SPEED,
    life: 0.9,
    from: 'player',
    damage: 34,
  });
  if (G.audio && G.audio.shoot) G.audio.shoot();
  addHeat(G, 0.2);
  return true;
}

export function updateCombat(G, dt) {
  // Rivals close in slowly and fire back.
  for (const r of G.rivals) {
    if (r.down > 0) continue;
    const d = Math.hypot(G.player.x - r.x, G.player.y - r.y);
    r.shootT = (r.shootT || 0) - dt;
    if (d < 520 && r.shootT <= 0 && !G.player.dead) {
      r.shootT = 1.4 + G.rng.next() * 0.6;
      const a = Math.atan2(G.player.y - r.y, G.player.x - r.x) + (G.rng.next() - 0.5) * 0.24;
      G.bullets.push({
        x: r.x,
        y: r.y,
        vx: Math.cos(a) * RIVAL_BULLET_SPEED,
        vy: Math.sin(a) * RIVAL_BULLET_SPEED,
        life: 1.6,
        from: 'rival',
        damage: 3,
      });
      r.angle = a;
    }
    if (d > 260 && d > 0.01) {
      r.x += ((G.player.x - r.x) / d) * 42 * dt;
      r.y += ((G.player.y - r.y) / d) * 42 * dt;
    }
  }
  // Move bullets.
  for (const b of G.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
  }
  G.bullets = G.bullets.filter(
    (b) => b.life > 0 && b.x > 0 && b.x < G.city.w && b.y > 0 && b.y < G.city.h,
  );
  // Hits.
  for (const b of G.bullets) {
    if (b.life <= 0) continue;
    if (b.from === 'player') {
      for (const r of G.rivals) {
        if (r.down > 0) continue;
        if (Math.hypot(b.x - r.x, b.y - r.y) < BULLET_HIT_RADIUS) {
          r.health -= b.damage;
          b.life = 0;
          if (r.health <= 0) {
            r.down = 1;
            addHeat(G, 6);
            const step = G.missions.active && G.missions.active.def.steps[G.missions.active.step];
            if (step && step.type === 'kill') G.missions.kills += 1;
          }
          break;
        }
      }
      if (b.life > 0) {
        for (const ped of G.peds) {
          if (ped.down > 0) continue;
          if (Math.hypot(b.x - ped.x, b.y - ped.y) < BULLET_HIT_RADIUS) {
            ped.health -= b.damage;
            b.life = 0;
            if (ped.health <= 0) {
              ped.down = 1;
              addHeat(G, 5);
            }
            break;
          }
        }
      }
    } else if (b.from === 'rival') {
      if (!G.player.dead && !G.player.car && Math.hypot(b.x - G.player.x, b.y - G.player.y) < 18) {
        G.player.health -= b.damage;
        G.player.lastHurtT = G.time;
        b.life = 0;
        if (G.player.health <= 0) {
          G.player.health = 0;
          G.player.dead = true;
        }
      }
    }
  }
  G.bullets = G.bullets.filter((b) => b.life > 0);
}
