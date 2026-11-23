// Game core: the state object every module shares, and the update loop
// that runs it. This is the file the headless driver imports.

import { RNG } from './random.js';
import { STEP, PRICES } from './config.js';
import { createCity, nearestRoadPoint } from './world.js';
import { createCar, spawnTraffic } from './vehicles.js';
import { createPlayer, updatePlayer, damagePlayer } from './player.js';
import { createWanted, updatePolice, wastePlayer } from './police.js';
import { createMissions, updateMissions, currentObjective } from './missions.js';
import { updateCombat } from './combat.js';
import { spawnPeds, updatePeds } from './pedestrians.js';
import { updateVehicles } from './vehicles.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';


export { STEP };

// Convenience aliases the driver (and the HUD) may read: the current
// step and mission, kept in sync every tick.
export function syncAliases(G) {
  const active = G.missions.active;
  const step = active ? active.step : null;
  const def = active ? active.def : null;
  G.step = step;
  G.currentStep = step;
  G.activeStep = step;
  G.currentMission = def;
  G.mission = def;
  G.missions.step = step;
  G.missions.currentStep = step;
  G.missions.current = active;
  if (active) {
    active.current = step;
    active.steps = active.def.steps;
  }
}

export function createGame(seed, opts) {
  const rng = new RNG(seed === undefined || seed === null ? 1 : seed);
  const city = createCity(rng);
  const G = {
    seed,
    rng,
    city,
    time: 0,
    clock: 0,
    screen: 'play',
    screenTimer: 0,
    stats: { kills: 0, moneyEarned: 0, busts: 0, deaths: 0 },
    cars: [],
    peds: [],
    cops: [],
    rivals: [],
    enemies: [],
    bullets: [],
    effects: [],
    explodeQueue: [],
    messages: [],
    objective: '',
    input: createInput(),
    audio: createAudio(),
    autopilot: null,
    shootCooldown: 0,
    busts: 0,
    deaths: 0,
    kills: 0,
    step: null,
    currentStep: null,
    activeStep: null,
    currentMission: null,
    mission: null,
  };
  G.message = (text, color) => {
    G.messages.push({ text, color: color || '#e8e2c8', t: G.time });
    if (G.messages.length > 6) G.messages.shift();
  };
  G.setScreen = (screen, info) => {
    G.screen = screen;
    G.screenTimer = screen === 'play' ? 0 : 2.2;
    if (info && typeof info.fine === 'number') G._lastFine = info.fine;
  };
  // Player spawns by the safehouse, with a car parked right there so the
  // first job can start driving immediately.
  const home = city.spots.safehouse;
  G.player = createPlayer(home.x, home.y + 60);
  G.wanted = createWanted();
  G.missions = createMissions();
  // A sedan at the kerb for the player, on the same road, close enough to
  // step into without a walk, facing north up the road toward town.
  const first = createCar(city, rng, 'sedan', home.x, home.y + 130, -Math.PI / 2, null);
  first.color = '#c94f43';
  G.cars.push(first);
  for (let i = 0; i < 5; i += 1) {
    const p = nearestRoadPoint(rng, city, home.x + rng.range(-500, 500), home.y + rng.range(-500, 500));
    const angle = rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
    G.cars.push(createCar(city, rng, rng.pick(['sedan', 'taxi', 'sport', 'truck']), p.x, p.y, angle, null));
  }
  spawnTraffic(G, 16);
  spawnPeds(G, 26);
  // The first job starts at once: the driver expects active to be set.
  updateMissions(G, 0);
  G.objective = currentObjective(G);
  syncAliases(G);
  return G;
}

export function updateGame(G, dt) {
  if (dt === undefined) dt = STEP;
  if (dt > 0.25) dt = 0.25;
  G.time += dt;
  G.clock += dt;

  // Health 0 means wasted, even if damage came from a car wreck.
  if (G.player.health <= 0 && !G.player.dead) {
    G.player.dead = true;
    G.player.health = 0;
    G.player.hp = 0;
  }
  if (G.player.dead && G.screen === 'play') {
    G.deaths = (G.deaths || 0) + 1;
    G.stats.deaths = G.deaths;
    wastePlayer(G);
    syncAliases(G);
    return;
  }

  // Death by car wreck: the player's car is gone and the player is hurt.
  if (G.player.car && G.player.car.dead) {
    damagePlayer(G, 30);
    G.player.car = null;
    G.player.onFoot = true;
  }

  updatePlayer(G, dt);
  updateVehicles(G, dt);
  updatePolice(G, dt);
  updateCombat(G, dt);
  updatePeds(G, dt);
  updateMissions(G, dt);
  G.objective = currentObjective(G);
  syncAliases(G);

  // Messages fade after a few seconds.
  while (G.messages.length && G.time - G.messages[0].t > 6) {
    G.messages.shift();
  }

}
