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
  // Grunts & interceptors — distinctive tactical faction finishes & crisp silhouettes
  drone:       { path: 'props/craft_racer',            size: 15.4, glow: 0xff8a4c, tint: 0x526488, role: 'agile' },
  lancer:      { path: 'props/craft_speedera',         size: 18.4, glow: 0xff5252, tint: 0xb83848, role: 'agile' },
  ray:         { path: 'props/craft_speederb',         size: 19.6, glow: 0x5ae8ff, tint: 0x3b7fa8, role: 'agile' },
  // Elites — detailed Quaternius & Sci-Fi Essentials fighters (nose faces -z)
  strafer:     { path: 'ships/striker',                size: 21.8, rotY: Math.PI, glow: 0xff7b4d, tint: 0xa44058, role: 'agile' },
  seeker:      { path: 'ships/zenith',                 size: 20.8, rotY: Math.PI, glow: 0x72ffc8, tint: 0x326b7c, role: 'agile' },
  sniper:      { path: 'ships/omen',                   size: 21.2, rotY: Math.PI, glow: 0x59c6ff, tint: 0x3b5882, role: 'tech' },
  bomber:      { path: 'ships/dispatcher',             size: 25.5, rotY: Math.PI, glow: 0xff8533, tint: 0x5c4654, role: 'heavy' },
  skyraider:   { path: 'external/aero_airship',        size: 30.0, rotY: Math.PI, glow: 0xff9a4c, tint: 0x4c5870, role: 'heavy' },
  relaydrone:  { path: 'external/scifi_drone',         size: 18.6, rotY: Math.PI, glow: 0xff45a8, tint: 0x623b7c, role: 'tech' },
  gunship:     { path: 'ships/executioner',            size: 28.0, rotY: Math.PI, glow: 0xff4930, tint: 0x743848, role: 'heavy' },
  carrier:     { path: 'ships/imperial',               size: 32.0, rotY: Math.PI, glow: 0xff9e4a, tint: 0x4b5c7a, role: 'heavy' },
  saucer:      { path: 'ships/pancake',                size: 23.0, rotY: Math.PI, glow: 0x80ffe4, tint: 0x5a748e, role: 'tech' },
  // Iconic procedural concept-art pod (articulated armoured petals + hot magenta core) & spiked mine
  pod:         { path: 'props/machine_wireless',       size: 16.8, glow: 0xff3d8f, procedural: true, role: 'tech' },
  mine:        { path: 'debris/crystals',              size: 12.2, glow: 0xff2848, procedural: true, role: 'mine' },
  // Ground & surface units — big enough to read clearly from flight altitude
  turret:      { path: 'props/turret_single',          size: 15.8, ground: true, tint: 0x56647a },
  flak:        { path: 'props/turret_double',          size: 19.2, ground: true, tint: 0x6e6048 },
  hovertank:   { path: 'props/craft_speederb',         size: 21.4, ground: true, tint: 0x4d6070 },
  launcher:    { path: 'props/rocket_basea',           size: 19.2, ground: true, tint: 0x58664e },
  // Expansion pack — Quaternius Sci-Fi Essentials + Ultimate Space Kit + Kenney Pirate Kit
  scout:       { path: 'expansion/Enemy_EyeDrone',     ext: 'gltf', size: 21.2, rotY: Math.PI, glow: 0xff485e, tint: 0x524668, role: 'tech' },
  fighter:     { path: 'expansion/Enemy_Flying',       ext: 'gltf', size: 25.4, rotY: Math.PI, glow: 0xff8638, tint: 0x8c3c44, role: 'agile' },
  skytalon:    { path: 'external/sky_talon',           ext: 'glb',  size: 24.0, rotY: Math.PI, glow: 0xffbe4d, tint: 0xd94834, role: 'agile' },
  harrier:     { path: 'ships/challenger',             size: 24.2, rotY: Math.PI, glow: 0xff4868, tint: 0x9c324a, role: 'agile' },
  phantom:     { path: 'ships/spitfire',               size: 23.0, rotY: Math.PI, glow: 0x9d72ff, tint: 0x4e367a, role: 'tech' },
  dreadwing:   { path: 'ships/insurgent',              size: 33.5, rotY: Math.PI, glow: 0xb082ff, procedural: true, role: 'heavy' },
  quadtank:    { path: 'expansion/Enemy_QuadShell',    ext: 'gltf', size: 22.8, rotY: Math.PI, ground: true, tint: 0x5a5248 },
  trilobite:   { path: 'expansion/Enemy_Trilobite',    ext: 'gltf', size: 23.6, rotY: Math.PI, ground: true, tint: 0x5c3c4c },
  mech:        { path: 'expansion/Enemy_Large',        ext: 'gltf', size: 28.5, rotY: Math.PI, ground: true, tint: 0x644852 },
  cannon:      { path: 'expansion/cannon-mobile',      ext: 'glb',  size: 17.4, ground: true },
  shorecannon: { path: 'expansion/cannon',             ext: 'glb',  size: 16.4, ground: true },
  gunboat:     { path: 'expansion/ship-large',         ext: 'glb',  size: 39.5, ground: true },
  frigate:     { path: 'expansion/ship-pirate-large',  ext: 'glb',  size: 49.5, ground: true },
};

/**
 * Normalise imported GLTF/GLB materials so authored textures stay crisp,
 * untextured metallic hulls gain micro-paneled normal relief + sky sheen,
 * and high-metalness kit assets never collapse into black silhouettes.
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
    material.roughness = clamp(material.roughness ?? 0.44, 0.26, 0.66);
  }
  if ('metalness' in material) {
    // Rich anodized aerospace metal sheen with PMREM sky reflections, capped so hulls stay bright
    material.metalness = clamp(material.metalness ?? 0.34, 0.16, 0.44);
  }
  if ('envMapIntensity' in material) {
    material.envMapIntensity = 1.25;
  }
  if (material.metalnessMap) {
    material.metalness = Math.min(material.metalness, 0.32);
  }
  // Enrich smooth untextured hull surfaces with crisp micro-paneled armor normal relief!
  if ('normalMap' in material && !material.normalMap && !material.bumpMap && typeof shipArmorNormal !== 'undefined' && shipArmorNormal) {
    material.normalMap = shipArmorNormal;
    material.normalScale = new THREE.Vector2(0.36, 0.36);
  }
  if (material.color) {
    if (opts.tint) {
      material.color.lerp(new THREE.Color(opts.tint), opts.tintStrength ?? 0.26);
    }
    const lum = 0.299 * material.color.r + 0.587 * material.color.g + 0.114 * material.color.b;
    if (!material.map && lum < 0.09) {
      // Lift near-black untextured hull surfaces (linear space) to readable tactical slate.
      material.color.lerp(new THREE.Color(0x8a9cb8), 0.65);
    }
  }
  if (material.emissive) {
    const emLum = 0.299 * material.emissive.r + 0.587 * material.emissive.g + 0.114 * material.emissive.b;
    if (emLum < 0.08) {
      if (material.map) {
        material.emissive.setHex(opts.texturedEmissive ?? 0x1e283b);
        material.emissiveIntensity = opts.emissiveFloor ?? 0.44;
      } else if (material.color) {
        material.emissive.copy(material.color).multiplyScalar(opts.emissiveFloor ?? 0.18);
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
      if (def.ground) addGroundCombatFrame(wrap, type, def);
      else addCombatFrame(wrap, type, def);
      // Mark all template combat-frame geometries/materials shared so clones never dispose template GPU buffers!
      wrap.traverse((o) => {
        if (o.geometry) o.geometry.userData.shared = true;
        if (o.material) {
          for (const mat of (Array.isArray(o.material) ? o.material : [o.material])) {
            if (mat) mat.userData.shared = true;
          }
        }
      });
      SHIP_MODELS[type] = wrap;
    });
  }
}

// Brushed-metal panel grain for hero hull surfaces (CC0)
const metalTex = loadDetailTexture('./assets/textures/metal_diff.jpg', { repeat: 1.5, brightness: 1.95, contrast: 0.45, desat: 0.7 });

/** High-definition 512px procedural spacecraft armor plating + matching Sobel normal map + hazard & window trims. */
function makeShipArmorMaps() {
  if (typeof document === 'undefined') return { diffuse: null, normal: null, hazard: null, windows: null };
  // 1. 512px metallic beveled hull panels, inspection hatches, cooling louvers, rivets & micro-brushed sheen
  const S = 512;
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#c4cedc';
  ctx.fillRect(0, 0, S, S);
  // Subtle directional brushed aerospace alloy streaks
  for (let y = 0; y < S; y += 3) {
    ctx.fillStyle = y % 6 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(18,28,44,0.05)';
    ctx.fillRect(0, y, S, 1.5);
  }
  const panels = [
    [10, 10, 236, 152, '#d5dfec'],
    [262, 10, 240, 152, '#bec9d8'],
    [10, 178, 154, 158, '#c6d1e0'],
    [178, 178, 156, 158, '#dae3f0'],
    [348, 178, 154, 158, '#bcc7d6'],
    [10, 352, 236, 150, '#ccd7e6'],
    [262, 352, 240, 150, '#d6e0ed'],
  ];
  for (const [x, y, w, h, col] of panels) {
    ctx.fillStyle = col;
    ctx.fillRect(x, y, w, h);
    // Recessed beveled panel seam + bright specular top-left lip
    ctx.strokeStyle = 'rgba(16, 24, 38, 0.66)';
    ctx.lineWidth = 4;
    ctx.strokeRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.62)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 3, y + h - 3); ctx.lineTo(x + 3, y + 3); ctx.lineTo(x + w - 3, y + 3);
    ctx.stroke();
    // Inner inspection sub-plate on wide armor blocks
    if (w > 180) {
      ctx.strokeStyle = 'rgba(24, 36, 56, 0.34)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 22, y + 22, w - 44, h - 44);
    }
    // Corner countersunk rivets
    ctx.fillStyle = 'rgba(22, 32, 48, 0.62)';
    for (const rx of [x + 14, x + w - 14]) {
      for (const ry of [y + 14, y + h - 14]) {
        ctx.beginPath(); ctx.arc(rx, ry, 3.2, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  // Precision cooling radiator louvers + tactical stencil stripes
  ctx.fillStyle = 'rgba(18, 26, 40, 0.56)';
  for (let i = 0; i < 6; i++) ctx.fillRect(288, 36 + i * 18, 184, 7);
  for (let i = 0; i < 5; i++) ctx.fillRect(368, 206 + i * 20, 112, 8);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.34)';
  ctx.fillRect(28, 412, 196, 16);
  ctx.fillStyle = 'rgba(20, 30, 46, 0.42)';
  ctx.fillRect(28, 434, 196, 9);

  const diffuse = new THREE.CanvasTexture(c);
  diffuse.wrapS = diffuse.wrapT = THREE.RepeatWrapping;
  diffuse.colorSpace = THREE.SRGBColorSpace;
  diffuse.anisotropy = 4;
  diffuse.userData = { shared: true };

  // 2. Matching 256px Sobel normal map so every armor seam, louver & rivet catches 3D directional lighting!
  const NS = 256;
  const hc = document.createElement('canvas'); hc.width = hc.height = NS;
  const hg = hc.getContext('2d');
  hg.drawImage(c, 0, 0, NS, NS);
  const hData = hg.getImageData(0, 0, NS, NS).data;
  const nc = document.createElement('canvas'); nc.width = nc.height = NS;
  const ng = nc.getContext('2d');
  const nImg = ng.createImageData(NS, NS);
  const nd = nImg.data;
  const lumAt = (x, y) => {
    const p = (((y + NS) % NS) * NS + ((x + NS) % NS)) * 4;
    return (hData[p] * 0.3 + hData[p + 1] * 0.59 + hData[p + 2] * 0.11) / 255;
  };
  for (let y = 0; y < NS; y++) {
    for (let x = 0; x < NS; x++) {
      const dx = (lumAt(x + 1, y - 1) + 2 * lumAt(x + 1, y) + lumAt(x + 1, y + 1))
               - (lumAt(x - 1, y - 1) + 2 * lumAt(x - 1, y) + lumAt(x - 1, y + 1));
      const dy = (lumAt(x - 1, y + 1) + 2 * lumAt(x, y + 1) + lumAt(x + 1, y + 1))
               - (lumAt(x - 1, y - 1) + 2 * lumAt(x, y - 1) + lumAt(x + 1, y - 1));
      const nx = -dx * 2.4, ny = dy * 2.4, nz = 1.0;
      const inv = 1 / Math.hypot(nx, ny, nz);
      const p = (y * NS + x) * 4;
      nd[p] = Math.round((nx * inv * 0.5 + 0.5) * 255);
      nd[p + 1] = Math.round((ny * inv * 0.5 + 0.5) * 255);
      nd[p + 2] = Math.round((nz * inv * 0.5 + 0.5) * 255);
      nd[p + 3] = 255;
    }
  }
  ng.putImageData(nImg, 0, 0);
  const normal = new THREE.CanvasTexture(nc);
  normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
  normal.anisotropy = 4;
  normal.userData = { shared: true };

  // 3. Tactical warning chevron & squadron decal armor texture
  const hz = document.createElement('canvas'); hz.width = hz.height = 256;
  const hzg = hz.getContext('2d');
  hzg.fillStyle = '#3a465c'; hzg.fillRect(0, 0, 256, 256);
  const stripeBand = (y0, bh) => {
    hzg.save();
    hzg.beginPath(); hzg.rect(0, y0, 256, bh); hzg.clip();
    hzg.fillStyle = '#f2b238'; hzg.fillRect(0, y0, 256, bh);
    hzg.fillStyle = '#181e2a';
    for (let x = -64; x < 320; x += 34) {
      hzg.beginPath();
      hzg.moveTo(x, y0 + bh); hzg.lineTo(x + 17, y0 + bh);
      hzg.lineTo(x + 35, y0); hzg.lineTo(x + 18, y0);
      hzg.closePath(); hzg.fill();
    }
    hzg.restore();
  };
  stripeBand(0, 40); stripeBand(216, 40);
  hzg.fillStyle = '#4e5d74'; hzg.fillRect(10, 48, 236, 160);
  hzg.strokeStyle = '#161e2c'; hzg.lineWidth = 6; hzg.strokeRect(10, 48, 236, 160);
  hzg.fillStyle = 'rgba(255,255,255,0.22)'; hzg.fillRect(24, 62, 208, 12);
  const hazard = new THREE.CanvasTexture(hz);
  hazard.wrapS = hazard.wrapT = THREE.RepeatWrapping;
  hazard.colorSpace = THREE.SRGBColorSpace;
  hazard.anisotropy = 4;
  hazard.userData = { shared: true };

  // 4. Illuminated capital-ship viewport & command bridge window grid
  const wc = document.createElement('canvas'); wc.width = 256; wc.height = 128;
  const wg = wc.getContext('2d');
  wg.fillStyle = '#182234'; wg.fillRect(0, 0, 256, 128);
  for (let r = 0; r < 4; r++) {
    const y = r * 32;
    wg.fillStyle = '#2d3b54'; wg.fillRect(0, y, 256, 6);
    for (let col = 0; col < 10; col++) {
      const lit = ((r * 7 + col * 11) % 5) !== 0;
      wg.fillStyle = lit ? (r === 1 ? '#82f4ff' : '#ffd87a') : '#1c2a40';
      wg.fillRect(8 + col * 24, y + 10, 17, 14);
    }
  }
  const windows = new THREE.CanvasTexture(wc);
  windows.wrapS = windows.wrapT = THREE.RepeatWrapping;
  windows.colorSpace = THREE.SRGBColorSpace;
  windows.anisotropy = 4;
  windows.userData = { shared: true };

  return { diffuse, normal, hazard, windows };
}
const _shipMaps = makeShipArmorMaps();
const shipArmorTex = _shipMaps.diffuse;
const shipArmorNormal = _shipMaps.normal;
const shipHazardTex = _shipMaps.hazard;
const shipWindowTex = _shipMaps.windows;

/** High-definition 512px precision aerospace titanium/ceramic hull plating for Player Arwing & Wingmates. */
function makeArwingPanelTexture() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#eef3fa';
  ctx.fillRect(0, 0, 512, 512);
  // Subtle aerospace hull plate segmentation & crisp micro-seams
  const rects = [
    [6, 6, 244, 160, '#f5f8fd'],
    [262, 6, 244, 160, '#e6edf6'],
    [6, 178, 162, 160, '#eaf0f8'],
    [180, 178, 152, 160, '#f7faff'],
    [344, 178, 162, 160, '#e4ebf5'],
    [6, 350, 244, 156, '#e8eff8'],
    [262, 350, 244, 156, '#f3f7fc'],
  ];
  for (const [x, y, w, h, col] of rects) {
    ctx.fillStyle = col;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(34, 48, 72, 0.34)';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + 2, y + h - 2); ctx.lineTo(x + 2, y + 2); ctx.lineTo(x + w - 2, y + 2);
    ctx.stroke();
    // Recessed titanium panel fasteners
    ctx.fillStyle = 'rgba(42, 58, 86, 0.42)';
    for (const rx of [x + 12, x + w - 12]) for (const ry of [y + 12, y + h - 12]) {
      ctx.beginPath(); ctx.arc(rx, ry, 2.4, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Precision cooling louver slats & maintenance hatch outlines
  ctx.fillStyle = 'rgba(32, 46, 68, 0.28)';
  for (let i = 0; i < 6; i++) ctx.fillRect(284, 34 + i * 16, 118, 6);
  ctx.strokeStyle = 'rgba(36, 52, 78, 0.30)';
  ctx.lineWidth = 2;
  ctx.strokeRect(32, 378, 128, 96);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.userData = { shared: true };
  return tex;
}
const arwingPanelTex = makeArwingPanelTexture();

const WHITE = 0xf2f5fa, PANEL = 0xdbe2ec, RED = 0xdc3230, DARKRED = 0x941f22,
  NAVY = 0x26314c, DARKNAVY = 0x171f33, STEEL = 0x5c6b88, CANOPY = 0x2ca8e0, ENGINE = 0x52e0ff;

function _withShipNorm(opts) {
  if (!opts || opts.normalMap || !shipArmorNormal) return opts;
  if (opts.map === shipArmorTex || opts.map === shipHazardTex) {
    return { ...opts, normalMap: shipArmorNormal, normalScale: new THREE.Vector2(0.42, 0.42) };
  }
  return opts;
}
function box(w, h, d, color, opts) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), toonMat(color, _withShipNorm(opts))); }
function cone(r, h, seg, color, opts) { return new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), toonMat(color, _withShipNorm(opts))); }
function cyl(rt, rb, h, seg, color, opts) { return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), toonMat(color, _withShipNorm(opts))); }

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
  const matOpts = { flat: true, ...opts };
  if (matOpts.map === shipArmorTex && shipArmorNormal && !matOpts.normalMap) {
    matOpts.normalMap = shipArmorNormal;
    matOpts.normalScale = new THREE.Vector2(0.45, 0.45);
  }
  return new THREE.Mesh(geo, toonMat(color, matOpts));
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
 * Detailed, hull-hugging combat kit for imported enemies:
 * - Sculpted armored underwing cannon pods, barrel sleeves & glowing muzzle telegraphs
 * - Swept dorsal IFF tactical stabilizer vane & forward optical rangefinder collar
 * - Tapered armored engine nozzle shrouds + volumetric 3D plasma flame plumes
 * - Command bridge visor + twin point-defense turrets & rotating reactor on capital ships
 */
