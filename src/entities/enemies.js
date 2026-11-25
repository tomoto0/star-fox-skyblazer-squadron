import * as THREE from 'three';
import { buildDrone, buildLancer, buildPod, buildTurret, buildMine, buildRay, buildGunship, buildSeeker, buildSniper, buildStrafer, buildBomber, buildFlak, buildAABattery, buildHovertank, buildLauncher, buildSaucer, buildCarrier, buildSiegeCarrier, buildBreacher, buildValkyrie, buildVanguard, buildKraken, buildSilo, buildWyrm, buildScorpion, SHIP_MODELS } from './shipFactory.js';
import { rand, pick, clamp, damp, TAU, _v1, _v2, dotTexture } from '../core/util.js';
import { PLAYER_Z } from './player.js';
import { audio } from '../core/audio.js';

// Close-quarters combat spawn depth: enemies enter substantial 3D silhouettes
// immediately and surge into the player's windshield in ~2-3 seconds!
const SPAWN_Z = -310;
const FORMATION_SCALE = [null, 1.04, 1.08, 1.12, 1.18, 1.24, 1.30, 1.38, 1.46, 1.54, 1.62, 1.70, 1.78, 1.86, 1.94, 2.02, 2.10];
const WAVE_HP_SCALE   = [null, 1.00, 1.10, 1.20, 1.32, 1.46, 1.62, 1.78, 1.96, 2.16, 2.38, 2.62, 2.86, 3.12, 3.38, 3.65, 3.95];
const HP_BAR_GEO = new THREE.PlaneGeometry(1, 1);
HP_BAR_GEO.userData.shared = true;

/* Enlarged collision radii matching the bigger V60 enemy silhouettes, plus
 * destruction `tier` ('small' | 'medium' | 'heavy') driving explosion scale,
 * dying spin-outs, debris burst, and hitstop punch! */
const STATS = {
  drone:       { hp: 3,  r: 7.2,  score: 15,   tier: 'small',  linger: 2.0 },
  lancer:      { hp: 5,  r: 8.2,  score: 35,   tier: 'medium', linger: 2.3 },
  pod:         { hp: 11, r: 8.2,  score: 60,   tier: 'medium', linger: 2.6 },
  turret:      { hp: 8,  r: 7.8,  score: 45,   tier: 'medium', ground: true },
  mine:        { hp: 2,  r: 6.2,  score: 25,   tier: 'small' },
  ray:         { hp: 5,  r: 8.4,  score: 35,   tier: 'small',  linger: 2.0 },
  gunship:     { hp: 26, r: 11.4, score: 160,  tier: 'heavy',  linger: 3.6 },
  seeker:      { hp: 8,  r: 8.4,  score: 70,   tier: 'medium' },
  sniper:      { hp: 10, r: 8.6,  score: 90,   tier: 'medium' },
  strafer:     { hp: 8,  r: 8.8,  score: 80,   tier: 'medium', linger: 2.4 },
  bomber:      { hp: 18, r: 10.6, score: 140,  tier: 'heavy',  linger: 3.4 },
  saucer:      { hp: 12, r: 9.2,  score: 120,  tier: 'medium' },
  skyraider:   { hp: 42, r: 12.4, score: 380,  tier: 'heavy',  linger: 4.2 },
  relaydrone:  { hp: 9,  r: 8.0,  score: 120,  tier: 'medium', linger: 2.3 },
  carrier:     { hp: 34, r: 12.6, score: 240,  tier: 'heavy',  linger: 4.2 },
  flak:        { hp: 14, r: 8.4,  score: 100,  tier: 'medium', ground: true },
  hovertank:   { hp: 16, r: 9.0,  score: 110,  tier: 'medium', ground: true },
  launcher:    { hp: 12, r: 8.2,  score: 100,  tier: 'medium', ground: true },
  aabattery:   { hp: 28, r: 9.2,  score: 360,  tier: 'heavy',  ground: true },
  scout:       { hp: 7,  r: 8.5,  score: 95,   tier: 'medium', linger: 2.3 },
  fighter:     { hp: 14, r: 10.2, score: 170,  tier: 'medium', linger: 2.7 },
  skytalon:    { hp: 11, r: 9.6,  score: 200,  tier: 'medium', linger: 2.5 },
  harrier:     { hp: 12, r: 9.6,  score: 190,  tier: 'medium', linger: 2.4 },
  phantom:     { hp: 16, r: 9.2,  score: 260,  tier: 'medium', linger: 2.7 },
  dreadwing:   { hp: 58, r: 13.4, score: 980,  tier: 'heavy',  linger: 4.5 },
  quadtank:    { hp: 30, r: 9.6,  score: 340,  tier: 'heavy',  ground: true },
  trilobite:   { hp: 26, r: 9.8,  score: 320,  tier: 'heavy',  ground: true },
  cannon:      { hp: 18, r: 7.8,  score: 230,  tier: 'medium', ground: true },
  shorecannon: { hp: 16, r: 7.5,  score: 220,  tier: 'medium', ground: true },
  gunboat:     { hp: 46, r: 14.0, score: 680,  tier: 'heavy',  ground: true },
  frigate:     { hp: 70, r: 17.6, score: 1150, tier: 'heavy',  ground: true },
  mech:        { hp: 52, r: 11.2, score: 920,  tier: 'heavy',  ground: true },
  siegecarrier:{ hp: 82, r: 14.8, score: 1500, tier: 'heavy',  linger: 4.8 },
  breacher:    { hp: 10, r: 9.2,  score: 150,  tier: 'medium', linger: 2.2 },
  valkyrie:    { hp: 11, r: 9.4,  score: 170,  tier: 'medium', linger: 2.3 },
  vanguard:    { hp: 10, r: 9.2,  score: 160,  tier: 'medium', linger: 2.2 },
  kraken:      { hp: 13, r: 9.6,  score: 190,  tier: 'medium', linger: 2.5 },
  silo:        { hp: 16, r: 9.6,  score: 210,  tier: 'medium', ground: true },
  wyrm:        { hp: 15, r: 9.8,  score: 220,  tier: 'medium', linger: 2.6 },
  scorpion:    { hp: 16, r: 9.8,  score: 230,  tier: 'medium', linger: 2.5 },
};

const BUILDERS = {
  drone: buildDrone, lancer: buildLancer, pod: buildPod, turret: buildTurret, mine: buildMine, ray: buildRay,
  gunship: buildGunship, seeker: buildSeeker, sniper: buildSniper,
  strafer: buildStrafer, bomber: buildBomber, flak: buildFlak, aabattery: buildAABattery, hovertank: buildHovertank, launcher: buildLauncher,
  saucer: buildSaucer, carrier: buildCarrier,
  skyraider: buildCarrier, relaydrone: buildDrone,
  scout: buildDrone, fighter: buildStrafer, skytalon: buildStrafer, harrier: buildLancer, phantom: buildSeeker, dreadwing: buildSiegeCarrier,
  quadtank: buildHovertank, trilobite: buildFlak,
  cannon: buildFlak, shorecannon: buildTurret, gunboat: buildCarrier, frigate: buildCarrier, mech: buildLauncher,
  siegecarrier: buildSiegeCarrier,
  breacher: buildBreacher, valkyrie: buildValkyrie, vanguard: buildVanguard,
  kraken: buildKraken, silo: buildSilo, wyrm: buildWyrm, scorpion: buildScorpion,
};

const HEAVY_TYPES = new Set(['skyraider', 'carrier', 'gunship', 'bomber', 'dreadwing', 'frigate', 'gunboat', 'mech', 'quadtank', 'trilobite', 'siegecarrier', 'aabattery']);
const ELITE_TYPES = new Set(['seeker', 'sniper', 'strafer', 'fighter', 'skytalon', 'harrier', 'phantom', 'saucer', 'scout', 'relaydrone', 'breacher', 'valkyrie', 'vanguard', 'kraken', 'wyrm', 'scorpion']);
const SMALL_REGULAR_TYPES = new Set(['drone', 'lancer', 'ray', 'relaydrone', 'scout', 'pod']);
const ENTRY_MODES = new Set(['rear', 'rearPincer', 'sideSweep', 'sidePincer', 'skyDive', 'helixSurround']);
const ALLY_TARGET_CAPABLE = new Set([
  'drone', 'relaydrone', 'lancer', 'turret', 'seeker', 'sniper', 'strafer',
  'flak', 'aabattery', 'saucer', 'carrier', 'skyraider', 'scout', 'fighter', 'skytalon', 'harrier',
  'phantom', 'trilobite', 'cannon', 'shorecannon', 'siegecarrier',
  'breacher', 'valkyrie', 'vanguard', 'kraken', 'silo', 'wyrm', 'scorpion',
]);

/* ---- Crisp Star Fox-style tactical corner brackets (no noisy HOSTILE text boxes!) ---- */
const BRACKET_CACHE = new Map();
function bracketTexture(style = 'corner') {
  if (BRACKET_CACHE.has(style)) return BRACKET_CACHE.get(style);
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);
  ctx.strokeStyle = '#ffffff';
  ctx.lineCap = 'square';
  if (style === 'lock') {
    ctx.lineWidth = 7;
    const m = 14, len = 28;
    ctx.beginPath();
    ctx.moveTo(m, m + len); ctx.lineTo(m, m); ctx.lineTo(m + len, m);
    ctx.moveTo(128 - m - len, m); ctx.lineTo(128 - m, m); ctx.lineTo(128 - m, m + len);
    ctx.moveTo(m, 128 - m - len); ctx.lineTo(m, 128 - m); ctx.lineTo(m + len, 128 - m);
    ctx.moveTo(128 - m - len, 128 - m); ctx.lineTo(128 - m, 128 - m); ctx.lineTo(128 - m, 128 - m - len);
    ctx.stroke();
    // subtle diamond ticks inside lock reticle
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(64, 24); ctx.lineTo(64, 36);
    ctx.moveTo(64, 92); ctx.lineTo(64, 104);
    ctx.moveTo(24, 64); ctx.lineTo(36, 64);
    ctx.moveTo(92, 64); ctx.lineTo(104, 64);
    ctx.stroke();
  } else if (style === 'heavy') {
    // Bold octagonal heavy target corners
    ctx.lineWidth = 6;
    const m = 18, len = 26;
    ctx.beginPath();
    ctx.moveTo(m, m + len); ctx.lineTo(m, m); ctx.lineTo(m + len, m);
    ctx.moveTo(128 - m - len, m); ctx.lineTo(128 - m, m); ctx.lineTo(128 - m, m + len);
    ctx.moveTo(m, 128 - m - len); ctx.lineTo(m, 128 - m); ctx.lineTo(m + len, 128 - m);
    ctx.moveTo(128 - m - len, 128 - m); ctx.lineTo(128 - m, 128 - m); ctx.lineTo(128 - m, 128 - m - len);
    ctx.stroke();
  } else {
    // Sleek minimal tactical target corners (keeps focus on the 3D craft!)
    ctx.lineWidth = 5;
    const m = 24, len = 20;
    ctx.beginPath();
    ctx.moveTo(m, m + len); ctx.lineTo(m, m); ctx.lineTo(m + len, m);
    ctx.moveTo(128 - m - len, m); ctx.lineTo(128 - m, m); ctx.lineTo(128 - m, m + len);
    ctx.moveTo(m, 128 - m - len); ctx.lineTo(m, 128 - m); ctx.lineTo(m + len, 128 - m);
    ctx.moveTo(128 - m - len, 128 - m); ctx.lineTo(128 - m, 128 - m); ctx.lineTo(128 - m, 128 - m - len);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  BRACKET_CACHE.set(style, t);
  return t;
}

function markerProfile(type, ground = false) {
  if (type === 'mine') return { style: 'corner', color: 0xff3558, scale: 0.95, class: 'mine' };
  if (HEAVY_TYPES.has(type)) return { style: 'heavy', color: 0xff9f43, scale: 1.45, class: 'heavy' };
  if (ELITE_TYPES.has(type)) return { style: 'corner', color: 0xda7eff, scale: 1.15, class: 'elite' };
  if (ground) return { style: 'corner', color: 0xffc454, scale: 1.05, class: 'ground' };
  return { style: 'corner', color: 0xff5268, scale: 1.0, class: 'hostile' };
}

