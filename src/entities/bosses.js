import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { toonMat, dotTexture, rand, clamp, damp, TAU, _v1, _v2 } from '../core/util.js';
import { normalizeImportedMaterial } from './shipFactory.js';
import { PLAYER_Z } from './player.js';

/* ============================================================================
 * High-detail CC0 flagship hulls for spacefaring / orbital bosses.
 * CascadeWarden & EmberSerpent use 100% bespoke sculpted architecture so they
 * never collapse into low-poly grey hangars or lumpy pebbles.
 * Every persistent hardware Group physically bridges into the central hull so
 * ZERO weakpoints, turrets, or nacelles ever float in mid-air, and every boss's
 * focal cores, turrets, sliding doors, and dragon jaws face the player (+Z)!
 * ============================================================================ */
const BOSS_MODELS = {};
function loadBossModel(key, path, size, opts = {}) {
  const ext = opts.ext || (path.startsWith('ships/') ? 'gltf' : 'glb');
  new GLTFLoader().load(`./assets/models/${path}.${ext}`, (g) => {
    const obj = g.scene;
    obj.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = o.receiveShadow = false;
      if (o.geometry) o.geometry.userData.shared = true;
      for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
        normalizeImportedMaterial(m, {
          emissiveFloor: opts.emissiveFloor ?? 0.24,
          tint: opts.tint,
          tintStrength: opts.tintStrength ?? 0.28,
        });
        if (m) m.userData.shared = true;
      }
    });
    const box = new THREE.Box3().setFromObject(obj);
    const c = box.getCenter(new THREE.Vector3());
    const dim = box.getSize(new THREE.Vector3());
    const s = size / (Math.max(dim.x, dim.y, dim.z) || 1);
    obj.scale.setScalar(s);
    obj.position.set(-c.x * s, -c.y * s, -c.z * s);
    BOSS_MODELS[key] = obj;
  });
}

// High-poly 3–4 MB flagship hulls matched to each boss's silhouette:
loadBossModel('ray', 'ships/bob', 68, { tint: 0x3878a8, tintStrength: 0.34 });             // TEMPEST RAY — sleek wide manta cruiser (3.5 MB)
loadBossModel('dread', 'ships/imperial', 78, { tint: 0x424d6e, tintStrength: 0.26 });      // DREAD SOVEREIGN — imperial dreadnought (4.3 MB)
loadBossModel('matriarch', 'ships/insurgent', 94, { tint: 0x3b2c58, tintStrength: 0.34 }); // OBSIDIAN MATRIARCH — assault carrier (3.1 MB)
loadBossModel('harbinger', 'external/aero_station_ring', 118, { ext: 'glb', emissiveFloor: 0.32 }); // RIFT HARBINGER — orbital citadel ring

let _sharedScorchTex = null;

function glowSprite(color, size, opacity = 0.95) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: dotTexture(), color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  s.scale.setScalar(size);
  return s;
}

/* ============================================================================
 * High-Definition 512px Procedural Warship Textures (shared = true)
 * ============================================================================ */
function makeBossArmorTexture() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#9aa7bc';
  ctx.fillRect(0, 0, 512, 512);

  const rows = [
    [0, 128, [0, 176, 344, 512]],
    [128, 128, [0, 128, 320, 512]],
    [256, 128, [0, 210, 384, 512]],
    [384, 128, [0, 144, 304, 512]],
  ];
  let idx = 0;
  for (const [y, h, xs] of rows) {
    for (let k = 0; k < xs.length - 1; k++) {
      const x = xs[k] + 5, w = xs[k + 1] - xs[k] - 10, py = y + 5, ph = h - 10;
      const shades = ['#b8c4d6', '#a4b2c7', '#c2cde0', '#96a5bc'];
      ctx.fillStyle = shades[(idx++) % shades.length];
      ctx.fillRect(x, py, w, ph);

      ctx.strokeStyle = 'rgba(14, 20, 32, 0.72)';
      ctx.lineWidth = 4;
      ctx.strokeRect(x, py, w, ph);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.48)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 3, py + ph - 3);
      ctx.lineTo(x + 3, py + 3);
      ctx.lineTo(x + w - 3, py + 3);
      ctx.stroke();

      if (w > 130) {
        ctx.strokeStyle = 'rgba(20, 30, 46, 0.36)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 18, py + 18, w - 36, ph - 36);
      }

      ctx.fillStyle = 'rgba(18, 28, 44, 0.65)';
      for (const rx of [x + 11, x + w - 11]) {
        for (const ry of [py + 11, py + ph - 11]) {
          ctx.beginPath(); ctx.arc(rx, ry, 2.8, 0, TAU); ctx.fill();
        }
      }
    }
  }
  ctx.fillStyle = 'rgba(15, 22, 34, 0.62)';
  for (let i = 0; i < 6; i++) {
    ctx.fillRect(28 + i * 20, 152, 11, 72);
    ctx.fillRect(340 + i * 20, 408, 11, 72);
  }
  ctx.fillStyle = 'rgba(255, 255, 255, 0.24)';
  ctx.fillRect(16, 286, 176, 12);
  ctx.fillStyle = 'rgba(16, 24, 38, 0.42)';
  ctx.fillRect(16, 302, 176, 8);

  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.userData = { shared: true };
  return t;
}

function makeBossHazardTexture() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#384354';
  ctx.fillRect(0, 0, 256, 256);
  const drawChevrons = (y0, h) => {
    ctx.save();
    ctx.beginPath(); ctx.rect(0, y0, 256, h); ctx.clip();
    ctx.fillStyle = '#e8a830';
    ctx.fillRect(0, y0, 256, h);
    ctx.fillStyle = '#1b202a';
    for (let x = -64; x < 320; x += 36) {
      ctx.beginPath();
      ctx.moveTo(x, y0 + h); ctx.lineTo(x + 18, y0 + h);
      ctx.lineTo(x + 38, y0); ctx.lineTo(x + 20, y0);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  };
  drawChevrons(0, 42);
  drawChevrons(214, 42);
  ctx.fillStyle = '#4c596e';
  ctx.fillRect(10, 50, 236, 156);
  ctx.strokeStyle = '#151c28';
  ctx.lineWidth = 6;
  ctx.strokeRect(10, 50, 236, 156);
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 64, 208, 128);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.userData = { shared: true };
  return t;
}

function makeBossWindowTexture() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#131c2c';
  ctx.fillRect(0, 0, 512, 256);
  ctx.fillStyle = '#26344c';
  for (let r = 0; r < 6; r++) ctx.fillRect(0, r * 42, 512, 8);
  for (let r = 0; r < 6; r++) {
    const y = r * 42 + 14;
    for (let col = 0; col < 14; col++) {
      const lit = ((r * 11 + col * 17) % 6) !== 0;
      if (r === 1 && col >= 3 && col <= 10) {
        ctx.fillStyle = '#7bf5ff';
        ctx.fillRect(12 + col * 35, y - 2, 31, 20);
      } else {
        ctx.fillStyle = lit ? (r % 2 === 0 ? '#ffd875' : '#8ef0ff') : '#1c2a40';
        ctx.fillRect(14 + col * 35, y, 24, 15);
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.userData = { shared: true };
  return t;
}

const bossArmorTex = makeBossArmorTexture();
const bossHazardTex = makeBossHazardTexture();
const bossWindowTex = makeBossWindowTexture();

/* ============================================================================
 * Sculpted Aerospace / Fortress Geometry Builders
 * ============================================================================ */

/** Chamfered aerospace tapered prism: front (-Z) narrows/shifts into back (+Z). */
function taperHull(wf, hf, wb, hb, len, mat, opts = {}) {
  const geo = new THREE.BoxGeometry(1, 1, len, 1, 1, 1);
  const pos = geo.attributes.position;
  const topPinch = opts.topPinch ?? 0.78;
  const botPinch = opts.botPinch ?? 0.90;
  const yShiftFront = opts.yShiftFront ?? 0;
  const xShiftFront = opts.xShiftFront ?? 0;
  const yShiftBack = opts.yShiftBack ?? 0;
  const xShiftBack = opts.xShiftBack ?? 0;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const isFront = z < 0;
    const w = isFront ? wf : wb;
    const h = isFront ? hf : hb;
    const pinch = y > 0 ? topPinch : botPinch;
    pos.setX(i, x * w * pinch + (isFront ? xShiftFront : xShiftBack));
    pos.setY(i, y * h + (isFront ? yShiftFront : yShiftBack));
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}

/** Swept aerodynamic wing blade extending along +X (mirror via scale.x = -1). */
function sweptWing(span, chordRoot, chordTip, sweepZ, thick, mat, opts = {}) {
  const geo = new THREE.BoxGeometry(span, thick, 1, 1, 1, 1);
  geo.translate(span * 0.5, 0, 0);
  const pos = geo.attributes.position;
  const dropY = opts.dropY ?? 0;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const k = clamp(x / span, 0, 1);
    const chord = chordRoot + (chordTip - chordRoot) * k;
    pos.setZ(i, z * chord + k * sweepZ);
    pos.setY(i, y * (1 - k * 0.45) + k * dropY);
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}

/** Volumetric 3D additive plasma thruster plume trailing along +Z (toward chase camera). */
function buildBossPlume(color, radius, length) {
  const g = new THREE.Group();
  const outerGeo = new THREE.ConeGeometry(radius, length, 10, 1, true);
  outerGeo.translate(0, -length * 0.5, 0);
  outerGeo.rotateX(-Math.PI / 2);
  const outer = new THREE.Mesh(outerGeo, new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0.64, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  const innerGeo = new THREE.ConeGeometry(radius * 0.48, length * 0.68, 8, 1, true);
  innerGeo.translate(0, -length * 0.34, 0);
  innerGeo.rotateX(-Math.PI / 2);
  const inner = new THREE.Mesh(innerGeo, new THREE.MeshBasicMaterial({
    color: 0xf6fdff, transparent: true, opacity: 0.90, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  g.add(outer, inner);
  return g;
}

/** Multi-layer Star Fox thruster nacelle: tapered cowling + 6 vectoring petals + spinning turbine + plume. */
function buildEngineNacelle(boss, armorMat, darkMat, litMat, accent, radius = 2.4, length = 16) {
  const g = new THREE.Group();
  const cowl = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.95, radius * 1.24, radius * 2.2, 10), armorMat);
  cowl.rotation.x = Math.PI / 2;
  cowl.position.z = -radius * 0.9;
  g.add(cowl);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.96, radius * 0.14, 6, 14), darkMat);
  collar.position.z = radius * 0.18;
  g.add(collar);

  for (let p = 0; p < 6; p++) {
    const a = (p / 6) * TAU;
    const petal = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.34, radius * 0.68, radius * 0.92), darkMat);
    petal.position.set(Math.cos(a) * radius * 0.98, Math.sin(a) * radius * 0.98, radius * 0.34);
    petal.rotation.z = a;
    g.add(petal);
  }

  const turbine = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.68, radius * 0.11, 6, 12), litMat);
  turbine.position.z = radius * 0.24;
  g.add(turbine);
  boss.rotors.push({ mesh: turbine, axis: 'z', speed: 3.4 });

  const coreDisc = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.62, 10), litMat);
  coreDisc.position.z = radius * 0.28;
  g.add(coreDisc);

  const plume = buildBossPlume(accent, radius * 0.94, length);
  plume.position.z = radius * 0.30;
  g.add(plume);
  boss.plumes.push({ mesh: plume, phase: rand(0, TAU) });

  const glow = glowSprite(accent, radius * 2.4, 0.92);
  glow.position.z = radius * 0.9;
  g.add(glow);
  return g;
}

/** Articulated armored twin/triple-barrel boss turret pointing natively toward +Z (the player!) and tracking smoothly. */
function buildTrackingTurret(boss, armorMat, hazardMat, darkMat, litMat, accent, opts = {}) {
  const scale = opts.scale ?? 1.0;
  const barrels = opts.barrels ?? 2;
  const barrelLen = (opts.len ?? 8.5) * scale;
  const root = new THREE.Group();

  const barbette = new THREE.Mesh(new THREE.CylinderGeometry(2.0 * scale, 2.6 * scale, 1.5 * scale, 8), armorMat);
  barbette.position.y = 0.75 * scale;
  root.add(barbette);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(2.15 * scale, 2.25 * scale, 0.48 * scale, 8), hazardMat);
  ring.position.y = 1.55 * scale;
  root.add(ring);

  // Rotating turret head: barrels extend along +Z directly toward the player!
  const head = new THREE.Group();
  head.position.y = 2.0 * scale;
  const mantlet = taperHull(3.2 * scale, 1.75 * scale, 2.5 * scale, 1.45 * scale, 3.8 * scale, armorMat, { topPinch: 0.72 });
  head.add(mantlet);
  const optic = new THREE.Mesh(new THREE.BoxGeometry(1.4 * scale, 0.45 * scale, 0.35 * scale), litMat);
  optic.position.set(0, 0.55 * scale, 1.9 * scale);
  head.add(optic);

  const offsets = barrels === 3 ? [-0.88, 0, 0.88] : [-0.62, 0.62];
  for (const off of offsets) {
    const bx = off * scale;
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.34 * scale, 0.22 * scale, barrelLen, 7), darkMat);
    tube.rotation.x = Math.PI / 2;
    tube.position.set(bx, 0.05 * scale, barrelLen * 0.55 + 0.8 * scale);
    head.add(tube);

    const jacket = new THREE.Mesh(new THREE.CylinderGeometry(0.42 * scale, 0.42 * scale, barrelLen * 0.24, 7), litMat);
    jacket.rotation.x = Math.PI / 2;
    jacket.position.set(bx, 0.05 * scale, barrelLen * 0.28 + 0.8 * scale);
    head.add(jacket);

    const brake = new THREE.Mesh(new THREE.CylinderGeometry(0.26 * scale, 0.32 * scale, 0.7 * scale, 6), armorMat);
    brake.rotation.x = Math.PI / 2;
    brake.position.set(bx, 0.05 * scale, barrelLen + 0.65 * scale);
    head.add(brake);
  }
  const muzzle = glowSprite(accent, 2.1 * scale, 0.82);
  muzzle.position.set(0, 0.05 * scale, barrelLen + 0.9 * scale);
  head.add(muzzle);

  root.add(head);
  boss.trackingTurrets.push({ root, head, maxYaw: opts.maxYaw ?? 0.65, maxPitch: opts.maxPitch ?? 0.36 });
  return root;
}

const BOSS_TAG_TEXTURES = new Map();
function bossTagTexture(name) {
  if (BOSS_TAG_TEXTURES.has(name)) return BOSS_TAG_TEXTURES.get(name);
  const c = document.createElement('canvas'); c.width = 640; c.height = 96;
  const ctx = c.getContext('2d');
  ctx.lineWidth = 5; ctx.strokeStyle = '#ffffff';
  ctx.beginPath(); ctx.moveTo(18, 32); ctx.lineTo(18, 14); ctx.lineTo(96, 14); ctx.moveTo(622, 32); ctx.lineTo(622, 14); ctx.lineTo(544, 14); ctx.stroke();
  ctx.font = '700 32px system-ui, sans-serif'; ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`BOSS // ${name}`, 320, 50);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  BOSS_TAG_TEXTURES.set(name, t); return t;
}

function scaleBoss(boss, s) {
  boss.group.scale.setScalar(s);
  boss.bodyRadius *= s;
  for (const w of boss.weakpoints) w.radius *= s;
  boss._scale = s;
}

