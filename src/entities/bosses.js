import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { toonMat, dotTexture, rand, clamp, damp, TAU, _v1, _v2 } from '../core/util.js';

/* real CC0 3D models used as boss hulls (Quaternius ships / Kenney structures)
 * and the Kenney turret bolted onto the fortress. Loaded once, cloned per boss. */
const BOSS_MODELS = {};
function loadBossModel(key, path, size, extOverride) {
  const ext = extOverride || (path.startsWith('ships/') ? 'gltf' : 'glb');
  new GLTFLoader().load(`./assets/models/${path}.${ext}`, (g) => {
    const obj = g.scene;
    obj.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = false; if (o.material) o.material.fog = true; } });
    const box = new THREE.Box3().setFromObject(obj);
    const c = box.getCenter(new THREE.Vector3());
    const dim = box.getSize(new THREE.Vector3());
    const s = size / (Math.max(dim.x, dim.y, dim.z) || 1);
    obj.scale.setScalar(s);
    obj.position.set(-c.x * s, -c.y * s, -c.z * s);
    BOSS_MODELS[key] = obj;
  });
}
// TEMPEST RAY flies the expansion pack's purpose-built enemy command ship
loadBossModel('ray', 'expansion/Spaceship_RaeTheRedPanda', 56, 'gltf');
loadBossModel('warden', 'props/hangar_largea', 82); // CASCADE WARDEN — fortress station
loadBossModel('dread', 'ships/imperial', 70);       // DREAD SOVEREIGN — capital ship
// Formerly unused CC0 models for the expanded afterburner campaign bosses
loadBossModel('matriarch', 'ships/insurgent', 86);   // OBSIDIAN MATRIARCH — assault carrier
loadBossModel('harbinger', 'external/aero_station_ring', 108); // RIFT HARBINGER — relay citadel
loadBossModel('serpentSeg', 'debris/meteor', 1);    // EMBER SERPENT — rock segments
let _turretTpl = null;
new GLTFLoader().load('./assets/models/props/turret_double.glb', (g) => {
  const box = new THREE.Box3().setFromObject(g.scene);
  const dim = box.getSize(new THREE.Vector3());
  g.scene.scale.setScalar(9 / (Math.max(dim.x, dim.y, dim.z) || 1));
  _turretTpl = g.scene;
});
import { PLAYER_Z } from './player.js';

function glowSprite(color, size) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: dotTexture(), color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  s.scale.setScalar(size);
  return s;
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

/** grow a boss visually and keep every hit radius in sync (weakpoints are
 *  scaled by the group transform, so only the raw radii need multiplying) */
function scaleBoss(boss, s) {
  boss.group.scale.setScalar(s);
  boss.bodyRadius *= s;
  for (const w of boss.weakpoints) w.radius *= s;
  boss._scale = s;
}

/** Persistent Groups survive the external hull swap and add readable combat
 * hardware: layered reactor rings, gun rails, pylons and engine crowns. */
function addBossHardware(boss, profile, accent, trim = 0x263247) {
  const rig = new THREE.Group();
  const armor = toonMat(trim, { flat: true });
  const lit = toonMat(0x17243a, { emissive: accent, emissiveIntensity: 1.2, flat: true });
  const dark = toonMat(0x111826, { flat: true });
  const span = ({ ray: 22, warden: 34, dread: 36, matriarch: 31, harbinger: 34 })[profile] ?? 28;
  // Segmented outer armour, bolt lines and protected cooling conduits retain
  // their place when a high-detail CC0 hull replaces the procedural shell.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const plate = new THREE.Mesh(new THREE.BoxGeometry(5.8, 1.25, 8.8), armor);
      plate.position.set(side * (span * 0.62 + i * 1.5), 4 + i * 1.6, -10 + i * 11);
      plate.rotation.y = side * (0.10 + i * 0.035); rig.add(plate);
      const conduit = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 8.0, 6), lit);
      conduit.rotation.x = Math.PI / 2; conduit.position.set(side * (span * 0.72 + i * 1.4), 4.8 + i * 1.6, -10 + i * 11); rig.add(conduit);
      const serviceLight = glowSprite(i === 1 ? accent : 0xffa45a, 1.05);
      serviceLight.position.set(side * (span * 0.80 + i * 1.4), 6.2 + i * 1.6, -10 + i * 11); rig.add(serviceLight);
    }
  }
  const addBarrel = (x, y, z, len = 8) => {
    const mount = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.45, 1.0, 8), armor);
    mount.position.set(x, y, z); rig.add(mount);
    for (const off of [-0.38, 0.38]) {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, len, 6), dark);
      barrel.rotation.x = Math.PI / 2; barrel.position.set(x + off, y + 0.25, z - len * 0.48); rig.add(barrel);
    }
    const muzzle = glowSprite(accent, 1.5); muzzle.position.set(x, y + 0.25, z - len); rig.add(muzzle);
  };

  if (profile === 'ray') {
    for (const side of [-1, 1]) {
      const pylon = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.1, 10), armor);
      pylon.position.set(side * 23, 1.2, 3); pylon.rotation.z = side * 0.2; rig.add(pylon);
      addBarrel(side * 24, 1.8, -2, 6.5);
      const engine = glowSprite(accent, 2.6); engine.position.set(side * 15, 0, 12); rig.add(engine);
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(6.4, 0.42, 8, 18), lit); ring.position.set(0, -1.5, -10); rig.add(ring);
  } else if (profile === 'warden') {
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(5, 2.2, 24), armor); rail.position.set(side * 37, 37, 0); rig.add(rail);
      addBarrel(side * 37, 58, -5, 7.5);
      const beacon = glowSprite(accent, 2.2); beacon.position.set(side * 37, 68, -6); rig.add(beacon);
    }
    const coreRing = new THREE.Mesh(new THREE.TorusGeometry(8, 0.5, 8, 20), lit); coreRing.position.set(0, 20, -7); rig.add(coreRing);
  } else if (profile === 'dread') {
    for (const side of [-1, 1]) {
      const pylon = new THREE.Mesh(new THREE.BoxGeometry(5, 1.5, 28), armor); pylon.position.set(side * 37, 0, 4); pylon.rotation.y = side * 0.12; rig.add(pylon);
      addBarrel(side * 27, 7, -8, 8.5);
      addBarrel(side * 43, 2, -17, 7.5);
      const engine = glowSprite(accent, 3.2); engine.position.set(side * 38, -2, 26); rig.add(engine);
    }
    const commandRing = new THREE.Mesh(new THREE.TorusGeometry(9, 0.6, 8, 20), lit); commandRing.position.set(0, 8, -26); rig.add(commandRing);
  } else if (profile === 'matriarch') {
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(7, 1.8, 30), armor); rail.position.set(side * 30, 3, 4); rail.rotation.y = side * 0.16; rig.add(rail);
      addBarrel(side * 28, 8, -10, 8.5);
      const engine = glowSprite(accent, 3.0); engine.position.set(side * 24, 0, 24); rig.add(engine);
    }
    const coreRing = new THREE.Mesh(new THREE.TorusGeometry(10, 0.7, 8, 22), lit); coreRing.position.set(0, 4, -18); rig.add(coreRing);
  } else if (profile === 'harbinger') {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + Math.PI * 0.25;
      const x = Math.cos(a) * 34, y = 10 + Math.sin(a) * 28;
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.2, 14, 7), armor); mast.position.set(x, y, 0); rig.add(mast);
      addBarrel(x, y, -8, 7.5);
    }
    const gate = new THREE.Mesh(new THREE.TorusGeometry(28, 0.8, 8, 30), lit); gate.position.set(0, 10, 0); rig.add(gate);
  }
  boss.group.add(rig);
  boss.hardware = rig;
}