function addCombatFrame(wrap, type, def) {
  if (!def.glow) return;
  const s = def.size;
  const role = def.role ?? (new Set(['bomber', 'gunship', 'carrier', 'skyraider', 'dreadwing']).has(type) ? 'heavy' : 'agile');
  const isHeavy = role === 'heavy';
  const isTech = role === 'tech';
  const artillery = new Set(['sniper', 'bomber', 'gunship', 'carrier', 'skyraider', 'dreadwing']);
  const frame = new THREE.Group();
  frame.name = 'combatFrame';
  const accent = def.glow;
  const dark = 0x192336;
  const armorMat = toonMat(0x2d3c56, { map: shipArmorTex, normalMap: shipArmorNormal, normalScale: new THREE.Vector2(0.48, 0.48), flat: true });
  const hazardMat = toonMat(0x455268, { map: shipHazardTex, normalMap: shipArmorNormal, normalScale: new THREE.Vector2(0.36, 0.36), flat: true });
  const gunMat = toonMat(0x161f2e, { flat: true });
  const trimLit = toonMat(dark, { emissive: accent, emissiveIntensity: 1.15, flat: true });
  const scale = isHeavy ? 1.0 : 0.80;

  // Forward targeting ring + armored optical rangefinder brackets (glows brightly right before firing).
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(s * 0.135 * scale, s * 0.015 * scale, 6, 16),
    toonMat(dark, { emissive: accent, emissiveIntensity: 0.95, flat: true })
  );
  ring.name = 'combatSensorRing';
  ring.position.z = -s * 0.39;
  frame.add(ring);
  for (const side of [-1, 1]) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(s * 0.036 * scale, s * 0.10 * scale, s * 0.12 * scale), hazardMat);
    fin.position.set(side * s * 0.168 * scale, 0, -s * 0.37);
    frame.add(fin);
  }

  // Sculpted dorsal tactical stabilizer crest + luminous hostile IFF stripe + menacing predator canopy visor
  const dorsalVane = taperBox(s * 0.024 * scale, s * 0.13 * scale, s * 0.044 * scale, s * 0.19 * scale, s * 0.32 * scale, 0x2d3c56, { map: shipArmorTex });
  dorsalVane.position.set(0, s * 0.18 * scale, s * 0.12);
  dorsalVane.rotation.x = -0.24;
  frame.add(dorsalVane);
  const iffStrip = new THREE.Mesh(
    new THREE.BoxGeometry(s * 0.042 * scale, s * 0.030 * scale, s * 0.25 * scale),
    trimLit
  );
  iffStrip.position.set(0, s * 0.245 * scale, s * 0.13);
  iffStrip.rotation.x = -0.24;
  frame.add(iffStrip);

  // Recessed illuminated predator canopy dome + armored spine rib + ventral keel stabilizer!
  if (!isHeavy) {
    const canopy = new THREE.Mesh(
      new THREE.SphereGeometry(s * 0.072 * scale, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.54),
      toonMat(0x101c2e, { emissive: accent, emissiveIntensity: 1.35, flat: true })
    );
    canopy.scale.set(1.0, 0.72, 2.05);
    canopy.position.set(0, s * 0.105 * scale, -s * 0.14);
    frame.add(canopy);
    const canopyRib = new THREE.Mesh(new THREE.BoxGeometry(s * 0.018 * scale, s * 0.036 * scale, s * 0.22 * scale), armorMat);
    canopyRib.position.set(0, s * 0.142 * scale, -s * 0.13);
    frame.add(canopyRib);
  }
  const keelFin = taperBox(s * 0.020 * scale, s * 0.08 * scale, s * 0.034 * scale, s * 0.12 * scale, s * 0.24 * scale, 0x243248, { map: shipArmorTex });
  keelFin.position.set(0, -s * 0.13 * scale, s * 0.08);
  frame.add(keelFin);

  // Armored flanking air-intake cowls, glowing intake grilles, side conduit rails & underslung micro-missile pods!
  for (const side of [-1, 1]) {
    const intake = taperBox(s * 0.072 * scale, s * 0.056 * scale, s * 0.092 * scale, s * 0.072 * scale, s * 0.24 * scale, 0x26344a, { map: shipArmorTex });
    intake.position.set(side * s * 0.145 * scale, s * 0.01 * scale, -s * 0.09);
    frame.add(intake);
    const grille = new THREE.Mesh(new THREE.BoxGeometry(s * 0.052 * scale, s * 0.032 * scale, s * 0.018 * scale), trimLit);
    grille.position.set(side * s * 0.145 * scale, s * 0.01 * scale, -s * 0.215);
    frame.add(grille);

    const conduit = new THREE.Mesh(new THREE.BoxGeometry(s * 0.018 * scale, s * 0.020 * scale, s * 0.34 * scale), trimLit);
    conduit.position.set(side * s * 0.205 * scale, s * 0.032 * scale, s * 0.04);
    frame.add(conduit);

    // Underslung dual micro-missile pylon rack (clearly visible from cockpit during bank/dive!)
    const rack = new THREE.Mesh(new THREE.BoxGeometry(s * 0.054 * scale, s * 0.032 * scale, s * 0.16 * scale), hazardMat);
    rack.position.set(side * s * 0.32 * scale, -s * 0.075 * scale, -s * 0.02);
    frame.add(rack);
    const warhead = new THREE.Mesh(
      new THREE.ConeGeometry(s * 0.018 * scale, s * 0.075 * scale, 6),
      toonMat(0x3a1820, { emissive: 0xff5a3c, emissiveIntensity: 1.55, flat: true })
    );
    warhead.rotation.x = -Math.PI / 2;
    warhead.position.set(side * s * 0.32 * scale, -s * 0.075 * scale, -s * 0.125);
    frame.add(warhead);
  }

  // Sculpted underwing weapon pods + twin accelerator coils + gun barrels + glowing muzzle telegraphs.
  const hardpoints = isHeavy ? [-0.31, -0.13, 0.13, 0.31] : [-0.24, 0.24];
  for (const x of hardpoints) {
    const pod = taperBox(s * 0.068 * scale, s * 0.056 * scale, s * 0.088 * scale, s * 0.070 * scale, s * 0.26 * scale, 0x384760, { map: shipHazardTex });
    pod.position.set(x * s, -s * 0.055 * scale, -s * 0.18);
    frame.add(pod);

    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(s * 0.015 * scale, s * 0.022 * scale, s * 0.24 * scale, 6),
      gunMat
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(x * s, -s * 0.055 * scale, -s * 0.35);
    frame.add(barrel);

    const coil = new THREE.Mesh(
      new THREE.TorusGeometry(s * 0.026 * scale, s * 0.007 * scale, 5, 10),
      trimLit
    );
    coil.position.set(x * s, -s * 0.055 * scale, -s * 0.39);
    frame.add(coil);

    const tip = glowSprite(artillery.has(type) ? 0xffae52 : accent, s * 0.15 * scale, 0.72);
    tip.name = 'combatWeaponGlow';
    tip.position.set(x * s, -s * 0.055 * scale, -s * 0.47);
    frame.add(tip);
  }

  // Class-tailored silhouette enhancements:
  // 1. Agile interceptors: forward canard strakes, glowing leading-edge trim & articulated wingtip stabilizers!
  if (role === 'agile') {
    for (const side of [-1, 1]) {
      const canard = taperBox(s * 0.14 * scale, s * 0.018 * scale, s * 0.10 * scale, s * 0.022 * scale, s * 0.12 * scale, 0x3b4c68, { map: shipHazardTex });
      canard.position.set(side * s * 0.19 * scale, -s * 0.01 * scale, -s * 0.28);
      canard.rotation.y = side * -0.44;
      canard.rotation.z = side * 0.16;
      frame.add(canard);

      const edgeRail = new THREE.Mesh(new THREE.BoxGeometry(s * 0.22 * scale, s * 0.014 * scale, s * 0.032 * scale), trimLit);
      edgeRail.position.set(side * s * 0.30, 0.01 * s, -s * 0.04);
      edgeRail.rotation.y = side * -0.26;
      frame.add(edgeRail);

      // Articulated pivoting wingtip fin (angles dynamically during dives & snap-rolls!)
      const wingPivot = new THREE.Group();
      wingPivot.name = side < 0 ? 'combatWingL' : 'combatWingR';
      wingPivot.position.set(side * s * 0.43, s * 0.02, s * 0.04);
      wingPivot.userData.baseRotZ = side * -0.32;
      const wtipFin = taperBox(s * 0.022 * scale, s * 0.15 * scale, s * 0.034 * scale, s * 0.12 * scale, s * 0.18 * scale, 0x354662, { map: shipArmorTex });
      wtipFin.rotation.z = side * -0.32;
      wingPivot.add(wtipFin);
      const wtipEdge = new THREE.Mesh(new THREE.BoxGeometry(s * 0.016 * scale, s * 0.11 * scale, s * 0.03 * scale), trimLit);
      wtipEdge.position.set(side * s * 0.022 * scale, s * 0.01, -s * 0.07 * scale);
      wtipEdge.rotation.z = side * -0.32;
      wingPivot.add(wtipEdge);
      const strobe = glowSprite(side < 0 ? 0xff4c66 : 0x56f0ff, s * 0.11 * scale, 0.68);
      strobe.position.set(side * s * 0.03, s * 0.06, 0);
      wingPivot.add(strobe);
      frame.add(wingPivot);
    }
  } else if (isTech) {
    // 2. Tech / Phase craft: counter-rotating dual holographic gyroscope rings & phase emitter pylons!
    const gyroA = new THREE.Mesh(
      new THREE.TorusGeometry(s * 0.36, s * 0.013, 6, 22),
      toonMat(0x162236, { emissive: accent, emissiveIntensity: 1.25, flat: true })
    );
    gyroA.name = 'combatGyroA';
    gyroA.rotation.x = 0.68;
    frame.add(gyroA);

    const gyroB = new THREE.Mesh(
      new THREE.TorusGeometry(s * 0.29, s * 0.010, 5, 18),
      toonMat(0x1e2c44, { emissive: 0x8ef2ff, emissiveIntensity: 1.05, flat: true })
    );
    gyroB.name = 'combatGyroB';
    gyroB.rotation.set(0.45, 0.8, 0);
    frame.add(gyroB);

    for (const side of [-1, 1]) {
      const pylon = taperBox(s * 0.03 * scale, s * 0.12 * scale, s * 0.04 * scale, s * 0.09 * scale, s * 0.18 * scale, 0x354662, { map: shipArmorTex });
      pylon.position.set(side * s * 0.42, s * 0.03, s * 0.02);
      pylon.rotation.z = side * -0.42;
      frame.add(pylon);
      const strobe = glowSprite(accent, s * 0.11 * scale, 0.72);
      strobe.position.set(side * s * 0.45, s * 0.06, s * 0.02);
      frame.add(strobe);
    }
  } else {
    // Heavy ship outer flanking wingtip nacelles + hazard armor ribs
    for (const side of [-1, 1]) {
      const wtipFin = taperBox(s * 0.032, s * 0.13, s * 0.048, s * 0.11, s * 0.22, 0x3c4b64, { map: shipHazardTex });
      wtipFin.position.set(side * s * 0.43, s * 0.03, s * 0.04);
      wtipFin.rotation.z = side * -0.26;
      frame.add(wtipFin);
      const strobe = glowSprite(side < 0 ? 0xff4c66 : 0xffbe52, s * 0.11, 0.68);
      strobe.position.set(side * s * 0.45, s * 0.06, s * 0.04);
      frame.add(strobe);
    }
  }

  // Armored engine nozzle shrouds + rotating glowing turbine collars + volumetric 3D plasma flame plumes (+Z).
  const engineGlows = [];
  const engineCollars = [];
  const enginePlumes = [];
  const engineCount = isHeavy ? 4 : 2;
  for (let i = 0; i < engineCount; i++) {
    const x = engineCount === 2 ? (i ? 0.165 : -0.165) * s : (-0.27 + i * 0.18) * s;
    const shroud = new THREE.Mesh(
      new THREE.CylinderGeometry(s * 0.056 * scale, s * 0.072 * scale, s * 0.14 * scale, 8),
      armorMat
    );
    shroud.rotation.x = Math.PI / 2;
    shroud.position.set(x, -s * 0.02 * scale, s * 0.36);
    frame.add(shroud);
    // 4-petal vectored thrust deflector flaps around every engine nozzle!
    for (let p = 0; p < 4; p++) {
      const pa = (p / 4) * TAU + Math.PI * 0.25;
      const petal = new THREE.Mesh(new THREE.BoxGeometry(s * 0.020 * scale, s * 0.042 * scale, s * 0.056 * scale), gunMat);
      petal.position.set(x + Math.cos(pa) * s * 0.062 * scale, -s * 0.02 * scale + Math.sin(pa) * s * 0.062 * scale, s * 0.435);
      petal.rotation.z = pa;
      frame.add(petal);
    }

    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(s * 0.058 * scale, s * 0.013 * scale, 5, 10),
      toonMat(0x283448, { emissive: accent, emissiveIntensity: 0.92, flat: true })
    );
    collar.name = 'combatEngineCollar';
    collar.position.set(x, -s * 0.02 * scale, s * 0.43);
    frame.add(collar);

    const plume = buildThrusterPlume(accent, s * (isHeavy ? 0.076 : 0.070) * scale, s * (isHeavy ? 0.48 : 0.56) * scale, 'combatEnginePlume');
    plume.position.set(x, -s * 0.02 * scale, s * 0.44);
    frame.add(plume);

    const exhaust = glowSprite(accent, s * (isHeavy ? 0.22 : 0.19) * scale, 0.92);
    exhaust.name = 'combatEngineGlow';
    exhaust.position.set(x, -s * 0.02 * scale, s * 0.47);
    frame.add(exhaust);
    engineGlows.push(exhaust);
    engineCollars.push(collar);
    enginePlumes.push(plume);
  }

  // Battle-damage caution beacons & smoke anchor.
  const warningLights = [];
  for (const side of [-1, 1]) {
    const warning = glowSprite(0xff6b38, s * 0.13 * scale, 0.12);
    warning.name = 'combatWarningLight';
    warning.position.set(side * s * 0.26 * scale, s * 0.12 * scale, -s * 0.04);
    frame.add(warning);
    warningLights.push(warning);
  }
  const damageSmoke = new THREE.Sprite(new THREE.SpriteMaterial({
    map: dotTexture(), color: 0x3b221e, transparent: true, opacity: 0, depthWrite: false,
  }));
  damageSmoke.name = 'combatDamageSmoke';
  damageSmoke.position.set(0, s * 0.25 * scale, s * 0.06);
  damageSmoke.scale.set(s * 0.48, s * 0.62, 1);
  frame.add(damageSmoke);

  // Heavy warships gain an illuminated multi-deck command bridge, spinning radar array, dorsal turrets & reactor core.
  if (isHeavy) {
    const bridgeMat = toonMat(0x2d3c56, { map: shipWindowTex, emissive: 0x8ef0ff, emissiveMap: shipWindowTex, emissiveIntensity: 0.72, flat: true });
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(s * 0.20, s * 0.10, s * 0.18), bridgeMat);
    bridge.position.set(0, s * 0.19, -s * 0.08);
    frame.add(bridge);
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(s * 0.17, s * 0.032, s * 0.024),
      toonMat(0x0c1e2e, { emissive: 0x8ef0ff, emissiveIntensity: 1.85, flat: true })
    );
    visor.position.set(0, s * 0.205, -s * 0.175);
    frame.add(visor);

    // Spinning dorsal AWACS radar dish atop the heavy warship bridge!
    const radar = new THREE.Group();
    radar.name = 'combatRadar';
    radar.position.set(0, s * 0.275, -s * 0.08);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.012, s * 0.018, s * 0.07, 6), armorMat);
    radar.add(mast);
    const dish = new THREE.Mesh(new THREE.BoxGeometry(s * 0.14, s * 0.028, s * 0.022), hazardMat);
    dish.position.y = s * 0.04;
    radar.add(dish);
    const dishTip = new THREE.Mesh(new THREE.BoxGeometry(s * 0.15, s * 0.012, s * 0.012), trimLit);
    dishTip.position.y = s * 0.04;
    radar.add(dishTip);
    frame.add(radar);

    for (const side of [-1, 1]) {
      const turBase = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.044, s * 0.058, s * 0.045, 8), hazardMat);
      turBase.position.set(side * s * 0.18, s * 0.15, -s * 0.16);
      frame.add(turBase);
      const turGun = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.012, s * 0.016, s * 0.15, 6), gunMat);
      turGun.rotation.x = Math.PI / 2;
      turGun.position.set(side * s * 0.18, s * 0.168, -s * 0.24);
      frame.add(turGun);
    }

    const reactor = new THREE.Mesh(
      new THREE.IcosahedronGeometry(s * 0.082, 1),
      toonMat(0x182337, { emissive: accent, emissiveIntensity: 1.45, flat: true })
    );
    reactor.name = 'combatReactorCore';
    reactor.position.set(0, s * 0.15, s * 0.16);
    frame.add(reactor);

    const reactorHalo = new THREE.Mesh(
      new THREE.TorusGeometry(s * 0.13, s * 0.015, 6, 16),
      toonMat(0x25334c, { emissive: accent, emissiveIntensity: 0.85, flat: true })
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

/**
 * High-contrast armored targeting kit for imported ground batteries, tanks, mechs & naval warships:
 * hazard base collar, spinning optical targeting ring, radar antennae & glowing weapon strobes!
 */
function addGroundCombatFrame(wrap, type, def) {
  const s = def.size;
  const isNaval = type === 'gunboat' || type === 'frigate';
  const accent = isNaval ? 0x62e2ff : type === 'launcher' || type === 'mech' ? 0xff7042 : 0xffb442;
  const frame = new THREE.Group();
  frame.name = 'combatFrame';
  const hazardMat = toonMat(0x465264, { map: shipHazardTex, normalMap: shipArmorNormal, normalScale: new THREE.Vector2(0.4, 0.4), flat: true });
  const darkMat = toonMat(0x1b2434, { map: shipArmorTex, normalMap: shipArmorNormal, normalScale: new THREE.Vector2(0.35, 0.35), flat: true });
  const litMat = toonMat(0x182234, { emissive: accent, emissiveIntensity: 1.5, flat: true });

  // Reinforced hazard armored base collar ring (skipped for floating wooden/pirate hulls)
  if (!isNaval) {
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.28, s * 0.33, s * 0.08, 8), hazardMat);
    collar.position.y = s * 0.05;
    frame.add(collar);
  }

  // Spinning optical targeting acquisition ring + glowing fire-control eye
  const sensorY = isNaval ? s * 0.36 : s * 0.46;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(s * 0.14, s * 0.015, 6, 16), litMat);
  ring.name = 'combatSensorRing';
  ring.position.set(0, sensorY, -s * 0.26);
  frame.add(ring);

  // Rotating fire-control radar crossbar atop ground batteries & warships!
  const radar = new THREE.Group();
  radar.name = 'combatRadar';
  radar.position.set(0, isNaval ? s * 0.54 : s * 0.62, s * 0.06);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.016, s * 0.024, s * 0.14, 6), darkMat);
  radar.add(mast);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(s * 0.22, s * 0.032, s * 0.026), hazardMat);
  bar.position.y = s * 0.06;
  radar.add(bar);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(s * 0.23, s * 0.014, s * 0.016), litMat);
  strip.position.y = s * 0.06;
  radar.add(strip);
  frame.add(radar);

  const weaponGlows = [];
  for (const side of [-1, 1]) {
    const glow = glowSprite(accent, s * 0.18, 0.72);
    glow.name = 'combatWeaponGlow';
    glow.position.set(side * s * 0.20, sensorY, -s * 0.30);
    frame.add(glow);
    weaponGlows.push(glow);
  }
  const warningLights = [];
  for (const side of [-1, 1]) {
    const w = glowSprite(0xff5238, s * 0.14, 0.12);
    w.name = 'combatWarningLight';
    w.position.set(side * s * 0.26, sensorY * 0.75, 0);
    frame.add(w);
    warningLights.push(w);
  }

  frame.userData.visual = { engineGlows: [], engineCollars: [], enginePlumes: [], warningLights, weaponGlows, accent };
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
  const hullTex = isRival ? shipArmorTex : arwingPanelTex;

  const g = new THREE.Group();
  const hull = new THREE.Group();
  g.add(hull);

  /* ---- 1. Sculpted tapered aerospace fuselage with 512px titanium hull plating ---- */
  const mainBody = taperBox(1.55, 0.76, 2.30, 1.08, 4.95, BODY, { map: hullTex, topPinch: 0.72, botPinch: 0.90, yShiftFront: -0.06 });
  mainBody.position.set(0, 0.08, -0.35);
  hull.add(mainBody);

  const bellyChine = taperBox(1.25, 0.44, 1.98, 0.58, 5.25, BODY_LOW, { map: hullTex, topPinch: 0.94, botPinch: 0.68 });
  bellyChine.position.set(0, -0.38, 0.05);
  hull.add(bellyChine);

  // Dorsal spine, beveled armor plates & bold squadron chevron stripe (reads razor-sharp from chase-cam!)
  const spine = taperBox(0.76, 0.36, 1.22, 0.54, 4.55, BODY, { map: hullTex, topPinch: 0.65 });
  spine.position.set(0, 0.58, 0.25);
  hull.add(spine);
  const stripe = taperBox(0.32, 0.14, 0.66, 0.19, 4.35, WING, { topPinch: 0.72 });
  stripe.position.set(0, 0.81, 0.15);
  hull.add(stripe);

  // Sculpted shoulder G-Diffuser intakes + glowing cooling fins + articulated dorsal air-brakes!
  const airBrakes = [];
  for (const s of [-1, 1]) {
    const intake = taperBox(0.48, 0.48, 0.72, 0.70, 2.65, DARKNAVY, { map: shipArmorTex, topPinch: 0.82 });
    intake.position.set(s * 1.15, 0.06, 1.45);
    hull.add(intake);
    const intakeTrim = box(0.18, 0.52, 0.24, variant === 'hero' ? 0xe5b842 : WING, { flat: true });
    intakeTrim.position.set(s * 1.20, 0.06, 0.14);
    hull.add(intakeTrim);
    const intakeGlow = box(0.14, 0.24, 1.05, 0x0f2538, { emissive: ENG, emissiveIntensity: 2.0, flat: true });
    intakeGlow.position.set(s * 1.46, 0.08, 1.72);
    hull.add(intakeGlow);

    // Articulated dorsal air-brake flap (hinges upward with glowing deceleration light on Brake!)
    const brakePivot = new THREE.Group();
    brakePivot.position.set(s * 0.78, 0.72, 1.05);
    const brakeBlade = taperBox(0.56, 0.12, 0.64, 0.10, 1.38, BODY, { map: hullTex });
    brakeBlade.position.set(0, 0.04, 0.62);
    brakePivot.add(brakeBlade);
    const brakeGlow = box(0.44, 0.08, 0.95, 0x2a1410, { emissive: 0xff5a28, emissiveIntensity: 0.15, flat: true });
    brakeGlow.position.set(0, -0.02, 0.66);
    brakePivot.add(brakeGlow);
    brakePivot.userData.glowMat = brakeGlow.material;
    hull.add(brakePivot);
    airBrakes.push(brakePivot);
  }

  /* ---- 2. Razor-sharp multi-segment nose spear + recessed targeting optics ---- */
  const noseMid = taperBox(0.78, 0.46, 1.50, 0.74, 2.25, BODY, { map: hullTex, topPinch: 0.70, botPinch: 0.78, yShiftFront: -0.05 });
  noseMid.position.set(0, -0.02, -3.72);
  hull.add(noseMid);
  const noseTipLen = variant === 'hunter' ? 3.7 : 2.95;
  const noseCone = cone(0.56, noseTipLen, 4, BODY, { map: hullTex, flat: true });
  noseCone.rotation.x = -Math.PI / 2;
  noseCone.rotation.z = Math.PI / 4;
  noseCone.position.set(0, -0.05, -4.82 - noseTipLen * 0.46);
  hull.add(noseCone);
  const noseCap = cone(0.23, 1.12, 4, WING, { flat: true });
  noseCap.rotation.x = -Math.PI / 2;
  noseCap.rotation.z = Math.PI / 4;
  noseCap.position.set(0, -0.05, -4.82 - noseTipLen - 0.36);
  hull.add(noseCap);
  for (const s of [-1, 1]) {
    const nStripe = box(0.13, 0.13, 2.1, WING, { flat: true });
    nStripe.position.set(s * 0.54, 0.14, -3.62);
    nStripe.rotation.y = s * -0.14;
    hull.add(nStripe);
  }
  const chin = taperBox(0.34, 0.24, 0.58, 0.32, 1.45, DARKNAVY, { map: shipArmorTex });
  chin.position.set(0, -0.46, -3.55);
  hull.add(chin);
  const chinOptic = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), toonMat(0x102838, { emissive: ENG, emissiveIntensity: 1.9 }));
  chinOptic.position.set(0, -0.46, -4.28);
  hull.add(chinOptic);

  /* ---- 3. Detailed Cockpit Interior + Multi-Frame Specular Canopy ---- */
  const cFrame = taperBox(0.98, 0.42, 1.36, 0.58, 2.6, DARKNAVY, { map: shipArmorTex, topPinch: 0.78 });
  cFrame.position.set(0, 0.54, -1.25);
  hull.add(cFrame);
  // Pilot helmet silhouette + glowing tactical cockpit console inside the canopy!
  const pilotHelm = new THREE.Mesh(new THREE.SphereGeometry(0.30, 8, 7), toonMat(isRival ? 0x1a1424 : 0xeef4fc, { flat: true }));
  pilotHelm.position.set(0, 0.86, -1.05);
  hull.add(pilotHelm);
  const pilotVisor = box(0.36, 0.16, 0.22, 0x0c1a2e, { emissive: isRival ? 0xff425e : 0x5ae8ff, emissiveIntensity: 1.45, flat: true });
  pilotVisor.position.set(0, 0.88, -1.26);
  hull.add(pilotVisor);
  const hudConsole = box(0.42, 0.14, 0.08, 0x0a2234, { emissive: isRival ? 0xff4c66 : 0x66ffbe, emissiveIntensity: 1.85, flat: true });
  hudConsole.position.set(0, 0.82, -1.82);
  hull.add(hudConsole);

  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.66, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.56),
    toonMat(GLASS, { emissive: GLASS_EM, emissiveIntensity: 0.95, transparent: true, opacity: 0.72 })
  );
  canopy.scale.set(0.94, 0.96, 2.08);
  canopy.position.set(0, 0.68, -1.22);
  hull.add(canopy);
  // Twin structural canopy roll-bar ribs
  for (const rz of [-1.62, -0.78]) {
    const rib = box(0.96, 0.08, 0.14, DARKNAVY, { flat: true });
    rib.position.set(0, 1.15, rz);
    hull.add(rib);
  }
  // Rear dorsal fairing cowl + recessed radiator louvers + glowing telemetry diodes
  const dorsalCowling = taperBox(1.18, 0.64, 1.52, 0.74, 2.3, WING, { map: hullTex, topPinch: 0.68 });
  dorsalCowling.position.set(0, 0.52, 1.58);
  hull.add(dorsalCowling);
  for (let i = 0; i < 3; i++) {
    const louvre = box(0.88, 0.10, 0.22, DARKNAVY, { flat: true });
    louvre.position.set(0, 0.89, 0.86 + i * 0.52);
    hull.add(louvre);
  }
  // Hero radiator dorsal twin-vanes / Escort NOVA radar dome / Ace KIT twin upper dorsal booster pods
  if (variant === 'hero') {
    for (const s of [-1, 1]) {
      const heatFin = taperBox(0.09, 0.58, 0.12, 0.42, 1.55, BODY, { flat: true });
      heatFin.position.set(s * 0.44, 0.96, 2.15);
      heatFin.rotation.z = s * -0.18;
      hull.add(heatFin);
    }
  } else if (variant === 'escort') {
    const radDome = cyl(0.72, 0.86, 0.28, 12, BODY, { map: hullTex, flat: true });
    radDome.position.set(0, 1.06, 1.65);
    hull.add(radDome);
    const radRing = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.07, 5, 14), toonMat(0x143022, { emissive: ENG, emissiveIntensity: 1.6, flat: true }));
    radRing.rotation.x = Math.PI / 2;
    radRing.position.set(0, 1.08, 1.65);
    hull.add(radRing);
  } else if (variant === 'ace') {
    for (const s of [-1, 1]) {
      const topPod = taperBox(0.38, 0.36, 0.46, 0.44, 2.1, DARKNAVY, { map: shipArmorTex });
      topPod.position.set(s * 0.68, 0.95, 2.35);
      hull.add(topPod);
      const topNoz = cyl(0.18, 0.22, 0.26, 8, 0xfff4c2, { emissive: ENG, emissiveIntensity: 2.1 });
      topNoz.rotation.x = Math.PI / 2;
      topNoz.position.set(s * 0.68, 0.95, 3.45);
      hull.add(topNoz);
    }
  }

  /* ---- 4. Heroic Triple-Thruster Rear Engine Block + Spinning Plasma Turbine Ring ---- */
  const engineBlock = taperBox(2.24, 1.08, 2.08, 1.04, 2.05, NAVY, { map: shipArmorTex, topPinch: 0.86, botPinch: 0.86 });
  engineBlock.position.set(0, 0.02, 2.85);
  hull.add(engineBlock);

  const glowGroup = new THREE.Group();
  const engineGlows = [];
  const enginePetals = [];
  const enginePlumes = [];

  const mainOuter = cyl(0.78, 0.92, 1.22, 12, STEEL, { map: shipArmorTex, flat: true });
  mainOuter.rotation.x = Math.PI / 2;
  mainOuter.position.set(0, 0.04, 3.86);
  hull.add(mainOuter);
  const mainRim = new THREE.Mesh(new THREE.TorusGeometry(0.80, 0.11, 6, 16), toonMat(DARKNAVY, { flat: true }));
  mainRim.position.set(0, 0.04, 4.44);
  hull.add(mainRim);
  // Spinning inner plasma turbine ring visible right down the main jet nozzle!
  const turbineRing = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.075, 5, 12), toonMat(0x16384c, { emissive: ENG, emissiveIntensity: 2.2, flat: true }));
  turbineRing.position.set(0, 0.04, 4.46);
  hull.add(turbineRing);
  const mainCore = cyl(0.62, 0.50, 0.22, 12, 0xeefcff, { emissive: ENG, emissiveIntensity: 2.45 });
  mainCore.rotation.x = Math.PI / 2;
  mainCore.position.set(0, 0.04, 4.42);
  hull.add(mainCore);

  // 6 articulated mechanical thrust-vectoring petals around the main nozzle
  const mainPetalRig = new THREE.Group();
  mainPetalRig.position.set(0, 0.04, 4.44);
  for (let p = 0; p < 6; p++) {
    const a = (p / 6) * TAU;
    const petal = taperBox(0.18, 0.44, 0.14, 0.36, 0.68, DARKWING, { flat: true });
    petal.position.set(Math.cos(a) * 0.78, Math.sin(a) * 0.78, 0.14);
    petal.rotation.z = a;
    mainPetalRig.add(petal);
  }
  hull.add(mainPetalRig);
  enginePetals.push(mainPetalRig);

  const mainPlume = buildThrusterPlume(ENG, 0.74, 5.1);
  mainPlume.position.set(0, 0.04, 4.50);
  hull.add(mainPlume);
  enginePlumes.push(mainPlume);

  const mainGlow = glowSprite(ENG, 3.8, 0.96);
  mainGlow.position.set(0, 0.04, 4.78);
  glowGroup.add(mainGlow);
  engineGlows.push(mainGlow);

  // Twin flanking secondary afterburner pods
  for (const s of [-1, 1]) {
    const pod = taperBox(0.68, 0.70, 0.78, 0.76, 1.55, DARKNAVY, { map: shipArmorTex });
    pod.position.set(s * 1.26, -0.02, 3.26);
    hull.add(pod);
    const trim = box(0.80, 0.22, 1.15, WING, { flat: true });
    trim.position.set(s * 1.26, 0.35, 3.22);
    hull.add(trim);
    const port = cyl(0.28, 0.32, 0.18, 8, 0x0c1a2c, { emissive: ENG, emissiveIntensity: 2.15 });
    port.rotation.x = Math.PI / 2;
    port.position.set(s * 1.26, -0.02, 4.06);
    hull.add(port);

    const subPlume = buildThrusterPlume(ENG, 0.35, 3.0);
    subPlume.position.set(s * 1.26, -0.02, 4.10);
    hull.add(subPlume);
    enginePlumes.push(subPlume);

    const subGlow = glowSprite(ENG, 2.0, 0.86);
    subGlow.position.set(s * 1.26, -0.02, 4.38);
    glowGroup.add(subGlow);
    engineGlows.push(subGlow);
  }
  hull.add(glowGroup);

  /* ---- 5. Variant-Specific Articulated Main Wings, Live Ailerons & Upgradeable Weapon Pods ---- */
  const weaponPods = [];
  let flapL = null, flapR = null;

  function buildMainWing(sign) {
    const wg = new THREE.Group();
    const span = variant === 'escort' ? 5.05 : variant === 'ace' ? 5.85 : 5.4;
    const sweep = variant === 'hunter' ? -1.75 : variant === 'rival' ? -1.90 : 2.38;
    const chord = variant === 'escort' ? 2.4 : 1.98;

    // Primary sculpted titanium wing blade with 512px aerospace panel texture
    const bladeGeo = new THREE.BoxGeometry(span, 0.21, chord);
    bladeGeo.translate(span * 0.5, 0, 0);
    const pos = bladeGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), k = x / span;
      pos.setZ(i, pos.getZ(i) * (1 - k * 0.54) + k * sweep);
      pos.setY(i, pos.getY(i) * (1 - k * 0.45));
    }
    bladeGeo.computeVertexNormals();
    const blade = new THREE.Mesh(bladeGeo, toonMat(BODY, { map: hullTex, flat: true }));
    wg.add(blade);

    // Bold team-colour trailing/outer wing trim stripe
    const trimGeo = new THREE.BoxGeometry(span * 0.94, 0.24, 0.54);
    trimGeo.translate(span * 0.49, 0.01, chord * 0.34);
    const tp = trimGeo.attributes.position;
    for (let i = 0; i < tp.count; i++) {
      const k = tp.getX(i) / span;
      tp.setZ(i, tp.getZ(i) * (1 - k * 0.4) + k * sweep);
    }
    trimGeo.computeVertexNormals();
    wg.add(new THREE.Mesh(trimGeo, toonMat(WING, { flat: true })));

    // Dark leading edge armor rib
    const leGeo = new THREE.BoxGeometry(span * 0.92, 0.17, 0.30);
    leGeo.translate(span * 0.46, 0.0, -chord * 0.44);
    const lp = leGeo.attributes.position;
    for (let i = 0; i < lp.count; i++) {
      const k = lp.getX(i) / span;
      lp.setZ(i, lp.getZ(i) + k * sweep);
    }
    leGeo.computeVertexNormals();
    wg.add(new THREE.Mesh(leGeo, toonMat(DARKNAVY, { flat: true })));

    // Live articulated trailing-edge aileron control surface!
    const flapPivot = new THREE.Group();
    const flapK = 0.56;
    flapPivot.position.set(span * flapK, 0, chord * 0.46 + flapK * sweep);
    const flapMesh = box(span * 0.36, 0.11, 0.44, DARKNAVY, { flat: true });
    flapMesh.position.set(0, 0, 0.22);
    flapPivot.add(flapMesh);
    const flapEdge = box(span * 0.34, 0.13, 0.12, WING, { flat: true });
    flapEdge.position.set(0, 0, 0.40);
    flapPivot.add(flapEdge);
    wg.add(flapPivot);
    if (sign > 0) flapL = flapPivot; else flapR = flapPivot;

    // Sculpted wing-root G-Diffuser hinge housing + upgradeable underwing twin-coil laser pod
    const hinge = cyl(0.34, 0.40, 1.55, 8, STEEL, { map: shipArmorTex, flat: true });
    hinge.rotation.z = Math.PI / 2;
    hinge.position.set(0.65, -0.02, 0.15);
    wg.add(hinge);
    const podHousing = taperBox(0.36, 0.32, 0.46, 0.38, 1.85, DARKNAVY, { map: shipArmorTex });
    podHousing.position.set(1.42, -0.26, -0.45);
    wg.add(podHousing);
    const gunLen = variant === 'hunter' ? 2.85 : 2.35;
    const gunBarrel = cyl(0.11, 0.16, gunLen, 6, DARKNAVY, { flat: true });
    gunBarrel.rotation.x = Math.PI / 2;
    gunBarrel.position.set(1.42, -0.26, -1.35 - gunLen * 0.24);
    wg.add(gunBarrel);
    const coilMat = toonMat(0x143028, { emissive: isRival ? 0xff4d6d : 0x54ff9e, emissiveIntensity: 1.25, flat: true });
    const gunCoil = new THREE.Mesh(new THREE.TorusGeometry(0.20, 0.055, 5, 10), coilMat);
    gunCoil.position.set(1.42, -0.26, -2.05);
    wg.add(gunCoil);
    const muzzle = glowSprite(isRival ? 0xff4d6d : 0x72ffbe, 0.65, 0.78);
    muzzle.position.set(1.42, -0.26, -1.45 - gunLen * 0.72);
    wg.add(muzzle);
    weaponPods.push({ coilMat, muzzle, gunCoil });

    // Escort (NOVA) heavy armored twin-boom engine nacelles WITH live emerald plasma plumes!
    if (variant === 'escort') {
      const boom = taperBox(0.70, 0.56, 0.92, 0.68, 3.75, WING, { map: hullTex, topPinch: 0.8 });
      boom.position.set(2.55, 0.04, 0.55);
      wg.add(boom);
      const boomNoz = cyl(0.32, 0.38, 0.45, 8, DARKNAVY, { flat: true });
      boomNoz.rotation.x = Math.PI / 2;
      boomNoz.position.set(2.55, 0.04, 2.52);
      wg.add(boomNoz);
      const boomCap = cyl(0.26, 0.24, 0.14, 8, 0xe8fff2, { emissive: ENG, emissiveIntensity: 2.1 });
      boomCap.rotation.x = Math.PI / 2;
      boomCap.position.set(2.55, 0.04, 2.74);
      wg.add(boomCap);
      const boomPlume = buildThrusterPlume(ENG, 0.30, 2.65);
      boomPlume.position.set(2.55, 0.04, 2.78);
      wg.add(boomPlume);
      enginePlumes.push(boomPlume);
      const boomGlow = glowSprite(ENG, 1.55, 0.82);
      boomGlow.position.set(2.55, 0.04, 2.95);
      wg.add(boomGlow);
      engineGlows.push(boomGlow);
    }

    // Upturned angular winglet tip (Ace KIT gets stacked upper+ventral golden feather winglets!)
    const tipZ = sweep * 0.88;
    const tip = taperBox(0.28, variant === 'ace' ? 2.25 : 1.62, 0.24, variant === 'ace' ? 1.9 : 1.38, 1.15, WING, { topPinch: 0.65 });
    tip.position.set(span - 0.1, 0.56, tipZ);
    tip.rotation.z = variant === 'ace' ? -0.32 : -0.50;
    wg.add(tip);
    const tipEdge = box(0.20, 0.68, 1.12, BODY, { flat: true });
    tipEdge.position.set(span - 0.26, 0.02, tipZ);
    tipEdge.rotation.z = -0.50;
    wg.add(tipEdge);
    if (variant === 'ace') {
      const lowerTip = taperBox(0.22, 1.35, 0.18, 1.10, 0.96, DARKWING, { topPinch: 0.65 });
      lowerTip.position.set(span - 0.16, -0.56, tipZ + 0.15);
      lowerTip.rotation.z = 0.58;
      wg.add(lowerTip);
    }
    const nav = glowSprite(sign > 0 ? 0x42ff82 : 0xff4d66, 1.0, 0.88);
    nav.position.set(span + 0.16, 1.24, tipZ);
    wg.add(nav);

    wg.position.set(sign * 0.98, -0.10, 0.85);
    wg.rotation.z = sign * (variant === 'ace' ? 0.18 : 0.08);
    wg.userData.baseRotZ = wg.rotation.z;
    wg.scale.x = sign;
    return wg;
  }
  const wingL = buildMainWing(1);
  const wingR = buildMainWing(-1);
  hull.add(wingL, wingR);

  /* ---- 6. Iconic 4-Fin X-Configuration Rear Stabilizers (upper + lower angled blades!) ---- */
  for (const s of [1, -1]) {
    const upperAngle = variant === 'hunter' ? -0.20 : -0.62;
    const upperFin = taperBox(0.18, variant === 'hunter' ? 2.65 : 2.38, 0.16, 2.12, 1.48, WING, { map: hullTex, topPinch: 0.72 });
    upperFin.position.set(s * 1.48, 1.26, 2.36);
    upperFin.rotation.z = s * upperAngle;
    upperFin.rotation.x = -0.18;
    hull.add(upperFin);
    const upperWhite = box(0.22, 1.08, 0.44, BODY, { flat: true });
    upperWhite.position.set(s * 1.72, 1.62, 1.86);
    upperWhite.rotation.z = s * upperAngle;
    hull.add(upperWhite);

    const lowerFin = taperBox(0.16, 1.88, 0.14, 1.68, 1.38, isRival ? WING : DARKWING, { topPinch: 0.76 });
    lowerFin.position.set(s * 1.42, -1.04, 2.44);
    lowerFin.rotation.z = s * 0.64;
    lowerFin.rotation.x = 0.14;
    hull.add(lowerFin);
    const lowerAccent = box(0.18, 0.74, 0.36, WING, { flat: true });
    lowerAccent.position.set(s * 1.76, -1.44, 2.44);
    lowerAccent.rotation.z = s * 0.64;
    hull.add(lowerAccent);
  }

  // Hunter (VEGA) extra forward nose canards + Rival Thorne Wolfen-grade interceptor blades & crimson intakes
  if (variant === 'hunter' || isRival) {
    for (const s of [1, -1]) {
      const canard = taperBox(1.55, 0.12, 1.20, 0.14, 0.78, WING, { flat: true });
      canard.position.set(s * 1.08, -0.08, -3.18);
      canard.rotation.y = s * -0.45;
      canard.rotation.z = s * 0.15;
      hull.add(canard);
    }
  }
  if (isRival) {
    for (const s of [1, -1]) {
      const strake = taperBox(0.32, 0.44, 0.65, 0.68, 4.4, DARKNAVY, { map: shipArmorTex, topPinch: 0.65 });
      strake.position.set(s * 2.85, 0.08, -1.8);
      strake.rotation.y = s * -0.18;
      hull.add(strake);
      const bladeEdge = box(0.14, 0.22, 3.6, 0x260812, { emissive: 0xff3b58, emissiveIntensity: 1.75, flat: true });
      bladeEdge.position.set(s * 2.95, 0.26, -1.9);
      bladeEdge.rotation.y = s * -0.18;
      hull.add(bladeEdge);
      const dorsalCrest = taperBox(0.16, 1.35, 0.22, 1.75, 2.8, WING, { topPinch: 0.45 });
      dorsalCrest.position.set(s * 0.72, 1.32, 1.35);
      dorsalCrest.rotation.z = s * -0.26;
      hull.add(dorsalCrest);
    }
  }

  /* ---- Trail & weapon anchors ---- */
  const tipX = variant === 'ace' ? 6.5 : 6.1;
  const tipZ = variant === 'hunter' || isRival ? -0.6 : 2.95;
  const tipL = new THREE.Object3D(); tipL.position.set(tipX, 0.45, tipZ); g.add(tipL);
  const tipR = new THREE.Object3D(); tipR.position.set(-tipX, 0.45, tipZ); g.add(tipR);
  const noseAnchor = new THREE.Object3D(); noseAnchor.position.set(0, -0.02, -7.85); g.add(noseAnchor);

  g.userData = {
    engineGlow: glowGroup, engineGlows, enginePetals, enginePlumes, turbineRing,
    wingL, wingR, flapL, flapR, airBrakes, weaponPods,
    tipL, tipR, noseAnchor, hull,
  };
  return g;
}

