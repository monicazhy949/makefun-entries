// Keyboard and pointer input. Held keys steer the thief; one-shot presses
// (start, pause, tool use) are queued as bit flags and taken once by the loop,
// so a press between two frames is never lost and never counted twice. The
// pointer selects gadgets on the HUD and aims the thrown ones at the floor.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_USE = 4;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const USE = new Set(['Space']);
const TOOL_KEYS = { Digit1: 'coin', Digit2: 'smoke', Digit3: 'emp' };

export function createInput(canvas, toField) {
  const held = { up: false, down: false, left: false, right: false, sneak: false };
  let actions = 0;
  let toolKey = null;
  let click = null;

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) held.up = true;
    else if (DOWN.has(event.code)) held.down = true;
    else if (LEFT.has(event.code)) held.left = true;
    else if (RIGHT.has(event.code)) held.right = true;
    else if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') held.sneak = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (USE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_USE;
    } else if (TOOL_KEYS[event.code]) {
      if (!event.repeat) toolKey = TOOL_KEYS[event.code];
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) held.up = false;
    else if (DOWN.has(event.code)) held.down = false;
    else if (LEFT.has(event.code)) held.left = false;
    else if (RIGHT.has(event.code)) held.right = false;
    else if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') held.sneak = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    held.up = held.down = held.left = held.right = held.sneak = false;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    click = toField(event.clientX - rect.left, event.clientY - rect.top);
    actions |= ACTION_CONFIRM;
  });

  return {
    /** The thief's wanted direction, each component -1..1. */
    move() {
      return {
        x: (held.right ? 1 : 0) - (held.left ? 1 : 0),
        y: (held.down ? 1 : 0) - (held.up ? 1 : 0),
      };
    },
    sneaking() {
      return held.sneak;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The gadget key pressed since the last call, or null. */
    takeToolKey() {
      const taken = toolKey;
      toolKey = null;
      return taken;
    },
    /** The last pointer click in field coordinates, or null. */
    takeClick() {
      const taken = click;
      click = null;
      return taken;
    },
  };
}
