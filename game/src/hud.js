// Everything drawn on top of the world: health, money, wanted stars, the
// mission objective, the minimap, messages, banners and the menu screens.
// The objective line shows whichever of the nine story missions is active.
// All canvas, so screenshots capture exactly what a player sees.
import { WEAPONS, WEAPON_ORDER } from './config.js';
import { currentObjective } from './missions.js';
import { districtNameAt } from './world.js';

function fmtMoney(n) {
  return `$${Math.floor(n).toLocaleString('en-US')}`;
}

function fmtClock(seconds) {
  const h = Math.floor(seconds / 3600) % 24;
  const m = Math.floor(seconds / 60) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function bar(ctx, x, y, w, h, frac, color, bg) {
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);
}

function text(ctx, str, x, y, font, color, align = 'left') {
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillText(str, x + 2, y + 2);
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

let mapCache = null;
let mapCacheKey = '';

/** The static city layer of the minimap, cached per city seed. */
function cityLayer(G, w, h) {
  const key = `${G.seed}:${w}x${h}`;
  if (mapCache && mapCacheKey === key) return mapCache;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const c = cv.getContext('2d');
  const sx = w / G.city.width;
  const sy = h / G.city.height;
  c.fillStyle = '#c9bd9f';
  c.fillRect(0, 0, w, h);
  c.fillStyle = '#2f9ec4';
  c.fillRect(0, 0, G.city.water.x1 * sx, h);
  c.fillStyle = '#ecd9a4';
  c.fillRect(G.city.water.x1 * sx, 0, (G.city.sand.x1 - G.city.water.x1) * sx, h);
  c.fillStyle = '#79b264';
  for (const p of G.city.parks) c.fillRect(p.x * sx, p.y * sy, p.w * sx, p.h * sy);
  c.fillStyle = '#3d4149';
  for (const rx of G.city.roadsV) c.fillRect((rx - 32) * sx, 0, 64 * sx, h);
  for (const ry of G.city.roadsH) c.fillRect(0, (ry - 32) * sy, w, 64 * sy);
  c.fillStyle = '#8a8272';
  for (const b of G.city.buildings) c.fillRect(b.x * sx, b.y * sy, Math.max(1, b.w * sx), Math.max(1, b.h * sy));
  mapCache = cv;
  mapCacheKey = key;
  return cv;
}

export function drawMinimap(G, ctx, x, y, w, h) {
  ctx.save();
  ctx.fillStyle = 'rgba(10,12,16,0.85)';
  ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
  ctx.drawImage(cityLayer(G, w, h), x, y);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1);
  const sx = w / G.city.width;
  const sy = h / G.city.height;
  const blip = (px, py, r, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + px * sx, y + py * sy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.stroke();
  };
  // Shops and safehouse.
  blip(G.city.spots.garage.x, G.city.spots.garage.y, 3, '#4fb0a5');
  blip(G.city.spots.gunshop.x, G.city.spots.gunshop.y, 3, '#e88fb0');
  blip(G.city.spots.safehouse.x, G.city.spots.safehouse.y, 3, '#8fe388');
  // Mission marker: V for the next mission, yellow diamond for the objective.
  const obj = currentObjective(G);
  if (obj.target) {
    const flashing = Math.sin(G.time * 5) > 0;
    blip(obj.target.x, obj.target.y, flashing ? 5 : 4, '#ffd93a');
  }
  // Cops flash blue/red.
  const copColor = Math.sin(G.time * 10) > 0 ? '#4f8ff7' : '#f74f4f';
  for (const car of G.cars) {
    if (car.driver === 'police' && !car.dead) blip(car.x, car.y, 3, copColor);
  }
  // The player: a white arrow pointing where they face.
  const px = x + G.player.x * sx;
  const py = y + G.player.y * sy;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(G.player.angle);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -4.5);
  ctx.lineTo(-5, 4.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

/** An arrow at the screen edge pointing at an off-screen objective. */
function waypointArrow(G, ctx, w, h) {
  const obj = currentObjective(G);
  if (!obj.target) return;
  const screen = G.worldToScreen(obj.target.x, obj.target.y);
  if (screen.x > 60 && screen.x < w - 60 && screen.y > 60 && screen.y < h - 60) return;
  const cx = w / 2;
  const cy = h / 2;
  const angle = Math.atan2(screen.y - cy, screen.x - cx);
  const ax = cx + Math.cos(angle) * (Math.min(w, h) * 0.36);
  const ay = cy + Math.sin(angle) * (Math.min(w, h) * 0.36);
  const dist = Math.hypot(obj.target.x - G.player.x, obj.target.y - G.player.y);
  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate(angle);
  ctx.fillStyle = '#ffd93a';
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.lineTo(-8, -10);
  ctx.lineTo(-4, 0);
  ctx.lineTo(-8, 10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  text(ctx, `${Math.round(dist)}m`, ax, ay + 16, '700 13px system-ui, sans-serif', '#ffd93a', 'center');
}

export function drawHUD(G, ctx, w, h) {
  const p = G.player;
  // Top-left: health, armour, money, weapon.
  bar(ctx, 16, 16, 200, 12, p.health / 100, '#7ed957', 'rgba(0,0,0,0.55)');
  bar(ctx, 16, 32, 200, 8, p.armor / 100, '#6fb7ff', 'rgba(0,0,0,0.55)');
  text(ctx, fmtMoney(p.money), 16, 48, '700 22px system-ui, sans-serif', '#8fe388');
  const def = WEAPONS[p.weapon];
  const ammo = p.weapon === 'fists' ? '∞' : String(p.ammo[def.ammo] ?? 0);
  text(ctx, `${def.name}  ${ammo}`, 16, 76, '600 15px system-ui, sans-serif', '#ffffff');
  text(ctx, `Q: ${WEAPON_ORDER.map((k) => WEAPONS[k].name).join(' / ')}`, 16, 98, '12px system-ui, sans-serif', 'rgba(255,255,255,0.6)');

  // Objective under the weapon line.
  const obj = currentObjective(G);
  text(ctx, `◆ ${obj.text}`, 16, 122, '600 15px system-ui, sans-serif', '#ffd93a');

  // Top-right: wanted stars, clock, district.
  const stars = G.wanted.stars;
  const starText = stars > 0 ? '★'.repeat(stars) + '☆'.repeat(5 - stars) : 'CLEAN';
  text(ctx, starText, w - 16, 14, '700 24px system-ui, sans-serif', stars > 0 ? '#ffb02a' : '#8fe388', 'right');
  text(ctx, fmtClock(G.clock), w - 16, 46, '600 16px system-ui, sans-serif', '#ffffff', 'right');
  text(ctx, districtNameAt(p.x, p.y), w - 16, 68, '13px system-ui, sans-serif', 'rgba(255,255,255,0.75)', 'right');

  // Messages, top-centre, newest last, fading.
  const now = G.time;
  let my = 16;
  for (let i = Math.max(0, G.messages.length - 4); i < G.messages.length; i += 1) {
    const m = G.messages[i];
    const age = now - m.t;
    if (age > 5) continue;
    ctx.globalAlpha = age > 4 ? 5 - age : 1;
    text(ctx, m.text, w / 2, my, '600 16px system-ui, sans-serif', m.color, 'center');
    ctx.globalAlpha = 1;
    my += 24;
  }

  // Banner: mission titles and big events, centre screen.
  if (G.bannerText && now - G.bannerText.t < 4.5) {
    const age = now - G.bannerText.t;
    ctx.globalAlpha = age > 3.5 ? Math.max(0, 4.5 - age) : 1;
    text(ctx, G.bannerText.title, w / 2, h * 0.24, '800 44px system-ui, sans-serif', '#ffffff', 'center');
    if (G.bannerText.sub) {
      ctx.save();
      ctx.globalAlpha = ctx.globalAlpha * 0.9;
      // Wrap the subtitle to two lines at most.
      const words = G.bannerText.sub.split(' ');
      let line = '';
      let ly = h * 0.24 + 56;
      for (const word of words) {
        if ((line + ' ' + word).length > 62 && line) {
          text(ctx, line, w / 2, ly, '16px system-ui, sans-serif', '#ffd93a', 'center');
          ly += 22;
          line = word;
        } else {
          line = line ? line + ' ' + word : word;
        }
      }
      if (line) text(ctx, line, w / 2, ly, '16px system-ui, sans-serif', '#ffd93a', 'center');
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // Bottom-left: speed in a car, contextual hint, nearby-car prompt.
  if (p.car) {
    const mph = Math.round(Math.abs(p.car.speed) * 0.09);
    text(ctx, `${mph} mph`, 16, h - 44, '700 26px system-ui, sans-serif', '#ffffff');
    text(ctx, p.car.health < 55 ? 'ENGINE SMOKING' : '', 16, h - 70, '700 13px system-ui, sans-serif', '#ff8a7a');
  } else {
    text(ctx, 'E — get in a car', 16, h - 44, '600 14px system-ui, sans-serif', 'rgba(255,255,255,0.75)');
  }
  if (G.hint) text(ctx, G.hint, 16, h - 70, '600 14px system-ui, sans-serif', '#8fb8e8');
  if (G.muted) text(ctx, 'MUTED (M)', 16, h - 96, '600 13px system-ui, sans-serif', 'rgba(255,255,255,0.6)');

  // Minimap, bottom-right.
  drawMinimap(G, ctx, w - 216, h - 166, 200, 150);

  // Waypoint arrow and crosshair.
  waypointArrow(G, ctx, w, h);
  if (!p.car && p.weapon !== 'fists' && G.screen === 'play') {
    const mx = G.input.mouse.x;
    const my2 = G.input.mouse.y;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(mx - 8, my2); ctx.lineTo(mx - 3, my2);
    ctx.moveTo(mx + 3, my2); ctx.lineTo(mx + 8, my2);
    ctx.moveTo(mx, my2 - 8); ctx.lineTo(mx, my2 - 3);
    ctx.moveTo(mx, my2 + 3); ctx.lineTo(mx, my2 + 8);
    ctx.stroke();
  }

  // Damage vignette.
  if (G.lastHurt && now - G.lastHurt < 0.5) {
    ctx.fillStyle = `rgba(200,30,20,${0.25 * (1 - (now - G.lastHurt) / 0.5)})`;
    ctx.fillRect(0, 0, w, h);
  }
}

function overlay(ctx, w, h, alpha) {
  ctx.fillStyle = `rgba(8,10,16,${alpha})`;
  ctx.fillRect(0, 0, w, h);
}

function menuButton(G, ctx, x, y, w, label, hot, id) {
  G.menuButtons.push({ id, x, y, w, h: 40 });
  ctx.fillStyle = hot ? 'rgba(255,217,58,0.9)' : 'rgba(255,255,255,0.12)';
  ctx.fillRect(x, y, w, 40);
  ctx.strokeStyle = hot ? '#ffd93a' : 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, w, 40);
  text(ctx, label, x + w / 2, y + 11, '700 17px system-ui, sans-serif', hot ? '#14100a' : '#ffffff', 'center');
}

function drawHelp(G, ctx, w, h) {
  overlay(ctx, w, h, 0.72);
  text(ctx, 'HOW TO PLAY', w / 2, h * 0.14, '800 34px system-ui, sans-serif', '#ffd93a', 'center');
  const lines = [
    'W A S D / Arrows — drive or walk      Shift — run      Space — handbrake',
    'E — get in / out of a car      Mouse — aim      Click — shoot / punch',
    'Q — switch weapon      H — horn      F — taxi fare / courier / save at home',
    'M — mute      P / Esc — pause      F1 — this help',
    '',
    'Follow the yellow ◆ marker. Steal cars, lose the cops at Spray & Save,',
    'buy guns at Harbor Arms, save at Milo\u2019s apartment. Six story missions.',
  ];
  lines.forEach((line, i) => text(ctx, line, w / 2, h * 0.14 + 60 + i * 30, '16px system-ui, sans-serif', '#ffffff', 'center'));
  text(ctx, 'Press F1 to close', w / 2, h * 0.86, '600 15px system-ui, sans-serif', 'rgba(255,255,255,0.7)', 'center');
}

/** Title, pause, busted, wasted and help screens, drawn over the live city. */
export function drawMenu(G, ctx, w, h) {
  const screen = G.screen;
  G.menuButtons = [];
  if (screen === 'title') {
    overlay(ctx, w, h, 0.45);
    text(ctx, 'SOLMAR BAY', w / 2, h * 0.2, '900 84px system-ui, sans-serif', '#ffffff', 'center');
    text(ctx, 'A SUN-SOAKED OPEN-WORLD CRIME STORY', w / 2, h * 0.2 + 96, '700 19px system-ui, sans-serif', '#ffd93a', 'center');
    text(ctx, 'Milo Reyes owes Vera Solano a favour. The whole city is the payback.', w / 2, h * 0.2 + 128, '16px system-ui, sans-serif', 'rgba(255,255,255,0.85)', 'center');
    const bw = 300;
    const bx = w / 2 - bw / 2;
    menuButton(G, ctx, bx, h * 0.52, bw, G.hasSave ? 'CONTINUE' : 'NEW GAME', true, 'start');
    menuButton(G, ctx, bx, h * 0.52 + 52, bw, 'HOW TO PLAY', false, 'help');
    if (G.hasSave) menuButton(G, ctx, bx, h * 0.52 + 104, bw, 'NEW GAME (erase save)', false, 'new');
    text(ctx, 'WASD drive & walk · E enter car · Mouse aim · Click shoot · P pause', w / 2, h * 0.86, '600 15px system-ui, sans-serif', 'rgba(255,255,255,0.8)', 'center');
    text(ctx, 'An original game. No Rockstar assets, names or places.', w / 2, h * 0.86 + 26, '13px system-ui, sans-serif', 'rgba(255,255,255,0.5)', 'center');
  } else if (screen === 'paused') {
    overlay(ctx, w, h, 0.6);
    text(ctx, 'PAUSED', w / 2, h * 0.24, '800 52px system-ui, sans-serif', '#ffffff', 'center');
    text(ctx, `${fmtMoney(G.player.money)}  ·  Missions done: ${G.missions.done.length}/6  ·  Cars stolen: ${G.stats.carsStolen}`, w / 2, h * 0.24 + 66, '16px system-ui, sans-serif', '#ffd93a', 'center');
    const bw = 300;
    const bx = w / 2 - bw / 2;
    menuButton(G, ctx, bx, h * 0.44, bw, 'RESUME', true, 'resume');
    menuButton(G, ctx, bx, h * 0.44 + 52, bw, 'SAVE GAME', false, 'save');
    menuButton(G, ctx, bx, h * 0.44 + 104, bw, 'QUIT TO TITLE', false, 'quit');
    text(ctx, 'P / Esc — resume', w / 2, h * 0.82, '600 15px system-ui, sans-serif', 'rgba(255,255,255,0.7)', 'center');
  } else if (screen === 'busted' || screen === 'wasted') {
    const title = screen === 'busted' ? 'BUSTED' : 'WASTED';
    const color = screen === 'busted' ? '#6fb7ff' : '#ff6a5a';
    overlay(ctx, w, h, 0.66);
    text(ctx, title, w / 2, h * 0.3, '900 76px system-ui, sans-serif', color, 'center');
    const fine = G.screenData && G.screenData.fine ? G.screenData.fine : 0;
    text(ctx, screen === 'busted' ? `The SBPD caught up with you. Bail: $${fine}.` : `You went down in Solmar Bay. Hospital bill: $${fine}.`, w / 2, h * 0.3 + 92, '17px system-ui, sans-serif', '#ffffff', 'center');
    text(ctx, 'Press Enter to get back on the street', w / 2, h * 0.62, '600 17px system-ui, sans-serif', '#ffd93a', 'center');
  }
  if (G.help) drawHelp(G, ctx, w, h);
}
