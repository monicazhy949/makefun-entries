// Combat: guns and fists, bullets that hit cars, cops, rivals and walls,
// explosions, and the pickups scattered around the city (cash, health, armour,
// ammo and bribes). Rival gang members are simple on-foot shooters.
import { WEAPONS } from './config.js';
import { solidAt } from './world.js';
import { damageCar, spark } from './vehicles.js';
import { knockDown, scarePeds } from './pedestrians.js';
import { damagePlayer } from './player.js';

const BULLET_SPEED = 900;

export function shoot(G, from, angle, weaponKey) {
  const def = WEAPONS[weaponKey] || WEAPONS.pistol;
  const px = from.x + Math.cos(angle) * 18;
  const py = from.y + Math.sin(angle) * 18;
  G.bullets.push({
    x: px, y: py, angle,
    speed: BULLET_SPEED,
    life: def.range / BULLET_SPEED,
    damage: def.damage,
    from: from === G.player ? 'player' : (from.cop ? 'cop' : 'rival'),
  });
  G.particles.push({
    x: px, y: py, vx: 0, vy: 0, life: 0.06, maxLife: 0.06, size: 9,
    color: '#ffe9a0', kind: 'flash',
  });
  G.audio.shot();
  scarePeds(G, px, py, 260);
  if (from === G.player) G.addHeat(2, '');
}

/** The player's trigger: respects fire rate, ammo and the current weapon. */
export function playerShoot(G) {
  const player = G.player;
  if (player.dead || player.car) return;
  const def = WEAPONS[player.weapon] || WEAPONS.fists;
  if (player.weapon === 'fists') {
    if (player.punchCooldown > 0) return;
    player.punchCooldown = 1 / def.rate;
    punch(G, player, player.aimAngle);
    return;
  }
  if (player.fireCooldown > 0) return;
  const pool = def.ammo;
  if (player.ammo[pool] <= 0) {
    G.message(`Out of ${def.name} ammo — visit Harbor Arms.`, '#ff8a7a');
    player.fireCooldown = 0.5;
    return;
  }
  player.ammo[pool] -= 1;
  player.fireCooldown = 1 / def.rate;
  shoot(G, player, player.aimAngle, player.weapon);
}

function punch(G, from, angle) {
  G.audio.punch();
  const px = from.x + Math.cos(angle) * 26;
  const py = from.y + Math.sin(angle) * 26;
  // Rivals and cops first, then pedestrians.
  for (const rival of G.rivals) {
    if (rival.down > 0) continue;
    if (Math.hypot(rival.x - px, rival.y - py) < 30) {
      hurtRival(G, rival, WEAPONS.fists.damage, angle);
      return;
    }
  }
  for (const cop of G.cops) {
    if (cop.down > 0) continue;
    if (Math.hypot(cop.x - px, cop.y - py) < 30) {
      cop.health -= WEAPONS.fists.damage;
      if (cop.health <= 0) {
        cop.down = 6;
        G.addHeat(16, 'cop down');
      }
      return;
    }
  }
  for (const ped of G.peds) {
    if (ped.state === 'down') continue;
    if (Math.hypot(ped.x - px, ped.y - py) < 30) {
      knockDown(G, ped, true);
      return;
    }
  }
}

export function hurtRival(G, rival, damage, angle) {
  rival.health -= damage;
  rival.x += Math.cos(angle) * 6;
  rival.y += Math.sin(angle) * 6;
  if (rival.health <= 0 && rival.down <= 0) {
    rival.down = 999;
    G.stats.kills += 1;
    G.message('Rival down.', '#ffd76a');
    // Count the kill for any mission whose active step is a kill step,
    // not just Dockside Deal — Warehouse Raid has one too.
    const step = G.missions.active && G.missions.active.def.steps[G.missions.active.step];
    if (step && step.type === 'kill') {
      G.missions.kills = (G.missions.kills || 0) + 1;
    }
    // Rivals drop a little cash.
    spawnPickup(G, 'cash', rival.x, rival.y, 40);
  }
}

