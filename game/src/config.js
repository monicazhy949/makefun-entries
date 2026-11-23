// Solmar Bay: tuning numbers and the story missions.
// Vera Solano hands the player nine jobs across the city. The rewards add up
// to $12,590 for a clean full run.
export const STEP = 1 / 60;

export const WORLD_W = 3200;
export const WORLD_H = 2400;

export const PLAYER_WALK_SPEED = 170;
export const PLAYER_RUN_SPEED = 240;
export const CAR_MAX_SPEED = 380;
export const CAR_REVERSE_SPEED = 140;
export const COP_MAX_SPEED = 330;
export const TRAFFIC_CRUISE_MIN = 120;
export const TRAFFIC_CRUISE_MAX = 180;
export const FOOT_COP_SPEED = 120;
export const PED_WALK_SPEED = 55;

export const CAR_TYPES = [
  { name: 'Falcon GT', color: '#e33e2b' },
  { name: 'Comet', color: '#2b6fd6' },
  { name: 'Dune Buggy', color: '#e8a13a' },
  { name: 'Metro Cab', color: '#f2c200' },
  { name: 'Pickup', color: '#4a7d4f' },
  { name: 'Sedan', color: '#8a8f98' },
  { name: 'Coupe', color: '#7b4fd0' },
  { name: 'Van', color: '#d8d3c8' },
];

export const MISSIONS = [
  {
    id: 'first-fare',
    title: 'First Fare',
    reward: 550,
    start: 'taxi',
    steps: [
      { type: 'goto', spot: 'taxi', text: 'Pick up the fare at the taxi stand' },
      { type: 'goto', spot: 'hospital', text: 'Drop the fare at the hospital' },
      { type: 'goto', spot: 'casino', text: 'Collect the fare at the casino' },
    ],
  },
  {
    id: 'hot-wheels',
    title: 'Hot Wheels',
    reward: 500,
    start: 'garage',
    steps: [
      { type: 'goto', spot: 'garage', text: 'Get to the garage' },
      { type: 'steal', spot: 'garage', text: 'Steal the Falcon GT' },
      { type: 'goto', spot: 'safehouse', text: 'Bring the Falcon GT to the safehouse' },
    ],
  },
  {
    id: 'the-drop',
    title: 'The Drop',
    reward: 700,
    start: 'pier',
    steps: [
      { type: 'goto', spot: 'pier', text: 'Get to the pier' },
      { type: 'pickup', spot: 'pier', text: 'Pick up the case at the pier' },
      { type: 'goto', spot: 'warehouse', text: 'Deliver the case to the warehouse' },
    ],
  },
  {
    id: 'heat-wave',
    title: 'Heat Wave',
    reward: 800,
    start: 'casino',
    heat: 40,
    steps: [
      { type: 'goto', spot: 'casino', text: 'Reach the casino with the heat on' },
      { type: 'evade', seconds: 20, text: 'Survive the heat for 20 seconds' },
    ],
  },
  {
    id: 'dockside-deal',
    title: 'Dockside Deal',
    reward: 1240,
    start: 'pier',
    steps: [
      { type: 'goto', spot: 'pier', text: 'Get to the pier' },
      { type: 'kill', count: 3, spot: 'pier', text: 'Take out 3 rivals at the docks' },
      { type: 'goto', spot: 'safehouse', text: 'Lay low at the safehouse' },
    ],
  },
  {
    id: 'the-big-score',
    title: 'The Big Score',
    reward: 2500,
    start: 'warehouse',
    steps: [
      { type: 'goto', spot: 'warehouse', text: 'Get to the warehouse' },
      { type: 'goto', spot: 'pier', text: 'Meet the crew at the pier' },
      { type: 'kill', count: 2, spot: 'pier', text: 'Clear 2 guards at the pier' },
      { type: 'goto', spot: 'casino', text: 'Bring the score to the casino' },
    ],
  },
  {
    id: 'night-shift',
    title: 'Night Shift',
    reward: 1500,
    start: 'taxi',
    steps: [
      { type: 'goto', spot: 'taxi', text: 'Start the night shift at the taxi stand' },
      { type: 'wait', seconds: 3, text: 'Wait for the passenger' },
      { type: 'goto', spot: 'hospital', text: 'Drive the passenger to the hospital' },
      { type: 'goto', spot: 'casino', text: 'Drop the passenger at the casino' },
    ],
  },
  {
    id: 'warehouse-raid',
    title: 'Warehouse Raid',
    reward: 1800,
    start: 'warehouse',
    steps: [
      { type: 'goto', spot: 'warehouse', text: 'Get to the warehouse' },
      { type: 'goto', spot: 'pier', text: 'Move to the pier' },
      { type: 'kill', count: 3, spot: 'pier', text: 'Take out 3 rivals at the pier' },
      { type: 'goto', spot: 'safehouse2', text: 'Fall back to the second safehouse' },
    ],
  },
  {
    id: 'street-king',
    title: 'Street King',
    reward: 3000,
    start: 'garage',
    heat: 40,
    steps: [
      { type: 'evade', seconds: 20, text: 'Outrun the law for 20 seconds' },
      { type: 'lose', text: 'Lose the cops' },
      { type: 'goto', spot: 'garage', text: 'Park up at the garage' },
    ],
  },
];
