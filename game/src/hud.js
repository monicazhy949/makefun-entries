// Solmar Bay: the HUD — money, health, wanted stars, objective, messages,
// minimap and speed — plus the title, busted, wasted and pause screens.
import { MISSIONS } from './config.js';

function drawMinimap(G, ctx, w, h) {
  const size = 150;
  const x0 = w - size - 16;
  const y0 = 16;
  const sx = size / G.city.w;
  const sy = size / G.city.h;
  ctx.fillStyle = 'rgba(10,16,28,0.75)';
  ctx.fillRect(x0, y0, size, size);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x0, y0, size, size);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  for (const vx of G.city.roadsV) {
    ctx.beginPath();
    ctx.moveTo(x0 + vx * sx, y0);
    ctx.lineTo(x0 + vx * sx, y0 + size);
    ctx.stroke();
  }
  for (const hy of G.city.roadsH) {
    ctx.beginPath();
    ctx.moveTo(x0, y0 + hy * sy);
    ctx.lineTo(x0 + size, y0 + hy * sy);
    ctx.stroke();
  }
  ctx.fillStyle = '#2e7f9e';
  ctx.fillRect(x0 + 2960 * sx, y0, size - 2960 * sx, size);
  const obj = G.objective;
  if (obj && obj.target) {
    ctx.fillStyle = '#f2c200';
    ctx.beginPath();
    ctx.arc(x0 + obj.target.x * sx, y0 + obj.target.y * sy, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const car of G.cars) {
    if (car.driver !== 'police' || car.dead) continue;
    ctx.fillStyle = '#ff5a4e';
    ctx.fillRect(x0 + car.x * sx - 2, y0 + car.y * sy - 2, 4, 4);
  }
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x0 + G.player.x * sx, y0 + G.player.y * sy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1c5fd6';
  ctx.lineWidth = 2;
  ctx.stroke();
}

export function drawHud(G, ctx, w, h) {
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  // Objective bar.
  const obj = G.objective;
  ctx.fillStyle = 'rgba(10,16,28,0.72)';
  ctx.fillRect(16, 16, 430, 44);
  ctx.fillStyle = '#f2c200';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(obj ? obj.text : '', 28, 35);
  ctx.fillStyle = '#ffffff';
  ctx.font = '13px sans-serif';
  const mission = G.missions.active ? G.missions.active.def : null;
  ctx.fillText(
    mission ? `${mission.title}  •  $${mission.reward}` : `Missions done: ${G.missions.done.length}/${MISSIONS.length}`,
    28, 53,
  );
  // Money and health.
  ctx.fillStyle = 'rgba(10,16,28,0.72)';
  ctx.fillRect(16, 68, 220, 56);
  ctx.fillStyle = '#7ed07e';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(`$${Math.floor(G.player.money).toLocaleString('en-US')}`, 28, 92);
  ctx.fillStyle = '#333';
  ctx.fillRect(28, 100, 160, 10);
  ctx.fillStyle = G.player.health > 30 ? '#7ed07e' : '#e85a4e';
  ctx.fillRect(28, 100, 160 * Math.max(0, G.player.health / 100), 10);
  // Wanted stars.
  ctx.fillStyle = 'rgba(10,16,28,0.72)';
  ctx.fillRect(16, 132, 220, 34);
  ctx.font = '20px sans-serif';
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < G.wanted.stars ? '#f2c200' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', 28 + i * 34, 157);
  }
  // Minimap.
  drawMinimap(G, ctx, w, h);
  // Messages.
  ctx.font = '14px sans-serif';
  let my = h - 96;
  for (const m of G.messages) {
    ctx.fillStyle = 'rgba(10,16,28,0.72)';
    const tw = ctx.measureText(m.text).width;
    ctx.fillRect(16, my - 16, tw + 20, 22);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(m.text, 26, my);
    my += 26;
  }
  // Speed and controls.
  if (G.player.car) {
    ctx.fillStyle = 'rgba(10,16,28,0.72)';
    ctx.fillRect(w - 166, h - 60, 150, 44);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(Math.abs(G.player.car.speed) * 0.6)} mph`, w - 28, h - 30);
    ctx.textAlign = 'left';
  }
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '12px sans-serif';
  ctx.fillText('WASD drive / walk   E enter car   Click shoot   L snapshot   P pause', 16, h - 16);
}

export function drawTitle(G, ctx, w, h) {
  ctx.fillStyle = 'rgba(8,12,24,0.62)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f2c200';
  ctx.font = 'bold 84px sans-serif';
  ctx.fillText('SOLMAR BAY', w / 2, h / 2 - 70);
  ctx.fillStyle = '#ffffff';
  ctx.font = '26px sans-serif';
  ctx.fillText('An open-world crime story in the sun', w / 2, h / 2 - 24);
  ctx.font = '17px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('Nine jobs for Vera Solano. Steal cars, dodge the law, take the score.', w / 2, h / 2 + 16);
  ctx.fillText('WASD drive and walk  •  E enter a car  •  Mouse aims, click shoots  •  L snapshot', w / 2, h / 2 + 52);
  const save = G.saveState;
  ctx.fillStyle = '#7ed07e';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(save ? 'Press ENTER to play  •  Press C to continue your save' : 'Press ENTER to play', w / 2, h / 2 + 100);
  ctx.textAlign = 'left';
}

export function drawEnd(G, ctx, w, h) {
  ctx.fillStyle = 'rgba(8,12,24,0.6)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText(G.screen === 'busted' ? 'BUSTED' : 'WASTED', w / 2, h / 2 - 20);
  ctx.font = '20px sans-serif';
  ctx.fillText('Press ENTER to get back on the street', w / 2, h / 2 + 30);
  ctx.textAlign = 'left';
}

export function drawPause(G, ctx, w, h) {
  void G;
  ctx.fillStyle = 'rgba(8,12,24,0.6)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 48px sans-serif';
  ctx.fillText('PAUSED', w / 2, h / 2);
  ctx.font = '18px sans-serif';
  ctx.fillText('Press P to resume', w / 2, h / 2 + 40);
  ctx.textAlign = 'left';
}
