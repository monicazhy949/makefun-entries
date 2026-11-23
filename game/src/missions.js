// Solmar Bay: missions. Vera Solano's nine jobs, their steps, and the
// objective the HUD and the driver follow.
import { MISSIONS } from './config.js';
import { createCar } from './vehicles.js';
import { saveGame } from './save.js';

export function pushMessage(G, text) {
  G.messages.push({ t: G.time, text });
  if (G.messages.length > 6) G.messages.shift();
}

export function stepTarget(G, step) {
  if (!step) return null;
  if (step.type === 'steal' && G.missions.active && G.missions.active.data.car) {
    const c = G.missions.active.data.car;
    return { x: c.x, y: c.y };
  }
  if (step.type === 'pickup') {
    const cs = G.pickups.find((p) => p.kind === 'case');
    if (cs) return { x: cs.x, y: cs.y };
  }
  if (step.spot && G.city.spots[step.spot]) {
    const s = G.city.spots[step.spot];
    return { x: s.x, y: s.y };
  }
  if (step.target) return step.target;
  return { x: G.player.x, y: G.player.y };
}

export function currentObjective(G) {
  if (G.missions.active) {
    const a = G.missions.active;
    const step = a.def.steps[a.step];
    return {
      text: step.text || a.def.title,
      target: stepTarget(G, step),
      mission: a.def.id,
      step: a.step,
    };
  }
  if (G.missions.current < MISSIONS.length) {
    const def = MISSIONS[G.missions.current];
    const s = G.city.spots[def.start];
    return {
      text: `Meet Vera: ${def.title} ($${def.reward})`,
      target: { x: s.x, y: s.y },
      mission: def.id,
      step: -1,
    };
  }
  return {
    text: 'All missions complete — free roam Solmar Bay',
    target: { x: G.city.spots.safehouse.x, y: G.city.spots.safehouse.y },
    mission: null,
    step: -1,
  };
}

function startMission(G, def) {
  G.missions.active = { def, step: 0, data: {}, t: 0 };
  if (def.heat) G.wanted.heat = def.heat;
  G.missions.kills = 0;
  G.missions.hasCase = false;
  pushMessage(G, `New mission: ${def.title} — $${def.reward}`);
  if (G.audio && G.audio.mission) G.audio.mission();
  onStepStart(G);
}

function onStepStart(G) {
  const a = G.missions.active;
  if (!a) return;
  const step = a.def.steps[a.step];
  if (!step) return;
  a.t = 0;
  if (step.type === 'kill') {
    G.missions.kills = 0;
    const pier = G.city.spots.pier;
    for (let i = 0; i < step.count; i += 1) {
      G.rivals.push({
        x: pier.x + (i - 1) * 70,
        y: pier.y + 60,
        angle: 0,
        health: 100,
        down: 0,
        speed: 0,
        shootT: 1 + i * 0.4,
      });
    }
  } else if (step.type === 'pickup') {
    const t = stepTarget(G, step);
    G.pickups = G.pickups.filter((p) => p.kind !== 'case');
    G.pickups.push({ kind: 'case', x: t.x, y: t.y });
  } else if (step.type === 'steal') {
    const t = stepTarget(G, step);
    // Clear other cars from around the target so the Falcon GT is the
    // nearest car when the player walks up to it. Never move the player's car.
    for (const car of G.cars) {
      if (car.dead || car === G.player.car) continue;
      if (Math.hypot(car.x - t.x, car.y - t.y) < 140) {
        for (let tries = 0; tries < 12; tries += 1) {
          const nx = G.city.roadsV[G.rng.int(0, G.city.roadsV.length - 1)];
          const ny = G.city.roadsH[G.rng.int(0, G.city.roadsH.length - 1)];
          if (Math.hypot(nx - t.x, ny - t.y) > 400) {
            car.x = nx;
            car.y = ny;
            car.angle = 0;
            car.speed = 0;
            break;
          }
        }
      }
    }
    const falcon = createCar(G, 'Falcon GT', t.x, t.y, 0, null);
    falcon.parked = true;
    G.cars.push(falcon);
    a.data.car = falcon;
  }
}

function nextStep(G) {
  const a = G.missions.active;
  a.step += 1;
  a.t = 0;
  if (a.step >= a.def.steps.length) {
    completeMission(G);
    return;
  }
  onStepStart(G);
}

function completeMission(G) {
  const a = G.missions.active;
  G.player.money += a.def.reward;
  G.missions.done.push(a.def.id);
  G.missions.current += 1;
  G.missions.active = null;
  G.missions.hasCase = false;
  pushMessage(G, `Mission complete: ${a.def.title} — $${a.def.reward}`);
  if (G.audio && G.audio.complete) G.audio.complete();
  try {
    saveGame(G);
  } catch (e) {
    // Saving is best-effort; a failed save never blocks the mission.
  }
}

export function updateMissions(G, dt) {
  const M = G.missions;
  // Health pickups lying around the city.
  for (const p of [...G.pickups]) {
    if (p.kind !== 'health') continue;
    if (Math.hypot(G.player.x - p.x, G.player.y - p.y) < 26) {
      G.player.health = 100;
      G.pickups = G.pickups.filter((q) => q !== p);
      pushMessage(G, 'Health restored');
    }
  }
  if (!M.active) {
    if (M.current < MISSIONS.length) {
      const def = MISSIONS[M.current];
      const s = G.city.spots[def.start];
      if (Math.hypot(G.player.x - s.x, G.player.y - s.y) < 90) startMission(G, def);
    }
    return;
  }
  const a = M.active;
  const step = a.def.steps[a.step];
  if (!step) {
    completeMission(G);
    return;
  }
  a.t += dt;
  const t = stepTarget(G, step);
  switch (step.type) {
    case 'goto':
      if (Math.hypot(G.player.x - t.x, G.player.y - t.y) < 80) nextStep(G);
      break;
    case 'wait':
      if (a.t >= (step.seconds || 2)) nextStep(G);
      break;
    case 'evade':
      if (a.t >= (step.seconds || 20)) nextStep(G);
      break;
    case 'lose':
      if (G.wanted.stars === 0) nextStep(G);
      break;
    case 'steal':
      if (G.player.car && G.player.car === a.data.car) nextStep(G);
      break;
    case 'kill':
      if (M.kills >= (step.count || 1)) nextStep(G);
      break;
    case 'pickup': {
      const cs = G.pickups.find((p) => p.kind === 'case');
      if (cs && Math.hypot(G.player.x - cs.x, G.player.y - cs.y) < 26) {
        M.hasCase = true;
        G.pickups = G.pickups.filter((p) => p !== cs);
        if (G.audio && G.audio.pickup) G.audio.pickup();
        nextStep(G);
      }
      break;
    }
    default:
      if (Math.hypot(G.player.x - t.x, G.player.y - t.y) < 80) nextStep(G);
      break;
  }
}
