// The renderer: a smooth follow camera and every brush stroke of the city —
// water, sand, roads with markings, buildings with shadows and signs, trees,
// cars with headlights and flashing light bars, people, bullets and particles.
// The V marker moves with the story across all nine mission starts.
// Then the HUD and menus on top.
import { PALETTE, ROAD_W, WALK_W, CAR_TYPES } from './config.js';
import { lightState } from './world.js';
import { drawHUD, drawMenu } from './hud.js';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let viewW = 1280;
  let viewH = 800;

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    viewW = w;
    viewH = h;
  }
  window.addEventListener('resize', resize);
  resize();

  function drawGround(G) {
    const c = G.city;
    ctx.fillStyle = PALETTE.ground;
    ctx.fillRect(0, 0, c.width, c.height);
    // Water and beach on the west edge.
    ctx.fillStyle = PALETTE.waterDeep;
    ctx.fillRect(0, 0, c.water.x1, c.height);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(0, 0, c.water.x1 - 8, c.height);
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(c.sand.x0, 0, c.sand.x1 - c.sand.x0, c.height);
    // Parks.
    for (const p of c.parks) {
      ctx.fillStyle = PALETTE.grass;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = PALETTE.grassDark;
      ctx.fillRect(p.x + 10, p.y + 10, p.w - 20, p.h - 20);
    }
    // Sidewalks: pale frames around every block.
    ctx.fillStyle = PALETTE.walk;
    for (const rx of c.roadsV) ctx.fillRect(rx - ROAD_W / 2 - WALK_W, 0, ROAD_W + WALK_W * 2, c.height);
    for (const ry of c.roadsH) ctx.fillRect(0, ry - ROAD_W / 2 - WALK_W, c.width, ROAD_W + WALK_W * 2);
    // Asphalt.
    ctx.fillStyle = PALETTE.asphalt;
    for (const rx of c.roadsV) ctx.fillRect(rx - ROAD_W / 2, 0, ROAD_W, c.height);
    for (const ry of c.roadsH) ctx.fillRect(0, ry - ROAD_W / 2, c.width, ROAD_W);
    // Centre dashes.
    ctx.fillStyle = PALETTE.lane;
    for (const rx of c.roadsV) {
      for (let y = 20; y < c.height; y += 56) ctx.fillRect(rx - 2, y, 4, 28);
    }
    for (const ry of c.roadsH) {
      for (let x = 170; x < c.width; x += 56) ctx.fillRect(x, ry - 2, 28, 4);
    }
    // Crosswalks at every other intersection.
    ctx.fillStyle = 'rgba(232,226,200,0.85)';
    for (let i = 0; i < c.roadsV.length; i += 1) {
      for (let j = 0; j < c.roadsH.length; j += 1) {
        if ((i + j) % 2 !== 0) continue;
        const x = c.roadsV[i];
        const y = c.roadsH[j];
        for (let k = -3; k <= 3; k += 1) {
          ctx.fillRect(x + k * 9 - 3, y - ROAD_W / 2 - 8, 6, 12);
          ctx.fillRect(x + k * 9 - 3, y + ROAD_W / 2 - 4, 6, 12);
        }
      }
    }
    // Traffic lights.
    for (const light of c.lights) {
      const state = lightState(light, G.time);
      ctx.fillStyle = '#22242a';
      ctx.fillRect(light.x + ROAD_W / 2 + 4, light.y - 20, 8, 26);
      ctx.fillStyle = state === 'ns' ? '#37d67a' : '#e5484d';
      ctx.beginPath();
      ctx.arc(light.x + ROAD_W / 2 + 8, light.y - 14, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = state === 'ns' ? '#e5484d' : '#37d67a';
      ctx.beginPath();
      ctx.arc(light.x + ROAD_W / 2 + 8, light.y - 4, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawSkids(G) {
    ctx.strokeStyle = 'rgba(20,20,24,0.35)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    for (const s of G.skids) {
      const a = Math.max(0, s.life / 6);
      ctx.globalAlpha = a * 0.7;
      ctx.beginPath();
      ctx.moveTo(s.x - Math.cos(s.angle) * 10, s.y - Math.sin(s.angle) * 10);
      ctx.lineTo(s.x + Math.cos(s.angle) * 10, s.y + Math.sin(s.angle) * 10);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawBuildings(G) {
    for (const b of G.city.buildings) {
      // Long sun shadow to the south-east.
      ctx.fillStyle = PALETTE.shadow;
      ctx.fillRect(b.x + 8 + b.hgt * 2, b.y + 10 + b.hgt * 2, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      // Roof inset with a lighter edge.
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, 6);
      if (b.glass) {
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        for (let x = b.x + 12; x < b.x + b.w - 12; x += 18) ctx.fillRect(x, b.y + 10, 8, b.h - 20);
      } else {
        // Roof clutter: AC units and skylights.
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(b.x + b.w * 0.2, b.y + b.h * 0.25, 12, 9);
        ctx.fillRect(b.x + b.w * 0.6, b.y + b.h * 0.55, 14, 10);
      }
      if (b.sign && b.w > 90) {
        ctx.fillStyle = 'rgba(20,16,8,0.75)';
        ctx.font = '700 13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(b.sign, b.x + b.w / 2, b.y + b.h / 2);
      }
    }
  }

  function drawTrees(G) {
    for (const t of G.city.trees) {
      ctx.fillStyle = PALETTE.shadow;
      ctx.beginPath();
      ctx.ellipse(t.x + 5, t.y + 6, t.r, t.r * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = t.palm ? '#4d8f3f' : '#3f7d33';
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.arc(t.x - t.r * 0.3, t.y - t.r * 0.3, t.r * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPickups(G) {
    for (const p of G.pickups) {
      const bob = Math.sin(p.bob) * 3;
      const y = p.y + bob;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 8, 10, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      if (p.kind === 'cash') {
        ctx.fillStyle = '#3fae5a';
        ctx.fillRect(p.x - 9, y - 6, 18, 12);
        ctx.fillStyle = '#e8f5d0';
        ctx.font = '700 11px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', p.x, y + 1);
      } else if (p.kind === 'health') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(p.x - 8, y - 8, 16, 16);
        ctx.fillStyle = '#e5484d';
        ctx.fillRect(p.x - 2, y - 6, 4, 12);
        ctx.fillRect(p.x - 6, y - 2, 12, 4);
      } else if (p.kind === 'armor') {
        ctx.fillStyle = '#6fb7ff';
        ctx.beginPath();
        ctx.moveTo(p.x, y - 9);
        ctx.lineTo(p.x + 8, y - 4);
        ctx.lineTo(p.x + 6, y + 7);
        ctx.lineTo(p.x, y + 10);
        ctx.lineTo(p.x - 6, y + 7);
        ctx.lineTo(p.x - 8, y - 4);
        ctx.closePath();
        ctx.fill();
      } else if (p.kind === 'bribe') {
        ctx.fillStyle = '#8fb8e8';
        ctx.beginPath();
        ctx.arc(p.x, y, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★', p.x, y + 1);
      } else if (p.kind === 'case') {
        ctx.fillStyle = '#8a6b3f';
        ctx.fillRect(p.x - 11, y - 7, 22, 14);
        ctx.fillStyle = '#ffd93a';
        ctx.fillRect(p.x - 3, y - 7, 6, 4);
      } else {
        ctx.fillStyle = '#ffd93a';
        ctx.fillRect(p.x - 8, y - 5, 16, 10);
      }
    }
  }

  function drawCarShape(G, car) {
    const def = CAR_TYPES[car.type] || CAR_TYPES.sedan;
    const w = def.w;
    const h = def.h;
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    // Shadow.
    ctx.fillStyle = PALETTE.shadow;
    ctx.beginPath();
    ctx.roundRect(-w / 2 + 4, -h / 2 + 5, w, h, 6);
    ctx.fill();
    // Body.
    ctx.fillStyle = car.color;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Windshield and rear window.
    ctx.fillStyle = 'rgba(30,50,66,0.9)';
    ctx.fillRect(w * 0.08, -h / 2 + 3, w * 0.2, h - 6);
    ctx.fillRect(-w * 0.3, -h / 2 + 3, w * 0.14, h - 6);
    // Roof.
    ctx.fillStyle = car.color;
    ctx.fillRect(-w * 0.12, -h / 2 + 4, w * 0.22, h - 8);
    // Headlights and tail lights.
    ctx.fillStyle = '#fff6c9';
    ctx.fillRect(w / 2 - 3, -h / 2 + 2, 3, 5);
    ctx.fillRect(w / 2 - 3, h / 2 - 7, 3, 5);
    ctx.fillStyle = car.brakeLight ? '#ff2a1a' : '#b03030';
    ctx.fillRect(-w / 2, -h / 2 + 2, 3, 5);
    ctx.fillRect(-w / 2, h / 2 - 7, 3, 5);
    if (car.type === 'taxi') {
      ctx.fillStyle = '#22242a';
      ctx.font = '700 8px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('TAXI', 0, 0);
    }
    if (car.type === 'police') {
      ctx.fillStyle = '#e8e8e8';
      ctx.fillRect(-w * 0.12, -h / 2 + 4, w * 0.22, h - 8);
      // Flashing light bar.
      const phase = Math.sin(car.sirenPhase) > 0;
      ctx.fillStyle = phase ? '#ff3b30' : '#4f8ff7';
      ctx.fillRect(-6, -h / 2 + 2, 12, 5);
      ctx.fillStyle = phase ? '#4f8ff7' : '#ff3b30';
      ctx.fillRect(-6, h / 2 - 7, 12, 5);
      ctx.fillStyle = '#22242a';
      ctx.font = '700 8px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('SBPD', 0, 0);
    }
    // Damage: dents show as dark patches.
    if (car.health < 55) {
      ctx.fillStyle = 'rgba(20,20,20,0.35)';
      ctx.beginPath();
      ctx.arc(w * 0.28, -h * 0.2, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPerson(x, y, angle, shirt, skin, down) {
    ctx.save();
    ctx.translate(x, y);
    if (down) {
      ctx.rotate(angle + Math.PI / 2);
      ctx.fillStyle = PALETTE.shadow;
      ctx.beginPath();
      ctx.ellipse(2, 3, 12, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = shirt;
      ctx.beginPath();
      ctx.ellipse(0, 0, 11, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.arc(11, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    ctx.rotate(angle);
    ctx.fillStyle = PALETTE.shadow;
    ctx.beginPath();
    ctx.ellipse(2, 3, 8, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // Body: shirt circle with a head and shoulders, facing the walk direction.
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(4, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.arc(5.5, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawMarkers(G) {
    // Mission / objective marker: a light beam and a bouncing diamond.
    const obj = G.objective;
    if (obj && obj.target) {
      const t = obj.target;
      const bob = Math.sin(G.time * 4) * 6;
      ctx.fillStyle = 'rgba(255,217,58,0.18)';
      ctx.fillRect(t.x - 16, t.y - 90, 32, 90);
      ctx.save();
      ctx.translate(t.x, t.y - 52 + bob);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#ffd93a';
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1.5;
      ctx.fillRect(-9, -9, 18, 18);
      ctx.strokeRect(-9, -9, 18, 18);
      ctx.restore();
      ctx.fillStyle = 'rgba(255,217,58,0.35)';
      ctx.beginPath();
      ctx.ellipse(t.x, t.y, 26, 10, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Shop markers: small floating signs.
    const signs = [
      { spot: 'garage', label: 'SPRAY', color: '#4fb0a5' },
      { spot: 'gunshop', label: 'ARMS', color: '#e88fb0' },
      { spot: 'safehouse', label: 'HOME', color: '#8fe388' },
    ];
    for (const s of signs) {
      const p = G.city.spots[s.spot];
      ctx.fillStyle = s.color;
      ctx.font = '700 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(s.label, p.x, p.y - 34);
    }
  }

  function drawParticles(G) {
    for (const p of G.particles) {
      const a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = p.kind === 'smoke' ? a * 0.55 : a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (p.kind === 'smoke' ? 1 + (1 - a) : 1), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawBullets(G) {
    ctx.fillStyle = '#ffe9a0';
    for (const b of G.bullets) {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.angle);
      ctx.fillRect(-6, -1.5, 12, 3);
      ctx.restore();
    }
  }

  function updateCamera(G, dt) {
    const cam = G.camera;
    const p = G.player;
    // Look ahead in the drive direction; ease the camera toward the target.
    const lead = p.car ? 90 : 30;
    const tx = p.x + Math.cos(p.angle) * lead - viewW / 2;
    const ty = p.y + Math.sin(p.angle) * lead - viewH / 2;
    const k = Math.min(1, dt * 4.5);
    cam.x += (tx - cam.x) * k;
    cam.y += (ty - cam.y) * k;
    cam.x = Math.max(-80, Math.min(G.city.width - viewW + 80, cam.x));
    cam.y = Math.max(-80, Math.min(G.city.height - viewH + 80, cam.y));
  }

  return {
    view() {
      return { w: viewW, h: viewH };
    },
    worldToScreen(G, x, y) {
      return { x: x - G.camera.x, y: y - G.camera.y };
    },
    screenToWorld(G, x, y) {
      return { x: x + G.camera.x, y: y + G.camera.y };
    },
    draw(G, dt) {
      if (G.screen === 'play' || G.screen === 'paused') updateCamera(G, dt);
      const cam = G.camera;
      ctx.clearRect(0, 0, viewW, viewH);
      ctx.save();
      ctx.translate(-Math.round(cam.x), -Math.round(cam.y));
      drawGround(G);
      drawSkids(G);
      drawBuildings(G);
      drawTrees(G);
      drawPickups(G);
      drawMarkers(G);
      for (const car of G.cars) {
        if (!car.dead) drawCarShape(G, car);
      }
      for (const ped of G.peds) drawPerson(ped.x, ped.y, ped.angle, ped.shirt, ped.skin, ped.state === 'down');
      for (const cop of G.cops) drawPerson(cop.x, cop.y, cop.angle, cop.shirt, cop.skin, cop.down > 0);
      for (const rival of G.rivals) drawPerson(rival.x, rival.y, rival.angle, rival.shirt, rival.skin, rival.down > 0);
      // The player: white shirt, dark cap, a ring so they read at a glance.
      const p = G.player;
      if (!p.car && !p.dead) {
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
        ctx.stroke();
        drawPerson(p.x, p.y, p.angle, '#f2f2f2', '#d9a06b', false);
        // Gun in hand.
        if (p.weapon !== 'fists') {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.aimAngle);
          ctx.fillStyle = '#22242a';
          ctx.fillRect(8, -2, 12, 4);
          ctx.restore();
        }
      }
      drawBullets(G);
      drawParticles(G);
      ctx.restore();
      // The HUD belongs to play (and pause); the title and end screens stay clean.
      if (G.screen === 'play' || G.screen === 'paused') drawHUD(G, ctx, viewW, viewH);
      drawMenu(G, ctx, viewW, viewH);
    },
  };
}