/* ============ PROCEDURAL ENEMIES & FALLBACKS (V70 multi-layered aerospace armor & weapons) ============ */
export function buildDrone(tint = 0x3a4668) {
  const g = new THREE.Group();
  const hull = taperBox(2.2, 1.3, 3.6, 1.85, 5.8, tint, { map: shipArmorTex, topPinch: 0.72, botPinch: 0.86 });
  g.add(hull);
  const dorsal = taperBox(1.4, 0.55, 2.2, 0.82, 4.4, 0x222c44, { map: shipArmorTex, topPinch: 0.66 });
  dorsal.position.set(0, 1.05, 0.45); g.add(dorsal);
  const visor = box(1.42, 0.38, 1.8, 0x162238, { emissive: 0xff6230, emissiveIntensity: 1.55, flat: true });
  visor.position.set(0, 0.70, -1.65); visor.rotation.x = 0.22; g.add(visor);
  const visorRib = box(0.18, 0.42, 1.75, 0x1e283c, { flat: true });
  visorRib.position.set(0, 0.74, -1.65); visorRib.rotation.x = 0.22; g.add(visorRib);
  const cowl = cone(1.15, 3.2, 4, 0xc83828, { map: shipArmorTex, flat: true });
  cowl.rotation.x = -Math.PI / 2; cowl.rotation.z = Math.PI / 4; cowl.position.set(0, -0.05, -4.3); g.add(cowl);
  const keel = taperBox(0.24, 0.75, 0.38, 0.95, 3.6, 0x1e283c, { map: shipArmorTex });
  keel.position.set(0, -1.15, 0.6); g.add(keel);
  for (const s of [1, -1]) {
    // Flanking armored air-intake cowls + glowing intake louvers
    const intake = taperBox(0.95, 0.82, 1.25, 0.98, 3.4, 0x24304a, { map: shipHazardTex });
    intake.position.set(s * 1.95, 0.08, -0.5); g.add(intake);
    const grille = box(0.68, 0.42, 0.16, 0x261214, { emissive: 0xff7a3e, emissiveIntensity: 1.6, flat: true });
    grille.position.set(s * 1.95, 0.08, -2.22); g.add(grille);
    const wing = box(5.6, 0.28, 2.5, 0x2b3654, { map: shipArmorTex, flat: true });
    wing.position.set(s * 3.8, -0.15, 0.5); wing.rotation.z = s * 0.28; wing.rotation.y = s * -0.22; g.add(wing);
    const rib = box(5.2, 0.36, 0.50, 0x3b4864, { map: shipHazardTex, flat: true });
    rib.position.set(s * 3.6, -0.10, -0.62); rib.rotation.z = s * 0.28; rib.rotation.y = s * -0.22; g.add(rib);
    const trimGlow = box(4.8, 0.16, 0.22, 0x2c1218, { emissive: 0xff6a3c, emissiveIntensity: 1.45, flat: true });
    trimGlow.position.set(s * 3.6, 0.06, 1.38); trimGlow.rotation.z = s * 0.28; trimGlow.rotation.y = s * -0.22; g.add(trimGlow);
    const wtip = taperBox(0.45, 1.65, 0.55, 1.35, 2.0, 0xc83828, { map: shipArmorTex });
    wtip.position.set(s * 6.1, 0.42, 0.7); wtip.rotation.z = s * 0.28; g.add(wtip);
    const cannon = cyl(0.18, 0.26, 2.9, 6, 0x182030, { flat: true });
    cannon.rotation.x = Math.PI / 2; cannon.position.set(s * 2.4, -0.72, -1.7); g.add(cannon);
    const missilePod = cyl(0.24, 0.24, 1.9, 6, 0x3a4860, { map: shipHazardTex, flat: true });
    missilePod.rotation.x = Math.PI / 2; missilePod.position.set(s * 4.2, -0.58, 0.1); g.add(missilePod);
    const tailFin = box(0.24, 1.55, 1.5, 0xc83828, { map: shipArmorTex, flat: true });
    tailFin.position.set(s * 1.4, 1.0, 2.2); tailFin.rotation.z = s * -0.38; g.add(tailFin);
    const nozzle = cyl(0.55, 0.70, 0.85, 8, 0x1e283c, { map: shipArmorTex, flat: true });
    nozzle.rotation.x = Math.PI / 2; nozzle.position.set(s * 0.95, -0.05, 3.2); g.add(nozzle);
    const plume = buildThrusterPlume(0xff8a3e, 0.64, 4.6, 'combatEnginePlume');
    plume.position.set(s * 0.95, -0.05, 3.6); g.add(plume);
  }
  const eye = glowSprite(0xffb830, 3.3);
  eye.position.set(0, 0, -5.6);
  g.add(eye);
  g.userData.glow = eye;
  g.userData.meshScale = 1.50;
  return g;
}