/* ============================================================================
 * Articulated Weakpoint Reactor Assembly (oriented toward +Z player camera!)
 * - Armored octagonal socket + hazard flange + 4 animated clamp jaws
 * - Energy barrier dome while shielded (!active)
 * - Persistent charred wreckage crater after destruction
 * ============================================================================ */
class Weakpoint {
  constructor(parent, pos, radius, hp, color = 0xff3d5e) {
    this.obj = new THREE.Group();
    this.color = color;

    const bezelMat = toonMat(0x283448, { map: bossArmorTex, flat: true });
    const flangeMat = toonMat(0x4b566a, { map: bossHazardTex, flat: true });

    // Armored octagonal mounting socket seated slightly behind (-Z) so the glowing core projects cleanly toward +Z!
    this.housing = new THREE.Group();
    const bezel = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.92, radius * 1.14, Math.max(0.7, radius * 0.36), 8),
      bezelMat
    );
    bezel.rotation.x = Math.PI / 2;
    bezel.position.z = -radius * 0.24;
    this.housing.add(bezel);

    const flange = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 0.96, Math.max(0.14, radius * 0.09), 6, 8),
      flangeMat
    );
    flange.position.z = -radius * 0.06;
    this.housing.add(flange);

    this.claws = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + Math.PI * 0.25;
      const claw = taperHull(radius * 0.32, radius * 0.58, radius * 0.22, radius * 0.42, radius * 0.62, bezelMat);
      claw.position.set(Math.cos(a) * radius * 0.88, Math.sin(a) * radius * 0.88, radius * 0.08);
      claw.rotation.z = a;
      this.housing.add(claw);
      this.claws.push({ mesh: claw, angle: a });
    }
    this.obj.add(this.housing);

    // Charred scorched inner crater facing +Z shown after destruction
    this.crater = new THREE.Mesh(
      new THREE.CircleGeometry(radius * 0.72, 8),
      toonMat(0x141218, { emissive: 0xff4518, emissiveIntensity: 0.25, flat: true })
    );
    this.crater.position.z = radius * 0.06;
    this.crater.visible = false;
    this.obj.add(this.crater);

    this.core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(radius * 0.58, 1),
      toonMat(0x552233, { emissive: color, emissiveIntensity: 2.0, flat: true })
    );
    this.glow = glowSprite(color, radius * 2.8);
    this.cageA = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 0.82, Math.max(0.13, radius * 0.07), 6, 16),
      toonMat(0x172033, { emissive: color, emissiveIntensity: 0.92, flat: true })
    );
    this.cageA.rotation.x = Math.PI * 0.5;
    this.cageB = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 0.66, Math.max(0.10, radius * 0.052), 6, 14),
      toonMat(0x202a3c, { emissive: color, emissiveIntensity: 0.65, flat: true })
    );
    this.cageB.rotation.y = Math.PI * 0.5;

    this.shieldDome = new THREE.Mesh(
      new THREE.IcosahedronGeometry(radius * 1.0, 1),
      new THREE.MeshBasicMaterial({
        color: 0x62e8ff, transparent: true, opacity: 0.28, wireframe: true,
        blending: THREE.AdditiveBlending, depthWrite: false,
      })
    );
    this.shieldDome.visible = false;

    this.obj.add(this.core, this.glow, this.cageA, this.cageB, this.shieldDome);
    this.obj.position.copy(pos);
    parent.add(this.obj);
    this.radius = radius; this.hp = hp; this.maxHp = hp; this.alive = true; this.active = true;
    this.flashT = 0;
  }

  worldPos(out) { return this.obj.getWorldPosition(out); }

  hit(dmg) {
    this.hp -= dmg; this.flashT = 0.09;
    if (this.hp <= 0) {
      this.alive = false;
      this.core.visible = false;
      this.glow.visible = false;
      this.cageA.visible = false;
      this.cageB.visible = false;
      this.shieldDome.visible = false;
      this.crater.visible = true;
      this.housing.traverse((n) => {
        if (n.isMesh && n.material?.color) n.material.color.multiplyScalar(0.42);
      });
    }
    return !this.alive;
  }

  update(dt, t) {
    if (!this.alive) {
      this.crater.material.emissiveIntensity = 0.14 + Math.max(0, Math.sin(t * 7.5 + this.radius)) * 0.28;
      return;
    }
    const live = this.active ? 1 : 0.30;
    const pulse = 1 + Math.sin(t * 5.2 + this.radius) * 0.08 * live;

    this.shieldDome.visible = !this.active;
    if (!this.active) {
      this.shieldDome.rotation.y += dt * 1.4;
      this.shieldDome.rotation.x -= dt * 0.9;
    }
    const jawDist = this.radius * (this.active ? 0.96 : 0.78);
    for (const c of this.claws) {
      c.mesh.position.x = damp(c.mesh.position.x, Math.cos(c.angle) * jawDist, 6, dt);
      c.mesh.position.y = damp(c.mesh.position.y, Math.sin(c.angle) * jawDist, 6, dt);
    }

    if (this.flashT > 0) {
      this.flashT -= dt;
      this.core.material.emissiveIntensity = 4.2;
      this.cageA.material.emissiveIntensity = 3.0;
      this.cageB.material.emissiveIntensity = 2.4;
    } else {
      this.core.material.emissiveIntensity = 0.55 + live * (0.95 + Math.sin(t * 5.4) * 0.52);
      this.cageA.material.emissiveIntensity = 0.22 + live * (0.66 + Math.sin(t * 4.2) * 0.22);
      this.cageB.material.emissiveIntensity = 0.16 + live * (0.42 + Math.sin(t * 3.4 + 1) * 0.16);
    }
    this.core.rotation.y += dt * (this.active ? 2.2 : 0.6);
    this.glow.material.opacity = this.active ? 0.92 : 0.20;
    this.glow.scale.setScalar(this.radius * 2.75 * pulse);
    this.cageA.rotation.z += dt * (this.active ? 3.0 : 0.7);
    this.cageB.rotation.x += dt * (this.active ? -2.2 : -0.5);
    this.cageA.scale.setScalar(pulse);
    this.cageB.scale.setScalar(1.04 - (pulse - 1) * 0.45);
  }
}

/* ============================================================================
 * BossBase — shared mobility, tracking turrets, rotors, plumes, scorch & damage FX
 * ============================================================================ */
class BossBase {
  constructor(scene, name, maxHp) {
    this.scene = scene; this.name = name;
    this.maxHp = maxHp; this.hp = maxHp;
    this.alive = true; this.time = 0;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.weakpoints = [];
    this.accents = [];
    this.rotors = [];
    this.plumes = [];
    this.trackingTurrets = [];
    this.phaseGlows = [];
    this.bodyRadius = 18;
    this.introT = 3.0;
    this.offscreen = false;
    this.armorMult = 0.25;
    this.specialCd = rand(4.6, 6.4);
    this._bossShots = [];
    this._shieldPulseCd = 10.5;
    this._shieldPulseT = 0;
    this._damageSmokeCd = 0;
    this._bossTag = new THREE.Sprite(new THREE.SpriteMaterial({
      map: bossTagTexture(name), color: 0xff5d71, transparent: true, opacity: 0.94,
      depthTest: false, depthWrite: false, fog: false,
    }));
    this._bossTag.scale.set(42, 6.3, 1);
    this._bossTag.position.set(0, 68, 0);
    this.group.add(this._bossTag);
  }

  pos() { return this.group.position; }

  addAccent(pos, color, size, spd = 4) {
    const spr = glowSprite(color, size);
    spr.position.copy(pos);
    this.group.add(spr);
    this.accents.push({ spr, size, spd, off: rand(0, TAU) });
    return spr;
  }

  addWeak(pos, radius, hp, color) {
    const w = new Weakpoint(this.group, pos, radius, hp, color);
    this.weakpoints.push(w);
    return w;
  }

  _broadsideFx(game, pos, color = 0xffa45a, scale = 1) {
    if (!game?.particles || !pos) return;
    const fx = game.particles;
    fx.muzzle(pos.x, pos.y, pos.z, 1.2 * scale, color);
    fx.flash(pos.x, pos.y, pos.z, 0.56 * scale, color);
    fx.emit(pos.x, pos.y, pos.z, { count: Math.round(6 + 3 * scale), speed: 24 * scale, vz: 18 * scale, color, color2: 0xffffff, life: 0.28, size: 2.3 * scale, drag: 2.8, spread: 0.45 });
  }

  _phaseBurst(game, color = 0xffd080, scale = 1) {
    if (!game?.particles) return;
    const p = this.group.position, fx = game.particles;
    fx.flash(p.x, p.y, p.z, 1.85 * scale, color);
    fx.emit(p.x, p.y, p.z, { count: Math.round(16 * scale), speed: 34 * scale, color, color2: 0xffffff, life: 0.48, size: 3.2 * scale, drag: 2.3, spread: 2.2 });
    fx.ring(p.x, p.y, p.z, { color, from: 2.6 * scale, radius: 26 * scale, dur: 0.50, opacity: 0.36 });
  }

  /** Curving multi-missile fan (Macross / Star Fox style outward arc that homes toward player). */
  _fireMissileFan(proj, game, origin, player, count = 4, type = 'swarm', spread = 26, color = 0xff7a4a) {
    if (!proj || !origin) return;
    this._broadsideFx(game, origin, color, 1.15);
    const half = (count - 1) * 0.5;
    for (let k = 0; k < count; k++) {
      const off = k - half;
      const sx = origin.x + off * 7.5;
      const sy = origin.y + Math.abs(off) * 2.2;
      _v2.set(sx, sy, origin.z + 4);
      _v1.set(player.x + off * spread, player.y + 10 + Math.abs(off) * 6, PLAYER_Z).sub(_v2);
      proj.fireEnemy(_v2.clone(), _v1.clone(), type);
    }
  }

  /** Relentless glowing pursuit-orb salvo fanning left/right before steering onto player. */
  _firePursuitSalvo(proj, game, origin, player, count = 2, color = 0xc262ff) {
    if (!proj || !origin) return;
    if (game?.particles) {
      game.particles.ring(origin.x, origin.y, origin.z + 4, { color, from: 2.0, radius: 18, dur: 0.38, opacity: 0.50 });
    }
    const half = (count - 1) * 0.5;
    for (let k = 0; k < count; k++) {
      const off = count === 1 ? 0 : (k - half);
      _v2.set(origin.x + off * 11, origin.y + (k % 2 ? 5 : -3), origin.z + 5);
      _v1.set(player.x + off * 40, player.y + (k % 2 ? 14 : -8), PLAYER_Z).sub(_v2);
      proj.fireEnemy(_v2.clone(), _v1.clone(), 'pursuit');
    }
  }

  /** Radial or X-cross special energy shockwave burst. */
  _fireWaveCross(proj, game, origin, player, count = 6, type = 'superwave', spin = 0, color = 0xffb84a) {
    if (!proj || !origin) return;
    if (game?.particles) {
      game.particles.flash(origin.x, origin.y, origin.z + 4, 1.5, color);
      game.particles.ring(origin.x, origin.y, origin.z + 4, { color, from: 2.2, radius: 24, dur: 0.44, opacity: 0.52 });
    }
    const baseDx = player.x - origin.x;
    const baseDy = player.y - origin.y;
    const baseDz = Math.max(48, PLAYER_Z - origin.z);
    for (let k = 0; k < count; k++) {
      const a = (k / count) * TAU + spin;
      _v1.set(baseDx + Math.cos(a) * 42, baseDy + Math.sin(a) * 32, baseDz);
      proj.fireEnemy(origin.clone(), _v1.clone(), type);
    }
  }

  /** Pause-safe delayed boss shot scheduler (never leaks after death/destroy). */
  _scheduleBossShot(delaySec, fn) {
    this._bossShots.push({ t: delaySec, fn });
  }

  /** Bright cyan charge telegraph followed by staggered hypersonic `rail` sniping sweep! */
  _fireBossRailBarrage(proj, game, origin, player, count = 2, spread = 24) {
    if (!proj || !origin) return;
    const src = origin.clone();
    game?.particles?.weaponTelegraph?.(src.x, src.y, src.z + 4, 0x62ecff, 1.8);
    game?.particles?.ring?.(src.x, src.y, src.z + 4, { color: 0x62ecff, from: 2.0, radius: 22, dur: 0.36, opacity: 0.72 });
    const half = (count - 1) * 0.5;
    for (let k = 0; k < count; k++) {
      const off = count === 1 ? 0 : (k - half);
      this._scheduleBossShot(0.32 + k * 0.14, () => {
        if (!this.alive || this.offscreen) return;
        const pos = this.core ? this.core.worldPos(new THREE.Vector3()) : (this.headWeak ? this.headWeak.worldPos(new THREE.Vector3()) : src);
        game?.particles?.flash?.(pos.x, pos.y, pos.z + 4, 1.15, 0xb8f8ff);
        _v1.set(player.x + off * spread, player.y + rand(-3, 3), PLAYER_Z).sub(pos);
        proj.fireEnemy(pos, _v1.clone(), 'rail');
      });
    }
  }

  /** Airburst `cluster` shell barrage splitting mid-air into radial shard blooms! */
  _fireBossClusterRain(proj, game, origin, player, count = 3, spread = 30) {
    if (!proj || !origin) return;
    this._broadsideFx(game, origin, 0xff6232, 1.2);
    const half = (count - 1) * 0.5;
    for (let k = 0; k < count; k++) {
      const off = count === 1 ? 0 : (k - half);
      _v2.set(origin.x + off * 9, origin.y + 2, origin.z + 5);
      _v1.set(player.x + off * spread, player.y + rand(-4, 6), PLAYER_Z).sub(_v2);
      proj.fireEnemy(_v2.clone(), _v1.clone(), 'cluster');
    }
  }

  /** Counter-twisting DNA `spiral` beams + wide curving `boomerang` pincer blades! */
  _fireBossHelixBoomerang(proj, game, origin, player) {
    if (!proj || !origin) return;
    const src = origin.clone();
    const dir = new THREE.Vector3(player.x - src.x, player.y - src.y, PLAYER_Z - src.z);
    proj.fireEnemy(src.clone(), dir.clone(), 'spiral', null, null, { helixPhase: 0 });
    proj.fireEnemy(src.clone(), dir.clone(), 'spiral', null, null, { helixPhase: Math.PI });
    for (const s of [-1, 1]) {
      _v1.set(player.x + s * 62, player.y + rand(-4, 6), PLAYER_Z).sub(src);
      proj.fireEnemy(src.clone(), _v1.clone(), 'boomerang', null, null, { curveX: -s * 72 });
    }
  }

  /** Temporary Phase-3 overdrive shield barrier (clearly telegraphed via core's cyan wireframe shieldDome!). */
  _updateShieldPulse(dt, core, game, duration = 2.2, cooldown = 11.5, label = '⚠ SHIELD OVERDRIVE!') {
    if (!core || !core.alive) return;
    if (this._shieldPulseT > 0) {
      this._shieldPulseT -= dt;
      core.active = false;
      if (this._shieldPulseT <= 0) {
        this._shieldPulseT = 0;
        core.active = true;
        this._phaseBurst(game, 0x62f2ff, 1.15);
        game?.hud?.alert?.('CORE SHIELD DROPPED — STRIKE NOW!', 1.35);
      }
      return;
    }
    this._shieldPulseCd -= dt;
    if (this._shieldPulseCd <= 0 && !this.offscreen) {
      this._shieldPulseCd = cooldown;
      this._shieldPulseT = duration;
      core.active = false;
      this._phaseBurst(game, 0x8ef2ff, 1.25);
      game?.hud?.alert?.(label, 1.6);
    }
  }

