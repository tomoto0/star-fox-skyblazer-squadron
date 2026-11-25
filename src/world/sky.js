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
    // Tiny companion moon + 3D revolving orbital defense ring stations around the planet!
    this.orbitRig = new THREE.Group();
    this.orbitRig.rotation.set(Math.PI * 0.41, 0.25, -0.34);
    const moon = new THREE.Sprite(new THREE.SpriteMaterial({
      map: pTex, color: 0xe8eefc, transparent: true, opacity: 0.62, depthWrite: false, fog: false,
    }));
    moon.scale.set(92, 92, 1);
    moon.position.set(-345, 0, 28);
    this.orbitRig.add(moon);
    const stationMat = new THREE.MeshBasicMaterial({
      color: 0xdff6ff, transparent: true, opacity: 0.52, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
    });
    const stationGeo = new THREE.OctahedronGeometry(7.5, 0);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      const node = new THREE.Mesh(stationGeo, stationMat);
      node.position.set(Math.cos(a) * 418, Math.sin(a) * 418, 0);
      this.orbitRig.add(node);
    }
    this.planetGroup.add(this.orbitRig);

    this.planetGroup.position.set(580, 390, -1320);
    this.skyDecor.add(this.planetGroup);

    // High-altitude zenith starfield (subtly glints in daylight, shines vividly in Ember & Dune twilight!)
    const starN = 240;
    const starPos = new Float32Array(starN * 3);
    for (let i = 0; i < starN; i++) {
      const theta = rand(0, TAU);
      const phi = rand(0.18, Math.PI * 0.48); // upper sky hemisphere
      const r = 1480;
      starPos[i * 3] = Math.cos(theta) * Math.cos(phi) * r;
      starPos[i * 3 + 1] = Math.sin(phi) * r;
      starPos[i * 3 + 2] = Math.sin(theta) * Math.cos(phi) * r;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    this.starMat = new THREE.PointsMaterial({
      color: 0xe8f4ff, size: 5.5, sizeAttenuation: true, transparent: true, opacity: 0.34,
      depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
    });
    this.stars = new THREE.Points(starGeo, this.starMat);
    this.stars.renderOrder = -97;
    this.skyDecor.add(this.stars);

    // Distant high-altitude starship armada convoy silhouetted across the far horizon sky!
    this.fleetGroup = new THREE.Group();
    const fleetHullMat = new THREE.MeshBasicMaterial({ color: 0x3b4968, transparent: true, opacity: 0.42, depthWrite: false, fog: false });
    const fleetGlowMat = new THREE.MeshBasicMaterial({ color: 0x8ef2ff, transparent: true, opacity: 0.72, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
    this.fleetMat = fleetHullMat;
    const shipSpecs = [
      { x: -340, y: 260, z: -1240, s: 1.0 },
      { x: -430, y: 235, z: -1270, s: 0.65 },
      { x: -270, y: 242, z: -1260, s: 0.58 },
    ];
    for (const sp of shipSpecs) {
      const sh = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(58 * sp.s, 9 * sp.s, 16 * sp.s), fleetHullMat);
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(14 * sp.s, 11 * sp.s, 10 * sp.s), fleetHullMat);
      bridge.position.set(-10 * sp.s, 9 * sp.s, 0);
      const prow = new THREE.Mesh(new THREE.ConeGeometry(8 * sp.s, 26 * sp.s, 4), fleetHullMat);
      prow.rotation.z = -Math.PI / 2;
      prow.position.set(40 * sp.s, 0, 0);
      const eng = new THREE.Mesh(new THREE.SphereGeometry(5.5 * sp.s, 6, 5), fleetGlowMat);
      eng.position.set(-32 * sp.s, 0, 0);
      sh.add(body, bridge, prow, eng);
      sh.position.set(sp.x, sp.y, sp.z);
      this.fleetGroup.add(sh);
    }
    this.skyDecor.add(this.fleetGroup);

    // Distant sculpted 3-layer shaded panoramic mountain ranges (alpine snow peaks, coastal headlands, volcanic spires, desert mesas!)
    this.mountainUniforms = {
      uBase: { value: new THREE.Color(0x524b6b) },
      uMid: { value: new THREE.Color(0x7e6d88) },
      uPeak: { value: new THREE.Color(0xf6c9a0) },
      uSunColor: { value: new THREE.Color(0xffd699) },
      uHorizon: { value: new THREE.Color(0xffbe74) },
      uSunDir: { value: new THREE.Vector3(0.14, 0.28, -1).normalize() },
      uSnowLine: { value: 0.72 },
    };
    const makeMountainLayer = ({ r, h, yPos, segs, f1, f2, f3, seed, notchWidth, notchDepth, opacity, haze, renderOrder }) => {
      const geo = new THREE.CylinderGeometry(r, r + 26, h, segs, 6, true);
      const pos = geo.attributes.position;
      const elev = new Float32Array(pos.count);
      const ridge = (t) => 1.0 - Math.abs(Math.sin(t));
      for (let i = 0; i < pos.count; i++) {
        const y0 = pos.getY(i);
        const yn = (y0 / h) + 0.5; // 0 = base, 1 = ridge crest
        const x = pos.getX(i), z = pos.getZ(i);
        const a = Math.atan2(z, x);
        // Multi-octave ridged alpine profile (sharp peaks & sweeping river valleys)
        const p1 = Math.pow(ridge(a * f1 + seed), 1.35) * 0.52;
        const p2 = Math.pow(ridge(a * f2 + seed * 2.1), 1.45) * 0.30;
        const p3 = ridge(a * f3 + seed * 3.7) * 0.14;
        const p4 = (0.5 + 0.5 * Math.sin(a * (f3 * 2 + 1) + seed)) * 0.04;
        // Leave an inviting open valley / sea channel directly ahead (-Z) for the sun & flight corridor
        const frontNotch = 1.0 - Math.exp(-Math.pow(Math.sin(a + Math.PI * 0.5) * notchWidth, 2)) * notchDepth;
        const profile = (0.24 + (p1 + p2 + p3 + p4) * 1.18) * frontNotch;
        // Intermediate rows follow the mountain silhouette smoothly and push outward slightly at spurs
        const sculptedY = -h * 0.5 + yn * h * profile;
        const spur = (1.0 - yn) * (p2 * 44.0 + Math.sin(a * f2 + yn * 3.1) * 14.0);
        const lenXZ = Math.hypot(x, z) || 1;
        pos.setX(i, x + (x / lenXZ) * spur);
        pos.setZ(i, z + (z / lenXZ) * spur);
        pos.setY(i, sculptedY);
        elev[i] = Math.min(1.0, Math.max(0.0, yn * profile * 1.12));
      }
      geo.setAttribute('aElev', new THREE.BufferAttribute(elev, 1));
      geo.computeVertexNormals();
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uBase: this.mountainUniforms.uBase,
          uMid: this.mountainUniforms.uMid,
          uPeak: this.mountainUniforms.uPeak,
          uSunColor: this.mountainUniforms.uSunColor,
          uHorizon: this.mountainUniforms.uHorizon,
          uSunDir: this.mountainUniforms.uSunDir,
          uSnowLine: this.mountainUniforms.uSnowLine,
          uHaze: { value: haze },
          uOpacity: { value: opacity },
          uYPos: { value: yPos },
        },
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        fog: false,
        vertexShader: /* glsl */`
          attribute float aElev;
          uniform float uYPos;
          varying float vElev;
          varying float vRelY;
          varying vec3 vNorm;
          varying vec3 vDir;
          varying float vAngle;
          void main() {
            vElev = aElev;
            vRelY = position.y + uYPos;
            vNorm = normalize(-normal);
            vDir = normalize(vec3(position.x, position.y + uYPos, position.z));
            vAngle = atan(position.z, position.x);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */`
          uniform vec3 uBase, uMid, uPeak, uSunColor, uHorizon, uSunDir;
          uniform float uSnowLine, uHaze, uOpacity;
          varying float vElev;
          varying float vRelY;
          varying vec3 vNorm;
          varying vec3 vDir;
          varying float vAngle;
          void main() {
            vec3 N = normalize(vNorm);
            vec3 L = normalize(uSunDir);
            // Crisp cel-painterly ridge lighting + backlit sunset rim glow near the sun!
            float ndl = dot(N, L) * 0.5 + 0.5;
            float sunStep = smoothstep(0.32, 0.68, ndl);
            float backlit = pow(max(dot(normalize(vDir), L), 0.0), 5.0);
            // Subtle geological horizontal strata & vertical gully veins across mountain slopes
            float strata = sin(vRelY * 0.14 + sin(vAngle * 18.0) * 1.6) * 0.5 + 0.5;
            float gully = sin(vAngle * 64.0 + vRelY * 0.05) * 0.5 + 0.5;
            vec3 rockCol = mix(uBase, uMid, smoothstep(10.0, 150.0, vRelY));
            rockCol *= 0.88 + strata * 0.14 + gully * 0.08;
            // Warm directional sunlight & atmospheric shadow contrast
            rockCol = mix(rockCol * 0.72, rockCol * 1.12 + uSunColor * 0.22, sunStep);
            rockCol += uSunColor * backlit * 0.34;
            // Altitude snow peaks / sunlit sandstone crowns / glowing volcanic ridge crests
            float snowMask = smoothstep(uSnowLine, uSnowLine + 0.22, vElev + (strata - 0.5) * 0.10) * smoothstep(55.0, 130.0, vRelY);
            rockCol = mix(rockCol, mix(uPeak, uSunColor, 0.22), snowMask * (0.65 + sunStep * 0.35));
            // Atmospheric aerial perspective + misty valley base anchored right at horizon y=0..80
            float valleyMist = 1.0 - smoothstep(-8.0, 82.0, vRelY);
            vec3 col = mix(rockCol, uHorizon, clamp(uHaze + valleyMist * 0.68, 0.0, 0.94));
            float alpha = uOpacity * smoothstep(-30.0, 12.0, vRelY);
            gl_FragColor = vec4(col, alpha);
          }`,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = yPos;
      mesh.renderOrder = renderOrder;
      return { mesh, mat };
    };

    const farMtn = makeMountainLayer({ r: 1470, h: 270, yPos: 44, segs: 96, f1: 5, f2: 13, f3: 27, seed: 0.6, notchWidth: 2.8, notchDepth: 0.68, opacity: 0.86, haze: 0.44, renderOrder: -96 });
    const midMtn = makeMountainLayer({ r: 1360, h: 180, yPos: 26, segs: 88, f1: 7, f2: 17, f3: 33, seed: 2.1, notchWidth: 2.5, notchDepth: 0.74, opacity: 0.82, haze: 0.26, renderOrder: -95 });
    const nearMtn = makeMountainLayer({ r: 1245, h: 112, yPos: 12, segs: 80, f1: 9, f2: 21, f3: 39, seed: 4.3, notchWidth: 2.3, notchDepth: 0.82, opacity: 0.76, haze: 0.14, renderOrder: -94 });
    this.horizonRing = farMtn.mesh;
    this.mountainRanges = [farMtn, midMtn, nearMtn];
    this.horizonMat = { color: new THREE.Color(0x7e6d88) };
    this.nearHorizonMat = { color: new THREE.Color(0x524b6b) };
    this.skyDecor.add(farMtn.mesh, midMtn.mesh, nearMtn.mesh);

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
    const mtnPresets = {
      sea:   { base: 0x2b4363, mid: 0x655e7c, peak: 0xffc494, snow: 0.76 },
      gorge: { base: 0x2f5e64, mid: 0x608a7e, peak: 0xf4fbff, snow: 0.62 },
      ember: { base: 0x261529, mid: 0x612a3b, peak: 0xff823e, snow: 0.70 },
      dune:  { base: 0x7b5239, mid: 0xc28a54, peak: 0xfae3b4, snow: 0.74 },
    };
    const mp = mtnPresets[zone.id] ?? mtnPresets.dune;
    this._from = this._snapshot();
    this._target = {
      top: new THREE.Color(s.top), mid: new THREE.Color(s.mid), horizon: new THREE.Color(s.horizon),
      sun: new THREE.Color(s.sun), glow: new THREE.Color(s.sunGlow), size: s.sunSize,
      dir: new THREE.Vector3(...(zone.sun.pos)).normalize().setY(Math.max(zone.sky.sunY, 0.02)).normalize(),
      cloudTint: new THREE.Color(s.cloudTint), cloudOp: s.clouds,
      planet: new THREE.Color(s.planet ?? 0xc8c0e4),
      planetRing: new THREE.Color(s.planetRing ?? 0xffe0b8),
      horizonRidge: new THREE.Color(zone.fog?.color ?? s.mid).lerp(new THREE.Color(zone.rock?.base ?? 0x334455), 0.35),
      mtnBase: new THREE.Color(mp.base),
      mtnMid: new THREE.Color(mp.mid),
      mtnPeak: new THREE.Color(mp.peak),
      snowLine: mp.snow,
    };
    this._blend = dur <= 0 ? 1 : 0;
    this._dur = Math.max(dur, 0.0001);
    if (dur <= 0) this._apply(this._target);
    if (zone.skyImage) this.setPhoto(zone.skyImage, dur <= 0 ? 0.4 : dur, zone.photoOpacity ?? 0.2);
  }

  _snapshot() {
    const u = this.uniforms;
    const mu = this.mountainUniforms;
    return {
      top: u.uTop.value.clone(), mid: u.uMid.value.clone(), horizon: u.uHorizon.value.clone(),
      sun: u.uSunColor.value.clone(), glow: u.uSunGlow.value.clone(), size: u.uSunSize.value,
      dir: u.uSunDir.value.clone(),
      cloudTint: this.cloudMats[0].color.clone(), cloudOp: this.cloudMats[0].opacity,
      planet: this.planetMat.color.clone(),
      planetRing: this.ringMat.color.clone(),
      horizonRidge: this.horizonMat.color.clone(),
      mtnBase: mu.uBase.value.clone(),
      mtnMid: mu.uMid.value.clone(),
      mtnPeak: mu.uPeak.value.clone(),
      snowLine: mu.uSnowLine.value,
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
    if (this.mountainUniforms) {
      const mu = this.mountainUniforms;
      mu.uBase.value.copy(f ? mix(f.mtnBase, t.mtnBase) : t.mtnBase);
      mu.uMid.value.copy(f ? mix(f.mtnMid, t.mtnMid) : t.mtnMid);
      mu.uPeak.value.copy(f ? mix(f.mtnPeak, t.mtnPeak) : t.mtnPeak);
      mu.uSunColor.value.copy(u.uSunGlow.value);
      mu.uHorizon.value.copy(u.uHorizon.value);
      mu.uSunDir.value.copy(u.uSunDir.value);
      mu.uSnowLine.value = f ? f.snowLine + (t.snowLine - f.snowLine) * k : t.snowLine;
    }
    if (this.fleetMat) this.fleetMat.color.copy(hr).multiplyScalar(0.85);
    if (this.starMat) {
      // Stars gleam brighter under darker twilight skies (Ember/Dune) and subtly in daylight
      const skyLum = u.uTop.value.r * 0.3 + u.uTop.value.g * 0.59 + u.uTop.value.b * 0.11;
      this.starMat.opacity = Math.max(0.18, Math.min(0.68, 0.72 - skyLum * 1.1));
    }
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
    if (this.orbitRig) this.orbitRig.rotation.z += dt * 0.055;
    if (this.fleetGroup) {
      this.fleetGroup.position.x += dt * 3.8;
      if (this.fleetGroup.position.x > 1100) this.fleetGroup.position.x = -750;
    }
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
