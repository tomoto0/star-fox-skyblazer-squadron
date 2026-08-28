import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { toonMat, dotTexture, loadDetailTexture, TAU } from '../core/util.js';

/* ---- real CC0 3D models for EVERY enemy type: Quaternius Ultimate Spaceships
 * for the fighters, Kenney Space Kit for turrets / structures / ground units.
 * Loaded once, normalised (centred + scaled to `size`; fighters rotated nose to
 * -z; ground models rest their base at y=0), then cloned per spawn. Until a
 * model arrives the procedural builder is used as a graceful fallback. */
export const SHIP_MODELS = {};
const MODEL_DEFS = {
  // numerous grunts → low-poly Kenney craft (cheap, many on screen at once)
  drone:    { path: 'props/craft_racer',    size: 4.6, glow: 0x9ad0ff },
  lancer:   { path: 'props/craft_speedera',  size: 5.6, glow: 0xff6a60 },
  ray:      { path: 'props/craft_speederb',  size: 6.4, glow: 0x7fe9ff },
  // elites → detailed Quaternius fighters (few on screen) — nose faces -z
  strafer:  { path: 'ships/striker',     size: 7.6,  rotY: Math.PI, glow: 0xff8560 },
  seeker:   { path: 'ships/zenith',      size: 7.0,  rotY: Math.PI, glow: 0x8bffe0 },
  sniper:   { path: 'ships/omen',        size: 7.6,  rotY: Math.PI, glow: 0x59c6ff },
  bomber:   { path: 'ships/dispatcher',  size: 11.5, rotY: Math.PI, glow: 0xff8a3e },
  // additional CC0 models: a mobile relay carrier and its compact escort drone
  skyraider:{ path: 'external/aero_airship', size: 16.5, rotY: Math.PI, glow: 0xff9a4c },
  relaydrone:{ path: 'external/scifi_drone', size: 6.8, rotY: Math.PI, glow: 0xff45a8 },
  gunship:  { path: 'ships/executioner', size: 14.0, rotY: Math.PI, glow: 0xff5030 },
  carrier:  { path: 'ships/imperial',    size: 17.0, rotY: Math.PI, glow: 0xff9e4a },
  saucer:   { path: 'ships/pancake',     size: 8.6,  rotY: Math.PI, glow: 0x8fffe0 },
  // structures / ground (props|debris/*.glb)
  pod:      { path: 'props/machine_wireless',  size: 5.2 },
  mine:     { path: 'debris/crystals',         size: 4.4 },
  turret:   { path: 'props/turret_single',     size: 6.4, ground: true },
  flak:     { path: 'props/turret_double',     size: 8.6, ground: true },
  hovertank:{ path: 'props/craft_speederb',    size: 9.6 },
  launcher: { path: 'props/rocket_basea',      size: 8.6, ground: true },

  /* ---- enemy/ally expansion pack (Quaternius Sci-Fi Essentials + Ultimate
     Space Kit + Kenney Pirate Kit) — bigger, meaner, purpose-built enemies ---- */
  scout:    { path: 'expansion/Enemy_EyeDrone',    ext: 'gltf', size: 8.0,  rotY: Math.PI, glow: 0xff4d5e },
  fighter:  { path: 'expansion/Enemy_Flying',      ext: 'gltf', size: 11.0, rotY: Math.PI, glow: 0xff8a3e },
  // CC0 light aircraft by iPoly3D (OpenGameArt); converted from .blend to GLB.
  // Its conventional wing/tail profile gives low-altitude interception a distinct read.
  skytalon: { path: 'external/sky_talon',           ext: 'glb',  size: 9.2,  rotY: Math.PI, glow: 0xffc45d, tint: 0xd24b38 },
  // unused CC0 Quaternius hulls become distinct late-campaign combat roles
  harrier:  { path: 'ships/challenger',             size: 9.4,  rotY: Math.PI, glow: 0xff4d6d },
  phantom:  { path: 'ships/spitfire',               size: 8.8,  rotY: Math.PI, glow: 0x9d72ff },
  // Dreadwing uses the bespoke procedural siege hull below. It exposes its
  // armour seams, launch bay and engine array reliably on every renderer.
  dreadwing:{ path: 'ships/insurgent',              size: 19.5, rotY: Math.PI, glow: 0xa878ff, procedural: true },
  quadtank: { path: 'expansion/Enemy_QuadShell',   ext: 'gltf', size: 12.0, rotY: Math.PI, ground: true },
  trilobite:{ path: 'expansion/Enemy_Trilobite',   ext: 'gltf', size: 13.0, rotY: Math.PI, ground: true },
  mech:     { path: 'expansion/Enemy_Large',       ext: 'gltf', size: 16.0, rotY: Math.PI, ground: true },
  cannon:   { path: 'expansion/cannon-mobile',     ext: 'glb',  size: 8.0,  ground: true },
  shorecannon:{ path: 'expansion/cannon',          ext: 'glb',  size: 7.0,  ground: true },
  gunboat:  { path: 'expansion/ship-large',        ext: 'glb',  size: 26.0, ground: true },
  frigate:  { path: 'expansion/ship-pirate-large', ext: 'glb',  size: 34.0, ground: true },
};
{
  const loader = new GLTFLoader();
  for (const [type, def] of Object.entries(MODEL_DEFS)) {
    if (def.procedural) continue;
    const ext = def.ext || (def.path.startsWith('ships/') ? 'gltf' : 'glb');
    loader.load(`./assets/models/${def.path}.${ext}`, (gltf) => {
      const obj = gltf.scene;
      obj.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = o.receiveShadow = false;
        for (const material of (Array.isArray(o.material) ? o.material : [o.material])) {
          if (!material) continue;
          material.fog = true;
          // Some kit assets rely on an environment map or dark packed texture
          // data that is not present in the rail-shooter lighting setup. Retain
          // their authored paint colour, but use a tiny emissive floor and
          // two-sided shaded surface so a valuable enemy never becomes a black
          // silhouette at attack range.
          if (material.color && material.emissive) {
            if (def.tint) material.color.lerp(new THREE.Color(def.tint), 0.72);
            const paint = material.color.clone();
            material.map = null;
            material.vertexColors = false;
            material.emissive.copy(paint).multiplyScalar(0.055);
            material.emissiveIntensity = 1;
            if ('roughness' in material) material.roughness = Math.min(material.roughness ?? 0.72, 0.72);
            if ('metalness' in material) material.metalness = Math.min(material.metalness ?? 0.24, 0.30);
            material.side = THREE.DoubleSide;
            material.needsUpdate = true;
          }
        }
      });
      const box = new THREE.Box3().setFromObject(obj);
      const c = box.getCenter(new THREE.Vector3());
      const dim = box.getSize(new THREE.Vector3());
      const s = def.size / (Math.max(dim.x, dim.y, dim.z) || 1);
      obj.scale.setScalar(s);
      obj.position.set(-c.x * s, def.ground ? -box.min.y * s : -c.y * s, -c.z * s);
      const spin = new THREE.Group(); spin.rotation.y = def.rotY || 0; spin.add(obj);
      const wrap = new THREE.Group(); wrap.add(spin);
      if (def.glow) { const gl = glowSprite(def.glow, def.size * 0.34); gl.position.set(0, 0, def.size * 0.32); wrap.add(gl); wrap.userData.glow = gl; }
      addCombatFrame(wrap, type, def);
      SHIP_MODELS[type] = wrap;
    });
  }
}

// subtle brushed-metal panel grain for the hull (CC0)
const metalTex = loadDetailTexture('./assets/textures/metal_diff.jpg', { repeat: 1.5, brightness: 1.95, contrast: 0.45, desat: 0.7 });

