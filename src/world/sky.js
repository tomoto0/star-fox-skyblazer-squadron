import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { rand, TAU } from '../core/util.js';

/**
 * Gradient sky dome with sun disc + halo, plus a field of cel-shaded
 * billboard clouds. All colors lerp smoothly on zone change.
 */
export class Sky {
  constructor(scene) {
    this.scene = scene;

    this.uniforms = {
      uTop: { value: new THREE.Color(0x27356e) },
      uMid: { value: new THREE.Color(0xb3547a) },
      uHorizon: { value: new THREE.Color(0xff9e4a) },
      uSunColor: { value: new THREE.Color(0xfff3c8) },
      uSunGlow: { value: new THREE.Color(0xffb347) },
      uSunSize: { value: 0.055 },
      uSunDir: { value: new THREE.Vector3(0.1, 0.05, -1).normalize() },
    };
    this._target = null; this._from = null; this._blend = 1;

    const geo = new THREE.SphereGeometry(1600, 32, 24);
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: /* glsl */`
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uTop, uMid, uHorizon, uSunColor, uSunGlow;
        uniform float uSunSize;
        uniform vec3 uSunDir;
        varying vec3 vDir;
        void main() {
          float h = clamp(vDir.y, -0.12, 1.0);
          vec3 col;
          if (h < 0.14) col = mix(uHorizon, uMid, smoothstep(-0.05, 0.14, h) * 0.55);
          col = mix(uHorizon, uMid, smoothstep(-0.03, 0.22, h));
          col = mix(col, uTop, smoothstep(0.16, 0.75, h));
          float d = distance(normalize(vDir), uSunDir);
          if (uSunSize > 0.001) {
            float disc = 1.0 - smoothstep(uSunSize * 0.82, uSunSize, d);
            float halo = pow(clamp(1.0 - d * 1.15, 0.0, 1.0), 3.2);
            col = mix(col, uSunGlow, halo * 0.75);
            col = mix(col, uSunColor, disc);
          } else {
            float halo = pow(clamp(1.0 - d * 0.9, 0.0, 1.0), 4.0);
            col = mix(col, uSunGlow, halo * 0.35);
          }
          // subtle banding for the painted look
          col += (fract(sin(dot(vDir.xy, vec2(12.9898,78.233))) * 43758.5453) - 0.5) * 0.012;
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.dome = new THREE.Mesh(geo, mat);
    this.dome.renderOrder = -100;
    scene.add(this.dome);

    this._initPhotoSky();
    this._buildClouds();
  }

  /**
   * Zone skyboxes: compact 1K CC0 HDRIs are rendered directly on the
   * equirectangular shells. The gradient dome and drifting clouds remain in
   * place, so each zone retains its stylised readability while gaining an
   * individual horizon, cloud structure, and time-of-day light character.
   */
  _initPhotoSky() {
    const loader = new RGBELoader();
    const skyboxes = {
      // warm harbour water at sunset; distant physical horizon stays behind the ocean
      sky_sea: './assets/skyboxes/sea_harbour_sunset_1k.hdr',
      // a bright rocky valley for the water-cut canyon and its waterfalls
      sky_day: './assets/skyboxes/gorge_valley_1k.hdr',
      // cool-violet sunset with a low orange band, amplified by Ember's lava palette
      sky_sunset: './assets/skyboxes/ember_industrial_sunset_1k.hdr',
      // hard, cloudless desert illumination for dune ridges and rift silhouettes
      sky_desert: './assets/skyboxes/dune_goegap_1k.hdr',
    };
    this.skyTex = {};
    for (const [key, path] of Object.entries(skyboxes)) {
      const t = loader.load(path);
      t.mapping = THREE.EquirectangularReflectionMapping;
      t.colorSpace = THREE.LinearSRGBColorSpace;
      t.anisotropy = 4;
      // Sky is visual-only: a PMREM conversion of HDR FloatType textures is
      // unreliable on the low-capability WebGL validator used in QA.
      t.userData.skyboxOnly = true;
      this.skyTex[key] = t;
    }
    const geo = new THREE.SphereGeometry(1500, 48, 32);
    this.photoDomes = [];
    for (let i = 0; i < 2; i++) {
      const mat = new THREE.MeshBasicMaterial({
        side: THREE.BackSide, transparent: true, opacity: 0,
        depthWrite: false, fog: false, toneMapped: true, color: 0xf2ede6,
      });
      const m = new THREE.Mesh(geo, mat);
      m.renderOrder = -99;
      m.frustumCulled = false;
      m.userData = { op: 0, dur: 2.5 };
      this.scene.add(m);
      this.photoDomes.push(m);
    }
    this._photoFront = 0;
    this._skyKey = null;
  }

  /** cross-fade the photographic sky to a new equirect image */
  setPhoto(key, dur = 2.5, opacity = 0.9) {
    if (!this.skyTex || key === this._skyKey || !this.skyTex[key]) return;
    const back = this.photoDomes[this._photoFront ^ 1];
    const front = this.photoDomes[this._photoFront];
    back.material.map = this.skyTex[key];
    back.material.needsUpdate = true;
    back.userData.op = opacity; back.userData.dur = Math.max(dur, 0.001);
    front.userData.op = 0; front.userData.dur = Math.max(dur, 0.001);
    this._photoFront ^= 1;
    this._skyKey = key;
  }

  _cloudTexture() {
    // soft, volumetric cel cloud: many overlapping radial puffs, top-lit with a
    // cool shaded underbelly, so it reads as a fluffy 3D cumulus rather than a blob
    const W = 512, H = 256;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.clearRect(0, 0, W, H);

    // build a cluster of puffs along a rounded cumulus silhouette
    const puffs = [];
    let x = 60;
    const baseY = H * 0.66;
    while (x < W - 60) {
      const r = rand(38, 78);
      const hump = Math.sin((x / W) * Math.PI);           // taller in the middle
      const py = baseY - r * 0.5 - hump * 40 + rand(-10, 10);
      puffs.push([x, py, r]);
      x += r * rand(0.7, 1.0);
    }
    // extra smaller top puffs for a billowy crown
    for (let i = 0; i < 8; i++) {
      const p = puffs[Math.floor(rand(1, puffs.length - 1))];
      puffs.push([p[0] + rand(-30, 30), p[1] - rand(20, 55), rand(24, 48)]);
    }

    const softPuff = (bx, by, r, top, bottom) => {
      const grd = g.createRadialGradient(bx, by - r * 0.25, r * 0.1, bx, by, r);
      grd.addColorStop(0, top);
      grd.addColorStop(0.7, top);
      grd.addColorStop(1, bottom);
      g.fillStyle = grd;
      g.beginPath(); g.arc(bx, by, r, 0, TAU); g.fill();
    };
    // shaded underbelly pass (cool blue-grey, offset down)
    for (const [bx, by, r] of puffs) softPuff(bx, by + r * 0.32, r * 1.02, 'rgba(178,196,222,0.9)', 'rgba(178,196,222,0)');
    // main body pass (bright, top-lit)
    for (const [bx, by, r] of puffs) softPuff(bx, by, r, 'rgba(255,255,255,1)', 'rgba(230,238,248,0)');
    // crisp highlight caps on top edges
    for (const [bx, by, r] of puffs) softPuff(bx, by - r * 0.42, r * 0.55, 'rgba(255,255,255,1)', 'rgba(255,255,255,0)');

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  _buildClouds() {
    this.clouds = new THREE.Group();
    this.cloudMats = [];
    for (let i = 0; i < 5; i++) {
      const tex = this._cloudTexture();
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.95, fog: false, depthWrite: false });
      this.cloudMats.push(mat);
    }
    // three depth bands: distant haze, mid, and closer drifting cumulus
    const bands = [
      { n: 14, dist: [1500, 2200], y: [180, 520], s: [420, 720], op: 0.6 },
      { n: 16, dist: [950, 1500], y: [120, 400], s: [260, 500], op: 0.9 },
      { n: 12, dist: [560, 950], y: [70, 260], s: [150, 320], op: 1.0 },
    ];
    for (const band of bands) {
      for (let i = 0; i < band.n; i++) {
        const spr = new THREE.Sprite(this.cloudMats[Math.floor(rand(0, 5))]);
        const ang = rand(-1.35, 1.35);
        const dist = rand(band.dist[0], band.dist[1]);
        const y = rand(band.y[0], band.y[1]);
        spr.position.set(Math.sin(ang) * dist, y, -Math.cos(ang) * dist);
        const s = rand(band.s[0], band.s[1]);
        spr.scale.set(s, s * 0.52, 1);
        spr.userData.drift = rand(1.2, 5) * (band.dist[0] < 800 ? 1.6 : 1);
        spr.userData.bandOp = band.op;
        this.clouds.add(spr);
      }
    }
    this.scene.add(this.clouds);
  }

  /** apply zone palette; blends over `dur` seconds */
  setZone(zone, dur = 2.5) {
    const s = zone.sky;
    this._from = this._snapshot();
    this._target = {
      top: new THREE.Color(s.top), mid: new THREE.Color(s.mid), horizon: new THREE.Color(s.horizon),
      sun: new THREE.Color(s.sun), glow: new THREE.Color(s.sunGlow), size: s.sunSize,
      dir: new THREE.Vector3(...(zone.sun.pos)).normalize().setY(Math.max(zone.sky.sunY, 0.02)).normalize(),
      cloudTint: new THREE.Color(s.cloudTint), cloudOp: s.clouds,
    };
    this._blend = dur <= 0 ? 1 : 0;
    this._dur = Math.max(dur, 0.0001);
    if (dur <= 0) this._apply(this._target);
    if (zone.skyImage) this.setPhoto(zone.skyImage, dur <= 0 ? 0.4 : dur, zone.photoOpacity ?? 0.9);
  }

  _snapshot() {
    const u = this.uniforms;
    return {
      top: u.uTop.value.clone(), mid: u.uMid.value.clone(), horizon: u.uHorizon.value.clone(),
      sun: u.uSunColor.value.clone(), glow: u.uSunGlow.value.clone(), size: u.uSunSize.value,
      dir: u.uSunDir.value.clone(),
      cloudTint: this.cloudMats[0].color.clone(), cloudOp: this.cloudMats[0].opacity,
    };
  }

  _apply(t, f = null, k = 1) {
    const u = this.uniforms;
    const mix = (a, b) => a.clone().lerp(b, k);
    u.uTop.value.copy(f ? mix(f.top, t.top) : t.top);
    u.uMid.value.copy(f ? mix(f.mid, t.mid) : t.mid);
    u.uHorizon.value.copy(f ? mix(f.horizon, t.horizon) : t.horizon);
    u.uSunColor.value.copy(f ? mix(f.sun, t.sun) : t.sun);
    u.uSunGlow.value.copy(f ? mix(f.glow, t.glow) : t.glow);
    u.uSunSize.value = f ? f.size + (t.size - f.size) * k : t.size;
    u.uSunDir.value.copy(f ? mix(f.dir, t.dir).normalize() : t.dir);
    for (const m of this.cloudMats) {
      m.color.copy(f ? mix(f.cloudTint, t.cloudTint) : t.cloudTint);
      m.opacity = (f ? f.cloudOp + (t.cloudOp - f.cloudOp) * k : t.cloudOp) * 0.92;
    }
  }

  update(dt, camera) {
    if (this._target && this._blend < 1) {
      this._blend = Math.min(1, this._blend + dt / this._dur);
      this._apply(this._target, this._from, this._blend * this._blend * (3 - 2 * this._blend));
    }
    this.dome.position.copy(camera.position);
    for (const m of this.photoDomes) {
      m.position.copy(camera.position);
      const u = m.userData;
      if (m.material.opacity !== u.op) {
        const step = dt / u.dur;
        m.material.opacity += Math.sign(u.op - m.material.opacity) * Math.min(step, Math.abs(u.op - m.material.opacity));
      }
    }
    for (const c of this.clouds.children) {
      c.position.x += c.userData.drift * dt;
      if (c.position.x > 1500) c.position.x = -1500;
    }
  }
}
