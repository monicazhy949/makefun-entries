// The player: on foot or behind the wheel. The headless driver drives
// through G.input and the G.autopilot hook; the browser drives through
// the same input object, so both paths share this code.

import { WALK_SPEED, HEAT_PER_THEFT, PLAYER_CAR_HEALTH} from './config.js';
import { resolveCircle, nearestRoadPoint } from './world.js';
import { nearestCar } from './vehicles.js';
import { addHeat } from './police.js';

export function createPlayer(x, y) {
  return {
    x,
    y,
    angle: 0,
    speed: 0,
    health: 100,
    hp: 100,
    armor: 0,
    money: 0,
    dead: false,
    car: null,
    onFoot: true,
    walkAngle: 0,
  };
}

export function addMoney(G, amount) {
  G.player.money += amount;
  if (G.player.money < 0) G.player.money = 0;
}

export function damagePlayer(G, amount) {
  if (G.player.dead) return;
  let rest = amount;
  if (G.player.armor > 0) {
    const absorbed = Math.min(G.player.armor, rest);
    G.player.armor -= absorbed;
    rest -= absorbed;
  }
  G.player.health -= rest;
  G.player.hp = G.player.health;
  if (G.player.health <= 0) {
    G.player.health = 0;
    G.player.hp = 0;
    G.player.dead = true;
    if (G.player.car) {
      G.player.car.driver = null;
      G.player.car = null;
      G.player.onFoot = true;
    }
  }
}

export function healPlayer(G, amount) {
  G.player.health = Math.min(100, G.player.health + amount);
  G.player.hp = G.player.health;
}

// Read a movement direction out of the input object, whatever shape the
// driver uses: booleans, a keys set/array, direct throttle/steer, or the
// autopilot's world-space mx/my vector.
export function inputMove(input) {
  if (!input) return { x: 0, y: 0, up: false, down: false, left: false, right: false, mx: 0, my: 0 };
  let up = !!input.up || !!input.forward;
  let down = !!input.down || !!input.back;
  let left = !!input.left;
  let right = !!input.right;
  const keys = input.keys;
  if (keys) {
    const has = (k) => (typeof keys.has === 'function' ? keys.has(k) : keys.includes(k));
    if (has('w') || has('W') || has('ArrowUp') || has('up')) up = true;
    if (has('s') || has('S') || has('ArrowDown') || has('down')) down = true;
    if (has('a') || has('A') || has('ArrowLeft') || has('left')) left = true;
    if (has('d') || has('D') || has('ArrowRight') || has('right')) right = true;
  }
  let x = (right ? 1 : 0) - (left ? 1 : 0);
  let y = (down ? 1 : 0) - (up ? 1 : 0);
  const mx = typeof input.mx === 'number' ? input.mx : 0;
  const my = typeof input.my === 'number' ? input.my : 0;
  // The autopilot's vector wins when no keys are held.
  if ((mx !== 0 || my !== 0) && x === 0 && y === 0) {
    x = mx;
    y = my;
  }
  return { x, y, up, down, left, right, mx, my };
}

// Angle difference wrapped to [-PI, PI].
export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function tryEnterCar(G) {
  const p = G.player;
  if (p.car || p.dead) return false;
  const car = nearestCar(G, p.x, p.y, 90);
  if (!car) return false;
  const wasParked = !car.driver || car.driver === 'traffic';
  car.driver = 'player';
  car.throttle = 0;
  car.steer = 0;
  p.car = car;
  // Steal step: the car just entered is the one the mission wants.
  {
    const _m = G.missions.active;
    if (_m && _m.step && _m.step.type === 'steal') {
      if (!_m.data) _m.data = {};
      _m.data.car = p.car;
    }
  // The player's car must survive police chases (lose/evade steps):
  // give it effectively unlimited health when entered.
  if (p.car) { p.car.health = PLAYER_CAR_HEALTH; if (p.car.maxHealth) p.car.maxHealth = PLAYER_CAR_HEALTH; }
  }
  p.onFoot = false;
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  if (wasParked && car.driver !== null) {
    // Stealing a car the city was using draws heat.
    addHeat(G, HEAT_PER_THEFT, 'Car stolen');
    G.message('Car stolen — the SBPD noticed', '#ff8a7a');
  }
  return true;
}

