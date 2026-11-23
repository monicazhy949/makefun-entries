// Input: keyboard and mouse for the browser game. The headless driver
// writes the same shape of object itself, so the game reads G.input
// through one helper no matter who drives.

export function createInput() {
  return {
    keys: new Set(),
    up: false,
    down: false,
    left: false,
    right: false,
    shoot: false,
    interact: false,
    mouse: { x: 640, y: 400, down: false },
  };
}

// Sync the boolean shortcuts from the keys set after any key event.
export function syncInput(input) {
  const has = (k) => input.keys.has(k);
  input.up = has('w') || has('W') || has('ArrowUp');
  input.down = has('s') || has('S') || has('ArrowDown');
  input.left = has('a') || has('A') || has('ArrowLeft');
  input.right = has('d') || has('D') || has('ArrowRight');
  input.shoot = !!input.mouse.down;
}

// Wire browser events onto a canvas. Returns a cleanup function.
export function attachInput(input, canvas, onKey) {
  const keyDown = (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      e.preventDefault();
    }
    input.keys.add(e.key);
    if (e.key === 'e' || e.key === 'E') input.interact = true;
    syncInput(input);
    if (onKey) onKey(e.key);
  };
  const keyUp = (e) => {
    input.keys.delete(e.key);
    if (e.key === 'e' || e.key === 'E') input.interact = false;
    syncInput(input);
  };
  const mouseMove = (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouse.x = e.clientX - r.left;
    input.mouse.y = e.clientY - r.top;
  };
  const mouseDown = (e) => {
    mouseMove(e);
    input.mouse.down = true;
    input.shoot = true;
  };
  const mouseUp = () => {
    input.mouse.down = false;
    input.shoot = false;
  };
  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  canvas.addEventListener('mousemove', mouseMove);
  canvas.addEventListener('mousedown', mouseDown);
  window.addEventListener('mouseup', mouseUp);
  return () => {
    window.removeEventListener('keydown', keyDown);
    window.removeEventListener('keyup', keyUp);
    canvas.removeEventListener('mousemove', mouseMove);
    canvas.removeEventListener('mousedown', mouseDown);
    window.removeEventListener('mouseup', mouseUp);
  };
}
