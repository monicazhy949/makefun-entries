// Solmar Bay: the top-down renderer. Sun-soaked city, roads, buildings,
// docks and sea, traffic, pedestrians, rivals, the player and the bullets.
// The camera follows the player and never leaves the city.
import { ROAD_W } from './world.js';

export function cameraFor(G, w, h) {
  const x = Math.max(w / 2, Math.min(G.city.w - w / 2, G.player.x));
  const y = Math.max(h / 2, Math.min(G.city.h - h / 2, G.player.y));
  return { x, y };
}

function drawCar(ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(-24, -10, 48, 24);
  ctx.fillStyle = car.color;
  ctx.beginPath();
  ctx.roundRect(-23, -11, 46, 22, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,30,45,0.85)';
  ctx.fillRect(-6, -9, 14, 18);
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(20, -8, 3, 5);
  ctx.fillRect(20, 3, 3, 5);
  ctx.fillStyle = '#ff5a4e';
  ctx.fillRect(-23, -8, 3, 5);
  ctx.fillRect(-23, 3, 3, 5);
  if (car.driver === 'police') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-14, -11, 10, 22);
    ctx.fillStyle = '#1c5fd6';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLICE', 2, 3);
  }
  if (car.dead) {
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-18, -8);
    ctx.lineTo(18, 8);
    ctx.moveTo(18, -8);
    ctx.lineTo(-18, 8);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawWorld(G, ctx, w, h) {
  const cam = cameraFor(G, w, h);
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  ctx.translate(w / 2 - cam.x, h / 2 - cam.y);
  const view = {
    x0: cam.x - w / 2 - 60,
    y0: cam.y - h / 2 - 60,
    x1: cam.x + w / 2 + 60,
    y1: cam.y + h / 2 + 60,
  };
  // Ground: dry grass and sand.
  ctx.fillStyle = '#b5c48d';
  ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
  // Sea along the east edge, beach beside it.
  ctx.fillStyle = '#e8d5a0';
  ctx.fillRect(2900, view.y0, G.city.w - 2900, view.y1 - view.y0);
  ctx.fillStyle = '#2e7f9e';
  ctx.fillRect(2960, view.y0, G.city.w - 2960, view.y1 - view.y0);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  for (let y = Math.floor(view.y0 / 90) * 90; y < view.y1; y += 90) {
    ctx.fillRect(2970, y, 60, 4);
  }
  // Pier decking.
  ctx.fillStyle = '#a9805a';
  ctx.fillRect(2760, 1420, 190, 120);
  ctx.fillStyle = '#8a6a48';
  for (let x = 2780; x < 2940; x += 40) ctx.fillRect(x, 1420, 3, 120);
  // Roads.
  ctx.fillStyle = '#3d3d46';
  for (const vx of G.city.roadsV) ctx.fillRect(vx - ROAD_W / 2, 0, ROAD_W, G.city.h);
  for (const hy of G.city.roadsH) ctx.fillRect(0, hy - ROAD_W / 2, G.city.w, ROAD_W);
  // Sidewalks.
  ctx.fillStyle = '#cfc4a8';
  for (const vx of G.city.roadsV) {
    ctx.fillRect(vx - ROAD_W / 2 - 8, 0, 8, G.city.h);
    ctx.fillRect(vx + ROAD_W / 2, 0, 8, G.city.h);
  }
  for (const hy of G.city.roadsH) {
    ctx.fillRect(0, hy - ROAD_W / 2 - 8, G.city.w, 8);
    ctx.fillRect(0, hy + ROAD_W / 2, G.city.w, 8);
  }
  // Centre dashes.
  ctx.fillStyle = '#f2c200';
  for (const vx of G.city.roadsV) {
    for (let y = 40; y < G.city.h; y += 80) ctx.fillRect(vx - 2, y, 4, 36);
  }
  for (const hy of G.city.roadsH) {
    for (let x = 40; x < G.city.w; x += 80) ctx.fillRect(x, hy - 2, 36, 4);
  }
  // Buildings.
  for (const b of G.city.buildings) {
    if (b.x > view.x1 || b.y > view.y1 || b.x + b.w < view.x0 || b.y + b.h < view.y0) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(b.x, b.y, b.w, 6);
    ctx.fillStyle = 'rgba(20,30,45,0.55)';
    const cols = Math.max(1, Math.floor(b.w / 34));
    const rows = Math.max(1, Math.floor(b.h / 34));
    for (let i = 0; i < cols; i += 1) {
      for (let j = 0; j < rows; j += 1) {
        ctx.fillRect(b.x + 10 + i * 34, b.y + 12 + j * 34, 14, 12);
      }
    }
  }
  // Named places.
  for (const [key, s] of Object.entries(G.city.spots)) {
    ctx.fillStyle = key === 'pier' ? '#8a6a48' : '#ffffff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1c5fd6';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#12203a';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(s.label, s.x, s.y + 32);
  }
  // Pickups.
  for (const p of G.pickups) {
    if (p.kind === 'case') {
      ctx.fillStyle = '#f2c200';
      ctx.fillRect(p.x - 12, p.y - 9, 24, 18);
      ctx.strokeStyle = '#7a5c00';
      ctx.lineWidth = 2;
      ctx.strokeRect(p.x - 12, p.y - 9, 24, 18);
    } else if (p.kind === 'health') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(p.x - 11, p.y - 11, 22, 22);
      ctx.fillStyle = '#2fae4e';
      ctx.fillRect(p.x - 3, p.y - 9, 6, 18);
      ctx.fillRect(p.x - 9, p.y - 3, 18, 6);
    }
  }
  // Objective marker.
  const obj = G.objective;
  if (obj && obj.target) {
    const pulse = 14 + Math.sin(G.time * 4) * 4;
    ctx.strokeStyle = '#f2c200';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(obj.target.x, obj.target.y - pulse - 14);
    ctx.lineTo(obj.target.x + 10, obj.target.y - pulse);
    ctx.lineTo(obj.target.x, obj.target.y - pulse + 14);
    ctx.lineTo(obj.target.x - 10, obj.target.y - pulse);
    ctx.closePath();
    ctx.stroke();
  }
  // Pedestrians.
  for (const ped of G.peds) {
    if (ped.down > 0) continue;
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(ped.x + Math.cos(ped.angle) * 4, ped.y + Math.sin(ped.angle) * 4, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Rivals.
  for (const r of G.rivals) {
    if (r.down > 0) continue;
    ctx.fillStyle = '#c22e2e';
    ctx.beginPath();
    ctx.arc(r.x, r.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#ffd7d7';
    ctx.fillRect(r.x - 12, r.y - 20, 24, 4);
    ctx.fillStyle = '#c22e2e';
    ctx.fillRect(r.x - 12, r.y - 20, 24 * Math.max(0, r.health / 100), 4);
  }
  // Foot cops.
  for (const f of G.footCops) {
    ctx.fillStyle = '#1c2f6e';
    ctx.beginPath();
    ctx.arc(f.x, f.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('P', f.x, f.y + 3);
  }
  // Cars.
  for (const car of G.cars) {
    if (car.x < view.x0 || car.x > view.x1 || car.y < view.y0 || car.y > view.y1) continue;
    drawCar(ctx, car);
  }
  // Bullets.
  ctx.fillStyle = '#ffe14d';
  for (const b of G.bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // The player on foot.
  const p = G.player;
  if (!p.car) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1c5fd6';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(p.aimAngle) * 22, p.y + Math.sin(p.aimAngle) * 22);
    ctx.stroke();
  }
  ctx.restore();
}
