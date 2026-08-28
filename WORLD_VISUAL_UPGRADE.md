# World Visual Upgrade — All-Stage Pass

## Goal

The campaign should read as a sequence of inhabited, damaged flight corridors rather than four repeating palettes. The upgrade keeps the current clear centre-line and performance-oriented pooling, while adding stage-specific silhouettes, atmospheric depth, and material-aware destruction.

## Stage Direction

| Wave | Zone | Landmark language | Atmospheric layer | Destruction profile |
|---:|---|---|---|---|
| 1 | Azure Sea | Relay buoys and sea stacks | Salt spray | Steam, cool sparks, ripples |
| 2 | Azure Sea | Breakwater arches and stranded stations | Horizon haze | Spray and fractured hulls |
| 3 | Azure Sea | Tidal relay bastion | Storm fronts | Heavy structural fireballs |
| 4 | Cascade Gorge | Cataract shelves | Waterfall mist | Wet rock dust |
| 5 | Cascade Gorge | Survey bridges and cliff works | Valley haze | Masonry fragments |
| 6 | Cascade Gorge | Skyfall control span | High mist | Reinforced facility breakup |
| 7 | Ember Canyon | Cinder narrows | Rising embers | Soot, hot fragments |
| 8 | Ember Canyon | Ash relay works | Dense ash | Burning machinery |
| 9 | Ember Canyon | Magma spire approach | Heat haze | Lava-tinted shockwaves |
| 10 | Dune Sea | Wind-carved ruins | Fine sand | Sand plume and stone chips |
| 11 | Dune Sea | Sunken convoy field | Crosswind dust | Salvage fragments |
| 12 | Dune Sea | Ancient gate line | Sun glare | Heavy ruin collapse |
| 13 | Ember Canyon | Command return route | Soot trail | Veteran-route industrial blasts |
| 14 | Ember Canyon | Obsidian citadel | Ember storm | Obsidian shards and core flare |
| 15 | Dune Sea | Rift approach | Charged dust | Violet energy-sand bursts |
| 16 | Dune Sea | Rift citadel | Rift haze | Multi-stage citadel collapse |

## Implementation Principles

The upgrade uses existing CC0/CC-BY assets and procedural geometry only. It does not introduce an unlicensed model dependency. New scenery remains outside the collision corridor unless it is an intentional, readable flight obstacle. Pools, shared geometry, and capped sprite counts preserve the existing performance envelope.

Stage context is passed from `Game.loadWave()` to `Sky`, `Terrain`, and `Props`. Every wave receives a deterministic visual role inside its zone. The sky system gains a low-cost atmospheric field; terrain gains a stage setpiece vocabulary; props use the same stage context to vary density and installation scale.

Explosions retain the existing pooled particle and debris systems, but receive a local material profile. Sea impacts add spray and ripples, gorge impacts add cool stone dust, ember impacts add ash and hot sparks, and dune impacts add broad sand plumes. Ground-proximate heavy detonations also leave temporary, pooled scorch or energy marks that scroll with the world.

## Acceptance Criteria

The four zones must remain instantly recognisable, while waves within a zone gain distinct landmark and atmospheric composition. In browser verification, Wave 1, 4, 7, 10, 13, and 16 must each show a visibly different corridor. Heavy detonations must show fire, debris, shockwave, and a zone-specific residual effect without unbounded allocations or gameplay collisions outside the marked route.