const WHITE = 0xeef1f6, PANEL = 0xd7dde6, RED = 0xd8332e, DARKRED = 0x9c2622,
  NAVY = 0x2c3652, STEEL = 0x59657f, CANOPY = 0x2f9fd4, ENGINE = 0x66d9ff, TRIM = 0xf2b33a;

function box(w, h, d, color, opts) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), toonMat(color, opts)); }
function cone(r, h, seg, color, opts) { return new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), toonMat(color, opts)); }
function cyl(rt, rb, h, seg, color, opts) { return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), toonMat(color, opts)); }

function glowSprite(color, size, opacity = 0.95) {
  const m = new THREE.Sprite(new THREE.SpriteMaterial({
    map: dotTexture(), color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  m.scale.setScalar(size);
  return m;
}

/** Adds a lightweight, role-specific combat silhouette around imported hulls.
 * The GLB remains the main body; these rings, hardpoints and engine beacons
 * make fast enemies, artillery and carriers immediately readable in combat. */
function addCombatFrame(wrap, type, def) {
  if (!def.glow) return;
  const s = def.size;
  const heavy = new Set(['bomber', 'gunship', 'carrier', 'skyraider', 'dreadwing']);
  const artillery = new Set(['sniper', 'bomber', 'gunship', 'carrier', 'skyraider', 'dreadwing']);
  const scout = new Set(['drone', 'lancer', 'ray', 'strafer', 'seeker', 'scout', 'fighter', 'harrier', 'phantom', 'relaydrone']);
  const frame = new THREE.Group();
  frame.name = 'combatFrame';
  const accent = def.glow;
  const dark = 0x172033;
  const scale = heavy.has(type) ? 1.0 : 0.72;

  // A rotating forward sensor ring gives every airborne enemy a clear weak-end cue.
  const ring = new THREE.Mesh(new THREE.TorusGeometry(s * 0.16 * scale, s * 0.018 * scale, 5, 14),
    toonMat(dark, { emissive: accent, emissiveIntensity: 0.65, flat: true }));
  ring.name = 'combatSensorRing';
  ring.position.z = -s * 0.30;
  frame.add(ring);

  // Side hardpoints distinguish strafers/interceptors from pure scenery silhouettes.
  const hardpoints = heavy.has(type) ? [-0.32, -0.11, 0.11, 0.32] : [-0.24, 0.24];
  for (const x of hardpoints) {
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.026 * scale, s * 0.035 * scale, s * 0.18 * scale, 6), toonMat(dark, { flat: true }));
    pod.rotation.x = Math.PI / 2;
    pod.position.set(x * s, -s * 0.045, -s * 0.18);
    frame.add(pod);
    const tip = glowSprite(artillery.has(type) ? 0xffa45a : accent, s * 0.12 * scale, 0.75);
    tip.name = 'combatWeaponGlow';
    tip.position.set(x * s, -s * 0.045, -s * 0.29);
    frame.add(tip);
  }

  // Small fin arrays make scouts and fighters read as aggressive mobile units.
  if (scout.has(type)) {
    for (const side of [-1, 1]) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(s * 0.14, s * 0.025, s * 0.26), toonMat(0x263652, { flat: true }));
      fin.position.set(side * s * 0.30, s * 0.07, s * 0.15);
      fin.rotation.z = side * 0.42;
      frame.add(fin);
    }
  }

  // Layered service panels break up imported hulls with readable maintenance
  // bays and make the vehicle feel assembled rather than like a single mesh.
  const panelMat = toonMat(0x304057, { flat: true });
  panelMat.map = metalTex;
  for (const z of [-0.12, 0.10, 0.30]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(s * 0.24 * scale, s * 0.032 * scale, s * 0.16 * scale), panelMat);
    panel.position.set(0, s * 0.16 * scale, z * s);
    frame.add(panel);
  }
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(s * 0.05 * scale, s * 0.06 * scale, s * 0.42 * scale), toonMat(0x1b2537, { flat: true }));
    rail.position.set(side * s * 0.26 * scale, -s * 0.03 * scale, s * 0.10);
    frame.add(rail);
  }

  // Physical exhaust cans sit behind the model's hull and surround its glow,
  // turning a flat sprite into a layered propulsion assembly.
  const engineGlows = [];
  const engineCollars = [];
  const engineCount = heavy.has(type) ? 4 : 2;
  for (let i = 0; i < engineCount; i++) {
    const x = engineCount === 2 ? (i ? 0.18 : -0.18) * s : (-0.30 + i * 0.20) * s;
    const outer = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.055 * scale, s * 0.075 * scale, s * 0.15 * scale, 8), toonMat(0x1a2434, { flat: true }));
    outer.rotation.x = Math.PI / 2; outer.position.set(x, -s * 0.045 * scale, s * 0.35); frame.add(outer);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(s * 0.060 * scale, s * 0.010 * scale, 5, 10), toonMat(0x40506b, { emissive: accent, emissiveIntensity: 0.45, flat: true }));
    collar.name = 'combatEngineCollar';
    collar.rotation.x = Math.PI / 2; collar.position.set(x, -s * 0.045 * scale, s * 0.43); frame.add(collar);
    const exhaust = glowSprite(accent, s * (heavy.has(type) ? 0.16 : 0.13) * scale, 0.84);
    exhaust.name = 'combatEngineGlow';
    exhaust.position.set(x, -s * 0.045 * scale, s * 0.48); frame.add(exhaust);
    engineGlows.push(exhaust); engineCollars.push(collar);
  }

  // Four small caution lamps and one soot sprite are bounded state indicators.
  // Enemy update controls their brightness from remaining hit points.
  const warningLights = [];
  for (const side of [-1, 1]) {
    const warning = glowSprite(0xff654b, s * 0.075 * scale, 0.18);
    warning.name = 'combatWarningLight';
    warning.position.set(side * s * 0.34 * scale, s * 0.12 * scale, -s * 0.08);
    frame.add(warning); warningLights.push(warning);
  }
  const damageSmoke = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(), color: 0x5b2c28, transparent: true, opacity: 0, depthWrite: false }));
  damageSmoke.name = 'combatDamageSmoke';
  damageSmoke.position.set(0, s * 0.28 * scale, s * 0.02); damageSmoke.scale.set(s * 0.38, s * 0.52, 1); frame.add(damageSmoke);

  // A contained reactor and its heat fins make even a fast flyby read as a
  // machine with a power path. These are simple shared geometries per template,
  // then only transform during combat, so fleet density remains inexpensive.
  const reactor = new THREE.Mesh(new THREE.IcosahedronGeometry(s * 0.10 * scale, 1), toonMat(0x182337, { emissive: accent, emissiveIntensity: 1.15, flat: true }));
  reactor.name = 'combatReactorCore';
  reactor.position.set(0, s * 0.08 * scale, s * 0.18); frame.add(reactor);
  const reactorHalo = new THREE.Mesh(new THREE.TorusGeometry(s * 0.145 * scale, s * 0.015 * scale, 5, 12), toonMat(0x25334c, { emissive: accent, emissiveIntensity: 0.48, flat: true }));
  reactorHalo.name = 'combatReactorHalo';
  reactorHalo.rotation.x = Math.PI / 2; reactorHalo.position.copy(reactor.position); frame.add(reactorHalo);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + Math.PI / 6;
    const vane = new THREE.Mesh(new THREE.BoxGeometry(s * 0.035 * scale, s * 0.11 * scale, s * 0.20 * scale), toonMat(0x29354a, { emissive: accent, emissiveIntensity: 0.22, flat: true }));
    vane.name = 'combatHeatVane';
    vane.position.set(Math.cos(a) * s * 0.17 * scale, s * 0.08 * scale, s * 0.18 + Math.sin(a) * s * 0.04);
    vane.rotation.z = -a; frame.add(vane);
  }

  // Artillery silhouettes gain a physical muzzle cage; heavy vehicles gain
  // side armour plates and struts. These visual parts sit outside the hull and
  // explain its role without touching collision radii or enemy behaviour.
  if (artillery.has(type)) {
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(s * 0.026 * scale, s * 0.052 * scale, s * 0.34 * scale), toonMat(0x232d40, { emissive: accent, emissiveIntensity: 0.28, flat: true }));
      rail.position.set(side * s * 0.20 * scale, s * 0.025 * scale, -s * 0.31); frame.add(rail);
    }
    const muzzle = new THREE.Mesh(new THREE.TorusGeometry(s * 0.19 * scale, s * 0.017 * scale, 5, 12), toonMat(0x172030, { emissive: 0xffa45a, emissiveIntensity: 0.32, flat: true }));
    muzzle.name = 'combatMuzzleCage'; muzzle.position.set(0, s * 0.02 * scale, -s * 0.40); frame.add(muzzle);
  }
  if (heavy.has(type)) {
    for (const side of [-1, 1]) {
      const armour = new THREE.Mesh(new THREE.BoxGeometry(s * 0.15, s * 0.10, s * 0.48), toonMat(0x27344a, { emissive: accent, emissiveIntensity: 0.14, flat: true }));
      armour.name = 'combatArmourPlate'; armour.position.set(side * s * 0.36, s * 0.07, s * 0.04); armour.rotation.z = side * 0.16; frame.add(armour);
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.016, s * 0.022, s * 0.46, 5), toonMat(0x1d2738, { flat: true }));
      strut.position.set(side * s * 0.43, s * 0.08, s * 0.08); strut.rotation.x = Math.PI / 2; strut.rotation.z = side * 0.18; frame.add(strut);
    }
  }

  // Role-specific surface details make the silhouette legible before the HUD marker is read.
  // They use a few flat-shaded primitives and named parts, so the extra detail remains cheap
  // even when a formation contains many imported GLTF hulls.
  const dataVanes = [];
  if (scout.has(type)) {
    for (const side of [-1, 1]) {
      const vane = new THREE.Mesh(new THREE.BoxGeometry(s * 0.035 * scale, s * 0.19 * scale, s * 0.34 * scale), toonMat(0x24314a, { emissive: accent, emissiveIntensity: 0.18, flat: true }));
      vane.name = 'combatDataVane';
      vane.position.set(side * s * 0.17 * scale, s * 0.17 * scale, s * 0.08);
      vane.rotation.z = side * 0.52;
      frame.add(vane); dataVanes.push(vane);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(s * 0.032 * scale, 5, 4), toonMat(0x1b2639, { emissive: accent, emissiveIntensity: 0.75, flat: true }));
      tip.position.set(side * s * 0.26 * scale, s * 0.26 * scale, s * 0.11);
      frame.add(tip);
    }
  }
  if (artillery.has(type)) {
    for (const side of [-1, 1]) {
      const shroud = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.042 * scale, s * 0.055 * scale, s * 0.26 * scale, 6), toonMat(0x1b2537, { emissive: accent, emissiveIntensity: 0.16, flat: true }));
      shroud.rotation.x = Math.PI / 2;
      shroud.position.set(side * s * 0.26 * scale, -s * 0.015 * scale, -s * 0.33);
      frame.add(shroud);
    }
  }
  if (heavy.has(type)) {
    for (let i = 0; i < 3; i++) {
      const radiator = new THREE.Mesh(new THREE.BoxGeometry(s * 0.34, s * 0.026, s * 0.12), toonMat(0x202b3e, { emissive: accent, emissiveIntensity: 0.10, flat: true }));
      radiator.name = 'combatDataVane';
      radiator.position.set(0, s * (0.20 + i * 0.055), s * (-0.12 + i * 0.18));
      frame.add(radiator); dataVanes.push(radiator);
    }
  }

  // Heavy hulls get a dorsal command spine and a rear exhaust crown.
  if (heavy.has(type)) {
    const spine = new THREE.Mesh(new THREE.BoxGeometry(s * 0.18, s * 0.065, s * 0.62), toonMat(0x283548, { emissive: accent, emissiveIntensity: 0.2, flat: true }));
    spine.position.set(0, s * 0.16, s * 0.04);
    frame.add(spine);
    for (const side of [-1, 1]) {
      const exhaust = glowSprite(accent, s * 0.18, 0.82);
      exhaust.position.set(side * s * 0.16, 0, s * 0.38);
      frame.add(exhaust);
    }
  }
  frame.userData.visual = { engineGlows, engineCollars, warningLights, damageSmoke, dataVanes, accent };
  wrap.add(frame);
  wrap.userData.combatFrame = frame;
  wrap.userData.combatVisual = frame.userData.visual;
}

