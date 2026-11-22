// Keyboard and pointer input. Held keys give a steering direction in
// two axes; one-shot presses (start or restart, pause, throw a coin)
// are queued as bit flags and taken once by the loop, so a press
// between two frames is never lost and never counted twice. A mouse
// click also throws a coin toward the click, so the game plays with
// keyboard and mouse together.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_COIN = 4;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const SNEAK = new Set(['ShiftLeft', 'ShiftRight']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const COIN = new Set(['KeyE']);

export function createInput(target) {
  let up = false;
  let down = false;
  let left = false;
  let right = false;
  let sneak = false;
  let actions = 0;
  // Where the last click landed, in canvas pixels; the world turns it
  // into field coordinates when a coin is thrown.
  let click = null;

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) up = true;
    else if (DOWN.has(event.code)) down = true;
    else if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (SNEAK.has(event.code)) sneak = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (COIN.has(event.code)) {
      if (!event.repeat) actions |= ACTION_COIN;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) up = false;
    else if (DOWN.has(event.code)) down = false;
    else if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
    else if (SNEAK.has(event.code)) sneak = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    up = false;
    down = false;
    left = false;
    right = false;
    sneak = false;
  });
  target.addEventListener('pointerdown', (event) => {
    click = { x: event.clientX, y: event.clientY };
    // A click is both "confirm" (it starts the game, resumes it, or
    // restarts it) and "throw a coin" (it plays in the game itself):
    // the loop's branches take the one that fits the screen it is on,
    // and the other flag is dropped with the same takeActions call.
    actions |= ACTION_CONFIRM | ACTION_COIN;
  });

  return {
    /** The steering direction, each axis -1, 0 or 1. */
    direction() {
      return {
        x: (right ? 1 : 0) - (left ? 1 : 0),
        y: (down ? 1 : 0) - (up ? 1 : 0),
      };
    },
    /** True while a sneak key is held. */
    sneaking() {
      return sneak;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The last click's canvas position, or null; cleared on read. */
    takeClick() {
      const taken = click;
      click = null;
      return taken;
    },
  };
}
