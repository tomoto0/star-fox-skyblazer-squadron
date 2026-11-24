import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { rand, TAU } from '../core/util.js';

/**
 * Painterly Star Fox sky dome with blazing sun disc + atmospheric glow,
 * distant ringed Lylat-style planet silhouette, subtle mountain horizon band,
 * and luminous rim-lit cel-shaded cumulus clouds.
 */
export class Sky {
  constructor(scene) {
    this.scene = scene;

    this.uniforms = {
      uTop: { value: new THREE.Color(0x1c4b8f) },
      uMid: { value: new THREE.Color(0xc46b88) },
      uHorizon: { value: new THREE.Color(0xffbe74) },
      uSunColor: { value: new THREE.Color(0xfff6cf) },
      uSunGlow: { value: new THREE.Color(0xffa64d) },
      uSunSize: { value: 0.056 },
      uSunDir: { value: new THREE.Vector3(0.14, 0.13, -1).normalize() },
    };
    this._target = null; this._from = null; this._blend = 1;

    const geo = new THREE.SphereGeometry(1650, 36, 24);
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
          vec3 dir = normalize(vDir);
          float h = clamp(dir.y, -0.14, 1.0);
          vec3 col = mix(uHorizon, uMid, smoothstep(-0.02, 0.24, h));
          col = mix(col, uTop, smoothstep(0.18, 0.72, h));

          // Radiant atmospheric horizon scatter band
          float horizonBand = exp(-pow((h - 0.02) * 9.0, 2.0));
          col = mix(col, uSunGlow, horizonBand * 0.22);

          float d = distance(dir, uSunDir);
          if (uSunSize > 0.001) {
            float disc = 1.0 - smoothstep(uSunSize * 0.80, uSunSize, d);
            float halo = pow(clamp(1.0 - d * 1.05, 0.0, 1.0), 2.8);
            float outerGlow = pow(clamp(1.0 - d * 0.62, 0.0, 1.0), 3.6);
            col = mix(col, uSunGlow, halo * 0.72 + outerGlow * 0.24);
            col = mix(col, uSunColor, disc);
          } else {
            float halo = pow(clamp(1.0 - d * 0.85, 0.0, 1.0), 3.6);
            col = mix(col, uSunGlow, halo * 0.35);
          }

          // Subtle painterly grain so smooth gradients never band
          col += (fract(sin(dot(dir.xy, vec2(12.9898,78.233))) * 43758.5453) - 0.5) * 0.009;
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.dome = new THREE.Mesh(geo, mat);
    this.dome.renderOrder = -100;
    scene.add(this.dome);

    this._initPhotoSky();
    this._buildPlanetAndHorizon();
    this._buildClouds();
  }

