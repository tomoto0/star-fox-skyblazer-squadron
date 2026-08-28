import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { rand, pick, TAU, loadDetailTexture } from '../core/util.js';
import { flightRoute } from './terrain.js';

/**
 * Scrolling scenery layer. Low-cost CC0 kit pieces form the readable midground,
 * while two optimized Poly Haven scans are used sparingly as hero landmarks.
 * Procedural megasites add layered towers, trusses, emitters and rings without
 * duplicating a heavy model in every slot.
 */
const KENNEY = [
  'hangar_largea', 'hangar_rounda', 'hangar_smallb', 'machine_generatorlarge',
  'turret_double', 'turret_single', 'satellitedish_large', 'satellitedish',
  'rocket_basea', 'rock_largea', 'rock_largeb', 'rock_crystalslargea',
  'craft_speedera', 'craft_miner',
  'aero_station_ring', 'scifi_antenna', 'scifi_bridge', 'scifi_machine',
];
const EXTERNAL_PROP_PATHS = {
  aero_station_ring: 'external/aero_station_ring',
  scifi_antenna: 'external/scifi_antenna',
  scifi_bridge: 'external/scifi_bridge',
  scifi_machine: 'external/scifi_machine',
};
const HERO_PATHS = {
  hero_coast_rock: 'hero/hero_coast_rock',
  hero_desert_rock: 'hero/hero_desert_rock',
};
const SHIPS = ['striker', 'executioner', 'omen', 'insurgent'];
const ROCKS = ['rock_largea', 'rock_largeb', 'rock_crystalslargea'];
const FACILITIES = new Set([
  'hangar_largea', 'hangar_rounda', 'hangar_smallb', 'machine_generatorlarge',
  'turret_double', 'turret_single', 'satellitedish_large', 'satellitedish',
  'rocket_basea', 'aero_station_ring', 'scifi_antenna', 'scifi_bridge', 'scifi_machine',
]);
const ZONE_PROP_POOLS = {
  // Close geology is built by terrain.js, which provides route-safe, zone-specific
  // cliff forms. Imported kit props therefore stay engineering/settlement accents
  // in the far layer instead of placing an oversized scan across the cockpit view.
  sea: ['hangar_rounda', 'satellitedish_large', 'scifi_antenna', 'aero_station_ring'],
  gorge: ['scifi_bridge', 'scifi_antenna', 'hangar_rounda', 'turret_double', 'satellitedish'],
  ember: ['scifi_machine', 'machine_generatorlarge', 'rocket_basea', 'turret_double', 'scifi_bridge'],
  dune: ['scifi_bridge', 'scifi_antenna', 'aero_station_ring', 'hangar_largea', 'rocket_basea', 'machine_generatorlarge'],
};

const SPACING = 145;
const N_PROP = 16;
const N_SHIP = 5;
const N_HERO = 2;
const FRONT = 150;

// Large imported facilities and procedural megasites are visual-only. Keep them
// disabled until they have a gameplay role and collision model; otherwise they
// can read as opaque black structures that obstruct the flight view.
const SHOW_LARGE_ARTIFICIAL_SCENERY = false;

// Reused CC0 detail map keeps procedural engineering surfaces from reading as
// flat-colour primitives, without adding another texture request per landmark.
const metalDetail = loadDetailTexture('./assets/textures/metal_diff.jpg', {
  repeat: 3.6, brightness: 1.38, contrast: 0.72, desat: 0.9,
});
const UP = new THREE.Vector3(0, 1, 0);

function pbr(color, emissive = 0x000000, intensity = 0, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color, emissive, emissiveIntensity: intensity,
    // The asynchronously prepared canvas texture can temporarily be a blank
    // image on WebGL/mobile drivers, multiplying an otherwise valid structure
    // into a black silhouette. Landmark paint is therefore the safe default;
    // a caller opts into the detail texture only where its decode is assured.
    map: opts.detail === true ? metalDetail : null,
    roughness: opts.roughness ?? 0.63,
    metalness: opts.metalness ?? 0.38,
    envMapIntensity: opts.env ?? 0.48,
    transparent: !!opts.transparent,
    opacity: opts.opacity ?? 1,
  });
}

/** Build a visible load-bearing member between two points. */
function strutBetween(a, b, radius, material, sides = 6) {
  const delta = b.clone().sub(a);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), sides), material);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(UP, delta.normalize());
  return mesh;
}

/**
 * A structural foundation for every man-made landmark. The source kits use
 * independent origin points, so placing them directly on the world plane made
 * dishes and antennas read as floating. This shared base gives each facility a
 * visible load path into the terrain or sea deck before the kit model begins.
 */
