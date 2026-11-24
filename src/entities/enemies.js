import * as THREE from 'three';
import { buildDrone, buildLancer, buildPod, buildTurret, buildMine, buildRay, buildGunship, buildSeeker, buildSniper, buildStrafer, buildBomber, buildFlak, buildAABattery, buildHovertank, buildLauncher, buildSaucer, buildCarrier, buildSiegeCarrier, SHIP_MODELS } from './shipFactory.js';
import { rand, pick, clamp, damp, TAU, _v1, _v2, dotTexture } from '../core/util.js';
import { PLAYER_Z } from './player.js';
import { audio } from '../core/audio.js';

// Close-quarters combat spawn depth: enemies enter substantial 3D silhouettes
// immediately and surge into the player's windshield in ~2-3 seconds!
const SPAWN_Z = -310;
const FORMATION_SCALE = [null, 1.04, 1.06, 1.10, 1.06, 1.08, 1.12, 1.14, 1.14, 1.18, 1.18, 1.22, 1.24, 1.24, 1.24, 1.24, 1.24];
const HP_BAR_GEO = new THREE.PlaneGeometry(1, 1);
HP_BAR_GEO.userData.shared = true;

/* Enlarged collision radii matching the bigger V57 enemy silhouettes, plus
 * destruction `tier` ('small' | 'medium' | 'heavy') driving explosion scale,
 * dying spin-outs, debris burst, and hitstop punch! */
const STATS = {
  drone:       { hp: 3,  r: 5.8,  score: 15,   tier: 'small',  linger: 2.0 },
  lancer:      { hp: 5,  r: 6.7,  score: 35,   tier: 'medium', linger: 2.3 },
  pod:         { hp: 11, r: 6.8,  score: 60,   tier: 'medium', linger: 2.6 },
  turret:      { hp: 8,  r: 6.6,  score: 45,   tier: 'medium', ground: true },
  mine:        { hp: 2,  r: 5.2,  score: 25,   tier: 'small' },
  ray:         { hp: 5,  r: 7.0,  score: 35,   tier: 'small',  linger: 2.0 },
  gunship:     { hp: 26, r: 10.6, score: 160,  tier: 'heavy',  linger: 3.6 },
  seeker:      { hp: 8,  r: 7.0,  score: 70,   tier: 'medium' },
  sniper:      { hp: 10, r: 7.2,  score: 90,   tier: 'medium' },
  strafer:     { hp: 8,  r: 7.4,  score: 80,   tier: 'medium', linger: 2.4 },
  bomber:      { hp: 18, r: 9.6,  score: 140,  tier: 'heavy',  linger: 3.4 },
  saucer:      { hp: 12, r: 8.0,  score: 120,  tier: 'medium' },
  skyraider:   { hp: 42, r: 11.8, score: 380,  tier: 'heavy',  linger: 4.2 },
  relaydrone:  { hp: 9,  r: 6.6,  score: 120,  tier: 'medium', linger: 2.3 },
  carrier:     { hp: 34, r: 12.0, score: 240,  tier: 'heavy',  linger: 4.2 },
  flak:        { hp: 14, r: 7.2,  score: 100,  tier: 'medium', ground: true },
  hovertank:   { hp: 16, r: 7.8,  score: 110,  tier: 'medium', ground: true },
  launcher:    { hp: 12, r: 7.0,  score: 100,  tier: 'medium', ground: true },
  aabattery:   { hp: 28, r: 8.8,  score: 360,  tier: 'heavy',  ground: true },
  scout:       { hp: 7,  r: 7.2,  score: 95,   tier: 'medium', linger: 2.3 },
  fighter:     { hp: 14, r: 8.8,  score: 170,  tier: 'medium', linger: 2.7 },
  skytalon:    { hp: 11, r: 8.2,  score: 200,  tier: 'medium', linger: 2.5 },
  harrier:     { hp: 12, r: 8.2,  score: 190,  tier: 'medium', linger: 2.4 },
  phantom:     { hp: 16, r: 8.0,  score: 260,  tier: 'medium', linger: 2.7 },
  dreadwing:   { hp: 58, r: 12.8, score: 980,  tier: 'heavy',  linger: 4.5 },
  quadtank:    { hp: 30, r: 8.8,  score: 340,  tier: 'heavy',  ground: true },
  trilobite:   { hp: 26, r: 9.0,  score: 320,  tier: 'heavy',  ground: true },
  cannon:      { hp: 18, r: 6.8,  score: 230,  tier: 'medium', ground: true },
  shorecannon: { hp: 16, r: 6.6,  score: 220,  tier: 'medium', ground: true },
  gunboat:     { hp: 46, r: 13.5, score: 680,  tier: 'heavy',  ground: true },
  frigate:     { hp: 70, r: 17.0, score: 1150, tier: 'heavy',  ground: true },
  mech:        { hp: 52, r: 10.4, score: 920,  tier: 'heavy',  ground: true },
  siegecarrier:{ hp: 82, r: 14.4, score: 1500, tier: 'heavy',  linger: 4.8 },
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
};

