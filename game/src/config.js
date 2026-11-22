// Every tuning number, colour and the room's layout in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales
// it to the window, so no rule below depends on the screen size.
// The game is "The Velvet Vault": a museum gallery at night. The thief
// starts by the exit door at the bottom, sneaks past two patrolling
// guards and two sweeping cameras, lifts the Velvet Diamond from its
// pedestal at the top, and gets back to the exit.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The thief: a circle. Sneaking is slower but shrinks every cone that can spot him. */
export const THIEF = {
  radius: 14,
  speed: 230,
  sneakSpeed: 130,
  sneakSpotFactor: 0.6,
};

/** A guard: patrols its waypoints, chases what it sees, investigates a thrown coin. */
export const GUARD = {
  radius: 15,
  patrolSpeed: 90,
  chaseSpeed: 165,
  investigateSpeed: 120,
  coneRange: 250,
  coneHalfAngle: (35 * Math.PI) / 180,
  touchDistance: 28,
  investigateTime: 3,
  loseSightTime: 2,
};

/** A wall camera: fixed to its mount, its cone sweeps around its base angle. */
export const CAMERA = {
  coneRange: 280,
  coneHalfAngle: (30 * Math.PI) / 180,
  sweepAmplitude: (38 * Math.PI) / 180,
  sweepSpeed: 0.55,
};

/** The alarm meter: 0 to 100. It climbs while anyone sees the thief and falls while hidden. */
export const ALARM = {
  max: 100,
  riseGuardClose: 30,
  riseGuardFar: 18,
  riseCamera: 22,
  closeDistance: 120,
  decay: 10,
};

/** Coins to throw: a distraction, not a weapon. Three only, no refill. */
export const COINS = 3;
export const COIN_THROW_RANGE = 320;

/** The loot: the Velvet Diamond, worth 1000, on its pedestal. */
export const LOOT = { value: 1000, x: 640, y: 112, radius: 18 };

/** The way out: the door in the bottom wall. Reach it with the diamond to win. */
export const EXIT = { x: 640, y: 692, width: 110, height: 28 };

/** Where the thief begins, just inside the exit door. */
export const THIEF_START = { x: 640, y: 640 };

/**
 * Cover: display cases, pillars and benches. They block movement and
 * block sight, so the thief hides behind them. Each is {x, y, w, h}.
 */
export const COVER = [
  { x: 150, y: 150, w: 100, h: 160 }, // left-top display case
  { x: 150, y: 420, w: 100, h: 160 }, // left-bottom display case
  { x: 1030, y: 150, w: 100, h: 160 }, // right-top display case
  { x: 1030, y: 420, w: 100, h: 160 }, // right-bottom display case
  { x: 480, y: 260, w: 70, h: 70 }, // centre-left pillar
  { x: 730, y: 260, w: 70, h: 70 }, // centre-right pillar
  { x: 480, y: 480, w: 120, h: 50 }, // centre-bottom bench
  { x: 680, y: 480, w: 120, h: 50 }, // centre-bottom bench
];

/** Guards: each patrols its waypoints back and forth, facing where it walks. */
export const GUARDS = [
  {
    waypoints: [
      { x: 300, y: 380 },
      { x: 980, y: 380 },
    ],
  },
  {
    waypoints: [
      { x: 300, y: 200 },
      { x: 980, y: 200 },
    ],
  },
];

/** Cameras: mounted on the side walls, sweeping across the side corridors. */
export const CAMERAS = [
  { x: 42, y: 300, baseAngle: 0 }, // left wall, looking right
  { x: 1238, y: 300, baseAngle: Math.PI }, // right wall, looking left
];

/** Score bonuses on a clean getaway: fast and quiet pays more. */
export const SCORE = { timeBonusMax: 500, timeBonusSeconds: 120, alarmBonusMax: 300 };

export const PALETTE = {
  backdrop: '#0d0f16',
  floor: '#1c2030',
  floorTile: '#222839',
  wall: '#3a4157',
  wallEdge: '#4d5878',
  cover: '#2e3550',
  coverEdge: '#55618a',
  coverTop: '#3d4a6e',
  pedestal: '#4a3d24',
  pedestalEdge: '#8a6d3b',
  diamond: '#f2c94c',
  diamondGlow: '#ffe9a8',
  exit: '#2f7d4f',
  exitEdge: '#5cc98a',
  thief: '#e8e4d8',
  thiefHood: '#3a3f52',
  guard: '#c9503f',
  guardCone: 'rgba(242, 201, 76, 0.15)',
  guardConeEdge: 'rgba(242, 201, 76, 0.55)',
  guardAlert: 'rgba(229, 83, 75, 0.25)',
  camera: '#e5534b',
  cameraCone: 'rgba(229, 83, 75, 0.12)',
  cameraConeEdge: 'rgba(229, 83, 75, 0.5)',
  coin: '#f2c94c',
  alarmLow: '#5cc98a',
  alarmMid: '#f2c94c',
  alarmHigh: '#e5534b',
  panel: '#1a1e2c',
  text: '#eef1f5',
  muted: '#8b93a3',
  gold: '#f2c94c',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'velvet-vault.best';