function buildFoundation(referenceSize, zoneId = 'dune') {
  const palette = {
    sea:   { slab: 0x3f6273, edge: 0x172c3b, paint: 0x668fa0, light: 0x62d8ff },
    gorge: { slab: 0x746650, edge: 0x363b3e, paint: 0x8c8068, light: 0x8fe6ff },
    ember: { slab: 0x663844, edge: 0x2b1e28, paint: 0x954553, light: 0xff6938 },
    dune:  { slab: 0x7b6953, edge: 0x30313a, paint: 0xa88f6a, light: 0x9b82ff },
  };
  const c = palette[zoneId] ?? palette.dune;
  const g = new THREE.Group();
  const r = Math.max(5, referenceSize * 0.20);
  const h = Math.max(2.8, referenceSize * 0.08);
  const slab = pbr(c.slab), edge = pbr(c.edge, 0x000000, 0, { roughness: 0.76, metalness: 0.25 });
  const paint = pbr(c.paint, 0x000000, 0, { roughness: 0.7, metalness: 0.28 });
  const glow = pbr(0x10151e, c.light, 1.1, { roughness: 0.28, metalness: 0.52 });

  // Three tier footing visibly sinks into the landscape. A larger buried lower
  // ring, service deck and central plinth establish a legible load path.
  const buried = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.38, r * 1.55, h * 0.52, 12), edge);
  buried.position.y = -h * 0.06; g.add(buried);
  const footing = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.22, r * 1.38, h * 0.72, 12), slab);
  footing.position.y = h * 0.30; g.add(footing);
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.10, r * 1.16, h * 0.22, 14), paint);
  deck.position.y = h * 0.74; g.add(deck);
  const central = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.76, r * 0.86, h * 0.36, 10), edge);
  central.position.y = h * 0.96; g.add(central);

  // Panel joints and access grating stop the deck from reading as a generic disc.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    const seam = new THREE.Mesh(new THREE.BoxGeometry(r * 0.62, h * 0.045, 0.18), edge);
    seam.position.set(Math.cos(a) * r * 0.48, h * 0.87, Math.sin(a) * r * 0.48);
    seam.rotation.y = -a; g.add(seam);
  }
  const walkway = new THREE.Mesh(new THREE.BoxGeometry(r * 1.08, h * 0.08, r * 0.32), edge);
  walkway.position.set(0, h * 0.89, r * 0.82); g.add(walkway);
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, r * 1.05, 5), paint);
    rail.position.set(side * r * 0.5, h * 1.35, r * 0.96); rail.rotation.z = Math.PI / 2; g.add(rail);
  }

  // Six angled concrete/steel buttresses tie the deck into the lower ring. On
  // marine sites, four deeper caissons descend below the wave deck.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + Math.PI / 6;
    const low = new THREE.Vector3(Math.cos(a) * r * 1.15, h * 0.05, Math.sin(a) * r * 1.15);
    const high = new THREE.Vector3(Math.cos(a) * r * 0.72, h * 1.08, Math.sin(a) * r * 0.72);
    g.add(strutBetween(low, high, Math.max(0.22, r * 0.055), edge));
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.09, r * 0.13, h * 0.18, 5), paint);
    cap.position.copy(low); cap.position.y = h * 0.03; g.add(cap);
  }
  if (zoneId === 'sea') {
    for (const side of [-1, 1]) for (const front of [-1, 1]) {
      const pile = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.11, r * 0.14, h * 2.5, 7), edge);
      pile.position.set(side * r * 0.88, -h * 0.62, front * r * 0.88); g.add(pile);
      const brace = strutBetween(new THREE.Vector3(side * r * 0.88, -h * 0.15, front * r * 0.88), new THREE.Vector3(side * r * 0.40, h * 0.7, front * r * 0.40), Math.max(0.14, r * 0.035), paint, 5);
      g.add(brace);
    }
  }

  const beacon = new THREE.Mesh(new THREE.TorusGeometry(r * 0.74, Math.max(0.16, h * 0.06), 6, 18), glow);
  beacon.rotation.x = Math.PI / 2; beacon.position.y = h * 1.14; g.add(beacon);
  g.userData.topY = h * 1.18;
  return g;
}

