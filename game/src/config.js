// Solmar Bay — tuning, palette, vehicles, weapons and the story mission list.
// One place for every number the rest of the game reads, so balancing never means
// hunting through the systems.

export const STEP = 1 / 60;
export const WORLD_W = 3200;
export const WORLD_H = 2400;
export const ROAD_W = 64;
export const WALK_W = 16;
export const SAVE_KEY = 'solmar-save-v1';

// Sun-soaked palette: warm sand, pale stucco, terracotta roofs, turquoise water.
export const PALETTE = {
  water: '#2f9ec4',
  waterDeep: '#1f7ea6',
  sand: '#ecd9a4',
  ground: '#c9bd9f',
  grass: '#79b264',
  grassDark: '#639c50',
  asphalt: '#3d4149',
  asphaltDark: '#34383f',
  lane: '#e8e2c8',
  walk: '#b9b2a0',
  walkDark: '#a89f8b',
  plaza: '#c9bda6',
  buildingEdge: 'rgba(0,0,0,0.18)',
  shadow: 'rgba(20,16,8,0.28)',
};

// Roof and wall colours per district feel.
export const WALL_COLORS = ['#f2e3c6', '#f6d9b8', '#e8c9a0', '#dfe8ee', '#f0c8b8', '#e5d8b0', '#d8e4d0'];
export const ROOF_COLORS = ['#b8543f', '#c96f4a', '#8a5a3b', '#5f7d8c', '#7a8ba0', '#a8574a', '#6b7f59'];
export const GLASS_COLORS = ['#7fb8c9', '#6fa8c0', '#8fc4d4', '#5f9db5'];
export const CAR_COLORS = ['#c94f43', '#3f6fb5', '#e8c53a', '#e8e4da', '#2e2e33', '#7fb069', '#d97b29', '#8e6fb8', '#4fb0a5', '#b8b8c0'];

// Vehicle types: size, acceleration, top speed (px/s), grip (turn rate) and mass feel.
export const CAR_TYPES = {
  sedan:   { w: 46, h: 22, accel: 260, maxSpeed: 430, grip: 2.6, name: 'Solmar Sedan' },
  coupe:   { w: 44, h: 21, accel: 320, maxSpeed: 520, grip: 3.0, name: 'Vento Coupe' },
  sports:  { w: 46, h: 22, accel: 420, maxSpeed: 640, grip: 3.4, name: 'Falcon GT' },
  taxi:    { w: 46, h: 22, accel: 280, maxSpeed: 450, grip: 2.7, name: 'Bay Taxi' },
  van:     { w: 52, h: 24, accel: 200, maxSpeed: 360, grip: 2.2, name: 'Harbor Van' },
  truck:   { w: 58, h: 26, accel: 170, maxSpeed: 330, grip: 2.0, name: 'Dock Truck' },
  police:  { w: 47, h: 22, accel: 380, maxSpeed: 600, grip: 3.2, name: 'SBPD Cruiser' },
  limo:    { w: 62, h: 23, accel: 240, maxSpeed: 470, grip: 2.4, name: 'Marina Limo' },
};

export const WEAPONS = {
  fists:  { name: 'Fists', damage: 12, rate: 2.2, range: 34, auto: false, ammo: Infinity },
  pistol: { name: 'Pistol', damage: 26, rate: 3.5, range: 420, auto: false, ammo: 'pistol' },
  smg:    { name: 'SMG', damage: 16, rate: 9.0, range: 380, auto: true, ammo: 'smg' },
};

export const WEAPON_ORDER = ['fists', 'pistol', 'smg'];

// Wanted stars from heat: heat 0-100, stars step up at these floors.
export const STAR_HEAT = [0, 12, 32, 55, 76, 92];
export const HEAT_DECAY_HIDDEN = 6; // heat per second while no cop sees the player
export const HEAT_DECAY_SEEN = 0.5;

export const PRICES = {
  sprayPerStar: 150,
  pistolAmmo: 40,
  smg: 900,
  smgAmmo: 120,
  armor: 250,
  healthSnack: 20,
  bribe: 0,
};