export function buildLancer(tint = 0x723142) {
  const g = new THREE.Group();
  const fuselage = taperBox(1.4, 1.0, 2.8, 1.7, 7.8, tint, { map: shipArmorTex, topPinch: 0.68, botPinch: 0.85 });
  g.add(fuselage);
  const nose = cone(1.15, 3.8, 4, tint, { map: shipArmorTex, flat: true });
  nose.rotation.x = -Math.PI / 2; nose.rotation.z = Math.PI / 4; nose.position.set(0, -0.05, -5.5); g.add(nose);
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.88, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.56),
    toonMat(0x1f283d, { emissive: 0xff4c60, emissiveIntensity: 1.45, flat: true })
  );
  canopy.scale.set(0.95, 0.82, 2.25); canopy.position.set(0, 0.72, -1.4); g.add(canopy);
  const spine = taperBox(0.85, 0.8, 1.25, 1.35, 5.4, 0x3c2030, { map: shipHazardTex });
  spine.position.set(0, 0.98, 1.25); g.add(spine);
  const dorsalFin = box(0.24, 2.2, 2.1, 0xc93548, { map: shipArmorTex, flat: true });
  dorsalFin.position.set(0, 2.05, 2.5); dorsalFin.rotation.x = -0.35; g.add(dorsalFin);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.34, 6, 12), toonMat(0x2a1620, { emissive: 0xff4555, emissiveIntensity: 0.85, flat: true }));
  ring.position.set(0, 0, 4.0); g.add(ring);
  for (const s of [1, -1]) {
    // Swept forward nose canards + armored flanking intakes + plasma leading edge rails!
    const canard = taperBox(2.2, 0.16, 1.5, 0.18, 1.1, 0xc93548, { map: shipHazardTex });
    canard.position.set(s * 1.45, -0.04, -3.5); canard.rotation.y = s * -0.45; canard.rotation.z = s * 0.16; g.add(canard);
    const intake = taperBox(0.85, 0.72, 1.1, 0.88, 3.6, 0x2c1824, { map: shipArmorTex });
    intake.position.set(s * 1.65, -0.05, -0.2); g.add(intake);
    const wing = box(6.8, 0.28, 2.8, 0x3c2030, { map: shipArmorTex, flat: true });
    wing.position.set(s * 3.6, -0.15, 1.8); wing.rotation.z = s * 0.14; wing.rotation.y = s * -0.34; g.add(wing);
    const edge = box(6.2, 0.34, 0.68, tint, { map: shipHazardTex, flat: true });
    edge.position.set(s * 3.4, 0, 0.62); edge.rotation.y = s * -0.34; g.add(edge);
    const glowStrip = box(5.4, 0.16, 0.22, 0x381018, { emissive: 0xff5268, emissiveIntensity: 1.6, flat: true });
    glowStrip.position.set(s * 3.5, 0.14, 2.55); glowStrip.rotation.y = s * -0.34; g.add(glowStrip);
    const gun = cyl(0.20, 0.28, 3.4, 6, 0x1b1420, { flat: true });
    gun.rotation.x = Math.PI / 2; gun.position.set(s * 5.9, -0.12, 1.3); g.add(gun);
    const tip = glowSprite(0xff5560, 2.3);
    tip.position.set(s * 5.9, -0.12, -0.4); g.add(tip);
    const subPlume = buildThrusterPlume(0xff5a40, 0.62, 4.4, 'combatEnginePlume');
    subPlume.position.set(s * 1.15, -0.1, 4.1); g.add(subPlume);
  }
  const plume = buildThrusterPlume(0xff5a40, 1.15, 6.4, 'combatEnginePlume');
  plume.position.set(0, 0, 4.2); g.add(plume);
  const eng = glowSprite(0xff8560, 3.6);
  eng.position.set(0, 0, 4.4);
  g.add(eng);
  g.userData.glow = eng;
  g.userData.meshScale = 1.50;
  return g;
}

/** Iconic Star Fox armoured claw-petal pod with articulated blooming petals & pulsing magenta core (STAR_FOX_2.jpeg) */
export function buildPod() {
  const g = new THREE.Group();
  // Counter-rotating metallic gyroscopic containment rings
  const frameRing = new THREE.Mesh(
    new THREE.TorusGeometry(3.45, 0.52, 8, 18),
    toonMat(0x525d72, { map: shipArmorTex, normalMap: shipArmorNormal, normalScale: new THREE.Vector2(0.45, 0.45), flat: true, emissive: 0x3b1f38, emissiveIntensity: 0.45 })
  );
  g.add(frameRing);
  const frameCross = new THREE.Mesh(
    new THREE.TorusGeometry(3.25, 0.40, 6, 16),
    toonMat(0x3a4354, { emissive: 0xff3d8f, emissiveIntensity: 0.52, flat: true })
  );
  frameCross.rotation.y = Math.PI / 2;
  g.add(frameCross);

  // Glowing magenta core eye + armored aperture iris ring
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(2.25, 14, 12),
    toonMat(0x882055, { emissive: 0xff2f8c, emissiveIntensity: 2.35 })
  );
  g.add(core);

  // 4 articulated heavy orange-ochre armoured shell petals that physically hinge open during plasma volley!
  const shellMat = toonMat(0xdc8432, { map: shipArmorTex, normalMap: shipArmorNormal, normalScale: new THREE.Vector2(0.55, 0.55), flat: true, emissive: 0x3b1e08, emissiveIntensity: 0.28 });
  const trimMat = toonMat(0x7c869a, { map: shipHazardTex, normalMap: shipArmorNormal, normalScale: new THREE.Vector2(0.4, 0.4), flat: true });
  const spikeMat = toonMat(0x283244, { flat: true });
  const petals = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU;
    const petalGroup = new THREE.Group();
    petalGroup.rotation.y = a;
    const hinge = new THREE.Group();
    const petal = new THREE.Mesh(
      new THREE.SphereGeometry(4.5, 10, 8, 0, Math.PI * 0.58, 0.40, Math.PI * 0.68),
      shellMat
    );
    hinge.add(petal);
    const rib = box(0.75, 5.4, 1.2, 0x7c869a, { flat: true });
    rib.material = trimMat;
    rib.position.set(4.15, 0, 0);
    hinge.add(rib);
    const knuckle = box(1.3, 1.1, 1.6, 0x3a4558, { flat: true });
    knuckle.material = spikeMat;
    knuckle.position.set(4.35, 0, 0);
    hinge.add(knuckle);
    const spike = cone(0.32, 2.1, 5, 0x283244, { flat: true });
    spike.material = spikeMat;
    spike.rotation.z = -Math.PI / 2;
    spike.position.set(5.45, 0, 0);
    hinge.add(spike);
    const tipLight = glowSprite(0xffa042, 2.2, 0.88);
    tipLight.position.set(4.65, 1.6, 0);
    hinge.add(tipLight);
    petalGroup.add(hinge);
    g.add(petalGroup);
    petals.push(hinge);
  }
  const glow = glowSprite(0xff3d8f, 6.8, 0.96);
  g.add(glow);
  g.userData.glow = glow;
  g.userData.petals = petals;
  g.userData.frameCross = frameCross;
  g.userData.core = core;
  g.userData.meshScale = 1.46;
  return g;
}

export function buildTurret(tint = 0x4a5568) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(4.0, 5.4, 3.6, 8), toonMat(tint, { map: shipArmorTex, flat: true }));
  base.position.y = 1.8;
  g.add(base);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.8, 0.9, 10), toonMat(0x283242, { flat: true }));
  collar.position.y = 3.8;
  g.add(collar);
  const head = new THREE.Mesh(new THREE.SphereGeometry(2.9, 10, 8), toonMat(0x39445c, { map: shipArmorTex, flat: true }));
  head.position.y = 4.6;
  g.add(head);
  const visor = box(2.4, 0.65, 0.6, 0x16202e, { emissive: 0xff6238, emissiveIntensity: 1.5, flat: true });
  visor.position.set(0, 5.0, -2.55);
  g.add(visor);
  const barrel = new THREE.Group();
  barrel.position.set(0, 5.5, -2.6);
  for (const sx of [-0.75, 0.75]) {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.52, 6.0, 8), toonMat(0x1f283a));
    tube.rotation.x = Math.PI / 2.6;
    tube.position.set(sx, 0, 0);
    barrel.add(tube);
    const cool = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.55, 8), toonMat(0x52627a, { emissive: 0xff7040, emissiveIntensity: 0.7, flat: true }));
    cool.rotation.x = Math.PI / 2.6;
    cool.position.set(sx, 0.5, -1.1);
    barrel.add(cool);
  }
  g.add(barrel);
  const glow = glowSprite(0xff7040, 3.0);
  glow.position.set(0, 5.7, -5.0);
  g.add(glow);
  g.userData.glow = glow;
  g.userData.barrel = barrel;
  g.userData.meshScale = 1.24;
  return g;
}

export function buildMine() {
  const g = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(3.2, 0),
    toonMat(0x4b2438, { map: shipArmorTex, normalMap: shipArmorNormal, normalScale: new THREE.Vector2(0.55, 0.55), flat: true, emissive: 0xff2244, emissiveIntensity: 0.78 })
  );
  g.add(core);
  const band = new THREE.Mesh(
    new THREE.TorusGeometry(3.4, 0.36, 6, 14),
    toonMat(0x3a242c, { map: shipHazardTex, flat: true, emissive: 0xff3b58, emissiveIntensity: 0.95 })
  );
  g.add(band);
  const bandB = new THREE.Mesh(
    new THREE.TorusGeometry(3.35, 0.28, 6, 14),
    toonMat(0x261522, { flat: true, emissive: 0xff7a38, emissiveIntensity: 0.85 })
  );
  bandB.rotation.x = Math.PI / 2;
  g.add(bandB);
  const spikeMat = toonMat(0x2d1828, { flat: true, emissive: 0x5c1424, emissiveIntensity: 0.48 });
  const tipMat = toonMat(0x4a1622, { flat: true, emissive: 0xff3b58, emissiveIntensity: 1.6 });
  for (let i = 0; i < 12; i++) {
    const sp = cone(0.68, 2.7, 4, 0x2e1c30);
    sp.material = spikeMat;
    const dir = new THREE.Vector3().setFromSphericalCoords(3.1, Math.acos(1 - 2 * ((i + 0.5) / 12)), i * 2.39996);
    sp.position.copy(dir);
    sp.lookAt(dir.clone().multiplyScalar(2));
    sp.rotateX(Math.PI / 2);
    g.add(sp);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.32, 6, 5), tipMat);
    tip.position.copy(dir).multiplyScalar(1.42);
    g.add(tip);
  }
  const glow = glowSprite(0xff2848, 5.8, 0.95);
  g.add(glow);
  g.userData.glow = glow;
  g.userData.bandA = band;
  g.userData.bandB = bandB;
  g.userData.meshScale = 1.32;
  return g;
}

export function buildRay(tint = 0x3f6d8a) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(2.4, 12, 8), toonMat(tint, { map: shipArmorTex, normalMap: shipArmorNormal, normalScale: new THREE.Vector2(0.45, 0.45), flat: true }));
  body.scale.set(2.9, 0.52, 1.65);
  g.add(body);
  const crest = taperBox(1.3, 0.55, 2.1, 0.85, 5.4, 0x244660, { map: shipHazardTex, topPinch: 0.65 });
  crest.position.set(0, 0.72, 0.2); g.add(crest);
  const spineGlow = box(0.32, 0.18, 4.4, 0x0e2c3e, { emissive: 0x62f6ff, emissiveIntensity: 1.75, flat: true });
  spineGlow.position.set(0, 1.16, 0.35); g.add(spineGlow);
  const visor = box(1.9, 0.38, 1.25, 0x102838, { emissive: 0x62f0ff, emissiveIntensity: 1.7, flat: true });
  visor.position.set(0, 0.65, -2.35); g.add(visor);
  for (const s of [-1, 1]) {
    const rail = box(5.0, 0.22, 0.55, 0x1a384c, { emissive: 0x5ae8ff, emissiveIntensity: 1.35, flat: true });
    rail.position.set(s * 4.5, 0.08, -0.75); rail.rotation.y = s * -0.32; g.add(rail);
    const tipBlade = taperBox(0.32, 1.35, 0.44, 1.0, 2.4, 0x1b3a52, { map: shipArmorTex });
    tipBlade.position.set(s * 6.7, 0.36, 0.25); tipBlade.rotation.z = s * -0.45; g.add(tipBlade);
    const emitter = cyl(0.24, 0.32, 2.8, 6, 0x1a2838, { flat: true });
    emitter.rotation.x = Math.PI / 2; emitter.position.set(s * 3.1, -0.58, -1.9); g.add(emitter);
    const fin = box(0.24, 1.75, 2.1, 0x2a526e, { map: shipArmorTex, flat: true });
    fin.position.set(s * 2.1, 0.68, 3.2); fin.rotation.z = s * -0.42; g.add(fin);
    const plume = buildThrusterPlume(0x5ae8ff, 0.68, 4.6, 'combatEnginePlume');
    plume.position.set(s * 1.4, -0.05, 3.5); g.add(plume);
  }
  const tail = taperBox(0.55, 0.22, 0.20, 0.14, 6.4, tint, { map: shipArmorTex });
  tail.position.z = 5.0;
  g.add(tail);
  const eye = glowSprite(0x7fe9ff, 3.2);
  eye.position.z = -3.4;
  g.add(eye);
  g.userData.glow = eye;
  g.userData.body = body;
  g.userData.meshScale = 1.50;
  return g;
}

/* ============ ELITE / CAPITAL SHIPS (V63 armor-plated & sculpted) ============ */
export function buildGunship() {
  const g = new THREE.Group();
  const hullMat = toonMat(0x5a3444, { map: shipArmorTex, normalMap: shipArmorNormal, normalScale: new THREE.Vector2(0.45, 0.45), flat: true });
  const dark = toonMat(0x2e1c26, { map: shipArmorTex, normalMap: shipArmorNormal, normalScale: new THREE.Vector2(0.45, 0.45), flat: true });
  const gunMat = toonMat(0x1c1218);
  const hull = taperBox(6.4, 3.2, 8.2, 4.0, 18.5, 0x5a3444, { map: shipArmorTex, topPinch: 0.78 }); g.add(hull);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(3.4, 7.6, 4), hullMat);
  bow.rotation.x = -Math.PI / 2; bow.rotation.y = Math.PI / 4; bow.position.z = -12.6; g.add(bow);
  const deck = taperBox(4.8, 1.5, 5.8, 1.9, 12.0, 0x704252, { map: shipHazardTex }); deck.position.set(0, 2.5, 1.2); g.add(deck);
  const bridge = taperBox(2.8, 2.6, 3.6, 3.0, 4.2, 0x3a2634, { map: shipWindowTex, emissive: 0x8fe6ff, emissiveMap: shipWindowTex, emissiveIntensity: 0.65 }); bridge.position.set(0, 4.6, 4.2); g.add(bridge);
  const bridgeWin = box(2.7, 0.56, 0.22, 0x0f2030, { emissive: 0x8fe6ff, emissiveIntensity: 2.0 });
  bridgeWin.position.set(0, 5.0, 2.1); g.add(bridgeWin);
  // Spinning dorsal AWACS fire-control radar!
  const radar = new THREE.Group();
  radar.name = 'combatRadar';
  radar.position.set(0, 6.4, 4.2);
  radar.add(cyl(0.22, 0.30, 1.4, 6, 0x2e1c26, { flat: true }));
  const rBar = box(3.2, 0.45, 0.36, 0x4b5668, { map: shipHazardTex, flat: true });
  rBar.position.y = 0.75; radar.add(rBar);
  g.add(radar);
  for (const [tz, ty] of [[-5.6, 2.3], [-1.0, 3.8], [5.6, 2.3]]) {
    const tur = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.85, 1.2, 8), dark);
    tur.position.set(0, ty + 0.5, tz); g.add(tur);
    for (const s of [0.5, -0.5]) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 3.8, 6), gunMat);
      bar.rotation.x = Math.PI / 2; bar.position.set(s, ty + 0.78, tz - 2.4); g.add(bar);
    }
  }
  for (const s of [1, -1]) {
    const belt = box(1.2, 2.3, 15.8, 0x2e1c26, { map: shipHazardTex, flat: true }); belt.position.set(s * 4.3, -0.3, 0); g.add(belt);
    const podGlow = box(0.32, 0.8, 8.8, 0x381218, { emissive: 0xff5a3c, emissiveIntensity: 1.55, flat: true });
    podGlow.position.set(s * 4.95, 0.1, -1.5); g.add(podGlow);
    const cowl = cyl(1.25, 1.55, 2.2, 8, 0x2e1c26, { map: shipArmorTex, flat: true });
    cowl.rotation.x = Math.PI / 2; cowl.position.set(s * 2.0, 0, 9.2); g.add(cowl);
    const plume = buildThrusterPlume(0xff7030, 1.35, 7.8, 'combatEnginePlume');
    plume.position.set(s * 2.0, 0, 10.2); g.add(plume);
    const eng = glowSprite(0xff8a3e, 4.0); eng.position.set(s * 2.0, 0, 10.6); g.add(eng);
  }
  const eye = glowSprite(0xff3040, 4.4); eye.position.set(0, 0.6, -15.2); g.add(eye);
  g.userData.glow = eye;
  g.userData.meshScale = 1.30;
  return g;
}

