// Boot and the one loop: input is read every frame, the world advances
// in fixed 1/60 s steps (several in a slow frame, none in a fast one),
// and the renderer paints what is there. The game moves between five
// screens: title, play, paused, caught and clean getaway.
//
// ?seed=N fixes the random seed. ?shot=play|start|caught|getaway (with
// &seed=N) stages that scene instead of running the loop, paints it
// twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, COIN_THROW_RANGE, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_CAUGHT, EVENT_COIN, EVENT_LOOT, EVENT_SPOTTED, EVENT_WIN } from './world.js';
import { ACTION_COIN, ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { createSound } from './sound.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const sound = createSound();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let wasSpotted = false;
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes and the big moments.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    wasSpotted = false;
    screen = SCREEN_PLAY;
    sound.unlock();
    announce('Playing. Lift the Velvet Diamond and slip out the green door.');
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(
      won
        ? `Clean getaway. Score ${world.state.score}. Best ${best}.`
        : `Caught. Score ${world.state.score}. Best ${best}.`,
    );
  }

  /** Where a coin goes: the click, in field coordinates, or straight ahead of the thief. */
  function coinTarget() {
    const click = input.takeClick();
    if (click !== null) return renderer.toField(click.x, click.y);
    const thief = world.state.thief;
    return {
      x: thief.x + Math.cos(thief.facing) * COIN_THROW_RANGE,
      y: thief.y + Math.sin(thief.facing) * COIN_THROW_RANGE,
    };
  }

  let pendingCoin = null;

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN)) {
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    } else if (actions & ACTION_COIN && screen === SCREEN_PLAY) {
      // The coin is thrown by the world's step, so it lands in the same
      // fixed step as the movement: set a pending target for step().
      pendingCoin = coinTarget();
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { x: 0, y: 0 }, false, null, true);
      return;
    }
    const coin = pendingCoin;
    pendingCoin = null;
    const events = world.step(STEP, input.direction(), input.sneaking(), coin, false);
    if (events & EVENT_SPOTTED && !wasSpotted) sound.spotted();
    wasSpotted = world.state.spottedNow;
    if (events & EVENT_COIN) {
      sound.coin();
      announce('Coin tossed. A guard walks over to look.');
    }
    if (events & EVENT_LOOT) {
      sound.loot();
      announce('The Velvet Diamond is yours. Get to the green door.');
    }
    if (events & EVENT_WIN) {
      sound.win();
      endGame(true);
    } else if (events & EVENT_CAUGHT) {
      sound.caught();
      endGame(false);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting the alarm climb unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('The Velvet Vault. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