  hitTest(point, r) {
    for (const w of this.weakpoints) {
      if (!w.alive || !w.active) continue;
      w.worldPos(_v2);
      if (point.distanceTo(_v2) < w.radius + r) return { kind: 'weak', wp: w };
    }
    if (point.distanceTo(this.group.position) < this.bodyRadius + r) return { kind: 'body', wp: null };
    return null;
  }

  damage(amount) {
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp <= 0) this.alive = false;
  }

  _scorchParent() { return this.group; }

  addScorch(point) {
    if (!this.scorches) {
      this.scorches = [];
      if (!_sharedScorchTex) {
        _sharedScorchTex = new THREE.TextureLoader().load('./assets/particles/scorch_01.png');
        _sharedScorchTex.colorSpace = THREE.SRGBColorSpace;
      }
      this._scorchTex = _sharedScorchTex;
    }
    let e;
    if (this.scorches.length >= 14) {
      e = this.scorches.reduce((a, b) => (a.life < b.life ? a : b));
    } else {
      e = { spr: new THREE.Sprite(new THREE.SpriteMaterial({ map: this._scorchTex, color: 0x181008, transparent: true, opacity: 0.8, depthWrite: false })), life: 0 };
      this.scorches.push(e);
    }
    const parent = this._scorchParent(point);
    parent.add(e.spr);
    e.spr.visible = true;
    e.spr.position.copy(parent.worldToLocal(_v1.copy(point)));
    parent.getWorldScale(_v2);
    e.spr.scale.setScalar(rand(3.5, 6) / (_v2.x || 1));
    e.spr.material.rotation = rand(0, TAU);
    e.life = 8;
  }

  destroy() {
    this.scene.remove(this.group);
    this.group.traverse((n) => {
      if (n.geometry && !n.geometry.userData?.shared) n.geometry.dispose?.();
      if (n.material) {
        const mats = Array.isArray(n.material) ? n.material : [n.material];
        for (const m of mats) {
          if (m && !m.userData?.shared) m.dispose?.();
        }
      }
    });
  }

  _tryBodyModel() {
    if (!this._modelKey || this._bodyDone || !BOSS_MODELS[this._modelKey]) return;
    this._bodyDone = true;
    const m = BOSS_MODELS[this._modelKey].clone(true);
    const o = this._modelOpts || {};
    m.rotation.y = o.rotY || 0;
    m.position.y += o.y || 0;
    if (o.scale) m.scale.multiplyScalar(o.scale);
    m.traverse((c) => c.layers && c.layers.enable(1));
    for (const c of this.group.children) if (c.isMesh) c.visible = false;
    this.group.add(m);
    this._bodyModel = m;
  }

  update(ctx) {
    this.time += ctx.dt;
    this._tryBodyModel();
    for (let i = this._bossShots.length - 1; i >= 0; i--) {
      const s = this._bossShots[i];
      s.t -= ctx.dt;
      if (s.t <= 0) { this._bossShots.splice(i, 1); s.fn(); }
    }
    const hpRatio = this.hp / Math.max(1, this.maxHp);
    const overdrive = clamp((0.45 - hpRatio) / 0.45, 0, 1);

    for (const w of this.weakpoints) w.update(ctx.dt, this.time);

    const tagPulse = 1 + Math.sin(this.time * 4.5) * 0.045;
    this._bossTag.scale.set(42 * tagPulse, 6.3 * tagPulse, 1);
    const tagZ = this.segs?.[0] ? this.segs[0].position.z : this.group.position.z;
    this._bossTag.material.opacity = (!this.offscreen && tagZ > -650 && tagZ < 60) ? 0.92 : 0;

    for (const a of this.accents) {
      const p = Math.sin(this.time * a.spd + a.off);
      a.spr.scale.setScalar(a.size * (0.85 + p * 0.22));
      a.spr.material.opacity = 0.72 + p * 0.28;
    }

    const rotorMul = 1 + overdrive * 0.85;
    for (const r of this.rotors) {
      r.mesh.rotation[r.axis] += ctx.dt * r.speed * rotorMul;
    }

    for (const pl of this.plumes) {
      const flicker = (0.88 + overdrive * 0.22) + Math.sin(this.time * 38 + pl.phase) * 0.16;
      pl.mesh.scale.set(1 + overdrive * 0.12, 1 + overdrive * 0.12, flicker);
    }

    // Smoothly track the player (+Z direction) with every mounted boss turret!
    if (this.trackingTurrets.length && ctx.player) {
      const px = ctx.player.x, py = ctx.player.y;
      for (const tr of this.trackingTurrets) {
        tr.root.getWorldPosition(_v2);
        const dz = Math.max(25, PLAYER_Z - _v2.z);
        const wantYaw = clamp(Math.atan2(px - _v2.x, dz), -tr.maxYaw, tr.maxYaw);
        const wantPitch = clamp(-Math.atan2(py - _v2.y, dz), -tr.maxPitch, tr.maxPitch);
        tr.head.rotation.y = damp(tr.head.rotation.y, wantYaw, 4.5, ctx.dt);
        tr.head.rotation.x = damp(tr.head.rotation.x, wantPitch, 4.5, ctx.dt);
      }
    }

    for (const pg of this.phaseGlows) {
      pg.mat.emissiveIntensity = pg.base + overdrive * 0.85 + Math.sin(this.time * 6.5) * (0.15 + overdrive * 0.25);
    }

    // Progressive battle-damage smoke & electrical spark vents on destroyed sockets / low HP
    if (ctx.game?.particles && !this.offscreen && this.group.position.z > -380) {
      this._damageSmokeCd -= ctx.dt;
      const destroyed = this.weakpoints.filter((w) => !w.alive);
      if (this._damageSmokeCd <= 0 && (destroyed.length > 0 || hpRatio < 0.55)) {
        this._damageSmokeCd = hpRatio < 0.35 ? 0.11 : 0.22;
        const src = destroyed.length ? destroyed[(Math.random() * destroyed.length) | 0] : null;
        if (src) {
          src.worldPos(_v2);
        } else {
          _v2.copy(this.group.position).add(_v1.set(rand(-20, 20), rand(-4, 14), rand(-12, 12)));
        }
        ctx.game.particles.smoke(_v2.x, _v2.y, _v2.z, hpRatio < 0.35 ? 1.35 : 0.9, 0x2a201e);
        if (hpRatio < 0.45 || Math.random() < 0.45) {
          ctx.game.particles.emit(_v2.x, _v2.y, _v2.z, {
            count: 3, speed: 18, color: 0xffb84d, color2: 0xff5a2e, life: 0.32, size: 1.8, drag: 2.2, spread: 1.4,
          });
        }
      }
    }

    if (this.scorches) for (const s of this.scorches) {
      if (s.life > 0) {
        s.life -= ctx.dt;
        s.spr.material.opacity = 0.8 * Math.min(1, s.life / 4);
        if (s.life <= 0) s.spr.visible = false;
      }
    }
  }

  /**
   * Cinematic multi-state 3D boss choreographer:
   * cycles through sweeping cruise, dramatic close windshield rushes, deep horizon
   * retreats, high-speed flank passes, and full off-screen exits + surprise re-entries!
   */
  _maneuver(dt, player, opts = {}) {
    const p = this.group.position;
    const xRange = opts.xRange ?? 82;
    const zNear = opts.zNear ?? -82;
    const zFar = opts.zFar ?? -335;
    const zMid = (zNear + zFar) * 0.5;
    const yBase = opts.yBase ?? p.y;
    const yRange = opts.yRange ?? 16;
    const sp = opts.speed ?? 1.08;
    const exitModes = opts.exitModes ?? ['left', 'right', 'top'];
    const game = opts.game;

    if (!this._mv) {
      this._mv = {
        mode: 'cruise',
        wp: new THREE.Vector3(0, yBase, zMid + 20),
        t: 1.6,
        cycles: 0,
        lastExit: null,
        reenterDir: 'top',
        reenterFired: false,
        splashFired: false,
        flankDir: Math.random() < 0.5 ? -1 : 1,
      };
    }
    const mv = this._mv;
    mv.t -= dt;

    if (mv.t <= 0) {
      if (mv.mode === 'offscreenExit') {
        mv.mode = 'offscreenWait';
        mv.t = 0.62;
        const pool = exitModes.filter((m) => m !== mv.lastExit);
        const dir = pool.length ? pool[(Math.random() * pool.length) | 0] : exitModes[0];
        mv.reenterDir = dir;
        mv.reenterFired = false;
        mv.splashFired = false;
        // Teleport off-screen to the chosen surprise re-entry vector & telegraph clearly!
        const aimX = clamp(player.x * 0.42 + rand(-34, 34), -xRange * 0.65, xRange * 0.65);
        if (dir === 'left') p.set(-315, yBase + rand(-4, 12), zNear - rand(32, 66));
        else if (dir === 'right') p.set(315, yBase + rand(-4, 12), zNear - rand(32, 66));
        else if (dir === 'dive') p.set(aimX, -94, zNear - rand(24, 56));
        else p.set(aimX, 204, zNear - rand(40, 74));
        const label = dir === 'left' ? 'LEFT FLANK' : dir === 'right' ? 'RIGHT FLANK' : dir === 'dive' ? 'SURFACE BREACH' : 'HIGH OVERHEAD';
        game?.hud?.alert?.(`⚠ BOSS RE-ENTRY — ${label}!`, 1.45);
        if (game?.particles) {
          const rx = dir === 'left' ? -140 : dir === 'right' ? 140 : aimX;
          const ry = dir === 'dive' ? 6 : dir === 'top' ? 92 : yBase + 8;
          const rCol = dir === 'dive' ? 0x62f2ff : 0xff7c54;
          game.particles.ring(rx, ry, zNear - 45, { color: rCol, from: 4, radius: 34, dur: 0.60, opacity: 0.62 });
        }
      } else if (mv.mode === 'offscreenWait') {
        mv.mode = 'offscreenReenter';
        mv.t = 1.35;
        mv.wp.set(
          clamp(player.x * 0.35 + rand(-36, 36), -xRange * 0.72, xRange * 0.72),
          yBase + rand(-yRange * 0.35, yRange * 0.65),
          zNear - rand(22, 54)
        );
      } else {
        mv.cycles++;
        const canExit = this.time > 3.2 && mv.cycles >= 3;
        const roll = Math.random();
        if (canExit && (mv.cycles >= 5 || roll < 0.28)) {
          mv.cycles = 0;
          mv.mode = 'offscreenExit';
          mv.t = 1.15;
          mv.splashFired = false;
          const dir = exitModes[(Math.random() * exitModes.length) | 0];
          mv.lastExit = dir;
          if (dir === 'left') mv.wp.set(-335, yBase + rand(-4, 14), zMid + 20);
          else if (dir === 'right') mv.wp.set(335, yBase + rand(-4, 14), zMid + 20);
          else if (dir === 'dive') mv.wp.set(clamp(p.x, -70, 70), -102, zNear - 48);
          else mv.wp.set(clamp(p.x, -70, 70), 215, zMid);
          if (game?.particles) {
            game.particles.ring(p.x, p.y, p.z + 8, { color: 0xffa858, from: 3, radius: 26, dur: 0.42, opacity: 0.46 });
          }
        } else if (roll < 0.27) {
          // Dramatic close-quarters windshield rush!
          mv.mode = 'closeRush';
          mv.t = rand(1.35, 1.85);
          mv.wp.set(
            clamp(player.x * 0.52 + rand(-38, 38), -xRange * 0.82, xRange * 0.82),
            yBase + rand(-yRange * 0.45, yRange * 0.45),
            rand(zNear, zNear - 24)
          );
        } else if (roll < 0.54) {
          // Deep horizon retreat for long-range missile & special bombardment!
          mv.mode = 'retreatFar';
          mv.t = rand(1.75, 2.35);
          mv.wp.set(
            clamp(player.x * 0.30 + rand(-xRange * 0.85, xRange * 0.85), -xRange, xRange),
            yBase + rand(yRange * 0.15, yRange * 0.95),
            rand(zFar, zFar + 42)
          );
        } else if (roll < 0.78) {
          // High-speed cross-screen flank gun-run!
          mv.mode = 'flankSweep';
          mv.t = rand(1.45, 2.05);
          mv.flankDir = p.x >= 0 ? -1 : 1;
          mv.wp.set(
            mv.flankDir * xRange * 1.12,
            yBase + rand(-yRange * 0.6, yRange * 0.7),
            rand(zNear - 32, zNear - 88)
          );
        } else {
          mv.mode = 'cruise';
          mv.t = rand(1.5, 2.2);
          mv.wp.set(
            clamp(player.x * 0.45 + rand(-xRange, xRange), -xRange, xRange),
            yBase + rand(-yRange, yRange),
            rand(zMid - 42, zMid + 48)
          );
        }
      }
    }

    const prevX = p.x, prevY = p.y;
    if (mv.mode !== 'offscreenWait') {
      const mul = mv.mode === 'offscreenExit' ? 2.5
        : mv.mode === 'offscreenReenter' ? 2.65
        : mv.mode === 'closeRush' ? 1.85
        : mv.mode === 'flankSweep' ? 1.65
        : mv.mode === 'retreatFar' ? 1.50
        : 1.05;
      const s = sp * mul;
      p.x = damp(p.x, mv.wp.x, s, dt);
      p.y = damp(p.y, mv.wp.y, s * 0.92, dt);
      p.z = damp(p.z, mv.wp.z, s * 0.88, dt);
    }

    this.offscreen = (Math.abs(p.x) > 195 || p.y > 135 || p.y < -28 || p.z < -410);

    // Water/surface breach splash ring on dive exit or re-entry!
    if (game?.particles && !mv.splashFired && ((mv.mode === 'offscreenExit' && mv.lastExit === 'dive' && p.y < 14) || (mv.mode === 'offscreenReenter' && mv.reenterDir === 'dive' && p.y > -4))) {
      mv.splashFired = true;
      game.particles.ring(p.x, 4, p.z, { color: 0x62f2ff, from: 6, radius: 42, dur: 0.56, opacity: 0.65 });
      game.particles.emit(p.x, 5, p.z, { count: 22, speed: 44, vy: 32, color: 0xbff8ff, color2: 0x3ac2ff, life: 0.58, size: 4.2, drag: 1.9, spread: 1.8 });
    }

    // Fire dramatic re-entry counter-salvo once boss bursts cleanly back onto screen!
    if (mv.mode === 'offscreenReenter' && !mv.reenterFired && !this.offscreen) {
      mv.reenterFired = true;
      opts.onReenter?.(mv.reenterDir);
    }

    if (opts.bank !== false) {
      const bankWant = clamp((prevX - p.x) * 0.14 + (mv.wp.x - p.x) * 0.004, -0.78, 0.78);
      this.group.rotation.z = damp(this.group.rotation.z, bankWant, 4.2, dt);
    }
    if (opts.pitch) {
      const pitchWant = clamp((p.y - prevY) * 0.12, -0.42, 0.42);
      this.group.rotation.x = damp(this.group.rotation.x, pitchWant, 4.0, dt);
    }
  }
}

/* ============================================================================
 * WAVE 3 — TEMPEST RAY (Azure Sea Oceanic Manta Command Cruiser)
 * Chased from behind (+Z): high-poly 3.5 MB `ships/bob.gltf` manta hull fused
 * with swept armored wingtip blades, illuminated dorsal bridge deck + shark-fin,
 * armored wing cradles under both pods, rear stern plasma core framed by
 * counter-rotating cyan rings (100% unobstructed from cockpit!), and twin engines.
 * ============================================================================ */