/* ============ PLAYER ARWING (red/white, concept style, detailed) ============ */
export function buildArwing(opts = {}) {
  const WING = opts.wing ?? RED;          // team accent colour (wings/fins/trim)
  const DARKWING = opts.darkWing ?? DARKRED;
  const ENG = opts.engine ?? ENGINE;      // engine glow colour
  const g = new THREE.Group();
  const hull = new THREE.Group(); // everything but trails/anchors
  g.add(hull);

  /* ---- fuselage: layered wedge with panel breaks ---- */
  const belly = box(1.9, 0.9, 5.4, PANEL, { flat: true });
  belly.position.set(0, -0.28, 0.4);
  belly.material.map = metalTex;
  hull.add(belly);
  const spine = box(1.5, 0.8, 4.8, WHITE, { flat: true });
  spine.position.set(0, 0.32, 0.2);
  spine.material.map = metalTex;
  hull.add(spine);
  // dorsal racing stripe (team accent)
  const stripe = box(0.5, 0.2, 4.4, WING, { flat: true });
  stripe.position.set(0, 0.74, 0.1);
  hull.add(stripe);

  /* ---- pointed nose (multi-segment) ---- */
  const nose1 = box(1.3, 0.7, 1.8, WHITE, { flat: true });
  nose1.position.set(0, 0.05, -3.0);
  hull.add(nose1);
  const nose2 = cone(0.62, 3.2, 4, WHITE, { flat: true });
  nose2.rotation.x = -Math.PI / 2; nose2.rotation.z = Math.PI / 4;
  nose2.position.set(0, 0.02, -4.9);
  hull.add(nose2);
  const noseTip = cone(0.24, 1.1, 4, WING, { flat: true });
  noseTip.rotation.x = -Math.PI / 2; noseTip.rotation.z = Math.PI / 4;
  noseTip.position.set(0, 0.02, -6.4);
  hull.add(noseTip);
  // chin sensor
  const chin = box(0.5, 0.3, 1.0, STEEL, { flat: true });
  chin.position.set(0, -0.5, -3.4);
  hull.add(chin);

  /* ---- cockpit: frame + glowing canopy glass ---- */
  const cframe = box(1.15, 0.55, 2.2, DARKRED, { flat: true });
  cframe.position.set(0, 0.6, -1.1);
  hull.add(cframe);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.62, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.62),
    toonMat(CANOPY, { emissive: 0x1a6fa0, emissiveIntensity: 0.9, transparent: true, opacity: 0.92 }));
  canopy.scale.set(0.92, 1.0, 1.9);
  canopy.position.set(0, 0.78, -1.05);
  hull.add(canopy);

  /* ---- engine deck ---- */
  const deck = box(2.2, 1.05, 2.4, NAVY, { flat: true });
  deck.position.set(0, 0.05, 3.0);
  deck.material.map = metalTex;
  hull.add(deck);
  const deckTop = box(1.6, 0.4, 2.0, STEEL, { flat: true });
  deckTop.position.set(0, 0.72, 3.0);
  hull.add(deckTop);
  // cyan intake bars along the flanks
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const bar = box(0.22, 0.5, 0.42, 0x0f3550, { emissive: ENG, emissiveIntensity: 2.0 });
      bar.position.set(s * 1.22, 0.15, 2.3 + i * 0.62);
      hull.add(bar);
    }
  }

  /* ---- twin engine nozzles + glow ---- */
  const glowGroup = new THREE.Group();
  const engineGlows = [];
  const enginePetals = [];
  for (const s of [-1, 1]) {
    const housing = cyl(0.55, 0.68, 1.2, 12, STEEL, { flat: true });
    housing.rotation.x = Math.PI / 2;
    housing.position.set(s * 0.62, 0.02, 3.9);
    hull.add(housing);
    const ring = cyl(0.6, 0.6, 0.18, 12, WING, { flat: true });
    ring.rotation.x = Math.PI / 2;
    ring.position.set(s * 0.62, 0.02, 4.5);
    hull.add(ring);
    const inner = cyl(0.42, 0.42, 0.2, 12, 0x0c1a2c, { emissive: ENG, emissiveIntensity: 1.6 });
    inner.rotation.x = Math.PI / 2;
    inner.position.set(s * 0.62, 0.02, 4.55);
    hull.add(inner);
    // Four armoured thrust petals give each exhaust a mechanical vectoring rim.
    const petalRig = new THREE.Group();
    petalRig.position.set(s * 0.62, 0.02, 4.58);
    for (let p = 0; p < 4; p++) {
      const a = p * Math.PI * 0.5 + Math.PI * 0.25;
      const petal = box(0.16, 0.46, 0.60, DARKWING, { flat: true });
      petal.position.set(Math.cos(a) * 0.47, Math.sin(a) * 0.47, 0.13);
      petal.rotation.z = a;
      petalRig.add(petal);
    }
    hull.add(petalRig); enginePetals.push(petalRig);
    const glow = glowSprite(ENG, 2.6);
    glow.position.set(s * 0.62, 0.02, 5.0);
    glowGroup.add(glow);
    engineGlows.push(glow);
  }
  hull.add(glowGroup);

  /* ---- main wings: swept, layered red blade + white leading edge ---- */
  function wing(sign) {
    const wg = new THREE.Group();
    // red main blade (tapered + swept)
    const bladeGeo = new THREE.BoxGeometry(5.0, 0.18, 1.9);
    bladeGeo.translate(2.5, 0, 0);
    const pos = bladeGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), k = x / 5.0;
      pos.setZ(i, pos.getZ(i) * (1 - k * 0.5) + k * 2.3);
    }
    bladeGeo.computeVertexNormals();
    const blade = new THREE.Mesh(bladeGeo, toonMat(WING, { flat: true }));
    wg.add(blade);
    // white leading edge
    const leGeo = new THREE.BoxGeometry(4.8, 0.2, 0.5);
    leGeo.translate(2.4, 0.02, -0.6);
    const lp = leGeo.attributes.position;
    for (let i = 0; i < lp.count; i++) { const k = lp.getX(i) / 4.8; lp.setZ(i, lp.getZ(i) + k * 2.3); }
    leGeo.computeVertexNormals();
    wg.add(new THREE.Mesh(leGeo, toonMat(WHITE, { flat: true })));
    // dark underwing strut
    const strut = box(3.0, 0.24, 0.4, DARKWING, { flat: true });
    strut.position.set(1.7, -0.22, 0.9);
    wg.add(strut);
    // wingtip white blade fin (angled up)
    const tip = box(0.4, 1.7, 1.0, WHITE, { flat: true });
    tip.position.set(5.0, 0.55, 1.6); tip.rotation.z = -0.5;
    wg.add(tip);
    const tipRed = box(0.24, 0.7, 1.0, WING, { flat: true });
    tipRed.position.set(5.15, 1.25, 1.6); tipRed.rotation.z = -0.5;
    wg.add(tipRed);
    // aviation nav light: red on the port wing, green to starboard
    wg.add((() => { const l = glowSprite(sign > 0 ? 0x35ff70 : 0xff5a6a, 0.9); l.position.set(5.2, 1.5, 1.5); return l; })());

    wg.position.set(sign * 0.9, -0.15, 1.2);
    wg.rotation.z = sign * 0.16;
    wg.scale.x = sign;
    return wg;
  }
  hull.add(wing(1), wing(-1));

  /* ---- upper tail fins ---- */
  for (const s of [1, -1]) {
    const fin = box(0.16, 1.7, 1.4, WING, { flat: true });
    fin.position.set(s * 0.95, 1.1, 3.2);
    fin.rotation.z = s * -0.42;
    hull.add(fin);
    const finEdge = box(0.2, 0.5, 1.4, WHITE, { flat: true });
    finEdge.position.set(s * 1.35, 1.75, 3.2);
    finEdge.rotation.z = s * -0.42;
    hull.add(finEdge);
  }

  /* ---- structural detail: wing roots, flight-control nozzles and gun ports ---- */
  for (const s of [-1, 1]) {
    const hinge = cyl(0.28, 0.34, 1.45, 8, STEEL, { flat: true });
    hinge.rotation.z = Math.PI / 2; hinge.position.set(s * 1.18, -0.04, 1.14); hull.add(hinge);
    const hingeCap = cyl(0.22, 0.22, 0.10, 8, WING, { flat: true });
    hingeCap.rotation.z = Math.PI / 2; hingeCap.position.set(s * 1.92, -0.04, 1.14); hull.add(hingeCap);
    const gunFairing = box(0.28, 0.24, 1.65, NAVY, { flat: true });
    gunFairing.position.set(s * 1.76, -0.26, -1.72); hull.add(gunFairing);
    const muzzle = glowSprite(0x9eefff, 0.38, 0.62);
    muzzle.position.set(s * 1.76, -0.26, -2.58); hull.add(muzzle);
    // paired RCS blocks on the rear fuselage read as real attitude-control hardware.
    for (const y of [-0.48, 0.70]) {
      const rcs = cyl(0.10, 0.14, 0.36, 6, STEEL, { flat: true });
      rcs.rotation.z = Math.PI / 2; rcs.position.set(s * 1.06, y, 3.18); hull.add(rcs);
    }
  }

  /* ---- fine detail: panel seams, antenna, underwing missile hardpoints ---- */
  for (const z of [-1.6, 0.4, 1.6]) {
    const seam = box(1.55, 0.06, 0.07, 0x9aa4b5, { flat: true });
    seam.position.set(0, 0.735, z);
    hull.add(seam);
  }
  const antenna = cyl(0.035, 0.035, 1.1, 4, STEEL);
  antenna.position.set(-0.5, 1.35, 2.6); hull.add(antenna);
  // pitot tube on the nose + twin ventral strakes (real-fighter silhouette)
  const pitot = cyl(0.025, 0.025, 1.0, 4, STEEL);
  pitot.rotation.x = Math.PI / 2; pitot.position.set(0.22, 0.18, -6.9); hull.add(pitot);
  for (const s of [1, -1]) {
    const strake = box(0.12, 0.6, 1.2, DARKRED, { flat: true });
    strake.position.set(s * 0.55, -0.85, 3.4); strake.rotation.z = s * 0.35; hull.add(strake);
  }
  const antTip = glowSprite(0xff5a6a, 0.45);
  antTip.position.set(-0.5, 1.95, 2.6); hull.add(antTip);
  for (const s of [-1, 1]) for (const hx of [2.1, 3.2]) {
    const msl = cyl(0.09, 0.09, 0.85, 5, PANEL, { flat: true });
    msl.rotation.x = Math.PI / 2; msl.position.set(s * hx, -0.44, 1.35); hull.add(msl);
    const mtip = cone(0.09, 0.26, 5, WING, { flat: true });
    mtip.rotation.x = -Math.PI / 2; mtip.position.set(s * hx, -0.44, 0.8); hull.add(mtip);
  }

  /* ---- anchors for trails ---- */
  const tipL = new THREE.Object3D(); tipL.position.set(5.6, 0.2, 2.7); g.add(tipL);
  const tipR = new THREE.Object3D(); tipR.position.set(-5.6, 0.2, 2.7); g.add(tipR);
  const noseAnchor = new THREE.Object3D(); noseAnchor.position.set(0, 0.02, -7.0); g.add(noseAnchor);

  g.userData = { engineGlow: glowGroup, engineGlows, enginePetals, tipL, tipR, noseAnchor, hull };
  return g;
}

