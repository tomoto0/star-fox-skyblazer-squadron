import * as THREE from 'three';
import { dotTexture, toonMat, _v1 } from '../core/util.js';
import { audio } from '../core/audio.js';

const LASER_SPEED = 520;
const MAXL = 48, MAXE = 240, MAXC = 6, MAXB = 3, MAXAL = 48;

/**
 * Enemy bullet presets — each has a distinct 3D shape, colour, size, base
 * speed, hit radius and behaviour. `shape` drives which sub-meshes light up
 * on the pooled bullet: orb (glow ball), bolt (tracer), shell (heavy round),
 * ring (energy pulse), missile (finned + trail), spike (jagged dart).
 */
export const BULLET = {
  // NOTE: the world scrolls at ~46 and enemies close on top of that, so every
  // round stays well above ~85 — otherwise a shell visibly trails its own ship.
  orb:     { core: 0xffd27a, halo: 0xff5a1e, size: 2.6, r: 0.9, speed: 90,  shape: 'orb' },
  bolt:    { core: 0xeaffff, halo: 0x59c6ff, size: 2.5, r: 0.7, speed: 138, shape: 'bolt' },   // fast thin tracer
  heavy:   { core: 0xffe6b0, halo: 0xff5020, size: 3.8, r: 1.9, speed: 88,  shape: 'shell' },  // big cannon shell
  plasma:  { core: 0xffd6f0, halo: 0xff3d8f, size: 3.0, r: 1.1, speed: 94,  shape: 'orb' },    // pink energy round
  homing:  { core: 0xdcffe4, halo: 0x54ff9e, size: 3.0, r: 1.0, speed: 82,  shape: 'missile', homing: true, trail: 0x54ff9e },
  venom:   { core: 0xecffb4, halo: 0x9be23a, size: 3.0, r: 1.1, speed: 98,  shape: 'spike' },  // acid dart
  // new rounds
  missile: { core: 0xffe6c0, halo: 0xff7a3a, size: 3.2, r: 1.1, speed: 86,  shape: 'missile', homing: true, trail: 0xff7a3a },
  flak:    { core: 0xffefc0, halo: 0xffb030, size: 4.2, r: 2.3, speed: 82,  shape: 'shell' },  // fat AA burst round
  wave:    { core: 0xd6e6ff, halo: 0x6a9bff, size: 4.6, r: 2.1, speed: 85,  shape: 'shell' },  // heavy siege round
  shard:   { core: 0xf2f8ff, halo: 0x8fd0ff, size: 2.3, r: 0.7, speed: 158, shape: 'spike' },  // very fast splinter
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

    /* player lasers — bright inner bolt + additive outer glow sheath + tip flare */
    this.lasers = [];
    const boltGeo = new THREE.CapsuleGeometry(0.2, 4.2, 3, 6);
    boltGeo.rotateX(Math.PI / 2);
    const sheathGeo = new THREE.CapsuleGeometry(0.5, 4.6, 3, 6);
    sheathGeo.rotateX(Math.PI / 2);
    for (let i = 0; i < MAXL; i++) {
      const g = new THREE.Group();
      const core = new THREE.Mesh(boltGeo, new THREE.MeshBasicMaterial({ color: 0xf2fff6, fog: false }));
      const sheath = new THREE.Mesh(sheathGeo, new THREE.MeshBasicMaterial({ color: 0x54ff9e, fog: false, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
      const halo = glowSprite(0x54ff9e, 3.0);
      halo.position.z = -2.2;
      const rail = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.095, 5, 10), new THREE.MeshBasicMaterial({ color: 0x54ff9e, transparent: true, opacity: 0.82, blending: THREE.AdditiveBlending, depthWrite: false }));
      rail.visible = false;
      g.add(core, sheath, halo, rail);
      g.visible = false;
      scene.add(g);
      this.lasers.push({ mesh: g, core, sheath, halo, rail, level: 1, active: false, vel: new THREE.Vector3(), life: 0, dmg: 1 });
    }

    /* wingmate (ally) lasers — team-coloured supporting fire */
    this.alasers = [];
    const aboltGeo = new THREE.CapsuleGeometry(0.18, 3.2, 3, 6);
    aboltGeo.rotateX(Math.PI / 2);
    for (let i = 0; i < MAXAL; i++) {
      const g = new THREE.Group();
      const core = new THREE.Mesh(aboltGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }));
      const halo = glowSprite(0x66d9ff, 2.2);
      g.add(core, halo);
      g.visible = false;
      scene.add(g);
      this.alasers.push({ mesh: g, core, halo, active: false, vel: new THREE.Vector3(), life: 0, dmg: 1 });
    }

    /* charge shots */
    this.charges = [];
    for (let i = 0; i < MAXC; i++) {
      const g = new THREE.Group();
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 8), new THREE.MeshBasicMaterial({ color: 0xbfefff, fog: false }));
      const halo = glowSprite(0x59c6ff, 7);
      g.add(orb, halo);
      g.visible = false;
      scene.add(g);
      this.charges.push({ mesh: g, active: false, vel: new THREE.Vector3(), target: null, life: 0 });
    }

    /* bombs — a spinning finned warhead with a hot core */
    this.bombs = [];
    for (let i = 0; i < MAXB; i++) {
      const g = new THREE.Group();
      const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(1.35, 1), toonMat(0xc9cdd6, { emissive: 0xff7030, emissiveIntensity: 0.5, flat: true }));
      const bandGeo = new THREE.TorusGeometry(1.3, 0.28, 6, 12);
      const band = new THREE.Mesh(bandGeo, toonMat(0xd83a2a, { emissive: 0xff4020, emissiveIntensity: 0.9, flat: true }));
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff0c0, fog: false }));
      const fins = new THREE.Group();
      for (let f = 0; f < 4; f++) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.1, 0.7), toonMat(0xd83a2a, { flat: true }));
        fin.position.set(Math.cos(f * Math.PI / 2) * 1.2, 0, Math.sin(f * Math.PI / 2) * 1.2);
        fin.lookAt(0, 0, 0);
        fins.add(fin);
      }
      const halo = glowSprite(0xffb060, 5);
      g.add(shell, band, core, fins, halo);
      g.visible = false;
      scene.add(g);
      this.bombs.push({ mesh: g, spinner: g, core, halo, active: false, vel: new THREE.Vector3(), fuse: 0 });
    }

    /* enemy bullets — a pooled group carrying every shape (orb/tracer/shell/
       ring/missile), toggled per type so each round has a distinct silhouette */
    this.ebullets = [];
    const eCoreGeo = new THREE.SphereGeometry(0.55, 8, 6);
    const eShellGeo = new THREE.CapsuleGeometry(0.34, 1.5, 4, 8); eShellGeo.rotateX(Math.PI / 2);
    const eSpikeGeo = new THREE.ConeGeometry(0.42, 2.4, 5); eSpikeGeo.rotateX(-Math.PI / 2);
    const eRingGeo = new THREE.TorusGeometry(0.72, 0.16, 6, 16);
    const eFinGeo = new THREE.BoxGeometry(0.1, 0.7, 0.5);
    for (let i = 0; i < MAXE; i++) {
      const g = new THREE.Group();
      const core = new THREE.Mesh(eCoreGeo, new THREE.MeshBasicMaterial({ color: 0xfff0d0, fog: false }));
      const shell = new THREE.Mesh(eShellGeo, new THREE.MeshBasicMaterial({ color: 0xffe6b0, fog: false })); shell.visible = false;
      const spike = new THREE.Mesh(eSpikeGeo, new THREE.MeshBasicMaterial({ color: 0xecffb4, fog: false })); spike.visible = false;
      const ring = new THREE.Mesh(eRingGeo, new THREE.MeshBasicMaterial({ color: 0xff3d8f, fog: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); ring.visible = false;
      const fins = new THREE.Group();
      for (let f = 0; f < 3; f++) { const fin = new THREE.Mesh(eFinGeo, new THREE.MeshBasicMaterial({ color: 0x39424f, fog: false })); fin.rotation.z = (f / 3) * Math.PI * 2; fin.position.z = 0.7; fins.add(fin); }
      fins.visible = false;
      const halo = glowSprite(0xff9040, 3.2);
      const trail = glowSprite(0xff7a3a, 2.6); trail.visible = false; trail.position.z = 1.6;
      g.add(core, shell, spike, ring, fins, halo, trail);
      g.visible = false;
      scene.add(g);
      this.ebullets.push({ mesh: g, core, shell, spike, ring, fins, halo, trail, active: false, vel: new THREE.Vector3(), life: 0, deflected: false, radius: 0.9, homing: false, spin: false, shape: 'orb', btype: 'orb', targetWingmate: null });
    }
  }

  fireLaser(from, toward, dmg, level) {
    const b = this.lasers.find((l) => !l.active);
    if (!b) return null;
    b.active = true; b.mesh.visible = true;
    b.mesh.position.copy(from);
    b.vel.copy(toward).sub(from).normalize().multiplyScalar(LASER_SPEED);
    b.mesh.lookAt(_v1.copy(from).add(b.vel));
    b.life = 1.25;
    b.dmg = dmg;
    const col = level >= 3 ? 0x59c6ff : 0x54ff9e;
    b.halo.material.color.set(col);
    b.sheath.material.color.set(col);
    b.core.material.color.set(level >= 3 ? 0xe8f8ff : 0xf2fff6);
    b.level = level;
    b.rail.visible = level >= 2;
    b.rail.material.color.set(col);
    b.rail.scale.setScalar(level >= 3 ? 1.42 : 1.0);
    b.rail.material.opacity = level >= 3 ? 0.96 : 0.72;
    b.sheath.scale.set(level >= 3 ? 1.22 : level === 2 ? 1.08 : 1.0, level >= 3 ? 1.22 : level === 2 ? 1.08 : 1.0, level >= 3 ? 1.18 : 1.0);
    return b;
  }

  /** ally supporting laser — flies from a wingmate toward `toward` */
  fireAlly(from, toward, color = 0x66d9ff) {
    const b = this.alasers.find((l) => !l.active);
    if (!b) return null;
    b.active = true; b.mesh.visible = true;
    b.mesh.position.copy(from);
    b.vel.copy(toward).sub(from).normalize().multiplyScalar(520);
    b.mesh.lookAt(_v1.copy(from).add(b.vel));
    b.life = 1.2;
    b.dmg = 1;
    b.halo.material.color.set(color);
    return b;
  }

  fireCharge(from, target) {
    const c = this.charges.find((l) => !l.active);
    if (!c) return null;
    c.active = true; c.mesh.visible = true;
    c.mesh.position.copy(from);
    c.vel.set(0, 0, -320);
    c.target = target;
    c.life = 2.5;
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
  fireEnemy(from, dir, type = 'orb', speedOverride = null, targetWingmate = null) {
    const b = this.ebullets.find((l) => !l.active);
    if (!b) return null;
    const legacyColor = typeof type === 'number' ? type : null;   // bosses pass a raw colour
    const key = legacyColor !== null ? 'orb' : (typeof type === 'string' && BULLET[type] ? type : 'orb');
    const T = BULLET[key];
    const shape = legacyColor !== null ? 'orb' : T.shape;

    b.active = true; b.mesh.visible = true; b.deflected = false;
    b.btype = key; b.shape = shape; b.targetWingmate = targetWingmate;
    b.mesh.position.copy(from);
    const spd = speedOverride ?? (legacyColor !== null ? dir.length() : T.speed);
    b.vel.copy(dir).normalize().multiplyScalar(spd);

    const coreCol = legacyColor !== null ? 0xffdcae : T.core;
    const haloCol = legacyColor ?? T.halo;
    b.halo.material.color.set(haloCol);
    b.halo.scale.setScalar(T.size);
    b.core.material.color.set(coreCol);

    // reset all shape sub-meshes, then light up the ones this round uses
    b.shell.visible = b.spike.visible = b.ring.visible = b.fins.visible = b.trail.visible = false;
    b.mesh.rotation.set(0, 0, 0);
    const elong = ELONGATED.has(shape);
    if (elong) b.mesh.lookAt(_v1.copy(from).add(b.vel));

    if (shape === 'orb') {
      // glowing tracer round (was a plain white ball): short bright bolt + tail
      b.core.scale.setScalar(0.85);
      b.shell.visible = true; b.shell.scale.set(0.9, 0.9, 1.8); b.shell.material.color.set(coreCol);
    } else if (shape === 'bolt') {
      b.core.scale.setScalar(0.7);
      b.shell.visible = true; b.shell.scale.set(0.5, 0.5, 2.1); b.shell.material.color.set(coreCol);
    } else if (shape === 'shell') {
      b.core.scale.setScalar(1.5);
      b.shell.visible = true; b.shell.scale.set(1.7, 1.7, 1.9); b.shell.material.color.set(coreCol);
    } else if (shape === 'ring') {
      b.core.scale.setScalar(1.2);
      b.ring.visible = true; b.ring.scale.setScalar(T.size * 0.42); b.ring.material.color.set(haloCol);
    } else if (shape === 'missile') {
      b.core.scale.setScalar(0.6);
      b.shell.visible = true; b.shell.scale.set(0.7, 0.7, 2.4); b.shell.material.color.set(coreCol);
      b.fins.visible = true;
      b.trail.visible = true; b.trail.material.color.set(T.trail ?? haloCol); b.trail.scale.setScalar(T.size * 0.8);
    } else if (shape === 'spike') {
      b.core.scale.setScalar(0.5);
      b.spike.visible = true; b.spike.scale.set(0.8, 0.8, 1.1); b.spike.material.color.set(coreCol);
    }
    // glowing tracer trail behind elongated rounds (missile sets its own above)
    if (elong && shape !== 'missile') {
      b.trail.visible = true;
      b.trail.material.color.set(shape === 'shell' ? haloCol : coreCol);
      b.trail.scale.setScalar(T.size * (shape === 'shell' ? 0.75 : 0.5));
      b.trail.position.z = 1.5;
    }

    b.radius = legacyColor !== null ? 0.9 : T.r;
    b.homing = legacyColor === null && !!T.homing;
    b.spin = shape === 'orb' || shape === 'ring';
    b.life = 8;
    audio.enemyFire(key);   // throttled inside audio so a volley = one report
    return b;
  }

  clearEnemyBullets(cb) {
    for (const b of this.ebullets) {
      if (b.active) { cb?.(b.mesh.position); b.active = false; b.mesh.visible = false; b.targetWingmate = null; }
    }
  }

  update(dt, scroll, player) {
    for (const b of this.lasers) {
      if (!b.active) continue;
      b.mesh.position.addScaledVector(b.vel, dt);
      if (b.rail.visible) {
        b.rail.rotation.z += dt * (b.level >= 3 ? 18 : 11);
        const base = b.level >= 3 ? 1.42 : 1.0;
        const pulse = 1 + Math.sin((b.life * 18) + b.mesh.position.z * 0.06) * 0.08;
        b.rail.scale.setScalar(base * pulse);
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
    for (const c of this.charges) {
      if (!c.active) continue;
      if (c.target && c.target.alive) {
        _v1.copy(c.target.pos()).sub(c.mesh.position).normalize().multiplyScalar(350);
        c.vel.lerp(_v1, Math.min(1, dt * 8));
      }
      c.mesh.position.addScaledVector(c.vel, dt);
      c.mesh.children[1].scale.setScalar(6 + Math.sin(performance.now() * 0.02) * 1.4);
      c.life -= dt;
      if (c.life <= 0) { c.active = false; c.mesh.visible = false; }
    }
    for (const b of this.bombs) {
      if (!b.active) continue;
      b.mesh.position.addScaledVector(b.vel, dt);
      b.mesh.rotation.y += dt * 6; b.mesh.rotation.x += dt * 3.5;
      b.core.material.color.setRGB(1, 0.85 + Math.sin(performance.now() * 0.03) * 0.15, 0.6);
      b.fuse -= dt;
    }
    const now = performance.now();
    for (const b of this.ebullets) {
      if (!b.active) continue;
      // Homing bullets follow their assigned wingmate when one was selected;
      // all other shots retain the player as their target.
      if (b.homing && player) {
        const w = b.targetWingmate;
        if (w && w.hidden <= 0 && w.mesh.visible && w.hp > 0) _v1.copy(w.mesh.position);
        else _v1.set(player.x, player.y, -20);
        _v1.sub(b.mesh.position);
        if (_v1.lengthSq() > 1) {
          const spd = b.vel.length();
          b.vel.lerp(_v1.normalize().multiplyScalar(spd), Math.min(1, dt * 1.6));
          b.vel.setLength(spd);
          b.mesh.lookAt(_v1.copy(b.mesh.position).add(b.vel));
        }
      }
      b.mesh.position.addScaledVector(b.vel, dt);
      b.mesh.position.z += scroll * dt * 0.35;
      b.life -= dt;
      b.halo.material.rotation += dt * 4;
      if (b.shape === 'ring' && b.ring.visible) {           // pulsing, spinning energy ring
        b.ring.rotation.z += dt * 6;
        b.ring.scale.multiplyScalar(1 + Math.sin(now * 0.02 + b.mesh.id) * 0.02 + 0.004);
      }
      if (b.trail.visible) b.trail.material.opacity = 0.65 + Math.sin(now * 0.05 + b.mesh.id) * 0.3;   // flickering tracer/exhaust
      if (b.mesh.position.z > 40 || b.mesh.position.z < -1000 || b.life <= 0) { b.active = false; b.mesh.visible = false; b.targetWingmate = null; }
    }
  }
}
