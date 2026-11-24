import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { toonMat, dotTexture, loadDetailTexture, clamp, TAU } from '../core/util.js';

/* ---- Real CC0 3D models for enemy types (Quaternius Ultimate Spaceships,
 * Quaternius Sci-Fi Essentials, Kenney Space/Pirate Kits, Sky Talon).
 * Loaded once, normalised (centred + scaled to `size`; fighters rotated nose to
 * -z; ground models rest their base at y=0), preserving authored textures and
 * vibrant materials so close-quarters combat looks sharp and detailed. ---- */
export const SHIP_MODELS = {};

const MODEL_DEFS = {
  // Grunts & interceptors — enlarged ~1.25x for bold, visceral close-range dogfights
  drone:       { path: 'props/craft_racer',            size: 12.2, glow: 0xff8a4c },
  lancer:      { path: 'props/craft_speedera',         size: 14.8, glow: 0xff5252 },
  ray:         { path: 'props/craft_speederb',         size: 15.8, glow: 0x5ae8ff },
  // Elites — detailed Quaternius & Sci-Fi Essentials fighters (nose faces -z)
  strafer:     { path: 'ships/striker',                size: 18.0, rotY: Math.PI, glow: 0xff7b4d },
  seeker:      { path: 'ships/zenith',                 size: 17.0, rotY: Math.PI, glow: 0x72ffc8 },
  sniper:      { path: 'ships/omen',                   size: 17.6, rotY: Math.PI, glow: 0x59c6ff },
  bomber:      { path: 'ships/dispatcher',             size: 23.0, rotY: Math.PI, glow: 0xff8533 },
  skyraider:   { path: 'external/aero_airship',        size: 28.5, rotY: Math.PI, glow: 0xff9a4c },
  relaydrone:  { path: 'external/scifi_drone',         size: 15.2, rotY: Math.PI, glow: 0xff45a8 },
  gunship:     { path: 'ships/executioner',            size: 25.5, rotY: Math.PI, glow: 0xff4930 },
  carrier:     { path: 'ships/imperial',               size: 30.0, rotY: Math.PI, glow: 0xff9e4a },
  saucer:      { path: 'ships/pancake',                size: 19.5, rotY: Math.PI, glow: 0x80ffe4 },
  // Iconic procedural concept-art pod (armoured petals + hot magenta core) & spiked mine
  pod:         { path: 'props/machine_wireless',       size: 13.6, glow: 0xff3d8f, procedural: true },
  mine:        { path: 'debris/crystals',              size: 10.2, glow: 0xff2848, procedural: true },
  // Ground & surface units — big enough to read clearly from flight altitude
  turret:      { path: 'props/turret_single',          size: 13.2, ground: true },
  flak:        { path: 'props/turret_double',          size: 16.5, ground: true },
  hovertank:   { path: 'props/craft_speederb',         size: 18.2, ground: true },
  launcher:    { path: 'props/rocket_basea',           size: 16.5, ground: true },
  // Expansion pack — Quaternius Sci-Fi Essentials + Ultimate Space Kit + Kenney Pirate Kit
  scout:       { path: 'expansion/Enemy_EyeDrone',     ext: 'gltf', size: 17.4, rotY: Math.PI, glow: 0xff485e },
  fighter:     { path: 'expansion/Enemy_Flying',       ext: 'gltf', size: 21.4, rotY: Math.PI, glow: 0xff8638 },
  skytalon:    { path: 'external/sky_talon',           ext: 'glb',  size: 20.0, rotY: Math.PI, glow: 0xffbe4d, tint: 0xd94834 },
  harrier:     { path: 'ships/challenger',             size: 20.4, rotY: Math.PI, glow: 0xff4868 },
  phantom:     { path: 'ships/spitfire',               size: 19.2, rotY: Math.PI, glow: 0x9d72ff },
  dreadwing:   { path: 'ships/insurgent',              size: 31.5, rotY: Math.PI, glow: 0xb082ff, procedural: true },
  quadtank:    { path: 'expansion/Enemy_QuadShell',    ext: 'gltf', size: 20.5, rotY: Math.PI, ground: true },
  trilobite:   { path: 'expansion/Enemy_Trilobite',    ext: 'gltf', size: 21.5, rotY: Math.PI, ground: true },
  mech:        { path: 'expansion/Enemy_Large',        ext: 'gltf', size: 26.5, rotY: Math.PI, ground: true },
  cannon:      { path: 'expansion/cannon-mobile',      ext: 'glb',  size: 14.8, ground: true },
  shorecannon: { path: 'expansion/cannon',             ext: 'glb',  size: 13.8, ground: true },
  gunboat:     { path: 'expansion/ship-large',         ext: 'glb',  size: 37.5, ground: true },
  frigate:     { path: 'expansion/ship-pirate-large',  ext: 'glb',  size: 47.5, ground: true },
};

/**
 * Normalise imported GLTF/GLB materials so authored textures stay crisp and
 * high-metalness kit assets never collapse into black silhouettes.
 */
export function normalizeImportedMaterial(material, opts = {}) {
  if (!material) return;
  material.fog = true;
  material.side = THREE.DoubleSide;
  if (material.map) {
    material.map.colorSpace = THREE.SRGBColorSpace;
    material.map.anisotropy = 4;
  }
  if ('roughness' in material) {
    material.roughness = clamp(material.roughness ?? 0.56, 0.36, 0.76);
  }
  if ('metalness' in material) {
    // Kenney Space Kit exports metalness=1.0 on diffuse metal parts; cap it so
    // directional + hemisphere + procedural PMREM lighting reads brightly.
    material.metalness = Math.min(material.metalness ?? 0.25, 0.34);
  }
  if (material.metalnessMap) {
    // Packed ORM maps can darken specular responses under stylised lighting.
    material.metalness = Math.min(material.metalness, 0.26);
  }
  if (material.color) {
    if (opts.tint) {
      material.color.lerp(new THREE.Color(opts.tint), opts.tintStrength ?? 0.34);
    }
    const lum = 0.299 * material.color.r + 0.587 * material.color.g + 0.114 * material.color.b;
    if (!material.map && lum < 0.08) {
      // Lift near-black untextured hull surfaces (linear space) to readable tactical slate.
      material.color.lerp(new THREE.Color(0x8899b4), 0.65);
    }
  }
  if (material.emissive) {
    const emLum = 0.299 * material.emissive.r + 0.587 * material.emissive.g + 0.114 * material.emissive.b;
    if (emLum < 0.08) {
      if (material.map) {
        // Textured hulls get a subtle cool-neutral fill floor while retaining map contrast.
        material.emissive.setHex(opts.texturedEmissive ?? 0x1e2536);
        material.emissiveIntensity = opts.emissiveFloor ?? 0.42;
      } else if (material.color) {
        material.emissive.copy(material.color).multiplyScalar(opts.emissiveFloor ?? 0.16);
        material.emissiveIntensity = 1.0;
      }
    }
  }
  material.needsUpdate = true;
}

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
        if (o.geometry) o.geometry.userData.shared = true;
        for (const material of (Array.isArray(o.material) ? o.material : [o.material])) {
          normalizeImportedMaterial(material, { tint: def.tint, tintStrength: 0.36 });
          if (material) material.userData.shared = true;
        }
      });
      const box = new THREE.Box3().setFromObject(obj);
      const c = box.getCenter(new THREE.Vector3());
      const dim = box.getSize(new THREE.Vector3());
      const s = def.size / (Math.max(dim.x, dim.y, dim.z) || 1);
      obj.scale.setScalar(s);
      obj.position.set(-c.x * s, def.ground ? -box.min.y * s : -c.y * s, -c.z * s);
      const spin = new THREE.Group();
      spin.rotation.y = def.rotY || 0;
      spin.add(obj);
      const wrap = new THREE.Group();
      wrap.add(spin);
      if (def.glow) {
        const gl = glowSprite(def.glow, def.size * 0.36, 0.88);
        gl.position.set(0, 0, def.size * 0.34);
        wrap.add(gl);
        wrap.userData.glow = gl;
      }
      addCombatFrame(wrap, type, def);
      SHIP_MODELS[type] = wrap;
    });
  }
}

