import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { Input } from '../core/input.js';
import { audio } from '../core/audio.js';
import { Particles } from '../core/particles.js';
import { Debris } from '../core/debris.js';
import { clamp, damp, rand, pick, _v1, _v2, _v3 } from '../core/util.js';
import { Sky } from '../world/sky.js';
import { Terrain } from '../world/terrain.js';
import { Props } from '../world/props.js';
import { Atmosphere } from '../world/atmosphere.js';
import { WAVE_ZONE } from '../world/palettes.js';
import { Player, PLAYER_Z } from '../entities/player.js';
import { Projectiles } from '../entities/projectiles.js';
import { Enemies } from '../entities/enemies.js';
import { Pickups } from '../entities/pickups.js';
import { Wingmates } from '../entities/wingmates.js';
import { RivalDuel } from '../entities/rival.js';
import { BOSS_BY_WAVE } from '../entities/bosses.js';
import { WAVES, FINAL_WAVE } from './waves.js';
import { Hud } from '../ui/hud.js';
import { LeaderboardStore, formatRankScore, sanitizePilotName } from '../core/leaderboard.js';

const BASE_SCROLL = 46;
const CLEAR_DATA_KEY = 'skyblazer-squadron-clear-data-v1';
const $ = (id) => document.getElementById(id);

