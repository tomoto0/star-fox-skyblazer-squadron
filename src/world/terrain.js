import * as THREE from 'three';
import { rand, pick, makeNoise, toonMat, clamp, TAU, toonGradient, dotTexture, loadDetailTexture } from '../core/util.js';

const TEX = './assets/textures/';

const CHUNK_LEN = 300;
const NUM_CHUNKS = 8;
const TOTAL_LEN = CHUNK_LEN * NUM_CHUNKS;
const FIELD = 300;            // lateral half-extent the player can reach
const CEIL = 190;             // vertical ceiling the player can climb to
const COLLIDE_REACH = 340;    // beyond this a prop is pure background — no collider

const noise = makeNoise(7.31);
const noise2 = makeNoise(19.77);

// Every environmental layer reads the same route definition: terrain leaves it
// open, installations flank it, and beacons reveal its curve at a glance.
const ROUTE_SPECS = {
  sea:   { amp: 68, wavelength: 760, half: 88, phase: 0.2 },
  gorge: { amp: 52, wavelength: 590, half: 76, phase: 1.1 },
  ember: { amp: 42, wavelength: 510, half: 70, phase: 2.0 },
  dune:  { amp: 92, wavelength: 880, half: 96, phase: 2.7 },
};

export function flightRoute(zoneId, worldZ = 0) {
  const s = ROUTE_SPECS[zoneId] ?? ROUTE_SPECS.dune;
  const u = worldZ / s.wavelength + s.phase;
  return {
    center: Math.sin(u) * s.amp + Math.sin(u * 0.47 + 0.8) * s.amp * 0.22,
    halfWidth: s.half + Math.sin(u * 0.63) * 7,
  };
}

// scratch objects for bounding-box collider computation
const _box = new THREE.Box3();
const _bc = new THREE.Vector3();
const _bs = new THREE.Vector3();

/* ---------------- shared materials (CC0 detail textures × vertex-colour palette) ---------------- */
// detail maps are brightened toward white + desaturated so multiplying them
// against the vertex-colour palette adds surface grain without dimming the hue
const rockTex = loadDetailTexture(TEX + 'rock_diff.jpg', { repeat: 2.6, brightness: 2.5, contrast: 0.5, desat: 0.8 });
const rockMat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient(), map: rockTex });
rockMat.flatShading = true;

// Each zone uses a distinct CC0 rock surface. The high-poly source scans are
// never imported: compact 1K maps enrich the authored, low-cost silhouettes.
function makeCliffMaterial(diffusePath, normalPath, opts = {}) {
  const repeat = opts.repeat ?? 2.5;
  const map = loadDetailTexture(TEX + diffusePath, {
    repeat, brightness: opts.brightness ?? 2.15, contrast: opts.contrast ?? 0.60, desat: opts.desat ?? 0.5,
  });
  const normal = new THREE.TextureLoader().load(TEX + normalPath);
  normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
  normal.repeat.set(repeat, repeat);
  const material = new THREE.MeshToonMaterial({
    vertexColors: true, gradientMap: toonGradient(), map, normalMap: normal,
    normalScale: new THREE.Vector2(opts.normal ?? 0.4, opts.normal ?? 0.4),
  });
  material.flatShading = true;
  return material;
}

const CLIFF_MATS = {
  // AZURE SEA — wet, blue-grey sea-cut stone with a restrained normal response.
  sea: makeCliffMaterial('coastal_cliff_04/diffuse.jpg', 'coastal_cliff_04/normal_gl.jpg', { repeat: 2.1, brightness: 2.15, contrast: 0.62, desat: 0.52, normal: 0.38 }),
  // CASCADE GORGE — warm layered sedimentary faces, visibly striated under daylight.
  gorge: makeCliffMaterial('zone_cliffs/gorge/diffuse.jpg', 'zone_cliffs/gorge/normal_gl.jpg', { repeat: 3.0, brightness: 2.28, contrast: 0.58, desat: 0.32, normal: 0.45 }),
  // EMBER CANYON — dark fractured volcanic rock, coloured by the zone's red vertex lighting.
  ember: makeCliffMaterial('zone_cliffs/ember/diffuse.jpg', 'zone_cliffs/ember/normal_gl.jpg', { repeat: 3.8, brightness: 1.92, contrast: 0.70, desat: 0.42, normal: 0.58 }),
  // DUNE SEA — dusty, weathered gravel and warm sandstone with softened relief.
  dune: makeCliffMaterial('zone_cliffs/dune/diffuse.jpg', 'zone_cliffs/dune/normal_gl.jpg', { repeat: 3.35, brightness: 2.38, contrast: 0.54, desat: 0.30, normal: 0.32 }),
};
const cliffMat = CLIFF_MATS.sea;
// Shared wet-rock layer for sea stacks. Reusing this material makes the tide line
// readable without adding texture fetches or per-stack material allocations.
const seaWetMat = toonMat(0x18384f, { emissive: 0x245a78, emissiveIntensity: 0.22, flat: true });
const seaSaltMat = toonMat(0x6e91a4, { emissive: 0xa8d8e8, emissiveIntensity: 0.10, flat: true });

// Monumental gate and tunnel geometry must remain legible while browser texture
// decoding is in flight. This map-free material retains the same per-vertex zone
// palette and lets the high-density erosion geometry carry the surface detail.
const STABLE_CLIFF_MATS = {};
function stableCliffMaterial(zoneId) {
  if (STABLE_CLIFF_MATS[zoneId]) return STABLE_CLIFF_MATS[zoneId];
  const m = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient(), color: 0xffffff, side: THREE.DoubleSide, fog: true });
  m.flatShading = true;
  STABLE_CLIFF_MATS[zoneId] = m;
  return m;
}

const sandTex = loadDetailTexture(TEX + 'sand_diff.jpg', { repeat: 18, brightness: 2.7, contrast: 0.45, desat: 0.85 });
const sandMat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient(), map: sandTex });
sandMat.flatShading = true;

const groundRockTex = loadDetailTexture(TEX + 'rock_diff.jpg', { repeat: 15, brightness: 2.4, contrast: 0.5, desat: 0.8 });
const emberGroundMat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient(), map: groundRockTex });
emberGroundMat.flatShading = true;

// Zone floor materials are separate from cliff surfaces: their high repeat count
// reads as broad terrain at flight speed while vertex colours retain the authored
// route visibility and zone lighting.
function makeFloorMaterial(diffusePath, normalPath, opts = {}) {
  const repeat = opts.repeat ?? 16;
  const map = loadDetailTexture(TEX + diffusePath, {
    repeat, brightness: opts.brightness ?? 2.2, contrast: opts.contrast ?? 0.54, desat: opts.desat ?? 0.55,
  });
  const normal = new THREE.TextureLoader().load(TEX + normalPath);
  normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
  normal.repeat.set(repeat, repeat);
  const material = new THREE.MeshToonMaterial({
    vertexColors: true, gradientMap: toonGradient(), map, normalMap: normal,
    normalScale: new THREE.Vector2(opts.normal ?? 0.30, opts.normal ?? 0.30),
  });
  material.flatShading = true;
  return material;
}
const FLOOR_MATS = {
  // CASCADE GORGE is supplied through the blue river surface; its dry banks are
  // deliberately kept under the wide water ribbon rather than becoming a noisy runway.
  ember: makeFloorMaterial('zone_cliffs/ember/diffuse.jpg', 'zone_cliffs/ember/normal_gl.jpg', { repeat: 18, brightness: 1.85, contrast: 0.72, desat: 0.48, normal: 0.46 }),
  dune: makeFloorMaterial('zone_floors/dune/diffuse.jpg', 'zone_floors/dune/normal_gl.jpg', { repeat: 23, brightness: 2.26, contrast: 0.50, desat: 0.42, normal: 0.22 }),
};

// A compact procedural surface map preserves animated vertex waves while giving
// AZURE SEA and CASCADE GORGE visibly different floor textures without a large
// translucent water mesh or an additional full-resolution asset download.
function makeWaterSurfaceTexture(deep, crest, foam = 0.28) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = deep; g.fillRect(0, 0, 256, 256);
  g.globalAlpha = 0.36;
  for (let y = -20; y < 280; y += 22) {
    g.strokeStyle = crest; g.lineWidth = 2.2;
    g.beginPath();
    for (let x = -20; x < 280; x += 10) {
      const yy = y + Math.sin(x * 0.085 + y * 0.057) * 3.1;
      x < -10 ? g.moveTo(x, yy) : g.lineTo(x, yy);
    }
    g.stroke();
  }
  g.globalAlpha = foam;
  g.fillStyle = '#ffffff';
  for (let i = 0; i < 170; i++) g.fillRect((i * 47) % 256, (i * 91 + 13) % 256, 1.4, 1.4);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(9, 7);
  tex.anisotropy = 2;
  return tex;
}
function makeWaterMaterial(opts) {
  const material = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uDeep: { value: new THREE.Color(opts.deep) },
        uShallow: { value: new THREE.Color(opts.shallow) },
        uFoamColor: { value: new THREE.Color(opts.foam) },
        uSpecular: { value: new THREE.Color(opts.specular) },
        uFlow: { value: opts.flow },
        uScale: { value: opts.scale },
        uFoam: { value: opts.foamAmount },
        uFresnel: { value: opts.fresnel },
        uOpacity: { value: opts.opacity ?? 1 },
        uGlow: { value: opts.glow ?? 0 },
        uCrust: { value: opts.crust ?? 0 },
      },
    ]),
    transparent: (opts.opacity ?? 1) < 1,
    depthWrite: (opts.opacity ?? 1) >= 1,
    fog: true,
    vertexShader: `
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      #include <fog_pars_vertex>
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vec4 mvPosition = viewMatrix * world;
        vWorldPos = world.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        #include <fog_vertex>
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uFoamColor;
      uniform vec3 uSpecular;
      uniform float uFlow;
      uniform float uScale;
      uniform float uFoam;
      uniform float uFresnel;
      uniform float uOpacity;
      uniform float uGlow;
      uniform float uCrust;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      #include <fog_pars_fragment>

      // Two curved analytical flow bands cost far less than a 3×3 cellular
      // lookup in every fragment, while retaining small broken ripple highlights.
      float ripple(vec2 p) {
        float a = sin(p.x * 2.65 + p.y * 0.78 + sin(p.y * 0.72) * 0.9) * 0.5 + 0.5;
        float b = sin(p.y * 3.85 - p.x * 1.16 + sin(p.x * 0.55) * 0.8) * 0.5 + 0.5;
        float c = sin((p.x + p.y) * 1.72) * 0.5 + 0.5;
        return smoothstep(0.74, 0.96, a * 0.46 + b * 0.38 + c * 0.16);
      }
      void main() {
        vec2 p = vWorldPos.xz;
        float drift = uTime * uFlow;
        float longWave = sin(p.y * uScale + drift + sin(p.x * uScale * 0.64) * 1.8) * 0.5 + 0.5;
        float crossWave = sin(p.x * uScale * 1.45 - drift * 0.72 + p.y * uScale * 0.28) * 0.5 + 0.5;
        float tiny = ripple(p * (uScale * 1.34) + vec2(-drift * 0.22, drift * 0.78));
        float crest = smoothstep(0.78, 0.98, longWave * 0.72 + crossWave * 0.28);
        float foam = (crest * 0.66 + tiny * 0.34) * uFoam;
        vec3 col = mix(uDeep, uShallow, longWave * 0.62 + crossWave * 0.18 + tiny * 0.12);
        // Lava gains broad cooling plates at a much lower frequency than the flow.
        // uCrust is zero for water, so the extra detail has no visual impact there.
        float plateA = sin(p.x * 0.24 + sin(p.y * 0.17) * 1.4 + drift * 0.18) * 0.5 + 0.5;
        float plateB = sin(p.y * 0.31 - p.x * 0.13 + sin(p.x * 0.11) * 1.7) * 0.5 + 0.5;
        float cooling = smoothstep(0.72, 0.96, plateA * 0.56 + plateB * 0.44) * uCrust;
        col = mix(col, uDeep * 0.72, cooling * 0.72);
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float facing = 1.0 - max(dot(normalize(vWorldNormal), viewDir), 0.0);
        float fresnel = pow(facing, 2.6) * uFresnel;
        vec3 lightDir = normalize(vec3(0.32, 0.84, -0.44));
        float highlight = pow(max(dot(reflect(-viewDir, normalize(vWorldNormal)), lightDir), 0.0), 46.0);
        // Keep foam and reflected light below combat-reticle brightness. This preserves
        // water motion while preventing large white patches from masking projectiles.
        col = mix(col, uFoamColor, foam * 0.62);
        col += uSpecular * (fresnel * 0.34 + highlight * (0.14 + crest * 0.28));
        // Heat remains visible in cracks and moving channels, rather than lighting the full ribbon.
        col += uFoamColor * uGlow * (0.13 + longWave * 0.23 + crest * 0.42) * (1.0 - cooling * 0.62);
        gl_FragColor = vec4(col, uOpacity);
        #include <fog_fragment>
      }
    `,
  });
  material.userData.fluid = true;
  return material;
}
const WATER_MATS = {
  sea: makeWaterMaterial({ deep: 0x0f4566, shallow: 0x1c8c9d, foam: 0xd8f3ec, specular: 0xffd49c, flow: 1.05, scale: 0.052, foamAmount: 0.20, fresnel: 0.52, glow: 0.018 }),
  gorge: makeWaterMaterial({ deep: 0x14557a, shallow: 0x3297aa, foam: 0xd9f8ef, specular: 0xdff8ee, flow: 1.82, scale: 0.104, foamAmount: 0.24, fresnel: 0.36, glow: 0.03 }),
};
const LIQUID_MATS = {
  ember: makeWaterMaterial({ deep: 0x24090d, shallow: 0xe0441b, foam: 0xffb565, specular: 0xffc27c, flow: 0.70, scale: 0.096, foamAmount: 0.34, fresnel: 0.58, glow: 0.58, crust: 0.84 }),
  dune: makeWaterMaterial({ deep: 0x176a92, shallow: 0x86d8dd, foam: 0xeaffed, specular: 0xfff0bd, flow: 0.66, scale: 0.085, foamAmount: 0.34, fresnel: 0.80, opacity: 0.82, glow: 0.18 }),
};
const FLUID_MATS = [...Object.values(WATER_MATS), ...Object.values(LIQUID_MATS)];

function fluidRibbon(width, length, material, y = 0.7) {
  const geo = new THREE.PlaneGeometry(width, length, 12, 24);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const taper = 0.78 + 0.22 * Math.sin((z / length + 0.5) * Math.PI);
    pos.setX(i, x * taper + noise(z * 0.055, x * 0.031) * width * 0.075);
    pos.setY(i, Math.sin(z * 0.11 + x * 0.07) * 0.10 + Math.sin(z * 0.032) * 0.14);
  }
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.y = y;
  mesh.userData.noCollide = true;
  mesh.renderOrder = 1;
  return mesh;
}

const snowTex = loadDetailTexture(TEX + 'snow_diff.jpg', { repeat: 2.2, brightness: 1.9, contrast: 0.6, desat: 0.4 });
const snowCapMat = new THREE.MeshToonMaterial({ gradientMap: toonGradient(), map: snowTex, color: 0xeef4fb });
snowCapMat.flatShading = true;