// Brushed-metal panel grain for hero hull surfaces (CC0)
const metalTex = loadDetailTexture('./assets/textures/metal_diff.jpg', { repeat: 1.5, brightness: 1.95, contrast: 0.45, desat: 0.7 });

const WHITE = 0xf2f5fa, PANEL = 0xdbe2ec, RED = 0xdc3230, DARKRED = 0x941f22,
  NAVY = 0x26314c, DARKNAVY = 0x171f33, STEEL = 0x5c6b88, CANOPY = 0x2ca8e0, ENGINE = 0x52e0ff;

function box(w, h, d, color, opts) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), toonMat(color, opts)); }
function cone(r, h, seg, color, opts) { return new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), toonMat(color, opts)); }
function cyl(rt, rb, h, seg, color, opts) { return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), toonMat(color, opts)); }

/** Tapered aerospace wedge prism: front face (-Z) narrows/bevels into back face (+Z). */
function taperBox(wf, hf, wb, hb, len, color, opts = {}) {
  const geo = new THREE.BoxGeometry(1, 1, len, 1, 1, 1);
  const pos = geo.attributes.position;
  const topPinch = opts.topPinch ?? 0.82;
  const botPinch = opts.botPinch ?? 0.92;
  const yShiftFront = opts.yShiftFront ?? 0;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const isFront = z < 0;
    const w = isFront ? wf : wb;
    const h = isFront ? hf : hb;
    const pinch = y > 0 ? topPinch : botPinch;
    pos.setX(i, x * w * pinch);
    pos.setY(i, y * h + (isFront ? yShiftFront : 0));
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, toonMat(color, { flat: true, ...opts }));
}

