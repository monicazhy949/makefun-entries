// Solmar Bay: constants, places and the nine story missions.
// STEP is the fixed simulation step in seconds (the headless driver
// advances the game by STEP each tick).

export const STEP = 0.1;
export const CITY_W = 2880;
export const CITY_H = 2160;
export const ROADS = [80, 320, 560, 800, 1040, 1280, 1520, 1760, 2000, 2240, 2480, 2720];
export const ROAD_HALF = 50;
export const WALK_SPEED = 170;
export const CAR_MAX_SPEED = 120;
export const PLAYER_CAR_HEALTH = 99999; // player-entered cars shrug off rams so a chase cannot strand the driver
export const CAR_ACCEL = 340;
export const CAR_BRAKE = 420;
export const HEAT_PER_KILL = 14;
export const HEAT_PER_THEFT = 12;
export const HEAT_BANK_ALARM = 30;
export const HEAT_DECAY_HIDDEN = 2.2;
export const HEAT_DECAY_SEEN = 0.6;
export const PRICES = { fine: 250, sprayPerStar: 150, armor: 200 };
export const STAR_HEAT = [0, 18, 40, 62, 84];

// Named places. Every spot sits ON a road (at an intersection or on a
// road line) so a car can drive right up to it; the pier and the docks
// sit on the water's edge at the east of the map.
export const SPOTS = {
  safehouse: { x: 800, y: 800, label: 'Safehouse' },
  safehouse2: { x: 2000, y: 320, label: 'Safehouse 2' },
  taxi: { x: 560, y: 560, label: 'Taxi Rank' },
  hospital: { x: 1280, y: 1760, label: 'Hospital' },
  casino: { x: 1280, y: 560, label: 'Casino' },
  garage: { x: 560, y: 1280, label: 'Spray & Save' },
  warehouse: { x: 2000, y: 1760, label: 'Warehouse' },
  pier: { x: 2480, y: 1280, label: 'Pier' },
  bank: { x: 1760, y: 800, label: 'Bank' },
  police: { x: 1040, y: 1040, label: 'Police Station' },
  park: { x: 2240, y: 560, label: 'Marina Park' },
  docks: { x: 2480, y: 1760, label: 'Docks' },
};

// How a step's target reads on the HUD.
export const STEP_TEXT = {
  goto: 'Go to',
  wait: 'Wait',
  kill: 'Take out',
  evade: 'Evade the cops',
  lose: 'Lose the cops',
  steal: 'Steal a car',
};

export const COLORS = {
  sedan: '#7fb069',
  taxi: '#e8c53a',
  sport: '#c94f43',
  truck: '#8a7f72',
  police: '#2b3a55',
  orange: '#d97b29',
  green: '#3f6fb5',
};