export class TempestRay extends BossBase {
  constructor(scene) {
    super(scene, 'TEMPEST RAY', 575);
    this.phaseCount = 2;

    const hullMat = toonMat(0x2d5478, { map: bossArmorTex, flat: true });
    const darkMat = toonMat(0x16293d, { map: bossArmorTex, flat: true });
    const hazardMat = toonMat(0x3a546d, { map: bossHazardTex, flat: true });
    const litMat = toonMat(0x123248, { emissive: 0x59e6f6, emissiveIntensity: 1.45, flat: true });
    const bridgeMat = toonMat(0x1f3a54, { map: bossWindowTex, emissive: 0x59e6f6, emissiveIntensity: 0.55, flat: true });
    this.phaseGlows.push({ mat: litMat, base: 1.45 });

    // Temporary fallback fuselage (hidden automatically once `ships/bob.gltf` loads)
    const fallbackBody = taperHull(16, 4.2, 26, 7.2, 28, hullMat, { topPinch: 0.65 });
    this.group.add(fallbackBody);

    const rig = new THREE.Group();
    this.group.add(rig);
    this.hardware = rig;

    // Swept dorsal command deck + shark-fin stabilizer crest
    const bridgeDeck = taperHull(7.2, 2.8, 11.2, 4.0, 14, bridgeMat, { topPinch: 0.68 });
    bridgeDeck.position.set(0, 5.2, 1.5);
    rig.add(bridgeDeck);
    const dorsalFin = taperHull(0.7, 5.0, 1.3, 6.8, 13.5, darkMat, { topPinch: 0.45, yShiftFront: -1.4 });
    dorsalFin.position.set(0, 8.2, 4.2);
    rig.add(dorsalFin);
    const dorsalTrim = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 11.5), litMat);
    dorsalTrim.position.set(0, 10.2, 4.6);
    rig.add(dorsalTrim);

    // Sculpted wing-mounted armor booms, hydro-blades, reactor cradles & tracking stern turrets
    for (const s of [-1, 1]) {
      const wingArm = sweptWing(23, 12.5, 5.2, 5.5, 1.9, hullMat, { dropY: 1.2 });
      wingArm.position.set(s * 11, 0.2, 0.5);
      wingArm.scale.x = s;
      rig.add(wingArm);

      // Luminous cyan plasma trailing-edge accent rail (clearly visible from chase camera!)
      const plasmaRail = new THREE.Mesh(new THREE.BoxGeometry(20.5, 0.55, 0.9), litMat);
      plasmaRail.position.set(s * 21.5, 0.8, 6.8);
      plasmaRail.rotation.y = s * -0.22;
      rig.add(plasmaRail);

      // Sculpted reactor cradle directly seating podL / podR at (±20, 2.4, 4.5)
      const cradle = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 6.2, 2.4, 8), hazardMat);
      cradle.position.set(s * 20, 1.2, 4.5);
      rig.add(cradle);

      // Swept vertical manta wingtip stabilizer blade + glowing tip strip
      const tipBlade = taperHull(0.9, 8.8, 1.4, 6.6, 9.5, darkMat, { topPinch: 0.5 });
      tipBlade.position.set(s * 33.8, 2.6, 6.2);
      tipBlade.rotation.z = s * -0.34;
      rig.add(tipBlade);
      const tipEdge = new THREE.Mesh(new THREE.BoxGeometry(0.45, 7.2, 0.8), litMat);
      tipEdge.position.set(s * 35.1, 3.2, 9.8);
      tipEdge.rotation.z = s * -0.34;
      rig.add(tipEdge);

      // Tracking rear-facing shoulder plasma cannons aiming directly at the player (+Z)!
      const turret = buildTrackingTurret(this, hullMat, hazardMat, darkMat, litMat, 0x59e6f6, { scale: 0.92, len: 7.4 });
      turret.position.set(s * 26.8, 1.6, 6.0);
      rig.add(turret);

      // Vectored oceanic plasma engine nacelles facing back at player (+Z)
      const engine = buildEngineNacelle(this, hullMat, darkMat, litMat, 0x59e6f6, 2.4, 16);
      engine.position.set(s * 14.2, -0.3, 14.5);
      rig.add(engine);

      // Swept twin-pronged manta whip tail pincers framing the central stern core!
      const tailBoom = taperHull(1.8, 1.5, 0.45, 0.45, 16, darkMat, { topPinch: 0.7, xShiftBack: s * -1.4 });
      tailBoom.position.set(s * 7.2, 1.8, 18.5);
      rig.add(tailBoom);

      this.addAccent(new THREE.Vector3(s * 12, 1.4, 6), 0x59e6f6, 2.6, 5);
      this.addAccent(new THREE.Vector3(s * 34, 4.6, 9), 0x2fd0e0, 2.8, 3.8);
    }

    // Prominent Stern Reactor Bay housing the Phase-2 Core at (0, 2.4, 13.5) — 100% visible from cockpit!
    const sternHousing = taperHull(12.5, 5.2, 9.5, 4.2, 10, darkMat);
    sternHousing.position.set(0, 2.2, 9.2);
    rig.add(sternHousing);
    const coreRingA = new THREE.Mesh(new THREE.TorusGeometry(6.8, 0.48, 8, 22), litMat);
    coreRingA.position.set(0, 2.4, 13.2);
    rig.add(coreRingA);
    const coreRingB = new THREE.Mesh(new THREE.TorusGeometry(5.0, 0.32, 6, 18), litMat);
    coreRingB.position.set(0, 2.4, 13.8);
    rig.add(coreRingB);
    this.rotors.push({ mesh: coreRingA, axis: 'z', speed: 1.4 }, { mesh: coreRingB, axis: 'z', speed: -2.3 });

    this.podL = this.addWeak(new THREE.Vector3(20, 2.4, 4.5), 4.5, 130, 0x59e6f6);
    this.podR = this.addWeak(new THREE.Vector3(-20, 2.4, 4.5), 4.5, 130, 0x59e6f6);
    this.core = this.addWeak(new THREE.Vector3(0, 2.4, 13.8), 5.4, 315, 0xff9e4a);
    this.core.active = false;
    this.bodyRadius = 21;
    this.group.position.set(0, 24, -360);
    this.fireCd = 2.1;
    scaleBoss(this, 2.05);
    this._modelKey = 'ray'; this._modelOpts = { rotY: Math.PI };
  }

  update(ctx) {
    super.update(ctx);
    const { dt, player, proj, game } = ctx;
    const p = this.group.position;
    this._maneuver(dt, player, {
      xRange: 88, yBase: 28, yRange: 18, zNear: -74, zFar: -330, speed: this.core.active ? 1.25 : 1.10,
      exitModes: ['left', 'right', 'top', 'dive'], pitch: true, game,
      onReenter: (dir) => {
        this.core.worldPos(_v2);
        this._fireMissileFan(proj, game, _v2, player, 4, 'torpedo', 24, 0x59e6f6);
        if (dir === 'dive') this._fireWaveCross(proj, game, _v2, player, 4, 'superwave', Math.PI * 0.25, 0x59e6f6);
      },
    });
    this.group.rotation.y = damp(this.group.rotation.y, clamp((player.x - p.x) * 0.004, -0.45, 0.45), 2.5, dt);

    if (!this.podL.alive && !this.podR.alive && !this.core.active) {
      this.core.active = true;
      this._phaseBurst(game, 0xffd080, 1.2);
      game.bossPhase('CORE EXPOSED!');
    }

    if (this.offscreen) return;

    this.fireCd -= dt;
    if (this.fireCd <= 0) {
      this.fireCd = this.core.active ? 1.55 : 2.25;
      this.core.worldPos(_v2);
      this._broadsideFx(game, _v2, 0x59e6f6, 1.15);
      for (let k = -2; k <= 2; k++) {
        _v1.set(player.x + k * 14, player.y + rand(-4, 4), PLAYER_Z).sub(_v2).normalize().multiplyScalar(74);
        proj.fireEnemy(_v2.clone(), _v1.clone(), 0x59c6ff);
      }
      for (const pod of [this.podL, this.podR]) {
        if (!pod.alive) continue;
        pod.worldPos(_v2);
        _v1.set(player.x, player.y, PLAYER_Z).sub(_v2).normalize().multiplyScalar(62);
        proj.fireEnemy(_v2.clone(), _v1.clone(), 0x59e6f6);
      }
      if (Math.random() < 0.58) for (const s of [1, -1]) {
        _v2.set(p.x + s * 24, p.y + 2, p.z + 10);
        _v1.set(player.x + s * 24, player.y + 8, PLAYER_Z).sub(_v2);
        proj.fireEnemy(_v2.clone(), _v1.clone(), Math.random() < 0.5 ? 'torpedo' : 'missile');
      }
      if (this.core.active && Math.random() < 0.65) {
        _v1.set(player.x, player.y, PLAYER_Z).sub(p);
        proj.fireEnemy(p.clone(), _v1.clone(), 'wave');
      }
    }

    // Signature Special: HYDRO-STORM BARRAGE (torpedo fan + violet pursuit seekers + Phase-2 DNA helix & superwave cross)
    this.specialCd -= dt;
    if (this.specialCd <= 0) {
      this.specialCd = this.core.active ? 4.0 : 5.4;
      this.core.worldPos(_v2);
      this._fireMissileFan(proj, game, _v2, player, this.core.active ? 5 : 4, 'torpedo', 24, 0x59e6f6);
      this._firePursuitSalvo(proj, game, _v2, player, 2, 0xc262ff);
      if (this.core.active) {
        this._fireWaveCross(proj, game, _v2, player, 4, 'superwave', this.time, 0x59e6f6);
        this._fireBossHelixBoomerang(proj, game, _v2, player);
      }
    }
  }
}

/* ============================================================================
 * WAVE 6 — CASCADE WARDEN (Emerald Gorge Hydroelectric Fortress Citadel)
 * 100% bespoke sculpted multi-tier fortress facing straight at the player (+Z)!
 * - Twin stepped stone-and-steel bastion towers with flying buttresses & lit galleries
 * - Cantilevered main bridge deck with rooftop rotating dual-dish radar crown
 * - Split hazard-striped blast-gate shutter doors on the +Z front face that slide
 *   APART horizontally to expose the spinning counter-rotating hydro-plasma core!
 * - 4 articulated tracking fortress cannons mounted solidly on +Z bastion decks
 * ============================================================================ */