function glowSprite(color, size, opacity = 0.95) {
  const m = new THREE.Sprite(new THREE.SpriteMaterial({
    map: dotTexture(), color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  m.scale.setScalar(size);
  return m;
}

/** Layered 3D additive plasma jet cone (outer coloured sheath + white-hot inner flame). */
function buildThrusterPlume(color, radius, length, name = 'thrusterPlume') {
  const g = new THREE.Group();
  g.name = name;
  const outerGeo = new THREE.ConeGeometry(radius, length, 8, 1, true);
  outerGeo.translate(0, -length * 0.5, 0);
  outerGeo.rotateX(-Math.PI / 2);
  const outerMat = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0.62, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  const outer = new THREE.Mesh(outerGeo, outerMat);

  const innerGeo = new THREE.ConeGeometry(radius * 0.52, length * 0.68, 7, 1, true);
  innerGeo.translate(0, -length * 0.34, 0);
  innerGeo.rotateX(-Math.PI / 2);
  const innerMat = new THREE.MeshBasicMaterial({
    color: 0xf4fcff, transparent: true, opacity: 0.88, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  const inner = new THREE.Mesh(innerGeo, innerMat);
  g.add(outer, inner);
  g.userData.outerMat = outerMat;
  return g;
}

/**
 * Sleek, hull-hugging combat kit for imported enemies:
 * - Volumetric 3D thruster flame cones (instant orientation, speed & hostile IFF read)
 * - Clean forward targeting ring + weapon charge tips (clear firing telegraph)
 * - Wingtip navigation strobes & battle-damage warning/smoke nodes
 * Replaces boxy overlapping slabs so the imported GLTF hulls shine cleanly.
 */
function addCombatFrame(wrap, type, def) {
  if (!def.glow) return;
  const s = def.size;
  const heavy = new Set(['bomber', 'gunship', 'carrier', 'skyraider', 'dreadwing']);
  const artillery = new Set(['sniper', 'bomber', 'gunship', 'carrier', 'skyraider', 'dreadwing']);
  const frame = new THREE.Group();
  frame.name = 'combatFrame';
  const accent = def.glow;
  const dark = 0x192336;
  const scale = heavy.has(type) ? 1.0 : 0.78;

  // Sleek forward targeting ring — glows brightly right before firing.
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(s * 0.13 * scale, s * 0.013 * scale, 5, 14),
    toonMat(dark, { emissive: accent, emissiveIntensity: 0.85, flat: true })
  );
  ring.name = 'combatSensorRing';
  ring.position.z = -s * 0.38;
  frame.add(ring);

  // Compact underwing weapon charge cores (telegraph incoming enemy fire).
  const hardpoints = heavy.has(type) ? [-0.28, -0.10, 0.10, 0.28] : [-0.22, 0.22];
  for (const x of hardpoints) {
    const tip = glowSprite(artillery.has(type) ? 0xffae52 : accent, s * 0.13 * scale, 0.65);
    tip.name = 'combatWeaponGlow';
    tip.position.set(x * s, -s * 0.04, -s * 0.34);
    frame.add(tip);
  }

  // Layered 3D thruster nozzles + volumetric flame plumes trailing behind (+Z).
  const engineGlows = [];
  const engineCollars = [];
  const enginePlumes = [];
  const engineCount = heavy.has(type) ? 4 : 2;
  for (let i = 0; i < engineCount; i++) {
    const x = engineCount === 2 ? (i ? 0.16 : -0.16) * s : (-0.27 + i * 0.18) * s;
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(s * 0.052 * scale, s * 0.011 * scale, 5, 10),
      toonMat(0x283448, { emissive: accent, emissiveIntensity: 0.65, flat: true })
    );
    collar.name = 'combatEngineCollar';
    collar.position.set(x, -s * 0.02 * scale, s * 0.42);
    frame.add(collar);

    const plume = buildThrusterPlume(accent, s * (heavy.has(type) ? 0.068 : 0.062) * scale, s * (heavy.has(type) ? 0.42 : 0.48) * scale, 'combatEnginePlume');
    plume.position.set(x, -s * 0.02 * scale, s * 0.43);
    frame.add(plume);

    const exhaust = glowSprite(accent, s * (heavy.has(type) ? 0.20 : 0.17) * scale, 0.90);
    exhaust.name = 'combatEngineGlow';
    exhaust.position.set(x, -s * 0.02 * scale, s * 0.46);
    frame.add(exhaust);
    engineGlows.push(exhaust);
    engineCollars.push(collar);
    enginePlumes.push(plume);
  }

  // Wingtip strobe diodes + battle-damage caution beacons & smoke anchor.
  const warningLights = [];
  for (const side of [-1, 1]) {
    const strobe = glowSprite(0xff5a68, s * 0.095 * scale, 0.55);
    strobe.position.set(side * s * 0.44, s * 0.02, s * 0.04);
    frame.add(strobe);

    const warning = glowSprite(0xff6b38, s * 0.12 * scale, 0.12);
    warning.name = 'combatWarningLight';
    warning.position.set(side * s * 0.26 * scale, s * 0.11 * scale, -s * 0.04);
    frame.add(warning);
    warningLights.push(warning);
  }
  const damageSmoke = new THREE.Sprite(new THREE.SpriteMaterial({
    map: dotTexture(), color: 0x3b221e, transparent: true, opacity: 0, depthWrite: false,
  }));
  damageSmoke.name = 'combatDamageSmoke';
  damageSmoke.position.set(0, s * 0.24 * scale, s * 0.06);
  damageSmoke.scale.set(s * 0.48, s * 0.62, 1);
  frame.add(damageSmoke);

  // Heavy ships keep a clean dorsal reactor core & energy halo for silhouette scale.
  if (heavy.has(type)) {
    const reactor = new THREE.Mesh(
      new THREE.IcosahedronGeometry(s * 0.075, 1),
      toonMat(0x182337, { emissive: accent, emissiveIntensity: 1.25, flat: true })
    );
    reactor.name = 'combatReactorCore';
    reactor.position.set(0, s * 0.14, s * 0.14);
    frame.add(reactor);

    const reactorHalo = new THREE.Mesh(
      new THREE.TorusGeometry(s * 0.115, s * 0.013, 5, 14),
      toonMat(0x25334c, { emissive: accent, emissiveIntensity: 0.65, flat: true })
    );
    reactorHalo.name = 'combatReactorHalo';
    reactorHalo.rotation.x = Math.PI / 2;
    reactorHalo.position.copy(reactor.position);
    frame.add(reactorHalo);
  }

  frame.userData.visual = { engineGlows, engineCollars, enginePlumes, warningLights, damageSmoke, accent };
  wrap.add(frame);
  wrap.userData.combatFrame = frame;
  wrap.userData.combatVisual = frame.userData.visual;
}

/* ============ PLAYER ARWING & SQUADRON VARIANTS (Hero / Hunter / Escort / Ace / Rival) ============ */
export function buildArwing(opts = {}) {
  const variant = opts.variant ?? 'hero';
  const isRival = variant === 'rival';
  const WING = opts.wing ?? RED;
  const DARKWING = opts.darkWing ?? (isRival ? 0x10111a : DARKRED);
  const ENG = opts.engine ?? ENGINE;
  const BODY = isRival ? 0x262838 : WHITE;
  const BODY_LOW = isRival ? 0x191b28 : PANEL;
  const GLASS = isRival ? 0xff3b58 : CANOPY;
  const GLASS_EM = isRival ? 0xb51832 : 0x1e88c8;

  const g = new THREE.Group();
  const hull = new THREE.Group();
  g.add(hull);

  /* ---- 1. Sculpted tapered aerospace fuselage ---- */
  const mainBody = taperBox(1.55, 0.74, 2.25, 1.06, 4.9, BODY, { topPinch: 0.72, botPinch: 0.90, yShiftFront: -0.06 });
  mainBody.position.set(0, 0.08, -0.35);
  mainBody.material.map = metalTex;
  hull.add(mainBody);

  const bellyChine = taperBox(1.25, 0.42, 1.95, 0.56, 5.2, BODY_LOW, { topPinch: 0.94, botPinch: 0.68 });
  bellyChine.position.set(0, -0.38, 0.05);
  hull.add(bellyChine);

  // Dorsal spine & team chevron stripe (sharp silhouette from behind!)
  const spine = taperBox(0.75, 0.34, 1.18, 0.52, 4.5, BODY, { topPinch: 0.65 });
  spine.position.set(0, 0.58, 0.25);
  hull.add(spine);
  const stripe = taperBox(0.32, 0.14, 0.62, 0.18, 4.3, WING, { topPinch: 0.72 });
  stripe.position.set(0, 0.80, 0.15);
  hull.add(stripe);

  // Sleek dark mechanical shoulder intakes
  for (const s of [-1, 1]) {
    const intake = taperBox(0.46, 0.46, 0.68, 0.66, 2.5, DARKNAVY, { topPinch: 0.82 });
    intake.position.set(s * 1.12, 0.06, 1.45);
    hull.add(intake);
    const intakeGlow = box(0.14, 0.24, 0.9, 0x0f2538, { emissive: ENG, emissiveIntensity: 1.9, flat: true });
    intakeGlow.position.set(s * 1.42, 0.08, 1.75);
    hull.add(intakeGlow);
  }

  /* ---- 2. Razor-sharp multi-segment nose spear ---- */
  const noseMid = taperBox(0.78, 0.44, 1.48, 0.72, 2.2, BODY, { topPinch: 0.70, botPinch: 0.78, yShiftFront: -0.05 });
  noseMid.position.set(0, -0.02, -3.7);
  hull.add(noseMid);
  const noseTipLen = variant === 'hunter' ? 3.5 : 2.9;
  const noseCone = cone(0.56, noseTipLen, 4, BODY, { flat: true });
  noseCone.rotation.x = -Math.PI / 2;
  noseCone.rotation.z = Math.PI / 4;
  noseCone.position.set(0, -0.05, -4.8 - noseTipLen * 0.46);
  hull.add(noseCone);
  const noseCap = cone(0.22, 1.05, 4, WING, { flat: true });
  noseCap.rotation.x = -Math.PI / 2;
  noseCap.rotation.z = Math.PI / 4;
  noseCap.position.set(0, -0.05, -4.8 - noseTipLen - 0.35);
  hull.add(noseCap);
  // Nose side stripes + chin targeting sensor
  for (const s of [-1, 1]) {
    const nStripe = box(0.12, 0.12, 2.0, WING, { flat: true });
    nStripe.position.set(s * 0.52, 0.14, -3.6);
    nStripe.rotation.y = s * -0.14;
    hull.add(nStripe);
  }
  const chin = taperBox(0.32, 0.22, 0.56, 0.30, 1.3, DARKNAVY);
  chin.position.set(0, -0.46, -3.5);
  hull.add(chin);

  /* ---- 3. Sculpted glowing cockpit canopy + roll-bar fairing ---- */
  const cFrame = taperBox(0.95, 0.40, 1.32, 0.56, 2.5, DARKNAVY, { topPinch: 0.78 });
  cFrame.position.set(0, 0.54, -1.25);
  hull.add(cFrame);
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.64, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.56),
    toonMat(GLASS, { emissive: GLASS_EM, emissiveIntensity: 1.05, transparent: true, opacity: 0.92 })
  );
  canopy.scale.set(0.92, 0.94, 2.05);
  canopy.position.set(0, 0.68, -1.22);
  hull.add(canopy);
  // Crisp cockpit specular canopy rib
  const rib = box(0.96, 0.08, 0.14, DARKNAVY, { flat: true });
  rib.position.set(0, 1.14, -1.45);
  hull.add(rib);
  // Rear dorsal fairing ridge (reads strongly from chase-cam)
  const dorsalCowling = taperBox(1.16, 0.62, 1.48, 0.72, 2.2, WING, { topPinch: 0.68 });
  dorsalCowling.position.set(0, 0.52, 1.55);
  hull.add(dorsalCowling);
  for (let i = 0; i < 3; i++) {
    const louvre = box(0.86, 0.10, 0.22, DARKNAVY, { flat: true });
    louvre.position.set(0, 0.88, 0.85 + i * 0.52);
    hull.add(louvre);
  }

  /* ---- 4. Heroic triple-thruster rear engine block (concept art signature!) ---- */
  const engineBlock = taperBox(2.2, 1.05, 2.05, 1.02, 2.0, NAVY, { topPinch: 0.86, botPinch: 0.86 });
  engineBlock.position.set(0, 0.02, 2.85);
  engineBlock.material.map = metalTex;
  hull.add(engineBlock);

  const glowGroup = new THREE.Group();
  const engineGlows = [];
  const enginePetals = [];
  const enginePlumes = [];

  // Central heroic main thruster (large glowing blue plasma nozzle like STAR_FOX_1..4.jpeg)
  const mainOuter = cyl(0.76, 0.88, 1.15, 12, STEEL, { flat: true });
  mainOuter.rotation.x = Math.PI / 2;
  mainOuter.position.set(0, 0.04, 3.85);
  hull.add(mainOuter);
  const mainRim = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.11, 6, 14), toonMat(DARKNAVY, { flat: true }));
  mainRim.position.set(0, 0.04, 4.40);
  hull.add(mainRim);
  const mainCore = cyl(0.64, 0.52, 0.22, 12, 0xeefcff, { emissive: ENG, emissiveIntensity: 2.3 });
  mainCore.rotation.x = Math.PI / 2;
  mainCore.position.set(0, 0.04, 4.44);
  hull.add(mainCore);

  // 6 mechanical thrust-vectoring petals around the main nozzle
  const mainPetalRig = new THREE.Group();
  mainPetalRig.position.set(0, 0.04, 4.42);
  for (let p = 0; p < 6; p++) {
    const a = (p / 6) * TAU;
    const petal = box(0.18, 0.42, 0.62, DARKWING, { flat: true });
    petal.position.set(Math.cos(a) * 0.76, Math.sin(a) * 0.76, 0.12);
    petal.rotation.z = a;
    mainPetalRig.add(petal);
  }
  hull.add(mainPetalRig);
  enginePetals.push(mainPetalRig);

  const mainPlume = buildThrusterPlume(ENG, 0.72, 4.8);
  mainPlume.position.set(0, 0.04, 4.48);
  hull.add(mainPlume);
  enginePlumes.push(mainPlume);

  const mainGlow = glowSprite(ENG, 3.6, 0.96);
  mainGlow.position.set(0, 0.04, 4.75);
  glowGroup.add(mainGlow);
  engineGlows.push(mainGlow);

  // Twin flanking secondary afterburner pods
  for (const s of [-1, 1]) {
    const pod = box(0.72, 0.72, 1.45, DARKNAVY, { flat: true });
    pod.position.set(s * 1.24, -0.02, 3.25);
    hull.add(pod);
    const trim = box(0.78, 0.22, 1.1, WING, { flat: true });
    trim.position.set(s * 1.24, 0.34, 3.2);
    hull.add(trim);
    const port = box(0.46, 0.46, 0.16, 0x0c1a2c, { emissive: ENG, emissiveIntensity: 2.0 });
    port.position.set(s * 1.24, -0.02, 4.02);
    hull.add(port);

    const subPlume = buildThrusterPlume(ENG, 0.34, 2.8);
    subPlume.position.set(s * 1.24, -0.02, 4.06);
    hull.add(subPlume);
    enginePlumes.push(subPlume);

    const subGlow = glowSprite(ENG, 1.9, 0.85);
    subGlow.position.set(s * 1.24, -0.02, 4.35);
    glowGroup.add(subGlow);
    engineGlows.push(subGlow);
  }
  hull.add(glowGroup);

  /* ---- 5. Variant-specific main wings & iconic X-profile stabilizer fins ---- */
  function buildMainWing(sign) {
    const wg = new THREE.Group();
    const span = variant === 'escort' ? 4.9 : variant === 'ace' ? 5.6 : 5.3;
    const sweep = variant === 'hunter' ? -1.45 : variant === 'rival' ? -1.85 : 2.35;
    const chord = variant === 'escort' ? 2.3 : 1.95;

    // White primary sculpted wing blade
    const bladeGeo = new THREE.BoxGeometry(span, 0.20, chord);
    bladeGeo.translate(span * 0.5, 0, 0);
    const pos = bladeGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), k = x / span;
      pos.setZ(i, pos.getZ(i) * (1 - k * 0.54) + k * sweep);
      pos.setY(i, pos.getY(i) * (1 - k * 0.45));
    }
    bladeGeo.computeVertexNormals();
    const blade = new THREE.Mesh(bladeGeo, toonMat(BODY, { flat: true }));
    wg.add(blade);

    // Bold team-colour trailing/outer wing trim stripe
    const trimGeo = new THREE.BoxGeometry(span * 0.94, 0.23, 0.54);
    trimGeo.translate(span * 0.49, 0.01, chord * 0.34);
    const tp = trimGeo.attributes.position;
    for (let i = 0; i < tp.count; i++) {
      const k = tp.getX(i) / span;
      tp.setZ(i, tp.getZ(i) * (1 - k * 0.4) + k * sweep);
    }
    trimGeo.computeVertexNormals();
    wg.add(new THREE.Mesh(trimGeo, toonMat(WING, { flat: true })));

    // Dark leading edge armor rib
    const leGeo = new THREE.BoxGeometry(span * 0.92, 0.16, 0.30);
    leGeo.translate(span * 0.46, 0.0, -chord * 0.44);
    const lp = leGeo.attributes.position;
    for (let i = 0; i < lp.count; i++) {
      const k = lp.getX(i) / span;
      lp.setZ(i, lp.getZ(i) + k * sweep);
    }
    leGeo.computeVertexNormals();
    wg.add(new THREE.Mesh(leGeo, toonMat(DARKNAVY, { flat: true })));

    // Wing-root G-Diffuser hinge housing + underwing laser cannon
    const hinge = cyl(0.32, 0.38, 1.5, 8, STEEL, { flat: true });
    hinge.rotation.z = Math.PI / 2;
    hinge.position.set(0.65, -0.02, 0.15);
    wg.add(hinge);
    const gunBarrel = cyl(0.11, 0.15, 2.2, 6, DARKNAVY, { flat: true });
    gunBarrel.rotation.x = Math.PI / 2;
    gunBarrel.position.set(1.35, -0.26, -1.35);
    wg.add(gunBarrel);
    const muzzle = glowSprite(isRival ? 0xff4d6d : 0x72ffbe, 0.55, 0.72);
    muzzle.position.set(1.35, -0.26, -2.50);
    wg.add(muzzle);

    // Escort (NOVA) armored twin-boom pod on mid-wing
    if (variant === 'escort') {
      const boom = taperBox(0.68, 0.52, 0.88, 0.62, 3.4, WING, { topPinch: 0.8 });
      boom.position.set(2.45, 0.05, 0.5);
      wg.add(boom);
      const boomCap = box(0.45, 0.34, 0.18, DARKNAVY, { emissive: ENG, emissiveIntensity: 1.5 });
      boomCap.position.set(2.45, 0.05, 2.25);
      wg.add(boomCap);
    }

    // Upturned angular winglet tip + nav light
    const tipZ = sweep * 0.88;
    const tip = box(0.30, variant === 'ace' ? 2.1 : 1.55, 1.05, WING, { flat: true });
    tip.position.set(span - 0.1, 0.52, tipZ);
    tip.rotation.z = variant === 'ace' ? -0.35 : -0.52;
    wg.add(tip);
    const tipEdge = box(0.20, 0.65, 1.08, BODY, { flat: true });
    tipEdge.position.set(span - 0.25, 0.02, tipZ);
    tipEdge.rotation.z = -0.52;
    wg.add(tipEdge);
    const nav = glowSprite(sign > 0 ? 0x42ff82 : 0xff4d66, 0.95, 0.85);
    nav.position.set(span + 0.15, 1.18, tipZ);
    wg.add(nav);

    wg.position.set(sign * 0.98, -0.10, 0.85);
    wg.rotation.z = sign * (variant === 'ace' ? 0.18 : 0.08);
    wg.scale.x = sign;
    return wg;
  }
  hull.add(buildMainWing(1), buildMainWing(-1));

  /* ---- 6. Iconic 4-Fin X-Configuration Rear Stabilizers (upper + lower angled blades!) ---- */
  // Matches the unmistakable rear X-wing silhouette in STAR_FOX_1..4.jpeg!
  for (const s of [1, -1]) {
    // Upper swept fin
    const upperAngle = variant === 'hunter' ? -0.22 : -0.62;
    const upperFin = taperBox(0.18, 2.35, 0.16, 2.1, 1.45, WING, { topPinch: 0.72 });
    upperFin.position.set(s * 1.48, 1.25, 2.35);
    upperFin.rotation.z = s * upperAngle;
    upperFin.rotation.x = -0.18;
    hull.add(upperFin);
    const upperWhite = box(0.22, 1.05, 0.42, BODY, { flat: true });
    upperWhite.position.set(s * 1.72, 1.60, 1.85);
    upperWhite.rotation.z = s * upperAngle;
    hull.add(upperWhite);

    // Lower ventral angled fin (completes the X-silhouette from behind!)
    const lowerFin = taperBox(0.16, 1.85, 0.14, 1.65, 1.35, isRival ? WING : DARKWING, { topPinch: 0.76 });
    lowerFin.position.set(s * 1.42, -1.02, 2.42);
    lowerFin.rotation.z = s * 0.64;
    lowerFin.rotation.x = 0.14;
    hull.add(lowerFin);
    const lowerAccent = box(0.18, 0.72, 0.36, WING, { flat: true });
    lowerAccent.position.set(s * 1.76, -1.42, 2.42);
    lowerAccent.rotation.z = s * 0.64;
    hull.add(lowerAccent);
  }

  // Hunter (VEGA) extra forward nose canards
  if (variant === 'hunter' || isRival) {
    for (const s of [1, -1]) {
      const canard = box(1.45, 0.12, 0.72, WING, { flat: true });
      canard.position.set(s * 1.05, -0.08, -3.15);
      canard.rotation.y = s * -0.45;
      canard.rotation.z = s * 0.15;
      hull.add(canard);
    }
  }

  /* ---- Trail & weapon anchors ---- */
  const tipX = variant === 'ace' ? 6.3 : 6.0;
  const tipZ = variant === 'hunter' || isRival ? -0.4 : 2.9;
  const tipL = new THREE.Object3D(); tipL.position.set(tipX, 0.45, tipZ); g.add(tipL);
  const tipR = new THREE.Object3D(); tipR.position.set(-tipX, 0.45, tipZ); g.add(tipR);
  const noseAnchor = new THREE.Object3D(); noseAnchor.position.set(0, -0.02, -7.8); g.add(noseAnchor);

  g.userData = { engineGlow: glowGroup, engineGlows, enginePetals, enginePlumes, tipL, tipR, noseAnchor, hull };
  return g;
}

