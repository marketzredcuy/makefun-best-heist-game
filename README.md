# The Velvet Vault

A museum heist game for [make.fun's best heist game bounty](https://make.fun/bounty/best-heist-game-20261122-0559).

One room. Two guards. Two cameras. One diamond.

You are the thief. Sneak past the guards' vision cones and the cameras'
sweeping red cones, lift the Velvet Diamond from its pedestal, and slip
out the green door — before the alarm meter hits 100%.

## How to play

- **WASD / arrow keys** — move
- **SHIFT** — sneak (slower, but the cones spot you from much closer)
- **E or mouse click** — toss a coin (you carry three). The nearest guard
  walks over to look at the noise, which opens a gap in the patrol.
- **P** — pause

Hide behind the display cases and pillars: they block sight, so a cone
stops at them. A guard that sees you gives chase; a guard that touches
you catches you. The alarm climbs while anyone sees you and falls while
you are hidden. Grab the diamond, then reach the green door for a clean
getaway — fast and quiet pays more.

## Run it

```sh
node serve.ts
```

Then open <http://localhost:8080> in a desktop browser. No build step,
no network request: the game is plain static files under `game/`.

## Files

- `game/` — the playable game (open `game/index.html`)
- `game/src/world.js` — the heist rules: thief, guards, cameras, alarm, coins
- `game/src/render.js` — drawing, including raycast vision cones
- `game/src/input.js` — keyboard and mouse input
- `game/src/shots.js` — the four screenshot scenes
- `game/src/sound.js` — synthesised sounds (Web Audio, no files)
- `game/src/config.js` — every tuning number and the room layout
- `game/src/random.js` — the seeded random generator
- `game/src/main.js` — boot and the game loop
- `main.ts` — the hand-in program (Node 22, standard library only)
- `screenshots/` — four renders of the game's own code
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged

## License

MIT. See `LICENSE`.
