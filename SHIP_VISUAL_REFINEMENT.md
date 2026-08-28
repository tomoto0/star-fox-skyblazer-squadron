# Ship Visual Refinement

## Intent

The craft roster should read as engineered hardware at combat speed: readable silhouette first, then a second layer of panels, hardpoints, thermal management, and battle wear. The existing CC0 hulls remain the primary geometry; procedural detail is attached as lightweight shared-material hardware so the upgrade does not introduce per-unit texture loading.

| Fleet | Structural language | Detail layer | State animation |
|---|---|---|---|
| Player and wingmates | White/red interceptor hull with broad swept wings | Wing-root hinges, RCS thrusters, dorsal sensor bridge, recessed gun ports, plated engine petals | Thrust petals and afterburner scale follow boost; red warning lamps pulse on low health |
| Hostile fighters | Dark armoured imported hulls with distinct role silhouettes | Panel rails, forward sensor ring, weapon pods, physical exhaust cans, navigation strobes | Engine brightness responds to flight; critical damage exposes orange warning glow and smoke sprite |
| Heavy / carrier hulls | Broad armoured decks and command spines | Four-point hardpoint rails, hull conduits, dorsal heat sinks, turret collars | Engine crown pulse, caution strobes, proportionally restrained damage smoke |
| Bosses | Existing bespoke combat hardware remains primary | Additional segmented armour belts, hull conduits, reactor maintenance nodes | Scorch marks and weak-point status remain legible; never obscure boss attacks or hit targets |

## Performance and Readability Rules

Reusable primitive geometry and the preloaded CC0 hulls are used for recurring enemies. The player uses a bounded set of extra pieces and shares the already-loaded metal detail texture. Damage smoke and warning lamps are state-driven and pooled or strictly bounded. Friendly engine hues remain cool cyan or team-coloured; hostile units retain warm red/orange/magenta cues.

## Acceptance Criteria

Player and wingmates gain mechanically plausible joints, control nozzles, weapons, and engine petals. Imported hostile hulls gain visible physical propulsion, hardpoint, and panel layers without hiding their IFF frames. Enemy damage state becomes visible before destruction. Boss hardware is enhanced without changing hitboxes or weakening established boss telegraphs.