export class CascadeWarden extends BossBase {
  constructor(scene) {
    super(scene, 'CASCADE WARDEN', 860);
    this.phaseCount = 2;
    this.armorMult = 0.22;

    const stoneMat = toonMat(0x8c7b60, { map: bossArmorTex, flat: true });
    const steelMat = toonMat(0x465162, { map: bossArmorTex, flat: true });
    const darkMat = toonMat(0x28303d, { flat: true });
    const hazardMat = toonMat(0x525866, { map: bossHazardTex, flat: true });
    const bridgeMat = toonMat(0x2c384a, { map: bossWindowTex, emissive: 0xffb858, emissiveIntensity: 0.46, flat: true });
    const hydroLit = toonMat(0x143044, { emissive: 0x59e6f6, emissiveIntensity: 1.50, flat: true });
    const warnLit = toonMat(0x3a2414, { emissive: 0xffa040, emissiveIntensity: 1.42, flat: true });
    this.phaseGlows.push({ mat: hydroLit, base: 1.50 }, { mat: warnLit, base: 1.42 });

    const fort = new THREE.Group();
    this.group.add(fort);
    this.hardware = fort;

    // Armored hydroelectric dam foundation plinth spanning between both towers
    const plinth = taperHull(92, 12, 82, 10, 26, steelMat, { topPinch: 0.92 });
    plinth.position.set(0, 4, -2);
    fort.add(plinth);
    const spillway = new THREE.Mesh(new THREE.BoxGeometry(24, 3.2, 28), hydroLit);
    spillway.position.set(0, 1.6, 2);
    fort.add(spillway);

    // Twin monumental stepped bastion towers at x = ±34
    for (const s of [-1, 1]) {
      const tx = s * 34;
      const base = new THREE.Mesh(new THREE.CylinderGeometry(11.5, 15.2, 24, 8), stoneMat);
      base.position.set(tx, 12, 0);
      fort.add(base);
      const mid = new THREE.Mesh(new THREE.CylinderGeometry(9.6, 11.4, 28, 8), steelMat);
      mid.position.set(tx, 36, 0);
      fort.add(mid);
      const gallery = new THREE.Mesh(new THREE.BoxGeometry(14.5, 14, 14.5), bridgeMat);
      gallery.position.set(tx, 43, 2.2);
      fort.add(gallery);
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(12.2, 9.8, 9, 8), hazardMat);
      crown.position.set(tx, 54.5, 0);
      fort.add(crown);

      for (const sideAngle of [-0.45, 0.45]) {
        const rib = taperHull(3.2, 46, 5.8, 48, 6.5, darkMat, { topPinch: 0.72 });
        rib.position.set(tx + s * 10.2, 26, sideAngle * 14);
        rib.rotation.z = s * 0.14;
        fort.add(rib);
      }
      // Glowing cyan hydro-conduit pipes running down the front (+Z) inner face of each tower
      const conduit = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 48, 8), hydroLit);
      conduit.position.set(tx - s * 10.6, 30, 6.2);
      fort.add(conduit);

      // Forward (+Z) cantilevered lower turret deck solidly supporting lower weakpoints & cannons
      const lowerDeck = taperHull(13, 5.2, 10, 4.2, 11, steelMat);
      lowerDeck.position.set(tx, 10.2, 9.2);
      fort.add(lowerDeck);

      const upperTurret = buildTrackingTurret(this, steelMat, hazardMat, darkMat, warnLit, 0xffa040, { scale: 1.15, len: 8.5 });
      upperTurret.position.set(tx, 59.0, 5.5);
      fort.add(upperTurret);

      const lowerTurret = buildTrackingTurret(this, steelMat, hazardMat, darkMat, warnLit, 0xffa040, { scale: 1.05, len: 7.6 });
      lowerTurret.position.set(tx, 12.2, 11.2);
      fort.add(lowerTurret);

      const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 1.1, 12, 6), darkMat);
      spire.position.set(tx + s * 6.5, 64, -3);
      fort.add(spire);
      this.addAccent(new THREE.Vector3(tx + s * 6.5, 70.5, -3), 0xffa040, 2.8, 4.5);
      for (let i = 0; i < 3; i++) this.addAccent(new THREE.Vector3(tx, 14 + i * 18, 9.8), 0x8fe6ff, 2.0, 3 + i);
    }

    // Monumental upper armored span bridge + front-facing illuminated fortress command gallery (+Z)
    const bridgeSpan = taperHull(82, 12.5, 74, 10.5, 16, steelMat, { topPinch: 0.88 });
    bridgeSpan.position.set(0, 56, 0);
    fort.add(bridgeSpan);
    const bridgeCitadel = new THREE.Mesh(new THREE.BoxGeometry(38, 7.8, 13.5), bridgeMat);
    bridgeCitadel.position.set(0, 57, 3.2);
    fort.add(bridgeCitadel);
    for (const s of [-1, 1]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(19, 3.2, 7.5), darkMat);
      strut.position.set(s * 20, 44, 0);
      strut.rotation.z = s * 0.62;
      fort.add(strut);
    }

    // Rooftop rotating dual-dish phased-array radar crown
    const radarCrown = new THREE.Group();
    radarCrown.position.set(0, 62.5, 0);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.4, 10, 8), steelMat);
    mast.position.y = 5;
    radarCrown.add(mast);
    const crossArm = new THREE.Mesh(new THREE.BoxGeometry(24, 1.8, 2.8), hazardMat);
    crossArm.position.y = 10.2;
    radarCrown.add(crossArm);
    for (const s of [-1, 1]) {
      const dish = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.42, 6, 16), warnLit);
      dish.position.set(s * 12, 10.2, 0);
      dish.rotation.y = Math.PI / 2;
      radarCrown.add(dish);
      const feed = new THREE.Mesh(new THREE.ConeGeometry(1.2, 3.4, 6), darkMat);
      feed.rotation.z = s * -Math.PI / 2;
      feed.position.set(s * 12, 10.2, 0);
      radarCrown.add(feed);
    }
    fort.add(radarCrown);
    this.rotors.push({ mesh: radarCrown, axis: 'y', speed: 1.45 });

    // Central Armored Reactor Vault facing +Z + Split Sliding Blast Shutter Doors in front of the core!
    const vaultBack = new THREE.Mesh(new THREE.BoxGeometry(30, 32, 10), steelMat);
    vaultBack.position.set(0, 21, -2.5);
    fort.add(vaultBack);
    for (const s of [-1, 1]) {
      const cheek = new THREE.Mesh(new THREE.BoxGeometry(5.5, 32, 13), steelMat);
      cheek.position.set(s * 15, 21, 3.0);
      fort.add(cheek);
    }
    const vaultArch = new THREE.Mesh(new THREE.BoxGeometry(36, 5.5, 16), hazardMat);
    vaultArch.position.set(0, 38.5, 2.0);
    fort.add(vaultArch);

    // Counter-rotating hydro-plasma containment rings visible on +Z when doors slide open!
    const coreRingA = new THREE.Mesh(new THREE.TorusGeometry(9.6, 0.65, 8, 24), hydroLit);
    coreRingA.position.set(0, 19, 5.8);
    fort.add(coreRingA);
    const coreRingB = new THREE.Mesh(new THREE.TorusGeometry(7.0, 0.42, 6, 18), hydroLit);
    coreRingB.position.set(0, 19, 6.4);
    fort.add(coreRingB);
    this.rotors.push({ mesh: coreRingA, axis: 'z', speed: 1.3 }, { mesh: coreRingB, axis: 'z', speed: -2.1 });

    // Split left/right hazard blast-gate doors on the +Z front face (z = +9.2)
    const doorGeo = new THREE.BoxGeometry(11.8, 25.5, 3.4);
    this.doorL = new THREE.Mesh(doorGeo, hazardMat);
    this.doorL.position.set(-5.9, 19, 9.2);
    this.doorR = new THREE.Mesh(doorGeo, hazardMat);
    this.doorR.position.set(5.9, 19, 9.2);
    fort.add(this.doorL, this.doorR);
    this._doorSlide = 0;

    this.turrets = [
      this.addWeak(new THREE.Vector3(34, 62, 6.2), 3.1, 105, 0xffa040),
      this.addWeak(new THREE.Vector3(-34, 62, 6.2), 3.1, 105, 0xffa040),
      this.addWeak(new THREE.Vector3(34, 12, 10.2), 3.1, 105, 0xffa040),
      this.addWeak(new THREE.Vector3(-34, 12, 10.2), 3.1, 105, 0xffa040),
    ];
    this.core = this.addWeak(new THREE.Vector3(0, 19, 6.8), 4.8, 440, 0x59e6f6);
    this.core.active = false;
    this.bodyRadius = 30;
    this.group.position.set(0, 0, -400);
    this.doorTimer = 3.4;
    this.doorOpen = false;
    this.fireIdx = 0; this.fireCd = 1.6; this.escortCd = 8.5;
    scaleBoss(this, 1.6);
  }

  update(ctx) {
    super.update(ctx);
    const { dt, player, proj, game } = ctx;
    const p = this.group.position;
    this._maneuver(dt, player, {
      xRange: 86, yBase: 0, yRange: 8, zNear: -84, zFar: -335, speed: 1.04, bank: false,
      exitModes: ['left', 'right'], game,
      onReenter: () => {
        this.core.worldPos(_v2);
        this._fireMissileFan(proj, game, _v2, player, 4, 'swarm', 28, 0xffa040);
        this._fireBossClusterRain(proj, game, _v2, player, 2, 30);
      },
    });

    const turretsLeft = this.turrets.filter((t) => t.alive).length;
    this.doorTimer -= dt;
    if (this.doorTimer <= 0) {
      this.doorOpen = !this.doorOpen;
      this.doorTimer = this.doorOpen ? (turretsLeft ? 2.9 : 4.8) : 2.9;
      this.core.active = this.doorOpen;
      if (this.doorOpen && turretsLeft === 0 && !this._coreAnnounced) {
        this._coreAnnounced = true;
        this._phaseBurst(game, 0x8fe6ff, 1.25);
        game.bossPhase('THE CORE IS OPEN!');
      }
    }

    this._doorSlide = damp(this._doorSlide, this.doorOpen ? 10.8 : 0, 5.5, dt);
    this.doorL.position.x = -5.9 - this._doorSlide;
    this.doorR.position.x = 5.9 + this._doorSlide;

    if (this.offscreen) return;

    this.fireCd -= dt;
    if (this.fireCd <= 0) {
      this.fireCd = turretsLeft ? 1.22 : 0.96;
      const live = this.turrets.filter((t) => t.alive);
      if (live.length) {
        const t = live[this.fireIdx++ % live.length];
        t.worldPos(_v2);
        _v1.set(player.x, player.y, PLAYER_Z).sub(_v2).normalize().multiplyScalar(70);
        this._broadsideFx(game, _v2, 0xffb65a, 0.92);
        proj.fireEnemy(_v2.clone(), _v1.clone(), 0xffa040);
        if (Math.random() < 0.45) proj.fireEnemy(_v2.clone(), _v1.clone(), 'cluster');
        if (Math.random() < 0.52) proj.fireEnemy(_v2.clone(), _v1.clone(), 'missile');
      }
      if (this.doorOpen) {
        this.core.worldPos(_v2);
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * TAU + this.time;
          _v1.set(Math.cos(a) * 32, Math.sin(a) * 32, 46);
          proj.fireEnemy(_v2.clone(), _v1.clone(), 0x59e6f6);
        }
        if (Math.random() < 0.55) proj.fireEnemy(_v2.clone(), _v1.set(player.x, player.y, PLAYER_Z).sub(_v2).clone(), 'pursuit');
      }
    }

    // Signature Special: CITADEL SIEGE BARRAGE (4 swarm + 2 pursuit + cluster rain + rail vault beam + triple superwave)
    this.specialCd -= dt;
    if (this.specialCd <= 0) {
      this.specialCd = turretsLeft ? 5.0 : 3.8;
      this.core.worldPos(_v2);
      this._fireMissileFan(proj, game, _v2, player, 4, 'swarm', 28, 0xffa040);
      this._firePursuitSalvo(proj, game, _v2, player, 2, 0xc262ff);
      this._fireBossClusterRain(proj, game, _v2, player, 2, 32);
      if (this.doorOpen) this._fireBossRailBarrage(proj, game, _v2, player, 2, 22);
      for (let k = -1; k <= 1; k++) {
        _v1.set(player.x + k * 28, player.y + rand(-4, 4), PLAYER_Z).sub(_v2);
        proj.fireEnemy(_v2.clone(), _v1.clone(), 'superwave');
      }
    }

    // Phase-2 river ambush reinforcements (water breachers!)
    this.escortCd -= dt;
    if (this.escortCd <= 0 && turretsLeft <= 1 && game?.enemies) {
      this.escortCd = 9.5;
      game.enemies.spawn('breacher', { x: rand(-68, 68), y: -28, z: -145, peakY: 54 });
    }
  }
}

/* ============================================================================
 * WAVE 9 — EMBER SERPENT (Articulated Biomechanical Volcanic Dragon Leviathan)
 * Three.js Object3D.lookAt aligns local +Z toward target — so the sculpted
 * dragon snout, eyes, hinged lower jaw, and cheek cannons all face +Z directly
 * into the player's eyes while horns & spinal blades sweep gracefully toward -Z!
 * ============================================================================ */