/* ============ ENEMIES ============ */
export function buildDrone(tint = 0x3a4668) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.OctahedronGeometry(1.5, 0), toonMat(tint, { flat: true }));
  body.scale.set(1, 0.62, 1.7);
  g.add(body);
  // dark armour plate + orange sensor cowl on the nose
  const plate = box(1.5, 0.5, 1.6, 0x232a42, { flat: true });
  plate.position.set(0, 0.5, 0.2); g.add(plate);
  const cowl = cone(0.7, 1.5, 5, 0x9a3020, { flat: true });
  cowl.rotation.x = -Math.PI / 2; cowl.position.set(0, 0, -1.9); g.add(cowl);
  for (const s of [1, -1]) {
    const wing = box(2.8, 0.16, 1.2, 0x2a3250, { flat: true });
    wing.position.set(s * 1.9, -0.1, 0.3);
    wing.rotation.z = s * 0.38;
    g.add(wing);
    const wtip = box(0.3, 0.7, 0.9, 0x9a3020, { flat: true });
    wtip.position.set(s * 3.1, 0.15, 0.4); wtip.rotation.z = s * 0.38; g.add(wtip);
  }
  // sinister touches: curved horns + a blood-red underglow
  for (const s of [1, -1]) {
    const horn = cone(0.22, 1.4, 4, 0x1c1420, { flat: true });
    horn.position.set(s * 0.8, 0.9, -1.2); horn.rotation.z = s * -0.55; g.add(horn);
  }
  const under = glowSprite(0xff2030, 1.3); under.position.set(0, -0.9, 0); g.add(under);
  const eye = glowSprite(0xffb02e, 1.6);
  eye.position.set(0, 0, -2.4);
  g.add(eye);
  g.userData.glow = eye;
  return g;
}

