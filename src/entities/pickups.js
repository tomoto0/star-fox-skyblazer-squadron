import * as THREE from 'three';
import { toonMat, dotTexture, _v1 } from '../core/util.js';
import { PLAYER_Z } from './player.js';

const ICON = {
  laser:  { core: 0xffe482, emis: 0xffa020, halo: 0xffc65c },
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
    // Iconic Star Fox supply/boost gate ring: beveled titanium-gold outer frame, 4 radial emitter brackets & counter-rotating inner plasma ring
    ringOuterGeo: new THREE.TorusGeometry(6.1, 0.68, 8, 24),
    ringBevelGeo: new THREE.TorusGeometry(6.82, 0.20, 6, 8),
    ringInnerGeo: new THREE.TorusGeometry(5.15, 0.24, 6, 12),
    ringClampGeo: new THREE.BoxGeometry(1.15, 1.55, 1.35),
    ringDiodeGeo: new THREE.OctahedronGeometry(0.46, 0),
    ringOuterMat: toonMat(0xffc93c, { emissive: 0xf7b733, emissiveIntensity: 1.15, flat: true }),
    ringFrameMat: toonMat(0x4b566c, { flat: true }),
    ringInnerMat: toonMat(0xfff4c0, { emissive: 0xffe27a, emissiveIntensity: 1.85, flat: true }),
    ringGlowMat: makeGlowMat(0xffd870, 0.64),
    // Prismatic final-chain ring materials (shared, animated hue during Ring Chain finale!)
    ringPrismOuterMat: toonMat(0xffe878, { emissive: 0x72f8ff, emissiveIntensity: 1.75, flat: true }),
    ringPrismInnerMat: toonMat(0xffffff, { emissive: 0xff7ae6, emissiveIntensity: 2.25, flat: true }),
    ringPrismGlowMat: makeGlowMat(0x9ef8ff, 0.88),

    // Shared pickup framing & beacon
    beaconGeo: new THREE.CylinderGeometry(1.1, 2.3, 46, 8, 1, true),
    haloGeo: new THREE.TorusGeometry(2.85, 0.17, 6, 18),
    haloInnerGeo: new THREE.TorusGeometry(2.25, 0.11, 5, 14),
    frameHexGeo: new THREE.TorusGeometry(2.15, 0.22, 6, 6),
    armorMat: toonMat(0x3a465c, { flat: true }),
    darkMat: toonMat(0x1e2636, { flat: true }),

    // Laser Upgrade: twin-winged Star Fox golden chevron emblem + plasma barrels + diamond core
    laserWingGeo: new THREE.ConeGeometry(1.55, 1.9, 4),
    laserBarrelGeo: new THREE.CylinderGeometry(0.18, 0.24, 2.1, 6),
    laserDiamondGeo: new THREE.OctahedronGeometry(0.95, 0),

    // Smart Bomb: sculpted armored warhead + equatorial plasma band + 4 stabilizing fins + arming nose cap
    bombBodyGeo: new THREE.IcosahedronGeometry(1.65, 1),
    bombBandGeo: new THREE.TorusGeometry(1.68, 0.22, 6, 14),
    bombFinGeo: new THREE.BoxGeometry(0.20, 1.35, 0.85),
    bombCapGeo: new THREE.ConeGeometry(0.65, 1.05, 6),

    // Shield Repair: beveled glowing repair cross nested in armored hexagonal shield collar
    healthBarHGeo: new THREE.BoxGeometry(2.75, 0.92, 0.92),
    healthBarVGeo: new THREE.BoxGeometry(0.92, 2.75, 0.92),
    healthCoreGeo: new THREE.OctahedronGeometry(0.75, 0),

    byKind: Object.fromEntries(Object.entries(ICON).map(([k, c]) => [k, {
      coreMat: toonMat(c.core, { emissive: c.emis, emissiveIntensity: 1.45, flat: true }),
      haloMat: toonMat(c.halo, { emissive: c.halo, emissiveIntensity: 1.15, flat: true }),
      glowMat: makeGlowMat(c.halo, 0.58),
      beaconMat: makeBeaconMat(c.halo),
    }])),
  };
  return _shared;
}

