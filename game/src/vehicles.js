// Solmar Bay: cars. Traffic follows the road grid, parked cars wait at the
// kerb, and the player and the police steer freely.
import { TRAFFIC_CRUISE_MIN, TRAFFIC_CRUISE_MAX } from './config.js';
import { ROADS_V, ROADS_H } from './world.js';

const CAR_COLORS = {
  'Falcon GT': '#e33e2b',
  Comet: '#2b6fd6',
  'Dune Buggy': '#e8a13a',
  'Metro Cab': '#f2c200',
  Pickup: '#4a7d4f',
  Sedan: '#8a8f98',
  Coupe: '#7b4fd0',
  Van: '#d8d3c8',
  Interceptor: '#1c1e26',
};

const CAR_NAMES = Object.keys(CAR_COLORS).filter((n) => n !== 'Interceptor');

export function createCar(G, type, x, y, angle, driver) {
  const id = G.nextCarId;
  G.nextCarId += 1;
  const car = {
    id,
    type,
    color: CAR_COLORS[type] || '#8a8f98',
    x, y,
    angle: angle || 0,
    speed: 0,
    health: 100,
    dead: false,
    driver: driver === undefined ? null : driver,
    parked: !driver,
    axis: 'v',
    road: x,
    dir: 1,
    cruise: TRAFFIC_CRUISE_MIN + G.rng.next() * (TRAFFIC_CRUISE_MAX - TRAFFIC_CRUISE_MIN),
    length: 46,
    width: 22,
  };
  return car;
}

function randomRoadSpot(G) {
  const vx = G.rng.pick(ROADS_V);
  const hy = G.rng.pick(ROADS_H);
  return { x: vx, y: hy };
}

export function spawnTraffic(G, count) {
  for (let i = 0; i < count; i += 1) {
    const spot = randomRoadSpot(G);
    const type = G.rng.pick(CAR_NAMES);
    const axis = G.rng.chance(0.5) ? 'v' : 'h';
    const dir = G.rng.chance(0.5) ? 1 : -1;
    const car = createCar(G, type, spot.x, spot.y, 0, 'traffic');
    car.axis = axis;
    car.road = axis === 'v' ? spot.x : spot.y;
    car.dir = dir;
    car.angle = axis === 'v' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    car.speed = car.cruise;
    G.cars.push(car);
  }
}

// Parked cars at the kerb, near the places the player starts and works.
export function spawnParked(G) {
  const spots = [
    [895, 1100], [895, 1220], [785, 1100],
    [1855, 470], [1855, 580],
    [1215, 1750],
    [2705, 1430],
    [2175, 1110],
    [2495, 790],
    [1535, 2070],
  ];
  for (const [x, y] of spots) {
    const type = G.rng.pick(CAR_NAMES);
    const car = createCar(G, type, x, y, G.rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]), null);
    G.cars.push(car);
  }
}

export function updateVehicles(G, dt) {
  for (const car of G.cars) {
    if (car.dead || car.driver !== 'traffic') continue;
    car.speed += (car.cruise - car.speed) * Math.min(1, 1.5 * dt);
    if (car.axis === 'v') {
      const prevY = car.y;
      car.y += car.dir * car.speed * dt;
      car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      car.x = car.road;
      for (const hy of ROADS_H) {
        const crossed = (prevY - hy) * (car.y - hy) <= 0 && Math.abs(car.y - hy) < car.speed * dt + 2;
        if (!crossed) continue;
        car.y = hy;
        const r = G.rng.next();
        if (r < 0.16) {
          car.axis = 'h';
          car.road = hy;
          car.dir = G.rng.chance(0.5) ? 1 : -1;
        }
        break;
      }
      if (car.y < ROADS_H[0]) car.dir = 1;
      if (car.y > ROADS_H[ROADS_H.length - 1]) car.dir = -1;
    } else {
      const prevX = car.x;
      car.x += car.dir * car.speed * dt;
      car.angle = car.dir > 0 ? 0 : Math.PI;
      car.y = car.road;
      for (const vx of ROADS_V) {
        const crossed = (prevX - vx) * (car.x - vx) <= 0 && Math.abs(car.x - vx) < car.speed * dt + 2;
        if (!crossed) continue;
        car.x = vx;
        const r = G.rng.next();
        if (r < 0.16) {
          car.axis = 'v';
          car.road = vx;
          car.dir = G.rng.chance(0.5) ? 1 : -1;
        }
        break;
      }
      if (car.x < ROADS_V[0]) car.dir = 1;
      if (car.x > ROADS_V[ROADS_V.length - 1]) car.dir = -1;
    }
    car.x = Math.max(60, Math.min(G.city.w - 60, car.x));
    car.y = Math.max(60, Math.min(G.city.h - 60, car.y));
  }
  // Keep traffic from piling up: slow the rear car when two overlap.
  const traffic = G.cars.filter((c) => !c.dead && c.driver === 'traffic');
  for (let i = 0; i < traffic.length; i += 1) {
    for (let j = i + 1; j < traffic.length; j += 1) {
      const a = traffic[i];
      const b = traffic[j];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < 44 && d > 0.01) {
        if (a.speed > b.speed) a.speed = Math.max(40, b.speed - 20);
        else b.speed = Math.max(40, a.speed - 20);
      }
    }
  }
}
