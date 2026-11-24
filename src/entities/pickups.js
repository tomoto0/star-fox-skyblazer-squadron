import * as THREE from 'three';
import { toonMat, dotTexture, _v1 } from '../core/util.js';
import { PLAYER_Z } from './player.js';

const ICON = {
  laser:  { core: 0xffe27a, emis: 0xffa020, halo: 0xffc060 },
  bomb:   { core: 0xd8fbff, emis: 0x2eb8e6, halo: 0x7fe9ff },
  health: { core: 0xffd0df, emis: 0xff3d6e, halo: 0xff8fb0 },
};

/* ---- Shared cached geometries & materials (zero GPU allocation/leak per ring/pickup!) ---- */
let _shared = null;
function getShared() {
  if (_shared) return _shared;
  const dot = dotTexture();
  const makeGlowMat = (color, opacity) => new THREE.SpriteMaterial({
    map: dot, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity,
  });
  const makeBeaconMat = (color) => new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide,
  });
  _shared = {
    ringOuterGeo: new THREE.TorusGeometry(6.0, 0.72, 10, 24),
    ringInnerGeo: new THREE.TorusGeometry(6.0, 0.26, 8, 24),
    ringOuterMat: toonMat(0xffc93c, { emissive: 0xf7b733, emissiveIntensity: 1.15 }),
    ringInnerMat: toonMat(0xfff4c0, { emissive: 0xffe27a, emissiveIntensity: 1.6 }),
    ringGlowMat: makeGlowMat(0xffd870, 0.6),

    beaconGeo: new THREE.CylinderGeometry(1.2, 2.4, 46, 8, 1, true),
    haloGeo: new THREE.TorusGeometry(2.7, 0.16, 6, 18),
    laserChevGeo: new THREE.ConeGeometry(1.8, 1.1, 3),
    bombOrbGeo: new THREE.IcosahedronGeometry(1.9, 0),
    bombFuseGeo: new THREE.CylinderGeometry(0.16, 0.16, 1.2, 6),
    bombFuseMat: toonMat(0x334, {}),
    healthBarHGeo: new THREE.BoxGeometry(2.8, 1.0, 1.0),
    healthBarVGeo: new THREE.BoxGeometry(1.0, 2.8, 1.0),

    byKind: Object.fromEntries(Object.entries(ICON).map(([k, c]) => [k, {
      coreMat: toonMat(c.core, { emissive: c.emis, emissiveIntensity: 1.35, flat: true }),
      haloMat: toonMat(c.halo, { emissive: c.halo, emissiveIntensity: 1.0, flat: true }),
      glowMat: makeGlowMat(c.halo, 0.55),
      beaconMat: makeBeaconMat(c.halo),
    }])),
  };
  return _shared;
}

export class Pickups {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
  }

  _iconMesh(kind) {
    const S = getShared();
    const m = S.byKind[kind] ?? S.byKind.health;
    const g = new THREE.Group();
    if (kind === 'laser') {
      for (let i = 0; i < 2; i++) {
        const chev = new THREE.Mesh(S.laserChevGeo, m.coreMat);
        chev.rotation.x = -Math.PI / 2;
        chev.position.y = -0.9 + i * 1.4;
        g.add(chev);
      }
    } else if (kind === 'bomb') {
      g.add(new THREE.Mesh(S.bombOrbGeo, m.coreMat));
      const fuse = new THREE.Mesh(S.bombFuseGeo, S.bombFuseMat);
      fuse.position.y = 2.1;
      g.add(fuse);
    } else {
      g.add(new THREE.Mesh(S.healthBarHGeo, m.coreMat), new THREE.Mesh(S.healthBarVGeo, m.coreMat));
    }
    const halo = new THREE.Mesh(S.haloGeo, m.haloMat);
    halo.rotation.x = Math.PI / 2;
    const glow = new THREE.Sprite(m.glowMat);
    glow.scale.setScalar(8);
    g.add(halo, glow);
    g.userData.halo = halo;
    return g;
  }

  spawn(kind, x, y, z = -340) {
    const S = getShared();
    const g = new THREE.Group();
    let radius = 5.2, hasBeacon = false;
    if (kind === 'ring') {
      const ring = new THREE.Mesh(S.ringOuterGeo, S.ringOuterMat);
      const inner = new THREE.Mesh(S.ringInnerGeo, S.ringInnerMat);
      const glow = new THREE.Sprite(S.ringGlowMat);
      glow.scale.setScalar(9);
      g.add(ring, inner, glow);
      radius = 7.6;
    } else {
      g.add(this._iconMesh(kind));
      const m = S.byKind[kind] ?? S.byKind.health;
      const beam = new THREE.Mesh(S.beaconGeo, m.beaconMat);
      beam.position.y = 23;
      g.add(beam);
      hasBeacon = true;
    }
    g.position.set(x, y, z);
    this.scene.add(g);
    this.list.push({ kind, mesh: g, radius, age: 0, hasBeacon });
  }

  ringLine(n, x0, y0, dx = 0, dy = 0, z = -350, dz = -34) {
    for (let i = 0; i < n; i++) this.spawn('ring', x0 + dx * i, y0 + dy * i, z + dz * i);
  }

  update(dt, scroll, player, onCollect) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.age += dt;
      p.mesh.position.z += scroll * dt;
      if (p.kind === 'ring') {
        p.mesh.rotation.y = Math.sin(p.age * 1.4) * 0.5;
      } else {
        const icon = p.mesh.children[0];
        icon.rotation.y += dt * 2.0;
        if (icon.userData.halo) icon.userData.halo.rotation.z -= dt * 3.0;
        icon.position.y = Math.sin(p.age * 2.2) * 0.6;
      }
      const m = p.mesh.position;
      _v1.set(player.x, player.y, PLAYER_Z);
      const dist = _v1.distanceTo(m);
      // Responsive magnetic attraction: strong for power-ups, gentle assist for gold rings
      if (p.kind !== 'ring' && Math.abs(m.z - PLAYER_Z) < 46 && dist < 28) {
        const pull = Math.min(1, dt * 5.2);
        m.x += (player.x - m.x) * pull;
        m.y += (player.y - m.y) * pull;
      } else if (p.kind === 'ring' && Math.abs(m.z - PLAYER_Z) < 28 && dist < 16) {
        const pull = Math.min(1, dt * 2.4);
        m.x += (player.x - m.x) * pull;
        m.y += (player.y - m.y) * pull;
      }
      if (Math.abs(m.z - PLAYER_Z) < 7.5 && dist < p.radius + player.radius + 1.8) {
        onCollect(p.kind, m);
        this.remove(p);
        continue;
      }
      if (m.z > 30) this.remove(p);
    }
  }

  remove(p) {
    this.scene.remove(p.mesh);
    const i = this.list.indexOf(p);
    if (i >= 0) this.list.splice(i, 1);
  }

  clear() { for (const p of [...this.list]) this.remove(p); }
}
