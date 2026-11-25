import * as THREE from 'three';
import { dotTexture, toonMat, _v1 } from '../core/util.js';
import { audio } from '../core/audio.js';

const LASER_SPEED = 520;
const MAXL = 72, MAXE = 380, MAXC = 14, MAXB = 3, MAXAL = 48;

/**
 * Enemy bullet presets — each has a distinct 3D shape, colour, size, base
 * speed, hit radius and behaviour. `shape` drives which sub-meshes light up
 * on the pooled bullet: orb (glow ball), bolt (tracer), shell (heavy round),
 * ring (energy pulse), missile (finned + trail), spike (jagged dart).
 */
export const BULLET = {
  // Tuned for close-quarters dogfights: brisk enough to outpace ships, readable & sculpted to dodge/deflect!
  orb:       { core: 0xffd27a, halo: 0xff5a1e, size: 3.0, r: 0.9,  speed: 84,  shape: 'orb' },
  bolt:      { core: 0xeaffff, halo: 0x59c6ff, size: 2.8, r: 0.7,  speed: 124, shape: 'bolt' },
  heavy:     { core: 0xffe6b0, halo: 0xff5020, size: 4.3, r: 1.9,  speed: 82,  shape: 'shell' },
  plasma:    { core: 0xffe0f5, halo: 0xff3d8f, size: 3.5, r: 1.1,  speed: 88,  shape: 'ring' },
  homing:    { core: 0xdcffe4, halo: 0x54ff9e, size: 3.5, r: 1.0,  speed: 78,  shape: 'missile', homing: true, turnRate: 1.85, trail: 0x54ff9e },
  venom:     { core: 0xecffb4, halo: 0x9be23a, size: 3.4, r: 1.1,  speed: 92,  shape: 'spike' },
  missile:   { core: 0xffe6c0, halo: 0xff7a3a, size: 3.8, r: 1.1,  speed: 82,  shape: 'missile', homing: true, turnRate: 1.75, trail: 0xff7a3a },
  swarm:     { core: 0xfff0c8, halo: 0xff3e62, size: 3.6, r: 1.0,  speed: 88,  shape: 'missile', homing: true, turnRate: 2.45, trail: 0xff5270 },
  torpedo:   { core: 0xdcf8ff, halo: 0x38d8ff, size: 4.4, r: 1.3,  speed: 86,  shape: 'missile', homing: true, turnRate: 2.10, trail: 0x62e8ff },
  pursuit:   { core: 0xf4dcff, halo: 0xc262ff, size: 4.4, r: 1.25, speed: 74,  shape: 'ring',    homing: true, turnRate: 2.75, trail: 0xc262ff },
  cluster:   { core: 0xfff2c2, halo: 0xff4628, size: 5.0, r: 2.0,  speed: 78,  shape: 'shell',   splitTime: 0.78, shootable: true, trail: 0xff6a32 },
  spiral:    { core: 0xd8fff2, halo: 0x26f5c2, size: 3.8, r: 1.05, speed: 88,  shape: 'ring',    helixR: 6.2, helixFreq: 8.8, trail: 0x38f6d2 },
  rail:      { core: 0xffffff, halo: 0x4ad4ff, size: 4.4, r: 0.85, speed: 192, shape: 'bolt',    trail: 0x6ce8ff },
  mortar:    { core: 0xffe4a8, halo: 0xff6e24, size: 4.6, r: 1.75, speed: 92,  shape: 'shell',   gravity: -56, trail: 0xff8438 },
  boomerang: { core: 0xffe2ff, halo: 0xe048ff, size: 4.4, r: 1.25, speed: 96,  shape: 'ring',    trail: 0xe664ff },
  flak:      { core: 0xffefc0, halo: 0xffb030, size: 4.6, r: 2.3,  speed: 80,  shape: 'shell' },
  wave:      { core: 0xdcecff, halo: 0x6a9bff, size: 5.0, r: 2.1,  speed: 82,  shape: 'ring' },
  superwave: { core: 0xfff4d0, halo: 0xff9e38, size: 6.8, r: 2.6,  speed: 96,  shape: 'ring' },
  shard:     { core: 0xf4f9ff, halo: 0x8fd0ff, size: 2.8, r: 0.7,  speed: 140, shape: 'spike' },
};

