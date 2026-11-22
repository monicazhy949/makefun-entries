// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps, and the renderer paints what is there. Screens: title,
// play, paused, busted, wasted. ?seed=N fixes the city; ?shot=chase|drive|
// foot|title (with &seed=N) stages that scene, paints it twice and sets
// window.__shotReady for a screenshot.
import { STEP, WEAPONS, WEAPON_ORDER, PRICES } from './config.js';
import { createGame, stepGame } from './game.js';
import { createRenderer } from './render.js';
import {
  createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_ENTER, ACTION_HORN,
  ACTION_WEAPON, ACTION_MUTE, ACTION_HELP, ACTION_SAVE,
} from './input.js';
import { createAudio } from './audio.js';
import { loadSave } from './save.js';
import { tryEnterCar } from './player.js';
import { trySprayShop } from './police.js';
import { playerShoot } from './combat.js';
import { nearbyJob, startTaxiJob, startCourierJob } from './missions.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
const audio = createAudio();
const input = createInput(canvas);

function announce(message) {
  status.textContent = message;
}

function newGame() {
  const G = createGame(seed, null);
  G.input = input;
  G.audio = audio;
  G.worldToScreen = (x, y) => renderer.worldToScreen(G, x, y);
  G.screenToWorld = (x, y) => renderer.screenToWorld(G, x, y);
  return G;
}

function continueGame() {
  const save = loadSave();
  const G = createGame(seed, save);
  G.input = input;
  G.audio = audio;
  G.worldToScreen = (x, y) => renderer.worldToScreen(G, x, y);
  G.screenToWorld = (x, y) => renderer.screenToWorld(G, x, y);
  return G;
}

function runShot(name) {
  const G = newGame();
  G.screen = stageShot(name, G);
  // Paint many frames before the screenshot: the camera eases to the player
  // over them, so the frame is centred on the action, not on the spawn point.
  let painted = 0;
  function paint() {
    renderer.draw(G, 1 / 60);
    painted += 1;
    if (painted < 90) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let G = newGame();
  G.hasSave = !!loadSave();
  let accumulator = 0;
  let last = performance.now();
  let prevDown = false;

  function startGame(fresh) {
    audio.ensure();
    audio.click();
    G = fresh ? newGame() : continueGame();
    G.hasSave = !!loadSave();
    G.setScreen('play');
    accumulator = 0;
    announce('Playing. Follow the yellow marker.');
    if (fresh) {
      G.banner('SOLMAR BAY', 'Vera Solano needs a driver. Follow the V marker to the Marina Hotel.');
      G.message('WASD drive & walk · E enter car · F1 help', '#ffffff');
    }
  }

  function buyAtGunshop() {
    const p = G.player;
    if (!p.owned.smg && p.money >= PRICES.smg) {
      p.money -= PRICES.smg;
      p.owned.smg = true;
      p.ammo.smg += 120;
      p.weapon = 'smg';
      G.message('Bought the SMG + 120 rounds. -$900', '#8fe388');
      audio.jingle();
    } else if (p.owned.smg && p.ammo.smg < 60 && p.money >= PRICES.smgAmmo) {
      p.money -= PRICES.smgAmmo;
      p.ammo.smg += 120;
      G.message('SMG ammo +120. -$120', '#8fe388');
    } else if (p.money >= PRICES.pistolAmmo) {
      p.money -= PRICES.pistolAmmo;
      p.ammo.pistol += 48;
      G.message('Pistol ammo +48. -$40', '#8fe388');
    } else {
      G.message('Harbor Arms: bring cash.', '#ff8a7a');
    }
  }

  function pressF() {
    const p = G.player;
    const home = G.city.spots.safehouse;
    const garage = G.city.spots.garage;
    const gunshop = G.city.spots.gunshop;
    if (Math.hypot(p.x - home.x, p.y - home.y) < 80) {
      G.saveProgress();
      return;
    }
    if (Math.hypot(p.x - garage.x, p.y - garage.y) < 80) {
      trySprayShop(G);
      return;
    }
    if (Math.hypot(p.x - gunshop.x, p.y - gunshop.y) < 80) {
      buyAtGunshop();
      return;
    }
    const job = nearbyJob(G);
    if (job === 'taxi') startTaxiJob(G);
    else if (job === 'courier') startCourierJob(G);
  }

  function cycleWeapon() {
    const owned = WEAPON_ORDER.filter((k) => G.player.owned[k]);
    const i = owned.indexOf(G.player.weapon);
    G.player.weapon = owned[(i + 1) % owned.length];
    G.message(WEAPONS[G.player.weapon].name, '#ffffff');
    audio.click();
  }

  function clickMenu() {
    const mx = input.mouse.x;
    const my = input.mouse.y;
    for (const b of G.menuButtons) {
      if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) return b.id;
    }
    return null;
  }

  function handleActions() {
    const actions = input.takeActions();
    const clicked = clickMenu();
    if (G.screen === 'title') {
      if (clicked === 'help' || (actions & ACTION_HELP)) {
        G.help = !G.help;
        return;
      }
      if (clicked === 'new') {
        startGame(true);
        return;
      }
      if ((actions & ACTION_CONFIRM) || clicked === 'start') {
        startGame(!G.hasSave);
      }
      return;
    }
    if (G.screen === 'paused') {
      if (clicked === 'resume' || (actions & ACTION_PAUSE)) {
        G.setScreen('play');
        announce('Playing.');
      } else if (clicked === 'save') {
        G.saveProgress();
      } else if (clicked === 'quit') {
        G = newGame();
        G.hasSave = !!loadSave();
        G.setScreen('title');
      } else if (actions & ACTION_CONFIRM) {
        G.setScreen('play');
      }
      return;
    }
    if (G.screen === 'busted' || G.screen === 'wasted') {
      if (actions & ACTION_CONFIRM) {
        G.setScreen('play');
        announce('Back on the street.');
      }
      return;
    }
    // Playing.
    if (actions & ACTION_PAUSE) {
      G.setScreen('paused');
      announce('Paused.');
      return;
    }
    if (actions & ACTION_ENTER) tryEnterCar(G);
    if (actions & ACTION_HORN) audio.horn();
    if (actions & ACTION_WEAPON) cycleWeapon();
    if (actions & ACTION_MUTE) {
      G.muted = !G.muted;
      audio.setMuted(G.muted);
      G.message(G.muted ? 'Sound off' : 'Sound on', '#ffffff');
    }
    if (actions & ACTION_HELP) G.help = !G.help;
    if (actions & ACTION_SAVE) pressF();
  }

  function handleFiring() {
    if (G.screen !== 'play' || G.player.car || G.player.dead) {
      prevDown = input.mouse.down;
      return;
    }
    const def = WEAPONS[G.player.weapon];
    const edge = input.mouse.down && !prevDown;
    prevDown = input.mouse.down;
    if (def.auto ? input.mouse.down : edge) playerShoot(G);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    handleFiring();
    if (G.screen === 'title') {
      // Attract mode: the city lives behind the title, camera drifting.
      while (accumulator >= STEP) {
        stepGame(G, STEP, 'attract');
        accumulator -= STEP;
      }
      G.camera.x = 1150 + Math.sin(G.time * 0.07) * 320;
      G.camera.y = 420 + Math.cos(G.time * 0.05) * 220;
    } else if (G.screen === 'play') {
      while (accumulator >= STEP) {
        stepGame(G, STEP, 'play');
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(G, 1 / 60);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && G.screen === 'play') {
      G.setScreen('paused');
      announce('Paused.');
    }
  });

  announce('Solmar Bay. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