export class EmberSerpent extends BossBase {
  constructor(scene) {
    super(scene, 'EMBER SERPENT', 1050);
    this.phaseCount = 2;
    this.armorMult = 0.18;
    this.segs = [];

    const armorMat = toonMat(0x3a202a, { map: bossArmorTex, flat: true });
    const darkScaleMat = toonMat(0x24141d, { map: bossArmorTex, flat: true });
    const hornMat = toonMat(0xc45328, { map: bossArmorTex, flat: true });
    const magmaMat = toonMat(0x4a1612, { emissive: 0xff5a22, emissiveIntensity: 1.55, flat: true });
    const coreGlowMat = toonMat(0x5a1c14, { emissive: 0xffaa38, emissiveIntensity: 1.85, flat: true });
    this.phaseGlows.push({ mat: magmaMat, base: 1.55 }, { mat: coreGlowMat, base: 1.85 });

    const N = 13;
    for (let i = 0; i < N; i++) {
      const seg = new THREE.Group();
      const r = i === 0 ? 7.2 : 5.4 - i * 0.22;

      if (i === 0) {
        // ---- Sculpted Armored Dragon Skull facing +Z (toward player via lookAt!) ----
        const cranium = taperHull(10.6, 7.6, 6.4, 4.8, 11.5, armorMat, { topPinch: 0.72, yShiftBack: 0.4 });
        cranium.position.set(0, 1.4, 0.5);
        seg.add(cranium);

        const snout = taperHull(6.4, 4.4, 3.4, 2.8, 7.2, darkScaleMat, { topPinch: 0.65 });
        snout.position.set(0, 1.2, 8.8);
        seg.add(snout);

        const browRidge = taperHull(9.6, 2.2, 6.8, 1.4, 6.8, hornMat, { topPinch: 0.8 });
        browRidge.position.set(0, 4.6, 2.5);
        seg.add(browRidge);

        // Sweeping curved volcanic crown horns sweeping proudly back toward -Z!
        for (const s of [-1, 1]) {
          const hornBase = taperHull(2.2, 2.4, 1.4, 1.6, 6.8, hornMat);
          hornBase.position.set(s * 4.4, 4.8, -2.2);
          hornBase.rotation.set(-0.45, s * 0.35, s * -0.45);
          seg.add(hornBase);
          const hornTip = new THREE.Mesh(new THREE.ConeGeometry(1.15, 7.8, 5), hornMat);
          hornTip.position.set(s * 6.8, 7.2, -6.6);
          hornTip.rotation.set(-0.95, 0, s * -0.52);
          seg.add(hornTip);

          const cheekBlade = taperHull(1.8, 2.6, 0.9, 1.8, 6.4, darkScaleMat);
          cheekBlade.position.set(s * 5.6, -0.4, -1.2);
          cheekBlade.rotation.y = s * -0.45;
          seg.add(cheekBlade);

          // Recessed glowing furnace eyes staring forward (+Z)
          const eyeSocket = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.3, 2.6), darkScaleMat);
          eyeSocket.position.set(s * 3.8, 2.2, 5.2);
          seg.add(eyeSocket);
          const iris = glowSprite(0xffe054, 3.8);
          iris.position.set(s * 3.8, 2.2, 6.7);
          seg.add(iris);

          // Twin cheek-mounted magma plasma cannons aiming +Z!
          const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.42, 6.6, 7), darkScaleMat);
          cannon.rotation.x = Math.PI / 2;
          cannon.position.set(s * 5.2, -0.8, 4.8);
          seg.add(cannon);
          const barrelRing = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.14, 6, 10), magmaMat);
          barrelRing.position.set(s * 5.2, -0.8, 7.8);
          seg.add(barrelRing);
          const muzzle = glowSprite(0xff5a2e, 2.3);
          muzzle.position.set(s * 5.2, -0.8, 8.3);
          seg.add(muzzle);
        }

        // Articulated hinged lower magma jaw facing +Z (positive rotation.x swings jaw DOWN open!)
        this.lowerJaw = new THREE.Group();
        this.lowerJaw.position.set(0, -1.6, 1.5);
        const jawPlate = taperHull(6.8, 2.4, 3.6, 1.6, 9.6, darkScaleMat, { botPinch: 0.65 });
        jawPlate.position.set(0, -1.0, 4.6);
        this.lowerJaw.add(jawPlate);
        for (const s of [-1, 1]) {
          const fang = new THREE.Mesh(new THREE.ConeGeometry(0.65, 2.8, 4), coreGlowMat);
          fang.position.set(s * 1.9, 0.8, 7.8);
          fang.rotation.x = 0.2;
          this.lowerJaw.add(fang);
        }
        seg.add(this.lowerJaw);

        // Glowing throat furnace core + spinning magma focusing ring visible inside the open maw (+Z)!
        const throatCore = glowSprite(0xffc040, 9.6);
        throatCore.position.set(0, -0.4, 7.2);
        seg.add(throatCore);
        const mawRing = new THREE.Mesh(new THREE.TorusGeometry(4.4, 0.42, 8, 18), coreGlowMat);
        mawRing.position.set(0, -0.2, 6.4);
        seg.add(mawRing);
        this.rotors.push({ mesh: mawRing, axis: 'z', speed: 2.5 });
      } else {
        // ---- Sculpted Interlocking Armored Vertebra (+Z faces parent vertebra ahead!) ----
        const innerCore = new THREE.Mesh(new THREE.OctahedronGeometry(r * 0.78, 1), magmaMat);
        seg.add(innerCore);

        const shell = taperHull(r * 1.95, r * 1.48, r * 1.65, r * 1.25, r * 1.55, i % 2 === 0 ? armorMat : darkScaleMat, { topPinch: 0.68 });
        shell.position.y = r * 0.14;
        seg.add(shell);

        const collar = new THREE.Mesh(new THREE.TorusGeometry(r * 0.96, 0.34, 6, 12), magmaMat);
        collar.position.z = r * 0.62;
        seg.add(collar);

        // Swept dorsal dragon spine crest angling back toward -Z
        const dorsalBlade = taperHull(0.95, r * 1.15, 0.45, r * 0.88, r * 1.35, hornMat, { topPinch: 0.35, yShiftBack: -r * 0.25 });
        dorsalBlade.position.set(0, r * 1.05, -r * 0.15);
        seg.add(dorsalBlade);

        for (const s of [-1, 1]) {
          const rib = taperHull(r * 0.35, 0.22, r * 0.75, 0.38, r * 1.1, darkScaleMat);
          rib.position.set(s * r * 1.18, 0, -r * 0.1);
          rib.rotation.z = s * -0.42;
          rib.rotation.y = s * 0.35;
          seg.add(rib);
        }

        if (i % 2 === 0) {
          const flame = glowSprite(0xff7a3a, r * 1.1, 0.85);
          flame.position.set(0, r * 1.65, 0);
          seg.add(flame);
        }

        // Tapered volcanic tail stinger pointing aft (-Z) on final segment
        if (i === N - 1) {
          const tailBlade = new THREE.Mesh(new THREE.ConeGeometry(r * 0.65, r * 4.8, 4), hornMat);
          tailBlade.rotation.x = -Math.PI / 2;
          tailBlade.position.z = -r * 2.8;
          seg.add(tailBlade);
          const tailGlow = glowSprite(0xff6428, r * 2.2);
          tailGlow.position.z = -r * 4.6;
          seg.add(tailGlow);
        }
      }

      this.group.add(seg);
      this.segs.push(seg);
    }

    this.jointIdx = [3, 6, 9];
    this.joints = this.jointIdx.map(() => this.addWeak(new THREE.Vector3(), 3.8, 160, 0xff452e));
    this.headWeak = this.addWeak(new THREE.Vector3(), 5.8, 570, 0xffc040);
    this.headWeak.active = false;
    this.bodyRadius = 0;
    this.fireCd = 2.0; this.escortCd = 9.0;
    this.group.position.set(0, 0, 0);
    this.headPos = new THREE.Vector3(0, 24, -340);
    this._drag = { mode: 'coil', t: 2.4, cycles: 0, side: 1, breachFired: false, eruptFired: false };
  }

  _scorchParent(point) {
    let best = this.segs[0], bd = Infinity;
    for (const s of this.segs) { const d = point.distanceTo(s.position); if (d < bd) { bd = d; best = s; } }
    return best;
  }

  hitTest(point, r) {
    const base = super.hitTest(point, r);
    if (base) return base;
    for (let i = 1; i < this.segs.length; i++) {
      if (point.distanceTo(this.segs[i].position) < 6.4 + r) return { kind: 'body', wp: null };
    }
    if (point.distanceTo(this.segs[0].position) < 9.5 + r) return { kind: 'body', wp: null };
    return null;
  }

  update(ctx) {
    super.update(ctx);
    const { dt, player, proj, game } = ctx;
    const t = this.time;
    const dr = this._drag;
    const head = this.segs[0];

    dr.t -= dt;
    if (dr.t <= 0) {
      if (dr.mode === 'burrowDown') {
        dr.mode = 'burrowWait';
        dr.t = 0.65;
        dr.side = -dr.side;
        dr.eruptFired = false;
        const rx = dr.side * rand(46, 86);
        this.headPos.set(rx, -92, rand(-155, -108));
        head.position.copy(this.headPos);
        for (let i = 1; i < this.segs.length; i++) this.segs[i].position.set(rx, -92 - i * 6.5, this.headPos.z);
        game?.hud?.alert?.(`⚠ DRAGON ERUPTION — ${dr.side < 0 ? 'LEFT' : 'RIGHT'} FLANK!`, 1.45);
        game?.particles?.ring?.(rx, 4, this.headPos.z, { color: 0xff6228, from: 5, radius: 38, dur: 0.62, opacity: 0.68 });
      } else if (dr.mode === 'burrowWait') {
        dr.mode = 'breachUp';
        dr.t = 1.45;
      } else {
        dr.cycles++;
        const roll = Math.random();
        if (this.time > 3.2 && (dr.cycles >= 4 || (dr.cycles >= 3 && roll < 0.30))) {
          dr.cycles = 0;
          dr.mode = 'burrowDown';
          dr.t = 1.25;
          dr.breachFired = false;
        } else if (roll < 0.30) {
          dr.mode = 'lunge';
          dr.t = rand(1.45, 2.0);
        } else if (roll < 0.60) {
          dr.mode = 'retreatSky';
          dr.t = rand(1.85, 2.5);
        } else {
          dr.mode = 'coil';
          dr.t = rand(2.1, 3.0);
        }
      }
    }

    let lerpSpd = 3.2;
    if (dr.mode === 'lunge') {
      // Roaring close-range strike right across the cockpit!
      this.headPos.set(
        clamp(player.x * 0.65 + Math.sin(t * 2.4) * 32, -82, 82),
        clamp(player.y + Math.cos(t * 2.1) * 14, 14, 52),
        -62 + Math.sin(t * 3.0) * 10
      );
      lerpSpd = 4.2;
    } else if (dr.mode === 'retreatSky') {
      // Soars high and deep into the volcanic horizon!
      this.headPos.set(Math.sin(t * 1.15) * 90, 74 + Math.sin(t * 1.4) * 18, -328 + Math.cos(t * 0.9) * 18);
      lerpSpd = 3.0;
    } else if (dr.mode === 'burrowDown') {
      this.headPos.set(clamp(head.position.x, -76, 76), -96, -155);
      lerpSpd = 4.8;
      if (!dr.breachFired && head.position.y < 10) {
        dr.breachFired = true;
        game?.particles?.ring?.(head.position.x, 4, head.position.z, { color: 0xff6228, from: 4, radius: 34, dur: 0.48, opacity: 0.62 });
        game?.particles?.emit?.(head.position.x, 6, head.position.z, { count: 20, speed: 40, vy: 28, color: 0xffb848, color2: 0xff3c18, life: 0.52, size: 4.2, drag: 1.8 });
      }
    } else if (dr.mode === 'burrowWait') {
      lerpSpd = 0;
    } else if (dr.mode === 'breachUp') {
      this.headPos.set(dr.side * 42 + Math.sin(t * 2.2) * 20, 48 + Math.sin(t * 2.0) * 10, -118);
      lerpSpd = 4.6;
      if (!dr.eruptFired && head.position.y > 4) {
        dr.eruptFired = true;
        game?.particles?.ring?.(head.position.x, 5, head.position.z, { color: 0xff8838, from: 5, radius: 42, dur: 0.56, opacity: 0.70 });
        game?.particles?.emit?.(head.position.x, 6, head.position.z, { count: 24, speed: 46, vy: 36, color: 0xffe070, color2: 0xff4218, life: 0.60, size: 4.6, drag: 1.7 });
        this.headWeak.worldPos(_v2);
        this._fireMissileFan(proj, game, _v2, player, 4, 'swarm', 28, 0xff6a38);
      }
    } else {
      // Wide dramatic S-coil weaving across the gorge
      const tz = -126 - Math.sin(t * 0.52) * 76;
      this.headPos.set(
        Math.sin(t * 0.95) * 74 + Math.sin(t * 2.15) * 12,
        28 + Math.sin(t * 0.72 + 1.2) * 18,
        Math.min(this.headPos.z + 72 * dt, tz)
      );
    }

    if (lerpSpd > 0) head.position.lerp(this.headPos, Math.min(1, dt * lerpSpd));
    head.lookAt(player.x, player.y, PLAYER_Z);
    this._bossTag.position.set(head.position.x, head.position.y + 18, head.position.z);
    this.offscreen = (Math.abs(head.position.x) > 195 || head.position.y > 135 || head.position.y < -28 || head.position.z < -410);

    if (this.lowerJaw) {
      const roar = (this.fireCd < 0.55 || this.specialCd < 0.7 || dr.mode === 'lunge') ? 0.58 : 0.14 + Math.sin(t * 3.5) * 0.08;
      this.lowerJaw.rotation.x = damp(this.lowerJaw.rotation.x, roar, 9, dt);
    }

    for (let i = 1; i < this.segs.length; i++) {
      const prev = this.segs[i - 1].position, cur = this.segs[i].position;
      _v1.copy(cur).sub(prev);
      const want = i === 1 ? 8.2 : 6.6;
      if (_v1.lengthSq() < 0.0001) _v1.set(0, 0, -1);
      cur.copy(prev).addScaledVector(_v1.normalize(), want);
      this.segs[i].lookAt(prev);
    }

    this.jointIdx.forEach((si, k) => {
      const w = this.joints[k];
      if (w.alive) w.obj.position.copy(this.segs[si].position).add(_v1.set(0, 3.0, 0));
    });
    // Seat the golden mouth weakpoint right inside the dragon's open +Z roaring jaws!
    head.getWorldDirection(_v1);
    this.headWeak.obj.position.copy(head.position).addScaledVector(_v1, 6.2);

    const jointsLeft = this.joints.filter((j) => j.alive).length;
    if (jointsLeft === 0 && !this.headWeak.active) {
      this.headWeak.active = true;
      this._phaseBurst(game, 0xff7a3a, 1.25);
      game.bossPhase('HIT THE HEAD!');
    }

    if (this.offscreen) return;

    this.fireCd -= dt;
    if (this.fireCd <= 0) {
      this.fireCd = this.headWeak.active ? 1.15 : 1.72;
      this.headWeak.worldPos(_v2);
      this._broadsideFx(game, _v2, 0xff6a38, 1.2);
      for (let k = -1; k <= 1; k++) {
        _v1.set(player.x + k * 16, player.y + Math.abs(k) * 5, PLAYER_Z).sub(_v2).normalize().multiplyScalar(78);
        proj.fireEnemy(_v2.clone(), _v1.clone(), 0xff5a2e);
      }
      if (Math.random() < 0.55) for (let k = -1; k <= 1; k++) {
        _v1.set(player.x + k * 30, player.y + 8, PLAYER_Z).sub(_v2);
        proj.fireEnemy(_v2.clone(), _v1.clone(), 'venom');
      }
      if (Math.random() < 0.62) for (const s of [-1, 1]) {
        _v1.set(player.x + s * 28, player.y + 10, PLAYER_Z).sub(_v2);
        proj.fireEnemy(_v2.clone(), _v1.clone(), 'missile');
      }
    }

    // Signature Special: INFERNO SPIRAL (magma cluster rain + 5 swarm + pursuit + boomerang + Phase-2 molten rail breath!)
    this.specialCd -= dt;
    if (this.specialCd <= 0) {
      this.specialCd = this.headWeak.active ? 3.5 : 4.7;
      this.headWeak.worldPos(_v2);
      this._fireMissileFan(proj, game, _v2, player, 5, 'swarm', 26, 0xff5a2e);
      this._firePursuitSalvo(proj, game, _v2, player, this.headWeak.active ? 3 : 2, 0xff8c42);
      this._fireBossClusterRain(proj, game, _v2, player, 2, 32);
      this._fireBossHelixBoomerang(proj, game, _v2, player);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU + t * 0.9;
        _v1.set(Math.cos(a) * 34, Math.sin(a) * 34, 46);
        proj.fireEnemy(_v2.clone(), _v1.clone(), 'plasma');
      }
      if (this.headWeak.active) {
        this._fireBossRailBarrage(proj, game, _v2, player, 2, 24);
        _v1.set(player.x, player.y, PLAYER_Z).sub(_v2);
        proj.fireEnemy(_v2.clone(), _v1.clone(), 'superwave');
      }
    }

    this.escortCd -= dt;
    if (this.escortCd <= 0 && this.headWeak.active && game?.enemies) {
      this.escortCd = 9.0;
      game.enemies.spawn('valkyrie', { x: rand(-74, 74), y: 162, z: -140, diveY: 26, side: Math.random() < 0.5 ? -1 : 1 });
    }
  }
}

/* ============================================================================
 * WAVE 12 — DREAD SOVEREIGN (Imperial Dreadnought Battleship)
 * Chased from behind (+Z): 4.3 MB `ships/imperial.gltf` central hull fused with
 * heavy chamfered outrigger wing-sponsons bridging x = ±12 → ±46, stern dreadnought
 * reactor bay facing +Z (100% unobstructed!), multi-tier lit command citadel,
 * 4 tracking broadside triple/twin turrets aiming back at the player, & quad engines.
 * ============================================================================ */