export class Enemies {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.queue = [];
    this._pendingShots = [];
    this.killCount = 0;
    this.difficultyWave = 1;
    this.ambushTimer = rand(3.5, 5.2);
    this._squads = new Map();
    this._squadSeq = 0;
  }

  /** Pause-safe delayed shot scheduler driven by game dt (never leaks across pause/waveclear) */
  _scheduleShot(delaySec, fn) {
    this._pendingShots.push({ t: delaySec, fn });
  }

  get aliveCount() { return this.list.filter((e) => !e.dying).length; }

  setDifficultyWave(wave) { this.difficultyWave = clamp(wave | 0, 1, 16); }

  /** immediately spawn one enemy */
  spawn(type, opts = {}) {
    const st = STATS[type];
    const mesh = SHIP_MODELS[type] ? SHIP_MODELS[type].clone(true) : BUILDERS[type]();
    mesh.traverse((o) => o.layers.enable(1));
    this.scene.add(mesh);

    const w = this.difficultyWave;
    const waveHpMul = type === 'mine' ? (1 + (w - 1) * 0.14) : (WAVE_HP_SCALE[w] ?? 3.95);
    const hpVal = Math.max(1, Math.round(st.hp * waveHpMul * (opts.hpMul ?? 1)));
    const scaledScore = Math.round(st.score * (1 + (w - 1) * 0.08));
    // Give regular enemies a bolder, more readable 3D presence across the sky & ground!
    const sizeMul = type === 'mine' ? 1.06
      : HEAVY_TYPES.has(type) ? 1.08
      : SMALL_REGULAR_TYPES.has(type) ? 1.26
      : st.ground ? 1.18
      : 1.20;
    const hitRadius = st.r * (0.5 + 0.5 * sizeMul);
    const e = {
      type, mesh, alive: true, dying: false,
      tier: st.tier ?? 'small',
      hp: hpVal, maxHp: hpVal,
      radius: hitRadius, score: scaledScore,
      age: 0,
      fireCd: opts.fireCd ?? (this.difficultyWave <= 3 ? rand(0.6, 1.25) : rand(0.95, 2.0)),
      x0: opts.x ?? rand(-75, 75),
      y0: opts.y ?? rand(10, 34),
      flankOffset: rand(-34, 34),
      yOffset: rand(-6, 15),
      phase: opts.phase ?? rand(TAU),
      amp: opts.amp ?? rand(6, 16),
      speed: opts.speed ?? 1,
      side: opts.side ?? (Math.random() < 0.5 ? -1 : 1),
      aggressive: opts.aggressive ?? false,
      ground: !!st.ground,
      // Close-quarters dogfight linger & acrobatic flight state:
      // enemies dive right into z ∈ [-102, -34], execute coordinated aerial stunts, then roar past!
      lingerDur: st.linger ?? 0,
      lingerUsed: 0,
      lingering: false,
      maneuver: opts.maneuver ?? pick(['corkscrew', 'diveBomb', 'scissor', 'barrelSwoop', 'figure8', 'stalker', 'splitBreak', 'skimmer']),
      splitSide: opts.splitSide ?? (Math.random() < 0.5 ? -1 : 1),
      rank: opts.rank ?? 0,
      splitFired: false,
      rollBurst: 0,
      rollDir: Math.random() < 0.5 ? -1 : 1,
      rollCd: rand(1.1, 2.3),
      bankZ: 0,
      aimPressure: 0,
      dodgeCd: rand(1.6, 2.8),
      trailCd: 0,
      podOpen: 0,
      phaseBlinkT: 0,
      evadeT: 0,
      evadeDir: 1,
      evadeSpin: 0,
      dashCd: rand(1.6, 2.6),
      telegraphFired: false,
      breachPeakY: opts.peakY ?? rand(44, 64),
      breachSplashed: false,
      diveTargetY: opts.diveY ?? rand(18, 36),
      wingFold: 0,
      attackIdx: (Math.random() * 3) | 0,
      minePulseFired: false,
      popTelegraphCd: 0,
      popErupted: false,
      skipSplash2: false,
      pounceCd: 0.9,
      pounceX: opts.x ?? rand(-75, 75),
      wyrmTrail: null,
      // Visceral impact / death-spiral state
      flash: 0,
      recoil: 0,
      hitSpin: 0,
      smokeCd: 0,
      deathT: 0,
      deathVel: null,
      deathSpin: null,
      baseScale: (mesh.userData.meshScale ?? 1) * sizeMul,
      allyTarget: opts.allyTarget ?? null,
      forcedWingmate: opts.forcedWingmate ?? null,
      allyTargetT: 0,
      squadId: opts.squadId ?? null,
      // Curved 3D multi-vector entry trajectory (rear overtake, lateral cut-in, sky dive, spiral surround)
      entryMode: opts.entryMode ?? null,
      entryT: 0,
      entryDur: opts.entryDur ?? 1.45,
      entryStart: opts.entryStart ? opts.entryStart.clone() : null,
      entryCtrl: opts.entryCtrl ? opts.entryCtrl.clone() : null,
      entryEnd: opts.entryEnd ? opts.entryEnd.clone() : null,
      entrySwooshed: false,
      pos() { return this.mesh.position; },
    };

    if (e.baseScale !== 1) mesh.scale.setScalar(e.baseScale);

    const HOVER = { hovertank: 3.5, quadtank: 3.0, gunboat: 1.8, frigate: 2.2, silo: 0.2 };
    if (st.ground) e.y0 = opts.y ?? (HOVER[type] ?? 0);
    // Keep ground enemies inside the visible canyon/sea flanks so they aren't hidden off-screen
    if (st.ground && opts.x === undefined) e.x0 = rand(-118, 118);
    // Sudden water/ground ambushers default to hidden submerged/buried depth in mid-close engagement range!
    const POPUP_Y = { breacher: -28, kraken: -24, wyrm: -32, scorpion: -18, silo: -9.5 };
    let spawnY = e.y0;
    let spawnZ = opts.z ?? SPAWN_Z;
    if (e.entryMode && e.entryStart) {
      mesh.position.copy(e.entryStart);
      if (e.entryEnd) {
        e.x0 = e.entryEnd.x;
        e.y0 = e.entryEnd.y;
      }
    } else {
      if (type in POPUP_Y) {
        spawnY = opts.y ?? POPUP_Y[type];
        if (opts.z === undefined) spawnZ = type === 'silo' ? rand(-188, -128) : rand(-168, -112);
      }
      mesh.position.set(e.x0, spawnY, spawnZ);
    }
    if (type === 'silo' && mesh.userData.hatch) {
      mesh.userData.hatch.position.y = (0.2 - mesh.position.y) / (e.baseScale || 1);
    }
    if (type === 'turret') mesh.position.y = opts.y ?? 1.2;

    const frame = mesh.getObjectByName('combatFrame');
    if (frame) {
      const visual = {
        engineGlows: [], engineCollars: [], enginePlumes: [],
        warningLights: [], weaponGlows: [], sensorRings: [],
        reactorCores: [], reactorHalos: [],
        gyroA: [], gyroB: [], radars: [],
        wingL: null, wingR: null, damageSmoke: null,
      };
      frame.traverse((n) => {
        if (n.name === 'combatEngineGlow') visual.engineGlows.push(n);
        else if (n.name === 'combatEngineCollar') visual.engineCollars.push(n);
        else if (n.name === 'combatEnginePlume') visual.enginePlumes.push(n);
        else if (n.name === 'combatWarningLight') visual.warningLights.push(n);
        else if (n.name === 'combatWeaponGlow') visual.weaponGlows.push(n);
        else if (n.name === 'combatSensorRing') visual.sensorRings.push(n);
        else if (n.name === 'combatReactorCore') visual.reactorCores.push(n);
        else if (n.name === 'combatReactorHalo') visual.reactorHalos.push(n);
        else if (n.name === 'combatGyroA') visual.gyroA.push(n);
        else if (n.name === 'combatGyroB') visual.gyroB.push(n);
        else if (n.name === 'combatRadar') visual.radars.push(n);
        else if (n.name === 'combatWingL') visual.wingL = n;
        else if (n.name === 'combatWingR') visual.wingR = n;
        else if (n.name === 'combatDamageSmoke') visual.damageSmoke = n;
      });
      e.visual = visual;
    } else {
      const enginePlumes = [], radars = [], gyroA = [];
      mesh.traverse((n) => {
        if (n.name === 'combatEnginePlume') enginePlumes.push(n);
        else if (n.name === 'combatRadar') radars.push(n);
        else if (n.name === 'combatGyroA') gyroA.push(n);
      });
      if (enginePlumes.length || radars.length || gyroA.length) {
        e.visual = {
          engineGlows: [], engineCollars: [], enginePlumes,
          warningLights: [], weaponGlows: [], sensorRings: [],
          reactorCores: [], reactorHalos: [],
          gyroA, gyroB: [], radars,
          wingL: null, wingR: null, damageSmoke: null,
        };
      }
    }
    this._addMarker(e);
    this.list.push(e);
    return e;
  }

  /** queue a formation tightly framed across the player's combat corridor with coordinated squadron stunts */
  formation(type, n, pattern, opts = {}) {
    const scale = opts.noScale ? 1 : (FORMATION_SCALE[this.difficultyWave] ?? 2.10);
    n = clamp(Math.round(n * scale), 1, 14);
    const bx = opts.x !== undefined ? clamp(opts.x * 0.72, -110, 110) : rand(-74, 74);
    const highY = opts.y === undefined && Math.random() < 0.28 ? rand(30, 66) : null;
    // Assign a cohesive Star Fox squadron maneuver matched to the formation geometry!
    const squadManeuver = opts.maneuver ?? (
      pattern === 'vee' ? pick(['splitBreak', 'diveBomb', 'barrelSwoop'])
        : (pattern === 'sides' || pattern === 'pincer') ? pick(['scissor', 'diveBomb', 'corkscrew'])
        : pattern === 'column' ? pick(['corkscrew', 'figure8', 'skimmer'])
        : pattern === 'echelon' ? pick(['diveBomb', 'scissor', 'barrelSwoop'])
        : pick(['barrelSwoop', 'splitBreak', 'skimmer', 'stalker', 'figure8'])
    );
    const squadId = (n >= 3 && type !== 'mine') ? (++this._squadSeq) : null;
    if (squadId) {
      this._squads.set(squadId, { type, total: n, killed: 0, escaped: 0, done: false });
    }
    for (let i = 0; i < n; i++) {
      const o = { ...opts, maneuver: squadManeuver, rank: i, splitSide: i < n / 2 ? -1 : 1, squadId };
      switch (pattern) {
        case 'line':
          o.x = -((n - 1) / 2) * 18 + i * 18 + bx;
          o.y = opts.y ?? highY ?? 18;
          o.delay = i * 0.08;
          break;
        case 'vee':
          o.x = (i - (n - 1) / 2) * 17 + bx;
          o.y = (opts.y ?? highY ?? 22) - Math.abs(i - (n - 1) / 2) * 2.8;
          o.delay = Math.abs(i - (n - 1) / 2) * 0.12;
          break;
        case 'column':
          o.x = opts.x !== undefined ? clamp(opts.x, -95, 95) : rand(-78, 78);
          o.y = opts.y ?? highY ?? rand(12, 46);
          o.delay = i * 0.36;
          break;
        case 'sides':
          o.side = i % 2 ? 1 : -1;
          o.x = o.side * rand(85, 138);
          o.y = opts.y ?? highY ?? rand(14, 52);
          o.delay = Math.floor(i / 2) * 0.38;
          break;
        case 'wall':
          o.x = -((n - 1) / 2) * (240 / Math.max(1, n)) + i * (240 / Math.max(1, n));
          o.y = opts.y ?? rand(14, 46);
          o.delay = i * 0.05;
          break;
        case 'echelon':
          o.x = bx + (i - (n - 1) / 2) * 24;
          o.y = (opts.y ?? highY ?? 24) + i * 4;
          o.z = (opts.z ?? SPAWN_Z) - i * 18;
          o.delay = i * 0.14;
          break;
        case 'pincer': {
          const side = i < Math.ceil(n / 2) ? -1 : 1;
          const rank = i % Math.ceil(n / 2);
          o.side = side;
          o.x = side * rand(96, 136) + bx * 0.18;
          o.y = (opts.y ?? highY ?? 28) + rank * 9;
          o.z = (opts.z ?? SPAWN_Z) - rank * 22;
          o.delay = rank * 0.22;
          break;
        }
        case 'popup': {
          // Sudden mid-close surface/ground emergence spread cleanly across the visible water or floor!
          const half = (n - 1) * 0.5;
          const baseOff = opts.x !== undefined ? opts.x : 0;
          o.x = clamp(baseOff + (i - half) * 68 + rand(-16, 16), -114, 114);
          o.z = (opts.z ?? rand(-166, -116)) - i * 16;
          o.delay = i * 0.42;
          break;
        }
        case 'rear': {
          // Star Fox signature Rear Overtake: roar past left/right canopy wings from behind,
          // sweep forward into z ∈ [-142, -88], and snap-turn to engage head-on!
          const side = opts.side ?? (i % 2 === 0 ? -1 : 1);
          const slot = Math.floor(i / 2);
          const startX = side * rand(54, 96);
          const startY = clamp((opts.y ?? 26) + rand(-8, 16) + slot * 4, 12, 68);
          const endX = clamp(bx * 0.45 + side * (22 + slot * 18) + rand(-12, 12), -118, 118);
          const endY = clamp((opts.y ?? 26) + rand(-6, 18), 14, 68);
          const endZ = rand(-142, -92) - slot * 14;
          o.side = side;
          o.entryMode = 'rear';
          o.entryDur = rand(1.18, 1.48);
          o.entryStart = new THREE.Vector3(startX, startY, rand(28, 46));
          o.entryCtrl = new THREE.Vector3(side * rand(68, 115), startY + rand(4, 18), rand(-62, -26));
          o.entryEnd = new THREE.Vector3(endX, endY, endZ);
          o.x = endX; o.y = endY; o.z = endZ;
          o.delay = i * 0.19;
          break;
        }
        case 'rearPincer': {
          // Twin-wing Rear Cross-Overtake: streak past BOTH wings from behind & crisscross in front of the nose!
          const side = i % 2 === 0 ? -1 : 1;
          const rank = Math.floor(i / 2);
          const startX = side * rand(56, 94);
          const startY = clamp((opts.y ?? 28) + (rank % 2 ? 10 : -4), 12, 66);
          const endX = clamp(-side * (34 + rank * 18) + rand(-10, 10), -122, 122);
          const endY = clamp((opts.y ?? 26) + rand(-6, 16), 14, 70);
          const endZ = rand(-148, -96) - rank * 14;
          o.side = -side;
          o.entryMode = 'rearPincer';
          o.entryDur = rand(1.25, 1.55);
          o.entryStart = new THREE.Vector3(startX, startY, rand(30, 48));
          o.entryCtrl = new THREE.Vector3(side * rand(82, 126), startY + rand(8, 22), rand(-64, -32));
          o.entryEnd = new THREE.Vector3(endX, endY, endZ);
          o.x = endX; o.y = endY; o.z = endZ;
          o.delay = rank * 0.24 + (i % 2) * 0.08;
          break;
        }
        case 'sideSweep': {
          // High-speed lateral cut-in straight across mid-close combat space!
          const side = opts.side ?? (Math.random() < 0.5 ? -1 : 1);
          const startX = side * rand(218, 258);
          const startY = clamp((opts.y ?? 30) + (i - (n - 1) * 0.5) * 6 + rand(-6, 6), 14, 72);
          const endX = clamp(-side * rand(28, 96) + (i - (n - 1) * 0.5) * 14, -124, 124);
          const endY = clamp(startY + rand(-10, 12), 14, 72);
          const endZ = rand(-146, -84) - i * 10;
          o.side = side;
          o.entryMode = 'sideSweep';
          o.entryDur = rand(1.15, 1.45);
          o.entryStart = new THREE.Vector3(startX, startY, endZ - rand(18, 38));
          o.entryCtrl = new THREE.Vector3(side * rand(42, 86), startY + rand(-8, 14), endZ + rand(14, 32));
          o.entryEnd = new THREE.Vector3(endX, endY, endZ);
          o.x = endX; o.y = endY; o.z = endZ;
          o.delay = i * 0.16;
          break;
        }
        case 'sidePincer': {
          // Simultaneous left & right closing pincer jaws surging in from both screen edges!
          const side = i % 2 === 0 ? -1 : 1;
          const rank = Math.floor(i / 2);
          const startX = side * rand(215, 255);
          const startY = clamp((opts.y ?? 28) + rank * 8 + rand(-6, 6), 14, 72);
          const endX = clamp(side * rand(32, 78), -118, 118);
          const endY = clamp(startY + rand(-8, 10), 14, 70);
          const endZ = rand(-148, -88) - rank * 16;
          o.side = side;
          o.entryMode = 'sidePincer';
          o.entryDur = rand(1.12, 1.42);
          o.entryStart = new THREE.Vector3(startX, startY + rand(-6, 10), endZ + rand(-18, 16));
          o.entryCtrl = new THREE.Vector3(side * rand(110, 155), startY + rand(6, 20), endZ + rand(16, 36));
          o.entryEnd = new THREE.Vector3(endX, endY, endZ);
          o.x = endX; o.y = endY; o.z = endZ;
          o.delay = rank * 0.22;
          break;
        }
        case 'skyDive': {
          // High-altitude plunging dive squadron swooping down from above the top viewport edge!
          const half = (n - 1) * 0.5;
          const endX = clamp(bx + (i - half) * 28 + rand(-10, 10), -122, 122);
          const endY = clamp((opts.y ?? 24) + rand(-4, 14), 14, 54);
          const endZ = rand(-154, -92) - Math.abs(i - half) * 14;
          o.side = endX >= 0 ? 1 : -1;
          o.entryMode = 'skyDive';
          o.entryDur = rand(1.18, 1.48);
          o.entryStart = new THREE.Vector3(endX + rand(-34, 34), rand(152, 184), endZ - rand(28, 52));
          o.entryCtrl = new THREE.Vector3(endX * 0.85, rand(52, 82), endZ + rand(8, 24));
          o.entryEnd = new THREE.Vector3(endX, endY, endZ);
          o.x = endX; o.y = endY; o.z = endZ;
          o.delay = i * 0.14;
          break;
        }
        case 'helixSurround': {
          // 360-degree 3D spiral encirclement converging from top, bottom, left & right edges!
          const ang = (i / Math.max(1, n)) * TAU + rand(-0.2, 0.2);
          const endR = rand(46, 78);
          const endX = clamp(bx * 0.35 + Math.cos(ang) * endR, -124, 124);
          const endY = clamp(36 + Math.sin(ang) * 22, 14, 68);
          const endZ = rand(-148, -94) - (i % 3) * 12;
          const startAng = ang - 1.15;
          const startX = Math.cos(startAng) * 210;
          const startY = clamp(42 + Math.sin(startAng) * 95, 8, 155);
          const ctrlAng = ang - 0.52;
          o.side = endX >= 0 ? 1 : -1;
          o.entryMode = 'helixSurround';
          o.entryDur = rand(1.30, 1.62);
          o.entryStart = new THREE.Vector3(startX, startY, endZ - rand(55, 85));
          o.entryCtrl = new THREE.Vector3(Math.cos(ctrlAng) * 138, clamp(40 + Math.sin(ctrlAng) * 58, 10, 118), endZ - rand(10, 26));
          o.entryEnd = new THREE.Vector3(endX, endY, endZ);
          o.x = endX; o.y = endY; o.z = endZ;
          o.delay = i * 0.11;
          break;
        }
        default:
          o.delay = i * 0.22;
      }
      o.phase = (opts.phase ?? 0) + i * 0.7;
      this.queue.push({ type, opts: o, t: o.delay ?? 0 });
    }
  }

  taskForce(kind, opts = {}, game = null) {
    const x = opts.x !== undefined ? clamp(opts.x * 0.7, -50, 50) : rand(-36, 36);
    const y = clamp(opts.y ?? 42, 22, 62);
    const z = opts.z ?? SPAWN_Z;
    if (kind === 'siege') {
      const flagship = this.spawn('siegecarrier', { x, y, z, speed: opts.speed ?? 0.55, hpMul: opts.hpMul ?? 1 });
      this._formationEntryFx(flagship, game, 'siege');
      const escorts = opts.escorts ?? 4;
      for (let i = 0; i < escorts; i++) {
        const side = i % 2 ? 1 : -1;
        this.queue.push({
          type: i % 3 === 2 ? 'phantom' : 'fighter',
          opts: { x: x + side * (34 + (i >> 1) * 18), y: y + (i % 2 ? 7 : -8), z: z - 24 - i * 12, side, speed: i % 3 === 2 ? 0.92 : 1.04, noScale: true },
          t: 0.4 + i * 0.22,
        });
      }
      return;
    }
    if (kind === 'pincer') {
      const count = opts.count ?? 3;
      this.formation('harrier', count, 'pincer', { x, y, z, noScale: true, speed: 1.06, entryFx: 'pincer' });
      this.formation('fighter', Math.max(2, count - 1), 'sides', { x, y: y + 10, z: z - 28, noScale: true, speed: 0.90, entryFx: 'pincer' });
    }
  }

  update(dt, scroll, player, proj, game) {
    // pause-safe delayed burst shots
    for (let i = this._pendingShots.length - 1; i >= 0; i--) {
      const s = this._pendingShots[i];
      s.t -= dt;
      if (s.t <= 0) {
        this._pendingShots.splice(i, 1);
        s.fn();
      }
    }

    // delayed spawns
    for (let i = this.queue.length - 1; i >= 0; i--) {
      const q = this.queue[i];
      q.t -= dt;
      if (q.t <= 0) {
        const spawned = this.spawn(q.type, q.opts);
        if (q.opts.entryFx) this._formationEntryFx(spawned, game, q.opts.entryFx);
        this.queue.splice(i, 1);
      }
    }

    // random elite / ground spawns (progressively denser in later stages)
    this.eliteTimer = (this.eliteTimer ?? 7) - dt;
    if (this.eliteTimer <= 0 && game.state === 'playing' && !game.boss && !game.rival?.active && !game.waveSpec?.boss && (game.wave ?? 1) >= 2) {
      const w = game.wave ?? 1;
      this.eliteTimer = Math.max(3.4, rand(8.6, 12.8) - Math.max(0, w - 2) * 0.36);
      const overWater = game.zone?.id === 'sea';
      const roll = Math.random();
      if (overWater && roll < 0.40) {
        const pool = ['shorecannon'];
        if (w >= 4) pool.push('gunboat');
        if (w >= 7) pool.push('gunboat', 'frigate');
        const t = pick(pool);
        this.spawn(t, { x: rand(-105, 105), z: SPAWN_Z, speed: 1.0 });
        game.hud?.alert?.(t === 'frigate' ? '⚠ FRIGATE ON THE WATER' : '⚠ SURFACE CONTACT', 1.5);
      } else if (!overWater && roll < 0.38) {
        const pool = ['flak', 'hovertank', 'launcher', 'cannon'];
        if (w >= 4) pool.push('aabattery');
        if (w >= 5) pool.push('quadtank', 'trilobite');
        if (w >= 8) pool.push('mech');
        const t = pick(pool);
        const n = (t === 'hovertank' || t === 'cannon') && Math.random() < 0.5 ? 2 : 1;
        for (let k = 0; k < n; k++) this.spawn(t, { x: rand(-95, 95) + k * 28, z: SPAWN_Z, speed: 1.0 });
        game.hud?.alert?.(t === 'mech' ? '⚠ HEAVY WALKER' : t === 'aabattery' ? '⚠ AA BATTERY LOCKING' : '⚠ GROUND FORCES', 1.4);
      } else {
        const r = Math.random() + Math.min(w, 16) * 0.015;
        const type = w >= 15 && r > 1.16 ? 'dreadwing' : w >= 13 && r > 1.06 ? 'phantom'
          : r > 1.08 ? 'skyraider' : r > 0.98 ? 'carrier' : r > 0.86 ? 'gunship' : r > 0.72 ? 'bomber'
          : w >= 13 && r > 0.64 ? 'harrier' : r > 0.60 ? 'fighter' : w >= 6 && r > 0.52 ? 'skytalon' : r > 0.48 ? 'saucer' : r > 0.36 ? 'sniper'
          : r > 0.24 ? 'strafer' : r > 0.12 ? 'scout' : 'seeker';
        const speed = type === 'dreadwing' ? 0.52 : type === 'skyraider' ? 0.58 : type === 'carrier' ? 0.55 : type === 'gunship' ? 0.68 : type === 'bomber' ? 0.62
          : type === 'phantom' ? 0.92 : type === 'harrier' ? 1.08 : type === 'skytalon' ? 1.12 : type === 'sniper' ? 0.58 : type === 'scout' ? 0.82 : type === 'fighter' ? 0.90 : 1.0;
        const spawnY = (type === 'carrier' || type === 'skyraider' || type === 'dreadwing') ? rand(30, 56) : rand(14, 48);
        this.spawn(type, { x: clamp(player.x * 0.4 + rand(-80, 80), -115, 115), y: spawnY, z: SPAWN_Z, speed });
        game.hud?.alert?.(type === 'dreadwing' ? '⚠ DREADWING CARRIER INBOUND' : type === 'phantom' ? '⚠ PHASE CONTACT' : type === 'skytalon' ? '⚠ SKY TALON INBOUND' : type === 'skyraider' ? '⚠ RELAY CARRIER INBOUND' : type === 'carrier' ? '⚠ CARRIER ON APPROACH' : '⚠ ELITE INBOUND', 1.4);
      }
    }

    // Progressive multi-vector ambushes: water/surface breachers, sky dive-bombers, left/right raiders & edge missile salvos!
    this._updateAmbushDirector(dt, player, proj, game);

    const wingmates = game.wingmates?.list ?? [];
    const earlyBarrage = this.difficultyWave <= 3;
    for (const w of wingmates) w.targetedBy = 0;

    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      e.age += dt;
      const p = e.mesh.position;

      /* ---- Flaming death spin-out before final catastrophic explosion! ---- */
      if (e.dying) {
        e.deathT -= dt;
        p.addScaledVector(e.deathVel, dt);
        e.deathVel.y -= 26 * dt;
        e.mesh.rotation.x += e.deathSpin.x * dt;
        e.mesh.rotation.y += e.deathSpin.y * dt;
        e.mesh.rotation.z += e.deathSpin.z * dt;
        e.smokeCd -= dt;
        if (e.smokeCd <= 0 && game?.particles) {
          e.smokeCd = 0.045;
          game.particles.fireball(p.x, p.y, p.z, e.tier === 'heavy' ? 1.15 : 0.72, 0xffaa44);
          game.particles.smoke(p.x, p.y, p.z, e.tier === 'heavy' ? 1.1 : 0.7, 0x2b201e);
        }
        if (e.deathT <= 0 || p.y < 1.5 || p.z > 24) {
          game?.finalizeEnemyDeath?.(e);
          this.remove(e);
        }
        continue;
      }

      this._updateCombatVisual(e, dt, game);
      this._assignAllyTarget(e, player, wingmates, dt);

      // ---- Curved 3D multi-vector entry trajectory (rear overtake, lateral cut-in, sky dive, spiral surround) ----
      if (e.entryMode && e.entryStart && e.entryCtrl && e.entryEnd) {
        e.entryT += dt;
        const u = clamp(e.entryT / Math.max(0.25, e.entryDur), 0, 1);
        const isRear = e.entryMode === 'rear' || e.entryMode === 'rearPincer';
        // Brisk ease-out for rear overtake surge, smoothstep for lateral/dive/helix arcs
        const k = isRear ? (1 - Math.pow(1 - u, 2.35)) : (u * u * (3 - 2 * u));
        const om = 1 - k;
        const p0 = e.entryStart, p1 = e.entryCtrl, p2 = e.entryEnd;
        const prevX = p.x;
        p.set(
          om * om * p0.x + 2 * om * k * p1.x + k * k * p2.x,
          om * om * p0.y + 2 * om * k * p1.y + k * k * p2.y,
          om * om * p0.z + 2 * om * k * p1.z + k * k * p2.z
        );
        // Analytic velocity tangent along the 3D Bezier curve for true aerospace banking & nose alignment!
        const tx = 2 * om * (p1.x - p0.x) + 2 * k * (p2.x - p1.x);
        const ty = 2 * om * (p1.y - p0.y) + 2 * k * (p2.y - p1.y);
        const tz = 2 * om * (p1.z - p0.z) + 2 * k * (p2.z - p1.z);
        if (tx * tx + ty * ty + tz * tz > 0.01) {
          if (isRear && u > 0.72) {
            // Execute dramatic combat snap-turn toward Bowie at the apex of a rear overtake!
            const turnK = (u - 0.72) / 0.28;
            _v1.set(p.x + tx * (1 - turnK) + (player.x - p.x) * turnK, p.y + ty * (1 - turnK) + (player.y - p.y) * turnK, p.z + tz * (1 - turnK) + (PLAYER_Z - p.z) * turnK);
          } else {
            _v1.set(p.x + tx, p.y + ty, p.z + tz);
          }
          e.mesh.lookAt(_v1);
          e.bankZ = damp(e.bankZ, clamp((prevX - p.x) * 3.2 + (isRear ? e.side * 0.65 : 0), -1.28, 1.28), 8, dt);
          e.mesh.rotation.z += e.bankZ;
        }
        // Cinematic flyby swoosh & slipstream ring right as rear-overtake fighters streak past Bowie's cockpit!
        if (isRear && !e.entrySwooshed && p.z < PLAYER_Z + 8) {
          e.entrySwooshed = true;
          audio.pincerPass();
          game?.particles?.ring?.(p.x, p.y, p.z + 2, { color: 0xffa654, from: 1.5, radius: 13, dur: 0.30, opacity: 0.48 });
          if (e.rank === 0) game?.hud?.alert?.('⚠ BANDITS OVERTAKING FROM BEHIND!', 1.4);
        } else if (!isRear && !e.entrySwooshed && u > 0.12 && e.rank === 0) {
          e.entrySwooshed = true;
          audio.pincerPass();
          if (e.entryMode === 'sideSweep' || e.entryMode === 'sidePincer') {
            game?.hud?.alert?.('⚠ INTERCEPTORS FROM THE FLANKS!', 1.35);
          } else if (e.entryMode === 'skyDive') {
            game?.hud?.alert?.('⚠ DIVE SQUADRON — HIGH ABOVE!', 1.35);
          } else if (e.entryMode === 'helixSurround') {
            game?.hud?.alert?.('⚠ SPIRAL ENCIRCLEMENT!', 1.4);
          }
        }
        // Keep firing fair: hold fire until inside the player's forward sightline
        if (p.z > -48 || (isRear && u < 0.78)) {
          e.fireCd = Math.max(e.fireCd, 0.38);
        }
        if (u >= 1) {
          e.entryMode = null;
          e.x0 = p.x;
          e.y0 = p.y;
          e.rollBurst = 0.38;
          e.rollDir = e.side || 1;
        }
        this._updateMarker(e, player, game);
        if (e.flash > 0) {
          e.flash -= dt;
          if (e.flash <= 0) this._setFlash(e, false);
        }
        continue;
      }

      // ---- Close-quarters dogfight pacing & aggressive sweet-spot linger ----
      // Standard fighters surge briskly from SPAWN_Z (-310) straight into close
      // combat (z ∈ [-102, -34]), weave aggressively across your windshield,
      // then hit afterburners to scream dramatically past the cockpit!
      let zRate = 1.0;
      const selfZ = e.type === 'seeker' || e.type === 'sniper' || e.type === 'saucer' || e.type === 'breacher' || e.type === 'valkyrie' || e.type === 'vanguard' || e.type === 'kraken' || e.type === 'wyrm' || e.type === 'scorpion';
      if (!selfZ && !e.ground && e.lingerDur > 0) {
        const sweetNear = e.tier === 'heavy' ? -56 : -34;
        const sweetFar = e.tier === 'heavy' ? -122 : -102;
        if (p.z < sweetFar) {
          // Surge rapidly into dramatic close-range engagement!
          zRate = 1.54;
        } else if (p.z <= sweetNear && e.lingerUsed < e.lingerDur) {
          e.lingering = true;
          e.lingerUsed += dt;
          // Subtle Z-breathing oscillation during dogfight linger makes fighters feel alive!
          const zWave = e.tier === 'heavy' ? 0 : Math.sin(e.age * 3.8 + e.phase) * 0.24;
          zRate = (e.tier === 'heavy' ? 0.14 : 0.20) + zWave;
        } else {
          e.lingering = false;
          // Roaring close-range flyby past the player!
          zRate = e.tier === 'heavy' ? 0.88 : 1.62;
        }
      }

      if (!selfZ) {
        p.z += scroll * dt * e.speed * zRate + (e.type === 'turret' || e.ground ? 0 : 7 * dt * zRate);
      }

      // Actively converge airborne fighters into the player's close forward sightline
      if (!e.ground && !selfZ && p.z < -36) {
        const wantX = clamp(player.x + e.flankOffset, -120, 120);
        const wantY = clamp(player.y + e.yOffset, 10, 74);
        e.x0 = damp(e.x0, wantX, e.lingering ? 0.88 : 0.58, dt);
        e.y0 = damp(e.y0, wantY, e.lingering ? 0.65 : 0.44, dt);
      }

      // Crisp muzzle-charge telegraph glint right before close-range weapons fire
      if (e.fireCd > 0 && e.fireCd < 0.28 && !e.telegraphFired && p.z > -220 && p.z < -34) {
        e.telegraphFired = true;
        if (game?.particles?.weaponTelegraph && (e.tier !== 'small' || e.type === 'drone')) {
          const tCol = e.type === 'phantom' ? 0xc088ff : e.type === 'sniper' || e.type === 'lancer' ? 0x72e0ff : 0xff9248;
          game.particles.weaponTelegraph(p.x, p.y, p.z + (e.ground ? 0 : 2.5), tCol, e.tier === 'heavy' ? 1.35 : 0.9);
        }
      } else if (e.fireCd > 0.36) {
        e.telegraphFired = false;
      }

      // Damaged enemies trail burning embers and dark smoke so every hit feels tangible!
      const hpRatio = e.hp / Math.max(1, e.maxHp);
      if (hpRatio <= 0.55 && e.maxHp > 2 && game?.particles) {
        e.smokeCd -= dt;
        if (e.smokeCd <= 0) {
          e.smokeCd = hpRatio <= 0.28 ? 0.08 : 0.16;
          game.particles.smoke(p.x + rand(-1.2, 1.2), p.y + rand(-0.6, 1.0), p.z + 2, e.tier === 'heavy' ? 0.85 : 0.5, 0x382a26);
          if (hpRatio <= 0.35) {
            game.particles.emit(p.x, p.y, p.z + 1.5, { count: 3, speed: 12, color: 0xffb84d, color2: 0xff4420, life: 0.28, size: 2.2, drag: 2.0 });
          }
        }
      }

      switch (e.type) {
        case 'drone': {
          // 8 Star Fox squadron-coordinated acrobatic maneuvers!
          const closeK = clamp((p.z + 210) / 170, 0, 1);
          const prevX = p.x, prevY = p.y;
          let targetX = p.x, targetY = p.y, bankMul = 0.20, pitchBias = 0;
          if (e.maneuver === 'corkscrew') {
            const rad = (e.amp + 10) * (0.68 + closeK * 0.56);
            const ang = e.age * 3.1 + e.phase;
            targetX = e.x0 + Math.cos(ang) * rad;
            targetY = clamp(e.y0 + Math.sin(ang) * rad * 0.62, 8, 78);
            e.mesh.rotation.z = -Math.sin(ang) * 1.15;
            bankMul = 0;
          } else if (e.maneuver === 'diveBomb') {
            // High entry → steep nose-down dive through sightline → dramatic afterburner pull-up!
            const diveArc = Math.sin(clamp((p.z + 290) / 250, 0, 1) * Math.PI);
            targetX = e.x0 + Math.sin(e.age * 1.85 + e.phase) * (e.amp + 12);
            targetY = clamp(e.y0 + 28 - diveArc * 38, 9, 82);
            pitchBias = (targetY - prevY) * 0.14;
          } else if (e.maneuver === 'scissor') {
            // Paired X-cross diagonal slice straight across the player's nose!
            const sweep = Math.cos(clamp((p.z + 280) / 245, 0, 1) * Math.PI);
            targetX = clamp(player.x * 0.35 + e.side * sweep * 96 + Math.sin(e.age * 2.2 + e.phase) * 10, -142, 142);
            targetY = clamp(e.y0 + Math.sin(e.age * 2.6 + e.phase) * 11, 9, 76);
          } else if (e.maneuver === 'barrelSwoop') {
            const u = e.age * 2.35 + e.phase;
            targetX = e.x0 + Math.sin(u) * (e.amp + 22) + Math.sin(u * 2.0) * 6;
            targetY = clamp(e.y0 + Math.cos(u * 1.45) * 12, 9, 78);
            e.rollCd -= dt;
            if (e.rollCd <= 0 && closeK > 0.25 && e.rollBurst <= 0) {
              e.rollCd = rand(1.9, 3.0);
              e.rollBurst = 0.46;
              e.rollDir = targetX >= prevX ? -1 : 1;
            }
          } else if (e.maneuver === 'figure8') {
            const u = e.age * 2.15 + e.phase;
            targetX = e.x0 + Math.sin(u) * (e.amp + 26);
            targetY = clamp(e.y0 + Math.sin(u * 2.0) * 15, 9, 78);
          } else if (e.maneuver === 'splitBreak') {
            // Crisp tight squadron approach, then dramatic starburst break-away with thruster burst!
            if (p.z > -168) {
              if (!e.splitFired) {
                e.splitFired = true;
                e.rollBurst = 0.50;
                e.rollDir = e.splitSide;
                game?.particles?.ring?.(p.x, p.y, p.z + 2, { color: 0xff9852, from: 1.5, radius: 11, dur: 0.28, opacity: 0.44 });
              }
              const breakK = clamp((p.z + 168) / 110, 0, 1);
              const flare = Math.sin(breakK * Math.PI);
              targetX = clamp(e.x0 + e.splitSide * flare * (54 + (e.rank % 3) * 12), -142, 142);
              targetY = clamp(e.y0 + ((e.rank % 2 ? 1 : -1) * flare * 20), 9, 80);
            } else {
              targetX = e.x0 + Math.sin(e.age * 1.6 + e.phase) * 5;
              targetY = clamp(e.y0 + Math.cos(e.age * 1.6 + e.phase) * 3, 10, 76);
            }
          } else if (e.maneuver === 'skimmer') {
            // Low-altitude deck skimmer popping into a sudden high-G ambush climb!
            const popUp = clamp((p.z + 122) / 76, 0, 1);
            targetX = e.x0 + Math.sin(e.age * 2.5 + e.phase) * (e.amp + 18);
            targetY = clamp(10 + popUp * 34 + Math.sin(e.age * 4.2 + e.phase) * 2.5, 8.5, 78);
          } else {
            // 'stalker' — close-range lateral feint across the player's crosshairs!
            const feint = Math.sin(e.age * 2.7 + e.phase) + Math.sin(e.age * 5.2 + e.phase) * 0.35;
            targetX = clamp(e.x0 + feint * (e.amp + 20) + e.side * (1 - closeK) * 24, -142, 142);
            targetY = clamp(player.y + Math.sin(e.age * 2.9 + e.phase) * 11, 9, 76);
          }
          p.x = damp(p.x, targetX, 5.2, dt);
          p.y = damp(p.y, targetY, 4.6, dt);
          if (bankMul > 0) {
            e.bankZ = damp(e.bankZ, clamp((prevX - p.x) * 3.8, -1.25, 1.25), 7, dt);
            e.mesh.rotation.z = e.bankZ;
          }
          e.mesh.rotation.x = damp(e.mesh.rotation.x, clamp((p.y - prevY) * 1.6 + pitchBias, -0.58, 0.58), 6, dt);
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -250 && p.z < -28) {
            e.fireCd = earlyBarrage ? rand(0.95, 1.48) : rand(1.25, 2.05);
            const atk = e.attackIdx++ % 3;
            if (atk === 0) {
              this._aimedShot(e, player, proj, 'orb');
              if ((earlyBarrage && Math.random() < 0.34) || (this.difficultyWave >= 5 && Math.random() < 0.42)) {
                this._scheduleShot(earlyBarrage ? 0.135 : 0.15, () => e.alive && !e.dying && this._aimedShot(e, player, proj, 'orb', earlyBarrage ? 0.85 : 1.05));
              }
            } else if (atk === 1) {
              // Tight 3-way V-spread plasma orb salvo!
              this._fireFan(e, player, proj, 'orb', 3, 18, 0);
            } else {
              // Twin converging wing-bolt cross-shot!
              for (const s of [-1, 1]) {
                _v2.set(p.x + s * 4.5, p.y, p.z + 1);
                _v1.set(player.x - s * 8, player.y, PLAYER_Z).sub(_v2);
                proj.fireEnemy(_v2.clone(), _v1.clone(), 'bolt');
              }
            }
          }
          break;
        }
        case 'relaydrone': {
          const closeK = clamp((p.z + 185) / 145, 0, 1);
          const ang = e.age * 2.75 + e.phase;
          const prevX = p.x;
          p.x = e.x0 + Math.sin(ang) * (e.amp + 18) * (0.85 + closeK * 0.25);
          p.y = clamp(e.y0 + Math.sin(ang * 2) * 10.5, 9, 76);
          e.mesh.rotation.y += dt * 2.6;
          e.mesh.rotation.z = clamp((prevX - p.x) * 2.6 + Math.cos(ang) * 0.45, -1.1, 1.1);
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -250 && p.z < -28) {
            e.fireCd = rand(1.3, 1.95);
            const atk = e.attackIdx++ % 3;
            if (atk === 0) {
              this._aimedShot(e, player, proj, 'plasma');
              this._scheduleShot(0.14, () => e.alive && !e.dying && this._aimedShot(e, player, proj, 'plasma'));
            } else if (atk === 1) {
              // Counter-twisting emerald DNA helix laser pair!
              this._fireHelixPair(e, player, proj);
            } else {
              // 4-point diamond plasma relay pulse!
              this._fireRadialRing(e, proj, 'plasma', 4, 24, 52, Math.PI * 0.25);
            }
          }
          break;
        }
        case 'lancer': {
          // Razor wing-over slash cutting diagonally across the nose, snapping a full roll on pull-out!
          const enter = clamp(e.age * 0.92, 0, 1);
          const prevX = p.x, prevY = p.y;
          const slash = Math.sin(e.age * 3.1 + e.phase) * (e.lingering ? 32 : 15);
          const tx = e.side * 126 * (1 - enter) + e.x0 * enter + slash;
          const ty = clamp(e.y0 + Math.cos(e.age * 2.4 + e.phase) * 12.5, 9, 76);
          p.x = damp(p.x, tx, 5.4, dt);
          p.y = damp(p.y, ty, 4.8, dt);
          e.mesh.lookAt(this._targetPosition(e, player, _v1));
          e.mesh.rotation.z = clamp(-e.side * (1 - enter) * 1.05 + (prevX - p.x) * 2.8, -1.28, 1.28);
          e.mesh.rotation.x += clamp((p.y - prevY) * 0.12, -0.32, 0.32);
          e.rollCd -= dt;
          if (e.rollCd <= 0 && p.z > -160 && p.z < -40 && e.rollBurst <= 0) {
            e.rollCd = rand(2.0, 3.0);
            e.rollBurst = 0.44;
            e.rollDir = -e.side;
          }
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -245 && p.z < -28) {
            e.fireCd = earlyBarrage ? rand(1.2, 1.85) : rand(1.5, 2.3);
            const atk = e.attackIdx++ % 3;
            if (atk === 0) {
              const shots = earlyBarrage ? 2 : this.difficultyWave >= 7 ? 3 : 2;
              for (let k = 0; k < shots; k++) {
                if (k === 0) this._aimedShot(e, player, proj, 'bolt', earlyBarrage ? 1.0 : 1.25);
                else this._scheduleShot(k * 0.12, () => e.alive && !e.dying && this._aimedShot(e, player, proj, 'bolt', earlyBarrage ? 1.0 : 1.25));
              }
            } else if (atk === 1) {
              // Twin sweeping magenta boomerang arc-slicers!
              this._fireBoomerangPair(e, player, proj);
            } else {
              // Telegraphed hypersonic railgun lance!
              this._fireRailShot(e, player, proj, game);
            }
          }
          break;
        }
        case 'pod': {
          // Orbital pendulum drift + articulated armoured petals blooming wide open right before plasma ring!
          const u = e.age * 1.25 + e.phase;
          p.x = e.x0 + Math.sin(u) * 16 + Math.sin(u * 2.0) * 5;
          p.y = clamp(e.y0 + Math.cos(u * 1.5) * 8.0, 10, 74);
          const charging = e.fireCd < 0.82 && p.z > -255 && p.z < -28;
          e.podOpen = damp(e.podOpen, charging ? 1.0 : 0.0, charging ? 7.5 : 4.2, dt);
          e.mesh.rotation.y += dt * (1.85 + e.podOpen * 3.8);
          e.mesh.rotation.z = Math.sin(u) * 0.24;
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -245 && p.z < -34) {
            e.fireCd = earlyBarrage ? 1.95 : 2.25;
            const atk = e.attackIdx++ % 3;
            const spin = e.age * 0.65;
            const spokes = earlyBarrage ? 8 : this.difficultyWave >= 7 ? 10 : 8;
            if (atk === 0) {
              this._fireRadialRing(e, proj, 'plasma', spokes, 36, 36, spin);
              if (this.difficultyWave >= 3) this._aimedShot(e, player, proj, 'homing');
            } else if (atk === 1) {
              // Double-staggered counter-rotating plasma bloom!
              this._fireRadialRing(e, proj, 'plasma', 6, 32, 38, spin);
              this._scheduleShot(0.24, () => e.alive && !e.dying && this._fireRadialRing(e, proj, 'plasma', 6, 38, 42, spin + Math.PI / 6));
            } else {
              // Blooming core DNA helix + violet pursuit orb!
              this._fireHelixPair(e, player, proj);
              this._aimedShot(e, player, proj, 'pursuit');
            }
          }
          break;
        }
        case 'turret': {
          _v1.set(player.x, player.y, PLAYER_Z).sub(p);
          e.mesh.rotation.y = Math.atan2(_v1.x, _v1.z) + Math.PI;
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -270 && p.z < -34) {
            e.fireCd = earlyBarrage ? rand(1.35, 2.05) : rand(1.65, 2.45);
            const atk = e.attackIdx++ % 3;
            if (atk === 0) {
              this._aimedShot(e, player, proj, 'heavy', earlyBarrage ? 1.12 : 1.38);
              if (earlyBarrage || this.difficultyWave >= 5) this._scheduleShot(earlyBarrage ? 0.22 : 0.175, () => e.alive && !e.dying && this._aimedShot(e, player, proj, 'heavy', earlyBarrage ? 1.05 : 1.45));
            } else if (atk === 1) {
              // High-arcing parabolic mortar shell!
              this._fireMortarSalvo(e, player, proj, 2);
            } else {
              // Airburst cluster anti-air shell!
              this._aimedShot(e, player, proj, 'cluster', 0.9);
            }
          }
          break;
        }
        case 'mine': {
          const lunge = p.z > -120 ? 15.5 : 9.5;
          _v1.set(player.x, player.y, PLAYER_Z).sub(p).normalize().multiplyScalar(lunge);
          p.x += _v1.x * dt; p.y += _v1.y * dt;
          e.mesh.rotation.x += dt * 2.2; e.mesh.rotation.y += dt * 1.6;
          if (e.mesh.userData.bandA) e.mesh.userData.bandA.rotation.z += dt * 3.8;
          if (e.mesh.userData.bandB) e.mesh.userData.bandB.rotation.y -= dt * 4.4;
          const pulse = (1 + Math.sin(e.age * (p.z > -120 ? 14 : 8)) * 0.11) * e.baseScale;
          e.mesh.scale.setScalar(pulse);
          // Proximity discharge: emits a 4-spoke radial plasma shock pulse as it surges close!
          if (!e.minePulseFired && p.z > -135 && p.z < -55) {
            e.minePulseFired = true;
            game?.particles?.ring?.(p.x, p.y, p.z, { color: 0xff4068, from: 2, radius: 14, dur: 0.30, opacity: 0.55 });
            this._fireRadialRing(e, proj, 'plasma', 4, 28, 48, e.age);
          }
          _v2.set(player.x, player.y, PLAYER_Z);
          if (p.distanceTo(_v2) < 8.5 && player.invuln <= 0 && !player.rolling) {
            game.explodeAt(p, false);
            const mineDmg = Math.round(12 * (1 + (this.difficultyWave - 1) * 0.10));
            const minePan = clamp((p.x - player.x) / 14, -0.82, 0.82);
            game.damagePlayer(mineDmg, 'mine', { pan: minePan });
            this.kill(e, false);
            continue;
          }
          break;
        }
        case 'ray': {
          // Sweeping manta dive-and-flare figure-8 with steep wing-vertical knife turns!
          const u = e.age * 1.95 + e.phase;
          const prevX = p.x, prevY = p.y;
          const tx = e.x0 + Math.sin(u) * (e.amp + 28);
          const ty = clamp(e.y0 + Math.sin(u * 2.0) * 14.5 + Math.cos(u * 0.7) * 5, 8.5, 78);
          p.x = damp(p.x, tx, 4.8, dt);
          p.y = damp(p.y, ty, 4.2, dt);
          e.bankZ = damp(e.bankZ, clamp((prevX - p.x) * 3.6, -1.22, 1.22), 6.5, dt);
          e.mesh.rotation.z = e.bankZ;
          e.mesh.rotation.x = damp(e.mesh.rotation.x, clamp((p.y - prevY) * 1.5, -0.52, 0.52), 5.5, dt);
          if (e.mesh.userData.body) e.mesh.userData.body.rotation.x = Math.sin(e.age * 8.5) * 0.28;
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -195 && p.z < -34) {
            e.fireCd = rand(1.75, 2.55);
            const atk = e.attackIdx++ % 3;
            if (atk === 0) this._fireHelixPair(e, player, proj);
            else if (atk === 1) {
              this._aimedShot(e, player, proj, 'torpedo', 0.95);
              this._scheduleShot(0.18, () => e.alive && !e.dying && this._aimedShot(e, player, proj, 'plasma', 0.9));
            } else this._fireFan(e, player, proj, 'wave', 3, 24, 0);
          }
          break;
        }
        case 'gunship': {
          // Commanding banked broadside S-turns closing aggressively into flank firing arcs!
          if (!e.wp) { e.wp = new THREE.Vector3(); e.wpT = 0; }
          e.wpT -= dt;
          if (e.wpT <= 0) {
            e.wpT = rand(1.8, 2.7);
            e.side = -e.side;
            e.wp.set(clamp(player.x + e.side * rand(32, 72), -125, 125), clamp(player.y + rand(-10, 18), 14, 72), clamp(p.z, -145, -60));
          }
          const prevX = p.x;
          p.x = damp(p.x, e.wp.x, 1.35, dt);
          p.y = damp(p.y, e.wp.y, 1.25, dt);
          e.mesh.lookAt(this._targetPosition(e, player, _v1));
          e.bankZ = damp(e.bankZ, clamp((prevX - p.x) * 2.2, -0.45, 0.45), 4, dt);
          e.mesh.rotation.z = e.bankZ;
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -270 && p.z < -30) {
            e.fireCd = rand(1.45, 2.15);
            const atk = e.attackIdx++ % 3;
            if (atk === 0) {
              for (const s of [1, -1]) {
                _v2.set(p.x + s * 4.8, p.y, p.z);
                _v1.set(player.x, player.y, PLAYER_Z).sub(_v2);
                proj.fireEnemy(_v2.clone(), _v1.clone(), 'heavy');
              }
            } else if (atk === 1) {
              // Airburst cluster cannon + 3-way venom spread!
              this._aimedShot(e, player, proj, 'cluster', 0.9);
              this._fireFan(e, player, proj, 'venom', 3, 22, 0);
            } else {
              // Twin wing-pod curving swarm missiles!
              this._fireSwarmFan(e, player, proj, this.difficultyWave >= 8 ? 3 : 2, 34);
            }
          }
          break;
        }
        case 'seeker': {
          // 3-phase predatory dogfighter: close nose-dive → barrel-roll breakaway → high Yo-Yo flank!
          if (!e.wp) { e.wp = new THREE.Vector3(); e.aiState = 'dive'; e.wpT = 0; }
          e.wpT -= dt;
          if (e.wpT <= 0) {
            if (e.aiState === 'dive') {
              e.aiState = 'loop'; e.wpT = rand(0.95, 1.45);
              e.side = -e.side;
              e.rollBurst = 0.48; e.rollDir = e.side;
              e.wp.set(clamp(player.x + e.side * rand(54, 96), -145, 145), rand(36, 74), rand(-152, -104));
            } else {
              e.aiState = 'dive'; e.wpT = rand(1.15, 1.70);
              e.wp.set(player.x + rand(-20, 20), player.y + rand(-6, 12), PLAYER_Z - rand(18, 34));
            }
          }
          const acc = e.aiState === 'dive' ? 1.65 : 1.35;
          const prevX = p.x;
          p.x = damp(p.x, e.wp.x, acc, dt);
          p.y = damp(p.y, e.wp.y, acc, dt);
          p.z = damp(p.z, e.wp.z, acc * 1.15, dt);
          e.mesh.lookAt(_v1.copy(e.wp));
          e.mesh.rotation.z += clamp((prevX - p.x) * 2.2, -0.95, 0.95);
          e.fireCd -= dt;
          if (e.fireCd <= 0 && e.aiState === 'dive' && p.z > -240 && p.z < -30) {
            e.fireCd = rand(1.3, 1.95);
            const atk = e.attackIdx++ % 3;
            if (atk === 0) this._aimedShot(e, player, proj, 'homing');
            else if (atk === 1) this._fireBoomerangPair(e, player, proj);
            else {
              for (let k = 0; k < 3; k++) {
                if (k === 0) this._aimedShot(e, player, proj, 'shard', 1.15);
                else this._scheduleShot(k * 0.11, () => e.alive && !e.dying && this._aimedShot(e, player, proj, 'shard', 1.15));
              }
              if (this.difficultyWave >= 6) this._aimedShot(e, player, proj, 'pursuit');
            }
          }
          break;
        }
        case 'sniper': {
          // Tactical dart-and-lock marksman: quick lateral thruster burst, steady aim-lock, then instant sidestep!
          if (!e.wp) { e.wp = new THREE.Vector3(p.x, p.y, p.z); e.wpT = 0; }
          const tooClose = p.z > PLAYER_Z - 64;
          const locking = e.fireCd < 0.65 && p.z > -250 && p.z < -42 && !tooClose;
          e.wpT -= dt;
          if ((e.wpT <= 0 && !locking) || tooClose) {
            e.wpT = rand(1.5, 2.4);
            e.side = -e.side;
            const targetZ = tooClose ? rand(-155, -110) : rand(-168, -92);
            e.wp.set(clamp(player.x + e.side * rand(38, 86), -140, 140), clamp(player.y + rand(-12, 26), 14, 72), targetZ);
          }
          const moveSpd = tooClose ? 3.2 : locking ? 0.45 : 2.3;
          p.x = damp(p.x, e.wp.x, moveSpd, dt);
          p.y = damp(p.y, e.wp.y, moveSpd, dt);
          p.z = damp(p.z, e.wp.z, tooClose ? 3.2 : 1.6, dt);
          if (e.mesh.userData.ring) e.mesh.userData.ring.rotation.z += dt * (locking ? 6.8 : 1.9);
          e.mesh.lookAt(this._targetPosition(e, player, _v1));
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -250 && p.z < -42 && !tooClose) {
            e.fireCd = rand(1.75, 2.55);
            e.wpT = 0.25; // immediately dart to new sniping perch after firing!
            const atk = e.attackIdx++ % 3;
            if (atk === 0) {
              const shots = this.difficultyWave >= 8 ? 3 : 2;
              for (let k = 0; k < shots; k++) {
                if (k === 0) this._aimedShot(e, player, proj, 'bolt', 1.05);
                else this._scheduleShot(k * 0.125, () => e.alive && !e.dying && this._aimedShot(e, player, proj, 'bolt', 1.05));
              }
            } else if (atk === 1) {
              // Signature hypersonic telegraphed Railgun Snipe!
              this._fireRailShot(e, player, proj, game);
            } else {
              // Double framing shards + rail follow-up!
              this._fireFan(e, player, proj, 'shard', 2, 22, 0);
              this._scheduleShot(0.22, () => e.alive && !e.dying && this._fireRailShot(e, player, proj, game));
            }
          }
          break;
        }
        case 'strafer': {
          // High-G lateral strafer executing crisp split-S zigzags & periodic barrel-rolls!
          if (!e.wp) { e.wp = new THREE.Vector3(); e.wpT = 0; }
          e.wpT -= dt;
          if (e.wpT <= 0) {
            e.wpT = rand(0.85, 1.35);
            e.side = -e.side;
            e.wp.set(clamp(player.x + e.side * rand(36, 98), -145, 145), clamp(player.y + rand(-14, 28), 12, 76), p.z);
            if (Math.random() < 0.35 && e.rollBurst <= 0) { e.rollBurst = 0.44; e.rollDir = e.side; }
          }
          const prevX = p.x;
          p.x = damp(p.x, e.wp.x, 1.85, dt);
          p.y = damp(p.y, e.wp.y, 1.45, dt);
          e.mesh.lookAt(this._targetPosition(e, player, _v1));
          e.mesh.rotation.z = clamp((p.x - prevX) * -5.8, -1.22, 1.22);
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -260 && p.z < -34) {
            e.fireCd = rand(1.35, 2.0);
            const atk = e.attackIdx++ % 3;
            if (atk === 0) {
              // Sweeping 4-round diagonal strafing ribbon!
              const sweepDir = e.side;
              for (let k = 0; k < 4; k++) {
                this._scheduleShot(k * 0.085, () => {
                  if (!e.alive || e.dying) return;
                  const lead = (k - 1.5) * 14 * sweepDir;
                  _v1.set(player.x + lead, player.y + (k - 1.5) * 3, PLAYER_Z).sub(p);
                  proj.fireEnemy(p.clone(), _v1.clone(), 'bolt');
                });
              }
            } else if (atk === 1) {
              this._fireBoomerangPair(e, player, proj);
            } else {
              this._aimedShot(e, player, proj, 'shard', 1.2);
              this._scheduleShot(0.14, () => e.alive && !e.dying && this._aimedShot(e, player, proj, 'swarm', 1.0));
            }
          }
          break;
        }
        case 'bomber': {
          const u = e.age * 0.65 + e.phase;
          const prevX = p.x;
          p.x = e.x0 + Math.sin(u) * 26;
          p.y = clamp(e.y0 + Math.sin(u * 1.4) * 6.5, 16, 76);
          e.mesh.rotation.y = Math.sin(u * 0.6) * 0.16;
          e.mesh.rotation.z = clamp((prevX - p.x) * 1.8, -0.32, 0.32);
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -260 && p.z < -38) {
            e.fireCd = rand(2.0, 2.85);
            const atk = e.attackIdx++ % 3;
            if (atk === 0) {
              this._fireFan(e, player, proj, 'plasma', 3, 22, 0);
              this._aimedShot(e, player, proj, 'wave');
            } else if (atk === 1) {
              // Twin airburst cluster bomb drop!
              for (const s of [-1, 1]) {
                _v2.set(p.x + s * 6, p.y - 2, p.z);
                _v1.set(player.x + s * 16, player.y, PLAYER_Z).sub(_v2);
                proj.fireEnemy(_v2.clone(), _v1.clone(), 'cluster');
              }
            } else {
              // Parabolic mortar barrage + high-wave superwave!
              this._fireMortarSalvo(e, player, proj, 3);
              if (this.difficultyWave >= 8) this._aimedShot(e, player, proj, 'superwave');
            }
          }
          break;
        }
        case 'flak': {
          const head = e.mesh.userData.head;
          _v1.set(player.x, player.y, PLAYER_Z).sub(p);
          if (head) head.rotation.y = damp(head.rotation.y, Math.atan2(_v1.x, _v1.z) + Math.PI, 4, dt);
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -280 && p.z < -28) {
            e.fireCd = rand(1.9, 2.7);
            const atk = e.attackIdx++ % 3;
            if (atk === 0) {
              const shots = this.difficultyWave >= 8 ? 3 : 2;
              for (let k = 0; k < shots; k++) {
                if (k === 0) this._aimedShot(e, player, proj, 'flak', 1.3);
                else this._scheduleShot(k * 0.17, () => e.alive && !e.dying && this._aimedShot(e, player, proj, 'flak', 1.3));
              }
            } else if (atk === 1) {
              // Airburst anti-air cluster shell!
              this._aimedShot(e, player, proj, 'cluster', 1.0);
            } else {
              // 3-shell staggered flak wall across flight corridor!
              this._fireFan(e, player, proj, 'flak', 3, 22, 0);
            }
          }
          break;
        }
        case 'aabattery': {
          const head = e.mesh.userData.head;
          const radar = e.mesh.userData.radar;
          const sensorMat = e.mesh.userData.sensorMat;
          _v1.copy(this._targetPosition(e, player, _v1)).sub(p);
          if (head) {
            head.rotation.y = damp(head.rotation.y, Math.atan2(_v1.x, _v1.z) + Math.PI, 3.2, dt);
            const pitch = clamp(Math.atan2(_v1.y, Math.hypot(_v1.x, _v1.z)) * 0.42, -0.26, 0.28);
            head.rotation.x = damp(head.rotation.x, pitch, 2.8, dt);
          }
          if (radar) radar.rotation.z += dt * (1.35 + (e.fireCd < 0.48 ? 3.8 : 0));
          if (sensorMat?.emissive) sensorMat.emissiveIntensity = e.fireCd < 0.48 ? 2.35 : 1.25 + Math.sin(e.age * 3.2) * 0.16;
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -290 && p.z < -30) {
            e.fireCd = rand(2.4, 3.3);
            const muzzle = e.mesh.userData.muzzle;
            const origin = muzzle ? muzzle.getWorldPosition(_v2).clone() : p.clone().add(new THREE.Vector3(0, 9, -5));
            const atk = e.attackIdx++ % 3;
            if (atk === 0) {
              const shots = this.difficultyWave >= 8 ? 3 : 2;
              for (let k = 0; k < shots; k++) {
                if (k === 0) this._aimedShot(e, player, proj, 'flak', 1.4, origin);
                else this._scheduleShot(k * 0.19, () => e.alive && !e.dying && this._aimedShot(e, player, proj, 'flak', 1.4, origin));
              }
            } else if (atk === 1) {
              // Twin airburst anti-air cluster shells!
              this._fireFan(e, player, proj, 'cluster', 2, 22, 0, origin);
            } else {
              // Side-cell SAM curving swarm missile launch!
              this._fireSwarmFan(e, player, proj, 3, 32, origin);
            }
          }
          break;
        }
        case 'hovertank': {
          // Snappy hover-jet lateral strafe bursts with realistic chassis banking!
          const prevX = p.x;
          const burst = Math.sin(e.age * 0.95 + e.phase) + Math.sin(e.age * 2.1 + e.phase) * 0.35;
          p.x = e.x0 + burst * (e.amp + 12);
          p.y = e.y0 + Math.sin(e.age * 3.4) * 0.65;
          e.mesh.rotation.z = clamp((prevX - p.x) * 1.4, -0.24, 0.24);
          const turret = e.mesh.userData.turret;
          if (turret) { _v1.set(player.x, player.y, PLAYER_Z).sub(p); turret.rotation.y = damp(turret.rotation.y, Math.atan2(_v1.x, _v1.z) + Math.PI, 5, dt); }
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -280 && p.z < -28) {
            e.fireCd = rand(1.75, 2.45);
            const atk = e.attackIdx++ % 3;
            if (atk === 0) {
              for (let k = -1; k <= 1; k += 2) { _v1.set(player.x + k * 18, player.y, PLAYER_Z).sub(p); proj.fireEnemy(p.clone(), _v1.clone(), 'heavy'); }
            } else if (atk === 1) {
              // Parabolic hover-artillery mortar pair!
              this._fireMortarSalvo(e, player, proj, 2);
            } else {
              // Rapid 3-way horizontal bolt suppression fan!
              this._fireFan(e, player, proj, 'bolt', 3, 20, 0);
            }
          }
          break;
        }
        case 'launcher': {
          const rack = e.mesh.userData.rack;
          if (rack) rack.rotation.z = Math.sin(e.age * 1.5) * 0.12;
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -280 && p.z < -28) {
            e.fireCd = rand(2.7, 3.6);
            const atk = e.attackIdx++ % 3;
            const origin = new THREE.Vector3(p.x, p.y + 3.5, p.z);
            if (atk === 0) {
              const missiles = this.difficultyWave >= 8 ? 3 : 2;
              for (let k = 0; k < missiles; k++) this._scheduleShot(k * 0.22, () => {
                if (!e.alive || e.dying) return;
                _v2.set(p.x + rand(-2, 2), p.y + 3, p.z);
                _v1.set(player.x, player.y, PLAYER_Z).sub(_v2);
                proj.fireEnemy(_v2.clone(), _v1.clone(), 'missile');
              });
            } else if (atk === 1) {
              // 4-pod Macross curving swarm fan!
              this._fireSwarmFan(e, player, proj, 4, 34, origin);
            } else {
              // Twin violet pursuit seeker orbs!
              this._fireFan(e, player, proj, 'pursuit', 2, 34, 8, origin);
            }
          }
          break;
        }
        case 'saucer': {
          // Erratic anti-gravity UFO snap-darts & abrupt tilt-hovers!
          if (!e.wp) { e.wp = new THREE.Vector3(p.x, p.y, p.z); e.wpT = 0; }
          e.wpT -= dt;
          if (e.wpT <= 0) {
            e.wpT = rand(0.62, 1.25);
            e.wp.set(clamp(player.x + rand(-108, 108), -145, 145), rand(14, 74), rand(-165, -52));
          }
          const prevX = p.x, prevY = p.y;
          p.x = damp(p.x, e.wp.x, 2.85, dt);
          p.y = damp(p.y, e.wp.y, 2.65, dt);
          p.z = damp(p.z, e.wp.z, 2.1, dt);
          e.mesh.rotation.y += dt * 3.2;
          e.mesh.rotation.z = clamp((prevX - p.x) * 1.8, -0.45, 0.45);
          e.mesh.rotation.x = clamp((p.y - prevY) * 1.1, -0.32, 0.32);
          if (e.mesh.userData.lights) e.mesh.userData.lights.rotation.y -= dt * 6.5;
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -230 && p.z < -42) {
            e.fireCd = rand(1.6, 2.35);
            const atk = e.attackIdx++ % 3;
            if (atk === 0) {
              this._aimedShot(e, player, proj, 'wave');
              if (this.difficultyWave >= 6) this._aimedShot(e, player, proj, 'plasma');
            } else if (atk === 1) {
              this._fireHelixPair(e, player, proj);
            } else {
              // Spinning UFO 6-spoke plasma ring + violet pursuit orb!
              this._fireRadialRing(e, proj, 'plasma', 6, 34, 44, e.age);
              this._aimedShot(e, player, proj, 'pursuit');
            }
          }
          break;
        }
        case 'carrier': {
          const prevX = p.x;
          p.x = e.x0 + Math.sin(e.age * 0.36 + e.phase) * 22;
          p.y = e.y0 + Math.sin(e.age * 0.58) * 4.5;
          e.mesh.rotation.z = clamp((prevX - p.x) * 1.6, -0.22, 0.22);
          e.launchCd = (e.launchCd ?? rand(1.8, 3.2)) - dt;
          if (e.launchCd <= 0 && p.z > -270 && p.z < -65) {
            e.launchCd = rand(7.0, 9.8);
            for (let k = 0; k < (this.difficultyWave >= 9 ? 2 : 1); k++) this.spawn('drone', { x: p.x + rand(-8, 8), y: Math.max(8, p.y - 4), z: p.z - 8, speed: 1.05, maneuver: 'splitBreak', splitSide: k ? 1 : -1 });
            game.hud?.alert?.('⚠ FIGHTERS LAUNCHED', 1.2);
          }
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -265 && p.z < -45) {
            e.fireCd = rand(1.7, 2.5);
            const atk = e.attackIdx++ % 3;
            if (atk === 0) this._fireFan(e, player, proj, 'heavy', 2, 18, 0);
            else if (atk === 1) this._fireSwarmFan(e, player, proj, 3, 34);
            else {
              this._aimedShot(e, player, proj, 'cluster', 0.95);
              this._aimedShot(e, player, proj, 'wave', 1.0);
            }
          }
          break;
        }
        case 'skyraider': {
          const prevX = p.x;
          p.x = e.x0 + Math.sin(e.age * 0.32 + e.phase) * 24;
          p.y = e.y0 + Math.sin(e.age * 0.62) * 5.2;
          e.mesh.rotation.z = clamp((prevX - p.x) * 1.6, -0.22, 0.22);
          e.launchCd = (e.launchCd ?? rand(1.8, 3.4)) - dt;
          if (e.launchCd <= 0 && p.z > -270 && p.z < -65) {
            e.launchCd = rand(7.5, 10.5);
            for (let k = 0; k < (this.difficultyWave >= 10 ? 2 : 1); k++) this.spawn('relaydrone', { x: p.x + rand(-10, 10), y: Math.max(10, p.y - 5), z: p.z - 10, speed: 1.05 });
            game.hud?.alert?.('⚠ RELAY DRONES LAUNCHED', 1.2);
          }
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -265 && p.z < -45) {
            e.fireCd = rand(1.8, 2.6);
            const atk = e.attackIdx++ % 3;
            if (atk === 0) {
              this._aimedShot(e, player, proj, 'heavy', 1.25);
              this._aimedShot(e, player, proj, 'plasma');
            } else if (atk === 1) {
              this._fireHelixPair(e, player, proj);
              this._fireSwarmFan(e, player, proj, 2, 34);
            } else {
              this._aimedShot(e, player, proj, 'cluster', 0.95);
              this._aimedShot(e, player, proj, 'pursuit');
            }
          }
          break;
        }
        case 'scout': {
          // Darting recon orbiter that circles the corridor with crisp hover pauses!
          if (!e.wp) { e.wp = new THREE.Vector3(p.x, p.y, p.z); e.wpT = 0; }
          e.wpT -= dt;
          if (e.wpT <= 0) {
            e.wpT = rand(1.3, 2.2);
            e.side = -e.side;
            e.wp.set(clamp(player.x + e.side * rand(38, 86), -145, 145), clamp(player.y + rand(-10, 28), 12, 74), p.z);
          }
          const prevX = p.x;
          p.x = damp(p.x, e.wp.x, 1.95, dt);
          p.y = damp(p.y, e.wp.y, 1.65, dt);
          e.mesh.rotation.y += dt * 1.45;
          e.mesh.rotation.z = clamp((prevX - p.x) * 2.2, -0.58, 0.58);
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -260 && p.z < -36) {
            e.fireCd = rand(1.5, 2.25);
            const atk = e.attackIdx++ % 3;
            if (atk === 0) {
              this._aimedShot(e, player, proj, 'orb');
              this._scheduleShot(0.14, () => e.alive && !e.dying && this._aimedShot(e, player, proj, 'orb'));
            } else if (atk === 1) this._fireFan(e, player, proj, 'shard', 3, 18, 0);
            else this._aimedShot(e, player, proj, 'homing');
          }
          break;
        }
        case 'fighter':
        case 'skytalon': {
          // Ace close-quarters dogfighters: high-G scissor reversals, Yo-Yo dives & snap barrel-rolls!
          if (!e.wp) { e.wp = new THREE.Vector3(p.x, p.y, p.z); e.wpT = 0; }
          e.wpT -= dt;
          if (e.wpT <= 0) {
            e.wpT = rand(0.82, 1.38);
            e.side = -e.side;
            const highYoYo = Math.random() < 0.42;
            e.wp.set(
              clamp(player.x + e.side * rand(30, 86), -142, 142),
              clamp(player.y + (highYoYo ? rand(18, 34) : rand(-14, 14)), 10, 78),
              p.z
            );
            if (Math.random() < 0.45 && e.rollBurst <= 0) { e.rollBurst = 0.44; e.rollDir = e.side; }
          }
          const pvx = p.x, pvy = p.y;
          p.x = damp(p.x, e.wp.x, e.type === 'skytalon' ? 2.85 : 2.25, dt);
          p.y = damp(p.y, e.wp.y, e.type === 'skytalon' ? 2.35 : 1.95, dt);
          e.mesh.lookAt(this._targetPosition(e, player, _v1));
          e.mesh.rotation.z = clamp((p.x - pvx) * -6.2, -1.28, 1.28);
          e.mesh.rotation.x += clamp((p.y - pvy) * 0.14, -0.35, 0.35);
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -255 && p.z < -28) {
            e.fireCd = e.type === 'skytalon' ? rand(1.55, 2.25) : rand(1.4, 2.05);
            const atk = e.attackIdx++ % 3;
            if (atk === 0) {
              const shots = e.type === 'skytalon' ? 3 : 2;
              for (let k = 0; k < shots; k++) {
                if (k === 0) this._aimedShot(e, player, proj, 'bolt', e.type === 'skytalon' ? 1.15 : 1.08);
                else this._scheduleShot(k * 0.14, () => e.alive && !e.dying && this._aimedShot(e, player, proj, 'bolt', e.type === 'skytalon' ? 1.15 : 1.08));
              }
            } else if (atk === 1) {
              this._fireHelixPair(e, player, proj);
            } else if (e.type === 'skytalon') {
              this._fireRailShot(e, player, proj, game);
              this._scheduleShot(0.20, () => e.alive && !e.dying && this._fireBoomerangPair(e, player, proj));
            } else {
              this._aimedShot(e, player, proj, 'swarm');
              this._fireBoomerangPair(e, player, proj);
            }
          }
          break;
        }
        case 'harrier': {
          // Steep plunge-dive → snap-roll break → diagonal climb reversal!
          if (!e.wp) { e.wp = new THREE.Vector3(p.x, p.y, p.z); e.wpT = 0; }
          e.wpT -= dt;
          if (e.wpT <= 0) {
            e.wpT = rand(0.75, 1.25);
            const dive = p.y > player.y + 8;
            e.side = -e.side;
            if (!dive && e.rollBurst <= 0) { e.rollBurst = 0.42; e.rollDir = e.side; }
            e.wp.set(clamp(player.x + e.side * rand(22, 62), -136, 136), clamp(dive ? player.y + rand(-6, 6) : player.y + rand(20, 42), 11, 80), p.z);
          }
          const oldX = p.x, oldY = p.y;
          p.x = damp(p.x, e.wp.x, 2.75, dt);
          p.y = damp(p.y, e.wp.y, 2.75, dt);
          e.mesh.lookAt(this._targetPosition(e, player, _v1));
          e.mesh.rotation.x = clamp((p.y - oldY) * 0.18, -0.68, 0.68);
          e.mesh.rotation.z = clamp((oldX - p.x) * 5.2, -1.25, 1.25);
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -255 && p.z < -30) {
            e.fireCd = rand(1.4, 2.05);
            const atk = e.attackIdx++ % 3;
            if (atk === 0) {
              for (let k = -1; k <= 1; k++) {
                if (k === -1) this._aimedShot(e, player, proj, 'shard', 1.2);
                else this._scheduleShot((k + 1) * 0.105, () => e.alive && !e.dying && this._aimedShot(e, player, proj, 'shard', 1.2));
              }
            } else if (atk === 1) {
              this._fireBoomerangPair(e, player, proj);
            } else {
              this._aimedShot(e, player, proj, 'cluster', 0.95);
              this._aimedShot(e, player, proj, 'swarm', 1.0);
            }
          }
          break;
        }
        case 'phantom': {
          // Teleporting Phase-Blink Assassin: violet warp ring telegraph + micro phase-shrink blink!
          e.dashCd -= dt;
          if (e.dashCd <= 0 && p.z > -235 && p.z < -42) {
            e.dashCd = rand(1.9, 2.8);
            const dashDir = p.x > player.x ? -1 : 1;
            game?.particles?.weaponTelegraph?.(p.x, p.y, p.z, 0xb886ff, 1.5);
            game?.particles?.ring?.(p.x, p.y, p.z, { color: 0xb886ff, from: 2.0, radius: 16, dur: 0.30, opacity: 0.55 });
            e.x0 = clamp(e.x0 + dashDir * rand(38, 58), -138, 138);
            e.y0 = clamp(e.y0 + rand(-14, 16), 12, 72);
            e.phaseBlinkT = 0.28;
            e.evadeT = 0.42;
            e.evadeDir = dashDir;
            e.evadeSpin = dashDir * TAU;
          }
          if (e.phaseBlinkT > 0) e.phaseBlinkT = Math.max(0, e.phaseBlinkT - dt);
          const stride = Math.sin(e.age * 3.0 + e.phase);
          p.x = damp(p.x, e.x0 + stride * (e.amp + 26), e.phaseBlinkT > 0 ? 11.0 : 4.8, dt);
          p.y = damp(p.y, clamp(e.y0 + Math.cos(e.age * 2.2 + e.phase) * 11, 10, 76), 5.0, dt);
          const blinkPinch = e.phaseBlinkT > 0 ? (1 - Math.sin((e.phaseBlinkT / 0.28) * Math.PI) * 0.42) : 1;
          e.baseScale = (e.mesh.userData.meshScale ?? 1) * blinkPinch * (0.95 + (Math.sin(e.age * 8) + 1) * 0.04);
          e.mesh.rotation.z = Math.cos(e.age * 3.0 + e.phase) * 0.62;
          e.mesh.lookAt(this._targetPosition(e, player, _v1));
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -255 && p.z < -30) {
            e.fireCd = rand(1.65, 2.35);
            const atk = e.attackIdx++ % 3;
            if (atk === 0) {
              this._aimedShot(e, player, proj, 'homing', 1.1);
              this._scheduleShot(0.16, () => e.alive && !e.dying && this._aimedShot(e, player, proj, 'venom', 1.05));
            } else if (atk === 1) {
              // Twin violet pursuit phase seekers!
              this._fireFan(e, player, proj, 'pursuit', 2, 34, 6);
            } else {
              // 5-way venom ambush fan + curving boomerang slicers!
              this._fireFan(e, player, proj, 'venom', 5, 16, 0);
              this._fireBoomerangPair(e, player, proj);
            }
          }
          break;
        }
        case 'dreadwing': {
          const prevX = p.x;
          p.x = e.x0 + Math.sin(e.age * 0.34 + e.phase) * 28;
          p.y = e.y0 + Math.sin(e.age * 0.48) * 6.5;
          e.mesh.rotation.z = clamp((prevX - p.x) * 1.4, -0.22, 0.22);
          e.launchCd = (e.launchCd ?? rand(2.2, 4.0)) - dt;
          if (e.launchCd <= 0 && p.z > -280 && p.z < -70) {
            e.launchCd = rand(8.0, 11.0);
            this.spawn('harrier', { x: p.x - 10, y: Math.max(16, p.y - 3), z: p.z - 12, speed: 1.12 });
            this.spawn('phantom', { x: p.x + 10, y: Math.max(20, p.y + 2), z: p.z - 16, speed: 0.92 });
            game.hud?.alert?.('⚠ PHASE ESCORTS DEPLOYED', 1.25);
          }
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -275 && p.z < -42) {
            e.fireCd = rand(1.85, 2.7);
            const atk = e.attackIdx++ % 3;
            if (atk === 0) {
              for (const s of [-1, 1]) {
                _v2.set(p.x + s * 8, p.y, p.z);
                _v1.set(player.x + s * 10, player.y, PLAYER_Z).sub(_v2);
                proj.fireEnemy(_v2.clone(), _v1.clone(), 'missile');
              }
              this._aimedShot(e, player, proj, 'heavy', 1.2);
            } else if (atk === 1) {
              this._fireSwarmFan(e, player, proj, 4, 34);
              this._aimedShot(e, player, proj, 'superwave');
            } else {
              this._fireFan(e, player, proj, 'pursuit', 2, 36, 8);
              this._fireFan(e, player, proj, 'cluster', 2, 24, 0);
            }
          }
          break;
        }
        case 'siegecarrier': {
          const prevX = p.x;
          p.x = e.x0 + Math.sin(e.age * 0.28 + e.phase) * 28;
          p.y = e.y0 + Math.sin(e.age * 0.48 + e.phase) * 6.0;
          e.mesh.lookAt(this._targetPosition(e, player, _v1));
          e.mesh.rotation.z = clamp((prevX - p.x) * 1.2, -0.18, 0.18);
          e.launchCd = (e.launchCd ?? rand(3.2, 4.6)) - dt;
          if (e.launchCd <= 0 && p.z > -280 && p.z < -75) {
            e.launchCd = rand(8.5, 11.5);
            this.taskForce('pincer', { x: p.x * 0.35, y: Math.max(22, p.y - 8), z: p.z - 28, count: 2 }, game);
            game.particles?.flash(p.x, p.y, p.z - 10, 1.4, 0xff744a);
            game.particles?.ring(p.x, p.y, p.z - 10, { color: 0xff744a, from: 2, radius: 28, dur: 0.42, opacity: 0.45 });
            audio.escortLaunch();
            game.hud?.alert?.('⚠ AEGIS ESCORT WAVE', 1.35);
          }
          e.fireCd -= dt;
          const bayGlow = e.mesh.userData.glow;
          const charge = clamp((0.82 - Math.max(0, e.fireCd)) / 0.82, 0, 1);
          if (bayGlow) {
            bayGlow.scale.setScalar(5.0 + charge * 3.8 + Math.sin(e.age * 20) * charge * 0.4);
            bayGlow.material.opacity = 0.68 + charge * 0.30;
          }
          if (charge > 0 && !e.siegeTelegraph && p.z > -275 && p.z < -55) {
            e.siegeTelegraph = true;
            game.particles?.muzzle(p.x, p.y, p.z - 10, 1.7, 0xffc078);
            game.particles?.ring(p.x, p.y, p.z - 10, { color: 0xff9a58, from: 1.6, radius: 15, dur: 0.72, opacity: 0.28 });
            audio.siegeCharge();
          }
          if (e.fireCd <= 0 && p.z > -270 && p.z < -55) {
            e.fireCd = rand(2.9, 3.8);
            e.siegeTelegraph = false;
            game.particles?.flash(p.x, p.y, p.z - 10, 1.25, 0xffb36a);
            game.particles?.ring(p.x, p.y, p.z - 10, { color: 0xff8a4a, from: 2.5, radius: 22, dur: 0.52, opacity: 0.42 });
            game.particles?.emit(p.x, p.y, p.z - 10, { count: 16, speed: 30, color: 0xffe2a2, color2: 0xff5a24, life: 0.42, size: 3.6, drag: 2.6, spread: 1.8 });
            const atk = e.attackIdx++ % 3;
            if (atk === 0) {
              this._siegeShot(e, player, proj, game, -1, 'heavy');
              this._scheduleShot(0.25, () => e.alive && !e.dying && this._siegeShot(e, player, proj, game, 1, 'heavy'));
              this._scheduleShot(0.52, () => e.alive && !e.dying && this._siegeShot(e, player, proj, game, 0, 'wave'));
            } else if (atk === 1) {
              // Siege Cluster + 4-missile swarm rack + Superwave!
              this._siegeShot(e, player, proj, game, 0, 'cluster');
              this._fireSwarmFan(e, player, proj, 4, 34, new THREE.Vector3(p.x, p.y + 2, p.z - 12));
              this._scheduleShot(0.45, () => e.alive && !e.dying && this._siegeShot(e, player, proj, game, 0, 'superwave'));
            } else {
              // Twin Railgun lances + violet Pursuit seekers!
              this._fireRailShot(e, player, proj, game, new THREE.Vector3(p.x - 5, p.y + 1, p.z - 12));
              this._scheduleShot(0.22, () => e.alive && !e.dying && this._fireRailShot(e, player, proj, game, new THREE.Vector3(p.x + 5, p.y + 1, p.z - 12)));
              this._fireFan(e, player, proj, 'pursuit', 2, 36, 8, new THREE.Vector3(p.x, p.y, p.z - 10));
            }
          }
          break;
        }
        case 'quadtank': {
          const prevX = p.x;
          p.x = e.x0 + Math.sin(e.age * 0.62 + e.phase) * (e.amp + 10);
          p.y = e.y0 + Math.sin(e.age * 2.8) * 0.55;
          e.mesh.rotation.z = clamp((prevX - p.x) * 1.1, -0.18, 0.18);
          _v1.set(player.x, player.y, PLAYER_Z).sub(p);
          e.mesh.rotation.y = damp(e.mesh.rotation.y, Math.atan2(_v1.x, _v1.z) + Math.PI, 2.4, dt);
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -280 && p.z < -28) {
            e.fireCd = rand(1.9, 2.75);
            const atk = e.attackIdx++ % 3;
            if (atk === 0) {
              for (let k = -1; k <= 1; k += 2) { _v2.set(player.x + k * 18, player.y, PLAYER_Z).sub(p); proj.fireEnemy(p.clone(), _v2.clone(), 'heavy'); }
            } else if (atk === 1) {
              this._fireMortarSalvo(e, player, proj, 3);
            } else {
              this._aimedShot(e, player, proj, 'cluster', 0.95);
              this._fireFan(e, player, proj, 'flak', 2, 24, 0);
            }
          }
          break;
        }
        case 'trilobite':
        case 'cannon':
        case 'shorecannon': {
          _v1.set(player.x, player.y, PLAYER_Z).sub(p);
          e.mesh.rotation.y = damp(e.mesh.rotation.y, Math.atan2(_v1.x, _v1.z) + Math.PI, 2.6, dt);
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -280 && p.z < -28) {
            const heavy = e.type === 'trilobite';
            e.fireCd = heavy ? rand(1.9, 2.7) : rand(2.0, 2.85);
            const atk = e.attackIdx++ % 3;
            if (atk === 0) {
              const shots = heavy ? (this.difficultyWave >= 9 ? 3 : 2) : 2;
              for (let k = 0; k < shots; k++) {
                if (k === 0) this._aimedShot(e, player, proj, heavy ? 'flak' : 'heavy', 1.2);
                else this._scheduleShot(k * 0.18, () => e.alive && !e.dying && this._aimedShot(e, player, proj, heavy ? 'flak' : 'heavy', 1.2));
              }
            } else if (atk === 1) {
              this._fireMortarSalvo(e, player, proj, 2);
              if (e.type === 'shorecannon') this._aimedShot(e, player, proj, 'torpedo', 0.95);
            } else {
              this._aimedShot(e, player, proj, 'cluster', 0.95);
            }
          }
          break;
        }
        case 'mech': {
          p.x = e.x0 + Math.sin(e.age * 0.36 + e.phase) * 13;
          p.y = e.y0 + Math.abs(Math.sin(e.age * 2.8)) * 1.85;
          e.mesh.rotation.z = Math.sin(e.age * 2.8) * 0.085;
          _v1.set(player.x, player.y, PLAYER_Z).sub(p);
          e.mesh.rotation.y = damp(e.mesh.rotation.y, Math.atan2(_v1.x, _v1.z) + Math.PI, 1.8, dt);
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -285 && p.z < -28) {
            e.fireCd = rand(2.4, 3.3);
            const origin = new THREE.Vector3(p.x, p.y + 6, p.z);
            const atk = e.attackIdx++ % 3;
            if (atk === 0) {
              for (let k = 0; k < 2; k++) this._scheduleShot(k * 0.22, () => {
                if (!e.alive || e.dying) return;
                _v2.set(p.x + rand(-4, 4), p.y + 6, p.z);
                _v1.set(player.x, player.y, PLAYER_Z).sub(_v2);
                proj.fireEnemy(_v2.clone(), _v1.clone(), 'missile');
              });
            } else if (atk === 1) {
              // 4-pod Macross shoulder swarm salvo!
              this._fireSwarmFan(e, player, proj, 4, 34, origin);
            } else {
              // Parabolic mortar pair + chest-mounted hypersonic Railgun!
              this._fireMortarSalvo(e, player, proj, 2, origin);
              this._fireRailShot(e, player, proj, game, origin);
            }
          }
          break;
        }
        case 'gunboat':
        case 'frigate': {
          const big = e.type === 'frigate';
          p.x = e.x0 + Math.sin(e.age * 0.26 + e.phase) * 15;
          p.y = e.y0 + Math.sin(e.age * 1.1 + e.phase) * (big ? 1.45 : 1.05);
          e.mesh.rotation.z = Math.sin(e.age * 1.1 + e.phase) * 0.075;
          e.mesh.rotation.x = Math.cos(e.age * 0.85 + e.phase) * 0.04;
          e.mesh.rotation.y = damp(e.mesh.rotation.y, Math.sin(e.age * 0.26 + e.phase) * 0.32, 1.5, dt);
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -295 && p.z < -36) {
            e.fireCd = big ? rand(1.45, 2.05) : rand(1.85, 2.55);
            const deckOrigin = new THREE.Vector3(p.x, p.y + 6, p.z);
            const atk = e.attackIdx++ % 3;
            if (atk === 0) {
              const guns = big ? 3 : 2;
              for (let k = 0; k < guns; k++) this._scheduleShot(k * 0.17, () => {
                if (!e.alive || e.dying) return;
                _v2.set(p.x + rand(-7, 7) * (big ? 1.6 : 1), p.y + 6, p.z);
                _v1.set(player.x + rand(-12, 12), player.y, PLAYER_Z).sub(_v2);
                proj.fireEnemy(_v2.clone(), _v1.clone(), big ? 'flak' : 'heavy');
              });
            } else if (atk === 1) {
              // Twin/triple water-skimming torpedo salvo!
              this._fireFan(e, player, proj, 'torpedo', big ? 3 : 2, 30, 4, deckOrigin);
            } else {
              // Naval parabolic mortar barrage + airburst cluster (Frigate adds SAM swarm + pursuit!)
              this._fireMortarSalvo(e, player, proj, big ? 3 : 2, deckOrigin);
              this._aimedShot(e, player, proj, 'cluster', 0.95, deckOrigin);
              if (big) {
                this._fireSwarmFan(e, player, proj, 3, 32, deckOrigin);
                this._aimedShot(e, player, proj, 'pursuit', 1.0, deckOrigin);
              }
            }
          }
          break;
        }
        case 'breacher': {
          // HYDRO-LEVIATHAN: erupts straight out of water/lava/sand, snaps hydrofoil wings wide open at apex, fires curving torpedoes!
          const prevX = p.x, prevY = p.y;
          const u = e.mesh.userData;
          if (u.sonarRing) u.sonarRing.rotation.z += dt * (e.age < 1.0 ? 8.5 : 3.2);
          if (e.age < 0.95) {
            // Vertical rocket breach out of the surface!
            const riseK = clamp(e.age / 0.95, 0, 1);
            p.y = damp(p.y, e.breachPeakY, 3.8, dt);
            p.x = damp(p.x, e.x0 + Math.sin(e.age * 4.0 + e.phase) * 10, 3.2, dt);
            p.z += scroll * dt * 0.24;
            e.mesh.rotation.x = damp(e.mesh.rotation.x, (1 - riseK) * 1.05, 6.5, dt);
            e.bankZ = damp(e.bankZ, Math.sin(e.age * 5.0 + e.phase) * 0.35, 5, dt);
            e.mesh.rotation.z = e.bankZ;
            e.wingFold = damp(e.wingFold, 1.0, 9.0, dt);
            if (!e.breachSplashed && p.y >= 0.5) {
              e.breachSplashed = true;
              const zid = game?.zone?.id;
              const c1 = zid === 'ember' ? 0xff7030 : zid === 'dune' ? 0xffcf70 : 0x5ef2ff;
              const c2 = zid === 'ember' ? 0xffe278 : zid === 'dune' ? 0xfff2c2 : 0xd6fcff;
              game?.particles?.ring?.(p.x, 3.5, p.z, { color: c1, from: 3.0, radius: 26, dur: 0.48, opacity: 0.68 });
              game?.particles?.emit?.(p.x, 4.5, p.z, { count: 18, speed: 38, vy: 28, color: c2, color2: c1, life: 0.52, size: 3.6, drag: 1.9, spread: 1.4 });
            }
          } else {
            // Apex wing-flare & sweeping close-range torpedo hunter!
            e.wingFold = damp(e.wingFold, 0.0, 7.5, dt);
            const targetX = clamp(player.x * 0.48 + Math.sin(e.age * 2.3 + e.phase) * 58, -138, 138);
            const targetY = clamp(player.y + 8 + Math.cos(e.age * 1.9 + e.phase) * 16, 10, 74);
            p.x = damp(p.x, targetX, 3.4, dt);
            p.y = damp(p.y, targetY, 3.0, dt);
            const zSpd = e.age > 3.6 ? (scroll * 1.48 + 34) : (p.z < -98 ? scroll * 0.85 : scroll * 0.16);
            p.z += zSpd * dt;
            e.bankZ = damp(e.bankZ, clamp((prevX - p.x) * 3.4, -1.18, 1.18), 6.0, dt);
            e.mesh.rotation.z = e.bankZ;
            e.mesh.rotation.x = damp(e.mesh.rotation.x, clamp((p.y - prevY) * 1.3, -0.45, 0.45), 5.5, dt);
          }
          if (u.wingL) { u.wingL.rotation.y = e.wingFold * 0.72; u.wingL.rotation.z = -e.wingFold * 0.48; }
          if (u.wingR) { u.wingR.rotation.y = -e.wingFold * 0.72; u.wingR.rotation.z = e.wingFold * 0.48; }
          e.fireCd -= dt;
          if (e.fireCd <= 0 && e.age > 0.85 && p.z > -245 && p.z < -26) {
            e.fireCd = rand(1.4, 2.05);
            const atk = e.attackIdx++ % 3;
            if (atk === 0) {
              this._aimedShot(e, player, proj, 'torpedo', 1.0);
              this._scheduleShot(0.16, () => e.alive && !e.dying && this._aimedShot(e, player, proj, 'bolt', 1.1));
            } else if (atk === 1) {
              // 3-way hydro-wave fan + twin curving torpedoes!
              this._fireFan(e, player, proj, 'wave', 3, 24, 0);
              this._fireFan(e, player, proj, 'torpedo', 2, 32, 6);
            } else {
              // Counter-twisting hydro-helix pair + violet pursuit seeker!
              this._fireHelixPair(e, player, proj);
              this._aimedShot(e, player, proj, 'pursuit');
            }
          }
          break;
        }
        case 'valkyrie': {
          // STRATO-VALKYRIE: plunges vertically from top of screen with tucked raptor wings, snaps open to unleash dive salvo!
          const prevX = p.x, prevY = p.y;
          const u = e.mesh.userData;
          if (u.bombCore) { u.bombCore.rotation.y += dt * 5.2; u.bombCore.rotation.x += dt * 3.4; }
          if (e.age < 1.15) {
            // Steep vertical hawk plunge from above the viewport!
            p.y = damp(p.y, e.diveTargetY, 3.6, dt);
            p.x = damp(p.x, clamp(e.x0 + Math.sin(e.age * 2.6 + e.phase) * 14, -132, 132), 2.8, dt);
            p.z += scroll * dt * 0.34;
            e.mesh.rotation.x = damp(e.mesh.rotation.x, -1.02, 7.0, dt);
            e.bankZ = damp(e.bankZ, (prevX - p.x) * 2.4, 5.5, dt);
            e.mesh.rotation.z = e.bankZ;
            e.wingFold = damp(e.wingFold, 1.0, 8.5, dt);
            e.trailCd -= dt;
            if (e.trailCd <= 0 && game?.particles) {
              e.trailCd = 0.06;
              game.particles.emit(p.x, p.y + 2, p.z, { count: 2, speed: 12, vy: 22, color: 0xffc652, color2: 0xff5a42, life: 0.28, size: 2.1, drag: 2.0 });
            }
          } else {
            // Pull-out flare, wing-snap & aggressive slash!
            e.wingFold = damp(e.wingFold, 0.0, 8.0, dt);
            const slashX = clamp(e.x0 + e.side * (e.age - 1.15) * 46, -150, 150);
            const climbY = clamp(e.diveTargetY + (e.age - 1.15) * 14 + Math.sin(e.age * 3.2) * 8, 12, 82);
            p.x = damp(p.x, slashX, 3.6, dt);
            p.y = damp(p.y, climbY, 3.2, dt);
            const zSpd = e.age > 3.4 ? (scroll * 1.55 + 38) : (p.z < -92 ? scroll * 0.85 : scroll * 0.22);
            p.z += zSpd * dt;
            e.bankZ = damp(e.bankZ, clamp((prevX - p.x) * 3.8, -1.24, 1.24), 6.2, dt);
            e.mesh.rotation.z = e.bankZ;
            e.mesh.rotation.x = damp(e.mesh.rotation.x, clamp((p.y - prevY) * 1.4, -0.45, 0.55), 5.5, dt);
          }
          if (u.wingL) { u.wingL.rotation.y = e.wingFold * 0.56; u.wingL.rotation.z = -e.wingFold * 0.42; }
          if (u.wingR) { u.wingR.rotation.y = -e.wingFold * 0.56; u.wingR.rotation.z = e.wingFold * 0.42; }
          e.fireCd -= dt;
          if (e.fireCd <= 0 && e.age > 0.72 && p.z > -245 && p.z < -26) {
            e.fireCd = rand(1.3, 1.95);
            const atk = e.attackIdx++ % 3;
            if (atk === 0) {
              this._aimedShot(e, player, proj, Math.random() < 0.65 ? 'swarm' : 'missile', 1.05);
              this._scheduleShot(0.14, () => e.alive && !e.dying && this._aimedShot(e, player, proj, 'bolt', 1.12));
              this._scheduleShot(0.28, () => e.alive && !e.dying && this._aimedShot(e, player, proj, 'bolt', 1.12));
            } else if (atk === 1) {
              // Ventral airburst cluster bomb drop + 3-way razor shard fan!
              this._aimedShot(e, player, proj, 'cluster', 0.95);
              this._fireFan(e, player, proj, 'shard', 3, 20, 0);
            } else {
              // Telegraphed hypersonic rail dive-lance + twin boomerang slicers!
              this._fireRailShot(e, player, proj, game);
              this._fireBoomerangPair(e, player, proj);
            }
          }
          break;
        }
        case 'vanguard': {
          // VANGUARD FLANK-RAIDER: slashes horizontally from far-left / far-right edges across the player's nose!
          const prevX = p.x, prevY = p.y;
          const u = e.mesh.userData;
          if (u.radar) u.radar.rotation.y += dt * 5.8;
          const crossTargetX = e.age < 2.2 ? (-e.side * 108) : (e.side * 72);
          const targetY = clamp(e.y0 + Math.sin(e.age * 2.8 + e.phase) * 16, 12, 74);
          p.x = damp(p.x, crossTargetX, 2.35, dt);
          p.y = damp(p.y, targetY, 3.2, dt);
          const zSpd = e.age > 3.5 ? (scroll * 1.52 + 36) : (scroll * 0.24);
          p.z += zSpd * dt;
          e.mesh.lookAt(this._targetPosition(e, player, _v1));
          e.bankZ = damp(e.bankZ, clamp((prevX - p.x) * 4.4, -1.24, 1.24), 6.2, dt);
          e.mesh.rotation.z = e.bankZ;
          e.mesh.rotation.x += clamp((p.y - prevY) * 0.14, -0.35, 0.35);
          e.fireCd -= dt;
          if (e.fireCd <= 0 && Math.abs(p.x) < 185 && p.z > -240 && p.z < -26) {
            e.fireCd = rand(1.25, 1.9);
            const atk = e.attackIdx++ % 3;
            if (atk === 0) {
              this._aimedShot(e, player, proj, 'bolt', 1.12);
              this._scheduleShot(0.18, () => e.alive && !e.dying && this._aimedShot(e, player, proj, this.difficultyWave >= 8 ? 'pursuit' : 'missile', 1.0));
            } else if (atk === 1) {
              // Twin sweeping boomerang arc-slicers!
              this._fireBoomerangPair(e, player, proj);
            } else {
              // 4-shot sweeping bolt ribbon + twin curving swarm missiles!
              for (let k = 0; k < 4; k++) {
                this._scheduleShot(k * 0.08, () => {
                  if (!e.alive || e.dying) return;
                  _v1.set(player.x + (k - 1.5) * 14, player.y, PLAYER_Z).sub(p);
                  proj.fireEnemy(p.clone(), _v1.clone(), 'bolt');
                });
              }
              this._fireSwarmFan(e, player, proj, 2, 34);
            }
          }
          break;
        }
        case 'kraken': {
          // ABYSSAL KRAKEN-SUB: bubbles on water surface -> explosive dolphin breach -> wave-skip dip -> 2nd cross-flank leap!
          const prevX = p.x, prevY = p.y;
          const u = e.mesh.userData;
          if (u.sonarRing) u.sonarRing.rotation.z += dt * 5.4;
          if (u.rotor) u.rotor.rotation.z += dt * 11.5;
          if (u.tentacles) {
            for (let ti = 0; ti < u.tentacles.length; ti++) {
              u.tentacles[ti].rotation.z = Math.sin(e.age * 7.2 + ti * 1.6) * 0.34;
              u.tentacles[ti].rotation.x = Math.cos(e.age * 5.4 + ti * 1.3) * 0.24;
            }
          }
          if (e.age < 0.42) {
            // Sudden bubbling water-surface sonar telegraph before bursting out!
            p.y = -24;
            p.z += scroll * dt * 0.14;
            e.popTelegraphCd -= dt;
            if (e.popTelegraphCd <= 0 && game?.particles) {
              e.popTelegraphCd = 0.14;
              game.particles.ring(p.x, 2.5, p.z, { color: 0x52f8ff, from: 2.5, radius: 22, dur: 0.34, opacity: 0.72 });
              game.particles.emit(p.x, 3.0, p.z, { count: 8, speed: 20, vy: 18, color: 0xd8fcff, color2: 0x3ad8ff, life: 0.35, size: 2.6, drag: 2.0 });
            }
          } else {
            const tRun = e.age - 0.42;
            // Two-humped dolphin wave-skip arc with a crisp ocean-kiss dip & 2nd cross-flank breach!
            let targetY, targetX;
            if (tRun < 1.15) {
              targetY = 6 + Math.sin((tRun / 1.15) * Math.PI) * 46;
              targetX = e.x0 + Math.sin(tRun * 2.2) * 18;
            } else if (tRun < 1.55) {
              // Skim right down into the ocean wave crest to trigger a huge second splash!
              targetY = 3.2;
              targetX = damp(p.x, clamp(-e.x0 * 0.4 + e.side * 22, -120, 120), 4.0, dt);
            } else if (tRun < 2.85) {
              const k = (tRun - 1.55) / 1.30;
              targetY = 5 + Math.sin(k * Math.PI) * 46;
              targetX = damp(p.x, clamp(-e.x0 * 0.75 + e.side * 46, -128, 128), 3.4, dt);
            } else {
              targetY = clamp(player.y + 8 + Math.sin(tRun * 2.5) * 12, 12, 70);
              targetX = clamp(p.x + e.side * 28 * dt, -142, 142);
            }
            p.x = damp(p.x, targetX, 4.6, dt);
            p.y = damp(p.y, targetY, 7.6, dt);
            const zSpd = e.age > 3.9 ? (scroll * 1.48 + 34) : (scroll * 0.22);
            p.z += zSpd * dt;
            e.bankZ = damp(e.bankZ, clamp((prevX - p.x) * 3.4, -1.12, 1.12), 6.0, dt);
            e.mesh.rotation.z = e.bankZ;
            e.mesh.rotation.x = damp(e.mesh.rotation.x, clamp((p.y - prevY) * 1.4, -0.78, 0.78), 5.5, dt);
            if (!e.popErupted && p.y >= 0.5) {
              e.popErupted = true;
              game?.particles?.ring?.(p.x, 3.5, p.z, { color: 0x52f8ff, from: 4, radius: 32, dur: 0.50, opacity: 0.75 });
              game?.particles?.emit?.(p.x, 4.5, p.z, { count: 22, speed: 42, vy: 32, color: 0xe2ffff, color2: 0x38d8ff, life: 0.55, size: 3.8, drag: 1.8, spread: 1.6 });
            }
            if (e.popErupted && !e.skipSplash2 && tRun > 1.05 && p.y < 11.5) {
              e.skipSplash2 = true;
              game?.particles?.ring?.(p.x, 3.0, p.z, { color: 0x72f8ff, from: 3, radius: 26, dur: 0.42, opacity: 0.68 });
              game?.particles?.emit?.(p.x, 4.0, p.z, { count: 16, speed: 34, vy: 26, color: 0xffffff, color2: 0x46e6ff, life: 0.44, size: 3.2, drag: 2.0 });
            }
          }
          e.fireCd -= dt;
          if (e.fireCd <= 0 && e.popErupted && p.y > 10 && p.z > -245 && p.z < -26) {
            e.fireCd = rand(1.35, 1.95);
            const atk = e.attackIdx++ % 3;
            if (atk === 0) {
              this._fireFan(e, player, proj, 'torpedo', 2, 30, 5);
              this._scheduleShot(0.16, () => e.alive && !e.dying && this._aimedShot(e, player, proj, 'bolt', 1.1));
            } else if (atk === 1) {
              this._fireHelixPair(e, player, proj);
              this._aimedShot(e, player, proj, 'wave');
            } else {
              this._aimedShot(e, player, proj, 'cluster', 0.95);
              this._aimedShot(e, player, proj, 'pursuit');
            }
          }
          break;
        }
        case 'silo': {
          // AEGIS POP-UP SILO TURRET: buried ground hatch tremors -> 4 blast doors swing open -> hydraulic spire shoots up & peeks!
          const u = e.mesh.userData;
          if (e.age < 0.46) {
            e.popTelegraphCd -= dt;
            if (e.popTelegraphCd <= 0 && game?.particles) {
              e.popTelegraphCd = 0.15;
              game.particles.ring(p.x, 2.2, p.z, { color: 0xffa838, from: 2.5, radius: 20, dur: 0.34, opacity: 0.68 });
              game.particles.emit(p.x, 2.6, p.z, { count: 9, speed: 22, vy: 18, color: 0xffd47a, color2: 0x8a6a4a, life: 0.36, size: 2.6, drag: 2.0 });
            }
          } else {
            if (!e.popErupted) {
              e.popErupted = true;
              game?.particles?.ring?.(p.x, 3.0, p.z, { color: 0xff9a3c, from: 3.5, radius: 24, dur: 0.44, opacity: 0.72 });
              game?.particles?.emit?.(p.x, 3.5, p.z, { count: 16, speed: 32, vy: 26, color: 0xffe49e, color2: 0x6e5a48, life: 0.48, size: 3.2, drag: 1.9 });
            }
            // Swing 4 blast-hatch doors open & telescope root/hitbox vertically upward (with tactical peek-a-boo ducking!)
            if (u.doors) {
              for (const hinge of u.doors) hinge.rotation.z = damp(hinge.rotation.z, 1.18, 7.5, dt);
            }
            const crouch = e.age > 1.7 && Math.sin((e.age - 1.7) * 2.5) < -0.52;
            const targetY = crouch ? 7.5 : 15.2;
            p.y = damp(p.y, targetY, 6.2, dt);
            if (u.head) {
              _v1.set(player.x, player.y, PLAYER_Z).sub(p);
              u.head.rotation.y = damp(u.head.rotation.y, Math.atan2(_v1.x, _v1.z) + Math.PI, 4.5, dt);
            }
          }
          if (u.hatch) u.hatch.position.y = (0.2 - p.y) / (e.baseScale || 1);
          e.fireCd -= dt;
          if (e.fireCd <= 0 && e.popErupted && p.y > 9.0 && p.z > -275 && p.z < -28) {
            e.fireCd = rand(1.45, 2.15);
            const muzzlePos = new THREE.Vector3(p.x, p.y + 1.2, p.z - 4);
            const atk = e.attackIdx++ % 3;
            if (atk === 0) this._fireSwarmFan(e, player, proj, 3, 32, muzzlePos);
            else if (atk === 1) {
              this._fireRailShot(e, player, proj, game, muzzlePos);
              this._aimedShot(e, player, proj, 'flak', 1.2, muzzlePos);
            } else {
              this._fireMortarSalvo(e, player, proj, 2, muzzlePos);
              this._aimedShot(e, player, proj, 'cluster', 0.95, muzzlePos);
            }
          }
          break;
        }
        case 'wyrm': {
          // MAGMA DRILL-WYRM: lava-crack telegraph -> helical sky-corkscrew eruption with 5 articulated trailing vertebrae -> diving sweep!
          const prevX = p.x, prevY = p.y, prevZ = p.z;
          const u = e.mesh.userData;
          if (u.drill) u.drill.rotation.z += dt * 16.5;
          // Articulated volcanic mandibles flare wide & chomp aggressively right before firing!
          const jawFlare = e.fireCd < 0.42 ? 0.42 : 0.14 + Math.sin(e.age * 7.5) * 0.10;
          if (u.jawL) u.jawL.rotation.y = damp(u.jawL.rotation.y, jawFlare, 9, dt);
          if (u.jawR) u.jawR.rotation.y = damp(u.jawR.rotation.y, -jawFlare, 9, dt);
          if (!e.wyrmTrail) {
            e.wyrmTrail = [];
            for (let k = 0; k < 36; k++) e.wyrmTrail.push(new THREE.Vector3(p.x, p.y - k * 2.4, p.z));
          }
          if (e.age < 0.45) {
            p.y = -32;
            p.z += scroll * dt * 0.12;
            e.popTelegraphCd -= dt;
            if (e.popTelegraphCd <= 0 && game?.particles) {
              e.popTelegraphCd = 0.14;
              const zid = game?.zone?.id;
              const col = zid === 'dune' ? 0xffcb62 : 0xff6224;
              game.particles.ring(p.x, 2.2, p.z, { color: col, from: 2.5, radius: 22, dur: 0.35, opacity: 0.74 });
              game.particles.emit(p.x, 3.0, p.z, { count: 10, speed: 24, vy: 24, color: 0xffe278, color2: col, life: 0.38, size: 2.8, drag: 1.9 });
            }
          } else {
            const tRun = e.age - 0.45;
            if (tRun < 1.85) {
              // Tight upward 3D helical corkscrew eruption into the sky!
              const riseK = clamp(tRun / 1.85, 0, 1);
              const ang = tRun * 4.4 + e.phase;
              const rad = 14 + riseK * 24;
              p.x = damp(p.x, clamp(e.x0 + Math.cos(ang) * rad, -134, 134), 6.0, dt);
              p.y = damp(p.y, -26 + riseK * 92, 5.2, dt);
              p.z += scroll * dt * 0.22;
            } else {
              // Apex sweep & curved dive-out across player's lane!
              const diveT = tRun - 1.85;
              const targetX = clamp(player.x * 0.45 + Math.sin(diveT * 2.4 + e.phase) * 58, -138, 138);
              const targetY = clamp(64 - diveT * 22 + Math.cos(diveT * 3.0) * 10, 10, 74);
              p.x = damp(p.x, targetX, 3.6, dt);
              p.y = damp(p.y, targetY, 3.4, dt);
              p.z += (e.age > 3.9 ? (scroll * 1.48 + 34) : (scroll * 0.28)) * dt;
            }
            if (!e.popErupted && p.y >= 0.5) {
              e.popErupted = true;
              const zid = game?.zone?.id;
              const c1 = zid === 'dune' ? 0xffcb62 : 0xff5a22;
              const c2 = zid === 'dune' ? 0xfff0b8 : 0xffe478;
              game?.particles?.ring?.(p.x, 3.5, p.z, { color: c1, from: 4, radius: 34, dur: 0.52, opacity: 0.78 });
              game?.particles?.emit?.(p.x, 4.5, p.z, { count: 24, speed: 44, vy: 36, color: c2, color2: c1, life: 0.58, size: 4.0, drag: 1.7, spread: 1.6 });
            }
          }
          // Keep root unrotated so local segment positions match world trail offsets cleanly!
          e.mesh.rotation.set(0, 0, 0);
          e.wyrmTrail.unshift(p.clone());
          if (e.wyrmTrail.length > 42) e.wyrmTrail.pop();
          if (u.segs && u.segs.length > 1) {
            const headSeg = u.segs[0];
            const vx = p.x - prevX, vy = p.y - prevY, vz = p.z - prevZ;
            if (vx * vx + vy * vy + vz * vz > 0.0004) {
              // Head's drill points along local -Z, so lookAt opposite velocity aligns drill forward!
              headSeg.lookAt(_v1.set(p.x - vx, p.y - vy, p.z - vz));
            }
            const invS = 1 / (e.baseScale || 1);
            for (let si = 1; si < u.segs.length; si++) {
              const sample = e.wyrmTrail[Math.min(e.wyrmTrail.length - 1, si * 5)];
              const seg = u.segs[si];
              seg.position.set((sample.x - p.x) * invS, (sample.y - p.y) * invS, (sample.z - p.z) * invS);
              seg.lookAt(u.segs[si - 1].position);
            }
          }
          e.fireCd -= dt;
          if (e.fireCd <= 0 && e.popErupted && p.y > 10 && p.z > -245 && p.z < -26) {
            e.fireCd = rand(1.35, 1.95);
            const atk = e.attackIdx++ % 3;
            if (atk === 0) {
              this._fireMortarSalvo(e, player, proj, 2);
              this._fireFan(e, player, proj, 'venom', 3, 20, 0);
            } else if (atk === 1) {
              this._fireBoomerangPair(e, player, proj);
              this._fireSwarmFan(e, player, proj, 2, 32);
            } else {
              this._aimedShot(e, player, proj, 'cluster', 0.95);
              this._aimedShot(e, player, proj, 'pursuit');
            }
          }
          break;
        }
        case 'scorpion': {
          // DUNE SAND-SCORPION STRIDER: swirling sand vortex -> spring-vault leap -> agile lateral hover-pounces & overhead stinger rail!
          const prevX = p.x, prevY = p.y;
          const u = e.mesh.userData;
          if (u.stingerRing) u.stingerRing.rotation.z += dt * 6.5;
          if (e.age < 0.42) {
            p.y = -18;
            p.z += scroll * dt * 0.14;
            e.popTelegraphCd -= dt;
            if (e.popTelegraphCd <= 0 && game?.particles) {
              e.popTelegraphCd = 0.14;
              game.particles.ring(p.x, 2.5, p.z, { color: 0xffcf68, from: 2.5, radius: 22, dur: 0.34, opacity: 0.72 });
              game.particles.emit(p.x, 3.0, p.z, { count: 10, speed: 24, vy: 20, color: 0xfff0c2, color2: 0xd49642, life: 0.36, size: 2.8, drag: 1.9 });
            }
          } else {
            const tRun = e.age - 0.42;
            let legSpread = 0;
            if (tRun < 0.95) {
              // Explosive spring-loaded vertical vault out of the dunes!
              p.y = damp(p.y, 48, 4.6, dt);
              p.x = damp(p.x, e.x0, 3.5, dt);
              p.z += scroll * dt * 0.22;
              legSpread = 0.65;
              if (!e.popErupted && p.y >= 0.5) {
                e.popErupted = true;
                game?.particles?.ring?.(p.x, 3.5, p.z, { color: 0xffcf68, from: 4, radius: 32, dur: 0.48, opacity: 0.74 });
                game?.particles?.emit?.(p.x, 4.5, p.z, { count: 22, speed: 42, vy: 30, color: 0xfff2c6, color2: 0xc98a36, life: 0.54, size: 3.8, drag: 1.8, spread: 1.6 });
              }
            } else {
              // Agile lateral hover-pounce hops across the corridor!
              e.pounceCd -= dt;
              if (e.pounceCd <= 0) {
                e.pounceCd = rand(0.85, 1.25);
                e.side = -e.side;
                e.pounceX = clamp(player.x + e.side * rand(38, 86), -136, 136);
                game?.particles?.ring?.(p.x, p.y - 2, p.z, { color: 0x62ff78, from: 1.8, radius: 13, dur: 0.26, opacity: 0.55 });
              }
              p.x = damp(p.x, e.pounceX, 4.8, dt);
              p.y = damp(p.y, clamp(player.y + 8 + Math.abs(Math.sin(tRun * 4.2)) * 18, 12, 72), 4.4, dt);
              const zSpd = e.age > 4.0 ? (scroll * 1.50 + 36) : (scroll * 0.20);
              p.z += zSpd * dt;
              legSpread = -0.12 + Math.sin(tRun * 8.0) * 0.14;
            }
            if (u.legs) {
              for (const leg of u.legs) leg.root.rotation.z = damp(leg.root.rotation.z, -leg.side * legSpread, 7.5, dt);
            }
            if (u.tail) {
              const strike = e.fireCd < 0.45 ? 0.32 : Math.sin(e.age * 4.0) * 0.10;
              u.tail.rotation.x = damp(u.tail.rotation.x, strike, 8.0, dt);
            }
            // Articulated twin pincer-cannon arms flare open on pounce & aim inward when firing!
            const clawSpread = e.fireCd < 0.45 ? -0.18 : 0.22 + Math.sin(e.age * 5.2) * 0.10;
            if (u.clawL) u.clawL.rotation.y = damp(u.clawL.rotation.y, clawSpread, 7.5, dt);
            if (u.clawR) u.clawR.rotation.y = damp(u.clawR.rotation.y, -clawSpread, 7.5, dt);
            e.bankZ = damp(e.bankZ, clamp((prevX - p.x) * 3.6, -1.05, 1.05), 6.2, dt);
            e.mesh.rotation.z = e.bankZ;
            e.mesh.rotation.x = damp(e.mesh.rotation.x, clamp((p.y - prevY) * 1.2, -0.55, 0.55), 5.5, dt);
          }
          e.fireCd -= dt;
          if (e.fireCd <= 0 && e.popErupted && p.y > 10 && p.z > -245 && p.z < -26) {
            e.fireCd = rand(1.35, 1.95);
            const stingerPos = new THREE.Vector3(p.x, p.y + 7.5 * e.baseScale, p.z - 4);
            const atk = e.attackIdx++ % 3;
            if (atk === 0) {
              this._fireRailShot(e, player, proj, game, stingerPos);
              this._fireFan(e, player, proj, 'bolt', 2, 16, 0);
            } else if (atk === 1) {
              this._fireBoomerangPair(e, player, proj);
              this._aimedShot(e, player, proj, 'homing', 1.0, stingerPos);
            } else {
              this._fireSwarmFan(e, player, proj, 3, 32, stingerPos);
              this._aimedShot(e, player, proj, 'cluster', 0.95, stingerPos);
            }
          }
          break;
        }
      }

      // Proactive ace sightline dodge: agile elites sense a sustained crosshair bead & snap-jink!
      if (!e.ground && ELITE_TYPES.has(e.type) && e.type !== 'sniper' && e.type !== 'saucer' && p.z > -195 && p.z < -42) {
        e.dodgeCd -= dt;
        const aimDist = Math.hypot(p.x - player.x, p.y - player.y);
        if (aimDist < 15 && e.dodgeCd <= 0 && e.evadeT <= 0) {
          e.aimPressure += dt;
          if (e.aimPressure > 0.36) {
            e.aimPressure = 0;
            e.dodgeCd = rand(2.5, 3.8);
            e.evadeT = 0.44;
            e.evadeDir = p.x >= player.x ? 1 : -1;
            e.evadeSpin = e.evadeDir * TAU;
            game?.particles?.emit?.(p.x, p.y, p.z + 3, { count: 6, speed: 18, vz: 14, color: 0xffd27a, color2: 0x72e8ff, life: 0.26, size: 2.0, drag: 2.5 });
          }
        } else {
          e.aimPressure = Math.max(0, e.aimPressure - dt * 1.5);
        }
      }

      // Scripted 360° Star Fox acrobatic barrel-roll burst (on dive pull-outs, split-breaks & ace turns!)
      if (e.rollBurst > 0) {
        e.rollBurst = Math.max(0, e.rollBurst - dt);
        const progress = 1 - e.rollBurst / 0.48;
        e.mesh.rotation.z += e.rollDir * TAU * progress;
      }

      // Reactive evasive jink & barrel-roll when damaged or dodging in flight!
      if (e.evadeT > 0) {
        e.evadeT = Math.max(0, e.evadeT - dt);
        const k = e.evadeT / 0.52;
        e.x0 = clamp(e.x0 + e.evadeDir * 44 * k * dt, -142, 142);
        p.x = clamp(p.x + e.evadeDir * 44 * k * dt, -152, 152);
        e.mesh.rotation.z += e.evadeSpin * (1 - k);
      }

      // Gentle 3D world obstacle avoidance so airborne enemies weave cleanly around cliffs & structures
      if (!e.ground && p.z > -185 && p.z < 18 && game?.forEachWorldObstacle) {
        game.forEachWorldObstacle((cx, cy, cz, rh, hy) => {
          const padY = hy + e.radius * 0.75 + 2.5;
          if (Math.abs(p.y - cy) >= padY) return;
          const padR = rh + e.radius + 3.5;
          const dx = p.x - cx, dz = p.z - cz;
          if (Math.abs(dx) >= padR || Math.abs(dz) >= padR) return;
          const dist = Math.hypot(dx, dz);
          if (dist < padR) {
            const dir = Math.abs(dx) > 0.5 ? Math.sign(dx) : (cx > 0 ? -1 : 1);
            const push = (padR - dist + 2.5) * Math.min(1, dt * 11);
            p.x = clamp(p.x + dir * push, -168, 168);
            e.x0 = clamp(e.x0 + dir * push * 0.7, -148, 148);
            if (p.y > cy + hy * 0.35 && p.y < 84) p.y += push * 0.55;
          }
        });
      }

      // Apply physical hit recoil jolt (squash-pop + roll shudder + brief knockback!)
      if (e.recoil > 0) {
        e.recoil = Math.max(0, e.recoil - dt * 7.5);
        const pop = e.baseScale * (1 + e.recoil * 0.09);
        if (e.type !== 'mine') e.mesh.scale.setScalar(pop);
        e.mesh.rotation.z += e.hitSpin * e.recoil * 0.28;
      } else if (e.type !== 'mine') {
        e.mesh.scale.setScalar(e.baseScale);
      }

      this._updateMarker(e, player, game);

      if (e.flash > 0) {
        e.flash -= dt;
        if (e.flash <= 0) this._setFlash(e, false);
      }

      if (p.z > 24) {
        this._noteSquadEscape(e);
        this.remove(e);
      } else if ((e.type === 'seeker' || e.type === 'sniper' || e.type === 'saucer' || e.type === 'breacher' || e.type === 'valkyrie' || e.type === 'vanguard' || e.type === 'kraken' || e.type === 'wyrm' || e.type === 'scorpion') && e.age > 20) {
        this._noteSquadEscape(e);
        this.remove(e);
      }
    }
  }

  /**
   * Multi-vector Ambush Director: spawns zone-tailored water/ground surface emergers
   * (kraken/silo/wyrm/scorpion/breacher), sky dive-bombers, flank raiders & edge missiles!
   */
  _updateAmbushDirector(dt, player, proj, game) {
    if (game?.state !== 'playing' || game.boss || game.rival?.active || game.waveSpec?.boss) return;
    this.ambushTimer = (this.ambushTimer ?? 4.5) - dt;
    if (this.ambushTimer > 0) return;

    const w = game.wave ?? this.difficultyWave ?? 1;
    this.ambushTimer = Math.max(2.7, rand(7.6, 10.2) - (w - 1) * 0.34);

    const zid = game.zone?.id ?? 'sea';
    const overWater = zid === 'sea' || zid === 'gorge';
    const pool = ['surfacePop', 'breach', 'dive', 'flank', 'ambushMissiles', 'rearSquad', 'sideSquad'];
    if (overWater) pool.push('surfacePop');
    if (w >= 4) pool.push('surfacePop', 'dive', 'flank', 'rearSquad', 'sideSquad');
    if (w >= 7) pool.push('crossAmbush', 'rearSquad');
    if (w >= 11) pool.push('crossAmbush', 'ambushMissiles', 'rearSquad', 'sideSquad');
    this.triggerAmbush(pick(pool), player, proj, game);
  }

  triggerAmbush(kind, player, proj, game) {
    const w = game?.wave ?? this.difficultyWave ?? 1;
    const zid = game?.zone?.id ?? 'sea';
    const tier = w >= 11 ? 3 : w >= 5 ? 2 : 1;

    if (kind === 'rearSquad') {
      // Dynamic regular-fighter Rear Overtake or Twin-Wing Rear Pincer surging past Bowie's canopy!
      const type = w >= 11 ? pick(['harrier', 'fighter', 'lancer']) : w >= 5 ? pick(['fighter', 'lancer', 'ray']) : pick(['drone', 'lancer', 'ray']);
      const pat = w >= 6 && Math.random() < 0.55 ? 'rearPincer' : 'rear';
      const cnt = w >= 10 ? 4 : w >= 4 ? 3 : 2;
      this.formation(type, cnt, pat, { y: clamp(player.y + rand(-4, 14), 18, 56), noScale: true });
      return;
    }

    if (kind === 'sideSquad') {
      // Dynamic lateral flank cut-in or 3D spiral surround by regular interceptors!
      const type = w >= 11 ? pick(['skytalon', 'harrier', 'strafer']) : w >= 5 ? pick(['fighter', 'strafer', 'ray']) : pick(['drone', 'ray', 'lancer']);
      const pat = w >= 7 ? pick(['sideSweep', 'sidePincer', 'helixSurround']) : pick(['sideSweep', 'sidePincer']);
      const cnt = w >= 10 ? 5 : w >= 4 ? 4 : 3;
      this.formation(type, cnt, pat, { y: clamp(player.y + rand(-6, 16), 18, 60), noScale: true });
      return;
    }

    if (kind === 'surfacePop') {
      // Zone-matched sudden emergence from ocean, canyon floor, magma, or desert sand!
      const zonePool = zid === 'sea' ? ['kraken', 'breacher']
        : zid === 'gorge' ? ['silo', 'kraken', 'breacher']
        : zid === 'ember' ? ['wyrm', 'silo']
        : ['scorpion', 'silo', 'wyrm'];
      const type = pick(zonePool);
      const count = type === 'silo' ? Math.min(2, tier) : tier;
      for (let k = 0; k < count; k++) {
        const off = count === 1 ? rand(-55, 55) : ((k - (count - 1) * 0.5) * 68 + rand(-14, 14));
        const x = clamp(player.x * 0.35 + off, -114, 114);
        const z = (type === 'silo' ? rand(-182, -132) : rand(-166, -114)) - k * 16;
        this.spawn(type, { x, z, fireCd: rand(0.9, 1.4), phase: k * 1.5, side: k % 2 ? 1 : -1 });
      }
      const alertText = type === 'kraken' ? '⚠ DEEP-SEA KRAKEN BREACHING!'
        : type === 'silo' ? '⚠ SUB-SURFACE SILO DEPLOYING!'
        : type === 'wyrm' ? '⚠ MAGMA DRILL-WYRM ERUPTING!'
        : type === 'scorpion' ? '⚠ SAND-SCORPION AMBUSH!'
        : '⚠ SURFACE BREACH — BELOW!';
      game?.hud?.alert?.(alertText, 1.55);
      return;
    }

    if (kind === 'breach') {
      const count = tier; // 1 (W1-4), 2 (W5-10), 3 (W11-16)
      for (let k = 0; k < count; k++) {
        const off = count === 1 ? rand(-55, 55) : ((k - (count - 1) * 0.5) * 66 + rand(-14, 14));
        const x = clamp(player.x * 0.4 + off, -118, 118);
        const z = rand(-168, -108) - k * 16;
        this.spawn('breacher', { x, y: -28, z, peakY: rand(44, 64), fireCd: rand(0.95, 1.45), phase: k * 1.4 });
      }
      const msg = zid === 'ember' ? '⚠ MAGMA BREACH — BELOW!' : zid === 'dune' ? '⚠ SAND BREACH — BELOW!' : '⚠ WATER BREACH — BELOW!';
      game?.hud?.alert?.(msg, 1.5);
      return;
    }

    if (kind === 'dive') {
      const count = w >= 10 ? 3 : w >= 5 ? 2 : 1;
      for (let k = 0; k < count; k++) {
        const off = count === 1 ? rand(-58, 58) : ((k - (count - 1) * 0.5) * 68 + rand(-14, 14));
        const x = clamp(player.x * 0.45 + off, -124, 124);
        const z = rand(-168, -102) - k * 18;
        this.spawn('valkyrie', {
          x, y: rand(152, 174), z, diveY: rand(18, 36),
          side: k % 2 ? 1 : -1, fireCd: rand(0.85, 1.35), phase: k * 1.2,
        });
      }
      game?.hud?.alert?.('⚠ DIVE BOMBERS — ABOVE!', 1.5);
      return;
    }

    if (kind === 'flank') {
      const count = w >= 12 ? 4 : w >= 7 ? 3 : 2;
      for (let k = 0; k < count; k++) {
        const side = k % 2 === 0 ? -1 : 1;
        this.spawn('vanguard', {
          x: side * rand(225, 265),
          y: rand(16, 58),
          z: rand(-148, -82) - Math.floor(k / 2) * 24,
          side,
          fireCd: rand(0.85, 1.35),
          phase: k * 1.3,
        });
      }
      game?.hud?.alert?.('⚠ FLANK RAIDERS — LEFT & RIGHT!', 1.5);
      return;
    }

    if (kind === 'ambushMissiles') {
      const count = w >= 13 ? 6 : w >= 9 ? 4 : w >= 5 ? 3 : 2;
      const dirs = ['left', 'right', 'top', 'bottom'];
      const chosen = pick(dirs);
      for (let k = 0; k < count; k++) {
        const d = count >= 4 ? dirs[k % dirs.length] : chosen;
        const z = rand(-175, -105) - k * 12;
        const ox = d === 'left' ? -192 : d === 'right' ? 192 : clamp(player.x + rand(-78, 78), -120, 120);
        const oy = d === 'top' ? 128 : d === 'bottom' ? 3.5 : rand(16, 60);
        const type = d === 'bottom' ? 'torpedo' : (w >= 9 && k % 3 === 2) ? 'pursuit' : (w >= 6 ? 'swarm' : 'missile');
        const col = d === 'bottom' ? 0x5ef2ff : type === 'pursuit' ? 0xc262ff : 0xff7a42;
        const orig = new THREE.Vector3(ox, oy, z);
        const aim = new THREE.Vector3(player.x + rand(-18, 18), player.y + rand(-8, 10), PLAYER_Z).sub(orig);
        proj?.fireEnemy?.(orig, aim, type);
        if (game?.particles) {
          const rx = d === 'left' ? -148 : d === 'right' ? 148 : ox;
          const ry = d === 'top' ? 92 : d === 'bottom' ? 4.5 : oy;
          game.particles.ring(rx, ry, z, { color: col, from: 2.5, radius: 18, dur: 0.42, opacity: 0.62 });
          if (d === 'bottom') {
            game.particles.emit(ox, 4.5, z, { count: 10, speed: 28, vy: 22, color: 0xcffaff, color2: 0x38d8ff, life: 0.40, size: 2.8, drag: 2.0 });
          }
        }
      }
      const label = count >= 4 ? 'ALL-VECTOR MISSILES' : chosen === 'bottom' ? 'SUB-SURFACE TORPEDOES' : chosen === 'top' ? 'SKY MISSILES' : `${chosen.toUpperCase()} FLANK MISSILES`;
      game?.hud?.alert?.(`⚠ ${label}!`, 1.45);
      return;
    }

    // 'crossAmbush' (Wave 7+): simultaneous multi-axis strike combining breachers + dive-bombers + flankers/torpedoes!
    const side = Math.random() < 0.5 ? -1 : 1;
    this.spawn('breacher', { x: clamp(player.x - side * 46, -110, 110), y: -28, z: -138, peakY: 54, fireCd: 1.0 });
    this.spawn('valkyrie', { x: clamp(player.x + side * 48, -115, 115), y: 162, z: -145, diveY: 26, side: -side, fireCd: 0.95 });
    for (const s of [-1, 1]) {
      this.spawn('vanguard', { x: s * 245, y: rand(22, 54), z: -116, side: s, fireCd: 1.0 });
    }
    if (w >= 11 && proj) {
      for (const s of [-1, 1]) {
        const orig = new THREE.Vector3(s * 188, 34, -145);
        proj.fireEnemy(orig, new THREE.Vector3(player.x, player.y, PLAYER_Z).sub(orig), 'torpedo');
      }
    }
    game?.hud?.alert?.('⚠ MULTI-VECTOR AMBUSH!', 1.65);
  }

  /** Crisp tactical targeting bracket + diegetic HP bar (only shown when damaged) */
  _addMarker(e) {
    const p = markerProfile(e.type, e.ground);
    const g = new THREE.Group();
    const boxSize = Math.max(9.5, e.radius * 2.15) * p.scale;

    const frame = new THREE.Sprite(new THREE.SpriteMaterial({
      map: bracketTexture(p.style), color: p.color, transparent: true, opacity: 0.62,
      depthTest: false, depthWrite: false, fog: false,
    }));
    frame.scale.set(boxSize, boxSize, 1);
    g.add(frame);

    const lock = new THREE.Sprite(new THREE.SpriteMaterial({
      map: bracketTexture('lock'), color: 0x5effa8, transparent: true, opacity: 0,
      depthTest: false, depthWrite: false, fog: false,
    }));
    lock.scale.set(boxSize * 1.28, boxSize * 1.28, 1);
    g.add(lock);

    // Compact diegetic HP bar using ONE shared unit PlaneGeometry (zero geometry alloc/leak!)
    const hpW = Math.max(7.0, e.radius * 1.65);
    const hpBg = new THREE.Mesh(
      HP_BAR_GEO,
      new THREE.MeshBasicMaterial({ color: 0x0e1424, transparent: true, opacity: 0.78, depthTest: false, depthWrite: false, fog: false })
    );
    hpBg.scale.set(hpW, 0.85, 1);
    hpBg.position.set(0, e.radius * 1.15 + 1.8, 0);
    hpBg.visible = false;
    const hpFill = new THREE.Mesh(
      HP_BAR_GEO,
      new THREE.MeshBasicMaterial({ color: 0xff6252, depthTest: false, depthWrite: false, fog: false })
    );
    hpFill.scale.set(0.95, 0.62, 1);
    hpFill.position.z = 0.02;
    hpBg.add(hpFill);
    g.add(hpBg);

    e.mesh.add(g);
    e.marker = { g, frame, lock, hpBg, hpFill, boxSize, profile: p };
  }

  _updateMarker(e, player, game) {
    const m = e.marker;
    if (!m) return;
    const z = e.mesh.position.z;
    const hiddenSub = (e.type === 'kraken' || e.type === 'wyrm' || e.type === 'scorpion' || e.type === 'breacher' || e.type === 'silo')
      ? e.mesh.position.y < 1.0
      : false;
    const inViewBand = z > -350 && z < 12 && !hiddenSub;
    m.g.visible = inViewBand && e.alive && !e.dying;
    if (!m.g.visible) return;
    const isLocked = game._isLocked ? game._isLocked(e) : (game._chargeLock?.ref === e);
    const imminent = e.fireCd < 0.45 && z > -265 && z < -30;
    const t = e.age;
    const base = m.profile.color;
    const col = isLocked ? 0x5effa8 : imminent ? 0xff2845 : base;
    m.frame.material.color.setHex(col);
    m.frame.material.opacity = isLocked ? 0.18 : imminent ? 0.94 : 0.48;
    const pulse = 1 + (imminent ? Math.sin(t * 20) * 0.12 : 0);
    m.frame.scale.set(m.boxSize * pulse, m.boxSize * pulse, 1);

    m.lock.material.opacity = isLocked ? 0.96 : 0;
    const lockScale = m.boxSize * (1.22 + Math.sin(t * 14) * 0.08);
    m.lock.scale.set(lockScale, lockScale, 1);

    // Show crisp HP bar once damaged (or on heavy ships / locked targets)
    const ratio = clamp(e.hp / Math.max(1, e.maxHp), 0, 1);
    const showHp = (ratio < 1 || isLocked || e.tier === 'heavy') && e.maxHp > 2;
    m.hpBg.visible = showHp;
    if (showHp) {
      if (game?.camera) m.hpBg.quaternion.copy(game.camera.quaternion);
      m.hpFill.scale.x = Math.max(0.02, 0.95 * ratio);
      m.hpFill.position.x = -(1 - ratio) * 0.475;
      m.hpFill.material.color.setHex(ratio > 0.55 ? 0xffb84a : ratio > 0.28 ? 0xff6e3a : 0xff2d4e);
    }
  }

  _formationEntryFx(e, game, kind) {
    if (!game?.particles || !e?.alive) return;
    const p = e.mesh.position;
    if (kind === 'siege') {
      game.particles.flash(p.x, p.y, p.z, 1.6, 0xff9b62);
      game.particles.ring(p.x, p.y, p.z, { color: 0xff8246, from: 2, radius: 24, dur: 0.6, opacity: 0.38 });
      game.particles.emit(p.x, p.y, p.z + 6, { count: 16, speed: 24, vz: 18, color: 0xffbc76, color2: 0x8fbaff, life: 0.52, size: 3.4, drag: 2.1, spread: 2.2 });
      audio.escortLaunch();
    } else if (kind === 'pincer') {
      game.particles.muzzle(p.x, p.y, p.z + 4, 1.25, 0x8fd8ff);
      game.particles.emit(p.x, p.y, p.z + 5, { count: 7, speed: 18, vz: 20, color: 0xd9f3ff, color2: 0x579dff, life: 0.32, size: 2.2, drag: 2.8, spread: 0.8 });
      audio.pincerPass();
    }
  }

  _siegeShot(e, player, proj, game, side, type) {
    const p = e.mesh.position;
    const muzzle = _v2.set(p.x + side * 4.5, p.y + (side ? 1.2 : 0.2), p.z - 14.0).clone();
    const color = type === 'wave' ? 0x95bfff : 0xffa15a;
    game.particles?.muzzle(muzzle.x, muzzle.y, muzzle.z, type === 'wave' ? 2.5 : 2.1, color);
    game.particles?.flash(muzzle.x, muzzle.y, muzzle.z, type === 'wave' ? 1.15 : 0.92, color);
    game.particles?.emit(muzzle.x, muzzle.y, muzzle.z, { count: type === 'wave' ? 12 : 9, speed: type === 'wave' ? 32 : 25, vz: -12, color, color2: 0xffffff, life: 0.36, size: type === 'wave' ? 4.0 : 3.0, drag: 2.6, spread: 0.75 });
    if (type === 'wave') game.particles?.ring(muzzle.x, muzzle.y, muzzle.z, { color, from: 1.5, radius: 14, dur: 0.28, opacity: 0.48 });
    this._aimedShot(e, player, proj, type, type === 'wave' ? 0.92 : 1.18, muzzle);
    audio.siegeBroadside();
  }

  _assignAllyTarget(e, player, wingmates, dt) {
    const valid = (w) => w && w.hidden <= 0 && w.mesh.visible && w.hp > 0;
    if (!e.forcedWingmate && !ALLY_TARGET_CAPABLE.has(e.type)) {
      e.allyTarget = null; e.allyTargetT = 0;
      return;
    }
    if (valid(e.forcedWingmate) && e.forcedWingmate.danger > 0) {
      e.allyTarget = e.forcedWingmate;
      e.allyTargetT = 0.25;
    } else {
      if (e.forcedWingmate && e.forcedWingmate.danger <= 0) e.forcedWingmate = null;
      if (valid(e.allyTarget) && (e.allyTarget.targetedBy ?? 0) >= 1) e.allyTarget = null;
      e.allyTargetT -= dt;
      if (!valid(e.allyTarget) || e.allyTargetT <= 0) {
        e.allyTarget = null;
        e.allyTargetT = rand(0.85, 1.45);
        const inAttackBand = e.mesh.position.z > -275 && e.mesh.position.z < -26;
        const candidates = inAttackBand ? wingmates.filter((w) => valid(w)
          && w.danger <= 0 && (w.targetedBy ?? 0) < 1
          && Math.abs(w.z - e.mesh.position.z) < 220
          && Math.hypot(w.x - e.mesh.position.x, w.y - e.mesh.position.y) < 220) : [];
        const allyTargetChance = this.difficultyWave <= 3 ? 0.32 : 0.26;
        if (candidates.length && Math.random() < allyTargetChance) {
          const least = Math.min(...candidates.map((w) => w.targetedBy ?? 0));
          const pool = candidates.filter((w) => (w.targetedBy ?? 0) === least);
          e.allyTarget = pick(pool);
          e.allyTargetT = rand(2.6, 4.4);
        }
      }
    }
    if (valid(e.allyTarget)) e.allyTarget.targetedBy++;
  }

  _targetPosition(e, player, out = _v1) {
    const w = e.allyTarget;
    return w && w.hidden <= 0 && w.mesh.visible && w.hp > 0
      ? out.set(w.x, w.y, w.z)
      : out.set(player.x, player.y, PLAYER_Z);
  }

  _aimedShot(e, player, proj, type = 'orb', leadMul = 1, origin = null, extra = null) {
    const p = origin ?? e.mesh.position;
    const w = e.allyTarget && e.allyTarget.hidden <= 0 && e.allyTarget.mesh.visible && e.allyTarget.hp > 0 ? e.allyTarget : null;
    const target = w ?? player;
    const targetZ = w ? w.z : PLAYER_Z;
    _v1.set(target.x + (target.vx ?? 0) * 0.11 * leadMul, target.y + (target.vy ?? 0) * 0.08 * leadMul, targetZ).sub(p);
    const shotType = w && (type === 'orb' || type === 'bolt') && Math.random() < 0.55 ? 'homing' : type;
    proj.fireEnemy(p.clone(), _v1.clone(), shotType, null, w, extra);
  }

  /** Horizontal/V-spread salvo fanning around the target's sightline. */
  _fireFan(e, player, proj, type = 'orb', count = 3, spreadX = 20, spreadY = 0, origin = null) {
    const p = origin ?? e.mesh.position;
    const half = (count - 1) * 0.5;
    for (let k = 0; k < count; k++) {
      const off = k - half;
      _v1.set(player.x + off * spreadX, player.y + Math.abs(off) * spreadY, PLAYER_Z).sub(p);
      proj.fireEnemy(p.clone(), _v1.clone(), type);
    }
  }

  /** Counter-twisting 3D DNA double-helix `spiral` beam pair! */
  _fireHelixPair(e, player, proj, origin = null) {
    const p = origin ?? e.mesh.position;
    const dir = new THREE.Vector3(player.x - p.x, player.y - p.y, PLAYER_Z - p.z);
    proj.fireEnemy(p.clone(), dir.clone(), 'spiral', null, null, { helixPhase: 0 });
    proj.fireEnemy(p.clone(), dir.clone(), 'spiral', null, null, { helixPhase: Math.PI });
  }

  /** Twin wide-curving magenta `boomerang` pincer blades that arc outward then slash back across center! */
  _fireBoomerangPair(e, player, proj, origin = null) {
    const p = origin ?? e.mesh.position;
    for (const s of [-1, 1]) {
      _v1.set(player.x + s * 56, player.y + rand(-4, 6), PLAYER_Z).sub(p);
      proj.fireEnemy(p.clone(), _v1.clone(), 'boomerang', null, null, { curveX: -s * 68 });
    }
  }

  /** High-arcing parabolic gravity `mortar` artillery salvo dropping onto the player's plane! */
  _fireMortarSalvo(e, player, proj, count = 2, origin = null) {
    const p = origin ?? e.mesh.position;
    const half = (count - 1) * 0.5;
    const g = -56;
    for (let k = 0; k < count; k++) {
      const off = count === 1 ? 0 : (k - half);
      const tx = player.x + off * 22;
      const ty = player.y + rand(-3, 5);
      const dist = Math.hypot(tx - p.x, ty - p.y, PLAYER_Z - p.z);
      const tFly = clamp(dist / 98, 0.80, 2.05);
      const vx = (tx - p.x) / tFly;
      const vy = (ty - p.y - 0.5 * g * tFly * tFly) / tFly;
      const vz = (PLAYER_Z - p.z) / tFly;
      const spd = Math.hypot(vx, vy, vz);
      proj.fireEnemy(p.clone(), new THREE.Vector3(vx, vy, vz), 'mortar', spd);
    }
  }

  /** Bright cyan charge telegraph glint followed 0.34s later by a hypersonic `rail` lance! */
  _fireRailShot(e, player, proj, game, origin = null) {
    const p = origin ? origin.clone() : e.mesh.position.clone();
    game?.particles?.weaponTelegraph?.(p.x, p.y, p.z + 2, 0x62ecff, 1.55);
    game?.particles?.ring?.(p.x, p.y, p.z + 2, { color: 0x62ecff, from: 1.5, radius: 13, dur: 0.34, opacity: 0.65 });
    const lockX = player.x, lockY = player.y;
    this._scheduleShot(0.34, () => {
      if (!e.alive || e.dying) return;
      const src = origin ? origin.clone() : e.mesh.position.clone();
      game?.particles?.flash?.(src.x, src.y, src.z + 2, 1.0, 0xb8f8ff);
      _v1.set(lockX + (player.x - lockX) * 0.35, lockY + (player.y - lockY) * 0.35, PLAYER_Z).sub(src);
      proj.fireEnemy(src, _v1.clone(), 'rail');
    });
  }

  /** Radial spinning energy ring (4–12 spokes). */
  _fireRadialRing(e, proj, type = 'plasma', spokes = 8, speedXY = 36, speedZ = 42, spin = 0, origin = null) {
    const p = origin ?? e.mesh.position;
    for (let k = 0; k < spokes; k++) {
      const a = (k / spokes) * TAU + spin;
      _v1.set(Math.cos(a) * speedXY, Math.sin(a) * speedXY, speedZ);
      proj.fireEnemy(p.clone(), _v1.clone(), type);
    }
  }

  /** Macross-style outward-curving micro-missile `swarm` fan! */
  _fireSwarmFan(e, player, proj, count = 3, spreadX = 32, origin = null) {
    const p = origin ?? e.mesh.position;
    const half = (count - 1) * 0.5;
    for (let k = 0; k < count; k++) {
      const off = count === 1 ? 0 : (k - half);
      _v2.set(p.x + off * 3.5, p.y + Math.abs(off) * 1.6, p.z);
      _v1.set(player.x + off * spreadX, player.y + 10 + Math.abs(off) * 5, PLAYER_Z).sub(_v2);
      proj.fireEnemy(_v2.clone(), _v1.clone(), 'swarm');
    }
  }

  _updateCombatVisual(e, dt, game = null) {
    const t = e.age;
    // Articulated blooming claw-petals & pulsing magenta core on procedural Pods!
    if (e.type === 'pod' && e.mesh.userData.petals) {
      const open = e.podOpen ?? 0;
      for (const hinge of e.mesh.userData.petals) {
        hinge.rotation.z = -open * 0.68;
      }
      if (e.mesh.userData.frameCross) e.mesh.userData.frameCross.rotation.x += dt * (1.8 + open * 5.2);
      if (e.mesh.userData.core?.material?.emissive) {
        e.mesh.userData.core.material.emissiveIntensity = 1.9 + open * 1.8 + Math.sin(t * 14) * 0.35;
      }
    }

    const v = e.visual;
    if (!v) return;
    const damage = clamp(1 - e.hp / Math.max(1, e.maxHp), 0, 1);
    const flaring = e.rollBurst > 0 || e.evadeT > 0 || !e.lingering;
    const thrust = (flaring ? 1.12 : 0.90) + Math.sin(t * 24 + e.phase) * 0.12 + damage * 0.14;
    for (const glow of v.engineGlows) {
      const base = glow.userData.baseScale ?? (glow.userData.baseScale = glow.scale.x);
      glow.scale.setScalar(base * thrust);
      glow.material.opacity = 0.78 + Math.sin(t * 18 + e.phase) * 0.14;
    }
    for (const plume of v.enginePlumes) {
      const len = (e.rollBurst > 0 || e.evadeT > 0 ? 1.48 : e.lingering ? 0.76 : 1.18) * (0.88 + Math.sin(t * 46 + e.phase) * 0.16);
      plume.scale.set(1, 1, len);
    }
    for (const collar of v.engineCollars) collar.rotation.z += dt * (2.2 + e.speed * 0.8 + (flaring ? 2.6 : 0));

    const critical = clamp((damage - 0.35) / 0.65, 0, 1);
    const attackBand = e.mesh.position.z > -270 && e.mesh.position.z < -30;
    const imminent = attackBand && e.fireCd > 0 && e.fireCd < 0.45;

    // Articulated agile wingtip stabilizers flex smoothly with bank angle & barrel-rolls
    const wingFlex = clamp(e.mesh.rotation.z * 0.25, -0.35, 0.35) + (e.rollBurst > 0 ? 0.22 : 0);
    if (v.wingL) v.wingL.rotation.z = wingFlex;
    if (v.wingR) v.wingR.rotation.z = -wingFlex;

    // Counter-rotating holographic gyroscopes on Tech/Phase craft accelerate on weapon lock!
    const gyroBoost = imminent ? 3.4 : 1.0;
    for (const gA of v.gyroA) { gA.rotation.z += dt * 1.9 * gyroBoost; gA.rotation.y += dt * 1.1 * gyroBoost; }
    for (const gB of v.gyroB) { gB.rotation.x -= dt * 2.5 * gyroBoost; gB.rotation.z -= dt * 1.4 * gyroBoost; }

    // Continuous AWACS dorsal radar sweep atop heavy gunships & carriers!
    for (const rad of v.radars) rad.rotation.y += dt * (1.85 + (imminent ? 2.4 : 0));

    // Crisp afterburner spark trail during dramatic snap-rolls, split-breaks & phase-dashes
    if (game?.particles && !e.ground && (e.rollBurst > 0 || e.evadeT > 0) && attackBand) {
      e.trailCd -= dt;
      if (e.trailCd <= 0) {
        e.trailCd = 0.055;
        const p = e.mesh.position;
        const tCol = e.type === 'phantom' ? 0xb886ff : e.type === 'ray' || e.type === 'seeker' ? 0x72f4ff : 0xffaa56;
        game.particles.emit(p.x, p.y, p.z + 4.5, { count: 2, speed: 9, vz: 16, color: tCol, color2: 0xffffff, life: 0.24, size: 1.85, drag: 2.2 });
      }
    }

    for (const ring of v.sensorRings) {
      const base = ring.userData.baseScale ?? (ring.userData.baseScale = ring.scale.x);
      ring.rotation.z += dt * (1.8 + e.speed * 1.2 + (imminent ? 5.6 : 0));
      ring.scale.setScalar(base * (1 + (imminent ? 0.22 : 0.04) * Math.sin(t * (imminent ? 26 : 6) + e.phase)));
      if (ring.material.emissive) ring.material.emissiveIntensity = imminent ? 2.2 : 0.55 + damage * 0.45;
    }
    for (const weapon of v.weaponGlows) {
      const base = weapon.userData.baseScale ?? (weapon.userData.baseScale = weapon.scale.x);
      const pulse = imminent ? 0.82 + Math.max(0, Math.sin(t * 28 + e.phase)) * 0.18 : 0.28 + damage * 0.18;
      weapon.material.opacity = pulse;
      weapon.scale.setScalar(base * (1 + (imminent ? 0.48 : 0.06) * Math.sin(t * (imminent ? 24 : 5) + e.phase)));
    }
    for (const warning of v.warningLights) {
      const base = warning.userData.baseScale ?? (warning.userData.baseScale = warning.scale.x);
      warning.material.opacity = critical * (0.38 + Math.max(0, Math.sin(t * 13 + e.phase)) * 0.60);
      warning.scale.setScalar(base * (1 + critical * 0.30));
    }
    for (const core of v.reactorCores) {
      const base = core.userData.baseScale ?? (core.userData.baseScale = core.scale.x);
      const energy = imminent ? 1 : 0.52 + damage * 0.38;
      core.rotation.y += dt * (1.8 + energy * 5.0);
      core.scale.setScalar(base * (1 + energy * 0.18));
      if (core.material.emissive) core.material.emissiveIntensity = 0.55 + energy * 1.2;
    }
    for (const halo of v.reactorHalos) {
      halo.rotation.z += dt * (0.9 + (imminent ? 4.4 : 1.3));
      if (halo.material.emissive) halo.material.emissiveIntensity = imminent ? 1.65 : 0.45 + damage * 0.35;
    }
    if (v.damageSmoke) {
      v.damageSmoke.material.opacity = critical * (0.22 + Math.max(0, Math.sin(t * 5 + e.phase)) * 0.34);
      v.damageSmoke.position.x = Math.sin(t * 3.8 + e.phase) * (0.4 + damage * 0.8);
      v.damageSmoke.position.y += dt * 0.35;
      if (v.damageSmoke.position.y > 7) v.damageSmoke.position.y = 2.6;
    }
  }

  _setFlash(e, on) {
    e.mesh.traverse((n) => {
      if (n.material && n.material.emissive !== undefined) {
        if (on) {
          if (n.userData._em === undefined) {
            n.userData._em = n.material.emissive.getHex();
            n.userData._emi = n.material.emissiveIntensity;
            n.material = n.material.clone();
            n.material.userData = { ...(n.material.userData || {}), shared: false, _clonedMat: true };
          }
          n.material.emissive.setHex(0xffffff);
          n.material.emissiveIntensity = 1.15;
        } else if (n.userData._em !== undefined) {
          n.material.emissive.setHex(n.userData._em);
          n.material.emissiveIntensity = n.userData._emi;
        }
      }
    });
  }

  hit(e, dmg) {
    if (e.dying) return false;
    e.hp -= dmg;
    e.flash = 0.12;
    e.recoil = 1.0;
    e.hitSpin = (Math.random() < 0.5 ? -1 : 1) * rand(0.6, 1.0);
    // Physical knockback kick on impact + reactive evasive snap-roll on surviving agile fighters!
    if (!e.ground) {
      e.mesh.position.z -= e.tier === 'heavy' ? 0.9 : 2.1;
      if (e.hp > 0 && e.tier !== 'heavy' && e.type !== 'pod' && e.type !== 'mine' && e.evadeT <= 0 && Math.random() < 0.72) {
        e.evadeT = 0.52;
        e.evadeDir = e.mesh.position.x > 0 ? -1 : 1;
        if (Math.random() < 0.35) e.evadeDir = -e.evadeDir;
        e.evadeSpin = e.evadeDir * TAU;
      }
    }
    this._setFlash(e, true);
    return e.hp <= 0;
  }

  /**
   * Kick off a snappy, dramatic Star Fox flaming death spiral for airborne craft
   * before their final explosive breakup! Score & combo register immediately so
   * combat pacing stays ultra-responsive.
   */
  beginDying(e, scored = true) {
    if (!e.alive || e.dying) return false;
    if (scored) this.killCount++;
    e.dying = true;
    e.hp = 0;
    if (e.marker) e.marker.g.visible = false;
    e.deathT = e.tier === 'heavy' ? 0.52 : 0.32;
    e.deathVel = new THREE.Vector3(rand(-22, 22), rand(-4, 12), rand(18, 42));
    e.deathSpin = new THREE.Vector3(rand(-5, 5), rand(-4, 4), (Math.random() < 0.5 ? -1 : 1) * rand(9, 15));
    e.smokeCd = 0;
    this._setFlash(e, true);
    return true;
  }

  kill(e, scored = true) {
    if (!e.alive) return;
    if (scored && !e.dying) this.killCount++;
    this.remove(e);
  }

  remove(e) {
    e.alive = false;
    e.dying = false;
    this.scene.remove(e.mesh);
    // Dispose per-enemy cloned hit-flash materials, marker materials & procedural geometry (preserves shared GLB templates!)
    e.mesh.traverse((n) => {
      if (n.geometry && !n.geometry.userData?.shared) n.geometry.dispose?.();
      if (n.material) {
        const mats = Array.isArray(n.material) ? n.material : [n.material];
        for (const m of mats) {
          if (m && !m.userData?.shared) m.dispose?.();
        }
      }
    });
    const i = this.list.indexOf(e);
    if (i >= 0) this.list.splice(i, 1);
  }

  /** Record a formation kill; returns `{ total, type }` when an entire squad is wiped with 0 escapes! */
  noteSquadKill(e) {
    if (!e?.squadId || e._squadCounted) return null;
    e._squadCounted = true;
    const sq = this._squads.get(e.squadId);
    if (!sq || sq.done) return null;
    sq.killed++;
    if (sq.escaped === 0 && sq.killed >= sq.total) {
      sq.done = true;
      this._squads.delete(e.squadId);
      return { total: sq.total, type: sq.type };
    }
    if (sq.killed + sq.escaped >= sq.total) this._squads.delete(e.squadId);
    return null;
  }

  _noteSquadEscape(e) {
    if (!e?.squadId || e._squadCounted) return;
    e._squadCounted = true;
    const sq = this._squads.get(e.squadId);
    if (!sq || sq.done) return;
    sq.escaped++;
    if (sq.killed + sq.escaped >= sq.total) this._squads.delete(e.squadId);
  }

  clear() {
    for (const e of [...this.list]) this.remove(e);
    this.queue.length = 0;
    this._pendingShots.length = 0;
    this._squads.clear();
    this.eliteTimer = rand(5.5, 9.0);
    this.ambushTimer = rand(3.5, 5.2);
  }
}
