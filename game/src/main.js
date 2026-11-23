// Solmar Bay: browser bootstrap. Builds the game, wires the canvas and the
// keys, and runs the fixed-step loop. Exposes window.SOLMAR so screenshots
// and playtests can stage the game.
import { createGame, stepGame } from './game.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { drawWorld, cameraFor } from './render.js';
import { drawHud, drawTitle, drawEnd, drawPause } from './hud.js';
import { tryEnterCar, exitCar } from './player.js';
import { playerShoot } from './combat.js';
import { downloadShot } from './shots.js';
import { loadGame, applySave } from './save.js';
import { STEP } from './config.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let W = 1280;
let H = 800;

function resize() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

const audio = createAudio();
const G = createGame(1, audio);
G.input = createInput(canvas);
G.saveState = loadGame();
window.SOLMAR = { G, createGame, stepGame };

let last = performance.now();
let acc = 0;

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (G.screen === 'play') {
    acc += dt;
    while (acc >= STEP) {
      stepGame(G, STEP);
      acc -= STEP;
    }
    const m = G.input.mouse;
    const cam = cameraFor(G, W, H);
    const wx = cam.x - W / 2 + m.x;
    const wy = cam.y - H / 2 + m.y;
    G.player.aimAngle = Math.atan2(wy - G.player.y, wx - G.player.x);
    if (m.down) playerShoot(G);
  }
  drawWorld(G, ctx, W, H);
  if (G.screen === 'title') drawTitle(G, ctx, W, H);
  else if (G.screen === 'busted' || G.screen === 'wasted') drawEnd(G, ctx, W, H);
  else if (G.screen === 'pause') drawPause(G, ctx, W, H);
  else drawHud(G, ctx, W, H);
  requestAnimationFrame(frame);
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Enter') {
    if (G.screen === 'title') {
      G.setScreen('play');
      if (G.audio && G.audio.click) G.audio.click();
    } else if (G.screen === 'busted' || G.screen === 'wasted') {
      G.setScreen('play');
    }
  }
  if (e.code === 'KeyC' && G.screen === 'title' && G.saveState) {
    applySave(G, G.saveState);
    G.setScreen('play');
  }
  if (e.code === 'KeyE' && G.screen === 'play') {
    if (G.player.car) exitCar(G);
    else tryEnterCar(G);
  }
  if (e.code === 'KeyL' && G.screen === 'play') downloadShot(canvas);
  if (e.code === 'KeyP' && (G.screen === 'play' || G.screen === 'pause')) {
    G.setScreen(G.screen === 'play' ? 'pause' : 'play');
  }
  if (G.audio && G.audio.resume) G.audio.resume();
});

requestAnimationFrame(frame);
