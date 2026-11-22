// Drawing only: the world's state and the current screen in, pixels out.
// The 1280x720 playfield is scaled to fit the window and centred, the
// margin filled with the backdrop colour. Vision cones are raycast
// against the cover, so a cone stops at a display case the way sight
// does; the cover is drawn over the floor, and the thief, guards and
// cameras over the cones. Flat shapes and canvas text for the HUD and
// the panels. Text that holds a number is rebuilt only when the number
// changes, so a frame allocates nothing.

import { CAMERA, COVER, EXIT, FIELD, FONT, GUARD, LOOT, PALETTE, THIEF } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

/** The panel's width; its height grows with its lines: room for the title, the lines and the prompt. */
const PANEL = { width: 640, top: 134, line: 34, bottom: 70 };
const ALARM_BAR = { x: 490, y: 18, w: 300, h: 22 };

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

/**
 * The distance along a ray from (ox, oy) in direction (dx, dy) to the
 * nearest point of the rectangle, or Infinity when the ray misses it.
 * (Slab method: the ray enters the rectangle's x-slab and y-slab.)
 */
function rayHitRect(ox, oy, dx, dy, rect) {
  let tMin = 0;
  let tMax = Infinity;
  const slabs = [
    [ox, dx, rect.x, rect.x + rect.w],
    [oy, dy, rect.y, rect.y + rect.h],
  ];
  for (let i = 0; i < 2; i += 1) {
    const [o, d, lo, hi] = slabs[i];
    if (d === 0) {
      if (o < lo || o > hi) return Infinity;
    } else {
      let t1 = (lo - o) / d;
      let t2 = (hi - o) / d;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      tMin = Math.max(tMin, t1);
      tMax = Math.min(tMax, t2);
      if (tMin > tMax) return Infinity;
    }
  }
  return tMin;
}

