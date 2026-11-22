// The renderer: paints the room, the watchers and their cones, the loot, the
// thief and the HUD on one canvas, and the title, pause, game-over and getaway
// screens over it. Everything is drawn from shapes: the game ships no images.
// Safe cover reads green, danger reads amber and red, loot reads gold.

import { CAMERA, FIELD, FONT, GUARD, PALETTE, THIEF, TOOLS } from './config.js';
import { TOOL_ORDER } from './tools.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const TOOL_BUTTONS = [
  { name: 'coin', x: 912, y: 10, width: 104, height: 44 },
  { name: 'smoke', x: 1024, y: 10, width: 104, height: 44 },
  { name: 'emp', x: 1136, y: 10, width: 104, height: 44 },
];

/** The gadget whose HUD button holds (x, y), or null. */
export function toolAtPoint(x, y) {
  for (const button of TOOL_BUTTONS) {
    if (x >= button.x && x <= button.x + button.width && y >= button.y && y <= button.y + button.height) {
      return button.name;
    }
  }
  return null;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  let vignette = null;

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    scale = Math.min(width / FIELD.width, height / FIELD.height) * dpr;
    offsetX = (width * dpr - FIELD.width * scale) / 2;
    offsetY = (height * dpr - FIELD.height * scale) / 2;
    const gradient = ctx.createRadialGradient(
      canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) * 0.45,
      canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) * 0.75,
    );
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.45)');
    vignette = gradient;
  }
  window.addEventListener('resize', resize);
  resize();

  /** Map a pointer position on the canvas to field coordinates. */
  function toField(clientX, clientY) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    return {
      x: (clientX * dpr - offsetX) / scale,
      y: (clientY * dpr - offsetY) / scale,
    };
  }

  function draw(state, screen, best) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    drawRoom(state);
    drawExit(state);
    drawLoot(state);
    drawSmoke(state);
    drawCoins(state);
    for (const camera of state.cameras) drawCameraCone(camera, state);
    for (const guard of state.guards) drawGuardCone(guard, state);
    drawWalls(state);
    for (const camera of state.cameras) drawCamera(camera, state);
    for (const guard of state.guards) drawGuard(guard, state);
    drawThief(state);
    drawHud(state, screen);
    if (state.banner) drawBanner(state.banner, state.caughtFreeze > 0);
    if (vignette) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    }
    if (screen === SCREEN_TITLE) drawTitleScreen(state, best);
    else if (screen === SCREEN_PAUSED) drawPauseScreen();
    else if (screen === SCREEN_OVER) drawOverScreen(state, best);
    else if (screen === SCREEN_WIN) drawWinScreen(state, best);
  }

  function drawRoom(state) {
    const level = state.level;
    ctx.fillStyle = PALETTE.floor;
    ctx.fillRect(0, FIELD.hudHeight, FIELD.width, FIELD.height - FIELD.hudHeight);
    ctx.strokeStyle = PALETTE.floorLine;
    ctx.lineWidth = 1;
    for (let x = 64; x < FIELD.width; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, FIELD.hudHeight);
      ctx.lineTo(x, FIELD.height);
      ctx.stroke();
    }
    for (let y = FIELD.hudHeight + 64; y < FIELD.height; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(FIELD.width, y);
      ctx.stroke();
    }
    // The prize rests on a carpet, so the eye finds it at once.
    const target = level.target;
    ctx.fillStyle = PALETTE.carpet;
    roundRect(target.x - 110, target.y - 80, 220, 160, 12);
    ctx.fill();
    ctx.strokeStyle = PALETTE.wallTrim;
    ctx.lineWidth = 2;
    ctx.stroke();
    for (const patch of level.cover) {
      ctx.fillStyle = PALETTE.cover;
      roundRect(patch.x, patch.y, patch.width, patch.height, 14);
      ctx.fill();
      ctx.fillStyle = PALETTE.coverLeaf;
      for (let i = 0; i < 5; i += 1) {
        const lx = patch.x + 16 + ((i * 37) % Math.max(1, patch.width - 32));
        const ly = patch.y + 14 + ((i * 53) % Math.max(1, patch.height - 28));
        ctx.beginPath();
        ctx.arc(lx, ly, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /** Walls paint after the cones, so a cone reads as blocked by a wall. */
  function drawWalls(state) {
    for (const wall of state.level.walls) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(wall.x + 4, wall.y + 5, wall.width, wall.height);
      ctx.fillStyle = PALETTE.wall;
      ctx.fillRect(wall.x, wall.y, wall.width, wall.height);
      ctx.fillStyle = PALETTE.wallTrim;
      ctx.fillRect(wall.x, wall.y, wall.width, 4);
    }
    // Border walls frame the room.
    ctx.fillStyle = PALETTE.wall;
    ctx.fillRect(0, FIELD.hudHeight, FIELD.width, 10);
    ctx.fillRect(0, FIELD.height - 10, FIELD.width, 10);
    ctx.fillRect(0, FIELD.hudHeight, 10, FIELD.height - FIELD.hudHeight);
    ctx.fillRect(FIELD.width - 10, FIELD.hudHeight, 10, FIELD.height - FIELD.hudHeight);
  }

  function drawExit(state) {
    const exit = state.level.exit;
    const open = state.exitOpen;
    ctx.save();
    if (open) {
      ctx.shadowColor = PALETTE.exit;
      ctx.shadowBlur = 18 + 8 * Math.sin(state.time * 4);
    }
    ctx.fillStyle = open ? PALETTE.exit : PALETTE.exitDark;
    roundRect(exit.x, exit.y, exit.width, exit.height, 6);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#0b0e1a';
    ctx.font = `bold 13px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(open ? 'EXIT' : 'LOCKED', exit.x + exit.width / 2, exit.y + exit.height / 2 + 5);
  }

  function drawLoot(state) {
    for (const item of state.loot) {
      if (item.taken) continue;
      glow(item.x, item.y, 26, 'rgba(242, 201, 76, 0.25)');
      ctx.fillStyle = PALETTE.loot;
      if (item.kind === 'cash') {
        ctx.fillRect(item.x - 11, item.y - 7, 22, 14);
        ctx.fillStyle = '#1d7a4a';
        ctx.fillRect(item.x - 11, item.y - 2, 22, 4);
      } else if (item.kind === 'gold') {
        roundRect(item.x - 12, item.y - 7, 24, 14, 3);
        ctx.fill();
      } else {
        diamond(item.x, item.y, 10);
        ctx.fill();
      }
    }
    if (!state.targetTaken) {
      const target = state.level.target;
      const pulse = 1 + 0.08 * Math.sin(state.time * 3);
      glow(target.x, target.y, 44, 'rgba(191, 243, 255, 0.3)');
      ctx.strokeStyle = PALETTE.gold;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(target.x, target.y, 24 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = PALETTE.target;
      diamond(target.x, target.y, 16 * pulse);
      ctx.fill();
      ctx.fillStyle = PALETTE.text;
      ctx.font = `bold 13px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(target.name, target.x, target.y - 32);
    }
  }

  function drawSmoke(state) {
    for (const cloud of state.smoke) {
      const fade = Math.min(1, cloud.ttl);
      ctx.fillStyle = `rgba(160, 165, 180, ${0.5 * fade})`;
      ctx.beginPath();
      ctx.arc(cloud.x, cloud.y, cloud.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(200, 205, 215, ${0.35 * fade})`;
      ctx.beginPath();
      ctx.arc(cloud.x - 20, cloud.y - 12, cloud.radius * 0.6, 0, Math.PI * 2);
      ctx.arc(cloud.x + 24, cloud.y + 10, cloud.radius * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCoins(state) {
    for (const coin of state.coins) {
      ctx.strokeStyle = PALETTE.gold;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(coin.x, coin.y, 12 + 6 * Math.sin(state.time * 6), 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath();
      ctx.arc(coin.x, coin.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawGuardCone(guard, state) {
    ctx.fillStyle = guard.seesThief ? PALETTE.suspiciousCone : state.alert ? PALETTE.alertCone : PALETTE.guardCone;
    ctx.beginPath();
    ctx.moveTo(guard.x, guard.y);
    ctx.arc(guard.x, guard.y, GUARD.coneRange, guard.angle - GUARD.coneHalfAngle, guard.angle + GUARD.coneHalfAngle);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = PALETTE.guardConeEdge;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function drawCameraCone(camera, state) {
    if (state.time < camera.disabledUntil) return;
    ctx.fillStyle = PALETTE.cameraCone;
    ctx.beginPath();
    ctx.moveTo(camera.x, camera.y);
    ctx.arc(camera.x, camera.y, CAMERA.coneRange, camera.angle - CAMERA.coneHalfAngle, camera.angle + CAMERA.coneHalfAngle);
    ctx.closePath();
    ctx.fill();
  }

  function drawGuard(guard, state) {
    ctx.fillStyle = state.alert ? '#a33' : PALETTE.guard;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, GUARD.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.thiefRim;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = PALETTE.thiefRim;
    ctx.beginPath();
    ctx.moveTo(guard.x, guard.y);
    ctx.lineTo(guard.x + Math.cos(guard.angle) * 18, guard.y + Math.sin(guard.angle) * 18);
    ctx.stroke();
    if (guard.seesThief) {
      ctx.fillStyle = PALETTE.danger;
      ctx.font = `bold 20px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('!', guard.x, guard.y - 20);
    }
  }

  function drawCamera(camera, state) {
    const off = state.time < camera.disabledUntil;
    ctx.fillStyle = off ? PALETTE.cameraOff : PALETTE.camera;
    ctx.fillRect(camera.x - 9, camera.y - 6, 18, 12);
    ctx.beginPath();
    ctx.arc(camera.x + Math.cos(camera.angle) * 8, camera.y + Math.sin(camera.angle) * 8, 5, 0, Math.PI * 2);
    ctx.fill();
    if (off) {
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `bold 10px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('OFF', camera.x, camera.y + 22);
    }
  }

  function drawThief(state) {
    const thief = state.thief;
    const inCover = state.level.cover.some(
      (patch) => thief.x >= patch.x && thief.x <= patch.x + patch.width && thief.y >= patch.y && thief.y <= patch.y + patch.height,
    );
    if (inCover) {
      ctx.strokeStyle = 'rgba(61, 220, 132, 0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(thief.x, thief.y, THIEF.radius + 5, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = thief.sneaking ? 0.85 : 1;
    ctx.fillStyle = THIEF_COLOR;
    ctx.beginPath();
    ctx.arc(thief.x, thief.y, THIEF.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.thiefRim;
    ctx.lineWidth = 2;
    ctx.stroke();
    // The burgundy beret and the pale mask stripe mark the thief at a glance.
    ctx.fillStyle = '#7a2e3a';
    ctx.beginPath();
    ctx.arc(thief.x, thief.y - 3, THIEF.radius - 3, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.thiefRim;
    ctx.beginPath();
    ctx.moveTo(thief.x - 5, thief.y + 1);
    ctx.lineTo(thief.x + 5, thief.y + 1);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawHud(state, screen) {
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(0, 0, FIELD.width, FIELD.hudHeight);
    ctx.fillStyle = PALETTE.wallTrim;
    ctx.fillRect(0, FIELD.hudHeight - 2, FIELD.width, 2);
    // Lives, as little masks.
    for (let i = 0; i < state.lives; i += 1) {
      ctx.fillStyle = THIEF_COLOR;
      ctx.beginPath();
      ctx.arc(28 + i * 30, 32, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = PALETTE.thiefRim;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `bold 20px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(`$${state.score}`, 130, 40);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `12px ${FONT}`;
    ctx.fillText(state.level.name, 130, 56);
    drawAlarmMeter(state);
    drawToolButtons(state, screen);
  }

  function drawAlarmMeter(state) {
    const x = 470;
    const y = 20;
    const width = 330;
    const height = 22;
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 12px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(state.alert ? 'ALARM — RUN!' : 'ALARM', x, y - 6);
    ctx.fillStyle = '#22283a';
    roundRect(x, y, width, height, 6);
    ctx.fill();
    const ratio = state.alarm / 100;
    ctx.fillStyle = ratio < 0.5 ? '#3ddc84' : ratio < 0.8 ? '#f2c94c' : '#ff5a5a';
    if (ratio > 0) {
      roundRect(x, y, Math.max(12, width * ratio), height, 6);
      ctx.fill();
    }
    ctx.strokeStyle = state.alarm >= 80 ? PALETTE.danger : PALETTE.wallTrim;
    ctx.lineWidth = state.alarm >= 80 ? 2.5 : 1.5;
    roundRect(x, y, width, height, 6);
    ctx.stroke();
  }

  function drawToolButtons(state, screen) {
    for (const button of TOOL_BUTTONS) {
      const tool = TOOLS[button.name];
      const selected = state.tool === button.name;
      const afford = state.score >= tool.cost;
      ctx.fillStyle = selected ? '#3a2f10' : 'rgba(30, 34, 52, 0.9)';
      roundRect(button.x, button.y, button.width, button.height, 8);
      ctx.fill();
      ctx.strokeStyle = selected ? PALETTE.gold : afford ? PALETTE.wallTrim : '#444a5e';
      ctx.lineWidth = selected ? 2.5 : 1.5;
      roundRect(button.x, button.y, button.width, button.height, 8);
      ctx.stroke();
      ctx.fillStyle = afford ? PALETTE.text : PALETTE.muted;
      ctx.font = `bold 13px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(`[${tool.key}] ${tool.name}`, button.x + button.width / 2, button.y + 19);
      ctx.fillStyle = PALETTE.gold;
      ctx.font = `12px ${FONT}`;
      ctx.fillText(`$${tool.cost}`, button.x + button.width / 2, button.y + 36);
    }
    void screen;
  }

  function drawBanner(text, danger) {
    ctx.fillStyle = danger ? 'rgba(163, 20, 20, 0.85)' : PALETTE.panel;
    ctx.font = `bold ${danger ? 34 : 20}px ${FONT}`;
    const width = ctx.measureText(text).width + 48;
    roundRect((FIELD.width - width) / 2, 92, width, danger ? 64 : 44, 10);
    ctx.fill();
    ctx.fillStyle = danger ? '#fff' : PALETTE.text;
    ctx.textAlign = 'center';
    ctx.fillText(text, FIELD.width / 2, danger ? 132 : 121);
  }

  function drawTitleScreen(state, best) {
    dim();
    panel(240, 110, 800, 500);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `bold 52px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('THE VELVET VAULT', FIELD.width / 2, 185);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `20px ${FONT}`;
    ctx.fillText('A midnight museum heist in three rooms', FIELD.width / 2, 220);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `15px ${FONT}`;
    const lines = [
      'The plan: take each room\u2019s prize, then reach the exit. Guards patrol with',
      'vision cones and cameras sweep the halls — cross a cone and the alarm fills.',
      'Shadow patches hide you. Gadgets cost loot: coins turn a guard away,',
      'smoke blinds every watcher, an EMP knocks the cameras out.',
      '',
      'Move  WASD / arrows      Sneak  Shift      Gadget  1 / 2 / 3, then click to place',
      'Use at your feet  Space      Pause  P      Click a gadget button to pick it up',
    ];
    lines.forEach((line, i) => ctx.fillText(line, FIELD.width / 2, 262 + i * 24));
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `bold 19px ${FONT}`;
    ctx.fillText('Press Enter or click to start the job', FIELD.width / 2, 470);
    if (best > 0) {
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `14px ${FONT}`;
      ctx.fillText(`Best loot so far: $${best}`, FIELD.width / 2, 500);
    }
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `13px ${FONT}`;
    ctx.fillText('Three rooms · The Ruby · The Sapphire · The Velvet Diamond', FIELD.width / 2, 560);
  }

  function drawPauseScreen() {
    dim();
    panel(440, 280, 400, 160);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 34px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', FIELD.width / 2, 340);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `16px ${FONT}`;
    ctx.fillText('Press P or Enter to slip back in', FIELD.width / 2, 385);
  }

  function drawOverScreen(state, best) {
    dim();
    panel(340, 200, 600, 320);
    ctx.fillStyle = PALETTE.danger;
    ctx.font = `bold 40px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('THE JOB IS BLOWN', FIELD.width / 2, 270);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `18px ${FONT}`;
    ctx.fillText(`Loot kept: $${state.score}   ·   Best: $${Math.max(best, state.score)}`, FIELD.width / 2, 320);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `15px ${FONT}`;
    ctx.fillText('The guards were faster this time. Study the cones, then go again.', FIELD.width / 2, 355);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `bold 19px ${FONT}`;
    ctx.fillText('Press Enter or click to plan the next job', FIELD.width / 2, 420);
  }

  function drawWinScreen(state, best) {
    dim();
    panel(300, 150, 680, 420);
    ctx.fillStyle = PALETTE.exit;
    ctx.font = `bold 40px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('CLEAN GETAWAY', FIELD.width / 2, 220);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `20px ${FONT}`;
    ctx.fillText(`Total loot: $${state.score}   ·   Gadgets spent: $${state.spent}`, FIELD.width / 2, 268);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `bold 22px ${FONT}`;
    ctx.fillText(state.rank, FIELD.width / 2, 312);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `15px ${FONT}`;
    ctx.fillText(`Time on the job: ${Math.floor(state.time / 60)}:${String(Math.floor(state.time % 60)).padStart(2, '0')}   ·   Best: $${Math.max(best, state.score)}`, FIELD.width / 2, 348);
    ctx.fillText('The Velvet Diamond is yours. The museum never knew you were there.', FIELD.width / 2, 382);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `bold 19px ${FONT}`;
    ctx.fillText('Press Enter or click to run it again', FIELD.width / 2, 450);
  }

  function dim() {
    ctx.fillStyle = 'rgba(5, 6, 14, 0.72)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function panel(x, y, width, height) {
    ctx.fillStyle = 'rgba(16, 19, 34, 0.95)';
    roundRect(x, y, width, height, 16);
    ctx.fill();
    ctx.strokeStyle = PALETTE.wallTrim;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function glow(x, y, radius, colour) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  function diamond(x, y, size) {
    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.lineTo(x + size * 0.8, y);
    ctx.lineTo(x, y + size);
    ctx.lineTo(x - size * 0.8, y);
    ctx.closePath();
  }

  function roundRect(x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
  }

  return { draw, toField, resize };
}

const THIEF_COLOR = '#17171f';
