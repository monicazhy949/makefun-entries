// HUD: money, health, wanted stars, objective, minimap and messages,
// drawn on the same canvas as the game.

export function drawHUD(ctx, G, cam, W, H) {
  const p = G.player;
  ctx.save();
  ctx.textBaseline = 'top';

  // Money and health, top left.
  ctx.fillStyle = 'rgba(10, 12, 18, 0.72)';
  ctx.fillRect(12, 12, 210, 64);
  ctx.strokeStyle = 'rgba(232, 226, 200, 0.35)';
  ctx.strokeRect(12, 12, 210, 64);
  ctx.fillStyle = '#7ee787';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText(`$${p.money.toLocaleString('en-US')}`, 22, 20);
  ctx.fillStyle = '#e8e2c8';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText(`HEALTH ${Math.round(p.health)}`, 22, 48);
  ctx.fillStyle = '#3a3f4a';
  ctx.fillRect(22, 66, 150, 6);
  ctx.fillStyle = p.health > 30 ? '#7ee787' : '#ff6b5e';
  ctx.fillRect(22, 66, Math.max(0, 150 * (p.health / 100)), 6);
  if (p.armor > 0) {
    ctx.fillStyle = '#7fb7ff';
    ctx.fillText(`ARMOR ${Math.round(p.armor)}`, 180, 48);
  }

  // Wanted stars, top centre. They flash while the heat is on.
  const stars = G.wanted.stars;
  const flash = stars > 0 && Math.floor(G.wanted.flash * 3) % 2 === 0;
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < stars ? (flash ? '#ff8a7a' : '#ffd23f') : 'rgba(232, 226, 200, 0.25)';
    ctx.fillText('★', W / 2 - 60 + i * 30, 12);
  }
  ctx.textAlign = 'left';
  if (stars > 0) {
    ctx.fillStyle = '#ff8a7a';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText('WANTED', W / 2 - 32, 48);
  }

  // Objective and current job, top right.
  const obj = G.objective || '';
  ctx.fillStyle = 'rgba(10, 12, 18, 0.72)';
  const boxW = 300;
  ctx.fillRect(W - boxW - 12, 12, boxW, 64);
  ctx.strokeStyle = 'rgba(232, 226, 200, 0.35)';
  ctx.strokeRect(W - boxW - 12, 12, boxW, 64);
  const m = G.missions.active;
  ctx.fillStyle = '#e8c53a';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText(m ? `${m.def.title}  •  $${m.def.reward}` : 'SOLMAR BAY', W - boxW, 20);
  ctx.fillStyle = '#e8e2c8';
  ctx.font = '13px system-ui, sans-serif';
  wrapText(ctx, obj, W - boxW, 40, boxW - 20, 16);

  // Messages, centre top.
  ctx.textAlign = 'center';
  let my = 92;
  for (const msg of G.messages.slice(-3)) {
    ctx.fillStyle = msg.color || '#e8e2c8';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(msg.text, W / 2, my);
    my += 20;
  }
  ctx.textAlign = 'left';

  // Speed, bottom left, when driving.
  if (p.car) {
    ctx.fillStyle = 'rgba(10, 12, 18, 0.72)';
    ctx.fillRect(12, H - 56, 120, 44);
    ctx.fillStyle = '#e8e2c8';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText(`${Math.round(Math.abs(p.car.speed) * 0.9)}`, 22, H - 48);
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('km/h', 66, H - 44);
    ctx.fillStyle = '#ff6b5e';
    ctx.fillText(`CAR ${Math.round(p.car.health)}`, 22, H - 22);
  }

  drawMinimap(ctx, G, W - 172, H - 172, 160);
  ctx.restore();
}

function wrapText(ctx, text, x, y, maxW, lh) {
  const words = String(text).split(' ');
  let line = '';
  let yy = y;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = w;
      yy += lh;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}

// Minimap: roads, places, the player, the cops and the job marker.
export function drawMinimap(ctx, G, x, y, size) {
  const city = G.city;
  const scale = size / city.width;
  ctx.save();
  ctx.fillStyle = 'rgba(10, 12, 18, 0.78)';
  ctx.fillRect(x - 6, y - 6, size + 12, size + 12);
  ctx.strokeStyle = 'rgba(232, 226, 200, 0.4)';
  ctx.strokeRect(x - 6, y - 6, size + 12, size + 12);
  ctx.beginPath();
  ctx.rect(x, y, size, size);
  ctx.clip();
  ctx.fillStyle = '#232a1e';
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = '#e8c53a';
  for (const r of city.water ? [city.water] : []) {
    ctx.fillStyle = '#1d4e6b';
    ctx.fillRect(x + r.x * scale, y + r.y * scale, r.w * scale, r.h * scale);
  }
  ctx.strokeStyle = '#5a5f6b';
  ctx.lineWidth = 2;
  for (const r of city.roadsV) {
    ctx.beginPath();
    ctx.moveTo(x + r * scale, y);
    ctx.lineTo(x + r * scale, y + size);
    ctx.stroke();
  }
  for (const r of city.roadsH) {
    ctx.beginPath();
    ctx.moveTo(x, y + r * scale);
    ctx.lineTo(x + size, y + r * scale);
    ctx.stroke();
  }
  // Job target marker.
  const target = missionTarget(G);
  if (target) {
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.arc(x + target.x * scale, y + target.y * scale, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Cops in red, player in white.
  ctx.fillStyle = '#ff6b5e';
  for (const car of G.cars) {
    if (car.driver !== 'police') continue;
    ctx.fillRect(x + car.x * scale - 2, y + car.y * scale - 2, 4, 4);
  }
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x + G.player.x * scale, y + G.player.y * scale, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function missionTarget(G) {
  const m = G.missions.active;
  if (!m || !m.step) return null;
  if (m.step.type === 'goto' || m.step.type === 'steal') {
    return G.city.spots[m.step.target] || null;
  }
  return null;
}
