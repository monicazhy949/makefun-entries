// Keyboard and mouse: held keys, edge-triggered presses, and the mouse position
// in canvas pixels. The game reads this once a frame; nothing here knows the game.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_HORN = 8;
export const ACTION_WEAPON = 16;
export const ACTION_MUTE = 32;
export const ACTION_HELP = 64;
export const ACTION_SAVE = 128;

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false };

  function code(e) {
    return e.code;
  }

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code(e))) e.preventDefault();
    if (!keys.has(code(e))) pressed.add(code(e));
    keys.add(code(e));
  });
  window.addEventListener('keyup', (e) => keys.delete(code(e)));
  window.addEventListener('blur', () => { keys.clear(); mouse.down = false; });

  function updateMouse(e) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - rect.left) * (canvas.width / rect.width);
    mouse.y = (e.clientY - rect.top) * (canvas.height / rect.height);
  }
  canvas.addEventListener('mousemove', updateMouse);
  canvas.addEventListener('mousedown', (e) => { updateMouse(e); mouse.down = true; mouse.clicked = true; });
  window.addEventListener('mouseup', () => { mouse.down = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    keys,
    mouse,
    /** -1/0/1 drive axis: W/up forward, S/down back. */
    throttle() {
      let v = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) v += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) v -= 1;
      return v;
    },
    /** -1/0/1 steer axis: A/left, D/right. */
    steer() {
      let v = 0;
      if (keys.has('KeyD') || keys.has('ArrowRight')) v += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) v -= 1;
      return v;
    },
    handbrake() {
      return keys.has('Space');
    },
    run() {
      return keys.has('ShiftLeft') || keys.has('ShiftRight');
    },
    /** Edge-triggered actions, consumed on read. */
    takeActions() {
      let actions = 0;
      if (pressed.has('Enter') || pressed.has('NumpadEnter') || mouse.clicked) actions |= ACTION_CONFIRM;
      if (pressed.has('KeyP') || pressed.has('Escape')) actions |= ACTION_PAUSE;
      if (pressed.has('KeyE')) actions |= ACTION_ENTER;
      if (pressed.has('KeyH')) actions |= ACTION_HORN;
      if (pressed.has('KeyQ')) actions |= ACTION_WEAPON;
      if (pressed.has('KeyM')) actions |= ACTION_MUTE;
      if (pressed.has('F1') || pressed.has('Slash')) actions |= ACTION_HELP;
      if (pressed.has('KeyF')) actions |= ACTION_SAVE;
      pressed.clear();
      mouse.clicked = false;
      return actions;
    },
    /** True while the fire button (mouse) is held. */
    firing() {
      return mouse.down;
    },
  };
}