export function buildLancer(tint = 0x5e3140) {
  const g = new THREE.Group();
  const body = cone(1.05, 4.8, 6, tint, { flat: true });
  body.rotation.x = -Math.PI / 2;
  g.add(body);
  // fuselage spine + intake ring
  const spine = box(0.7, 0.9, 3.4, 0x3c2030, { flat: true });
  spine.position.set(0, 0.5, 0.6); g.add(spine);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.2, 6, 10), toonMat(0x2a1620, { flat: true }));
  ring.position.set(0, 0, 2.1); g.add(ring);
  for (const s of [1, -1]) {
    // swept forward wings
    const wing = box(3.4, 0.16, 1.5, 0x3c2030, { flat: true });
    wing.position.set(s * 1.8, -0.1, 1.1); wing.rotation.z = s * 0.12; wing.rotation.y = s * -0.3;
    g.add(wing);
    const edge = box(3.2, 0.2, 0.4, tint, { flat: true });
    edge.position.set(s * 1.7, 0, 0.4); edge.rotation.y = s * -0.3; g.add(edge);
    const tip = glowSprite(0xff5560, 1.1);
    tip.position.set(s * 3.3, 0, 1.6); g.add(tip);
  }
  // serrated dorsal blades — predatory silhouette
  for (let i = 0; i < 3; i++) {
    const blade = cone(0.28, 1.1, 4, 0x1c0f18, { flat: true });
    blade.position.set(0, 0.95, -0.6 + i * 0.9); blade.rotation.x = -0.4; g.add(blade);
  }
  const eng = glowSprite(0xff8560, 1.9);
  eng.position.set(0, 0, 2.5);
  g.add(eng);
  g.userData.glow = eng;
  return g;
}

/** spherical pod with orange shell petals + pink core (concept 2) */
export function buildPod() {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 10), toonMat(0x777f8f, { emissive: 0xff3d8f, emissiveIntensity: 1.6 }));
  g.add(core);
  const shellMat = toonMat(0xb56a2e, { flat: true });
  for (let i = 0; i < 4; i++) {
    const petal = new THREE.Mesh(new THREE.SphereGeometry(1.9, 8, 6, 0, Math.PI * 0.62, 0.5, Math.PI * 0.62), shellMat);
    petal.rotation.y = (i / 4) * Math.PI * 2;
    g.add(petal);
  }
  const glow = glowSprite(0xff3d8f, 2.2);
  g.add(glow);
  g.userData.glow = glow;
  return g;
}

export function buildTurret(tint = 0x4a5568) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.2, 2.2, 8), toonMat(tint, { flat: true }));
  base.position.y = 1;
  g.add(base);
  const head = new THREE.Mesh(new THREE.SphereGeometry(1.7, 10, 8), toonMat(0x39445c, { flat: true }));
  head.position.y = 2.8;
  g.add(head);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 3.6, 8), toonMat(0x222b3d));
  barrel.rotation.x = Math.PI / 2.6;
  barrel.position.set(0, 3.4, -1.4);
  g.add(barrel);
  const glow = glowSprite(0xff7040, 1.6);
  glow.position.set(0, 3.5, -2.8);
  g.add(glow);
  g.userData.glow = glow;
  g.userData.barrel = barrel;
  return g;
}

export function buildMine() {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 0), toonMat(0x59324a, { flat: true, emissive: 0xff2244, emissiveIntensity: 0.4 }));
  g.add(core);
  const spikeMat = toonMat(0x2e1c30);
  for (let i = 0; i < 8; i++) {
    const sp = cone(0.34, 1.3, 4, 0x2e1c30);
    sp.material = spikeMat;
    const dir = new THREE.Vector3().setFromSphericalCoords(1.5, Math.acos(1 - 2 * ((i + 0.5) / 8)), i * 2.39996);
    sp.position.copy(dir);
    sp.lookAt(dir.clone().multiplyScalar(2));
    sp.rotateX(Math.PI / 2);
    g.add(sp);
  }
  const glow = glowSprite(0xff2244, 2.0);
  g.add(glow);
  g.userData.glow = glow;
  return g;
}

export function buildRay(tint = 0x3f6d8a) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(1.3, 10, 8), toonMat(tint, { flat: true }));
  body.scale.set(2.6, 0.5, 1.5);
  g.add(body);
  const tail = box(0.24, 0.1, 3.2, tint, { flat: true });
  tail.position.z = 2.4;
  g.add(tail);
  const eye = glowSprite(0x7fe9ff, 1.4);
  eye.position.z = -1.4;
  g.add(eye);
  g.userData.glow = eye;
  g.userData.body = body;
  return g;
}

/* ============ ELITE / RANDOM-SPAWN ENEMIES ============ */

