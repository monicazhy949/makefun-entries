// Sound, all synthesized with the Web Audio API: no audio files ship with the
// game. Every effect is a few oscillators; the alarm is a soft pulse that
// follows the meter. Audio starts only after the player's first gesture.

export function createAudio() {
  let context = null;
  let alarmNodes = null;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume();
      return context;
    }
    try {
      context = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      context = null;
    }
    return context;
  }

  /** A short tone: frequency slides from `from` to `to` over `seconds`. */
  function tone(from, to, seconds, type, gainValue, delay = 0) {
    const ctx = ensure();
    if (!ctx) return;
    const start = ctx.currentTime + delay;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + seconds);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + seconds + 0.05);
  }

  return {
    /** Call on any user gesture so later sounds are allowed to play. */
    unlock() {
      ensure();
    },
    pickup() {
      tone(880, 1320, 0.12, 'sine', 0.12);
    },
    prize() {
      tone(660, 660, 0.1, 'triangle', 0.14);
      tone(880, 880, 0.1, 'triangle', 0.14, 0.09);
      tone(1320, 1320, 0.18, 'triangle', 0.14, 0.18);
    },
    coin() {
      tone(2400, 1800, 0.08, 'square', 0.05);
    },
    smoke() {
      tone(220, 90, 0.25, 'sine', 0.14);
    },
    emp() {
      tone(1600, 120, 0.35, 'sawtooth', 0.08);
    },
    caught() {
      tone(320, 70, 0.5, 'sawtooth', 0.14);
    },
    roomClear() {
      tone(523, 523, 0.12, 'triangle', 0.14);
      tone(659, 659, 0.12, 'triangle', 0.14, 0.1);
      tone(784, 784, 0.2, 'triangle', 0.14, 0.2);
    },
    win() {
      [523, 659, 784, 1047].forEach((note, i) => tone(note, note, 0.22, 'triangle', 0.14, i * 0.13));
    },
    /** The alarm pulse: call every frame with the meter (0..100). */
    alarm(level, alert) {
      const ctx = ensure();
      if (!ctx) return;
      if (level < 45 && !alert) {
        if (alarmNodes) {
          try { alarmNodes.oscillator.stop(); } catch { /* already stopped */ }
          alarmNodes = null;
        }
        return;
      }
      if (!alarmNodes) {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = alert ? 620 : 440;
        gain.gain.value = 0.0;
        oscillator.connect(gain).connect(ctx.destination);
        oscillator.start();
        alarmNodes = { oscillator, gain, phase: 0 };
      }
      alarmNodes.oscillator.frequency.value = alert ? 620 : 440;
      alarmNodes.phase += 0.09;
      alarmNodes.gain.gain.value = 0.03 + 0.03 * Math.sin(alarmNodes.phase);
    },
    stopAlarm() {
      if (alarmNodes) {
        try { alarmNodes.oscillator.stop(); } catch { /* already stopped */ }
        alarmNodes = null;
      }
    },
  };
}
