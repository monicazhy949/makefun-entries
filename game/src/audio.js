// Sound: small WebAudio beeps and jingles. In Node (no AudioContext)
// every call is a no-op, so the headless game stays silent and safe.

export function createAudio() {
  const api = {
    ctx: null,
    enabled: true,
    ensure() {
      if (this.ctx) return this.ctx;
      if (typeof window === 'undefined') return null;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try {
        this.ctx = new AC();
      } catch (e) {
        this.ctx = null;
      }
      return this.ctx;
    },
    tone(freq, dur, type, gain) {
      const ctx = this.ensure();
      if (!ctx || !this.enabled) return;
      try {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = type || 'square';
        o.frequency.value = freq;
        g.gain.value = gain || 0.04;
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
        o.connect(g);
        g.connect(ctx.destination);
        o.start();
        o.stop(ctx.currentTime + dur);
      } catch (e) {
        // Sound never breaks the game.
      }
    },
    shoot() { this.tone(880, 0.07, 'square', 0.05); this.tone(220, 0.1, 'sawtooth', 0.03); },
    enemyShoot() { this.tone(440, 0.06, 'square', 0.02); },
    punch() { this.tone(140, 0.09, 'sine', 0.06); },
    jingle() {
      this.tone(523, 0.12, 'triangle', 0.05);
      setTimeout(() => this.tone(659, 0.12, 'triangle', 0.05), 110);
      setTimeout(() => this.tone(784, 0.2, 'triangle', 0.05), 220);
    },
    busted() {
      this.tone(330, 0.25, 'sawtooth', 0.05);
      setTimeout(() => this.tone(220, 0.35, 'sawtooth', 0.05), 200);
    },
    explosion() { this.tone(90, 0.4, 'sawtooth', 0.08); },
    pickup() { this.tone(660, 0.08, 'sine', 0.04); },
    click() { this.tone(700, 0.05, 'sine', 0.03); },
  };
  return api;
}
