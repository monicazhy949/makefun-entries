// Milo Reyes on foot and behind the wheel: walking, running, getting in and
// out of cars, health and armour, money and weapons.
import { WEAPONS } from './config.js';
import { resolveCircle } from './world.js';
import { driveCar } from './vehicles.js';

const WALK_SPEED = 150;
const RUN_SPEED = 250;

export function createPlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2,
    vx: 0, vy: 0,
    speed: 0,
    health: 100,
    armor: 0,
    money: 250,
    weapon: 'pistol',
    ammo: { pistol: 48, smg: 0 },
    car: null,
    aimAngle: -Math.PI / 2,
    fireCooldown: 0,
    punchCooldown: 0,
    dead: false,
    moving: false,
  };
}

function nearestCar(G, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of G.cars) {
    if (car.dead) continue;
    const d = Math.hypot(car.x - G.player.x, car.y - G.player.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

export function tryEnterCar(G) {
  const player = G.player;
  if (player.car) {
    exitCar(G);
    return;
  }
  const car = nearestCar(G, 60);
  if (!car) return;
  const stolen = car.driver === 'traffic' || car.driver === 'police';
  if (car.driver === 'traffic' || car.driver === 'police') {
    // Yank the driver out: a crime the cops notice.
    G.addHeat(stolen ? 14 : 0, 'car theft');
    G.stats.carsStolen += 1;
    G.message(stolen ? 'Car stolen!' : 'Car taken!', '#ffd76a');
    G.audio.horn();
  }
  car.driver = 'player';
  car.throttle = 0;
  car.steer = 0;
  player.car = car;
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
}

export function exitCar(G) {
  const player = G.player;
  const car = player.car;
  if (!car) return;
  car.driver = null;
  const side = Math.PI / 2;
  player.x = car.x + Math.cos(car.angle + side) * 34;
  player.y = car.y + Math.sin(car.angle + side) * 34;
  const fixed = resolveCircle(G.city, player.x, player.y, 12);
  player.x = fixed.x;
  player.y = fixed.y;
  player.car = null;
  player.speed = 0;
}

export function damagePlayer(G, amount) {
  const player = G.player;
  if (player.dead) return;
  let rest = amount;
  if (player.armor > 0) {
    const absorbed = Math.min(player.armor, rest * 0.6);
    player.armor -= absorbed;
    rest -= absorbed;
  }
  player.health -= rest;
  if (player.health <= 0) {
    player.health = 0;
    player.dead = true;
  }
}

export function healPlayer(G, amount) {
  G.player.health = Math.min(100, G.player.health + amount);
}

export function addMoney(G, amount, why) {
  G.player.money += amount;
  G.stats.moneyEarned += Math.max(0, amount);
  if (why) G.message(`${amount >= 0 ? '+' : ''}$${amount}  ${why}`, amount >= 0 ? '#8fe388' : '#ff8a7a');
}

export function updatePlayer(G, dt) {
  const player = G.player;
  const input = G.input;
  if (player.dead) return;
  player.fireCooldown = Math.max(0, player.fireCooldown - dt);
  player.punchCooldown = Math.max(0, player.punchCooldown - dt);

  if (player.car) {
    const car = player.car;
    if (car.dead) {
      player.car = null;
      player.x = car.x;
      player.y = car.y;
      return;
    }
    // Screenshot staging drives through G.autopilot instead of the keyboard.
    const drive = G.autopilot ? G.autopilot(G) : {
      throttle: input.throttle(),
      steer: input.steer(),
      handbrake: input.handbrake(),
    };
    driveCar(G, car, dt, drive.throttle, drive.steer, drive.handbrake);
    player.x = car.x;
    player.y = car.y;
    player.angle = car.angle;
    player.speed = car.speed;
    player.moving = Math.abs(car.speed) > 10;
    // Aim follows the car; the camera looks ahead of the drive.
    player.aimAngle = car.angle;
    return;
  }

  // On foot: WASD/arrows move, Shift runs, the mouse aims.
  const walk = G.autopilot ? G.autopilot(G) : null;
  const mx = walk ? walk.mx : input.steer();
  const my = walk ? walk.my : -input.throttle();
  const len = Math.hypot(mx, my);
  const top = input.run() ? RUN_SPEED : WALK_SPEED;
  if (len > 0.01) {
    const nx = mx / len;
    const ny = my / len;
    player.vx += (nx * top - player.vx) * Math.min(1, dt * 10);
    player.vy += (ny * top - player.vy) * Math.min(1, dt * 10);
    player.moving = true;
  } else {
    player.vx *= Math.max(0, 1 - dt * 10);
    player.vy *= Math.max(0, 1 - dt * 10);
    player.moving = false;
  }
  player.speed = Math.hypot(player.vx, player.vy);
  const nx = player.x + player.vx * dt;
  const ny = player.y + player.vy * dt;
  const fixed = resolveCircle(G.city, nx, ny, 12);
  player.x = fixed.x;
  player.y = fixed.y;
  // Face the mouse when aiming with a gun, else face the walk direction.
  // A staged shot may fix the aim instead.
  if (G.scriptedAim !== undefined) {
    player.aimAngle = G.scriptedAim;
    player.angle = G.scriptedAim;
    return;
  }
  const aim = G.screenToWorld ? G.screenToWorld(input.mouse.x, input.mouse.y) : null;
  if (aim && player.weapon !== 'fists') {
    player.aimAngle = Math.atan2(aim.y - player.y, aim.x - player.x);
    player.angle = player.aimAngle;
  } else if (player.moving) {
    player.angle = Math.atan2(player.vy, player.vx);
    player.aimAngle = player.angle;
  }
}

export function weaponDef(player) {
  return WEAPONS[player.weapon] || WEAPONS.fists;
}