/* ============ PROCEDURAL ENEMIES & FALLBACKS (enlarged & detailed) ============ */
export function buildDrone(tint = 0x3a4668) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.OctahedronGeometry(2.8, 0), toonMat(tint, { flat: true }));
  body.scale.set(1, 0.62, 1.75);
  g.add(body);
  const plate = box(2.8, 0.9, 3.0, 0x232a42, { flat: true });
  plate.position.set(0, 0.9, 0.3); g.add(plate);
  const cowl = cone(1.25, 2.8, 5, 0xc23828, { flat: true });
  cowl.rotation.x = -Math.PI / 2; cowl.position.set(0, 0, -3.4); g.add(cowl);
  for (const s of [1, -1]) {
    const wing = box(5.0, 0.28, 2.2, 0x2a3454, { flat: true });
    wing.position.set(s * 3.4, -0.15, 0.4);
    wing.rotation.z = s * 0.34;
    g.add(wing);
    const wtip = box(0.55, 1.3, 1.6, 0xc23828, { flat: true });
    wtip.position.set(s * 5.6, 0.3, 0.5); wtip.rotation.z = s * 0.34; g.add(wtip);
  }
  const plume = buildThrusterPlume(0xff8a3e, 1.0, 5.0);
  plume.position.set(0, 0, 4.4); g.add(plume);
  const eye = glowSprite(0xffb830, 3.0);
  eye.position.set(0, 0, -4.4);
  g.add(eye);
  g.userData.glow = eye;
  g.userData.meshScale = 1.24;
  return g;
}

