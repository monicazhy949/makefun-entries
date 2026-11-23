// All sound is synthesized with WebAudio — no audio files, nothing to load.
// Engine hum, siren, gunshots, explosions and UI blips, each a few oscillators.
// All nine missions share the same jingle; complete/fail cues are reused, not per-mission.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      // Engine: a sawtooth through a lowpass, pitch follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // Siren: a triangle that wails between two notes.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 720;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function noiseBurst(duration, volume, filterFreq, type = 'lowpass') {
    if (!ctx || muted) return;
    try {
      const len = Math.floor(ctx.sampleRate * duration);
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = type;
      filter.frequency.value = filterFreq;
      const gain = ctx.createGain();
      gain.gain.value = volume;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start();
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  function tone(freq, duration, volume, type = 'sine', when = 0) {
    if (!ctx || muted) return;
    try {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      const t0 = ctx.currentTime + when;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(volume, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t0);
      osc.stop(t0 + duration + 0.05);
    } catch {
      // Ignore.
    }
  }

  return {
    ensure,
    setMuted(m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    /** Call every frame: engine follows speed 0..1, siren follows the chase. */
    update(speed01, sirenOn, dt) {
      if (!ctx) return;
      try {
        engineGain.gain.value = muted ? 0 : 0.05 + speed01 * 0.09;
        engineOsc.frequency.value = 50 + speed01 * 130;
        if (sirenOn && !muted) {
          sirenTimer += dt;
          sirenOsc.frequency.value = Math.sin(sirenTimer * 9) > 0 ? 740 : 560;
          sirenGain.gain.value = 0.05;
        } else {
          sirenGain.gain.value = 0;
        }
      } catch {
        // Ignore.
      }
    },
    shot() { noiseBurst(0.12, 0.5, 1800, 'highpass'); },
    punch() { noiseBurst(0.08, 0.3, 500); },
    explosion() { noiseBurst(0.7, 0.9, 220); tone(55, 0.6, 0.5, 'sine'); },
    pickup() { tone(880, 0.12, 0.25); tone(1320, 0.16, 0.2, 'sine', 0.08); },
    click() { tone(660, 0.06, 0.2, 'square'); },
    horn() { tone(392, 0.25, 0.25, 'square'); tone(330, 0.25, 0.2, 'square'); },
    jingle() { tone(523, 0.14, 0.25); tone(659, 0.14, 0.25, 'sine', 0.12); tone(784, 0.22, 0.25, 'sine', 0.24); },
    fail() { tone(330, 0.2, 0.25, 'sawtooth'); tone(262, 0.3, 0.25, 'sawtooth', 0.18); },
    busted() { tone(440, 0.3, 0.3, 'triangle'); tone(349, 0.4, 0.3, 'triangle', 0.3); },
  };
}
