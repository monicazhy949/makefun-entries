// The story: nine missions for Vera Solano, each a chain of small steps, plus
// two repeatable side jobs (taxi fares and courier runs). Steps are data in
// config.js; this file runs them and tracks progress.
import { MISSIONS, SIDE_JOBS } from './config.js';
import { createCar } from './vehicles.js';
import { spawnRival, spawnPickup } from './combat.js';
import { addMoney } from './player.js';

export function createMissions(done = []) {
  return {
    done: [...done],
    current: done.length, // index of the next mission to offer
    active: null, // { def, step, timer, data }
    side: null, // { kind, stage, target, timer, passenger }
    kills: 0,
    hasCase: false,
    offerAt: null, // mission marker position while a mission is offered
  };
}

/** Where the next mission starts: Vera's marker moves with the story. */
export function missionStartSpot(G) {
  const spots = G.city.spots;
  const starts = ['hotel', 'docks', 'warehouse', 'garage', 'pier', 'casino', 'taxi', 'warehouse', 'casino'];
  // Street King starts at the Casino, not the garage: the garage sits mid-block
  // and the approach from the Old Town safehouse wedges a car against the
  // buildings south of it; the Casino is a straight run east on the 520 road.
  // The mission still ends at Spray & Save (its last step).
  const id = starts[Math.min(G.missions.current, starts.length - 1)];
  return { spot: id, point: spots[id] };
}

function spotPoint(G, name) {
  return G.city.spots[name] || { x: 1600, y: 1200, label: name };
}

function stepTarget(G, step) {
  if (step.spot) return spotPoint(G, step.spot);
  if (step.type === 'steal' && G.missions.active && G.missions.active.data.car) {
    const car = G.missions.active.data.car;
    return { x: car.x, y: car.y, label: 'Falcon GT' };
  }
  if (step.type === 'pickup') return { x: G.city.spots.pier.x, y: G.city.spots.pier.y, label: 'The case' };
  return null;
}

export function currentObjective(G) {
  const m = G.missions;
  if (m.side) {
    if (m.side.kind === 'taxi') {
      return {
        text: m.side.stage === 'pickup' ? 'Pick up the passenger' : SIDE_JOBS.taxi.text,
        target: m.side.target,
      };
    }
    return { text: `${SIDE_JOBS.courier.text} (${Math.ceil(m.side.timer)}s)`, target: m.side.target };
  }
  if (!m.active) {
    if (m.current >= MISSIONS.length) return { text: 'Story complete — Solmar is yours. Take a taxi fare or just cruise.', target: null };
    const start = missionStartSpot(G);
    return { text: `Go to the V marker (${start.point.label}) to start "${MISSIONS[m.current].title}"`, target: start.point };
  }
  const step = m.active.def.steps[m.active.step];
  let text = step.text;
  if (step.type === 'kill') text = `Take out the Marlowe crew (${m.kills}/${step.count})`;
  if (step.type === 'evade') text = `Survive the chase (${Math.ceil(m.active.timer)}s)`;
  if (step.type === 'wait') text = step.text;
  return { text, target: stepTarget(G, step) };
}

function startStep(G) {
  const m = G.missions;
  const step = m.active.def.steps[m.active.step];
  m.active.timer = step.seconds || 0;
  if (step.type === 'steal') {
    // Park the Falcon GT at the docks.
    const docks = spotPoint(G, 'docks');
    const car = createCar(G.city, G.rng, 'sports', docks.x + 40, docks.y + 20, Math.PI / 2, null);
    car.color = '#c94f43';
    G.cars.push(car);
    m.active.data.car = car;
  }
  if (step.type === 'kill') {
    m.kills = 0;
    const pier = spotPoint(G, 'pier');
    for (let i = 0; i < step.count; i += 1) {
      // Rivals hold the road by the pier (kept on the road, not in buildings).
      spawnRival(G, pier.x + G.rng.range(-20, 20), pier.y + G.rng.range(-120, 120));
    }
  }
  if (step.wanted) {
    G.wanted.heat = Math.max(G.wanted.heat, [0, 12, 32, 55, 76, 92][step.wanted] || 0);
    G.wanted.stars = Math.max(G.wanted.stars, step.wanted);
    G.message(`${'★'.repeat(step.wanted)}  The cops are onto you!`, '#ff8a7a');
  }
  if (step.type === 'pickup') {
    const pier = spotPoint(G, 'pier');
    spawnPickup(G, 'case', pier.x, pier.y, 0); // on the pier marker itself, inside the 26px pickup radius
  }
}

