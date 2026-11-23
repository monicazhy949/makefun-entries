// Solmar Bay: sound. A small WebAudio synth for engine hum, shots, pickups
// and mission stings. In Node (or any place without an AudioContext) every
// method is a no-op, so the game still runs headless.
function noopAudio() {
  const noop = () => {};
  return {
    update: noop,
    shoot: noop,
    pickup: noop,
    mission: noop,
    complete: noop,
    wasted: noop,
    busted: noop,
    click: noop,
    resume: noop,
  };
}

export function createAudio() {
  if (typeof window === 'undefined' || !window.AudioContext) return noopAudio();
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  try {
    ctx = new window.AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.25;
    master.connect(ctx.destination);
  } catch (e) {
    return noopAudio();
  }

  function blip(freq, dur, type, vol, when) {
    try {
      const t0 = ctx.currentTime + (when || 0);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'square';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol || 0.2, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch (e) {
      // Sound never blocks the game.
    }
  }

  function startEngine() {
    if (engineOsc) return;
    try {
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
    } catch (e) {
      engineOsc = null;
    }
  }

  return {
    resume() {
      try {
        if (ctx.state === 'suspended') void ctx.resume();
      } catch (e) {
        // Ignore.
      }
    },
    update(speed01, wanted, dt) {
      void dt;
      startEngine();
      if (!engineOsc || !engineGain) return;
      try {
        engineOsc.frequency.value = 55 + speed01 * 45 + (wanted ? 8 : 0);
        engineGain.gain.value = 0.02 + speed01 * 0.05;
      } catch (e) {
        // Ignore.
      }
    },
    shoot() {
      blip(220, 0.08, 'square', 0.25);
      blip(110, 0.12, 'sawtooth', 0.15, 0.01);
    },
    pickup() {
      blip(660, 0.1, 'sine', 0.25);
      blip(880, 0.14, 'sine', 0.25, 0.09);
    },
    mission() {
      blip(440, 0.12, 'triangle', 0.25);
      blip(554, 0.12, 'triangle', 0.25, 0.1);
    },
    complete() {
      blip(523, 0.12, 'triangle', 0.25);
      blip(659, 0.12, 'triangle', 0.25, 0.1);
      blip(784, 0.2, 'triangle', 0.3, 0.2);
    },
    wasted() {
      blip(330, 0.25, 'sawtooth', 0.2);
      blip(220, 0.35, 'sawtooth', 0.2, 0.2);
    },
    busted() {
      blip(392, 0.15, 'square', 0.2);
      blip(311, 0.15, 'square', 0.2, 0.14);
      blip(392, 0.25, 'square', 0.2, 0.28);
    },
    click() {
      blip(880, 0.05, 'sine', 0.15);
    },
  };
}