class Weakpoint {
  constructor(parent, pos, radius, hp, color = 0xff3d5e) {
    this.obj = new THREE.Group();
    this.core = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.55, 10, 8),
      toonMat(0x552233, { emissive: color, emissiveIntensity: 1.8 }));
    this.glow = glowSprite(color, radius * 2.6);
    // Twin containment rings make a weakpoint read as installed combat hardware,
    // rather than a flat glowing target. The light core stays visible through the cage.
    this.cageA = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.78, Math.max(0.12, radius * 0.065), 6, 16),
      toonMat(0x172033, { emissive: color, emissiveIntensity: 0.82, flat: true }));
    this.cageA.rotation.x = Math.PI * 0.5;
    this.cageB = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.62, Math.max(0.10, radius * 0.048), 6, 14),
      toonMat(0x202a3c, { emissive: color, emissiveIntensity: 0.56, flat: true }));
    this.cageB.rotation.y = Math.PI * 0.5;
    this.obj.add(this.core, this.glow, this.cageA, this.cageB);
    this.obj.position.copy(pos);
    parent.add(this.obj);
    this.radius = radius; this.hp = hp; this.maxHp = hp; this.alive = true; this.active = true;
    this.flashT = 0;
  }
  worldPos(out) { return this.obj.getWorldPosition(out); }
  hit(dmg) {
    this.hp -= dmg; this.flashT = 0.08;
    if (this.hp <= 0) { this.alive = false; this.obj.visible = false; }
    return !this.alive;
  }
  update(dt, t) {
    if (!this.alive) return;
    const live = this.active ? 1 : 0.32;
    const pulse = 1 + Math.sin(t * 5.2 + this.radius) * 0.08 * live;
    if (this.flashT > 0) {
      this.flashT -= dt;
      this.core.material.emissiveIntensity = 4;
      this.cageA.material.emissiveIntensity = 2.8;
      this.cageB.material.emissiveIntensity = 2.1;
    } else {
      this.core.material.emissiveIntensity = 0.52 + live * (0.88 + Math.sin(t * 5) * 0.5);
      this.cageA.material.emissiveIntensity = 0.20 + live * (0.60 + Math.sin(t * 4.2) * 0.20);
      this.cageB.material.emissiveIntensity = 0.15 + live * (0.38 + Math.sin(t * 3.4 + 1) * 0.14);
    }
    this.glow.material.opacity = this.active ? 0.92 : 0.18;
    this.glow.scale.setScalar(this.radius * 2.6 * pulse);
    this.cageA.rotation.z += dt * (this.active ? 2.8 : 0.7);
    this.cageB.rotation.x += dt * (this.active ? -2.0 : -0.5);
    this.cageA.scale.setScalar(pulse);
    this.cageB.scale.setScalar(1.04 - (pulse - 1) * 0.45);
  }
}