export function explode(G, x, y, radius, blame = false) {
  G.audio.explosion();
  if (blame) G.addHeat(8, 'explosion');
  scarePeds(G, x, y, 420);
  for (let i = 0; i < 26; i += 1) {
    const a = G.rng.range(0, Math.PI * 2);
    const s = G.rng.range(40, 320);
    G.particles.push({
      x, y,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: G.rng.range(0.3, 0.8), maxLife: 0.8, size: G.rng.range(4, 11),
      color: G.rng.pick(['#ff7a2a', '#ffb02a', '#ff4a2a', '#5a5a5a']), kind: 'fire',
    });
  }
  for (const car of G.cars) {
    if (car.dead) continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < radius) damageCar(G, car, 90 * (1 - d / (radius * 1.4)));
  }
  for (const ped of G.peds) {
    if (Math.hypot(ped.x - x, ped.y - y) < radius * 0.8) knockDown(G, ped, blame);
  }
  for (const rival of G.rivals) {
    if (rival.down <= 0 && Math.hypot(rival.x - x, rival.y - y) < radius) {
      hurtRival(G, rival, 80, Math.atan2(rival.y - y, rival.x - x));
    }
  }
  for (const cop of G.cops) {
    if (cop.down <= 0 && Math.hypot(cop.x - x, cop.y - y) < radius) {
      cop.health -= 80;
      if (cop.health <= 0) cop.down = 6;
    }
  }
  const pd = Math.hypot(G.player.x - x, G.player.y - y);
  if (pd < radius && !G.player.dead) damagePlayer(G, 55 * (1 - pd / (radius * 1.4)));
}

export function spawnPickup(G, kind, x, y, value) {
  G.pickups.push({ kind, x, y, value: value || 0, bob: G.rng.range(0, Math.PI * 2) });
}

export function spawnRival(G, x, y) {
  G.rivals.push({
    x, y, angle: 0, health: 50, down: 0, fireTimer: G.rng.range(0.4, 1.2),
    shirt: '#7a2a2a', skin: '#d9a06b', cop: false,
  });
}

function updateRival(G, rival, dt) {
  if (rival.down > 0) return;
  const player = G.player;
  const dx = player.x - rival.x;
  const dy = player.y - rival.y;
  const dist = Math.hypot(dx, dy);
  rival.angle = Math.atan2(dy, dx);
  rival.fireTimer -= dt;
  if (dist < 380 && rival.fireTimer <= 0 && !player.dead) {
    rival.fireTimer = G.rng.range(0.7, 1.4);
    const spread = G.rng.range(-0.14, 0.14);
    shoot(G, rival, rival.angle + spread, 'pistol');
  }
  // Rivals hold their ground and strafe a little.
  if (dist > 240) {
    rival.x += Math.cos(rival.angle) * 70 * dt;
    rival.y += Math.sin(rival.angle) * 70 * dt;
  }
}

function hitCar(G, bullet) {
  for (const car of G.cars) {
    if (car.dead) continue;
    // Skip the shooter's own car.
    if (bullet.from === 'player' && G.player.car === car) continue;
    const dx = bullet.x - car.x;
    const dy = bullet.y - car.y;
    // Rotate into the car's frame: a cheap oriented-box test.
    const c = Math.cos(-car.angle);
    const s = Math.sin(-car.angle);
    const lx = dx * c - dy * s;
    const ly = dx * s + dy * c;
    if (Math.abs(lx) < car.w / 2 && Math.abs(ly) < car.h / 2) {
      damageCar(G, car, bullet.damage);
      spark(G, bullet.x, bullet.y);
      return true;
    }
  }
  return false;
}

