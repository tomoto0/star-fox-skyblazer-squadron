import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { rand, pick, TAU, loadDetailTexture } from '../core/util.js';
import { flightRoute } from './terrain.js';
import { normalizeImportedMaterial } from '../entities/shipFactory.js';

/**
 * Scrolling artificial architecture & fleet scenery layer.
 * Facilities, fortified outposts, and hero megasites feature layered industrial
 * craftsmanship (command-bridge window bands, crane gantries, radiator arrays,
 * landing pads, glowing conduits, and rotating radar crowns) AND expose solid,
 * bounding-box-fitted colliders via `forEachObstacle()` so neither players,
 * shots, nor wingmates can ever clip through them.
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
const FACILITIES = new Set([
  'hangar_largea', 'hangar_rounda', 'hangar_smallb', 'machine_generatorlarge',
  'turret_double', 'turret_single', 'satellitedish_large', 'satellitedish',
  'rocket_basea', 'aero_station_ring', 'scifi_antenna', 'scifi_bridge', 'scifi_machine',
]);
const ZONE_PROP_POOLS = {
  sea:   ['hangar_rounda', 'satellitedish_large', 'scifi_antenna', 'aero_station_ring', 'hangar_largea'],
  gorge: ['scifi_bridge', 'scifi_antenna', 'hangar_rounda', 'turret_double', 'satellitedish'],
  ember: ['scifi_machine', 'machine_generatorlarge', 'rocket_basea', 'turret_double', 'scifi_bridge'],
  dune:  ['scifi_bridge', 'scifi_antenna', 'aero_station_ring', 'hangar_largea', 'rocket_basea', 'machine_generatorlarge'],
};

const SPACING = 340;
const N_PROP = 6;
const N_SHIP = 3;
const N_HERO = 1;
const FRONT = 150;
const SHOW_LARGE_ARTIFICIAL_SCENERY = true;

const metalDetail = loadDetailTexture('./assets/textures/metal_diff.jpg', {
  repeat: 3.6, brightness: 1.38, contrast: 0.72, desat: 0.9,
});

/** Procedural high-craft armor hull plating texture (beveled seams, panel tonal breaks & rivets). */
function makeArmorPanelTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#c8cfd9';
  g.fillRect(0, 0, 256, 256);
  // Subtle rectangular armor plate luminance shifts
  const plates = [
    [0, 0, 128, 64, '#d3dae4'], [128, 0, 128, 64, '#bcc4cf'],
    [0, 64, 64, 128, '#c2cad4'], [64, 64, 128, 128, '#d8dfe8'], [192, 64, 64, 128, '#b8c0cc'],
    [0, 192, 160, 64, '#cfd6e0'], [160, 192, 96, 64, '#bec7d3'],
  ];
  for (const [x, y, w, h, col] of plates) {
    g.fillStyle = col;
    g.fillRect(x + 2, y + 2, w - 4, h - 4);
    // Crisp top/left bevel highlight + dark recessed seam
    g.strokeStyle = 'rgba(255,255,255,0.45)';
    g.lineWidth = 2;
    g.strokeRect(x + 3, y + 3, w - 6, h - 6);
    g.strokeStyle = 'rgba(26,34,48,0.68)';
    g.lineWidth = 2;
    g.strokeRect(x + 1, y + 1, w - 2, h - 2);
    // Corner rivets
    g.fillStyle = 'rgba(32,42,56,0.55)';
    for (const [rx, ry] of [[x + 8, y + 8], [x + w - 10, y + 8], [x + 8, y + h - 10], [x + w - 10, y + h - 10]]) {
      g.fillRect(rx, ry, 3, 3);
    }
  }
  // Recessed cooling louver grille in center plate
  g.fillStyle = 'rgba(28,36,50,0.65)';
  for (let i = 0; i < 6; i++) g.fillRect(82, 86 + i * 12, 92, 5);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2.2, 2.2);
  tex.anisotropy = 4;
  tex.userData = { shared: true };
  return tex;
}

/** Procedural illuminated command-tower window grid texture (multi-story sci-fi mullions + lit bays). */
function makeWindowGridTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#404a5a';
  g.fillRect(0, 0, 256, 256);
  // Horizontal structural deck girders & vertical armor ribs
  for (let row = 0; row < 8; row++) {
    const y = row * 32;
    g.fillStyle = '#252e3d';
    g.fillRect(0, y, 256, 9);
    g.fillStyle = '#5d6a7e';
    g.fillRect(0, y + 9, 256, 3);
    // Lit panoramic window slots with staggered dark shutter mullions
    for (let col = 0; col < 8; col++) {
      const x = col * 32;
      const lit = ((row * 5 + col * 3) % 7) !== 0;
      g.fillStyle = lit ? '#f0fbff' : '#1b2432';
      g.fillRect(x + 4, y + 14, 24, 13);
      if (lit) {
        g.fillStyle = 'rgba(130,220,255,0.45)';
        g.fillRect(x + 4, y + 22, 24, 5);
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.anisotropy = 4;
  tex.userData = { shared: true };
  return tex;
}

const armorPanelTex = makeArmorPanelTexture();
const windowGridTex = makeWindowGridTexture();
const UP = new THREE.Vector3(0, 1, 0);
const _box = new THREE.Box3();
const _bc = new THREE.Vector3();
const _bs = new THREE.Vector3();

function disposeTree(root) {
  if (!root) return;
  root.traverse((o) => {
    if (o.geometry && !o.geometry.userData?.shared) o.geometry.dispose?.();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (m && !m.userData?.shared) m.dispose?.();
      }
    }
  });
}

function pbr(color, emissive = 0x000000, intensity = 0, opts = {}) {
  const map = opts.windows ? windowGridTex
    : opts.panel ? armorPanelTex
    : opts.detail === true ? metalDetail
    : null;
  const emissiveMap = opts.windows ? windowGridTex : null;
  return new THREE.MeshStandardMaterial({
    color, emissive, emissiveIntensity: intensity,
    map, emissiveMap,
    roughness: opts.roughness ?? 0.52,
    metalness: opts.metalness ?? 0.36,
    envMapIntensity: opts.env ?? 0.62,
    transparent: !!opts.transparent,
    opacity: opts.opacity ?? 1,
    side: opts.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
  });
}

/** Build a visible load-bearing diagonal truss/pipe between two points. */
function strutBetween(a, b, radius, material, sides = 6) {
  const delta = b.clone().sub(a);
  const len = delta.length();
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, Math.max(0.05, len), sides), material);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  if (len > 0.001) mesh.quaternion.setFromUnitVectors(UP, delta.normalize());
  return mesh;
}