/** A lightweight layered base/fortress that sits behind the gameplay corridor. */
function buildMegasite(zoneId = 'dune') {
  const palettes = {
    sea:   { shell: 0x34566d, trim: 0x183149, glow: 0x62d8ff, hot: 0xffbf72 },
    gorge: { shell: 0x685848, trim: 0x2d3440, glow: 0x8fe6ff, hot: 0xffbd68 },
    ember: { shell: 0x55303a, trim: 0x241d28, glow: 0xff6a38, hot: 0xffd36a },
    dune:  { shell: 0x5c5660, trim: 0x242a3d, glow: 0x9b82ff, hot: 0xffad56 },
  };
  const c = palettes[zoneId] ?? palettes.dune;
  const g = new THREE.Group();
  const shell = pbr(c.shell), trim = pbr(c.trim), glow = pbr(0x101b2b, c.glow, 2.1), hot = pbr(0x241510, c.hot, 1.5);

  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(13, 17, 5, 10), shell);
  plinth.position.y = 2.5; g.add(plinth);
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, 1.3, 12), trim);
  deck.position.y = 5.3; g.add(deck);

  // Four stepped spires give the installation a complex, readable silhouette.
  for (const side of [-1, 1]) {
    for (const z of [-1, 1]) {
      const x = side * 9, zz = z * 8;
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 3.7, 20 + (z > 0 ? 7 : 0), 6), shell);
      tower.position.set(x, 15, zz); g.add(tower);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(3.2, 6, 6), trim);
      cap.position.set(x, tower.position.y + (20 + (z > 0 ? 7 : 0)) * 0.5 + 3, zz); g.add(cap);
      for (let h = 0; h < 3; h++) {
        const window = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.18), glow);
        window.position.set(x + side * 2.6, 10 + h * 5, zz - 0.2); g.add(window);
      }
    }
  }

  // Cross-braced bridges and antenna arrays add parallax-friendly fine detail.
  for (const y of [10, 18]) {
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(25, 0.75, 1.0), trim);
    bridge.position.set(0, y, 0); g.add(bridge);
    for (const side of [-1, 1]) {
      const brace = new THREE.Mesh(new THREE.BoxGeometry(0.55, 10, 0.55), trim);
      brace.position.set(side * 6, y - 4, 0); brace.rotation.z = side * 0.58; g.add(brace);
    }
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(9.5, 0.55, 8, 20), pbr(c.trim, c.glow, 0.45));
  ring.position.set(0, 25, -2); g.add(ring);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.65, 8, 6), hot);
    beacon.position.set(Math.cos(a) * 9.5, 25 + Math.sin(a) * 9.5, -2); g.add(beacon);
  }
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.7, 23, 6), trim);
  mast.position.set(0, 31, 3); g.add(mast);
  const dish = new THREE.Mesh(new THREE.ConeGeometry(4.2, 1.8, 16, 1, true), pbr(c.shell, c.glow, 0.35));
  dish.rotation.x = -0.72; dish.position.set(0, 43, 3); g.add(dish);
  const core = new THREE.Mesh(new THREE.SphereGeometry(1.4, 10, 8), glow);
  core.position.set(0, 43, 1.8); g.add(core);

  // Offset sensor masts and service pods turn the hero silhouette into a
  // working complex. The small dish groups rotate at update time while the
  // larger hull remains static, keeping the distant layer inexpensive.
  const scannerRotors = [];
  for (const side of [-1, 1]) {
    const mastBase = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.6, 8, 7), trim);
    mastBase.position.set(side * 28, 8, -8); g.add(mastBase);
    const mastArm = new THREE.Mesh(new THREE.BoxGeometry(2.8, 22, 2.8), shell);
    mastArm.position.set(side * 28, 19, -8); g.add(mastArm);
    const rotor = new THREE.Group();
    rotor.position.set(side * 28, 31, -8);
    const dish = new THREE.Mesh(new THREE.ConeGeometry(6.4, 2.0, 12, 1, true), pbr(0x263849, c.glow, 0.46));
    dish.rotation.z = side * 0.74; rotor.add(dish);
    const receiver = new THREE.Mesh(new THREE.SphereGeometry(0.84, 7, 6), hot);
    receiver.position.set(side * 4.1, 0, 0); rotor.add(receiver);
    g.add(rotor); scannerRotors.push(rotor);
    const pod = new THREE.Mesh(new THREE.BoxGeometry(8.6, 3.6, 6.4), pbr(c.shell, 0x000000, 0, { roughness: 0.58, metalness: 0.42 }));
    pod.position.set(side * 33, 8.2, 3); g.add(pod);
    const podLight = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.4, 0.28), hot);
    podLight.position.set(side * 33, 8.2, -0.28); g.add(podLight);
  }
  const perimeterRails = new THREE.Group();
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(31, 0.34, 0.34), trim);
    rail.position.set(0, 8.8, side * 17); perimeterRails.add(rail);
    for (const x of [-12, 0, 12]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.34, 4.4, 0.34), shell);
      post.position.set(x, 6.7, side * 17); perimeterRails.add(post);
    }
  }
  g.add(perimeterRails);

  // Service decks, pipe runs and weathering panels break the silhouette into
  // believable construction layers when the landmark slides through midground.
  const weather = pbr(c.hot, 0x000000, 0, { roughness: 0.88, metalness: 0.12 });
  for (const side of [-1, 1]) {
    const catwalk = new THREE.Mesh(new THREE.BoxGeometry(12, 0.55, 3.1), trim);
    catwalk.position.set(side * 18, 16, -5); g.add(catwalk);
    const railTop = strutBetween(new THREE.Vector3(side * 12, 17.3, -6.2), new THREE.Vector3(side * 24, 17.3, -6.2), 0.16, shell, 5);
    const railLow = strutBetween(new THREE.Vector3(side * 12, 16.2, -6.2), new THREE.Vector3(side * 24, 16.2, -6.2), 0.12, shell, 5);
    g.add(railTop, railLow);
    for (let r = 0; r < 4; r++) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 1.35, 5), shell);
      post.position.set(side * (12 + r * 4), 16.75, -6.2); g.add(post);
    }
    const pipeA = strutBetween(new THREE.Vector3(side * 15, 6, 7), new THREE.Vector3(side * 22, 29, 3), 0.7, weather, 7);
    const pipeB = strutBetween(new THREE.Vector3(side * 20, 9, 5), new THREE.Vector3(side * 27, 24, 1), 0.45, trim, 6);
    g.add(pipeA, pipeB);
    for (const y of [8, 15, 22]) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.2, 0.22), weather);
      panel.position.set(side * 15.7, y, 8.2); g.add(panel);
    }
  }
  for (let i = 0; i < 7; i++) {
    const a = -0.9 + i * 0.3;
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.26, 6), hot);
    bolt.rotation.x = Math.PI / 2;
    bolt.position.set(Math.sin(a) * 15.4, 5.9, Math.cos(a) * 15.4); g.add(bolt);
  }

  // Zone-specific structural logic: sea platforms use pile braces, the canyon
  // uses terrace anchors, Ember needs insulated exhaust pipes, and Dune gains
  // half-buried survey pylons that turn violet on the late Rift approach.
  if (zoneId === 'sea') {
    for (const side of [-1, 1]) for (const front of [-1, 1]) {
      const pile = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.35, 30, 8), trim);
      pile.position.set(side * 13, -10, front * 12); g.add(pile);
      g.add(strutBetween(new THREE.Vector3(side * 13, 2, front * 12), new THREE.Vector3(side * 5, 8, front * 5), 0.55, shell, 6));
    }
  } else if (zoneId === 'gorge') {
    for (const side of [-1, 1]) {
      const retaining = new THREE.Mesh(new THREE.BoxGeometry(13, 7, 9), shell);
      retaining.position.set(side * 17, 3.5, 10); retaining.rotation.y = side * 0.16; g.add(retaining);
      g.add(strutBetween(new THREE.Vector3(side * 23, 1, 6), new THREE.Vector3(side * 11, 14, 2), 0.48, trim, 6));
    }
  } else if (zoneId === 'ember') {
    for (const side of [-1, 1]) {
      const duct = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.55, 31, 8), pbr(0x3a232a, c.glow, 0.32));
      duct.position.set(side * 23, 16, 8); duct.rotation.z = side * 0.16; g.add(duct);
      const vent = new THREE.Mesh(new THREE.ConeGeometry(2.5, 4.4, 8), hot);
      vent.position.set(side * 26.5, 30.5, 8); g.add(vent);
    }
  } else {
    for (const side of [-1, 1]) {
      const survey = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 2.4, 28, 6), trim);
      survey.position.set(side * 21, 14, 9); g.add(survey);
      const lens = new THREE.Mesh(new THREE.SphereGeometry(1.8, 8, 6), pbr(0x1c1727, c.glow, 1.6));
      lens.position.set(side * 21, 29, 9); g.add(lens);
      g.add(strutBetween(new THREE.Vector3(side * 21, 4, 9), new THREE.Vector3(side * 8, 10, 2), 0.45, shell, 6));
    }
  }

  g.userData.beaconRing = ring;
  g.userData.scannerRotors = scannerRotors;
  return g;
}

