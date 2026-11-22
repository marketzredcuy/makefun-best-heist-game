// The screenshot scenes behind ?shot=play|start|caught|getaway. Each
// one stages the world directly (positions, alarm, loot) and returns the
// screen to draw over it, so the frame is what a real game looks like
// at that moment and the same seed always gives the same frame. The
// cover is the play scene: the heist in full swing, every required
// element — the room, guards with cones, cameras, the loot target and
// the alarm meter — visible in one frame.
import { STEP } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 5;

/**
 * Set `world` to the named scene (play, start, caught or getaway; any
 * other name is start) and return the screen to draw over it and the
 * best score to show.
 */
export function stageShot(name, world) {
  const state = world.state;
  if (name === 'play') {
    world.reset();
    // Mid-heist: the thief is sneaking up the centre corridor, the
    // diamond still on its pedestal, both guards mid-patrol with
    // their cones sweeping, the cameras mid-sweep, the alarm halfway.
    state.thief.x = 560;
    state.thief.y = 320;
    state.thief.facing = -Math.PI / 3;
    state.thief.sneaking = true;
    state.guards[0].x = 480;
    state.guards[0].y = 380;
    state.guards[0].angle = 0;
    state.guards[1].x = 760;
    state.guards[1].y = 200;
    state.guards[1].angle = Math.PI;
    // The second guard has the thief in its cone: the red alert cone
    // and the SPOTTED warning show the danger of this moment.
    state.guards[1].spotted = true;
    state.spottedNow = true;
    state.cameras[0].angle = 0.35;
    state.cameras[1].angle = Math.PI - 0.35;
    state.alarm = 45;
    state.coins = 3;
    state.elapsed = 42;
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'caught') {
    world.reset();
    // The alarm hit 100%: a guard is on the thief at the room's right
    // edge, clear of the panel, the cone red, the game over. The fair
    // end of a run that pushed too far.
    state.thief.x = 980;
    state.thief.y = 320;
    state.thief.facing = Math.PI;
    state.guards[0].x = 1012;
    state.guards[0].y = 320;
    state.guards[0].angle = Math.PI;
    state.guards[0].mode = 'chase';
    state.guards[0].spotted = true;
    state.spottedNow = true;
    state.guards[1].x = 760;
    state.guards[1].y = 200;
    state.guards[1].angle = Math.PI;
    state.cameras[0].angle = 0.35;
    state.cameras[1].angle = Math.PI - 0.35;
    state.alarm = 100;
    state.coins = 2;
    state.elapsed = 55;
    state.score = 120;
    state.caught = true;
    return { screen: SCREEN_OVER, best: 0 };
  }
  if (name === 'getaway') {
    world.reset();
    // Clean getaway: the diamond is the thief's, he is at the green
    // door, the alarm barely raised, the run paid off.
    state.thief.x = 640;
    state.thief.y = 672;
    state.thief.facing = Math.PI / 2;
    state.thief.hasLoot = true;
    state.lootTaken = true;
    state.guards[0].x = 480;
    state.guards[0].y = 380;
    state.guards[0].angle = Math.PI;
    state.guards[1].x = 760;
    state.guards[1].y = 200;
    state.guards[1].angle = 0;
    state.cameras[0].angle = -0.3;
    state.cameras[1].angle = Math.PI + 0.3;
    state.alarm = 12;
    state.coins = 1;
    state.elapsed = 68;
    state.score = 1584;
    state.won = true;
    return { screen: SCREEN_WIN, best: 1584 };
  }
  // The title: the room behind the panel, guards patrolling and
  // cameras sweeping for a few seconds, nothing spotted.
  world.reset();
  for (let index = 0; index < START_SECONDS / STEP; index += 1) {
    world.step(STEP, { x: 0, y: 0 }, false, null, true);
  }
  return { screen: SCREEN_TITLE, best: 0 };
}