/** Reusable precision sci-fi command kiosk: beveled armored hull, wrap-around bridge visors, roof HVAC/sensor bay & twin strobe antennas. */
function buildCommandPod(scale, hullMat, trimMat, glowMat, strobeMat) {
  const g = new THREE.Group();
  // Chamfered lower armoured skirt + main bridge block
  const baseSkirt = new THREE.Mesh(new THREE.BoxGeometry(scale * 1.72, scale * 0.22, scale * 1.26), trimMat);
  baseSkirt.position.y = scale * 0.11; g.add(baseSkirt);
  const body = new THREE.Mesh(new THREE.BoxGeometry(scale * 1.6, scale * 0.86, scale * 1.14), hullMat);
  body.position.y = scale * 0.56; g.add(body);
  // Sloped armored roof deck + rooftop cooling unit & sensor radome
  const roof = new THREE.Mesh(new THREE.BoxGeometry(scale * 1.38, scale * 0.24, scale * 0.94), trimMat);
  roof.position.y = scale * 1.08; g.add(roof);
  const hvac = new THREE.Mesh(new THREE.BoxGeometry(scale * 0.54, scale * 0.22, scale * 0.44), hullMat);
  hvac.position.set(-scale * 0.28, scale * 1.26, scale * 0.06); g.add(hvac);
  const radome = new THREE.Mesh(new THREE.SphereGeometry(scale * 0.20, 8, 6, 0, TAU, 0, Math.PI * 0.55), hullMat);
  radome.position.set(scale * 0.26, scale * 1.20, scale * 0.10); g.add(radome);
  // Illuminated wrap-around bridge visor windows with central mullion divider
  for (const zSide of [-1, 1]) {
    const visor = new THREE.Mesh(new THREE.BoxGeometry(scale * 1.30, scale * 0.17, scale * 0.06), glowMat);
    visor.position.set(0, scale * 0.70, zSide * scale * 0.58); g.add(visor);
    const mullion = new THREE.Mesh(new THREE.BoxGeometry(scale * 0.08, scale * 0.22, scale * 0.09), trimMat);
    mullion.position.set(0, scale * 0.70, zSide * scale * 0.59); g.add(mullion);
  }
  // Louvered side armour ribs, intake vents & twin aviation strobe antennas
  for (const xSide of [-1, 1]) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(scale * 0.14, scale * 0.88, scale * 1.22), trimMat);
    rib.position.set(xSide * scale * 0.54, scale * 0.56, 0); g.add(rib);
    const sideVisor = new THREE.Mesh(new THREE.BoxGeometry(scale * 0.06, scale * 0.14, scale * 0.62), glowMat);
    sideVisor.position.set(xSide * scale * 0.81, scale * 0.70, 0); g.add(sideVisor);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(scale * 0.026, scale * 0.048, scale * 1.05, 5), trimMat);
    ant.position.set(xSide * scale * 0.48, scale * 1.66, -scale * 0.22); g.add(ant);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(scale * 0.08, 6, 5), strobeMat);
    tip.position.set(xSide * scale * 0.48, scale * 2.20, -scale * 0.22); g.add(tip);
  }
  return g;
}

/**
 * Precision multi-tier fortified foundation for man-made outposts:
 * panel-plated octagonal bunker footing, blast-door alcoves, painted fighter
 * landing apron with H-pad markings & approach lights, exposed conduit pipes,
 * armored buttress struts, and glowing perimeter beacon collar.
 */
