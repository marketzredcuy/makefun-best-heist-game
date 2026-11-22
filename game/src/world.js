// The game's rules and state, with no drawing and no browser in it:
// the thief, the patrolling guards and their vision cones, the sweeping
// cameras, the loot, the alarm meter and the thrown coins. step()
// advances one fixed step and returns what happened as bit flags, so the
// caller can react without the world knowing about screens or sound.
// Nothing here allocates after createWorld returns.

import {
  ALARM,
  CAMERA,
  CAMERAS,
  COIN_THROW_RANGE,
  COINS,
  COVER,
  EXIT,
  FIELD,
  GUARD,
  GUARDS,
  LOOT,
  SCORE,
  THIEF,
  THIEF_START,
} from './config.js';

export const EVENT_SPOTTED = 1;
export const EVENT_LOOT = 2;
export const EVENT_COIN = 4;
export const EVENT_CAUGHT = 8;
export const EVENT_WIN = 16;

const WALL = 16;
const TWO_PI = Math.PI * 2;

/** Smallest absolute difference between two angles, in radians. */
function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= TWO_PI;
  while (d < -Math.PI) d += TWO_PI;
  return Math.abs(d);
}

/** Whether the segment from (x1, y1) to (x2, y2) crosses the rectangle. */
function segmentHitsRect(x1, y1, x2, y2, rect) {
  const minX = rect.x;
  const maxX = rect.x + rect.w;
  const minY = rect.y;
  const maxY = rect.y + rect.h;
  // An endpoint inside the rectangle is a hit.
  if (x1 >= minX && x1 <= maxX && y1 >= minY && y1 <= maxY) return true;
  if (x2 >= minX && x2 <= maxX && y2 >= minY && y2 <= maxY) return true;
  // Otherwise the segment must cross one of the four edges.
  const dx = x2 - x1;
  const dy = y2 - y1;
  const edges = [
    [minX, minY, maxX, minY],
    [maxX, minY, maxX, maxY],
    [maxX, maxY, minX, maxY],
    [minX, maxY, minX, minY],
  ];
  for (let i = 0; i < 4; i += 1) {
    const [ax, ay, bx, by] = edges[i];
    const ex = bx - ax;
    const ey = by - ay;
    const denom = dx * ey - dy * ex;
    if (denom === 0) continue;
    const t = ((ax - x1) * ey - (ay - y1) * ex) / denom;
    const u = ((ax - x1) * dy - (ay - y1) * dx) / denom;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return true;
  }
  return false;
}

/** True when nothing solid stands between the eye and the target. */
function lineOfSight(x1, y1, x2, y2) {
  for (let i = 0; i < COVER.length; i += 1) {
    if (segmentHitsRect(x1, y1, x2, y2, COVER[i])) return false;
  }
  return true;
}

/** Whether a circle at (x, y) with radius r overlaps a cover rectangle. */
function circleHitsCover(x, y, r) {
  for (let i = 0; i < COVER.length; i += 1) {
    const rect = COVER[i];
    const cx = Math.max(rect.x, Math.min(x, rect.x + rect.w));
    const cy = Math.max(rect.y, Math.min(y, rect.y + rect.h));
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy < r * r) return true;
  }
  return false;
}

/**
 * Move a circle by (dx, dy), sliding along cover and walls: each axis
 * moves only when the new spot is free. Returns the new position.
 */
function moveCircle(x, y, r, dx, dy) {
  let nx = x + dx;
  if (nx < WALL + r || nx > FIELD.width - WALL - r || circleHitsCover(nx, y, r)) nx = x;
  let ny = y + dy;
  if (ny < WALL + r || ny > FIELD.height - WALL - r || circleHitsCover(nx, ny, r)) ny = y;
  return { x: nx, y: ny };
}