/** GUNSHIP — a proper space BATTLESHIP: long armoured hull, stepped decks,
 *  bridge tower with lit windows, three twin-gun turrets, side armour belts */
export function buildGunship() {
  const g = new THREE.Group();
  const hullMat = toonMat(0x4a2e3a, { flat: true });
  const deckMat = toonMat(0x5c3a46, { flat: true });
  const dark = toonMat(0x2a1a22, { flat: true });
  const gunMat = toonMat(0x1c1218);
  // long hull + wedge bow
  const hull = new THREE.Mesh(new THREE.BoxGeometry(4.6, 2.2, 11), hullMat); g.add(hull);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(1.9, 4.5, 4), hullMat);
  bow.rotation.x = -Math.PI / 2; bow.rotation.y = Math.PI / 4; bow.position.z = -7.5; g.add(bow);
  // stepped upper deck + bridge tower with lit windows
  const deck = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.0, 7), deckMat); deck.position.set(0, 1.5, 0.8); g.add(deck);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.6, 2.0), dark); bridge.position.set(0, 2.7, 2.6); g.add(bridge);
  const bridgeWin = box(1.5, 0.28, 0.1, 0x0f2030, { emissive: 0x8fe6ff, emissiveIntensity: 1.6 });
  bridgeWin.position.set(0, 2.9, 1.55); g.add(bridgeWin);
  // three twin-gun turrets down the spine (bow-facing)
  for (const [tz, ty] of [[-3.4, 1.4], [-0.6, 2.3], [3.4, 1.4]]) {
    const tur = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.7, 8), dark);
    tur.position.set(0, ty + 0.3, tz); g.add(tur);
    for (const s of [0.3, -0.3]) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 2.2, 5), gunMat);
      bar.rotation.x = Math.PI / 2; bar.position.set(s, ty + 0.45, tz - 1.4); g.add(bar);
    }
  }
  // side armour belts, running lights, twin engines
  for (const s of [1, -1]) {
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.2, 9), dark); belt.position.set(s * 2.5, -0.2, 0); g.add(belt);
    for (let i = 0; i < 3; i++) { const l = glowSprite(0xff5030, 0.7); l.position.set(s * 2.8, 0.2, -3 + i * 3); g.add(l); }
    const eng = glowSprite(0xff8a3e, 2.2); eng.position.set(s * 1.2, 0, 6.2); g.add(eng);
  }
  // menacing ram spike on the bow + hellish red glow
  const ram = new THREE.Mesh(new THREE.ConeGeometry(0.55, 3.4, 4), toonMat(0x14090e, { flat: true }));
  ram.rotation.x = -Math.PI / 2; ram.position.z = -10.6; g.add(ram);
  const eye = glowSprite(0xff3040, 2.4); eye.position.set(0, 0.4, -9.2); g.add(eye);
  g.userData.glow = eye;
  return g;
}

/** SAUCER — classic disc UFO: layered rim, glass dome, rotating rim lights */
export function buildSaucer() {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 0.55, 24), toonMat(0x6a7488, { flat: true }));
  g.add(disc);
  const rimTop = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.3, 0.6, 24), toonMat(0x59657f, { flat: true }));
  rimTop.position.y = 0.55; g.add(rimTop);
  const rimBot = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 1.8, 0.7, 24), toonMat(0x454f66, { flat: true }));
  rimBot.position.y = -0.6; g.add(rimBot);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1.3, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
    toonMat(0x9fe8d8, { emissive: 0x3fd0a8, emissiveIntensity: 0.9, transparent: true, opacity: 0.9 }));
  dome.position.y = 0.8; g.add(dome);
  const lights = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const l = glowSprite(i % 2 ? 0xffd66b : 0x7fe9ff, 1.1);
    l.position.set(Math.cos(a) * 3.0, 0, Math.sin(a) * 3.0); lights.add(l);
  }
  g.add(lights);
  const beam = glowSprite(0x8fffe0, 2.6); beam.position.y = -1.4; g.add(beam);
  g.userData.glow = beam; g.userData.lights = lights;
  return g;
}

/** CARRIER — attack mothership: flight deck, tower island, glowing launch bay */
export function buildCarrier() {
  const g = new THREE.Group();
  const hullMat = toonMat(0x3a4458, { flat: true });
  const dark = toonMat(0x232a3a, { flat: true });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(6.5, 2.6, 13), hullMat); g.add(hull);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.5, 13.5), dark); deck.position.y = 1.55; g.add(deck);
  const stripe = box(0.5, 0.07, 12.5, 0xffd66b, { emissive: 0xaa8020, emissiveIntensity: 0.6 });
  stripe.position.y = 1.86; g.add(stripe);
  const island = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.2, 3.2), hullMat); island.position.set(2.4, 2.9, 2.5); g.add(island);
  const islWin = box(1.3, 0.28, 0.1, 0x0f2030, { emissive: 0x8fe6ff, emissiveIntensity: 1.6 });
  islWin.position.set(2.4, 3.4, 0.85); g.add(islWin);
  // glowing hangar maw at the bow — fighters launch from here
  const bayGlow = box(3.6, 1.4, 0.3, 0x101820, { emissive: 0xff9e4a, emissiveIntensity: 1.8 });
  bayGlow.position.set(0, -0.1, -6.6); g.add(bayGlow);
  for (const s of [1, -1]) {
    const spon = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, 8), dark); spon.position.set(s * 3.8, -0.5, 1); g.add(spon);
    const eng = glowSprite(0x7fb0ff, 2.0); eng.position.set(s * 2.2, -0.2, 7); g.add(eng);
    for (let i = 0; i < 4; i++) { const l = glowSprite(0x8fe6ff, 0.6); l.position.set(s * 3.9, 0.6, -4 + i * 3); g.add(l); }
  }
  const glow = glowSprite(0xff9e4a, 2.6); glow.position.set(0, -0.1, -7.1); g.add(glow);
  g.userData.glow = glow;
  return g;
}

