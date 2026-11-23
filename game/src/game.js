// Solmar Bay: the game state and the one tick that drives it.
// The browser loop and the headless tests both run stepGame.
import { MISSIONS } from './config.js';
import { createRng } from './random.js';
import { createCity } from './world.js';
import { createCar, spawnTraffic, spawnParked, updateVehicles } from './vehicles.js';
import { spawnPeds, updatePeds } from './pedestrians.js';
import { updatePlayer } from './player.js';
import { updateCombat } from './combat.js';
import { currentObjective, updateMissions, pushMessage } from './missions.js';
import { updatePolice, wastePlayer } from './police.js';
import { createAudio } from './audio.js';

export function createGame(seed, audio) {
  const rng = createRng(seed);
  const city = createCity(seed);
  const G = {
    seed,
    rng,
    time: 0,
    clock: 0,
    screen: 'title',
    city,
    player: {
      x: 840,
      y: 1160,
      angle: -Math.PI / 2,
      aimAngle: 0,
      health: 100,
      armor: 0,
      money: 0,
      car: null,
      dead: false,
      lastHurtT: -99,
    },
    cars: [],
    peds: [],
    rivals: [],
    pickups: [],
    bullets: [],
    cops: [],
    footCops: [],
    missions: { current: 0, active: null, done: [], kills: 0, hasCase: false },
    wanted: { heat: 0, stars: 0 },
    messages: [],
    objective: null,
    autopilot: null,
    input: null,
    audio: audio === undefined ? createAudio() : audio,
    combat: { lastShot: -99, shotsFired: 0 },
    nextCarId: 1,
    bustGrace: 0,
    setScreen(s) {
      this.screen = s;
    },
  };
  G.objective = currentObjective(G);
  spawnParked(G);
  spawnTraffic(G, 14);
  spawnPeds(G, 24);
  G.pickups.push({ kind: 'health', x: 1800, y: 600 });
  G.pickups.push({ kind: 'health', x: 1160, y: 600 });
  pushMessage(G, 'Welcome to Solmar Bay');
  return G;
}

export function stepGame(G, dt) {
  G.time += dt;
  G.clock += dt * 60;
  updatePlayer(G, dt);
  updateVehicles(G, dt);
  updatePeds(G, dt);
  updatePolice(G, dt);
  updateCombat(G, dt);
  updateMissions(G, dt);
  G.objective = currentObjective(G);
  if (G.player.dead) wastePlayer(G);
  if (G.audio && G.audio.update) {
    const speed01 = G.player.car ? Math.abs(G.player.car.speed) / 380 : 0;
    G.audio.update(speed01, G.wanted.stars > 0, dt);
  }
  while (G.messages.length > 0 && G.time - G.messages[0].t > 5) G.messages.shift();
}

export { MISSIONS, createCar };