export function buildLancer(tint = 0x723142) {
  const g = new THREE.Group();
  const body = cone(1.85, 8.6, 6, tint, { flat: true });
  body.rotation.x = -Math.PI / 2;
  g.add(body);
  const spine = box(1.2, 1.6, 6.2, 0x3c2030, { flat: true });
  spine.position.set(0, 0.9, 1.0); g.add(spine);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.35, 6, 10), toonMat(0x2a1620, { flat: true }));
  ring.position.set(0, 0, 3.8); g.add(ring);
  for (const s of [1, -1]) {
    const wing = box(6.0, 0.28, 2.6, 0x3c2030, { flat: true });
    wing.position.set(s * 3.2, -0.15, 1.9); wing.rotation.z = s * 0.12; wing.rotation.y = s * -0.32;
    g.add(wing);
    const edge = box(5.6, 0.34, 0.72, tint, { flat: true });
    edge.position.set(s * 3.0, 0, 0.8); edge.rotation.y = s * -0.32; g.add(edge);
    const tip = glowSprite(0xff5560, 2.0);
    tip.position.set(s * 5.8, 0, 2.8); g.add(tip);
  }
  const plume = buildThrusterPlume(0xff5a40, 1.25, 6.0);
  plume.position.set(0, 0, 4.2); g.add(plume);
  const eng = glowSprite(0xff8560, 3.4);
  eng.position.set(0, 0, 4.4);
  g.add(eng);
  g.userData.glow = eng;
  g.userData.meshScale = 1.24;
  return g;
}

/** Iconic Star Fox armoured claw-petal pod with pulsing hot magenta core (STAR_FOX_2.jpeg) */
export function buildPod() {
  const g = new THREE.Group();
  // Metallic inner ring frame
  const frameRing = new THREE.Mesh(
    new THREE.TorusGeometry(3.4, 0.55, 8, 18),
    toonMat(0x525d72, { flat: true, emissive: 0x262e3e, emissiveIntensity: 0.4 })
  );
  g.add(frameRing);
  const frameCross = new THREE.Mesh(
    new THREE.TorusGeometry(3.2, 0.42, 6, 16),
    toonMat(0x3a4354, { flat: true })
  );
  frameCross.rotation.y = Math.PI / 2;
  g.add(frameCross);

  // Glowing magenta core eye
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(2.1, 14, 12),
    toonMat(0x882055, { emissive: 0xff2f8c, emissiveIntensity: 2.1 })
  );
  g.add(core);

  // 4 sculpted heavy orange-ochre armoured shell petals with steel inner trim
  const shellMat = toonMat(0xd47e30, { flat: true, emissive: 0x3b1e08, emissiveIntensity: 0.25 });
  const trimMat = toonMat(0x7c869a, { flat: true });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU;
    const petalGroup = new THREE.Group();
    petalGroup.rotation.y = a;
    const petal = new THREE.Mesh(
      new THREE.SphereGeometry(4.4, 10, 8, 0, Math.PI * 0.58, 0.42, Math.PI * 0.66),
      shellMat
    );
    petalGroup.add(petal);
    const rib = box(0.7, 5.2, 1.1, 0x7c869a, { flat: true });
    rib.material = trimMat;
    rib.position.set(4.1, 0, 0);
    petalGroup.add(rib);
    const tipLight = glowSprite(0xffa042, 1.9, 0.8);
    tipLight.position.set(4.5, 1.5, 0);
    petalGroup.add(tipLight);
    g.add(petalGroup);
  }
  const glow = glowSprite(0xff3d8f, 6.2, 0.95);
  g.add(glow);
  g.userData.glow = glow;
  g.userData.meshScale = 1.22;
  return g;
}

export function buildTurret(tint = 0x4a5568) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 5.0, 3.4, 8), toonMat(tint, { flat: true }));
  base.position.y = 1.7;
  g.add(base);
  const head = new THREE.Mesh(new THREE.SphereGeometry(2.8, 10, 8), toonMat(0x39445c, { flat: true }));
  head.position.y = 4.4;
  g.add(head);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.72, 5.8, 8), toonMat(0x222b3d));
  barrel.rotation.x = Math.PI / 2.6;
  barrel.position.set(0, 5.4, -2.4);
  g.add(barrel);
  const glow = glowSprite(0xff7040, 2.8);
  glow.position.set(0, 5.6, -4.6);
  g.add(glow);
  g.userData.glow = glow;
  g.userData.barrel = barrel;
  return g;
}

