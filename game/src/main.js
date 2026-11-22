// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between five screens: title,
// play, paused, game over and the getaway.
//
// ?seed=N fixes the game. ?shot=plan|cover|escape|caught (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, LIVES, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  EVENT_ALERT,
  EVENT_CAUGHT,
  EVENT_CLEAR,
  EVENT_LOOT,
  EVENT_OVER,
  EVENT_TARGET,
  EVENT_WIN,
  createWorld,
  rankForRun,
} from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_USE, createInput } from './input.js';
import {
  SCREEN_OVER,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_WIN,
  createRenderer,
  toolAtPoint,
} from './render.js';
import { stageShot } from './shots.js';
import { createAudio } from './audio.js';
import { canAfford, useTool } from './tools.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  window.__heist = { world, screen: scene.screen };
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas, (x, y) => renderer.toField(x, y));
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Three rooms, three prizes. Stay out of the cones.');
  }

  function endGame(win) {
    screen = win ? SCREEN_WIN : SCREEN_OVER;
    const state = world.state;
    if (win) {
      state.rank = rankForRun(state.alertCount, LIVES - state.lives);
      audio.win();
    }
    if (state.score > best) {
      best = state.score;
      saveBest(best);
    }
    audio.stopAlarm();
    announce(win ? `Clean getaway. Loot $${state.score}.` : `Caught. Loot $${state.score}.`);
  }

  function handleEvents(events) {
    if (events & EVENT_LOOT) audio.pickup();
    if (events & EVENT_TARGET) audio.prize();
    if (events & EVENT_CAUGHT) audio.caught();
    if (events & EVENT_CLEAR) audio.roomClear();
    if (events & EVENT_WIN) endGame(true);
    else if (events & EVENT_OVER) endGame(false);
  }

  function handleClicks() {
    const click = input.takeClick();
    if (!click || screen !== SCREEN_PLAY) return;
    const button = toolAtPoint(click.x, click.y);
    if (button) {
      world.state.tool = button;
      return;
    }
    const tool = world.state.tool;
    if (!canAfford(world.state, tool)) return;
    if (useTool(world.state, tool, click.x, click.y)) {
      if (tool === 'coin') audio.coin();
      else if (tool === 'smoke') audio.smoke();
      else audio.emp();
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    const toolKey = input.takeToolKey();
    if (toolKey && screen === SCREEN_PLAY) world.state.tool = toolKey;
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN)) {
      audio.unlock();
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      audio.stopAlarm();
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    if (actions & ACTION_USE && screen === SCREEN_PLAY) {
      const state = world.state;
      const tool = state.tool;
      if (!canAfford(state, tool)) return;
      const thief = state.thief;
      const ahead = tool === 'coin'
        ? { x: thief.x + Math.cos(thief.angle) * 130, y: thief.y + Math.sin(thief.angle) * 130 }
        : { x: thief.x, y: thief.y };
      if (useTool(state, tool, ahead.x, ahead.y)) {
        if (tool === 'coin') audio.coin();
        else if (tool === 'smoke') audio.smoke();
        else audio.emp();
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleClicks();
    handleActions();
    if (screen === SCREEN_TITLE) {
      while (accumulator >= STEP) {
        world.step(STEP, { x: 0, y: 0 }, false);
        accumulator -= STEP;
      }
    } else if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP) {
        const events = world.step(STEP, input.move(), input.sneaking());
        accumulator -= STEP;
        handleEvents(events);
        if (screen !== SCREEN_PLAY) break;
      }
      audio.alarm(world.state.alarm, world.state.alert);
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting guards close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      audio.stopAlarm();
      announce('Paused.');
    }
  });

  // A handle for play-testing: the smoke test reads the live state through it.
  window.__heist = {
    world,
    get screen() {
      return screen;
    },
  };

  announce('The Velvet Vault. Press Enter or click to start the job.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
