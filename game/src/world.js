// Solmar Bay: the city itself. A road grid with named places, blocks of
// buildings in between, docks and sea along the east edge.
import { createRng } from './random.js';
import { WORLD_W, WORLD_H } from './config.js';

export const ROADS_V = [200, 520, 840, 1160, 1480, 1800, 2120, 2440, 2760];
export const ROADS_H = [200, 520, 840, 1160, 1480, 1800, 2120];
export const ROAD_W = 110;

const BUILDING_COLORS = [
  '#d9a066', '#c98d5f', '#b7c4ce', '#e0b184',
  '#9fb3c8', '#d8c49a', '#c4a484', '#a8bfb0', '#d78f7a',
];

export function createCity(seed) {
  const rng = createRng(seed * 7919 + 13);
  const spots = {
    safehouse: { x: 840, y: 840, label: 'Safehouse' },
    safehouse2: { x: 2440, y: 1480, label: 'Safehouse 2' },
    taxi: { x: 520, y: 520, label: 'Taxi Stand' },
    hospital: { x: 1800, y: 520, label: 'Hospital' },
    casino: { x: 2120, y: 1160, label: 'Casino' },
    garage: { x: 1160, y: 1800, label: 'Garage' },
    warehouse: { x: 2440, y: 840, label: 'Warehouse' },
    pier: { x: 2760, y: 1480, label: 'Pier' },
    police: { x: 1160, y: 520, label: 'Police Station' },
    spray: { x: 1480, y: 2120, label: 'Spray Shop' },
  };
  const buildings = [];
  for (let vi = 0; vi < ROADS_V.length - 1; vi += 1) {
    for (let hi = 0; hi < ROADS_H.length - 1; hi += 1) {
      const x0 = ROADS_V[vi] + ROAD_W / 2 + 14;
      const x1 = ROADS_V[vi + 1] - ROAD_W / 2 - 14;
      const y0 = ROADS_H[hi] + ROAD_W / 2 + 14;
      const y1 = ROADS_H[hi + 1] - ROAD_W / 2 - 14;
      if (x1 - x0 < 70 || y1 - y0 < 70) continue;
      const count = rng.int(1, 2);
      for (let k = 0; k < count; k += 1) {
        const w = rng.range(70, Math.min(150, x1 - x0 - 8));
        const h = rng.range(70, Math.min(150, y1 - y0 - 8));
        const x = rng.range(x0, x1 - w);
        const y = rng.range(y0, y1 - h);
        buildings.push({
          x, y, w, h,
          color: rng.pick(BUILDING_COLORS),
          floors: rng.int(1, 4),
        });
      }
    }
  }
  return {
    roadsV: ROADS_V,
    roadsH: ROADS_H,
    roadW: ROAD_W,
    spots,
    buildings,
    w: WORLD_W,
    h: WORLD_H,
  };
}

// Closest point on the road network to (x, y).
export function nearestRoadPoint(x, y) {
  const nx = ROADS_V.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a));
  const ny = ROADS_H.reduce((a, b) => (Math.abs(b - y) < Math.abs(a - y) ? b : a));
  return Math.abs(nx - x) < Math.abs(ny - y) ? { x: nx, y } : { x, y: ny };
}

// Which road runs nearest to (x, y), and where.
export function roadAt(x, y) {
  const nx = ROADS_V.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a));
  const ny = ROADS_H.reduce((a, b) => (Math.abs(b - y) < Math.abs(a - y) ? b : a));
  return Math.abs(nx - x) < Math.abs(ny - y)
    ? { axis: 'v', at: nx }
    : { axis: 'h', at: ny };
}