export class DreadSovereign extends BossBase {
  constructor(scene) {
    super(scene, 'DREAD SOVEREIGN', 1800);
    this.phaseCount = 3;
    this.armorMult = 0.15;

    const hullMat = toonMat(0x3f4862, { map: bossArmorTex, flat: true });
    const darkMat = toonMat(0x20273a, { map: bossArmorTex, flat: true });
    const hazardMat = toonMat(0x475066, { map: bossHazardTex, flat: true });
    const bridgeMat = toonMat(0x222c42, { map: bossWindowTex, emissive: 0x8f5cff, emissiveIntensity: 0.48, flat: true });
    const litMat = toonMat(0x1e1838, { emissive: 0x9b68ff, emissiveIntensity: 1.50, flat: true });
    const gunLit = toonMat(0x3a2012, { emissive: 0xffa040, emissiveIntensity: 1.40, flat: true });
    this.phaseGlows.push({ mat: litMat, base: 1.50 }, { mat: gunLit, base: 1.40 });

    const fallbackHull = taperHull(28, 9, 34, 12, 68, hullMat);
    this.group.add(fallbackHull);

    const rig = new THREE.Group();
    this.group.add(rig);
    this.hardware = rig;

    // Multi-tier illuminated Battleship Command Citadel + Rotating Tactical Radar Mast
    const citadelBase = taperHull(15, 5.5, 19, 6.8, 22, darkMat, { topPinch: 0.8 });
    citadelBase.position.set(0, 8.2, 8);
    rig.add(citadelBase);
    const citadelTower = new THREE.Mesh(new THREE.BoxGeometry(14.5, 7.8, 13), bridgeMat);
    citadelTower.position.set(0, 14.4, 8.5);
    rig.add(citadelTower);
    const bridgeWings = new THREE.Mesh(new THREE.BoxGeometry(23, 2.2, 5.2), hullMat);
    bridgeWings.position.set(0, 16.6, 10.2);
    rig.add(bridgeWings);

    const radarMast = new THREE.Group();
    radarMast.position.set(0, 18.4, 8.5);
    const mastStem = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.3, 8.5, 8), darkMat);
    mastStem.position.y = 4.2;
    radarMast.add(mastStem);
    const mastCross = new THREE.Mesh(new THREE.BoxGeometry(14, 1.2, 1.6), litMat);
    mastCross.position.y = 7.6;
    radarMast.add(mastCross);
    rig.add(radarMast);

    // Armored Stern Singularity Core Bay (+Z side!) framed by stern pincer mandibles & counter-rotating rings!
    for (const s of [-1, 1]) {
      const sternFork = taperHull(6.4, 6.8, 3.6, 4.2, 18, hullMat, { xShiftBack: s * -1.8, topPinch: 0.7 });
      sternFork.position.set(s * 9.8, 2.2, 24);
      rig.add(sternFork);
      const sternGlow = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.2, 14), litMat);
      sternGlow.position.set(s * 7.4, 2.4, 25);
      rig.add(sternGlow);
    }
    const coreRing = new THREE.Mesh(new THREE.TorusGeometry(9.2, 0.68, 8, 24), litMat);
    coreRing.position.set(0, 2.5, 25.5);
    rig.add(coreRing);
    const coreRingInner = new THREE.Mesh(new THREE.TorusGeometry(6.6, 0.38, 6, 18), litMat);
    coreRingInner.position.set(0, 2.5, 26.2);
    rig.add(coreRingInner);
    this.rotors.push(
      { mesh: radarMast, axis: 'y', speed: 1.9 },
      { mesh: coreRing, axis: 'z', speed: -1.35 },
      { mesh: coreRingInner, axis: 'z', speed: 2.2 },
    );

    // Structurally integrated Outrigger Wing-Sponsons physically bridging ±12 → ±46!
    for (const s of [-1, 1]) {
      const bridgeArm = sweptWing(33, 28, 16, 4, 4.8, hullMat, { dropY: -2.0 });
      bridgeArm.position.set(s * 12, 2.2, 2);
      bridgeArm.scale.x = s;
      rig.add(bridgeArm);

      // Inner turret barbette deck solidly seated under inner weakpoint (±24, 7.2, 4)
      const innerDeck = taperHull(13, 5.2, 10.5, 4.4, 16, hazardMat, { topPinch: 0.85 });
      innerDeck.position.set(s * 24, 3.8, 4.0);
      rig.add(innerDeck);
      const innerTurret = buildTrackingTurret(this, hullMat, hazardMat, darkMat, gunLit, 0xffa040, { scale: 1.15, barrels: 3, len: 9.2 });
      innerTurret.position.set(s * 24, 6.4, 9.2);
      rig.add(innerTurret);

      // Outer battleship outrigger bastion hull solidly under outer weakpoint (±40, 2.4, 8)
      const outerBastion = taperHull(11.5, 5.2, 15.5, 6.8, 44, darkMat, { topPinch: 0.78 });
      outerBastion.position.set(s * 40, -1.0, 4);
      rig.add(outerBastion);
      const outerSideStrip = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.4, 34), litMat);
      outerSideStrip.position.set(s * 46.8, -0.6, 4);
      rig.add(outerSideStrip);

      const outerTurret = buildTrackingTurret(this, hullMat, hazardMat, darkMat, gunLit, 0xffa040, { scale: 1.05, len: 8.6 });
      outerTurret.position.set(s * 40, 2.4, 14.5);
      rig.add(outerTurret);

      const sternFin = taperHull(1.1, 8.2, 1.8, 10.5, 13, hullMat, { topPinch: 0.48 });
      sternFin.position.set(s * 41, 6.4, 18);
      sternFin.rotation.z = s * -0.18;
      rig.add(sternFin);

      const outerEng = buildEngineNacelle(this, hullMat, darkMat, gunLit, 0xff6a3e, 3.1, 20);
      outerEng.position.set(s * 39, -1.2, 26.8);
      rig.add(outerEng);
      const innerEng = buildEngineNacelle(this, hullMat, darkMat, gunLit, 0xff9248, 2.5, 17);
      innerEng.position.set(s * 16.5, -0.5, 34.0);
      rig.add(innerEng);

      this.addAccent(new THREE.Vector3(s * 24, 7.2, 11), 0x8f5cff, 2.6, 4);
      this.addAccent(new THREE.Vector3(s * 41, 11.4, 19), 0xff6a3e, 2.4, 3.4);
    }

    this.turrets = [
      this.addWeak(new THREE.Vector3(24, 7.4, 5.5), 3.3, 175, 0xffa040),
      this.addWeak(new THREE.Vector3(-24, 7.4, 5.5), 3.3, 175, 0xffa040),
      this.addWeak(new THREE.Vector3(40, 2.4, 10.5), 3.3, 175, 0xffa040),
      this.addWeak(new THREE.Vector3(-40, 2.4, 10.5), 3.3, 175, 0xffa040),
    ];
    this.core = this.addWeak(new THREE.Vector3(0, 2.5, 26.5), 5.4, 1100, 0x8f5cff);
    this.core.active = false;
    this.bodyRadius = 34;
    this.group.position.set(0, 28, -420);
    this.fireCd = 1.8; this.ringCd = 3.6; this.droneCd = 6.5;
    this.phase = 1;
    scaleBoss(this, 1.95);
    this._modelKey = 'dread'; this._modelOpts = { rotY: Math.PI };
  }

  update(ctx) {
    super.update(ctx);
    const { dt, player, proj, game } = ctx;
    const p = this.group.position;
    const aggro = this.phase === 3 ? 1.56 : this.phase === 2 ? 1.28 : 1.06;
    this._maneuver(dt, player, {
      xRange: 98, yBase: 30, yRange: 19, zNear: -78, zFar: -355, speed: aggro,
      exitModes: ['left', 'right', 'top'], pitch: true, game,
      onReenter: () => {
        this.core.worldPos(_v2);
        this._fireMissileFan(proj, game, _v2, player, 6, 'swarm', 28, 0xff7a4a);
        this._fireBossRailBarrage(proj, game, _v2, player, 2, 24);
      },
    });

    const turretsLeft = this.turrets.filter((t) => t.alive).length;
    if (turretsLeft === 0 && this.phase === 1) {
      this.phase = 2;
      this.core.active = true;
      this._phaseBurst(game, 0x9d72ff, 1.3);
      game.bossPhase('SHIELD DOWN — HIT THE CORE!');
    }
    if (this.phase === 2 && this.hp < this.maxHp * 0.36) {
      this.phase = 3;
      this._phaseBurst(game, 0xff8a52, 1.5);
      game.bossPhase('FINAL FURY!');
    }
    if (this.phase === 3) {
      this._updateShieldPulse(dt, this.core, game, 2.2, 12.0, '⚠ IMPERIAL SHIELD OVERDRIVE!');
    }

    if (this.offscreen) return;

    this.fireCd -= dt;
    if (this.fireCd <= 0) {
      this.fireCd = this.phase === 3 ? 0.74 : 1.28;
      const live = this.turrets.filter((t) => t.alive);
      if (live.length) {
        for (const t of live.slice(0, 2)) {
          t.worldPos(_v2);
          _v1.set(player.x, player.y, PLAYER_Z).sub(_v2).normalize().multiplyScalar(76);
          this._broadsideFx(game, _v2, 0xffa85a, 0.95);
          proj.fireEnemy(_v2.clone(), _v1.clone(), 0xffa040);
        }
      } else {
        this.core.worldPos(_v2);
        for (let k = -2; k <= 2; k++) {
          _v1.set(player.x + k * 12, player.y + rand(-5, 5), PLAYER_Z).sub(_v2).normalize().multiplyScalar(84);
          proj.fireEnemy(_v2.clone(), _v1.clone(), 0x8f5cff);
        }
      }
      if (Math.random() < (this.phase >= 2 ? 0.68 : 0.48)) for (const s of [1, -1]) {
        _v2.copy(p); _v2.x += s * 40; _v2.y -= 2;
        _v1.set(player.x + s * 22, player.y + 8, PLAYER_Z).sub(_v2);
        proj.fireEnemy(_v2.clone(), _v1.clone(), this.phase >= 2 ? 'swarm' : 'missile');
      }
      if (this.phase === 3 && Math.random() < 0.6) {
        _v1.set(player.x, player.y, PLAYER_Z).sub(p);
        proj.fireEnemy(p.clone(), _v1.clone(), 'cluster');
      }
    }
    this.ringCd -= dt;
    if (this.ringCd <= 0 && this.phase >= 2) {
      this.ringCd = this.phase === 3 ? 2.2 : 3.4;
      this.core.worldPos(_v2);
      const n = this.phase === 3 ? 12 : 8;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * TAU + this.time * 0.7;
        _v1.set(Math.cos(a) * 34, Math.sin(a) * 34, 38);
        proj.fireEnemy(_v2.clone(), _v1.clone(), 0x8f5cff);
      }
    }
    // Signature Special: IMPERIAL MACROSS SALVO (6 swarm + pursuit + cluster curtain + staggered Rail Broadside + superwave!)
    this.specialCd -= dt;
    if (this.specialCd <= 0) {
      this.specialCd = this.phase === 3 ? 3.0 : this.phase === 2 ? 3.8 : 4.8;
      this.core.worldPos(_v2);
      this._fireMissileFan(proj, game, _v2, player, this.phase >= 2 ? 6 : 4, 'swarm', 28, 0xff824a);
      this._firePursuitSalvo(proj, game, _v2, player, this.phase === 3 ? 3 : 2, 0xc262ff);
      this._fireBossClusterRain(proj, game, _v2, player, this.phase >= 2 ? 3 : 2, 30);
      this._fireBossRailBarrage(proj, game, _v2, player, this.phase === 3 ? 3 : 2, 24);
      for (let k = -1; k <= 1; k++) {
        _v1.set(player.x + k * 28, player.y + rand(-5, 5), PLAYER_Z).sub(_v2);
        proj.fireEnemy(_v2.clone(), _v1.clone(), 'superwave');
      }
    }
    this.droneCd -= dt;
    if (this.droneCd <= 0 && this.phase >= 2 && game?.enemies) {
      this.droneCd = this.phase === 3 ? 5.5 : 8.2;
      game.enemies.formation('drone', 3, 'vee', { y: 22, z: -290 });
      if (this.phase === 3) {
        const side = Math.random() < 0.5 ? -1 : 1;
        game.enemies.spawn('vanguard', { x: side * 245, y: rand(20, 52), z: -118, side });
      }
    }
  }
}

/* ============================================================================
 * WAVE 14 — OBSIDIAN MATRIARCH (Stealth Obsidian Assault Carrier Flagship)
 * Chased from behind (+Z): 3.1 MB `ships/insurgent.gltf` integrated with swept
 * obsidian scythe wings, illuminated violet flight-deck hangar bays facing +Z,
 * dorsal rotating phase-prism citadel, stern reactor bay (+Z), 4 hull-mounted
 * tracking turrets, and quad vectored violet plasma thruster pods!
 * ============================================================================ */
export class ObsidianMatriarch extends BossBase {
  constructor(scene) {
    super(scene, 'OBSIDIAN MATRIARCH', 2600);
    this.phaseCount = 3;
    this.armorMult = 0.12;

    const hullMat = toonMat(0x2f2546, { map: bossArmorTex, flat: true });
    const darkMat = toonMat(0x17142b, { map: bossArmorTex, flat: true });
    const hazardMat = toonMat(0x3a2e52, { map: bossHazardTex, flat: true });
    const bridgeMat = toonMat(0x221b3c, { map: bossWindowTex, emissive: 0xa878ff, emissiveIntensity: 0.56, flat: true });
    const violetLit = toonMat(0x261644, { emissive: 0xb27dff, emissiveIntensity: 1.52, flat: true });
    const coralLit = toonMat(0x3e1a1e, { emissive: 0xff7c5c, emissiveIntensity: 1.42, flat: true });
    this.phaseGlows.push({ mat: violetLit, base: 1.52 }, { mat: coralLit, base: 1.42 });

    const fallbackBody = taperHull(36, 12, 46, 18, 80, hullMat);
    this.group.add(fallbackBody);

    const rig = new THREE.Group();
    this.group.add(rig);
    this.hardware = rig;

    // Dorsal Obsidian Phase-Prism Citadel + Double Counter-Rotating Phase Rings
    const dorsalCrown = new THREE.Mesh(new THREE.CylinderGeometry(9.5, 13.5, 7.5, 6), darkMat);
    dorsalCrown.position.set(0, 12.6, 6);
    rig.add(dorsalCrown);
    const prismRingA = new THREE.Mesh(new THREE.TorusGeometry(13.2, 0.62, 6, 20), violetLit);
    prismRingA.rotation.x = Math.PI / 2;
    prismRingA.position.set(0, 16.2, 6);
    rig.add(prismRingA);
    const prismRingB = new THREE.Mesh(new THREE.TorusGeometry(9.2, 0.42, 6, 16), coralLit);
    prismRingB.rotation.x = Math.PI / 2;
    prismRingB.position.set(0, 18.0, 6);
    rig.add(prismRingB);

    // Prominent Stern Phase-Reactor Core collar on +Z side (100% unobstructed from cockpit!)
    const coreRing = new THREE.Mesh(new THREE.TorusGeometry(10.6, 0.72, 8, 24), violetLit);
    coreRing.position.set(0, 3.8, 25.5);
    rig.add(coreRing);
    this.rotors.push(
      { mesh: prismRingA, axis: 'z', speed: 1.6 },
      { mesh: prismRingB, axis: 'z', speed: -2.4 },
      { mesh: coreRing, axis: 'z', speed: -1.3 },
    );

    // Swept Obsidian Carrier Wing Arms physically joining `insurgent` (±16) to outer scythes (±48)
    for (const s of [-1, 1]) {
      const wingArm = sweptWing(30, 34, 18, 6, 4.4, hullMat, { dropY: -1.8 });
      wingArm.position.set(s * 16, 2.2, 4);
      wingArm.scale.x = s;
      rig.add(wingArm);

      // Illuminated violet fighter launch-bay hangars facing +Z toward the player!
      const hangarBay = taperHull(13, 6.2, 11, 5.2, 22, bridgeMat, { topPinch: 0.86 });
      hangarBay.position.set(s * 26, 4.6, 4);
      rig.add(hangarBay);
      const launchLip = new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.9, 1.2), violetLit);
      launchLip.position.set(s * 26, 4.8, 15.2);
      rig.add(launchLip);

      // Swept jagged obsidian scythe wingtip blades
      const scythe = taperHull(4.2, 1.8, 9.5, 3.2, 28, darkMat, { xShiftFront: s * -4.2, topPinch: 0.65 });
      scythe.position.set(s * 43, 0.6, 4);
      rig.add(scythe);
      const scytheEdge = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.85, 24), violetLit);
      scytheEdge.position.set(s * 45.8, 0.8, 4);
      scytheEdge.rotation.y = s * -0.14;
      rig.add(scytheEdge);

      // Tracking heavy plasma turrets seated solidly on the wing decks aiming toward +Z!
      const innerTurret = buildTrackingTurret(this, hullMat, hazardMat, darkMat, coralLit, 0xff7c5c, { scale: 1.18, barrels: 3, len: 9.4 });
      innerTurret.position.set(s * 28, 7.6, 12.2);
      rig.add(innerTurret);

      const outerPad = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 7.2, 2.6, 8), hazardMat);
      outerPad.position.set(s * 40, -0.5, 11);
      rig.add(outerPad);
      const outerTurret = buildTrackingTurret(this, hullMat, hazardMat, darkMat, coralLit, 0xff7c5c, { scale: 1.05, len: 8.6 });
      outerTurret.position.set(s * 40, 0.8, 15.8);
      rig.add(outerTurret);

      // Quad vectored violet plasma engine nacelles
      const engOuter = buildEngineNacelle(this, hullMat, darkMat, violetLit, 0xa878ff, 3.0, 21);
      engOuter.position.set(s * 28, 0.2, 30.5);
      rig.add(engOuter);
      const engInner = buildEngineNacelle(this, hullMat, darkMat, violetLit, 0xd888ff, 2.4, 17);
      engInner.position.set(s * 14, -1.0, 36.5);
      rig.add(engInner);

      this.addAccent(new THREE.Vector3(s * 43, 1.4, 18), 0xa878ff, 3.2, 4.8);
      this.addAccent(new THREE.Vector3(s * 28, 8.8, 18), 0xff7c5c, 2.6, 4.0);
    }

    this.turrets = [
      this.addWeak(new THREE.Vector3(-28, 8.2, 8.2), 3.6, 220, 0xff7c5c),
      this.addWeak(new THREE.Vector3(28, 8.2, 8.2), 3.6, 220, 0xff7c5c),
      this.addWeak(new THREE.Vector3(-40, 1.6, 12.0), 3.3, 200, 0xff7c5c),
      this.addWeak(new THREE.Vector3(40, 1.6, 12.0), 3.3, 200, 0xff7c5c),
    ];
    this.core = this.addWeak(new THREE.Vector3(0, 3.8, 26.2), 6.0, 1760, 0xa878ff);
    this.core.active = false;
    this.bodyRadius = 38;
    this.group.position.set(0, 34, -420);
    this.fireCd = 1.5; this.spawnCd = 6.8; this.phase = 1;
    scaleBoss(this, 1.72);
    this._modelKey = 'matriarch'; this._modelOpts = { rotY: Math.PI };
  }

  update(ctx) {
    super.update(ctx);
    const { dt, player, proj, game } = ctx;
    const p = this.group.position;
    this._maneuver(dt, player, {
      xRange: 102, yBase: 34, yRange: 21, zNear: -78, zFar: -355, speed: this.phase === 3 ? 1.58 : 1.18,
      exitModes: ['left', 'right', 'top'], pitch: true, game,
      onReenter: () => {
        this.core.worldPos(_v2);
        this._firePursuitSalvo(proj, game, _v2, player, 4, 0xc262ff);
        this._fireMissileFan(proj, game, _v2, player, 6, 'swarm', 28, 0xff5278);
        this._fireBossHelixBoomerang(proj, game, _v2, player);
      },
    });
    const live = this.turrets.filter((t) => t.alive);
    if (live.length === 0 && this.phase === 1) { this.phase = 2; this.core.active = true; this._phaseBurst(game, 0xa878ff, 1.3); game.bossPhase('REACTOR EXPOSED!'); }
    if (this.phase === 2 && this.hp < this.maxHp * 0.36) { this.phase = 3; this._phaseBurst(game, 0xff825e, 1.5); game.bossPhase('MATRIARCH OVERDRIVE!'); }
    if (this.phase === 3) {
      this._updateShieldPulse(dt, this.core, game, 2.4, 11.2, '⚠ PHASE-CLOAK BARRIER!');
    }

    if (this.offscreen) return;

    this.fireCd -= dt;
    if (this.fireCd <= 0) {
      this.fireCd = this.phase === 3 ? 0.68 : 1.18;
      if (live.length) {
        for (const t of live.slice(0, this.phase === 3 ? 3 : 2)) {
          t.worldPos(_v2); _v1.set(player.x, player.y, PLAYER_Z).sub(_v2).normalize().multiplyScalar(80);
          this._broadsideFx(game, _v2, 0xff7c5c, 0.98);
          proj.fireEnemy(_v2.clone(), _v1.clone(), 'heavy');
        }
      } else {
        this.core.worldPos(_v2);
        for (let k = -2; k <= 2; k++) { _v1.set(player.x + k * 15, player.y + rand(-6, 6), PLAYER_Z).sub(_v2); proj.fireEnemy(_v2.clone(), _v1.clone(), 'plasma'); }
      }
      if (Math.random() < (this.phase >= 2 ? 0.72 : 0.52)) for (const s of [-1, 1]) {
        _v2.copy(p); _v2.x += s * 34; _v1.set(player.x + s * 22, player.y + 8, PLAYER_Z).sub(_v2);
        proj.fireEnemy(_v2.clone(), _v1.clone(), this.phase >= 2 ? 'swarm' : 'missile');
      }
    }
    // Signature Special: OBSIDIAN PHASE STORM (6 swarm + pursuit + cluster + rail + helix/boomerang + venom + superwave!)
    this.specialCd -= dt;
    if (this.specialCd <= 0) {
      this.specialCd = this.phase === 3 ? 2.8 : this.phase === 2 ? 3.5 : 4.5;
      this.core.worldPos(_v2);
      this._fireMissileFan(proj, game, _v2, player, 6, 'swarm', 28, 0xff5278);
      this._firePursuitSalvo(proj, game, _v2, player, this.phase === 3 ? 4 : 3, 0xc262ff);
      this._fireBossClusterRain(proj, game, _v2, player, 3, 30);
      this._fireBossHelixBoomerang(proj, game, _v2, player);
      this._fireBossRailBarrage(proj, game, _v2, player, this.phase === 3 ? 3 : 2, 24);
      for (let k = -2; k <= 2; k++) {
        _v1.set(player.x + k * 20, player.y + Math.abs(k) * 4, PLAYER_Z).sub(_v2);
        proj.fireEnemy(_v2.clone(), _v1.clone(), 'venom');
      }
      this._fireWaveCross(proj, game, _v2, player, this.phase === 3 ? 6 : 4, 'superwave', Math.PI * 0.25, 0xc262ff);
    }
    this.spawnCd -= dt;
    if (this.spawnCd <= 0 && this.phase >= 2 && game?.enemies) {
      this.spawnCd = this.phase === 3 ? 5.2 : 7.8;
      game.enemies.formation('phantom', this.phase === 3 ? 3 : 2, 'sides', { y: 38, z: -295, noScale: true });
      if (this.phase === 3) {
        game.enemies.spawn('valkyrie', { x: rand(-78, 78), y: 164, z: -140, diveY: 24, side: Math.random() < 0.5 ? -1 : 1 });
      }
    }
  }
}