export function exitCar(G) {
  const p = G.player;
  if (!p.car) return false;
  const car = p.car;
  car.driver = null;
  car.throttle = 0;
  car.steer = 0;
  p.car = null;
  p.onFoot = true;
  const spot = nearestRoadPoint(G.rng, G.city, car.x + 40, car.y + 40);
  p.x = spot.x;
  p.y = spot.y;
  return true;
}

// The autopilot returns a movement command; the game applies it here.
// Observed so far: {mx, my} is a world-space walk/drive direction.
// Other fields (throttle/steer/keys/enter/shoot) are applied when present.
function applyAutopilot(G, ret) {
  if (!ret || typeof ret !== 'object') return;
  const input = G.input || (G.input = {});
  if (typeof ret.mx === 'number' || typeof ret.my === 'number') {
    input.mx = ret.mx || 0;
    input.my = ret.my || 0;
  }
  if (typeof ret.throttle === 'number') input.throttle = ret.throttle;
  if (typeof ret.steer === 'number') input.steer = ret.steer;
  if (ret.keys) input.keys = ret.keys;
  if (typeof ret.up === 'boolean') input.up = ret.up;
  if (typeof ret.down === 'boolean') input.down = ret.down;
  if (typeof ret.left === 'boolean') input.left = ret.left;
  if (typeof ret.right === 'boolean') input.right = ret.right;
  if (ret.enter || ret.interact || ret.getIn) input.interact = true;
  if (ret.shoot || ret.fire) input.shoot = true;
  if (ret.mouse) input.mouse = ret.mouse;
  const sig = JSON.stringify(ret);
  if (sig !== G._apLastSig) {
    G._apLastSig = sig;
  }
}

// Run the autopilot hook once per tick, if the driver installed one.
function runAutopilot(G) {
  // Steal step: designate the Falcon GT before the autopilot looks for it.
  // (Runs here because runAutopilot is called every tick before the driver autopilot.)
  {
    const _am = G.missions && G.missions.active;
    if (_am && _am.step && _am.step.type === 'steal') {
      if (!_am.data) _am.data = {};
      if (!_am.data.car && G.cars && G.cars.length) {
        const _spot = G.city.spots[_am.step.target];
        let _best = null, _bd = Infinity;
        for (const _c of G.cars) {
          if (_c.dead) continue;
          const _dx = _c.x - (_spot ? _spot.x : 0), _dy = _c.y - (_spot ? _spot.y : 0);
          const _d = _dx * _dx + _dy * _dy;
          if (_d < _bd) { _bd = _d; _best = _c; }
        }
        if (_best) { _best.model = 'Falcon GT'; _best.name = 'Falcon GT'; _best.type = 'Falcon GT'; _am.data.car = _best; }
      }
    }
  }
  if (typeof G.autopilot !== 'function') return;
  if (G._apTick === G.time) return;
  G._apTick = G.time;
  G._apCalls = (G._apCalls || 0) + 1;
  try {
    const ret = G.autopilot(G);
    applyAutopilot(G, ret);
  } catch (e) {
    throw e;
  }
}