export class Pickups {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this._chains = new Map();
    this._chainSeq = 0;
  }

  _iconMesh(kind) {
    const S = getShared();
    const m = S.byKind[kind] ?? S.byKind.health;
    const g = new THREE.Group();

    if (kind === 'laser') {
      // Sculpted twin-winged golden laser upgrade emblem with central diamond & dual barrels
      const core = new THREE.Mesh(S.laserDiamondGeo, m.coreMat);
      g.add(core);
      for (const s of [-1, 1]) {
        const wing = new THREE.Mesh(S.laserWingGeo, m.coreMat);
        wing.position.set(s * 1.15, 0, 0);
        wing.rotation.z = s * -0.58;
        g.add(wing);
        const barrel = new THREE.Mesh(S.laserBarrelGeo, S.armorMat);
        barrel.position.set(s * 0.85, 0.85, 0);
        g.add(barrel);
      }
    } else if (kind === 'bomb') {
      // Sculpted finned Nova Smart-Bomb warhead with equatorial cyan plasma band & arming nose
      g.add(new THREE.Mesh(S.bombBodyGeo, S.armorMat));
      const band = new THREE.Mesh(S.bombBandGeo, m.coreMat);
      band.rotation.x = Math.PI / 2;
      g.add(band);
      const cap = new THREE.Mesh(S.bombCapGeo, m.coreMat);
      cap.position.y = 1.85;
      g.add(cap);
      for (let f = 0; f < 4; f++) {
        const a = (f / 4) * Math.PI * 2;
        const fin = new THREE.Mesh(S.bombFinGeo, m.haloMat);
        fin.position.set(Math.cos(a) * 1.45, -1.05, Math.sin(a) * 1.45);
        fin.rotation.y = -a;
        g.add(fin);
      }
    } else {
      // Sculpted Shield/Health Repair emblem: armored hexagonal bezel framing glowing cross core
      const hex = new THREE.Mesh(S.frameHexGeo, S.armorMat);
      g.add(hex);
      g.add(new THREE.Mesh(S.healthBarHGeo, m.coreMat), new THREE.Mesh(S.healthBarVGeo, m.coreMat));
      const core = new THREE.Mesh(S.healthCoreGeo, m.haloMat);
      g.add(core);
    }

    // Twin orthogonal counter-gyrating containment halos
    const halo = new THREE.Mesh(S.haloGeo, m.haloMat);
    halo.rotation.set(0.65, 0, 0);
    const halo2 = new THREE.Mesh(S.haloInnerGeo, m.coreMat);
    halo2.rotation.set(0, 0.72, 0.55);
    const glow = new THREE.Sprite(m.glowMat);
    glow.scale.setScalar(8.6);
    g.add(halo, halo2, glow);
    g.userData.halo = halo;
    g.userData.halo2 = halo2;
    return g;
  }

  spawn(kind, x, y, z = -340, meta = null) {
    const S = getShared();
    const g = new THREE.Group();
    let radius = 5.2, hasBeacon = false;
    let ringOuter = null, ringInner = null, ringGlow = null;
    if (kind === 'ring') {
      const ring = new THREE.Mesh(S.ringOuterGeo, S.ringOuterMat);
      const bevel = new THREE.Mesh(S.ringBevelGeo, S.ringFrameMat);
      const inner = new THREE.Mesh(S.ringInnerGeo, S.ringInnerMat);
      g.add(ring, bevel, inner);
      // 4 armored outer emitter brackets + 4 orbiting inner plasma diodes at 90° intervals
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const ca = Math.cos(a), sa = Math.sin(a);
        const clamp = new THREE.Mesh(S.ringClampGeo, S.ringFrameMat);
        clamp.position.set(ca * 6.25, sa * 6.25, 0);
        clamp.rotation.z = a;
        g.add(clamp);
        const diode = new THREE.Mesh(S.ringDiodeGeo, S.ringInnerMat);
        diode.position.set(ca * 5.15, sa * 5.15, 0);
        inner.add(diode);
      }
      const glow = new THREE.Sprite(S.ringGlowMat);
      glow.scale.setScalar(10.5);
      g.add(glow);
      g.userData.innerRing = inner;
      ringOuter = ring; ringInner = inner; ringGlow = glow;
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
    this.list.push({
      kind, mesh: g, radius, age: 0, hasBeacon,
      ringOuter, ringInner, ringGlow,
      chainId: meta?.chainId ?? null,
      chainIndex: meta?.chainIndex ?? 0,
      chainTotal: meta?.chainTotal ?? 0,
      prismatic: false,
    });
  }

  ringLine(n, x0, y0, dx = 0, dy = 0, z = -350, dz = -34) {
    let chainId = null;
    if (n >= 3) {
      chainId = ++this._chainSeq;
      this._chains.set(chainId, { total: n, collected: 0, missed: 0 });
    }
    for (let i = 0; i < n; i++) {
      this.spawn('ring', x0 + dx * i, y0 + dy * i, z + dz * i, chainId ? { chainId, chainIndex: i, chainTotal: n } : null);
    }
  }

  update(dt, scroll, player, onCollect) {
    const S = getShared();
    // Smooth rainbow shimmer for any live prismatic finale ring!
    const hue = (performance.now() * 0.00055) % 1;
    S.ringPrismOuterMat.emissive.setHSL(hue, 0.95, 0.62);
    S.ringPrismInnerMat.emissive.setHSL((hue + 0.35) % 1, 1.0, 0.68);
    S.ringPrismGlowMat.color.setHSL((hue + 0.15) % 1, 0.95, 0.72);

    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.age += dt;
      p.mesh.position.z += scroll * dt;
      if (p.kind === 'ring') {
        // Promote final ring of an unbroken chain into an unmistakable Prismatic Rainbow Ring!
        if (!p.prismatic && p.chainId && p.chainIndex === p.chainTotal - 1) {
          const ch = this._chains.get(p.chainId);
          if (ch && ch.missed === 0 && ch.collected === ch.total - 1) {
            p.prismatic = true;
            if (p.ringOuter) p.ringOuter.material = S.ringPrismOuterMat;
            if (p.ringInner) {
              p.ringInner.material = S.ringPrismInnerMat;
              for (const child of p.ringInner.children) child.material = S.ringPrismInnerMat;
            }
            if (p.ringGlow) { p.ringGlow.material = S.ringPrismGlowMat; p.ringGlow.scale.setScalar(13.8); }
            p.mesh.scale.setScalar(1.16);
          }
        }
        p.mesh.rotation.y = Math.sin(p.age * 1.4) * 0.48;
        if (p.mesh.userData.innerRing) p.mesh.userData.innerRing.rotation.z += dt * (p.prismatic ? 5.6 : 2.8);
      } else {
        const icon = p.mesh.children[0];
        icon.rotation.y += dt * 2.0;
        if (icon.userData.halo) {
          icon.userData.halo.rotation.x += dt * 2.2;
          icon.userData.halo.rotation.y -= dt * 1.3;
        }
        if (icon.userData.halo2) {
          icon.userData.halo2.rotation.y += dt * 2.7;
          icon.userData.halo2.rotation.z -= dt * 1.6;
        }
        icon.position.y = Math.sin(p.age * 2.2) * 0.6;
      }
      const m = p.mesh.position;
      _v1.set(player.x, player.y, PLAYER_Z);
      const dist = _v1.distanceTo(m);
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
        let chainInfo = null;
        if (p.kind === 'ring' && p.chainId) {
          const ch = this._chains.get(p.chainId);
          if (ch) {
            ch.collected++;
            const complete = ch.missed === 0 && ch.collected >= ch.total;
            chainInfo = {
              chainStep: ch.missed === 0 ? ch.collected : 0,
              chainTotal: ch.total,
              chainComplete: complete,
            };
            if (ch.collected + ch.missed >= ch.total) this._chains.delete(p.chainId);
          }
        }
        onCollect(p.kind, m, chainInfo);
        this.remove(p);
        continue;
      }
      if (m.z > 30) {
        if (p.kind === 'ring' && p.chainId) {
          const ch = this._chains.get(p.chainId);
          if (ch) {
            ch.missed++;
            if (ch.collected + ch.missed >= ch.total) this._chains.delete(p.chainId);
          }
        }
        this.remove(p);
      }
    }
  }

  remove(p) {
    this.scene.remove(p.mesh);
    const i = this.list.indexOf(p);
    if (i >= 0) this.list.splice(i, 1);
  }

  clear() {
    for (const p of [...this.list]) this.remove(p);
    this._chains.clear();
  }
}