const ELONGATED = new Set(['orb', 'bolt', 'shell', 'missile', 'spike']);

function glowSprite(color, size) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: dotTexture(), color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  s.scale.setScalar(size);
  return s;
}

export class Projectiles {
  constructor(scene) {
    this.scene = scene;
    this._laserHead = 0;
    this._alaserHead = 0;
    this._ebulletHead = 0;

    /* player lasers — sculpted tapered energy lance: pointed spearhead, hot core, faceted outer sheath & twin field rings */
    this.lasers = [];
    const boltGeo = new THREE.CapsuleGeometry(0.24, 5.4, 3, 6);
    boltGeo.rotateX(Math.PI / 2);
    const noseGeo = new THREE.ConeGeometry(0.46, 2.2, 6);
    noseGeo.rotateX(-Math.PI / 2);
    const sheathGeo = new THREE.CylinderGeometry(0.32, 0.70, 6.2, 6, 1, true);
    sheathGeo.rotateX(Math.PI / 2);
    const railGeo = new THREE.TorusGeometry(0.84, 0.085, 5, 12);
    for (let i = 0; i < MAXL; i++) {
      const g = new THREE.Group();
      const core = new THREE.Mesh(boltGeo, new THREE.MeshBasicMaterial({ color: 0xf4fff8, fog: false }));
      const nose = new THREE.Mesh(noseGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, transparent: true, opacity: 0.92, blending: THREE.AdditiveBlending, depthWrite: false }));
      nose.position.z = -3.4;
      const sheath = new THREE.Mesh(sheathGeo, new THREE.MeshBasicMaterial({ color: 0x54ff9e, fog: false, transparent: true, opacity: 0.54, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      const halo = glowSprite(0x54ff9e, 3.4);
      halo.position.z = -2.6;
      const rail = new THREE.Mesh(railGeo, new THREE.MeshBasicMaterial({ color: 0x54ff9e, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
      rail.position.z = -0.8;
      rail.visible = false;
      const rail2 = new THREE.Mesh(railGeo, new THREE.MeshBasicMaterial({ color: 0xbffeff, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false }));
      rail2.position.z = 1.4;
      rail2.visible = false;
      g.add(core, nose, sheath, halo, rail, rail2);
      g.visible = false;
      scene.add(g);
      this.lasers.push({ mesh: g, core, nose, sheath, halo, rail, rail2, level: 1, style: null, active: false, vel: new THREE.Vector3(), life: 0, dmg: 1 });
    }

    /* wingmate (ally) lasers — team-coloured supporting energy lances */
    this.alasers = [];
    const aboltGeo = new THREE.CapsuleGeometry(0.18, 3.4, 3, 6);
    aboltGeo.rotateX(Math.PI / 2);
    const asheathGeo = new THREE.CylinderGeometry(0.24, 0.48, 4.0, 6, 1, true);
    asheathGeo.rotateX(Math.PI / 2);
    for (let i = 0; i < MAXAL; i++) {
      const g = new THREE.Group();
      const core = new THREE.Mesh(aboltGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }));
      const sheath = new THREE.Mesh(asheathGeo, new THREE.MeshBasicMaterial({ color: 0x66d9ff, fog: false, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      const halo = glowSprite(0x66d9ff, 2.5);
      halo.position.z = -1.5;
      g.add(core, sheath, halo);
      g.visible = false;
      scene.add(g);
      this.alasers.push({ mesh: g, core, sheath, halo, active: false, vel: new THREE.Vector3(), life: 0, dmg: 1 });
    }

    /* charge shots — gyroscopic plasma singularity with twin counter-rotating energy rings */
    this.charges = [];
    const cCoreGeo = new THREE.IcosahedronGeometry(0.98, 1);
    const cGyroGeo = new THREE.TorusGeometry(1.75, 0.16, 6, 18);
    for (let i = 0; i < MAXC; i++) {
      const g = new THREE.Group();
      const orb = new THREE.Mesh(cCoreGeo, new THREE.MeshBasicMaterial({ color: 0xe8fbff, fog: false }));
      const halo = glowSprite(0x59c6ff, 7.6);
      const gyroA = new THREE.Mesh(cGyroGeo, new THREE.MeshBasicMaterial({ color: 0x70ecff, fog: false, transparent: true, opacity: 0.88, blending: THREE.AdditiveBlending, depthWrite: false }));
      const gyroB = new THREE.Mesh(cGyroGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false }));
      gyroB.rotation.x = Math.PI / 2;
      gyroB.scale.setScalar(0.80);
      g.add(orb, halo, gyroA, gyroB);
      g.visible = false;
      scene.add(g);
      this.charges.push({ mesh: g, orb, halo, gyroA, gyroB, active: false, vel: new THREE.Vector3(), target: null, life: 0, trailCd: 0, dmgMul: 1, radMul: 1, trailCol: 0x62d8ff });
    }

    /* bombs — a spinning finned warhead with glowing plasma collar & hot core */
    this.bombs = [];
    for (let i = 0; i < MAXB; i++) {
      const g = new THREE.Group();
      const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(1.38, 1), toonMat(0xc9cdd6, { emissive: 0xff7030, emissiveIntensity: 0.55, flat: true }));
      const bandGeo = new THREE.TorusGeometry(1.35, 0.28, 6, 14);
      const band = new THREE.Mesh(bandGeo, toonMat(0xd83a2a, { emissive: 0xff4020, emissiveIntensity: 0.95, flat: true }));
      const band2 = new THREE.Mesh(bandGeo, new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false }));
      band2.rotation.y = Math.PI / 2;
      band2.scale.setScalar(1.18);
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.64, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff0c0, fog: false }));
      const fins = new THREE.Group();
      for (let f = 0; f < 4; f++) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.15, 0.75), toonMat(0xd83a2a, { flat: true }));
        fin.position.set(Math.cos(f * Math.PI / 2) * 1.25, 0, Math.sin(f * Math.PI / 2) * 1.25);
        fin.lookAt(0, 0, 0);
        fins.add(fin);
      }
      const halo = glowSprite(0xffb060, 5.6);
      g.add(shell, band, band2, core, fins, halo);
      g.visible = false;
      scene.add(g);
      this.bombs.push({ mesh: g, spinner: g, core, halo, active: false, vel: new THREE.Vector3(), fuse: 0 });
    }

    /* enemy bullets — precision-sculpted pooled ordnance (orb/bolt/armoured shell/dual plasma ring/finned missile/crystal dart) */
    this.ebullets = [];
    const eCoreGeo = new THREE.OctahedronGeometry(0.58, 1);
    const eShellGeo = new THREE.CapsuleGeometry(0.35, 1.6, 4, 8); eShellGeo.rotateX(Math.PI / 2);
    const eCollarGeo = new THREE.TorusGeometry(0.58, 0.13, 5, 12);
    const eSpikeGeo = new THREE.ConeGeometry(0.46, 2.7, 4); eSpikeGeo.rotateX(-Math.PI / 2);
    const eRingGeo = new THREE.TorusGeometry(0.84, 0.16, 6, 18);
    const eFinGeo = new THREE.BoxGeometry(0.10, 0.85, 0.62);
    const eExhaustGeo = new THREE.ConeGeometry(0.28, 1.45, 6); eExhaustGeo.rotateX(Math.PI / 2);
    for (let i = 0; i < MAXE; i++) {
      const g = new THREE.Group();
      const core = new THREE.Mesh(eCoreGeo, new THREE.MeshBasicMaterial({ color: 0xfff0d0, fog: false }));
      const shell = new THREE.Mesh(eShellGeo, new THREE.MeshBasicMaterial({ color: 0xffe6b0, fog: false })); shell.visible = false;
      const collar = new THREE.Mesh(eCollarGeo, new THREE.MeshBasicMaterial({ color: 0xff6a30, fog: false, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })); collar.visible = false;
      const spike = new THREE.Mesh(eSpikeGeo, new THREE.MeshBasicMaterial({ color: 0xecffb4, fog: false })); spike.visible = false;
      const ring = new THREE.Mesh(eRingGeo, new THREE.MeshBasicMaterial({ color: 0xff3d8f, fog: false, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })); ring.visible = false;
      const ring2 = new THREE.Mesh(eRingGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false })); ring2.visible = false;
      ring2.rotation.y = Math.PI / 2;
      const fins = new THREE.Group();
      for (let f = 0; f < 4; f++) {
        const fin = new THREE.Mesh(eFinGeo, new THREE.MeshBasicMaterial({ color: 0x4b586a, fog: false }));
        fin.rotation.z = (f / 4) * Math.PI * 2;
        fin.position.z = 0.85;
        fins.add(fin);
      }
      const exhaust = new THREE.Mesh(eExhaustGeo, new THREE.MeshBasicMaterial({ color: 0xffa64a, fog: false, transparent: true, opacity: 0.88, blending: THREE.AdditiveBlending, depthWrite: false }));
      exhaust.position.z = 1.65;
      fins.add(exhaust);
      fins.visible = false;
      const halo = glowSprite(0xff9040, 3.4);
      const trail = glowSprite(0xff7a3a, 2.8); trail.visible = false; trail.position.z = 1.7;
      g.add(core, shell, collar, spike, ring, ring2, fins, halo, trail);
      g.visible = false;
      scene.add(g);
      this.ebullets.push({ mesh: g, core, shell, collar, spike, ring, ring2, fins, exhaust, halo, trail, active: false, vel: new THREE.Vector3(), life: 0, age: 0, trailCd: 0, deflected: false, radius: 0.9, homing: false, shootable: false, spin: false, shape: 'orb', btype: 'orb', targetWingmate: null, splitT: 0, helixR: 0, helixFreq: 0, helixPhase: 0, gravity: 0, curveX: 0 });
    }
  }

  _alloc(pool, headKey) {
    const len = pool.length;
    const start = this[headKey] % len;
    for (let k = 0; k < len; k++) {
      const idx = (start + k) % len;
      if (!pool[idx].active) {
        this[headKey] = (idx + 1) % len;
        return pool[idx];
      }
    }
    return null;
  }

  fireLaser(from, toward, dmg, level, style = null) {
    const b = this._alloc(this.lasers, '_laserHead');
    if (!b) return null;
    b.active = true; b.mesh.visible = true;
    b.mesh.position.copy(from);
    b.vel.copy(toward).sub(from).normalize().multiplyScalar(LASER_SPEED);
    b.mesh.lookAt(_v1.copy(from).add(b.vel));
    // Tuned engagement range (~365 units) keeps combat excitingly close-up!
    b.life = level >= 4 ? 0.78 : 0.70;
    b.dmg = dmg;
    b.style = style;
    const isCrimson = style === 'crimson';
    const isOverdrive = style === 'overdrive';
    const isPlasma = level >= 4;
    const col = isOverdrive ? 0xffe466 : isCrimson ? 0xff4e76 : isPlasma ? 0xffc844 : level >= 3 ? 0x59c6ff : 0x54ff9e;
    const ring2Col = isOverdrive ? 0x72f8ff : isCrimson ? 0xffe288 : isPlasma ? 0x64f2ff : 0xd2f7ff;
    b.halo.material.color.set(col);
    b.halo.scale.setScalar(isPlasma || isOverdrive ? 4.4 : 3.4);
    b.sheath.material.color.set(col);
    b.nose.material.color.set(isPlasma || isOverdrive ? 0xfff8d6 : isCrimson ? 0xffdbe4 : level >= 3 ? 0xd8f5ff : 0xe8fff2);
    b.core.material.color.set(isPlasma || isOverdrive ? 0xfffdf0 : isCrimson ? 0xffeef2 : level >= 3 ? 0xe8f8ff : 0xf4fff8);
    b.level = level;
    b.rail.visible = level >= 2 || isOverdrive || isCrimson;
    b.rail.material.color.set(col);
    b.rail.scale.setScalar(isPlasma || isOverdrive ? 1.62 : level >= 3 ? 1.38 : 1.0);
    b.rail.material.opacity = level >= 3 || isOverdrive ? 0.96 : 0.74;
    b.rail2.visible = level >= 3 || isOverdrive || isCrimson;
    b.rail2.material.color.set(ring2Col);
    b.rail2.scale.setScalar(isPlasma || isOverdrive ? 1.35 : 1.12);
    const sw = isPlasma || isOverdrive ? 1.44 : level >= 3 ? 1.24 : level === 2 ? 1.08 : 0.96;
    const sl = isPlasma || isOverdrive ? 1.34 : level >= 3 ? 1.18 : 1.0;
    b.sheath.scale.set(sw, sw, sl);
    return b;
  }

  /** ally supporting laser — flies from a wingmate toward `toward` */
  fireAlly(from, toward, color = 0x66d9ff) {
    const b = this._alloc(this.alasers, '_alaserHead');
    if (!b) return null;
    b.active = true; b.mesh.visible = true;
    b.mesh.position.copy(from);
    b.vel.copy(toward).sub(from).normalize().multiplyScalar(520);
    b.mesh.lookAt(_v1.copy(from).add(b.vel));
    b.life = 1.2;
    b.dmg = 1;
    b.halo.material.color.set(color);
    b.sheath.material.color.set(color);
    return b;
  }

  fireCharge(from, target, vx = 0, vy = 0, opts = null) {
    const c = this.charges.find((l) => !l.active);
    if (!c) return null;
    c.active = true; c.mesh.visible = true;
    c.mesh.position.copy(from);
    c.vel.set(vx, vy, -320);
    c.target = target;
    c.life = 2.5;
    c.trailCd = 0;
    c.dmgMul = opts?.dmgMul ?? 1;
    c.radMul = opts?.radMul ?? 1;
    const col = opts?.crimson ? 0xff5a80 : opts?.overdrive ? 0xffe268 : 0x59c6ff;
    c.trailCol = col;
    c.halo.material.color.set(col);
    c.gyroA.material.color.set(opts?.crimson ? 0xff92a8 : opts?.overdrive ? 0xfff0a0 : 0x70ecff);
    c.mesh.scale.setScalar(0.95 + (c.radMul - 1) * 0.55);
    return c;
  }

  fireBomb(from) {
    const b = this.bombs.find((l) => !l.active);
    if (!b) return null;
    b.active = true; b.mesh.visible = true;
    b.mesh.position.copy(from);
    b.vel.set(0, 1.8, -145);
    b.fuse = 2.1;   // wider window to press B again for a manual big detonation
    return b;
  }

  /**
   * Fire an enemy bullet. `dir` is a direction (any length); the preset's speed
   * is applied unless `speedOverride` is given. `type` selects a BULLET preset.
   */
  fireEnemy(from, dir, type = 'orb', speedOverride = null, targetWingmate = null, extra = null) {
    const b = this._alloc(this.ebullets, '_ebulletHead');
    if (!b) return null;
    const legacyColor = typeof type === 'number' ? type : null;   // bosses pass a raw colour
    const key = legacyColor !== null ? 'orb' : (typeof type === 'string' && BULLET[type] ? type : 'orb');
    const T = BULLET[key];
    const shape = legacyColor !== null ? 'orb' : T.shape;

    b.active = true; b.mesh.visible = true; b.deflected = false;
    b.btype = key; b.shape = shape; b.targetWingmate = targetWingmate;
    b.age = 0;
    b.mesh.position.copy(from);
    const spd = speedOverride ?? (legacyColor !== null ? dir.length() : T.speed);
    b.vel.copy(dir).normalize().multiplyScalar(spd);

    const coreCol = legacyColor !== null ? 0xffdcae : T.core;
    const haloCol = legacyColor ?? T.halo;
    b.halo.material.color.set(haloCol);
    b.halo.scale.setScalar(T.size);
    b.core.material.color.set(coreCol);

    // reset all shape sub-meshes, then light up the sculpted ordnance for this round
    b.shell.visible = b.collar.visible = b.spike.visible = b.ring.visible = b.ring2.visible = b.fins.visible = b.trail.visible = false;
    b.mesh.rotation.set(0, 0, 0);
    b.trailCd = 0;
    const elong = ELONGATED.has(shape);
    if (elong) b.mesh.lookAt(_v1.copy(from).add(b.vel));

    if (shape === 'orb') {
      b.core.scale.setScalar(0.88);
      b.shell.visible = true; b.shell.scale.set(0.85, 0.85, 1.85); b.shell.material.color.set(coreCol);
      b.collar.visible = true; b.collar.scale.setScalar(1.0); b.collar.material.color.set(haloCol);
    } else if (shape === 'bolt') {
      const isRail = key === 'rail';
      b.core.scale.setScalar(isRail ? 0.92 : 0.68);
      b.shell.visible = true; b.shell.scale.set(isRail ? 0.62 : 0.46, isRail ? 0.62 : 0.46, isRail ? 4.4 : 2.35); b.shell.material.color.set(coreCol);
      b.ring.visible = true; b.ring.scale.setScalar(isRail ? 1.15 : 0.68); b.ring.material.color.set(haloCol);
      if (isRail) { b.ring2.visible = true; b.ring2.scale.setScalar(0.88); b.ring2.material.color.set(coreCol); }
    } else if (shape === 'shell') {
      b.core.scale.setScalar(1.45);
      b.shell.visible = true; b.shell.scale.set(1.65, 1.65, 1.95); b.shell.material.color.set(coreCol);
      b.collar.visible = true; b.collar.scale.setScalar(1.75); b.collar.material.color.set(haloCol);
    } else if (shape === 'ring') {
      b.core.scale.setScalar(1.05);
      b.ring.visible = true; b.ring.scale.setScalar(T.size * 0.42); b.ring.material.color.set(haloCol);
      b.ring2.visible = true; b.ring2.scale.setScalar(T.size * 0.34); b.ring2.material.color.set(coreCol);
    } else if (shape === 'missile') {
      b.core.scale.setScalar(0.65);
      b.shell.visible = true; b.shell.scale.set(0.72, 0.72, 2.5); b.shell.material.color.set(coreCol);
      b.collar.visible = true; b.collar.scale.setScalar(0.85); b.collar.material.color.set(haloCol);
      b.fins.visible = true;
      b.exhaust.material.color.set(T.trail ?? haloCol);
      b.trail.visible = true; b.trail.material.color.set(T.trail ?? haloCol); b.trail.scale.setScalar(T.size * 0.82);
    } else if (shape === 'spike') {
      b.core.scale.setScalar(0.52);
      b.spike.visible = true; b.spike.scale.set(0.88, 0.88, 1.22); b.spike.material.color.set(coreCol);
      b.ring.visible = true; b.ring.scale.setScalar(0.66); b.ring.material.color.set(haloCol);
    }
    // glowing tracer trail behind elongated rounds (missile sets its own above)
    if (elong && shape !== 'missile') {
      b.trail.visible = true;
      b.trail.material.color.set(shape === 'shell' ? haloCol : coreCol);
      b.trail.scale.setScalar(T.size * (shape === 'shell' ? 0.78 : 0.52));
      b.trail.position.z = 1.6;
    }

    b.radius = legacyColor !== null ? 0.9 : T.r;
    b.homing = legacyColor === null && !!T.homing;
    b.shootable = legacyColor === null && !!(T.homing || T.shootable);
    b.splitT = legacyColor === null ? (extra?.splitT ?? T.splitTime ?? 0) : 0;
    b.helixR = legacyColor === null ? (extra?.helixR ?? T.helixR ?? 0) : 0;
    b.helixFreq = legacyColor === null ? (extra?.helixFreq ?? T.helixFreq ?? 0) : 0;
    b.helixPhase = extra?.helixPhase ?? 0;
    b.gravity = legacyColor === null ? (extra?.gravity ?? T.gravity ?? 0) : 0;
    b.curveX = extra?.curveX ?? 0;
    b.spin = shape === 'orb' || shape === 'ring' || shape === 'spike';
    b.life = 8;
    audio.enemyFire(key);   // throttled inside audio so a volley = one report
    return b;
  }

  clearEnemyBullets(cb) {
    for (const b of this.ebullets) {
      if (b.active) { cb?.(b.mesh.position); b.active = false; b.mesh.visible = false; b.targetWingmate = null; }
    }
  }

  update(dt, scroll, player, particles = null) {
    for (const b of this.lasers) {
      if (!b.active) continue;
      b.mesh.position.addScaledVector(b.vel, dt);
      if (b.rail.visible) {
        b.rail.rotation.z += dt * (b.level >= 3 ? 20 : 12);
        const base = b.level >= 3 ? 1.38 : 1.0;
        const pulse = 1 + Math.sin((b.life * 20) + b.mesh.position.z * 0.06) * 0.10;
        b.rail.scale.setScalar(base * pulse);
      }
      if (b.rail2.visible) {
        b.rail2.rotation.z -= dt * 16;
        if (particles?.missileTrail && Math.random() < 0.35) {
          const tCol = b.style === 'overdrive' ? 0xffe268 : b.style === 'crimson' ? 0xff5a80 : b.level >= 4 ? 0xffcc55 : 0x62dcff;
          particles.missileTrail(b.mesh.position.x, b.mesh.position.y, b.mesh.position.z + 2.2, tCol, true);
        }
      }
      b.life -= dt;
      if (b.life <= 0 || b.mesh.position.z < -900) { b.active = false; b.mesh.visible = false; }
    }
    for (const b of this.alasers) {
      if (!b.active) continue;
      b.mesh.position.addScaledVector(b.vel, dt);
      b.life -= dt;
      if (b.life <= 0 || b.mesh.position.z < -900) { b.active = false; b.mesh.visible = false; }
    }
    const now = performance.now();
    for (const c of this.charges) {
      if (!c.active) continue;
      if (c.target && c.target.alive) {
        _v1.copy(c.target.pos()).sub(c.mesh.position).normalize().multiplyScalar(350);
        c.vel.lerp(_v1, Math.min(1, dt * 8));
      }
      c.mesh.position.addScaledVector(c.vel, dt);
      c.gyroA.rotation.z += dt * 11;
      c.gyroA.rotation.x += dt * 6;
      c.gyroB.rotation.y -= dt * 13;
      c.gyroB.rotation.z += dt * 5;
      c.halo.scale.setScalar(7.0 + Math.sin(now * 0.024) * 1.6);
      if (particles?.missileTrail) {
        c.trailCd -= dt;
        if (c.trailCd <= 0) {
          c.trailCd = 0.022;
          particles.missileTrail(c.mesh.position.x, c.mesh.position.y, c.mesh.position.z, c.trailCol ?? 0x62d8ff, true);
        }
      }
      c.life -= dt;
      if (c.life <= 0) { c.active = false; c.mesh.visible = false; }
    }
    for (const b of this.bombs) {
      if (!b.active) continue;
      b.mesh.position.addScaledVector(b.vel, dt);
      b.mesh.rotation.y += dt * 6; b.mesh.rotation.x += dt * 3.5;
      b.core.material.color.setRGB(1, 0.85 + Math.sin(now * 0.03) * 0.15, 0.6);
      if (particles?.missileTrail && Math.random() < 0.65) {
        particles.missileTrail(b.mesh.position.x, b.mesh.position.y, b.mesh.position.z + 1.8, 0xffaa44, true);
      }
      b.fuse -= dt;
    }
    for (const b of this.ebullets) {
      if (!b.active) continue;
      const prevAge = b.age;
      b.age += dt;
      // Homing bullets follow their assigned wingmate when one was selected;
      // all other shots retain the player as their target.
      // Deflected bullets fly back toward enemies without player-homing pull
      if (b.homing && player && !b.deflected) {
        const w = b.targetWingmate;
        if (w && w.hidden <= 0 && w.mesh.visible && w.hp > 0) _v1.copy(w.mesh.position);
        else _v1.set(player.x, player.y, -20);
        _v1.sub(b.mesh.position);
        if (_v1.lengthSq() > 1) {
          const spd = b.vel.length();
          const turn = BULLET[b.btype]?.turnRate ?? 1.6;
          b.vel.lerp(_v1.normalize().multiplyScalar(spd), Math.min(1, dt * turn));
          b.vel.setLength(spd);
          b.mesh.lookAt(_v1.copy(b.mesh.position).add(b.vel));
        }
      }
      // Parabolic artillery mortar gravity & boomerang lateral arc acceleration
      if (!b.deflected) {
        if (b.gravity !== 0) {
          b.vel.y += b.gravity * dt;
          b.mesh.lookAt(_v1.copy(b.mesh.position).add(b.vel));
        }
        if (b.curveX !== 0) {
          b.vel.x += b.curveX * dt;
        }
      }
      b.mesh.position.addScaledVector(b.vel, dt);
      // Exact dt-invariant 3D DNA-helix corkscrew displacement for `spiral` rounds!
      if (!b.deflected && b.helixR > 0 && b.helixFreq > 0) {
        const a0 = prevAge * b.helixFreq + b.helixPhase;
        const a1 = b.age * b.helixFreq + b.helixPhase;
        b.mesh.position.x += b.helixR * (Math.cos(a1) - Math.cos(a0));
        b.mesh.position.y += b.helixR * (Math.sin(a1) - Math.sin(a0));
      }
      b.mesh.position.z += scroll * dt * 0.35;

      // Airburst Cluster Shell mid-air split into 5 radial shard sub-munitions!
      if (!b.deflected && b.splitT > 0) {
        b.splitT -= dt;
        const pz = b.mesh.position.z;
        if ((b.splitT <= 0 || (pz > -64 && pz < -28)) && pz < -24) {
          const ox = b.mesh.position.x, oy = b.mesh.position.y, oz = pz;
          b.active = false; b.mesh.visible = false; b.targetWingmate = null; b.splitT = 0;
          if (particles) {
            particles.flash(ox, oy, oz, 1.05, 0xff9a44);
            particles.ring(ox, oy, oz, { color: 0xff6232, from: 2.0, radius: 16, dur: 0.34, opacity: 0.62 });
            particles.sparks(ox, oy, oz, 0.72, 0xffd27a);
          }
          audio.impact('flak');
          const orig = new THREE.Vector3(ox, oy, oz);
          const aimX = player ? (player.x - ox) * 0.45 : 0;
          const aimY = player ? (player.y - oy) * 0.45 : 0;
          const spin = b.age * 2.1;
          for (let k = 0; k < 5; k++) {
            const a = (k / 5) * Math.PI * 2 + spin;
            _v1.set(aimX + Math.cos(a) * 34, aimY + Math.sin(a) * 28, 86);
            this.fireEnemy(orig, _v1, 'shard', 112);
          }
          continue;
        }
      }

      b.life -= dt;
      b.halo.material.rotation += dt * 4;
      if (b.ring.visible) {
        b.ring.rotation.z += dt * (b.deflected ? 14 : b.btype === 'boomerang' ? 16 : 7);
        if (b.shape === 'ring' && !b.deflected) {
          b.ring.rotation.x += dt * (b.btype === 'boomerang' ? 2 : 4);
        }
      }
      if (b.ring2.visible) {
        b.ring2.rotation.y -= dt * 8;
        b.ring2.rotation.z -= dt * 5;
      }
      if (b.collar.visible) b.collar.rotation.z += dt * (b.btype === 'cluster' ? 14 : 7);
      if (b.spike.visible) b.spike.rotation.z += dt * 10;
      const hasTrail = b.shape === 'missile' || b.btype === 'pursuit' || b.btype === 'cluster' || b.btype === 'spiral' || b.btype === 'rail' || b.btype === 'mortar' || b.btype === 'boomerang';
      if (hasTrail && particles?.missileTrail) {
        b.trailCd -= dt;
        if (b.trailCd <= 0) {
          b.trailCd = b.btype === 'rail' ? 0.025 : b.btype === 'pursuit' || b.btype === 'spiral' ? 0.052 : 0.044;
          const p = b.mesh.position;
          particles.missileTrail(p.x, p.y, p.z, b.deflected ? 0x66fff0 : (BULLET[b.btype]?.trail ?? 0xff7a3a), b.deflected || b.btype === 'rail' || b.btype === 'spiral' || b.btype === 'boomerang');
        }
      }
      if (b.trail.visible) b.trail.material.opacity = 0.65 + Math.sin(now * 0.05 + b.mesh.id) * 0.3;   // flickering tracer/exhaust
      if (b.mesh.position.z > 40 || b.mesh.position.z < -1000 || b.mesh.position.y < -30 || b.life <= 0) { b.active = false; b.mesh.visible = false; b.targetWingmate = null; }
    }
  }
}