/**
 * Small service assemblies attach only to man-made GLB props. Their job is to
 * explain how a hangar, dish or generator is powered, maintained and braced
 * without hiding the source asset's silhouette.
 */
function buildFacilityServiceLayer(referenceSize, zoneId, name) {
  const g = new THREE.Group();
  const s = Math.max(4, referenceSize * 0.10);
  const tones = {
    sea: [0x2a4352, 0x6f9aac, 0x62d8ff],
    gorge: [0x514d44, 0x96866a, 0x8fe6ff],
    ember: [0x43252d, 0x8d4750, 0xff6938],
    dune: [0x554d46, 0xa88e66, 0x9b82ff],
  };
  const t = tones[zoneId] ?? tones.dune;
  const steel = pbr(t[0], 0x000000, 0, { roughness: 0.68, metalness: 0.46 });
  const paint = pbr(t[1], 0x000000, 0, { roughness: 0.74, metalness: 0.26 });
  const signal = pbr(0x151a20, t[2], 1.2, { roughness: 0.25, metalness: 0.55 });

  const serviceDeck = new THREE.Mesh(new THREE.BoxGeometry(s * 1.9, s * 0.16, s * 0.72), steel);
  serviceDeck.position.set(s * 0.75, s * 0.22, s * 0.45); g.add(serviceDeck);
  for (const side of [-1, 1]) {
    const rail = strutBetween(new THREE.Vector3(-s * 0.12, s * 0.78, s * 0.8 + side * s * 0.26), new THREE.Vector3(s * 1.65, s * 0.78, s * 0.8 + side * s * 0.26), 0.09 * s, paint, 5);
    g.add(rail);
  }
  for (let i = 0; i < 4; i++) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.055, s * 0.055, s * 0.62, 5), paint);
    post.position.set(-s * 0.06 + i * s * 0.56, s * 0.47, s * 0.78); g.add(post);
  }

  const powerBox = new THREE.Mesh(new THREE.BoxGeometry(s * 0.52, s * 0.68, s * 0.42), paint);
  powerBox.position.set(s * 1.2, s * 0.55, -s * 0.2); g.add(powerBox);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(s * 0.11, 7, 5), signal);
  lamp.position.set(s * 1.2, s * 0.95, -s * 0.44); g.add(lamp);
  const conduitA = strutBetween(new THREE.Vector3(-s * 0.82, s * 0.1, -s * 0.42), new THREE.Vector3(s * 1.15, s * 0.44, -s * 0.42), s * 0.10, steel, 6);
  const conduitB = strutBetween(new THREE.Vector3(-s * 0.60, s * 0.1, -s * 0.15), new THREE.Vector3(s * 1.12, s * 0.56, -s * 0.15), s * 0.07, paint, 6);
  g.add(conduitA, conduitB);

  if (name.includes('satellite') || name.includes('antenna')) {
    for (const side of [-1, 1]) {
      const guy = strutBetween(new THREE.Vector3(side * s * 1.25, 0.05, s * 0.92), new THREE.Vector3(side * s * 0.42, s * 2.05, 0), s * 0.035, steel, 5);
      g.add(guy);
    }
  } else if (name.includes('hangar')) {
    const gantry = new THREE.Mesh(new THREE.BoxGeometry(s * 1.55, s * 0.18, s * 0.18), steel);
    gantry.position.set(0, s * 1.25, s * 0.64); g.add(gantry);
    for (const side of [-1, 1]) {
      const column = new THREE.Mesh(new THREE.BoxGeometry(s * 0.15, s * 1.25, s * 0.15), paint);
      column.position.set(side * s * 0.7, s * 0.63, s * 0.64); g.add(column);
    }
  } else if (name.includes('rocket') || name.includes('generator')) {
    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.28, s * 0.38, s * 1.2, 7), steel);
    exhaust.position.set(-s * 0.85, s * 0.64, 0); g.add(exhaust);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(s * 0.30, s * 0.06, 6, 12), signal);
    collar.rotation.x = Math.PI / 2; collar.position.set(-s * 0.85, s * 1.05, 0); g.add(collar);
  }
  return g;
}

