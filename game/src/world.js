// The city of Solmar Bay: a road grid, blocks of buildings, a beach on the west
// edge, a park in the middle, and the named spots missions and shops live at.
// Named spots include the taxi depot, warehouse and garage the new missions start at.
// Everything is generated from the seed, so the same seed builds the same city.
import { WORLD_W, WORLD_H, ROAD_W, WALK_W, WALL_COLORS, ROOF_COLORS, GLASS_COLORS, DISTRICTS } from './config.js';

const BLOCK = 320; // road centre to road centre
const FIRST_V = 200; // first vertical road centre (x)
const FIRST_H = 200; // first horizontal road centre (y)

function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
  }
  return DISTRICTS[0];
}

function makeBuilding(rng, bx, by, bw, bh, tall) {
  const w = Math.max(70, bw - rng.int(14, 40));
  const h = Math.max(60, bh - rng.int(14, 40));
  const x = bx + (bw - w) / 2 + rng.range(-6, 6);
  const y = by + (bh - h) / 2 + rng.range(-6, 6);
  const glass = tall && rng.chance(0.55);
  return {
    x, y, w, h,
    hgt: tall ? rng.int(3, 6) : rng.int(1, 3),
    color: glass ? rng.pick(GLASS_COLORS) : rng.pick(WALL_COLORS),
    roof: glass ? '#4a6b7a' : rng.pick(ROOF_COLORS),
    glass,
    sign: rng.chance(0.3) ? rng.pick(['HOTEL', 'BANK', 'CAFE', 'MARKET', 'PIER 9', 'CLUB', 'GYM', 'DINER', 'ARMS', 'BAR']) : null,
  };
}

export function generateCity(rng) {
  const roadsV = [];
  for (let x = FIRST_V; x < WORLD_W - 100; x += BLOCK) roadsV.push(x);
  const roadsH = [];
  for (let y = FIRST_H; y < WORLD_H - 100; y += BLOCK) roadsH.push(y);

  const buildings = [];
  const parks = [];
  const trees = [];
  // Blocks sit between roads; each block holds buildings, or a park, or a plaza.
  for (let i = 0; i < roadsV.length - 1; i += 1) {
    for (let j = 0; j < roadsH.length - 1; j += 1) {
      const bx = roadsV[i] + ROAD_W / 2 + WALK_W;
      const by = roadsH[j] + ROAD_W / 2 + WALK_W;
      const bw = BLOCK - ROAD_W - WALK_W * 2;
      const bh = BLOCK - ROAD_W - WALK_W * 2;
      const cx = bx + bw / 2;
      const cy = by + bh / 2;
      const district = districtAt(cx, cy);
      // The central block is the park; a few others are plazas or parking lots.
      if (i === 4 && j === 3) {
        parks.push({ x: bx, y: by, w: bw, h: bh });
        for (let t = 0; t < 26; t += 1) trees.push({ x: bx + rng.range(16, bw - 16), y: by + rng.range(16, bh - 16), r: rng.range(9, 15) });
        continue;
      }
      if (rng.chance(0.1)) continue; // empty lot / parking
      const tall = district.tall && rng.chance(0.8);
      if (bw > 200 && rng.chance(0.55)) {
        // Split the block into two buildings side by side.
        const split = bw * rng.range(0.42, 0.58);
        buildings.push(makeBuilding(rng, bx, by, split - 8, bh, tall));
        buildings.push(makeBuilding(rng, bx + split + 8, by, bw - split - 8, bh, tall));
      } else {
        buildings.push(makeBuilding(rng, bx, by, bw, bh, tall));
      }
      if (rng.chance(0.5)) {
        for (let t = 0; t < rng.int(1, 3); t += 1) trees.push({ x: bx + rng.range(8, bw - 8), y: by + rng.range(8, bh - 8), r: rng.range(7, 11) });
      }
    }
  }
  // Palms along the beach.
  for (let y = 240; y < WORLD_H - 200; y += 90) {
    trees.push({ x: 120 + rng.range(-14, 14), y: y + rng.range(-20, 20), r: rng.range(10, 14), palm: true });
  }

  // Named spots: fixed road-side points the missions and shops use. Every one
  // sits ON a road centre (x or y on the 200 + 320k grid), so the player,
  // cars and mission waypoints can always reach it — a spot inside a block
  // could end up inside a building and be unreachable.
  const spots = {
    safehouse: { x: 2760, y: 360, label: 'Milo\u2019s Apartment' },
    safehouse2: { x: 680, y: 520, label: 'Old Town Safehouse' },
    garage: { x: 1360, y: 1160, label: 'Spray & Save' },
    gunshop: { x: 680, y: 1160, label: 'Harbor Arms' },
    casino: { x: 1680, y: 520, label: 'Casino Solmar' },
    hotel: { x: 360, y: 840, label: 'Marina Hotel' },
    docks: { x: 840, y: 2000, label: 'The Docks' },
    pier: { x: 520, y: 2000, label: 'Pier 9' },
    warehouse: { x: 2440, y: 2000, label: 'Warehouse' },
    chopshop: { x: 2760, y: 1680, label: 'Chop Shop' },
    hospital: { x: 1360, y: 840, label: 'Solmar General' },
    hideout: { x: 2760, y: 2000, label: 'Hideout' },
    taxi: { x: 1040, y: 840, label: 'Taxi Depot' },
    police: { x: 1680, y: 1160, label: 'SBPD Central' },
  };

  // Traffic lights at every other intersection.
  const lights = [];
  for (let i = 0; i < roadsV.length; i += 1) {
    for (let j = 0; j < roadsH.length; j += 1) {
      if ((i + j) % 2 === 0) lights.push({ x: roadsV[i], y: roadsH[j], t: rng.range(0, 12), period: 12 });
    }
  }

  return {
    width: WORLD_W, height: WORLD_H, roadsV, roadsH, buildings, parks, trees, spots, lights,
    water: { x0: 0, x1: 56 },
    sand: { x0: 56, x1: 150 },
  };
}

