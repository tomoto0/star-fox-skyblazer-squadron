import * as THREE from 'three';
import { rand, TAU, clamp } from '../core/util.js';

const PROFILES = {
  sea:   { haze: 0xb9e6ff, mote: 0x8ee7ff, flare: 0xffd89a, opacity: 0.17, drift: 0.58, low: 10, high: 86 },
  gorge: { haze: 0xd7f4ff, mote: 0xb7edff, flare: 0xffffff, opacity: 0.22, drift: 0.46, low: 18, high: 126 },
  ember: { haze: 0x4a2636, mote: 0xff7b3f, flare: 0xffc07b, opacity: 0.28, drift: 0.72, low: 16, high: 118 },
  dune:  { haze: 0xe4bd82, mote: 0xffd38d, flare: 0xfff0bd, opacity: 0.19, drift: 0.66, low: 8, high: 78 },
};

/**
 * A pooled atmospheric depth field. It deliberately uses a handful of large
 * sprites and one compact Points cloud rather than translucent meshes across
 * the full view, so every campaign stage gains motion and distance without a
 * fill-rate spike.
 */
export class Atmosphere {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.position.z = -70;
    scene.add(this.group);
    this.zone = { id: 'sea' };
    this.wave = 1;
    this.time = 0;
    this._ambientAccumulator = 0;
    this._ambientInterval = 1 / 30;

    const loader = new THREE.TextureLoader();
    this.tex = {
      haze: loader.load('./assets/particles/smoke_07.png'),
      soft: loader.load('./assets/particles/smoke_04.png'),
      flare: loader.load('./assets/particles/flare_01.png'),
    };
    for (const t of Object.values(this.tex)) t.colorSpace = THREE.SRGBColorSpace;