export class Props {
  constructor(scene, game) {
    this.scene = scene;
    this.game = game;
    this.ready = false;
    this.zone = null;
    this.stage = 1;
    this.stageVariant = 0;
    this._drawDistance = 1500;
    this.templates = {}; // name -> { obj, cx, cz, minY, size }
    this.propSlots = [];
    this.shipSlots = [];
    this.heroSlots = [];
    this.group = new THREE.Group();
    scene.add(this.group);
    this._load();
  }

  _prep(name, gltf) {
    const obj = gltf.scene;
    obj.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = o.receiveShadow = false;
      o.frustumCulled = true;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (!m) continue;
        m.fog = true;
        if ('roughness' in m) m.roughness = Math.min(m.roughness ?? 0.8, 0.9);
        if ('metalness' in m) m.metalness = Math.min(m.metalness ?? 0.2, 0.34);
        // A subset of imported GLB props carries dark vertex/mapped material
        // data that can render as a featureless black silhouette under the
        // game’s stylised lighting. Normalise once at template load: retain the
        // authored base colour, use a restrained self-illumination, and permit
        // both faces to receive light. This is safer and more legible than a
        // large black horizon object, while preserving the detailed geometry.
        if (m.color && m.emissive) {
          const tint = m.color.clone();
          m.map = null;
          m.vertexColors = false;
          m.emissive.copy(tint).multiplyScalar(0.075);
          m.emissiveIntensity = 1;
          m.side = THREE.DoubleSide;
          m.needsUpdate = true;
        }
      }
    });
    const box = new THREE.Box3().setFromObject(obj);
    const c = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    this.templates[name] = { obj, cx: c.x, cz: c.z, minY: box.min.y, size: Math.max(size.x, size.y, size.z) || 1 };
  }

  _load() {
    const loader = new GLTFLoader();
    const names = [...KENNEY, ...Object.keys(HERO_PATHS)];
    let pending = names.length + SHIPS.length;
    const done = () => { if (--pending === 0) this._onLoaded(); };
    for (const n of KENNEY) {
      const path = EXTERNAL_PROP_PATHS[n] ?? `props/${n}`;
      loader.load(`./assets/models/${path}.glb`, (g) => { this._prep(n, g); done(); }, undefined, done);
    }
    for (const n of Object.keys(HERO_PATHS)) {
      loader.load(`./assets/models/${HERO_PATHS[n]}.glb`, (g) => { this._prep(n, g); done(); }, undefined, done);
    }
    for (const n of SHIPS) loader.load(`./assets/models/ships/${n}.gltf`, (g) => { this._prep(n, g); done(); }, undefined, done);
  }

  _onLoaded() {
    for (let i = 0; i < N_PROP; i++) {
      const slot = { z: -i * SPACING - rand(0, 60), inner: null, spin: 0 };
      this.group.add((slot.holder = new THREE.Group()));
      this.propSlots.push(slot);
    }
    for (let i = 0; i < N_SHIP; i++) {
      const name = SHIPS[i % SHIPS.length];
      const holder = this._container(name);
      this.group.add(holder);
      this.shipSlots.push({ z: -i * (SPACING * 2.6) - rand(0, 200), holder, name, bob: rand(0, TAU) });
    }
    for (let i = 0; i < N_HERO; i++) {
      const holder = new THREE.Group();
      this.group.add(holder);
      this.heroSlots.push({ z: -620 - i * 790 - rand(0, 110), holder, kind: null, phase: rand(0, TAU) });
    }
    this.ready = true;
    if (this.zone) this._reseed();
  }

  _container(name) {
    const t = this.templates[name];
    const holder = new THREE.Group();
    const clone = t.obj.clone(true);
    clone.position.set(-t.cx, -t.minY, -t.cz);
    holder.add(clone);
    holder.userData.size = t.size;
    return holder;
  }

  setZone(zone) {
    this.zone = zone;
    this._openWater = zone?.id === 'sea';
    // setStage() immediately follows during Wave loading and performs the single
    // reseed, avoiding a second clone/rebuild pass for every transition.
  }

  /** Quality-controlled culling preserves the close silhouette layer while trimming distant scene traversal. */
  setDrawDistance(distance = 1500) {
    this._drawDistance = Math.max(780, Math.min(1800, distance));
  }

  /** Stage-specific background composition; retains the current zone palette. */
  setStage(wave, zone = this.zone) {
    this.stage = wave;
    this.stageVariant = (wave - 1) % 3;
    if (zone) { this.zone = zone; this._openWater = zone.id === 'sea'; }
    if (this.ready) this._reseed();
  }

  _reseed() {
    for (const s of this.propSlots) this._rollProp(s);
    for (const s of this.shipSlots) this._rollShip(s);
    for (const s of this.heroSlots) this._rollHero(s);
  }

  _rollProp(slot) {
    if (slot.inner) { slot.holder.remove(slot.inner); slot.inner = null; }
    if (!SHOW_LARGE_ARTIFICIAL_SCENERY) {
      slot.holder.clear();
      slot.name = null;
      return;
    }
    const z = this.zone || {};
    const pool = ZONE_PROP_POOLS[z.id] ?? KENNEY;
    const name = pick(pool);
    const t = this.templates[name];
    const inner = new THREE.Group();
    const model = t.obj.clone(true);
    model.position.set(-t.cx, -t.minY, -t.cz);
    // In the current light pipeline, several third-party kit hulls still emit
    // screen-filling black planes on some driver/material combinations. The
    // route-aware foundation and service geometry below is intentionally used
    // as the reliable visible facility layer until those assets are rebaked.
    model.visible = false;
    const facility = FACILITIES.has(name);
    if (facility) {
      const foundation = buildFoundation(t.size, z.id);
      inner.add(foundation);
      const service = buildFacilityServiceLayer(t.size, z.id, name);
      service.position.y = foundation.userData.topY;
      inner.add(service);
      model.position.y += foundation.userData.topY;
    }
    inner.add(model);
    slot.holder.add(inner); slot.inner = inner; slot.name = name;

    // Facilities stay grounded. Only genuine vessels occupy the air layer;
    // this prevents oversized dishes, bridges, and antennae from floating above
    // the sea or canyon floor as random background decoration.
    const side = Math.random() < 0.5 ? -1 : 1;
    const landmarkShell = name === 'aero_station_ring' || name === 'scifi_bridge';
    const compactFacility = name.startsWith('scifi_') || name.startsWith('satellite');
    const forcedDistant = landmarkShell || name.startsWith('satellite');
    // Slots scroll several hundred world units before they are rerolled. A
    // midground facility spawned near the player can therefore later dominate
    // the camera even when it remains outside the formal flight corridor.
    // Reserve the full near-field approach for terrain and combat; objects in
    // that band are pushed to the distant layer to frame, never occlude, play.
    const cameraNear = slot.z > -700;
    const background = forcedDistant || cameraNear || Math.random() < (this._openWater ? 0.74 : 0.46);
    const route = flightRoute(z.id, slot.z);
    let targetSize, x;
    if (background) {
      // The closest recycled prop slots act as edge framing only. Keeping their
      // silhouette smaller and farther out avoids a large GLB crossing the
      // camera while the dedicated terrain layer supplies the close parallax.
      const nearScale = cameraNear ? 0.54 : 1;
      targetSize = (landmarkShell ? rand(68, 112) : (compactFacility ? rand(28, 58) : (facility ? rand(86, 164) : rand(112, 210)))) * nearScale;
      const xNear = (landmarkShell || compactFacility) ? 760 : 650;
      const xFar = (landmarkShell || compactFacility) ? 1100 : 980;
      x = route.center + side * rand(xNear, xFar);
    } else {
      targetSize = compactFacility ? rand(20, 40) : (facility ? rand(54, 102) : rand(58, 116));
      // Foundations line the travel corridor instead of being scattered across
      // the horizon. Their setbacks echo the terrain beacons and leave combat
      // airspace clear in the centre.
      x = route.center + side * rand(route.halfWidth + 72, route.halfWidth + 160);
    }
    const sc = targetSize / t.size;
    slot.holder.scale.setScalar(sc);
    slot.holder.position.set(x, this.zone?.floorY ?? 0, slot.z);
    slot.holder.rotation.set(0, rand(TAU), 0);
    slot.spin = 0;
    if (name.startsWith('rocket')) slot.holder.rotation.z = rand(-0.035, 0.035);
  }

  _rollShip(slot) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const flying = this._openWater ? true : Math.random() < 0.6;
    const t = this.templates[slot.name];
    let targetSize, x, y, rotX = 0, rotZ = 0;
    if (flying) {
      targetSize = rand(46, 84); x = side * rand(330, 650); y = rand(70, 175); rotZ = -side * rand(0.1, 0.4);
    } else {
      targetSize = rand(36, 68); x = side * rand(290, 410); y = rand(0, 3); rotX = rand(-0.12, 0.05); rotZ = rand(-0.1, 0.1);
    }
    const sc = targetSize / t.size;
    slot.holder.scale.setScalar(sc);
    slot.holder.position.set(x, (this.zone?.floorY ?? 0) + y, slot.z);
    slot.holder.rotation.set(rotX, rand(-0.5, 0.5) + (flying ? 0 : side * 0.6), rotZ);
    slot.flying = flying;
  }

  /** Place just two high-detail scans at a time, then enrich each with a base. */
  _rollHero(slot) {
    slot.holder.clear();
    if (!SHOW_LARGE_ARTIFICIAL_SCENERY) {
      slot.kind = null;
      slot.site = null;
      return;
    }
    const zoneId = this.zone?.id ?? 'dune';
    const kind = zoneId === 'sea' ? 'hero_coast_rock' : 'hero_desert_rock';
    const t = this.templates[kind];
    const rock = t.obj.clone(true);
    rock.position.set(-t.cx, -t.minY, -t.cz);
    const rockWrap = new THREE.Group(); rockWrap.add(rock);
    // The scan remains prepared at its intended horizon scale so it can be
    // re-enabled after a future calibrated material pass, but the live scene uses
    // the deterministic procedural terrain and megasite composition below.
    const size = zoneId === 'sea' ? rand(180, 250) : rand(165, 235);
    rockWrap.scale.setScalar(size / t.size);
    // The terrain module now owns the close/midground geology with dedicated
    // zone materials. Keep the scan as a cacheable asset but do not draw its
    // large unlit shell; the detailed procedural megasite remains as the
    // far-horizon landmark and cannot become a black screen-filling silhouette.
    rockWrap.visible = false;
    slot.holder.add(rockWrap);

    const site = buildMegasite(zoneId);
    // Hero scans already provide the dominant mass; reduce the settlement so it
    // reads as an inhabited terrace on the rock instead of a second giant prop.
    site.scale.setScalar(size / 105);
    site.position.set(0, 0, 0);
    site.rotation.y = rand(-0.6, 0.6);

    // Three staged additions keep the hero silhouettes evolving across every
    // return to a zone: relay arrays, crane-like gantries, then signal crowns.
    const accent = zoneId === 'ember' ? 0xff6a38 : zoneId === 'sea' ? 0x62d8ff : zoneId === 'gorge' ? 0x8fe6ff : (this.stage >= 15 ? 0x9b82ff : 0xffc66b);
    const accentMat = pbr(0x17202a, accent, 1.45);
    const trimMat = pbr(zoneId === 'dune' ? 0x6c5c48 : 0x35434d, 0x000000, 0);
    const stageDetail = new THREE.Group();
    if (this.stageVariant === 0) {
      for (const side of [-1, 1]) {
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.4, 33, 6), trimMat);
        mast.position.set(side * 18, 23, -8); stageDetail.add(mast);
        const dish = new THREE.Mesh(new THREE.ConeGeometry(5.8, 1.7, 12, 1, true), accentMat);
        dish.position.set(side * 18, 39, -8); dish.rotation.z = side * 0.8; stageDetail.add(dish);
      }
    } else if (this.stageVariant === 1) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(58, 2.1, 5), trimMat);
      beam.position.set(0, 28, -6); stageDetail.add(beam);
      for (const side of [-1, 1]) {
        const brace = new THREE.Mesh(new THREE.BoxGeometry(1.4, 30, 1.4), trimMat);
        brace.position.set(side * 20, 14, -6); brace.rotation.z = side * 0.55; stageDetail.add(brace);
        const light = new THREE.Mesh(new THREE.SphereGeometry(1.55, 8, 6), accentMat);
        light.position.set(side * 28, 28, -6); stageDetail.add(light);
      }
    } else {
      const crown = new THREE.Mesh(new THREE.TorusGeometry(16, 1.2, 7, 18), accentMat);
      crown.position.set(0, 42, -4); crown.rotation.x = Math.PI / 2; stageDetail.add(crown);
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * TAU;
        const node = new THREE.Mesh(new THREE.OctahedronGeometry(1.6, 0), accentMat);
        node.position.set(Math.cos(a) * 16, 42 + Math.sin(a) * 16, -4); stageDetail.add(node);
      }
    }
    site.add(stageDetail);
    slot.holder.add(site);

    const side = Math.random() < 0.5 ? -1 : 1;
    const route = flightRoute(zoneId, slot.z);
    slot.holder.position.set(route.center + side * rand(760, 1080), (this.zone?.floorY ?? 0) + (zoneId === 'sea' ? -8 : 0), slot.z);
    slot.holder.rotation.y = rand(-0.35, 0.35);
    slot.kind = kind;
    slot.site = site;
  }

  update(dt, scroll) {
    if (!this.ready) return;
    for (const s of this.propSlots) {
      s.z += scroll * dt; s.holder.position.z = s.z;
      // Imported kit assets are a distant parallax layer. Once an object gets
      // within this near band, terrain and combat take over, avoiding oversized
      // model silhouettes occluding the cockpit view on narrow or mobile screens.
      s.holder.visible = s.z > -this._drawDistance && s.z < -420;
      if (s.spin && s.holder.visible) s.holder.rotation.y += s.spin * dt;
      if (s.z > FRONT) { s.z -= N_PROP * SPACING; this._rollProp(s); }
    }
    for (const s of this.shipSlots) {
      s.z += scroll * dt; s.holder.position.z = s.z;
      // Actionable hostile ships are owned by Enemies. Imported decorative
      // ships are disabled while their materials are rebaked, preventing their
      // dark packed texture surfaces from becoming featureless horizon slabs.
      s.holder.visible = false;
      if (s.flying && s.holder.visible) { s.bob += dt; s.holder.position.y += Math.sin(s.bob * 0.8) * 4 * dt; }
      if (s.z > FRONT) { s.z -= N_SHIP * SPACING * 2.6; this._rollShip(s); }
    }
    for (const s of this.heroSlots) {
      s.z += scroll * dt; s.holder.position.z = s.z;
      // Hero megasites are far-horizon establishments rather than foreground
      // obstacles. Their procedural parts remain richly detailed at distance.
      s.holder.visible = s.z > -this._drawDistance && s.z < -520;
      if (s.holder.visible) s.phase += dt;
      if (s.holder.visible && s.site?.userData.beaconRing) s.site.userData.beaconRing.rotation.z += dt * 0.18;
      if (s.holder.visible && s.site?.userData.scannerRotors) {
        for (let i = 0; i < s.site.userData.scannerRotors.length; i++) {
          s.site.userData.scannerRotors[i].rotation.y += dt * (0.24 + i * 0.05);
        }
      }
      if (s.z > FRONT) { s.z -= N_HERO * 790; this._rollHero(s); }
    }
  }
}