export function createWorld(random) {
  const thief = {
    x: THIEF_START.x,
    y: THIEF_START.y,
    facing: -Math.PI / 2,
    sneaking: false,
    hasLoot: false,
  };
  const guards = GUARDS.map((def) => ({
    x: def.waypoints[0].x,
    y: def.waypoints[0].y,
    angle: 0,
    waypointIndex: 1,
    waypointDir: 1,
    mode: 'patrol',
    investigateX: 0,
    investigateY: 0,
    investigateTimer: 0,
    loseSightTimer: 0,
    lastSeenX: 0,
    lastSeenY: 0,
    spotted: false,
  }));
  const cameras = CAMERAS.map((def) => ({
    x: def.x,
    y: def.y,
    baseAngle: def.baseAngle,
    angle: def.baseAngle,
    time: random() * TWO_PI,
    spotted: false,
  }));
  const thrown = [];
  const state = {
    thief,
    guards,
    cameras,
    thrown,
    alarm: 0,
    coins: COINS,
    lootTaken: false,
    elapsed: 0,
    score: 0,
    won: false,
    caught: false,
    spottedNow: false,
  };

  function reset() {
    thief.x = THIEF_START.x;
    thief.y = THIEF_START.y;
    thief.facing = -Math.PI / 2;
    thief.sneaking = false;
    thief.hasLoot = false;
    for (let i = 0; i < guards.length; i += 1) {
      const guard = guards[i];
      guard.x = GUARDS[i].waypoints[0].x;
      guard.y = GUARDS[i].waypoints[0].y;
      guard.angle = 0;
      guard.waypointIndex = 1;
      guard.waypointDir = 1;
      guard.mode = 'patrol';
      guard.investigateTimer = 0;
      guard.loseSightTimer = 0;
      guard.spotted = false;
    }
    for (let i = 0; i < cameras.length; i += 1) {
      cameras[i].angle = cameras[i].baseAngle;
      cameras[i].time = 0;
      cameras[i].spotted = false;
    }
    thrown.length = 0;
    state.alarm = 0;
    state.coins = COINS;
    state.lootTaken = false;
    state.elapsed = 0;
    state.score = 0;
    state.won = false;
    state.caught = false;
    state.spottedNow = false;
  }

  /** Whether an eye at (ex, ey) facing `angle` can see the thief. */
  function canSee(ex, ey, angle, range, halfAngle) {
    const dx = thief.x - ex;
    const dy = thief.y - ey;
    const dist = Math.hypot(dx, dy);
    const spotRange = thief.sneaking ? range * THIEF.sneakSpotFactor : range;
    if (dist > spotRange) return false;
    if (angleDiff(Math.atan2(dy, dx), angle) > halfAngle) return false;
    return lineOfSight(ex, ey, thief.x, thief.y);
  }

  function throwCoin(targetX, targetY) {
    if (state.coins <= 0) return false;
    const dx = targetX - thief.x;
    const dy = targetY - thief.y;
    const dist = Math.hypot(dx, dy);
    const range = Math.min(dist, COIN_THROW_RANGE);
    const nx = thief.x + (dist === 0 ? 0 : (dx / dist) * range);
    const ny = thief.y + (dist === 0 ? 0 : (dy / dist) * range);
    thrown.push({ x: nx, y: ny, timer: 1.2 });
    state.coins -= 1;
    // The nearest guard in earshot walks over to look at the noise.
    let nearest = null;
    let nearestDist = 420;
    for (let i = 0; i < guards.length; i += 1) {
      const guard = guards[i];
      const d = Math.hypot(guard.x - nx, guard.y - ny);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = guard;
      }
    }
    if (nearest !== null) {
      nearest.mode = 'investigate';
      nearest.investigateX = nx;
      nearest.investigateY = ny;
      nearest.investigateTimer = GUARD.investigateTime;
    }
    return true;
  }

  function stepGuard(guard, dt, harmless) {
    const dx = thief.x - guard.x;
    const dy = thief.y - guard.y;
    const dist = Math.hypot(dx, dy);
    guard.spotted = canSee(guard.x, guard.y, guard.angle, GUARD.coneRange, GUARD.coneHalfAngle);

    // On the title screen's backdrop the guards only patrol: a sighting
    // there never starts a chase, so the backdrop stays calm.
    if (guard.spotted && !harmless) {
      guard.lastSeenX = thief.x;
      guard.lastSeenY = thief.y;
      guard.loseSightTimer = GUARD.loseSightTime;
      if (guard.mode !== 'investigate') guard.mode = 'chase';
    } else if (guard.loseSightTimer > 0) {
      guard.loseSightTimer -= dt;
      if (guard.loseSightTimer <= 0 && guard.mode === 'chase') guard.mode = 'patrol';
    }

    if (guard.mode === 'chase') {
      const tx = guard.lastSeenX;
      const ty = guard.lastSeenY;
      const tdx = tx - guard.x;
      const tdy = ty - guard.y;
      const tdist = Math.hypot(tdx, tdy);
      if (tdist > 4) {
        guard.angle = Math.atan2(tdy, tdx);
        const moved = moveCircle(
          guard.x, guard.y, GUARD.radius,
          (tdx / tdist) * GUARD.chaseSpeed * dt,
          (tdy / tdist) * GUARD.chaseSpeed * dt,
        );
        guard.x = moved.x;
        guard.y = moved.y;
      }
      if (tdist < 12) guard.mode = 'patrol';
    } else if (guard.mode === 'investigate') {
      const tdx = guard.investigateX - guard.x;
      const tdy = guard.investigateY - guard.y;
      const tdist = Math.hypot(tdx, tdy);
      if (tdist > 6) {
        guard.angle = Math.atan2(tdy, tdx);
        const moved = moveCircle(
          guard.x, guard.y, GUARD.radius,
          (tdx / tdist) * GUARD.investigateSpeed * dt,
          (tdy / tdist) * GUARD.investigateSpeed * dt,
        );
        guard.x = moved.x;
        guard.y = moved.y;
      } else {
        guard.investigateTimer -= dt;
        guard.angle += dt * 1.5;
        if (guard.investigateTimer <= 0) guard.mode = 'patrol';
      }
    } else {
      const target = GUARDS[guards.indexOf(guard)].waypoints[guard.waypointIndex];
      const tdx = target.x - guard.x;
      const tdy = target.y - guard.y;
      const tdist = Math.hypot(tdx, tdy);
      if (tdist < 8) {
        guard.waypointIndex += guard.waypointDir;
        const waypoints = GUARDS[guards.indexOf(guard)].waypoints;
        if (guard.waypointIndex >= waypoints.length) {
          guard.waypointIndex = waypoints.length - 2;
          guard.waypointDir = -1;
        } else if (guard.waypointIndex < 0) {
          guard.waypointIndex = 1;
          guard.waypointDir = 1;
        }
      } else {
        guard.angle = Math.atan2(tdy, tdx);
        const moved = moveCircle(
          guard.x, guard.y, GUARD.radius,
          (tdx / tdist) * GUARD.patrolSpeed * dt,
          (tdy / tdist) * GUARD.patrolSpeed * dt,
        );
        guard.x = moved.x;
        guard.y = moved.y;
      }
    }

    // A guard that reaches the thief catches him on the spot.
    // (Not on the title backdrop: there the thief is only scenery.)
    if (dist < GUARD.touchDistance && !harmless) {
      state.caught = true;
    }
  }

  /**
   * One fixed step. `move` is {x, y} in -1..1, `sneak` is a boolean,
   * `coin` is a {x, y} field target to throw at, or null. With
   * `harmless` set (the title screen's backdrop) the guards patrol and
   * the cameras sweep, but nothing spots the thief and nothing scores.
   */
  function step(dt, move, sneak, coin, harmless) {
    let events = 0;
    state.elapsed += dt;

    // The thief moves; sneaking is slower and harder to spot.
    const speed = sneak ? THIEF.sneakSpeed : THIEF.speed;
    const len = Math.hypot(move.x, move.y);
    const nx = len === 0 ? 0 : (move.x / len) * speed * dt;
    const ny = len === 0 ? 0 : (move.y / len) * speed * dt;
    if (len > 0) thief.facing = Math.atan2(move.y, move.x);
    thief.sneaking = sneak;
    const moved = moveCircle(thief.x, thief.y, THIEF.radius, nx, ny);
    thief.x = moved.x;
    thief.y = moved.y;

    if (coin !== null && throwCoin(coin.x, coin.y)) events |= EVENT_COIN;

    // The thrown coins' clink rings fade.
    for (let i = 0; i < thrown.length; i += 1) {
      thrown[i].timer -= dt;
      if (thrown[i].timer <= 0) {
        thrown.splice(i, 1);
        i -= 1;
      }
    }

    // Cameras sweep; guards patrol, chase or investigate.
    let spotted = false;
    for (let i = 0; i < cameras.length; i += 1) {
      const camera = cameras[i];
      camera.time += dt;
      camera.angle = camera.baseAngle + CAMERA.sweepAmplitude * Math.sin(camera.time * CAMERA.sweepSpeed);
      camera.spotted = !harmless && canSee(camera.x, camera.y, camera.angle, CAMERA.coneRange, CAMERA.coneHalfAngle);
      if (camera.spotted) spotted = true;
    }
    for (let i = 0; i < guards.length; i += 1) {
      stepGuard(guards[i], dt, harmless);
      if (guards[i].spotted) spotted = true;
    }
    state.spottedNow = spotted && !harmless;
    if (state.spottedNow) events |= EVENT_SPOTTED;

    // The alarm climbs while anyone sees the thief, faster up close,
    // and falls while he is hidden.
    if (!harmless) {
      if (spotted) {
        let rise = ALARM.riseCamera;
        for (let i = 0; i < guards.length; i += 1) {
          if (!guards[i].spotted) continue;
          const d = Math.hypot(thief.x - guards[i].x, thief.y - guards[i].y);
          rise = Math.max(rise, d < ALARM.closeDistance ? ALARM.riseGuardClose : ALARM.riseGuardFar);
        }
        state.alarm = Math.min(ALARM.max, state.alarm + rise * dt);
      } else {
        state.alarm = Math.max(0, state.alarm - ALARM.decay * dt);
      }
    }

    // The diamond, on its pedestal, is lifted by walking over it.
    if (!state.lootTaken && !harmless) {
      const d = Math.hypot(thief.x - LOOT.x, thief.y - LOOT.y);
      if (d < THIEF.radius + LOOT.radius) {
        state.lootTaken = true;
        thief.hasLoot = true;
        state.score += LOOT.value;
        events |= EVENT_LOOT;
      }
    }

    // The way out is the door at the bottom: reach it with the diamond.
    if (thief.hasLoot && !harmless) {
      const inExit =
        thief.x > EXIT.x - EXIT.width / 2 &&
        thief.x < EXIT.x + EXIT.width / 2 &&
        thief.y > EXIT.y - EXIT.height;
      if (inExit) {
        state.won = true;
        const timeBonus = Math.max(0, Math.round(SCORE.timeBonusMax * (1 - state.elapsed / SCORE.timeBonusSeconds)));
        const alarmBonus = Math.round(SCORE.alarmBonusMax * (1 - state.alarm / ALARM.max));
        state.score += timeBonus + alarmBonus;
        events |= EVENT_WIN;
      }
    }

    if ((state.alarm >= ALARM.max || state.caught) && !harmless) {
      state.caught = true;
      events |= EVENT_CAUGHT;
    }
    return events;
  }

  reset();
  return { state, reset, step, throwCoin };
}