function buildFoundation(referenceSize, zoneId = 'dune') {
  const palette = {
    sea:   { slab: 0x4b7488, edge: 0x1a3040, paint: 0x7daabf, light: 0x6ce4ff, warn: 0xffc65c },
    gorge: { slab: 0x82745e, edge: 0x353d44, paint: 0xa2957a, light: 0x8feaff, warn: 0xffbf58 },
    ember: { slab: 0x74404d, edge: 0x2a1d28, paint: 0xa65462, light: 0xff723c, warn: 0xffd564 },
    dune:  { slab: 0x8e7960, edge: 0x303340, paint: 0xbca27a, light: 0x9e86ff, warn: 0xffcb5c },
  };
  const c = palette[zoneId] ?? palette.dune;
  const g = new THREE.Group();
  const r = Math.max(5.5, referenceSize * 0.21);
  const h = Math.max(3.2, referenceSize * 0.09);
  const slab = pbr(c.slab, 0x000000, 0, { panel: true, roughness: 0.56, metalness: 0.34 });
  const edge = pbr(c.edge, 0x000000, 0, { panel: true, roughness: 0.68, metalness: 0.36 });
  const paint = pbr(c.paint, 0x000000, 0, { detail: true, roughness: 0.58, metalness: 0.30 });
  const glow = pbr(0x101822, c.light, 1.55, { roughness: 0.22, metalness: 0.45 });
  const warn = pbr(0x281c10, c.warn, 1.35, { roughness: 0.28, metalness: 0.35 });

  // Stepped armored foundation tiers with panel plating
  const buried = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.44, r * 1.62, h * 0.58, 8), edge);
  buried.position.y = -h * 0.05; g.add(buried);
  const footing = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.24, r * 1.42, h * 0.78, 8), slab);
  footing.position.y = h * 0.32; g.add(footing);
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.15, r * 1.22, h * 0.28, 12), paint);
  deck.position.y = h * 0.80; g.add(deck);
  const central = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.80, r * 0.90, h * 0.40, 10), edge);
  central.position.y = h * 1.04; g.add(central);

  // Recessed blast-door alcoves, glowing edge strips, corner bollards & perimeter stanchions
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    const ca = Math.cos(a), sa = Math.sin(a);
    const seam = new THREE.Mesh(new THREE.BoxGeometry(r * 0.64, h * 0.05, 0.22), edge);
    seam.position.set(ca * r * 0.50, h * 0.94, sa * r * 0.50);
    seam.rotation.y = -a; g.add(seam);
    if (i % 2 === 0) {
      // Glowing recessed deck edge marker strips
      const strip = new THREE.Mesh(new THREE.BoxGeometry(r * 0.38, h * 0.09, 0.18), i % 4 === 0 ? glow : warn);
      strip.position.set(ca * r * 1.16, h * 0.80, sa * r * 1.16);
      strip.rotation.y = -a + Math.PI / 2; g.add(strip);
      // Heavy armored corner bollards with beacon tips
      const bollard = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.06, r * 0.085, h * 0.44, 6), edge);
      bollard.position.set(ca * r * 1.08, h * 1.06, sa * r * 1.08); g.add(bollard);
      const bTip = new THREE.Mesh(new THREE.SphereGeometry(r * 0.045, 5, 4), warn);
      bTip.position.set(ca * r * 1.08, h * 1.30, sa * r * 1.08); g.add(bTip);
    } else {
      // Armored lower bulkhead blast-door housing with glowing status lintel
      const bay = new THREE.Mesh(new THREE.BoxGeometry(r * 0.34, h * 0.44, r * 0.24), edge);
      bay.position.set(ca * r * 1.24, h * 0.34, sa * r * 1.24);
      bay.rotation.y = -a + Math.PI / 2; g.add(bay);
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(r * 0.26, h * 0.07, r * 0.26), glow);
      lintel.position.set(ca * r * 1.24, h * 0.56, sa * r * 1.24);
      lintel.rotation.y = -a + Math.PI / 2; g.add(lintel);
    }
  }

  // Cantilevered docking apron / fighter landing pad with crisp H-markings & approach lights
  const walkway = new THREE.Mesh(new THREE.BoxGeometry(r * 1.26, h * 0.16, r * 0.64), edge);
  walkway.position.set(0, h * 0.88, r * 0.98); g.add(walkway);
  const padTrim = new THREE.Mesh(new THREE.BoxGeometry(r * 1.00, h * 0.04, r * 0.44), slab);
  padTrim.position.set(0, h * 0.98, r * 0.98); g.add(padTrim);
  // Crisp helipad 'H' marking bars
  const hBar = new THREE.Mesh(new THREE.BoxGeometry(r * 0.26, h * 0.05, r * 0.05), warn);
  hBar.position.set(0, h * 1.00, r * 0.98); g.add(hBar);
  for (const side of [-1, 1]) {
    const hLeg = new THREE.Mesh(new THREE.BoxGeometry(r * 0.05, h * 0.05, r * 0.24), warn);
    hLeg.position.set(side * r * 0.13, h * 1.00, r * 0.98); g.add(hLeg);
    const guide = new THREE.Mesh(new THREE.BoxGeometry(r * 0.08, h * 0.06, r * 0.48), glow);
    guide.position.set(side * r * 0.48, h * 0.99, r * 0.98); g.add(guide);
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, r * 1.12, 5), paint);
    rail.position.set(side * r * 0.58, h * 1.30, r * 1.02); rail.rotation.z = Math.PI / 2; g.add(rail);
  }

  // Six heavy angled structural buttresses with armored anchor shoes & glowing conduit pipes
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + Math.PI / 6;
    const ca = Math.cos(a), sa = Math.sin(a);
    const low = new THREE.Vector3(ca * r * 1.26, h * 0.04, sa * r * 1.26);
    const high = new THREE.Vector3(ca * r * 0.78, h * 1.14, sa * r * 0.78);
    g.add(strutBetween(low, high, Math.max(0.24, r * 0.062), edge));
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.12, r * 0.16, h * 0.24, 6), paint);
    cap.position.copy(low); cap.position.y = h * 0.06; g.add(cap);
    if (i % 2 === 0) {
      const pipeLow = new THREE.Vector3(ca * r * 1.18, h * 0.24, sa * r * 1.18);
      const pipeHigh = new THREE.Vector3(ca * r * 0.82, h * 1.16, sa * r * 0.82);
      g.add(strutBetween(pipeLow, pipeHigh, Math.max(0.11, r * 0.026), glow, 5));
    }
  }
  if (zoneId === 'sea') {
    for (const side of [-1, 1]) for (const front of [-1, 1]) {
      const pile = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.14, r * 0.17, h * 2.9, 7), edge);
      pile.position.set(side * r * 0.92, -h * 0.72, front * r * 0.92); g.add(pile);
      // Submerged sea-pillar cross-bracing collar
      const pCollar = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.21, r * 0.21, h * 0.18, 7), paint);
      pCollar.position.set(side * r * 0.92, h * 0.12, front * r * 0.92); g.add(pCollar);
      const brace = strutBetween(
        new THREE.Vector3(side * r * 0.92, -h * 0.18, front * r * 0.92),
        new THREE.Vector3(side * r * 0.42, h * 0.76, front * r * 0.42),
        Math.max(0.16, r * 0.04), paint, 5
      );
      g.add(brace);
    }
  }

  const beacon = new THREE.Mesh(new THREE.TorusGeometry(r * 0.80, Math.max(0.16, h * 0.068), 6, 18), glow);
  beacon.rotation.x = Math.PI / 2; beacon.position.y = h * 1.22; g.add(beacon);
  g.userData.topY = h * 1.24;
  return g;
}

/**
 * High-craft industrial/military service superstructure attached atop each facility:
 * panel-plated command kiosk, pressurized twin coolant tanks with saddle rings,
 * cooling radiator fin banks, animated micro-radar rotor, crane gantries & conduits.
 */
