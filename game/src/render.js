// Rendering: a sun-soaked 2D city on canvas, with a chase camera.
// Everything is drawn from the game state; there are no image assets.

import { drawHUD } from './hud.js';

export function makeCamera() {
  return { x: 0, y: 0, zoom: 1, w: 1280, h: 800 };
}

function updateCamera(cam, G) {
  const p = G.player;
  const tx = p.x - cam.w / 2;
  const ty = p.y - cam.h / 2;
  cam.x += (tx - cam.x) * 0.12;
  cam.y += (ty - cam.y) * 0.12;
}

function drawCar(ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fillRect(-22, -11, 46, 24);
  ctx.fillStyle = car.color;
  roundRect(ctx, -22, -12, 44, 24, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(20, 26, 34, 0.9)';
  ctx.fillRect(-6, -10, 16, 20);
  ctx.fillStyle = '#e8e2c8';
  ctx.fillRect(18, -9, 3, 4);
  ctx.fillRect(18, 5, 3, 4);
  if (car.siren) {
    const on = Math.floor(car.sirenPhase) % 2 === 0;
    ctx.fillStyle = on ? '#ff3b30' : '#3b82ff';
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  if (car.health < 100) {
    ctx.fillStyle = '#3a3f4a';
    ctx.fillRect(-22, -18, 44, 4);
    ctx.fillStyle = car.health > 30 ? '#7ee787' : '#ff6b5e';
    ctx.fillRect(-22, -18, 44 * (car.health / 100), 4);
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawPerson(ctx, x, y, angle, shirt, skin, down) {
  ctx.save();
  ctx.translate(x, y);
  if (down) {
    ctx.rotate(1.4);
    ctx.fillStyle = shirt;
    ctx.fillRect(-9, -5, 18, 10);
  } else {
    ctx.rotate(angle);
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.arc(3, 0, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawGame(ctx, G, cam, W, H) {
  cam.w = W;
  cam.h = H;
  updateCamera(cam, G);
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#2e3d24';
  ctx.fillRect(0, 0, W, H);
  ctx.translate(-cam.x, -cam.y);

  const city = G.city;
  // Water on the east edge.
  ctx.fillStyle = '#1d4e6b';
  ctx.fillRect(city.water.x, city.water.y, city.water.w, city.water.h);
  // Parks.
  ctx.fillStyle = '#3d6b34';
  for (const pk of city.parks) ctx.fillRect(pk.x, pk.y, pk.w, pk.h);
  // Roads.
  ctx.fillStyle = '#33363e';
  for (const r of city.roadsV) ctx.fillRect(r - city.roadHalf, 0, city.roadHalf * 2, city.height);
  for (const r of city.roadsH) ctx.fillRect(0, r - city.roadHalf, city.width, city.roadHalf * 2);
  ctx.strokeStyle = '#e8c53a';
  ctx.lineWidth = 2;
  ctx.setLineDash([18, 22]);
  for (const r of city.roadsV) {
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(r, city.height);
    ctx.stroke();
  }
  for (const r of city.roadsH) {
    ctx.beginPath();
    ctx.moveTo(0, r);
    ctx.lineTo(city.width, r);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // Buildings, with lit windows.
  for (const b of city.buildings) {
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(b.x, b.y + b.h - 6, b.w, 6);
    ctx.fillStyle = 'rgba(255, 220, 120, 0.55)';
    const cols = Math.max(1, Math.floor(b.w / 34));
    const rows = Math.max(1, Math.floor(b.h / 34));
    for (let i = 0; i < cols; i += 1) {
      for (let j = 0; j < rows; j += 1) {
        if ((i * 7 + j * 13 + b.hgt) % 5 === 0) {
          ctx.fillRect(b.x + 8 + i * 34, b.y + 8 + j * 34, 12, 10);
        }
      }
    }
  }
  // Named places, marked with a letter.
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const s of Object.values(city.spots)) {
    ctx.fillStyle = 'rgba(232, 197, 58, 0.9)';
    ctx.beginPath();
    ctx.arc(s.x, s.y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#20242e';
    ctx.fillText(s.label[0], s.x, s.y - 4);
    ctx.fillStyle = 'rgba(232, 226, 200, 0.85)';
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillText(s.label, s.x, s.y + 26);
    ctx.font = 'bold 13px system-ui, sans-serif';
  }
  ctx.textAlign = 'left';

  // The drop crate, when a delivery step is live.
  const m = G.missions.active;
  if (m && m.step && m.step.type === 'goto' && m.def.id === 'the-drop' && m.step.target === 'pier') {
    const pier = city.spots.pier;
    ctx.fillStyle = '#8a6b3a';
    ctx.fillRect(pier.x - 12, pier.y - 12, 24, 24);
    ctx.strokeStyle = '#e8c53a';
    ctx.strokeRect(pier.x - 12, pier.y - 12, 24, 24);
  }
  // Mission target ring, pulsing.
  const target = missionTarget(G);
  if (target) {
    const pulse = 26 + Math.sin(G.time * 4) * 6;
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(target.x, target.y, pulse, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Pedestrians, then cars, then cops on foot, rivals, bullets, player.
  for (const ped of G.peds) {
    drawPerson(ctx, ped.x, ped.y, ped.angle, ped.shirt, ped.skin, false);
  }
  for (const car of G.cars) {
    if (car.driver === 'player') continue;
    drawCar(ctx, car);
  }
  if (G.player.car) drawCar(ctx, G.player.car);
  for (const cop of G.cops) {
    drawPerson(ctx, cop.x, cop.y, cop.angle, cop.shirt, cop.skin, cop.down > 0);
  }
  for (const r of G.rivals) {
    if (r.health <= 0) continue;
    drawPerson(ctx, r.x, r.y, r.angle, r.shirt, r.skin, false);
    ctx.fillStyle = '#3a3f4a';
    ctx.fillRect(r.x - 14, r.y - 20, 28, 4);
    ctx.fillStyle = '#ff6b5e';
    ctx.fillRect(r.x - 14, r.y - 20, 28 * (r.health / 60), 4);
  }
  ctx.fillStyle = '#ffd23f';
  for (const b of G.bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const e of G.effects) {
    if (e.kind !== 'boom') continue;
    const k = e.t / e.life;
    ctx.fillStyle = `rgba(255, ${Math.round(180 - 120 * k)}, 40, ${1 - k})`;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius * (0.5 + k * 0.7), 0, Math.PI * 2);
    ctx.fill();
  }
  const p = G.player;
  if (!p.car && !p.dead) {
    drawPerson(ctx, p.x, p.y, p.angle, '#e8e2c8', '#d9a06b', false);
    // Aim line while shooting.
    if (G.input && G.input.mouse && G.input.mouse.down) {
      ctx.strokeStyle = 'rgba(255, 210, 63, 0.6)';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + Math.cos(p.angle) * 120, p.y + Math.sin(p.angle) * 120);
      ctx.stroke();
    }
  }

  ctx.restore();
  drawHUD(ctx, G, cam, W, H);
  drawScreens(ctx, G, W, H);
}

function missionTarget(G) {
  const mm = G.missions.active;
  if (!mm || !mm.step) return null;
  if (mm.step.type === 'goto' || mm.step.type === 'steal') {
    return G.city.spots[mm.step.target] || null;
  }
  return null;
}

function drawScreens(ctx, G, W, H) {
  if (G.screen === 'title') {
    ctx.fillStyle = 'rgba(8, 10, 16, 0.82)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e8c53a';
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.fillText('SOLMAR BAY', W / 2, H / 2 - 90);
    ctx.fillStyle = '#e8e2c8';
    ctx.font = '22px system-ui, sans-serif';
    ctx.fillText('An open-world crime story in the sun', W / 2, H / 2 - 48);
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText('WASD drive & walk  •  E get in a car  •  Mouse aim, click to shoot', W / 2, H / 2 + 10);
    ctx.fillText('Nine jobs for Vera Solano. Mind the SBPD.', W / 2, H / 2 + 38);
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText('Press ENTER to start', W / 2, H / 2 + 90);
    ctx.textAlign = 'left';
    return;
  }
  if (G.screen === 'busted' || G.screen === 'wasted') {
    ctx.fillStyle = 'rgba(8, 10, 16, 0.7)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff6b5e';
    ctx.font = 'bold 56px system-ui, sans-serif';
    ctx.fillText(G.screen === 'busted' ? 'BUSTED' : 'WASTED', W / 2, H / 2 - 10);
    ctx.fillStyle = '#e8e2c8';
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText('The SBPD takes its cut and drops you off.', W / 2, H / 2 + 30);
    ctx.textAlign = 'left';
    return;
  }
  if (G.screen === 'complete') {
    ctx.fillStyle = 'rgba(8, 10, 16, 0.82)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#7ee787';
    ctx.font = 'bold 48px system-ui, sans-serif';
    ctx.fillText('STREET KING', W / 2, H / 2 - 40);
    ctx.fillStyle = '#e8e2c8';
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText(`All nine jobs done. Final take: $${G.player.money.toLocaleString('en-US')}`, W / 2, H / 2 + 10);
    ctx.fillText('Solmar Bay is yours.', W / 2, H / 2 + 42);
    ctx.textAlign = 'left';
  }
}
