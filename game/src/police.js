// Wanted level and the SBPD: heat rises with crimes, stars follow heat,
// cop cars chase and ram, foot cops chase and arrest, and the heat only
// cools when no cop can see the player.

import { STAR_HEAT, HEAT_DECAY_HIDDEN, HEAT_DECAY_SEEN, PRICES } from './config.js';
import { createCar } from './vehicles.js';
import { resolveCircle, randomRoadPoint } from './world.js';
import { damagePlayer, addMoney } from './player.js';

export function createWanted() {
  return { stars: 0, heat: 0, seen: 0, bustTimer: 0, flash: 0 };
}

export function starsForHeat(heat) {
  let stars = 0;
  for (let i = 0; i < STAR_HEAT.length; i += 1) {
    if (heat >= STAR_HEAT[i]) stars = i;
  }
  return stars;
}

// Raise the heat; the star count follows, and the player is told why.
export function addHeat(G, amount, why) {
  const wanted = G.wanted;
  wanted.heat = Math.min(100, wanted.heat + amount);
  const before = wanted.stars;
  wanted.stars = starsForHeat(wanted.heat);
  if (wanted.stars > before && why) {
    G.message(`${'★'.repeat(wanted.stars)} Wanted — ${why}`, '#ff8a7a');
  }
}

// Is any cop close enough to see the player right now?
function playerSeen(G) {
  const px = G.player.x;
  const py = G.player.y;
  for (const car of G.cars) {
    if (car.driver !== 'police' || car.dead) continue;
    if (Math.hypot(car.x - px, car.y - py) < 620) return true;
  }
  for (const cop of G.cops) {
    if (cop.down > 0) continue;
    if (Math.hypot(cop.x - px, cop.y - py) < 420) return true;
  }
  return false;
}

function spawnCopCar(G) {
  const p = randomRoadPoint(G.rng, G.city);
  const d = Math.hypot(p.x - G.player.x, p.y - G.player.y);
  if (d < 500 || d > 1300) return;
  const angle = Math.atan2(G.player.y - p.y, G.player.x - p.x);
  const car = createCar(G.city, G.rng, 'police', p.x, p.y, angle, 'police');
  car.siren = true;
  car.speed = 260;
  G.cars.push(car);
}

function spawnFootCop(G) {
  const a = G.rng.range(0, Math.PI * 2);
  const d = G.rng.range(320, 520);
  const x = G.player.x + Math.cos(a) * d;
  const y = G.player.y + Math.sin(a) * d;
  if (x < 80 || x > G.city.width - 80 || y < 80 || y > G.city.height - 80) return;
  G.cops.push({
    x, y, angle: 0, speed: 0, health: 60, down: 0, punchTimer: 0,
    shirt: '#2b3a55', skin: '#d9a06b', state: 'chase',
  });
}