export function buildMine() {
  const g = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(3.1, 0),
    toonMat(0x4b2438, { flat: true, emissive: 0xff2244, emissiveIntensity: 0.75 })
  );
  g.add(core);
  const band = new THREE.Mesh(
    new THREE.TorusGeometry(3.25, 0.34, 6, 14),
    toonMat(0x261522, { flat: true, emissive: 0xff3b58, emissiveIntensity: 0.9 })
  );
  g.add(band);
  const spikeMat = toonMat(0x2d1828, { flat: true, emissive: 0x5c1424, emissiveIntensity: 0.45 });
  for (let i = 0; i < 10; i++) {
    const sp = cone(0.68, 2.6, 4, 0x2e1c30);
    sp.material = spikeMat;
    const dir = new THREE.Vector3().setFromSphericalCoords(3.0, Math.acos(1 - 2 * ((i + 0.5) / 10)), i * 2.39996);
    sp.position.copy(dir);
    sp.lookAt(dir.clone().multiplyScalar(2));
    sp.rotateX(Math.PI / 2);
    g.add(sp);
  }
  const glow = glowSprite(0xff2848, 5.4, 0.95);
  g.add(glow);
  g.userData.glow = glow;
  return g;
}

export function buildRay(tint = 0x3f6d8a) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(2.3, 10, 8), toonMat(tint, { flat: true }));
  body.scale.set(2.8, 0.5, 1.55);
  g.add(body);
  const tail = box(0.45, 0.18, 5.8, tint, { flat: true });
  tail.position.z = 4.4;
  g.add(tail);
  const eye = glowSprite(0x7fe9ff, 2.8);
  eye.position.z = -2.6;
  g.add(eye);
  g.userData.glow = eye;
  g.userData.body = body;
  g.userData.meshScale = 1.24;
  return g;
}

/* ============ ELITE / CAPITAL SHIPS ============ */
export function buildGunship() {
  const g = new THREE.Group();
  const hullMat = toonMat(0x5a3444, { flat: true });
  const deckMat = toonMat(0x704252, { flat: true });
  const dark = toonMat(0x2e1c26, { flat: true });
  const gunMat = toonMat(0x1c1218);
  const hull = new THREE.Mesh(new THREE.BoxGeometry(7.6, 3.6, 18), hullMat); g.add(hull);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(3.2, 7.2, 4), hullMat);
  bow.rotation.x = -Math.PI / 2; bow.rotation.y = Math.PI / 4; bow.position.z = -12.4; g.add(bow);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.7, 11.5), deckMat); deck.position.set(0, 2.5, 1.2); g.add(deck);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(3.0, 2.6, 3.4), dark); bridge.position.set(0, 4.4, 4.2); g.add(bridge);
  const bridgeWin = box(2.5, 0.45, 0.16, 0x0f2030, { emissive: 0x8fe6ff, emissiveIntensity: 1.8 });
  bridgeWin.position.set(0, 4.8, 2.5); g.add(bridgeWin);
  for (const [tz, ty] of [[-5.6, 2.3], [-1.0, 3.8], [5.6, 2.3]]) {
    const tur = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.8, 1.1, 8), dark);
    tur.position.set(0, ty + 0.5, tz); g.add(tur);
    for (const s of [0.5, -0.5]) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 3.6, 5), gunMat);
      bar.rotation.x = Math.PI / 2; bar.position.set(s, ty + 0.75, tz - 2.3); g.add(bar);
    }
  }
  for (const s of [1, -1]) {
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.0, 15), dark); belt.position.set(s * 4.1, -0.3, 0); g.add(belt);
    const plume = buildThrusterPlume(0xff7030, 1.3, 7.2);
    plume.position.set(s * 2.0, 0, 9.6); g.add(plume);
    const eng = glowSprite(0xff8a3e, 3.8); eng.position.set(s * 2.0, 0, 10.2); g.add(eng);
  }
  const eye = glowSprite(0xff3040, 4.2); eye.position.set(0, 0.6, -15.0); g.add(eye);
  g.userData.glow = eye;
  g.userData.meshScale = 1.24;
  return g;
}

export function buildSaucer() {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(6.0, 6.0, 1.0, 24), toonMat(0x707c94, { flat: true }));
  g.add(disc);
  const rimTop = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 5.8, 1.1, 24), toonMat(0x5c6984, { flat: true }));
  rimTop.position.y = 1.0; g.add(rimTop);
  const rimBot = new THREE.Mesh(new THREE.CylinderGeometry(5.8, 3.2, 1.2, 24), toonMat(0x454f66, { flat: true }));
  rimBot.position.y = -1.0; g.add(rimBot);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(2.4, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
    toonMat(0x9fe8d8, { emissive: 0x3fd0a8, emissiveIntensity: 1.0, transparent: true, opacity: 0.92 }));
  dome.position.y = 1.4; g.add(dome);
  const lights = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const l = glowSprite(i % 2 ? 0xffd66b : 0x7fe9ff, 2.0);
    l.position.set(Math.cos(a) * 5.4, 0, Math.sin(a) * 5.4); lights.add(l);
  }
  g.add(lights);
  const beam = glowSprite(0x8fffe0, 4.8); beam.position.y = -2.4; g.add(beam);
  g.userData.glow = beam; g.userData.lights = lights;
  return g;
}

export function buildCarrier() {
  const g = new THREE.Group();
  const hullMat = toonMat(0x44526b, { flat: true });
  const dark = toonMat(0x283246, { flat: true });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(10.5, 4.2, 21), hullMat); g.add(hull);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(12.2, 0.85, 22), dark); deck.position.y = 2.5; g.add(deck);
  const stripe = box(0.85, 0.12, 20, 0xffd66b, { emissive: 0xaa8020, emissiveIntensity: 0.75 });
  stripe.position.y = 3.0; g.add(stripe);
  const island = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3.6, 5.2), hullMat); island.position.set(3.9, 4.6, 4.0); g.add(island);
  const islWin = box(2.1, 0.45, 0.16, 0x0f2030, { emissive: 0x8fe6ff, emissiveIntensity: 1.7 });
  islWin.position.set(3.9, 5.4, 1.35); g.add(islWin);
  const bayGlow = box(5.8, 2.2, 0.5, 0x101820, { emissive: 0xff9e4a, emissiveIntensity: 1.9 });
  bayGlow.position.set(0, -0.2, -10.8); g.add(bayGlow);
  for (const s of [1, -1]) {
    const spon = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.6, 13), dark); spon.position.set(s * 6.2, -0.8, 1.5); g.add(spon);
    const plume = buildThrusterPlume(0x7fb0ff, 1.5, 8.0);
    plume.position.set(s * 3.5, -0.3, 11.2); g.add(plume);
    const eng = glowSprite(0x7fb0ff, 3.4); eng.position.set(s * 3.5, -0.3, 11.6); g.add(eng);
  }
  const glow = glowSprite(0xff9e4a, 4.4); glow.position.set(0, -0.2, -11.4); g.add(glow);
  g.userData.glow = glow;
  return g;
}