class BossBase {
  constructor(scene, name, maxHp) {
    this.scene = scene; this.name = name;
    this.maxHp = maxHp; this.hp = maxHp;
    this.alive = true; this.time = 0;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.weakpoints = [];
    this.accents = [];
    this.bodyRadius = 18;
    this.introT = 3.0;
    this._bossTag = new THREE.Sprite(new THREE.SpriteMaterial({
      map: bossTagTexture(name), color: 0xff5d71, transparent: true, opacity: 0.94,
      depthTest: false, depthWrite: false, fog: false,
    }));
    this._bossTag.scale.set(42, 6.3, 1);
    this._bossTag.position.set(0, 68, 0);
    this.group.add(this._bossTag);
  }
  pos() { return this.group.position; }
  /** a pulsing accent light welded to the hull (registered for animation) */
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
  /** Compact, high-readability firing flare at a known boss hardpoint. */
  _broadsideFx(game, pos, color = 0xffa45a, scale = 1) {
    if (!game?.particles || !pos) return;
    const fx = game.particles;
    fx.muzzle(pos.x, pos.y, pos.z, 1.15 * scale, color);
    fx.flash(pos.x, pos.y, pos.z, 0.52 * scale, color);
    fx.emit(pos.x, pos.y, pos.z, { count: Math.round(5 + 3 * scale), speed: 22 * scale, vz: -16 * scale, color, color2: 0xffffff, life: 0.26, size: 2.2 * scale, drag: 2.8, spread: 0.45 });
  }
  /** One clearly bounded phase-break pulse. It announces a new weakpoint state without adding a new attack. */
  _phaseBurst(game, color = 0xffd080, scale = 1) {
    if (!game?.particles) return;
    const p = this.group.position, fx = game.particles;
    fx.flash(p.x, p.y, p.z, 1.7 * scale, color);
    fx.emit(p.x, p.y, p.z, { count: Math.round(14 * scale), speed: 30 * scale, color, color2: 0xffffff, life: 0.46, size: 3.0 * scale, drag: 2.4, spread: 2.1 });
    fx.ring(p.x, p.y, p.z, { color, from: 2.5 * scale, radius: 24 * scale, dur: 0.48, opacity: 0.34 });
  }
  /** returns {kind, wp} | null */
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
  /** which object a burn mark should stick to (serpent overrides → nearest segment) */
  _scorchParent() { return this.group; }
  /** persistent burn mark (爆発痕) where a shot landed — pooled, rides the hull, fades */
  addScorch(point) {
    if (!this.scorches) {
      this.scorches = [];
      this._scorchTex = new THREE.TextureLoader().load('./assets/particles/scorch_01.png');
      this._scorchTex.colorSpace = THREE.SRGBColorSpace;
    }
    let e;
    if (this.scorches.length >= 14) {
      e = this.scorches.reduce((a, b) => (a.life < b.life ? a : b));   // recycle the faintest
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

  destroy() { this.scene.remove(this.group); }
  /** once the external hull model has loaded, swap it in and hide the
   *  procedural hull meshes (weakpoints / accents / added models are kept) */
  _tryBodyModel() {
    if (!this._modelKey || this._bodyDone || !BOSS_MODELS[this._modelKey]) return;
    this._bodyDone = true;
    const m = BOSS_MODELS[this._modelKey].clone(true);
    const o = this._modelOpts || {};
    m.rotation.y = o.rotY || 0;
    m.position.y += o.y || 0;
    m.traverse((c) => c.layers && c.layers.enable(1));
    // hide procedural hull pieces (direct-child meshes); keep weakpoint groups,
    // accent sprites, and any GLB models added elsewhere (Groups, not isMesh)
    for (const c of this.group.children) if (c.isMesh) c.visible = false;
    this.group.add(m);
    this._bodyModel = m;
  }

  update(ctx) {
    this.time += ctx.dt;
    this._tryBodyModel();
    for (const w of this.weakpoints) w.update(ctx.dt, this.time);
    const tagPulse = 1 + Math.sin(this.time * 4.5) * 0.045;
    this._bossTag.scale.set(42 * tagPulse, 6.3 * tagPulse, 1);
    this._bossTag.material.opacity = this.group.position.z > -650 && this.group.position.z < 60 ? 0.92 : 0;
    for (const a of this.accents) {
      const p = Math.sin(this.time * a.spd + a.off);
      a.spr.scale.setScalar(a.size * (0.85 + p * 0.22));
      a.spr.material.opacity = 0.72 + p * 0.28;
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
   * Shared AI mobility: the boss picks fresh waypoints and slews toward them,
   * lunging FORWARD at the player, retreating BACK, and strafing LEFT/RIGHT —
   * so every boss dances through the arena instead of drifting on a sine wave.
   * opts: {xRange, yBase, yRange, zNear, zFar, speed, bank} — per-boss agility.
   */
  _maneuver(dt, player, opts = {}) {
    const p = this.group.position;
    const xRange = opts.xRange ?? 60, zNear = opts.zNear ?? -150, zFar = opts.zFar ?? -320;
    const yBase = opts.yBase ?? p.y, yRange = opts.yRange ?? 12, sp = opts.speed ?? 1.1;
    if (!this._mv) this._mv = { wp: new THREE.Vector3(p.x, p.y, p.z), t: 0, lunge: false };
    this._mv.t -= dt;
    if (this._mv.t <= 0) {
      const roll = Math.random();
      this._mv.lunge = roll < 0.32;
      this._mv.t = this._mv.lunge ? rand(0.8, 1.3) : rand(1.3, 2.4);
      // forward lunge toward the player / mid hold / deep retreat
      const z = this._mv.lunge ? rand(zNear, zNear * 0.55)
        : roll < 0.68 ? rand(zFar * 0.75, zNear) : rand(zFar, zFar * 0.8);
      const x = clamp(player.x * 0.45 + rand(-xRange, xRange), -xRange, xRange);
      this._mv.wp.set(x, yBase + rand(-yRange, yRange), z);
    }
    const s = this._mv.lunge ? sp * 1.7 : sp;
    p.x = damp(p.x, this._mv.wp.x, s, dt);
    p.y = damp(p.y, this._mv.wp.y, s * 0.8, dt);
    p.z = damp(p.z, this._mv.wp.z, s * 0.7, dt);
    if (opts.bank !== false) this.group.rotation.z = damp(this.group.rotation.z, (this._mv.wp.x - p.x) * 0.006, 3, dt);
  }
}

/* ================= WAVE 3 — TEMPEST RAY (sea) ================= */
export class TempestRay extends BossBase {
  constructor(scene) {
    super(scene, 'TEMPEST RAY', 115);
    this.phaseCount = 2;
    const bodyMat = toonMat(0x2e4a6e, { flat: true });
    const body = new THREE.Mesh(new THREE.SphereGeometry(9, 12, 10), bodyMat);
    body.scale.set(2.4, 0.55, 1.4);
    this.group.add(body);
    for (const s of [1, -1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(24, 1.2, 14), toonMat(0x24405e, { flat: true }));
      wing.position.set(s * 20, 0, 2);
      wing.rotation.z = s * 0.24;
      this.group.add(wing);
      const tipGlow = glowSprite(0x59e6f6, 5);
      tipGlow.position.set(s * 31, 1.5, 2);
      this.group.add(tipGlow);
    }
    const tail = new THREE.Mesh(new THREE.ConeGeometry(1.2, 16, 6), toonMat(0x24405e));
    tail.rotation.x = Math.PI / 2;
    tail.position.z = 18;
    this.group.add(tail);
    const maw = glowSprite(0xffd080, 6);
    maw.position.set(0, -1, -12);
    this.group.add(maw);
    // pulsing bio-luminescent hull lights
    for (const s of [1, -1]) { this.addAccent(new THREE.Vector3(s * 12, 1, 0), 0x59e6f6, 2.6, 5); this.addAccent(new THREE.Vector3(s * 27, 1.4, 3), 0x2fd0e0, 2.0, 3.4); }
    this.addAccent(new THREE.Vector3(0, 1.4, 6), 0xff9e4a, 2.4, 6);
    // dorsal fin ridges along the wings
    for (const s of [1, -1]) for (let i = 0; i < 3; i++) {
      const fin = new THREE.Mesh(new THREE.ConeGeometry(1.1, 3.6, 4), toonMat(0x24405e, { flat: true }));
      fin.position.set(s * (10 + i * 7), 2.4, 4 + i * 1.2);
      fin.rotation.z = s * 0.25;
      this.group.add(fin);
    }

    this.podL = this.addWeak(new THREE.Vector3(20, 2.2, 2), 4.5, 26, 0x59e6f6);
    this.podR = this.addWeak(new THREE.Vector3(-20, 2.2, 2), 4.5, 26, 0x59e6f6);
    this.core = this.addWeak(new THREE.Vector3(0, -1.5, -11), 5.4, 38, 0xff9e4a);
    this.core.active = false;
    this.bodyRadius = 20;
    this.group.position.set(0, 24, -560);
    this.fireCd = 2.5;
    scaleBoss(this, 2.0);
    this._modelKey = 'ray'; this._modelOpts = { rotY: Math.PI };
    addBossHardware(this, 'ray', 0x59e6f6, 0x24405e);
  }
  update(ctx) {
    super.update(ctx);
    const { dt, player, proj } = ctx;
    const p = this.group.position;
    // agile ray: figure-8 strafes with sudden dives at the player
    this._maneuver(dt, player, { xRange: 72, yBase: 32, yRange: 16, zNear: -150, zFar: -320, speed: 0.95 });
    this.group.rotation.x = Math.sin(this.time * 0.9) * 0.13;
    this.group.rotation.y = damp(this.group.rotation.y, (player.x - p.x) * 0.004, 2, dt);

    if (!this.podL.alive && !this.podR.alive && !this.core.active) {
      this.core.active = true;
      this._phaseBurst(ctx.game, 0xffd080, 1.15);
      ctx.game.bossPhase('CORE EXPOSED!');
    }

    this.fireCd -= dt;
    if (this.fireCd <= 0) {
      this.fireCd = this.core.active ? 1.7 : 2.6;
      // spread from the maw
      this._broadsideFx(ctx.game, _v2.set(p.x, p.y - 2, p.z - 10), 0x59e6f6, 1.15);
      for (let k = -2; k <= 2; k++) {
        _v2.set(p.x, p.y - 2, p.z - 10);
        _v1.set(player.x + k * 14, player.y + rand(-4, 4), PLAYER_Z).sub(_v2).normalize().multiplyScalar(72);
        proj.fireEnemy(_v2.clone(), _v1.clone(), 0x59c6ff);
      }
      // wing pods spit while alive
      for (const pod of [this.podL, this.podR]) {
        if (!pod.alive) continue;
        pod.worldPos(_v2);
        _v1.set(player.x, player.y, PLAYER_Z).sub(_v2).normalize().multiplyScalar(60);
        proj.fireEnemy(_v2.clone(), _v1.clone(), 0x59e6f6);
      }
      // wingtip homing missiles; shockwave rings once the core is exposed
      if (Math.random() < 0.35) for (const s of [1, -1]) {
        _v2.set(p.x + s * 24, p.y + 2, p.z);
        _v1.set(player.x, player.y, PLAYER_Z).sub(_v2);
        proj.fireEnemy(_v2.clone(), _v1.clone(), 'missile');
      }
      if (this.core.active && Math.random() < 0.5) {
        _v1.set(player.x, player.y, PLAYER_Z).sub(p);
        proj.fireEnemy(p.clone(), _v1.clone(), 'wave');
      }
    }
  }
}

/* ================= WAVE 6 — CASCADE WARDEN (gorge) ================= */
export class CascadeWarden extends BossBase {
  constructor(scene) {
    super(scene, 'CASCADE WARDEN', 145);
    this.phaseCount = 2;
    const stone = toonMat(0x9a8560, { flat: true });
    const dark = toonMat(0x5e5340, { flat: true });
    for (const s of [1, -1]) {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(9, 12, 74, 7), stone);
      tower.position.set(s * 34, 26, 0);
      this.group.add(tower);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(88, 12, 12), dark);
    beam.position.set(0, 58, 0);
    this.group.add(beam);
    const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(26, 30, 8), dark);
    doorFrame.position.set(0, 20, 0);
    this.group.add(doorFrame);
    this.door = new THREE.Mesh(new THREE.BoxGeometry(20, 24, 3), toonMat(0x3a4a66, { emissive: 0x59e6f6, emissiveIntensity: 0.25 }));
    this.door.position.set(0, 19, -3.5);
    this.group.add(this.door);
    // glowing tower ports + beacon
    for (const s of [1, -1]) for (let i = 0; i < 3; i++) this.addAccent(new THREE.Vector3(s * 34, 12 + i * 22, -6.2), 0x8fe6ff, 1.7, 3 + i);
    this.addAccent(new THREE.Vector3(0, 58, -6.2), 0xffa040, 2.6, 5);
    // carved stone blocks clinging to the towers
    for (const s of [1, -1]) for (let i = 0; i < 3; i++) {
      const blk = new THREE.Mesh(new THREE.BoxGeometry(rand(4, 7), rand(3, 5), rand(4, 7)), dark);
      blk.position.set(s * 34 + rand(-5, 5), rand(8, 55), rand(-4, 4));
      this.group.add(blk);
    }

    this.turrets = [
      this.addWeak(new THREE.Vector3(34, 62, -5), 3.0, 18, 0xffa040),
      this.addWeak(new THREE.Vector3(-34, 62, -5), 3.0, 18, 0xffa040),
      this.addWeak(new THREE.Vector3(34, 12, -8), 3.0, 18, 0xffa040),
      this.addWeak(new THREE.Vector3(-34, 12, -8), 3.0, 18, 0xffa040),
    ];
    this.core = this.addWeak(new THREE.Vector3(0, 19, -6), 4.6, 48, 0x59e6f6);
    this.core.active = false;
    this.bodyRadius = 30;
    this.group.position.set(0, 0, -640);
    this.doorTimer = 4;
    this.doorOpen = false;
    this.fireIdx = 0; this.fireCd = 2.0;
    scaleBoss(this, 1.55);
    this._modelKey = 'warden'; this._modelOpts = { y: 26 };
    addBossHardware(this, 'warden', 0xffa040, 0x5e5340);
  }
  update(ctx) {
    super.update(ctx);
    // bolt real Kenney turrets under the four turret weakpoints (async model)
    if (!this._turretsAttached && _turretTpl) {
      this._turretsAttached = true;
      for (const t of [[34, 58, -5], [-34, 58, -5], [34, 8, -8], [-34, 8, -8]]) {
        const m = _turretTpl.clone(true);
        m.position.set(t[0], t[1], t[2]);
        m.traverse((o) => o.layers.enable(1));
        this.group.add(m);
      }
    }
    const { dt, player, proj } = ctx;
    const p = this.group.position;
    // a marching fortress: grinds forward to bear down, then pulls back
    this._maneuver(dt, player, { xRange: 62, yBase: 0, yRange: 5, zNear: -185, zFar: -320, speed: 0.75, bank: false });

    const turretsLeft = this.turrets.filter((t) => t.alive).length;
    this.doorTimer -= dt;
    if (this.doorTimer <= 0) {
      this.doorOpen = !this.doorOpen;
      this.doorTimer = this.doorOpen ? (turretsLeft ? 3.2 : 5.5) : 3.5;
      this.core.active = this.doorOpen;
      if (this.doorOpen && turretsLeft === 0 && !this._coreAnnounced) {
        this._coreAnnounced = true;
        this._phaseBurst(ctx.game, 0x8fe6ff, 1.2);
        ctx.game.bossPhase('THE CORE IS OPEN!');
      }
    }
    this.door.position.y = this.doorOpen
      ? Math.min(this.door.position.y + 26 * dt, 42)
      : Math.max(this.door.position.y - 26 * dt, 19);

    this.fireCd -= dt;
    if (this.fireCd <= 0) {
      this.fireCd = turretsLeft ? 1.5 : 1.1;
      const live = this.turrets.filter((t) => t.alive);
      if (live.length) {
        const t = live[this.fireIdx++ % live.length];
        t.worldPos(_v2);
        _v1.set(player.x, player.y, PLAYER_Z).sub(_v2).normalize().multiplyScalar(66);
        this._broadsideFx(ctx.game, _v2, 0xffb65a, 0.92);
        proj.fireEnemy(_v2.clone(), _v1.clone(), 0xffa040);
        if (Math.random() < 0.4) proj.fireEnemy(_v2.clone(), _v1.clone(), 'flak');   // AA burst round
      }
      if (this.doorOpen) {
        this.core.worldPos(_v2);
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * TAU + this.time;
          _v1.set(Math.cos(a) * 30, Math.sin(a) * 30, 42);
          proj.fireEnemy(_v2.clone(), _v1.clone(), 0x59e6f6);
        }
      }
    }
  }
}

/* ================= WAVE 9 — EMBER SERPENT (ember) ================= */
export class EmberSerpent extends BossBase {
  constructor(scene) {
    super(scene, 'EMBER SERPENT', 150);
    this.phaseCount = 2;
    this.segs = [];
    const N = 13;
    for (let i = 0; i < N; i++) {
      const r = i === 0 ? 7.2 : 5.0 - i * 0.16;
      const mat = i === 0
        ? toonMat(0x6e2a28, { flat: true, emissive: 0xff5a2e, emissiveIntensity: 0.35 })
        : toonMat(i % 3 === 2 ? 0x4a2530 : 0x3a1e28, { flat: true });
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat);
      this.group.add(m);
      this.segs.push(m);
      if (i > 0) {
        const collar = new THREE.Mesh(new THREE.TorusGeometry(r * 0.76, 0.22, 6, 12), toonMat(0x321d25, { emissive: 0xff4a2e, emissiveIntensity: 0.7, flat: true }));
        collar.rotation.x = Math.PI / 2;
        m.add(collar);
        if (i % 2 === 0) {
          const vent = new THREE.Mesh(new THREE.ConeGeometry(r * 0.23, r * 1.15, 5), toonMat(0x261722, { emissive: 0xff783e, emissiveIntensity: 0.55, flat: true }));
          vent.position.y = r * 0.78;
          m.add(vent);
          const flame = glowSprite(0xff7a3a, r * 0.72); flame.position.set(0, r * 1.45, 0); m.add(flame);
        }
      }
      if (i === 0) {
        for (const s of [1, -1]) {
          const horn = new THREE.Mesh(new THREE.ConeGeometry(1.2, 6.0, 5), toonMat(0xd95f33));
          horn.position.set(s * 4.2, 3.4, 1.4);
          horn.rotation.z = s * -0.5;
          m.add(horn);
        }
        // jagged jaw plates + burning eyes
        for (const s of [1, -1]) {
          const jaw = new THREE.Mesh(new THREE.ConeGeometry(1.0, 3.4, 4), toonMat(0x5a2422, { flat: true }));
          jaw.position.set(s * 2.4, -2.6, -3.5); jaw.rotation.x = Math.PI * 0.5; jaw.rotation.z = s * 0.3;
          m.add(jaw);
          const iris = glowSprite(0xffd24a, 2.2); iris.position.set(s * 2.4, 1.4, -4.6); m.add(iris);
        }
        const eye = glowSprite(0xffc040, 8);
        eye.position.z = -5.4;
        m.add(eye);
        const mawRing = new THREE.Mesh(new THREE.TorusGeometry(4.3, 0.38, 8, 16), toonMat(0x4a1c1c, { emissive: 0xff7a2e, emissiveIntensity: 1.1, flat: true }));
        mawRing.position.z = -4.7;
        m.add(mawRing);
        for (const s of [-1, 1]) {
          const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.38, 4.6, 6), toonMat(0x24151d, { flat: true }));
          cannon.rotation.x = Math.PI / 2; cannon.position.set(s * 3.8, -0.2, -2.2); m.add(cannon);
          const muzzle = glowSprite(0xff542e, 1.45); muzzle.position.set(s * 3.8, -0.2, -4.65); m.add(muzzle);
        }
      }
    }
    // glowing joint weakpoints ride on segments 3/6/9
    this.jointIdx = [3, 6, 9];
    this.joints = this.jointIdx.map(() => this.addWeak(new THREE.Vector3(), 3.8, 24, 0xff452e));
    this.headWeak = this.addWeak(new THREE.Vector3(), 5.8, 66, 0xffc040);
    this.headWeak.active = false;
    this.bodyRadius = 0; // body handled via segments
    this.fireCd = 2.2;
    this.group.position.set(0, 0, 0);
    this.headPos = new THREE.Vector3(0, 26, -520);
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
      if (point.distanceTo(this.segs[i].position) < 5.5 + r) return { kind: 'body', wp: null };
    }
    if (point.distanceTo(this.segs[0].position) < 8 + r) return { kind: 'body', wp: null };
    return null;
  }
  update(ctx) {
    super.update(ctx);
    // skin each body segment with a real Kenney rock model once it loads
    if (!this._segSkinned && BOSS_MODELS.serpentSeg) {
      this._segSkinned = true;
      for (const seg of this.segs) {
        const r = seg.geometry.parameters.radius || 4;
        const rock = BOSS_MODELS.serpentSeg.clone(true);
        rock.scale.setScalar(r * 1.75);
        rock.rotation.set(rand(0, TAU), rand(0, TAU), rand(0, TAU));
        rock.traverse((o) => o.layers && o.layers.enable(1));
        seg.add(rock);
        seg.material.transparent = true; seg.material.opacity = 0;   // hide the driver sphere
      }
    }
    const { dt, player, proj } = ctx;
    // aggressive weaving head path — lunges in close, then recoils far back
    const t = this.time;
    const tz = -190 - Math.sin(t * 0.4) * 150;
    this.headPos.set(
      Math.sin(t * 0.9) * 48 + Math.sin(t * 2.1) * 8,
      22 + Math.sin(t * 0.6 + 1.2) * 16,
      Math.min(this.headPos.z + 48 * dt, tz)
    );
    // segments follow with delay
    const head = this.segs[0];
    head.position.lerp(this.headPos, Math.min(1, dt * 3.2));
    head.lookAt(player.x, player.y, PLAYER_Z);
    for (let i = 1; i < this.segs.length; i++) {
      const prev = this.segs[i - 1].position, cur = this.segs[i].position;
      _v1.copy(cur).sub(prev);
      const d = _v1.length() || 0.001;
      const want = 6.4;
      cur.copy(prev).addScaledVector(_v1.normalize(), want);
      void d;
    }
    // ride weakpoints on joints
    this.jointIdx.forEach((si, k) => {
      const w = this.joints[k];
      if (w.alive) w.obj.position.copy(this.segs[si].position).add(_v1.set(0, 2.4, 0));
    });
    this.headWeak.obj.position.copy(head.position).add(_v1.set(0, 0, -4));

    const jointsLeft = this.joints.filter((j) => j.alive).length;
    if (jointsLeft === 0 && !this.headWeak.active) {
      this.headWeak.active = true;
      this._phaseBurst(ctx.game, 0xff7a3a, 1.22);
      ctx.game.bossPhase('HIT THE HEAD!');
    }

    this.fireCd -= dt;
    if (this.fireCd <= 0) {
      this.fireCd = this.headWeak.active ? 1.5 : 2.2;
      this._broadsideFx(ctx.game, head.position, 0xff6a38, 1.18);
      for (let k = -1; k <= 1; k++) {
        _v1.set(player.x + k * 16, player.y + Math.abs(k) * 5, PLAYER_Z).sub(head.position).normalize().multiplyScalar(74);
        proj.fireEnemy(head.position.clone(), _v1.clone(), 0xff5a2e);
      }
      // corrosive venom spray from the maw
      if (Math.random() < 0.4) for (let k = -1; k <= 1; k++) {
        _v1.set(player.x + k * 30, player.y + 8, PLAYER_Z).sub(head.position);
        proj.fireEnemy(head.position.clone(), _v1.clone(), 'venom');
      }
    }
  }
}