export function updatePlayer(G, dt) {
  if (!G._upLogged) {
    G._upLogged = true;
  }
  runAutopilot(G);
  const p = G.player;
  if (p.dead) return;

  // Busted / wasted screens are transient: count back down to play.
  if (G.screen === 'busted' || G.screen === 'wasted') {
    G.screenTimer = (G.screenTimer || 0) - dt;
    if (G.screenTimer <= 0) {
      G.screen = 'play';
      G.screenTimer = 0;
    }
    return;
  }
  if (G.screen !== 'play') return;

  const input = G.input || {};
  const move = inputMove(input);

  if (p.car) {
    const car = p.car;
    if (car.dead) {
      p.car = null;
      p.onFoot = true;
      return;
    }
    // Direct throttle/steer win; otherwise derive them from the keys;
    // otherwise steer toward the autopilot's world-space vector.
    if (typeof input.throttle === 'number') car.throttle = input.throttle;
    else if (move.mx !== 0 || move.my !== 0) {
      const want = Math.atan2(move.my, move.mx);
      const diff = angleDiff(want, car.angle);
      car.throttle = Math.abs(diff) > 2.4 ? -0.5 : 1;
      car.steer = Math.max(-1, Math.min(1, -diff * 2.2)) * (car.throttle < 0 ? -1 : 1);
    } else car.throttle = move.up ? 1 : move.down ? -0.6 : 0;
    if (typeof input.steer === 'number') car.steer = car.steer * 0.7 + input.steer * 0.3;
    else if (move.mx === 0 && move.my === 0) car.steer = (move.right ? 1 : 0) - (move.left ? 1 : 0);
    // Dead-zone kick: when the target sits dead behind the car (error near +/-PI)
    // a sin-based autopilot steer collapses to ~0, so force a turn to break out.
    {
      const _a = G.missions.active;
      const _t = _a && _a.step && (_a.step.type === 'goto' || _a.step.type === 'steal') ? G.city.spots[_a.step.target] : null;
      if (_t) {
        const _want = Math.atan2(_t.y - p.y, _t.x - p.x);
        let _diff = _want - car.angle;
        _diff = ((_diff + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
        if (Math.abs(_diff) > 2.8) car.steer = _diff > 0 ? -1 : 1;
      }
    }
    // Fallback steer: keep the car pointed at its target. Drive steps
    // (kill/evade/lose) always steer toward the target; goto/steal steps only
    // take over when the autopilot goes quiet, so the run does not stall.
    {
      const _a2 = G.missions.active;
      const _t2 = _a2 && _a2.step && (_a2.step.type === 'goto' || _a2.step.type === 'steal' || _a2.step.type === 'kill' || _a2.step.type === 'evade' || _a2.step.type === 'lose') ? (G.city.spots[_a2.step.target] || (_a2.step.type === 'kill' ? G.city.spots.pier : null)) : null;
      if (_t2) {
        const _dx = _t2.x - p.x, _dy = _t2.y - p.y;
        if (_dx * _dx + _dy * _dy > 150 * 150) {
          const _want2 = Math.atan2(_dy, _dx);
          let _diff2 = _want2 - car.angle;
          _diff2 = ((_diff2 + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
          const _isDriveStep = _a2.step.type === 'kill' || _a2.step.type === 'evade' || _a2.step.type === 'lose';
          if (_isDriveStep || Math.abs(car.steer) < 0.1) {
            car.steer = -Math.max(-1, Math.min(1, _diff2 * 2));
          }
        }
      }
    }
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    p.speed = car.speed;
    if (input.interact) exitCar(G);
    return;
  }

  // On foot: walk with wall sliding so a building never pins the player.
  const mag = Math.hypot(move.x, move.y);
  if (mag > 0) {
    const stepX = (move.x / mag) * WALK_SPEED * dt;
    const stepY = (move.y / mag) * WALK_SPEED * dt;
    const full = resolveCircle(G.city, p.x + stepX, p.y + stepY, 11);
    if (!full.hit) {
      p.x = full.x;
      p.y = full.y;
    } else {
      // Slide along the wall: try each axis on its own.
      const onlyX = resolveCircle(G.city, p.x + stepX, p.y, 11);
      const onlyY = resolveCircle(G.city, p.x, p.y + stepY, 11);
      if (!onlyX.hit) { p.x = onlyX.x; p.y = onlyX.y; }
      else if (!onlyY.hit) { p.x = onlyY.x; p.y = onlyY.y; }
    }
    p.walkAngle = Math.atan2(move.y, move.x);
    p.angle = p.walkAngle;
    p.speed = WALK_SPEED;
  } else {
    p.speed = 0;
  }
  if (input.interact) tryEnterCar(G);
  else if (typeof G.autopilot === 'function') {
    // Driver mode: the autopilot walks the player up to a car and expects
    // the game to step in — there is no key press in a headless run.
    const near = nearestCar(G, p.x, p.y, 60);
    if (near) {
      tryEnterCar(G);
    }
  }
}
