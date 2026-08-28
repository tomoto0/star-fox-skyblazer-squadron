# Ship Visual Refinement — QA

## Implemented Detail Layers

| Fleet | New visual elements | Runtime state |
|---|---|---|
| Player / wingmates | Wing-root hinges, dual gun fairings, recessed muzzle lights, paired RCS nozzles, four-petal vectoring exhaust rims | Exhaust petals open and subtly oscillate with boost; existing twin engine glow and contrails remain intact |
| Imported hostile hulls | Metal-grain service panels, structural rails, physical exhaust cans, emissive engine collars, role-scaled engine count, caution lamps, smoke emitter | Engine pulse follows flight state; at 38% damage and above the warning lights and smoke activate progressively |
| Heavy hostile hulls | Four-engine kit, reinforced command spine, extra hardpoints | Heavy silhouettes retain their separate IFF classification and warm hostile lighting |
| Boss hulls | Segmented armour belts, protected cooling conduits and service lights in addition to existing rails, guns, reactor rings, weak points and scorches | Existing weak-point and hull-scorch systems remain unchanged, so combat telegraphs and hit testing are preserved |

## Browser Validation

The player mesh exposes two engine-petal rigs and two engine glow anchors. After the asynchronous CC0 fighter hull loaded, a spawned fighter produced the expected two engine glows, two caution lights, and damage smoke. At approximately 70% applied damage, smoke opacity was 0.159 and warning-light opacity was 0.183, confirming the critical-damage visual path.

The refined entity modules (`shipFactory.js`, `player.js`, `enemies.js`, and `bosses.js`) passed ES-module syntax validation. The browser console contains only pre-existing Three.js material-property warnings and no new runtime exception after the clone-safe visual-part lookup was introduced.