function steerCopCar(G, car, dt) {
  const player = G.player;
  // Aim slightly ahead of the player, then ram.
  const lead = 0.5;
  const tx = player.x + Math.cos(player.angle) * (player.car ? player.speed * lead : 0);
  const ty = player.y + Math.sin(player.angle) * (player.car ? player.speed * lead : 0);
  const want = Math.atan2(ty - car.y, tx - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.steer = Math.max(-1, Math.min(1, -diff * 2.4));
  car.throttle = Math.abs(diff) > 1.4 ? 0.3 : 1;
  car.sirenPhase += dt * 10;
  // A cop car that touches the player's car damages it and slows both down.
  if (player.car && !player.car.dead) {
    const d = Math.hypot(car.x - player.car.x, car.y - player.car.y);
    if (d < 44) {
      player.car.health -= 14 * dt;
      player.car.hp = player.car.health;
      if (player.car.health <= 0) {
        player.car.health = 0;
        player.car.hp = 0;
        player.car.dead = true;
        G.explodeQueue.push({ x: player.car.x, y: player.car.y, radius: 90, blame: false });
        player.car = null;
        player.onFoot = true;
      }
    }
  }
}

function updateFootCop(G, cop, dt) {
  const player = G.player;
  if (cop.down > 0) {
    cop.down -= dt;
    return;
  }
  const dx = player.x - cop.x;
  const dy = player.y - cop.y;
  const dist = Math.hypot(dx, dy);
  const want = Math.atan2(dy, dx);
  let diff = want - cop.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  cop.angle += Math.max(-4 * dt, Math.min(4 * dt, diff));
  const speed = dist > 300 ? 0 : 120; // cops only run when close; they arrive by car
  const nx = cop.x + Math.cos(cop.angle) * speed * dt;
  const ny = cop.y + Math.sin(cop.angle) * speed * dt;
  const fixed = resolveCircle(G.city, nx, ny, 11);
  cop.x = fixed.x;
  cop.y = fixed.y;
  cop.punchTimer = Math.max(0, cop.punchTimer - dt);
  if (dist < 30 && !player.car && !player.dead) {
    // On foot and caught: the arrest timer runs while a cop holds the player.
    G.wanted.bustTimer += dt;
    if (cop.punchTimer <= 0) {
      cop.punchTimer = 0.9;
      damagePlayer(G, 6);
      if (G.audio) G.audio.punch();
    }
  }
}

export function updatePolice(G, dt) {
  const wanted = G.wanted;
  wanted.flash += dt;
  // An evade step holds the heat at its floor so the chase can be survived.
  const step = G.missions && G.missions.active ? G.missions.active.step : null;
  if (wanted.stars === 0) {
    // No heat: the few cops on patrol drift away.
    for (let i = G.cars.length - 1; i >= 0; i -= 1) {
      const car = G.cars[i];
      if (car.driver === 'police' && Math.hypot(car.x - G.player.x, car.y - G.player.y) > 900) {
        G.cars.splice(i, 1);
      }
    }
    G.cops.length = 0;
    wanted.bustTimer = 0;
    return;
  }

  const seen = playerSeen(G);
  wanted.seen = seen ? wanted.seen + dt : 0;
  // Heat cools when hidden, barely when seen.
  wanted.heat = Math.max(0, wanted.heat - (seen ? HEAT_DECAY_SEEN : HEAT_DECAY_HIDDEN) * dt);
  if (step && step.type === 'evade' && step.stars) {
    const floor = STAR_HEAT[Math.min(step.stars, STAR_HEAT.length - 1)];
    if (wanted.heat < floor) wanted.heat = floor;
  }
  const stars = starsForHeat(wanted.heat);
  if (stars < wanted.stars) {
    wanted.stars = stars;
    if (stars === 0) G.message('You lost the cops.', '#8fe388');
  } else {
    wanted.stars = stars;
  }

  // Reinforcements scale with stars.
  const wantCars = Math.min(5, wanted.stars + 1);
  const wantFoot = wanted.stars >= 3 ? wanted.stars - 2 : 0;
  let copCars = 0;
  for (const car of G.cars) {
    if (car.driver === 'police' && !car.dead) copCars += 1;
  }
  if (copCars < wantCars && G.rng.chance(dt * 1.2)) spawnCopCar(G);
  const footUp = G.cops.filter((c) => c.down <= 0).length;
  if (footUp < wantFoot && !G.player.car && G.rng.chance(dt * 0.8)) spawnFootCop(G);

  for (const car of G.cars) {
    if (car.driver === 'police' && !car.dead) steerCopCar(G, car, dt);
  }
  for (const cop of G.cops) updateFootCop(G, cop, dt);

  // Busted: held by a cop on foot, or boxed in while stopped.
  if (!G.player.car && wanted.bustTimer > 4.0) {
    wanted.bustTimer = 0;
    bustPlayer(G);
  } else if (G.player.car && Math.abs(G.player.car.speed) < 12) {
    let near = 0;
    for (const car of G.cars) {
      if (car.driver === 'police' && !car.dead && Math.hypot(car.x - G.player.x, car.y - G.player.y) < 90) near += 1;
    }
    if (near >= 2) {
      wanted.bustTimer += dt;
      if (wanted.bustTimer > 6.0) {
        wanted.bustTimer = 0;
        bustPlayer(G);
      }
    } else {
      wanted.bustTimer = Math.max(0, wanted.bustTimer - dt);
    }
  } else if (G.player.car) {
    wanted.bustTimer = Math.max(0, wanted.bustTimer - dt);
  }
  if (G.player.car) wanted.bustTimer = Math.max(0, wanted.bustTimer - dt * 0.5);
}

export function bustPlayer(G) {
  const fine = Math.min(G.player.money, PRICES.fine);
  addMoney(G, -fine);
  G.player.money = Math.max(0, G.player.money);
  G.wanted.stars = 0;
  G.wanted.heat = 0;
  G.wanted.bustTimer = 0;
  G.player.health = 100;
  G.player.hp = 100;
  G.player.armor = 0;
  // Drop the player at the police station, on foot.
  const station = G.city.spots.police;
  if (G.player.car) {
    G.player.car.driver = null;
    G.player.car = null;
  }
  G.player.onFoot = true;
  G.player.x = station.x;
  G.player.y = station.y + 60;
  for (let i = G.cars.length - 1; i >= 0; i -= 1) {
    if (G.cars[i].driver === 'police') G.cars.splice(i, 1);
  }
  G.cops.length = 0;
  if (G.audio) G.audio.busted();
  G.setScreen('busted', { fine });
  G.busts = (G.busts || 0) + 1;
}

// Wasted: the player died. Respawn at the hospital, fined, wanted cleared.
export function wastePlayer(G) {
  const fine = Math.min(G.player.money, PRICES.fine);
  addMoney(G, -fine);
  G.player.money = Math.max(0, G.player.money);
  G.wanted.stars = 0;
  G.wanted.heat = 0;
  const hospital = G.city.spots.hospital;
  if (G.player.car) {
    G.player.car.driver = null;
    G.player.car = null;
  }
  G.player.onFoot = true;
  G.player.x = hospital.x;
  G.player.y = hospital.y + 60;
  G.player.health = 100;
  G.player.hp = 100;
  G.player.armor = 0;
  G.player.dead = false;
  for (let i = G.cars.length - 1; i >= 0; i -= 1) {
    if (G.cars[i].driver === 'police') G.cars.splice(i, 1);
  }
  G.cops.length = 0;
  if (G.audio) G.audio.busted();
  G.setScreen('wasted', { fine });
}

// Spray & Save: pay per star to repaint and clear the wanted level.
export function trySprayShop(G) {
  const garage = G.city.spots.garage;
  const d = Math.hypot(G.player.x - garage.x, G.player.y - garage.y);
  if (d > 70) return false;
  if (G.wanted.stars === 0) {
    G.message('No heat to lose. Your ride already shines.', '#e8e2c8');
    return true;
  }
  const cost = PRICES.sprayPerStar * G.wanted.stars;
  if (G.player.money < cost) {
    G.message(`Spray & Save wants $${cost} — you're short.`, '#ff8a7a');
    return true;
  }
  addMoney(G, -cost);
  G.wanted.stars = 0;
  G.wanted.heat = 0;
  G.wanted.bustTimer = 0;
  if (G.player.car) {
    G.player.car.health = 100;
    G.player.car.hp = 100;
    G.player.car.color = G.rng.pick(['#c94f43', '#3f6fb5', '#e8c53a', '#2e2e33', '#7fb069', '#d97b29']);
  }
  for (let i = G.cars.length - 1; i >= 0; i -= 1) {
    if (G.cars[i].driver === 'police') G.cars.splice(i, 1);
  }
  G.cops.length = 0;
  G.message(`Fresh paint, clean plate. -$${cost}`, '#8fe388');
  if (G.audio) G.audio.jingle();
  return true;
}