// The story: six missions for Milo Reyes, driver for fixer Vera Solano.
export const MISSIONS = [
  {
    id: 'first-fare', title: 'First Fare', giver: 'Vera Solano', reward: 300,
    brief: 'Vera needs a driver she can trust. Pick up her client at the Marina hotel and get him to the Casino. No scratches.',
    steps: [
      { type: 'goto', spot: 'hotel', text: 'Drive to the Marina Hotel' },
      { type: 'wait', seconds: 2, text: 'Picking up the client…' },
      { type: 'goto', spot: 'casino', text: 'Drive the client to the Casino' },
    ],
  },
  {
    id: 'hot-wheels', title: 'Hot Wheels', giver: 'Vera Solano', reward: 500,
    brief: 'A Falcon GT is parked outside the docks. Take it — quietly — and drop it at the chop shop. The boys pay cash.',
    steps: [
      { type: 'goto', spot: 'docks', text: 'Go to the docks' },
      { type: 'steal', car: 'sports', text: 'Steal the Falcon GT' },
      { type: 'deliver', spot: 'chopshop', text: 'Deliver the Falcon GT to the chop shop' },
    ],
  },
  {
    id: 'the-drop', title: 'The Drop', giver: 'Vera Solano', reward: 700,
    brief: 'A package has to reach the Old Town safehouse, and the SBPD are already sniffing around. Expect company.',
    steps: [
      { type: 'goto', spot: 'warehouse', text: 'Collect the package at the warehouse' },
      { type: 'goto', spot: 'safehouse2', text: 'Deliver it to the Old Town safehouse', wanted: 2 },
    ],
  },
  {
    id: 'heat-wave', title: 'Heat Wave', giver: 'Vera Solano', reward: 800,
    brief: 'The heat is on the whole crew. Shake a three-star tail and get to the spray shop with a clean plate.',
    steps: [
      { type: 'evade', seconds: 25, text: 'Survive the chase for 25 seconds', wanted: 3 },
      { type: 'lose', text: 'Lose the cops' },
      { type: 'goto', spot: 'garage', text: 'Get to Spray & Save' },
    ],
  },
  {
    id: 'dockside-deal', title: 'Dockside Deal', giver: 'Vera Solano', reward: 1200,
    brief: 'The deal at Pier 9 is a setup. The Marlowe crew is waiting. Go in loud, come out with the case.',
    steps: [
      { type: 'goto', spot: 'pier', text: 'Reach Pier 9' },
      { type: 'kill', count: 4, who: 'rivals', text: 'Take out the Marlowe crew (0/4)' },
      { type: 'pickup', item: 'case', text: 'Grab the case' },
      { type: 'goto', spot: 'safehouse', text: 'Bring the case home' },
    ],
  },
  {
    id: 'the-big-score', title: 'The Big Score', giver: 'Vera Solano', reward: 2500,
    brief: 'The Casino vault. In and out before the alarm brings the whole city down — then lose four stars and vanish.',
    steps: [
      { type: 'goto', spot: 'casino', text: 'Get to the Casino' },
      { type: 'wait', seconds: 4, text: 'Cracking the vault…' },
      { type: 'escape', spot: 'hideout', text: 'Escape to the hideout', wanted: 4 },
    ],
  },
];

export const SIDE_JOBS = {
  taxi: { name: 'Taxi Fare', base: 60, tip: 40, text: 'Take the passenger to the marker' },
  courier: { name: 'Courier Run', base: 90, tip: 60, text: 'Deliver the parcels before time runs out' },
};

export const DISTRICTS = [
  { name: 'Downtown', x: 1200, y: 300, w: 1100, h: 900, tall: true },
  { name: 'Old Town', x: 500, y: 300, w: 650, h: 900, tall: false },
  { name: 'Harbor', x: 500, y: 1400, w: 1300, h: 700, tall: false },
  { name: 'Beachfront', x: 0, y: 300, w: 450, h: 1800, tall: false },
  { name: 'Hillside', x: 2400, y: 300, w: 750, h: 1800, tall: false },
];