/* ================= WAVE 12 — DREAD SOVEREIGN (dune) ================= */
export class DreadSovereign extends BossBase {
  constructor(scene) {
    super(scene, 'DREAD SOVEREIGN', 240);
    this.phaseCount = 3;
    const hullMat = toonMat(0x3c4258, { flat: true });
    const trim = toonMat(0x252a3d, { flat: true });
    const hull = new THREE.Mesh(new THREE.BoxGeometry(70, 10, 30), hullMat);
    this.group.add(hull);
    const prow = new THREE.Mesh(new THREE.ConeGeometry(11, 30, 4), hullMat);
    prow.rotation.x = -Math.PI / 2;
    prow.rotation.y = Math.PI / 4;
    prow.position.z = -28;
    this.group.add(prow);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(18, 10, 12), trim);
    bridge.position.set(0, 9, 6);
    this.group.add(bridge);
    // fine detail: lit bridge windows, comms antenna, turret hardware, deck greebles
    const win = new THREE.Mesh(new THREE.BoxGeometry(14, 1.2, 0.4), toonMat(0x0f2030, { emissive: 0x8fe6ff, emissiveIntensity: 1.7 }));
    win.position.set(0, 11, -0.2);
    this.group.add(win);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 9, 4), trim);
    ant.position.set(4, 18, 6);
    this.group.add(ant);
    for (const t of [[24, 7, -6], [-24, 7, -6], [40, 1.5, -14], [-40, 1.5, -14]]) {
      const tbase = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.2, 1.8, 8), trim);
      tbase.position.set(t[0], t[1] - 2.4, t[2]);
      this.group.add(tbase);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 6.5, 6), toonMat(0x161a28));
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(t[0], t[1] - 1.4, t[2] - 4.4);
      this.group.add(barrel);
    }
    for (let i = 0; i < 6; i++) {
      const gb = new THREE.Mesh(new THREE.BoxGeometry(rand(3, 6), rand(1, 2.2), rand(3, 6)), trim);
      gb.position.set(rand(-28, 28), 5.6, rand(-8, 12));
      this.group.add(gb);
    }
    for (const s of [1, -1]) {
      const pylon = new THREE.Mesh(new THREE.BoxGeometry(16, 4, 44), trim);
      pylon.position.set(s * 40, -2, 4);
      pylon.rotation.y = s * 0.16;
      this.group.add(pylon);
      const engGlow = glowSprite(0xff6a3e, 7);
      engGlow.position.set(s * 40, -2, 27);
      this.group.add(engGlow);
    }
    // pulsing hull running-lights
    for (const s of [1, -1]) { this.addAccent(new THREE.Vector3(s * 20, 6, -4), 0x8f5cff, 2.2, 4); this.addAccent(new THREE.Vector3(s * 34, -1, -10), 0xff6a3e, 1.8, 3.2); }
    this.addAccent(new THREE.Vector3(0, 9, 9), 0x59e6f6, 2.0, 5);
    this.turrets = [
      this.addWeak(new THREE.Vector3(24, 7, -6), 3.2, 22, 0xffa040),
      this.addWeak(new THREE.Vector3(-24, 7, -6), 3.2, 22, 0xffa040),
      this.addWeak(new THREE.Vector3(40, 1.5, -14), 3.2, 22, 0xffa040),
      this.addWeak(new THREE.Vector3(-40, 1.5, -14), 3.2, 22, 0xffa040),
    ];
    this.core = this.addWeak(new THREE.Vector3(0, -1, -26), 5.2, 90, 0x8f5cff);
    this.core.active = false;
    this.bodyRadius = 34;
    this.group.position.set(0, 30, -680);
    this.fireCd = 2.2; this.ringCd = 4; this.droneCd = 7;
    this.phase = 1;
    scaleBoss(this, 1.9);
    this._modelKey = 'dread'; this._modelOpts = { rotY: Math.PI };
    addBossHardware(this, 'dread', 0x8f5cff, 0x252a3d);
  }
  update(ctx) {
    super.update(ctx);
    const { dt, player, proj, game } = ctx;
    const p = this.group.position;
    // dreadnought: ponderous but deliberate lunges forward and broadside strafes
    const aggro = this.phase === 3 ? 1.35 : this.phase === 2 ? 1.1 : 0.9;
    this._maneuver(dt, player, { xRange: 86, yBase: 34, yRange: 18, zNear: -175, zFar: -360, speed: aggro });
    this.group.rotation.z = damp(this.group.rotation.z, Math.cos(this.time * 0.3) * 0.05, 2, dt);

    const turretsLeft = this.turrets.filter((t) => t.alive).length;
    if (turretsLeft === 0 && this.phase === 1) {
      this.phase = 2;
      this.core.active = true;
      this._phaseBurst(game, 0x9d72ff, 1.28);
      game.bossPhase('SHIELD DOWN — HIT THE CORE!');
    }
    if (this.phase === 2 && this.hp < this.maxHp * 0.35) {
      this.phase = 3;
      this._phaseBurst(game, 0xff8a52, 1.48);
      game.bossPhase('FINAL FURY!');
    }

    this.fireCd -= dt;
    if (this.fireCd <= 0) {
      this.fireCd = this.phase === 3 ? 0.9 : 1.6;
      const live = this.turrets.filter((t) => t.alive);
      if (live.length) {
        for (const t of live.slice(0, 2)) {
          t.worldPos(_v2);
          _v1.set(player.x, player.y, PLAYER_Z).sub(_v2).normalize().multiplyScalar(72);
          this._broadsideFx(game, _v2, 0xffa85a, 0.95);
          proj.fireEnemy(_v2.clone(), _v1.clone(), 0xffa040);
        }
      } else {
        // core spreads
        this.core.worldPos(_v2);
        for (let k = -2; k <= 2; k++) {
          _v1.set(player.x + k * 12, player.y + rand(-5, 5), PLAYER_Z).sub(_v2).normalize().multiplyScalar(80);
          proj.fireEnemy(_v2.clone(), _v1.clone(), 0x8f5cff);
        }
      }
      // pylon missile volleys from phase 2; flak barrage in the final fury
      if (this.phase >= 2 && Math.random() < 0.4) for (const s of [1, -1]) {
        _v2.copy(p); _v2.x += s * 40; _v2.y -= 2;
        _v1.set(player.x, player.y, PLAYER_Z).sub(_v2);
        proj.fireEnemy(_v2.clone(), _v1.clone(), 'missile');
      }
      if (this.phase === 3 && Math.random() < 0.5) {
        _v1.set(player.x, player.y, PLAYER_Z).sub(p);
        proj.fireEnemy(p.clone(), _v1.clone(), 'flak');
      }
    }
    this.ringCd -= dt;
    if (this.ringCd <= 0 && this.phase >= 2) {
      this.ringCd = this.phase === 3 ? 2.6 : 4;
      this.core.worldPos(_v2);
      const n = this.phase === 3 ? 12 : 8;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * TAU + this.time * 0.7;
        _v1.set(Math.cos(a) * 34, Math.sin(a) * 34, 36);
        proj.fireEnemy(_v2.clone(), _v1.clone(), 0x8f5cff);
      }
    }
    this.droneCd -= dt;
    if (this.droneCd <= 0 && this.phase >= 2) {
      this.droneCd = this.phase === 3 ? 6 : 9;
      game.enemies.formation('drone', 3, 'vee', { y: 22, z: -500 });
    }
  }
}

