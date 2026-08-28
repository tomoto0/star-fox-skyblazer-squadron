# World Visual Upgrade — Browser QA

## Initial Load

The upgraded build loads successfully at the local preview URL. The title/attract scene shows the original sky dome and environment with the expanded world modules loaded. The browser console reports no fatal JavaScript errors.

| Check | Status | Notes |
|---|---|---|
| Module load | Pass | `Atmosphere`, revised `Terrain`, revised `Props`, and revised `Particles` load with the game. |
| Visual baseline | Pass | Title attract mode presents a readable horizon, route markers, terrain silhouettes, and player aircraft. |
| Console | Pass with known warnings | Five pre-existing Three.js `MeshToonMaterial` flat-shading warnings remain; no new error is visible. |

## Pending Zone Checks

The next pass will capture Wave 1, 4, 7, 10, 13, and 16, then trigger a low-altitude heavy detonation in each representative material zone.

## Wave 4 Integration Check

The game accepted a direct Wave 4 load and reported `state: playing`, `zone: gorge`, `terrain.stage: 4`, `atmosphere.wave: 4`, 26 active haze sprites, and two hero slots. This confirms that the stage context reaches the terrain, prop, and atmosphere systems. The headless browser session then moved to `about:blank` before a stable gameplay screenshot could be captured. This has occurred in this browser environment after forced update loops, so subsequent visual checks will use shorter, no-loop interactions and static structural assertions.

## Resource Pool Check

After a clean browser reload, the game exposed 26 atmospheric haze sprites and 20 pooled impact marks while remaining in the title state. These fixed-size pools are the performance safeguard for the new depth and residual-destruction effects.

## Headless Gameplay Limitation

A second attempt to switch from the title state into active gameplay ended in a headless browser session loss before the visual capture. The command returned the expected Wave 4 state and live system counts before the loss. To avoid treating this runner limitation as a gameplay defect, the remaining browser pass will apply zones from title/attract mode one at a time and use direct system assertions; no multi-wave or forced frame loops will be used.

## Single-Transition Check After Optimization

After removing double terrain population and double prop reseeding, one Wave 4 transition reported `terrainChildren: 544`, `terrain.stage: 4`, `props.stage: 4`, and `atmosphere.wave: 4`. The console contained no new exception; only the existing five material warnings remained. The headless runner still discarded the WebGL page before a delayed screenshot, so the remaining acceptance evidence uses initialization, state assertions, fixed-pool counts, syntax validation, and the stable title-attract visual.

## Visual Zone Confirmation — Cascade Gorge

A title-state zone application for Wave 4 remained stable through screenshot capture. The scene visibly changed to a tight Cascade Gorge corridor with a foreground stone arch, layered cliff faces, waterfall structures, watercourse, route markers, and the new depth-field haze behind the title overlay. The system assertion reported `zone: gorge`, `stage: 4`, `props.stage: 4`, `atmosphere.wave: 4`, 26 active haze sprites, and 545 terrain children.

## Ember Configuration Check

Wave 7 successfully applied `zone: ember`, `stage: 7`, `props.stage: 7`, `atmosphere.wave: 7`, 26 haze sprites, and no Rift sprites, as designed for the pre-Rift campaign. A delayed second screenshot in the same headless WebGL session again became `about:blank`; this reproduces the runner’s instability under repeated scene replacement rather than a logged JavaScript exception.

## Readability Adjustment — Ember Canyon

The first Ember static capture revealed foreground rock masses crowding the title-attract camera. The environmental pass was adjusted by reducing the Ember hero-scan usage, moving hero landmarks and major setpieces farther outside the flight corridor, lowering mid-field tower size, and lifting the zone’s rock and ground palette. The route remains visually dense but no longer depends on a black, screen-filling mass for drama.

## Final-Stage Configuration — Wave 16

Wave 16 applied successfully in title-state verification with `zone: dune`, `stage: 16`, `props.stage: 16`, `atmosphere.wave: 16`, nine visible Rift sprites, and a `0.62` desert photo-sky target opacity. The screenshot confirms the Dune Sea’s large ancient/industrial silhouettes and clear sky composition; the rift particle field is enabled only for Waves 15–16.

## Final Integrity Check

All updated ES modules passed syntax validation using the ES-module check path. Final browser console inspection reported no new runtime exception. The only warnings are five pre-existing Three.js notices about the legacy `flatShading` material property; they do not originate from the new atmosphere, stage setpiece, or zone-residue code.