/* ---------------- shared geometry helpers ---------------- */
function vertexColoredRock(radius, height, baseColor, topColor, sides = 7) {
  // A broader radial/vertical mesh carries erosion, bedding planes and asymmetric
  // buttresses. This replaces the earlier sparse cylinder silhouette while staying
  // far below the cost of a scanned cliff for the many recycled world chunks.
  const radial = clamp(Math.round(sides + (height > 54 ? 4 : 2)), 8, 13);
  const vertical = clamp(Math.round(height / 15), 4, 12);
  const geo = new THREE.CylinderGeometry(radius * rand(0.46, 0.72), radius, height, radial, vertical, false);
  const pos = geo.attributes.position;
  const cBase = new THREE.Color(baseColor), cTop = new THREE.Color(topColor);
  const colors = new Float32Array(pos.count * 3);
  const phase = rand(TAU);
  const bedding = rand(4.2, 7.2);
  const overhangBand = rand(0.32, 0.68);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const yn = clamp(y / height + 0.5, 0, 1);
    const x0 = pos.getX(i), z0 = pos.getZ(i);
    const theta = Math.atan2(z0, x0);
    const broad = noise(Math.cos(theta) * 1.9 + phase, yn * 3.7 + phase) * 0.24;
    const chip = noise2(Math.sin(theta * 1.6) + phase * 0.5, yn * 7.4) * 0.14;
    // Thin ledges and a single larger weathered shelf break the cylinder profile.
    const strataWave = Math.sin(yn * Math.PI * bedding + theta * 0.55 + phase);
    const shelf = Math.max(0, 1 - Math.abs(yn - overhangBand) * 9) * 0.13;
    const erosion = 1 + broad + chip + strataWave * 0.045 + shelf;
    pos.setX(i, x0 * erosion);
    pos.setZ(i, z0 * erosion * (0.90 + noise(theta * 0.8 + phase, yn) * 0.08));
    pos.setY(i, y + noise2(theta * 1.2 + phase, yn * 4.6) * height * 0.045);
    const strata = 0.5 + 0.5 * Math.sin(yn * Math.PI * bedding + noise(theta + phase, yn * 2) * 2.8);
    const weather = 0.84 + strata * 0.16 + shelf * 0.35;
    const c = cBase.clone().lerp(cTop, Math.pow(yn, 1.55)).multiplyScalar(weather);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

function makeRock(radius, height, base, top, sides) {
  const m = new THREE.Mesh(vertexColoredRock(radius, height, base, top, sides), rockMat);
  m.rotation.y = rand(TAU);
  return m;
}

/** Textured counterpart for high-visibility cliff faces and suspended landforms. */
function makeCliffRock(radius, height, base, top, sides = 8, material = cliffMat) {
  const m = new THREE.Mesh(vertexColoredRock(radius, height, base, top, sides), material);
  m.rotation.y = rand(TAU);
  return m;
}

/**
 * An asymmetrical cliff mass made from embedded strata, overhang shelves and
 * talus. It produces a readable large-scale silhouette without flat, repeated
 * mesas or expensive imported scan geometry.
 */
function buttressedCliff(radius, height, base, top, opts = {}) {
  const g = new THREE.Group();
  const layers = opts.layers ?? 3;
  const material = opts.material ?? cliffMat;
  const foot = makeCliffRock(radius * 1.32, height * 0.26, base, top, 8, material);
  foot.position.y = Math.max(0, height * 0.04);
  foot.scale.z = 1.18;
  g.add(foot);

  let y = height * 0.14;
  for (let i = 0; i < layers; i++) {
    const t = i / Math.max(1, layers - 1);
    const tierH = height * rand(0.30, 0.43);
    const tierR = radius * (0.92 - t * 0.26) * rand(0.86, 1.08);
    const tier = makeCliffRock(tierR, tierH, base, top, pick([7, 8, 9]), material);
    tier.position.set(rand(-radius * 0.16, radius * 0.16), y + tierH * 0.28, rand(-radius * 0.22, radius * 0.22));
    tier.rotation.z = rand(-0.10, 0.10);
    g.add(tier);

    // Offset shelves create visible erosion planes rather than uniform cones.
    const shelf = makeCliffRock(tierR * rand(0.60, 0.86), Math.max(4, tierH * 0.13), base, top, 7, material);
    const a = rand(TAU);
    shelf.position.set(tier.position.x + Math.cos(a) * tierR * 0.58, tier.position.y + tierH * rand(0.05, 0.28), tier.position.z + Math.sin(a) * tierR * 0.58);
    shelf.rotation.z = rand(-0.16, 0.16);
    g.add(shelf);
    y += tierH * rand(0.55, 0.72);
  }

  // A talus fan and several exposed bedding ribs eliminate the isolated-block
  // look at the base of large cliffs. These are visual children of the cliff; the
  // parent collision volume remains unchanged and therefore predictable.
  for (let i = 0; i < 7; i++) {
    const a = rand(TAU);
    const talus = makeCliffRock(radius * rand(0.07, 0.19), height * rand(0.045, 0.14), base, top, 7, material);
    talus.position.set(Math.cos(a) * radius * rand(0.72, 1.24), height * rand(0.02, 0.16), Math.sin(a) * radius * rand(0.72, 1.13));
    talus.rotation.z = rand(-0.22, 0.22);
    g.add(talus);
  }
  for (let i = 0; i < 3; i++) {
    const a = rand(TAU);
    const rib = makeCliffRock(radius * rand(0.18, 0.31), Math.max(4, height * rand(0.035, 0.065)), base, top, 8, material);
    rib.position.set(Math.cos(a) * radius * rand(0.58, 0.86), height * rand(0.24, 0.72), Math.sin(a) * radius * rand(0.58, 0.86));
    rib.scale.set(1.45, 0.62, 0.45);
    rib.rotation.set(rand(-0.10, 0.10), a, rand(-0.20, 0.20));
    g.add(rib);
  }
    return g;
}
/**
 * Broad, low-frequency eroded strata used only as non-colliding side scenery.
 * Offset beds, a slumped shoulder and talus create geological direction without
 * turning the open combat corridor into a repeated obstacle course.
 */
function erodedEscarpment(radius, height, base, top, opts = {}) {
  const g = new THREE.Group();
  const material = opts.material ?? cliffMat;
  const side = opts.side ?? 1;
  const layers = opts.layers ?? 4;
  for (let i = 0; i < layers; i++) {
    const t = i / Math.max(1, layers - 1);
    const shelf = makeCliffRock(
      radius * (1.00 - t * 0.24) * rand(0.90, 1.10),
      height * rand(0.13, 0.20),
      base,
      top,
      pick([7, 8, 9]),
      material,
    );
    shelf.position.set(side * radius * (0.10 + t * 0.10) + rand(-radius * 0.12, radius * 0.12), height * (0.10 + t * 0.72), rand(-radius * 0.30, radius * 0.30));
    shelf.scale.set(1.55 - t * 0.22, 0.62, 0.68 + t * 0.10);
    shelf.rotation.set(rand(-0.08, 0.08), rand(-0.22, 0.22), side * rand(-0.13, 0.13));
    g.add(shelf);
  }
  for (let i = 0; i < 5; i++) {
    const talus = makeCliffRock(radius * rand(0.08, 0.17), height * rand(0.04, 0.10), base, top, 6, material);
    talus.position.set(side * radius * rand(0.55, 1.05), rand(1, height * 0.09), rand(-radius * 0.70, radius * 0.70));
    talus.scale.z = rand(0.70, 1.35);
    g.add(talus);
  }
  g.userData.noCollide = true;
  return g;
}
/** Deliberately suspended rift-islet: broad vegetated crown, fractured belly and light debris. */

function riftIslet(radius, height, base, top, accent = 0x8feeff, material = cliffMat) {
  const g = new THREE.Group();
  const belly = makeCliffRock(radius, height, base, top, 8, material);
  belly.position.y = -height * 0.18;
  belly.scale.y = 0.9;
  g.add(belly);
  const crown = makeCliffRock(radius * 0.88, height * 0.22, top, top, 8, material);
  crown.position.y = height * 0.26;
  crown.scale.set(1.12, 0.72, 0.96);
  g.add(crown);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + rand(-0.22, 0.22);
    const shard = new THREE.Mesh(new THREE.ConeGeometry(radius * rand(0.08, 0.15), height * rand(0.18, 0.34), 5), toonMat(0x1f2833, { emissive: accent, emissiveIntensity: 0.30, flat: true }));
    shard.position.set(Math.cos(a) * radius * rand(0.34, 0.84), -height * rand(0.37, 0.62), Math.sin(a) * radius * rand(0.30, 0.74));
    shard.rotation.z = Math.cos(a) * rand(0.25, 0.56);
    g.add(shard);
  }
  for (let i = 0; i < 3; i++) {
    const fragment = makeCliffRock(radius * rand(0.09, 0.16), height * rand(0.08, 0.15), base, top, 6, material);
    const a = rand(TAU);
    fragment.position.set(Math.cos(a) * radius * rand(1.08, 1.32), -height * rand(0.08, 0.32), Math.sin(a) * radius * rand(0.72, 1.08));
    g.add(fragment);
  }
  return g;
}

/** Grounded sea stack: broad submerged foot + clustered eroded rock columns. */
function seaStack(radius, height, base, top) {
  const g = new THREE.Group();
  const cluster = 3 + (Math.random() < 0.55 ? 1 : 0);

  // Wide lower masses visibly break the water surface and anchor the stack. The
  // design avoids flat mushroom caps; silhouette detail comes from overlapping
  // eroded columns with different heights and lean angles.
  const reef = makeRock(radius * 1.42, height * 0.28, base, top, 7);
  reef.position.y = height * 0.07;
  reef.scale.z = 1.18;
  g.add(reef);
  // A dark wet shelf and a thin salt line make the waterline legible at speed.
  // They are visual-only children of the same rock mass, so collision is unchanged.
  const wetShelf = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.12, radius * 1.28, Math.max(1.1, height * 0.032), 9), seaWetMat);
  wetShelf.position.y = Math.max(0.55, height * 0.12); wetShelf.scale.z = 1.12; g.add(wetShelf);
  const saltLine = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.06, Math.max(0.16, radius * 0.025), 5, 14), seaSaltMat);
  saltLine.rotation.x = Math.PI / 2; saltLine.position.y = Math.max(0.92, height * 0.155); saltLine.scale.z = 1.08; g.add(saltLine);

  for (let i = 0; i < cluster; i++) {
    const a = (i / cluster) * TAU + rand(-0.45, 0.45);
    const off = i === 0 ? 0 : radius * rand(0.28, 0.72);
    const h = height * rand(i === 0 ? 0.72 : 0.35, i === 0 ? 1.05 : 0.72);
    const r = radius * rand(i === 0 ? 0.62 : 0.34, i === 0 ? 0.88 : 0.58);
    const pillar = makeRock(r, h, base, top, pick([6, 7]));
    pillar.position.set(Math.cos(a) * off, h * 0.33, Math.sin(a) * off);
    pillar.rotation.x = Math.sin(a) * rand(0.035, 0.09);
    pillar.rotation.z = -Math.cos(a) * rand(0.035, 0.09);
    g.add(pillar);
    // A tide-darkened collar and a small wind-cut ledge stop each column from
    // reading as an untouched primitive while retaining its existing silhouette.
    const wetCollar = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.94, r * 1.04, Math.max(0.55, h * 0.035), 7), seaWetMat);
    wetCollar.position.set(Math.cos(a) * off, h * 0.12, Math.sin(a) * off);
    wetCollar.rotation.x = pillar.rotation.x; wetCollar.rotation.z = pillar.rotation.z; g.add(wetCollar);
    if (i < 2) {
      const ledge = makeRock(r * rand(0.70, 0.94), Math.max(2.2, h * 0.055), base, top, 6);
      ledge.position.set(Math.cos(a) * off + Math.cos(a) * r * 0.18, h * rand(0.38, 0.62), Math.sin(a) * off + Math.sin(a) * r * 0.18);
      ledge.scale.set(1.45, 0.55, 0.72); g.add(ledge);
    }
  }

  // Small fracture blocks read as broken stone ledges without creating the old
  // flat floating-island look. A fifth fragment makes the large sea stacks feel
  // weathered asymmetrically without altering their parent collision volume.
  for (let i = 0; i < 5; i++) {
    const a = rand(TAU);
    const block = makeRock(radius * rand(0.18, 0.32), height * rand(0.10, 0.18), base, top, 5);
    block.position.set(Math.cos(a) * radius * rand(0.62, 1.15), height * rand(0.20, 0.46), Math.sin(a) * radius * rand(0.62, 1.15));
    g.add(block);
  }
  return g;
}

function mossCap(radius, color) {
  const geo = new THREE.IcosahedronGeometry(radius, 1);
  geo.scale(1, 0.32, 1);
  return new THREE.Mesh(geo, toonMat(color, { emissive: color, emissiveIntensity: 0.045, flat: true }));
}

/** Broken moss shelves add life to wet cliffs without forming a uniform green crown. */
function mossLedge(radius, color) {
  const g = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const patch = mossCap(radius * rand(0.20, 0.42), color);
    const a = (i / 4) * TAU + rand(-0.35, 0.35);
    patch.position.set(Math.cos(a) * radius * rand(0.12, 0.52), rand(-0.6, 0.7), Math.sin(a) * radius * rand(0.10, 0.46));
    patch.rotation.set(rand(-0.12, 0.12), rand(TAU), rand(-0.08, 0.08));
    g.add(patch);
  }
  g.userData.noCollide = true;
  return g;
}

/**
 * A side-framing natural arch: heavy weathered legs and an offset faceted crown.
 * It is exclusively scenery and must be positioned outside the route by callers.
 */
function naturalStoneArch(width, height, base, top, material = cliffMat) {
  const g = new THREE.Group();
  const legH = height * 0.68;
  const legR = width * 0.18;
  for (const side of [-1, 1]) {
    const leg = makeCliffRock(legR * rand(0.92, 1.08), legH, base, top, 7, material);
    leg.position.set(side * width * 0.43, legH * 0.31, rand(-width * 0.05, width * 0.05));
    leg.rotation.z = side * rand(-0.10, 0.10);
    g.add(leg);
    const foot = makeCliffRock(legR * 1.28, Math.max(4, legH * 0.13), base, top, 7, material);
    foot.position.set(side * width * 0.45, Math.max(1.5, legH * 0.055), rand(-width * 0.08, width * 0.08));
    foot.scale.z = 1.16; g.add(foot);
  }
  const crown = new THREE.Mesh(new THREE.TorusGeometry(width * 0.43, Math.max(3.2, width * 0.085), 6, 14, Math.PI), material);
  crown.position.set(0, legH * 0.60, 0);
  crown.scale.set(1, 1.14, 0.86);
  crown.rotation.z = rand(-0.12, 0.12);
  g.add(crown);
  for (let i = 0; i < 4; i++) {
    const fragment = makeCliffRock(width * rand(0.06, 0.12), height * rand(0.06, 0.13), base, top, 6, material);
    const side = i % 2 ? 1 : -1;
    fragment.position.set(side * width * rand(0.22, 0.58), rand(1, height * 0.18), rand(-width * 0.28, width * 0.28));
    fragment.rotation.z = side * rand(-0.24, 0.24); g.add(fragment);
  }
  g.userData.noCollide = true;
  return g;
}

/** textured snow / ice cap */
function snowCap(radius) {
  const geo = new THREE.IcosahedronGeometry(radius, 1);
  geo.scale(1, 0.34, 1);
  return new THREE.Mesh(geo, snowCapMat);
}

/** low-poly conifer for the gorge zone */
function conifer(scale, trunkCol = 0x6b4a2e, leafCol = 0x3f9b46) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5 * scale, 0.7 * scale, 3 * scale, 5), toonMat(trunkCol, { flat: true }));
  trunk.position.y = 1.5 * scale;
  g.add(trunk);
  for (let i = 0; i < 3; i++) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry((2.4 - i * 0.55) * scale, 3 * scale, 6), toonMat(leafCol, { flat: true }));
    cone.position.y = (3 + i * 2) * scale;
    g.add(cone);
  }
  return g;
}

/** glowing crystal pylon for the ember zone */
function crystal(h, color) {
  // A volcanic outcrop: dark faceted basalt carries a few thin molten seams.
  // The restrained emissive faces read as dangerous terrain without competing
  // with laser, pickup and lock-on colours in the combat corridor.
  const g = new THREE.Group();
  const base = makeRock(h * 0.28, h * 0.20, 0x211721, 0x4a3030, 6);
  base.position.y = h * 0.06;
  base.scale.z = 1.18;
  g.add(base);
  const main = new THREE.Mesh(new THREE.ConeGeometry(h * 0.18, h * 0.86, 6), toonMat(0x241923, { emissive: color, emissiveIntensity: 0.70, flat: true }));
  main.position.y = h * 0.48;
  main.rotation.y = rand(TAU);
  g.add(main);
  for (let i = 0; i < 3; i++) {
    const shard = new THREE.Mesh(new THREE.ConeGeometry(h * 0.075, h * rand(0.34, 0.58), 5), toonMat(0x21171f, { emissive: color, emissiveIntensity: 0.50, flat: true }));
    const a = rand(TAU);
    shard.position.set(Math.cos(a) * h * 0.17, h * 0.22, Math.sin(a) * h * 0.17);
    shard.rotation.z = rand(-0.40, 0.40); shard.rotation.x = rand(-0.35, 0.35);
    g.add(shard);
  }
  const seam = new THREE.Mesh(new THREE.BoxGeometry(h * 0.07, h * 0.46, h * 0.055), toonMat(0x2c1720, { emissive: color, emissiveIntensity: 0.88, flat: true }));
  seam.position.set(h * 0.075, h * 0.46, h * 0.14);
  seam.rotation.set(rand(-0.15, 0.15), rand(TAU), rand(-0.18, 0.18));
  g.add(seam);
  g.userData.glowMat = seam.material;
  return g;
}