function buildFacilityServiceLayer(referenceSize, zoneId, name) {
  const g = new THREE.Group();
  const s = Math.max(4.4, referenceSize * 0.11);
  const tones = {
    sea:   [0x284354, 0x7daabf, 0x6ae4ff, 0xffc862],
    gorge: [0x504c44, 0xa29376, 0x8feaff, 0xffc05e],
    ember: [0x45262f, 0x9c525e, 0xff703c, 0xffd262],
    dune:  [0x564e48, 0xb89e74, 0xa088ff, 0xffca60],
  };
  const t = tones[zoneId] ?? tones.dune;
  const steel = pbr(t[0], 0x000000, 0, { panel: true, roughness: 0.56, metalness: 0.42 });
  const paint = pbr(t[1], 0x000000, 0, { detail: true, roughness: 0.62, metalness: 0.30 });
  const signal = pbr(0x141b24, t[2], 1.55, { roughness: 0.22, metalness: 0.48 });
  const strobe = pbr(0x281810, t[3], 1.65, { roughness: 0.24, metalness: 0.35 });
  const rotors = [];

  // Catwalk service deck with safety railings & access staircase ramp
  const serviceDeck = new THREE.Mesh(new THREE.BoxGeometry(s * 2.1, s * 0.18, s * 0.82), steel);
  serviceDeck.position.set(s * 0.75, s * 0.24, s * 0.48); g.add(serviceDeck);
  for (const side of [-1, 1]) {
    g.add(strutBetween(
      new THREE.Vector3(-s * 0.22, s * 0.82, s * 0.82 + side * s * 0.28),
      new THREE.Vector3(s * 1.72, s * 0.82, s * 0.82 + side * s * 0.28),
      0.075 * s, paint, 5
    ));
  }
  for (let i = 0; i < 4; i++) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.052, s * 0.052, s * 0.64, 5), paint);
    post.position.set(-s * 0.10 + i * s * 0.58, s * 0.50, s * 0.82); g.add(post);
  }

  // Command control pod with illuminated visor slits & twin antennas
  const kiosk = buildCommandPod(s * 0.58, paint, steel, signal, strobe);
  kiosk.position.set(s * 1.15, s * 0.32, -s * 0.22);
  g.add(kiosk);

  // Twin horizontal pressurized coolant tanks with armored cradle bands
  for (const tz of [-s * 0.62, -s * 0.94]) {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.16, s * 0.16, s * 0.88, 8), paint);
    tank.rotation.z = Math.PI / 2;
    tank.position.set(s * 0.15, s * 0.24, tz); g.add(tank);
    for (const bx of [-s * 0.24, s * 0.24]) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(s * 0.175, s * 0.032, 5, 10), steel);
      band.rotation.y = Math.PI / 2;
      band.position.set(s * 0.15 + bx, s * 0.24, tz); g.add(band);
    }
  }

  // Pressurized conduit manifolds + cooling radiator fin bank
  g.add(strutBetween(new THREE.Vector3(-s * 0.90, s * 0.12, -s * 0.44), new THREE.Vector3(s * 1.10, s * 0.48, -s * 0.44), s * 0.11, steel, 6));
  g.add(strutBetween(new THREE.Vector3(-s * 0.65, s * 0.12, -s * 0.16), new THREE.Vector3(s * 1.05, s * 0.62, -s * 0.16), s * 0.075, signal, 6));
  for (let i = 0; i < 5; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(s * 0.075, s * 0.56, s * 0.36), steel);
    fin.position.set(-s * 0.64 + i * s * 0.16, s * 0.42, -s * 0.44);
    g.add(fin);
  }

  // Animated compact tracking radar rotor mounted on rear pylon
  const rMast = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.06, s * 0.09, s * 1.05, 6), steel);
  rMast.position.set(s * 0.48, s * 0.72, -s * 0.74); g.add(rMast);
  const rotor = new THREE.Group();
  rotor.position.set(s * 0.48, s * 1.28, -s * 0.74);
  const rBar = new THREE.Mesh(new THREE.BoxGeometry(s * 0.68, s * 0.18, s * 0.08), paint);
  rotor.add(rBar);
  const rLens = new THREE.Mesh(new THREE.BoxGeometry(s * 0.54, s * 0.06, s * 0.10), signal);
  rotor.add(rLens);
  g.add(rotor);
  rotors.push(rotor);

  // Role-specific engineering silhouette details
  if (name.includes('satellite') || name.includes('antenna')) {
    for (const side of [-1, 1]) {
      g.add(strutBetween(new THREE.Vector3(side * s * 1.32, 0.05, s * 0.94), new THREE.Vector3(side * s * 0.42, s * 2.15, 0), s * 0.04, steel, 5));
    }
    const relayRing = new THREE.Mesh(new THREE.TorusGeometry(s * 0.48, s * 0.055, 5, 14), signal);
    relayRing.rotation.x = Math.PI / 2; relayRing.position.set(0, s * 1.55, 0); g.add(relayRing);
  } else if (name.includes('hangar')) {
    // Reinforced double-beam gantry crane frame with illuminated bay header & overhead hoist trolley
    const gantry = new THREE.Mesh(new THREE.BoxGeometry(s * 1.80, s * 0.24, s * 0.26), steel);
    gantry.position.set(0, s * 1.42, s * 0.72); g.add(gantry);
    const hoist = new THREE.Mesh(new THREE.BoxGeometry(s * 0.34, s * 0.22, s * 0.32), paint);
    hoist.position.set(-s * 0.28, s * 1.22, s * 0.72); g.add(hoist);
    const bayLight = new THREE.Mesh(new THREE.BoxGeometry(s * 1.38, s * 0.08, s * 0.09), strobe);
    bayLight.position.set(0, s * 1.28, s * 0.84); g.add(bayLight);
    for (const side of [-1, 1]) {
      const column = new THREE.Mesh(new THREE.BoxGeometry(s * 0.20, s * 1.42, s * 0.20), paint);
      column.position.set(side * s * 0.80, s * 0.71, s * 0.72); g.add(column);
      g.add(strutBetween(new THREE.Vector3(side * s * 0.80, s * 0.95, s * 0.72), new THREE.Vector3(side * s * 0.44, s * 1.42, s * 0.72), s * 0.048, steel, 5));
    }
  } else if (name.includes('rocket') || name.includes('generator') || name.includes('machine')) {
    // Dual armored exhaust stacks with glowing plasma cooling rings & heat-shield louvers
    for (const zOff of [-s * 0.24, s * 0.24]) {
      const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.26, s * 0.38, s * 1.42, 8), steel);
      exhaust.position.set(-s * 0.88, s * 0.70, zOff); g.add(exhaust);
      const collar = new THREE.Mesh(new THREE.TorusGeometry(s * 0.31, s * 0.058, 6, 12), signal);
      collar.rotation.x = Math.PI / 2; collar.position.set(-s * 0.88, s * 1.15, zOff); g.add(collar);
      const crown = new THREE.Mesh(new THREE.TorusGeometry(s * 0.27, s * 0.04, 5, 10), strobe);
      crown.rotation.x = Math.PI / 2; crown.position.set(-s * 0.88, s * 1.38, zOff); g.add(crown);
    }
  } else {
    // Cantilevered lattice service crane boom with guy-wire tieback & suspended warning lamp
    const mast = new THREE.Mesh(new THREE.BoxGeometry(s * 0.24, s * 1.52, s * 0.24), steel);
    mast.position.set(-s * 0.95, s * 0.76, s * 0.35); g.add(mast);
    g.add(strutBetween(new THREE.Vector3(-s * 0.95, s * 1.48, s * 0.35), new THREE.Vector3(-s * 0.02, s * 1.94, s * 0.35), s * 0.065, paint, 5));
    g.add(strutBetween(new THREE.Vector3(-s * 0.95, s * 1.10, s * 0.35), new THREE.Vector3(-s * 0.32, s * 1.78, s * 0.35), s * 0.038, steel, 5));
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(s * 0.11, 6, 5), strobe);
    lamp.position.set(-s * 0.02, s * 1.88, s * 0.35); g.add(lamp);
  }
  g.userData.rotors = rotors;
  return g;
}

/**
 * Hero multi-tier sci-fi citadel / orbital relay megasite:
 * Window-grid illuminated octagonal keep, 8 vertical exoskeleton armor ribs,
 * four buttressed cooling-fin spires, dual X-truss skybridges, fighter landing
 * aprons with H-markings & blast deflectors, dual counter-rotating orbital rings,
 * holographic spire beam, and dual animated radar scanner arrays.
 */
