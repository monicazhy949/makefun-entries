// The three rooms of the heist, as data: walls, shadow patches (cover), guard
// patrol routes, cameras, loot, the room's prize and the exit. Coordinates are
// in the 1280x720 field; the HUD strip (y < 64) holds no gameplay. Waypoint
// lines are chosen clear of walls, so a patrol never walks through one.

export const LOOT_KINDS = {
  cash: { value: 50, label: 'Cash' },
  gem: { value: 100, label: 'Gem' },
  gold: { value: 200, label: 'Gold bar' },
};

export const LEVELS = [
  {
    name: 'I · The Gallery',
    brief: 'Slip through the gallery, take the Ruby, reach the east door.',
    spawn: { x: 90, y: 620 },
    exit: { x: 1196, y: 580, width: 52, height: 96 },
    walls: [
      { x: 560, y: 300, width: 160, height: 140 },
      { x: 300, y: 180, width: 60, height: 200 },
      { x: 900, y: 420, width: 60, height: 180 },
    ],
    cover: [
      { x: 180, y: 480, width: 140, height: 90 },
      { x: 700, y: 170, width: 150, height: 90 },
      { x: 1000, y: 560, width: 140, height: 90 },
    ],
    guards: [
      { route: [{ x: 400, y: 200 }, { x: 400, y: 500 }, { x: 700, y: 500 }, { x: 700, y: 200 }] },
      { route: [{ x: 1000, y: 200 }, { x: 1000, y: 450 }, { x: 850, y: 450 }, { x: 850, y: 200 }] },
    ],
    cameras: [
      { x: 640, y: 78, baseAngle: Math.PI / 2 },
    ],
    loot: [
      { x: 250, y: 300, kind: 'gem' },
      { x: 800, y: 620, kind: 'cash' },
      { x: 1150, y: 300, kind: 'gold' },
      { x: 450, y: 650, kind: 'gem' },
    ],
    target: { x: 1100, y: 150, name: 'The Ruby', value: 1000 },
  },
  {
    name: 'II · The Vault Hall',
    brief: 'Cross the hall two ways round the vault block. The Sapphire waits below it.',
    spawn: { x: 90, y: 380 },
    exit: { x: 1196, y: 340, width: 52, height: 96 },
    walls: [
      { x: 560, y: 220, width: 160, height: 280 },
      { x: 300, y: 150, width: 60, height: 160 },
      { x: 900, y: 400, width: 60, height: 160 },
      { x: 200, y: 120, width: 180, height: 60 },
    ],
    cover: [
      { x: 180, y: 180, width: 140, height: 90 },
      { x: 700, y: 560, width: 150, height: 90 },
      { x: 1000, y: 150, width: 140, height: 90 },
      { x: 450, y: 400, width: 120, height: 80 },
    ],
    guards: [
      { route: [{ x: 350, y: 150 }, { x: 350, y: 550 }] },
      { route: [{ x: 700, y: 150 }, { x: 950, y: 150 }, { x: 950, y: 550 }, { x: 700, y: 550 }] },
      { route: [{ x: 1050, y: 300 }, { x: 1050, y: 600 }, { x: 850, y: 600 }, { x: 850, y: 300 }] },
    ],
    cameras: [
      { x: 640, y: 78, baseAngle: Math.PI / 2 },
      { x: 110, y: 78, baseAngle: Math.PI / 2 },
    ],
    loot: [
      { x: 200, y: 620, kind: 'cash' },
      { x: 480, y: 180, kind: 'gem' },
      { x: 820, y: 620, kind: 'gold' },
      { x: 1120, y: 220, kind: 'gem' },
      { x: 420, y: 560, kind: 'cash' },
    ],
    target: { x: 640, y: 545, name: 'The Sapphire', value: 1000 },
  },
  {
    name: 'III · The Velvet Vault',
    brief: 'The Diamond sits inside the vault. Take it and get back to the west door.',
    spawn: { x: 90, y: 620 },
    exit: { x: 40, y: 100, width: 52, height: 96 },
    walls: [
      // The vault: a U open at the bottom, the Diamond inside.
      { x: 700, y: 150, width: 24, height: 300 },
      { x: 700, y: 150, width: 300, height: 24 },
      { x: 976, y: 150, width: 24, height: 300 },
      { x: 300, y: 150, width: 60, height: 160 },
      { x: 1100, y: 520, width: 60, height: 140 },
    ],
    cover: [
      { x: 200, y: 200, width: 140, height: 90 },
      { x: 500, y: 550, width: 150, height: 90 },
      { x: 1100, y: 550, width: 140, height: 90 },
      { x: 500, y: 150, width: 120, height: 80 },
    ],
    guards: [
      { route: [{ x: 750, y: 500 }, { x: 950, y: 500 }, { x: 950, y: 620 }, { x: 750, y: 620 }] },
      { route: [{ x: 300, y: 150 }, { x: 300, y: 550 }] },
      { route: [{ x: 1150, y: 150 }, { x: 1150, y: 550 }] },
    ],
    cameras: [
      { x: 850, y: 78, baseAngle: Math.PI / 2 },
      { x: 400, y: 78, baseAngle: Math.PI / 2 },
    ],
    loot: [
      { x: 200, y: 420, kind: 'gem' },
      { x: 480, y: 300, kind: 'cash' },
      { x: 620, y: 620, kind: 'gold' },
      { x: 1120, y: 320, kind: 'gem' },
      { x: 850, y: 620, kind: 'cash' },
      { x: 380, y: 650, kind: 'gem' },
    ],
    target: { x: 850, y: 300, name: 'The Velvet Diamond', value: 1500 },
  },
];