export class Game {
  constructor(canvas) {
    /* ---------- renderer ---------- */
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    // Post-processing scales with pixel count. 1.5 remains crisp on Retina
    // displays yet avoids the 36% extra fill cost of the previous 1.75 cap.
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x8f4a5e, 260, 1150);
    this.camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.1, 3400);
    this.camera.position.set(0, 12, 14);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.32, 0.55, 0.86);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    // Bloom is intentionally softer than the main scene. Its internal targets
    // can run below native resolution with no loss of HUD or geometry sharpness.
    this._bloomScale = 0.72;
    this._resizeBloom = () => {
      const s = this.renderer.getPixelRatio() * this._bloomScale;
      this.bloom.setSize(Math.max(1, Math.round(innerWidth * s)), Math.max(1, Math.round(innerHeight * s)));
    };
    this._resizeBloom();

    /* ---------- lights ---------- */
    this.hemi = new THREE.HemisphereLight(0xffb08a, 0x1c2a55, 0.85);
    this.scene.add(this.hemi);
    this.dirLight = new THREE.DirectionalLight(0xffd9a0, 1.6);
    this.dirLight.position.set(30, 60, -40);
    this.scene.add(this.dirLight);
    // soft fill from behind the camera so the player ship reads clearly
    this.fillLight = new THREE.DirectionalLight(0xbfd4ff, 0.55);
    this.fillLight.position.set(0, 26, 80);
    this.scene.add(this.fillLight);
    // enemy-only fill (layer 1): keeps dark hulls readable in dusky zones —
    // every enemy/boss mesh enables layer 1, scenery stays untouched
    this.enemyFill = new THREE.DirectionalLight(0xfff0dc, 0.3);
    this.enemyFill.position.set(0, 50, 70);
    this.enemyFill.layers.set(1);
    this.scene.add(this.enemyFill);

    /* ---------- systems ---------- */
    this.input = new Input(canvas);
    this.input.onTouchAction = (action) => {
      if (action === 'pause' && (this.state === 'playing' || this.paused)) this._togglePause();
    };
    this.sky = new Sky(this.scene);
    this.terrain = new Terrain(this.scene);
    this.props = new Props(this.scene, this);
    this.atmosphere = new Atmosphere(this.scene);
    this.particles = new Particles(this.scene);
    this.debris = new Debris(this.scene);
    this.player = new Player(this.scene);
    this.proj = new Projectiles(this.scene);
    this.enemies = new Enemies(this.scene);
    this.pickups = new Pickups(this.scene);
    this.wingmates = new Wingmates(this.scene, this);
    this.wingmates.setVisible(false);
    this.rival = new RivalDuel(this.scene, this);
    this.hud = new Hud();

    // image-based sky reflections for the metal CC0 props/ships/debris
    // (MeshStandard); the cel-shaded world uses MeshToon and is unaffected.
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.pmrem.compileEquirectangularShader();
    this.scene.environmentIntensity = 0.4;
    this._envCache = {};
    this._envRetries = {};

    /* ---------- state ---------- */
    this.state = 'title';
    this.paused = false;
    this.timeScale = 1;
    this.shake = 0;
    this.wave = 1;
    this.boss = null;
    this._chargeLock = null;
    this._fogColor = new THREE.Color(0x8f4a5e);
    this._fogTarget = { color: new THREE.Color(0x8f4a5e), near: 260, far: 1150 };
    this.runMode = 'standard';
    this.progress = this._loadProgress();
    this.leaderboard = new LeaderboardStore();
    this._pendingRankRun = null;
    this._rankEntryOffered = false;
    this._lastRankedEntryId = null;
    // Three escalating quality tiers retain gameplay update rate. Only display
    // resolution, bloom and ambient background cadence can change at runtime.
    this._qualityPresets = [
      { name: 'BALANCED', pixelCap: 1.25, bloomScale: 0.62, post: true, ambientHz: 30, drawDistance: 1500 },
      { name: 'PERFORMANCE', pixelCap: 1.00, bloomScale: 0.48, post: true, ambientHz: 22, drawDistance: 1150 },
      { name: 'EMERGENCY', pixelCap: 0.85, bloomScale: 0.40, post: false, ambientHz: 15, drawDistance: 820 },
    ];
    this._qualityIndex = 0;
    this.performance = { emaMs: 16.7, highFor: 0, lowFor: 0, cooldown: 0, changes: 0 };
    this._applyQuality(0, true);

    this.resetRun();
    this._refreshUnlockUI();
    this._applyZone(WAVE_ZONE[1], 0, 1);
    this._bindKeys();

    addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
      this.composer.setSize(innerWidth, innerHeight);
      this._resizeBloom();
    });
  }

  /* ================= performance quality ================= */
  _applyQuality(index, initial = false) {
    this._qualityIndex = clamp(index | 0, 0, this._qualityPresets.length - 1);
    const q = this._qualityPresets[this._qualityIndex];
    this._bloomScale = q.bloomScale;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, q.pixelCap));
    this.renderer.setSize(innerWidth, innerHeight);
    this.composer.setSize(innerWidth, innerHeight);
    this.bloom.enabled = q.post;
    this._resizeBloom();
    this.terrain?.setAmbientRate(q.ambientHz);
    this.terrain?.setDrawDistance(q.drawDistance);
    this.props?.setDrawDistance(q.drawDistance);
    this.atmosphere?.setAmbientRate(q.ambientHz);
    if (!initial && this.state === 'playing') {
      this.hud.alert(`PERFORMANCE // ${q.name}`, 1.7);
      this.performance.changes++;
    }
  }

  _updatePerformance(rawDt) {
    const p = this.performance;
    const ms = clamp(rawDt * 1000, 1, 100);
    p.emaMs += (ms - p.emaMs) * 0.075;
    p.cooldown = Math.max(0, p.cooldown - rawDt);
    if (p.cooldown > 0) return;
    if (p.emaMs > 34) { p.highFor += rawDt; p.lowFor = 0; }
    else if (p.emaMs < 22) { p.lowFor += rawDt; p.highFor = 0; }
    else { p.highFor = Math.max(0, p.highFor - rawDt * 0.5); p.lowFor = 0; }
    if (p.highFor > 1.2 && this._qualityIndex < this._qualityPresets.length - 1) {
      this._applyQuality(this._qualityIndex + 1);
      p.highFor = 0; p.lowFor = 0; p.cooldown = 2.5;
    } else if (p.lowFor > 5.5 && this._qualityIndex > 0) {
      this._applyQuality(this._qualityIndex - 1);
      p.highFor = 0; p.lowFor = 0; p.cooldown = 4.5;
    }
  }

  /* ================= clear data / run management ================= */
  _loadProgress() {
    try {
      const saved = JSON.parse(localStorage.getItem(CLEAR_DATA_KEY) || '{}');
      return { afterburnerUnlocked: !!saved.afterburnerUnlocked, clears: Math.max(0, saved.clears | 0), bestScore: Math.max(0, saved.bestScore | 0), bestAccuracy: Math.max(0, saved.bestAccuracy | 0) };
    } catch { return { afterburnerUnlocked: false, clears: 0, bestScore: 0, bestAccuracy: 0 }; }
  }
  _saveProgress() {
    try { localStorage.setItem(CLEAR_DATA_KEY, JSON.stringify(this.progress)); } catch { /* private browsing may disable storage; the run still works */ }
  }
  _refreshUnlockUI() {
    const unlocked = !!this.progress?.afterburnerUnlocked;
    $('title-unlock')?.classList.toggle('hidden', !unlocked);
    if ($('title-foot')) $('title-foot').textContent = unlocked
      ? 'WAVE 1 – 16  ·  4 COMBAT ZONES  ·  6 BOSSES  ·  AFTERBURNER+'
      : 'WAVE 1 – 16  ·  4 COMBAT ZONES  ·  6 BOSSES';
  }
  _showModeSelect() {
    if (!this.progress.afterburnerUnlocked) return this.startGame('standard');
    this.state = 'mode';
    $('mode-screen').classList.remove('hidden');
    audio.ui();
  }
  _chooseMode(mode) {
    if (this.state !== 'mode' || !['standard', 'afterburner'].includes(mode)) return;
    $('mode-screen').classList.add('hidden');
    audio.ui();
    this.startGame(mode);
  }
  _openArchive() {
    if (!this.progress.afterburnerUnlocked || this.state !== 'title') return;
    this.state = 'archive';
    $('archive-record').textContent = `CLEAR RECORD // ${this.progress.clears} SORTIE${this.progress.clears === 1 ? '' : 'S'} // BEST ${String(this.progress.bestScore).padStart(6, '0')}`;
    $('archive-text').textContent = this.progress.clears > 1
      ? 'Echo analysis repeats the same final transmission: “Coast is clear. Bring everyone home.” The signal now carries four distinct wing signatures.'
      : 'A residual rift echo carries four formation signatures into a quiet sky. The final line is addressed to Bowie alone: “Bring everyone home.”';
    $('archive-screen').classList.remove('hidden');
    audio.blip();
  }
  async _openLeaderboard() {
    if (this.state !== 'title') return;
    await this.leaderboard.ready;
    this._lastRankedEntryId = null;
    this._renderLeaderboard();
    $('leaderboard-screen').classList.remove('hidden');
    $('leaderboard-screen').setAttribute('aria-hidden', 'false');
    this.state = 'leaderboard';
    audio.ui();
    setTimeout(() => $('leaderboard-close')?.focus(), 0);
  }

  _closeLeaderboard() {
    if (this.state !== 'leaderboard') return;
    audio.ui();
    this._returnToTitle();
  }

  _renderLeaderboard() {
    const body = $('leaderboard-body');
    const empty = $('leaderboard-empty');
    if (!body || !empty) return;
    body.replaceChildren();
    const entries = this.leaderboard.entries;
    $('leaderboard-count').textContent = `${entries.length} / 30 ENTRIES`;
    empty.classList.toggle('hidden', entries.length > 0);

    entries.forEach((entry, index) => {
      const row = document.createElement('tr');
      row.classList.add(`rank-${index + 1}`);
      if (entry.id === this._lastRankedEntryId) row.classList.add('is-new-record');
      const rank = document.createElement('td');
      const name = document.createElement('td');
      const score = document.createElement('td');
      const run = document.createElement('td');
      rank.textContent = `#${index + 1}`;
      name.textContent = entry.name;
      name.title = entry.name;
      score.textContent = formatRankScore(entry.score);
      run.textContent = entry.mode === 'afterburner' ? 'AFTER+' : entry.outcome === 'complete' ? 'CLEAR' : `W${entry.wave}`;
      row.append(rank, name, score, run);
      body.append(row);
    });
  }

  _makeRankRun(outcome) {
    const accuracy = this.stats.shots ? Math.round((this.stats.hits / this.stats.shots) * 100) : 0;
    return {
      score: this.score,
      mode: this.runMode,
      outcome,
      wave: this.wave,
      kills: this.stats.kills,
      accuracy,
    };
  }

  async _offerRankEntry(outcome) {
    if (this._rankEntryOffered) return false;
    const expectedState = outcome === 'complete' ? 'victory' : 'gameover';
    await this.leaderboard.ready;
    if (this.state !== expectedState) return false;
    const run = this._makeRankRun(outcome);
    if (!this.leaderboard.qualifies(run.score)) return false;

    this._rankEntryOffered = true;
    this._pendingRankRun = run;
    this.state = 'rank-entry';
    this.input.setTouchEnabled(false);
    const projectedRank = this.leaderboard.rankFor(run.score);
    $('rank-entry-score').textContent = String(run.score).padStart(6, '0');
    $('rank-entry-copy').textContent = `Projected position: #${projectedRank} of the Top 30. Register your callsign.`;
    const input = $('rank-entry-name');
    input.value = '';
    input.removeAttribute('aria-invalid');
    $('rank-entry-screen').classList.remove('hidden');
    $('rank-entry-screen').setAttribute('aria-hidden', 'false');
    audio.ui();
    setTimeout(() => input.focus(), 80);
    return true;
  }

  _dismissRankEntry() {
    if (this.state !== 'rank-entry') return;
    $('rank-entry-screen').classList.add('hidden');
    $('rank-entry-screen').setAttribute('aria-hidden', 'true');
    this._pendingRankRun = null;
    audio.ui();
    this._returnToTitle();
  }

  async _submitRankEntry() {
    if (this.state !== 'rank-entry' || !this._pendingRankRun) return;
    const input = $('rank-entry-name');
    const name = sanitizePilotName(input.value);
    if (!name) {
      input.setAttribute('aria-invalid', 'true');
      $('rank-entry-copy').textContent = 'CALLSIGN REQUIRED // Enter a name before registering the flight record.';
      audio.blip();
      input.focus();
      return;
    }

    const submit = $('rank-entry-submit');
    submit.disabled = true;
    const result = await this.leaderboard.submit(name, this._pendingRankRun);
    submit.disabled = false;
    if (!result) {
      input.setAttribute('aria-invalid', 'true');
      $('rank-entry-copy').textContent = 'RECORD COULD NOT BE SAVED // Storage may be unavailable. Try again or return to title.';
      audio.blip();
      return;
    }

    this._lastRankedEntryId = result.entry.id;
    this._pendingRankRun = null;
    $('rank-entry-screen').classList.add('hidden');
    $('rank-entry-screen').setAttribute('aria-hidden', 'true');
    this._renderLeaderboard();
    $('leaderboard-screen').classList.remove('hidden');
    $('leaderboard-screen').setAttribute('aria-hidden', 'false');
    this.state = 'leaderboard';
    audio.ui();
    setTimeout(() => $('leaderboard-table-wrap')?.focus(), 0);
  }

  _returnToTitle() {
    $('gameover-screen').classList.add('hidden');
    $('victory-screen').classList.add('hidden');
    $('ending-screen').classList.add('hidden');
    $('leaderboard-screen').classList.add('hidden');
    $('leaderboard-screen').setAttribute('aria-hidden', 'true');
    $('rank-entry-screen').classList.add('hidden');
    $('rank-entry-screen').setAttribute('aria-hidden', 'true');
    this.hud.hide();
    this.input.setTouchEnabled(false);
    $('title-screen').classList.remove('hidden');
    this._refreshUnlockUI();
    this.state = 'title';
    audio.playTrack('title');
  }

  resetRun() {
    const veteran = this.runMode === 'afterburner';
    this.score = 0; this.lives = veteran ? 4 : 3; this.hp = 100;
    this.stats = { kills: 0, shots: 0, hits: 0, rings: 0 };
    this.waveStats = { kills: 0, shots: 0, hits: 0, rings: 0 };
    this.combo = 0; this.comboTimer = 0; this.maxCombo = 0;
    this._rollHinted = false;
    this._pendingRankRun = null;
    this._rankEntryOffered = false;
    this._lastRankedEntryId = null;
    this.player.laserLevel = veteran ? 3 : 1;
    this.player.bombs = veteran ? 5 : 3;
    this.player.meter = 100;
  }

  /** register a scored kill: build the combo chain + bonus */
  _onKill(pos) {
    this.combo++;
    this.comboTimer = 2.6;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    if (this.combo >= 2) {
      this.addScore(this.combo * 5);           // escalating chain bonus
      this.hud.setCombo(this.combo);
    }
    if (pos) this.wingmates.onEnemyKilled(pos);
  }
  _breakCombo() {
    if (this.combo >= 2) this.hud.setCombo(0);
    this.combo = 0; this.comboTimer = 0;
  }

  /** loot drops scale with enemy toughness — keeps the harder waves survivable */
  _dropLoot(e) {
    const p = e.mesh.position;
    if (e.type === 'gunship') {
      // elite cruiser always yields something good
      this.pickups.spawn(pick(['health', 'bomb', 'laser']), p.x, p.y, p.z);
      if (Math.random() < 0.5) this.pickups.spawn('ring', p.x + 6, p.y, p.z);
    } else if (e.type === 'sniper' || e.type === 'seeker') {
      const r = Math.random();
      if (r < 0.4) this.pickups.spawn(pick(['health', 'bomb']), p.x, p.y, p.z);
      else if (r < 0.7) this.pickups.spawn('ring', p.x, p.y, p.z);
    } else if (e.type === 'pod') {
      const r = Math.random();
      if (r < 0.4) this.pickups.spawn('health', p.x, p.y, p.z);
      else if (r < 0.65) this.pickups.spawn('bomb', p.x, p.y, p.z);
      else if (r < 0.85) this.pickups.spawn('laser', p.x, p.y, p.z);
    } else if (e.type === 'turret' && Math.random() < 0.25) {
      this.pickups.spawn(Math.random() < 0.5 ? 'health' : 'bomb', p.x, p.y, p.z);
    } else if (Math.random() < 0.08) {
      this.pickups.spawn('ring', p.x, p.y, p.z);
    }
  }

  startGame(mode = 'standard') {
    this.runMode = mode === 'afterburner' && this.progress.afterburnerUnlocked ? 'afterburner' : 'standard';
    this.resetRun();
    this.wave = this.runMode === 'afterburner' ? 13 : 1;
    $('title-screen').classList.add('hidden');
    $('mode-screen').classList.add('hidden');
    $('archive-screen').classList.add('hidden');
    $('gameover-screen').classList.add('hidden');
    $('victory-screen').classList.add('hidden');
    $('ending-screen').classList.add('hidden');
    $('leaderboard-screen').classList.add('hidden');
    $('rank-entry-screen').classList.add('hidden');
    this.hud.show();
    this.input.setTouchEnabled(true);
    this.paused = false;
    this.state = 'playing';
    this.player.x = 0; this.player.y = 12;
    this.wingmates.reset();
    this.wingmates.setVisible(true);
    this.loadWave(this.wave);
    if (this.runMode === 'afterburner') {
      this.hud.alert('AFTERBURNER+ // VETERAN LOADOUT ONLINE', 2.6);
      this.hud.say('REX', 'Veteran route online. Command resurgence starts now.', 3.0);
    }
  }

  loadWave(n) {
    this.wave = n;
    this.enemies.setDifficultyWave(n);
    const spec = WAVES[n];
    this.waveSpec = spec;
    this.waveTimer = 0;
    this.events = [...spec.events].sort((a, b) => a.t - b.t);
    this.eventIdx = 0;
    this.bossSpawned = false;
    this.waveStats = { kills: 0, shots: 0, hits: 0, rings: 0 };
    // defensive: make sure nothing from a prior wave lingers
    if (this.boss) { this.boss.destroy(); this.boss = null; }
    this.enemies.clear();
    this.pickups.clear();
    this.proj.clearEnemyBullets();
    this._breakCombo();
    this._applyZone(spec.zone, n === 1 ? 0 : 3, n);
    this.hud.banner(`WAVE ${n}`, spec.zone.name);
    this.hud.hideBoss();
    this.input.setTouchEnabled(true);
    if (n > 1) audio.comms('objectiveAchieved', 0.18);
    audio.playTrack(spec.zone.music);
    this.state = 'playing';
  }

  /** build/assign a PMREM sky reflection for the zone (retries until the JPEG decodes) */
  _applyEnv(key) {
    if (!key) return;
    if (this._envCache[key]) { this.scene.environment = this._envCache[key]; return; }
    const tex = this.sky?.skyTex?.[key];
    // HDR skyboxes are displayed on the background dome only. On the current
    // WebGL QA driver, PMREM conversion of FloatType HDRIs fails validation for
    // imported physical materials, so do not turn a visual sky into an env map.
    if (tex?.userData?.skyboxOnly) {
      this.scene.environment = null;
      return;
    }
    if (!tex || !tex.image || !tex.image.width) {
      const n = (this._envRetries[key] || 0);
      if (n < 10) { this._envRetries[key] = n + 1; setTimeout(() => this._applyEnv(key), 350); }
      return;
    }
    const rt = this.pmrem.fromEquirectangular(tex);
    this._envCache[key] = rt.texture;
    this.scene.environment = rt.texture;
  }

  _applyZone(zone, blendDur, wave = this.wave) {
    this.zone = zone;
    this.sky.setZone(zone, blendDur);
    this.sky.setStage?.(wave, zone);
    this.terrain.setZone(zone);
    this.terrain.setStage?.(wave, zone);
    this.props.setZone(zone);
    this.props.setStage?.(wave, zone);
    this.atmosphere.setStage(wave, zone);
    this._applyEnv(zone.skyImage);
    // enemy readability: stronger enemy-only fill in the darker zones
    this.enemyFill.intensity = zone.id === 'ember' ? 0.9 : zone.id === 'sea' ? 0.45 : 0.25;
    this.player.setZoneBounds(zone);
    this._fogTarget = { color: new THREE.Color(zone.fog.color), near: zone.fog.near, far: zone.fog.far };
    if (blendDur === 0) {
      this.scene.fog.color.copy(this._fogTarget.color);
      this.scene.fog.near = zone.fog.near;
      this.scene.fog.far = zone.fog.far;
    }
    this.hemi.color.setHex(zone.hemi.sky);
    this.hemi.groundColor.setHex(zone.hemi.ground);
    this.hemi.intensity = zone.hemi.i;
    this.dirLight.color.setHex(zone.sun.color);
    this.dirLight.intensity = zone.sun.i;
    this.dirLight.position.set(zone.sun.pos[0] * 80, Math.max(zone.sun.pos[1], 0.15) * 90, zone.sun.pos[2] * 60);
  }

  /* ================= input bindings ================= */
  _togglePause() {
    if (this.state !== 'playing' && !this.paused) return;
    this.paused = !this.paused;
    $('pause-screen').classList.toggle('hidden', !this.paused);
    audio.ui();
  }

  _bindKeys() {
    addEventListener('keydown', (e) => {
      if (this.state === 'branch') {
        if (e.code === 'Digit1' || e.code === 'ArrowLeft') this._chooseBranch('pursue');
        else if (e.code === 'Digit2' || e.code === 'ArrowRight') this._chooseBranch('guard');
        return;
      }
      if (this.state === 'mode') {
        if (e.code === 'Digit1' || e.code === 'ArrowLeft') this._chooseMode('standard');
        else if (e.code === 'Digit2' || e.code === 'ArrowRight') this._chooseMode('afterburner');
        else if (e.code === 'Escape') { $('mode-screen').classList.add('hidden'); this.state = 'title'; audio.ui(); }
        return;
      }
      if (this.state === 'archive') {
        if (e.code === 'Enter' || e.code === 'KeyQ' || e.code === 'Escape') { $('archive-screen').classList.add('hidden'); this.state = 'title'; audio.ui(); }
        return;
      }
      if (this.state === 'leaderboard') {
        if (e.code === 'Escape' || e.code === 'KeyR') this._closeLeaderboard();
        return;
      }
      if (this.state === 'rank-entry') {
        if (e.code === 'Enter') this._submitRankEntry();
        else if (e.code === 'Escape') this._dismissRankEntry();
        return;
      }
      if (this.state === 'title' && e.code === 'KeyQ') { this._openArchive(); return; }
      if (this.state === 'title' && e.code === 'KeyR') { this._openLeaderboard(); return; }
      if (e.code === 'Enter') this._confirm();
      if (e.code === 'KeyP' && (this.state === 'playing' || this.paused)) this._togglePause();
      if (e.code === 'KeyM') { audio.init(); audio.toggleMute(); }
    });
    addEventListener('mousedown', (e) => {
      if (this.state === 'title' && !e.target.closest('#title-ranking-button')) this._confirm();
    });
    this.renderer.domElement.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch' && this.state === 'title') {
        e.preventDefault();
        this._confirm();
      }
    }, { passive: false });
    // branch cards are clickable
    for (const card of document.querySelectorAll('#branch-screen .branch-card')) {
      card.addEventListener('click', () => this._chooseBranch(card.dataset.opt));
    }
    for (const card of document.querySelectorAll('#mode-screen .mode-card')) {
      card.addEventListener('click', () => this._chooseMode(card.dataset.mode));
    }
    $('title-ranking-button')?.addEventListener('click', (e) => { e.stopPropagation(); this._openLeaderboard(); });
    $('leaderboard-close')?.addEventListener('click', () => this._closeLeaderboard());
    $('rank-entry-submit')?.addEventListener('click', () => this._submitRankEntry());
    $('rank-entry-skip')?.addEventListener('click', () => this._dismissRankEntry());
    $('rank-entry-name')?.addEventListener('input', (e) => {
      e.target.value = sanitizePilotName(e.target.value);
      e.target.removeAttribute('aria-invalid');
    });
  }

  _confirm() {
    audio.init(); audio.resume();
    if (this.state === 'title') { audio.ui(); this._showModeSelect(); }
    else if (this.state === 'gameover' || this.state === 'victory') {
      audio.ui();
      this._returnToTitle();
    }
  }

  /* ================= combat helpers ================= */
  explodeAt(pos, big = false, opts = {}) {
    this.particles.explosion(pos.x, pos.y, pos.z, big);
    this.particles.zoneResidue(pos.x, pos.y, pos.z, this.zone?.id, big);
    this.debris.burst(pos.x, pos.y, pos.z, {
      count: opts.count ?? (big ? 7 : 4),
      scale: opts.scale ?? (big ? 1.4 : 0.95),
      color: opts.color, speed: opts.speed ?? (big ? 1.3 : 1.05),
      profile: this.zone?.id,
    });
    this.terrain.impactMark(pos, big, opts);
    if (this.zone?.water && pos.y < 12) this.particles.splash(pos.x, pos.z);
    audio.explosion(big);
    this.shake = Math.min(this.shake + (big ? 0.9 : 0.35), 1.6);
  }

  /** detonate a bomb: 3x-radius blast; a manual (2nd-B) detonation is the big one */
  _detonateBomb(b, manual = false) {
    if (!b.active) return;
    b.active = false; b.mesh.visible = false;
    const bp = _v3.copy(b.mesh.position);
    audio.bomb();
    this.hud.flash(manual ? 0.9 : 0.6, manual ? 170 : 110);
    this.particles.bombBlast(bp.x, bp.y, bp.z, manual ? 1.4 : 1.0);
    this.debris.burst(bp.x, bp.y, bp.z, { count: manual ? 11 : 8, scale: manual ? 1.7 : 1.35, speed: 1.5 });
    this.shake = manual ? 2.4 : 1.9;
    this.timeScale = manual ? 0.5 : 0.7;              // brief slow-mo punch
    // explosion radius ~3x the old bomb (46 -> ~140), manual is larger still
    this._areaDamage(bp, manual ? 190 : 152, manual ? 18 : 14, true);
    this.proj.clearEnemyBullets((pos) => this.particles.emit(pos.x, pos.y, pos.z, { count: 3, speed: 8, color: 0xffe0a0, life: 0.3, size: 1.6 }));
  }

  /** a wingmate's bomb run — moderate blast that clears a cluster */
  allyBomb(pos) {
    audio.bomb();
    this.particles.bombBlast(pos.x, pos.y, pos.z, 0.85);
    this.debris.burst(pos.x, pos.y, pos.z, { count: 5, scale: 1.15, speed: 1.2 });
    this.shake = Math.min(this.shake + 0.7, 1.6);
    this._areaDamage(pos, 66, 6, true);
    this.wingmates.reportKill();
  }

  damagePlayer(dmg, src = '') {
    if (this.player.invuln > 0 || this.player.rolling || this.state !== 'playing') return;
    this.hp -= dmg;
    this.hud.hurt();
    this.shake = Math.min(this.shake + 0.7, 1.8);
    audio.playerHit();
    this.player.invuln = 0.8;
    this._breakCombo();
    // iconic first-hit coaching from a wingmate
    if (src === 'bullet' && !this._rollHinted) {
      this._rollHinted = true;
      this.hud.callout('DO A BARREL ROLL!', '↻', '#8bffb0');
      this.hud.say('KIT', 'Bowie, do a barrel roll (⌘+← / →) to deflect their fire!', 3.4);
    }
    if (this.hp <= 0) this._loseLife();
  }

  _loseLife() {
    this.lives--;
    this.explodeAt(_v1.set(this.player.x, this.player.y, PLAYER_Z), true);
    this.hud.flash(0.7, 120);
      if (this.lives < 0) {
      this.state = 'gameover';
      this.input.setTouchEnabled(false);
      audio.stopMusic();
      this.wingmates.setVisible(false);
      this.hud.clearDialogue();
      $('go-score').textContent = String(this.score);
      $('go-wave').textContent = 'WAVE ' + this.wave;
      $('gameover-screen').classList.remove('hidden');
      setTimeout(() => { if (this.state === 'gameover') this._offerRankEntry('failed'); }, 650);
      return;
    }
    this.hp = 100;
    this.player.invuln = 2.6;
    this.player.laserLevel = Math.max(1, this.player.laserLevel - 1);
    this.hud.say('JUNO', 'Bowie! Pull up — shields restored. Go get them!', 2.8);
  }

  addScore(v) { this.score += v; }

  bossPhase(text) {
    this.hud.alert(text, 2.4);
    this._bossPhaseNum = (this._bossPhaseNum ?? 1) + 1;
    this.hud.setBossPhase(this._bossPhaseNum);
    this.hud.flash(0.35, 90);
    this.shake = Math.min(this.shake + 0.8, 1.8);
    audio.alarm();
  }

  /* ================= weapons ================= */
  _updateWeapons(dt) {
    const p = this.player;
    p.fireCd -= dt;

    // hold C / right mouse: charge a lock-on shot
    if (this.input.chargeHeld) {
      if (!p.charging) { p.charging = true; p.charge = 0; audio.chargeStart(); }
      p.charge = Math.min(1, p.charge + dt / 0.62);
      this._updateChargeLock();
    } else if (p.charging) {
      if (p.charge > 0.32) this._releaseCharge();
      else audio.chargeEnd(false);
      p.charging = false; p.charge = 0;
      this._chargeLock = null;
    }

    // hold space / left mouse: rapid fire
    if (this.input.firing && !p.charging && p.fireCd <= 0) {
      p.fireCd = p.laserLevel >= 3 ? 0.085 : p.laserLevel === 2 ? 0.105 : 0.115;
      this._fireLasers();
    }

    // B: launch a bomb; press B again while one is airborne to manually detonate (大爆発)
    if (this.input.justPressed('KeyB')) {
      const airborne = this.proj.bombs.find((b) => b.active);
      if (airborne) {
        this._detonateBomb(airborne, true);
      } else if (p.bombs > 0) {
        p.bombs--;
        p.muzzle(_v1);
        this.proj.fireBomb(_v1);
        audio.missileLaunch(p.laserLevel);
      }
    }
    if (this.input.justPressed('KeyQ', 'KeyE')) audio.roll();
    if (this.input.justPressed('ShiftLeft')) audio.boost(true);
    if (this.input.justPressed('ControlLeft', 'KeyX')) audio.boost(false);
  }

  _fireLasers() {
    const p = this.player;
    const muzzle = new THREE.Vector3(); p.muzzle(muzzle);
    const aim = new THREE.Vector3(); p.aimFar(aim);
    // gentle aim assist: snap to a target near the far reticle
    const farScreen = this._toScreen(aim);
    if (farScreen) {
      let best = null, bestD = 145;
      for (const c of this._lockCandidates()) {
        const s = this._toScreen(c.pos());
        if (!s) continue;
        const d = Math.hypot(s.x - farScreen.x, s.y - farScreen.y);
        if (d < bestD) { bestD = d; best = c; }
      }
      if (best) aim.copy(best.pos());
    }
    const lvl = p.laserLevel;
    const dmg = lvl >= 3 ? 1.75 : lvl === 2 ? 1.25 : 1;
    const offsets = lvl === 1 ? [0] : lvl === 2 ? [-1.8, 1.8] : [-2.6, 0, 2.6];
    for (const s of offsets) {
      const origin = s === 0 ? muzzle : _v3.copy(muzzle).setX(muzzle.x + s);
      this.proj.fireLaser(origin, aim, dmg, lvl);
    }
    this.waveStats.shots += offsets.length;
    this.particles.laserMuzzle(muzzle.x, muzzle.y + 0.1, muzzle.z - 1, lvl);
    audio.laser(lvl);
  }

  _lockCandidates() {
    const out = [];
    for (const e of this.enemies.list) {
      if (e.mesh.position.z < -30) out.push({ pos: () => e.mesh.position, alive: true, ref: e });
    }
    if (this.boss?.alive) {
      for (const w of this.boss.weakpoints) {
        if (w.alive && w.active) {
          out.push({ pos: () => w.worldPos(new THREE.Vector3()), alive: true, ref: w, isWeak: true });
        }
      }
    }
    return out;
  }

  _updateChargeLock() {
    // pick target closest to the far reticle in screen space
    this.player.aimFar(_v1);
    const farScreen = this._toScreen(_v1);
    let best = null, bestD = 150;
    for (const c of this._lockCandidates()) {
      const s = this._toScreen(c.pos());
      if (!s) continue;
      const d = Math.hypot(s.x - farScreen.x, s.y - farScreen.y);
      if (d < bestD) { bestD = d; best = c; }
    }
    if (best && best !== this._chargeLock) {
      this._chargeLock = best;
      audio.lockBeep();
    }
    if (best === null) this._chargeLock = null;
  }

  _releaseCharge() {
    const p = this.player;
    p.muzzle(_v1);
    const lock = this._chargeLock;
    const target = lock ? {
      alive: true,
      pos: () => lock.ref.worldPos ? lock.ref.worldPos(new THREE.Vector3()) : lock.ref.mesh.position,
    } : null;
    this.proj.fireCharge(_v1, target);
    audio.chargeEnd(true);
    this.waveStats.shots++;
  }

  /** soft magnetism: bend live bolts toward nearby targets (arcade feel) */
  _steerLasers(dt) {
    const targets = this._lockCandidates();
    if (!targets.length) return;
    for (const b of this.proj.lasers) {
      if (!b.active) continue;
      const bp = b.mesh.position;
      let best = null, bestD = 48;
      for (const c of targets) {
        const d = bp.distanceTo(c.pos());
        if (d < bestD) { bestD = d; best = c; }
      }
      if (!best) continue;
      _v1.copy(best.pos()).sub(bp);
      const speed = b.vel.length();
      _v2.copy(b.vel).normalize();
      _v1.normalize();
      if (_v2.dot(_v1) > 0.76) {
        b.vel.lerp(_v1.multiplyScalar(speed), Math.min(1, dt * 12));
        b.vel.setLength(speed);
      }
    }
  }

  /* ================= collisions ================= */
  _collisions(dt) {
    const P = this.player;
    const playerPos = _v3.set(P.x, P.y, PLAYER_Z);

    /* player lasers vs enemies / boss */
    for (const b of this.proj.lasers) {
      if (!b.active) continue;
      const bp = b.mesh.position;
      let consumed = false;
      for (const e of this.enemies.list) {
        if (bp.distanceTo(e.mesh.position) < e.radius + 2.4) {
          this.waveStats.hits++;
          audio.enemyHit(b.level);
          this.particles.laserImpact(bp.x, bp.y, bp.z, b.level, false);
          if (this.enemies.hit(e, b.dmg)) {
            this.addScore(e.score);
            this.waveStats.kills++;
            this.stats.kills++;
            this._onKill(e.mesh.position);
            this.explodeAt(e.mesh.position, e.type === 'pod');
            this._dropLoot(e);
            this.enemies.kill(e);
          }
          consumed = true;
          break;
        }
      }
      if (!consumed && this.boss?.alive) {
        const hit = this.boss.hitTest(bp, 1.6);
        if (hit) {
          this.waveStats.hits++;
          // shell impact on the hull: small blast + metallic report + burn mark
          audio.bossHit(hit.kind === 'weak');
          this.particles.laserImpact(bp.x, bp.y, bp.z, b.level, hit.kind === 'weak');
          this.particles.impact(bp.x, bp.y, bp.z, hit.kind === 'weak' ? 'heavy' : 'orb', hit.kind === 'weak' ? 1.1 : 0.75);
          this.boss.addScorch(bp);
          if (hit.kind === 'weak') {
            const died = hit.wp.hit(b.dmg * 2);
            this.boss.damage(b.dmg * 2);
            if (died) { this.explodeAt(bp, true); this.addScore(200); }
          } else {
            this.boss.damage(b.dmg * 0.25);
          }
          consumed = true;
        }
      }
      if (consumed) { b.active = false; b.mesh.visible = false; }
    }

    /* wingmate lasers vs enemies / boss (allies help clear the skies) */
    for (const b of this.proj.alasers) {
      if (!b.active) continue;
      const bp = b.mesh.position;
      let consumed = false;
      for (const e of this.enemies.list) {
        if (bp.distanceTo(e.mesh.position) < e.radius + 2.2) {
          audio.enemyHit(1);
          this.particles.laserImpact(bp.x, bp.y, bp.z, 1, false);
          this.particles.emit(bp.x, bp.y, bp.z, { count: 4, speed: 12, color: 0xbfe8ff, life: 0.22, size: 1.6 });
          if (this.enemies.hit(e, b.dmg)) {
            this.addScore(Math.round(e.score * 0.6));   // allies score a little less
            this.waveStats.kills++;
            this.stats.kills++;
            this.explodeAt(e.mesh.position, false);
            this.enemies.kill(e);
            this.wingmates.reportKill();
          }
          consumed = true;
          break;
        }
      }
      if (!consumed && this.boss?.alive) {
        const hit = this.boss.hitTest(bp, 1.4);
        if (hit) {
          if (hit.kind === 'weak') { hit.wp.hit(b.dmg); this.boss.damage(b.dmg); }
          else this.boss.damage(b.dmg * 0.15);
          consumed = true;
        }
      }
      if (consumed) { b.active = false; b.mesh.visible = false; }
    }

    /* charge shots — proximity blast */
    for (const c of this.proj.charges) {
      if (!c.active) continue;
      const cp = c.mesh.position;
      let boom = false;
      if (c.target?.alive) {
        if (cp.distanceTo(c.target.pos()) < 7) boom = true;
      }
      for (const e of this.enemies.list) {
        if (cp.distanceTo(e.mesh.position) < e.radius + 2.5) { boom = true; break; }
      }
      if (!boom && this.boss?.alive && this.boss.hitTest(cp, 3)) boom = true;
      if (!boom) {
        this.terrain.forEachObstacle((cx, cy, cz, rh, hy) => {
          if (!boom && Math.abs(cp.y - cy) < hy + 2 && Math.hypot(cp.x - cx, cp.z - cz) < rh + 2) boom = true;
        });
      }
      if (boom || c.life <= 0.05) {
        c.active = false; c.mesh.visible = false;
        if (this.boss?.alive && this.boss.hitTest(cp, 8)) this.boss.addScorch(cp);
        this.explodeAt(cp, true);
        this._areaDamage(cp, 24, 4, true);
      }
    }

    /* bombs — detonate on enemy / boss / scenery contact or fuse timeout */
    for (const b of this.proj.bombs) {
      if (!b.active) continue;
      const bp = b.mesh.position;
      let boom = b.fuse <= 0;
      for (const e of this.enemies.list) {
        if (bp.distanceTo(e.mesh.position) < e.radius + 5) { boom = true; break; }
      }
      if (!boom && this.boss?.alive && this.boss.hitTest(bp, 6)) boom = true;
      if (!boom) {
        this.terrain.forEachObstacle((cx, cy, cz, rh, hy) => {
          if (!boom && Math.abs(bp.y - cy) < hy + 3 && Math.hypot(bp.x - cx, bp.z - cz) < rh + 3) boom = true;
        });
      }
      if (boom) this._detonateBomb(b, false);
    }

    /* enemy bullets vs player (per-type hit radius) */
    for (const b of this.proj.ebullets) {
      if (!b.active) continue;
      const d = b.mesh.position.distanceTo(playerPos);
      if (P.rolling && d < 9.5 && !b.deflected) {
        b.deflected = true;
        b.vel.multiplyScalar(-1.35);
        b.vel.x += rand(-20, 20); b.vel.y += rand(-10, 20);
        this.addScore(5);
        audio.hitTick();
        this.particles.emit(b.mesh.position.x, b.mesh.position.y, b.mesh.position.z, { count: 4, speed: 12, color: 0xbfffe8, life: 0.25, size: 1.6 });
      } else if (d < (b.radius ?? 0.9) + P.radius) {
        b.active = false; b.mesh.visible = false;
        const bp = b.mesh.position;
        this.particles.impact(bp.x, bp.y, bp.z, b.btype, b.radius > 1.5 ? 1.3 : 1);
        audio.impact(b.btype);
        this.damagePlayer(b.radius > 1.5 ? 12 : 7, 'bullet'); // heavy shells hurt more
      }
    }

    /* enemy bullets vs wingmates — only explicit ally-targeted rounds can hit.
       This removes arbitrary player-bound "stray" damage while keeping genuine,
       telegraphed enemy pressure on the selected support craft. */
    for (const b of this.proj.ebullets) {
      if (!b.active || !b.targetWingmate) continue;
      const w = b.targetWingmate;
      if (w.hidden > 0 || !w.mesh.visible || w.hp <= 0) { b.targetWingmate = null; continue; }
      if (b.mesh.position.distanceTo(w.mesh.position) < (b.radius ?? 0.9) + 3.4) {
        b.active = false; b.mesh.visible = false; b.targetWingmate = null;
        const damage = b.radius > 1.5 ? 12 : 7;
        if (w.takeDamage(damage, this, b.btype)) {
          const bp = b.mesh.position;
          this.particles.impact(bp.x, bp.y, bp.z, b.btype, 0.8);
          audio.impact(b.btype);
        }
      }
    }

    /* enemy bodies vs player */
    for (const e of [...this.enemies.list]) {
      if (e.type === 'mine') continue; // handled in enemies.js
      if (e.mesh.position.distanceTo(playerPos) < e.radius + 2.0) {
        this.explodeAt(e.mesh.position, false);
        this.enemies.kill(e, false);
        this.damagePlayer(12, 'ram');
      }
    }

    /* player lasers vs scenery: absorbed with sparks (cylinder collider) */
    for (const b of this.proj.lasers) {
      if (!b.active) continue;
      const bp = b.mesh.position;
      this.terrain.forEachObstacle((cx, cy, cz, rh, hy) => {
        if (b.active && Math.abs(bp.y - cy) < hy && Math.hypot(bp.x - cx, bp.z - cz) < rh) {
          b.active = false; b.mesh.visible = false;
          this.particles.terrainChip(bp.x, bp.y, bp.z, this.zone?.id, 0.86);
        }
      });
    }

    /* scenery vs player: every prop's surface deals damage + knockback */
    if (P.invuln <= 0 && !P.rolling) {
      let struck = null;
      this.terrain.forEachObstacle((cx, cy, cz, rh, hy, dmg) => {
        if (struck) return;
        if (Math.hypot(P.x - cx, PLAYER_Z - cz) < rh + P.radius && Math.abs(P.y - cy) < hy + P.radius) {
          struck = { cx, cy, dmg };
        }
      });
      if (struck) {
        this.damagePlayer(struck.dmg, 'crash');
        const push = Math.sign(P.x - struck.cx) || 1;
        P.vx += push * 95;
        P.vy += (P.y > struck.cy ? 1 : -1) * 32;
        this.explodeAt(_v1.set(P.x, P.y, PLAYER_Z), false);
      }
    }
  }

  /* ================= all-range rival duel ================= */
  startRivalDuel(afterWave) {
    this.input.setTouchEnabled(true);
    this._rivalReturnWave = afterWave;   // wave to load once the duel ends
    this.enemies.clear();
    this.pickups.clear();
    this.proj.clearEnemyBullets();
    this.state = 'playing';
    this.hud.banner('RIVAL DUEL', 'ALL-RANGE MODE');
    this.rival._done = false;
    this.rival.start();
  }
  _rivalDefeated() {
    this.hud.callout('RIVAL DOWN!', '★', '#ffd36b');
    setTimeout(() => this.loadWave(this._rivalReturnWave), 1400);
  }

  _areaDamage(center, radius, dmg, fromPlayer) {
    for (const e of [...this.enemies.list]) {
      if (center.distanceTo(e.mesh.position) < radius + e.radius) {
        if (this.enemies.hit(e, dmg)) {
          this.addScore(e.score);
          if (fromPlayer) { this.waveStats.kills++; this.stats.kills++; this._onKill(e.mesh.position); }
          this.explodeAt(e.mesh.position, false);
          this.enemies.kill(e);
        }
      }
    }
    if (this.boss?.alive) {
      for (const w of this.boss.weakpoints) {
        if (!w.alive || !w.active) continue;
        w.worldPos(_v1);
        if (center.distanceTo(_v1) < radius + w.radius) {
          const died = w.hit(dmg);
          this.boss.damage(dmg);
          if (died) { this.explodeAt(_v1, true); this.addScore(200); }
        }
      }
      if (center.distanceTo(this.boss.pos()) < radius + this.boss.bodyRadius) this.boss.damage(dmg * 0.4);
    }
  }

  /* ================= wave flow ================= */
  _updateWaveScript(dt) {
    if (this.state !== 'playing') return;
    this.waveTimer += dt;
    const spec = this.waveSpec;
    while (this.eventIdx < this.events.length && this.events[this.eventIdx].t <= this.waveTimer) {
      const e = this.events[this.eventIdx++];
      this._runEvent(e);
    }
    if (spec.boss) {
      if (!this.bossSpawned && this.waveTimer >= spec.bossAt) this._spawnBoss(spec.boss);
      if (this.bossSpawned && this.boss && !this.boss.alive) this._bossDefeated();
    } else if (this.waveTimer >= spec.length && this.enemies.aliveCount === 0) {
      this._waveClear();
    }
  }

  _runEvent(e) {
    switch (e.kind) {
      case 'form': this.enemies.formation(...e.args); break;
      case 'taskforce': this.enemies.taskForce(...e.args, this); break;
      case 'rings': this.pickups.ringLine(...e.args); break;
      case 'pick': this.pickups.spawn(...e.args); break;
      case 'say': this.hud.say(...e.args); break;
      case 'alert': this.hud.alert(e.args[0]); audio.alarm(); break;
    }
  }

  _spawnBoss(name) {
    this.bossSpawned = true;
    const Cls = BOSS_BY_WAVE[this.wave];
    this.boss = new Cls(this.scene);
    this.boss.group.traverse((o) => o.layers.enable(1));   // enemy-only fill light
    this._bossPhaseNum = 1;
    this.hud.showBoss(this.boss.name, this.boss.phaseCount ?? 2);
    this.hud.setBossPhase(1);
    audio.playTrack('boss');
  }

  _bossDefeated() {
    const b = this.boss;
    this.boss = null;
    this.addScore(1500);
    this.hud.hideBoss();
    audio.stopMusic();
    // death fireworks
    const pos = b.pos().clone();
    let i = 0;
    const burst = setInterval(() => {
      this.explodeAt(_v1.set(pos.x + rand(-22, 22), pos.y + rand(-10, 14), pos.z + rand(-14, 14)), true);
      if (++i > 7) clearInterval(burst);
    }, 160);
    this.hud.flash(0.9, 200);
    b.destroy();
    this.proj.clearEnemyBullets();
    if (this.wave === FINAL_WAVE) {
      this._beginFinale(pos);
    } else {
      this.hud.say('BOWIE', 'Target down! Moving on.', 3);
      setTimeout(() => this._waveClear(1500), 1600);
    }
  }

  _waveClear(bossBonus = 0) {
    if (this.state !== 'playing') return;
    this.state = 'waveclear';
    this.input.setTouchEnabled(false);
    const ws = this.waveStats;
    const acc = ws.shots ? Math.round((ws.hits / ws.shots) * 100) : 0;
    const bonus = ws.kills * 20 + acc * 5 + ws.rings * 30 + bossBonus;
    this.addScore(bonus);
    $('res-title').textContent = `WAVE ${this.wave} CLEAR`;
    $('res-kills').textContent = String(ws.kills);
    $('res-acc').textContent = acc + '%';
    $('res-rings').textContent = String(ws.rings);
    $('res-bonus').textContent = '+' + bonus;
    $('wave-results').classList.remove('hidden');
    this.enemies.clear();
    this.pickups.clear();
    const branchHere = (this.wave === 2 || this.wave === 8);   // route choice points
    setTimeout(() => {
      $('wave-results').classList.add('hidden');
      if (branchHere) this._showBranch();
      else this.loadWave(this.wave + 1);
    }, 3400);
  }

  /* ================= branching route choice ================= */
  _showBranch() {
    this.state = 'branch';
    this.input.setTouchEnabled(false);
    $('branch-screen').classList.remove('hidden');
    audio.alarm();
    this.hud.say('REX', 'Bowie, Thorne broke off from the fleet. Your call — pursue, or hold the line?', 4);
  }
  _chooseBranch(opt) {
    if (this.state !== 'branch') return;
    $('branch-screen').classList.add('hidden');
    audio.ui();
    const next = this.wave + 1;
    if (opt === 'pursue') {
      this.startRivalDuel(next);
    } else {
      // guard route: defensive reward + a saved squadron
      this.hp = 100;
      this.addScore(1000);
      this.player.bombs = Math.min(5, this.player.bombs + 1);
      this.hud.callout('FLEET GUARDED +1000', '✚', '#8bffb0');
      this.hud.say('KIT', 'Thanks for holding the line, Bowie! We owe you.', 2.8);
      this.loadWave(next);
    }
  }

  /** Final-boss aftermath: allow the player to witness the collapse before the debrief. */
  _beginFinale(pos) {
    this.state = 'finale';
    this.timeScale = 0.42;
    this.wingmates.setVisible(true);
    this.hud.flash(1, 260);
    this.hud.say('BOWIE', 'Rift core collapsing! Everybody, break clear!', 2.8);
    let n = 0;
    const finaleBurst = setInterval(() => {
      if (this.state !== 'finale') { clearInterval(finaleBurst); return; }
      this.explodeAt(_v1.set(pos.x + rand(-38, 38), pos.y + rand(-22, 28), pos.z + rand(-24, 24)), true, { count: 10, scale: 1.7, color: n % 2 ? 0x62d8ff : 0xffcf70, speed: 1.55 });
      this.hud.flash(0.75, 115);
      if (++n >= 12) clearInterval(finaleBurst);
    }, 190);
    setTimeout(() => { if (this.state === 'finale') this.hud.say('VEGA', 'Clear sky ahead! Squadron is in formation. I have Bowie on my wing.', 2.8); }, 720);
    setTimeout(() => { if (this.state === 'finale') this.hud.say('NOVA', 'The rift is folding in on itself. I am recording a residual echo for command.', 3.1); }, 1420);
    setTimeout(() => { if (this.state === 'finale') this.hud.say('KIT', 'Signal is gone. We did it! I knew that last pylon would crack.', 2.8); }, 2180);
    setTimeout(() => { if (this.state === 'finale') this.hud.say('THORNE', 'Not bad, Bowie. Keep the formation tight — victory laps are still flying.', 3.0); }, 2940);
    setTimeout(() => { if (this.state === 'finale') this.hud.banner('RIFT CITADEL CLOSED', 'FORM UP FOR HOME'); }, 3460);
    setTimeout(() => { if (this.state === 'finale') this._victory(); }, 4700);
  }

  _victory() {
    this.state = 'victory';
    this.input.setTouchEnabled(false);
    this.timeScale = 1;
    this.wingmates.setVisible(true);
    audio.playTrack('ending');
    audio.comms('missionCompleted', 0.32);
    this.hud.clearDialogue();
    this.hud.hide();
    const acc = this.stats.shots ? Math.round((this.stats.hits / this.stats.shots) * 100) : 0;
    const wasUnlocked = this.progress.afterburnerUnlocked;
    this.progress.afterburnerUnlocked = true;
    this.progress.clears += 1;
    this.progress.bestScore = Math.max(this.progress.bestScore, this.score);
    this.progress.bestAccuracy = Math.max(this.progress.bestAccuracy, acc);
    this._saveProgress();
    this._refreshUnlockUI();
    $('ending-unlock').textContent = wasUnlocked
      ? `AFTERBURNER+ // CLEAR DATA UPDATED — ${this.progress.clears} SORTIES`
      : 'AFTERBURNER+ // VETERAN ROUTE UNLOCKED · SIGNAL ARCHIVE RECOVERED';
    $('vic-score').textContent = String(this.score);
    $('vic-kills').textContent = String(this.stats.kills);
    $('vic-acc').textContent = acc + '%';
    $('end-score').textContent = String(this.score).padStart(6, '0');
    $('end-kills').textContent = String(this.stats.kills).padStart(3, '0');
    $('end-acc').textContent = acc + '%';
    $('victory-screen').classList.add('hidden');
    $('ending-screen').classList.remove('hidden');
    // Let the staged final debrief play before presenting any qualifying score.
    setTimeout(() => { if (this.state === 'victory') this._offerRankEntry('complete'); }, 4450);
  }

  /* ================= helpers ================= */
  _toScreen(v) {
    _v2.copy(v).project(this.camera);
    if (_v2.z > 1) return null;
    return { x: (_v2.x * 0.5 + 0.5) * innerWidth, y: (-_v2.y * 0.5 + 0.5) * innerHeight };
  }

  /* ================= main update ================= */
  update(rawDt) {
    if (!Number.isFinite(rawDt) || rawDt < 0) rawDt = 1 / 60;
    this._updatePerformance(rawDt);
    if (!Number.isFinite(this.timeScale)) this.timeScale = 1;
    if (!Number.isFinite(this.shake)) this.shake = 0;
    const P0 = this.player;
    if (!Number.isFinite(P0.x) || !Number.isFinite(P0.y)) { P0.x = 0; P0.y = 12; P0.vx = P0.vy = 0; }
    if (!Number.isFinite(P0.vx) || !Number.isFinite(P0.vy)) { P0.vx = P0.vy = 0; }
    if (!Number.isFinite(this.camera.position.x) || !Number.isFinite(this.camera.position.y)) {
      this.camera.position.set(P0.x * 0.5, 7.6 + P0.y * 0.48, 14);
    }
    const dt = Math.min(rawDt, 0.05) * this.timeScale;
    this.timeScale = damp(this.timeScale, 1, 2, rawDt);

    // fog blending
    this.scene.fog.color.lerp(this._fogTarget.color, Math.min(1, rawDt * 0.8));
    this.scene.fog.near = damp(this.scene.fog.near, this._fogTarget.near, 0.8, rawDt);
    this.scene.fog.far = damp(this.scene.fog.far, this._fogTarget.far, 0.8, rawDt);

    if (this.paused) { this.input.endFrame(); return; }

    const playing = this.state === 'playing' || this.state === 'waveclear' || this.state === 'finale';
    const bossHold = this.boss?.alive;
    const scroll = playing
      ? BASE_SCROLL * this.player.speedFactor * (bossHold ? 0.4 : 1)
      : BASE_SCROLL * 0.55;

    this.sky.update(dt, this.camera);
    this.terrain.update(dt, scroll);
    this.props.update(dt, scroll);
    this.atmosphere.update(dt, scroll);
    this.particles.update(dt);
    this.debris.update(dt);

    if (this.state === 'title') {
      // attract mode: gentle auto-flight
      const t = performance.now() * 0.001;
      this.player.x = Math.sin(t * 0.5) * 16;
      this.player.y = 13 + Math.sin(t * 0.8) * 4;
      this.player.vx = Math.cos(t * 0.5) * 9;
      this.player.vy = Math.cos(t * 0.8) * 3;
      this.player.update(0.0001, this.input, this); // pose only
      this.player.mesh.position.set(this.player.x, this.player.y, PLAYER_Z);
      this._updateCamera(dt, scroll);
      this.input.endFrame();
      return;
    }

    if (playing) {
      if (this.state === 'playing') {
        this.player.update(dt, this.input, this);
        this._updateWeapons(dt);
      }
      this.enemies.update(dt, scroll, this.player, this.proj, this);
      this._steerLasers(dt);
      this.proj.update(dt, scroll, this.player);
      this.pickups.update(dt, scroll, this.player, (kind, pos) => this._collect(kind, pos));
      if (this.state === 'playing' || this.state === 'finale') this.wingmates.update(dt, this.player, this.enemies, this.proj);
      if (this.boss?.alive) {
        this.boss.update({ dt, player: this.player, proj: this.proj, game: this, scroll, time: this.waveTimer });
        this.hud.setBossHp(this.boss.hp / this.boss.maxHp);
      }
      if (this.rival.active) this.rival.update(dt, this.player, this.proj, this);
      if (this.state === 'playing') {
        this._collisions(dt);
        if (!this.rival.active) this._updateWaveScript(dt);   // duel pauses the wave script
        if (this.comboTimer > 0) {
          this.comboTimer -= dt;
          if (this.comboTimer <= 0) this._breakCombo();
        }
      }

      // low-altitude water spray
      if (this.zone?.water && this.player.y < 6.5 && Math.random() < dt * 14) {
        this.particles.splash(this.player.x + rand(-2, 2), PLAYER_Z + rand(2, 6));
      }
    }

    this._updateCamera(dt, scroll);
    this._updateHud(dt);
    this.hud.update(rawDt);
    this.input.endFrame();
  }

  _collect(kind, pos) {
    const P = this.player;
    if (kind === 'ring') {
      this.addScore(50);
      this.waveStats.rings++; this.stats.rings++;
      this.hp = Math.min(100, this.hp + 3);
      audio.ring();
      this.particles.emit(pos.x, pos.y, pos.z, { count: 10, speed: 12, color: 0xffd870, life: 0.4, size: 2.2 });
      this.particles.ring(pos.x, pos.y, pos.z, { color: 0xffd870, radius: 9, dur: 0.4 });
    } else if (kind === 'laser') {
      P.laserLevel = Math.min(3, P.laserLevel + 1);
      audio.pickup();
      this.hud.callout(P.laserLevel >= 3 ? 'HYPER LASER!' : 'LASER UP!', '◆', '#ffd36b');
      this.hud.say('JUNO', P.laserLevel >= 3 ? 'Hyper lasers online!' : 'Twin lasers online!', 2.2);
      this.particles.emit(pos.x, pos.y, pos.z, { count: 14, speed: 16, color: 0xffd36b, color2: 0xff9020, life: 0.5, size: 2.4 });
    } else if (kind === 'bomb') {
      P.bombs = Math.min(5, P.bombs + 1);
      audio.pickup();
      this.hud.callout('BOMB +1', '❖', '#7fe9ff');
      this.particles.emit(pos.x, pos.y, pos.z, { count: 14, speed: 16, color: 0x7fe9ff, life: 0.5, size: 2.4 });
    } else if (kind === 'health') {
      this.hp = Math.min(100, this.hp + 35);
      audio.pickup();
      this.hud.callout('SHIELD +35', '✚', '#ff8fb0');
      this.particles.emit(pos.x, pos.y, pos.z, { count: 14, speed: 16, color: 0xff8fb0, life: 0.5, size: 2.4 });
    }
  }

  _updateCamera(dt, scroll) {
    const P = this.player;
    const boostK = clamp((P.speedFactor - 1) / 0.85, -1, 1);
    const cam = this.camera;
    // chase cam: sit directly behind the ship so it stays centred no matter how
    // far the player strafes or climbs across the (now very large) field
    const backZ = PLAYER_Z + 36 + boostK * -3;
    _v1.set(P.x, P.y + 5.5, backZ);
    cam.position.x = damp(cam.position.x, _v1.x, 9, dt);
    cam.position.y = damp(cam.position.y, _v1.y, 9, dt);
    cam.position.z = damp(cam.position.z, _v1.z, 5, dt);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 3.2);
      cam.position.x += rand(-1, 1) * this.shake * 0.55;
      cam.position.y += rand(-1, 1) * this.shake * 0.45;
    }
    // look straight ahead from behind the ship (a hair of lead keeps the horizon lively)
    cam.lookAt(cam.position.x + (P.x - cam.position.x) * 0.4, P.y + 1.5, PLAYER_Z - 90);
    cam.rotation.z += clamp(-P.vx * 0.0011, -0.09, 0.09) + P.rollAngle * 0.02;
    const wantFov = 74 + boostK * 10;
    cam.fov = damp(cam.fov, wantFov, 5, dt);
    cam.updateProjectionMatrix();
    this.bloom.strength = 0.32 + Math.max(boostK, 0) * 0.22;
  }

  _updateHud(dt) {
    const P = this.player;
    this.hud.setBars(this.hp, P.meter);
    this.hud.setScore(this.score);
    this.hud.setLives(Math.max(this.lives, 0));
    this.hud.setLaserLevel(P.laserLevel);
    this.hud.setBombs(P.bombs);

    // reticles
    P.aimNear(_v1);
    const near = this._toScreen(_v1);
    P.aimFar(_v1);
    const far = this._toScreen(_v1);
    if (near && far) this.hud.reticle(near, far, !!this._chargeLock);
    // charge ring + lock markers
    if (P.charging && far) this.hud.charge(P.charge, far.x, far.y);
    else this.hud.charge(0, 0, 0);
    const lockPos = [];
    if (this._chargeLock) {
      const s = this._toScreen(this._chargeLock.pos());
      if (s) lockPos.push(s);
    }
    this.hud.locks(lockPos);
  }

  render() {
    // Emergency tier skips the full-screen post chain but leaves world/HUD
    // rendering and all combat simulation intact.
    if (this._qualityPresets[this._qualityIndex].post) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
}
