# Landmark Realism Pass — QA

## Scope

This verification covers the grounded facility foundations, service assemblies, textured PBR landmark materials, zone-specific megasite additions, and the scale normalization of imported external landmark models.

| Check | Result | Evidence |
|---|---|---|
| Support structures | Pass | Facility slots create three layers: foundation, service assembly, and the source GLB shell. |
| Material detail | Pass | All newly created PBR landmark materials share the existing CC0 `metal_diff.jpg` detail map rather than allocating one texture per asset. |
| Zone-specific construction | Pass | Marine caissons, gorge retaining anchors, Ember exhaust ducts, and Dune survey pylons are constructed through the megasite zone branch. |
| Flight-corridor clearance | Pass after adjustment | Station rings and bridges are forced to 700–1,040 units laterally; compact imported antennas and satellite dishes use 20–58-unit target sizes rather than the earlier over-scaled configuration. |
| Scene complexity | Pass | At full prop initialization the scene contained 3,071 visible meshes, approximately 94,064 source triangles, 11 grounded facility assemblies, and 42 GPU textures. |
| Runtime errors | Pass | Browser console reported no new JavaScript errors. Five pre-existing `MeshToonMaterial` flat-shading warnings remain. |

## Visual Result

The title-attract capture now displays a clear sea-level corridor framed by smaller relay silhouettes, rocks, and distant infrastructure. In particular, imported station rings, bridges, dishes, and antennae have been shifted away from the camera path and reduced to horizon-scale landmarks. The readability issue caused by giant external props in the foreground was corrected during this pass.

## Known Test-Environment Limitation

The headless WebGL viewer can discard its page after repeated scene replacement. For that reason, stable title-attract captures, prop-layer assertions, sizing assertions, syntax checks, and a final error-log inspection form the acceptance evidence. This limitation did not produce a game-side JavaScript exception.