  _initPhotoSky() {
    const loader = new RGBELoader();
    const skyboxes = {
      sky_sea: './assets/skyboxes/sea_harbour_sunset_1k.hdr',
      sky_day: './assets/skyboxes/gorge_valley_1k.hdr',
      sky_sunset: './assets/skyboxes/ember_industrial_sunset_1k.hdr',
      sky_desert: './assets/skyboxes/dune_goegap_1k.hdr',
    };
    this.skyTex = {};
    for (const [key, path] of Object.entries(skyboxes)) {
      const t = loader.load(path);
      t.mapping = THREE.EquirectangularReflectionMapping;
      t.colorSpace = THREE.LinearSRGBColorSpace;
      t.anisotropy = 4;
      t.userData.skyboxOnly = true;
      this.skyTex[key] = t;
    }
    const geo = new THREE.SphereGeometry(1560, 40, 28);
    this.photoDomes = [];
    for (let i = 0; i < 2; i++) {
      const mat = new THREE.MeshBasicMaterial({
        side: THREE.BackSide, transparent: true, opacity: 0,
        depthWrite: false, fog: false, toneMapped: true, color: 0xf5f0ea,
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

  /** Sci-fi Lylat sky signature: giant hazy ringed planet in upper-right sky + mountain horizon ridge */
  _buildPlanetAndHorizon() {
    this.skyDecor = new THREE.Group();
    this.skyDecor.renderOrder = -95;

    // Giant distant atmospheric planet (like STAR_FOX_5.jpg)
    this.planetGroup = new THREE.Group();
    const planetCanvas = document.createElement('canvas');
    planetCanvas.width = planetCanvas.height = 256;
    const pg = planetCanvas.getContext('2d');
    const grd = pg.createRadialGradient(92, 86, 18, 128, 128, 124);
    grd.addColorStop(0, 'rgba(255,255,255,0.92)');
    grd.addColorStop(0.55, 'rgba(220,228,248,0.68)');
    grd.addColorStop(0.84, 'rgba(130,150,205,0.28)');
    grd.addColorStop(1, 'rgba(90,110,170,0)');
    pg.fillStyle = grd;
    pg.beginPath(); pg.arc(128, 128, 124, 0, TAU); pg.fill();
    // Subtle atmospheric cloud bands across the planet disc
    pg.globalCompositeOperation = 'source-atop';
    for (let i = 0; i < 7; i++) {
      pg.fillStyle = i % 2 ? 'rgba(255,255,255,0.14)' : 'rgba(60,70,115,0.15)';
      pg.fillRect(0, 26 + i * 30, 256, 12 + (i % 3) * 5);
    }
    const pTex = new THREE.CanvasTexture(planetCanvas);
    pTex.colorSpace = THREE.SRGBColorSpace;
    this.planetMat = new THREE.SpriteMaterial({
      map: pTex, color: 0xd8a8c6, transparent: true, opacity: 0.42,
      depthWrite: false, fog: false,
    });
    const planetSpr = new THREE.Sprite(this.planetMat);
    planetSpr.scale.set(540, 540, 1);
    this.planetGroup.add(planetSpr);

    this.ringMat = new THREE.MeshBasicMaterial({
      color: 0xffd2a0, transparent: true, opacity: 0.24, side: THREE.DoubleSide,
      depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
    });
    const pRing = new THREE.Mesh(new THREE.RingGeometry(245, 390, 48), this.ringMat);
    pRing.rotation.set(Math.PI * 0.41, 0.25, -0.34);
    this.planetGroup.add(pRing);
    // Secondary crisp outer orbital station track ring around the planet
    const outerRingMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.16, side: THREE.DoubleSide,
      depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
    });
    const outerRing = new THREE.Mesh(new THREE.RingGeometry(412, 424, 56), outerRingMat);
    outerRing.rotation.set(Math.PI * 0.41, 0.25, -0.34);
    this.planetGroup.add(outerRing);
    // Tiny companion moon + orbital defense beacon dots on the outer track
    const moon = new THREE.Sprite(new THREE.SpriteMaterial({
      map: pTex, color: 0xe8eefc, transparent: true, opacity: 0.56, depthWrite: false, fog: false,
    }));
    moon.scale.set(92, 92, 1);
    moon.position.set(-285, 130, 40);
    this.planetGroup.add(moon);

    this.planetGroup.position.set(580, 390, -1320);
    this.skyDecor.add(this.planetGroup);

    // Distant silhouetted double-layered horizon mountain ridge ring (anchors the sky to the terrain!)
    const ridgeGeo = new THREE.CylinderGeometry(1420, 1440, 225, 72, 1, true);
    const pos = ridgeGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y > 0) {
        const x = pos.getX(i), z = pos.getZ(i);
        const a = Math.atan2(z, x);
        const peaks = Math.sin(a * 7) * 34 + Math.sin(a * 17 + 1.3) * 22 + Math.cos(a * 29) * 12 + Math.sin(a * 47) * 6;
        // Leave a lower valley notch directly ahead (-Z) so the sun & sea horizon stay open
        const frontOpen = 1 - Math.exp(-Math.pow(Math.sin(a + Math.PI * 0.5) * 2.8, 2)) * 0.65;
        pos.setY(i, Math.max(-40, (44 + peaks) * frontOpen));
      }
    }
    ridgeGeo.computeVertexNormals();
    this.horizonMat = new THREE.MeshBasicMaterial({
      color: 0x8f778d, side: THREE.BackSide, transparent: true, opacity: 0.36,
      depthWrite: false, fog: false,
    });
    this.horizonRing = new THREE.Mesh(ridgeGeo, this.horizonMat);
    this.horizonRing.position.y = 48;
    this.horizonRing.renderOrder = -96;
    this.skyDecor.add(this.horizonRing);

    // Second closer atmospheric foothill band with subtle silhouette spires for deeper horizon parallax
    const nearRidgeGeo = new THREE.CylinderGeometry(1290, 1310, 118, 64, 1, true);
    const nPos = nearRidgeGeo.attributes.position;
    for (let i = 0; i < nPos.count; i++) {
      const y = nPos.getY(i);
      if (y > 0) {
        const x = nPos.getX(i), z = nPos.getZ(i);
        const a = Math.atan2(z, x);
        const peaks = Math.sin(a * 11 + 0.7) * 20 + Math.cos(a * 23) * 12 + Math.sin(a * 37) * 7;
        const frontOpen = 1 - Math.exp(-Math.pow(Math.sin(a + Math.PI * 0.5) * 2.5, 2)) * 0.78;
        nPos.setY(i, Math.max(-34, (16 + peaks) * frontOpen));
      }
    }
    nearRidgeGeo.computeVertexNormals();
    this.nearHorizonMat = new THREE.MeshBasicMaterial({
      color: 0x6f5b72, side: THREE.BackSide, transparent: true, opacity: 0.24,
      depthWrite: false, fog: false,
    });
    const nearRidge = new THREE.Mesh(nearRidgeGeo, this.nearHorizonMat);
    nearRidge.position.y = 18;
    nearRidge.renderOrder = -95;
    this.skyDecor.add(nearRidge);

    this.scene.add(this.skyDecor);
  }