/* ================= WAVE 14 — OBSIDIAN MATRIARCH (ember) ================= */
export class ObsidianMatriarch extends BossBase {
  constructor(scene) {
    super(scene, 'OBSIDIAN MATRIARCH', 320);
    this.phaseCount = 3;
    const hull = toonMat(0x302544, { flat: true });
    const trim = toonMat(0x1a1830, { flat: true });
    const body = new THREE.Mesh(new THREE.BoxGeometry(72, 12, 38), hull); this.group.add(body);
    const keel = new THREE.Mesh(new THREE.ConeGeometry(12, 34, 4), hull); keel.rotation.x = -Math.PI / 2; keel.position.z = -31; this.group.add(keel);
    for (const s of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(26, 3.5, 42), trim); wing.position.set(s * 38, 0, 5); wing.rotation.y = s * 0.17; this.group.add(wing);
      this.addAccent(new THREE.Vector3(s * 34, 0, 21), 0xa878ff, 3.4, 4.6);
    }
    this.turrets = [
      this.addWeak(new THREE.Vector3(-28, 8, -10), 3.5, 26, 0xff7c5c),
      this.addWeak(new THREE.Vector3(28, 8, -10), 3.5, 26, 0xff7c5c),
      this.addWeak(new THREE.Vector3(-40, 1, 8), 3.2, 24, 0xff7c5c),
      this.addWeak(new THREE.Vector3(40, 1, 8), 3.2, 24, 0xff7c5c),
    ];
    this.core = this.addWeak(new THREE.Vector3(0, 3, -20), 6.0, 104, 0xa878ff);
    this.core.active = false;
    this.bodyRadius = 38;
    this.group.position.set(0, 38, -700);
    this.fireCd = 1.8; this.spawnCd = 7.5; this.phase = 1;
    scaleBoss(this, 1.65);
    this._modelKey = 'matriarch'; this._modelOpts = { rotY: Math.PI };
    addBossHardware(this, 'matriarch', 0xa878ff, 0x1a1830);
  }
  update(ctx) {
    super.update(ctx);
    const { dt, player, proj, game } = ctx;
    const p = this.group.position;
    this._maneuver(dt, player, { xRange: 92, yBase: 40, yRange: 18, zNear: -175, zFar: -370, speed: this.phase === 3 ? 1.3 : 0.92 });
    const live = this.turrets.filter((t) => t.alive);
    if (live.length === 0 && this.phase === 1) { this.phase = 2; this.core.active = true; this._phaseBurst(game, 0xa878ff, 1.28); game.bossPhase('REACTOR EXPOSED!'); }
    if (this.phase === 2 && this.hp < this.maxHp * 0.34) { this.phase = 3; this._phaseBurst(game, 0xff825e, 1.48); game.bossPhase('MATRIARCH OVERDRIVE!'); }
    this.fireCd -= dt;
    if (this.fireCd <= 0) {
      this.fireCd = this.phase === 3 ? 0.82 : 1.45;
      if (live.length) {
        for (const t of live.slice(0, this.phase === 3 ? 3 : 2)) {
          t.worldPos(_v2); _v1.set(player.x, player.y, PLAYER_Z).sub(_v2).normalize().multiplyScalar(76);
          this._broadsideFx(game, _v2, 0xff7c5c, 0.98);
          proj.fireEnemy(_v2.clone(), _v1.clone(), 'heavy');
        }
      } else {
        this.core.worldPos(_v2);
        for (let k = -2; k <= 2; k++) { _v1.set(player.x + k * 15, player.y + rand(-6, 6), PLAYER_Z).sub(_v2); proj.fireEnemy(_v2.clone(), _v1.clone(), 'plasma'); }
      }
      if (this.phase >= 2 && Math.random() < 0.5) for (const s of [-1, 1]) {
        _v2.copy(p); _v2.x += s * 34; _v1.set(player.x, player.y, PLAYER_Z).sub(_v2); proj.fireEnemy(_v2.clone(), _v1.clone(), 'missile');
      }
    }
    this.spawnCd -= dt;
    if (this.spawnCd <= 0 && this.phase >= 2) {
      this.spawnCd = this.phase === 3 ? 5.5 : 8.5;
      game.enemies.formation('phantom', this.phase === 3 ? 3 : 2, 'sides', { y: 48, z: -520, noScale: true });
    }
  }
}

