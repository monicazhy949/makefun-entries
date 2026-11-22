// Every tuning number, colour and size in one place. The playfield is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule below
// depends on the screen size. The top 64 pixels are the HUD strip: rooms live
// below it.

export const FIELD = { width: 1280, height: 720, hudHeight: 64 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const THIEF = {
  radius: 11,
  walkSpeed: 215,
  sneakSpeed: 125,
  /** Detection is this much slower while sneaking. */
  sneakFactor: 0.5,
  /** Detection is this much slower while standing in a shadow patch. */
  coverFactor: 0.35,
};

export const GUARD = {
  radius: 13,
  patrolSpeed: 88,
  chaseSpeed: 158,
  /** Seconds a guard waits at each waypoint, sweeping its cone. */
  waypointPause: 1.1,
  /** Half-angle of the vision cone, in radians. */
  coneHalfAngle: 0.61,
  coneRange: 235,
  /** How fast the alarm fills per second when a guard sees the thief at point blank. */
  seeRate: 30,
  /** Touching a guard is always a catch, alert or not. */
  catchDistance: 24,
};

export const CAMERA = {
  coneHalfAngle: 0.49,
  coneRange: 265,
  seeRate: 20,
  /** Radians per second the camera head sweeps. */
  sweepSpeed: 0.55,
  /** How far, in radians, it sweeps each side of its base angle. */
  sweepRange: 0.9,
};

export const ALARM = {
  max: 100,
  /** The level at which the guards go to full alert and chase. */
  trigger: 100,
  /** The level at which an alert stands down and guards return to patrol. */
  standDown: 50,
  /** Points per second the alarm falls while nobody sees the thief. */
  decay: 16,
  /** Points per second it falls during an alert while nobody sees the thief. */
  alertDecay: 9,
};

export const TOOLS = {
  coin: { key: '1', name: 'Coin', cost: 10, radius: 320, linger: 3 },
  smoke: { key: '2', name: 'Smoke', cost: 25, radius: 95, linger: 5 },
  emp: { key: '3', name: 'EMP', cost: 40, linger: 8 },
};

export const LIVES = 3;
export const STARTING_CASH = 50;
export const ROOM_CLEAR_BONUS = 200;
export const CAUGHT_FREEZE = 1.4;

export const PALETTE = {
  backdrop: '#0b0e1a',
  floor: '#14182b',
  floorLine: '#1d2340',
  carpet: '#3a1f2b',
  wall: '#2b3247',
  wallTrim: '#8a6d3b',
  cover: '#1d3a2a',
  coverLeaf: '#2a5238',
  guard: '#3d5a80',
  guardCone: 'rgba(255, 190, 60, 0.20)',
  guardConeEdge: 'rgba(255, 190, 60, 0.55)',
  suspiciousCone: 'rgba(255, 120, 50, 0.32)',
  alertCone: 'rgba(255, 60, 60, 0.38)',
  camera: '#5a6b8a',
  cameraCone: 'rgba(120, 200, 255, 0.15)',
  cameraOff: '#3a4356',
  loot: '#f2c94c',
  target: '#bff3ff',
  thief: '#17171f',
  thiefRim: '#e8e8f0',
  exit: '#3ddc84',
  exitDark: '#1d7a4a',
  text: '#eef1f5',
  muted: '#9aa3b5',
  gold: '#f2c94c',
  danger: '#ff5a5a',
  panel: 'rgba(10, 12, 24, 0.82)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best loot total is kept between visits (this browser only). */
export const BEST_KEY = 'velvet-vault.best';
