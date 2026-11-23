// Combat: bullets, rivals, explosions. A kill only counts when the
// mission step that is active right now is a kill step.

import { HEAT_PER_KILL } from './config.js';
import { addHeat } from './police.js';
import { damagePlayer } from './player.js';

export function createRival(G, x, y) {
  return {
    x, y,
    angle: 0,
    health: 60,
    speed: 90,
    shootTimer: 1 + G.rng.range(0, 1),
    down: 0,
    shirt: '#5e2b2b',
    skin: '#d9a06b',
  };
}

// Spawn rivals around the player when a kill step starts.
export function spawnRivals(G, count) {
  const rivals = [];
  for (let i = 0; i < count; i += 1) {
    const a = G.rng.range(0, Math.PI * 2);
    const d = G.rng.range(220, 380);
    let x = G.player.x + Math.cos(a) * d;
    let y = G.player.y + Math.sin(a) * d;
    x = Math.max(60, Math.min(G.city.width - 60, x));
    y = Math.max(60, Math.min(G.city.height - 60, y));
    rivals.push(createRival(G, x, y));
  }
  return rivals;
}

function nearestRival(G) {
  let best = null;
  let bd = 650;
  for (const r of G.rivals) {
    if (r.health <= 0) continue;
    const d = Math.hypot(r.x - G.player.x, r.y - G.player.y);
    if (d < bd) { bd = d; best = r; }
  }
  return best;
}

// Fire one shot. Aim at the nearest rival when there is one; otherwise
// aim where the mouse points (screen centre is straight ahead).
export function playerShoot(G) {
  const p = G.player;
  if (p.dead || G.screen !== 'play') return false;
  if (G.shootCooldown > 0) return false;
  G.shootCooldown = 0.25;
  let angle = p.angle;
  const rival = nearestRival(G);
  if (rival) {
    angle = Math.atan2(rival.y - p.y, rival.x - p.x);
  } else if (G.input && G.input.mouse) {
    const mx = G.input.mouse.x - 640;
    const my = G.input.mouse.y - 400;
    if (Math.hypot(mx, my) > 30) angle = Math.atan2(my, mx);
  }
  p.angle = angle;
  G.bullets.push({
    x: p.x + Math.cos(angle) * 22,
    y: p.y + Math.sin(angle) * 22,
    vx: Math.cos(angle) * 650,
    vy: Math.sin(angle) * 650,
    life: 1.1,
    from: 'player',
    damage: 20,
  });
  if (G.audio) G.audio.shoot();
  return true;
}

// A rival is down: count it only for a kill step that is active now.
export function hurtRival(G, rival, amount) {
  if (rival.health <= 0) return false;
  rival.health -= amount;
  if (rival.health > 0) return false;
  rival.health = 0;
  G.stats.kills = (G.stats.kills || 0) + 1;
  const step = G.missions && G.missions.active ? G.missions.active.step : null;
  if (step && step.type === 'kill') {
    G.missions.kills = (G.missions.kills || 0) + 1;
    G.missions.active.kills = G.missions.kills;
  }
  addHeat(G, HEAT_PER_KILL, 'Rival down');
  return true;
}

function explode(G, x, y, radius, blame) {
  G.effects.push({ kind: 'boom', x, y, radius, t: 0, life: 0.6 });
  if (G.audio) G.audio.explosion();
  const hurt = (tx, ty, amount) => {
    if (Math.hypot(tx - x, ty - y) < radius) return amount;
    return 0;
  };
  const pd = hurt(G.player.x, G.player.y, 40);
  if (pd > 0 && !G.player.car) damagePlayer(G, pd);
  if (pd > 0 && G.player.car) {
    G.player.car.health -= 25;
    G.player.car.hp = G.player.car.health;
  }
  for (const r of G.rivals) {
    if (hurt(r.x, r.y, 60) > 0) hurtRival(G, r, 60);
  }
  for (const cop of G.cops) {
    if (hurt(cop.x, cop.y, 60) > 0) cop.down = 2;
  }
  for (const car of G.cars) {
    if (car.driver === 'player' || car.driver === 'police') continue;
    if (hurt(car.x, car.y, 50) > 0) {
      car.health -= 50;
      car.hp = car.health;
      if (car.health <= 0 && !car.dead) {
        car.dead = true;
        car.health = 0;
        car.hp = 0;
      }
    }
  }
}

export function updateCombat(G, dt) {
  G.shootCooldown = Math.max(0, (G.shootCooldown || 0) - dt);
  const input = G.input || {};
  const firing = !!input.shoot || (input.mouse && input.mouse.down);
  if (firing) playerShoot(G);

  // Move bullets and resolve hits.
  for (let i = G.bullets.length - 1; i >= 0; i -= 1) {
    const b = G.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead) {
      if (b.from === 'player') {
        for (const r of G.rivals) {
          if (r.health > 0 && Math.hypot(r.x - b.x, r.y - b.y) < 40) {
            hurtRival(G, r, b.damage);
            dead = true;
            break;
          }
        }
        if (!dead) {
          for (const cop of G.cops) {
            if (cop.down <= 0 && Math.hypot(cop.x - b.x, cop.y - b.y) < 40) {
              cop.down = 2;
              dead = true;
              break;
            }
          }
        }
      } else {
        if (!G.player.dead && Math.hypot(G.player.x - b.x, G.player.y - b.y) < 40) {
          damagePlayer(G, b.damage);
          dead = true;
        }
      }
    }
    if (!dead) {
      // Bullets stop at buildings.
      const { pointInBuilding } = { pointInBuilding: null };
      void pointInBuilding;
      for (const bd of G.city.buildings) {
        if (b.x >= bd.x && b.x <= bd.x + bd.w && b.y >= bd.y && b.y <= bd.y + bd.h) {
          dead = true;
          break;
        }
      }
    }
    if (dead) G.bullets.splice(i, 1);
  }

  // Rivals walk at the player and shoot back, slowly.
  for (const r of G.rivals) {
    if (r.health <= 0) continue;
    const dx = G.player.x - r.x;
    const dy = G.player.y - r.y;
    const d = Math.hypot(dx, dy);
    if (d > 120) {
      r.angle = Math.atan2(dy, dx);
      r.x += Math.cos(r.angle) * r.speed * dt;
      r.y += Math.sin(r.angle) * r.speed * dt;
    }
    r.shootTimer -= dt;
    if (r.shootTimer <= 0 && d < 420 && !G.player.dead) {
      r.shootTimer = 1.2 + G.rng.range(0, 0.6);
      const a = Math.atan2(dy, dx) + G.rng.range(-0.12, 0.12);
      G.bullets.push({
        x: r.x + Math.cos(a) * 20,
        y: r.y + Math.sin(a) * 20,
        vx: Math.cos(a) * 520,
        vy: Math.sin(a) * 520,
        life: 0.9,
        from: 'rival',
        damage: 3,
      });
      if (G.audio) G.audio.enemyShoot();
    }
  }
  G.rivals = G.rivals.filter((r) => r.health > 0 || r.down > 0);
  G.enemies = G.rivals;

  // Explosions queued by wrecks and the police.
  while (G.explodeQueue.length) {
    const e = G.explodeQueue.shift();
    explode(G, e.x, e.y, e.radius, e.blame);
  }
  for (let i = G.effects.length - 1; i >= 0; i -= 1) {
    G.effects[i].t += dt;
    if (G.effects[i].t >= G.effects[i].life) G.effects.splice(i, 1);
  }
}