export function buildSaucer() {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(6.2, 6.2, 1.1, 24), toonMat(0x707c94, { map: shipArmorTex, normalMap: shipArmorNormal, normalScale: new THREE.Vector2(0.45, 0.45), flat: true }));
  g.add(disc);
  const rimTop = new THREE.Mesh(new THREE.CylinderGeometry(4.3, 6.0, 1.15, 24), toonMat(0x5c6984, { map: shipArmorTex, normalMap: shipArmorNormal, normalScale: new THREE.Vector2(0.42, 0.42), flat: true }));
  rimTop.position.y = 1.05; g.add(rimTop);
  const rimBot = new THREE.Mesh(new THREE.CylinderGeometry(6.0, 3.2, 1.25, 24), toonMat(0x454f66, { map: shipHazardTex, normalMap: shipArmorNormal, normalScale: new THREE.Vector2(0.42, 0.42), flat: true }));
  rimBot.position.y = -1.05; g.add(rimBot);
  const plasmaRim = new THREE.Mesh(new THREE.TorusGeometry(6.25, 0.24, 6, 24), toonMat(0x163834, { emissive: 0x62ffe0, emissiveIntensity: 1.65, flat: true }));
  plasmaRim.rotation.x = Math.PI / 2; g.add(plasmaRim);
  const gyroRing = new THREE.Mesh(new THREE.TorusGeometry(7.2, 0.16, 6, 22), toonMat(0x142c38, { emissive: 0x72f4ff, emissiveIntensity: 1.25, flat: true }));
  gyroRing.name = 'combatGyroA';
  gyroRing.rotation.x = 0.45; g.add(gyroRing);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(2.5, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
    toonMat(0x9fe8d8, { emissive: 0x3fd0a8, emissiveIntensity: 1.2, transparent: true, opacity: 0.92 }));
  dome.position.y = 1.45; g.add(dome);
  const lights = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const node = box(0.72, 0.58, 0.95, 0x243044, { map: shipArmorTex, flat: true });
    node.position.set(Math.cos(a) * 6.0, 0, Math.sin(a) * 6.0);
    node.rotation.y = -a; lights.add(node);
    const l = glowSprite(i % 2 ? 0xffd66b : 0x7fe9ff, 2.3);
    l.position.set(Math.cos(a) * 5.6, 0.2, Math.sin(a) * 5.6); lights.add(l);
  }
  g.add(lights);
  const beam = glowSprite(0x8fffe0, 5.2); beam.position.y = -2.5; g.add(beam);
  g.userData.glow = beam; g.userData.lights = lights;
  g.userData.meshScale = 1.25;
  return g;
}

export function buildCarrier() {
  const g = new THREE.Group();
  const dark = toonMat(0x283246, { map: shipArmorTex, normalMap: shipArmorNormal, normalScale: new THREE.Vector2(0.45, 0.45), flat: true });
  const hull = taperBox(9.2, 3.8, 11.2, 4.6, 21.5, 0x44526b, { map: shipArmorTex, topPinch: 0.85 }); g.add(hull);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(12.6, 0.9, 22.5), dark); deck.position.y = 2.6; g.add(deck);
  const stripe = box(1.2, 0.16, 20.8, 0x4b586e, { map: shipHazardTex, emissive: 0xaa8020, emissiveIntensity: 0.55 });
  stripe.position.y = 3.1; g.add(stripe);
  const island = taperBox(2.6, 3.6, 3.1, 4.0, 6.0, 0x44526b, { map: shipWindowTex, emissive: 0x8fe6ff, emissiveMap: shipWindowTex, emissiveIntensity: 0.65 }); island.position.set(4.1, 4.8, 4.0); g.add(island);
  const islWin = box(2.3, 0.56, 0.20, 0x0f2030, { emissive: 0x8fe6ff, emissiveIntensity: 1.95 });
  islWin.position.set(4.1, 5.6, 0.95); g.add(islWin);
  const radar = new THREE.Group();
  radar.name = 'combatRadar';
  radar.position.set(4.1, 7.2, 4.0);
  radar.add(cyl(0.22, 0.30, 1.6, 6, 0x283246, { flat: true }));
  const rBar = box(3.6, 0.42, 0.32, 0x4b586e, { map: shipHazardTex, flat: true });
  rBar.position.y = 0.8; radar.add(rBar);
  g.add(radar);
  const bayGlow = box(6.0, 2.4, 0.5, 0x101820, { emissive: 0xff9e4a, emissiveIntensity: 2.0 });
  bayGlow.position.set(0, -0.2, -11.0); g.add(bayGlow);
  for (const s of [1, -1]) {
    const spon = box(2.4, 2.9, 13.8, 0x283246, { map: shipHazardTex, flat: true }); spon.position.set(s * 6.5, -0.8, 1.5); g.add(spon);
    const noz = cyl(1.4, 1.7, 2.4, 8, 0x283246, { map: shipArmorTex, flat: true });
    noz.rotation.x = Math.PI / 2; noz.position.set(s * 3.5, -0.3, 11.0); g.add(noz);
    const plume = buildThrusterPlume(0x7fb0ff, 1.55, 8.8, 'combatEnginePlume');
    plume.position.set(s * 3.5, -0.3, 12.0); g.add(plume);
    const eng = glowSprite(0x7fb0ff, 3.8); eng.position.set(s * 3.5, -0.3, 12.2); g.add(eng);
  }
  const glow = glowSprite(0xff9e4a, 4.6); glow.position.set(0, -0.2, -11.6); g.add(glow);
  g.userData.glow = glow;
  return g;
}

/** AEGIS SIEGE CARRIER — monumental armoured capital command ship */
export function buildSiegeCarrier() {
  const g = new THREE.Group();
  const normScale = new THREE.Vector2(0.5, 0.5);
  const hull = toonMat(0x6e8ec2, { map: shipArmorTex, normalMap: shipArmorNormal, normalScale: normScale, flat: true, emissive: 0x1e2c44, emissiveIntensity: 0.45 });
  const armour = toonMat(0x3a4e6e, { map: shipArmorTex, normalMap: shipArmorNormal, normalScale: normScale, flat: true, emissive: 0x121c2c, emissiveIntensity: 0.4 });
  const hazard = toonMat(0x4b5c78, { map: shipHazardTex, normalMap: shipArmorNormal, normalScale: normScale, flat: true });
  const trim = toonMat(0xa4c4ee, { map: arwingPanelTex, flat: true, emissive: 0x263854, emissiveIntensity: 0.35 });
  const gunMat = toonMat(0x1b2434, { flat: true });

  const keel = taperBox(10.6, 3.6, 13.0, 4.5, 25.0, 0x6e8ec2, { map: shipArmorTex, topPinch: 0.86 }); keel.position.y = -0.4; g.add(keel);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(14.6, 0.85, 26.5), armour); deck.position.y = 2.15; g.add(deck);
  const deckStripe = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.16, 24.0), hazard); deckStripe.position.y = 2.62; g.add(deckStripe);
  const bridge = taperBox(4.0, 3.6, 4.8, 4.2, 6.8, 0xa4c4ee, { map: shipWindowTex, emissive: 0x70dfff, emissiveMap: shipWindowTex, emissiveIntensity: 0.65 }); bridge.position.set(3.8, 4.4, 2.8); g.add(bridge);
  const bridgeGlass = box(3.8, 0.70, 0.22, 0x112033, { emissive: 0x70dfff, emissiveIntensity: 2.0 });
  bridgeGlass.position.set(3.8, 5.0, -0.65); g.add(bridgeGlass);
  const spine = taperBox(1.4, 1.3, 1.9, 1.6, 22.0, 0xa4c4ee, { map: arwingPanelTex }); spine.position.set(0, 2.9, 0); g.add(spine);

  for (const s of [-1, 1]) {
    // Forward armoured prow mandibles framing the hangar launch bay
    const prowFork = taperBox(1.8, 2.0, 3.0, 3.0, 8.0, 0x3a4e6e, { map: shipArmorTex });
    prowFork.position.set(s * 4.8, 0.1, -15.0); g.add(prowFork);
    for (let i = 0; i < 4; i++) {
      const plate = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.3, 4.6), armour);
      plate.position.set(s * 7.2, 0.15, -8.2 + i * 5.6); g.add(plate);
      const seam = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.20, 3.8), trim);
      seam.position.set(s * 8.3, 0.18, -8.2 + i * 5.6); g.add(seam);
    }
    const pod = taperBox(2.4, 2.0, 3.0, 2.4, 11.2, 0xa4c4ee, { map: shipArmorTex }); pod.position.set(s * 7.6, 0.4, 2.8); g.add(pod);
    const noz = cyl(1.6, 2.0, 2.8, 10, 0x3a4e6e, { map: shipArmorTex, flat: true });
    noz.rotation.x = Math.PI / 2; noz.position.set(s * 3.8, -0.25, 12.6); g.add(noz);
    const plume = buildThrusterPlume(0x8db9ff, 1.9, 11.2);
    plume.position.set(s * 3.8, -0.25, 13.8); g.add(plume);
    const engine = glowSprite(0x8db9ff, 4.6); engine.position.set(s * 3.8, -0.25, 14.0); g.add(engine);
    // Broadside twin dorsal turret emplacements
    for (const tz of [-5.2, 6.2]) {
      const tBase = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 0.9, 8), armour);
      tBase.position.set(s * 5.0, 2.9, tz); g.add(tBase);
      for (const bx of [-0.32, 0.32]) {
        const tBar = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 3.8, 6), gunMat);
        tBar.rotation.x = Math.PI / 2; tBar.position.set(s * 5.0 + bx, 3.2, tz - 2.0); g.add(tBar);
      }
    }
    for (const z of [-6.0, 1.6, 7.8]) {
      const lamp = glowSprite(0xff6a42, 1.45); lamp.position.set(s * 8.5, 1.6, z); g.add(lamp);
    }
  }
  for (const s of [-1, 1]) {
    const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.78, 6.2, 6), armour);
    gun.rotation.x = Math.PI / 2; gun.position.set(s * 4.5, 1.4, -16.0); g.add(gun);
  }
  const bay = box(6.6, 2.6, 0.5, 0x121925, { emissive: 0xff5935, emissiveIntensity: 2.1 });
  bay.position.set(0, -0.05, -13.0); g.add(bay);
  const bayGlow = glowSprite(0xff5a36, 5.8); bayGlow.position.set(0, -0.05, -13.5); g.add(bayGlow);
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 6.0, 6), trim); antenna.position.set(-2.8, 7.1, 3.0); g.add(antenna);
  const dish = new THREE.Mesh(new THREE.ConeGeometry(1.4, 0.55, 10), trim); dish.rotation.x = Math.PI; dish.position.set(-2.8, 10.0, 3.0); g.add(dish);
  const commandEye = glowSprite(0xffd36a, 3.2); commandEye.position.set(0, 3.2, -13.5); g.add(commandEye);
  addCombatFrame(g, 'dreadwing', MODEL_DEFS.dreadwing);
  g.userData.glow = bayGlow;
  return g;
}

export function buildSeeker() {
  const g = new THREE.Group();
  const body = taperBox(2.2, 1.4, 3.2, 1.9, 6.4, 0x2a4572, { map: shipArmorTex, topPinch: 0.7 });
  g.add(body);
  const nose = cone(1.25, 4.8, 4, 0x9be23a, { map: shipArmorTex, emissive: 0x6bbf20, emissiveIntensity: 0.65, flat: true });
  nose.rotation.x = -Math.PI / 2; nose.rotation.z = Math.PI / 4; nose.position.z = -4.6; g.add(nose);
  const canopy = box(1.25, 0.48, 2.1, 0x16283e, { emissive: 0x72ffc8, emissiveIntensity: 1.5, flat: true });
  canopy.position.set(0, 0.96, -0.8); g.add(canopy);
  for (const s of [1, -1]) {
    const intake = taperBox(0.75, 0.68, 1.0, 0.85, 3.2, 0x1e3456, { map: shipHazardTex });
    intake.position.set(s * 1.75, 0, -0.2); g.add(intake);
    const wing = box(6.0, 0.28, 2.7, 0x203458, { map: shipArmorTex, flat: true });
    wing.position.set(s * 3.7, 0, 1.0); wing.rotation.z = s * 0.44; wing.rotation.y = s * 0.28; g.add(wing);
    const wingGlow = box(5.0, 0.16, 0.24, 0x103828, { emissive: 0x72ffc8, emissiveIntensity: 1.55, flat: true });
    wingGlow.position.set(s * 3.6, 0.18, 0.1); wingGlow.rotation.z = s * 0.44; wingGlow.rotation.y = s * 0.28; g.add(wingGlow);
    const vTail = box(0.24, 1.75, 1.5, 0x203458, { map: shipHazardTex, flat: true });
    vTail.position.set(s * 1.25, 1.25, 2.5); vTail.rotation.z = s * -0.45; g.add(vTail);
    const pod = cyl(0.26, 0.32, 3.0, 6, 0x18263d, { flat: true });
    pod.rotation.x = Math.PI / 2; pod.position.set(s * 2.5, -0.55, -1.7); g.add(pod);
    const tip = glowSprite(0x9be23a, 2.2); tip.position.set(s * 6.3, 0.60, 1.6); g.add(tip);
  }
  const plume = buildThrusterPlume(0x72ffc8, 1.25, 6.6, 'combatEnginePlume');
  plume.position.z = 4.0; g.add(plume);
  const eng = glowSprite(0x8bffe0, 3.6); eng.position.z = 4.2; g.add(eng);
  g.userData.glow = eng;
  g.userData.meshScale = 1.48;
  return g;
}

export function buildSniper() {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(3.3, 0), toonMat(0x3f5670, { map: shipArmorTex, normalMap: shipArmorNormal, normalScale: new THREE.Vector2(0.5, 0.5), flat: true }));
  g.add(core);
  const ring = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const plate = box(0.95, 2.9, 2.2, 0x2a3a4e, { map: i % 2 ? shipHazardTex : shipArmorTex, flat: true });
    const a = (i / 6) * Math.PI * 2;
    plate.position.set(Math.cos(a) * 4.3, Math.sin(a) * 4.3, 0);
    plate.rotation.z = a; ring.add(plate);
  }
  g.add(ring);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.92, 10.8, 8), toonMat(0x182230));
  barrel.rotation.x = Math.PI / 2; barrel.position.z = -4.8; g.add(barrel);
  // Triple accelerator rail coils + twin rangefinder prongs framing the hypersonic rail muzzle!
  for (const rz of [-4.2, -6.4, -8.6]) {
    const railRing = new THREE.Mesh(new THREE.TorusGeometry(1.12, 0.16, 6, 12), toonMat(0x1b2d42, { emissive: 0x59c6ff, emissiveIntensity: 1.55, flat: true }));
    railRing.position.z = rz; g.add(railRing);
  }
  for (const s of [-1, 1]) {
    const prong = taperBox(0.30, 0.42, 0.48, 0.62, 6.2, 0x2a3a4e, { map: shipHazardTex });
    prong.position.set(s * 1.45, 0, -6.2); g.add(prong);
  }
  const eye = glowSprite(0x59c6ff, 4.2); eye.position.z = -0.6; g.add(eye);
  g.userData.glow = eye;
  g.userData.ring = ring;
  g.userData.meshScale = 1.38;
  return g;
}

export function buildStrafer(tint = 0x863656) {
  const g = new THREE.Group();
  const body = taperBox(1.8, 1.2, 3.0, 1.7, 7.2, tint, { map: shipArmorTex, topPinch: 0.68 });
  g.add(body);
  const nose = cone(1.05, 5.4, 4, 0xffb02e, { map: shipArmorTex, emissive: 0xff6a10, emissiveIntensity: 0.65, flat: true });
  nose.rotation.x = -Math.PI / 2; nose.rotation.z = Math.PI / 4; nose.position.z = -5.0; g.add(nose);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.95, 10, 8), toonMat(0x2f9fd4, { emissive: 0x1a6fa0, emissiveIntensity: 1.15 }));
  canopy.scale.set(0.95, 0.85, 1.75); canopy.position.set(0, 0.95, -1.0); g.add(canopy);
  for (const s of [1, -1]) {
    const intake = taperBox(0.8, 0.65, 1.1, 0.82, 3.2, 0x3b1e2e, { map: shipHazardTex });
    intake.position.set(s * 1.65, 0.05, -0.4); g.add(intake);
    const wing = box(5.5, 0.28, 2.7, 0x422032, { map: shipArmorTex, flat: true });
    wing.position.set(s * 3.5, 0, 0.4); wing.rotation.z = s * -0.24; wing.rotation.y = s * 0.38; g.add(wing);
    const edgeGlow = box(4.6, 0.16, 0.24, 0x3a1420, { emissive: 0xff7b4d, emissiveIntensity: 1.55, flat: true });
    edgeGlow.position.set(s * 3.4, 0.16, -0.65); edgeGlow.rotation.z = s * -0.24; edgeGlow.rotation.y = s * 0.38; g.add(edgeGlow);
    const vFin = box(0.24, 1.85, 1.9, 0x422032, { map: shipHazardTex, flat: true });
    vFin.position.set(s * 1.15, 1.55, 2.3); vFin.rotation.z = s * -0.34; vFin.rotation.x = -0.28; g.add(vFin);
    const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.34, 3.8, 6), toonMat(0x161016));
    cannon.rotation.x = Math.PI / 2; cannon.position.set(s * 2.8, -0.25, -2.7); g.add(cannon);
    const tip = glowSprite(0xff5560, 2.0); tip.position.set(s * 5.8, 0.25, 1.1); g.add(tip);
  }
  const plume = buildThrusterPlume(0xff7b4d, 1.25, 6.6, 'combatEnginePlume');
  plume.position.z = 4.6; g.add(plume);
  const eng = glowSprite(0xff8560, 3.8); eng.position.z = 4.7; g.add(eng);
  g.userData.glow = eng;
  g.userData.meshScale = 1.48;
  return g;
}

export function buildBomber(tint = 0x424c66) {
  const g = new THREE.Group();
  const hull = taperBox(9.2, 2.9, 11.4, 3.6, 7.6, tint, { map: shipArmorTex, topPinch: 0.78 }); g.add(hull);
  const belly = taperBox(6.4, 1.8, 7.6, 2.2, 5.4, 0x262d40, { map: shipHazardTex }); belly.position.y = -2.1; g.add(belly);
  const nose = cone(2.7, 5.2, 5, tint, { map: shipArmorTex, flat: true }); nose.rotation.x = -Math.PI / 2; nose.position.z = -5.8; g.add(nose);
  const bridge = taperBox(3.8, 1.5, 4.6, 1.8, 3.2, 0x2a3448, { map: shipWindowTex, emissive: 0xffa852, emissiveMap: shipWindowTex, emissiveIntensity: 0.65 });
  bridge.position.set(0, 2.25, -1.2); g.add(bridge);
  const visor = box(4.2, 0.78, 0.85, 0x142234, { emissive: 0xff6238, emissiveIntensity: 1.65, flat: true });
  visor.position.set(0, 1.15, -3.9); g.add(visor);
  const radar = new THREE.Group();
  radar.name = 'combatRadar';
  radar.position.set(0, 3.6, -1.0);
  radar.add(cyl(0.22, 0.30, 1.2, 6, 0x262d40, { flat: true }));
  const rDish = box(3.4, 0.38, 0.30, 0x465268, { map: shipHazardTex, flat: true });
  rDish.position.y = 0.6; radar.add(rDish);
  g.add(radar);
  for (const s of [1, -1]) {
    const wing = box(9.8, 0.85, 4.2, 0x313a52, { map: shipArmorTex, flat: true }); wing.position.set(s * 7.5, 0, 0.6); wing.rotation.z = s * 0.06; g.add(wing);
    const wingStripe = box(8.8, 0.92, 0.72, 0x455068, { map: shipHazardTex, flat: true }); wingStripe.position.set(s * 7.2, 0.04, -1.1); wingStripe.rotation.z = s * 0.06; g.add(wingStripe);
    const eng = cyl(1.2, 1.5, 3.6, 8, 0x1a1e2a, { map: shipArmorTex, flat: true }); eng.rotation.x = Math.PI / 2; eng.position.set(s * 7.4, -0.65, 3.9); g.add(eng);
    const plume = buildThrusterPlume(0xff8533, 1.3, 7.4, 'combatEnginePlume');
    plume.position.set(s * 7.4, -0.65, 5.6); g.add(plume);
    const glow = glowSprite(0xff8a3e, 4.0); glow.position.set(s * 7.4, -0.65, 6.0); g.add(glow);
    const bay = glowSprite(0xff3d8f, 3.2); bay.position.set(s * 2.1, -3.2, 0); g.add(bay);
  }
  const eye = glowSprite(0xff5040, 4.2); eye.position.set(0, 1.0, -6.8); g.add(eye);
  g.userData.glow = eye;
  g.userData.meshScale = 1.32;
  return g;
}

export function buildFlak() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 5.6, 3.6, 8), toonMat(0x524838, { map: shipArmorTex, flat: true }));
  base.position.y = 1.8; g.add(base);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.6, 0.95, 10), toonMat(0x322d24, { flat: true }));
  collar.position.y = 3.85; g.add(collar);
  const head = new THREE.Group(); head.position.y = 4.65; g.add(head);
  head.add(taperBox(3.8, 2.1, 4.4, 2.4, 4.4, 0x64543c, { map: shipArmorTex }));
  for (const sx of [1.15, -1.15]) for (const sz of [0.85, -0.85]) {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.44, 4.8, 6), toonMat(0x1e1a12));
    barrel.position.set(sx, 1.9, sz); barrel.rotation.x = -0.5; head.add(barrel);
  }
  const glow = glowSprite(0xffb030, 3.2); glow.position.set(0, 3.8, -1.0); head.add(glow);
  g.userData.glow = glow; g.userData.head = head;
  g.userData.meshScale = 1.20;
  return g;
}

