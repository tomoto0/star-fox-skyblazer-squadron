# Terrain & Natural Hazard Expansion

## Objective

Each combat zone must become a coherent flying environment rather than a scattering of scenery. Terrain, weather, and obstacles will express a specific natural process while preserving a visibly open route. The safe route remains the curve exposed by existing navigation beacons; new lethal obstacles never spawn inside that route’s half-width.

| Zone | Terrain expansion | Animated natural phenomena | Gameplay obstacle policy |
|---|---|---|---|
| Azure Sea | Reef shelves, tide channels, breaker walls, collapsed offshore pylons | Moving foam bands, spray curtains, buoy oscillation | Sea stacks and breakers remain outside the marked channel; water motion is visual only |
| Cascade Gorge | Talus fans, overhangs, ravines, stepped tributaries, bridge scars | Waterfall sheets, drifting gorge mist, side-wall rockfall dust | Pillars and fallen slabs use the existing obstacle-row gap rule; rockfall remains on cliff flanks |
| Ember Canyon | Basalt shelves, lava fissures, cooled flow ribs, ash gullies | Pulsing heat vents, rising ash plumes, heat shimmer strips | Basalt needles and crystal outcrops are kept beyond the lava-marked route line |
| Dune Sea | Wind-cut ridges, buried ruins, salt pans, excavation trenches | Moving sand veils, dune crest drift, late-Wave rift flares | Broken obelisks and dune ribs remain outside the broadest route; sand is visual rather than random pushback |

## Fairness Rules

The route centre and its zone-specific half-width are the inviolable no-spawn corridor. Any collider is generated through the existing obstacle-row helper or automatically rejected if it lies beyond the reachable combat field. Dynamic natural phenomena use non-colliding visual meshes unless their collision volume is explicit, telegraphed, and placed outside the central route.

Natural effects are chunk-owned. Each recycled chunk disposes its visual references and rebuilds them deterministically from the active zone. Repeated frame work is limited to transform and opacity updates; no new geometry, texture, or particle allocation occurs during play.

## Wave Identity

The existing stage variant is used to rotate the terrain composition across each return to a zone. Early waves emphasize navigable geology; mid waves add environmental complexity; late zone returns intensify the same signatures rather than changing the core safe-route rule.

## Acceptance Criteria

Every zone shows one distinctive animated natural phenomenon and at least two additional environmental forms beyond its previous set. New collidable obstacles retain a visible traversal gap that agrees with route markers. Zone transitions rebuild without error, and the new animation references remain bounded to the fixed chunk pool.
