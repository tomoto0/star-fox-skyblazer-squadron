import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { rand, TAU } from './util.js';

/**
 * Flung wreckage fragments on kills — real low-poly chunks from the Kenney
 * Space Kit (CC0): meteor halves, rock shards, crystals and mechanical bits.
 * A GLB is loaded once, each mesh geometry is normalised to unit radius, then
 * a pool of reusable meshes borrows those geometries and tumbles away with a
 * hot emissive glow that cools as it flies.
 */
const FILES = ['meteor_half', 'meteor', 'rocks_a', 'rocks_b', 'crystals', 'part_gun', 'part_barrel'];
const POOL = 72;

export class Debris {
  constructor(scene) {
    this.scene = scene;
    this.ready = false;
    this.frags = [];          // normalised geometries
    this.active = [];
    this.pool = [];

    const seed = new THREE.IcosahedronGeometry(1, 0);
    for (let i = 0; i < POOL; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0x9298a4, roughness: 0.62, metalness: 0.35,
        emissive: 0xff5a1e, emissiveIntensity: 0,
      });
      mat.flatShading = true;
      const m = new THREE.Mesh(seed, mat);
      m.visible = false;
      m.frustumCulled = false;
      m.userData = { vel: new THREE.Vector3(), ang: new THREE.Vector3(), life: 0, maxLife: 1, drag: 0.7, grav: -46, base: 1 };
      scene.add(m);
      this.pool.push(m);
    }
    this._load();
  }

  _load() {
    const loader = new GLTFLoader();
    let pending = FILES.length;
    const done = () => { if (--pending === 0) this.ready = this.frags.length > 0; };
    for (const f of FILES) {
      loader.load(`./assets/models/debris/${f}.glb`, (gltf) => {
        gltf.scene.traverse((o) => {
          if (o.isMesh && o.geometry) {
            const g = o.geometry.clone();
            g.computeBoundingSphere();
            const c = g.boundingSphere.center, r = g.boundingSphere.radius || 1;
            g.translate(-c.x, -c.y, -c.z);
            g.scale(1 / r, 1 / r, 1 / r);   // unit radius
            this.frags.push(g);
          }
        });
        done();
      }, undefined, done);
    }
  }

  /** spray fragments from a destroyed target */
  burst(x, y, z, opts = {}) {
    if (!this.ready) return;
    const count = opts.count ?? 6;
    const scale = opts.scale ?? 1;
    const spd = opts.speed ?? 1;
    const color = opts.color ?? 0x9aa0ac;
    for (let i = 0; i < count; i++) {
      const m = this.pool.find((p) => !p.visible);
      if (!m) break;
      m.geometry = this.frags[(Math.random() * this.frags.length) | 0];
      m.visible = true;
      m.position.set(x + rand(-1.5, 1.5), y + rand(-1.5, 1.5), z + rand(-1.5, 1.5));
      const base = scale * rand(0.55, 1.25);   // smaller shards
      m.scale.setScalar(base);
      m.rotation.set(rand(TAU), rand(TAU), rand(TAU));
      m.material.color.set(color);
      m.material.emissive.setHex(0xff6a24);
      m.material.emissiveIntensity = 1.5;
      const a = rand(TAU), el = rand(-0.4, 1.05), s = rand(26, 66) * spd;
      const u = m.userData;
      u.vel.set(Math.cos(a) * Math.cos(el) * s, Math.sin(el) * s + rand(8, 30), Math.sin(a) * Math.cos(el) * s);
      u.ang.set(rand(-9, 9), rand(-9, 9), rand(-9, 9));
      u.life = u.maxLife = rand(0.85, 1.7);
      u.base = base;
      this.active.push(m);
    }
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const m = this.active[i], u = m.userData;
      u.life -= dt;
      if (u.life <= 0) { m.visible = false; this.active.splice(i, 1); continue; }
      const dr = Math.exp(-u.drag * dt);
      u.vel.x *= dr; u.vel.z *= dr;
      u.vel.y = u.vel.y * dr + u.grav * dt;
      m.position.addScaledVector(u.vel, dt);
      m.rotation.x += u.ang.x * dt;
      m.rotation.y += u.ang.y * dt;
      m.rotation.z += u.ang.z * dt;
      const k = u.life / u.maxLife;                  // 1 -> 0
      m.material.emissiveIntensity = 1.5 * k * k;    // cools as it flies
      if (k < 0.3) m.scale.setScalar(u.base * (k / 0.3));   // shrink out (keeps depth-correct, no alpha)
    }
  }
}
