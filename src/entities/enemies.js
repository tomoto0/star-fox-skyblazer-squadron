import * as THREE from 'three';
import { buildDrone, buildLancer, buildPod, buildTurret, buildMine, buildRay, buildGunship, buildSeeker, buildSniper, buildStrafer, buildBomber, buildFlak, buildAABattery, buildHovertank, buildLauncher, buildSaucer, buildCarrier, buildSiegeCarrier, SHIP_MODELS } from './shipFactory.js';
import { rand, pick, clamp, damp, TAU, _v1, _v2, dotTexture } from '../core/util.js';
import { PLAYER_Z } from './player.js';
import { audio } from '../core/audio.js';

const SPAWN_Z = -560;
// The scripted formations are intentionally scaled by progression, not globally.
// Early waves teach spacing and evasion; late waves gain density without sudden walls.
const FORMATION_SCALE = [null, 1.08, 1.10, 1.14, 1.10, 1.10, 1.16, 1.18, 1.18, 1.24, 1.24, 1.30, 1.30, 1.30, 1.30, 1.30, 1.30];

/* Enemies are slower and easier to line up than before, so HP is raised across
 * the board to keep them a real threat (bosses are tuned separately). */
const STATS = {
  drone: { hp: 3, r: 2.8, score: 10 },
  lancer: { hp: 5, r: 3.0, score: 30 },
  pod: { hp: 11, r: 3.2, score: 50 },
  turret: { hp: 8, r: 3.6, score: 40 },
  mine: { hp: 2, r: 2.4, score: 20 },
  ray: { hp: 5, r: 3.4, score: 30 },
  // elite random-spawn types
  gunship: { hp: 26, r: 4.8, score: 140 },
  seeker: { hp: 8, r: 3.0, score: 60 },
  sniper: { hp: 10, r: 3.2, score: 80 },
  strafer: { hp: 8, r: 3.0, score: 70 },
  bomber: { hp: 18, r: 4.4, score: 120 },
  saucer: { hp: 12, r: 3.8, score: 110 },
  // CC0 external-model enemies: mobile relay carrier and its escort drone
  skyraider: { hp: 42, r: 6.6, score: 360 },
  relaydrone: { hp: 9, r: 3.6, score: 120 },
  carrier: { hp: 34, r: 5.8, score: 200 },
  // ground-deployed types
  flak: { hp: 14, r: 3.8, score: 90, ground: true },
  hovertank: { hp: 16, r: 4.0, score: 100, ground: true },
  launcher: { hp: 12, r: 3.6, score: 90, ground: true },
  aabattery: { hp: 28, r: 6.1, score: 340, ground: true },    // fixed anti-air interception base
  /* ---- expansion-pack enemies (bigger models, tankier) ---- */
  scout: { hp: 7, r: 3.6, score: 90 },                          // air — swooping eye drone
  fighter: { hp: 14, r: 4.4, score: 160 },                      // air — strafing fighter
  skytalon: { hp: 11, r: 3.9, score: 190 },                     // air — CC0 aircraft, fast low-altitude interceptor
  harrier: { hp: 12, r: 3.9, score: 180 },                      // air — fast dive-bomber
  phantom: { hp: 16, r: 4.1, score: 250 },                      // air — phase interceptor
  dreadwing: { hp: 58, r: 7.2, score: 980 },                    // air — heavy wing carrier
  quadtank: { hp: 30, r: 5.2, score: 320, ground: true },       // ground — hover tank
  trilobite: { hp: 26, r: 5.4, score: 300, ground: true },      // emplaced turret
  cannon: { hp: 18, r: 4.0, score: 220, ground: true },         // mobile cannon
  shorecannon: { hp: 16, r: 3.8, score: 210, ground: true },    // shoreline cannon
  gunboat: { hp: 46, r: 8.5, score: 650, ground: true },        // surface warship
  frigate: { hp: 70, r: 11.0, score: 1100, ground: true },      // heavy surface frigate
  mech: { hp: 52, r: 6.4, score: 900, ground: true },           // heavy walker
  siegecarrier: { hp: 82, r: 10.2, score: 1450 },                // air — Aegis command capital ship
};

const BUILDERS = {
  drone: buildDrone, lancer: buildLancer, pod: buildPod, turret: buildTurret, mine: buildMine, ray: buildRay,
  gunship: buildGunship, seeker: buildSeeker, sniper: buildSniper,
  strafer: buildStrafer, bomber: buildBomber, flak: buildFlak, aabattery: buildAABattery, hovertank: buildHovertank, launcher: buildLauncher,
  saucer: buildSaucer, carrier: buildCarrier,
  skyraider: buildCarrier, relaydrone: buildDrone,
  // expansion types are model-only; these are just load-time fallbacks
  scout: buildDrone, fighter: buildStrafer, skytalon: buildStrafer, harrier: buildLancer, phantom: buildSeeker, dreadwing: buildSiegeCarrier,
  quadtank: buildHovertank, trilobite: buildFlak,
  cannon: buildFlak, shorecannon: buildTurret, gunboat: buildCarrier, frigate: buildCarrier, mech: buildLauncher,
  siegecarrier: buildSiegeCarrier,
};
const ELITES = ['seeker', 'sniper', 'gunship'];
const HEAVY_TYPES = new Set(['skyraider', 'carrier', 'gunship', 'bomber', 'dreadwing', 'frigate', 'gunboat', 'mech', 'quadtank', 'trilobite', 'siegecarrier']);
const ELITE_TYPES = new Set(['seeker', 'sniper', 'strafer', 'fighter', 'skytalon', 'harrier', 'phantom', 'saucer', 'scout', 'relaydrone']);
// These units use the shared aimed-shot path, so their HUD LOCK state always
// corresponds to a real projectile target. Barrage-only units stay player-focused.
const ALLY_TARGET_CAPABLE = new Set([
  'drone', 'relaydrone', 'lancer', 'turret', 'seeker', 'sniper', 'strafer',
  'flak', 'aabattery', 'saucer', 'carrier', 'skyraider', 'scout', 'fighter', 'skytalon', 'harrier',
  'phantom', 'trilobite', 'cannon', 'shorecannon', 'siegecarrier',
]);

const MARKER_TEXTURES = new Map();
function markerTexture(label) {
  if (MARKER_TEXTURES.has(label)) return MARKER_TEXTURES.get(label);
  const c = document.createElement('canvas');
  c.width = 256; c.height = 72;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.lineWidth = 5; ctx.strokeStyle = '#ffffff';
  // clipped sci-fi frame: visually distinct from the round pilot portraits
  ctx.beginPath();
  ctx.moveTo(12, 25); ctx.lineTo(12, 12); ctx.lineTo(46, 12);
  ctx.moveTo(210, 12); ctx.lineTo(244, 12); ctx.lineTo(244, 25);
  ctx.moveTo(12, 47); ctx.lineTo(12, 60); ctx.lineTo(46, 60);
  ctx.moveTo(210, 60); ctx.lineTo(244, 60); ctx.lineTo(244, 47);
  ctx.stroke();
  ctx.font = '700 29px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff'; ctx.fillText(label, 128, 37);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  MARKER_TEXTURES.set(label, t);
  return t;
}

function markerProfile(type, ground = false) {
  if (type === 'mine') return { label: 'MINE', color: 0xff3158, scale: 0.86, y: 7, class: 'mine' };
  if (type === 'siegecarrier') return { label: 'SIEGE', color: 0xffa34d, scale: 1.56, y: 22, class: 'heavy' };
  if (HEAVY_TYPES.has(type)) return { label: 'HEAVY', color: 0xffa34d, scale: 1.34, y: 18, class: 'heavy' };
  if (ELITE_TYPES.has(type)) return { label: 'ELITE', color: 0xce82ff, scale: 1.08, y: 12, class: 'elite' };
  if (type === 'aabattery') return { label: 'AA BASE', color: 0xff8d46, scale: 1.24, y: 16, class: 'ground' };
  if (ground) return { label: 'GROUND', color: 0xffc05c, scale: 1.0, y: 10, class: 'ground' };
  return { label: 'HOSTILE', color: 0xff4e64, scale: 0.92, y: 10, class: 'hostile' };
}