const HEAVY_TYPES = new Set(['skyraider', 'carrier', 'gunship', 'bomber', 'dreadwing', 'frigate', 'gunboat', 'mech', 'quadtank', 'trilobite', 'siegecarrier', 'aabattery']);
const ELITE_TYPES = new Set(['seeker', 'sniper', 'strafer', 'fighter', 'skytalon', 'harrier', 'phantom', 'saucer', 'scout', 'relaydrone']);
const ALLY_TARGET_CAPABLE = new Set([
  'drone', 'relaydrone', 'lancer', 'turret', 'seeker', 'sniper', 'strafer',
  'flak', 'aabattery', 'saucer', 'carrier', 'skyraider', 'scout', 'fighter', 'skytalon', 'harrier',
  'phantom', 'trilobite', 'cannon', 'shorecannon', 'siegecarrier',
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

    const hpVal = (st.hp * (opts.hpMul ?? 1)) | 0 || 1;
    const e = {
      type, mesh, alive: true, dying: false,
      tier: st.tier ?? 'small',
      hp: hpVal, maxHp: hpVal,
      radius: st.r, score: st.score,
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
      // enemies dive right into z ∈ [-102, -34], execute spirals/swoops/evasive jinks, then roar past!
      lingerDur: st.linger ?? 0,
      lingerUsed: 0,
      lingering: false,
      maneuver: opts.maneuver ?? pick(['corkscrew', 'swoop', 'flank']),
      evadeT: 0,
      evadeDir: 1,
      evadeSpin: 0,
      dashCd: rand(1.6, 2.6),
      telegraphFired: false,
      // Visceral impact / death-spiral state
      flash: 0,
      recoil: 0,
      hitSpin: 0,
      smokeCd: 0,
      deathT: 0,
      deathVel: null,
      deathSpin: null,
      baseScale: mesh.userData.meshScale ?? 1,
      allyTarget: opts.allyTarget ?? null,
      forcedWingmate: opts.forcedWingmate ?? null,
      allyTargetT: 0,
      pos() { return this.mesh.position; },
    };

    if (e.baseScale !== 1) mesh.scale.setScalar(e.baseScale);

    const HOVER = { hovertank: 3.5, quadtank: 3.0, gunboat: 1.8, frigate: 2.2 };
    if (st.ground) e.y0 = opts.y ?? (HOVER[type] ?? 0);
    // Keep ground enemies inside the visible canyon/sea flanks so they aren't hidden off-screen
    if (st.ground && opts.x === undefined) e.x0 = rand(-118, 118);
    mesh.position.set(e.x0, e.y0, opts.z ?? SPAWN_Z);
    if (type === 'turret') mesh.position.y = opts.y ?? 1.2;

    const frame = mesh.getObjectByName('combatFrame');
    if (frame) {
      const visual = {
        engineGlows: [], engineCollars: [], enginePlumes: [],
        warningLights: [], weaponGlows: [], sensorRings: [],
        reactorCores: [], reactorHalos: [], damageSmoke: null,
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
        else if (n.name === 'combatDamageSmoke') visual.damageSmoke = n;
      });
      e.visual = visual;
    }
    this._addMarker(e);
    this.list.push(e);
    return e;
  }

  /** queue a formation tightly framed across the player's combat corridor */
  formation(type, n, pattern, opts = {}) {
    const scale = opts.noScale ? 1 : (FORMATION_SCALE[this.difficultyWave] ?? 1.24);
    n = Math.max(1, Math.round(n * scale));
    const bx = opts.x !== undefined ? clamp(opts.x * 0.72, -110, 110) : rand(-74, 74);
    const highY = opts.y === undefined && Math.random() < 0.28 ? rand(30, 66) : null;
    for (let i = 0; i < n; i++) {
      const o = { ...opts };
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

    // random elite / ground spawns
    this.eliteTimer = (this.eliteTimer ?? 7) - dt;
    if (this.eliteTimer <= 0 && game.state === 'playing' && !game.boss && !game.rival?.active && !game.waveSpec?.boss && (game.wave ?? 1) >= 2) {
      const w = game.wave ?? 1;
      this.eliteTimer = Math.max(4.4, rand(9, 13.5) - Math.max(0, w - 2) * 0.28);
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

      this._updateCombatVisual(e, dt);
      this._assignAllyTarget(e, player, wingmates, dt);

      // ---- Close-quarters dogfight pacing & aggressive sweet-spot linger ----
      // Standard fighters surge briskly from SPAWN_Z (-310) straight into close
      // combat (z ∈ [-102, -34]), weave aggressively across your windshield,
      // then hit afterburners to scream dramatically past the cockpit!
      let zRate = 1.0;
      const selfZ = e.type === 'seeker' || e.type === 'sniper' || e.type === 'saucer';
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
          // 3 complex acrobatic patterns: helical corkscrew spiral, high-to-low dive-swoop, or cross-nose flank weave
          const closeK = clamp((p.z + 180) / 140, 0, 1);
          const prevX = p.x, prevY = p.y;
          if (e.maneuver === 'corkscrew') {
            const rad = (e.amp + 7) * (0.72 + closeK * 0.45);
            const ang = e.age * 2.9 + e.phase;
            p.x = e.x0 + Math.cos(ang) * rad;
            p.y = clamp(e.y0 + Math.sin(ang) * rad * 0.55, 8, 78);
            e.mesh.rotation.z = -Math.sin(ang) * 0.95;
          } else if (e.maneuver === 'swoop') {
            const u = e.age * 2.15 + e.phase;
            p.x = e.x0 + Math.sin(u) * (e.amp + 16) + Math.sin(u * 2.1) * 5;
            p.y = clamp(e.y0 + Math.cos(u * 1.4) * 11 - closeK * 5, 8, 78);
            e.mesh.rotation.z = clamp((prevX - p.x) * 0.18, -1.05, 1.05);
          } else {
            const cut = Math.sin(e.age * 2.4 + e.phase);
            p.x = e.x0 + cut * (e.amp + 18) + e.side * (1 - closeK) * 28;
            p.y = clamp(e.y0 + Math.sin(e.age * 3.1 + e.phase) * 7.5, 8, 78);
            e.mesh.rotation.z = clamp((prevX - p.x) * 0.20, -1.1, 1.1);
          }
          e.mesh.rotation.x = clamp((p.y - prevY) * 0.08, -0.45, 0.45);
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -250 && p.z < -28) {
            e.fireCd = earlyBarrage ? rand(0.95, 1.48) : rand(1.25, 2.05);
            this._aimedShot(e, player, proj, 'orb');
            if ((earlyBarrage && Math.random() < 0.34) || (this.difficultyWave >= 6 && Math.random() < 0.32)) {
              this._scheduleShot(earlyBarrage ? 0.135 : 0.15, () => e.alive && !e.dying && this._aimedShot(e, player, proj, 'orb', earlyBarrage ? 0.85 : 1.05));
            }
          }
          break;
        }
        case 'relaydrone': {
          const closeK = clamp((p.z + 180) / 145, 0, 1);
          const ang = e.age * 2.5 + e.phase;
          p.x = e.x0 + Math.sin(ang) * (e.amp + 13) * (1 - closeK * 0.18);
          p.y = clamp(e.y0 + Math.sin(ang * 2) * 7.5, 9, 76);
          e.mesh.rotation.y += dt * 2.2;
          e.mesh.rotation.z = Math.cos(ang) * 0.52;
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -250 && p.z < -28) {
            e.fireCd = rand(1.3, 1.95);
            this._aimedShot(e, player, proj, 'plasma');
            if (this.difficultyWave >= 7 && Math.random() < 0.32) this._scheduleShot(0.14, () => e.alive && !e.dying && this._aimedShot(e, player, proj, 'plasma'));
          }
          break;
        }
        case 'lancer': {
          // Aggressive wing-over swoop cutting diagonally across the player's nose at close range!
          const enter = clamp(e.age * 0.85, 0, 1);
          const prevX = p.x;
          const cross = Math.sin(e.age * 2.7 + e.phase) * (e.lingering ? 24 : 11);
          p.x = e.side * 126 * (1 - enter) + e.x0 * enter + cross;
          p.y = clamp(e.y0 + Math.cos(e.age * 2.2 + e.phase) * 8.5, 9, 76);
          e.mesh.lookAt(this._targetPosition(e, player, _v1));
          e.mesh.rotation.z = clamp(-e.side * (1 - enter) * 0.95 + (prevX - p.x) * 0.14, -1.15, 1.15);
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -245 && p.z < -28) {
            e.fireCd = earlyBarrage ? rand(1.2, 1.85) : rand(1.55, 2.4);
            const shots = earlyBarrage ? 2 : this.difficultyWave >= 8 ? 3 : 2;
            for (let k = 0; k < shots; k++) {
              if (k === 0) this._aimedShot(e, player, proj, 'bolt', earlyBarrage ? 1.0 : 1.25);
              else this._scheduleShot(k * 0.12, () => e.alive && !e.dying && this._aimedShot(e, player, proj, 'bolt', earlyBarrage ? 1.0 : 1.25));
            }
          }
          break;
        }
        case 'pod': {
          p.x = e.x0 + Math.sin(e.age * 1.05 + e.phase) * 10;
          p.y = clamp(e.y0 + Math.cos(e.age * 1.35 + e.phase) * 5.0, 10, 74);
          e.mesh.rotation.y += dt * 1.85;
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -245 && p.z < -34) {
            e.fireCd = earlyBarrage ? 1.95 : 2.3;
            const spin = e.age * 0.65;
            const spokes = earlyBarrage ? 8 : this.difficultyWave >= 7 ? 9 : 8;
            for (let k = 0; k < spokes; k++) {
              const a = (k / spokes) * TAU + spin;
              _v1.set(Math.cos(a) * 36, Math.sin(a) * 36, 36);
              proj.fireEnemy(p, _v1, 'plasma');
            }
            if (this.difficultyWave >= 4) this._aimedShot(e, player, proj, 'homing');
          }
          break;
        }
        case 'turret': {
          _v1.set(player.x, player.y, PLAYER_Z).sub(p);
          e.mesh.rotation.y = Math.atan2(_v1.x, _v1.z) + Math.PI;
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -270 && p.z < -34) {
            e.fireCd = earlyBarrage ? rand(1.35, 2.05) : rand(1.65, 2.5);
            this._aimedShot(e, player, proj, 'heavy', earlyBarrage ? 1.12 : 1.38);
            if (earlyBarrage || this.difficultyWave >= 6) this._scheduleShot(earlyBarrage ? 0.22 : 0.175, () => e.alive && !e.dying && this._aimedShot(e, player, proj, 'heavy', earlyBarrage ? 1.05 : 1.45));
          }
          break;
        }
        case 'mine': {
          _v1.set(player.x, player.y, PLAYER_Z).sub(p).normalize().multiplyScalar(9);
          p.x += _v1.x * dt; p.y += _v1.y * dt;
          e.mesh.rotation.x += dt * 2.1; e.mesh.rotation.y += dt * 1.4;
          const pulse = (1 + Math.sin(e.age * 8) * 0.1) * e.baseScale;
          e.mesh.scale.setScalar(pulse);
          _v2.set(player.x, player.y, PLAYER_Z);
          if (p.distanceTo(_v2) < 8.5 && player.invuln <= 0 && !player.rolling) {
            game.explodeAt(p, false);
            game.damagePlayer(12, 'mine');
            this.kill(e, false);
            continue;
          }
          break;
        }
        case 'ray': {
          // Graceful Lissajous figure-8 manta swoop diving boldly close across the nose!
          const u = e.age * 1.75 + e.phase;
          const prevX = p.x;
          p.x = e.x0 + Math.sin(u) * (e.amp + 22);
          p.y = clamp(e.y0 + Math.sin(u * 2.0) * 10.5, 9, 76);
          e.mesh.rotation.z = clamp((prevX - p.x) * 0.16, -1.05, 1.05);
          if (e.mesh.userData.body) e.mesh.userData.body.rotation.x = Math.sin(e.age * 7) * 0.26;
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -185 && p.z < -34) {
            e.fireCd = rand(1.9, 2.8);
            this._aimedShot(e, player, proj, 'plasma', 0.9);
          }
          break;
        }
        case 'gunship': {
          if (!e.wp) { e.wp = new THREE.Vector3(); e.wpT = 0; }
          e.wpT -= dt;
          if (e.wpT <= 0) {
            e.wpT = rand(2.0, 3.0);
            e.wp.set(clamp(player.x + (Math.random() < 0.5 ? 1 : -1) * rand(32, 66), -125, 125), clamp(player.y + rand(-10, 14), 14, 72), clamp(p.z, -145, -60));
          }
          p.x = damp(p.x, e.wp.x, 1.15, dt);
          p.y = damp(p.y, e.wp.y, 1.15, dt);
          e.mesh.rotation.z = damp(e.mesh.rotation.z, (e.wp.x - p.x) * 0.012, 4, dt);
          e.mesh.lookAt(this._targetPosition(e, player, _v1));
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -270 && p.z < -30) {
            e.fireCd = rand(1.45, 2.15);
            for (const s of [1, -1]) {
              _v2.copy(p); _v2.x += s * 4.8;
              _v1.set(player.x, player.y, PLAYER_Z).sub(_v2);
              proj.fireEnemy(_v2.clone(), _v1.clone(), 'heavy');
            }
            if (this.difficultyWave >= 7 && Math.random() < 0.35) {
              for (let k = -1; k <= 1; k++) { _v1.set(player.x + k * 22, player.y, PLAYER_Z).sub(p); proj.fireEnemy(p, _v1.clone(), 'venom'); }
            }
          }
          break;
        }
        case 'seeker': {
          // Aggressive close-range interceptor: dives right up to your nose, then loops!
          if (!e.wp) { e.wp = new THREE.Vector3(); e.aiState = 'dive'; e.wpT = 0; }
          e.wpT -= dt;
          if (e.wpT <= 0) {
            if (e.aiState === 'dive') {
              e.aiState = 'loop'; e.wpT = rand(0.95, 1.5);
              e.wp.set(clamp(player.x + rand(-85, 85), -145, 145), rand(28, 72), rand(-155, -108));
            } else {
              e.aiState = 'dive'; e.wpT = rand(1.15, 1.75);
              e.wp.set(player.x + rand(-18, 18), player.y + rand(-7, 12), PLAYER_Z - rand(16, 32));
            }
          }
          const acc = e.aiState === 'dive' ? 1.45 : 1.15;
          p.x = damp(p.x, e.wp.x, acc, dt);
          p.y = damp(p.y, e.wp.y, acc, dt);
          p.z = damp(p.z, e.wp.z, acc * 1.1, dt);
          e.mesh.lookAt(_v1.copy(e.wp));
          e.mesh.rotation.z += Math.sin(e.age * 9) * 0.05;
          e.fireCd -= dt;
          if (e.fireCd <= 0 && e.aiState === 'dive' && p.z > -240 && p.z < -30) {
            e.fireCd = rand(1.35, 2.0);
            this._aimedShot(e, player, proj, 'homing');
          }
          break;
        }
        case 'sniper': {
          // Close-mid marksman: holds clearly visible at z ∈ [-175, -90] so you can duel it!
          if (!e.wp) { e.wp = new THREE.Vector3(p.x, p.y, p.z); e.wpT = 0; }
          const tooClose = p.z > PLAYER_Z - 64;
          e.wpT -= dt;
          if (e.wpT <= 0 || tooClose) {
            e.wpT = rand(1.8, 2.8);
            const targetZ = tooClose ? rand(-155, -110) : rand(-168, -92);
            e.wp.set(clamp(player.x + rand(-72, 72), -140, 140), clamp(player.y + rand(-14, 24), 14, 72), targetZ);
          }
          p.x = damp(p.x, e.wp.x, tooClose ? 3.0 : 1.5, dt);
          p.y = damp(p.y, e.wp.y, tooClose ? 3.0 : 1.5, dt);
          p.z = damp(p.z, e.wp.z, tooClose ? 3.2 : 1.45, dt);
          if (e.mesh.userData.ring) e.mesh.userData.ring.rotation.z += dt * 1.8;
          e.mesh.lookAt(this._targetPosition(e, player, _v1));
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -250 && p.z < -42 && !tooClose) {
            e.fireCd = rand(1.75, 2.6);
            const shots = this.difficultyWave >= 8 ? 3 : 2;
            for (let k = 0; k < shots; k++) {
              if (k === 0) this._aimedShot(e, player, proj, 'bolt', 1.05);
              else this._scheduleShot(k * 0.125, () => e.alive && !e.dying && this._aimedShot(e, player, proj, 'bolt', 1.05));
            }
          }
          break;
        }
        case 'strafer': {
          if (!e.wp) { e.wp = new THREE.Vector3(); e.wpT = 0; }
          e.wpT -= dt;
          if (e.wpT <= 0) {
            e.wpT = rand(0.9, 1.5);
            e.wp.set(clamp(player.x + rand(-95, 95), -145, 145), clamp(player.y + rand(-16, 30), 12, 76), p.z);
          }
          const prevX = p.x;
          p.x = damp(p.x, e.wp.x, 1.25, dt);
          p.y = damp(p.y, e.wp.y, 1.15, dt);
          e.mesh.lookAt(this._targetPosition(e, player, _v1));
          e.mesh.rotation.z = clamp((p.x - prevX) * -6, -1.1, 1.1);
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -260 && p.z < -34) {
            e.fireCd = rand(1.4, 2.05);
            const shots = this.difficultyWave >= 8 ? 3 : 2;
            for (let k = 0; k < shots; k++) {
              if (k === 0) this._aimedShot(e, player, proj, 'bolt', 1.08);
              else this._scheduleShot(k * 0.125, () => e.alive && !e.dying && this._aimedShot(e, player, proj, 'bolt', 1.08));
            }
            if (this.difficultyWave >= 7 && Math.random() < 0.2) this._aimedShot(e, player, proj, 'shard', 1.2);
          }
          break;
        }
        case 'bomber': {
          p.x = e.x0 + Math.sin(e.age * 0.55 + e.phase) * 18;
          p.y = e.y0 + Math.sin(e.age * 0.65) * 4;
          e.mesh.rotation.y = Math.sin(e.age * 0.3) * 0.12;
          e.mesh.rotation.z = Math.cos(e.age * 0.55) * 0.14;
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -260 && p.z < -38) {
            e.fireCd = rand(2.1, 3.0);
            for (let k = -1; k <= 1; k++) { _v1.set(player.x + k * 20, player.y, PLAYER_Z).sub(p); proj.fireEnemy(p, _v1, 'plasma'); }
            if (this.difficultyWave >= 8 && Math.random() < 0.3) this._aimedShot(e, player, proj, 'wave');
          }
          break;
        }
        case 'flak': {
          const head = e.mesh.userData.head;
          _v1.set(player.x, player.y, PLAYER_Z).sub(p);
          if (head) head.rotation.y = damp(head.rotation.y, Math.atan2(_v1.x, _v1.z) + Math.PI, 4, dt);
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -280 && p.z < -28) {
            e.fireCd = rand(2.0, 2.8);
            const shots = this.difficultyWave >= 8 ? 3 : 2;
            for (let k = 0; k < shots; k++) {
              if (k === 0) this._aimedShot(e, player, proj, 'flak', 1.3);
              else this._scheduleShot(k * 0.17, () => e.alive && !e.dying && this._aimedShot(e, player, proj, 'flak', 1.3));
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
            e.fireCd = rand(2.6, 3.5);
            const muzzle = e.mesh.userData.muzzle;
            const origin = muzzle ? muzzle.getWorldPosition(_v2).clone() : p.clone().add(new THREE.Vector3(0, 9, -5));
            const shots = this.difficultyWave >= 8 ? 3 : 2;
            for (let k = 0; k < shots; k++) {
              if (k === 0) this._aimedShot(e, player, proj, 'flak', 1.4, origin);
              else this._scheduleShot(k * 0.19, () => e.alive && !e.dying && this._aimedShot(e, player, proj, 'flak', 1.4, origin));
            }
          }
          break;
        }
        case 'hovertank': {
          p.x = e.x0 + Math.sin(e.age * 0.8 + e.phase) * (e.amp + 8);
          p.y = e.y0 + Math.sin(e.age * 3) * 0.5;
          const turret = e.mesh.userData.turret;
          if (turret) { _v1.set(player.x, player.y, PLAYER_Z).sub(p); turret.rotation.y = damp(turret.rotation.y, Math.atan2(_v1.x, _v1.z) + Math.PI, 5, dt); }
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -280 && p.z < -28) {
            e.fireCd = rand(1.8, 2.5);
            for (let k = -1; k <= 1; k += 2) { _v1.set(player.x + k * 18, player.y, PLAYER_Z).sub(p); proj.fireEnemy(p, _v1, 'heavy'); }
          }
          break;
        }
        case 'launcher': {
          const rack = e.mesh.userData.rack;
          if (rack) rack.rotation.z = Math.sin(e.age * 1.5) * 0.12;
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -280 && p.z < -28) {
            e.fireCd = rand(2.9, 3.9);
            const missiles = this.difficultyWave >= 8 ? 3 : 2;
            for (let k = 0; k < missiles; k++) this._scheduleShot(k * 0.22, () => {
              if (!e.alive || e.dying) return;
              _v2.set(p.x + rand(-2, 2), p.y + 3, p.z);
              _v1.set(player.x, player.y, PLAYER_Z).sub(_v2);
              proj.fireEnemy(_v2, _v1, 'missile');
            });
          }
          break;
        }
        case 'saucer': {
          if (!e.wp) { e.wp = new THREE.Vector3(p.x, p.y, p.z); e.wpT = 0; }
          e.wpT -= dt;
          if (e.wpT <= 0) {
            e.wpT = rand(0.75, 1.45);
            e.wp.set(clamp(player.x + rand(-100, 100), -145, 145), rand(16, 72), rand(-165, -55));
          }
          p.x = damp(p.x, e.wp.x, 1.85, dt);
          p.y = damp(p.y, e.wp.y, 1.85, dt);
          p.z = damp(p.z, e.wp.z, 1.7, dt);
          e.mesh.rotation.y += dt * 2.4;
          e.mesh.rotation.z = Math.sin(e.age * 3) * 0.14;
          if (e.mesh.userData.lights) e.mesh.userData.lights.rotation.y -= dt * 5;
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -230 && p.z < -42) {
            e.fireCd = rand(1.65, 2.5);
            this._aimedShot(e, player, proj, 'wave');
            if (this.difficultyWave >= 7 && Math.random() < 0.35) this._aimedShot(e, player, proj, 'plasma');
          }
          break;
        }
        case 'carrier': {
          p.x = e.x0 + Math.sin(e.age * 0.32 + e.phase) * 14;
          p.y = e.y0 + Math.sin(e.age * 0.5) * 3;
          e.mesh.rotation.z = Math.cos(e.age * 0.4) * 0.06;
          e.launchCd = (e.launchCd ?? rand(1.8, 3.2)) - dt;
          if (e.launchCd <= 0 && p.z > -270 && p.z < -65) {
            e.launchCd = rand(7.0, 9.8);
            for (let k = 0; k < (this.difficultyWave >= 9 ? 2 : 1); k++) this.spawn('drone', { x: p.x + rand(-8, 8), y: Math.max(8, p.y - 4), z: p.z - 8, speed: 1.05 });
            game.hud?.alert?.('⚠ FIGHTERS LAUNCHED', 1.2);
          }
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -265 && p.z < -45) {
            e.fireCd = rand(1.75, 2.65);
            this._aimedShot(e, player, proj, 'heavy', 1.35);
          }
          break;
        }
        case 'skyraider': {
          p.x = e.x0 + Math.sin(e.age * 0.28 + e.phase) * 18;
          p.y = e.y0 + Math.sin(e.age * 0.55) * 4;
          e.mesh.rotation.z = Math.cos(e.age * 0.35) * 0.07;
          e.launchCd = (e.launchCd ?? rand(1.8, 3.4)) - dt;
          if (e.launchCd <= 0 && p.z > -270 && p.z < -65) {
            e.launchCd = rand(7.5, 10.5);
            for (let k = 0; k < (this.difficultyWave >= 10 ? 2 : 1); k++) this.spawn('relaydrone', { x: p.x + rand(-10, 10), y: Math.max(10, p.y - 5), z: p.z - 10, speed: 1.05 });
            game.hud?.alert?.('⚠ RELAY DRONES LAUNCHED', 1.2);
          }
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -265 && p.z < -45) {
            e.fireCd = rand(1.9, 2.8);
            this._aimedShot(e, player, proj, 'heavy', 1.25);
            if (this.difficultyWave >= 10 && Math.random() < 0.35) this._aimedShot(e, player, proj, 'plasma');
          }
          break;
        }
        case 'scout': {
          if (!e.wp) { e.wp = new THREE.Vector3(p.x, p.y, p.z); e.wpT = 0; }
          e.wpT -= dt;
          if (e.wpT <= 0) {
            e.wpT = rand(1.8, 2.8);
            e.wp.set(clamp(player.x + rand(-78, 78), -145, 145), clamp(player.y + rand(-12, 26), 12, 72), p.z);
          }
          p.x = damp(p.x, e.wp.x, 1.35, dt);
          p.y = damp(p.y, e.wp.y, 1.25, dt);
          e.mesh.rotation.y += dt * 0.9;
          e.mesh.rotation.z = Math.sin(e.age * 1.4) * 0.16;
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -260 && p.z < -36) {
            e.fireCd = rand(1.55, 2.3);
            this._aimedShot(e, player, proj, 'orb');
          }
          break;
        }
        case 'fighter':
        case 'skytalon': {
          // Aggressive close-quarters dogfighters: alternate high-G cross-overs & diving scissor passes!
          if (!e.wp) { e.wp = new THREE.Vector3(p.x, p.y, p.z); e.wpT = 0; }
          e.wpT -= dt;
          if (e.wpT <= 0) {
            e.wpT = rand(0.95, 1.55);
            e.side = -e.side;
            e.wp.set(
              clamp(player.x + e.side * rand(28, 76), -142, 142),
              clamp(player.y + rand(e.type === 'skytalon' ? -14 : -10, e.type === 'skytalon' ? 20 : 24), 10, 76),
              p.z
            );
          }
          const pvx = p.x;
          p.x = damp(p.x, e.wp.x, e.type === 'skytalon' ? 2.45 : 1.95, dt);
          p.y = damp(p.y, e.wp.y, e.type === 'skytalon' ? 2.1 : 1.75, dt);
          e.mesh.lookAt(this._targetPosition(e, player, _v1));
          e.mesh.rotation.z = clamp((p.x - pvx) * -5.5, -1.15, 1.15);
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -255 && p.z < -28) {
            e.fireCd = e.type === 'skytalon' ? rand(1.65, 2.35) : rand(1.45, 2.15);
            const shots = e.type === 'skytalon' ? 2 : (this.difficultyWave >= 7 ? 2 : 1);
            for (let k = 0; k < shots; k++) {
              if (k === 0) this._aimedShot(e, player, proj, 'bolt', e.type === 'skytalon' ? 1.15 : 1.08);
              else this._scheduleShot(k * (e.type === 'skytalon' ? 0.175 : 0.15), () => e.alive && !e.dying && this._aimedShot(e, player, proj, 'bolt', e.type === 'skytalon' ? 1.15 : 1.08));
            }
          }
          break;
        }
        case 'harrier': {
          // Steep swoop-and-climb interceptor diving right down to player altitude!
          if (!e.wp) { e.wp = new THREE.Vector3(p.x, p.y, p.z); e.wpT = 0; }
          e.wpT -= dt;
          if (e.wpT <= 0) {
            e.wpT = rand(0.85, 1.35);
            const dive = p.y > player.y + 8;
            e.wp.set(clamp(player.x + rand(-48, 48), -136, 136), clamp(dive ? player.y + rand(-6, 6) : player.y + rand(18, 38), 11, 80), p.z);
          }
          const oldX = p.x, oldY = p.y;
          p.x = damp(p.x, e.wp.x, 2.4, dt);
          p.y = damp(p.y, e.wp.y, 2.45, dt);
          e.mesh.lookAt(this._targetPosition(e, player, _v1));
          e.mesh.rotation.x = clamp((p.y - oldY) * 0.14, -0.6, 0.6);
          e.mesh.rotation.z = clamp((oldX - p.x) * 4.5, -1.05, 1.05);
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -255 && p.z < -30) {
            e.fireCd = rand(1.45, 2.1);
            for (let k = -1; k <= 1; k++) {
              if (k === -1) this._aimedShot(e, player, proj, 'shard', 1.2);
              else this._scheduleShot((k + 1) * 0.105, () => e.alive && !e.dying && this._aimedShot(e, player, proj, 'shard', 1.2));
            }
          }
          break;
        }
        case 'phantom': {
          // Phase-shifting striker: telegraphed violet phase-dash lateral blinks!
          e.dashCd -= dt;
          if (e.dashCd <= 0 && p.z > -230 && p.z < -42) {
            e.dashCd = rand(2.1, 3.0);
            const dashDir = p.x > player.x ? -1 : 1;
            game?.particles?.weaponTelegraph?.(p.x, p.y, p.z, 0xb886ff, 1.4);
            e.x0 = clamp(e.x0 + dashDir * rand(30, 44), -135, 135);
            e.evadeT = 0.42;
            e.evadeDir = dashDir;
            e.evadeSpin = dashDir * TAU;
          }
          const stride = Math.sin(e.age * 2.8 + e.phase);
          p.x = damp(p.x, e.x0 + stride * (e.amp + 26), 4.8, dt);
          p.y = clamp(e.y0 + Math.cos(e.age * 2.1 + e.phase) * 10, 10, 76);
          e.baseScale = (e.mesh.userData.meshScale ?? 1) * (0.94 + (Math.sin(e.age * 8) + 1) * 0.05);
          e.mesh.rotation.z = Math.cos(e.age * 2.8 + e.phase) * 0.56;
          e.mesh.lookAt(this._targetPosition(e, player, _v1));
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -255 && p.z < -30) {
            e.fireCd = rand(1.7, 2.45);
            this._aimedShot(e, player, proj, 'homing', 1.1);
            this._scheduleShot(0.16, () => e.alive && !e.dying && this._aimedShot(e, player, proj, 'venom', 1.05));
          }
          break;
        }
        case 'dreadwing': {
          p.x = e.x0 + Math.sin(e.age * 0.28 + e.phase) * 22;
          p.y = e.y0 + Math.sin(e.age * 0.42) * 5;
          e.mesh.rotation.z = Math.cos(e.age * 0.3) * 0.08;
          e.launchCd = (e.launchCd ?? rand(2.2, 4.0)) - dt;
          if (e.launchCd <= 0 && p.z > -280 && p.z < -70) {
            e.launchCd = rand(8.0, 11.0);
            this.spawn('harrier', { x: p.x - 10, y: Math.max(16, p.y - 3), z: p.z - 12, speed: 1.12 });
            this.spawn('phantom', { x: p.x + 10, y: Math.max(20, p.y + 2), z: p.z - 16, speed: 0.92 });
            game.hud?.alert?.('⚠ PHASE ESCORTS DEPLOYED', 1.25);
          }
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -275 && p.z < -42) {
            e.fireCd = rand(1.9, 2.8);
            for (const s of [-1, 1]) {
              _v2.set(p.x + s * 8, p.y, p.z);
              _v1.set(player.x + s * 10, player.y, PLAYER_Z).sub(_v2);
              proj.fireEnemy(_v2, _v1, 'missile');
            }
            this._aimedShot(e, player, proj, 'heavy', 1.2);
          }
          break;
        }
        case 'siegecarrier': {
          p.x = e.x0 + Math.sin(e.age * 0.24 + e.phase) * 24;
          p.y = e.y0 + Math.sin(e.age * 0.46 + e.phase) * 5;
          e.mesh.rotation.z = Math.cos(e.age * 0.28 + e.phase) * 0.07;
          e.mesh.lookAt(this._targetPosition(e, player, _v1));
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
            e.fireCd = rand(3.0, 4.0);
            e.siegeTelegraph = false;
            game.particles?.flash(p.x, p.y, p.z - 10, 1.25, 0xffb36a);
            game.particles?.ring(p.x, p.y, p.z - 10, { color: 0xff8a4a, from: 2.5, radius: 22, dur: 0.52, opacity: 0.42 });
            game.particles?.emit(p.x, p.y, p.z - 10, { count: 16, speed: 30, color: 0xffe2a2, color2: 0xff5a24, life: 0.42, size: 3.6, drag: 2.6, spread: 1.8 });
            this._siegeShot(e, player, proj, game, -1, 'heavy');
            this._scheduleShot(0.25, () => e.alive && !e.dying && this._siegeShot(e, player, proj, game, 1, 'heavy'));
            this._scheduleShot(0.52, () => e.alive && !e.dying && this._siegeShot(e, player, proj, game, 0, 'wave'));
          }
          break;
        }
        case 'quadtank': {
          p.x = e.x0 + Math.sin(e.age * 0.45 + e.phase) * (e.amp + 6);
          p.y = e.y0 + Math.sin(e.age * 2.4) * 0.4;
          _v1.set(player.x, player.y, PLAYER_Z).sub(p);
          e.mesh.rotation.y = damp(e.mesh.rotation.y, Math.atan2(_v1.x, _v1.z) + Math.PI, 2.4, dt);
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -280 && p.z < -28) {
            e.fireCd = rand(2.0, 2.9);
            for (let k = -1; k <= 1; k += 2) { _v2.set(player.x + k * 18, player.y, PLAYER_Z).sub(p); proj.fireEnemy(p, _v2, 'heavy'); }
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
            e.fireCd = heavy ? rand(1.95, 2.8) : rand(2.1, 3.0);
            const shots = heavy ? (this.difficultyWave >= 9 ? 3 : 2) : 2;
            for (let k = 0; k < shots; k++) {
              if (k === 0) this._aimedShot(e, player, proj, heavy ? 'flak' : 'heavy', 1.2);
              else this._scheduleShot(k * 0.18, () => e.alive && !e.dying && this._aimedShot(e, player, proj, heavy ? 'flak' : 'heavy', 1.2));
            }
          }
          break;
        }
        case 'mech': {
          p.x = e.x0 + Math.sin(e.age * 0.3 + e.phase) * 10;
          p.y = e.y0 + Math.abs(Math.sin(e.age * 2.2)) * 1.4;
          _v1.set(player.x, player.y, PLAYER_Z).sub(p);
          e.mesh.rotation.y = damp(e.mesh.rotation.y, Math.atan2(_v1.x, _v1.z) + Math.PI, 1.8, dt);
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -285 && p.z < -28) {
            e.fireCd = rand(2.6, 3.6);
            for (let k = 0; k < 2; k++) this._scheduleShot(k * 0.22, () => {
              if (!e.alive || e.dying) return;
              _v2.set(p.x + rand(-4, 4), p.y + 6, p.z);
              _v1.set(player.x, player.y, PLAYER_Z).sub(_v2);
              proj.fireEnemy(_v2, _v1, 'missile');
            });
          }
          break;
        }
        case 'gunboat':
        case 'frigate': {
          const big = e.type === 'frigate';
          p.x = e.x0 + Math.sin(e.age * 0.22 + e.phase) * 12;
          p.y = e.y0 + Math.sin(e.age * 0.9 + e.phase) * (big ? 1.2 : 0.9);
          e.mesh.rotation.z = Math.sin(e.age * 0.9 + e.phase) * 0.05;
          e.mesh.rotation.y = damp(e.mesh.rotation.y, Math.sin(e.age * 0.22 + e.phase) * 0.3, 1.5, dt);
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -295 && p.z < -36) {
            e.fireCd = big ? rand(1.4, 2.0) : rand(1.9, 2.6);
            const guns = big ? 3 : 2;
            for (let k = 0; k < guns; k++) this._scheduleShot(k * 0.17, () => {
              if (!e.alive || e.dying) return;
              _v2.set(p.x + rand(-7, 7) * (big ? 1.6 : 1), p.y + 6, p.z);
              _v1.set(player.x + rand(-12, 12), player.y, PLAYER_Z).sub(_v2);
              proj.fireEnemy(_v2, _v1, big ? 'flak' : 'heavy');
            });
          }
          break;
        }
      }

      // Reactive evasive jink & barrel-roll when damaged in flight!
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

      if (p.z > 24) this.remove(e);
      else if ((e.type === 'seeker' || e.type === 'sniper' || e.type === 'saucer') && e.age > 20) this.remove(e);
    }
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
    const inViewBand = z > -350 && z < 12;
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

  _aimedShot(e, player, proj, type = 'orb', leadMul = 1, origin = null) {
    const p = origin ?? e.mesh.position;
    const w = e.allyTarget && e.allyTarget.hidden <= 0 && e.allyTarget.mesh.visible && e.allyTarget.hp > 0 ? e.allyTarget : null;
    const target = w ?? player;
    const targetZ = w ? w.z : PLAYER_Z;
    _v1.set(target.x + (target.vx ?? 0) * 0.11 * leadMul, target.y + (target.vy ?? 0) * 0.08 * leadMul, targetZ).sub(p);
    const shotType = w && (type === 'orb' || type === 'bolt') && Math.random() < 0.55 ? 'homing' : type;
    proj.fireEnemy(p, _v1, shotType, null, w);
  }

  _updateCombatVisual(e, dt) {
    const v = e.visual;
    if (!v) return;
    const damage = clamp(1 - e.hp / Math.max(1, e.maxHp), 0, 1);
    const t = e.age;
    const thrust = 0.88 + Math.sin(t * 24 + e.phase) * 0.12 + damage * 0.14;
    for (const glow of v.engineGlows) {
      const base = glow.userData.baseScale ?? (glow.userData.baseScale = glow.scale.x);
      glow.scale.setScalar(base * thrust);
      glow.material.opacity = 0.78 + Math.sin(t * 18 + e.phase) * 0.14;
    }
    for (const plume of v.enginePlumes) {
      const len = (e.lingering ? 0.72 : 1.15) * (0.88 + Math.sin(t * 46 + e.phase) * 0.16);
      plume.scale.set(1, 1, len);
    }
    for (const collar of v.engineCollars) collar.rotation.z += dt * (2.0 + e.speed * 0.7);
    const critical = clamp((damage - 0.35) / 0.65, 0, 1);
    const attackBand = e.mesh.position.z > -270 && e.mesh.position.z < -30;
    const imminent = attackBand && e.fireCd > 0 && e.fireCd < 0.45;
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

  clear() {
    for (const e of [...this.list]) this.remove(e);
    this.queue.length = 0;
    this._pendingShots.length = 0;
    this.eliteTimer = rand(5.5, 9.0);
  }
}