/** AEGIS SIEGE CARRIER — monumental armoured capital command ship */
export function buildSiegeCarrier() {
  const g = new THREE.Group();
  const hull = toonMat(0x6e8ec2, { flat: true, emissive: 0x1e2c44, emissiveIntensity: 0.45 });
  const armour = toonMat(0x3a4e6e, { flat: true, emissive: 0x121c2c, emissiveIntensity: 0.4 });
  const trim = toonMat(0xa4c4ee, { flat: true, emissive: 0x263854, emissiveIntensity: 0.35 });

  const keel = new THREE.Mesh(new THREE.BoxGeometry(12.2, 4.0, 24.5), hull); keel.position.y = -0.4; g.add(keel);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(14.2, 0.78, 26.0), armour); deck.position.y = 2.1; g.add(deck);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(4.4, 3.8, 6.4), trim); bridge.position.set(3.8, 4.2, 2.8); g.add(bridge);
  const bridgeGlass = box(3.6, 0.60, 0.18, 0x112033, { emissive: 0x70dfff, emissiveIntensity: 1.9 });
  bridgeGlass.position.set(3.8, 4.8, -0.4); g.add(bridgeGlass);
  const spine = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 21.5), trim); spine.position.set(0, 2.8, 0); g.add(spine);

  for (const s of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const plate = new THREE.Mesh(new THREE.BoxGeometry(2.1, 2.2, 4.5), armour);
      plate.position.set(s * 7.0, 0.15, -8.2 + i * 5.6); g.add(plate);
      const seam = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.15, 3.6), trim);
      seam.position.set(s * 8.1, 0.18, -8.2 + i * 5.6); g.add(seam);
    }
    const pod = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.2, 10.8), trim); pod.position.set(s * 7.4, 0.4, 2.8); g.add(pod);
    const plume = buildThrusterPlume(0x8db9ff, 1.8, 10.5);
    plume.position.set(s * 3.8, -0.25, 13.0); g.add(plume);
    const engine = glowSprite(0x8db9ff, 4.2); engine.position.set(s * 3.8, -0.25, 13.2); g.add(engine);
    for (const z of [-6.0, 1.6, 7.8]) {
      const lamp = glowSprite(0xff6a42, 1.3); lamp.position.set(s * 8.3, 1.6, z); g.add(lamp);
    }
  }
  for (const s of [-1, 1]) {
    const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.78, 5.8, 6), armour);
    gun.rotation.x = Math.PI / 2; gun.position.set(s * 4.5, 1.2, -14.6); g.add(gun);
  }
  const bay = box(6.4, 2.5, 0.5, 0x121925, { emissive: 0xff5935, emissiveIntensity: 2.0 });
  bay.position.set(0, -0.05, -12.9); g.add(bay);
  const bayGlow = glowSprite(0xff5a36, 5.4); bayGlow.position.set(0, -0.05, -13.4); g.add(bayGlow);
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 5.8, 6), trim); antenna.position.set(-2.8, 7.0, 3.0); g.add(antenna);
  const dish = new THREE.Mesh(new THREE.ConeGeometry(1.3, 0.5, 10), trim); dish.rotation.x = Math.PI; dish.position.set(-2.8, 9.8, 3.0); g.add(dish);
  const commandEye = glowSprite(0xffd36a, 3.0); commandEye.position.set(0, 3.1, -13.4); g.add(commandEye);
  addCombatFrame(g, 'dreadwing', MODEL_DEFS.dreadwing);
  g.userData.glow = bayGlow;
  return g;
}

export function buildSeeker() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.OctahedronGeometry(2.8, 0), toonMat(0x2a4572, { flat: true }));
  body.scale.set(0.82, 0.7, 2.25); g.add(body);
  const nose = cone(1.2, 4.6, 4, 0x9be23a, { emissive: 0x6bbf20, emissiveIntensity: 0.65, flat: true });
  nose.rotation.x = -Math.PI / 2; nose.position.z = -4.2; g.add(nose);
  for (const s of [1, -1]) {
    const wing = box(5.4, 0.28, 2.5, 0x203458, { flat: true });
    wing.position.set(s * 3.4, 0, 1.0); wing.rotation.z = s * 0.48; wing.rotation.y = s * 0.3;
    g.add(wing);
    const tip = glowSprite(0x9be23a, 1.8); tip.position.set(s * 6.0, 0.5, 1.6); g.add(tip);
  }
  const plume = buildThrusterPlume(0x72ffc8, 1.15, 6.0);
  plume.position.z = 4.0; g.add(plume);
  const eng = glowSprite(0x8bffe0, 3.4); eng.position.z = 4.2; g.add(eng);
  g.userData.glow = eng;
  g.userData.meshScale = 1.24;
  return g;
}

export function buildSniper() {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(3.2, 0), toonMat(0x3f5670, { flat: true }));
  g.add(core);
  const ring = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const plate = box(0.9, 2.8, 2.1, 0x2a3a4e, { flat: true });
    const a = (i / 5) * Math.PI * 2;
    plate.position.set(Math.cos(a) * 4.2, Math.sin(a) * 4.2, 0);
    plate.rotation.z = a; ring.add(plate);
  }
  g.add(ring);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.88, 9.6, 8), toonMat(0x182230));
  barrel.rotation.x = Math.PI / 2; barrel.position.z = -4.2; g.add(barrel);
  const eye = glowSprite(0x59c6ff, 3.6); eye.position.z = -0.6; g.add(eye);
  g.userData.glow = eye;
  g.userData.ring = ring;
  return g;
}

export function buildStrafer(tint = 0x863656) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.OctahedronGeometry(2.5, 0), toonMat(tint, { flat: true }));
  body.scale.set(0.68, 0.7, 2.65); g.add(body);
  const nose = cone(1.0, 5.4, 4, 0xffb02e, { emissive: 0xff6a10, emissiveIntensity: 0.6, flat: true });
  nose.rotation.x = -Math.PI / 2; nose.position.z = -4.6; g.add(nose);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), toonMat(0x2f9fd4, { emissive: 0x1a6fa0, emissiveIntensity: 0.9 }));
  canopy.scale.set(0.9, 0.8, 1.4); canopy.position.set(0, 0.9, -1.0); g.add(canopy);
  for (const s of [1, -1]) {
    const wing = box(4.8, 0.25, 2.4, 0x422032, { flat: true });
    wing.position.set(s * 3.1, 0, 0.4); wing.rotation.z = s * -0.28; wing.rotation.y = s * 0.42; g.add(wing);
    const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.32, 3.2, 6), toonMat(0x161016));
    cannon.rotation.x = Math.PI / 2; cannon.position.set(s * 2.7, -0.2, -2.5); g.add(cannon);
    const tip = glowSprite(0xff5560, 1.6); tip.position.set(s * 5.4, 0.2, 1.1); g.add(tip);
  }
  const plume = buildThrusterPlume(0xff7b4d, 1.15, 6.2);
  plume.position.z = 4.6; g.add(plume);
  const eng = glowSprite(0xff8560, 3.6); eng.position.z = 4.7; g.add(eng);
  g.userData.glow = eng;
  g.userData.meshScale = 1.24;
  return g;
}

export function buildBomber(tint = 0x424c66) {
  const g = new THREE.Group();
  const hull = box(10.8, 3.3, 6.8, tint, { flat: true }); g.add(hull);
  const belly = box(7.2, 2.0, 4.8, 0x262d40, { flat: true }); belly.position.y = -2.0; g.add(belly);
  const nose = cone(2.6, 5.0, 5, tint, { flat: true }); nose.rotation.x = -Math.PI / 2; nose.position.z = -5.6; g.add(nose);
  for (const s of [1, -1]) {
    const wing = box(9.0, 0.85, 3.8, 0x313a52, { flat: true }); wing.position.set(s * 7.2, 0, 0.6); wing.rotation.z = s * 0.06; g.add(wing);
    const eng = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.45, 3.3, 8), toonMat(0x1a1e2a)); eng.rotation.x = Math.PI / 2; eng.position.set(s * 7.2, -0.65, 3.9); g.add(eng);
    const plume = buildThrusterPlume(0xff8533, 1.25, 6.8);
    plume.position.set(s * 7.2, -0.65, 5.5); g.add(plume);
    const glow = glowSprite(0xff8a3e, 3.8); glow.position.set(s * 7.2, -0.65, 5.8); g.add(glow);
    const bay = glowSprite(0xff3d8f, 2.8); bay.position.set(s * 2.1, -3.1, 0); g.add(bay);
  }
  const eye = glowSprite(0xff5040, 4.0); eye.position.set(0, 1.0, -6.6); g.add(eye);
  g.userData.glow = eye;
  g.userData.meshScale = 1.24;
  return g;
}