export function startMission(G, index) {
  const def = MISSIONS[index];
  if (!def) return;
  G.missions.active = { def, step: 0, timer: 0, data: {} };
  G.missions.kills = 0;
  G.missions.hasCase = false;
  G.banner(def.title, `${def.giver} — ${def.brief}`);
  G.audio.jingle();
  startStep(G);
}

function completeMission(G) {
  const m = G.missions;
  const def = m.active.def;
  m.done.push(def.id);
  m.current = m.done.length;
  m.active = null;
  addMoney(G, def.reward, `Mission complete: ${def.title}`);
  G.banner('Mission Complete', `${def.title} — $${def.reward}`);
  G.audio.jingle();
  G.stats.missionsDone += 1;
  G.saveProgress();
}

function failMission(G, reason) {
  const m = G.missions;
  const def = m.active.def;
  // Clean up mission entities.
  if (m.active.data.car) {
    const car = m.active.data.car;
    const i = G.cars.indexOf(car);
    if (i !== -1) G.cars.splice(i, 1);
    if (G.player.car === car) {
      G.player.car = null;
      G.player.x = car.x;
      G.player.y = car.y;
    }
  }
  G.rivals.length = 0;
  m.active = null;
  G.banner('Mission Failed', reason);
  G.audio.fail();
  void def;
}

function advanceStep(G) {
  const m = G.missions;
  m.active.step += 1;
  if (m.active.step >= m.active.def.steps.length) {
    completeMission(G);
  } else {
    startStep(G);
  }
}

function updateActiveMission(G, dt) {
  const m = G.missions;
  const step = m.active.def.steps[m.active.step];
  const player = G.player;
  const at = (point, r) => Math.hypot(player.x - point.x, player.y - point.y) < r;

  if (step.type === 'goto' || step.type === 'deliver') {
    const target = stepTarget(G, step);
    if (at(target, step.type === 'deliver' ? 80 : 70)) {
      if (step.type === 'deliver' && player.car !== m.active.data.car) {
        G.message('Bring the Falcon GT here.', '#ffd76a');
        return;
      }
      advanceStep(G);
    }
    return;
  }
  if (step.type === 'wait') {
    m.active.timer -= dt;
    if (m.active.timer <= 0) advanceStep(G);
    return;
  }
  if (step.type === 'steal') {
    if (player.car === m.active.data.car) advanceStep(G);
    return;
  }
  if (step.type === 'kill') {
    if (m.kills >= step.count) advanceStep(G);
    return;
  }
  if (step.type === 'pickup') {
    if (m.hasCase) advanceStep(G);
    return;
  }
  if (step.type === 'lose') {
    if (G.wanted.stars === 0) advanceStep(G);
    return;
  }
  if (step.type === 'evade') {
    m.active.timer -= dt;
    if (m.active.timer <= 0) advanceStep(G);
    return;
  }
  if (step.type === 'escape') {
    const target = stepTarget(G, step);
    if (at(target, 80)) advanceStep(G);
    return;
  }
}

/** Offer the next story mission when the player reaches its marker. */
function checkMissionOffer(G) {
  const m = G.missions;
  if (m.active || m.side || m.current >= MISSIONS.length) return;
  const start = missionStartSpot(G);
  if (Math.hypot(G.player.x - start.point.x, G.player.y - start.point.y) < 70) {
    startMission(G, m.current);
  }
}