/** AEGIS AA BATTERY — broad strategic fixed anti-air base */
export function buildAABattery() {
  const g = new THREE.Group();
  const armour = toonMat(0x4a505a, { map: shipArmorTex, flat: true, emissive: 0x141820, emissiveIntensity: 0.35 });
  const armourLight = toonMat(0x6b747d, { map: shipArmorTex, flat: true, emissive: 0x1a2028, emissiveIntensity: 0.30 });
  const dark = toonMat(0x222832, { map: shipArmorTex, flat: true });
  const warning = toonMat(0x2a1d1c, { emissive: 0xff6438, emissiveIntensity: 1.35, flat: true });
  const sensorMat = toonMat(0x17212a, { emissive: 0xff9a46, emissiveIntensity: 1.65, flat: true });

  const foundation = new THREE.Mesh(new THREE.CylinderGeometry(9.2, 11.6, 3.3, 8), dark);
  foundation.position.y = 1.65; g.add(foundation);
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(7.8, 9.5, 2.9, 8), armour);
  plinth.position.y = 4.45; g.add(plinth);
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(6.6, 7.9, 1.35, 10), armourLight);
  deck.position.y = 6.45; g.add(deck);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU;
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.50, 0.50, 0.35, 6), warning);
    bolt.rotation.x = Math.PI / 2; bolt.position.set(Math.cos(a) * 8.5, 3.4, Math.sin(a) * 8.5); g.add(bolt);
  }

  const head = new THREE.Group(); head.position.y = 6.95; g.add(head);
  const housing = taperBox(7.6, 2.8, 8.8, 3.2, 7.2, 0x4a505a, { map: shipArmorTex, topPinch: 0.85 });
  housing.position.y = 1.7; head.add(housing);
  const yoke = new THREE.Mesh(new THREE.CylinderGeometry(2.9, 3.5, 1.8, 10), dark);
  yoke.position.y = 3.25; head.add(yoke);
  const sensor = new THREE.Mesh(new THREE.SphereGeometry(1.7, 10, 7), sensorMat);
  sensor.scale.set(1.0, 0.76, 0.58); sensor.position.set(0, 4.1, -3.5); head.add(sensor);
  const sensorHalo = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.19, 5, 12), warning);
  sensorHalo.rotation.x = Math.PI / 2; sensorHalo.position.set(0, 4.1, -3.65); head.add(sensorHalo);

  for (const side of [-1, 1]) {
    const mount = new THREE.Mesh(new THREE.BoxGeometry(1.9, 2.2, 4.2), armourLight);
    mount.position.set(side * 2.85, 3.1, -1.0); head.add(mount);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.58, 9.8, 7), dark);
    barrel.rotation.x = Math.PI * 0.68; barrel.position.set(side * 2.85, 5.5, -4.45); head.add(barrel);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.68, 0.72, 7), warning);
    collar.rotation.x = Math.PI * 0.68; collar.position.set(side * 2.85, 6.15, -5.65); head.add(collar);
  }
  const muzzle = new THREE.Group(); muzzle.position.set(0, 8.2, -7.8); head.add(muzzle);

  const radar = new THREE.Group(); radar.position.set(0, 5.0, 1.55); head.add(radar);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.44, 5.7, 7), armourLight);
  mast.position.y = 2.85; radar.add(mast);
  const dish = new THREE.Mesh(new THREE.TorusGeometry(3.1, 0.30, 5, 14), warning);
  dish.rotation.x = Math.PI / 2; dish.position.y = 5.7; radar.add(dish);
  const dishCore = new THREE.Mesh(new THREE.CircleGeometry(2.35, 12), sensorMat);
  dishCore.position.set(0, 5.7, -0.1); radar.add(dishCore);

  for (const side of [-1, 1]) {
    const cell = new THREE.Mesh(new THREE.BoxGeometry(3.1, 4.3, 3.8), dark);
    cell.position.set(side * 6.9, 5.55, 1.2); g.add(cell);
    for (let i = 0; i < 3; i++) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.54, 0.36, 6), warning);
      cap.rotation.x = Math.PI / 2; cap.position.set(side * 6.9 + (i - 1) * 0.84, 6.45, -0.75); g.add(cap);
    }
  }
  const glow = glowSprite(0xff7a42, 3.8); glow.position.set(0, 10.9, -3.6); head.add(glow);
  g.userData.glow = glow; g.userData.head = head; g.userData.radar = radar;
  g.userData.sensorMat = sensorMat; g.userData.muzzle = muzzle;
  return g;
}

export function buildHovertank() {
  const g = new THREE.Group();
  const skirt = taperBox(7.2, 1.2, 8.2, 1.3, 9.8, 0x242e38, { map: shipArmorTex, topPinch: 0.92 });
  skirt.position.y = 2.1; g.add(skirt);
  const hull = taperBox(6.2, 2.0, 7.2, 2.3, 9.2, 0x42505c, { map: shipArmorTex, topPinch: 0.82 });
  hull.position.y = 3.35; g.add(hull);
  for (const sx of [1, -1]) for (const sz of [-3, 3]) {
    const th = glowSprite(0x59c6ff, 2.6); th.position.set(sx * 2.9, 1.3, sz); g.add(th);
  }
  const turret = new THREE.Group(); turret.position.set(0, 4.85, 0); g.add(turret);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(2.15, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), toonMat(0x52626e, { map: shipArmorTex, flat: true })); turret.add(dome);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.50, 5.2, 7), toonMat(0x1a2026)); barrel.rotation.x = Math.PI / 2; barrel.position.z = -2.6; turret.add(barrel);
  const eye = glowSprite(0xff6a3e, 2.8); eye.position.set(0, 0.65, -1.0); turret.add(eye);
  g.userData.glow = eye; g.userData.turret = turret;
  g.userData.meshScale = 1.20;
  return g;
}

export function buildLauncher() {
  const g = new THREE.Group();
  const base = taperBox(4.8, 2.3, 5.8, 2.6, 6.6, 0x485440, { map: shipArmorTex }); base.position.y = 1.25; g.add(base);
  const rack = new THREE.Group(); rack.position.set(0, 2.95, 0.6); rack.rotation.x = -0.7; g.add(rack);
  rack.add(box(4.8, 2.5, 3.6, 0x323c2d, { map: shipArmorTex, flat: true }));
  for (const sx of [1, -1]) for (const sy of [0.82, -0.82]) {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.50, 0.50, 3.8, 7), toonMat(0x242c20));
    tube.rotation.x = Math.PI / 2; tube.position.set(sx * 1.25, sy, -0.95); rack.add(tube);
    const tip = glowSprite(0xff7a3a, 1.65); tip.position.set(sx * 1.25, sy, -2.85); rack.add(tip);
  }
  const glow = glowSprite(0xffa030, 2.6); glow.position.set(0, 3.3, 0.6); g.add(glow);
  g.userData.glow = glow; g.userData.rack = rack;
  g.userData.meshScale = 1.20;
  return g;
}

/* ============ HARD-SURFACE SCULPTING PRIMITIVES & MECHANICAL SUB-ASSEMBLIES ============ */

/** True chamfered polygonal 3D airfoil / armor plate extruded along Z and centered at z = 0. */
function extrudeBevel(pts, depth, mat, opts = {}) {
  const shape = new THREE.Shape();
  shape.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], pts[i][1]);
  shape.closePath();
  const bevel = opts.bevel ?? Math.min(0.16, depth * 0.28);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: opts.bevelSegments ?? 2,
  });
  geo.translate(0, 0, -depth * 0.5);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}

/** Lathed axisymmetric aerospace hull / dome / drill cone from [radius, y] profile pairs. */
function latheHull(profile, segs, mat) {
  const pts = profile.map(([r, y]) => new THREE.Vector2(r, y));
  const geo = new THREE.LatheGeometry(pts, segs);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}

/** High-detail 6-petal vectored plasma jet thruster nacelle with turbine ring & 3D plume! */
function buildVectoredNozzle(accent, r, len, armorMat, darkMat, litMat) {
  const g = new THREE.Group();
  const cowl = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.94, r * 1.24, r * 1.9, 10), armorMat);
  cowl.rotation.x = Math.PI / 2; cowl.position.z = -r * 0.65; g.add(cowl);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(r * 0.96, r * 0.14, 5, 12), darkMat);
  collar.position.z = r * 0.28; g.add(collar);
  for (let p = 0; p < 6; p++) {
    const a = (p / 6) * TAU;
    const petal = new THREE.Mesh(new THREE.BoxGeometry(r * 0.30, r * 0.58, r * 0.85), darkMat);
    petal.position.set(Math.cos(a) * r * 0.94, Math.sin(a) * r * 0.94, r * 0.42);
    petal.rotation.z = a; g.add(petal);
  }
  const innerRing = new THREE.Mesh(new THREE.TorusGeometry(r * 0.66, r * 0.11, 5, 10), litMat);
  innerRing.position.z = r * 0.34; g.add(innerRing);
  const bore = new THREE.Mesh(new THREE.CircleGeometry(r * 0.58, 10), litMat);
  bore.position.z = r * 0.36; g.add(bore);
  const plume = buildThrusterPlume(accent, r * 0.98, len, 'combatEnginePlume');
  plume.position.z = r * 0.42; g.add(plume);
  return g;
}

/** Precision electromagnetic weapon barrel: armored breech + cooling fins + twin rail coils + muzzle brake! */
function buildRailBarrel(len, r, accent, darkMat, armorMat, litMat) {
  const g = new THREE.Group();
  const breech = new THREE.Mesh(new THREE.BoxGeometry(r * 3.0, r * 2.6, len * 0.30), armorMat);
  breech.position.z = -len * 0.15; g.add(breech);
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.78, r * 1.05, len, 8), darkMat);
  tube.rotation.x = Math.PI / 2; tube.position.z = -len * 0.52; g.add(tube);
  for (const frac of [0.36, 0.68]) {
    const coil = new THREE.Mesh(new THREE.TorusGeometry(r * 1.38, r * 0.32, 5, 10), litMat);
    coil.position.z = -len * frac; g.add(coil);
  }
  const brake = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.15, r * 0.85, r * 2.2, 6), armorMat);
  brake.rotation.x = Math.PI / 2; brake.position.z = -len * 0.96; g.add(brake);
  const tip = glowSprite(accent, r * 5.2, 0.78);
  tip.position.z = -len * 1.08; g.add(tip);
  return g;
}

/** Recessed multi-ring optical targeting eye housing facing -Z! */
function buildOpticalPod(r, accent, darkMat, litMat) {
  const g = new THREE.Group();
  const bezel = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.05, r * 1.28, r * 0.72, 8), darkMat);
  bezel.rotation.x = Math.PI / 2; g.add(bezel);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.84, r * 0.16, 6, 12), litMat);
  ring.position.z = -r * 0.32; g.add(ring);
  const lens = new THREE.Mesh(new THREE.SphereGeometry(r * 0.68, 10, 8), litMat);
  lens.scale.set(1, 1, 0.55); lens.position.z = -r * 0.25; g.add(lens);
  const glint = glowSprite(accent, r * 3.0, 0.88);
  glint.position.z = -r * 0.65; g.add(glint);
  return g;
}

/* ============ BESPOKE ELITE AMBUSH AIRCRAFT (Water Breacher, Sky Dive-Bomber, Flank Raider) ============ */

/**
 * HYDRO-LEVIATHAN BREACHER (`breacher`) — amphibious manta-shark submersible fighter!
 * Lathed hydrodynamic shark nosecone, beveled notched dorsal sail, 5 glowing gill louvers,
 * articulated beveled compound-delta hydrofoil wings (`wingL`/`wingR`) & twin vectored jets!
 */
export function buildBreacher() {
  const g = new THREE.Group();
  const norm = new THREE.Vector2(0.52, 0.52);
  const hullMat = toonMat(0x225478, { map: shipArmorTex, normalMap: shipArmorNormal, normalScale: norm, flat: true });
  const accentHull = toonMat(0x2e6f98, { map: shipArmorTex, normalMap: shipArmorNormal, normalScale: norm, flat: true });
  const darkMat = toonMat(0x112438, { map: shipArmorTex, normalMap: shipArmorNormal, normalScale: norm, flat: true });
  const hazardMat = toonMat(0x3a546a, { map: shipHazardTex, normalMap: shipArmorNormal, normalScale: norm, flat: true });
  const cyanLit = toonMat(0x0c344a, { emissive: 0x52f6ff, emissiveIntensity: 1.85, flat: true });
  const amberLit = toonMat(0x3a200e, { emissive: 0xffa83c, emissiveIntensity: 1.65, flat: true });

  // Sculpted hydrodynamic shark-torpedo fuselage + armored chine belly + lathed tapered nosecone!
  const fuselage = taperBox(2.3, 1.75, 4.1, 2.5, 8.6, 0x225478, { map: shipArmorTex, topPinch: 0.60, botPinch: 0.82, yShiftFront: -0.25 });
  g.add(fuselage);
  const belly = taperBox(1.6, 0.72, 3.1, 1.0, 7.8, 0x112438, { map: shipArmorTex, botPinch: 0.60 });
  belly.position.set(0, -1.12, 0.35); g.add(belly);
  const nose = latheHull([[0.01, 4.4], [0.52, 3.2], [1.05, 1.8], [1.45, 0.5], [1.62, 0.0]], 10, accentHull);
  nose.rotation.x = -Math.PI / 2; nose.position.set(0, -0.18, -4.2); g.add(nose);
  const chinScoop = taperBox(1.15, 0.45, 1.55, 0.65, 2.8, 0x112438, { map: shipHazardTex });
  chinScoop.position.set(0, -1.1, -4.4); g.add(chinScoop);

  // Dual recessed hydrodynamic sonar aperture collar + beveled shark-fin dorsal sail!
  const sonarRing = new THREE.Group();
  sonarRing.position.set(0, -0.15, -5.0);
  sonarRing.add(new THREE.Mesh(new THREE.TorusGeometry(1.26, 0.15, 6, 16), cyanLit));
  const sonarInner = new THREE.Mesh(new THREE.TorusGeometry(0.88, 0.09, 5, 12), amberLit);
  sonarInner.position.z = -0.35; sonarRing.add(sonarInner);
  g.add(sonarRing);

  const dorsalSail = extrudeBevel([[0, 0], [1.2, 3.4], [2.8, 3.1], [2.1, 1.6], [4.2, 0]], 0.36, darkMat, { bevel: 0.12 });
  dorsalSail.rotation.y = -Math.PI / 2;
  dorsalSail.position.set(0, 1.05, -0.4); g.add(dorsalSail);
  const dorsalTrim = extrudeBevel([[0.2, 0.3], [1.25, 3.15], [2.45, 2.95], [1.6, 1.8]], 0.44, cyanLit, { bevel: 0.05 });
  dorsalTrim.rotation.y = -Math.PI / 2;
  dorsalTrim.position.set(0, 1.05, -0.4); g.add(dorsalTrim);

  // Multi-pane armored predator canopy dome + central frame mullion + glowing gill vents!
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(1.15, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.56),
    toonMat(0x0c283c, { emissive: 0x62f8ff, emissiveIntensity: 1.75, flat: true })
  );
  canopy.scale.set(0.95, 0.72, 2.3); canopy.position.set(0, 0.88, -2.0); g.add(canopy);
  const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.65, 2.65), darkMat);
  mullion.position.set(0, 1.24, -1.95); g.add(mullion);

  for (const s of [-1, 1]) {
    // 5 angled glowing bioluminescent hydro-gill intake louvers per flank!
    for (let k = 0; k < 5; k++) {
      const gill = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.68 - k * 0.05, 0.24), cyanLit);
      gill.position.set(s * (1.76 + k * 0.06), 0.04, -2.2 + k * 0.62);
      gill.rotation.y = s * -0.22; gill.rotation.x = 0.22; g.add(gill);
    }
    // Under-belly armored torpedo launcher barrels + glowing amber warhead tips
    const torpGun = buildRailBarrel(3.8, 0.28, 0xffa83c, darkMat, hazardMat, amberLit);
    torpGun.position.set(s * 1.22, -1.25, -1.2); g.add(torpGun);
    // Canted ventral shark stabilizer fins
    const vFin = extrudeBevel([[0, 0], [0.8, -1.7], [2.2, -1.4], [2.4, 0]], 0.22, darkMat, { bevel: 0.06 });
    vFin.rotation.y = -Math.PI / 2; vFin.rotation.z = s * 0.42;
    vFin.position.set(s * 1.65, -0.75, 2.2); g.add(vFin);
    // Twin 6-petal vectored hydro-plasma engines
    const eng = buildVectoredNozzle(0x52f2ff, 0.76, 5.8, hullMat, darkMat, cyanLit);
    eng.position.set(s * 1.15, -0.08, 4.55); g.add(eng);
  }

  // Articulated beveled compound-delta hydrofoil wings (`wingL`/`wingR` fold back during breach, snap wide open!)
  const makeWing = (s) => {
    const piv = new THREE.Group();
    piv.position.set(s * 1.7, -0.10, 0.4);
    const blade = extrudeBevel([[0, -1.5], [s * 5.8, 0.4], [s * 6.4, 2.5], [s * 4.2, 2.8], [s * 2.2, 1.8], [0, 2.1]], 0.28, accentHull, { bevel: 0.10 });
    blade.rotation.x = Math.PI / 2; piv.add(blade);
    const hazRib = extrudeBevel([[s * 0.4, -1.2], [s * 5.1, 0.4], [s * 5.1, 1.15], [s * 0.4, -0.3]], 0.34, hazardMat, { bevel: 0.05 });
    hazRib.rotation.x = Math.PI / 2; piv.add(hazRib);
    const glowStrip = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.18, 0.24), cyanLit);
    glowStrip.position.set(s * 3.1, 0.16, 1.55); glowStrip.rotation.y = s * -0.26; piv.add(glowStrip);
    const tipSail = extrudeBevel([[0, -0.6], [1.1, 2.4], [2.3, 2.0], [2.6, -0.9], [1.3, -1.1]], 0.24, darkMat, { bevel: 0.07 });
    tipSail.rotation.y = -Math.PI / 2; tipSail.rotation.z = s * -0.32;
    tipSail.position.set(s * 6.1, 0.15, 0.65); piv.add(tipSail);
    const tipLight = glowSprite(0x52f6ff, 2.5, 0.90);
    tipLight.position.set(s * 6.5, 1.45, 1.4); piv.add(tipLight);
    return piv;
  };
  const wingL = makeWing(-1), wingR = makeWing(1);
  g.add(wingL, wingR);

  const eye = glowSprite(0x62f6ff, 4.4, 0.96);
  eye.position.set(0, -0.15, -8.5); g.add(eye);
  g.userData.glow = eye;
  g.userData.wingL = wingL;
  g.userData.wingR = wingR;
  g.userData.sonarRing = sonarRing;
  g.userData.meshScale = 1.45;
  return g;
}

/**
 * STRATO-VALKYRIE DIVE-BOMBER (`valkyrie`) — razor-angular high-altitude crimson-gold raptor striker!
 * Beveled hawk nose strakes, golden falcon cockpit with roll-cage, dorsal twin-rail spine,
 * open ventral cluster-bomb bay (`bombCore`), forward-swept feathered scissor wings & triple vectored jets!
 */
