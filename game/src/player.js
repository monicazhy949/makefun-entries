// Solmar Bay: the player, on foot and behind the wheel.
// Driving reads an autopilot first (a test driver or a scripted helper),
// then the keyboard. A walker autopilot never reaches the car controls:
// feeding its {mx, my} into the throttle would NaN the car's angle.
import {
  PLAYER_WALK_SPEED,
  PLAYER_RUN_SPEED,
  CAR_MAX_SPEED,
  CAR_REVERSE_SPEED,
} from './config.js';
import { clamp } from './random.js';

function enterCar(G, car) {
  car.driver = 'player';
  car.health = 99999;
  car.parked = false;
  G.player.car = car;
  G.player.x = car.x;
  G.player.y = car.y;
}

export function tryEnterCar(G) {
  if (G.player.car) return false;
  // On a steal step the target car is the objective: take it when in reach,
  // even if a passing traffic car happens to be closer at that moment.
  const a = G.missions.active;
  if (a) {
    const step = a.def.steps[a.step];
    if (step && step.type === 'steal' && a.data.car && !a.data.car.dead) {
      const d = Math.hypot(a.data.car.x - G.player.x, a.data.car.y - G.player.y);
      if (d < 60) {
        enterCar(G, a.data.car);
        return true;
      }
    }
  }
  let best = null;
  let bestD = 60;
  for (const car of G.cars) {
    if (car.dead || car.driver === 'police') continue;
    const d = Math.hypot(car.x - G.player.x, car.y - G.player.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  if (!best) return false;
  enterCar(G, best);
  return true;
}

export function exitCar(G) {
  const car = G.player.car;
  if (!car) return;
  car.driver = null;
  car.parked = true;
  car.speed = 0;
  G.player.car = null;
  G.player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
  G.player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
  G.player.angle = car.angle;
}

function driveCar(G, car, ctrl, dt) {
  let throttle = 0;
  let steer = 0;
  let handbrake = false;
  if (ctrl) {
    if (typeof ctrl.throttle === 'number') throttle = ctrl.throttle;
    if (typeof ctrl.steer === 'number') steer = ctrl.steer;
    if (typeof ctrl.handbrake === 'boolean') handbrake = ctrl.handbrake;
  } else if (G.input) {
    if (G.input.throttle) throttle = G.input.throttle();
    if (G.input.steer) steer = G.input.steer();
    if (G.input.handbrake) handbrake = G.input.handbrake();
  }
  if (!Number.isFinite(throttle)) throttle = 0;
  if (!Number.isFinite(steer)) steer = 0;
  throttle = clamp(throttle, -1, 1);
  steer = clamp(steer, -1, 1);
  const target = handbrake
    ? 0
    : throttle >= 0
      ? throttle * CAR_MAX_SPEED
      : throttle * CAR_REVERSE_SPEED;
  const rate = handbrake ? 6 : 1.9;
  car.speed += (target - car.speed) * Math.min(1, rate * dt);
  if (Math.abs(car.speed) < 2 && throttle === 0) car.speed = 0;
  const speedAbs = Math.abs(car.speed);
  const turn = 2.6 * (1 - Math.min(speedAbs / CAR_MAX_SPEED, 1) * 0.45);
  car.angle += steer * turn * dt * (car.speed >= 0 ? 1 : -1);
  while (car.angle > Math.PI) car.angle -= Math.PI * 2;
  while (car.angle < -Math.PI) car.angle += Math.PI * 2;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = clamp(car.x, 40, G.city.w - 40);
  car.y = clamp(car.y, 40, G.city.h - 40);
  // Shove traffic aside; a scrape costs the other car, never the player's.
  for (const other of G.cars) {
    if (other === car || other.dead || other.driver === 'player') continue;
    const d = Math.hypot(other.x - car.x, other.y - car.y);
    if (d < 48 && d > 0.01) {
      const push = (48 - d) * 0.5;
      other.x += ((other.x - car.x) / d) * push;
      other.y += ((other.y - car.y) / d) * push;
      if (other.driver === 'traffic') {
        other.health -= 2;
        other.speed = Math.max(40, other.speed - 30);
        if (other.health <= 0) {
          other.dead = true;
          other.speed = 0;
        }
      }
    }
  }
}

function walkPlayer(G, ctrl, dt) {
  const p = G.player;
  let mx = 0;
  let my = 0;
  if (ctrl && typeof ctrl.mx === 'number' && typeof ctrl.my === 'number') {
    mx = ctrl.mx;
    my = ctrl.my;
  } else if (G.input && G.input.move) {
    const m = G.input.move();
    mx = m.x;
    my = m.y;
  }
  if (!Number.isFinite(mx)) mx = 0;
  if (!Number.isFinite(my)) my = 0;
  const len = Math.hypot(mx, my);
  if (len > 0.01) {
    mx /= Math.max(1, len);
    my /= Math.max(1, len);
    const run = (ctrl && ctrl.run) || (G.input && G.input.run && G.input.run());
    const speed = run ? PLAYER_RUN_SPEED : PLAYER_WALK_SPEED;
    p.x += mx * speed * dt;
    p.y += my * speed * dt;
    p.angle = Math.atan2(my, mx);
  }
  p.x = clamp(p.x, 40, G.city.w - 40);
  p.y = clamp(p.y, 40, G.city.h - 40);
}

export function updatePlayer(G, dt) {
  const p = G.player;
  const ctrl = G.autopilot ? G.autopilot(G) : null;
  if (p.car) {
    driveCar(G, p.car, ctrl, dt);
    p.x = p.car.x;
    p.y = p.car.y;
    p.angle = p.car.angle;
  } else {
    walkPlayer(G, ctrl, dt);
  }
  // Slow recovery after taking a hit.
  if (p.health < 100 && G.time - p.lastHurtT > 6) {
    p.health = Math.min(100, p.health + 3 * dt);
  }
}