/** True when the point (with a small radius) is inside a building, the water, or outside the world. */
export function solidAt(city, x, y, r = 0) {
  if (x < city.water.x1 + r || x > city.width - r || y < r || y > city.height - r) return true;
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
  }
  return false;
}

/** Push a circle out of solid ground; returns the corrected position. */
export function resolveCircle(city, x, y, r) {
  if (x < city.water.x1 + r) x = city.water.x1 + r;
  if (x > city.width - r) x = city.width - r;
  if (y < r) y = r;
  if (y > city.height - r) y = city.height - r;
  for (const b of city.buildings) {
    const nx = Math.max(b.x, Math.min(x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - nx;
    const dy = y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        x = nx + (dx / d) * r;
        y = ny + (dy / d) * r;
      } else {
        // Centre inside the building: push out along the smallest overlap.
        const left = x - b.x + r;
        const right = b.x + b.w - x + r;
        const top = y - b.y + r;
        const bottom = b.y + b.h - y + r;
        const m = Math.min(left, right, top, bottom);
        if (m === left) x = b.x - r;
        else if (m === right) x = b.x + b.w + r;
        else if (m === top) y = b.y - r;
        else y = b.y + b.h + r;
      }
    }
  }
  return { x, y };
}

/** 'v' or 'h' when the point is on a road (within the asphalt), else null. */
export function roadAt(city, x, y) {
  const half = ROAD_W / 2;
  for (const rx of city.roadsV) {
    if (Math.abs(x - rx) <= half) return 'v';
  }
  for (const ry of city.roadsH) {
    if (Math.abs(y - ry) <= half) return 'h';
  }
  return null;
}

/** The nearest point on a road centre line, and which way it runs. */
export function nearestRoadPoint(city, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const rx of city.roadsV) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; best = { x: rx, y, dir: 'v' }; }
  }
  for (const ry of city.roadsH) {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; best = { x, y: ry, dir: 'h' }; }
  }
  return best;
}

export function randomRoadPoint(rng, city) {
  if (rng.chance(0.5)) {
    return { x: rng.pick(city.roadsV) + rng.range(-14, 14), y: rng.range(200, city.height - 200) };
  }
  return { x: rng.range(200, city.width - 200), y: rng.pick(city.roadsH) + rng.range(-14, 14) };
}

/** A sidewalk point beside a road (where pedestrians walk). */
export function randomSidewalkPoint(rng, city) {
  const p = randomRoadPoint(rng, city);
  const off = ROAD_W / 2 + WALK_W / 2;
  if (roadAt(city, p.x, p.y) === 'v') p.x += rng.chance(0.5) ? off : -off;
  else p.y += rng.chance(0.5) ? off : -off;
  return p;
}

/** The light state at an intersection: 'ns' lets north-south traffic go, 'ew' east-west. */
export function lightState(light, t) {
  const phase = (t + light.t) % light.period;
  return phase < light.period / 2 ? 'ns' : 'ew';
}

export function districtNameAt(x, y) {
  return districtAt(x, y).name;
}