export function startTaxiJob(G) {
  const depot = G.city.spots.taxi;
  const p = { x: depot.x + G.rng.range(-160, 160), y: depot.y + G.rng.range(-160, 160) };
  G.missions.side = { kind: 'taxi', stage: 'pickup', target: p, timer: 0, fare: 0 };
  G.message('Taxi fare: pick up the passenger.', '#8fb8e8');
}

export function startCourierJob(G) {
  const spots = G.city.spots;
  const dests = [spots.hotel, spots.casino, spots.hospital, spots.docks];
  const target = dests[G.rng.int(0, dests.length - 1)];
  G.missions.side = { kind: 'courier', stage: 'deliver', target, timer: 75, fare: 0 };
  G.message('Courier run: deliver before the timer ends!', '#8fb8e8');
}

function updateSideJob(G, dt) {
  const side = G.missions.side;
  const player = G.player;
  if (side.kind === 'taxi') {
    if (side.stage === 'pickup') {
      if (Math.hypot(player.x - side.target.x, player.y - side.target.y) < 60) {
        side.stage = 'dropoff';
        const spots = G.city.spots;
        const dests = [spots.casino, spots.hotel, spots.hospital, spots.pier, spots.safehouse];
        side.target = dests[G.rng.int(0, dests.length - 1)];
        side.timer = 90;
        G.message('Passenger aboard — drive to the marker.', '#8fb8e8');
      }
      return;
    }
    side.timer -= dt;
    if (side.timer <= 0) {
      G.missions.side = null;
      G.message('The passenger gave up and walked.', '#ff8a7a');
      return;
    }
    if (Math.hypot(player.x - side.target.x, player.y - side.target.y) < 60) {
      const fare = SIDE_JOBS.taxi.base + Math.round(side.timer * 0.4);
      addMoney(G, fare, 'Taxi fare');
      G.missions.side = null;
      G.audio.jingle();
    }
    return;
  }
  // Courier.
  side.timer -= dt;
  if (side.timer <= 0) {
    G.missions.side = null;
    G.message('Courier run failed — too slow.', '#ff8a7a');
    return;
  }
  if (Math.hypot(player.x - side.target.x, player.y - side.target.y) < 60) {
    const fare = SIDE_JOBS.courier.base + Math.round(side.timer * 0.5);
    addMoney(G, fare, 'Courier run');
    G.missions.side = null;
    G.audio.jingle();
  }
}

export function updateMissions(G, dt) {
  checkMissionOffer(G);
  if (G.missions.active) updateActiveMission(G, dt);
  if (G.missions.side) updateSideJob(G, dt);
  // Fail the active mission if its car is wrecked.
  const m = G.missions;
  if (m.active && m.active.data.car && m.active.data.car.dead) {
    failMission(G, 'The mission car was wrecked.');
  }
  // Hint at side jobs near the taxi depot and the warehouse; main.js acts on F.
  if (!m.active && !m.side) {
    const depot = G.city.spots.taxi;
    const warehouse = G.city.spots.warehouse;
    if (Math.hypot(G.player.x - depot.x, G.player.y - depot.y) < 70) {
      G.hint = 'Press F to take a taxi fare';
    } else if (Math.hypot(G.player.x - warehouse.x, G.player.y - warehouse.y) < 70) {
      G.hint = 'Press F to take a courier run';
    } else {
      G.hint = '';
    }
  }
}

/** Which side job (if any) the player can start here with F. */
export function nearbyJob(G) {
  const m = G.missions;
  if (m.active || m.side) return null;
  const depot = G.city.spots.taxi;
  const warehouse = G.city.spots.warehouse;
  if (Math.hypot(G.player.x - depot.x, G.player.y - depot.y) < 70) return 'taxi';
  if (Math.hypot(G.player.x - warehouse.x, G.player.y - warehouse.y) < 70) return 'courier';
  return null;
}
