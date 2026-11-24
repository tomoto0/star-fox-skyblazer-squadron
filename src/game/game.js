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
const SETTINGS_KEY = 'skyblazer-settings-v1';
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
    this.camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.1, 3400);
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
    // dynamic combat point light: casts fiery orange / cyan explosion flashes onto hulls & canyon walls
    this.fxLight = new THREE.PointLight(0xff9c44, 0, 210, 1.35);
    this.scene.add(this.fxLight);
    this._fxLightDecay = 10;

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
    this.settings = this._loadSettings();
    this._applySettings();
    this._deflectPopCd = 0;
    this._wasBoosting = false;
    this._wasBraking = false;

    // image-based sky reflections for the metal CC0 props/ships/debris
    // (MeshStandard); the cel-shaded world uses MeshToon and is unaffected.
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.pmrem.compileEquirectangularShader();
    this.scene.environmentIntensity = 0.65;
    this._envCache = {};
    this._envRetries = {};

    /* ---------- state ---------- */
    this.state = 'title';
    this.paused = false;
    this.timeScale = 1;
    this.shake = 0;
    this.camKick = 0;
    this.wave = 1;
    this.boss = null;
    this._chargeLock = null;
    this._chargeLocks = [];
    this._candidatesCache = [];
    this._candidatesFrame = -1;
    this._frameNum = 0;
    this._waveClearTimer = null;
    this._waveClearFinish = null;
    this._waveClearElapsed = 0;
    this._fogColor = new THREE.Color(0x8f4a5e);
    this._fogTarget = { color: new THREE.Color(0x8f4a5e), near: 260, far: 1150 };
    this.runMode = 'standard';
    this.progress = this._loadProgress();
    this.leaderboard = new LeaderboardStore();
    this._pendingRankRun = null;
    this._rankEntryOffered = false;
    this._lastRankedEntryId = null;

    // 4-tier graphics quality system with fast anti-freeze auto-guard.
    // Gameplay simulation always stays full-rate; visual budgets scale smoothly.
    this._qualityPresets = [
      { id: 'high',     name: 'HIGH',     pixelCap: 1.50, bloomScale: 0.66, post: true,  ambientHz: 30, drawDistance: 1500, fxBudget: 1.00, hazeCount: 26, motes: true,  waterCpu: true,  showProps: true,  dynamicLight: true },
      { id: 'balanced', name: 'BALANCED', pixelCap: 1.20, bloomScale: 0.52, post: true,  ambientHz: 24, drawDistance: 1320, fxBudget: 0.85, hazeCount: 16, motes: true,  waterCpu: true,  showProps: true,  dynamicLight: true },
      { id: 'fast',     name: 'FAST',     pixelCap: 1.00, bloomScale: 0.40, post: false, ambientHz: 18, drawDistance: 1080, fxBudget: 0.60, hazeCount: 8,  motes: true,  waterCpu: false, showProps: true,  dynamicLight: true },
      { id: 'lite',     name: 'LITE',     pixelCap: 0.85, bloomScale: 0.35, post: false, ambientHz: 12, drawDistance: 840,  fxBudget: 0.38, hazeCount: 0,  motes: false, waterCpu: false, showProps: false, dynamicLight: false },
    ];
    // Modest CPU/mobile devices start at FAST (Bloom OFF) in Auto mode so frame 1 is silky-smooth.
    const modestHw = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) || this.input.touch.capable;
    this._autoDefaultIndex = modestHw ? 2 : 1;
    this._qualityIndex = this._autoDefaultIndex;
    this._dynamicLightEnabled = true;
    this.performance = { emaMs: 16.7, highFor: 0, lowFor: 0, spikes: 0, cooldown: 0, changes: 0, perfUiCd: 0 };
    this._syncGraphicsMode(true);

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

  /* ================= performance quality & anti-freeze guard ================= */
  _syncGraphicsMode(initial = false) {
    if (!this._qualityPresets) return;
    const mode = this.settings?.graphicsMode ?? 'auto';
    if (mode === 'auto') {
      this._applyQuality(initial ? this._autoDefaultIndex : this._qualityIndex, true);
    } else {
      const idx = this._qualityPresets.findIndex((p) => p.id === mode);
      this._applyQuality(idx >= 0 ? idx : this._autoDefaultIndex, true);
    }
  }

  _applyQuality(index, initial = false) {
    this._qualityIndex = clamp(index | 0, 0, this._qualityPresets.length - 1);
    const q = this._qualityPresets[this._qualityIndex];
    this._bloomScale = q.bloomScale;
    this._dynamicLightEnabled = !!q.dynamicLight;
    if (!this._dynamicLightEnabled && this.fxLight) this.fxLight.intensity = 0;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, q.pixelCap));
    this.renderer.setSize(innerWidth, innerHeight);
    this.composer.setSize(innerWidth, innerHeight);
    this.bloom.enabled = q.post;
    this._resizeBloom();
    this.terrain?.setAmbientRate(q.ambientHz);
    this.terrain?.setDrawDistance(q.drawDistance);
    this.terrain?.setWaterCpuEnabled(q.waterCpu);
    this.props?.setDrawDistance(q.drawDistance);
    this.props?.setEnabled(q.showProps);
    this.atmosphere?.setAmbientRate(q.ambientHz);
    this.atmosphere?.setDetail({ hazeCount: q.hazeCount, motesEnabled: q.motes });
    this.particles?.setBudget(q.fxBudget);
    this.debris?.setBudget(q.fxBudget);
    if (!initial && this.state === 'playing') {
      this.hud.alert(`LIGHTWEIGHT GUARD // ${q.name}`, 1.6);
      this.performance.changes++;
    }
  }

  _updatePerformance(rawDt) {
    const p = this.performance;
    const ms = clamp(rawDt * 1000, 1, 120);
    p.emaMs += (ms - p.emaMs) * 0.10;
    p.perfUiCd -= rawDt;
    if (p.perfUiCd <= 0) {
      p.perfUiCd = 0.25;
      const q = this._qualityPresets[this._qualityIndex];
      const fps = clamp(1000 / Math.max(8, p.emaMs), 1, 144);
      const isAuto = (this.settings?.graphicsMode ?? 'auto') === 'auto';
      this.hud.setPerf(fps, q.name, isAuto, !!this.settings?.showPerf);
    }
    if ((this.settings?.graphicsMode ?? 'auto') !== 'auto') return;

    p.cooldown = Math.max(0, p.cooldown - rawDt);
    if (p.cooldown > 0) return;

    // Anti-freeze spike detector: 3 consecutive severe frame stalls drop quality immediately
    if (ms > 55) p.spikes++;
    else p.spikes = Math.max(0, p.spikes - 1);

    if (p.emaMs > 28) { p.highFor += rawDt; p.lowFor = 0; }
    else if (p.emaMs < 18.5) { p.lowFor += rawDt; p.highFor = 0; }
    else { p.highFor = Math.max(0, p.highFor - rawDt * 0.5); p.lowFor = 0; }

    if ((p.spikes >= 3 || p.highFor > 0.65) && this._qualityIndex < this._qualityPresets.length - 1) {
      this._applyQuality(this._qualityIndex + 1);
      p.highFor = 0; p.lowFor = 0; p.spikes = 0; p.cooldown = 2.0;
    } else if (p.lowFor > 6.0 && this._qualityIndex > this._autoDefaultIndex - 1 && this._qualityIndex > 0) {
      this._applyQuality(this._qualityIndex - 1);
      p.highFor = 0; p.lowFor = 0; p.spikes = 0; p.cooldown = 5.0;
    }
  }

  /** Auto-pause active gameplay if the player switches browser tabs */
  onTabHidden() {
    if (this.state === 'playing' && !this.paused) this._togglePause();
  }
  onContextLost() {
    this.hud.setContextLost(true);
    if (this.state === 'playing' && !this.paused) this._togglePause();
  }
  onContextRestored() {
    this.hud.setContextLost(false);
    this._envCache = {};
    if (this.zone) this._applyEnv(this.zone);
    this._syncGraphicsMode(true);
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
    $('pause-screen')?.classList.add('hidden');
    $('pause-screen')?.setAttribute('aria-hidden', 'true');
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

  /** Build a 100%-WebGL-safe procedural sky-gradient PMREM reflection map per zone.
   * Gives metallic GLTF ships, bosses, props and debris crisp sunset/sky reflections
   * without FloatType HDR compatibility issues! */
  _applyEnv(zone) {
    const key = zone?.id;
    if (!key) return;
    if (this._envCache[key]) { this.scene.environment = this._envCache[key]; return; }
    const c = document.createElement('canvas');
    c.width = 128; c.height = 64;
    const g = c.getContext('2d');
    const hex = (v) => '#' + (v >>> 0).toString(16).padStart(6, '0');
    const grad = g.createLinearGradient(0, 0, 0, 64);
    grad.addColorStop(0.0, hex(zone.sky.top));
    grad.addColorStop(0.38, hex(zone.sky.mid));
    grad.addColorStop(0.52, hex(zone.sky.horizon));
    grad.addColorStop(0.62, hex(zone.hemi.ground));
    grad.addColorStop(1.0, hex(zone.rock?.base ?? zone.hemi.ground));
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 64);
    // Warm sun reflection hotspot on the horizon band
    const sunGrd = g.createRadialGradient(64, 28, 2, 64, 28, 26);
    sunGrd.addColorStop(0, hex(zone.sky.sun));
    sunGrd.addColorStop(0.45, hex(zone.sky.sunGlow));
    sunGrd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sunGrd;
    g.fillRect(34, 4, 60, 48);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.mapping = THREE.EquirectangularReflectionMapping;
    const rt = this.pmrem.fromEquirectangular(tex);
    tex.dispose();
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
    this._applyEnv(zone);
    // Strong enemy-only rim fill keeps every close-range enemy crisp & vivid
    this.enemyFill.intensity = zone.id === 'ember' ? 1.15 : zone.id === 'sea' ? 0.65 : 0.45;
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

  /* ================= pilot settings & tactical pause ================= */
  _loadSettings() {
    const VALID_GFX = ['auto', 'high', 'balanced', 'fast', 'lite'];
    try {
      const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      return {
        invertY: !!s.invertY,
        autoFire: !!s.autoFire,
        muted: !!s.muted,
        volume: clamp(Number.isFinite(s.volume) ? s.volume : 1.0, 0, 1),
        sensitivity: clamp(Number.isFinite(s.sensitivity) ? s.sensitivity : 1.0, 0.6, 1.5),
        graphicsMode: VALID_GFX.includes(s.graphicsMode) ? s.graphicsMode : 'auto',
        showPerf: !!s.showPerf,
      };
    } catch {
      return { invertY: false, autoFire: false, muted: false, volume: 1.0, sensitivity: 1.0, graphicsMode: 'auto', showPerf: false };
    }
  }
  _saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); } catch { /* ignore storage restrictions */ }
  }
  _applySettings() {
    const s = this.settings;
    this.input.settings.invertY = s.invertY;
    this.input.settings.autoFire = s.autoFire;
    this.input.settings.sensitivity = s.sensitivity;
    audio.setMuted(s.muted);
    audio.setVolume(s.volume);
    this.hud.setQuickTools({ autoFire: s.autoFire, muted: s.muted });

    const setToggle = (id, on) => {
      const btn = $(id);
      if (!btn) return;
      btn.classList.toggle('on', !!on);
      btn.textContent = on ? 'ON' : 'OFF';
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    };
    setToggle('opt-invert-y', s.invertY);
    setToggle('opt-autofire', s.autoFire);
    setToggle('opt-audio', !s.muted);
    setToggle('opt-perf-hud', s.showPerf);
    const volEl = $('opt-volume');
    if (volEl) volEl.value = String(Math.round(s.volume * 100));
    if ($('opt-vol-val')) $('opt-vol-val').textContent = `${Math.round(s.volume * 100)}%`;
    const sensEl = $('opt-sensitivity');
    if (sensEl) sensEl.value = String(Math.round(s.sensitivity * 100));
    if ($('opt-sens-val')) $('opt-sens-val').textContent = `${s.sensitivity.toFixed(2).replace(/0$/, '')}x`;

    const gfxBtn = $('opt-graphics');
    const gfxDesc = $('opt-gfx-desc');
    const GFX_COPY = {
      auto: 'Auto-adjusts to keep smooth 60 FPS',
      high: 'Full Bloom, high-DPI & full effects',
      balanced: 'Crisp Bloom & balanced GPU load',
      fast: 'Bloom OFF — lightweight & super smooth',
      lite: 'Ultra-Light mode for older/mobile GPUs',
    };
    if (gfxBtn) {
      gfxBtn.textContent = s.graphicsMode.toUpperCase();
      gfxBtn.classList.toggle('on', s.graphicsMode === 'auto' || s.graphicsMode === 'fast' || s.graphicsMode === 'lite');
    }
    if (gfxDesc) gfxDesc.textContent = GFX_COPY[s.graphicsMode] ?? GFX_COPY.auto;
    if (this._qualityPresets) this._syncGraphicsMode(false);
    if (!s.showPerf) this.hud.setPerf(60, 'AUTO', true, false);
  }
  _cycleGraphicsMode() {
    const order = ['auto', 'high', 'balanced', 'fast', 'lite'];
    const i = order.indexOf(this.settings.graphicsMode);
    this.settings.graphicsMode = order[(i + 1) % order.length];
    this._saveSettings();
    this._applySettings();
    audio.ui();
  }
  _toggleAutoFire(announce = true) {
    this.settings.autoFire = !this.settings.autoFire;
    this._saveSettings();
    this._applySettings();
    audio.ui();
    if (announce && this.state === 'playing' && !this.paused) {
      this.hud.callout(this.settings.autoFire ? 'AUTO-FIRE ON' : 'AUTO-FIRE OFF', '⚡', this.settings.autoFire ? '#74ffd0' : '#a8c8f0');
    }
  }
  _toggleMute() {
    audio.init();
    this.settings.muted = !this.settings.muted;
    this._saveSettings();
    this._applySettings();
  }
  _syncPauseModal(fromTitle = false) {
    if ($('pause-kicker')) $('pause-kicker').textContent = fromTitle ? 'FLIGHT CONFIGURATION' : 'COCKPIT TACTICAL MENU';
    if ($('pause-title')) $('pause-title').textContent = fromTitle ? 'FLIGHT OPTIONS' : 'PAUSED';
    if ($('btn-pause-resume')) $('btn-pause-resume').innerHTML = fromTitle ? 'CLOSE OPTIONS <b>ESC</b>' : 'RESUME FLIGHT <b>ESC</b>';
    $('btn-pause-restart')?.classList.toggle('hidden', fromTitle);
    $('btn-pause-title')?.classList.toggle('hidden', fromTitle);
    if ($('pause-gp-status')) {
      $('pause-gp-status').innerHTML = this.input.gamepad.connected
        ? '<b>GAMEPAD</b> Connected &amp; Active'
        : '<b>GAMEPAD</b> Ready when connected';
    }
  }
  _openOptionsFromTitle() {
    if (this.state !== 'title') return;
    this.state = 'options';
    this._applySettings();
    this._syncPauseModal(true);
    $('pause-screen').classList.remove('hidden');
    $('pause-screen').setAttribute('aria-hidden', 'false');
    audio.ui();
  }
  _closeOptionsFromTitle() {
    if (this.state !== 'options') return;
    $('pause-screen').classList.add('hidden');
    $('pause-screen').setAttribute('aria-hidden', 'true');
    this.state = 'title';
    audio.ui();
  }
  _togglePause() {
    if (this.state === 'options') { this._closeOptionsFromTitle(); return; }
    if (this.state !== 'playing' && !this.paused) return;
    this.paused = !this.paused;
    this._applySettings();
    this._syncPauseModal(false);
    $('pause-screen').classList.toggle('hidden', !this.paused);
    $('pause-screen').setAttribute('aria-hidden', this.paused ? 'false' : 'true');
    this.input.setTouchEnabled(!this.paused);
    audio.ui();
  }
  _restartWave() {
    if (!this.paused) return;
    this.paused = false;
    $('pause-screen').classList.add('hidden');
    $('pause-screen').setAttribute('aria-hidden', 'true');
    this.hp = 100;
    this.player.meter = 100;
    this.player.invuln = 1.5;
    this.player.x = 0; this.player.y = 12;
    this.player.vx = 0; this.player.vy = 0;
    audio.ui();
    this.loadWave(this.wave);
  }
  _quitToTitle() {
    this.paused = false;
    if (this._waveClearTimer) { clearTimeout(this._waveClearTimer); this._waveClearTimer = null; this._waveClearFinish = null; }
    $('wave-results')?.classList.add('hidden');
    $('pause-screen').classList.add('hidden');
    $('pause-screen').setAttribute('aria-hidden', 'true');
    if (this.boss) { this.boss.destroy(); this.boss = null; }
    this.enemies.clear();
    this.pickups.clear();
    this.proj.clearEnemyBullets();
    this.wingmates.setVisible(false);
    this.hud.clearDialogue();
    this.hud.hideBoss();
    this.hud.setThreats([]);
    this.hud.setBombPrompt(false);
    audio.ui();
    this._returnToTitle();
  }

  /* ================= input bindings ================= */
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
      if (this.state === 'options') {
        if (e.code === 'Escape' || e.code === 'KeyO') this._closeOptionsFromTitle();
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
      if (this.state === 'waveclear' && (e.code === 'Enter' || e.code === 'Space') && this._waveClearElapsed >= 0.85) {
        this._finishWaveClear();
        return;
      }
      if (this.state === 'title' && e.code === 'KeyQ') { this._openArchive(); return; }
      if (this.state === 'title' && e.code === 'KeyR') { this._openLeaderboard(); return; }
      if (this.state === 'title' && e.code === 'KeyO') { this._openOptionsFromTitle(); return; }
      if (e.code === 'Enter' && !this.paused) this._confirm();
      if ((e.code === 'KeyP' || e.code === 'Escape') && (this.state === 'playing' || this.paused)) {
        e.preventDefault();
        this._togglePause();
        return;
      }
      if (e.code === 'KeyF' && (this.state === 'playing' || this.paused)) this._toggleAutoFire(true);
      if (e.code === 'KeyM') this._toggleMute();
    });
    addEventListener('mousedown', (e) => {
      if (this.state === 'title' && !e.target.closest('.title-actions, #title-ranking-button, #title-settings-button')) this._confirm();
    });
    this.renderer.domElement.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch' && this.state === 'title') {
        e.preventDefault();
        this._confirm();
      }
    }, { passive: false });
    // branch & mode cards are clickable
    for (const card of document.querySelectorAll('#branch-screen .branch-card')) {
      card.addEventListener('click', () => this._chooseBranch(card.dataset.opt));
    }
    for (const card of document.querySelectorAll('#mode-screen .mode-card')) {
      card.addEventListener('click', () => this._chooseMode(card.dataset.mode));
    }
    $('title-ranking-button')?.addEventListener('click', (e) => { e.stopPropagation(); this._openLeaderboard(); });
    $('title-settings-button')?.addEventListener('click', (e) => { e.stopPropagation(); this._openOptionsFromTitle(); });
    $('leaderboard-close')?.addEventListener('click', () => this._closeLeaderboard());
    $('rank-entry-submit')?.addEventListener('click', () => this._submitRankEntry());
    $('rank-entry-skip')?.addEventListener('click', () => this._dismissRankEntry());
    $('rank-entry-name')?.addEventListener('input', (e) => {
      e.target.value = sanitizePilotName(e.target.value);
      e.target.removeAttribute('aria-invalid');
    });

    // HUD quick utility buttons (block pointer propagation so clicking never fires weapons)
    const bindHudBtn = (id, fn) => {
      const btn = $(id);
      if (!btn) return;
      const stop = (e) => e.stopPropagation();
      btn.addEventListener('mousedown', stop);
      btn.addEventListener('pointerdown', stop);
      btn.addEventListener('click', (e) => { e.stopPropagation(); btn.blur(); fn(); });
    };
    bindHudBtn('btn-hud-autofire', () => this._toggleAutoFire(true));
    bindHudBtn('btn-hud-mute', () => this._toggleMute());
    bindHudBtn('btn-hud-pause', () => this._togglePause());

    // Pause & Flight Options modal controls
    $('opt-invert-y')?.addEventListener('click', () => {
      this.settings.invertY = !this.settings.invertY;
      this._saveSettings(); this._applySettings(); audio.ui();
    });
    $('opt-autofire')?.addEventListener('click', () => this._toggleAutoFire(false));
    $('opt-audio')?.addEventListener('click', () => this._toggleMute());
    $('opt-volume')?.addEventListener('input', (e) => {
      audio.init();
      this.settings.volume = clamp(Number(e.target.value) / 100, 0, 1);
      if (this.settings.volume > 0 && this.settings.muted) this.settings.muted = false;
      this._saveSettings(); this._applySettings();
    });
    $('opt-sensitivity')?.addEventListener('input', (e) => {
      this.settings.sensitivity = clamp(Number(e.target.value) / 100, 0.6, 1.5);
      this._saveSettings(); this._applySettings();
    });
    $('opt-graphics')?.addEventListener('click', () => this._cycleGraphicsMode());
    $('opt-perf-hud')?.addEventListener('click', () => {
      this.settings.showPerf = !this.settings.showPerf;
      this._saveSettings(); this._applySettings(); audio.ui();
    });
    $('btn-pause-resume')?.addEventListener('click', () => this._togglePause());
    $('btn-pause-restart')?.addEventListener('click', () => this._restartWave());
    $('btn-pause-title')?.addEventListener('click', () => this._quitToTitle());
    $('pause-screen')?.addEventListener('click', (e) => {
      if (e.target === $('pause-screen')) this._togglePause();
    });

    // Clickable end-screen buttons
    $('btn-go-retry')?.addEventListener('click', () => {
      if (this.state !== 'gameover') return;
      audio.init(); audio.resume(); audio.ui();
      this.startGame(this.runMode);
    });
    $('btn-go-title')?.addEventListener('click', () => {
      if (this.state !== 'gameover') return;
      audio.ui(); this._returnToTitle();
    });
    $('btn-vic-title')?.addEventListener('click', () => {
      if (this.state !== 'victory') return;
      audio.ui(); this._returnToTitle();
    });
    $('btn-end-title')?.addEventListener('click', () => {
      if (this.state !== 'victory') return;
      audio.ui(); this._returnToTitle();
    });
  }

  _confirm() {
    audio.init(); audio.resume();
    if (this.state === 'title') { audio.ui(); this._showModeSelect(); }
    else if (this.state === 'gameover') {
      audio.ui();
      this.startGame(this.runMode);
    } else if (this.state === 'victory') {
      audio.ui();
      this._returnToTitle();
    }
  }

  /* ================= combat helpers ================= */
  _flashLight(pos, color = 0xff9a44, intensity = 55, distance = 195, decay = 9.5) {
    if (!this.fxLight || !this._dynamicLightEnabled || !pos) return;
    if (intensity >= this.fxLight.intensity * 0.72) {
      this.fxLight.position.copy(pos);
      this.fxLight.color.setHex(color);
      this.fxLight.intensity = intensity;
      this.fxLight.distance = distance;
      this._fxLightDecay = decay;
    }
  }

  explodeAt(pos, big = false, opts = {}) {
    const scaleMul = opts.scaleMul ?? 1;
    this.particles.explosion(pos.x, pos.y, pos.z, big, scaleMul);
    this.particles.zoneResidue(pos.x, pos.y, pos.z, this.zone?.id, big);
    this.debris.burst(pos.x, pos.y, pos.z, {
      count: opts.count ?? (big ? 11 : 6),
      scale: (opts.scale ?? (big ? 1.55 : 1.08)) * scaleMul,
      color: opts.color,
      speed: opts.speed ?? (big ? 1.35 : 1.12),
      vzBias: opts.vzBias ?? (pos.z > -140 ? 34 : 18),
      profile: this.zone?.id,
    });
    this.terrain.impactMark(pos, big, opts);
    if (this.zone?.water && pos.y < 14) this.particles.splash(pos.x, pos.z);
    audio.explosion(big);
    const closeFactor = pos.z > -120 ? 1.35 : 1.0;
    this._flashLight(pos, opts.lightColor ?? 0xff943a, (big ? 92 : 48) * closeFactor, big ? 245 : 170, big ? 7.5 : 10.5);
    this.shake = Math.min(this.shake + (big ? 1.05 : 0.48) * closeFactor, 2.0);
    this.camKick = Math.min(this.camKick + (big ? 0.85 : 0.32) * closeFactor, 1.4);
  }

  /** Centralised visceral kill handler: close-kill / counter bonus, score popups, death spiral & scaled blasts */
  _handleEnemyKill(e, fromPlayer = true, instant = false, opts = {}) {
    const pos = e.mesh.position;
    const closeKill = fromPlayer && pos.z > -115;
    const baseScore = fromPlayer ? e.score : Math.round(e.score * 0.6);
    const mul = opts.scoreMul ?? (closeKill ? 1.5 : 1.0);
    const awarded = Math.round(baseScore * mul);

    this.addScore(awarded);
    this.waveStats.kills++;
    this.stats.kills++;
    if (fromPlayer) {
      this._onKill(pos);
      this.hud.hitConfirm(true);
      const tag = opts.tag ?? (closeKill ? 'CLOSE KILL!' : (e.tier === 'heavy' ? 'DESTROYED!' : ''));
      this.hud.killPop(this._toScreen(pos), awarded, tag, opts.style ?? '');
      this._dropLoot(e);
    } else {
      this.wingmates.reportKill();
    }

    const canSpinOut = !instant && !e.ground && (e.tier === 'medium' || e.tier === 'heavy') && e.type !== 'pod' && e.type !== 'mine';
    if (canSpinOut && this.enemies.beginDying(e, true)) {
      // Initial engine-rupture pop before the flaming spin-out culminates in a huge blast!
      this.particles.flash(pos.x, pos.y, pos.z, e.tier === 'heavy' ? 1.6 : 1.1, 0xffe4a0);
      this.particles.fireball(pos.x, pos.y, pos.z, e.tier === 'heavy' ? 1.8 : 1.15);
      this.particles.sparks(pos.x, pos.y, pos.z, 1.3);
      audio.explosion(false);
      this.shake = Math.min(this.shake + 0.42, 1.8);
      if (e.tier === 'heavy') this.timeScale = Math.min(this.timeScale, 0.72);
      return;
    }

    const big = e.tier === 'heavy' || e.type === 'pod';
    const scaleMul = e.tier === 'heavy' ? 1.35 : e.tier === 'medium' ? 1.14 : 1.0;
    this.explodeAt(pos, big, { scaleMul });
    if (fromPlayer && (big || closeKill)) {
      this.timeScale = Math.min(this.timeScale, big ? 0.62 : 0.84);
      if (big) this.hud.flash(0.32, 70);
    }
    this.enemies.kill(e, true);
  }

  /** Final catastrophic explosion when a spinning, burning enemy breaks apart! */
  finalizeEnemyDeath(e) {
    const pos = e.mesh.position;
    const big = e.tier === 'heavy' || pos.z > -95;
    const scaleMul = e.tier === 'heavy' ? 1.42 : 1.18;
    this.explodeAt(pos, big, { scaleMul, count: e.tier === 'heavy' ? 14 : 8, vzBias: 42 });
    if (e.tier === 'heavy') {
      this.hud.flash(0.38, 85);
      this.timeScale = Math.min(this.timeScale, 0.60);
    }
  }

  /** detonate a bomb: 3x-radius blast; a manual (2nd-B) detonation is the big one */
  _detonateBomb(b, manual = false) {
    if (!b.active) return;
    b.active = false; b.mesh.visible = false;
    const bp = _v3.copy(b.mesh.position);
    audio.bomb();
    this.hud.flash(manual ? 0.9 : 0.6, manual ? 170 : 110);
    this._flashLight(bp, manual ? 0x9cf0ff : 0xffd076, manual ? 165 : 115, manual ? 340 : 250, 5.5);
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
    this.player.triggerDamageShield();
    this.hud.hurt();
    this.shake = Math.min(this.shake + 0.7, 1.8);
    audio.playerHit();
    this.player.invuln = 0.8;
    this._breakCombo();
    // iconic first-hit coaching from a wingmate
    if (src === 'bullet' && !this._rollHinted) {
      this._rollHinted = true;
      this.hud.callout('DO A BARREL ROLL!', '↻', '#8bffb0');
      this.hud.say('KIT', 'Bowie, double-tap A/D or ←/→ (or Q/E) to barrel roll and deflect their fire!', 3.6);
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

    // hold C / right mouse: charge a multi-lock homing volley (up to 3 simultaneous targets!)
    if (this.input.chargeHeld) {
      if (!p.charging) {
        p.charging = true; p.charge = 0;
        this._chargeLocks.length = 0;
        this._chargeLock = null;
        audio.chargeStart();
      }
      p.charge = Math.min(1, p.charge + dt / 0.62);
      this._updateChargeLock();
    } else if (p.charging) {
      if (p.charge > 0.30) this._releaseCharge();
      else audio.chargeEnd(false);
      p.charging = false; p.charge = 0;
      this._chargeLocks.length = 0;
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
    const isBoost = this.input.boosting && p.meter > 2;
    const isBrake = !isBoost && this.input.braking && p.meter > 2;
    if (isBoost && !this._wasBoosting) audio.boost(true);
    if (isBrake && !this._wasBraking) audio.boost(false);
    this._wasBoosting = isBoost;
    this._wasBraking = isBrake;
  }

  _findAimAssistTarget(farScreen) {
    if (!farScreen) return null;
    let best = null, bestD = 145;
    for (const c of this._lockCandidates()) {
      const s = this._toScreen(c.pos());
      if (!s) continue;
      const d = Math.hypot(s.x - farScreen.x, s.y - farScreen.y);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  _fireLasers() {
    const p = this.player;
    const muzzle = new THREE.Vector3(); p.muzzle(muzzle);
    const aim = new THREE.Vector3(); p.aimFar(aim);
    // gentle aim assist: snap to a target near the far reticle
    const farScreen = this._toScreen(aim);
    const best = this._findAimAssistTarget(farScreen);
    if (best) aim.copy(best.pos());
    const lvl = p.laserLevel;
    const dmg = lvl >= 3 ? 1.75 : lvl === 2 ? 1.25 : 1;
    const offsets = lvl === 1 ? [0] : lvl === 2 ? [-1.8, 1.8] : [-2.6, 0, 2.6];
    for (const s of offsets) {
      const origin = s === 0 ? muzzle : _v3.copy(muzzle).setX(muzzle.x + s);
      this.proj.fireLaser(origin, aim, dmg, lvl);
      this.particles.laserMuzzle(origin.x, origin.y + 0.1, origin.z - 1, lvl);
    }
    p.recoilT = 0.08;
    this.waveStats.shots += offsets.length;
    audio.laser(lvl);
  }

  _isLocked(ref) {
    if (!ref) return false;
    for (let i = 0; i < this._chargeLocks.length; i++) {
      if (this._chargeLocks[i].ref === ref) return true;
    }
    return false;
  }

  _lockCandidates() {
    if (this._candidatesFrame === this._frameNum) return this._candidatesCache;
    this._candidatesFrame = this._frameNum;
    const out = this._candidatesCache;
    out.length = 0;
    for (const e of this.enemies.list) {
      if (!e.dying && e.mesh.position.z > -330 && e.mesh.position.z < -24) {
        out.push({ pos: () => e.mesh.position, alive: true, ref: e });
      }
    }
    if (this.boss?.alive) {
      for (const w of this.boss.weakpoints) {
        if (w.alive && w.active) {
          const wpVec = w._lockPos || (w._lockPos = new THREE.Vector3());
          w.worldPos(wpVec);
          out.push({ pos: () => wpVec, alive: true, ref: w, isWeak: true });
        }
      }
    }
    return out;
  }

  _updateChargeLock() {
    // Prune dead / out-of-range locks first
    for (let i = this._chargeLocks.length - 1; i >= 0; i--) {
      const l = this._chargeLocks[i];
      const alive = l.isWeak ? (this.boss?.alive && l.ref.alive && l.ref.active) : (l.ref.alive && !l.ref.dying && l.ref.mesh.position.z < -20);
      if (!alive) this._chargeLocks.splice(i, 1);
    }

    // Sweep reticle across enemies to acquire up to 3 simultaneous locks!
    this.player.aimFar(_v1);
    const farScreen = this._toScreen(_v1);
    if (!farScreen) { this._chargeLock = this._chargeLocks[0] ?? null; return; }

    if (this._chargeLocks.length < 3) {
      let best = null, bestD = 165;
      for (const c of this._lockCandidates()) {
        if (this._isLocked(c.ref)) continue;
        const s = this._toScreen(c.pos());
        if (!s) continue;
        const d = Math.hypot(s.x - farScreen.x, s.y - farScreen.y);
        if (d < bestD) { bestD = d; best = c; }
      }
      if (best) {
        this._chargeLocks.push(best);
        audio.lockBeep(this._chargeLocks.length - 1);
      }
    }
    this._chargeLock = this._chargeLocks[0] ?? null;
  }

  _releaseCharge() {
    const p = this.player;
    p.muzzle(_v1);
    const locks = this._chargeLocks;
    if (locks.length > 0) {
      const n = locks.length;
      for (let i = 0; i < n; i++) {
        const lock = locks[i];
        const target = {
          get alive() { return lock.isWeak ? (lock.ref.alive && lock.ref.active) : (lock.ref.alive && !lock.ref.dying); },
          pos: () => lock.ref.worldPos ? lock.ref.worldPos(lock.ref._lockPos || (lock.ref._lockPos = new THREE.Vector3())) : lock.ref.mesh.position,
        };
        const fanX = n === 1 ? 0 : (i - (n - 1) * 0.5) * 72;
        const fanY = n === 3 && i === 1 ? 34 : 0;
        this.proj.fireCharge(_v1, target, fanX, fanY);
        this.waveStats.shots++;
      }
    } else {
      this.proj.fireCharge(_v1, null);
      this.waveStats.shots++;
    }
    audio.chargeEnd(true);
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

  /** Unified solid-world collider iterator covering terrain rocks/cliffs/setpieces AND artificial Props structures */
  forEachWorldObstacle(cb) {
    this.terrain.forEachObstacle(cb);
    this.props.forEachObstacle(cb);
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
        if (e.dying) continue;
        if (bp.distanceTo(e.mesh.position) < e.radius + 2.6) {
          this.waveStats.hits++;
          audio.enemyHit(b.level);
          this.hud.hitConfirm(false);
          this.particles.laserImpact(bp.x, bp.y, bp.z, b.level, false);
          if (this.enemies.hit(e, b.dmg)) {
            this._handleEnemyKill(e, true, false);
          }
          consumed = true;
          break;
        }
      }
      if (!consumed && this.boss?.alive) {
        const hit = this.boss.hitTest(bp, 1.8);
        if (hit) {
          this.waveStats.hits++;
          this.hud.hitConfirm(hit.kind === 'weak');
          audio.bossHit(hit.kind === 'weak');
          this.particles.laserImpact(bp.x, bp.y, bp.z, b.level, hit.kind === 'weak');
          this.particles.impact(bp.x, bp.y, bp.z, hit.kind === 'weak' ? 'heavy' : 'orb', hit.kind === 'weak' ? 1.15 : 0.78);
          this.boss.addScorch(bp);
          if (hit.kind === 'weak') {
            const died = hit.wp.hit(b.dmg * 2);
            this.boss.damage(b.dmg * 2);
            if (died) { this.explodeAt(bp, true, { scaleMul: 1.3 }); this.addScore(200); this.timeScale = Math.min(this.timeScale, 0.65); }
          } else {
            this.boss.damage(b.dmg * 0.25);
          }
          consumed = true;
        }
      }
      // Point-defense missile interception: lasers can shoot down incoming enemy homing missiles!
      if (!consumed) {
        for (const eb of this.proj.ebullets) {
          if (!eb.active || eb.deflected || (eb.btype !== 'missile' && eb.btype !== 'homing')) continue;
          if (bp.distanceTo(eb.mesh.position) < 4.4) {
            eb.active = false; eb.mesh.visible = false; eb.targetWingmate = null;
            this.waveStats.hits++;
            this.addScore(15);
            this.hud.hitConfirm(false);
            this.hud.killPop(this._toScreen(eb.mesh.position), 15, 'INTERCEPT!', 'intercept-pop');
            this.particles.flash(eb.mesh.position.x, eb.mesh.position.y, eb.mesh.position.z, 0.9, 0xffe68a);
            this.particles.sparks(eb.mesh.position.x, eb.mesh.position.y, eb.mesh.position.z, 0.85, 0xffe078);
            this.particles.ring(eb.mesh.position.x, eb.mesh.position.y, eb.mesh.position.z, { color: 0xffe078, radius: 7, dur: 0.24, opacity: 0.5 });
            audio.hitTick();
            consumed = true;
            break;
          }
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
        if (e.dying) continue;
        if (bp.distanceTo(e.mesh.position) < e.radius + 2.4) {
          audio.enemyHit(1);
          this.particles.laserImpact(bp.x, bp.y, bp.z, 1, false);
          this.particles.emit(bp.x, bp.y, bp.z, { count: 4, speed: 12, color: 0xbfe8ff, life: 0.22, size: 1.6 });
          if (this.enemies.hit(e, b.dmg)) {
            this._handleEnemyKill(e, false, false);
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
        if (e.dying) continue;
        if (cp.distanceTo(e.mesh.position) < e.radius + 2.5) { boom = true; break; }
      }
      if (!boom && this.boss?.alive && this.boss.hitTest(cp, 3)) boom = true;
      if (!boom) {
        this.forEachWorldObstacle((cx, cy, cz, rh, hy, _dmg, _mesh, isStructure) => {
          if (!boom && Math.abs(cp.y - cy) < hy + 2 && Math.hypot(cp.x - cx, cp.z - cz) < rh + 2) {
            boom = true;
            if (isStructure) this.particles.structureHit(cp.x, cp.y, cp.z, 1.3);
          }
        });
      }
      if (boom || c.life <= 0.05) {
        c.active = false; c.mesh.visible = false;
        if (this.boss?.alive && this.boss.hitTest(cp, 8)) this.boss.addScorch(cp);
        this.explodeAt(cp, true);
        this._areaDamage(cp, 24, 4, true);
      }
    }

    /* bombs — detonate on enemy / boss / scenery / structure contact or fuse timeout */
    for (const b of this.proj.bombs) {
      if (!b.active) continue;
      const bp = b.mesh.position;
      let boom = b.fuse <= 0;
      for (const e of this.enemies.list) {
        if (e.dying) continue;
        if (bp.distanceTo(e.mesh.position) < e.radius + 5) { boom = true; break; }
      }
      if (!boom && this.boss?.alive && this.boss.hitTest(bp, 6)) boom = true;
      if (!boom) {
        this.forEachWorldObstacle((cx, cy, cz, rh, hy) => {
          if (!boom && Math.abs(bp.y - cy) < hy + 3 && Math.hypot(bp.x - cx, bp.z - cz) < rh + 3) boom = true;
        });
      }
      if (boom) this._detonateBomb(b, false);
    }

    /* enemy bullets vs player & deflected counter-shots vs enemies! */
    for (const b of this.proj.ebullets) {
      if (!b.active) continue;
      if (b.deflected) {
        // Reflected shots can counter-kill enemies & damage bosses!
        const bp = b.mesh.position;
        let hitCounter = false;
        for (const e of this.enemies.list) {
          if (e.dying) continue;
          if (bp.distanceTo(e.mesh.position) < e.radius + 3.4) {
            this.particles.laserImpact(bp.x, bp.y, bp.z, 3, true);
            this.hud.hitConfirm(true);
            audio.enemyHit(3);
            if (this.enemies.hit(e, 5.5)) {
              this._handleEnemyKill(e, true, false, { scoreMul: 2.0, tag: 'COUNTER KILL!', style: 'counter-kill' });
              this._flashLight(e.mesh.position, 0x72fff0, 82, 220, 9);
            }
            hitCounter = true;
            break;
          }
        }
        if (!hitCounter && this.boss?.alive) {
          const hit = this.boss.hitTest(bp, 2.8);
          if (hit) {
            this.hud.hitConfirm(true);
            audio.bossHit(true);
            this.particles.laserImpact(bp.x, bp.y, bp.z, 3, true);
            if (hit.kind === 'weak') {
              const died = hit.wp.hit(6);
              this.boss.damage(6);
              if (died) { this.explodeAt(bp, true, { scaleMul: 1.3 }); this.addScore(250); }
            } else {
              this.boss.damage(2.5);
            }
            this.hud.killPop(this._toScreen(bp), 50, 'COUNTER!', 'counter-kill');
            this.addScore(50);
            hitCounter = true;
          }
        }
        if (hitCounter) { b.active = false; b.mesh.visible = false; }
        continue;
      }

      const d = b.mesh.position.distanceTo(playerPos);
      if (P.rolling && d < 9.5) {
        b.deflected = true;
        b.targetWingmate = null;
        // Aim reflected shot back toward the nearest enemy ahead for true Star Fox counters!
        const bp = b.mesh.position;
        const spd = Math.max(195, b.vel.length() * 2.05);
        let counterTarget = null, bestD = 260;
        for (const c of this._lockCandidates()) {
          const cp = c.pos();
          if (cp.z >= bp.z - 8) continue;
          const cd = bp.distanceTo(cp);
          if (cd < bestD) { bestD = cd; counterTarget = cp; }
        }
        if (counterTarget) {
          b.vel.copy(counterTarget).sub(bp).normalize().multiplyScalar(spd);
        } else {
          b.vel.multiplyScalar(-1.85);
          b.vel.z = -Math.abs(b.vel.z) - 85;
          b.vel.x += rand(-16, 16); b.vel.y += rand(-8, 14);
        }
        b.halo.material.color.setHex(0x66fff0);
        b.core.material.color.setHex(0xeaffff);
        if (b.ring) { b.ring.visible = true; b.ring.material.color.setHex(0x66fff0); b.ring.scale.setScalar(1.38); }
        b.mesh.lookAt(_v1.copy(bp).add(b.vel));
        b.life = 2.2;
        this.addScore(5);
        P.triggerDeflect();
        audio.deflect();
        this._flashLight(playerPos, 0x76fff0, 38, 95, 14);
        this.particles.ring(bp.x, bp.y, bp.z, { color: 0x8effea, radius: 5.5, dur: 0.26, opacity: 0.65 });
        this.particles.emit(bp.x, bp.y, bp.z, { count: 6, speed: 15, color: 0xbfffe8, life: 0.28, size: 1.8 });
        if (this._deflectPopCd <= 0) {
          this._deflectPopCd = 0.45;
          this.hud.killPop(this._toScreen(playerPos), 5, 'DEFLECT!', 'counter-kill');
        }
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
      if (e.type === 'mine' || e.dying) continue;
      if (e.mesh.position.distanceTo(playerPos) < e.radius + 1.8) {
        this.explodeAt(e.mesh.position, e.tier === 'heavy');
        this.enemies.kill(e, false);
        this.damagePlayer(12, 'ram');
      }
    }

    /* projectiles vs world obstacles (terrain rocks, cliffs & artificial structures block all fire solidly!) */
    for (const b of this.proj.lasers) {
      if (!b.active) continue;
      const bp = b.mesh.position;
      this.forEachWorldObstacle((cx, cy, cz, rh, hy, _dmg, _mesh, isStructure) => {
        if (b.active && Math.abs(bp.y - cy) < hy && Math.hypot(bp.x - cx, bp.z - cz) < rh) {
          b.active = false; b.mesh.visible = false;
          if (isStructure) this.particles.structureHit(bp.x, bp.y, bp.z, 0.92);
          else this.particles.terrainChip(bp.x, bp.y, bp.z, this.zone?.id, 0.86);
        }
      });
    }
    for (const b of this.proj.alasers) {
      if (!b.active) continue;
      const bp = b.mesh.position;
      this.forEachWorldObstacle((cx, cy, cz, rh, hy, _dmg, _mesh, isStructure) => {
        if (b.active && Math.abs(bp.y - cy) < hy && Math.hypot(bp.x - cx, bp.z - cz) < rh) {
          b.active = false; b.mesh.visible = false;
          if (isStructure) this.particles.structureHit(bp.x, bp.y, bp.z, 0.65);
          else this.particles.terrainChip(bp.x, bp.y, bp.z, this.zone?.id, 0.65);
        }
      });
    }
    for (const b of this.proj.ebullets) {
      if (!b.active) continue;
      const bp = b.mesh.position;
      if (bp.z < -175 || bp.z > 45) continue;
      this.forEachWorldObstacle((cx, cy, cz, rh, hy, _dmg, _mesh, isStructure) => {
        if (b.active && Math.abs(bp.y - cy) < hy && Math.hypot(bp.x - cx, bp.z - cz) < rh) {
          b.active = false; b.mesh.visible = false; b.targetWingmate = null;
          if (isStructure) this.particles.structureHit(bp.x, bp.y, bp.z, 0.72);
          else this.particles.terrainChip(bp.x, bp.y, bp.z, this.zone?.id, 0.72);
        }
      });
    }

    /* solid world obstacles vs player: non-penetrable physical push-out ALWAYS (even while rolling or invulnerable!) */
    let struck = null;
    this.forEachWorldObstacle((cx, cy, cz, rh, hy, dmg, _mesh, isStructure) => {
      const padY = hy + P.radius;
      if (Math.abs(P.y - cy) >= padY) return;
      const padR = rh + P.radius;
      const dx = P.x - cx;
      const dz = PLAYER_Z - cz;
      const dist = Math.hypot(dx, dz);
      if (dist >= padR) return;
      // Physical push-out so player can NEVER clip through cliffs, rocks, towers or artificial installations!
      if (P.y >= cy + hy * 0.52 && cy + padY + 1.0 <= P.bounds.yMax) {
        P.y = cy + padY + 1.0;
        P.vy = Math.max(P.vy, 36);
      } else {
        const dirX = Math.abs(dx) > 0.3 ? Math.sign(dx) : (cx > 0 ? -1 : 1);
        const needX = Math.sqrt(Math.max(1, padR * padR - dz * dz)) + 1.2;
        P.x = clamp(cx + dirX * needX, -P.bounds.x, P.bounds.x);
        P.vx = dirX * Math.max(Math.abs(P.vx) * 0.7, 92);
      }
      P.mesh.position.set(P.x, P.y, PLAYER_Z + P.zShift);
      if (!struck || dmg > struck.dmg) struck = { cx, cy, dmg, isStructure };
    });
    if (struck) {
      if (struck.isStructure) this.particles.structureHit(P.x, P.y, PLAYER_Z, 1.35);
      else this.particles.terrainChip(P.x, P.y, PLAYER_Z, this.zone?.id, 1.25);
      if (P.invuln <= 0) {
        if (P.rolling) {
          // Glancing shield-scrape while rolling: physical bounce + welding sparks + light shield hit
          P.triggerDeflect();
          this.shake = Math.min(this.shake + 0.45, 1.4);
          audio.deflect();
          this.hp = Math.max(1, this.hp - Math.round(struck.dmg * 0.35));
          P.invuln = 0.45;
        } else {
          this.damagePlayer(struck.dmg, 'crash');
          this.explodeAt(_v1.set(P.x, P.y, PLAYER_Z), false);
        }
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
      if (e.dying) continue;
      if (center.distanceTo(e.mesh.position) < radius + e.radius) {
        if (this.enemies.hit(e, dmg)) {
          this._handleEnemyKill(e, fromPlayer, true);
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
    this._waveClearElapsed = 0;
    this._waveClearFinish = () => {
      if (this.state !== 'waveclear') return;
      clearTimeout(this._waveClearTimer);
      this._waveClearTimer = null;
      this._waveClearFinish = null;
      $('wave-results').classList.add('hidden');
      if (branchHere) this._showBranch();
      else this.loadWave(this.wave + 1);
    };
    this._waveClearTimer = setTimeout(() => this._waveClearFinish?.(), 3400);
  }
  _finishWaveClear() {
    if (this._waveClearFinish) {
      audio.ui();
      this._waveClearFinish();
    }
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
    this._frameNum++;
    this.input.pollGamepad();
    if (this.input.justPressed('GamepadPause') && (this.state === 'playing' || this.paused || this.state === 'options')) {
      this._togglePause();
    }
    if (this.input.justPressed('GamepadConfirm') && !this.paused) {
      if (this.state === 'waveclear' && this._waveClearElapsed >= 0.85) this._finishWaveClear();
      else if (['title', 'gameover', 'victory'].includes(this.state)) this._confirm();
    }
    if (this.state === 'waveclear' && !this.paused) this._waveClearElapsed += rawDt;
    if (this.fxLight.intensity > 0.15) {
      this.fxLight.intensity = damp(this.fxLight.intensity, 0, this._fxLightDecay, rawDt);
    } else if (this.fxLight.intensity !== 0) {
      this.fxLight.intensity = 0;
    }
    if (this._deflectPopCd > 0) this._deflectPopCd = Math.max(0, this._deflectPopCd - rawDt);

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
    this.atmosphere.update(dt, scroll, this.player);
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
      this.proj.update(dt, scroll, this.player, this.particles);
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

      // Dramatic low-altitude water wake & spray rings (STAR_FOX_1.jpeg)
      if (this.zone?.water && this.player.y < 9.0 && Math.random() < dt * 18) {
        this.particles.splash(this.player.x + rand(-3, 3), PLAYER_Z + rand(2, 7));
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
    this.camKick = damp(this.camKick, 0, 7.5, dt);
    // Closer, tighter Star Fox dogfight chase cam: enemies & allies loom much larger!
    const backZ = PLAYER_Z + 30 + boostK * -3.5 + this.camKick * 2.2;
    _v1.set(P.x, P.y + 4.8, backZ);
    cam.position.x = damp(cam.position.x, _v1.x, 9, dt);
    cam.position.y = damp(cam.position.y, _v1.y, 9, dt);
    cam.position.z = damp(cam.position.z, _v1.z, 5.5, dt);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 3.2);
      cam.position.x += rand(-1, 1) * this.shake * 0.58;
      cam.position.y += rand(-1, 1) * this.shake * 0.48;
    }
    cam.lookAt(cam.position.x + (P.x - cam.position.x) * 0.42, P.y + 1.4, PLAYER_Z - 85);
    cam.rotation.z += clamp(-P.vx * 0.0012, -0.09, 0.09) + P.rollAngle * 0.022;
    const wantFov = 65 + boostK * 9 + this.camKick * 3.0;
    cam.fov = damp(cam.fov, wantFov, 5.5, dt);
    cam.updateProjectionMatrix();
    this.bloom.strength = 0.34 + Math.max(boostK, 0) * 0.22 + this.camKick * 0.14;
  }

  _updateHud(dt) {
    const P = this.player;
    this.hud.setBars(this.hp, P.meter);
    this.hud.setFlightState(P.speedFactor);
    this.hud.setScore(this.score);
    this.hud.setLives(Math.max(this.lives, 0));
    this.hud.setLaserLevel(P.laserLevel);
    this.hud.setBombs(P.bombs);
    this.hud.setBombPrompt(this.proj.bombs.some((b) => b.active));
    if (this.combo >= 2) this.hud.setComboTimer(this.comboTimer / 2.6);

    const waveProg = this.waveSpec ? clamp(this.waveTimer / Math.max(1, this.waveSpec.length), 0, 1) : 0;
    this.hud.setWaveProgress(
      this.wave,
      FINAL_WAVE,
      this.zone?.name ?? '',
      waveProg,
      this.enemies.aliveCount,
      this.rival.active ? 'RIVAL DUEL' : ''
    );

    // reticles + soft aim-assist target snap
    P.aimNear(_v1);
    const near = this._toScreen(_v1);
    P.aimFar(_v1);
    const far = this._toScreen(_v1);
    const aimTarget = !P.charging ? this._findAimAssistTarget(far) : null;
    if (near && far) this.hud.reticle(near, far, this._chargeLocks.length > 0, !!aimTarget);
    // charge ring + multi-lock markers (up to 3 simultaneous locks)
    if (P.charging && far) this.hud.charge(P.charge, far.x, far.y);
    else this.hud.charge(0, 0, 0);
    const lockPos = [];
    for (let i = 0; i < this._chargeLocks.length; i++) {
      const s = this._toScreen(this._chargeLocks[i].pos());
      if (s) lockPos.push(s);
    }
    this.hud.locks(lockPos);

    // Off-screen threat edge indicators (flanking attackers & incoming homing/heavy rounds)
    const W = innerWidth, H = innerHeight, pad = 34;
    const threats = [];
    const pushThreat = (pos, kind, urgency) => {
      const s = this._toScreen(pos);
      if (!s) return;
      if (s.x >= pad && s.x <= W - pad && s.y >= pad && s.y <= H - pad) return;
      const dx = s.x - W * 0.5, dy = s.y - H * 0.5;
      const angleDeg = Math.atan2(dy, dx) * 180 / Math.PI + 90;
      // Intersect ray from screen center with viewport edge box
      const hw = W * 0.5 - pad, hh = H * 0.5 - pad;
      const scale = Math.min(hw / Math.max(Math.abs(dx), 0.001), hh / Math.max(Math.abs(dy), 0.001));
      threats.push({
        x: W * 0.5 + dx * scale,
        y: H * 0.5 + dy * scale,
        angleDeg,
        kind,
        urgency,
        opacity: clamp(0.45 + urgency * 0.55, 0.45, 1),
      });
    };
    for (const b of this.proj.ebullets) {
      if (!b.active || b.deflected) continue;
      const bp = b.mesh.position;
      if (bp.z > -125 && bp.z < PLAYER_Z + 4 && (b.btype === 'homing' || b.btype === 'missile' || b.radius > 1.35)) {
        pushThreat(bp, 'missile', clamp((bp.z + 125) / 105, 0, 1));
      }
    }
    for (const e of this.enemies.list) {
      if (e.dying || e.type === 'mine') continue;
      const ep = e.mesh.position;
      if (ep.z > -155 && ep.z < PLAYER_Z - 2) {
        pushThreat(ep, 'enemy', clamp((ep.z + 155) / 135, 0, 1) * 0.85);
      }
    }
    threats.sort((a, b) => b.urgency - a.urgency);
    this.hud.setThreats(threats.slice(0, 4));
  }

  render() {
    // Emergency tier skips the full-screen post chain but leaves world/HUD
    // rendering and all combat simulation intact.
    if (this._qualityPresets[this._qualityIndex].post) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
}