export class Enemies {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.queue = [];  // delayed spawns
    this.killCount = 0;
    this.difficultyWave = 1;
  }

  get aliveCount() { return this.list.length; }

  setDifficultyWave(wave) { this.difficultyWave = clamp(wave | 0, 1, 16); }

  /** immediately spawn one enemy */
  spawn(type, opts = {}) {
    const st = STATS[type];
    // real CC0 ship model when loaded (elites); procedural builder otherwise
    const mesh = SHIP_MODELS[type] ? SHIP_MODELS[type].clone(true) : BUILDERS[type]();
    mesh.traverse((o) => o.layers.enable(1));   // lit by the enemy-only fill light
    this.scene.add(mesh);
    const e = {
      type, mesh, alive: true,
      hp: (st.hp * (opts.hpMul ?? 1)) | 0 || 1,
      maxHp: (st.hp * (opts.hpMul ?? 1)) | 0 || 1,
      radius: st.r, score: st.score,
      age: 0, fireCd: opts.fireCd ?? (this.difficultyWave <= 3 ? rand(0.55, 1.25) : rand(1.1, 2.4)),
      x0: opts.x ?? rand(-90, 90), y0: opts.y ?? rand(6, 30),
      phase: opts.phase ?? rand(TAU), amp: opts.amp ?? rand(4, 14),
      speed: opts.speed ?? 1, side: opts.side ?? (Math.random() < 0.5 ? -1 : 1),
      aggressive: opts.aggressive ?? false,
      ground: !!st.ground,
      // Enemy fire remains player-focused, but a bounded share of combatants
      // temporarily tracks a wingmate. A forced target is reserved for the
      // visible rescue event and never falls back to a silent HP drain.
      allyTarget: opts.allyTarget ?? null,
      forcedWingmate: opts.forcedWingmate ?? null,
      allyTargetT: 0,
      flash: 0,
      pos() { return this.mesh.position; },
    };
    // hover craft and surface ships ride above the deck/water line
    const HOVER = { hovertank: 3, quadtank: 2.5, gunboat: 1.5, frigate: 2 };
    if (st.ground) e.y0 = opts.y ?? (HOVER[type] ?? 0);
    mesh.position.set(e.x0, e.y0, opts.z ?? SPAWN_Z);
    if (type === 'turret') mesh.position.y = opts.y ?? 1.2;
    // Object3D.clone does not preserve reference arrays in userData reliably,
    // so resolve named visual parts on the cloned hierarchy instead.
    const frame = mesh.getObjectByName('combatFrame');
    if (frame) {
      const visual = {
        engineGlows: [], engineCollars: [], warningLights: [], weaponGlows: [], sensorRings: [],
        reactorCores: [], reactorHalos: [], heatVanes: [], dataVanes: [], muzzleCages: [], armourPlates: [], damageSmoke: null,
      };
      frame.traverse((n) => {
        if (n.name === 'combatEngineGlow') visual.engineGlows.push(n);
        else if (n.name === 'combatEngineCollar') visual.engineCollars.push(n);
        else if (n.name === 'combatWarningLight') visual.warningLights.push(n);
        else if (n.name === 'combatWeaponGlow') visual.weaponGlows.push(n);
        else if (n.name === 'combatSensorRing') visual.sensorRings.push(n);
        else if (n.name === 'combatReactorCore') visual.reactorCores.push(n);
        else if (n.name === 'combatReactorHalo') visual.reactorHalos.push(n);
        else if (n.name === 'combatHeatVane') visual.heatVanes.push(n);
        else if (n.name === 'combatDataVane') visual.dataVanes.push(n);
        else if (n.name === 'combatMuzzleCage') visual.muzzleCages.push(n);
        else if (n.name === 'combatArmourPlate') visual.armourPlates.push(n);
        else if (n.name === 'combatDamageSmoke') visual.damageSmoke = n;
      });
      e.visual = visual;
    }
    this._addMarker(e);
    this.list.push(e);
    return e;
  }

  /** queue a formation with per-ship stagger, spread across the wide field */
  formation(type, n, pattern, opts = {}) {
    const scale = opts.noScale ? 1 : (FORMATION_SCALE[this.difficultyWave] ?? 1.30);
    n = Math.max(1, Math.round(n * scale));
    // when the wave doesn't pin an x, drop the group at a random lateral anchor
    // so successive formations sweep left / centre / right across the field
    const bx = opts.x ?? rand(-215, 215);
    // occasional high-altitude squadron to use the taller vertical space
    const highY = opts.y === undefined && Math.random() < 0.34 ? rand(52, 160) : null;
    for (let i = 0; i < n; i++) {
      const o = { ...opts };
      switch (pattern) {
        case 'line': o.x = -((n - 1) / 2) * 20 + i * 20 + bx; o.y = opts.y ?? highY ?? 16; o.delay = i * 0.05; break;
        case 'vee': o.x = (i - (n - 1) / 2) * 18 + bx; o.y = (opts.y ?? highY ?? 22) - Math.abs(i - (n - 1) / 2) * 3.4; o.delay = Math.abs(i - (n - 1) / 2) * 0.1; break;
        case 'column': o.x = opts.x ?? rand(-215, 215); o.y = opts.y ?? highY ?? rand(8, 80); o.delay = i * 0.42; break;
        case 'sides': o.side = i % 2 ? 1 : -1; o.x = o.side * rand(200, 290); o.y = opts.y ?? highY ?? rand(10, 90); o.delay = Math.floor(i / 2) * 0.45; break;
        case 'wall': o.x = -((n - 1) / 2) * (580 / n) + i * (580 / n); o.y = opts.y ?? rand(12, 70); o.delay = i * 0.03; break;
        // Wing echelon: a clean diagonal read that gives the player a wide flank.
        case 'echelon': o.x = bx + (i - (n - 1) / 2) * 28; o.y = (opts.y ?? highY ?? 26) + i * 5; o.z = (opts.z ?? SPAWN_Z) - i * 17; o.delay = i * 0.12; break;
        // Pincer begins outside the central corridor, then individual attack AIs converge.
        case 'pincer': { const side = i < Math.ceil(n / 2) ? -1 : 1; const rank = i % Math.ceil(n / 2); o.side = side; o.x = side * rand(190, 245) + bx * 0.18; o.y = (opts.y ?? highY ?? 34) + rank * 13; o.z = (opts.z ?? SPAWN_Z) - rank * 24; o.delay = rank * 0.22; break; }
        default: o.delay = i * 0.22;
      }
      o.phase = (opts.phase ?? 0) + i * 0.7;
      this.queue.push({ type, opts: o, t: o.delay ?? 0 });
    }
  }

  /** Spawn a readable mixed squadron rather than a dense single-type wall. */
  taskForce(kind, opts = {}, game = null) {
    const x = opts.x ?? rand(-42, 42);
    const y = opts.y ?? 64;
    const z = opts.z ?? SPAWN_Z;
    if (kind === 'siege') {
      const flagship = this.spawn('siegecarrier', { x, y, z, speed: opts.speed ?? 0.32, hpMul: opts.hpMul ?? 1 });
      this._formationEntryFx(flagship, game, 'siege');
      const escorts = opts.escorts ?? 4;
      for (let i = 0; i < escorts; i++) {
        const side = i % 2 ? 1 : -1;
        this.queue.push({
          type: i % 3 === 2 ? 'phantom' : 'fighter',
          opts: { x: x + side * (44 + (i >> 1) * 22), y: y + (i % 2 ? 8 : -10), z: z - 30 - i * 12, side, speed: i % 3 === 2 ? 0.88 : 1.02, noScale: true },
          t: 0.45 + i * 0.24,
        });
      }
      return;
    }
    if (kind === 'pincer') {
      const count = opts.count ?? 3;
      this.formation('harrier', count, 'pincer', { x, y, z, noScale: true, speed: 1.04, entryFx: 'pincer' });
      // The support pair stays wide, preserving the central escape lane between pincers.
      this.formation('fighter', Math.max(2, count - 1), 'sides', { x, y: y + 14, z: z - 32, noScale: true, speed: 0.86, entryFx: 'pincer' });
    }
  }

  update(dt, scroll, player, proj, game) {
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

    // random elite / ground spawns during regular (non-boss) waves — ramps with wave #
    this.eliteTimer = (this.eliteTimer ?? 8) - dt;
    if (this.eliteTimer <= 0 && game.state === 'playing' && !game.boss && !game.rival?.active && !game.waveSpec?.boss && (game.wave ?? 1) >= 3) {
      const w = game.wave ?? 1;
      this.eliteTimer = Math.max(4.6, rand(10, 15) - Math.max(0, w - 3) * 0.28);
      const overWater = game.zone?.id === 'sea';
      const roll = Math.random();
      if (overWater && roll < 0.45) {
        // surface task force — warships only where there is water to float on
        const pool = ['shorecannon'];
        if (w >= 6) pool.push('gunboat');
        if (w >= 9) pool.push('gunboat', 'frigate');
        const t = pick(pool);
        this.spawn(t, { x: rand(-200, 200), z: SPAWN_Z, speed: 1.0 });
        game.hud?.alert?.(t === 'frigate' ? '⚠ FRIGATE ON THE WATER' : '⚠ SURFACE CONTACT', 1.5);
      } else if (!overWater && roll < 0.42) {
        // ground column — heavier hardware unlocks as the run goes on
        const pool = ['flak', 'hovertank', 'launcher', 'cannon'];
        if (w >= 4) pool.push('aabattery');
        if (w >= 5) pool.push('quadtank', 'trilobite');
        if (w >= 8) pool.push('mech');
        const t = pick(pool);
        const n = (t === 'hovertank' || t === 'cannon') && Math.random() < 0.5 ? 2 : 1;
        for (let k = 0; k < n; k++) this.spawn(t, { x: rand(-170, 170) + k * 30, z: SPAWN_Z, speed: 1.0 });
        game.hud?.alert?.(t === 'mech' ? '⚠ HEAVY WALKER' : t === 'aabattery' ? '⚠ AA BATTERY LOCKING' : '⚠ GROUND FORCES', 1.4);
      } else {
        // air wing — tougher elites become more likely deeper in the run
        const r = Math.random() + Math.min(w, 16) * 0.015;
        const type = w >= 15 && r > 1.16 ? 'dreadwing' : w >= 13 && r > 1.06 ? 'phantom'
          : r > 1.10 ? 'skyraider' : r > 1.00 ? 'carrier' : r > 0.88 ? 'gunship' : r > 0.74 ? 'bomber'
          : w >= 13 && r > 0.66 ? 'harrier' : r > 0.62 ? 'fighter' : w >= 7 && r > 0.54 ? 'skytalon' : r > 0.50 ? 'saucer' : r > 0.38 ? 'sniper'
          : r > 0.25 ? 'strafer' : r > 0.13 ? 'scout' : 'seeker';
        const speed = type === 'dreadwing' ? 0.30 : type === 'skyraider' ? 0.38 : type === 'carrier' ? 0.32 : type === 'gunship' ? 0.5 : type === 'bomber' ? 0.42
          : type === 'phantom' ? 0.88 : type === 'harrier' ? 1.08 : type === 'skytalon' ? 1.16 : type === 'sniper' ? 0.38 : type === 'scout' ? 0.7 : type === 'fighter' ? 0.8 : 1.0;
        this.spawn(type, { x: rand(-150, 150), y: (type === 'carrier' || type === 'skyraider' || type === 'dreadwing') ? rand(48, 104) : rand(16, 80), z: SPAWN_Z, speed });
        game.hud?.alert?.(type === 'dreadwing' ? '⚠ DREADWING CARRIER INBOUND' : type === 'phantom' ? '⚠ PHASE CONTACT' : type === 'skytalon' ? '⚠ SKY TALON INBOUND' : type === 'skyraider' ? '⚠ RELAY CARRIER INBOUND' : type === 'carrier' ? '⚠ CARRIER ON APPROACH' : '⚠ ELITE INBOUND', 1.4);
      }
    }

    const wingmates = game.wingmates?.list ?? [];
    const earlyBarrage = this.difficultyWave <= 3;
    for (const w of wingmates) w.targetedBy = 0;

    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      e.age += dt;
      this._updateCombatVisual(e, dt);
      this._assignAllyTarget(e, player, wingmates, dt);
      const p = e.mesh.position;
      // seeker / sniper / saucer drive their own z via waypoints; others scroll
      // forward (turrets & ground units ride the terrain — no extra closing speed)
      if (e.type !== 'seeker' && e.type !== 'sniper' && e.type !== 'saucer') {
        p.z += scroll * dt * e.speed + (e.type === 'turret' || e.ground ? 0 : 4 * dt);
      }

      switch (e.type) {
        case 'drone': {
          p.x = e.x0 + Math.sin(e.age * 1.7 + e.phase) * e.amp;
          p.y = e.y0 + Math.sin(e.age * 1.1 + e.phase * 2) * e.amp * 0.4;
          e.mesh.rotation.z = Math.cos(e.age * 1.7 + e.phase) * 0.5;
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -460 && p.z < -70) {
            e.fireCd = earlyBarrage ? rand(0.82, 1.34) : rand(1.35, 2.45);
            this._aimedShot(e, player, proj, 'orb');
            if ((earlyBarrage && Math.random() < 0.38) || (this.difficultyWave >= 6 && Math.random() < 0.28)) {
              setTimeout(() => e.alive && this._aimedShot(e, player, proj, 'orb', earlyBarrage ? 0.84 : 1), earlyBarrage ? 125 : 150);
            }
          }
          break;
        }
        case 'relaydrone': {
          // compact escort drone: orbiting attack run with rapid plasma bursts
          p.x = e.x0 + Math.sin(e.age * 2.1 + e.phase) * (e.amp + 8);
          p.y = e.y0 + Math.cos(e.age * 1.6 + e.phase) * 4;
          e.mesh.rotation.y += dt * 1.8;
          e.mesh.rotation.z = Math.sin(e.age * 2.1 + e.phase) * 0.35;
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -440 && p.z < -50) {
            e.fireCd = rand(1.35, 2.15);
            this._aimedShot(e, player, proj, 'plasma');
            if (this.difficultyWave >= 8 && Math.random() < 0.25) setTimeout(() => e.alive && this._aimedShot(e, player, proj, 'plasma'), 140);
          }
          break;
        }
        case 'lancer': {
          // strafe in from the side, then dash past
          const enter = clamp(e.age * 0.45, 0, 1);
          p.x = e.side * 250 * (1 - enter) + e.x0 * enter + Math.sin(e.age * 2.2) * 4;
          p.y = e.y0 + Math.sin(e.age * 1.4 + e.phase) * 3;
          p.z += 10 * dt;
          e.mesh.rotation.z = -e.side * (1 - enter) * 0.8;
          e.mesh.lookAt(this._targetPosition(e, player, _v1));
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -420 && p.z < -50) {
            e.fireCd = earlyBarrage ? rand(1.20, 1.85) : rand(1.8, 2.9);
            // A short, legible tracer burst; the early game now establishes a clear crossfire rhythm.
            const shots = earlyBarrage ? 3 : this.difficultyWave >= 8 ? 3 : 2;
            for (let k = 0; k < shots; k++) setTimeout(() => e.alive && this._aimedShot(e, player, proj, 'bolt', earlyBarrage ? 1.05 : 1.3), k * 120);
          }
          break;
        }
        case 'pod': {
          p.x = e.x0 + Math.sin(e.age * 0.7 + e.phase) * 5;
          p.y = e.y0 + Math.sin(e.age * 0.9) * 2.5;
          e.mesh.rotation.y += dt * 1.5;
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -400 && p.z < -50) {
            e.fireCd = earlyBarrage ? 1.82 : 2.35;
            const spin = e.age * 0.6;
            const spokes = earlyBarrage ? 10 : this.difficultyWave >= 7 ? 9 : 8;
            for (let k = 0; k < spokes; k++) {
              const a = (k / spokes) * TAU + spin;
              _v1.set(Math.cos(a) * 38, Math.sin(a) * 38, 30);
              proj.fireEnemy(p, _v1.clone(), 'plasma');
            }
            // Homing pressure arrives after the player has seen the readable ring pattern.
            if (this.difficultyWave >= 4) this._aimedShot(e, player, proj, 'homing');
          }
          break;
        }
        case 'turret': {
          const head = e.mesh.children[1];
          _v1.set(player.x, player.y, PLAYER_Z).sub(p);
          e.mesh.rotation.y = Math.atan2(_v1.x, _v1.z) + Math.PI;
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -460 && p.z < -50) {
            e.fireCd = earlyBarrage ? rand(1.25, 2.0) : rand(1.7, 2.7);
            // Early turrets establish readable two-shell pressure; later waves retain their existing delayed partner.
            this._aimedShot(e, player, proj, 'heavy', earlyBarrage ? 1.18 : 1.45);
            if (earlyBarrage || this.difficultyWave >= 6) setTimeout(() => e.alive && this._aimedShot(e, player, proj, 'heavy', earlyBarrage ? 1.08 : 1.6), earlyBarrage ? 210 : 170);
          }
          break;
        }
        case 'mine': {
          _v1.set(player.x, player.y, PLAYER_Z).sub(p).normalize().multiplyScalar(7);
          p.x += _v1.x * dt; p.y += _v1.y * dt;
          e.mesh.rotation.x += dt * 2; e.mesh.rotation.y += dt * 1.3;
          const pulse = 1 + Math.sin(e.age * 8) * 0.1;
          e.mesh.scale.setScalar(pulse);
          // proximity detonation
          _v2.set(player.x, player.y, PLAYER_Z);
          if (p.distanceTo(_v2) < 7 && player.invuln <= 0 && !player.rolling) {
            game.explodeAt(p, false);
            game.damagePlayer(12, 'mine');
            this.kill(e, false);
            continue;
          }
          break;
        }
        case 'ray': {
          p.x = e.x0 + Math.sin(e.age * 1.1 + e.phase) * (e.amp + 16);
          p.y = e.y0 + Math.cos(e.age * 1.6 + e.phase) * 6;
          e.mesh.rotation.z = Math.cos(e.age * 1.1 + e.phase) * 0.7;
          if (e.mesh.userData.body) e.mesh.userData.body.rotation.x = Math.sin(e.age * 6) * 0.2;
          break;
        }
        /* ---- elite random-spawn enemies: independent waypoint AIs ---- */
        case 'gunship': {
          // heavy cruiser: repositions to BROADSIDE the player, then rakes it
          // with cannon fire from its flanks. Slow, deliberate, menacing.
          if (!e.wp) { e.wp = new THREE.Vector3(); e.wpT = 0; }
          e.wpT -= dt;
          if (e.wpT <= 0) {
            e.wpT = rand(2.2, 3.4);
            e.wp.set(player.x + (Math.random() < 0.5 ? 1 : -1) * rand(55, 100), clamp(player.y + rand(-14, 18), 12, 120), clamp(p.z, -300, -60));
          }
          p.x = damp(p.x, e.wp.x, 1.0, dt);
          p.y = damp(p.y, e.wp.y, 1.0, dt);
          e.mesh.rotation.z = damp(e.mesh.rotation.z, (e.wp.x - p.x) * 0.01, 4, dt);
          e.mesh.lookAt(this._targetPosition(e, player, _v1));
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -460 && p.z < -30) {
            e.fireCd = rand(1.4, 2.1);
            for (const s of [1, -1]) {              // twin heavy cannons
              _v2.copy(p); _v2.x += s * 3.4;
              _v1.set(player.x, player.y, PLAYER_Z).sub(_v2);
              proj.fireEnemy(_v2.clone(), _v1.clone(), 'heavy');
            }
            if (this.difficultyWave >= 7 && Math.random() < 0.35) { // late-game venom spread
              for (let k = -1; k <= 1; k++) { _v1.set(player.x + k * 24, player.y, PLAYER_Z).sub(p); proj.fireEnemy(p, _v1.clone(), 'venom'); }
            }
          }
          break;
        }
        case 'seeker': {
          // fast interceptor: dives at the player, overshoots, then loops back
          // out to re-engage. Aggressive attack runs, homing shots on approach.
          if (!e.wp) { e.wp = new THREE.Vector3(); e.aiState = 'dive'; e.wpT = 0; }
          e.wpT -= dt;
          if (e.wpT <= 0) {
            if (e.aiState === 'dive') { e.aiState = 'loop'; e.wpT = rand(1.0, 1.6);
              e.wp.set(clamp(player.x + rand(-120, 120), -240, 240), rand(60, 130), rand(-330, -220)); }   // peel away high & far
            else { e.aiState = 'dive'; e.wpT = rand(1.2, 1.8);
              e.wp.set(player.x + rand(-18, 18), player.y + rand(-8, 14), PLAYER_Z + rand(12, 30)); }        // screaming dive toward the player
          }
          const acc = e.aiState === 'dive' ? 1.15 : 0.95;
          p.x = damp(p.x, e.wp.x, acc, dt);
          p.y = damp(p.y, e.wp.y, acc, dt);
          p.z = damp(p.z, e.wp.z, acc * 0.9, dt);
          e.mesh.lookAt(_v1.copy(e.wp));
          e.mesh.rotation.z += Math.sin(e.age * 9) * 0.04;
          e.fireCd -= dt;
          if (e.fireCd <= 0 && e.aiState === 'dive' && p.z < -30) {
            e.fireCd = rand(1.3, 2.0);
            this._aimedShot(e, player, proj, 'homing');
          }
          break;
        }
        case 'sniper': {
          // marksman: holds at long range and snipes fast bolts; if the player
          // closes in it slides away to keep its distance. Rarely advances.
          if (!e.wp) { e.wp = new THREE.Vector3(p.x, p.y, p.z); e.wpT = 0; }
          const tooClose = p.z > PLAYER_Z - 120;
          e.wpT -= dt;
          if (e.wpT <= 0 || tooClose) {
            e.wpT = rand(2.0, 3.2);
            const flee = tooClose ? rand(-120, -60) : rand(-40, 20);
            e.wp.set(clamp(player.x + rand(-90, 90), -250, 250), clamp(player.y + rand(-20, 30), 12, 130), clamp(p.z + flee, -420, PLAYER_Z - 110));
          }
          p.x = damp(p.x, e.wp.x, tooClose ? 3.0 : 1.3, dt);
          p.y = damp(p.y, e.wp.y, tooClose ? 3.0 : 1.3, dt);
          p.z = damp(p.z, e.wp.z, tooClose ? 3.2 : 1.0, dt);
          if (e.mesh.userData.ring) e.mesh.userData.ring.rotation.z += dt * 1.6;
          e.mesh.lookAt(this._targetPosition(e, player, _v1));
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -520 && p.z < -50 && !tooClose) {
            e.fireCd = rand(1.8, 2.7);
            const shots = this.difficultyWave >= 8 ? 3 : 2;
            for (let k = 0; k < shots; k++) setTimeout(() => e.alive && this._aimedShot(e, player, proj, 'bolt', 1.1), k * 120);
          }
          break;
        }
        /* ---- STRAFER: hard-banking assault fighter that crosses the field ---- */
        case 'strafer': {
          if (!e.wp) { e.wp = new THREE.Vector3(); e.wpT = 0; }
          e.wpT -= dt;
          if (e.wpT <= 0) {
            e.wpT = rand(0.9, 1.6);
            e.wp.set(clamp(player.x + rand(-150, 150), -250, 250), clamp(player.y + rand(-24, 46), 10, 155), p.z);
          }
          const prevX = p.x;
          p.x = damp(p.x, e.wp.x, 1.1, dt);
          p.y = damp(p.y, e.wp.y, 1.0, dt);
          e.mesh.lookAt(this._targetPosition(e, player, _v1));
          e.mesh.rotation.z = clamp((p.x - prevX) * -6, -1.1, 1.1);   // bank into the turn
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -460 && p.z < -40) {
            e.fireCd = rand(1.4, 2.1);
            const shots = this.difficultyWave >= 8 ? 3 : 2;
            for (let k = 0; k < shots; k++) setTimeout(() => e.alive && this._aimedShot(e, player, proj, 'bolt', 1.1), k * 125);
            if (this.difficultyWave >= 7 && Math.random() < 0.2) this._aimedShot(e, player, proj, 'shard', 1.25);
          }
          break;
        }
        /* ---- BOMBER: slow heavy air unit that saturates with plasma & shockwaves ---- */
        case 'bomber': {
          p.x = e.x0 + Math.sin(e.age * 0.5 + e.phase) * 22;
          p.y = e.y0 + Math.sin(e.age * 0.6) * 4;
          e.mesh.rotation.y = Math.sin(e.age * 0.3) * 0.12;
          e.mesh.rotation.z = Math.cos(e.age * 0.5) * 0.12;
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -440 && p.z < -50) {
            e.fireCd = rand(2.2, 3.1);
            for (let k = -1; k <= 1; k++) { _v1.set(player.x + k * 22, player.y, PLAYER_Z).sub(p); proj.fireEnemy(p, _v1.clone(), 'plasma'); }
            if (this.difficultyWave >= 8 && Math.random() < 0.3) this._aimedShot(e, player, proj, 'wave');
          }
          break;
        }
        /* ---- FLAK: ground AA emplacement, tracks and lobs flak bursts ---- */
        case 'flak': {
          const head = e.mesh.userData.head;
          _v1.set(player.x, player.y, PLAYER_Z).sub(p);
          if (head) head.rotation.y = damp(head.rotation.y, Math.atan2(_v1.x, _v1.z) + Math.PI, 4, dt);
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -470 && p.z < -30) {
            e.fireCd = rand(2.0, 2.9);
            const shots = this.difficultyWave >= 8 ? 3 : 2;
            for (let k = 0; k < shots; k++) setTimeout(() => e.alive && this._aimedShot(e, player, proj, 'flak', 1.35), k * 170);
          }
          break;
        }
        /* ---- AEGIS AA BATTERY: fixed anti-air base, tracks player or wingmate before a flak burst ---- */
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
          if (sensorMat?.emissive) sensorMat.emissiveIntensity = e.fireCd < 0.48 ? 2.25 : 1.18 + Math.sin(e.age * 3.2) * 0.16;
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -500 && p.z < -32) {
            e.fireCd = rand(2.7, 3.7);
            const muzzle = e.mesh.userData.muzzle;
            const origin = muzzle ? muzzle.getWorldPosition(_v2).clone() : p.clone().add(new THREE.Vector3(0, 8, -4));
            const shots = this.difficultyWave >= 8 ? 3 : 2;
            for (let k = 0; k < shots; k++) setTimeout(() => e.alive && this._aimedShot(e, player, proj, 'flak', 1.46, origin), k * 190);
          }
          break;
        }
        /* ---- HOVERTANK: ground hover vehicle, strafes and fires heavy spread ---- */
        case 'hovertank': {
          p.x = e.x0 + Math.sin(e.age * 0.8 + e.phase) * (e.amp + 8);
          p.y = e.y0 + Math.sin(e.age * 3) * 0.5;
          const turret = e.mesh.userData.turret;
          if (turret) { _v1.set(player.x, player.y, PLAYER_Z).sub(p); turret.rotation.y = damp(turret.rotation.y, Math.atan2(_v1.x, _v1.z) + Math.PI, 5, dt); }
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -470 && p.z < -30) {
            e.fireCd = rand(1.8, 2.6);
            for (let k = -1; k <= 1; k += 2) { _v1.set(player.x + k * 20, player.y, PLAYER_Z).sub(p); proj.fireEnemy(p, _v1.clone(), 'heavy'); }
          }
          break;
        }
        /* ---- LAUNCHER: ground battery firing homing missile volleys ---- */
        case 'launcher': {
          const rack = e.mesh.userData.rack;
          if (rack) rack.rotation.z = Math.sin(e.age * 1.5) * 0.12;
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -480 && p.z < -30) {
            e.fireCd = rand(3.0, 4.1);
            const missiles = this.difficultyWave >= 8 ? 3 : 2;
            for (let k = 0; k < missiles; k++) setTimeout(() => {
              if (!e.alive) return;
              _v2.set(p.x + rand(-2, 2), p.y + 2, p.z);
              _v1.set(player.x, player.y, PLAYER_Z).sub(_v2);
              proj.fireEnemy(_v2.clone(), _v1.clone(), 'missile');
            }, k * 220);
          }
          break;
        }
        /* ---- SAUCER: erratic UFO — sudden darts, spinning lights, energy rings ---- */
        case 'saucer': {
          if (!e.wp) { e.wp = new THREE.Vector3(p.x, p.y, p.z); e.wpT = 0; }
          e.wpT -= dt;
          if (e.wpT <= 0) {
            e.wpT = rand(0.7, 1.5);   // impossible-looking course changes
            e.wp.set(clamp(player.x + rand(-160, 160), -240, 240), rand(20, 145), clamp(p.z + rand(-90, 90), -420, -80));
          }
          p.x = damp(p.x, e.wp.x, 1.7, dt);
          p.y = damp(p.y, e.wp.y, 1.7, dt);
          p.z = damp(p.z, e.wp.z, 1.5, dt);
          e.mesh.rotation.y += dt * 2.2;
          e.mesh.rotation.z = Math.sin(e.age * 3) * 0.12;     // wobble
          if (e.mesh.userData.lights) e.mesh.userData.lights.rotation.y -= dt * 5;
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z < -60) {
            e.fireCd = rand(1.7, 2.7);
            this._aimedShot(e, player, proj, 'wave');
            if (this.difficultyWave >= 7 && Math.random() < 0.35) this._aimedShot(e, player, proj, 'plasma');
          }
          break;
        }
        /* ---- CARRIER: attack mothership — launches fighter drones from its bay ---- */
        case 'carrier': {
          p.x = e.x0 + Math.sin(e.age * 0.3 + e.phase) * 14;
          p.y = e.y0 + Math.sin(e.age * 0.5) * 3;
          e.mesh.rotation.z = Math.cos(e.age * 0.4) * 0.05;
          e.launchCd = (e.launchCd ?? rand(2, 4)) - dt;
          if (e.launchCd <= 0 && p.z > -480 && p.z < -100) {
            e.launchCd = rand(7.5, 10.5);
            for (let k = 0; k < (this.difficultyWave >= 9 ? 2 : 1); k++) this.spawn('drone', { x: p.x + rand(-5, 5), y: Math.max(6, p.y - 3), z: p.z - 6, speed: 1.05 });
            game.hud?.alert?.('⚠ FIGHTERS LAUNCHED', 1.2);
          }
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -460 && p.z < -60) {
            e.fireCd = rand(1.8, 2.8);
            this._aimedShot(e, player, proj, 'heavy', 1.4);
          }
          break;
        }

        /* ---- SKYRAIDER: a mobile relay carrier that deploys escort drones ---- */
        case 'skyraider': {
          p.x = e.x0 + Math.sin(e.age * 0.26 + e.phase) * 22;
          p.y = e.y0 + Math.sin(e.age * 0.55) * 4;
          e.mesh.rotation.z = Math.cos(e.age * 0.35) * 0.07;
          e.launchCd = (e.launchCd ?? rand(2, 4)) - dt;
          if (e.launchCd <= 0 && p.z > -480 && p.z < -100) {
            e.launchCd = rand(8.0, 11.0);
            for (let k = 0; k < (this.difficultyWave >= 10 ? 2 : 1); k++) this.spawn('relaydrone', { x: p.x + rand(-8, 8), y: Math.max(10, p.y - 4), z: p.z - 8, speed: 1.05 });
            game.hud?.alert?.('⚠ RELAY DRONES LAUNCHED', 1.2);
          }
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -460 && p.z < -60) {
            e.fireCd = rand(2.0, 3.0);
            this._aimedShot(e, player, proj, 'heavy', 1.25);
            if (this.difficultyWave >= 10 && Math.random() < 0.35) this._aimedShot(e, player, proj, 'plasma');
          }
          break;
        }

        /* ================= expansion-pack enemies ================= */
        /* ---- SCOUT: eye drone that swoops in a lazy arc, then peels off ---- */
        case 'scout': {
          if (!e.wp) { e.wp = new THREE.Vector3(p.x, p.y, p.z); e.wpT = 0; }
          e.wpT -= dt;
          if (e.wpT <= 0) {
            e.wpT = rand(2.2, 3.4);
            e.wp.set(clamp(player.x + rand(-110, 110), -240, 240), clamp(player.y + rand(-16, 40), 12, 150), p.z);
          }
          p.x = damp(p.x, e.wp.x, 1.2, dt);
          p.y = damp(p.y, e.wp.y, 1.1, dt);
          e.mesh.rotation.y += dt * 0.9;                       // the eye slowly scans
          e.mesh.rotation.z = Math.sin(e.age * 1.3) * 0.15;
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -460 && p.z < -50) {
            e.fireCd = rand(1.6, 2.4);
            this._aimedShot(e, player, proj, 'orb');
          }
          break;
        }
        /* ---- FIGHTER: disciplined strafing runs across the lane ---- */
        case 'fighter':
        /* ---- SKY TALON: conventional aircraft interceptor — fast banking sweep, then a precise bolt pair ---- */
        case 'skytalon': {
          if (!e.wp) { e.wp = new THREE.Vector3(p.x, p.y, p.z); e.wpT = 0; }
          e.wpT -= dt;
          if (e.wpT <= 0) {
            e.wpT = rand(1.8, 2.8);
            e.wp.set(clamp(player.x + (Math.random() < 0.5 ? -1 : 1) * rand(60, 150), -245, 245),
              clamp(player.y + rand(e.type === 'skytalon' ? -22 : -14, e.type === 'skytalon' ? 22 : 34), 10, 150), p.z);
          }
          const pvx = p.x;
          p.x = damp(p.x, e.wp.x, e.type === 'skytalon' ? 1.75 : 1.3, dt);
          p.y = damp(p.y, e.wp.y, e.type === 'skytalon' ? 1.55 : 1.2, dt);
          e.mesh.lookAt(this._targetPosition(e, player, _v1));
          e.mesh.rotation.z = clamp((p.x - pvx) * -5, -0.9, 0.9);
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -460 && p.z < -50) {
            e.fireCd = e.type === 'skytalon' ? rand(1.9, 2.7) : rand(1.6, 2.4);
            const shots = e.type === 'skytalon' ? 2 : (this.difficultyWave >= 8 ? 2 : 1);
            for (let k = 0; k < shots; k++) setTimeout(() => e.alive && this._aimedShot(e, player, proj, 'bolt', e.type === 'skytalon' ? 1.20 : 1.1), k * (e.type === 'skytalon' ? 190 : 155));
          }
          break;
        }
        /* ---- HARRIER: high-speed dive bomber — telegraphed vertical slash and shard fan ---- */
        case 'harrier': {
          if (!e.wp) { e.wp = new THREE.Vector3(p.x, p.y, p.z); e.wpT = 0; }
          e.wpT -= dt;
          if (e.wpT <= 0) {
            e.wpT = rand(1.15, 1.8);
            e.wp.set(clamp(player.x + rand(-70, 70), -235, 235), clamp(player.y + rand(-26, 70), 18, 165), p.z);
          }
          const oldY = p.y;
          p.x = damp(p.x, e.wp.x, 1.8, dt);
          p.y = damp(p.y, e.wp.y, 1.9, dt);
          e.mesh.lookAt(this._targetPosition(e, player, _v1));
          e.mesh.rotation.x = clamp((p.y - oldY) * 0.12, -0.55, 0.55);
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -470 && p.z < -55) {
            e.fireCd = rand(1.55, 2.25);
            for (let k = -1; k <= 1; k++) setTimeout(() => e.alive && this._aimedShot(e, player, proj, 'shard', 1.28), (k + 1) * 110);
          }
          break;
        }
        /* ---- PHANTOM: lateral phase runner — pulses its hull then fires a split lock-on volley ---- */
        case 'phantom': {
          const stride = Math.sin(e.age * 2.6 + e.phase);
          p.x = e.x0 + stride * (e.amp + 42);
          p.y = e.y0 + Math.cos(e.age * 1.75 + e.phase) * 10;
          const pulse = 0.9 + (Math.sin(e.age * 8) + 1) * 0.07;
          e.mesh.scale.setScalar(pulse);
          e.mesh.rotation.z = Math.cos(e.age * 2.6 + e.phase) * 0.48;
          e.mesh.lookAt(this._targetPosition(e, player, _v1));
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -480 && p.z < -50) {
            e.fireCd = rand(1.9, 2.7);
            this._aimedShot(e, player, proj, 'homing', 1.15);
            setTimeout(() => e.alive && this._aimedShot(e, player, proj, 'venom', 1.05), 170);
          }
          break;
        }
        /* ---- DREADWING: heavy command carrier — deploys late-campaign escorts and missile barrages ---- */
        case 'dreadwing': {
          p.x = e.x0 + Math.sin(e.age * 0.26 + e.phase) * 28;
          p.y = e.y0 + Math.sin(e.age * 0.42) * 5;
          e.mesh.rotation.z = Math.cos(e.age * 0.3) * 0.08;
          e.launchCd = (e.launchCd ?? rand(2.4, 4.6)) - dt;
          if (e.launchCd <= 0 && p.z > -500 && p.z < -105) {
            e.launchCd = rand(8.5, 11.5);
            this.spawn('harrier', { x: p.x - 8, y: Math.max(18, p.y - 3), z: p.z - 10, speed: 1.12 });
            this.spawn('phantom', { x: p.x + 8, y: Math.max(22, p.y + 2), z: p.z - 14, speed: 0.9 });
            game.hud?.alert?.('⚠ PHASE ESCORTS DEPLOYED', 1.25);
          }
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -470 && p.z < -55) {
            e.fireCd = rand(2.0, 3.0);
            for (const s of [-1, 1]) {
              _v2.set(p.x + s * 6, p.y, p.z);
              _v1.set(player.x + s * 10, player.y, PLAYER_Z).sub(_v2);
              proj.fireEnemy(_v2.clone(), _v1.clone(), 'missile');
            }
            this._aimedShot(e, player, proj, 'heavy', 1.25);
          }
          break;
        }
        /* ---- AEGIS SIEGE CARRIER: command ship cycles escort waves with a telegraphed broadside ---- */
        case 'siegecarrier': {
          p.x = e.x0 + Math.sin(e.age * 0.22 + e.phase) * 32;
          p.y = e.y0 + Math.sin(e.age * 0.46 + e.phase) * 5;
          e.mesh.rotation.z = Math.cos(e.age * 0.28 + e.phase) * 0.07;
          e.mesh.lookAt(this._targetPosition(e, player, _v1));
          e.launchCd = (e.launchCd ?? rand(3.8, 5.2)) - dt;
          if (e.launchCd <= 0 && p.z > -500 && p.z < -115) {
            e.launchCd = rand(9.0, 12.5);
            // Small, alternating escort wave: it frames the carrier without sealing the center lane.
            this.taskForce('pincer', { x: p.x * 0.35, y: Math.max(28, p.y - 8), z: p.z - 28, count: 2 }, game);
            game.particles?.flash(p.x, p.y, p.z - 8, 1.25, 0xff744a);
            game.particles?.ring(p.x, p.y, p.z - 8, { color: 0xff744a, from: 2, radius: 24, dur: 0.42, opacity: 0.42 });
            audio.escortLaunch();
            game.hud?.alert?.('⚠ AEGIS ESCORT WAVE', 1.35);
          }
          e.fireCd -= dt;
          const bayGlow = e.mesh.userData.glow;
          const charge = clamp((0.82 - Math.max(0, e.fireCd)) / 0.82, 0, 1);
          if (bayGlow) {
            bayGlow.scale.setScalar(3.5 + charge * 2.9 + Math.sin(e.age * 20) * charge * 0.35);
            bayGlow.material.opacity = 0.66 + charge * 0.30;
          }
          // One short reaction window: the bay visibly and audibly charges before shots leave the hull.
          if (charge > 0 && !e.siegeTelegraph && p.z > -485 && p.z < -70) {
            e.siegeTelegraph = true;
            game.particles?.muzzle(p.x, p.y, p.z - 8, 1.5, 0xffc078);
            game.particles?.ring(p.x, p.y, p.z - 8, { color: 0xff9a58, from: 1.4, radius: 12, dur: 0.72, opacity: 0.24 });
            audio.siegeCharge();
          }
          if (e.fireCd <= 0 && p.z > -465 && p.z < -70) {
            e.fireCd = rand(3.2, 4.2);
            e.siegeTelegraph = false;
            // Reactor discharge establishes the three-beat broadside.
            game.particles?.flash(p.x, p.y, p.z - 8, 1.15, 0xffb36a);
            game.particles?.ring(p.x, p.y, p.z - 8, { color: 0xff8a4a, from: 2, radius: 18, dur: 0.52, opacity: 0.38 });
            game.particles?.emit(p.x, p.y, p.z - 8, { count: 14, speed: 28, color: 0xffe2a2, color2: 0xff5a24, life: 0.42, size: 3.2, drag: 2.6, spread: 1.6 });
            this._siegeShot(e, player, proj, game, -1, 'heavy');
            setTimeout(() => e.alive && this._siegeShot(e, player, proj, game, 1, 'heavy'), 250);
            setTimeout(() => e.alive && this._siegeShot(e, player, proj, game, 0, 'wave'), 520);
          }
          break;
        }
        /* ---- QUADTANK: armoured hover tank grinding along the deck ---- */
        case 'quadtank': {
          p.x = e.x0 + Math.sin(e.age * 0.45 + e.phase) * (e.amp + 6);
          p.y = e.y0 + Math.sin(e.age * 2.4) * 0.4;
          _v1.set(player.x, player.y, PLAYER_Z).sub(p);
          e.mesh.rotation.y = damp(e.mesh.rotation.y, Math.atan2(_v1.x, _v1.z) + Math.PI, 2.4, dt);
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -470 && p.z < -30) {
            e.fireCd = rand(2.1, 3.0);
            for (let k = -1; k <= 1; k += 2) { _v2.set(player.x + k * 18, player.y, PLAYER_Z).sub(p); proj.fireEnemy(p, _v2.clone(), 'heavy'); }
          }
          break;
        }
        /* ---- TRILOBITE / CANNON / SHORECANNON: emplaced guns that track ---- */
        case 'trilobite':
        case 'cannon':
        case 'shorecannon': {
          _v1.set(player.x, player.y, PLAYER_Z).sub(p);
          e.mesh.rotation.y = damp(e.mesh.rotation.y, Math.atan2(_v1.x, _v1.z) + Math.PI, 2.6, dt);
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -470 && p.z < -30) {
            const heavy = e.type === 'trilobite';
            e.fireCd = heavy ? rand(2.0, 2.9) : rand(2.2, 3.1);
            const shots = heavy ? (this.difficultyWave >= 9 ? 3 : 2) : 2;
            for (let k = 0; k < shots; k++) {
              setTimeout(() => e.alive && this._aimedShot(e, player, proj, heavy ? 'flak' : 'heavy', 1.25), k * 180);
            }
          }
          break;
        }
        /* ---- MECH: heavy walker, slow advance + missile volleys ---- */
        case 'mech': {
          p.x = e.x0 + Math.sin(e.age * 0.3 + e.phase) * 10;
          p.y = e.y0 + Math.abs(Math.sin(e.age * 2.2)) * 1.2;   // plodding gait
          _v1.set(player.x, player.y, PLAYER_Z).sub(p);
          e.mesh.rotation.y = damp(e.mesh.rotation.y, Math.atan2(_v1.x, _v1.z) + Math.PI, 1.8, dt);
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -480 && p.z < -30) {
            e.fireCd = rand(2.8, 3.9);
            for (let k = 0; k < 2; k++) setTimeout(() => {
              if (!e.alive) return;
              _v2.set(p.x + rand(-4, 4), p.y + 4, p.z);
              _v1.set(player.x, player.y, PLAYER_Z).sub(_v2);
              proj.fireEnemy(_v2.clone(), _v1.clone(), 'missile');
            }, k * 220);
          }
          break;
        }
        /* ---- GUNBOAT / FRIGATE: surface warships that broadside the lane ---- */
        case 'gunboat':
        case 'frigate': {
          const big = e.type === 'frigate';
          p.x = e.x0 + Math.sin(e.age * 0.22 + e.phase) * 12;
          p.y = e.y0 + Math.sin(e.age * 0.9 + e.phase) * (big ? 1.1 : 0.8);   // riding the swell
          e.mesh.rotation.z = Math.sin(e.age * 0.9 + e.phase) * 0.05;
          e.mesh.rotation.y = damp(e.mesh.rotation.y, Math.sin(e.age * 0.22 + e.phase) * 0.3, 1.5, dt);
          e.fireCd -= dt;
          if (e.fireCd <= 0 && p.z > -500 && p.z < -40) {
            e.fireCd = big ? rand(1.4, 2.0) : rand(1.9, 2.7);
            const guns = big ? 3 : 2;
            for (let k = 0; k < guns; k++) setTimeout(() => {
              if (!e.alive) return;
              _v2.set(p.x + rand(-6, 6) * (big ? 1.6 : 1), p.y + 5, p.z);
              _v1.set(player.x + rand(-12, 12), player.y, PLAYER_Z).sub(_v2);
              proj.fireEnemy(_v2.clone(), _v1.clone(), big ? 'flak' : 'heavy');
            }, k * 170);
          }
          break;
        }
      }

      this._updateMarker(e, player, game);

      // hit flash decay
      if (e.flash > 0) {
        e.flash -= dt;
        if (e.flash <= 0) this._setFlash(e, false);
      }

      // passed the player → despawn; self-z elites time out so they don't pile up
      if (p.z > 20) this.remove(e);
      else if ((e.type === 'seeker' || e.type === 'sniper' || e.type === 'saucer') && e.age > 24) this.remove(e);
    }
  }

  /** Attach a persistent world-space IFF marker. Unlike friendly portraits, these use angular hostile frames and threat colours. */
  _addMarker(e) {
    const p = markerProfile(e.type, e.ground);
    const g = new THREE.Group();
    g.position.y = p.y + e.radius * 1.2;
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: dotTexture(), color: p.color, transparent: true, opacity: 0.22,
      blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, fog: false,
    }));
    halo.scale.set(9 * p.scale, 4.5 * p.scale, 1); g.add(halo);
    const frame = new THREE.Sprite(new THREE.SpriteMaterial({
      map: markerTexture(p.label), color: p.color, transparent: true, opacity: 0.90,
      depthTest: false, depthWrite: false, fog: false,
    }));
    frame.scale.set(13 * p.scale, 3.65 * p.scale, 1); frame.position.y = 1.35 * p.scale; g.add(frame);
    const lock = new THREE.Sprite(new THREE.SpriteMaterial({
      map: markerTexture('LOCK'), color: 0x62ffad, transparent: true, opacity: 0,
      depthTest: false, depthWrite: false, fog: false,
    }));
    lock.scale.set(16 * p.scale, 4.45 * p.scale, 1); lock.position.y = 1.35 * p.scale; g.add(lock);
    const brackets = new THREE.Sprite(new THREE.SpriteMaterial({
      map: markerTexture(''), color: 0x62ffad, transparent: true, opacity: 0,
      depthTest: false, depthWrite: false, fog: false,
    }));
    brackets.scale.set(19 * p.scale, 6.6 * p.scale, 1); brackets.position.y = 1.35 * p.scale; g.add(brackets);
    e.mesh.add(g);
    e.marker = { g, halo, frame, lock, brackets, profile: p };
  }

  /** Update threat marker state after the enemy AI has chosen movement and fire timing. */
  _updateMarker(e, player, game) {
    const m = e.marker;
    if (!m) return;
    const z = e.mesh.position.z;
    const inViewBand = z > -650 && z < 44;
    m.g.visible = inViewBand && e.alive;
    if (!m.g.visible) return;
    const isLocked = game._chargeLock?.ref === e;
    const imminent = e.fireCd < 0.42 && z > -470 && z < -38;
    const t = e.age;
    const base = m.profile.color;
    const col = isLocked ? 0x62ffad : imminent ? 0xff354d : base;
    m.frame.material.color.setHex(col);
    m.halo.material.color.setHex(col);
    m.lock.material.opacity = isLocked ? 0.98 : 0;
    m.brackets.material.opacity = isLocked ? 0.78 + Math.sin(t * 12) * 0.20 : 0;
    m.frame.material.opacity = isLocked ? 0.25 : 0.92;
    m.halo.material.opacity = imminent ? 0.62 + Math.sin(t * 17) * 0.22 : (m.profile.class === 'heavy' ? 0.34 : 0.20);
    const pulse = 1 + Math.sin(t * (imminent ? 14 : 5) + e.phase) * (imminent ? 0.20 : 0.07);
    m.halo.scale.set(9 * m.profile.scale * pulse, 4.5 * m.profile.scale * pulse, 1);
    const lockPulse = 1 + Math.sin(t * 12) * 0.08;
    m.brackets.scale.set(19 * m.profile.scale * lockPulse, 6.6 * m.profile.scale * lockPulse, 1);
    // Heavy and elite contacts gain a subtle vertical bob so they remain legible
    // behind dense scenery without looking like friendly portrait badges.
    m.g.position.y = m.profile.y + e.radius * 1.2 + Math.sin(t * 2.4 + e.phase) * (m.profile.class === 'hostile' ? 0.28 : 0.75);
  }

  /** Compact arrival flair for large task forces; uses the existing fixed particle pools. */
  _formationEntryFx(e, game, kind) {
    if (!game?.particles || !e?.alive) return;
    const p = e.mesh.position;
    if (kind === 'siege') {
      game.particles.flash(p.x, p.y, p.z, 1.45, 0xff9b62);
      game.particles.ring(p.x, p.y, p.z, { color: 0xff8246, from: 2, radius: 20, dur: 0.6, opacity: 0.35 });
      game.particles.emit(p.x, p.y, p.z + 6, { count: 16, speed: 22, vz: 18, color: 0xffbc76, color2: 0x8fbaff, life: 0.52, size: 3.1, drag: 2.1, spread: 2.2 });
      audio.escortLaunch();
    } else if (kind === 'pincer') {
      game.particles.muzzle(p.x, p.y, p.z + 4, 1.15, 0x8fd8ff);
      game.particles.emit(p.x, p.y, p.z + 5, { count: 7, speed: 17, vz: 20, color: 0xd9f3ff, color2: 0x579dff, life: 0.32, size: 2.0, drag: 2.8, spread: 0.8 });
      audio.pincerPass();
    }
  }

  /** Fire one spectacular but readable Aegis round from a side-specific gun port. */
  _siegeShot(e, player, proj, game, side, type) {
    const p = e.mesh.position;
    const muzzle = _v2.set(p.x + side * 3.35, p.y + (side ? 0.85 : 0.15), p.z - 10.2).clone();
    const color = type === 'wave' ? 0x95bfff : 0xffa15a;
    game.particles?.muzzle(muzzle.x, muzzle.y, muzzle.z, type === 'wave' ? 2.3 : 2.0, color);
    game.particles?.flash(muzzle.x, muzzle.y, muzzle.z, type === 'wave' ? 1.05 : 0.86, color);
    game.particles?.emit(muzzle.x, muzzle.y, muzzle.z, { count: type === 'wave' ? 12 : 9, speed: type === 'wave' ? 32 : 25, vz: -12, color, color2: 0xffffff, life: 0.36, size: type === 'wave' ? 3.8 : 2.9, drag: 2.6, spread: 0.75 });
    if (type === 'wave') game.particles?.ring(muzzle.x, muzzle.y, muzzle.z, { color, from: 1.5, radius: 13, dur: 0.28, opacity: 0.46 });
    this._aimedShot(e, player, proj, type, type === 'wave' ? 0.92 : 1.18, muzzle);
    audio.siegeBroadside();
  }

  /** Assign a short-lived wingmate target without concentrating all fire on one ally. */
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
      // A normal combatant yields its target if another enemy has already
      // claimed that wingmate this frame. Only the visible rescue pursuer may
      // overlap, so one support craft cannot be focus-fired without warning.
      if (valid(e.allyTarget) && (e.allyTarget.targetedBy ?? 0) >= 1) e.allyTarget = null;
      e.allyTargetT -= dt;
      if (!valid(e.allyTarget) || e.allyTargetT <= 0) {
        e.allyTarget = null;
        e.allyTargetT = rand(0.85, 1.45);
        // A wingmate is eligible only in the attack band. This leaves the
        // player as the primary threat and prevents across-the-map sniping.
        const inAttackBand = e.mesh.position.z > -470 && e.mesh.position.z < -28;
        const candidates = inAttackBand ? wingmates.filter((w) => valid(w)
          && w.danger <= 0 && (w.targetedBy ?? 0) < 1
          && Math.abs(w.z - e.mesh.position.z) < 300
          && Math.hypot(w.x - e.mesh.position.x, w.y - e.mesh.position.y) < 300) : [];
        // Wingmates share meaningful, visible risk while retaining distributed targeting.
        // The player remains the main target, but allies now receive regular pressure.
        const allyTargetChance = this.difficultyWave <= 3 ? 0.34 : 0.28;
        if (candidates.length && Math.random() < allyTargetChance) {
          const least = Math.min(...candidates.map((w) => w.targetedBy ?? 0));
          const pool = candidates.filter((w) => (w.targetedBy ?? 0) === least);
          e.allyTarget = pick(pool);
          e.allyTargetT = rand(2.8, 4.8);
        }
      }
    }
    if (valid(e.allyTarget)) e.allyTarget.targetedBy++;
  }

  /** Current live target position; player remains the default primary objective. */
  _targetPosition(e, player, out = _v1) {
    const w = e.allyTarget;
    return w && w.hidden <= 0 && w.mesh.visible && w.hp > 0
      ? out.set(w.x, w.y, w.z)
      : out.set(player.x, player.y, PLAYER_Z);
  }

  /** Fire a shell while leading either the player or a currently selected wingmate. */
  _aimedShot(e, player, proj, type = 'orb', leadMul = 1, origin = null) {
    const p = origin ?? e.mesh.position;
    const w = e.allyTarget && e.allyTarget.hidden <= 0 && e.allyTarget.mesh.visible && e.allyTarget.hp > 0 ? e.allyTarget : null;
    const target = w ?? player;
    const targetZ = w ? w.z : PLAYER_Z;
    _v1.set(target.x + (target.vx ?? 0) * 0.12 * leadMul, target.y + (target.vy ?? 0) * 0.08 * leadMul, targetZ).sub(p);
    // A portion of ally-targeted light fire tracks its assigned support craft.
    // This makes the visible danger indicator correspond to real, avoidable hits.
    const shotType = w && (type === 'orb' || type === 'bolt') && Math.random() < 0.55 ? 'homing' : type;
    proj.fireEnemy(p, _v1.clone(), shotType, null, w);
  }

  /** Animate the bounded visual kit added to imported enemy hulls. */
  _updateCombatVisual(e, dt) {
    const v = e.visual;
    if (!v) return;
    const damage = clamp(1 - e.hp / Math.max(1, e.maxHp), 0, 1);
    const t = e.age;
    const thrust = 0.88 + Math.sin(t * 18 + e.phase) * 0.08 + damage * 0.12;
    for (const glow of v.engineGlows) {
      const base = glow.userData.baseScale ?? (glow.userData.baseScale = glow.scale.x);
      glow.scale.setScalar(base * thrust);
      glow.material.opacity = 0.76 + Math.sin(t * 15 + e.phase) * 0.12;
    }
    for (const collar of v.engineCollars) collar.rotation.z += dt * (1.8 + e.speed * 0.65);
    const critical = clamp((damage - 0.38) / 0.62, 0, 1);
    const attackBand = e.mesh.position.z > -470 && e.mesh.position.z < -38;
    const imminent = attackBand && e.fireCd > 0 && e.fireCd < 0.42;
    for (const ring of v.sensorRings) {
      const base = ring.userData.baseScale ?? (ring.userData.baseScale = ring.scale.x);
      ring.rotation.z += dt * (1.5 + e.speed * 1.2 + (imminent ? 4.8 : 0));
      ring.scale.setScalar(base * (1 + (imminent ? 0.16 : 0.035) * Math.sin(t * (imminent ? 22 : 6) + e.phase)));
      if (ring.material.emissive) ring.material.emissiveIntensity = imminent ? 1.85 : 0.45 + damage * 0.42;
    }
    for (const weapon of v.weaponGlows) {
      const base = weapon.userData.baseScale ?? (weapon.userData.baseScale = weapon.scale.x);
      const pulse = imminent ? 0.72 + Math.max(0, Math.sin(t * 24 + e.phase)) * 0.28 : 0.30 + damage * 0.18;
      weapon.material.opacity = pulse;
      weapon.scale.setScalar(base * (1 + (imminent ? 0.34 : 0.06) * Math.sin(t * (imminent ? 20 : 5) + e.phase)));
    }
    for (const warning of v.warningLights) {
      const base = warning.userData.baseScale ?? (warning.userData.baseScale = warning.scale.x);
      warning.material.opacity = critical * (0.34 + Math.max(0, Math.sin(t * 11 + e.phase)) * 0.62);
      warning.scale.setScalar(base * (1 + critical * 0.26));
    }
    // Reactor, cooling fins and muzzle cage telegraph the firing moment without
    // creating particles. This is transform/material work on only elite models.
    for (const core of v.reactorCores) {
      const base = core.userData.baseScale ?? (core.userData.baseScale = core.scale.x);
      const energy = imminent ? 1 : 0.48 + damage * 0.36;
      core.rotation.y += dt * (1.6 + energy * 5.0);
      core.scale.setScalar(base * (1 + energy * 0.16 + Math.sin(t * 9 + e.phase) * 0.035));
      if (core.material.emissive) core.material.emissiveIntensity = 0.42 + energy * 1.15;
    }
    for (const halo of v.reactorHalos) {
      halo.rotation.z += dt * (0.8 + (imminent ? 4.1 : 1.2));
      if (halo.material.emissive) halo.material.emissiveIntensity = imminent ? 1.45 : 0.34 + damage * 0.32;
    }
    for (const vane of v.heatVanes) {
      vane.rotation.z += dt * (0.18 + damage * 0.28);
      if (vane.material.emissive) vane.material.emissiveIntensity = 0.14 + (imminent ? 0.6 : damage * 0.24);
    }
    for (const vane of v.dataVanes) {
      vane.rotation.z += dt * (0.20 + (imminent ? 1.45 : damage * 0.35));
      if (vane.material.emissive) vane.material.emissiveIntensity = imminent ? 0.82 : 0.10 + damage * 0.20;
    }
    for (const muzzle of v.muzzleCages) {
      muzzle.rotation.z += dt * (imminent ? 4.4 : 0.45);
      if (muzzle.material.emissive) muzzle.material.emissiveIntensity = imminent ? 1.2 : 0.22 + damage * 0.25;
    }
    for (const plate of v.armourPlates) {
      if (plate.material.emissive) plate.material.emissiveIntensity = 0.10 + critical * (0.16 + Math.max(0, Math.sin(t * 7)) * 0.18);
    }
    if (v.damageSmoke) {
      v.damageSmoke.material.opacity = critical * (0.12 + Math.max(0, Math.sin(t * 4 + e.phase)) * 0.25);
      v.damageSmoke.scale.set((v.damageSmoke.userData.baseX ?? (v.damageSmoke.userData.baseX = v.damageSmoke.scale.x)) * (1 + critical * 0.22), (v.damageSmoke.userData.baseY ?? (v.damageSmoke.userData.baseY = v.damageSmoke.scale.y)) * (1 + critical * 0.36), 1);
      v.damageSmoke.position.x = Math.sin(t * 3.4 + e.phase) * (0.3 + damage * 0.7);
      v.damageSmoke.position.y += dt * 0.30;
      if (v.damageSmoke.position.y > 6) v.damageSmoke.position.y = 2.4;
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
          }
          n.material.emissive.setHex(0xffffff);
          n.material.emissiveIntensity = 0.9;
        } else if (n.userData._em !== undefined) {
          n.material.emissive.setHex(n.userData._em);
          n.material.emissiveIntensity = n.userData._emi;
        }
      }
    });
  }

  hit(e, dmg) {
    e.hp -= dmg;
    e.flash = 0.13;
    this._setFlash(e, true);
    return e.hp <= 0;
  }

  kill(e, scored = true) {
    if (!e.alive) return;
    if (scored) this.killCount++;
    this.remove(e);
  }

  remove(e) {
    e.alive = false;
    this.scene.remove(e.mesh);
    const i = this.list.indexOf(e);
    if (i >= 0) this.list.splice(i, 1);
  }

  clear() {
    for (const e of [...this.list]) this.remove(e);
    this.queue.length = 0;
    this.eliteTimer = rand(7, 11);
  }
}