/** Grounded sandstone ruin: fluted shaft, fractured crown and buried footing. */
function weatheredRuinPillar(radius, height, base, top, material = cliffMat) {
  const g = new THREE.Group();
  const footing = makeCliffRock(radius * 1.34, Math.max(7, height * 0.18), base, top, 8, material);
  footing.position.y = Math.max(1.5, height * 0.075); footing.scale.y = 0.66; g.add(footing);
  const shaft = makeCliffRock(radius * 0.76, height * 0.80, base, top, 8, material);
  shaft.position.y = height * 0.43; g.add(shaft);
  const collarMat = toonMat(top, { flat: true });
  for (const y of [height * 0.22, height * 0.54]) {
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.92, radius * 0.98, Math.max(1.4, height * 0.035), 8), collarMat);
    collar.position.y = y; g.add(collar);
  }
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * TAU;
    const flute = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.14, height * 0.42, radius * 0.10), toonMat(base, { flat: true }));
    flute.position.set(Math.cos(a) * radius * 0.72, height * 0.44, Math.sin(a) * radius * 0.72);
    flute.rotation.y = -a; g.add(flute);
  }
  const crown = makeCliffRock(radius * 1.04, Math.max(5, height * 0.13), top, top, 7, material);
  crown.position.set(rand(-radius * 0.15, radius * 0.15), height * 0.88, rand(-radius * 0.12, radius * 0.12)); crown.rotation.z = rand(-0.12, 0.12); g.add(crown);
  for (let i = 0; i < 3; i++) {
    const shard = makeCliffRock(radius * rand(0.13, 0.23), height * rand(0.07, 0.14), base, top, 6, material);
    const a = rand(TAU); shard.position.set(Math.cos(a) * radius * rand(0.82, 1.18), rand(1, height * 0.13), Math.sin(a) * radius * rand(0.82, 1.12)); g.add(shard);
  }
  return g;
}

/** A cratered meteor impact: layered rim, embedded iron core and short heat beacon. */
function meteorImpactSite(radius, base, top, accent, material = cliffMat) {
  const g = new THREE.Group();
  const rim = makeCliffRock(radius * 1.42, radius * 0.48, base, top, 8, material);
  rim.position.y = Math.max(0.8, radius * 0.07); rim.scale.y = 0.45; g.add(rim);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.82, radius * 1.02, Math.max(1.5, radius * 0.14), 10), toonMat(0x271e22, { flat: true }));
  bowl.position.y = Math.max(0.6, radius * 0.12); g.add(bowl);
  const meteor = makeCliffRock(radius * 0.56, radius * 1.35, 0x3b3436, 0x75604b, 7, material);
  meteor.position.set(radius * 0.10, radius * 0.45, -radius * 0.08); meteor.rotation.set(rand(-0.34, 0.34), rand(TAU), rand(-0.30, 0.30)); g.add(meteor);
  const seamMat = toonMat(0x25151c, { emissive: accent, emissiveIntensity: 1.05, flat: true });
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * TAU + 0.25;
    const seam = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.92, 0.52, 0.62), seamMat);
    seam.position.set(Math.cos(a) * radius * 0.55, radius * 0.30, Math.sin(a) * radius * 0.55); seam.rotation.y = -a; g.add(seam);
  }
  const beacon = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(), color: accent, transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false, fog: true }));
  beacon.position.set(0, radius * 1.15, 0); beacon.scale.set(radius * 0.95, radius * 1.45, 1); g.add(beacon);
  g.userData.impactGlow = seamMat;
  g.userData.impactBeacon = beacon;
  return g;
}

/* ---------------- waterfall material (scrolling stripes) -- */
function waterfallTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#2a5cd0'; g.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 30; i++) {
    const x = rand(0, 128), w = rand(3, 12);
    g.fillStyle = pick(['#3f74e0', '#5b90ec', '#dceaff', '#a9c8f5']);
    g.globalAlpha = rand(0.35, 0.9);
    const y = rand(0, 256), h = rand(30, 120);
    g.fillRect(x, y, w, h);
    if (y + h > 256) g.fillRect(x, 0, w, y + h - 256);
  }
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ============================================================
 *  Terrain — chunked, endlessly recycling, zone aware, wide field
 * ========================================================== */
export class Terrain {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.zone = null;
    this.chunks = [];
    this.waterfallMats = [];
    this.glows = [];           // pulsing emissive decorations
    this.naturalEffects = [];  // chunk-owned visual phenomena; transform-only update
    this.time = 0;
    // Decorative transforms can run below gameplay rate. Chunk movement and
    // collision logic remain full-rate so controls and route safety are unchanged.
    this._ambientAccumulator = 0;
    this._ambientInterval = 1 / 30;
    this._drawDistance = 1500;
    this.stage = 1;
    this.stageVariant = 0;
    this._nextVirtual = 0;

    this._buildWater();
    this._buildSunGlint();
    this._buildUnderlay();
    this._buildImpactMarks();

