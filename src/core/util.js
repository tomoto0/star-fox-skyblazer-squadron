import * as THREE from 'three';

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const TAU = Math.PI * 2;

/** deterministic-ish value noise for terrain */
export function makeNoise(seed = 1) {
  const s = Math.sin;
  return (x, y = 0) =>
    (s(x * 0.754 + seed) * 0.5 + s(x * 0.311 + y * 0.532 + seed * 2.1) * 0.3 +
     s(x * 0.117 + y * 0.221 + seed * 3.7) * 0.2 + s(x * 1.63 + y * 1.09 + seed) * 0.11);
}

/** shared 4-step toon gradient map */
let _gradMap = null;
export function toonGradient() {
  if (_gradMap) return _gradMap;
  const data = new Uint8Array([90, 150, 210, 255]);
  _gradMap = new THREE.DataTexture(data, 4, 1, THREE.RedFormat);
  _gradMap.needsUpdate = true;
  _gradMap.minFilter = THREE.NearestFilter;
  _gradMap.magFilter = THREE.NearestFilter;
  return _gradMap;
}

export function toonMat(color, opts = {}) {
  const m = new THREE.MeshToonMaterial({
    color, gradientMap: toonGradient(),
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    transparent: !!opts.transparent,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide,
    fog: opts.fog ?? true,
  });
  if (opts.flat) m.flatShading = true;
  return m;
}

/** soft round sprite texture (for glows / particles) */
let _dotTex = null;
export function dotTexture() {
  if (_dotTex) return _dotTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,.85)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  _dotTex = new THREE.CanvasTexture(c);
  return _dotTex;
}

/**
 * Load a diffuse texture and process it into a tileable DETAIL map:
 * desaturate + brighten + soften contrast so, when multiplied against the
 * cel-shaded vertex colours / material tint, it adds real surface grain
 * without overpowering the stylised palette. Returns a THREE.Texture that
 * populates once the image decodes.
 */
export function loadDetailTexture(url, opts = {}) {
  const tex = new THREE.Texture();
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const rep = opts.repeat ?? 1;
  tex.repeat.set(rep, rep);
  const size = opts.size ?? 512;
  const brightness = opts.brightness ?? 1.7;
  const contrast = opts.contrast ?? 0.72;
  const desat = opts.desat ?? 0.55;
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0, size, size);
    const id = g.getImageData(0, 0, size, size);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      let r = d[i], gg = d[i + 1], b = d[i + 2];
      const lum = 0.299 * r + 0.587 * gg + 0.114 * b;
      r = lum + (r - lum) * (1 - desat);
      gg = lum + (gg - lum) * (1 - desat);
      b = lum + (b - lum) * (1 - desat);
      r = (r - 128) * contrast + 128; gg = (gg - 128) * contrast + 128; b = (b - 128) * contrast + 128;
      r *= brightness; gg *= brightness; b *= brightness;
      d[i] = clamp(r, 0, 255); d[i + 1] = clamp(gg, 0, 255); d[i + 2] = clamp(b, 0, 255);
    }
    g.putImageData(id, 0, 0);
    tex.image = c;
    tex.needsUpdate = true;
  };
  img.onerror = () => { /* leave blank; materials still show vertex colours */ };
  img.src = url;
  return tex;
}

export const _v1 = new THREE.Vector3();
export const _v2 = new THREE.Vector3();
export const _v3 = new THREE.Vector3();