/** AEGIS SIEGE CARRIER — armoured fleet command ship with deployable escort bays. */
export function buildSiegeCarrier() {
  const g = new THREE.Group();
  // Dreadwing is a screen-scale contact. Its principal armour uses a small
  // unlit tactical-paint palette so the silhouette remains blue-grey and its
  // deck sections remain legible even on WebGL drivers that under-light toon
  // materials during HDRI or fog transitions.
  const tacticalPaint = (color) => new THREE.MeshBasicMaterial({ color, fog: true });
  const hull = tacticalPaint(0x7898c8);
  const armour = tacticalPaint(0x405778);
  const trim = tacticalPaint(0x9dbce5);
  const core = toonMat(0x34243a, { emissive: 0xff4b28, emissiveIntensity: 1.3, flat: true });
  // Long, three-tier hull reads as a capital ship without dense geometry.
  const keel = new THREE.Mesh(new THREE.BoxGeometry(8.8, 2.9, 17.8), hull); keel.position.y = -0.3; g.add(keel);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(10.2, 0.55, 18.8), armour); deck.position.y = 1.52; g.add(deck);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.7, 4.6), trim); bridge.position.set(2.8, 3.0, 2.1); g.add(bridge);
  const bridgeGlass = box(2.6, 0.42, 0.12, 0x112033, { emissive: 0x70dfff, emissiveIntensity: 1.7 });
  bridgeGlass.position.set(2.8, 3.45, -0.24); g.add(bridgeGlass);
  const spine = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.0, 15.5), trim); spine.position.set(0, 2.0, 0); g.add(spine);
  // Armour slabs leave gaps between plates, making the broad hull readable at range.
  for (const s of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const plate = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.55, 3.25), armour);
      plate.position.set(s * 5.0, 0.1, -5.9 + i * 4.0); g.add(plate);
      const seam = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.10, 2.55), tacticalPaint(0xbed7f3));
      seam.position.set(s * 5.78, 0.13, -5.9 + i * 4.0); g.add(seam);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 2.7), tacticalPaint(0x7f9fca));
      rail.position.set(s * 5.78, 0.75, -5.9 + i * 4.0); g.add(rail);
    }
    const pod = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.55, 7.8), trim); pod.position.set(s * 5.3, 0.3, 2.0); g.add(pod);
    const engine = glowSprite(0x8db9ff, 2.7); engine.position.set(s * 2.8, -0.2, 9.3); g.add(engine);
    for (const z of [-4.4, 1.2, 5.6]) {
      const lamp = glowSprite(0xff6a42, 0.85); lamp.position.set(s * 5.95, 1.15, z); g.add(lamp);
    }
  }
  // Twin bow apertures telegraph the heavy broadside; central bay telegraphs escorts.
  for (const s of [-1, 1]) {
    const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.55, 4.2, 6), armour);
    gun.rotation.x = Math.PI / 2; gun.position.set(s * 3.25, 0.85, -10.5); g.add(gun);
  }
  const bay = box(4.6, 1.8, 0.35, 0x121925, { emissive: 0xff5935, emissiveIntensity: 1.8 });
  bay.position.set(0, -0.05, -9.25); g.add(bay);
  const bayGlow = glowSprite(0xff5a36, 3.5); bayGlow.position.set(0, -0.05, -9.6); g.add(bayGlow);
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 4.2, 6), trim); antenna.position.set(-2.0, 5.0, 2.2); g.add(antenna);
  const dish = new THREE.Mesh(new THREE.ConeGeometry(0.9, 0.35, 10), trim); dish.rotation.x = Math.PI; dish.position.set(-2.0, 7.0, 2.2); g.add(dish);
  const commandEye = glowSprite(0xffd36a, 2.0); commandEye.position.set(0, 2.25, -9.65); g.add(commandEye);
  // The bespoke capital hull does not pass through the GLTF loader, so attach the
  // same role-readable combat kit explicitly to retain parity with imported heavies.
  addCombatFrame(g, 'dreadwing', MODEL_DEFS.dreadwing);
  g.userData.glow = bayGlow;
  return g;
}

/** SEEKER — sleek fast interceptor that homes on the player */
export function buildSeeker() {
  const g = new THREE.Group();
  const bodyMat = toonMat(0x2a3f66, { flat: true });
  const body = new THREE.Mesh(new THREE.OctahedronGeometry(1.6, 0), bodyMat);
  body.scale.set(0.8, 0.7, 2.2); g.add(body);
  const nose = cone(0.7, 2.6, 4, 0x9be23a, { emissive: 0x6bbf20, emissiveIntensity: 0.5, flat: true });
  nose.rotation.x = -Math.PI / 2; nose.position.z = -2.4; g.add(nose);
  for (const s of [1, -1]) {
    const wing = box(3.0, 0.16, 1.4, 0x203050, { flat: true });
    wing.position.set(s * 1.9, 0, 0.6); wing.rotation.z = s * 0.5; wing.rotation.y = s * 0.3;
    g.add(wing);
    const tip = glowSprite(0x9be23a, 0.9); tip.position.set(s * 3.4, 0.3, 0.9); g.add(tip);
  }
  const eng = glowSprite(0x8bffe0, 1.9); eng.position.z = 2.3; g.add(eng);
  g.userData.glow = eng;
  return g;
}

/** SNIPER — hovering weapons rig with a long barrel and a targeting eye */
export function buildSniper() {
  const g = new THREE.Group();
  const coreMat = toonMat(0x394d63, { flat: true });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.8, 0), coreMat);
  g.add(core);
  // rotating outer ring of plates
  const ring = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const plate = box(0.5, 1.6, 1.2, 0x2a3a4e, { flat: true });
    const a = (i / 5) * Math.PI * 2;
    plate.position.set(Math.cos(a) * 2.4, Math.sin(a) * 2.4, 0);
    plate.rotation.z = a; ring.add(plate);
  }
  g.add(ring);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.5, 5.5, 8), toonMat(0x161e28));
  barrel.rotation.x = Math.PI / 2; barrel.position.z = -2.4; g.add(barrel);
  const eye = glowSprite(0x59c6ff, 2.0); eye.position.z = -0.3; g.add(eye);
  g.userData.glow = eye;
  g.userData.ring = ring;
  return g;
}

/** STRAFER — dart-shaped assault fighter that screams across the field */
export function buildStrafer(tint = 0x7a3350) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.OctahedronGeometry(1.4, 0), toonMat(tint, { flat: true }));
  body.scale.set(0.68, 0.7, 2.6); g.add(body);
  const nose = cone(0.55, 3.0, 4, 0xffb02e, { emissive: 0xff6a10, emissiveIntensity: 0.5, flat: true });
  nose.rotation.x = -Math.PI / 2; nose.position.z = -2.6; g.add(nose);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), toonMat(0x2f9fd4, { emissive: 0x1a6fa0, emissiveIntensity: 0.8 }));
  canopy.scale.set(0.9, 0.8, 1.4); canopy.position.set(0, 0.5, -0.6); g.add(canopy);
  for (const s of [1, -1]) {
    const wing = box(2.6, 0.14, 1.3, 0x3a1c2c, { flat: true });
    wing.position.set(s * 1.7, 0, 0.2); wing.rotation.z = s * -0.28; wing.rotation.y = s * 0.42; g.add(wing);
    const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 1.8, 6), toonMat(0x161016));
    cannon.rotation.x = Math.PI / 2; cannon.position.set(s * 1.5, -0.1, -1.4); g.add(cannon);
    const tip = glowSprite(0xff5560, 0.8); tip.position.set(s * 3.0, 0.1, 0.6); g.add(tip);
  }
  const eng = glowSprite(0xff8560, 2.0); eng.position.z = 2.6; g.add(eng);
  g.userData.glow = eng;
  return g;
}

/** BOMBER — heavy wide air unit, belly bomb-bays, slow and menacing */
export function buildBomber(tint = 0x394055) {
  const g = new THREE.Group();
  const hull = box(6.6, 2.0, 4.2, tint, { flat: true }); g.add(hull);
  const belly = box(4.4, 1.2, 3.0, 0x232838, { flat: true }); belly.position.y = -1.2; g.add(belly);
  const nose = cone(1.6, 3.0, 5, tint, { flat: true }); nose.rotation.x = -Math.PI / 2; nose.position.z = -3.4; g.add(nose);
  for (const s of [1, -1]) {
    const wing = box(5.5, 0.5, 2.3, 0x2c3346, { flat: true }); wing.position.set(s * 4.4, 0, 0.4); wing.rotation.z = s * 0.06; g.add(wing);
    const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 2.0, 8), toonMat(0x1a1e2a)); eng.rotation.x = Math.PI / 2; eng.position.set(s * 4.4, -0.4, 2.4); g.add(eng);
    const glow = glowSprite(0xff8a3e, 2.2); glow.position.set(s * 4.4, -0.4, 3.6); g.add(glow);
    const bay = glowSprite(0xff3d8f, 1.7); bay.position.set(s * 1.3, -1.9, 0); g.add(bay);
  }
  const eye = glowSprite(0xff5040, 2.4); eye.position.set(0, 0.6, -4.0); g.add(eye);
  g.userData.glow = eye;
  return g;
}

