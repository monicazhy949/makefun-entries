// The game object: everything the systems share, assembled in one place, and
// the one step that advances the whole world in a fixed order. main.js runs
// the loop around this; shots.js stages scenes from it.
import { createRandom } from './random.js';
import { generateCity } from './world.js';
import { createPlayer } from './player.js';
import { createCar } from './vehicles.js';
import { createWanted, addHeat } from './police.js';
import { createMissions, currentObjective, updateMissions } from './missions.js';
import { updatePlayer } from './player.js';
import { updateVehicles } from './vehicles.js';
import { updatePeds } from './pedestrians.js';
import { updatePolice, wastePlayer } from './police.js';
import { updateCombat, spawnPickup } from './combat.js';
import { saveGame } from './save.js';

export function createGame(seed, saveData) {
  const rng = createRandom(seed);
  const city = generateCity(rng);
  const home = city.spots.safehouse;
  const player = createPlayer(home.x, home.y + 40);
  if (saveData) {
    player.money = saveData.money ?? 250;
    player.health = saveData.health ?? 100;
    player.armor = saveData.armor ?? 0;
    player.weapon = saveData.weapon ?? 'pistol';
    player.ammo = { pistol: saveData.ammoPistol ?? 48, smg: saveData.ammoSmg ?? 0 };
    player.x = saveData.x ?? home.x;
    player.y = saveData.y ?? home.y + 40;
    player.owned = { fists: true, pistol: true, smg: !!(saveData.ammoSmg > 0 || saveData.ownedSmg) };
  } else {
    player.owned = { fists: true, pistol: true, smg: false };
  }

  const G = {
    seed, rng, city, player,
    time: 0,
    clock: saveData?.clock ?? 10 * 3600,
    cars: [], peds: [], cops: [], rivals: [],
    bullets: [], particles: [], pickups: [], skids: [],
    explodeQueue: [],
    wanted: createWanted(),
    missions: createMissions(saveData?.missionsDone || []),
    camera: { x: player.x - 640, y: player.y - 400 },
    messages: [],
    bannerText: null,
    hint: '',
    screen: 'title',
    screenData: null,
    stats: { kills: 0, carsStolen: 0, missionsDone: saveData?.missionsDone?.length || 0, moneyEarned: 0 },
    muted: false,
    help: false,
    hasSave: !!saveData,
    lastHurt: 0,
    objective: null,
    autopilot: null,
    scriptedAim: undefined,
    menuButtons: [],
    input: null,
    audio: null,
    message(text, color) {
      this.messages.push({ text, color: color || '#ffffff', t: this.time });
      if (this.messages.length > 6) this.messages.shift();
    },
    banner(title, sub) {
      this.bannerText = { title, sub: sub || '', t: this.time };
    },
    setScreen(name, data) {
      this.screen = name;
      this.screenData = data || null;
    },
    saveProgress() {
      const ok = saveGame({
        money: Math.floor(this.player.money),
        health: Math.floor(this.player.health),
        armor: Math.floor(this.player.armor),
        weapon: this.player.weapon,
        ammoPistol: this.player.ammo.pistol,
        ammoSmg: this.player.ammo.smg,
        ownedSmg: !!this.player.owned.smg,
        x: Math.floor(this.player.x),
        y: Math.floor(this.player.y),
        clock: this.clock,
        missionsDone: this.missions.done,
      });
      this.message(ok ? 'Game saved.' : 'Save failed — storage is off.', ok ? '#8fe388' : '#ff8a7a');
      this.hasSave = ok || this.hasSave;
    },
    addHeat(amount, why) {
      addHeat(this, amount, why);
    },
  };

  // Milo's own sedan, parked on the road by the apartment.
  const homeCar = createCar(city, rng, 'sedan', home.x, home.y + 90, Math.PI / 2, null);
  homeCar.color = '#3f6fb5';
  G.cars.push(homeCar);
  // A few parked cars around the city to steal.
  const parked = [
    ['coupe', 1160, 360], ['sedan', 1680, 840], ['sports', 2320, 520],
    ['van', 840, 1480], ['taxi', 1480, 2000], ['coupe', 2640, 1160],
    ['limo', 360, 1480], ['sports', 2960, 840],
  ];
  for (const [type, x, y] of parked) {
    G.cars.push(createCar(city, rng, type, x, y, rng.range(0, Math.PI * 2), null));
  }
  // Pickups: health at the hospital, armour at the gun shop, bribes and cash.
  spawnPickup(G, 'health', city.spots.hospital.x + 40, city.spots.hospital.y + 30, 0);
  spawnPickup(G, 'armor', city.spots.gunshop.x + 40, city.spots.gunshop.y + 30, 0);
  spawnPickup(G, 'ammo', city.spots.gunshop.x - 40, city.spots.gunshop.y + 30, 0);
  spawnPickup(G, 'bribe', 1040, 1480, 0);
  spawnPickup(G, 'bribe', 2320, 1160, 0);
  spawnPickup(G, 'cash', 1800, 1680, 150);
  spawnPickup(G, 'cash', 1160, 2000, 100);
  G.objective = currentObjective(G);
  return G;
}

/** One fixed step of the whole world. 'attract' runs traffic and pedestrians
 *  only, for the title screen backdrop. */
export function stepGame(G, dt, mode = 'play') {
  G.time += dt;
  G.clock += dt * 60;
  if (mode === 'attract') {
    updateVehicles(G, dt);
    updatePeds(G, dt);
    updateCombat(G, dt);
    return;
  }
  updatePlayer(G, dt);
  updateVehicles(G, dt);
  updatePeds(G, dt);
  updatePolice(G, dt);
  updateCombat(G, dt);
  updateMissions(G, dt);
  G.objective = currentObjective(G);
  if (G.player.dead) wastePlayer(G);
  if (G.audio) {
    const speed01 = G.player.car ? Math.abs(G.player.car.speed) / 640 : 0;
    G.audio.update(speed01, G.wanted.stars > 0, dt);
  }
  while (G.messages.length > 0 && G.time - G.messages[0].t > 5) G.messages.shift();
}
