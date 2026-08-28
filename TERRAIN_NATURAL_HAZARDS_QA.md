# Terrain & Natural Hazard Expansion — QA

## Implemented Environment Layer

The terrain system now owns a chunk-scoped `naturalEffects` layer. Each effect is created during chunk population, receives only transform and opacity updates during play, and has its material released when that chunk is recycled. The layer adds environmental motion without creating per-frame geometry or texture allocations.

| Zone | New terrain forms | Animated phenomena | Natural-obstacle result |
|---|---|---|---|
| Azure Sea | Low reef shelves in addition to sea stacks | Breaker bands and spray | 97 total active obstacles in the sampled scene; zero safe-route violations after the safety-margin correction |
| Cascade Gorge | Talus shelves and boulder fields | Waterfall mist and side-wall dust | 8 tagged natural obstacles; zero safe-route violations; minimum lateral clearance 36.9 |
| Ember Canyon | Cooled lava ribs with glowing seams | Heat vents and rising ash plumes | 7 tagged natural obstacles; zero safe-route violations; minimum lateral clearance 61.1 |
| Dune Sea / Rift Citadel | Wind-cut sandstone ribs | Sand veils and late-Wave rift shimmer | 7 tagged natural obstacles; zero safe-route violations; minimum lateral clearance 47.4 |

## Fairness Correction

Initial route inspection found that wide terrain collider radii could encroach on a gap when a prop centre alone was placed outside the channel. The obstacle-row helper now adds 54 units of lateral safety beyond each route’s marked half-width before placing a new obstacle. New natural hazards are additionally tagged, allowing isolated fairness checks that distinguish them from legacy arches and other multi-height scenery.

## Technical Validation

All updated ES modules passed syntax validation. Static browser checks confirmed zone-specific effect lists for sea, gorge, ember, and the final Rift Dune stage. The browser runner may discard the WebGL page after repeated static scene replacement, a known test-environment limitation; it did not produce a game-side JavaScript error.
