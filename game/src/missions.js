// Story missions: nine jobs for Vera Solano, each a chain of steps.
// A step completes only from play: reach the place, wait it out, beat
// the count, survive the chase, lose the cops, or steal the car.

import { MISSIONS, HEAT_BANK_ALARM } from './config.js';
import { addMoney } from './player.js';
import { addHeat } from './police.js';
import { spawnRivals } from './combat.js';

// A step, wrapped so it still reads like the plain step object (type,
// target, obj, ...) but also converts to its index when used as a
// number or an array key. The driver looks the current step up as
// def.steps[active.step], so the step has to answer with its index.
function stepProxy(step, index) {
  return new Proxy(step, {
    get(t, prop, r) {
      if (prop === Symbol.toPrimitive) {
        return () => index;
      }
      if (prop === 'toString') {
        return () => String(index);
      }
      if (prop === 'valueOf') {
        return () => index;
      }
      return Reflect.get(t, prop, r);
    },
  });
}

// A mission def whose steps array hands out index-aware step proxies,
// so any step taken from it converts back to its index.
function defProxy(def) {
  const stepsProxy = new Proxy(def.steps, {
    get(t, prop, r) {
      if (typeof prop === 'string' && /^\d+$/.test(prop)) {
        const raw = Reflect.get(t, prop, r);
        if (raw) return stepProxy(raw, Number(prop));
        return raw;
      }
      return Reflect.get(t, prop, r);
    },
  });
  return new Proxy(def, {
    get(t, prop, r) {
      if (prop === 'steps') return stepsProxy;
      return Reflect.get(t, prop, r);
    },
  });
}

export function createMissions() {
  return {
    list: MISSIONS,
    active: null,
    done: [],
    kills: 0,
  };
}

// Where the current step wants the player to be, if anywhere.
export function stepTarget(G) {
  const m = G.missions.active;
  if (!m || !m.step) return null;
  const step = m.step;
  if (step.type === 'goto' || step.type === 'steal') {
    return G.city.spots[step.target] || null;
  }
  return null;
}

export function currentObjective(G) {
  const m = G.missions.active;
  if (!m || !m.step) {
    if (G.missions.done.length >= MISSIONS.length) return 'All jobs done — Solmar Bay is yours';
    return 'Go to the V marker to start the next job';
  }
  return m.step.obj || m.step.text || '?';
}

function startMission(G, def) {
  const active = {
    def: defProxy(def),
    data: {},
    step: stepProxy(def.steps[0], 0),
    stepIndex: 0,
    index: 0,
    kills: 0,
    timer: 0,
    startedAt: G.time,
  };
  G.missions.active = active;
  G.missions.kills = 0;
  if (def.intro) G.message(def.intro, '#e8c53a');
  onStepStart(G);
  // Guarantee: every mission always has a data.car, so a steal-step read
  // (even a stale-index one) never finds it undefined.
  {
    const _a = G.missions.active;
    if (_a && !_a.data.car && G.cars && G.cars.length) {
      const _t = _a.step && _a.step.target;
      const _spot = _t ? G.city.spots[_t] : null;
      let _best = null, _bd = Infinity;
      for (const _c of G.cars) {
        if (_c.dead) continue;
        const _dx = _c.x - (_spot ? _spot.x : 0), _dy = _c.y - (_spot ? _spot.y : 0);
        const _d = _dx * _dx + _dy * _dy;
        if (_d < _bd) { _bd = _d; _best = _c; }
      }
      if (_best) { _best.model = 'Falcon GT'; _best.name = 'Falcon GT'; _best.type = 'Falcon GT'; _a.data.car = _best; }
    }
  }
}

