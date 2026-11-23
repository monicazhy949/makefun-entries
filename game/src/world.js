// Solmar Bay city: a road grid, buildings, parks, water and named spots.
// All geometry is deterministic from the seed.

import { CITY_W, CITY_H, ROADS, ROAD_HALF, SPOTS } from './config.js';

// The last city built, used by the flexible road helpers below.
let lastCity = null;

export function createCity(rng) {
  const buildings = [];
  const parks = [];
  const palette = ['#b98a5e', '#8a7f72', '#a5716b', '#7d8a99', '#9c8f6a', '#6f7d6a'];
  // One building (or two) per block between neighbouring roads.
  for (let i = 0; i < ROADS.length - 1; i += 1) {
    for (let j = 0; j < ROADS.length - 1; j += 1) {
      const x0 = ROADS[i] + ROAD_HALF + 14;
      const x1 = ROADS[i + 1] - ROAD_HALF - 14;
      const y0 = ROADS[j] + ROAD_HALF + 14;
      const y1 = ROADS[j + 1] - ROAD_HALF - 14;
      if (x1 - x0 < 90 || y1 - y0 < 90) continue;
      // A few blocks are parks instead of buildings.
      if ((i + j * 3) % 7 === 3) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        continue;
      }
      const wide = x1 - x0 > 260 && rng.chance(0.5);
      if (wide) {
        const mid = (x0 + x1) / 2;
        buildings.push({
          x: x0, y: y0, w: mid - x0 - 12, h: y1 - y0,
          color: rng.pick(palette), hgt: rng.int(18, 60),
        });
        buildings.push({
          x: mid + 12, y: y0, w: x1 - mid - 12, h: y1 - y0,
          color: rng.pick(palette), hgt: rng.int(18, 60),
        });
      } else {
        buildings.push({
          x: x0, y: y0, w: x1 - x0, h: y1 - y0,
          color: rng.pick(palette), hgt: rng.int(18, 70),
        });
      }
    }
  }
  const city = {
    width: CITY_W,
    height: CITY_H,
    roadsV: ROADS.slice(),
    roadsH: ROADS.slice(),
    roadHalf: ROAD_HALF,
    buildings,
    parks,
    water: { x: 2480, y: 0, w: CITY_W - 2480, h: CITY_H },
    spots: {},
  };
  for (const [name, s] of Object.entries(SPOTS)) {
    city.spots[name] = { x: s.x, y: s.y, name, label: s.label };
  }
  lastCity = city;
  return city;
}

export function nearestRoadCoord(v) {
  let best = ROADS[0];
  let bd = Math.abs(v - best);
  for (const r of ROADS) {
    const d = Math.abs(v - r);
    if (d < bd) { bd = d; best = r; }
  }
  return best;
}

export function isOnRoad(city, x, y) {
  for (const r of city.roadsV) if (Math.abs(x - r) <= city.roadHalf) return true;
  for (const r of city.roadsH) if (Math.abs(y - r) <= city.roadHalf) return true;
  return false;
}

// Snap a point to the nearest road: keep the coordinate that is already
// closest to a road, snap the other one onto its nearest road line.
export function roadAt(a, b, c) {
  let city = lastCity;
  let x;
  let y;
  if (a && typeof a === 'object' && a.roadsV) {
    city = a; x = b; y = c;
  } else {
    x = a; y = b;
    if (c && typeof c === 'object' && c.roadsV) city = c;
  }
  if (!city) return { x, y };
  const nx = nearestRoadCoord(x);
  const ny = nearestRoadCoord(y);
  if (Math.abs(x - nx) <= Math.abs(y - ny)) return { x: nx, y };
  return { x, y: ny };
}

// A random point on a road. Accepts (rng, city), (city), (rng, city, x, y)
// (the last form snaps near x, y) and plain (x, y) for a nearby road point.
export function nearestRoadPoint(a, b, c, d) {
  let rng = null;
  let city = lastCity;
  let x = null;
  let y = null;
  const args = [a, b, c, d].filter((v) => v !== undefined);
  for (const v of args) {
    if (v && typeof v === 'object' && typeof v.next === 'function') rng = v;
    else if (v && typeof v === 'object' && v.roadsV) city = v;
    else if (typeof v === 'number' && x === null) x = v;
    else if (typeof v === 'number') y = v;
  }
  if (!city) return { x: x ?? 0, y: y ?? 0 };
  if (x !== null && y !== null) return roadAt(city, x, y);
  const r = rng || { next: () => Math.random(), pick: (arr) => arr[0] };
  if (r.chance ? r.chance(0.5) : Math.random() < 0.5) {
    const rx = r.pick ? r.pick(city.roadsV) : city.roadsV[0];
    return { x: rx, y: r.range ? r.range(80, city.height - 80) : 400 };
  }
  const ry = r.pick ? r.pick(city.roadsH) : city.roadsH[0];
  return { x: r.range ? r.range(80, city.width - 80) : 400, y: ry };
}

export function randomRoadPoint(rng, city) {
  return nearestRoadPoint(rng, city);
}

// Push a circle out of buildings and the world edge. Returns the fixed
// position and whether anything blocked it.
export function resolveCircle(city, x, y, r) {
  let hit = false;
  let fx = Math.max(r, Math.min(city.width - r, x));
  let fy = Math.max(r, Math.min(city.height - r, y));
  if (fx !== x || fy !== y) hit = true;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(fx, b.x + b.w));
    const cy = Math.max(b.y, Math.min(fy, b.y + b.h));
    const dx = fx - cx;
    const dy = fy - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    hit = true;
    if (d2 > 0.01) {
      const d = Math.sqrt(d2);
      fx = cx + (dx / d) * r;
      fy = cy + (dy / d) * r;
    } else {
      // Centre inside the building: push out along the shortest side.
      const left = fx - b.x;
      const right = b.x + b.w - fx;
      const top = fy - b.y;
      const bottom = b.y + b.h - fy;
      const m = Math.min(left, right, top, bottom);
      if (m === left) fx = b.x - r;
      else if (m === right) fx = b.x + b.w + r;
      else if (m === top) fy = b.y - r;
      else fy = b.y + b.h + r;
    }
  }
  return { x: fx, y: fy, hit };
}

export function pointInBuilding(city, x, y) {
  for (const b of city.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
}

export function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
