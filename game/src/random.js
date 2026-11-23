// Seeded deterministic random numbers for Solmar Bay.
// Every random choice in the game flows through one RNG so a seed
// replays the same city, traffic and pedestrians.
export class RNG {
  constructor(seed = 1) {
    this.s = (seed >>> 0) || 1;
  }

  // mulberry32: small, fast, deterministic.
  next() {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(a, b) {
    return a + this.next() * (b - a);
  }

  int(a, b) {
    return Math.floor(this.range(a, b + 1));
  }

  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }

  chance(p) {
    return this.next() < p;
  }

  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.next() * (i + 1));
      const tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }
}

export function mulberry32(seed) {
  return new RNG(seed);
}