export function updateCombat(G, dt) {
  // Bullets.
  for (let i = G.bullets.length - 1; i >= 0; i -= 1) {
    const b = G.bullets[i];
    b.x += Math.cos(b.angle) * b.speed * dt;
    b.y += Math.sin(b.angle) * b.speed * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead && solidAt(G.city, b.x, b.y, 0)) {
      spark(G, b.x, b.y);
      dead = true;
    }
    if (!dead && hitCar(G, b)) dead = true;
    if (!dead && b.from !== 'player') {
      const pd = Math.hypot(G.player.x - b.x, G.player.y - b.y);
      if (pd < 14 && !G.player.dead) {
        damagePlayer(G, b.damage);
        dead = true;
      }
    }
    if (!dead && b.from === 'player') {
      for (const rival of G.rivals) {
        if (rival.down > 0) continue;
        if (Math.hypot(rival.x - b.x, rival.y - b.y) < 14) {
          hurtRival(G, rival, b.damage, b.angle);
          dead = true;
          break;
        }
      }
      if (!dead) {
        for (const cop of G.cops) {
          if (cop.down > 0) continue;
          if (Math.hypot(cop.x - b.x, cop.y - b.y) < 14) {
            cop.health -= b.damage;
            if (cop.health <= 0) {
              cop.down = 6;
              G.addHeat(16, 'cop down');
            }
            dead = true;
            break;
          }
        }
      }
      if (!dead) {
        for (const ped of G.peds) {
          if (ped.state === 'down') continue;
          if (Math.hypot(ped.x - b.x, ped.y - b.y) < 12) {
            knockDown(G, ped, true);
            dead = true;
            break;
          }
        }
      }
    }
    if (dead) G.bullets.splice(i, 1);
  }
  // Rivals.
  for (const rival of G.rivals) updateRival(G, rival, dt);
  // Pickups: bob, and the player collects them by walking or driving over.
  for (let i = G.pickups.length - 1; i >= 0; i -= 1) {
    const p = G.pickups[i];
    p.bob += dt * 3;
    if (Math.hypot(G.player.x - p.x, G.player.y - p.y) < 26) {
      G.pickups.splice(i, 1);
      collectPickup(G, p);
    }
  }
  // Explosion queue (cars that died this frame).
  while (G.explodeQueue.length > 0) {
    const e = G.explodeQueue.shift();
    explode(G, e.x, e.y, e.radius, e.blame);
  }
  // Particles age out.
  for (let i = G.particles.length - 1; i >= 0; i -= 1) {
    const p = G.particles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.max(0, 1 - dt * 2);
    p.vy *= Math.max(0, 1 - dt * 2);
    if (p.life <= 0) G.particles.splice(i, 1);
  }
  for (let i = G.skids.length - 1; i >= 0; i -= 1) {
    G.skids[i].life -= dt;
    if (G.skids[i].life <= 0) G.skids.splice(i, 1);
  }
}

function collectPickup(G, p) {
  const player = G.player;
  G.audio.pickup();
  if (p.kind === 'cash') {
    player.money += p.value;
    G.message(`+$${p.value}`, '#8fe388');
  } else if (p.kind === 'health') {
    player.health = Math.min(100, player.health + 50);
    G.message('Health restored', '#8fe388');
  } else if (p.kind === 'armor') {
    player.armor = Math.min(100, player.armor + 50);
    G.message('Armour +50', '#8fb8e8');
  } else if (p.kind === 'ammo') {
    player.ammo.pistol += 24;
    player.ammo.smg += 30;
    G.message('Ammo restocked', '#ffd76a');
  } else if (p.kind === 'bribe') {
    G.wanted.heat = Math.max(0, G.wanted.heat - 30);
    G.wanted.stars = Math.max(0, G.wanted.stars - 1);
    G.message('Bribe paid — one star cleared', '#8fb8e8');
  } else if (p.kind === 'case') {
    G.missions.hasCase = true;
    G.message('You have the case.', '#ffd76a');
  }
}