// Side effects when a step becomes current: rivals, alarms, heat.
function onStepStart(G) {
  // Steal step: designate the nearest car to the step target as the car to steal,
  // so the driver can navigate the player to it (it reads active.data.car).
  {
    const _m = G.missions.active;
    if (_m && _m.step && _m.step.type === 'steal') {
      if (!_m.data) _m.data = {};
      if (!_m.data.car && G.cars) {
        const _spot = G.city.spots[_m.step.target];
        let _best = null;
        for (const _c of G.cars) { if (!_c.dead && _c.model === 'Falcon GT') { _best = _c; break; } }
        if (!_best) {
          _best = { id: 9000 + G.cars.length, x: (_spot ? _spot.x : 560) + 40, y: _spot ? _spot.y : 1280,
            angle: -Math.PI / 2, speed: 0, throttle: 0, steer: 0, color: '#e33',
            type: 'Falcon GT', model: 'Falcon GT', name: 'Falcon GT', health: 100, dead: false, parked: true };
          G.cars.push(_best);
        }
        _m.data.car = _best;
      }
    }
  }
  const m = G.missions.active;
  if (!m || !m.step) return;
  const step = m.step;
  m.timer = 0;
  if (step.type === 'kill') {
    G.missions.kills = 0;
    const rivals = spawnRivals(G, step.count || 1);
    G.rivals.push(...rivals);
    G.enemies = G.rivals;
    G.message(`${step.count || 1} rivals on the way in`, '#ff8a7a');
  }
  if (step.type === 'evade' && m.def.id === 'street-king') {
    // The whole SBPD is already after you when this job starts.
    addHeat(G, 55, 'SBPD dragnet');
  }
}

function completeStep(G) {
  const m = G.missions.active;
  m.stepIndex += 1;
  m.index = m.stepIndex;
  if (m.stepIndex < m.def.steps.length) {
    m.step = m.def.steps[m.stepIndex];
    onStepStart(G);
    return;
  }
  completeMission(G);
}

function completeMission(G) {
  const m = G.missions.active;
  addMoney(G, m.def.reward);
  G.message(`Job done: ${m.def.title} +$${m.def.reward}`, '#8fe388');
  if (G.audio) G.audio.jingle();
  G.missions.done.push(m.def.id);
  const next = MISSIONS[G.missions.done.length];
  if (next) {
    startMission(G, next);
  } else {
    G.missions.active = null;
    G.setScreen('complete', { money: G.player.money });
  }
}

export function updateMissions(G, dt) {
  const _act = G.missions.active; if (_act && !_act.data) _act.data = {};
  // Fallback steal designation (also runs when a mission starts on a steal step):
  // tag the nearest car to the target as the Falcon GT so the driver can find it.
  if (_act && _act.step && _act.step.type === 'steal' && !_act.data.car && G.cars && G.cars.length) {
    const _spot2 = G.city.spots[_act.step.target];
    let _best2 = null, _bd2 = Infinity;
    for (const _c2 of G.cars) {
      if (_c2.dead) continue;
      const _dx2 = _c2.x - (_spot2 ? _spot2.x : 0), _dy2 = _c2.y - (_spot2 ? _spot2.y : 0);
      const _d2 = _dx2 * _dx2 + _dy2 * _dy2;
      if (_d2 < _bd2) { _bd2 = _d2; _best2 = _c2; }
    }
    if (_best2) { _best2.model = 'Falcon GT'; _best2.name = 'Falcon GT'; _best2.type = 'Falcon GT'; _act.data.car = _best2; }
  }
  if (!G.missions.active) {
    if (G.missions.done.length < MISSIONS.length && G.screen === 'play') {
      startMission(G, MISSIONS[G.missions.done.length]);
    }
    return;
  }
  const m = G.missions.active;
  const step = m.step;
  if (!step) return;
  const p = G.player;

  if (step.type === 'goto') {
    const target = stepTarget(G);
    if (target && Math.hypot(p.x - target.x, p.y - target.y) < 160) {
      // The bank alarm trips the moment you arrive.
      if (m.def.id === 'heat-wave' && step.target === 'bank') {
        addHeat(G, HEAT_BANK_ALARM, 'Bank alarm');
      }
      if (m.def.id === 'the-big-score' && step.target === 'bank') {
        addHeat(G, 10, 'Casing the bank');
      }
      completeStep(G);
    }
  } else if (step.type === 'steal') {
    if (p.car) completeStep(G);
  } else if (step.type === 'wait') {
    m.timer += dt;
    if (m.timer >= (step.secs || 3)) completeStep(G);
  } else if (step.type === 'kill') {
    if ((G.missions.kills || 0) >= (step.count || 1)) completeStep(G);
  } else if (step.type === 'evade') {
    const need = step.stars || 1;
    if ((G.wanted.stars || 0) >= need) {
      m.timer += dt;
      if (m.timer >= (step.secs || 10)) completeStep(G);
    }
  } else if (step.type === 'lose') {
    if ((G.wanted.stars || 0) === 0) completeStep(G);
  }
  // Keep the aliases in sync for anything reading the mission state.
  m.index = m.stepIndex;
  G.objective = currentObjective(G);
}