  setPhoto(key, dur = 2.5, opacity = 0.22) {
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
    // Bold cel-shaded Star Fox cumulus cloud (STAR_FOX_3.jpeg): billowy crown,
    // luminous sunlit white rim highlight, and soft cool-shaded underbelly!
    const W = 512, H = 256;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.clearRect(0, 0, W, H);

    const puffs = [];
    let x = 56;
    const baseY = H * 0.68;
    while (x < W - 56) {
      const r = rand(40, 82);
      const hump = Math.sin((x / W) * Math.PI);
      const py = baseY - r * 0.48 - hump * 48 + rand(-10, 10);
      puffs.push([x, py, r]);
      x += r * rand(0.68, 0.95);
    }
    for (let i = 0; i < 10; i++) {
      const p = puffs[Math.floor(rand(1, puffs.length - 1))];
      puffs.push([p[0] + rand(-34, 34), p[1] - rand(22, 58), rand(26, 52)]);
    }

    const softPuff = (bx, by, r, top, bottom) => {
      const grd = g.createRadialGradient(bx, by - r * 0.25, r * 0.12, bx, by, r);
      grd.addColorStop(0, top);
      grd.addColorStop(0.74, top);
      grd.addColorStop(1, bottom);
      g.fillStyle = grd;
      g.beginPath(); g.arc(bx, by, r, 0, TAU); g.fill();
    };
    // Crisp sunlit outer glow halo along top edge (concept art rim glow!)
    for (const [bx, by, r] of puffs) softPuff(bx, by - r * 0.24, r * 1.08, 'rgba(255,255,255,0.65)', 'rgba(255,255,255,0)');
    // Shaded cool-blue underbelly
    for (const [bx, by, r] of puffs) softPuff(bx, by + r * 0.34, r * 1.02, 'rgba(155,180,218,0.88)', 'rgba(155,180,218,0)');
    // Bright painted cumulus body
    for (const [bx, by, r] of puffs) softPuff(bx, by, r, 'rgba(255,255,255,1)', 'rgba(232,240,252,0)');
    // Crisp bright crown highlights
    for (const [bx, by, r] of puffs) softPuff(bx, by - r * 0.44, r * 0.56, 'rgba(255,255,255,1)', 'rgba(255,255,255,0)');

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  _buildClouds() {
    this.clouds = new THREE.Group();
    this.cloudMats = [];
    for (let i = 0; i < 6; i++) {
      const tex = this._cloudTexture();
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.95, fog: false, depthWrite: false });
      this.cloudMats.push(mat);
    }
    const bands = [
      { n: 16, dist: [1450, 2100], y: [170, 500], s: [460, 780], op: 0.72 },
      { n: 16, dist: [900, 1450],  y: [115, 380], s: [290, 540], op: 0.92 },
      { n: 12, dist: [540, 900],   y: [75, 250],  s: [170, 340], op: 1.0 },
    ];
    for (const band of bands) {
      for (let i = 0; i < band.n; i++) {
        const spr = new THREE.Sprite(this.cloudMats[Math.floor(rand(0, this.cloudMats.length))]);
        const ang = rand(-1.38, 1.38);
        const dist = rand(band.dist[0], band.dist[1]);
        const y = rand(band.y[0], band.y[1]);
        spr.position.set(Math.sin(ang) * dist, y, -Math.cos(ang) * dist);
        const s = rand(band.s[0], band.s[1]);
        spr.scale.set(s, s * 0.54, 1);
        spr.userData.drift = rand(1.4, 5.2) * (band.dist[0] < 800 ? 1.5 : 1);
        spr.userData.bandOp = band.op;
        this.clouds.add(spr);
      }
    }
    this.scene.add(this.clouds);
  }

  setZone(zone, dur = 2.5) {
    const s = zone.sky;
    this._from = this._snapshot();
    this._target = {
      top: new THREE.Color(s.top), mid: new THREE.Color(s.mid), horizon: new THREE.Color(s.horizon),
      sun: new THREE.Color(s.sun), glow: new THREE.Color(s.sunGlow), size: s.sunSize,
      dir: new THREE.Vector3(...(zone.sun.pos)).normalize().setY(Math.max(zone.sky.sunY, 0.02)).normalize(),
      cloudTint: new THREE.Color(s.cloudTint), cloudOp: s.clouds,
      planet: new THREE.Color(s.planet ?? 0xc8c0e4),
      planetRing: new THREE.Color(s.planetRing ?? 0xffe0b8),
      horizonRidge: new THREE.Color(zone.fog?.color ?? s.mid).lerp(new THREE.Color(zone.rock?.base ?? 0x334455), 0.35),
    };
    this._blend = dur <= 0 ? 1 : 0;
    this._dur = Math.max(dur, 0.0001);
    if (dur <= 0) this._apply(this._target);
    if (zone.skyImage) this.setPhoto(zone.skyImage, dur <= 0 ? 0.4 : dur, zone.photoOpacity ?? 0.2);
  }

  _snapshot() {
    const u = this.uniforms;
    return {
      top: u.uTop.value.clone(), mid: u.uMid.value.clone(), horizon: u.uHorizon.value.clone(),
      sun: u.uSunColor.value.clone(), glow: u.uSunGlow.value.clone(), size: u.uSunSize.value,
      dir: u.uSunDir.value.clone(),
      cloudTint: this.cloudMats[0].color.clone(), cloudOp: this.cloudMats[0].opacity,
      planet: this.planetMat.color.clone(),
      planetRing: this.ringMat.color.clone(),
      horizonRidge: this.horizonMat.color.clone(),
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
    this.planetMat.color.copy(f ? mix(f.planet, t.planet) : t.planet);
    this.ringMat.color.copy(f ? mix(f.planetRing, t.planetRing) : t.planetRing);
    const hr = f ? mix(f.horizonRidge, t.horizonRidge) : t.horizonRidge;
    this.horizonMat.color.copy(hr);
    if (this.nearHorizonMat) this.nearHorizonMat.color.copy(hr).multiplyScalar(0.80);
    for (const m of this.cloudMats) {
      m.color.copy(f ? mix(f.cloudTint, t.cloudTint) : t.cloudTint);
      m.opacity = (f ? f.cloudOp + (t.cloudOp - f.cloudOp) * k : t.cloudOp) * 0.94;
    }
  }

  update(dt, camera) {
    if (this._target && this._blend < 1) {
      this._blend = Math.min(1, this._blend + dt / this._dur);
      this._apply(this._target, this._from, this._blend * this._blend * (3 - 2 * this._blend));
    }
    this.dome.position.copy(camera.position);
    this.skyDecor.position.set(camera.position.x, camera.position.y * 0.15, camera.position.z);
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
      if (c.position.x > 1550) c.position.x = -1550;
    }
  }
}