/** FLAK — ground AA emplacement: armoured base + tracking quad-barrel head */
export function buildFlak() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.6, 2.4, 8), toonMat(0x4a4030, { flat: true }));
  base.position.y = 1.2; g.add(base);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.6, 10), toonMat(0x2c2820, { flat: true }));
  collar.position.y = 2.5; g.add(collar);
  const head = new THREE.Group(); head.position.y = 3.0; g.add(head);
  head.add(box(2.6, 1.4, 2.6, 0x5a4a34, { flat: true }));
  for (const sx of [0.7, -0.7]) for (const sz of [0.5, -0.5]) {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 2.8, 6), toonMat(0x1c1810));
    barrel.position.set(sx, 1.2, sz); barrel.rotation.x = -0.5; head.add(barrel);
  }
  const glow = glowSprite(0xffb030, 1.8); glow.position.set(0, 2.3, -0.6); head.add(glow);
  g.userData.glow = glow; g.userData.head = head;
  return g;
}

/** HOVERTANK — ground hover vehicle: skirted hull, thruster glow, top turret */
/**
 * AEGIS AA BATTERY — a fixed ground interception base with a broad armoured
 * plinth, tracking sensor dish, dual elevated barrels and protected missile cells.
 * The base is intentionally wider than a turret so it reads as a strategic target.
 */
export function buildAABattery() {
  const g = new THREE.Group();
  const armour = toonMat(0x3d4147, { flat: true });
  const armourLight = toonMat(0x596064, { flat: true });
  const dark = toonMat(0x191d23, { flat: true });
  const warning = toonMat(0x2a1d1c, { emissive: 0xff6438, emissiveIntensity: 1.10, flat: true });
  const sensorMat = toonMat(0x17212a, { emissive: 0xff9a46, emissiveIntensity: 1.45, flat: true });

  const foundation = new THREE.Mesh(new THREE.CylinderGeometry(7.4, 9.2, 2.6, 8), dark);
  foundation.position.y = 1.3; g.add(foundation);
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(6.3, 7.5, 2.2, 8), armour);
  plinth.position.y = 3.55; g.add(plinth);
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(5.35, 6.25, 1.05, 10), armourLight);
  deck.position.y = 5.15; g.add(deck);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU;
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.24, 6), warning);
    bolt.rotation.x = Math.PI / 2; bolt.position.set(Math.cos(a) * 6.8, 2.75, Math.sin(a) * 6.8); g.add(bolt);
  }

  const head = new THREE.Group(); head.position.y = 5.55; g.add(head);
  const housing = new THREE.Mesh(new THREE.BoxGeometry(6.7, 2.35, 5.4), armour);
  housing.position.y = 1.35; head.add(housing);
  const yoke = new THREE.Mesh(new THREE.CylinderGeometry(2.35, 2.7, 1.4, 10), dark);
  yoke.position.y = 2.55; head.add(yoke);
  const sensor = new THREE.Mesh(new THREE.SphereGeometry(1.32, 10, 7), sensorMat);
  sensor.scale.set(1.0, 0.76, 0.58); sensor.position.set(0, 3.25, -2.72); head.add(sensor);
  const sensorHalo = new THREE.Mesh(new THREE.TorusGeometry(1.66, 0.14, 5, 12), warning);
  sensorHalo.rotation.x = Math.PI / 2; sensorHalo.position.set(0, 3.25, -2.87); head.add(sensorHalo);

  for (const side of [-1, 1]) {
    const mount = new THREE.Mesh(new THREE.BoxGeometry(1.45, 1.7, 3.2), armourLight);
    mount.position.set(side * 2.28, 2.45, -0.8); head.add(mount);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.45, 7.8, 7), dark);
    barrel.rotation.x = Math.PI * 0.68; barrel.position.set(side * 2.28, 4.38, -3.55); head.add(barrel);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.55, 7), warning);
    collar.rotation.x = Math.PI * 0.68; collar.position.set(side * 2.28, 4.92, -4.48); head.add(collar);
  }
  const muzzle = new THREE.Group(); muzzle.position.set(0, 6.65, -6.3); head.add(muzzle);

  const radar = new THREE.Group(); radar.position.set(0, 4.0, 1.25); head.add(radar);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.34, 4.6, 7), armourLight);
  mast.position.y = 2.2; radar.add(mast);
  const dish = new THREE.Mesh(new THREE.TorusGeometry(2.45, 0.23, 5, 14), warning);
  dish.rotation.x = Math.PI / 2; dish.position.y = 4.5; radar.add(dish);
  const dishCore = new THREE.Mesh(new THREE.CircleGeometry(1.85, 12), sensorMat);
  dishCore.position.set(0, 4.5, -0.08); radar.add(dishCore);

  for (const side of [-1, 1]) {
    const cell = new THREE.Mesh(new THREE.BoxGeometry(2.45, 3.4, 3.0), dark);
    cell.position.set(side * 5.45, 4.4, 1.0); g.add(cell);
    for (let i = 0; i < 3; i++) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.28, 6), warning);
      cap.rotation.x = Math.PI / 2; cap.position.set(side * 5.45 + (i - 1) * 0.68, 5.15, -0.58); g.add(cap);
    }
  }
  const glow = glowSprite(0xff7a42, 2.6); glow.position.set(0, 8.8, -3.0); head.add(glow);
  g.userData.glow = glow; g.userData.head = head; g.userData.radar = radar;
  g.userData.sensorMat = sensorMat; g.userData.muzzle = muzzle;
  return g;
}

export function buildHovertank() {
  const g = new THREE.Group();
  g.add((() => { const s = box(5.2, 0.8, 6.4, 0x1e262c, { flat: true }); s.position.y = 1.4; return s; })());
  const hull = box(4.6, 1.4, 6.0, 0x354048, { flat: true }); hull.position.y = 2.2; g.add(hull);
  for (const sx of [1, -1]) for (const sz of [-2, 2]) {
    const th = glowSprite(0x59c6ff, 1.4); th.position.set(sx * 1.9, 0.9, sz); g.add(th);
  }
  const turret = new THREE.Group(); turret.position.set(0, 3.2, 0); g.add(turret);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1.3, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), toonMat(0x445058, { flat: true })); turret.add(dome);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.32, 3.2, 7), toonMat(0x14181c)); barrel.rotation.x = Math.PI / 2; barrel.position.z = -1.6; turret.add(barrel);
  const eye = glowSprite(0xff6a3e, 1.6); eye.position.set(0, 0.4, -0.6); turret.add(eye);
  g.userData.glow = eye; g.userData.turret = turret;
  return g;
}

/** LAUNCHER — ground missile battery: base + angled rack of glowing tubes */
export function buildLauncher() {
  const g = new THREE.Group();
  const base = box(3.4, 1.6, 4.0, 0x3c4634, { flat: true }); base.position.y = 0.8; g.add(base);
  const rack = new THREE.Group(); rack.position.set(0, 1.9, 0.4); rack.rotation.x = -0.7; g.add(rack);
  rack.add(box(3.0, 1.6, 2.2, 0x2a3226, { flat: true }));
  for (const sx of [1, -1]) for (const sy of [0.5, -0.5]) {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 2.4, 7), toonMat(0x20261c));
    tube.rotation.x = Math.PI / 2; tube.position.set(sx * 0.8, sy, -0.6); rack.add(tube);
    const tip = glowSprite(0xff7a3a, 0.9); tip.position.set(sx * 0.8, sy, -1.8); rack.add(tip);
  }
  const glow = glowSprite(0xffa030, 1.4); glow.position.set(0, 2.0, 0.4); g.add(glow);
  g.userData.glow = glow; g.userData.rack = rack;
  return g;
}
