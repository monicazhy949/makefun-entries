// Browser entry: Solmar Bay. Canvas, title screen, the game loop and
// the pause / help keys. Opens and plays immediately.

import { createGame, updateGame, STEP } from './game.js';
import { drawGame, makeCamera } from './render.js';
import { attachInput } from './input.js';
import { saveGame, loadGame } from './save.js';
import { trySprayShop } from './police.js';
import { takeShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const G = createGame(20261123, null);
G.screen = 'title';
const cam = makeCamera();
let paused = false;
let last = performance.now();
let acc = 0;

const saved = loadGame();
if (saved && saved.done && saved.done.length > 0) {
  G.message(`Save found: ${saved.done.length} jobs done, $${saved.money}`, '#e8c53a');
}

const detach = attachInput(G.input, canvas, (key) => {
  if (key === 'Enter' && G.screen === 'title') {
    G.screen = 'play';
    G.audio.ensure();
    G.audio.click();
  }
  if ((key === 'p' || key === 'P') && G.screen === 'play') {
    paused = !paused;
    G.message(paused ? 'Paused' : 'Back on the street', '#e8e2c8');
  }
  if ((key === 'r' || key === 'R') && G.screen === 'complete') {
    location.reload();
  }
  if ((key === 'f' || key === 'F') && G.screen === 'play') {
    trySprayShop(G);
  }
  if ((key === 'h' || key === 'H') && G.screen === 'play') {
    G.message('WASD drive • E enter car • Click shoot • F Spray & Save • P pause', '#e8e2c8');
  }
  if ((key === 'l' || key === 'L') && G.screen === 'play') {
    const shot = takeShot(canvas, G);
    if (shot) G.message(`Snapshot saved: ${shot.name}`, '#8fe388');
  }
});

function resize() {
  const w = Math.min(window.innerWidth, 1280);
  const h = Math.min(window.innerHeight, 800);
  canvas.width = w;
  canvas.height = h;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
}
window.addEventListener('resize', resize);
resize();

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!paused && G.screen !== 'title') {
    acc += dt;
    let n = 0;
    while (acc >= STEP && n < 5) {
      updateGame(G, STEP);
      acc -= STEP;
      n += 1;
    }
    if (n === 5) acc = 0;
  }
  drawGame(ctx, G, cam, canvas.width, canvas.height);
  // Autosave every ten seconds of play.
  if (G.screen === 'play' && Math.floor(G.time) % 10 === 0 && !G._savedAt) {
    G._savedAt = Math.floor(G.time);
    saveGame(G);
  }
  if (Math.floor(G.time) % 10 !== 0) G._savedAt = 0;
}

requestAnimationFrame(frame);
window.SOLMAR = { G, takeShot, saveGame };