/** The nearest cover the ray from (ox, oy) in direction (dx, dy) meets, within `range`. */
function rayRange(ox, oy, dx, dy, range) {
  let best = range;
  for (let i = 0; i < COVER.length; i += 1) {
    const t = rayHitRect(ox, oy, dx, dy, COVER[i]);
    if (t >= 0 && t < best) best = t;
  }
  return best;
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('Score ');
  const timeLabel = cachedLabel('');
  const bestLabel = cachedLabel('Best ');
  const coinsLabel = cachedLabel('Coins ');
  const lootLabel = cachedLabel('Loot $');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  /** A vision cone, raycast against the cover so it stops at solid things. */
  function drawCone(x, y, angle, range, halfAngle, fill, edge) {
    const steps = 14;
    context.beginPath();
    context.moveTo(x, y);
    for (let i = 0; i <= steps; i += 1) {
      const a = angle - halfAngle + ((2 * halfAngle * i) / steps);
      const dx = Math.cos(a);
      const dy = Math.sin(a);
      const r = rayRange(x, y, dx, dy, range);
      context.lineTo(x + dx * r, y + dy * r);
    }
    context.closePath();
    context.fillStyle = fill;
    context.fill();
    context.strokeStyle = edge;
    context.lineWidth = 1.5;
    context.stroke();
  }

  function drawFloor() {
    context.fillStyle = PALETTE.floor;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    // Floor tiles, faint, so the room reads as a gallery.
    context.strokeStyle = PALETTE.floorTile;
    context.lineWidth = 1;
    for (let x = 80; x < FIELD.width; x += 80) {
      context.beginPath();
      context.moveTo(x, 16);
      context.lineTo(x, FIELD.height - 16);
      context.stroke();
    }
    for (let y = 80; y < FIELD.height; y += 80) {
      context.beginPath();
      context.moveTo(16, y);
      context.lineTo(FIELD.width - 16, y);
      context.stroke();
    }
    // Walls: a thick edge around the room, with the exit gap at the bottom.
    context.fillStyle = PALETTE.wall;
    context.fillRect(0, 0, FIELD.width, 16);
    context.fillRect(0, 0, 16, FIELD.height);
    context.fillRect(FIELD.width - 16, 0, 16, FIELD.height);
    context.fillRect(0, FIELD.height - 16, EXIT.x - EXIT.width / 2 - 16, 16);
    context.fillRect(EXIT.x + EXIT.width / 2, FIELD.height - 16, FIELD.width - (EXIT.x + EXIT.width / 2), 16);
    context.fillStyle = PALETTE.wallEdge;
    context.fillRect(0, 16, FIELD.width, 2);
    context.fillRect(16, 0, 2, FIELD.height);
    context.fillRect(FIELD.width - 18, 0, 2, FIELD.height);
    // The exit door, green and open.
    context.fillStyle = PALETTE.exit;
    context.fillRect(EXIT.x - EXIT.width / 2, EXIT.y - EXIT.height, EXIT.width, EXIT.height + 16);
    context.fillStyle = PALETTE.exitEdge;
    context.fillRect(EXIT.x - EXIT.width / 2, EXIT.y - EXIT.height, EXIT.width, 3);
    text('EXIT', EXIT.x, EXIT.y + 4, 16, PALETTE.text, 'center');
  }

  function drawCover() {
    for (let i = 0; i < COVER.length; i += 1) {
      const rect = COVER[i];
      context.fillStyle = PALETTE.cover;
      context.fillRect(rect.x, rect.y, rect.w, rect.h);
      context.fillStyle = PALETTE.coverTop;
      context.fillRect(rect.x + 4, rect.y + 4, rect.w - 8, 10);
      context.strokeStyle = PALETTE.coverEdge;
      context.lineWidth = 2;
      context.strokeRect(rect.x, rect.y, rect.w, rect.h);
    }
  }

  function drawLoot(state, time) {
    if (state.lootTaken) return;
    const pulse = 0.5 + 0.5 * Math.sin(time * 3);
    // The pedestal.
    context.fillStyle = PALETTE.pedestal;
    context.fillRect(LOOT.x - 34, LOOT.y + 8, 68, 34);
    context.strokeStyle = PALETTE.pedestalEdge;
    context.lineWidth = 2;
    context.strokeRect(LOOT.x - 34, LOOT.y + 8, 68, 34);
    // The diamond, glowing and turning slowly.
    const glow = 26 + pulse * 8;
    context.fillStyle = PALETTE.diamondGlow;
    context.globalAlpha = 0.25 + pulse * 0.2;
    context.beginPath();
    context.arc(LOOT.x, LOOT.y, glow, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
    context.fillStyle = PALETTE.diamond;
    context.beginPath();
    context.moveTo(LOOT.x, LOOT.y - LOOT.radius);
    context.lineTo(LOOT.x + LOOT.radius * 0.7, LOOT.y);
    context.lineTo(LOOT.x, LOOT.y + LOOT.radius);
    context.lineTo(LOOT.x - LOOT.radius * 0.7, LOOT.y);
    context.closePath();
    context.fill();
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.moveTo(LOOT.x, LOOT.y - LOOT.radius);
    context.lineTo(LOOT.x + LOOT.radius * 0.7, LOOT.y);
    context.lineTo(LOOT.x, LOOT.y);
    context.closePath();
    context.fill();
    text('THE VELVET DIAMOND', LOOT.x, LOOT.y - LOOT.radius - 10, 13, PALETTE.gold, 'center');
  }

  function drawGuards(state) {
    for (let i = 0; i < state.guards.length; i += 1) {
      const guard = state.guards[i];
      const alerted = guard.spotted || guard.mode === 'chase';
      drawCone(
        guard.x, guard.y, guard.angle, GUARD.coneRange, GUARD.coneHalfAngle,
        alerted ? PALETTE.guardAlert : PALETTE.guardCone,
        alerted ? PALETTE.alarmHigh : PALETTE.guardConeEdge,
      );
    }
    for (let i = 0; i < state.guards.length; i += 1) {
      const guard = state.guards[i];
      context.fillStyle = PALETTE.guard;
      context.beginPath();
      context.arc(guard.x, guard.y, GUARD.radius, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#7d2a20';
      context.beginPath();
      context.arc(guard.x + Math.cos(guard.angle) * 6, guard.y + Math.sin(guard.angle) * 6, 6, 0, Math.PI * 2);
      context.fill();
      if (guard.spotted) {
        text('!', guard.x, guard.y - GUARD.radius - 8, 26, PALETTE.alarmHigh, 'center');
      } else if (guard.mode === 'investigate') {
        text('?', guard.x, guard.y - GUARD.radius - 8, 24, PALETTE.gold, 'center');
      }
    }
  }

  function drawCameras(state) {
    for (let i = 0; i < state.cameras.length; i += 1) {
      const camera = state.cameras[i];
      drawCone(
        camera.x, camera.y, camera.angle, CAMERA.coneRange, CAMERA.coneHalfAngle,
        camera.spotted ? PALETTE.guardAlert : PALETTE.cameraCone,
        camera.spotted ? PALETTE.alarmHigh : PALETTE.cameraConeEdge,
      );
    }
    for (let i = 0; i < state.cameras.length; i += 1) {
      const camera = state.cameras[i];
      context.fillStyle = PALETTE.camera;
      context.fillRect(camera.x - 8, camera.y - 6, 16, 12);
      context.fillStyle = '#ffffff';
      context.beginPath();
      context.arc(camera.x + Math.cos(camera.angle) * 10, camera.y + Math.sin(camera.angle) * 10, 3, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawThief(state) {
    const thief = state.thief;
    // A faint ring while sneaking: the thief is harder to spot, and it shows.
    if (thief.sneaking) {
      context.strokeStyle = 'rgba(238, 241, 245, 0.35)';
      context.lineWidth = 1.5;
      context.beginPath();
      context.arc(thief.x, thief.y, THIEF.radius + 6, 0, Math.PI * 2);
      context.stroke();
    }
    context.fillStyle = PALETTE.thief;
    context.beginPath();
    context.arc(thief.x, thief.y, THIEF.radius, 0, Math.PI * 2);
    context.fill();
    // A pale outline, so the thief stays readable against a cone.
    context.strokeStyle = 'rgba(238, 241, 245, 0.9)';
    context.lineWidth = 2;
    context.stroke();
    context.fillStyle = PALETTE.thiefHood;
    context.beginPath();
    context.arc(thief.x, thief.y, THIEF.radius - 4, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.thief;
    context.beginPath();
    context.arc(
      thief.x + Math.cos(thief.facing) * 5,
      thief.y + Math.sin(thief.facing) * 5,
      4, 0, Math.PI * 2,
    );
    context.fill();
    if (thief.hasLoot) {
      context.fillStyle = PALETTE.diamond;
      context.beginPath();
      context.moveTo(thief.x, thief.y - THIEF.radius - 12);
      context.lineTo(thief.x + 6, thief.y - THIEF.radius - 4);
      context.lineTo(thief.x, thief.y - THIEF.radius + 2);
      context.lineTo(thief.x - 6, thief.y - THIEF.radius - 4);
      context.closePath();
      context.fill();
    }
  }

  function drawThrown(state) {
    for (let i = 0; i < state.thrown.length; i += 1) {
      const coin = state.thrown[i];
      const progress = 1 - coin.timer / 1.2;
      context.strokeStyle = `rgba(242, 201, 76, ${1 - progress})`;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(coin.x, coin.y, 6 + progress * 26, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = PALETTE.coin;
      context.beginPath();
      context.arc(coin.x, coin.y, 5, 0, Math.PI * 2);
      context.fill();
    }
  }

  function alarmColor(alarm) {
    if (alarm < 40) return PALETTE.alarmLow;
    if (alarm < 75) return PALETTE.alarmMid;
    return PALETTE.alarmHigh;
  }

  function drawHud(state) {
    context.textBaseline = 'top';
    const lootText = state.lootTaken ? lootLabel(state.score) : 'Loot —';
    text(lootText, 24, 20, 24, state.lootTaken ? PALETTE.gold : PALETTE.text, 'left');
    // The alarm meter, centre top: the number that decides everything.
    text('ALARM', ALARM_BAR.x - 10, 20, 20, PALETTE.text, 'right');
    context.fillStyle = PALETTE.panel;
    context.fillRect(ALARM_BAR.x, ALARM_BAR.y, ALARM_BAR.w, ALARM_BAR.h);
    context.fillStyle = alarmColor(state.alarm);
    context.fillRect(ALARM_BAR.x, ALARM_BAR.y, (ALARM_BAR.w * state.alarm) / 100, ALARM_BAR.h);
    context.strokeStyle = PALETTE.wallEdge;
    context.lineWidth = 1.5;
    context.strokeRect(ALARM_BAR.x, ALARM_BAR.y, ALARM_BAR.w, ALARM_BAR.h);
    text(`${Math.round(state.alarm)}%`, ALARM_BAR.x + ALARM_BAR.w + 10, 20, 20, alarmColor(state.alarm), 'left');
    const minutes = Math.floor(state.elapsed / 60);
    const seconds = Math.floor(state.elapsed % 60);
    const timeText = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    text(timeLabel(timeText), FIELD.width - 24, 20, 24, PALETTE.text, 'right');
    text(coinsLabel(state.coins), FIELD.width - 24, 52, 20, PALETTE.gold, 'right');
    if (state.spottedNow) {
      // Top-left, under the loot line: clear of the alarm bar and of
      // the diamond's label at the top centre.
      text('SPOTTED!', 24, 52, 26, PALETTE.alarmHigh, 'left');
    }
    context.textBaseline = 'alphabetic';
    // Bottom-left, clear of the green exit door at the centre.
    text(
      'WASD / arrows move · SHIFT sneak · E or click toss a coin · P pause',
      24, FIELD.height - 24, 15, PALETTE.muted, 'left',
    );
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = PALETTE.wallEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 78, 48, PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 22, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 40, 24, PALETTE.gold, 'center');
  }

  const TITLE_LINES = [
    'One room. Two guards. Two cameras. One diamond.',
    'Sneak past the cones, lift the Velvet Diamond,',
    'and slip out the green door. A coin toss pulls',
    'a guard away — you only carry three.',
    '',
  ];
  const PAUSED_LINES = ['The guards will wait for you.'];
  const OVER_LINES = ['', '', ''];
  const WIN_LINES = ['', '', ''];

  /** Paint one frame: the room, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawFloor();
    drawGuards(state);
    drawCameras(state);
    drawCover();
    drawLoot(state, state.elapsed);
    drawThrown(state);
    drawThief(state);
    if (screen === SCREEN_TITLE) {
      TITLE_LINES[4] = best > 0 ? bestLabel(best) : 'No getaway yet. Make one.';
      drawPanel('THE VELVET VAULT', TITLE_LINES, 'Press Space or click to start');
      return;
    }
    drawHud(state);
    if (screen === SCREEN_PAUSED) drawPanel('Paused', PAUSED_LINES, 'Press P to resume');
    else if (screen === SCREEN_OVER) {
      OVER_LINES[0] = scoreLabel(state.score);
      OVER_LINES[1] = bestLabel(best);
      OVER_LINES[2] = state.alarm >= 100 ? 'The alarm hit 100%.' : 'A guard caught you.';
      drawPanel('CAUGHT', OVER_LINES, 'Press Space or click to try again');
    } else if (screen === SCREEN_WIN) {
      WIN_LINES[0] = scoreLabel(state.score);
      WIN_LINES[1] = bestLabel(best);
      WIN_LINES[2] = state.lootTaken ? 'The Velvet Diamond is yours.' : '';
      drawPanel('CLEAN GETAWAY', WIN_LINES, 'Press Space or click to play again');
    }
  }

  resize();
  window.addEventListener('resize', resize);

  /** A click's window position, turned into field coordinates. */
  function toField(clientX, clientY) {
    const ratio = window.devicePixelRatio || 1;
    return {
      x: (clientX * ratio - view.x) / view.scale,
      y: (clientY * ratio - view.y) / view.scale,
    };
  }

  return { draw, toField };
}
