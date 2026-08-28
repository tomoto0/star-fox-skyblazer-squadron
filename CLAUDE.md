# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

STAR FOX "Skyblazer Squadron" — a commercial-grade browser 3D rail shooter (Three.js), built entirely from the four concept paintings in `assets/concept_image/`. 12 waves / 4 zones / 4 bosses.

## Running & verifying

- **Run:** `node server.mjs` → http://127.0.0.1:8747 (a ~30-line static file server on port 8747). `.claude/launch.json` has a `starfox` config for `preview_start`. Python's `http.server` fails in the sandbox — use `server.mjs`.
- **No build step.** Three.js 0.166 loads via the importmap in `index.html` straight from `node_modules`; everything under `src/` is native ES modules. Editing a file + reloading the page is the entire dev loop.
- **No test suite** (the `npm test` script is a stub). Verification is done by driving the game in a browser and inspecting state/screenshots.

### Driving the game headlessly (in the Browser pane)
`src/main.js` runs the loop via `requestAnimationFrame` and exposes `window.__game`. The Browser pane counts as `document.hidden`, so rAF stalls — **advance the game manually**:
```js
const g = window.__game;
g._confirm();                    // dismiss title → state 'playing' (synthetic keys don't reach the page)
for (let i=0;i<60;i++) g.update(1/60);
g.render();
```
- For correct screenshots, first `g.renderer.setSize(innerWidth,innerHeight); g.composer.setSize(innerWidth,innerHeight); g.camera.aspect=innerWidth/innerHeight; g.camera.updateProjectionMatrix();` (the pane's native size differs from the canvas).
- Jump waves with `g.loadWave(n)`; **force a boss** with `g._spawnBoss(g.waveSpec.boss)` (bosses otherwise spawn on a wave timer at `spec.bossAt`).
- `util.js` helpers (`rand`, `pick`, …) are module-scoped and **not** available in the eval console — inline `Math.random()` instead.
- Driving a whole ~60s wave synchronously in one call can exceed a 30s tool timeout; step in chunks and re-check state.

## Architecture

`index.html` → `src/main.js` (`new Game(canvas)` + rAF loop) → **`src/game/game.js`** is the orchestrator. `Game` owns the renderer/`EffectComposer` (UnrealBloom + ACESFilmic tone mapping), scene, chase camera, lights, and every subsystem; it runs the `title / playing / branch / result / gameover` state machine, `_collisions()` (one big per-frame pass), and `explodeAt()` (the central choke point for kill VFX/SFX + debris). Subsystems are plain classes constructed once and updated each frame.

### The rail model (critical coordinate convention)
The **player is fixed at `PLAYER_Z = -20`** (constant in `src/entities/player.js`); the *world scrolls toward the camera* at `scroll = BASE_SCROLL(46) * player.speedFactor`. Consequences:
- Things ahead of the player sit at **more-negative z**; they scroll toward +z and are despawned once `z > ~20`.
- Terrain chunks (`src/world/terrain.js`) and scenery props (`src/world/props.js`) each add `scroll*dt` to their z and recycle when they pass the front.
- Enemies mostly scroll forward too; `seeker`/`sniper` self-drive their z via waypoints (excluded from the generic forward-scroll), and turrets/ground units ride the terrain exactly (no extra closing speed).
- The camera is a chase cam: `cam.x = player.x`, `cam.z = PLAYER_Z + 36`, looking straight ahead, so the ship stays screen-centred at any x/y.

### Collision system (`terrain.forEachObstacle`)
Scenery collision is **cylinder-based**, not mesh-based. `terrain._autoCollideChunk()` fits a `{cx,cy,cz,rh,hy,damage}` cylinder (horizontal radius `rh`, vertical half-height `hy`) to every chunk child's bounding box, except those flagged `userData.noCollide` or beyond `COLLIDE_REACH`. Ring/arch gates are toruses whose bbox would plug the fly-through hole, so instead `_torusColliders()` chains small proxy colliders (plain `{userData:{collide}}` objects pushed onto `chunk.userData.obstacles`) around the rim/arch curve. `game._collisions` consumes them via `terrain.forEachObstacle((cx,cy,worldZ,rh,hy,damage)=>…)` with `hypot(x-cx, z-cz) < rh && abs(y-cy) < hy` tests — used for player crash, laser/charge/bomb absorption.

### Combat entities
- **`src/entities/enemies.js`** — `STATS`/`BUILDERS`/AI `switch` keyed by type. `spawn()` + `formation()` (patterns: line/vee/column/sides/wall). Types include ground units (`ground:true` → rest on the floor, `head`/`turret`/`rack` sub-groups aim). An **elite scheduler** in `update()` random-spawns air elites or ground squads during non-boss waves, ramping with wave number.
- **`src/entities/projectiles.js`** — pooled bolts. `BULLET` presets define per-type `shape` (orb/bolt/shell/ring/missile/spike); each pooled enemy bolt is a group with all shape sub-meshes toggled per type. `fireEnemy(from, dir, type, speedOverride)` — a **raw colour number as `type` is a legacy path** (bosses use it) that maps to `orb`. Player: `fireLaser`/`fireCharge`/`fireBomb`; allies: `fireAlly`.
- **`src/entities/bosses.js`** — `BOSS_BY_WAVE = {3,6,9,12}`. `BossBase` holds `weakpoints` (glowing weak spots) + `hitTest(point,r)` returning `{kind:'weak'|'body', wp}`, and `_maneuver(dt,player,opts)` = shared waypoint AI (forward lunges / retreats / lateral strafes / bank). `scaleBoss(boss,s)` grows `group.scale` and multiplies `bodyRadius` + each `weakpoint.radius` to keep hit radii in sync — **do not use on `EmberSerpent`**, whose custom hitTest reads local segment positions; it's enlarged by editing its construction dimensions instead.
- **`src/entities/wingmates.js`** — allies fly **autonomous** waypoint patrols (per-pilot `xStyle`/`yBand`/`zBand`), deliberately **not** anchored to `player.x/y`. They engage enemies, fire bursts, drop bombs on clusters (`game.allyBomb`), and each has a signature `_trySpecial` move.
- **`src/entities/shipFactory.js`** — all ships/enemies are procedurally modelled here from `toonMat` primitives (`buildArwing`, `buildDrone`, …). `buildArwing(opts)` takes `{wing,darkWing,engine}` team colours (reused for wingmates).

### World & content
- **`src/world/palettes.js`** — `ZONES` (sea/gorge/ember/dune: sky/fog/light/water/rock colours + `skyImage` key) and `WAVE_ZONE[waveNum]`.
- **`src/game/waves.js`** — `WAVES` array indexed by **1-based** wave number; each is `{zone, length, boss, events:[ev(t,kind,...args)]}` where events fire at `t` seconds (`form`/`rings`/`pick`/`say`). `FINAL_WAVE` = 12.
- **`src/world/sky.js`** — stylised gradient dome + painted billboard clouds **plus** cross-fading photographic HDRI domes per zone (`skyImage`).
- **`src/core/audio.js`** — fully synthesised WebAudio: SFX methods (`laser`, `explosion`, `enemyFire(type)`/`impact(type)` are per-weapon + throttled) and a per-zone 16-step sequencer (`TRACKS`).

## Conventions & gotchas

- **Cel look:** almost everything uses `toonMat()` (`MeshToonMaterial`, 4-step gradient map). MeshToon **ignores env maps** — that is *why* `scene.environment` (a PMREM of the zone sky, set in `game._applyEnv`) reflects only on the `MeshStandardMaterial` CC0 props/ships/debris, leaving the cel world untouched. Keep new gameplay meshes on `toonMat` unless you specifically want reflections.
- **Shared temp vectors** `_v1`/`_v2`/`_v3` are exported from `util.js` and reused everywhere per-frame — `.clone()` before storing one past the current statement.
- **CC0 texture detail maps:** `loadDetailTexture(url,{brightness,contrast,desat,repeat})` brightens/desaturates a texture so multiplying it over the vertex-colour palette doesn't dim the hue (keep brightness ~2.4–2.7).
- **Assets** (`assets/`, all CC0; credits in `assets/CREDITS_ASSETPACK.txt`, `assets/textures/CREDITS.txt`): Poly Haven textures + tone-mapped 3072px equirect skyboxes (`backgrounds/`), Kenney particle PNGs (`particles/`) and Space Kit GLBs (`models/debris/`, `models/props/`), Quaternius ships (`models/ships/`). GLBs/glTFs load via `GLTFLoader` (available through the `three/addons/` importmap). The 444 MB source pack `starfox_rail_shooter_CC0_asset_pack.zip` is **only partially extracted** — pull individual files from it rather than unzipping everything; downscale any Poly Haven JPEG (originals are 8192px/~20 MB).
- **Perf:** the renderer/bloom is the bottleneck (~11 ms); collision is cheap (~0.6 ms even at 500+ colliders). Sprite/particle pools and the debris/props pools are fixed-size — reuse slots, don't allocate per frame.
- `README.md` documents the incremental feature history (v2–v13) if you need the "why" behind a subsystem.
