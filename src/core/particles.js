import * as THREE from 'three';
import { rand, dotTexture, TAU } from './util.js';

const MAX = 900;
const _c1 = new THREE.Color();
const _c2 = new THREE.Color();
const _cTmp = new THREE.Color();

/** pooled additive point particles + expanding shockwave rings */
export class Particles {
  constructor(scene) {
    this.scene = scene;
    this.budgetScale = 1.0;
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(MAX * 3);
    this.col = new Float32Array(MAX * 3);
    this.sizes = new Float32Array(MAX);
    this.vel = new Float32Array(MAX * 3);
    this.life = new Float32Array(MAX);
    this.maxLife = new Float32Array(MAX);
    this.drag = new Float32Array(MAX);
    this.grav = new Float32Array(MAX);
    this.baseSize = new Float32Array(MAX);
    this.head = 0;
    // Dense fixed buffers remain GPU-friendly, while this compact index list
    // avoids updating all 900 slots when only a small combat effect is alive.
    this.active = new Uint16Array(MAX);
    this.activeIndex = new Int16Array(MAX);
    this.activeIndex.fill(-1);
    this.activeCount = 0;
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.geo.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));

    this.mat = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: dotTexture() } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */`
        attribute float size;
        varying vec3 vColor;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (240.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        uniform sampler2D uTex;
        varying vec3 vColor;
        void main() {
          vec4 t = texture2D(uTex, gl_PointCoord);
          gl_FragColor = vec4(vColor, 1.0) * t;
        }`,
      vertexColors: true,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);

    // shockwave rings
    this.rings = [];
    this.ringGeo = new THREE.RingGeometry(0.86, 1, 40);
    this.ringPool = [];
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
      }));
      m.visible = false;
      scene.add(m);
      this.ringPool.push(m);
    }

    this._initSprites();
  }

  /* ---- textured billboard sprite FX (Kenney Particle Pack, CC0) ---- */
  _initSprites() {
    const loader = new THREE.TextureLoader();
    const load = (n) => {
      const t = loader.load(`./assets/particles/${n}.png`);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    };
    this.tex = {
      fire: [load('fire_01'), load('fire_02'), load('flame_04'), load('flame_05')],
      smoke: [load('smoke_01'), load('smoke_04'), load('smoke_07')],
      spark: [load('spark_01'), load('spark_05'), load('spark_07'), load('star_08')],
      flare: [load('flare_01'), load('light_01'), load('circle_05')],
      muzzle: [load('muzzle_04'), load('muzzle_05')],
    };
    // two pools so blend mode never has to change at runtime (avoids shader recompiles)
    const mkPool = (n, blending, seedTex) => {
      const arr = [];
      for (let i = 0; i < n; i++) {
        const mat = new THREE.SpriteMaterial({
          map: seedTex, transparent: true, depthWrite: false, blending,
          opacity: 0, fog: false, rotation: 0,
        });
        const s = new THREE.Sprite(mat);
        s.visible = false;
        s.userData = { life: 0, maxLife: 1, vel: new THREE.Vector3(), drag: 1.4, grav: 0, spin: 0, s0: 1, s1: 1, o0: 1, ease: 0.6 };
        this.scene.add(s);
        arr.push(s);
      }
      return arr;
    };
    this.addSprites = mkPool(200, THREE.AdditiveBlending, this.tex.fire[0]);   // fire / spark / flare / muzzle
    this.normSprites = mkPool(96, THREE.NormalBlending, this.tex.smoke[0]);    // smoke
    this._addHead = 0; this._normHead = 0;
    this._pending = [];   // delayed emissions for multi-stage blasts
  }

  /** Scale particle & sprite density smoothly for lightweight / adaptive quality tiers */
  setBudget(scale = 1.0) {
    this.budgetScale = Math.max(0.25, Math.min(1.0, scale));
  }

  /** schedule a callback after `delay` seconds (drives staged, rolling explosions) */
  _after(delay, fn) { this._pending.push({ t: delay, fn }); }

  _spawnSprite(add, tex, x, y, z, o) {
    if (this.budgetScale < 0.99 && Math.random() > this.budgetScale + 0.18) return;
    const pool = add ? this.addSprites : this.normSprites;
    const cap = Math.max(16, Math.round(pool.length * this.budgetScale));
    let idx = (add ? this._addHead : this._normHead) % cap;
    // find a free (or oldest) slot within the active budget cap
    let s = null;
    for (let k = 0; k < cap; k++) {
      const cand = pool[(idx + k) % cap];
      if (!cand.visible) { s = cand; idx = (idx + k + 1) % cap; break; }
    }
    if (!s) { s = pool[idx]; idx = (idx + 1) % cap; }   // steal oldest
    if (add) this._addHead = idx; else this._normHead = idx;
    s.visible = true;
    s.material.map = tex;
    s.material.color.set(o.color ?? 0xffffff);
    s.material.opacity = o.o0 ?? 1;
    s.material.rotation = o.rot ?? rand(TAU);
    s.position.set(x, y, z);
    s.scale.setScalar(o.s0);
    const u = s.userData;
    u.life = u.maxLife = o.life;
    u.vel.set(o.vx ?? 0, o.vy ?? 0, o.vz ?? 0);
    u.drag = o.drag ?? 1.4; u.grav = o.grav ?? 0; u.spin = o.spin ?? 0;
    u.s0 = o.s0; u.s1 = o.s1 ?? o.s0; u.o0 = o.o0 ?? 1; u.ease = o.ease ?? 0.6;
  }

  /** hot fireball licks — additive, grow & fade */
  fireball(x, y, z, s = 1, tint = 0xffd18a) {
    const n = 3 + Math.round(2 * s);
    for (let i = 0; i < n; i++) {
      const t = this.tex.fire[(Math.random() * this.tex.fire.length) | 0];
      this._spawnSprite(true, t, x + rand(-1, 1) * s, y + rand(-1, 1) * s, z + rand(-1, 1) * s, {
        color: i === 0 ? 0xffffff : tint, life: rand(0.42, 0.72),
        s0: rand(4, 7) * s, s1: rand(13, 20) * s, o0: 1, spin: rand(-2, 2),
        vx: rand(-8, 8) * s, vy: rand(2, 12) * s, vz: rand(-8, 8) * s, drag: 2.2,
      });
    }
  }

  /** rolling smoke — normal blending, rises and lingers */
  smoke(x, y, z, s = 1, tint = 0x4a4038) {
    const n = 2 + Math.round(2 * s);
    for (let i = 0; i < n; i++) {
      const t = this.tex.smoke[(Math.random() * this.tex.smoke.length) | 0];
      this._spawnSprite(false, t, x + rand(-2, 2) * s, y + rand(-1, 2) * s, z + rand(-2, 2) * s, {
        color: tint, life: rand(1.1, 1.9),
        s0: rand(5, 8) * s, s1: rand(18, 26) * s, o0: rand(0.4, 0.6), ease: 0.85,
        vx: rand(-6, 6) * s, vy: rand(6, 13) * s, vz: rand(-6, 6) * s, drag: 1.0, spin: rand(-1, 1),
      });
    }
  }

  /** bright flying sparks/embers — additive, fall under gravity */
  sparks(x, y, z, s = 1, color = 0xffe6a0) {
    const n = 6 + Math.round(6 * s);
    for (let i = 0; i < n; i++) {
      const t = this.tex.spark[(Math.random() * this.tex.spark.length) | 0];
      this._spawnSprite(true, t, x, y, z, {
        color, life: rand(0.4, 0.75),
        s0: rand(2.2, 4) * s, s1: 0.6, o0: 1, spin: rand(-6, 6),
        vx: rand(-1, 1) * 60 * s, vy: rand(6, 34) * s, vz: rand(-1, 1) * 60 * s, drag: 1.1, grav: -46,
      });
    }
  }

  /** instant blinding pop of light — additive flare */
  flash(x, y, z, s = 1, color = 0xfff2c8) {
    this._spawnSprite(true, this.tex.flare[0], x, y, z, {
      color, life: 0.22, s0: 3 * s, s1: 30 * s, o0: 1, ease: 0.3,
    });
    this._spawnSprite(true, this.tex.flare[1], x, y, z, {
      color, life: 0.34, s0: 4 * s, s1: 20 * s, o0: 0.85, ease: 0.5,
    });
  }

  /** short muzzle flash at a gun barrel, oriented randomly */
  muzzle(x, y, z, s = 1, color = 0xfff0c0) {
    const t = this.tex.muzzle[(Math.random() * this.tex.muzzle.length) | 0];
    this._spawnSprite(true, t, x, y, z, { color, life: 0.09, s0: 2 * s, s1: 6 * s, o0: 1, ease: 0.4 });
  }

  /** player laser discharge: sculpted cross-star muzzle flare + directional ion streaks + recoil ring */
  laserMuzzle(x, y, z, level = 1) {
    const hyper = level >= 3;
    const col = hyper ? 0x62d2ff : level === 2 ? 0x66ffbe : 0x8effca;
    this.muzzle(x, y, z, 0.78 + level * 0.20, col);
    this._spawnSprite(true, this.tex.spark[3], x, y, z - 0.25, {
      color: 0xffffff, life: 0.085, s0: 1.8 + level * 0.55, s1: 4.8 + level * 1.1, o0: 0.95, ease: 0.45,
    });
    this.emit(x, y, z, {
      count: hyper ? 6 : 4, speed: 24 + level * 8, vz: -72 - level * 12,
      color: 0xffffff, color2: col, life: 0.17, size: 1.35 + level * 0.20,
      drag: 3.4, spread: 0.24,
    });
    if (level >= 2) {
      this.ring(x, y, z - 0.5, { color: col, radius: hyper ? 3.8 : 2.6, dur: 0.12, from: 0.5, opacity: hyper ? 0.55 : 0.36 });
    }
    if (hyper) this.flash(x, y, z - 0.4, 0.46, col);
  }

  /** terrain chip: short material-aware response when shots strike cliffs or ground */
  terrainChip(x, y, z, zoneId = 'dune', scale = 1) {
    const p = {
      sea: { core: 0xd9f6ff, edge: 0x62b9e8, gravity: -24 },
      gorge: { core: 0xd4c9ad, edge: 0x75604d, gravity: -17 },
      ember: { core: 0xffd077, edge: 0xff562d, gravity: -28 },
      dune: { core: 0xf0cc83, edge: 0x9a6a3c, gravity: -19 },
    }[zoneId] ?? { core: 0xf0cc83, edge: 0x9a6a3c, gravity: -19 };
    this.flash(x, y, z, 0.24 * scale, p.core);
    this.emit(x, y, z, { count: 6, speed: 16 * scale, color: p.core, color2: p.edge, life: 0.32, size: 1.9 * scale, gravity: p.gravity, drag: 2.2, spread: 0.30 });
    if (zoneId === 'ember') this.sparks(x, y, z, 0.38 * scale, p.core);
  }

  /** metallic armour ricochet: crisp welding-arc spark shower + shock ring when shots/ships strike artificial structures */
  structureHit(x, y, z, scale = 1) {
    this.flash(x, y, z, 0.40 * scale, 0xfff3cc);
    this.sparks(x, y, z, 0.56 * scale, 0xffd47a);
    this.emit(x, y, z, {
      count: 9, speed: 32 * scale, vy: 8 * scale,
      color: 0xffffff, color2: 0xffa842, life: 0.34,
      size: 1.85 * scale, gravity: -38, drag: 1.7, spread: 0.35,
    });
    this.ring(x, y, z, { color: 0xffe29a, radius: 5.5 * scale, dur: 0.20, from: 0.8, opacity: 0.48 });
  }

  /** lightweight live exhaust trail for incoming homing missiles & player charge singularities */
  missileTrail(x, y, z, color = 0xff8a40, isCharge = false) {
    if (this.budgetScale < 0.6 && Math.random() > 0.5) return;
    this.emit(x, y, z, {
      count: isCharge ? 2 : 1,
      speed: isCharge ? 7 : 5,
      color: 0xffffff,
      color2: color,
      life: isCharge ? 0.24 : 0.20,
      size: isCharge ? 2.4 : 1.75,
      drag: 2.8,
      spread: isCharge ? 0.45 : 0.25,
    });
    if (!isCharge && this.budgetScale >= 0.72) {
      this._spawnSprite(false, this.tex.smoke[0], x, y, z, {
        color: 0x625a55, life: 0.34, s0: 1.4, s1: 3.8, o0: 0.28, ease: 0.8, drag: 1.6,
      });
    }
  }

  /** crisp glowing weapon-charge glint right before enemy fire or phase-dash */
  weaponTelegraph(x, y, z, color = 0xff7058, scale = 1) {
    this._spawnSprite(true, this.tex.spark[3], x, y, z, {
      color, life: 0.24, s0: 1.6 * scale, s1: 7.4 * scale, o0: 0.92, spin: 5, ease: 0.45,
    });
    this.ring(x, y, z, { color, radius: 4.8 * scale, dur: 0.22, from: 0.6, opacity: 0.42 });
  }

  /** Player laser contact: hot-white core flash, dual concentric plasma rings & precision armour sparks */
  laserImpact(x, y, z, level = 1, weak = false) {
    const hyper = level >= 3;
    const col = hyper ? 0x62ccff : level === 2 ? 0x56ffc6 : 0x9effe2;
    const scale = weak ? 1.5 : 1 + level * 0.14;
    this.flash(x, y, z, (weak ? 0.88 : 0.52) + level * 0.10, weak ? 0xffffff : col);
    this._spawnSprite(true, this.tex.spark[3], x, y, z, {
      color: 0xffffff, life: 0.18, s0: 2.4 * scale, s1: 9.2 * scale, o0: 0.96, spin: rand(-5, 5), ease: 0.42,
    });
    this.sparks(x, y, z, (weak ? 0.78 : 0.50) * scale, weak ? 0xffffff : col);
    this.emit(x, y, z, {
      count: (weak ? 12 : 8) + level * 2, speed: weak ? 34 : 25,
      color: 0xffffff, color2: col, life: weak ? 0.42 : 0.30,
      size: weak ? 2.5 : 1.95, drag: 2.5, spread: 0.48,
    });
    // Dual concentric shock rings (fast hot-white inner + colored outer wave)
    this.ring(x, y, z, { color: 0xffffff, radius: weak ? 8.5 : 4.8 + level * 0.7, dur: 0.18, from: 0.7, opacity: weak ? 0.68 : 0.50 });
    this.ring(x, y, z, { color: col, radius: weak ? 14.5 : 8.2 + level, dur: weak ? 0.40 : 0.28, from: 1.2, opacity: weak ? 0.54 : 0.38 });
  }

  /** small detonation when an enemy round hits the player / scenery — tinted per weapon */
  impact(x, y, z, type = 'orb', s = 1) {
    const heavy = type === 'heavy' || type === 'flak' || type === 'missile' || type === 'homing';
    const energy = type === 'plasma' || type === 'wave' || type === 'venom';
    const col = energy ? (type === 'venom' ? 0x9be23a : 0x6a9bff) : 0xffb060;
    this.flash(x, y, z, (heavy ? 0.9 : 0.5) * s, energy ? col : 0xfff2c8);
    if (heavy) { this.fireball(x, y, z, 0.6 * s, 0xffb070); this.sparks(x, y, z, 0.7 * s); }
    else this.sparks(x, y, z, (energy ? 0.5 : 0.4) * s, energy ? col : 0xffe6a0);
    this.smoke(x, y, z, (heavy ? 0.55 : 0.35) * s, 0x3a3230);   // real puff instead of a ring
    this.emit(x, y, z, { count: heavy ? 8 : 5, speed: 18 * s, color: col, color2: 0xffffff, life: 0.3, size: 2 * s, drag: 2.2 });
  }

  emit(x, y, z, opts = {}) {
    const rawN = opts.count ?? 10;
    const n = Math.max(1, Math.round(rawN * this.budgetScale));
    const spd = opts.speed ?? 20;
    _c1.set(opts.color ?? 0xffcc66);
    if (opts.color2 !== undefined) _c2.set(opts.color2);
    else _c2.copy(_c1);
    for (let k = 0; k < n; k++) {
      const i = this.head; this.head = (this.head + 1) % MAX;
      if (this.activeIndex[i] < 0) {
        this.activeIndex[i] = this.activeCount;
        this.active[this.activeCount++] = i;
      }
      const a = rand(TAU), b = Math.acos(rand(-1, 1));
      const s = spd * rand(0.3, 1);
      this.pos[i * 3] = x + rand(-1, 1) * (opts.spread ?? 0.5);
      this.pos[i * 3 + 1] = y + rand(-1, 1) * (opts.spread ?? 0.5);
      this.pos[i * 3 + 2] = z + rand(-1, 1) * (opts.spread ?? 0.5);
      this.vel[i * 3] = Math.sin(b) * Math.cos(a) * s + (opts.vx ?? 0);
      this.vel[i * 3 + 1] = Math.cos(b) * s + (opts.vy ?? 0);
      this.vel[i * 3 + 2] = Math.sin(b) * Math.sin(a) * s + (opts.vz ?? 0);
      _cTmp.copy(_c1).lerp(_c2, Math.random());
      this.col[i * 3] = _cTmp.r; this.col[i * 3 + 1] = _cTmp.g; this.col[i * 3 + 2] = _cTmp.b;
      this.maxLife[i] = this.life[i] = (opts.life ?? 0.8) * rand(0.6, 1.15);
      this.baseSize[i] = (opts.size ?? 2.4) * rand(0.6, 1.4);
      this.drag[i] = opts.drag ?? 1.6;
      this.grav[i] = opts.gravity ?? 0;
    }
  }

  ring(x, y, z, opts = {}) {
    const m = this.ringPool.find((r) => !r.visible);
    if (!m) return;
    m.visible = true;
    m.position.set(x, y, z);
    m.material.color.set(opts.color ?? 0xffffff);
    m.material.opacity = opts.opacity ?? 0.9;
    m.userData = { t: 0, dur: opts.dur ?? 0.5, from: opts.from ?? 1, to: opts.to ?? (opts.radius ?? 16), horizontal: !!opts.horizontal, op: opts.opacity ?? 0.85 };
    m.rotation.set(opts.horizontal ? -Math.PI / 2 : 0, 0, 0);
    m.scale.setScalar(m.userData.from);
  }

  explosion(x, y, z, big = false, scaleMul = 1) {
    const m = scaleMul;
    const s = (big ? 2.8 : 1.35) * m;
    // Multi-layered fiery detonation scaled for visceral close-range impact!
    this.flash(x, y, z, (big ? 2.7 : 1.45) * m);
    this.fireball(x, y, z, (big ? 2.9 : 1.65) * m);
    this.smoke(x, y, z, (big ? 2.5 : 1.3) * m);
    this.sparks(x, y, z, (big ? 2.3 : 1.35) * m);
    // Fiery inner embers + fast flying glow sparks
    this.emit(x, y, z, { count: Math.round((big ? 28 : 14) * Math.min(m, 1.4)), speed: 34 * s, color: 0xfff5b8, color2: 0xff8028, life: 0.65, size: 4.0 * s, drag: 2.3 });
    this.emit(x, y, z, { count: Math.round((big ? 18 : 9) * Math.min(m, 1.4)), speed: 19 * s, color: 0xff5a28, color2: 0x992010, life: 1.05, size: 5.2 * s, drag: 1.7 });
    // Crisp dual-plane shockwave rings (vertical plasma flash + horizontal blast wave on big kills!)
    this.ring(x, y, z, { color: big ? 0xfff5e0 : 0xffbe74, radius: (big ? 80 : 32) * m, dur: big ? 0.44 : 0.30, from: big ? 4 : 2, opacity: big ? 0.48 : 0.38 });
    this.ring(x, y, z, { color: big ? 0xff9248 : 0xffe8b4, radius: (big ? 58 : 22) * m, dur: big ? 0.52 : 0.26, from: 1.5, horizontal: true, opacity: big ? 0.36 : 0.28 });
    if (big) {
      this._after(0.08, () => { this.fireball(x + rand(-9, 9) * m, y + rand(2, 10) * m, z + rand(-6, 6), 2.2 * m); this.sparks(x, y, z, 1.5 * m); });
      this._after(0.19, () => { this.fireball(x + rand(-10, 10) * m, y + rand(6, 13) * m, z + rand(-6, 6), 1.9 * m); this.smoke(x, y + 6, z, 2.1 * m); });
      this._after(0.34, () => this.smoke(x, y + 14, z, 1.9 * m));
    }
  }

  /** Zone-specific material response layered over the common fireball. */
  zoneResidue(x, y, z, zoneId = 'dune', big = false) {
    const s = big ? 1.35 : 0.72;
    if (zoneId === 'sea') {
      this.emit(x, y, z, { count: big ? 26 : 12, speed: 22 * s, vy: 13 * s, color: 0xd7f6ff, color2: 0x67b9e6, life: 0.75, size: 2.6 * s, gravity: -28, drag: 1.05, spread: 2.4 });
      this.smoke(x, y + 2, z, 0.7 * s, 0x718a96);
      this.ring(x, Math.max(0.5, y - 1), z, { color: 0x9eeeff, radius: big ? 34 : 16, dur: 0.55, horizontal: true, opacity: 0.32 });
    } else if (zoneId === 'gorge') {
      this.emit(x, y, z, { count: big ? 24 : 10, speed: 18 * s, color: 0xc7d4d4, color2: 0x65594c, life: 1.05, size: 4.2 * s, gravity: -18, drag: 1.45, spread: 1.8 });
      this.smoke(x, y + 2, z, 1.05 * s, 0x6f746f);
    } else if (zoneId === 'ember') {
      this.emit(x, y, z, { count: big ? 30 : 16, speed: 35 * s, color: 0xffc36d, color2: 0xff4328, life: 0.95, size: 3.3 * s, gravity: -28, drag: 1.2, spread: 1.8 });
      this.sparks(x, y + 2, z, 1.35 * s, 0xff8b42);
      this.smoke(x, y + 4, z, 1.2 * s, 0x35252a);
    } else {
      this.emit(x, y, z, { count: big ? 28 : 14, speed: 20 * s, color: 0xf0c47d, color2: 0x9a673c, life: 1.05, size: 4.8 * s, gravity: -20, drag: 1.35, spread: 2.1 });
      this.smoke(x, y + 2, z, 1.15 * s, 0xa9875f);
      if (big) this.ring(x, Math.max(0.5, y - 1), z, { color: 0xffd990, radius: 38, dur: 0.65, horizontal: true, opacity: 0.28 });
    }
  }

  /** big multi-layer bomb detonation: flash + fireball + smoke + debris + shockwaves */
  bombBlast(x, y, z, s = 1) {
    // ---- stage 0: blinding flash + dense core fireball cluster ----
    this.flash(x, y, z, 3.8 * s, 0xffffff);
    this.flash(x, y, z, 2.5 * s, 0xffe6b0);
    for (let i = 0; i < Math.round(4 + s * 4); i++) {
      const a = rand(TAU), r = rand(0, 13) * s;
      this.fireball(x + Math.cos(a) * r, y + rand(-3, 10) * s, z + Math.sin(a) * r, 1.8 * s);
    }
    this.sparks(x, y, z, 3.4 * s);
    this.smoke(x, y, z, 3.4 * s);
    this.smoke(x, y + 7 * s, z, 2.7 * s);
    // point-sprite core layers (fine grain)
    this.emit(x, y, z, { count: Math.round(54 * s), speed: 86 * s, color: 0xffffff, color2: 0xffe89a, life: 0.42, size: 7.5 * s, drag: 2.8, spread: 2.5 });
    this.emit(x, y, z, { count: Math.round(66 * s), speed: 60 * s, color: 0xffc250, color2: 0xff4d1e, life: 1.15, size: 12 * s, drag: 1.6, spread: 3.5 });
    this.emit(x, y, z, { count: Math.round(38 * s), speed: 34 * s, color: 0xff7a2a, color2: 0x8a1e10, life: 1.5, size: 14 * s, drag: 1.3, spread: 3.5 });
    // dark smoke that rises + lingers
    this.emit(x, y, z, { count: Math.round(42 * s), speed: 28 * s, color: 0x4a2c22, color2: 0x241612, life: 2.2, size: 17 * s, drag: 1.05, gravity: 8, spread: 4.5 });
    // fast debris sparks
    this.emit(x, y, z, { count: Math.round(42 * s), speed: 120 * s, color: 0xffe6a0, color2: 0xff8040, life: 0.78, size: 2.6 * s, drag: 1.1, gravity: -34 });
    // ---- blast waves: brief and translucent, fire/smoke carry the visual ----
    this.ring(x, y, z, { color: 0xfff4e6, radius: 132 * s, dur: 0.42, from: 5, opacity: 0.38 });
    this.ring(x, y, z, { color: 0xffdfba, radius: 172 * s, dur: 0.85, from: 6, horizontal: true, opacity: 0.26 });
    // ---- staged rolling detonations + billowing column ----
    const roll = (dly, rad, size) => this._after(dly, () => {
      for (let i = 0; i < 3; i++) {
        const a = rand(TAU);
        this.fireball(x + Math.cos(a) * rad * s, y + rand(-2, 11) * s, z + Math.sin(a) * rad * s, size * s);
      }
      this.smoke(x + rand(-8, 8) * s, y + rand(2, 10) * s, z, 1.2 * s);   // churn, not hoops
    });
    roll(0.10, 16, 1.6);
    roll(0.22, 32, 1.35);
    roll(0.36, 50, 1.1);
    this._after(0.30, () => { this.smoke(x, y + 15 * s, z, 2.7 * s); this.sparks(x, y + 6, z, 1.7 * s); });
    this._after(0.55, () => this.smoke(x, y + 24 * s, z, 2.4 * s));
    this._after(0.85, () => this.smoke(x, y + 32 * s, z, 2.0 * s));
  }

  splash(x, z) {
    this.emit(x, 1, z, { count: 8, speed: 9, vy: 8, color: 0xcfe8ff, color2: 0x7db8e8, life: 0.6, size: 2.6, gravity: -22 });
    this.ring(x, 0.7, z, { color: 0xbfe0ff, radius: 10, dur: 0.7, horizontal: true, opacity: 0.5 });
  }

  update(dt) {
    let dirty = false;
    // Iterate the active compact list backwards, removing expired entries in
    // O(1). Slots may still be overwritten by the ring head, but never need a
    // second list entry.
    for (let slot = this.activeCount - 1; slot >= 0; slot--) {
      const i = this.active[slot];
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.life[i] = 0; this.sizes[i] = 0; dirty = true;
        const lastSlot = --this.activeCount;
        const last = this.active[lastSlot];
        if (slot !== lastSlot) { this.active[slot] = last; this.activeIndex[last] = slot; }
        this.activeIndex[i] = -1;
        continue;
      }
      const j = i * 3;
      const dr = Math.exp(-this.drag[i] * dt);
      this.vel[j] *= dr;
      this.vel[j + 1] = this.vel[j + 1] * dr + this.grav[i] * dt;
      this.vel[j + 2] *= dr;
      this.pos[j] += this.vel[j] * dt;
      this.pos[j + 1] += this.vel[j + 1] * dt;
      this.pos[j + 2] += this.vel[j + 2] * dt;
      const k = this.life[i] / this.maxLife[i];
      this.sizes[i] = this.baseSize[i] * (k < 0.85 ? k + 0.15 : (1 - k) * 6.6 + 0.15);
      this.col[j] *= (1 - dt * 0.4); this.col[j + 1] *= (1 - dt * 0.55); this.col[j + 2] *= (1 - dt * 0.6);
      dirty = true;
    }
    this.points.visible = this.activeCount > 0;
    if (dirty) {
      this.geo.attributes.position.needsUpdate = true;
      this.geo.attributes.color.needsUpdate = true;
      this.geo.attributes.size.needsUpdate = true;
    }

    for (const m of this.ringPool) {
      if (!m.visible) continue;
      const u = m.userData;
      u.t += dt;
      const k = u.t / u.dur;
      if (k >= 1) { m.visible = false; continue; }
      const e = 1 - Math.pow(1 - k, 3);
      m.scale.setScalar(u.from + (u.to - u.from) * e);
      m.material.opacity = (1 - k) * u.op;
    }

    // staged/delayed emissions
    if (this._pending.length) {
      for (let i = this._pending.length - 1; i >= 0; i--) {
        const p = this._pending[i];
        p.t -= dt;
        if (p.t <= 0) { p.fn(); this._pending.splice(i, 1); }
      }
    }

    // textured billboard sprites
    this._updateSprites(this.addSprites, dt);
    this._updateSprites(this.normSprites, dt);
  }

  _updateSprites(pool, dt) {
    for (const s of pool) {
      if (!s.visible) continue;
      const u = s.userData;
      u.life -= dt;
      if (u.life <= 0) { s.visible = false; s.material.opacity = 0; continue; }
      const dr = Math.exp(-u.drag * dt);
      u.vel.x *= dr; u.vel.z *= dr;
      u.vel.y = u.vel.y * dr + u.grav * dt;
      s.position.x += u.vel.x * dt;
      s.position.y += u.vel.y * dt;
      s.position.z += u.vel.z * dt;
      s.material.rotation += u.spin * dt;
      const k = u.life / u.maxLife;           // 1 -> 0
      const grow = 1 - k;                      // 0 -> 1
      s.scale.setScalar(u.s0 + (u.s1 - u.s0) * grow);
      s.material.opacity = u.o0 * Math.pow(k, u.ease);
    }
  }
}