export function buildFlak() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(4.0, 5.4, 3.6, 8), toonMat(0x524838, { flat: true }));
  base.position.y = 1.8; g.add(base);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 0.9, 10), toonMat(0x322d24, { flat: true }));
  collar.position.y = 3.8; g.add(collar);
  const head = new THREE.Group(); head.position.y = 4.6; g.add(head);
  head.add(box(4.0, 2.2, 4.0, 0x64543c, { flat: true }));
  for (const sx of [1.1, -1.1]) for (const sz of [0.8, -0.8]) {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 4.4, 6), toonMat(0x1e1a12));
    barrel.position.set(sx, 1.8, sz); barrel.rotation.x = -0.5; head.add(barrel);
  }
  const glow = glowSprite(0xffb030, 3.0); glow.position.set(0, 3.6, -1.0); head.add(glow);
  g.userData.glow = glow; g.userData.head = head;
  return g;
}

/** AEGIS AA BATTERY — broad strategic fixed anti-air base */
export function buildAABattery() {
  const g = new THREE.Group();
  const armour = toonMat(0x4a505a, { flat: true, emissive: 0x141820, emissiveIntensity: 0.35 });
  const armourLight = toonMat(0x6b747d, { flat: true, emissive: 0x1a2028, emissiveIntensity: 0.30 });
  const dark = toonMat(0x222832, { flat: true });
  const warning = toonMat(0x2a1d1c, { emissive: 0xff6438, emissiveIntensity: 1.25, flat: true });
  const sensorMat = toonMat(0x17212a, { emissive: 0xff9a46, emissiveIntensity: 1.60, flat: true });

  const foundation = new THREE.Mesh(new THREE.CylinderGeometry(9.2, 11.4, 3.2, 8), dark);
  foundation.position.y = 1.6; g.add(foundation);
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(7.8, 9.4, 2.8, 8), armour);
  plinth.position.y = 4.4; g.add(plinth);
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(6.6, 7.8, 1.3, 10), armourLight);
  deck.position.y = 6.4; g.add(deck);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU;
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.32, 6), warning);
    bolt.rotation.x = Math.PI / 2; bolt.position.set(Math.cos(a) * 8.4, 3.4, Math.sin(a) * 8.4); g.add(bolt);
  }

  const head = new THREE.Group(); head.position.y = 6.9; g.add(head);
  const housing = new THREE.Mesh(new THREE.BoxGeometry(8.4, 2.9, 6.8), armour);
  housing.position.y = 1.65; head.add(housing);
  const yoke = new THREE.Mesh(new THREE.CylinderGeometry(2.9, 3.4, 1.75, 10), dark);
  yoke.position.y = 3.2; head.add(yoke);
  const sensor = new THREE.Mesh(new THREE.SphereGeometry(1.65, 10, 7), sensorMat);
  sensor.scale.set(1.0, 0.76, 0.58); sensor.position.set(0, 4.05, -3.4); head.add(sensor);
  const sensorHalo = new THREE.Mesh(new THREE.TorusGeometry(2.05, 0.18, 5, 12), warning);
  sensorHalo.rotation.x = Math.PI / 2; sensorHalo.position.set(0, 4.05, -3.55); head.add(sensorHalo);

  for (const side of [-1, 1]) {
    const mount = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.1, 4.0), armourLight);
    mount.position.set(side * 2.85, 3.05, -1.0); head.add(mount);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.40, 0.56, 9.6, 7), dark);
    barrel.rotation.x = Math.PI * 0.68; barrel.position.set(side * 2.85, 5.45, -4.4); head.add(barrel);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.68, 7), warning);
    collar.rotation.x = Math.PI * 0.68; collar.position.set(side * 2.85, 6.1, -5.6); head.add(collar);
  }
  const muzzle = new THREE.Group(); muzzle.position.set(0, 8.2, -7.8); head.add(muzzle);

  const radar = new THREE.Group(); radar.position.set(0, 5.0, 1.55); head.add(radar);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.42, 5.6, 7), armourLight);
  mast.position.y = 2.8; radar.add(mast);
  const dish = new THREE.Mesh(new THREE.TorusGeometry(3.0, 0.28, 5, 14), warning);
  dish.rotation.x = Math.PI / 2; dish.position.y = 5.6; radar.add(dish);
  const dishCore = new THREE.Mesh(new THREE.CircleGeometry(2.3, 12), sensorMat);
  dishCore.position.set(0, 5.6, -0.1); radar.add(dishCore);

  for (const side of [-1, 1]) {
    const cell = new THREE.Mesh(new THREE.BoxGeometry(3.0, 4.2, 3.7), dark);
    cell.position.set(side * 6.8, 5.5, 1.2); g.add(cell);
    for (let i = 0; i < 3; i++) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.35, 6), warning);
      cap.rotation.x = Math.PI / 2; cap.position.set(side * 6.8 + (i - 1) * 0.84, 6.4, -0.72); g.add(cap);
    }
  }
  const glow = glowSprite(0xff7a42, 3.6); glow.position.set(0, 10.8, -3.6); head.add(glow);
  g.userData.glow = glow; g.userData.head = head; g.userData.radar = radar;
  g.userData.sensorMat = sensorMat; g.userData.muzzle = muzzle;
  return g;
}

export function buildHovertank() {
  const g = new THREE.Group();
  g.add((() => { const s = box(7.8, 1.2, 9.6, 0x242e38, { flat: true }); s.position.y = 2.1; return s; })());
  const hull = box(6.8, 2.1, 9.0, 0x42505c, { flat: true }); hull.position.y = 3.3; g.add(hull);
  for (const sx of [1, -1]) for (const sz of [-3, 3]) {
    const th = glowSprite(0x59c6ff, 2.4); th.position.set(sx * 2.8, 1.3, sz); g.add(th);
  }
  const turret = new THREE.Group(); turret.position.set(0, 4.8, 0); g.add(turret);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(2.0, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), toonMat(0x52626e, { flat: true })); turret.add(dome);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.48, 4.8, 7), toonMat(0x1a2026)); barrel.rotation.x = Math.PI / 2; barrel.position.z = -2.4; turret.add(barrel);
  const eye = glowSprite(0xff6a3e, 2.6); eye.position.set(0, 0.6, -1.0); turret.add(eye);
  g.userData.glow = eye; g.userData.turret = turret;
  return g;
}

export function buildLauncher() {
  const g = new THREE.Group();
  const base = box(5.2, 2.4, 6.2, 0x485440, { flat: true }); base.position.y = 1.2; g.add(base);
  const rack = new THREE.Group(); rack.position.set(0, 2.9, 0.6); rack.rotation.x = -0.7; g.add(rack);
  rack.add(box(4.6, 2.4, 3.4, 0x323c2d, { flat: true }));
  for (const sx of [1, -1]) for (const sy of [0.8, -0.8]) {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 3.6, 7), toonMat(0x242c20));
    tube.rotation.x = Math.PI / 2; tube.position.set(sx * 1.2, sy, -0.9); rack.add(tube);
    const tip = glowSprite(0xff7a3a, 1.5); tip.position.set(sx * 1.2, sy, -2.7); rack.add(tip);
  }
  const glow = glowSprite(0xffa030, 2.4); glow.position.set(0, 3.2, 0.6); g.add(glow);
  g.userData.glow = glow; g.userData.rack = rack;
  return g;
}