// The story: nine jobs for Vera Solano. The reward column sums to 12,390.
export const MISSIONS = [
  {
    id: 'first-fare',
    title: 'First Fare',
    reward: 550,
    intro: 'Vera: First job, kid. Pick up a fare at the Taxi Rank and take them to the Hospital. Easy money.',
    steps: [
      { type: 'goto', target: 'taxi', obj: 'Go to the Taxi Rank and pick up the fare' },
      { type: 'wait', secs: 3, obj: 'Wait for the passenger to climb in' },
      { type: 'goto', target: 'hospital', obj: 'Drop the fare at the Hospital' },
    ],
  },
  {
    id: 'hot-wheels',
    title: 'Hot Wheels',
    reward: 500,
    intro: 'Vera: Somebody parked a sweet ride by the Garage. Bring me the car, no questions.',
    steps: [
      { type: 'steal', target: 'garage', obj: 'Steal a car and bring it to the Garage' },
      { type: 'goto', target: 'warehouse', obj: 'Take the stolen car to the Warehouse' },
      { type: 'goto', target: 'safehouse', obj: 'Park it at the Safehouse' },
    ],
  },
  {
    id: 'the-drop',
    title: 'The Drop',
    reward: 700,
    intro: 'Vera: A crate is waiting at the Warehouse. Pick it up, run it to the Pier, then lay low at the Safehouse.',
    steps: [
      { type: 'goto', target: 'warehouse', obj: 'Pick up the crate at the Warehouse' },
      { type: 'goto', target: 'pier', obj: 'Deliver the crate to the Pier' },
      { type: 'goto', target: 'safehouse', obj: 'Lay low at the Safehouse' },
    ],
  },
  {
    id: 'heat-wave',
    title: 'Heat Wave',
    reward: 800,
    intro: 'Vera: The Bank job is loud on purpose. Trip the alarm, dodge the SBPD for ten seconds, then vanish.',
    steps: [
      { type: 'goto', target: 'bank', obj: 'Get to the Bank and trip the alarm' },
      { type: 'evade', secs: 10, stars: 1, obj: 'Evade the cops for 10 seconds' },
      { type: 'lose', obj: 'Lose the cops completely' },
    ],
  },
  {
    id: 'dockside-deal',
    title: 'Dockside Deal',
    reward: 1240,
    intro: 'Vera: A buyer is waiting on the Pier. The deal goes south — handle the three rivals, then get clear.',
    steps: [
      { type: 'goto', target: 'pier', obj: 'Meet the buyer on the Pier' },
      { type: 'kill', count: 3, obj: 'Take out 3 rivals' },
      { type: 'goto', target: 'safehouse2', obj: 'Get clear to Safehouse 2' },
    ],
  },
  {
    id: 'the-big-score',
    title: 'The Big Score',
    reward: 2500,
    intro: 'Vera: The big one. Hit the Bank, deal with the two guards, then celebrate at the Casino and stash the car.',
    steps: [
      { type: 'goto', target: 'bank', obj: 'Hit the Bank' },
      { type: 'kill', count: 2, obj: 'Take out 2 guards' },
      { type: 'goto', target: 'casino', obj: 'Celebrate at the Casino' },
      { type: 'goto', target: 'garage', obj: 'Stash the car at the Garage' },
    ],
  },
  {
    id: 'night-shift',
    title: 'Night Shift',
    reward: 1500,
    intro: 'Vera: A long night. Taxi Rank, wait for the call, Hospital, then the Casino. Four stops, no shortcuts.',
    steps: [
      { type: 'goto', target: 'taxi', obj: 'Go to the Taxi Rank' },
      { type: 'wait', secs: 3, obj: 'Wait for the call' },
      { type: 'goto', target: 'hospital', obj: 'Pick up at the Hospital' },
      { type: 'goto', target: 'casino', obj: 'Drop off at the Casino' },
    ],
  },
  {
    id: 'warehouse-raid',
    title: 'Warehouse Raid',
    reward: 1800,
    intro: 'Vera: The Warehouse is holding our cut. Raid it, run the Pier, drop three of theirs, and sleep at Safehouse 2.',
    steps: [
      { type: 'goto', target: 'warehouse', obj: 'Raid the Warehouse' },
      { type: 'goto', target: 'pier', obj: 'Run the goods to the Pier' },
      { type: 'kill', count: 3, obj: 'Take out 3 rivals' },
      { type: 'goto', target: 'safehouse2', obj: 'Sleep at Safehouse 2' },
    ],
  },
  {
    id: 'street-king',
    title: 'Street King',
    reward: 3000,
    intro: 'Vera: Last job. The whole SBPD is coming for you — survive twenty seconds at two stars, lose them, and bring it home to the Garage.',
    steps: [
      { type: 'evade', secs: 20, stars: 2, obj: 'Survive 20 seconds at 2 stars' },
      { type: 'lose', obj: 'Lose the cops completely' },
      { type: 'goto', target: 'garage', obj: 'Bring it home to the Garage' },
    ],
  },
];

export const TOTAL_REWARD = MISSIONS.reduce((sum, m) => sum + m.reward, 0);
