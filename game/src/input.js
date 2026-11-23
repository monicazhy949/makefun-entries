// Solmar Bay: keyboard and mouse input for the browser.
// WASD or arrows drive and walk, E enters and exits cars, mouse aims,
// click shoots, Space is the handbrake, Shift runs on foot.
export function createInput(canvas) {
  const keys = new Set();
  const mouse = { x: 0, y: 0, down: false };
  const input = {
    keys,
    mouse,
    throttle() {
      let t = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) t += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) t -= 0.6;
      return t;
    },
    steer() {
      let s = 0;
      if (keys.has('KeyD') || keys.has('ArrowRight')) s += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) s -= 1;
      return s;
    },
    handbrake() {
      return keys.has('Space');
    },
    run() {
      return keys.has('ShiftLeft') || keys.has('ShiftRight');
    },
    move() {
      let x = 0;
      let y = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      const l = Math.hypot(x, y) || 1;
      return { x: x / l, y: y / l };
    },
  };
  if (typeof window !== 'undefined' && canvas) {
    window.addEventListener('keydown', (e) => {
      keys.add(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => keys.delete(e.code));
    window.addEventListener('blur', () => keys.clear());
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
    });
    canvas.addEventListener('mousedown', () => {
      mouse.down = true;
    });
    window.addEventListener('mouseup', () => {
      mouse.down = false;
    });
  }
  return input;
}