export function buildValkyrie() {
  const g = new THREE.Group();
  const norm = new THREE.Vector2(0.52, 0.52);
  const crimsonMat = toonMat(0x92263a, { map: shipArmorTex, normalMap: shipArmorNormal, normalScale: norm, flat: true });
  const brightMat = toonMat(0xc43448, { map: shipArmorTex, normalMap: shipArmorNormal, normalScale: norm, flat: true });
  const darkMat = toonMat(0x181f32, { map: shipArmorTex, normalMap: shipArmorNormal, normalScale: norm, flat: true });
  const hazardMat = toonMat(0x5c363e, { map: shipHazardTex, normalMap: shipArmorNormal, normalScale: norm, flat: true });
  const goldLit = toonMat(0x3e260c, { emissive: 0xffc03a, emissiveIntensity: 1.85, flat: true });
  const redLit = toonMat(0x42101a, { emissive: 0xff425c, emissiveIntensity: 1.80, flat: true });

  // Sculpted angular raptor fuselage + beveled hawk-beak nose + forward intake cheek strakes!
  const body = taperBox(2.0, 1.45, 3.6, 2.05, 8.8, 0x92263a, { map: shipArmorTex, topPinch: 0.64, botPinch: 0.84 });
  g.add(body);
  const beak = latheHull([[0.01, 4.8], [0.55, 3.2], [1.15, 1.4], [1.45, 0.0]], 4, brightMat);
  beak.rotation.x = -Math.PI / 2; beak.rotation.z = Math.PI / 4; beak.position.set(0, -0.1, -4.2); g.add(beak);
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(1.08, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.56),
    toonMat(0x32200a, { emissive: 0xffc642, emissiveIntensity: 1.75, flat: true })
  );
  canopy.scale.set(0.95, 0.80, 2.45); canopy.position.set(0, 0.90, -1.6); g.add(canopy);
  const canopyFrame = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.72, 2.8), darkMat);
  canopyFrame.position.set(0, 1.24, -1.55); g.add(canopyFrame);

  // Dorsal twin-rail cannon spine + armored open ventral cluster-bomb bay with glowing spinning bombCore!
  const spine = taperBox(1.25, 0.82, 1.75, 1.15, 6.4, 0x181f32, { map: shipHazardTex });
  spine.position.set(0, 1.28, 1.4); g.add(spine);
  const bombCore = new THREE.Group();
  bombCore.position.set(0, -1.25, -0.5);
  bombCore.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.95, 0), redLit));
  bombCore.add(new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.14, 5, 12), goldLit));
  g.add(bombCore);
  for (const s of [-1, 1]) {
    const bayDoor = extrudeBevel([[0, 0], [0.85, -0.85], [0.65, -1.05], [-0.15, -0.2]], 3.2, darkMat, { bevel: 0.05 });
    bayDoor.position.set(s * 0.95, -0.95, -0.5); bayDoor.scale.x = s; g.add(bayDoor);
    // Cheek air-intakes with glowing golden turbine grilles
    const intake = taperBox(0.9, 0.78, 1.25, 0.95, 3.8, 0x181f32, { map: shipArmorTex });
    intake.position.set(s * 1.85, 0.05, -0.8); g.add(intake);
    const grille = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.42, 0.18), goldLit);
    grille.position.set(s * 1.85, 0.05, -2.72); g.add(grille);
    // Recessed dorsal spine micro-rails
    const dRail = buildRailBarrel(3.6, 0.16, 0xffc03a, darkMat, crimsonMat, goldLit);
    dRail.position.set(s * 0.52, 1.65, -1.4); g.add(dRail);
  }

  // Iconic beveled forward-swept feathered raptor scissor wings (`wingL`/`wingR`)!
  const makeRaptorWing = (s) => {
    const piv = new THREE.Group();
    piv.position.set(s * 1.55, 0.08, 0.2);
    const mainBlade = extrudeBevel([[0, -1.4], [s * 3.4, -1.8], [s * 7.2, -3.1], [s * 6.5, -1.1], [s * 4.4, -0.1], [s * 2.4, 1.4], [0, 1.6]], 0.26, crimsonMat, { bevel: 0.09 });
    mainBlade.rotation.x = Math.PI / 2; piv.add(mainBlade);
    const innerOverlay = extrudeBevel([[s * 0.3, -1.1], [s * 3.4, -1.4], [s * 3.0, 0.6], [s * 0.3, 0.9]], 0.34, hazardMat, { bevel: 0.05 });
    innerOverlay.rotation.x = Math.PI / 2; piv.add(innerOverlay);
    // 3 tiered beveled golden primary raptor feather blades fanning off the outer wingtip!
    for (let f = 0; f < 3; f++) {
      const feather = extrudeBevel([[0, 0], [s * (2.6 - f * 0.35), -0.85], [s * (2.2 - f * 0.3), -0.15], [0, 0.32]], 0.18, f === 0 ? goldLit : darkMat, { bevel: 0.04 });
      feather.rotation.x = Math.PI / 2;
      feather.position.set(s * (5.2 - f * 0.65), 0.06, -1.8 + f * 0.85);
      piv.add(feather);
    }
    const wingGun = buildRailBarrel(3.8, 0.22, 0xffc03a, darkMat, hazardMat, goldLit);
    wingGun.position.set(s * 3.0, -0.32, -0.8); piv.add(wingGun);
    const tipGlow = glowSprite(0xffc03a, 2.5, 0.90);
    tipGlow.position.set(s * 7.4, 0.1, -2.9); piv.add(tipGlow);
    return piv;
  };
  const wingL = makeRaptorWing(-1), wingR = makeRaptorWing(1);
  g.add(wingL, wingR);

  // Swept beveled twin V-tail fins + triple 6-petal star-arranged vectored afterburners!
  for (const s of [-1, 1]) {
    const vTail = extrudeBevel([[0, 0], [1.4, 2.8], [2.7, 2.5], [2.4, 0]], 0.22, brightMat, { bevel: 0.06 });
    vTail.rotation.y = -Math.PI / 2; vTail.rotation.z = s * -0.46;
    vTail.position.set(s * 1.45, 0.65, 2.2); g.add(vTail);
    const subJet = buildVectoredNozzle(0xff7238, 0.56, 4.8, crimsonMat, darkMat, redLit);
    subJet.position.set(s * 1.28, -0.28, 4.7); g.add(subJet);
  }
  const mainJet = buildVectoredNozzle(0xffc03a, 0.82, 6.6, brightMat, darkMat, goldLit);
  mainJet.position.set(0, 0.30, 4.9); g.add(mainJet);

  const eye = glowSprite(0xffb838, 4.4, 0.95);
  eye.position.set(0, -0.1, -8.8); g.add(eye);
  g.userData.glow = eye;
  g.userData.wingL = wingL;
  g.userData.wingR = wingR;
  g.userData.bombCore = bombCore;
  g.userData.meshScale = 1.44;
  return g;
}

/**
 * VANGUARD FLANK-RAIDER (`vanguard`) — twin-boom catamaran edge-ambush interceptor!
 * Sculpted forward-swept twin scythe-prow booms, beveled bridge spars, spinning multi-tier
 * hexagonal AWACS radar crown (`radar`), twin rail autocannons & vectored magenta afterburners!
 */
export function buildVanguard() {
  const g = new THREE.Group();
  const norm = new THREE.Vector2(0.52, 0.52);
  const slateMat = toonMat(0x3a4868, { map: shipArmorTex, normalMap: shipArmorNormal, normalScale: norm, flat: true });
  const darkMat = toonMat(0x182136, { map: shipArmorTex, normalMap: shipArmorNormal, normalScale: norm, flat: true });
  const crimsonMat = toonMat(0xc83858, { map: shipArmorTex, normalMap: shipArmorNormal, normalScale: norm, flat: true });
  const hazardMat = toonMat(0x4b566e, { map: shipHazardTex, normalMap: shipArmorNormal, normalScale: norm, flat: true });
  const plasmaLit = toonMat(0x3c1228, { emissive: 0xff5486, emissiveIntensity: 1.85, flat: true });
  const cyanLit = toonMat(0x0c283a, { emissive: 0x6ceeff, emissiveIntensity: 1.75, flat: true });

  // Faceted central cockpit nacelle + chin optical targeting pod + ventral keel fin!
  const corePod = taperBox(2.4, 1.45, 3.2, 1.85, 5.8, 0x3a4868, { map: shipArmorTex, topPinch: 0.70 });
  g.add(corePod);
  const visor = new THREE.Mesh(
    new THREE.SphereGeometry(1.12, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
    cyanLit
  );
  visor.scale.set(0.95, 0.65, 1.65); visor.position.set(0, 0.68, -1.4); g.add(visor);
  const visorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.55, 1.95), darkMat);
  visorFrame.position.set(0, 0.96, -1.4); g.add(visorFrame);
  const chinOptic = buildOpticalPod(0.52, 0x6ceeff, darkMat, cyanLit);
  chinOptic.position.set(0, -0.78, -2.5); g.add(chinOptic);
  const keel = extrudeBevel([[0, 0], [0.8, -1.2], [2.4, -0.9], [2.8, 0]], 0.24, darkMat, { bevel: 0.06 });
  keel.rotation.y = -Math.PI / 2; keel.position.set(0, -0.75, -0.6); g.add(keel);

  // Multi-tiered spinning hexagonal AWACS target-acquisition radar crown (`radar`)!
  const radar = new THREE.Group();
  radar.position.set(0, 1.65, 0.65);
  radar.add(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.45, 0.85, 6), darkMat));
  const hexRim = new THREE.Mesh(new THREE.TorusGeometry(1.62, 0.19, 6, 6), plasmaLit);
  hexRim.rotation.x = Math.PI / 2; hexRim.position.y = 0.42; radar.add(hexRim);
  const scanBar = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.24, 0.36), hazardMat);
  scanBar.position.y = 0.42; radar.add(scanBar);
  const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.82, 0.32, 6), cyanLit);
  dome.position.y = 0.52; radar.add(dome);
  g.add(radar);

  // Twin armored forward-swept catamaran blade hulls + beveled scythe prows + rail cannons + vectored nozzles!
  for (const s of [-1, 1]) {
    const spar = extrudeBevel([[0, -1.1], [s * 3.8, -1.5], [s * 3.8, 1.4], [0, 1.1]], 0.42, hazardMat, { bevel: 0.08 });
    spar.rotation.x = Math.PI / 2; spar.position.set(s * 0.6, -0.05, 0.2); g.add(spar);
    const boom = taperBox(1.35, 1.2, 1.95, 1.55, 9.8, 0x26314a, { map: shipArmorTex, topPinch: 0.70 });
    boom.position.set(s * 4.0, 0, -0.4); g.add(boom);
    // Beveled crimson scythe prow blade extending forward!
    const prowBlade = extrudeBevel([[0, 0], [s * 0.9, -4.4], [s * -0.4, -3.4], [s * -0.6, 0]], 0.65, crimsonMat, { bevel: 0.12 });
    prowBlade.rotation.x = Math.PI / 2; prowBlade.position.set(s * 4.0, 0, -5.0); g.add(prowBlade);
    // Recessed broadside nose rail autocannon!
    const boomGun = buildRailBarrel(4.2, 0.22, 0xff5486, darkMat, slateMat, plasmaLit);
    boomGun.position.set(s * 3.15, -0.25, -4.0); g.add(boomGun);
    // Glowing broadside energy arc-rail conduit
    const arcRail = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.36, 7.2), plasmaLit);
    arcRail.position.set(s * 4.92, 0.16, -0.8); g.add(arcRail);
    // Outer canted beveled wing blade + tall canted dorsal stabilizer fin!
    const outerWing = extrudeBevel([[0, -1.2], [s * 3.4, 0.6], [s * 3.0, 2.2], [0, 1.8]], 0.24, slateMat, { bevel: 0.08 });
    outerWing.rotation.x = Math.PI / 2; outerWing.rotation.z = s * -0.30;
    outerWing.position.set(s * 4.75, -0.1, 0.8); g.add(outerWing);
    const tailFin = extrudeBevel([[0, 0], [1.4, 2.6], [2.6, 2.2], [2.5, 0]], 0.22, hazardMat, { bevel: 0.06 });
    tailFin.rotation.y = -Math.PI / 2; tailFin.rotation.z = s * -0.26;
    tailFin.position.set(s * 4.0, 0.65, 2.1); g.add(tailFin);
    // 6-petal vectored magenta plasma engine
    const eng = buildVectoredNozzle(0xff6288, 0.78, 6.0, slateMat, darkMat, plasmaLit);
    eng.position.set(s * 4.0, 0, 4.95); g.add(eng);
    const strobe = glowSprite(s < 0 ? 0xff4a68 : 0x6cecff, 2.4, 0.90);
    strobe.position.set(s * 7.8, -0.85, 2.1); g.add(strobe);
  }

  const eye = glowSprite(0xff5a82, 4.0, 0.95);
  eye.position.set(0, 0, -3.7); g.add(eye);
  g.userData.glow = eye;
  g.userData.radar = radar;
  g.userData.meshScale = 1.40;
  return g;
}

/* ============ WAVE-TAILORED SUDDEN WATER & GROUND EMERGING AMBUSH CRAFT ============ */

/**
 * ABYSSAL KRAKEN-SUB (`kraken`) — deep-sea cephalopod dreadnought hydro-mech!
 * Lathed ribbed bathysphere dome, beveled curved dorsal fin, multi-lens sonar cyclops bridge,
 * twin 4-tube dorsal torpedo pods, shrouded 6-blade pump-jet rotor & 6 articulated 3-joint tentacles!
 */
export function buildKraken() {
  const g = new THREE.Group();
  const norm = new THREE.Vector2(0.55, 0.55);
  const navyMat = toonMat(0x163a56, { map: shipArmorTex, normalMap: shipArmorNormal, normalScale: norm, flat: true });
  const tealMat = toonMat(0x226e84, { map: shipArmorTex, normalMap: shipArmorNormal, normalScale: norm, flat: true });
  const darkMat = toonMat(0x0f2032, { map: shipArmorTex, normalMap: shipArmorNormal, normalScale: norm, flat: true });
  const hazardMat = toonMat(0x3a5668, { map: shipHazardTex, normalMap: shipArmorNormal, normalScale: norm, flat: true });
  const windowMat = toonMat(0x163044, { map: shipWindowTex, emissive: 0x52f8ff, emissiveMap: shipWindowTex, emissiveIntensity: 0.72, flat: true });
  const cyanLit = toonMat(0x0a3448, { emissive: 0x52f8ff, emissiveIntensity: 1.9, flat: true });
  const amberLit = toonMat(0x3e220a, { emissive: 0xffaa38, emissiveIntensity: 1.75, flat: true });

  // Lathed multi-stepped bathysphere pressure dome + brass-hazard equatorial flange + recessed porthole gallery!
  const mantle = latheHull([[0.01, 4.2], [1.6, 3.85], [2.75, 3.1], [3.35, 2.0], [3.55, 0.9], [3.25, 0.0], [2.4, -0.8], [0.01, -1.2]], 14, tealMat);
  mantle.scale.set(1.12, 0.95, 1.32); mantle.position.set(0, -0.35, -0.35); g.add(mantle);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(3.85, 0.52, 6, 16), hazardMat);
  collar.rotation.x = Math.PI / 2; collar.position.set(0, 0.05, -0.25); g.add(collar);
  const deckBelt = new THREE.Mesh(new THREE.CylinderGeometry(3.45, 3.65, 1.15, 12), windowMat);
  deckBelt.position.set(0, 1.15, -0.45); g.add(deckBelt);
  // Swept beveled curved dorsal sail crest with glowing hydro-coolant ribs!
  const sail = extrudeBevel([[0, 0], [1.4, 3.6], [3.6, 3.3], [2.9, 1.8], [5.2, 0]], 0.48, navyMat, { bevel: 0.14 });
  sail.rotation.y = -Math.PI / 2; sail.position.set(0, 2.45, -1.1); g.add(sail);
  const sailGlow = extrudeBevel([[0.3, 0.4], [1.45, 3.3], [3.2, 3.05], [2.2, 1.9]], 0.56, cyanLit, { bevel: 0.05 });
  sailGlow.rotation.y = -Math.PI / 2; sailGlow.position.set(0, 2.45, -1.1); g.add(sailGlow);

  // Armored cyclops sonar bridge eye + spinning dual holographic sonar aperture + twin hydro-jaw mandibles!
  const cyclops = buildOpticalPod(1.38, 0x52f8ff, darkMat, cyanLit);
  cyclops.position.set(0, 1.25, -4.35); g.add(cyclops);
  const sonarRing = new THREE.Group();
  sonarRing.position.set(0, 1.25, -5.05);
  sonarRing.add(new THREE.Mesh(new THREE.TorusGeometry(1.72, 0.14, 6, 16), cyanLit));
  const sonarTick = new THREE.Mesh(new THREE.TorusGeometry(1.22, 0.08, 5, 8), amberLit);
  sonarTick.position.z = -0.35; sonarRing.add(sonarTick);
  g.add(sonarRing);

  for (const s of [-1, 1]) {
    // Curved lower armored hydro-mandible jaws flanking the sonar snout!
    const beak = extrudeBevel([[0, 0], [s * 1.4, -2.2], [s * 0.4, -3.2], [s * -0.3, -1.2]], 0.48, darkMat, { bevel: 0.10 });
    beak.rotation.x = Math.PI / 2; beak.position.set(s * 1.25, -0.35, -3.3); g.add(beak);
    // Twin dorsal 4-cell armored torpedo silos with protruding amber warheads!
    const silo = taperBox(1.35, 1.45, 1.65, 1.65, 4.9, 0x163a56, { map: shipHazardTex });
    silo.position.set(s * 3.1, 2.15, 0.45); g.add(silo);
    for (const [ox, oy] of [[-0.32, 0.30], [0.32, 0.30], [-0.32, -0.30], [0.32, -0.30]]) {
      const warhead = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.95, 6), amberLit);
      warhead.rotation.x = -Math.PI / 2; warhead.position.set(s * 3.1 + ox, 2.15 + oy, -2.25); g.add(warhead);
    }
    // Swept beveled manta stabilizer hydrofoils + wingtip dive-planes!
    const hydroFin = extrudeBevel([[0, -1.2], [s * 4.4, 0.4], [s * 4.8, 2.2], [s * 2.4, 2.1], [0, 1.4]], 0.30, tealMat, { bevel: 0.10 });
    hydroFin.rotation.x = Math.PI / 2; hydroFin.rotation.z = s * -0.18;
    hydroFin.position.set(s * 3.2, 0.15, 0.4); g.add(hydroFin);
    const finGlow = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.16, 0.24), cyanLit);
    finGlow.position.set(s * 5.2, -0.12, 1.65); finGlow.rotation.y = s * -0.22; g.add(finGlow);
    // Twin 6-petal vectored hydro-plasma thrusters!
    const jet = buildVectoredNozzle(0x46f0ff, 0.82, 6.2, navyMat, darkMat, cyanLit);
    jet.position.set(s * 1.75, 0.22, 4.45); g.add(jet);
  }

  // Shrouded Kort-nozzle 6-blade rear ballast pump-jet turbine (`rotor`)!
  const kort = new THREE.Mesh(new THREE.TorusGeometry(1.52, 0.26, 6, 16), hazardMat);
  kort.position.set(0, 0.1, 4.9); g.add(kort);
  const rotor = new THREE.Group();
  rotor.position.set(0, 0.1, 4.9);
  rotor.add(new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), darkMat));
  for (let b = 0; b < 6; b++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.32, 2.6, 0.14), amberLit);
    blade.rotation.z = (b / 6) * TAU; rotor.add(blade);
  }
  g.add(rotor);

  // 6 articulated 3-segment mechanical hydro-tentacles with beveled whip tips & bioluminescent sucker nodes!
  const tentacles = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + Math.PI / 6;
    const root = new THREE.Group();
    root.position.set(Math.cos(a) * 2.75, -0.95, Math.sin(a) * 2.45);
    root.rotation.y = -a;
    const socket = new THREE.Mesh(new THREE.SphereGeometry(0.65, 8, 6), hazardMat);
    root.add(socket);
    const upper = taperBox(0.82, 2.45, 0.58, 2.2, 0.86, 0x163a56, { map: shipArmorTex });
    upper.position.set(0.42, -1.15, 0); upper.rotation.z = 0.28; root.add(upper);
    const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.56, 8, 6), hazardMat);
    elbow.position.set(0.84, -2.35, 0); root.add(elbow);
    const whip = extrudeBevel([[0, 0], [0.58, -0.2], [1.45, -2.9], [0.72, -3.2], [-0.15, -0.3]], 0.36, navyMat, { bevel: 0.08 });
    whip.position.set(0.75, -2.35, 0); root.add(whip);
    for (const [sx, sy] of [[0.92, -3.25], [1.22, -4.15], [1.52, -5.05]]) {
      const sucker = new THREE.Mesh(new THREE.SphereGeometry(0.24, 6, 5), cyanLit);
      sucker.position.set(sx, sy, 0.22); root.add(sucker);
    }
    g.add(root);
    tentacles.push(root);
  }

  const eye = glowSprite(0x52f8ff, 4.8, 0.96);
  eye.position.set(0, 1.25, -5.6); g.add(eye);
  g.userData.glow = eye;
  g.userData.tentacles = tentacles;
  g.userData.sonarRing = sonarRing;
  g.userData.rotor = rotor;
  g.userData.meshScale = 1.44;
  return g;
}

/**
 * AEGIS POP-UP SILO TURRET (`silo`) — fortress subterranean hydraulic assault spire!
 * Octagonal buttressed bunker collar (`hatch`) with 4 beveled chevron blast-door leaves (`doors[]`),
 * lathed telescoping armored pylon with 4 twin-stage hydraulic rams, dual rail cannons & 12-cell SAM pods!
 */