/* ============================================================================
 * WAVE 16 — RIFT HARBINGER (Dimensional Singularity Orbital Citadel — Final Boss)
 * Faces the player (+Z) with commanding hovering presence (`rotation.y` sways
 * dramatically instead of turning its back!), uniting `aero_station_ring.glb` with:
 * - 4 massive radial structural bridge spokes locking outer ring → pylons → core
 * - Live energy tether beams from each surviving pylon into the singularity core
 * - Triple nested armillary gyroscope rings spinning independently on X, Y, Z axes
 * - 8 outer perimeter stabilizer wing-vanes + 4 articulated tracking pylon cannons!
 * ============================================================================ */
export class RiftHarbinger extends BossBase {
  constructor(scene) {
    super(scene, 'RIFT HARBINGER', 3500);
    this.phaseCount = 3;
    this.armorMult = 0.10;

    const armorMat = toonMat(0x27354f, { map: bossArmorTex, flat: true });
    const darkMat = toonMat(0x141d2e, { map: bossArmorTex, flat: true });
    const hazardMat = toonMat(0x344460, { map: bossHazardTex, flat: true });
    const cyanLit = toonMat(0x10283e, { emissive: 0x62e2ff, emissiveIntensity: 1.55, flat: true });
    const goldLit = toonMat(0x3a2a12, { emissive: 0xffd26b, emissiveIntensity: 1.65, flat: true });
    this.phaseGlows.push({ mat: cyanLit, base: 1.55 }, { mat: goldLit, base: 1.65 });

    const fallbackRing = new THREE.Mesh(new THREE.TorusGeometry(46, 5.2, 8, 32), armorMat);
    fallbackRing.position.y = 10;
    this.group.add(fallbackRing);

    const rig = new THREE.Group();
    this.group.add(rig);
    this.hardware = rig;

    // Triple nested 3D armillary gyroscope containment rings around central singularity at (0, 10, 0)
    const gimbalOuter = new THREE.Mesh(new THREE.TorusGeometry(29.5, 1.05, 8, 32), cyanLit);
    gimbalOuter.position.set(0, 10, 2);
    rig.add(gimbalOuter);
    const gimbalMid = new THREE.Mesh(new THREE.TorusGeometry(21.5, 0.72, 6, 28), goldLit);
    gimbalMid.position.set(0, 10, 2);
    gimbalMid.rotation.x = 0.65;
    rig.add(gimbalMid);
    const gimbalInner = new THREE.Mesh(new THREE.TorusGeometry(14.5, 0.52, 6, 24), cyanLit);
    gimbalInner.position.set(0, 10, 2);
    gimbalInner.rotation.y = 0.75;
    rig.add(gimbalInner);

    const coreSphere = new THREE.Mesh(new THREE.IcosahedronGeometry(9.2, 1), darkMat);
    coreSphere.position.set(0, 10, 0);
    rig.add(coreSphere);

    this.rotors.push(
      { mesh: gimbalOuter, axis: 'z', speed: 0.75 },
      { mesh: gimbalMid, axis: 'y', speed: -1.55 },
      { mesh: gimbalInner, axis: 'x', speed: 2.15 },
      { mesh: coreSphere, axis: 'y', speed: -0.9 },
    );

    // 4 Massive Structural Radial Bridge Spokes anchoring outer ring (r=57) → pylon hubs (r=31) → core
    this.pylons = [];
    this.pylonBeams = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + Math.PI * 0.25;
      const ca = Math.cos(a), sa = Math.sin(a);
      const px = ca * 31, py = 10 + sa * 27;

      const spoke = new THREE.Mesh(new THREE.BoxGeometry(36, 4.4, 7.2), armorMat);
      spoke.position.set(ca * 38, 10 + sa * 35, -1.0);
      spoke.rotation.z = a;
      rig.add(spoke);

      const bastion = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 6.6, 12, 8), hazardMat);
      bastion.rotation.x = Math.PI / 2;
      bastion.position.set(px, py, 0.5);
      rig.add(bastion);

      // Tracking plasma cannons facing +Z directly at the player!
      const turret = buildTrackingTurret(this, armorMat, hazardMat, darkMat, cyanLit, 0x62e2ff, { scale: 1.05, len: 8.6 });
      turret.position.set(ca * 38, 10 + sa * 34, 4.2);
      rig.add(turret);

      // Luminous inward energy tether beam on the +Z face feeding the central singularity!
      const beamLen = Math.hypot(px, py - 10) - 9;
      const beamMat = new THREE.MeshBasicMaterial({
        color: 0x62e2ff, transparent: true, opacity: 0.65,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.45, beamLen, 8), beamMat);
      beam.position.set(px * 0.52, 10 + (py - 10) * 0.52, 3.8);
      beam.rotation.z = a + Math.PI / 2;
      rig.add(beam);
      this.pylonBeams.push(beam);

      this.pylons.push(this.addWeak(new THREE.Vector3(px, py, 6.8), 3.9, 290, 0x62d8ff));
      this.addAccent(new THREE.Vector3(px, py, 2.5), 0x62d8ff, 3.0, 5.2 + i);
    }

    // 8 Outer radial armored stabilizer vanes crowning the orbital ring perimeter
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      const vane = taperHull(2.8, 11.5, 4.6, 14.5, 7.8, i % 2 === 0 ? armorMat : darkMat, { topPinch: 0.45 });
      vane.position.set(Math.cos(a) * 57, 10 + Math.sin(a) * 57, 0);
      vane.rotation.z = a - Math.PI / 2;
      rig.add(vane);
      const tipLight = glowSprite(i % 2 === 0 ? 0x62e2ff : 0xffd26b, 3.4);
      tipLight.position.set(Math.cos(a) * 63.5, 10 + Math.sin(a) * 63.5, 1.5);
      rig.add(tipLight);
    }

    this.core = this.addWeak(new THREE.Vector3(0, 10, 9.8), 7.0, 2340, 0xffd26b);
    this.core.active = false;
    this.bodyRadius = 42;
    this.group.position.set(0, 36, -440);
    this.fireCd = 1.4; this.ringCd = 3.8; this.spawnCd = 6.2; this.phase = 1;
    scaleBoss(this, 1.52);
    this._modelKey = 'harbinger'; this._modelOpts = { y: 10 };
  }

  update(ctx) {
    super.update(ctx);
    const { dt, player, proj, game } = ctx;
    const p = this.group.position;
    this._maneuver(dt, player, {
      xRange: 96, yBase: 36, yRange: 20, zNear: -82, zFar: -360, speed: this.phase === 3 ? 1.54 : 1.12, bank: false,
      exitModes: ['left', 'right', 'top'], game,
      onReenter: () => {
        this.core.worldPos(_v2);
        this._firePursuitSalvo(proj, game, _v2, player, 4, 0xc262ff);
        this._fireMissileFan(proj, game, _v2, player, 6, 'torpedo', 28, 0x62e2ff);
        this._fireBossRailBarrage(proj, game, _v2, player, 3, 24);
        this._fireWaveCross(proj, game, _v2, player, 6, 'superwave', this.time, 0xffd26b);
      },
    });
    // Commanding face-on hover sway so the armillary rings, energy tethers & core stay facing the player!
    this.group.rotation.y = Math.sin(this.time * (this.phase === 3 ? 0.72 : 0.44)) * 0.34;

    for (let i = 0; i < this.pylons.length; i++) {
      const beam = this.pylonBeams[i];
      if (!beam) continue;
      beam.visible = this.pylons[i].alive;
      if (beam.visible) {
        const s = 0.85 + Math.sin(this.time * 14 + i * 1.7) * 0.25;
        beam.scale.set(s, 1, s);
      }
    }

    const live = this.pylons.filter((w) => w.alive);
    if (live.length === 0 && this.phase === 1) { this.phase = 2; this.core.active = true; this._phaseBurst(game, 0x62d8ff, 1.35); game.bossPhase('RIFT CORE EXPOSED!'); }
    if (this.phase === 2 && this.hp < this.maxHp * 0.34) { this.phase = 3; this._phaseBurst(game, 0xffd26b, 1.55); game.bossPhase('SINGULARITY APOCALYPSE!'); }
    if (this.phase === 3) {
      this._updateShieldPulse(dt, this.core, game, 2.5, 10.5, '⚠ DIMENSIONAL SHIELD BARRIER!');
    }

    if (this.offscreen) return;

    this.fireCd -= dt;
    if (this.fireCd <= 0) {
      this.fireCd = this.phase === 3 ? 0.60 : 1.12;
      if (live.length) {
        for (const w of live.slice(0, this.phase === 3 ? 3 : 2)) {
          w.worldPos(_v2); _v1.set(player.x, player.y, PLAYER_Z).sub(_v2).normalize().multiplyScalar(78);
          this._broadsideFx(game, _v2, this.phase === 3 ? 0xa6ff73 : 0x62d8ff, 0.92);
          proj.fireEnemy(_v2.clone(), _v1.clone(), this.phase === 3 ? 'venom' : 'bolt');
        }
      } else {
        this.core.worldPos(_v2);
        for (let k = -2; k <= 2; k++) { _v1.set(player.x + k * 18, player.y + rand(-7, 7), PLAYER_Z).sub(_v2); proj.fireEnemy(_v2.clone(), _v1.clone(), 'wave'); }
      }
      if (Math.random() < 0.65) for (const s of [-1, 1]) {
        _v2.set(p.x + s * 34, p.y + 10, p.z + 8);
        _v1.set(player.x + s * 22, player.y, PLAYER_Z).sub(_v2);
        proj.fireEnemy(_v2.clone(), _v1.clone(), this.phase >= 2 ? 'swarm' : 'torpedo');
      }
    }
    this.ringCd -= dt;
    if (this.ringCd <= 0 && this.phase >= 2) {
      this.ringCd = this.phase === 3 ? 1.95 : 3.3;
      this.core.worldPos(_v2);
      const n = this.phase === 3 ? 14 : 10;
      for (let k = 0; k < n; k++) { const a = (k / n) * TAU + this.time * 0.5; _v1.set(Math.cos(a) * 38, Math.sin(a) * 38, 42); proj.fireEnemy(_v2.clone(), _v1.clone(), 'plasma'); }
    }
    // Signature Special: SINGULARITY VORTEX (6 swarm + 4 pursuit + 3 cluster + triple rail + helix/boomerang + 8-superwave ring!)
    this.specialCd -= dt;
    if (this.specialCd <= 0) {
      this.specialCd = this.phase === 3 ? 2.6 : this.phase === 2 ? 3.4 : 4.4;
      this.core.worldPos(_v2);
      this._fireMissileFan(proj, game, _v2, player, 6, 'swarm', 30, 0x62e2ff);
      this._firePursuitSalvo(proj, game, _v2, player, this.phase >= 2 ? 4 : 3, 0xc262ff);
      this._fireBossClusterRain(proj, game, _v2, player, 3, 32);
      this._fireBossHelixBoomerang(proj, game, _v2, player);
      this._fireBossRailBarrage(proj, game, _v2, player, this.phase === 3 ? 3 : 2, 26);
      this._fireWaveCross(proj, game, _v2, player, this.phase === 3 ? 8 : 6, 'superwave', this.time * 0.8, 0xffd26b);
    }
    this.spawnCd -= dt;
    if (this.spawnCd <= 0 && this.phase >= 2 && game?.enemies) {
      this.spawnCd = this.phase === 3 ? 4.8 : 7.2;
      game.enemies.formation(this.phase === 3 ? 'harrier' : 'phantom', this.phase === 3 ? 3 : 2, 'vee', { y: 36, z: -295, noScale: true });
      if (this.phase === 3) {
        const s = Math.random() < 0.5 ? -1 : 1;
        game.enemies.spawn('vanguard', { x: s * 245, y: rand(24, 52), z: -120, side: s });
      }
    }
  }
}

export const BOSS_BY_WAVE = { 3: TempestRay, 6: CascadeWarden, 9: EmberSerpent, 12: DreadSovereign, 14: ObsidianMatriarch, 16: RiftHarbinger };