/* ================= WAVE 16 — RIFT HARBINGER (dune) ================= */
export class RiftHarbinger extends BossBase {
  constructor(scene) {
    super(scene, 'RIFT HARBINGER', 390);
    this.phaseCount = 3;
    const shell = toonMat(0x253047, { flat: true });
    const coreMat = toonMat(0x141b2d, { emissive: 0x62d8ff, emissiveIntensity: 0.85, flat: true });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(34, 4.2, 8, 32), shell); ring.position.y = 10; this.group.add(ring);
    const core = new THREE.Mesh(new THREE.SphereGeometry(10, 12, 8), coreMat); core.position.set(0, 10, 0); this.group.add(core);
    this.pylons = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + Math.PI * 0.25;
      const x = Math.cos(a) * 31, y = 10 + Math.sin(a) * 27;
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.6, 20, 7), shell); mast.position.set(x, y, 0); this.group.add(mast);
      this.pylons.push(this.addWeak(new THREE.Vector3(x, y, -6), 3.9, 32, 0x62d8ff));
      this.addAccent(new THREE.Vector3(x, y, 2), 0x62d8ff, 2.5, 5.2 + i);
    }
    this.core = this.addWeak(new THREE.Vector3(0, 10, -10), 7.0, 126, 0xffd26b);
    this.core.active = false;
    this.bodyRadius = 42;
    this.group.position.set(0, 38, -740);
    this.fireCd = 1.7; this.ringCd = 4.5; this.spawnCd = 7.0; this.phase = 1;
    scaleBoss(this, 1.45);
    this._modelKey = 'harbinger'; this._modelOpts = {};
    addBossHardware(this, 'harbinger', 0x62d8ff, 0x17243a);
  }
  update(ctx) {
    super.update(ctx);
    const { dt, player, proj, game } = ctx;
    const p = this.group.position;
    this._maneuver(dt, player, { xRange: 68, yBase: 40, yRange: 12, zNear: -185, zFar: -365, speed: this.phase === 3 ? 1.15 : 0.78, bank: false });
    this.group.rotation.y += dt * (this.phase === 3 ? 0.32 : 0.18);
    const live = this.pylons.filter((w) => w.alive);
    if (live.length === 0 && this.phase === 1) { this.phase = 2; this.core.active = true; this._phaseBurst(game, 0x62d8ff, 1.32); game.bossPhase('RIFT CORE EXPOSED!'); }
    if (this.phase === 2 && this.hp < this.maxHp * 0.30) { this.phase = 3; this._phaseBurst(game, 0xffd26b, 1.52); game.bossPhase('SINGULARITY BREACH!'); }
    this.fireCd -= dt;
    if (this.fireCd <= 0) {
      this.fireCd = this.phase === 3 ? 0.75 : 1.35;
      if (live.length) {
        for (const w of live.slice(0, this.phase === 3 ? 3 : 2)) {
          w.worldPos(_v2); _v1.set(player.x, player.y, PLAYER_Z).sub(_v2).normalize().multiplyScalar(74);
          this._broadsideFx(game, _v2, this.phase === 3 ? 0xa6ff73 : 0x62d8ff, 0.92);
          proj.fireEnemy(_v2.clone(), _v1.clone(), this.phase === 3 ? 'venom' : 'bolt');
        }
      } else {
        this.core.worldPos(_v2);
        for (let k = -2; k <= 2; k++) { _v1.set(player.x + k * 18, player.y + rand(-7, 7), PLAYER_Z).sub(_v2); proj.fireEnemy(_v2.clone(), _v1.clone(), 'wave'); }
      }
    }
    this.ringCd -= dt;
    if (this.ringCd <= 0 && this.phase >= 2) {
      this.ringCd = this.phase === 3 ? 2.3 : 4.0;
      this.core.worldPos(_v2);
      const n = this.phase === 3 ? 14 : 9;
      for (let k = 0; k < n; k++) { const a = (k / n) * TAU + this.time * 0.5; _v1.set(Math.cos(a) * 38, Math.sin(a) * 38, 42); proj.fireEnemy(_v2.clone(), _v1.clone(), 'plasma'); }
    }
    this.spawnCd -= dt;
    if (this.spawnCd <= 0 && this.phase >= 2) {
      this.spawnCd = this.phase === 3 ? 5 : 8;
      game.enemies.formation(this.phase === 3 ? 'harrier' : 'phantom', this.phase === 3 ? 3 : 2, 'vee', { y: 42, z: -520, noScale: true });
    }
  }
}

export const BOSS_BY_WAVE = { 3: TempestRay, 6: CascadeWarden, 9: EmberSerpent, 12: DreadSovereign, 14: ObsidianMatriarch, 16: RiftHarbinger };