    for (let i = 0; i < NUM_CHUNKS; i++) {
      const g = new THREE.Group();
      g.position.z = -i * CHUNK_LEN;
      g.userData.virtualZ = -i * CHUNK_LEN;
      g.userData.obstacles = [];
      this.group.add(g);
      this.chunks.push(g);
    }
    this._nextVirtual = -NUM_CHUNKS * CHUNK_LEN;
  }

  /* ---------- global water plane (sea + gorge) ---------- */
  _buildWater() {
    // The water is viewed at speed and through fog; a 56×32 mesh preserves its
    // silhouette while reducing animated vertices by about 37%.
    const geo = new THREE.PlaneGeometry(4200, 2600, 56, 32);
    geo.rotateX(-Math.PI / 2);
    this._waterFrame = 0;
    this._waterNormalFrame = 0;
    const colors = new Float32Array(geo.attributes.position.count * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.waterMat = WATER_MATS.sea;
    this.water = new THREE.Mesh(geo, this.waterMat);
    this.water.position.set(0, 0, -900);
    this.scene.add(this.water);
    this._waterDeep = new THREE.Color(0x123055);
    this._waterShallow = new THREE.Color(0x1d4a7e);
  }

  /** soft sun-glitter mask: a narrow bright wedge at the horizon that widens and
   *  breaks into flecks toward the viewer, with fully feathered edges — without
   *  this falloff the glint plane reads as a hard beige road on the water */
  _glintTexture() {
    const W = 64, H = 256;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(W, H);
    for (let y = 0; y < H; y++) {
      const t = 1 - y / (H - 1);                       // 1 = far (sun), 0 = near
      const along = Math.pow(t, 2.0) * (1 - Math.pow(1 - t, 12));  // fade out both ends
      const spread = 0.16 + (1 - t) * 0.8;             // tight at the sun, wide up close
      for (let x = 0; x < W; x++) {
        const u = (x / (W - 1)) * 2 - 1;
        const across = Math.exp(-(u * u) / (2 * spread * spread));
        // glitter breaks into flecks the closer it gets to the viewer
        const n = 0.5 + 0.5 * Math.sin(y * 1.9 + Math.sin(x * 2.7) * 3.3);
        const speck = 1 - (1 - n) * (1 - t) * 0.85;
        const a = along * across * speck;
        const i = (y * W + x) * 4;
        img.data[i] = 255; img.data[i + 1] = 228; img.data[i + 2] = 184;
        img.data[i + 3] = Math.max(0, Math.min(255, a * 255));
      }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _buildSunGlint() {
    const geo = new THREE.PlaneGeometry(170, 1700);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      map: this._glintTexture(), color: 0xffa040, transparent: true, opacity: 0.0,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    });
    this.glint = new THREE.Mesh(geo, mat);
    this.glint.position.set(30, 0.4, -1000);
    this.scene.add(this.glint);

    // twinkling sun-sparkles on the water surface
    const N = 90;
    const pos = new Float32Array(N * 3);
    this._sparklePhase = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = 30 + (Math.random() - 0.5) * 120;
      pos[i * 3 + 1] = 0.6;
      pos[i * 3 + 2] = -200 - Math.random() * 1500;
      this._sparklePhase[i] = Math.random() * Math.PI * 2;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const alpha = new Float32Array(N); sg.setAttribute('aA', new THREE.BufferAttribute(alpha, 1));
    this._sparkleMat = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: dotTexture() }, uColor: { value: new THREE.Color(0xfff0c0) } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      vertexShader: `attribute float aA; varying float vA; void main(){ vA=aA; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=90.0/-mv.z*aA; gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `uniform sampler2D uTex; uniform vec3 uColor; varying float vA; void main(){ gl_FragColor=vec4(uColor,1.0)*texture2D(uTex,gl_PointCoord)*vA; }`,
    });
    this.sparkles = new THREE.Points(sg, this._sparkleMat);
    this.sparkles.frustumCulled = false;
    this.sparkles.visible = false;
    this.scene.add(this.sparkles);
  }

  /** flat backstop plane so chunk gaps never show sky below the horizon */
  _buildUnderlay() {
    const geo = new THREE.PlaneGeometry(4400, 3000);
    geo.rotateX(-Math.PI / 2);
    this.underlayMat = new THREE.MeshToonMaterial({ color: 0x35284a, gradientMap: toonGradient() });
    this.underlay = new THREE.Mesh(geo, this.underlayMat);
    this.underlay.position.set(0, -6.2, -1000);
    this.underlay.userData.noCollide = true;
    this.underlay.visible = false;
    this.scene.add(this.underlay);
  }

  /** Grounded heavy impacts leave a short-lived, pooled material response. */
  _buildImpactMarks() {
    const loader = new THREE.TextureLoader();
    const scorch = loader.load('./assets/particles/scorch_01.png');
    scorch.colorSpace = THREE.SRGBColorSpace;
    this.impactMarks = [];
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 20; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: scorch, color: 0x20120e, transparent: true, opacity: 0,
        depthWrite: false, blending: THREE.NormalBlending, fog: false,
      });
      const mark = new THREE.Mesh(geo, mat);
      mark.visible = false;
      mark.renderOrder = 1;
      mark.userData = { life: 0, maxLife: 1, base: 1, kind: 'dune' };
      this.scene.add(mark);
      this.impactMarks.push(mark);
    }
  }

  /** Add a material-aware residual at low altitude; air bursts remain particle-only. */
  impactMark(pos, big = false, opts = {}) {
    if (!pos || pos.y > (opts.groundLimit ?? 18)) return;
    const mark = this.impactMarks.find((m) => !m.visible) ?? this.impactMarks[0];
    const id = this.zone?.id ?? 'dune';
    const palette = {
      sea: { color: 0x86d8ee, opacity: 0.28, life: 0.8, y: 0.18 },
      gorge: { color: 0x6e5b4b, opacity: 0.34, life: 1.7, y: 0.05 },
      ember: { color: 0xff522d, opacity: 0.5, life: 2.0, y: 0.08 },
      dune: { color: 0x936d43, opacity: 0.4, life: 1.8, y: 0.06 },
    };
    const p = palette[id] ?? palette.dune;
    const base = (big ? 36 : 16) * (opts.markScale ?? 1) * rand(0.8, 1.18);
    mark.visible = true;
    mark.position.set(pos.x, p.y, pos.z);
    mark.rotation.z = rand(TAU);
    mark.scale.setScalar(base);
    mark.material.color.setHex(p.color);
    mark.material.opacity = p.opacity;
    mark.userData = { life: p.life * (big ? 1.1 : 0.8), maxLife: p.life * (big ? 1.1 : 0.8), base, kind: id, op: p.opacity };

    if (id === 'sea') {
      this.sparkles.visible = true;
    } else if (id === 'ember') {
      this.glows.push({ chunk: null, mat: mark.material, base: p.opacity, amp: p.opacity * 0.25, off: rand(TAU), impact: true });
    }
    return mark;
  }

  _updateWater(dt) {
    if (!this.zone) return;
    // All liquid surfaces share a compact, time-driven shader. Updating four
    // uniforms is cheaper than mutating another full grid of vertices.
    for (const mat of FLUID_MATS) mat.uniforms.uTime.value = this.time;
    const vis = !!this.zone.water;
    this.water.visible = vis;
    this.glint.visible = vis && this.zone.id === 'sea';
    if (!vis) return;
    // Animated water is a background surface. Updating it at 20 Hz remains
    // smooth at flight speed, while direct typed-array writes avoid accessor
    // overhead. Flat shading means normal recomputation can be infrequent.
    this._waterFrame = (this._waterFrame + 1) % 3;
    if (this._waterFrame === 0) {
      const posAttr = this.water.geometry.attributes.position;
      const colAttr = this.water.geometry.attributes.color;
      const pos = posAttr.array, col = colAttr.array;
      const t = this.time;
      const cd = this._waterDeep, cs = this._waterShallow;
      const dr = cs.r - cd.r, dg = cs.g - cd.g, db = cs.b - cd.b;
      const zOffset = this.water.position.z;
      for (let i = 0, j = 0; i < pos.length; i += 3, j += 3) {
        const x = pos[i], z = pos[i + 2] - zOffset;
        const h = Math.sin(x * 0.045 + t * 1.4) * 0.7 + Math.sin(z * 0.05 + t * 0.9 + x * 0.02) * 0.8
          + Math.sin((x + z) * 0.021 + t * 0.6) * 0.5;
        pos[i + 1] = h;
        const k = clamp(h * 0.38 + 0.5, 0, 1);
        col[j] = cd.r + dr * k; col[j + 1] = cd.g + dg * k; col[j + 2] = cd.b + db * k;
      }
      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
      this._waterNormalFrame = (this._waterNormalFrame + 1) % 6;
      if (this._waterNormalFrame === 0) this.water.geometry.computeVertexNormals();
    }
    // The sun trail is a horizon cue, not a white runway across the combat lane.
    this.glint.material.opacity = this.zone.id === 'sea' ? 0.085 + Math.sin(this.time * 2.2) * 0.018 : 0;

    // twinkle + scroll the sparkles, only in the sea zone
    const showSpark = this.zone.id === 'sea';
    this.sparkles.visible = showSpark;
    if (showSpark) {
      const sp = this.sparkles.geometry.attributes.position.array;
      const sa = this.sparkles.geometry.attributes.aA.array;
      const N = sa.length;
      for (let i = 0; i < N; i++) {
        sp[i * 3 + 2] += 46 * dt;                 // drift toward camera like the water
        if (sp[i * 3 + 2] > 40) { sp[i * 3 + 2] -= 1600; sp[i * 3] = 30 + (Math.random() - 0.5) * 120; }
        const tw = Math.sin(this.time * 7 + this._sparklePhase[i]);
        sa[i] = Math.max(0, tw) ** 3;             // sharp twinkle
      }
      this.sparkles.geometry.attributes.position.needsUpdate = true;
      this.sparkles.geometry.attributes.aA.needsUpdate = true;
      this._sparkleMat.uniforms.uColor.value.copy(this._waterShallow).lerp(new THREE.Color(0xffedbe), 0.48);
    }
  }

  /* ---------- zone switching ---------- */
  setZone(zone) {
    const prev = this.zone;
    this.zone = zone;
    if (zone.water) {
      this._waterDeep.set(zone.water.deep);
      this._waterShallow.set(zone.water.shallow);
      this.waterMat = WATER_MATS[zone.id] ?? WATER_MATS.sea;
      this.water.material = this.waterMat;
      // Match the shader surface to the authored zone palette as well as the
      // low-frequency vertex-water colours, so shallow water reads turquoise
      // instead of a generic pale overlay.
      this.waterMat.uniforms.uDeep.value.set(zone.water.deep);
      this.waterMat.uniforms.uShallow.value.set(zone.water.shallow);
      if (zone.water.glint) this.glint.material.color.set(zone.water.glint);
    }
    this.floorMaterial = FLOOR_MATS[zone.id] ?? null;
    this.underlay.visible = !zone.water;
    if (zone.ground) this.underlayMat.color.set(zone.ground.base);
    else if (zone.sand) this.underlayMat.color.set(zone.sand.shade);
    if (this.floorMaterial) {
      this.underlayMat.map = this.floorMaterial.map;
      this.underlayMat.normalMap = this.floorMaterial.normalMap;
      this.underlayMat.normalScale.copy(this.floorMaterial.normalScale);
      this.underlayMat.needsUpdate = true;
    } else if (this.underlayMat.map) {
      this.underlayMat.map = null; this.underlayMat.normalMap = null;
      this.underlayMat.needsUpdate = true;
    }
    // Population is deliberately deferred to setStage(). Game applies both in
    // sequence, so this avoids rebuilding every chunk twice at each Wave change.
    this.cliffMaterial = CLIFF_MATS[zone.id] ?? cliffMat;
    this._zoneChanged = prev?.id !== zone.id;
  }

  /** Apply a deterministic visual identity for every campaign wave. */
  setStage(wave, zone = this.zone) {
    this.stage = wave;
    this.stageVariant = (wave - 1) % 3;
    if (zone) this.zone = zone;
    for (const chunk of this.chunks) this._populate(chunk);
  }

  /** Decorative scenery can update below gameplay rate without changing routes or collisions. */
  setAmbientRate(hz = 30) {
    this._ambientInterval = 1 / clamp(hz, 15, 60);
  }

  /** Hide far terrain past fog-relevant range while retaining full-rate chunk recycling. */
  setDrawDistance(distance = 1500) {
    this._drawDistance = clamp(distance, 780, 1800);
  }

  /* ---------- collidable obstacle registry ----------
   * Every reachable scenery object gets a cylinder collider whose horizontal
   * radius + vertical half-height are derived from its actual bounding box, so
   * the hit volume matches the visible surface. Colliders are computed in one
   * pass per chunk (_autoCollideChunk) after population. `_obstacle` just flags
   * an explicit damage value; the geometry-fit happens in the pass.
   */
  _obstacle(chunk, mesh, _r, damage = 18) {
    mesh.userData.dmg = damage;
    chunk.add(mesh);
    return mesh;
  }

  /** build bbox-fit cylinder colliders for all reachable props in the chunk */
  _autoCollideChunk(chunk) {
    chunk.updateMatrixWorld(true);
    const zc = chunk.position.z;
    const obs = chunk.userData.obstacles;
    for (const o of chunk.children) {
      if (o.userData.noCollide || o.userData.collide) continue;
      if (Math.abs(o.position.x) > COLLIDE_REACH) continue; // far background only
      _box.setFromObject(o);
      if (_box.isEmpty()) continue;
      _box.getCenter(_bc); _box.getSize(_bs);
      o.userData.collide = {
        cx: _bc.x, cy: _bc.y, cz: _bc.z - zc,          // chunk-local centre
        rh: Math.max(_bs.x, _bs.z) * 0.5,              // horizontal radius
        hy: _bs.y * 0.5,                               // vertical half-height
        damage: o.userData.dmg ?? 14,
      };
      obs.push(o);
    }
  }

  /** register one extra collider (chunk-local cz) — used for ring/arch rims that
   *  a single bbox cylinder can't describe without plugging their opening */
  _addCollider(chunk, cx, cy, czLocal, rh, hy, damage = 14) {
    chunk.userData.obstacles.push({ userData: { collide: { cx, cy, cz: czLocal, rh, hy, damage } } });
  }

  /** trace a torus arc (rim of a ring / span of an arch) with a chain of small
   *  overlapping colliders, leaving the central opening passable */
  _torusColliders(chunk, cx0, cy0, czLocal, R, tube, a0, a1, rotZ, damage) {
    const rh = Math.max(tube + 3, 8);
    const arcLen = R * Math.abs(a1 - a0);
    const samples = clamp(Math.round(arcLen / (rh * 1.05)), 6, 24);
    const cosR = Math.cos(rotZ), sinR = Math.sin(rotZ);
    for (let i = 0; i <= samples; i++) {
      const a = a0 + (a1 - a0) * (i / samples);
      const dx = R * Math.cos(a), dy = R * Math.sin(a);
      this._addCollider(chunk, cx0 + dx * cosR - dy * sinR, cy0 + dx * sinR + dy * cosR, czLocal, rh, rh, damage);
    }
  }

  /** call the callback with world-space cylinder-collider info near the play plane */
  forEachObstacle(cb) {
    for (const chunk of this.chunks) {
      const cz = chunk.position.z;
      const obs = chunk.userData.obstacles;
      for (let i = 0; i < obs.length; i++) {
        const c = obs[i].userData.collide;
        const wz = c.cz + cz;
        if (wz > -90 - c.rh && wz < 50 + c.rh) cb(c.cx, c.cy, wz, c.rh, c.hy, c.damage, obs[i]);
      }
    }
  }

  /* ---------- chunk population ---------- */
  _clear(chunk) {
    for (let i = chunk.children.length - 1; i >= 0; i--) {
      const o = chunk.children[i];
      chunk.remove(o);
      o.traverse?.((n) => { if (n.geometry && !n.userData.shared) n.geometry.dispose?.(); });
    }
    chunk.userData.obstacles.length = 0;
    // drop this chunk's glow + waterfall refs so they don't leak on recycle
    this.glows = this.glows.filter((gr) => gr.chunk !== chunk);
    this.waterfallMats = this.waterfallMats.filter((w) => w.chunk !== chunk);
    for (const fx of this.naturalEffects) if (fx.chunk === chunk) fx.mat?.dispose?.();
    this.naturalEffects = this.naturalEffects.filter((fx) => fx.chunk !== chunk);
  }

  _populate(chunk) {
    this._clear(chunk);
    const z = this.zone;
    if (!z) return;
    switch (z.terrain) {
      case 'ocean': this._popOcean(chunk, z); break;
      case 'gorge': this._popGorge(chunk, z); break;
      case 'ember': this._popEmber(chunk, z); break;
      case 'dune': this._popDune(chunk, z); break;
    }
    this._routeMarkers(chunk, z);
    this._stageSetpiece(chunk, z);
    this._zonePhenomena(chunk, z);
    this._autoCollideChunk(chunk);
  }

  /** place obstacles across the width but always leave a navigable gap */
  _obstacleRow(chunk, zz, count, place) {
    const route = flightRoute(this.zone?.id, chunk.userData.virtualZ + zz);
    const gapCenter = route.center;
    // Preserve a full ship-width of visual and collision clearance beyond the
    // beacon channel. Individual props may be wide, so centre-only placement is
    // not sufficient to guarantee a fair weaving line.
    const gapHalf = route.halfWidth + 54;
    let made = 0, tries = 0;
    while (made < count && tries < count * 4) {
      tries++;
      const x = rand(-FIELD * 0.86, FIELD * 0.86);
      if (Math.abs(x - gapCenter) < gapHalf) continue;
      place(x, zz + rand(-30, 30));
      made++;
    }
  }

  /** A low natural obstacle uses the same clearly visible route gap as all major props. */
  _naturalObstacleRow(chunk, zz, make, damage = 14) {
    this._obstacleRow(chunk, zz, 1, (x, cz) => {
      const mesh = make(x, cz);
      if (mesh) {
        mesh.userData.naturalHazard = true;
        this._obstacle(chunk, mesh, 0, damage);
      }
    });
  }

  /**
   * Route markers are environmental infrastructure, not UI. They sit beyond the
   * collision corridor and use the same curve as obstacle gaps, making the safe
   * flight channel legible through fog, combat effects, and changing terrain.
   */
  _routeMarkers(chunk, z) {
    const styles = {
      sea:   { body: 0x25475f, trim: 0x87eaff, lamp: 0x7be8ff, height: 10 },
      gorge: { body: 0x665844, trim: 0xb6e7ff, lamp: 0x9deaff, height: 14 },
      ember: { body: 0x401f2c, trim: 0x8e3b32, lamp: 0xff7040, height: 16 },
      dune:  { body: 0x756144, trim: 0xcbb982, lamp: 0xffd77a, height: 13 },
    };
    const s = styles[z.id] ?? styles.dune;
    for (const localZ of [-42, -178]) {
      const route = flightRoute(z.id, chunk.userData.virtualZ + localZ);
      for (const side of [-1, 1]) {
        const g = new THREE.Group();
        const x = route.center + side * (route.halfWidth + 24);
        if (z.id === 'sea') {
          // Anchored navigation buoy: a low pontoon and twin braces make it part
          // of the water surface rather than a generic pole on the horizon.
          const pontoon = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 5.8, 1.5, 8), toonMat(s.body, { flat: true }));
          pontoon.position.y = -0.2; g.add(pontoon);
          const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.95, s.height, 6), toonMat(s.body, { flat: true }));
          mast.position.y = s.height * 0.5 + 0.5; g.add(mast);
          for (const braceSide of [-1, 1]) {
            const brace = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.5, s.height * 0.62, 5), toonMat(s.trim, { flat: true }));
            brace.position.set(braceSide * 2.3, s.height * 0.28, 0); brace.rotation.z = braceSide * 0.32; g.add(brace);
          }
        } else if (z.id === 'gorge') {
          // Carved cliff survey pylon with a broad stone abutment.
          const footing = makeRock(6.5, 8, z.rock.base, z.rock.top, 6);
          footing.position.y = 1.6; g.add(footing);
          const mast = new THREE.Mesh(new THREE.BoxGeometry(1.45, s.height, 1.45), toonMat(s.body, { flat: true }));
          mast.position.y = s.height * 0.5 + 2.5; g.add(mast);
          const vane = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.45, 1.1), toonMat(s.trim, { flat: true }));
          vane.position.y = s.height * 0.72 + 2.5; g.add(vane);
        } else if (z.id === 'ember') {
          // Heat conduit with armoured cooling fins rooted into the volcanic floor.
          const foot = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 6.6, 2.8, 6), toonMat(s.body, { flat: true }));
          foot.position.y = 0.2; g.add(foot);
          const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 1.55, s.height, 6), toonMat(s.body, { flat: true }));
          mast.position.y = s.height * 0.5 + 1; g.add(mast);
          for (const finSide of [-1, 1]) {
            const fin = new THREE.Mesh(new THREE.BoxGeometry(4.8, 3.2, 0.42), toonMat(s.trim, { emissive: s.lamp, emissiveIntensity: 0.35, flat: true }));
            fin.position.set(finSide * 1.25, s.height * 0.5 + 1, 0); fin.rotation.z = finSide * 0.33; g.add(fin);
          }
        } else {
          // Weathered desert range marker: stepped plinth, sandstone mast, and
          // a shaded wind fin that points down the open flight channel.
          const foot = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 6.4, 3.4, 6), toonMat(s.body, { flat: true }));
          foot.position.y = 0.45; g.add(foot);
          const mast = new THREE.Mesh(new THREE.BoxGeometry(1.7, s.height, 1.7), toonMat(s.trim, { flat: true }));
          mast.position.y = s.height * 0.5 + 1.2; g.add(mast);
          const fin = new THREE.Mesh(new THREE.BoxGeometry(0.35, 4.2, 5.2), toonMat(s.body, { flat: true }));
          fin.position.y = s.height * 0.74 + 1.2; g.add(fin);
        }
        const collar = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.65, 6), toonMat(s.trim, { flat: true }));
        collar.position.y = s.height * 0.68 + 1; g.add(collar);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.25, 8, 6), toonMat(0x181c24, { emissive: s.lamp, emissiveIntensity: 1.4, flat: true }));
        lamp.position.y = s.height + 1.7; g.add(lamp);
        // A physical signal cage makes the marker legible as world infrastructure,
        // not a floating UI dot. It has no collider and preserves the clear route.
        const signalCage = new THREE.Mesh(new THREE.TorusGeometry(1.62, 0.12, 5, 10), toonMat(s.trim, { emissive: s.lamp, emissiveIntensity: 0.18, flat: true }));
        signalCage.rotation.x = Math.PI / 2; signalCage.position.y = s.height + 1.7; g.add(signalCage);
        g.position.set(x, 0, localZ);
        g.userData.noCollide = true;
        chunk.add(g);
        this.glows.push({ chunk, mat: lamp.material, base: 1.4, amp: 0.42, off: route.center * 0.03 + side });
      }
    }
  }

  /** One readable, grounded landmark per three recycled chunks. */
  _stageSetpiece(chunk, z) {
    const ordinal = Math.abs(Math.round(chunk.userData.virtualZ / CHUNK_LEN)) % 3;
    if (ordinal !== this.stageVariant) return;
    const route = flightRoute(z.id, chunk.userData.virtualZ - CHUNK_LEN * 0.52);
    const side = ((Math.abs(Math.floor(chunk.userData.virtualZ / CHUNK_LEN)) + this.stage) % 2) ? 1 : -1;
    const x = route.center + side * (route.halfWidth + rand(156, 220));
    const localZ = -CHUNK_LEN * rand(0.32, 0.72);
    const g = new THREE.Group();
    g.position.set(x, 0, localZ);
    g.rotation.y = side * rand(-0.28, 0.28);
    g.userData.noCollide = true;

    // Stage landmarks use a tiny paint-colour emission floor and double-sided
    // toon shading. This preserves panel facets in fog and on mobile GPU drivers
    // where a single unlit back face otherwise collapses into a black silhouette.
    const metal = (c, glow = 0x000000, intensity = 0) => {
      const selfLit = glow === 0x000000;
      return toonMat(c, {
        emissive: selfLit ? c : glow,
        emissiveIntensity: selfLit ? 0.11 : intensity,
        flat: true,
        side: THREE.DoubleSide,
      });
    };
    const lamp = (px, py, pz, color, scale = 1) => {
      const node = new THREE.Mesh(new THREE.OctahedronGeometry(2.0 * scale, 0), metal(0x151821, color, 1.8));
      node.position.set(px, py, pz); g.add(node);
      this.glows.push({ chunk, mat: node.material, base: 1.8, amp: 0.62, off: rand(TAU) });
    };

    if (z.id === 'sea') {
      // A real wave-side relay: submerged foot, deck, antennas and a weather vane.
      const reef = seaStack(28, 46, z.rock.base, z.rock.top);
      reef.position.y = -2; g.add(reef);
      const deck = new THREE.Mesh(new THREE.CylinderGeometry(23, 27, 4, 10), metal(0x29465b));
      deck.position.y = 20; g.add(deck);
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 5.4, 48, 8), metal(0x21394c));
      tower.position.y = 45; g.add(tower);
      for (let i = 0; i < 3; i++) {
        const dish = new THREE.Mesh(new THREE.ConeGeometry(9 - i, 2.8, 12, 1, true), metal(0x547d95, 0x6bdcff, 0.35));
        dish.position.set(side * (4 + i * 3), 39 + i * 9, 0); dish.rotation.z = side * 0.78; g.add(dish);
      }
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.1, 34, 6), metal(0x1c3042));
      mast.position.y = 84; g.add(mast);
      // Mooring booms and tension cables connect the tall relay to the reef deck,
      // so the sea landmark reads as an engineered outpost rather than a floating mast.
      for (const boomSide of [-1, 1]) {
        const boom = new THREE.Mesh(new THREE.BoxGeometry(20, 1.1, 1.4), metal(0x31566a));
        boom.position.set(boomSide * 13, 34, 4); boom.rotation.z = boomSide * 0.26; g.add(boom);
        const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 58, 5), metal(0x9ecfe2));
        cable.position.set(boomSide * 11, 57, 3); cable.rotation.z = boomSide * 0.28; g.add(cable);
        lamp(boomSide * 23, 39, 4, 0x7be8ff, 0.46);
      }
      // Service cages and offset maintenance pods give the relay a readable working scale.
      for (const serviceSide of [-1, 1]) {
        const pod = new THREE.Mesh(new THREE.BoxGeometry(7.2, 3.8, 5.4), metal(0x27475d));
        pod.position.set(serviceSide * 16, 24, -7); pod.rotation.z = serviceSide * 0.08; g.add(pod);
        const porthole = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.22, 8), metal(0x172734, 0x62d8ff, 0.75));
        porthole.rotation.x = Math.PI / 2; porthole.position.set(serviceSide * 16, 24.5, -9.8); g.add(porthole);
      }
      for (const py of [56, 72, 88]) {
        const cage = new THREE.Mesh(new THREE.TorusGeometry(1.65, 0.15, 5, 12), metal(0x476c80, 0x62d8ff, 0.18));
        cage.rotation.x = Math.PI / 2; cage.position.set(0, py, 0); g.add(cage);
      }
      lamp(0, 104, 0, 0x8eeaff, 1.35);
    } else if (z.id === 'gorge') {
      // A cliff-side suspension observatory: buttresses, span and cascading mist.
      const footing = makeRock(34, 68, z.rock.base, z.rock.top, 7);
      footing.position.y = 20; g.add(footing);
      for (const offset of [-16, 16]) {
        const pylon = new THREE.Mesh(new THREE.BoxGeometry(7, 72, 8), metal(0x5d5548));
        pylon.position.set(offset, 52, 0); g.add(pylon);
        const cap = new THREE.Mesh(new THREE.ConeGeometry(6, 12, 6), metal(0x3c4650));
        cap.position.set(offset, 94, 0); g.add(cap);
        lamp(offset, 88, 0, 0xa8efff, 0.75);
      }
      const span = new THREE.Mesh(new THREE.BoxGeometry(62, 3.8, 12), metal(0x4b4a45));
      span.position.y = 73; g.add(span);
      for (let i = 0; i < 5; i++) {
        const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 34, 5), metal(0xceddec));
        cable.position.set(-22 + i * 11, 53 + Math.sin((i / 4) * Math.PI) * 16, 0);
        cable.rotation.z = (i - 2) * 0.22; g.add(cable);
      }
      // Repeating hangers and lower maintenance cradles give the observatory a
      // believable load path into the canyon walls and add parallax under the span.
      for (let i = 0; i < 4; i++) {
        const hx = -18 + i * 12;
        const hanger = new THREE.Mesh(new THREE.BoxGeometry(0.75, 24 + (i % 2) * 8, 0.75), metal(0x303c47));
        hanger.position.set(hx, 58 - (i % 2) * 3, 2.8); g.add(hanger);
        const cradle = new THREE.Mesh(new THREE.BoxGeometry(8.6, 1.1, 5.2), metal(0x4c504a));
        cradle.position.set(hx, 45 - (i % 2) * 6, 2.8); g.add(cradle);
        lamp(hx, cradle.position.y + 2.0, 2.8, 0xa8efff, 0.34);
      }
      const mist = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(), color: 0xdff7ff, transparent: true, opacity: 0.38, depthWrite: false }));
      mist.position.set(0, 34, -5); mist.scale.set(46, 18, 1); g.add(mist);
    } else if (z.id === 'ember') {
      // Layered heat-exchange stack: glowing conduits, exhaust crown and armoured fins.
      const base = new THREE.Mesh(new THREE.CylinderGeometry(30, 36, 9, 8), metal(0x34202d));
      base.position.y = 4; g.add(base);
      for (let i = 0; i < 3; i++) {
        const stack = new THREE.Mesh(new THREE.CylinderGeometry(4.2 - i * 0.5, 6.4 - i * 0.4, 45 + i * 14, 7), metal(0x3b2631, z.rock.glow, 0.35));
        stack.position.set((i - 1) * 12, 28 + i * 10, -4 + i * 5); g.add(stack);
        const collar = new THREE.Mesh(new THREE.TorusGeometry(5.1 - i * 0.4, 0.6, 6, 12), metal(0x241721, z.rock.glow, 0.85));
        collar.rotation.x = Math.PI / 2; collar.position.copy(stack.position); collar.position.y += (45 + i * 14) * 0.22; g.add(collar);
        lamp(stack.position.x, stack.position.y + (45 + i * 14) * 0.5 + 2, stack.position.z, 0xff7040, 0.85);
      }
      const fin = new THREE.Mesh(new THREE.BoxGeometry(78, 4.5, 18), metal(0x4c2b31, z.rock.glow, 0.45));
      fin.position.y = 24; fin.rotation.z = side * 0.24; g.add(fin);
      // Repeating heat-sink plates and a lower intake turn the platform into an
      // engineered exchanger rather than a single glowing slab.
      for (const finSide of [-1, 1]) {
        for (let i = 0; i < 5; i++) {
          const sink = new THREE.Mesh(new THREE.BoxGeometry(1.0, 10 + (i % 2) * 3, 15), metal(0x251923, z.rock.glow, 0.14));
          sink.position.set(finSide * (20 + i * 6), 27 + (i % 2) * 2, -2 + (i % 2) * 4); sink.rotation.z = finSide * 0.10; g.add(sink);
        }
        const intake = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.8, 5.2, 8), metal(0x1d1820, 0xff7040, 0.38));
        intake.position.set(finSide * 33, 6.0, 4); g.add(intake);
      }
      // Insulated manifold pipes visibly carry heat from the exchange stacks to
      // armoured side radiators; their hot collars pulse through the shared glow list.
      for (const pipeSide of [-1, 1]) {
        const manifold = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.55, 44, 7), metal(0x2d1d27, z.rock.glow, 0.28));
        manifold.position.set(pipeSide * 31, 16, 7); manifold.rotation.z = pipeSide * 0.30; g.add(manifold);
        for (const py of [6, 18, 30]) {
          const collar = new THREE.Mesh(new THREE.TorusGeometry(1.34, 0.17, 6, 10), metal(0x25131d, 0xff7040, 0.95));
          collar.rotation.x = Math.PI / 2; collar.position.set(pipeSide * 31, py, 7); g.add(collar);
          this.glows.push({ chunk, mat: collar.material, base: 0.95, amp: 0.34, off: py * 0.21 + pipeSide });
        }
      }
    } else {
      // A half-buried rift gate: broad foundations, a supported arch and signal nodes.
      const plinth = new THREE.Mesh(new THREE.CylinderGeometry(36, 44, 10, 8), metal(0x7d6748));
      plinth.position.y = 4; g.add(plinth);
      const arch = new THREE.Mesh(new THREE.TorusGeometry(42, 4.8, 8, 18, Math.PI), metal(0x836a48, this.stage >= 15 ? 0x9a7aff : 0x000000, this.stage >= 15 ? 0.7 : 0));
      arch.position.y = 16; arch.rotation.z = side * 0.1; g.add(arch);
      for (const sx of [-42, 42]) {
        const support = new THREE.Mesh(new THREE.CylinderGeometry(7, 10, 42, 7), metal(0x6e5941));
        support.position.set(sx, 20, 0); g.add(support);
        lamp(sx, 39, 0, this.stage >= 15 ? 0xb188ff : 0xffd77a, 0.72);
      }
      const obelisk = new THREE.Mesh(new THREE.ConeGeometry(8, 42, 5), metal(0x645140, this.stage >= 15 ? 0x865eff : 0x000000, this.stage >= 15 ? 0.5 : 0));
      obelisk.position.set(0, 26, -14); g.add(obelisk);
      // Broken survey arches and ribbed signal conductors make the rift gate a
      // constructed ruin. They remain outside the channel and have no collider.
      for (const riftSide of [-1, 1]) {
        const buttress = new THREE.Mesh(new THREE.BoxGeometry(7, 24, 10), metal(0x594838));
        buttress.position.set(riftSide * 27, 12, 7); buttress.rotation.z = riftSide * 0.22; g.add(buttress);
        const conductor = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.92, 34, 6), metal(0x2e2940, this.stage >= 15 ? 0xa98aff : 0xffc66b, this.stage >= 15 ? 0.62 : 0.18));
        conductor.position.set(riftSide * 29, 29, 7); conductor.rotation.z = riftSide * 0.20; g.add(conductor);
        for (const py of [18, 31, 43]) lamp(riftSide * 29, py, 7, this.stage >= 15 ? 0xb188ff : 0xffd77a, 0.32);
      }
    }

    // A shared service apron ties every zone-specific landmark into the ground
    // and repeats the route language in-world. It remains outside the safe lane
    // and has no collider, so it adds parallax and scale without changing play.
    const accent = z.id === 'sea' ? 0x8eeaff : z.id === 'gorge' ? 0xa8efff : z.id === 'ember' ? 0xff7040 : (this.stage >= 15 ? 0xb188ff : 0xffd77a);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(48, 2.2, 34), metal(z.id === 'ember' ? 0x34202d : z.id === 'sea' ? 0x223d50 : 0x5d5244));
    deck.position.set(0, 1.1, 12); g.add(deck);
    const trench = new THREE.Mesh(new THREE.BoxGeometry(39, 0.34, 1.15), metal(0x181d25, accent, 0.6));
    trench.position.set(0, 2.32, 7); g.add(trench);
    for (const lane of [-15, -5, 5, 15]) {
      const seam = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.28, 27), metal(0x1e2730));
      seam.position.set(lane, 2.32, 12); g.add(seam);
    }
    for (const sideDeck of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(1.1, 5.6, 25), metal(0x28313a));
      rail.position.set(sideDeck * 22, 4.0, 12); g.add(rail);
      const brace = new THREE.Mesh(new THREE.BoxGeometry(1.6, 11, 1.4), metal(0x202832));
      brace.position.set(sideDeck * 18, 5.5, 23); brace.rotation.z = sideDeck * 0.34; g.add(brace);
      for (const localZ of [1, 22]) {
        const beaconBase = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.15, 4, 6), metal(0x28313a));
        beaconBase.position.set(sideDeck * 18, 3.1, localZ); g.add(beaconBase);
        lamp(sideDeck * 18, 6.2, localZ, accent, 0.52);
      }
    }
    const relay = new THREE.Mesh(new THREE.BoxGeometry(12, 5.6, 7), metal(0x2c3440));
    relay.position.set(0, 5, 24); g.add(relay);
    const relayCore = new THREE.Mesh(new THREE.SphereGeometry(1.45, 8, 6), metal(0x161b23, accent, 1.1));
    relayCore.position.set(0, 7.0, 20.4); g.add(relayCore);
    this.glows.push({ chunk, mat: relayCore.material, base: 1.1, amp: 0.38, off: rand(TAU) });

    chunk.add(g);
  }

  /**
   * Lightweight chunk-owned nature layer. These effects deliberately have no
   * collider: terrain keeps the marked channel fair while motion supplies
   * weather, scale and depth at flight speed.
   */
  _zonePhenomena(chunk, z) {
    const route = flightRoute(z.id, chunk.userData.virtualZ - CHUNK_LEN * 0.52);
    const side = ((Math.abs(Math.floor(chunk.userData.virtualZ / CHUNK_LEN)) + this.stage) % 2) ? 1 : -1;
    const flank = route.center + side * (route.halfWidth + rand(34, 78));
    const fxGroup = new THREE.Group();
    fxGroup.userData.noCollide = true;
    chunk.add(fxGroup);
    const addSprite = (color, opacity, x, y, localZ, size, kind, extra = {}) => {
      const mat = new THREE.SpriteMaterial({ map: dotTexture(), color, transparent: true, opacity, depthWrite: false, blending: extra.additive ? THREE.AdditiveBlending : THREE.NormalBlending, fog: true });
      const sprite = new THREE.Sprite(mat);
      sprite.position.set(x, y, localZ);
      sprite.scale.set(size, size * (extra.tall ?? 1), 1);
      fxGroup.add(sprite);
      this.naturalEffects.push({ chunk, kind, mesh: sprite, mat, x, y, z: localZ, base: size, tall: extra.tall ?? 1, phase: rand(TAU), speed: extra.speed ?? 1, amp: extra.amp ?? 1, op: opacity, side });
      return sprite;
    };

    if (z.id === 'sea') {
      // Wind-driven breaker lines and spray rise only beside the channel.
      const foamMat = new THREE.MeshBasicMaterial({ map: dotTexture(), color: 0xbdeeff, transparent: true, opacity: 0.24, depthWrite: false, blending: THREE.AdditiveBlending, fog: true });
      const breaker = new THREE.Mesh(new THREE.PlaneGeometry(rand(28, 48), rand(8, 14)), foamMat);
      breaker.rotation.x = -Math.PI / 2;
      breaker.position.set(flank, 0.7, -rand(46, CHUNK_LEN - 46));
      fxGroup.add(breaker);
      this.naturalEffects.push({ chunk, kind: 'breaker', mesh: breaker, mat: foamMat, x: breaker.position.x, y: breaker.position.y, z: breaker.position.z, base: breaker.scale.x, phase: rand(TAU), speed: rand(0.7, 1.3), amp: rand(4, 10), op: 0.24, side });
      addSprite(0xd7f5ff, 0.26, flank + side * rand(8, 18), rand(6, 15), breaker.position.z + rand(-16, 16), rand(11, 20), 'spray', { tall: 1.8, speed: 1.4, amp: 2.8 });
    } else if (z.id === 'gorge') {
      // Fine waterfall mist and a slow side-wall dust drift sell the ravine scale.
      const localZ = -rand(36, CHUNK_LEN - 36);
      addSprite(0xdff6ff, 0.30, flank, rand(26, 72), localZ, rand(28, 46), 'gorgeMist', { tall: 0.56, speed: 0.55, amp: 8 });
      addSprite(0xb9a68e, 0.20, flank + side * rand(8, 24), rand(18, 54), localZ + rand(-28, 28), rand(16, 30), 'talusDust', { tall: 1.55, speed: 0.72, amp: 5 });
    } else if (z.id === 'ember') {
      // A primary molten channel and two narrow tributaries remain outside the
      // marked route. Their varying widths break the old single-strip appearance.
      const lavaWidth = rand(42, 60);
      const lava = fluidRibbon(lavaWidth, CHUNK_LEN + 38, LIQUID_MATS.ember, 1.05);
      lava.position.set(route.center + side * (route.halfWidth + rand(28, 44)), 1.05, -CHUNK_LEN * 0.52);
      lava.rotation.y = side * rand(-0.10, 0.10);
      fxGroup.add(lava);
      for (let branch = 0; branch < 2; branch++) {
        const tributary = fluidRibbon(rand(12, 22), rand(104, 158), LIQUID_MATS.ember, 1.07);
        tributary.position.set(
          lava.position.x + side * rand(22, 48),
          1.07,
          -rand(58 + branch * 74, 122 + branch * 78),
        );
        tributary.rotation.y = side * rand(0.22, 0.48);
        fxGroup.add(tributary);
      }
      // Discontinuous basalt shelves give the molten channel a broken, embedded edge.
      // They belong to the no-collision phenomena group so no new evasive hazard is added.
      for (const edge of [-1, 1]) {
        for (let i = 0; i < 4; i++) {
          const localZ = -26 - i * (CHUNK_LEN - 52) / 3 + rand(-12, 12);
          const shelf = makeCliffRock(rand(5, 10), rand(2.0, 5.0), 0x24171e, 0x5c3230, 6, this.cliffMaterial);
          shelf.position.set(lava.position.x + edge * (lavaWidth * 0.53 + rand(2, 7)), rand(0.4, 1.3), localZ);
          shelf.scale.set(rand(1.2, 2.1), 0.48, rand(1.0, 2.4));
          shelf.rotation.set(rand(-0.07, 0.07), rand(-0.35, 0.35), rand(-0.12, 0.12));
          fxGroup.add(shelf);
        }
      }
      const localZ = -rand(36, CHUNK_LEN - 36);
      const vent = addSprite(0xff6b3d, 0.30, lava.position.x + side * rand(8, 18), rand(5, 12), localZ, rand(11, 18), 'heatVent', { additive: true, tall: 2.4, speed: 1.35, amp: 3 });
      vent.material.color.offsetHSL(0, 0, rand(-0.08, 0.08));
      addSprite(0x4d3a43, 0.24, flank - side * rand(8, 20), rand(18, 38), localZ + rand(-18, 18), rand(24, 38), 'ashPlume', { tall: 1.8, speed: 0.48, amp: 6 });
    } else {
      // Small, shallow oasis sheets reflect the bright desert sky. They remain
      // off-route and under transparent sand veils, reading as water/mirage rather
      // than an implausibly broad desert ocean.
      const oasis = fluidRibbon(rand(42, 66), rand(92, 138), LIQUID_MATS.dune, 2.15);
      oasis.position.set(route.center + side * (route.halfWidth + rand(28, 44)), 2.15, -rand(74, CHUNK_LEN - 68));
      oasis.rotation.y = side * rand(-0.18, 0.18);
      fxGroup.add(oasis);
      // Broad, transparent sand curtains make the ridges feel wind-carved. Late
      // waves additionally gain a violet rift shimmer behind their ruins.
      const localZ = -rand(40, CHUNK_LEN - 40);
      addSprite(0xe6bf79, 0.18, flank, rand(9, 26), localZ, rand(50, 82), 'sandVeil', { tall: 0.34, speed: 0.42, amp: 15 });
      addSprite(0xd9f5ea, 0.20, oasis.position.x, 2.8, oasis.position.z + rand(-18, 18), rand(14, 26), 'oasisGlint', { additive: true, tall: 0.20, speed: 0.85, amp: 4 });
      if (this.stage >= 15) addSprite(0xae86ff, 0.28, flank + side * rand(16, 34), rand(28, 66), localZ + rand(-18, 18), rand(14, 26), 'riftShimmer', { additive: true, tall: 2.4, speed: 0.95, amp: 5 });
    }
  }

  /* ================= OCEAN ================= */
  _popOcean(chunk, z) {
    // Eroded stacks rise from broad underwater feet. Their ledges are rock, not
    // flat snow discs, so the horizon reads as a coastline rather than a field
    // of floating islands.
    for (let row = 0; row < 2; row++) {
      const zz = -row * (CHUNK_LEN / 2) - rand(12, 48);
      this._obstacleRow(chunk, zz, 2, (x, cz) => {
        const h = rand(34, 78);
        const stack = seaStack(rand(10, 18), h, z.rock.base, z.rock.top);
        stack.position.set(x, -1.6, cz);
        this._obstacle(chunk, stack, 15, 18);
      });
    }
    // Low reef shelves add a second, readable navigation layer without closing
    // the beacon-marked channel. They are intentionally shallower than stacks.
    for (let row = 0; row < 1 + this.stageVariant; row++) {
      const zz = -rand(36 + row * 72, 86 + row * 76);
      this._naturalObstacleRow(chunk, zz, (x, cz) => {
        const shelf = seaStack(rand(8, 13), rand(20, 34), z.rock.base, z.rock.top);
        shelf.position.set(x, -2.8, cz);
        return shelf;
      }, 14);
    }
    // Side stacks establish a continuous coast profile but remain outside the
    // flight corridor and therefore never turn into arbitrary gameplay blocks.
    for (let i = 0; i < 5; i++) {
      const side = i % 2 ? 1 : -1;
      const x = side * rand(325, 510);
      const stack = buttressedCliff(rand(30, 52), rand(76, 154), z.rock.base, z.rock.top, { layers: 3, material: this.cliffMaterial });
      stack.position.set(x, -2.2, -rand(0, CHUNK_LEN));
      chunk.add(stack);
    }
    // Eroded shoreline shelves form a middle-distance coastline. They are visual only,
    // so the existing beacon-marked route and collision layout remain unchanged.
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1;
      const escarpment = erodedEscarpment(rand(52, 78), rand(38, 66), z.rock.base, z.rock.top, { side, layers: 4, material: this.cliffMaterial });
      escarpment.position.set(side * rand(390, 540), -1.8, -rand(24, CHUNK_LEN - 24));
      chunk.add(escarpment);
    }
    // Infrequent weathered arches frame the coastal horizon. They sit beyond the
    // collision field so the opening remains a landscape feature, not a lane gate.
    const coastOrdinal = Math.abs(Math.round(chunk.userData.virtualZ / CHUNK_LEN));
    if (coastOrdinal % 4 === this.stageVariant) {
      const side = coastOrdinal % 2 ? 1 : -1;
      const arch = naturalStoneArch(rand(88, 122), rand(78, 112), z.rock.base, z.rock.top, this.cliffMaterial);
      arch.position.set(side * rand(430, 560), -1.5, -rand(76, CHUNK_LEN - 54));
      arch.rotation.y = side * rand(-0.36, 0.36);
      chunk.add(arch);
    }
    // A single broad coastal fall gives the middle distance a cool vertical cue;
    // it is pure scenery and is intentionally placed on the far sea wall.
    if (coastOrdinal % 3 === (this.stageVariant + 1) % 3) {
      const side = coastOrdinal % 2 ? -1 : 1;
      const fallW = rand(18, 32), fallH = rand(52, 86);
      const tex = waterfallTexture(); tex.repeat.set(1, fallH / 44);
      const mat = new THREE.MeshToonMaterial({ map: tex, gradientMap: toonGradient(), transparent: true, opacity: 0.78, depthWrite: false, side: THREE.DoubleSide });
      mat.chunk = chunk; this.waterfallMats.push(mat);
      const fall = new THREE.Mesh(new THREE.PlaneGeometry(fallW, fallH), mat);
      const fallX = side * rand(352, 424), fallZ = -rand(52, CHUNK_LEN - 48);
      fall.position.set(fallX, fallH * 0.48, fallZ);
      fall.rotation.y = side > 0 ? -Math.PI * 0.46 : Math.PI * 0.46;
      fall.userData.noCollide = true; chunk.add(fall);
      const impact = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(), color: 0xdff9f4, transparent: true, opacity: 0.30, depthWrite: false, fog: true }));
      impact.position.set(fallX - side * 3, 3.0, fallZ); impact.scale.set(fallW * 1.8, fallW * 0.62, 1); impact.userData.noCollide = true; chunk.add(impact);
    }
    // distant mesa silhouettes at two depth layers for parallax
    for (let i = 0; i < 3; i++) {
      const side = Math.random() < 0.5 ? 1 : -1;
      const far = Math.random() < 0.5;
      const mesa = makeRock(rand(70, 130), rand(100, 190), z.rock.base, z.rock.top, 6);
      mesa.position.set(side * rand(far ? 700 : 440, far ? 1100 : 700), 20, -rand(0, CHUNK_LEN));
      chunk.add(mesa);
    }
    this._aerialLayer(chunk, z);
    // Large artificial towers and ring gates are disabled to keep the route open.
  }

  /* ================= GORGE ================= */
  _popGorge(chunk, z) {
    // outer canyon walls (framing), pushed out for the wide corridor
    for (let side = -1; side <= 1; side += 2) {
      let zz = 0;
      while (zz < CHUNK_LEN) {
        const w = rand(34, 60), h = rand(90, 200);
        const x = side * rand(255, 335);
        const rock = buttressedCliff(w, h, z.rock.base, z.rock.top, { layers: pick([3, 4]), material: this.cliffMaterial });
        rock.position.set(x, 0, -zz);
        chunk.add(rock);
        if (Math.random() < 0.8) {
          const moss = mossLedge(w * rand(0.80, 1.15), z.rock.moss);
          moss.position.set(x + rand(-6, 6), h * 0.3 + h * 0.5 - rand(2, 8), -zz);
          chunk.add(moss);
          // trees perched on the cliff
          for (let t = 0; t < 3; t++) {
            const tree = conifer(rand(1.4, 2.4), 0x6b4a2e, z.rock.moss);
            tree.position.set(x + rand(-w, w) * 0.7, h * 0.3 + h * 0.5 - 4, -zz + rand(-w, w));
            chunk.add(tree);
          }
        }
        // waterfall sheet on the inner face
        if (Math.random() < 0.55) {
          const fw = rand(12, 26), fh = h * rand(0.7, 0.95);
          const tex = waterfallTexture();
          tex.repeat.set(1, fh / 40);
          const mat = new THREE.MeshToonMaterial({ map: tex, gradientMap: toonGradient(), transparent: true, opacity: 0.95 });
          mat.chunk = chunk;
          this.waterfallMats.push(mat);
          const fall = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh), mat);
          fall.position.set(x - side * (w * 0.72), fh / 2 + 1, -zz);
          fall.rotation.y = side > 0 ? -Math.PI / 2 * 0.92 : Math.PI / 2 * 0.92;
          chunk.add(fall);
          const foam = new THREE.Mesh(new THREE.CylinderGeometry(fw * 0.7, fw * 0.9, 1.6, 10),
            toonMat(0xeaf6ff, { transparent: true, opacity: 0.85, flat: true }));
          foam.position.set(fall.position.x - side * 2, 1.2, -zz);
          chunk.add(foam);
        }
        zz += rand(60, 110);
      }
    }
    // Broad, stepped cliff shoulders break the evenly-spaced wall rhythm and create
    // a second depth layer. They stay beyond the collision corridor by design.
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1;
      const escarpment = erodedEscarpment(rand(50, 78), rand(74, 128), z.rock.base, z.rock.top, { side, layers: pick([4, 5]), material: this.cliffMaterial });
      escarpment.position.set(side * rand(350, 430), 0, -rand(22, CHUNK_LEN - 22));
      chunk.add(escarpment);
    }
    // A distant natural bridge completes the canyon silhouette without ever
    // crossing the marked flight channel or altering the collision field.
    const gorgeOrdinal = Math.abs(Math.round(chunk.userData.virtualZ / CHUNK_LEN));
    if (gorgeOrdinal % 3 === this.stageVariant) {
      const side = gorgeOrdinal % 2 ? 1 : -1;
      const arch = naturalStoneArch(rand(80, 112), rand(94, 132), z.rock.base, z.rock.top, this.cliffMaterial);
      arch.position.set(side * rand(410, 520), 4, -rand(72, CHUNK_LEN - 50));
      arch.rotation.y = side * rand(-0.22, 0.22);
      const crownMoss = mossLedge(rand(16, 26), z.rock.moss);
      crownMoss.position.set(0, rand(56, 78), 0); arch.add(crownMoss);
      chunk.add(arch);
    }
    // mid-field stone pillars the player must weave between (collidable)
    for (let row = 0; row < 3; row++) {
      const zz = -row * (CHUNK_LEN / 3) - rand(10, 40);
      this._obstacleRow(chunk, zz, 2, (x, cz) => {
        const h = rand(60, 150), w = rand(10, 20);
        const pillar = makeRock(w, h, z.rock.base, z.rock.top, pick([6, 7]));
        pillar.position.set(x, h * 0.3, cz);
        this._obstacle(chunk, pillar, w * 1.15, 18);
        if (Math.random() < 0.7) {
          const moss = mossLedge(w * 1.05, z.rock.moss);
          moss.position.set(x, h * 0.3 + h * 0.5 - 4, cz);
          chunk.add(moss);
        }
      });
    }
    // Fallen talus shelves make the lower ravine feel geologically active, while
    // still using the route-gap helper rather than random centerline blockage.
    for (let row = 0; row < 1 + (this.stageVariant === 2 ? 1 : 0); row++) {
      const zz = -rand(62 + row * 94, 116 + row * 102);
      this._naturalObstacleRow(chunk, zz, (x, cz) => {
        const talus = new THREE.Group();
        const slab = makeRock(rand(13, 21), rand(12, 24), z.rock.base, z.rock.top, 6);
        slab.position.set(0, 4, 0); slab.rotation.z = rand(-0.38, 0.38); talus.add(slab);
        for (let i = 0; i < 3; i++) {
          const boulder = makeRock(rand(3, 6), rand(5, 11), z.rock.base, z.rock.top, 5);
          boulder.position.set(rand(-12, 12), rand(1, 4), rand(-8, 8)); talus.add(boulder);
        }
        talus.position.set(x, 0, cz);
        return talus;
      }, 15);
    }
    // Large centreline mountain passages and arches are intentionally disabled.
    // Their visual mass obstructed the flight view without adding useful gameplay.
    this._aerialLayer(chunk, z);
    // Large artificial towers and ring gates are disabled to keep the route open.
  }

  /* ================= EMBER ================= */
  _popEmber(chunk, z) {
    chunk.add(this._groundStrip(chunk, 1400, 5.5, z.ground.base, z.ground.lit, null, this.floorMaterial ?? emberGroundMat));
    // outer dark-red canyon walls
    for (let side = -1; side <= 1; side += 2) {
      let zz = 0;
      while (zz < CHUNK_LEN) {
        const w = rand(30, 54), h = rand(100, 220);
        const x = side * rand(315, 395);
        const rock = buttressedCliff(w, h, z.rock.base, z.rock.top, { layers: pick([3, 4]), material: this.cliffMaterial });
        rock.position.set(x, 0, -zz);
        chunk.add(rock);
        // glowing red fin panels (concept 2)
        if (Math.random() < 0.6) {
          const fin = new THREE.Mesh(
            new THREE.BoxGeometry(rand(16, 30), rand(3, 5), rand(6, 10)),
            toonMat(0x30161f, { emissive: z.rock.glow, emissiveIntensity: 1.5 })
          );
          fin.position.set(x - side * w * 0.6, rand(24, h * 0.6), -zz + rand(-10, 10));
          fin.rotation.z = side * rand(0.5, 0.9);
          fin.rotation.y = rand(-0.4, 0.4);
          chunk.add(fin);
          this.glows.push({ chunk, mat: fin.material, base: 1.5, amp: 0.6, off: rand(TAU) });
        }
        zz += rand(60, 110);
      }
    }
    // Stepped basalt shoulders add a geological middle layer rather than another
    // identical tower rhythm. They are scenery only and remain beyond the fair route.
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1;
      const escarpment = erodedEscarpment(rand(48, 72), rand(68, 118), 0x321d2a, z.rock.top, { side, layers: 4, material: this.cliffMaterial });
      escarpment.position.set(side * rand(410, 560), 0, -rand(24, CHUNK_LEN - 24));
      chunk.add(escarpment);
    }
    // A rare basalt arch gives Ember Canyon a monumental natural silhouette. It
    // is deliberately pushed far beyond the combat field and only frames the route.
    const emberOrdinal = Math.abs(Math.round(chunk.userData.virtualZ / CHUNK_LEN));
    if (emberOrdinal % 4 === this.stageVariant) {
      const side = emberOrdinal % 2 ? 1 : -1;
      const arch = naturalStoneArch(rand(86, 118), rand(82, 122), z.rock.base, z.rock.top, this.cliffMaterial);
      arch.position.set(side * rand(432, 560), 1, -rand(64, CHUNK_LEN - 48));
      arch.rotation.y = side * rand(-0.24, 0.24);
      for (const seamSide of [-1, 1]) {
        const seam = new THREE.Mesh(new THREE.BoxGeometry(1.0, rand(18, 30), 0.72), toonMat(0x20141a, { emissive: z.rock.glow, emissiveIntensity: 0.78, flat: true }));
        seam.position.set(seamSide * rand(20, 32), rand(28, 54), 0); seam.rotation.z = seamSide * rand(-0.48, 0.48); arch.add(seam);
        this.glows.push({ chunk, mat: seam.material, base: 0.78, amp: 0.20, off: rand(TAU) });
      }
      chunk.add(arch);
    }
    // mid-field jagged towers + glowing crystals (collidable)
    for (let row = 0; row < 3; row++) {
      const zz = -row * (CHUNK_LEN / 3) - rand(10, 40);
      this._obstacleRow(chunk, zz, 2, (x, cz) => {
        if (Math.random() < 0.5) {
          const h = rand(52, 118), w = rand(8, 16);
          const tower = makeRock(w, h, z.rock.base, z.rock.top, pick([5, 6]));
          tower.position.set(x, h * 0.3, cz);
          this._obstacle(chunk, tower, w * 1.1, 18);
        } else {
          const h = rand(30, 60);
          const cr = crystal(h, z.rock.glow);
          cr.position.set(x, 0, cz);
          this._obstacle(chunk, cr, h * 0.28, 20);
          this.glows.push({ chunk, mat: cr.userData.glowMat, base: 0.88, amp: 0.32, off: rand(TAU) });
        }
      });
    }
    // Cooled lava ribs form low, clearly lit hazard lines outside the route.
    for (let row = 0; row < 1 + this.stageVariant; row++) {
      const zz = -rand(50 + row * 84, 98 + row * 92);
      this._naturalObstacleRow(chunk, zz, (x, cz) => {
        const rib = new THREE.Group();
        const basalt = makeRock(rand(10, 17), rand(10, 18), 0x321d2a, z.rock.top, 6);
        basalt.position.y = 4; basalt.rotation.z = rand(-0.18, 0.18); rib.add(basalt);
        const seam = new THREE.Mesh(new THREE.BoxGeometry(rand(8, 16), 0.7, 1.2), toonMat(0x301419, { emissive: z.rock.glow, emissiveIntensity: 1.1, flat: true }));
        seam.position.set(0, rand(5, 10), 0); seam.rotation.z = basalt.rotation.z; rib.add(seam);
        rib.position.set(x, 0, cz);
        this.glows.push({ chunk, mat: seam.material, base: 1.1, amp: 0.38, off: rand(TAU) });
        return rib;
      }, 16);
    }
    // Large centreline mountain passages are disabled to preserve an open flight view.
    // Rare meteor impact sites use the same gap helper as all playable hazards:
    // they enrich the terrain but cannot form an unmarked centreline obstruction.
    if (this.stage >= 7 && Math.random() < 0.62) {
      const zz = -rand(56, CHUNK_LEN - 54);
      this._naturalObstacleRow(chunk, zz, (x, cz) => {
        const site = meteorImpactSite(rand(13, 20), z.rock.base, z.rock.top, z.rock.glow, this.cliffMaterial);
        site.position.set(x, 0, cz);
        this.glows.push({ chunk, mat: site.userData.impactGlow, base: 1.05, amp: 0.46, off: rand(TAU) });
        this.naturalEffects.push({ chunk, kind: 'impactBeacon', mesh: site.userData.impactBeacon, mat: site.userData.impactBeacon.material, x: 0, y: site.userData.impactBeacon.position.y, z: 0, base: site.userData.impactBeacon.scale.x, tall: site.userData.impactBeacon.scale.y / site.userData.impactBeacon.scale.x, phase: rand(TAU), speed: 1.15, amp: 0.18, op: 0.42, side: 1 });
        return site;
      }, 17);
    }
    // scattered floor boulders across the wide floor
    for (let i = 0; i < 8; i++) {
      const r = makeRock(rand(3, 9), rand(6, 18), 0x241522, 0x53303a, 6);
      r.position.set(rand(-FIELD, FIELD), 2, -rand(0, CHUNK_LEN));
      chunk.add(r);
    }
    // distant jagged silhouettes
    for (let i = 0; i < 3; i++) {
      const side = Math.random() < 0.5 ? 1 : -1;
      const mesa = buttressedCliff(rand(70, 120), rand(132, 238), z.rock.base, z.rock.top, { layers: 3, material: this.cliffMaterial });
      mesa.position.set(side * rand(500, 950), 0, -rand(0, CHUNK_LEN));
      chunk.add(mesa);
    }
    this._aerialLayer(chunk, z);
    // Large artificial towers and ring gates are disabled to keep the route open.
  }

  /* ================= DUNE ================= */
  _popDune(chunk, z) {
    chunk.add(this._groundStrip(chunk, 1600, 18, z.sand.shade, z.sand.lit, z.sand.base, this.floorMaterial ?? sandMat));
    // Low wind-carved escarpments give the dunes a readable near/mid/far profile
    // while remaining visual-only beyond the navigation channel.
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1;
      const escarpment = erodedEscarpment(rand(66, 104), rand(24, 46), z.sand.shade, z.sand.lit, { side, layers: 3, material: this.cliffMaterial });
      escarpment.position.set(side * rand(360, 520), -2.0, -rand(26, CHUNK_LEN - 26));
      escarpment.scale.z = rand(1.6, 2.5);
      chunk.add(escarpment);
    }
    // ancient stone pillars / ruins in the mid-field (collidable)
    for (let row = 0; row < 3; row++) {
      const zz = -row * (CHUNK_LEN / 3) - rand(10, 40);
      this._obstacleRow(chunk, zz, 2, (x, cz) => {
        if (Math.random() < 0.55) {
          const h = rand(28, 70), w = rand(6, 12);
          const pillar = weatheredRuinPillar(w, h, 0xb8975a, 0xc9a668, this.cliffMaterial);
          pillar.position.set(x, 0, cz);
          this._obstacle(chunk, pillar, w * 1.3, 18);
        } else {
          const h = rand(20, 44);
          const r = makeRock(rand(10, 20), h, z.rock.base, z.rock.top, 6);
          r.position.set(x, h * 0.25, cz);
          this._obstacle(chunk, r, 13, 18);
        }
      });
    }
    // Wind-cut sandstone ribs create changing low-altitude terrain signatures
    // but remain outside the broad Dune Sea navigation channel.
    for (let row = 0; row < 1 + this.stageVariant; row++) {
      const zz = -rand(54 + row * 82, 108 + row * 90);
      this._naturalObstacleRow(chunk, zz, (x, cz) => {
        const rib = new THREE.Group();
        const core = makeRock(rand(12, 20), rand(12, 22), z.rock.base, z.rock.top, 6);
        core.position.y = 4; core.rotation.z = rand(-0.20, 0.20); rib.add(core);
        const crest = new THREE.Mesh(new THREE.BoxGeometry(rand(14, 25), 1.2, rand(3, 6)), toonMat(0xc9a668, { flat: true }));
        crest.position.y = rand(10, 16); crest.rotation.z = core.rotation.z; rib.add(crest);
        rib.position.set(x, 0, cz);
        return rib;
      }, 15);
    }
    // Meteor scars become more common near the rift; they remain off the route
    // and glow only as a short environmental cue, never as a gameplay projectile.
    if (this.stage >= 9 && Math.random() < 0.55) {
      const zz = -rand(60, CHUNK_LEN - 56);
      this._naturalObstacleRow(chunk, zz, (x, cz) => {
        const accent = this.stage >= 15 ? 0xa688ff : 0xffc66b;
        const site = meteorImpactSite(rand(12, 19), z.rock.base, z.rock.top, accent, this.cliffMaterial);
        site.position.set(x, 0, cz);
        this.glows.push({ chunk, mat: site.userData.impactGlow, base: 0.95, amp: 0.38, off: rand(TAU) });
        this.naturalEffects.push({ chunk, kind: 'impactBeacon', mesh: site.userData.impactBeacon, mat: site.userData.impactBeacon.material, x: 0, y: site.userData.impactBeacon.position.y, z: 0, base: site.userData.impactBeacon.scale.x, tall: site.userData.impactBeacon.scale.y / site.userData.impactBeacon.scale.x, phase: rand(TAU), speed: 0.82, amp: 0.14, op: 0.36, side: 1 });
        return site;
      }, 16);
    }
    // half-buried wreckage + scattered rocks across the width
    for (let i = 0; i < 7; i++) {
      if (Math.random() < 0.5) {
        const r = makeRock(rand(6, 16), rand(10, 28), z.rock.base, z.rock.top, 6);
        r.position.set(rand(-FIELD * 1.4, FIELD * 1.4), 4, -rand(0, CHUNK_LEN));
        chunk.add(r);
      } else {
        const wreck = new THREE.Mesh(
          new THREE.BoxGeometry(rand(6, 18), rand(1.5, 4), rand(2, 6)),
          toonMat(pick([0x8a7a68, 0x6e5f52, 0x9a8874]), { flat: true })
        );
        wreck.position.set(rand(-FIELD, FIELD), rand(1, 3), -rand(0, CHUNK_LEN));
        wreck.rotation.set(rand(-0.4, 0.4), rand(TAU), rand(-0.5, 0.5));
        chunk.add(wreck);
      }
    }
    // Monumental centreline gates are disabled to preserve an open flight view.
    // Natural arches and mesa buttresses frame the desert horizon well outside
    // the corridor; their openings are scenic, never collision-bearing gates.
    const duneOrdinal = Math.abs(Math.round(chunk.userData.virtualZ / CHUNK_LEN));
    if (duneOrdinal % 3 === this.stageVariant) {
      const side = duneOrdinal % 2 ? 1 : -1;
      const arch = naturalStoneArch(rand(94, 136), rand(72, 108), z.rock.base, z.rock.top, this.cliffMaterial);
      arch.position.set(side * rand(450, 600), -2, -rand(54, CHUNK_LEN - 48));
      arch.rotation.y = side * rand(-0.30, 0.30);
      chunk.add(arch);
      const dryWash = new THREE.Mesh(new THREE.PlaneGeometry(rand(46, 72), rand(86, 142), 8, 10), toonMat(0x7c6d5c, { transparent: true, opacity: 0.34, flat: true }));
      dryWash.rotation.x = -Math.PI / 2;
      dryWash.position.set(side * rand(260, 330), 0.18, -rand(58, CHUNK_LEN - 54));
      dryWash.rotation.z = side * rand(-0.26, 0.26);
      dryWash.userData.noCollide = true; chunk.add(dryWash);
    }
    // giant distant dune ridges
    for (let i = 0; i < 2; i++) {
      const side = Math.random() < 0.5 ? 1 : -1;
      const ridge = buttressedCliff(rand(120, 200), rand(74, 142), z.sand.shade, z.sand.lit, { layers: 3, material: this.cliffMaterial });
      ridge.position.set(side * rand(500, 950), 0, -rand(0, CHUNK_LEN));
      chunk.add(ridge);
    }
    this._aerialLayer(chunk, z);
    // Large artificial towers and ring gates are disabled to keep the route open.
  }

  /* ---------- shared decorative structures ---------- */
  /**
   * Late-campaign rift erosion raises huge, visibly fractured islands well above
   * the flyable channel. They are pure scenery: their broad placement and the
   * no-collide flag preserve the established fair corridor.
   */
  _riftSkyIslands(chunk, z) {
    const shouldAppear = (z.id === 'dune' && this.stage >= 15) || (z.id === 'ember' && this.stage >= 11);
    if (!shouldAppear || Math.random() > 0.55) return;
    const count = z.id === 'dune' ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const side = (i % 2 ? -1 : 1) * (Math.random() < 0.4 ? -1 : 1);
      const localZ = -rand(42, CHUNK_LEN - 40);
      const route = flightRoute(z.id, chunk.userData.virtualZ + localZ);
      const radius = rand(z.id === 'dune' ? 42 : 34, z.id === 'dune' ? 78 : 62);
      const height = radius * rand(1.05, 1.46);
      const island = riftIslet(radius, height, z.rock.base, z.rock.top, z.id === 'ember' ? z.rock.glow : 0xa688ff, this.cliffMaterial);
      island.position.set(route.center + side * rand(route.halfWidth + 178, 340), rand(142, 236), localZ);
      island.rotation.set(rand(-0.10, 0.10), rand(TAU), rand(-0.10, 0.10));
      island.userData.noCollide = true;
      island.userData.float = { y0: island.position.y, off: rand(TAU) };
      chunk.add(island);
    }
  }

  _archGate(chunk, z, x, zpos) {
    const scale = rand(1.1, 1.6);
    const arch = new THREE.Mesh(new THREE.TorusGeometry(64 * scale, 12, 8, 14, Math.PI), rockMat);
    const geoCol = arch.geometry;
    const colors = new Float32Array(geoCol.attributes.position.count * 3);
    const cb = new THREE.Color(z.rock.base), ct = new THREE.Color(z.rock.top);
    for (let i = 0; i < geoCol.attributes.position.count; i++) {
      const t2 = clamp(geoCol.attributes.position.getY(i) / 64 + 0.4, 0, 1);
      const c = cb.clone().lerp(ct, t2);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geoCol.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    arch.position.set(x, 4, zpos);
    arch.userData.noCollide = true; // bbox would plug the opening — rim colliders added below
    chunk.add(arch);
    // solid stone span: trace the arch curve with colliders (opening stays passable)
    this._torusColliders(chunk, x, 4, zpos, 64 * scale, 12, 0, Math.PI, 0, 16);
    // the two legs are collidable so you must fly through the opening
    for (const s of [-1, 1]) {
      const legX = x + s * 64 * scale;
      const leg = makeRock(rand(9, 14), 40, z.rock.base, z.rock.top, 6);
      leg.position.set(legX, 20, zpos);
      this._obstacle(chunk, leg, 12, 16);
    }
    if (z.rock.moss) {
      const mossA = mossCap(24, z.rock.moss);
      mossA.position.set(x, 66 * scale, zpos);
      chunk.add(mossA);
    }
  }

  /**
   * Rooted skyline needles.  They stay on the outer flanks and visibly widen
   * into a fractured foot, so vertical drama comes from geology rather than
   * isolated platforms that appear to hover in mid-air.
   */
  /**
   * A large naturally eroded arch assembled from irregular rock masses rather
   * than a single perfect torus. The rim is collidable, while its central span
   * remains a high-visibility route decision.
   */
  _colossalArch(chunk, z, x, zpos, opts = {}) {
    const route = flightRoute(z.id, chunk.userData.virtualZ + zpos);
    const cx = x ?? route.center;
    const R = opts.radius ?? rand(94, 126);
    const tube = opts.tube ?? rand(13, 19);
    const segments = 11;
    const root = new THREE.Group();
    root.userData.noCollide = true;
    root.position.set(0, 0, 0);
    const material = stableCliffMaterial(z.id);

    // Overlapping asymmetric stones make the opening look water- and wind-cut.
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const a = Math.PI * t;
      const rock = makeCliffRock(
        tube * rand(0.84, 1.18),
        tube * rand(1.85, 2.75),
        z.rock.base,
        z.rock.top,
        pick([8, 9, 10]),
        material,
      );
      const outer = 1 + Math.sin(t * Math.PI) * rand(0.04, 0.16);
      rock.position.set(cx + Math.cos(a) * R * outer, 7 + Math.sin(a) * R * outer, zpos + Math.sin(a * 2.1) * 4);
      rock.rotation.set(rand(-0.15, 0.15), a + Math.PI / 2 + rand(-0.14, 0.14), rand(-0.24, 0.24));
      rock.scale.set(rand(0.82, 1.18), rand(0.92, 1.26), rand(0.72, 1.14));
      root.add(rock);
    }
    // Distinct fallen chunks and a ledge settle the formation into the ground.
    for (const side of [-1, 1]) {
      const foot = buttressedCliff(tube * rand(1.35, 1.70), R * rand(0.40, 0.56), z.rock.base, z.rock.top, { layers: 3, material });
      foot.position.set(cx + side * R * 0.98, 0, zpos + rand(-7, 7));
      foot.scale.z = rand(0.55, 0.82);
      root.add(foot);
      for (let j = 0; j < 3; j++) {
        const fall = makeCliffRock(tube * rand(0.18, 0.42), tube * rand(0.25, 0.58), z.rock.base, z.rock.top, 7, material);
        fall.position.set(cx + side * (R + rand(8, 32)), rand(2, 10), zpos + rand(-28, 28));
        root.add(fall);
      }
    }
    chunk.add(root);

    // Trace only the rocky rim. The middle stays open, and the wide legs make
    // an early large arch forgiving while still teaching precise alignment.
    this._torusColliders(chunk, cx, 7, zpos, R, tube, 0, Math.PI, 0, opts.damage ?? 16);
    for (const side of [-1, 1]) this._addCollider(chunk, cx + side * R, R * 0.22, zpos, tube * 1.55, R * 0.34, opts.damage ?? 16);
  }

  /**
   * A mountain pass made from a sequence of eroded portals. It has a low safe
   * flight band, an alternating baffle to require steering, and protected
   * lateral clearances sized against the player's 2.3-unit collision radius.
   */
  _mountainTunnel(chunk, z, zpos, opts = {}) {
    const route = flightRoute(z.id, chunk.userData.virtualZ + zpos);
    const center = route.center;
    const half = opts.half ?? (z.id === 'ember' ? 78 : 86);
    const openingH = opts.openingH ?? (z.id === 'ember' ? 112 : 124);
    const depth = opts.depth ?? (z.id === 'ember' ? 156 : 138);
    const portalCount = opts.portals ?? 3;
    const tube = opts.tube ?? (z.id === 'ember' ? 20 : 18);
    const damage = opts.damage ?? (this.stage >= 10 ? 23 : 19);
    const material = stableCliffMaterial(z.id);
    const root = new THREE.Group();
    root.userData.noCollide = true;

    // Side mountain masses close the horizon around the portals. They are
    // visual only; a clean hand-authored collider rail below sets the real wall.
    for (const side of [-1, 1]) {
      const massif = buttressedCliff(half * 1.32, openingH * 1.34, z.rock.base, z.rock.top, { layers: 4, material });
      massif.position.set(center + side * (half + 78), 0, zpos - depth * 0.46);
      massif.scale.z = 1.50;
      root.add(massif);
      for (let i = 0; i < 4; i++) {
        const talus = makeCliffRock(rand(10, 21), rand(12, 34), z.rock.base, z.rock.top, 8, material);
        talus.position.set(center + side * rand(half + 22, half + 102), rand(1, 8), zpos - rand(6, depth));
        talus.rotation.z = side * rand(-0.30, 0.30);
        root.add(talus);
      }
    }

    for (let p = 0; p < portalCount; p++) {
      const f = p / Math.max(1, portalCount - 1);
      const pz = zpos - depth * f;
      const arch = new THREE.Mesh(
        new THREE.TorusGeometry(half, tube, 10, 24, Math.PI),
        material,
      );
      arch.position.set(center, openingH * 0.08, pz);
      arch.userData.noCollide = true;
      root.add(arch);
      // Radial fins and layered lips remove the manufactured-perfect ring look.
      for (const side of [-1, 1]) {
        const lip = makeCliffRock(tube * rand(0.72, 1.02), openingH * rand(0.22, 0.38), z.rock.base, z.rock.top, 8, material);
        lip.position.set(center + side * half * 0.94, openingH * rand(0.16, 0.28), pz + rand(-6, 6));
        lip.rotation.z = side * rand(-0.18, 0.18);
        root.add(lip);
      }
      const ceiling = makeCliffRock(half * 0.58, tube * 1.25, z.rock.base, z.rock.top, 10, material);
      ceiling.position.set(center + rand(-8, 8), openingH + tube * 0.18, pz + rand(-4, 4));
      ceiling.scale.set(1.24, 0.54, 0.64);
      root.add(ceiling);

      // Wall rails plus a roof rail leave x +/- half and y < openingH passable.
      for (const side of [-1, 1]) this._addCollider(chunk, center + side * (half + tube * 0.52), openingH * 0.48, pz, tube * 1.25, openingH * 0.56, damage);
      this._addCollider(chunk, center, openingH + tube * 0.92, pz, half * 0.90, tube * 0.82, damage);
    }

    // Alternate low baffles: one side closes while the other side remains a
    // broad 70+ unit passage. Their warning glows make the required weave fair.
    for (let b = 0; b < portalCount - 1; b++) {
      const side = ((b + Math.abs(Math.floor(chunk.userData.virtualZ / CHUNK_LEN))) % 2) ? 1 : -1;
      const bz = zpos - depth * ((b + 0.5) / (portalCount - 1));
      const baffle = buttressedCliff(half * 0.31, openingH * rand(0.42, 0.54), z.rock.base, z.rock.top, { layers: 3, material });
      baffle.position.set(center + side * half * 0.62, 0, bz);
      baffle.scale.z = 0.74;
      // The visual talus cluster has a broad irregular bbox, so use a narrower
      // authored core collider rather than automatically turning all loose
      // rubble into a centreline wall. The opposite half remains a clear weave.
      baffle.userData.noCollide = true;
      chunk.add(baffle);
      this._addCollider(chunk, center + side * half * 0.62, openingH * 0.25, bz, half * 0.20, openingH * 0.29, damage);
      const warning = new THREE.Mesh(new THREE.OctahedronGeometry(2.2, 0), toonMat(0x231c20, { emissive: z.id === 'ember' ? 0xff7040 : 0x9deaff, emissiveIntensity: 1.35, flat: true }));
      warning.position.set(center + side * half * 0.28, 20, bz + 3);
      root.add(warning);
      this.glows.push({ chunk, mat: warning.material, base: 1.35, amp: 0.46, off: rand(TAU) });
    }
    chunk.add(root);
  }

  _aerialLayer(chunk, z) {
    if (Math.random() > 0.72) return;
    const side = Math.random() < 0.5 ? -1 : 1;
    const cz = -rand(24, CHUNK_LEN - 24);
    const route = flightRoute(z.id, chunk.userData.virtualZ + cz);
    const x = route.center + side * rand(route.halfWidth + (z.id === 'ember' ? 138 : 56), FIELD * 0.88);
    const h = rand(112, 180);
    const w = rand(9, 15);
    const foot = makeRock(w * 2.2, h * 0.26, z.rock.base, z.rock.top, pick([6, 7]));
    foot.position.set(x, h * 0.10, cz);
    chunk.add(foot);
    const spire = makeRock(w, h, z.rock.base, z.rock.top, pick([6, 7]));
    spire.position.set(x + side * rand(-2, 2), h * 0.34, cz);
    this._obstacle(chunk, spire, w * 1.1, 18);
    const ledge = new THREE.Mesh(new THREE.CylinderGeometry(w * 1.34, w * 1.58, 2.4, 7), toonMat(z.rock.top, { flat: true }));
    ledge.position.set(x, h * 0.46, cz); chunk.add(ledge);
    if (z.rock.moss && Math.random() < 0.55) {
      const cap = mossCap(w * 1.18, z.rock.moss);
      cap.position.set(x, h * 0.34 + h * 0.5 - 4, cz); chunk.add(cap);
    }
  }

  /** a complex multi-tier tower / ruin reaching high — collidable at every tier */
  _megaTower(chunk, z, x, cz) {
    let baseY = -3;
    let r = rand(17, 24);
    const tiers = 2 + (Math.random() < 0.5 ? 1 : 0);
    for (let i = 0; i < tiers; i++) {
      const h = rand(30, 46);
      const seg = makeRock(r, h, z.rock.base, z.rock.top, pick([6, 7]));
      seg.position.set(x, baseY + h / 2, cz);
      this._obstacle(chunk, seg, r * 0.95, 20);
      // protruding ledge blocks + buttresses
      for (let b = 0; b < 2; b++) {
        const bw = rand(5, 9);
        const blk = new THREE.Mesh(new THREE.BoxGeometry(bw, bw * 0.55, bw), toonMat(z.rock.top, { flat: true }));
        const a = rand(TAU);
        blk.position.set(x + Math.cos(a) * r * 0.96, baseY + rand(3, h - 3), cz + Math.sin(a) * r * 0.96);
        blk.rotation.y = a;
        chunk.add(blk);
      }
      // ring band between tiers
      const band = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.05, r * 1.05, 2.5, 7), toonMat(z.rock.top, { flat: true }));
      band.position.set(x, baseY + h, cz);
      chunk.add(band);
      baseY += h * 0.9;
      r *= rand(0.72, 0.82);
    }
    // crowning beacon / cap
    if (z.rock.glow || z.id === 'ember') {
      const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(), color: z.rock.glow ?? 0xff6a3e, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      g.scale.setScalar(6); g.position.set(x, baseY + 4, cz);
      chunk.add(g);
    } else if (z.rock.moss) {
      const cap = mossCap(r * 1.3, z.rock.moss);
      cap.position.set(x, baseY + 2, cz); chunk.add(cap);
    } else {
      const crown = makeRock(r * 1.05, r * 0.72, z.rock.base, z.rock.top, 6);
      crown.position.set(x, baseY + r * 0.18, cz); chunk.add(crown);
    }
  }

  /** big decorative ring gate you can fly through (adds vertical structure) */
  _ringGate(chunk, z, x, cz) {
    const R = rand(38, 60);
    const tube = rand(3, 5);
    const ringY = R + rand(4, 30);
    const rotZ = rand(-0.3, 0.3);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R, tube, 8, 20), toonMat(z.rock.base, { flat: true }));
    ring.position.set(x, ringY, cz);
    ring.rotation.z = rotZ;
    ring.userData.noCollide = true; // bbox would plug the opening — rim colliders added below
    chunk.add(ring);
    // solid rim: trace the full ring with colliders, leaving the centre passable
    this._torusColliders(chunk, x, ringY, cz, R, tube, 0, TAU, rotZ, 14);
    // Twin foundations make the ring a supported gateway rather than a loose
    // torus in the air. The opening stays clear because the supports sit on the
    // outer lower quadrants, beyond the central flight aperture.
    for (const side of [-1, 1]) {
      const sx = x + side * R * 0.74;
      const supportH = Math.max(12, ringY * 0.94);
      const support = new THREE.Mesh(new THREE.CylinderGeometry(tube * 1.65, tube * 2.25, supportH, 7), toonMat(z.rock.base, { flat: true }));
      support.position.set(sx, supportH * 0.5 - 1, cz);
      this._obstacle(chunk, support, tube * 2.25, 14);
      const footing = new THREE.Mesh(new THREE.CylinderGeometry(tube * 3.4, tube * 4.2, tube * 1.15, 8), toonMat(z.rock.top, { flat: true }));
      footing.position.set(sx, tube * 0.55 - 1, cz); chunk.add(footing);
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(tube * 2.05, tube * 2.25, tube * 0.55, 8), toonMat(z.rock.top, { flat: true }));
      collar.position.set(sx, supportH * 0.74, cz); chunk.add(collar);
    }
    // small emissive nodes around the ring
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      const node = new THREE.Mesh(new THREE.OctahedronGeometry(2.2, 0), toonMat(0x223, { emissive: z.rock.glow ?? 0x7fe9ff, emissiveIntensity: 1.3, flat: true }));
      node.position.set(x + Math.cos(a) * R, ring.position.y + Math.sin(a) * R, cz);
      chunk.add(node);
    }
  }

  /** choose a zone-appropriate complex prop and drop it off to one side */
  _complexProp(chunk, z) {
    const side = Math.random() < 0.5 ? 1 : -1;
    const cz = -rand(30, CHUNK_LEN - 30);
    const route = flightRoute(z.id, chunk.userData.virtualZ + cz);
    const x = route.center + side * rand(route.halfWidth + (z.id === 'ember' ? 150 : 62), FIELD * 0.82);
    // Ocean landmarks are fortified lighthouses/relay towers. Ring gates are
    // reserved for solid-ground zones where their foundations can read clearly.
    if (z.id === 'sea' || Math.random() < 0.5) this._megaTower(chunk, z, x, cz);
    else this._ringGate(chunk, z, x, cz);
  }

  _groundStrip(chunk, width, amp, cShade, cLit, cMid = null, mat = rockMat) {
    const segX = 64, segZ = 18;
    const geo = new THREE.PlaneGeometry(width, CHUNK_LEN + 6, segX, segZ);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const a = new THREE.Color(cShade), b = new THREE.Color(cLit), m = cMid ? new THREE.Color(cMid) : null;
    const vz = chunk.userData.virtualZ;
    const dune = this.zone?.id === 'dune';
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), zz = pos.getZ(i) + vz;
      let h = (noise(x * 0.014, zz * 0.012) * 0.7 + noise2(x * 0.033, zz * 0.028) * 0.3);
      const flatten = clamp((Math.abs(x) - 265) / 120, 0, 1); // keep the wide corridor low
      if (dune) {
        // Broad, wind-aligned ripples are shallow at the route and strengthen on the flanks.
        // They improve parallax without becoming visual or physical obstacles.
        const ripple = Math.sin(zz * 0.075 + x * 0.024 + Math.sin(x * 0.012) * 1.5);
        h += ripple * 0.13 * (0.18 + flatten * 0.82);
      }
      h = h * amp * (0.2 + 0.8 * flatten);
      pos.setY(i, h - 1.5);
      const k = clamp(h / amp * 0.5 + 0.5, 0, 1);
      const c = m ? (k < 0.5 ? a.clone().lerp(m, k * 2) : m.clone().lerp(b, (k - 0.5) * 2)) : a.clone().lerp(b, k);
      if (dune) {
        const windBand = 0.92 + (Math.sin(zz * 0.07 + x * 0.018) * 0.5 + 0.5) * 0.08;
        const route = flightRoute('dune', zz);
        const corridor = clamp(1 - Math.abs(x - route.center) / (route.halfWidth * 1.7), 0, 1);
        c.multiplyScalar(windBand).lerp(a, corridor * 0.12);
      }
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.z = -CHUNK_LEN / 2;
    mesh.userData.noCollide = true; // the floor itself must never block flight
    return mesh;
  }

  /* ---------- per-frame ---------- */
  update(dt, scrollSpeed) {
    this.time += dt;
    this._ambientAccumulator += dt;
    const animateAmbient = this._ambientAccumulator >= this._ambientInterval;
    const ambientDt = animateAmbient ? this._ambientAccumulator : 0;
    if (animateAmbient) this._ambientAccumulator = 0;
    for (const chunk of this.chunks) {
      chunk.position.z += scrollSpeed * dt;
      if (chunk.position.z > CHUNK_LEN * 0.9) {
        chunk.position.z -= TOTAL_LEN;
        chunk.userData.virtualZ = this._nextVirtual;
        this._nextVirtual -= CHUNK_LEN;
        this._populate(chunk);
      }
      // Keep one chunk of overlap around the fog edge to prevent visible pop-in.
      // Hidden chunks continue to scroll/recycle but skip rendering and ambient transforms.
      chunk.visible = chunk.position.z > -this._drawDistance - CHUNK_LEN && chunk.position.z < CHUNK_LEN * 0.72;
      // Floating islands are purely ambient. Scrolling and collider positions
      // remain full-rate; only decorative transform work is sampled.
      if (animateAmbient && chunk.visible) for (const o of chunk.children) {
        if (o.userData.float) o.position.y = o.userData.float.y0 + Math.sin(this.time * 0.6 + o.userData.float.off) * 3;
      }
    }
    if (animateAmbient) for (const m of this.waterfallMats) if (m.map) m.map.offset.y += ambientDt * 1.6;
    if (animateAmbient) for (const fx of this.naturalEffects) {
      const u = this.time * fx.speed + fx.phase;
      const pulse = 0.5 + 0.5 * Math.sin(u);
      if (fx.kind === 'breaker') {
        fx.mesh.position.x = fx.x + Math.sin(u) * fx.amp;
        fx.mesh.position.y = fx.y + Math.sin(u * 1.6) * 0.22;
        fx.mesh.rotation.z = Math.sin(u * 0.7) * 0.12;
        fx.mat.opacity = fx.op * (0.58 + pulse * 0.42);
      } else if (fx.kind === 'spray') {
        fx.mesh.position.y = fx.y + Math.sin(u * 1.8) * fx.amp;
        fx.mesh.position.x = fx.x + Math.sin(u * 0.7) * 1.6 * fx.side;
        fx.mesh.scale.set(fx.base * (0.82 + pulse * 0.25), fx.base * fx.tall * (0.82 + pulse * 0.25), 1);
        fx.mat.opacity = fx.op * (0.38 + pulse * 0.62);
      } else if (fx.kind === 'gorgeMist' || fx.kind === 'talusDust') {
        fx.mesh.position.x = fx.x + Math.sin(u * 0.55) * fx.amp * fx.side;
        fx.mesh.position.y = fx.y + Math.sin(u * 0.85) * 2.2;
        fx.mesh.scale.set(fx.base * (0.88 + pulse * 0.22), fx.base * fx.tall * (0.88 + pulse * 0.22), 1);
        fx.mat.opacity = fx.op * (0.48 + pulse * 0.5);
      } else if (fx.kind === 'heatVent') {
        fx.mesh.position.y = fx.y + pulse * fx.amp;
        fx.mesh.scale.set(fx.base * (0.78 + pulse * 0.52), fx.base * fx.tall * (0.78 + pulse * 0.52), 1);
        fx.mat.opacity = fx.op * (0.42 + pulse * 0.58);
      } else if (fx.kind === 'ashPlume') {
        fx.mesh.position.y = fx.y + (0.5 + pulse) * fx.amp;
        fx.mesh.position.x = fx.x + Math.sin(u * 0.34) * fx.amp * 0.55;
        fx.mat.opacity = fx.op * (0.34 + pulse * 0.42);
      } else if (fx.kind === 'sandVeil') {
        fx.mesh.position.x = fx.x + Math.sin(u * 0.45) * fx.amp;
        fx.mesh.position.y = fx.y + Math.sin(u * 0.75) * 3;
        fx.mesh.scale.set(fx.base * (0.8 + pulse * 0.35), fx.base * fx.tall * (0.8 + pulse * 0.35), 1);
        fx.mat.opacity = fx.op * (0.45 + pulse * 0.45);
      } else if (fx.kind === 'oasisGlint') {
        fx.mesh.position.x = fx.x + Math.sin(u * 0.7) * fx.amp;
        fx.mesh.scale.set(fx.base * (0.78 + pulse * 0.38), fx.base * fx.tall * (0.78 + pulse * 0.38), 1);
        fx.mat.opacity = fx.op * (0.32 + pulse * 0.58);
      } else if (fx.kind === 'riftShimmer') {
        fx.mesh.position.y = fx.y + Math.sin(u * 1.4) * fx.amp;
        fx.mesh.material.rotation += ambientDt * 0.38;
        fx.mat.opacity = fx.op * (0.42 + pulse * 0.58);
      } else if (fx.kind === 'impactBeacon') {
        fx.mesh.position.y = fx.y + Math.sin(u * 1.8) * fx.base * fx.amp;
        const s = 1 + Math.sin(u * 2.2) * 0.12;
        fx.mesh.scale.set(fx.base * s, fx.base * fx.tall * s, 1);
        fx.mat.opacity = fx.op * (0.56 + pulse * 0.44);
      }
    }
    if (animateAmbient) for (const gr of this.glows) {
      if (gr.mat?.emissiveIntensity !== undefined) gr.mat.emissiveIntensity = gr.base + Math.sin(this.time * 3 + gr.off) * gr.amp;
      else if (gr.impact && gr.mat) gr.mat.opacity = Math.max(0, gr.base + Math.sin(this.time * 3 + gr.off) * gr.amp);
    }
    for (const mark of this.impactMarks) {
      if (!mark.visible) continue;
      const u = mark.userData;
      u.life -= dt;
      if (u.life <= 0) { mark.visible = false; mark.material.opacity = 0; continue; }
      const k = u.life / u.maxLife;
      mark.position.z += scrollSpeed * dt;
      mark.scale.setScalar(u.base * (1.08 - k * 0.08));
      mark.material.opacity = u.op * Math.min(1, k * 2.4) * (0.35 + k * 0.65);
      if (mark.position.z > 95) { mark.visible = false; mark.material.opacity = 0; }
    }
    this._updateWater(dt);
  }
}
