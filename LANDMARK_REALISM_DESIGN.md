# Landmark Realism Pass

## Design Intent

The landmark layer should look engineered, inhabited, and weathered rather than assembled from isolated primitives. Every large object needs a credible load path into terrain or a marine platform, a maintenance vocabulary at medium distance, and material breakup visible in directional light. The centre of the flight corridor remains open; large structures are treated as flanking scenery or far-horizon anchors.

| Zone | Landmark | Structural logic | Surface treatment | Distance rule |
|---|---|---|---|---|
| Azure Sea | Tidal relay platforms | Caisson footings, wave decks, service gantries, antenna masts | Salt streaks, oxidised blue-grey panels, cool beacon lenses | Hero scan and platforms remain beyond the lateral channel |
| Cascade Gorge | Cliff observatories | Rock-cut terraces, retaining walls, bridge trusses, cable anchors | Damp stone, mineral staining, water runoff, pale service lighting | Spans frame the corridor without crossing the camera path |
| Ember Canyon | Heat-exchange works | Piled plinths, insulated conduits, exhaust stacks, cooling ribs | Charred burgundy steel, soot gradients, orange heat seams | Industrial silhouettes stay beyond the outer canyon wall |
| Dune Sea | Rift archaeology | Buried foundations, buttressed gates, excavation decks, weather stations | Sun-bleached stone, sand abrasion, violet rift corrosion in late waves | Gates and towers sit on distant terraces, not on the route centre |

## Construction Grammar

Near and midground facilities use three nested scales. At the primary scale, the facility receives a sunk footing or plinth. At the secondary scale, it receives buttresses, access decks, bracing, pipes, ladder-like rails, and cable runs. At the tertiary scale, it receives irregular panel strips, service lamps, weathering bands, and sparse warning markers. The result should remain readable from flight speed without forcing a high number of unique GLB assets.

Imported CC0 GLBs remain the principal structural shells. Procedural components only add support, connections, and maintenance detail; they must not obscure the source model silhouette. Detail geometry is shared or kept to low segment counts, while distant structures omit inner detail and use simplified silhouette modules.

## Performance Limits

The pass preserves two hero slots and the existing fixed number of scrolling prop slots. Detail clusters are applied only to hero structures and to a bounded portion of near/midground facility slots. Distant models use the original GLB plus light silhouette attachments. The upgrade must not add per-frame allocations or new collision objects for non-gameplay scenery.

## Verification Criteria

At least one sea relay, gorge observatory, ember heat plant, and dune rift gate must visibly show a grounded base, visible support members, a material/weathering treatment, and three depth bands. Structures must remain outside the direct player flight channel, and a zone switch must rebuild each prop layer only once.
