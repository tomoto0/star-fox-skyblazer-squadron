import * as THREE from 'three';
import { toonMat, dotTexture, TAU, _v1 } from '../core/util.js';
import { PLAYER_Z } from './player.js';

function glowSprite(color, size, opacity = 0.7) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: dotTexture(), color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity,
  }));
  s.scale.setScalar(size);
  return s;
}

/** vertical beacon beam so items read across the wide field */
function beacon(color) {
  const g = new THREE.Group();
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.4, 46, 8, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
  beam.position.y = 23;
  g.add(beam);
  return g;
}

const ICON = {
  laser: { core: 0xffe27a, emis: 0xffa020, halo: 0xffc060 },
  bomb: { core: 0xd8fbff, emis: 0x2eb8e6, halo: 0x7fe9ff },
  health: { core: 0xffd0df, emis: 0xff3d6e, halo: 0xff8fb0 },
};

export class Pickups {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
  }

  _iconMesh(kind) {
    const g = new THREE.Group();
    const c = ICON[kind];
    if (kind === 'laser') {
      // stacked double chevron
      for (let i = 0; i < 2; i++) {
        const chev = new THREE.Mesh(new THREE.ConeGeometry(1.8, 1.1, 3), toonMat(c.core, { emissive: c.emis, emissiveIntensity: 1.4, flat: true }));
        chev.rotation.x = -Math.PI / 2; chev.position.y = -0.9 + i * 1.4;
        g.add(chev);
      }
    } else if (kind === 'bomb') {
      const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(1.9, 0), toonMat(c.core, { emissive: c.emis, emissiveIntensity: 1.3, flat: true }));
      g.add(orb);
      const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.2, 6), toonMat(0x334, {}));
      fuse.position.y = 2.1; g.add(fuse);
    } else { // health cross
      const bar1 = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.0, 1.0), toonMat(c.core, { emissive: c.emis, emissiveIntensity: 1.3, flat: true }));
      const bar2 = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.8, 1.0), toonMat(c.core, { emissive: c.emis, emissiveIntensity: 1.3, flat: true }));
      g.add(bar1, bar2);
    }
    // spinning halo ring
    const halo = new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.16, 6, 20), toonMat(c.halo, { emissive: c.halo, emissiveIntensity: 1.0, flat: true }));
    halo.rotation.x = Math.PI / 2;
    g.add(halo, glowSprite(c.halo, 8, 0.55));
    g.userData.halo = halo;
    return g;
  }

  spawn(kind, x, y, z = -600) {
    const g = new THREE.Group();
    let radius = 4.5, hasBeacon = false;
    if (kind === 'ring') {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(5.2, 0.6, 10, 28),
        toonMat(0xffc93c, { emissive: 0xf7b733, emissiveIntensity: 1.0 }));
      const inner = new THREE.Mesh(new THREE.TorusGeometry(5.2, 0.22, 8, 28),
        toonMat(0xfff4c0, { emissive: 0xffe27a, emissiveIntensity: 1.4 }));
      g.add(ring, inner, glowSprite(0xffd870, 7, 0.5));
      radius = 6.5;
    } else {
      g.add(this._iconMesh(kind));
      g.add(beacon(ICON[kind].halo));
      hasBeacon = true;
    }
    g.position.set(x, y, z);
    this.scene.add(g);
    this.list.push({ kind, mesh: g, radius, age: 0, hasBeacon });
  }

  ringLine(n, x0, y0, dx = 0, dy = 0, z = -620, dz = -46) {
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
        // gentle spin of the icon + counter-spin halo + bob
        const icon = p.mesh.children[0];
        icon.rotation.y += dt * 2.0;
        if (icon.userData.halo) icon.userData.halo.rotation.z -= dt * 3.0;
        icon.position.y = Math.sin(p.age * 2.2) * 0.6;
      }
      const m = p.mesh.position;
      _v1.set(player.x, player.y, PLAYER_Z);
      // magnetize items toward the player when close, and use a forgiving grab radius
      if (p.kind !== 'ring' && Math.abs(m.z - PLAYER_Z) < 40 && _v1.distanceTo(m) < 22) {
        m.x += (player.x - m.x) * Math.min(1, dt * 4);
        m.y += (player.y - m.y) * Math.min(1, dt * 4);
      }
      if (Math.abs(m.z - PLAYER_Z) < 7 && _v1.distanceTo(m) < p.radius + player.radius + 1.5) {
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