export function buildSilo() {
  const g = new THREE.Group();
  const norm = new THREE.Vector2(0.55, 0.55);
  const steelMat = toonMat(0x4a586e, { map: shipArmorTex, normalMap: shipArmorNormal, normalScale: norm, flat: true });
  const darkMat = toonMat(0x1b2434, { map: shipArmorTex, normalMap: shipArmorNormal, normalScale: norm, flat: true });
  const hazardMat = toonMat(0x525e74, { map: shipHazardTex, normalMap: shipArmorNormal, normalScale: norm, flat: true });
  const windowMat = toonMat(0x1c2838, { map: shipWindowTex, emissive: 0x5ce8ff, emissiveMap: shipWindowTex, emissiveIntensity: 0.65, flat: true });
  const amberLit = toonMat(0x3e220c, { emissive: 0xffaa38, emissiveIntensity: 1.85, flat: true });
  const cyanLit = toonMat(0x0c283e, { emissive: 0x5ceeff, emissiveIntensity: 1.9, flat: true });

  // Ground-anchored octagonal reinforced bunker ring + 8 concrete/steel blast buttresses + glowing shaft well!
  const hatch = new THREE.Group();
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(7.6, 9.6, 2.2, 8), hazardMat);
  collar.position.y = 1.1; hatch.add(collar);
  const shaftWell = new THREE.Mesh(new THREE.CircleGeometry(6.2, 8), amberLit);
  shaftWell.rotation.x = -Math.PI / 2; shaftWell.position.y = 2.05; hatch.add(shaftWell);
  const rimRing = new THREE.Mesh(new THREE.TorusGeometry(6.7, 0.46, 6, 8), amberLit);
  rimRing.rotation.x = Math.PI / 2; rimRing.position.y = 2.22; hatch.add(rimRing);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    const rib = taperBox(1.2, 2.1, 1.8, 2.3, 2.6, 0x263246, { map: shipArmorTex });
    rib.position.set(Math.cos(a) * 8.4, 1.1, Math.sin(a) * 8.4);
    rib.rotation.y = -a + Math.PI / 2; hatch.add(rib);
    if (i % 2 === 0) {
      const beacon = glowSprite(0xff8438, 2.6, 0.88);
      beacon.position.set(Math.cos(a) * 8.2, 2.6, Math.sin(a) * 8.2); hatch.add(beacon);
    }
  }

  // 4 true beveled chevron blast-door petals (`doors[]`) with armored interlocking ribs!
  const doors = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.PI * 0.25;
    const hinge = new THREE.Group();
    hinge.position.set(Math.cos(a) * 6.2, 2.15, Math.sin(a) * 6.2);
    hinge.rotation.y = -a;
    const leaf = extrudeBevel([[0, -2.8], [-5.2, -1.6], [-6.0, 0], [-5.2, 1.6], [0, 2.8]], 0.56, hazardMat, { bevel: 0.14 });
    leaf.rotation.x = Math.PI / 2; leaf.position.y = 0.26; hinge.add(leaf);
    const doorRib = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.34, 0.65), darkMat);
    doorRib.position.set(-2.6, 0.62, 0); hinge.add(doorRib);
    hatch.add(hinge);
    doors.push(hinge);
  }
  g.add(hatch);

  // Lathed multi-stage telescoping armored spire (`tower`) + 4 twin-stage hydraulic actuator rams!
  const tower = new THREE.Group();
  const shaft = latheHull([[4.3, -14.5], [4.1, -10.5], [3.65, -10.0], [3.55, -5.2], [3.15, -4.8], [3.2, -0.5], [3.6, 0.0]], 8, steelMat);
  tower.add(shaft);
  for (const py of [-10.2, -5.0, -1.6]) {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(3.95, 4.05, 1.05, 8), hazardMat);
    band.position.y = py; tower.add(band);
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU;
    const cylLow = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.64, 7.6, 6), darkMat);
    cylLow.position.set(Math.cos(a) * 4.15, -10.4, Math.sin(a) * 4.15); tower.add(cylLow);
    const rodHigh = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 7.6, 6), amberLit);
    rodHigh.position.set(Math.cos(a) * 4.15, -4.0, Math.sin(a) * 4.15); tower.add(rodHigh);
  }

  // Heavy articulated angular gun-house (`head`) + dual full rail cannons + 12-cell SAM racks + dual-dish radar!
  const head = new THREE.Group();
  head.position.y = 0.85;
  const mantlet = taperBox(6.2, 3.2, 7.4, 3.6, 6.8, 0x4a586e, { map: shipArmorTex, topPinch: 0.74 });
  head.add(mantlet);
  const bustle = taperBox(5.2, 2.2, 4.4, 1.8, 3.2, 0x263246, { map: shipHazardTex });
  bustle.position.set(0, 0.5, 4.2); head.add(bustle);
  const visorGallery = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.1, 0.45), windowMat);
  visorGallery.position.set(0, 0.65, -3.45); head.add(visorGallery);
  const opticPod = buildOpticalPod(0.75, 0x5ceeff, darkMat, cyanLit);
  opticPod.position.set(0, 0.65, -3.72); head.add(opticPod);

  for (const s of [-1, 1]) {
    // Beveled cheek armor shield plates
    const cheek = extrudeBevel([[0, -1.2], [2.4, -0.8], [3.2, 0.8], [0, 1.3]], 0.55, steelMat, { bevel: 0.12 });
    cheek.rotation.y = s * 0.32; cheek.position.set(s * 2.8, 0.1, -1.8); head.add(cheek);
    // Twin full electromagnetic rail cannons (`buildRailBarrel`)!
    const rail = buildRailBarrel(8.8, 0.44, 0x5ceeff, darkMat, steelMat, cyanLit);
    rail.position.set(s * 1.55, 0.15, -2.6); head.add(rail);
    // Side 6-cell SAM armored missile pod with 6 protruding red-gold warhead cones!
    const samPod = taperBox(2.5, 3.2, 2.7, 3.4, 4.2, 0x3b485e, { map: shipHazardTex });
    samPod.position.set(s * 4.8, 0.45, 0.25); head.add(samPod);
    for (const mx of [-0.52, 0.52]) for (const my of [-0.85, 0, 0.85]) {
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.95, 6), amberLit);
      tip.rotation.x = -Math.PI / 2; tip.position.set(s * 4.8 + mx, 0.45 + my, -2.15); head.add(tip);
    }
  }
  // Dual-dish spinning AWACS fire-control radar crown!
  const radar = new THREE.Group();
  radar.name = 'combatRadar';
  radar.position.set(0, 2.65, 0.4);
  radar.add(cyl(0.32, 0.42, 2.2, 6, 0x1b2434, { flat: true }));
  const rBar = box(6.2, 0.54, 0.44, 0x525e74, { map: shipHazardTex, flat: true });
  rBar.position.y = 1.1; radar.add(rBar);
  for (const s of [-1, 1]) {
    const dish = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.15, 5, 12), cyanLit);
    dish.rotation.y = Math.PI / 2; dish.position.set(s * 3.1, 1.1, 0); radar.add(dish);
  }
  head.add(radar);

  const glow = glowSprite(0xff9a3c, 4.6, 0.95);
  glow.position.set(0, 0.65, -4.6); head.add(glow);
  tower.add(head);
  g.add(tower);

  g.userData.glow = glow;
  g.userData.hatch = hatch;
  g.userData.doors = doors;
  g.userData.tower = tower;
  g.userData.head = head;
  g.userData.meshScale = 1.22;
  return g;
}

/**
 * MAGMA DRILL-WYRM (`wyrm`) — volcanic subterranean obsidian & molten-gold drill-serpent!
 * Lathed spiral-fluted plasma drill with 3 helical tungsten cutter blades, swept obsidian crown horns,
 * articulated chomping magma mandibles (`jawL`/`jawR`) & 5 beveled overlapping armored dragon vertebrae!
 */
export function buildWyrm() {
  const g = new THREE.Group();
  const norm = new THREE.Vector2(0.55, 0.55);
  const obsidianMat = toonMat(0x281a28, { map: shipArmorTex, normalMap: shipArmorNormal, normalScale: norm, flat: true });
  const darkMat = toonMat(0x160e1c, { map: shipArmorTex, normalMap: shipArmorNormal, normalScale: norm, flat: true });
  const bronzeMat = toonMat(0xa84c28, { map: shipHazardTex, normalMap: shipArmorNormal, normalScale: norm, flat: true });
  const magmaLit = toonMat(0x4a160e, { emissive: 0xff6224, emissiveIntensity: 1.95, flat: true });
  const goldLit = toonMat(0x4e2c0a, { emissive: 0xffcc42, emissiveIntensity: 2.0, flat: true });

  const segs = [];
  // Segment 0: Multi-layered Armored Dragon-Drill Skull + Swept Crown Horns + Helical Auger + Articulated Jaws!
  const head = new THREE.Group();
  const skull = taperBox(3.6, 2.9, 4.8, 3.6, 5.6, 0x281a28, { map: shipArmorTex, topPinch: 0.68 });
  head.add(skull);
  const browPlate = extrudeBevel([[-2.2, 0], [-1.5, 1.4], [1.5, 1.4], [2.2, 0], [1.6, -0.4], [-1.6, -0.4]], 4.2, bronzeMat, { bevel: 0.14 });
  browPlate.position.set(0, 1.35, -0.2); head.add(browPlate);

  // True lathed conical plasma drill auger wrapped in 3 spiraling tungsten cutting blades + 4 magma coils!
  const drill = new THREE.Group();
  drill.position.set(0, 0, -2.9);
  const auger = latheHull([[0.01, 5.8], [0.65, 4.4], [1.25, 2.8], [1.75, 1.2], [2.05, 0.0]], 10, bronzeMat);
  auger.rotation.x = -Math.PI / 2; drill.add(auger);
  for (let b = 0; b < 3; b++) {
    const ba = (b / 3) * TAU;
    const flute = extrudeBevel([[0, 0], [0.55, 0.4], [0.22, 5.4], [-0.15, 5.4]], 0.24, obsidianMat, { bevel: 0.06 });
    flute.rotation.x = -Math.PI / 2; flute.rotation.z = ba;
    flute.position.set(Math.cos(ba) * 1.15, Math.sin(ba) * 1.15, -2.7); drill.add(flute);
  }
  for (let r = 0; r < 4; r++) {
    const coil = new THREE.Mesh(new THREE.TorusGeometry(1.85 - r * 0.38, 0.19, 5, 12), r % 2 ? goldLit : magmaLit);
    coil.position.z = -0.6 - r * 1.2; drill.add(coil);
  }
  head.add(drill);

  // Articulated hinged crushing magma mandibles (`jawL`/`jawR`) + swept beveled obsidian crown horns!
  let jawL = null, jawR = null;
  for (const s of [-1, 1]) {
    const horn = extrudeBevel([[0, 0], [1.4, 2.6], [3.8, 3.8], [2.2, 1.6], [1.8, 0]], 0.58, bronzeMat, { bevel: 0.12 });
    horn.rotation.y = -Math.PI / 2 + s * 0.28; horn.rotation.z = s * -0.42;
    horn.position.set(s * 1.65, 1.65, 0.4); head.add(horn);

    const eyePod = buildOpticalPod(0.68, 0xffe054, darkMat, goldLit);
    eyePod.position.set(s * 1.95, 0.78, -1.85); eyePod.rotation.y = s * -0.35; head.add(eyePod);

    const jawPivot = new THREE.Group();
    jawPivot.position.set(s * 2.15, -0.65, -1.4);
    const jawBlade = extrudeBevel([[0, 0], [s * 0.9, -2.8], [s * -0.45, -4.4], [s * -0.65, -2.2], [s * -0.25, 0]], 0.68, bronzeMat, { bevel: 0.12 });
    jawBlade.rotation.x = Math.PI / 2; jawPivot.add(jawBlade);
    const jawGlow = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.28, 3.2), magmaLit);
    jawGlow.position.set(s * 0.1, 0, -2.2); jawPivot.add(jawGlow);
    head.add(jawPivot);
    if (s < 0) jawL = jawPivot; else jawR = jawPivot;

    const gillVent = new THREE.Mesh(new THREE.BoxGeometry(0.26, 1.35, 3.2), magmaLit);
    gillVent.position.set(s * 2.45, 0.15, 0.65); head.add(gillVent);
  }
  const noseGlow = glowSprite(0xff8428, 5.0, 0.96);
  noseGlow.position.set(0, 0, -8.8); head.add(noseGlow);
  g.add(head);
  segs.push(head);

  // Segments 1..5: Overlapping Beveled Obsidian Carapace Scales + Molten Core + Twin Wing-Ribs + Dorsal Sail!
  for (let i = 1; i <= 5; i++) {
    const seg = new THREE.Group();
    const sc = 1 - i * 0.10;
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(1.55 * sc, 1), magmaLit);
    seg.add(core);
    const plate = taperBox(3.8 * sc, 2.7 * sc, 3.3 * sc, 2.4 * sc, 3.9 * sc, i % 2 ? 0x281a28 : 0x160e1c, { map: shipArmorTex, topPinch: 0.66 });
    seg.add(plate);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(1.95 * sc, 0.28 * sc, 6, 12), magmaLit);
    collar.position.z = -1.35 * sc; seg.add(collar);
    // Beveled serrated dorsal ridge sail!
    const sail = extrudeBevel([[0, 0], [0.9 * sc, 2.4 * sc], [2.4 * sc, 1.9 * sc], [2.6 * sc, 0]], 0.34 * sc, bronzeMat, { bevel: 0.08 * sc });
    sail.rotation.y = -Math.PI / 2; sail.position.set(0, 1.2 * sc, -0.9 * sc); seg.add(sail);
    // Swept lateral volcanic stabilizer rib-fins!
    for (const s of [-1, 1]) {
      const rib = extrudeBevel([[0, -0.8 * sc], [s * 2.2 * sc, 0.6 * sc], [s * 1.8 * sc, 1.5 * sc], [0, 0.9 * sc]], 0.24 * sc, darkMat, { bevel: 0.06 * sc });
      rib.rotation.x = Math.PI / 2; rib.rotation.z = s * -0.35;
      rib.position.set(s * 1.7 * sc, 0, 0); seg.add(rib);
    }
    if (i === 5) {
      // Twin-pronged molten tail pincer + vectored magma exhaust jet!
      for (const s of [-1, 1]) {
        const tailBlade = extrudeBevel([[0, 0], [s * 0.9, 3.8], [s * 0.1, 4.8], [s * -0.3, 1.2]], 0.34, goldLit, { bevel: 0.06 });
        tailBlade.rotation.x = Math.PI / 2; tailBlade.position.set(s * 0.6, 0, 1.4); seg.add(tailBlade);
      }
      const tailJet = buildVectoredNozzle(0xff6a24, 0.95, 6.6, obsidianMat, darkMat, magmaLit);
      tailJet.position.z = 2.4; seg.add(tailJet);
    }
    seg.position.set(0, -i * 3.8, 0);
    g.add(seg);
    segs.push(seg);
  }

  g.userData.glow = noseGlow;
  g.userData.segs = segs;
  g.userData.drill = drill;
  g.userData.jawL = jawL;
  g.userData.jawR = jawR;
  g.userData.meshScale = 1.38;
  return g;
}

/**
 * DUNE SAND-SCORPION STRIDER (`scorpion`) — desert-gold & obsidian hover-arachnid mecha!
 * Layered beveled carapace plates, 5 crimson compound optics, twin articulated snapping pincer-cannon
 * claws (`clawL`/`clawR`), 6 articulated 3-joint hover-spider legs (`legs[]`) & 5-segment arching
 * rail-stinger tail (`tail`) with twin vectored jump-boosters!
 */
export function buildScorpion() {
  const g = new THREE.Group();
  const norm = new THREE.Vector2(0.55, 0.55);
  const sandMat = toonMat(0xc48c3e, { map: shipArmorTex, normalMap: shipArmorNormal, normalScale: norm, flat: true });
  const darkMat = toonMat(0x221f2b, { map: shipArmorTex, normalMap: shipArmorNormal, normalScale: norm, flat: true });
  const hazardMat = toonMat(0x765636, { map: shipHazardTex, normalMap: shipArmorNormal, normalScale: norm, flat: true });
  const windowMat = toonMat(0x1b2420, { map: shipWindowTex, emissive: 0x62ff78, emissiveMap: shipWindowTex, emissiveIntensity: 0.65, flat: true });
  const limeLit = toonMat(0x143820, { emissive: 0x62ff7c, emissiveIntensity: 1.9, flat: true });
  const redLit = toonMat(0x46101c, { emissive: 0xff425c, emissiveIntensity: 1.9, flat: true });

  // Multi-tiered beveled arachnid thorax carapace + glowing emerald energy vents + 5-lens predator optics!
  const chassis = taperBox(4.6, 2.1, 5.8, 2.6, 7.8, 0xc48c3e, { map: shipArmorTex, topPinch: 0.70 });
  g.add(chassis);
  for (let tier = 0; tier < 3; tier++) {
    const shell = extrudeBevel([[-2.2 + tier * 0.25, -0.9], [-2.5 + tier * 0.25, 0.7], [0, 1.35], [2.5 - tier * 0.25, 0.7], [2.2 - tier * 0.25, -0.9]], 0.58, tier % 2 ? hazardMat : sandMat, { bevel: 0.14 });
    shell.rotation.x = Math.PI / 2; shell.position.set(0, 1.35 + tier * 0.14, -1.6 + tier * 2.1); g.add(shell);
  }
  const browVisor = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.68, 0.42), windowMat);
  browVisor.position.set(0, 0.65, -3.95); g.add(browVisor);
  for (const [ox, oy, or] of [[-1.45, 0.48, 0.34], [-0.72, 0.66, 0.40], [0, 0.76, 0.54], [0.72, 0.66, 0.40], [1.45, 0.48, 0.34]]) {
    const lens = new THREE.Mesh(new THREE.SphereGeometry(or, 8, 6), redLit);
    lens.position.set(ox, oy, -4.18); g.add(lens);
  }

  // Twin articulated snapping hydraulic pincer-cannon claws (`clawL`/`clawR`) + twin vectored jump boosters!
  let clawL = null, clawR = null;
  for (const s of [-1, 1]) {
    const armRoot = new THREE.Group();
    armRoot.position.set(s * 2.65, -0.05, -2.2);
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.88, 8, 6), hazardMat);
    armRoot.add(shoulder);
    const forearm = taperBox(1.2, 1.0, 1.5, 1.15, 3.8, 0x221f2b, { map: shipArmorTex });
    forearm.position.set(s * 0.75, 0, -1.8); forearm.rotation.y = s * -0.26; armRoot.add(forearm);
    // Opposing beveled serrated pincer blades framing a central claw railgun!
    const outerBlade = extrudeBevel([[0, 0], [s * 1.1, -1.4], [s * 0.85, -3.8], [s * -0.2, -4.4], [s * 0.2, -1.8], [s * -0.2, 0]], 0.58, sandMat, { bevel: 0.12 });
    outerBlade.rotation.x = Math.PI / 2; outerBlade.position.set(s * 1.45, 0, -3.4); armRoot.add(outerBlade);
    const innerBlade = extrudeBevel([[0, 0], [s * -0.8, -1.5], [s * -0.35, -3.4], [s * 0.25, -2.4], [s * 0.15, 0]], 0.46, hazardMat, { bevel: 0.10 });
    innerBlade.rotation.x = Math.PI / 2; innerBlade.position.set(s * 0.55, 0, -3.5); armRoot.add(innerBlade);
    const clawCannon = buildRailBarrel(4.2, 0.24, 0x62ff7c, darkMat, sandMat, limeLit);
    clawCannon.position.set(s * 0.92, -0.1, -3.2); armRoot.add(clawCannon);
    g.add(armRoot);
    if (s < 0) clawL = armRoot; else clawR = armRoot;

    // Rear 6-petal vectored desert jump-boosters
    const jet = buildVectoredNozzle(0xffa638, 0.84, 5.8, sandMat, darkMat, limeLit);
    jet.position.set(s * 1.75, 0.12, 4.35); g.add(jet);
  }

  // 6 articulated 3-joint mechanical hover-arachnid legs (`legs[]`) with beveled femur/tibia + hover rings!
  const legs = [];
  for (const s of [-1, 1]) {
    for (const lz of [-2.0, 0.2, 2.4]) {
      const legRoot = new THREE.Group();
      legRoot.position.set(s * 2.65, -0.35, lz);
      const hip = new THREE.Mesh(new THREE.SphereGeometry(0.64, 8, 6), hazardMat);
      legRoot.add(hip);
      const femur = extrudeBevel([[0, -0.32], [s * 2.9, 0.45], [s * 2.8, 1.05], [0, 0.35]], 0.52, darkMat, { bevel: 0.10 });
      legRoot.add(femur);
      const knee = new THREE.Mesh(new THREE.SphereGeometry(0.54, 8, 6), hazardMat);
      knee.position.set(s * 2.85, 0.65, 0); legRoot.add(knee);
      const tibia = extrudeBevel([[0, 0.2], [s * 0.85, -1.6], [s * 0.42, -3.6], [s * -0.15, -3.5], [s * -0.25, -0.2]], 0.46, sandMat, { bevel: 0.10 });
      tibia.position.set(s * 2.85, 0.65, 0); legRoot.add(tibia);
      const hoverRing = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.12, 5, 10), limeLit);
      hoverRing.rotation.x = Math.PI / 2; hoverRing.position.set(s * 3.15, -2.95, 0); legRoot.add(hoverRing);
      const hoverJet = glowSprite(0x62ff7c, 2.2, 0.85);
      hoverJet.position.set(s * 3.15, -3.05, 0); legRoot.add(hoverJet);
      g.add(legRoot);
      legs.push({ root: legRoot, side: s });
    }
  }

  // Monumental 5-segment arching overhead Scorpion Rail-Stinger Tail (`tail`)!
  const tail = new THREE.Group();
  tail.position.set(0, 1.35, 3.2);
  const segCoords = [
    [0, 1.25, 1.35, 0.48],
    [0, 3.05, 1.75, 0.12],
    [0, 4.75, 1.10, -0.42],
    [0, 5.85, -0.45, -0.96],
    [0, 6.05, -2.15, -1.42],
  ];
  for (let i = 0; i < segCoords.length; i++) {
    const [tx, ty, tz, rx] = segCoords[i];
    const s = 1 - i * 0.08;
    const tSeg = taperBox(1.65 * s, 1.22 * s, 1.42 * s, 1.08 * s, 2.25, i % 2 ? 0x221f2b : 0xc48c3e, { map: i % 2 ? shipArmorTex : shipHazardTex });
    tSeg.position.set(tx, ty, tz); tSeg.rotation.x = rx; tail.add(tSeg);
    const conduit = new THREE.Mesh(new THREE.TorusGeometry(0.88 * s, 0.13 * s, 5, 10), limeLit);
    conduit.position.set(tx, ty, tz); conduit.rotation.x = rx; tail.add(conduit);
  }
  // Sculpted Venom-Rail Stinger Bulb + Stabilizer Vanes + Full Rail-Lance Stinger!
  const bulb = latheHull([[0.01, 2.4], [0.95, 1.6], [1.28, 0.7], [0.85, -0.4], [0.01, -0.9]], 10, sandMat);
  bulb.rotation.x = -Math.PI / 2; bulb.position.set(0, 6.05, -3.1); tail.add(bulb);
  const stingerRail = buildRailBarrel(4.2, 0.34, 0xff425c, darkMat, hazardMat, redLit);
  stingerRail.position.set(0, 6.05, -3.0); tail.add(stingerRail);
  for (const s of [-1, 1]) {
    const vane = extrudeBevel([[0, 0], [s * 1.4, -0.9], [s * 1.1, 0.6], [0, 0.8]], 0.18, darkMat, { bevel: 0.05 });
    vane.rotation.x = Math.PI / 2; vane.position.set(s * 0.75, 6.05, -3.2); tail.add(vane);
  }
  const stingerRing = new THREE.Mesh(new THREE.TorusGeometry(1.18, 0.15, 6, 14), limeLit);
  stingerRing.position.set(0, 6.05, -4.6); tail.add(stingerRing);
  const stingerGlow = glowSprite(0xff4a68, 4.2, 0.96);
  stingerGlow.position.set(0, 6.05, -7.2); tail.add(stingerGlow);
  g.add(tail);

  const eye = glowSprite(0xff4a68, 4.0, 0.94);
  eye.position.set(0, 0.65, -4.9); g.add(eye);
  g.userData.glow = eye;
  g.userData.legs = legs;
  g.userData.tail = tail;
  g.userData.stingerRing = stingerRing;
  g.userData.clawL = clawL;
  g.userData.clawR = clawR;
  g.userData.meshScale = 1.36;
  return g;
}