    this.haze = [];
    for (let i = 0; i < 26; i++) {
      const mat = new THREE.SpriteMaterial({
        map: i % 3 === 0 ? this.tex.soft : this.tex.haze,
        color: 0xffffff, transparent: true, opacity: 0,
        depthWrite: false, depthTest: true, fog: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      sprite.userData = { speed: 0.42, phase: 0, base: 0.1, band: 0, width: 1 };
      this.group.add(sprite);
      this.haze.push(sprite);
    }

    const count = 156;
    this.motePos = new Float32Array(count * 3);
    this.moteCol = new Float32Array(count * 3);
    this.moteSize = new Float32Array(count);
    this.motePhase = new Float32Array(count);
    this.moteSpeed = new Float32Array(count);
    this.motesGeo = new THREE.BufferGeometry();
    this.motesGeo.setAttribute('position', new THREE.BufferAttribute(this.motePos, 3));
    this.motesGeo.setAttribute('color', new THREE.BufferAttribute(this.moteCol, 3));
    this.motesGeo.setAttribute('size', new THREE.BufferAttribute(this.moteSize, 1));
    this.motesMat = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: this.tex.flare }, uOpacity: { value: 0.5 } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      vertexColors: true,
      vertexShader: `attribute float size; varying vec3 vColor; void main(){ vColor=color; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=size*(220.0/-mv.z); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `uniform sampler2D uTex; uniform float uOpacity; varying vec3 vColor; void main(){ vec4 t=texture2D(uTex, gl_PointCoord); gl_FragColor=vec4(vColor, t.a*uOpacity)*t; }`,
    });
    this.motes = new THREE.Points(this.motesGeo, this.motesMat);
    this.motes.frustumCulled = false;
    this.group.add(this.motes);

    this.rift = [];
    for (let i = 0; i < 9; i++) {
      const m = new THREE.SpriteMaterial({ map: this.tex.flare, color: 0x9b7dff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
      const s = new THREE.Sprite(m);
      s.visible = false;
      s.userData = { phase: i * 0.72, speed: 0.35 + i * 0.03 };
      this.group.add(s);
      this.rift.push(s);
    }
    this.setStage(1, this.zone);
  }

  setStage(wave, zone = this.zone) {
    this.wave = wave;
    this.zone = zone ?? this.zone;
    const p = PROFILES[this.zone.id] ?? PROFILES.dune;
    const hazeColor = new THREE.Color(p.haze);
    const moteColor = new THREE.Color(p.mote);
    const stage = (wave - 1) % 3;

    for (let i = 0; i < this.haze.length; i++) {
      const s = this.haze[i];
      const farBand = i < 10;
      const midBand = i >= 10 && i < 20;
      const y = farBand ? rand(p.high * 0.72, p.high * 1.42) : midBand ? rand(p.low + 22, p.high) : rand(p.low, p.low + 44);
      const z = farBand ? rand(-1700, -980) : midBand ? rand(-1060, -410) : rand(-560, -130);
      const x = rand(-1, 1) * (farBand ? 820 : midBand ? 520 : 340);
      const width = farBand ? rand(260, 500) : midBand ? rand(130, 280) : rand(80, 160);
      s.position.set(x, y, z);
      s.scale.set(width, width * rand(0.32, 0.56), 1);
      s.material.color.copy(hazeColor).lerp(new THREE.Color(p.flare), farBand ? 0.2 : 0.06);
      s.material.opacity = p.opacity * (farBand ? 0.42 : midBand ? 0.72 : 1.0) * (stage === 1 ? 1.12 : 1);
      s.userData.base = s.material.opacity;
      s.userData.phase = rand(TAU);
      s.userData.speed = p.drift * rand(0.38, 1.0) * (farBand ? 0.22 : midBand ? 0.45 : 0.72);
      s.userData.band = farBand ? 0 : midBand ? 1 : 2;
      s.userData.width = width;
      s.visible = true;
    }

    for (let i = 0; i < this.moteSize.length; i++) {
      const far = i < 54;
      this.motePos[i * 3] = rand(-1, 1) * (far ? 700 : 360);
      this.motePos[i * 3 + 1] = rand(p.low, far ? p.high * 1.55 : p.high);
      this.motePos[i * 3 + 2] = far ? rand(-1500, -600) : rand(-820, -100);
      const c = moteColor.clone().lerp(new THREE.Color(p.flare), Math.random() * 0.42);
      this.moteCol[i * 3] = c.r; this.moteCol[i * 3 + 1] = c.g; this.moteCol[i * 3 + 2] = c.b;
      this.moteSize[i] = rand(far ? 1.1 : 1.5, far ? 2.4 : 4.8) * (this.zone.id === 'ember' ? 1.25 : 1);
      this.motePhase[i] = rand(TAU);
      this.moteSpeed[i] = p.drift * rand(0.25, 1.1) * (far ? 0.32 : 1);
    }
    this.motesGeo.attributes.position.needsUpdate = true;
    this.motesGeo.attributes.color.needsUpdate = true;
    this.motesGeo.attributes.size.needsUpdate = true;
    this.motesMat.uniforms.uOpacity.value = this.zone.id === 'ember' ? 0.72 : this.zone.id === 'dune' ? 0.45 : 0.34;

    const riftActive = wave >= 15;
    for (let i = 0; i < this.rift.length; i++) {
      const s = this.rift[i];
      const a = (i / this.rift.length) * TAU + stage * 0.55;
      const r = 100 + (i % 3) * 52;
      s.position.set(Math.cos(a) * r, 90 + Math.sin(a * 1.7) * 42, -780 - (i % 4) * 120);
      const scale = 20 + (i % 3) * 14;
      s.scale.setScalar(scale);
      s.material.color.setHex(wave === 16 ? 0xb18cff : 0xff9c5b);
      s.material.opacity = riftActive ? 0.28 : 0;
      s.visible = riftActive;
    }
  }

  setAmbientRate(hz = 30) {
    this._ambientInterval = 1 / clamp(hz, 15, 60);
  }

  update(dt, scroll) {
    this.time += dt;
    this._ambientAccumulator += dt;
    if (this._ambientAccumulator < this._ambientInterval) return;
    const ambientDt = this._ambientAccumulator;
    this._ambientAccumulator = 0;
    const p = PROFILES[this.zone?.id] ?? PROFILES.dune;
    for (const s of this.haze) {
      if (!s.visible) continue;
      s.position.z += scroll * ambientDt * s.userData.speed;
      s.position.x += Math.sin(this.time * 0.2 + s.userData.phase) * ambientDt * (s.userData.band + 1) * 1.2;
      s.material.opacity = s.userData.base * (0.82 + Math.sin(this.time * 0.38 + s.userData.phase) * 0.18);
      if (s.position.z > 120) {
        s.position.z = -1500 - Math.random() * 450;
        s.position.x = rand(-1, 1) * (s.userData.band === 0 ? 820 : s.userData.band === 1 ? 520 : 340);
      }
    }
    for (let i = 0; i < this.moteSize.length; i++) {
      const j = i * 3;
      this.motePos[j + 2] += scroll * ambientDt * this.moteSpeed[i];
      this.motePos[j] += Math.sin(this.time * 1.5 + this.motePhase[i]) * ambientDt * (this.zone?.id === 'ember' ? 3.5 : 1.6);
      this.motePos[j + 1] += Math.cos(this.time * 1.1 + this.motePhase[i]) * ambientDt * (this.zone?.id === 'dune' ? 0.8 : 0.35);
      if (this.motePos[j + 2] > 70) {
        this.motePos[j + 2] = -1300 - Math.random() * 420;
        this.motePos[j] = rand(-1, 1) * 650;
        this.motePos[j + 1] = rand(p.low, p.high * 1.35);
      }
    }
    this.motesGeo.attributes.position.needsUpdate = true;
    for (const s of this.rift) {
      if (!s.visible) continue;
      const pulse = 0.76 + Math.sin(this.time * 2.1 + s.userData.phase) * 0.24;
      s.material.opacity = (this.wave === 16 ? 0.42 : 0.28) * pulse;
      s.material.rotation += ambientDt * s.userData.speed;
    }
  }
}