function buildMegasite(zoneId = 'dune') {
  const palettes = {
    sea:   { shell: 0x416b86, trim: 0x1b364f, accent: 0x78a9c0, glow: 0x6ce4ff, hot: 0xffc66e },
    gorge: { shell: 0x776653, trim: 0x2e3745, accent: 0xa4957c, glow: 0x92ecff, hot: 0xffc066 },
    ember: { shell: 0x643844, trim: 0x241d28, accent: 0x98525c, glow: 0xff6e3a, hot: 0xffd668 },
    dune:  { shell: 0x6c6472, trim: 0x262d42, accent: 0xb29874, glow: 0xa088ff, hot: 0xffb858 },
  };
  const c = palettes[zoneId] ?? palettes.dune;
  const g = new THREE.Group();
  const shell = pbr(c.shell, 0x000000, 0, { panel: true, roughness: 0.54, metalness: 0.36 });
  const trim = pbr(c.trim, 0x000000, 0, { panel: true, roughness: 0.62, metalness: 0.42 });
  const accentMat = pbr(c.accent, 0x000000, 0, { detail: true, roughness: 0.56, metalness: 0.32 });
  const windowHull = pbr(c.shell, c.glow, 0.85, { windows: true, roughness: 0.44, metalness: 0.40 });
  const glow = pbr(0x101c2d, c.glow, 2.2, { roughness: 0.22, metalness: 0.42 });
  const hot = pbr(0x281610, c.hot, 1.85, { roughness: 0.26, metalness: 0.35 });

  // Heavy stepped octagonal citadel plinth & illuminated window-grid central command keep
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(14.8, 19.6, 5.8, 8), shell);
  plinth.position.y = 2.9; g.add(plinth);
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(17.2, 17.2, 1.6, 12), trim);
  deck.position.y = 6.2; g.add(deck);
  const deckRimGlow = new THREE.Mesh(new THREE.TorusGeometry(17.4, 0.34, 6, 24), glow);
  deckRimGlow.rotation.x = Math.PI / 2; deckRimGlow.position.y = 6.8; g.add(deckRimGlow);

  const coreKeep = new THREE.Mesh(new THREE.CylinderGeometry(6.6, 8.4, 17.0, 8), windowHull);
  coreKeep.position.y = 14.8; g.add(coreKeep);
  // 8 vertical armored exoskeleton ribs framing the illuminated keep windows
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    const rib = new THREE.Mesh(new THREE.BoxGeometry(1.15, 17.6, 1.55), trim);
    rib.position.set(Math.cos(a) * 7.5, 14.8, Math.sin(a) * 7.5);
    rib.rotation.y = -a; g.add(rib);
  }
  // Illuminated multi-level command-bridge visor ribbons wrapped around central core
  for (const wy of [10.4, 15.2, 20.0]) {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(7.8 - (wy - 10) * 0.14, 8.0 - (wy - 10) * 0.14, 0.72, 8), glow);
    band.position.y = wy; g.add(band);
    const lip = new THREE.Mesh(new THREE.CylinderGeometry(8.35 - (wy - 10) * 0.14, 8.35 - (wy - 10) * 0.14, 0.38, 8), trim);
    lip.position.y = wy + 0.54; g.add(lip);
  }
  const commandCap = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 6.8, 3.4, 8), trim);
  commandCap.position.y = 24.5; g.add(commandCap);

  // Four stepped buttressed corner spires with cooling louver fins, window bands & aviation strobes
  for (const side of [-1, 1]) {
    for (const z of [-1, 1]) {
      const x = side * 10.4, zz = z * 9.2;
      const th = 22.5 + (z > 0 ? 7.5 : 0);
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 4.0, th, 6), windowHull);
      tower.position.set(x, 6 + th * 0.5, zz); g.add(tower);
      const armorCollar = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.8, 1.7, 6), trim);
      armorCollar.position.set(x, 6 + th * 0.65, zz); g.add(armorCollar);
      const lowerCollar = new THREE.Mesh(new THREE.CylinderGeometry(4.1, 4.3, 1.4, 6), trim);
      lowerCollar.position.set(x, 6 + th * 0.28, zz); g.add(lowerCollar);
      // Outward armor buttress fin + radiator louver ribs
      const fin = new THREE.Mesh(new THREE.BoxGeometry(1.1, th * 0.72, 2.6), trim);
      fin.position.set(x + side * 3.2, 6 + th * 0.40, zz); g.add(fin);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(3.5, 6.8, 6), trim);
      cap.position.set(x, 6 + th + 3.4, zz); g.add(cap);
      const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.25, 6.8, 5), accentMat);
      needle.position.set(x, 6 + th + 9.2, zz); g.add(needle);
      const strobe = new THREE.Mesh(new THREE.SphereGeometry(0.54, 6, 5), hot);
      strobe.position.set(x, 6 + th + 12.6, zz); g.add(strobe);
      for (let h = 0; h < 4; h++) {
        const win = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.74, 0.26), glow);
        win.position.set(x + side * 2.9, 10 + h * 4.6, zz - 0.2); g.add(win);
      }
    }
  }

  // Dual X-truss skybridges & illuminated transit strips
  for (const y of [11.2, 19.4]) {
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(28, 1.0, 2.1), trim);
    bridge.position.set(0, y, 0); g.add(bridge);
    const transit = new THREE.Mesh(new THREE.BoxGeometry(25, 0.32, 2.3), glow);
    transit.position.set(0, y + 0.16, 0); g.add(transit);
    for (const side of [-1, 1]) {
      const brace = new THREE.Mesh(new THREE.BoxGeometry(0.68, 10.8, 0.68), trim);
      brace.position.set(side * 6.8, y - 4.2, 0); brace.rotation.z = side * 0.56; g.add(brace);
    }
  }

  // Dual counter-rotating orbital telemetry rings + glowing plasma emitter core & holographic beam spire
  const ring = new THREE.Mesh(new THREE.TorusGeometry(11.0, 0.72, 8, 24), pbr(c.trim, c.glow, 0.70));
  ring.position.set(0, 28.5, -2); g.add(ring);
  const innerRing = new THREE.Mesh(new THREE.TorusGeometry(8.2, 0.42, 6, 20), glow);
  innerRing.position.set(0, 28.5, -2); innerRing.rotation.x = Math.PI * 0.35; g.add(innerRing);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.82, 0), hot);
    beacon.position.set(Math.cos(a) * 11.0, 28.5 + Math.sin(a) * 11.0, -2); g.add(beacon);
  }
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.92, 26, 6), trim);
  mast.position.set(0, 36, 2.5); g.add(mast);
  // Subtle translucent energy beam inside upper emitter spire
  const beamMat = new THREE.MeshBasicMaterial({
    color: c.glow, transparent: true, opacity: 0.24, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const energyBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 1.35, 34, 8, 1, true), beamMat);
  energyBeam.position.set(0, 42, 2.5); g.add(energyBeam);
  const dish = new THREE.Mesh(new THREE.ConeGeometry(5.2, 2.2, 14, 1, true), pbr(c.shell, c.glow, 0.48, { doubleSide: true }));
  dish.rotation.x = -0.72; dish.position.set(0, 48, 2.5); g.add(dish);
  const core = new THREE.Mesh(new THREE.SphereGeometry(1.65, 10, 8), glow);
  core.position.set(0, 48, 1.2); g.add(core);

  // Offset rotating radar masts + cantilevered fighter landing aprons with H-pads, blast shields & command pods
  const scannerRotors = [];
  for (const side of [-1, 1]) {
    const mastBase = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 3.1, 8.8, 7), trim);
    mastBase.position.set(side * 28.5, 8.2, -8); g.add(mastBase);
    const mastArm = new THREE.Mesh(new THREE.BoxGeometry(3.2, 22.5, 3.2), shell);
    mastArm.position.set(side * 28.5, 19.8, -8); g.add(mastArm);
    const rotor = new THREE.Group();
    rotor.position.set(side * 28.5, 32.5, -8);
    const rDish = new THREE.Mesh(new THREE.ConeGeometry(7.2, 2.3, 12, 1, true), pbr(0x283c50, c.glow, 0.60, { doubleSide: true }));
    rDish.rotation.z = side * 0.74; rotor.add(rDish);
    const rFrame = new THREE.Mesh(new THREE.TorusGeometry(6.8, 0.26, 5, 14), trim);
    rFrame.rotation.y = Math.PI / 2; rFrame.rotation.z = side * 0.74; rotor.add(rFrame);
    const receiver = new THREE.Mesh(new THREE.SphereGeometry(0.98, 7, 6), hot);
    receiver.position.set(side * 4.5, 0, 0); rotor.add(receiver);
    g.add(rotor); scannerRotors.push(rotor);

    // Protruding fighter landing apron with crisp H-pad, angled blast deflector & command pod
    const pad = new THREE.Mesh(new THREE.BoxGeometry(12.2, 1.3, 9.8), trim);
    pad.position.set(side * 24.5, 7.2, 6); g.add(pad);
    const padDeck = new THREE.Mesh(new THREE.BoxGeometry(10.4, 0.26, 7.8), accentMat);
    padDeck.position.set(side * 24.5, 7.95, 6); g.add(padDeck);
    // Landing pad H-marking + blast deflector ramp
    const padH = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.28, 0.46), hot);
    padH.position.set(side * 24.5, 8.08, 6); g.add(padH);
    const blastWall = new THREE.Mesh(new THREE.BoxGeometry(0.65, 2.4, 6.2), trim);
    blastWall.position.set(side * 19.2, 9.0, 6); blastWall.rotation.z = side * -0.35; g.add(blastWall);
    for (const pSide of [-1, 1]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(8.8, 0.24, 0.48), pSide > 0 ? glow : hot);
      strip.position.set(side * 24.5, 8.10, 6 + pSide * 3.3); g.add(strip);
      const hArm = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.28, 2.6), hot);
      hArm.position.set(side * 24.5 + pSide * 1.3, 8.08, 6); g.add(hArm);
    }
    const pod = buildCommandPod(3.4, shell, trim, glow, hot);
    pod.position.set(side * 33.5, 7.4, 2); g.add(pod);
  }

  // Service catwalks, industrial coolant piping & X-braced diagonal struts
  const weather = pbr(c.hot, 0x000000, 0, { detail: true, roughness: 0.74, metalness: 0.22 });
  for (const side of [-1, 1]) {
    const catwalk = new THREE.Mesh(new THREE.BoxGeometry(13.5, 0.68, 3.4), trim);
    catwalk.position.set(side * 18.8, 16.5, -5); g.add(catwalk);
    g.add(strutBetween(new THREE.Vector3(side * 12, 18.0, -6.2), new THREE.Vector3(side * 24.8, 18.0, -6.2), 0.18, accentMat, 5));
    g.add(strutBetween(new THREE.Vector3(side * 15, 6, 7), new THREE.Vector3(side * 22, 29, 3), 0.72, weather, 7));
    g.add(strutBetween(new THREE.Vector3(side * 20, 9, 5), new THREE.Vector3(side * 27, 24, 1), 0.48, trim, 6));
  }

  // Zone-specific heavy anchoring foundations
  if (zoneId === 'sea') {
    for (const side of [-1, 1]) for (const front of [-1, 1]) {
      const pile = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.55, 32, 8), trim);
      pile.position.set(side * 14, -10, front * 13); g.add(pile);
      g.add(strutBetween(new THREE.Vector3(side * 14, 2, front * 13), new THREE.Vector3(side * 5.5, 8.5, front * 5.5), 0.60, shell, 6));
    }
  } else if (zoneId === 'gorge') {
    for (const side of [-1, 1]) {
      const retaining = new THREE.Mesh(new THREE.BoxGeometry(14.5, 7.8, 9.8), shell);
      retaining.position.set(side * 18, 3.9, 10); retaining.rotation.y = side * 0.16; g.add(retaining);
      g.add(strutBetween(new THREE.Vector3(side * 24, 1, 6), new THREE.Vector3(side * 11, 15, 2), 0.54, trim, 6));
    }
  } else if (zoneId === 'ember') {
    for (const side of [-1, 1]) {
      const duct = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.7, 32, 8), pbr(0x3a232a, c.glow, 0.48, { panel: true }));
      duct.position.set(side * 23, 16, 8); duct.rotation.z = side * 0.16; g.add(duct);
      const vent = new THREE.Mesh(new THREE.ConeGeometry(2.8, 4.8, 8), hot);
      vent.position.set(side * 26.8, 31, 8); g.add(vent);
    }
  } else {
    for (const side of [-1, 1]) {
      const survey = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 2.6, 29, 6), trim);
      survey.position.set(side * 21, 14.5, 9); g.add(survey);
      const lens = new THREE.Mesh(new THREE.SphereGeometry(2.0, 8, 6), pbr(0x1c1727, c.glow, 1.85));
      lens.position.set(side * 21, 30, 9); g.add(lens);
      g.add(strutBetween(new THREE.Vector3(side * 21, 4, 9), new THREE.Vector3(side * 8.5, 10.5, 2), 0.50, shell, 6));
    }
  }

  g.userData.beaconRing = ring;
  g.userData.innerRing = innerRing;
  g.userData.scannerRotors = scannerRotors;
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
    this.enabled = true;
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
      if (o.geometry) o.geometry.userData.shared = true;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        normalizeImportedMaterial(m, { emissiveFloor: 0.18 });
        if (m) m.userData.shared = true;
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
      const slot = { z: -i * SPACING - rand(0, 60), inner: null, spin: 0, colliders: [] };
      this.group.add((slot.holder = new THREE.Group()));
      this.propSlots.push(slot);
    }
    for (let i = 0; i < N_SHIP; i++) {
      const name = SHIPS[i % SHIPS.length];
      const holder = this._container(name);
      this.group.add(holder);
      this.shipSlots.push({ z: -i * (SPACING * 2.6) - rand(0, 200), holder, name, bob: rand(0, TAU), colliders: [] });
    }
    for (let i = 0; i < N_HERO; i++) {
      const holder = new THREE.Group();
      this.group.add(holder);
      this.heroSlots.push({ z: -780 - i * 1240 - rand(0, 140), holder, kind: null, phase: rand(0, TAU), colliders: [] });
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

  /** Compute accurate solid cylinder collider(s) fitted to the real 3D mesh bounds. */
  _fitColliders(slot, damage = 18, splitTiers = false) {
    slot.colliders.length = 0;
    const h = slot.holder;
    const prevVis = h.visible;
    h.visible = true;
    h.updateMatrixWorld(true);
    _box.setFromObject(h);
    h.visible = prevVis;
    if (_box.isEmpty()) return;
    _box.getCenter(_bc);
    _box.getSize(_bs);
    const px = h.position.x, py = h.position.y, pz = h.position.z;
    const rhFull = Math.max(_bs.x, _bs.z) * 0.44;
    const hyFull = _bs.y * 0.48;
    if (splitTiers && _bs.y > 26) {
      // Lower wide foundation deck + slimmer upper superstructure tower so flying over the lower apron works cleanly while the building itself is 100% solid!
      const baseH = _bs.y * 0.34;
      slot.colliders.push({
        lx: _bc.x - px,
        ly: (_box.min.y + baseH * 0.5) - py,
        lz: _bc.z - pz,
        rh: rhFull,
        hy: baseH * 0.52,
        dmg: damage,
      });
      const topH = _bs.y * 0.66;
      slot.colliders.push({
        lx: _bc.x - px,
        ly: (_box.min.y + baseH + topH * 0.5) - py,
        lz: _bc.z - pz,
        rh: rhFull * 0.68,
        hy: topH * 0.48,
        dmg: damage,
      });
    } else {
      slot.colliders.push({
        lx: _bc.x - px,
        ly: _bc.y - py,
        lz: _bc.z - pz,
        rh: rhFull,
        hy: hyFull,
        dmg: damage,
      });
    }
  }

  /**
   * Expose solid colliders for all visible artificial structures & cruisers near
   * the active combat band — matches Terrain.forEachObstacle's signature plus `isStructure = true`.
   */
  forEachObstacle(cb) {
    if (!this.ready || !this.enabled || !SHOW_LARGE_ARTIFICIAL_SCENERY) return;
    const emitSlots = (slots) => {
      for (let sIdx = 0; sIdx < slots.length; sIdx++) {
        const s = slots[sIdx];
        if (!s.holder.visible || !s.colliders.length) continue;
        const hx = s.holder.position.x;
        const hy0 = s.holder.position.y;
        const hz = s.holder.position.z;
        for (let i = 0; i < s.colliders.length; i++) {
          const c = s.colliders[i];
          const wz = hz + c.lz;
          if (wz > -165 - c.rh && wz < 55 + c.rh) {
            cb(hx + c.lx, hy0 + c.ly, wz, c.rh, c.hy, c.dmg, s.holder, true);
          }
        }
      }
    };
    emitSlots(this.propSlots);
    emitSlots(this.heroSlots);
    emitSlots(this.shipSlots);
  }

  setZone(zone) {
    this.zone = zone;
    this._openWater = zone?.id === 'sea';
  }

  /** Quality-controlled culling preserves the close silhouette layer while trimming distant scene traversal. */
  setDrawDistance(distance = 1500) {
    this._drawDistance = Math.max(780, Math.min(1800, distance));
  }

  /** Allow LITE mode to disable distant megasite/facility draw calls cleanly. */
  setEnabled(enabled) {
    this.enabled = !!enabled;
    this.group.visible = this.enabled;
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

  /** Resolve the true terrain-synchronized flight corridor at `worldZ` so props never drift into the lane. */
  _routeAt(zoneId, worldZ) {
    const chunks = this.game?.terrain?.chunks;
    if (chunks && chunks.length) {
      for (let i = 0; i < chunks.length; i++) {
        const ch = chunks[i];
        const cz = ch.position.z;
        if (worldZ <= cz + 12 && worldZ >= cz - 312) {
          return flightRoute(zoneId, ch.userData.virtualZ + (worldZ - cz));
        }
      }
    }
    return flightRoute(zoneId, worldZ);
  }

  _rollProp(slot) {
    if (slot.inner) {
      slot.holder.remove(slot.inner);
      disposeTree(slot.inner);
      slot.inner = null;
    }
    slot.colliders.length = 0;
    if (!SHOW_LARGE_ARTIFICIAL_SCENERY) {
      slot.holder.clear();
      slot.name = null;
      return;
    }
    const z = this.zone || {};
    const pool = ZONE_PROP_POOLS[z.id] ?? KENNEY;
    const name = pick(pool);
    const t = this.templates[name];
    if (!t) return;
    const inner = new THREE.Group();
    const model = t.obj.clone(true);
    model.position.set(-t.cx, -t.minY, -t.cz);
    model.visible = true;
    const facility = FACILITIES.has(name);
    if (facility) {
      const foundation = buildFoundation(t.size, z.id);
      inner.add(foundation);
      const service = buildFacilityServiceLayer(t.size, z.id, name);
      service.position.y = foundation.userData.topY;
      inner.add(service);
      slot.rotors = service.userData.rotors ?? [];
      model.position.y += foundation.userData.topY;
    } else {
      slot.rotors = [];
    }
    inner.add(model);
    slot.holder.add(inner); slot.inner = inner; slot.name = name;

    const side = Math.random() < 0.5 ? -1 : 1;
    const landmarkShell = name === 'aero_station_ring' || name === 'scifi_bridge';
    const compactFacility = name.startsWith('scifi_') || name.startsWith('satellite');
    const background = landmarkShell || Math.random() < (this._openWater ? 0.55 : 0.48);
    const route = this._routeAt(z.id, slot.z);
    let targetSize, x;
    if (background) {
      targetSize = landmarkShell ? rand(72, 108) : (compactFacility ? rand(38, 60) : rand(50, 82));
      x = route.center + side * rand(340, 560);
      if (Math.abs(x) < 290) x = side * rand(310, 460);
    } else {
      // Positioned cleanly outside the wide flight corridor so outposts frame the flanks
      // without cluttering or blocking the player's navigable flight channel.
      targetSize = compactFacility ? rand(28, 42) : rand(34, 52);
      const minClear = route.halfWidth + 148;
      x = route.center + side * rand(minClear, route.halfWidth + 230);
      if (Math.abs(x) < 175) x = side * rand(182, 245);
    }
    const sc = targetSize / t.size;
    slot.holder.scale.setScalar(sc);
    slot.holder.position.set(x, this.zone?.floorY ?? 0, slot.z);
    slot.holder.rotation.set(0, rand(TAU), 0);
    slot.spin = 0;
    if (name.startsWith('rocket')) slot.holder.rotation.z = rand(-0.035, 0.035);
    this._fitColliders(slot, 18, facility);
  }

  _rollShip(slot) {
    slot.colliders.length = 0;
    const side = Math.random() < 0.5 ? -1 : 1;
    const flying = this._openWater ? true : Math.random() < 0.6;
    const t = this.templates[slot.name];
    if (!t) return;
    let targetSize, x, y, rotX = 0, rotZ = 0;
    if (flying) {
      targetSize = rand(46, 78); x = side * rand(340, 580); y = rand(76, 168); rotZ = -side * rand(0.1, 0.36);
    } else {
      targetSize = rand(36, 62); x = side * rand(280, 420); y = rand(0, 3); rotX = rand(-0.12, 0.05); rotZ = rand(-0.1, 0.1);
    }
    const sc = targetSize / t.size;
    slot.holder.scale.setScalar(sc);
    slot.holder.position.set(x, (this.zone?.floorY ?? 0) + y, slot.z);
    slot.holder.rotation.set(rotX, rand(-0.5, 0.5) + (flying ? 0 : side * 0.6), rotZ);
    slot.flying = flying;
    if (flying) this._fitColliders(slot, 22, false);
  }

  /** Place a rare, intricately detailed hero megasite citadel well outside the flight lane. */
  _rollHero(slot) {
    for (let i = slot.holder.children.length - 1; i >= 0; i--) {
      const ch = slot.holder.children[i];
      slot.holder.remove(ch);
      disposeTree(ch);
    }
    slot.colliders.length = 0;
    if (!SHOW_LARGE_ARTIFICIAL_SCENERY) {
      slot.kind = null;
      slot.site = null;
      return;
    }
    const zoneId = this.zone?.id ?? 'dune';
    const kind = zoneId === 'sea' ? 'hero_coast_rock' : 'hero_desert_rock';
    const size = zoneId === 'sea' ? rand(152, 198) : rand(146, 188);

    const site = buildMegasite(zoneId);
    site.scale.setScalar(size / 102);
    site.position.set(0, 0, 0);
    site.rotation.y = rand(-0.55, 0.55);

    const accent = zoneId === 'ember' ? 0xff6a38 : zoneId === 'sea' ? 0x62d8ff : zoneId === 'gorge' ? 0x8fe6ff : (this.stage >= 15 ? 0x9b82ff : 0xffc66b);
    const accentMat = pbr(0x17202a, accent, 1.6);
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
      const beam = new THREE.Mesh(new THREE.BoxGeometry(58, 2.2, 5.2), trimMat);
      beam.position.set(0, 29, -6); stageDetail.add(beam);
      for (const side of [-1, 1]) {
        const brace = new THREE.Mesh(new THREE.BoxGeometry(1.4, 30, 1.4), trimMat);
        brace.position.set(side * 20, 14, -6); brace.rotation.z = side * 0.55; stageDetail.add(brace);
        const light = new THREE.Mesh(new THREE.SphereGeometry(1.6, 8, 6), accentMat);
        light.position.set(side * 28, 29, -6); stageDetail.add(light);
      }
    } else {
      const crown = new THREE.Mesh(new THREE.TorusGeometry(16.5, 1.25, 7, 18), accentMat);
      crown.position.set(0, 44, -4); crown.rotation.x = Math.PI / 2; stageDetail.add(crown);
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * TAU;
        const node = new THREE.Mesh(new THREE.OctahedronGeometry(1.7, 0), accentMat);
        node.position.set(Math.cos(a) * 16.5, 44 + Math.sin(a) * 16.5, -4); stageDetail.add(node);
      }
    }
    site.add(stageDetail);
    slot.holder.add(site);

    const side = Math.random() < 0.5 ? -1 : 1;
    const route = this._routeAt(zoneId, slot.z);
    let hx = route.center + side * rand(route.halfWidth + 230, route.halfWidth + 360);
    if (Math.abs(hx) < 285) hx = side * rand(295, 410);
    slot.holder.position.set(hx, (this.zone?.floorY ?? 0) + (zoneId === 'sea' ? -4 : 0), slot.z);
    slot.holder.rotation.y = rand(-0.35, 0.35);
    slot.kind = kind;
    slot.site = site;
    this._fitColliders(slot, 24, true);
  }

  update(dt, scroll) {
    if (!this.ready || !this.enabled) return;
    for (const s of this.propSlots) {
      s.z += scroll * dt; s.holder.position.z = s.z;
      s.holder.visible = SHOW_LARGE_ARTIFICIAL_SCENERY && s.z > -this._drawDistance && s.z < 90;
      if (s.holder.visible) {
        if (s.spin) s.holder.rotation.y += s.spin * dt;
        if (s.rotors?.length) {
          for (let r = 0; r < s.rotors.length; r++) s.rotors[r].rotation.y += dt * 1.15;
        }
      }
      if (s.z > FRONT) { s.z -= N_PROP * SPACING; this._rollProp(s); }
    }
    for (const s of this.shipSlots) {
      s.z += scroll * dt * 0.85; s.holder.position.z = s.z;
      s.holder.visible = s.z > -this._drawDistance && s.z < 60 && s.flying;
      if (s.flying && s.holder.visible) { s.bob += dt; s.holder.position.y += Math.sin(s.bob * 0.8) * 3.5 * dt; }
      if (s.z > FRONT) { s.z -= N_SHIP * SPACING * 2.6; this._rollShip(s); }
    }
    for (const s of this.heroSlots) {
      s.z += scroll * dt; s.holder.position.z = s.z;
      s.holder.visible = SHOW_LARGE_ARTIFICIAL_SCENERY && s.z > -this._drawDistance && s.z < 75;
      if (s.holder.visible) s.phase += dt;
      if (s.holder.visible && s.site?.userData.beaconRing) s.site.userData.beaconRing.rotation.z += dt * 0.24;
      if (s.holder.visible && s.site?.userData.innerRing) s.site.userData.innerRing.rotation.z -= dt * 0.42;
      if (s.holder.visible && s.site?.userData.scannerRotors) {
        for (let i = 0; i < s.site.userData.scannerRotors.length; i++) {
          s.site.userData.scannerRotors[i].rotation.y += dt * (0.32 + i * 0.08);
        }
      }
      if (s.z > FRONT) { s.z -= N_HERO * 1240; this._rollHero(s); }
    }
  }
}
