/* WebAudio: generated per-scene BGM, CC0 layered SFX, and procedural fallbacks. */

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

const TRACKS = {
  title: {
    bpm: 100, swing: 0,
    chords: [[48, 55, 60, 64], [45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 59]],
    bass: [0, null, 0, null, 7, null, 0, null, 0, null, 0, null, 7, null, 12, null],
    arp: 'updown', arpOct: 1, lead: true,
    kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
    padGain: 0.16, arpGain: 0.11, bassGain: 0.2,
  },
  sea: {
    bpm: 98, swing: 0.08,
    chords: [[45, 52, 57, 60], [41, 48, 53, 57], [48, 55, 60, 64], [43, 50, 55, 59]],
    bass: [0, null, null, 0, null, null, 0, null, 0, null, null, 0, null, 7, null, null],
    arp: 'up', arpOct: 1, lead: false,
    kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0],
    padGain: 0.2, arpGain: 0.085, bassGain: 0.19,
  },
  gorge: {
    bpm: 122, swing: 0,
    chords: [[48, 55, 60, 64], [43, 50, 55, 59], [45, 52, 57, 60], [41, 48, 53, 57]],
    bass: [0, 0, null, 0, null, 0, 0, null, 0, 0, null, 0, 7, null, 12, null],
    arp: 'updown', arpOct: 1, lead: true,
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
    hat: [1, 0, 1, 1, 0, 0, 1, 0, 1, 0, 1, 1, 0, 0, 1, 1],
    padGain: 0.13, arpGain: 0.12, bassGain: 0.22,
  },
  ember: {
    bpm: 124, swing: 0,
    chords: [[50, 57, 62, 65], [46, 53, 58, 62], [43, 50, 55, 58], [45, 52, 57, 61]],
    bass: [0, null, 0, 0, null, 0, null, 0, 0, null, 0, 0, null, 0, 3, 5],
    arp: 'down', arpOct: 1, lead: true,
    kick: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hat: [1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1],
    padGain: 0.14, arpGain: 0.1, bassGain: 0.24,
  },
  dune: {
    bpm: 128, swing: 0,
    chords: [[50, 57, 62, 66], [45, 52, 57, 61], [47, 54, 59, 62], [43, 50, 55, 59]],
    bass: [0, null, 0, null, 0, 7, null, 0, 0, null, 0, null, 0, 7, 12, null],
    arp: 'updown', arpOct: 2, lead: true,
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hat: [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1],
    padGain: 0.12, arpGain: 0.12, bassGain: 0.22,
  },
  boss: {
    bpm: 142, swing: 0,
    chords: [[40, 47, 52, 55], [48, 55, 60, 63], [38, 45, 50, 53], [47, 54, 59, 62]],
    bass: [0, 0, null, 0, 0, null, 0, 0, 0, 0, null, 0, 0, null, 1, 2],
    arp: 'down', arpOct: 2, lead: true,
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0],
    hat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    padGain: 0.15, arpGain: 0.13, bassGain: 0.27,
  },
  victory: {
    bpm: 112, swing: 0,
    chords: [[48, 55, 60, 64], [53, 60, 65, 69], [55, 62, 67, 71], [48, 55, 60, 64]],
    bass: [0, null, 7, null, 0, null, 7, null, 0, null, 7, null, 12, null, 12, null],
    arp: 'up', arpOct: 2, lead: true,
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
    padGain: 0.18, arpGain: 0.13, bassGain: 0.2,
  },
  // The downloaded full-length ending score remains optional; this preserves a resilient in-browser fallback.
  ending: {
    bpm: 88, swing: 0,
    chords: [[41, 48, 53, 57], [43, 50, 55, 60], [48, 55, 60, 64], [45, 52, 57, 62]],
    bass: [0, null, null, 7, null, null, 0, null, 0, null, 7, null, 12, null, null, 7],
    arp: 'up', arpOct: 2, lead: true,
    kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hat: [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0],
    padGain: 0.24, arpGain: 0.10, bassGain: 0.16,
  },
};

// High-quality music downloaded from Scott Buckley's official CC BY 4.0 library.
// Full-length MP3s are looped by WebAudio; exact credits are in CREDITS_ASSETPACK.txt.
const MUSIC_FILES = {
  title: './assets/audio/music/title.mp3',
  sea: './assets/audio/music/sea.mp3',
  gorge: './assets/audio/music/gorge.mp3',
  ember: './assets/audio/music/ember.mp3',
  dune: './assets/audio/music/dune.mp3',
  boss: './assets/audio/music/boss.mp3',
  victory: './assets/audio/music/victory.mp3',
  ending: './assets/audio/music/ending_majestic.mp3',
};

// Kenney Sci-fi Sounds 1.0 (CC0) — layered quietly with the existing responsive synthesis.
const SFX_FILES = {
  laser: './assets/audio/sfx/laserRetro_001.ogg',
  chargedLaser: './assets/audio/sfx/laserLarge_003.ogg',
  explosion: './assets/audio/sfx/explosionCrunch_003.ogg',
  explosionBig: './assets/audio/sfx/lowFrequency_explosion_000.ogg',
  impact: './assets/audio/sfx/impactMetal_002.ogg',
  shield: './assets/audio/sfx/forceField_002.ogg',
  missileMk1: './assets/audio/sfx/missile_launch_mk1.ogg',
  missileMk2: './assets/audio/sfx/missile_launch_mk2.ogg',
  missileMk3: './assets/audio/sfx/missile_launch_mk3.ogg',
  commsWatchMyBack: './assets/audio/voice/wingmate_watch_my_back.ogg',
  commsCoverMe: './assets/audio/voice/wingmate_cover_me.ogg',
  commsTargetEngaged: './assets/audio/voice/target_engaged.ogg',
  commsTargetDestroyed: './assets/audio/voice/target_destroyed.ogg',
  commsMissionCompleted: './assets/audio/voice/mission_completed.ogg',
  commsObjectiveAchieved: './assets/audio/voice/objective_achieved.ogg',
};

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this._chargeNodes = null;
    this._musicTimer = null;
    this.trackName = null;
    this.musicBuffers = new Map();
    this.sfxBuffers = new Map();
    this._musicSource = null;
    this._musicGain = null;
    this._externalLoaded = false;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = 0.55;
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -14; this.comp.ratio.value = 6;
    this.master.connect(this.comp).connect(c.destination);
    this.sfxBus = c.createGain(); this.sfxBus.gain.value = 0.9; this.sfxBus.connect(this.master);
    this.musicBus = c.createGain(); this.musicBus.gain.value = 0.62; this.musicBus.connect(this.master);
    // delay send for leads
    this.delay = c.createDelay(0.6); this.delay.delayTime.value = 0.27;
    this.delayFb = c.createGain(); this.delayFb.gain.value = 0.32;
    this.delayWet = c.createGain(); this.delayWet.gain.value = 0.2;
    this.delay.connect(this.delayFb).connect(this.delay);
    this.delay.connect(this.delayWet).connect(this.musicBus);
    // noise buffer
    const len = c.sampleRate * 1;
    this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this._loadExternalAudio();
  }

  resume() { this.ctx?.state === 'suspended' && this.ctx.resume(); }
  toggleMute() {
    this.enabled = !this.enabled;
    if (this.master) this.master.gain.value = this.enabled ? 0.55 : 0;
    return this.enabled;
  }

  /* ---------------- SFX primitives ---------------- */
  _env(gainNode, t, a, peak, d, end = 0.0001) {
    const g = gainNode.gain;
    g.setValueAtTime(0.0001, t);
    g.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
    g.exponentialRampToValueAtTime(end, t + a + d);
  }

  _osc(type, freq, t, dur, peak, opts = {}) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (opts.slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(opts.slideTo, 1), t + (opts.slideT ?? dur));
    const g = c.createGain();
    this._env(g, t, opts.a ?? 0.004, peak, dur);
    let node = o;
    if (opts.lp) {
      const flt = c.createBiquadFilter();
      flt.type = 'lowpass'; flt.frequency.value = opts.lp;
      o.connect(flt); node = flt;
    }
    node.connect(g);
    g.connect(opts.bus ?? this.sfxBus);
    if (opts.delaySend) { const s = c.createGain(); s.gain.value = opts.delaySend; g.connect(s).connect(this.delay); }
    o.start(t); o.stop(t + dur + 0.1);
    return o;
  }

  _noise(t, dur, peak, filterType = 'lowpass', freq = 3000, q = 1) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    const flt = c.createBiquadFilter();
    flt.type = filterType; flt.frequency.value = freq; flt.Q.value = q;
    const g = c.createGain();
    this._env(g, t, 0.004, peak, dur);
    src.connect(flt).connect(g).connect(this.sfxBus);
    src.start(t); src.stop(t + dur + 0.1);
  }

  /* ---------------- external audio assets ---------------- */
  async _fetchBuffer(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`audio request failed: ${response.status}`);
      return await this.ctx.decodeAudioData(await response.arrayBuffer());
    } catch (err) {
      console.warn(`[audio] optional asset unavailable: ${url}`, err);
      return null;
    }
  }

  async _loadExternalAudio() {
    const musicJobs = Object.entries(MUSIC_FILES).map(async ([name, url]) => {
      const buffer = await this._fetchBuffer(url);
      if (buffer) this.musicBuffers.set(name, buffer);
    });
    const sfxJobs = Object.entries(SFX_FILES).map(async ([name, url]) => {
      const buffer = await this._fetchBuffer(url);
      if (buffer) this.sfxBuffers.set(name, buffer);
    });
    await Promise.all([...musicJobs, ...sfxJobs]);
    this._externalLoaded = true;
    if (this.trackName && this.musicBuffers.has(this.trackName)) this.playTrack(this.trackName, true);
  }

  _playSample(name, gain = 0.12, rate = 1) {
    if (!this.ctx || !this.enabled) return;
    const buffer = this.sfxBuffers.get(name);
    if (!buffer) return;
    const source = this.ctx.createBufferSource();
    const level = this.ctx.createGain();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    level.gain.value = gain;
    source.connect(level).connect(this.sfxBus);
    source.start();
  }

  /**
   * Short CC0 command-radio samples are intentionally throttled.  The onscreen
   * dialogue remains the authoritative narrative; voice only reinforces a
   * major, readable combat event and never queues over itself.
   */
  comms(name, gain = 0.28) {
    if (!this.ctx || !this.enabled) return;
    const now = this.ctx.currentTime;
    if (now - (this._lastComms ?? -99) < 1.25) return;
    this._lastComms = now;
    const key = {
      watchMyBack: 'commsWatchMyBack', coverMe: 'commsCoverMe',
      targetEngaged: 'commsTargetEngaged', targetDestroyed: 'commsTargetDestroyed',
      missionCompleted: 'commsMissionCompleted', objectiveAchieved: 'commsObjectiveAchieved',
    }[name];
    if (key) this._playSample(key, gain, 0.98 + Math.random() * 0.04);
  }

  _startExternalMusic(name) {
    const buffer = this.musicBuffers.get(name);
    if (!buffer || !this.ctx) return false;
    this._stopExternalMusic();
    const t = this.ctx.currentTime;
    const source = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    source.buffer = buffer;
    source.loop = true;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.92, t + 0.35);
    source.connect(gain).connect(this.musicBus);
    source.start(t);
    this._musicSource = source;
    this._musicGain = gain;
    return true;
  }

  _stopExternalMusic() {
    if (!this._musicSource || !this.ctx) return;
    const t = this.ctx.currentTime;
    const source = this._musicSource;
    const gain = this._musicGain;
    if (gain) {
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    }
    try { source.stop(t + 0.24); } catch (_) { /* source already stopped */ }
    this._musicSource = null;
    this._musicGain = null;
  }

  /* ---------------- game SFX ---------------- */
  laser(level = 1) {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    this._playSample(level >= 3 ? 'chargedLaser' : 'laser', level >= 3 ? 0.12 : 0.075, level >= 3 ? 0.95 : 1.06);
    const f = level >= 3 ? 1400 : 1150;
    this._osc('square', f, t, 0.09, 0.16, { slideTo: f * 0.42, slideT: 0.09 });
    this._osc('sawtooth', f * 0.5, t, 0.07, 0.09, { slideTo: f * 0.25 });
  }
  enemyShot() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    this._osc('square', 620, t, 0.12, 0.05, { slideTo: 240 });
  }
  /** per-weapon muzzle report; throttled so a spread volley = one sound */
  enemyFire(type = 'orb') {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    if (t - (this._lastEfire ?? 0) < 0.05) return;
    this._lastEfire = t;
    switch (type) {
      case 'heavy': case 'flak':
        this._osc('square', 300, t, 0.2, 0.085, { slideTo: 88, lp: 1100 });
        this._noise(t, 0.12, 0.07, 'lowpass', 760); break;
      case 'bolt': case 'shard':
        this._osc('sawtooth', 1320, t, 0.06, 0.05, { slideTo: 520 }); break;
      case 'missile': case 'homing':
        this._noise(t, 0.32, 0.055, 'highpass', 1700);
        this._osc('sine', 480, t, 0.3, 0.045, { slideTo: 1180, slideT: 0.3 }); break;
      case 'plasma': case 'wave':
        this._osc('triangle', 700, t, 0.15, 0.06, { slideTo: 300 });
        this._osc('sine', 340, t, 0.15, 0.04, { slideTo: 150 }); break;
      case 'venom':
        this._osc('sawtooth', 900, t, 0.11, 0.05, { slideTo: 1500, slideT: 0.11 }); break;
      default:
        this._osc('square', 620, t, 0.1, 0.045, { slideTo: 240 });
    }
  }
  /** Aegis Siege Carrier charge-up: a low reactor swell that telegraphs the broadside. */
  siegeCharge() {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    if (t - (this._lastSiegeCharge ?? -99) < 1.1) return;
    this._lastSiegeCharge = t;
    this._osc('sine', 68, t, 0.56, 0.19, { slideTo: 132, slideT: 0.52, lp: 540 });
    this._osc('sawtooth', 176, t + 0.06, 0.42, 0.075, { slideTo: 92, lp: 900, delaySend: 0.12 });
    this._noise(t + 0.10, 0.42, 0.055, 'lowpass', 720);
  }
  /** Aegis broadside: a compressed sample layer plus a large low-end cannon body. */
  siegeBroadside() {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    if (t - (this._lastSiegeBroadside ?? -99) < 0.42) return;
    this._lastSiegeBroadside = t;
    this._playSample('explosionBig', 0.22, 0.78);
    this._noise(t, 0.38, 0.24, 'lowpass', 620);
    this._osc('sine', 92, t, 0.52, 0.28, { slideTo: 30, lp: 420 });
    this._osc('square', 240, t, 0.16, 0.08, { slideTo: 72, lp: 1000 });
  }
  /** Carrier launch-bay roar, intentionally limited so a short escort wave stays readable. */
  escortLaunch() {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    if (t - (this._lastEscortLaunch ?? -99) < 0.5) return;
    this._lastEscortLaunch = t;
    this._osc('sawtooth', 190, t, 0.22, 0.09, { slideTo: 880, slideT: 0.2, lp: 1700 });
    this._noise(t, 0.18, 0.06, 'highpass', 1300);
  }
  /** Paired flyby cue for a Pincer attack. */
  pincerPass() {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    if (t - (this._lastPincerPass ?? -99) < 0.75) return;
    this._lastPincerPass = t;
    this._noise(t, 0.34, 0.10, 'bandpass', 1700, 1.5);
    this._osc('sine', 260, t, 0.32, 0.085, { slideTo: 740, slideT: 0.28, delaySend: 0.10 });
  }
  /** armour clank when the player's fire lands on a boss; weak-point hits ring brighter */
  bossHit(weak = false) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    if (t - (this._lastBossHit ?? 0) < 0.06) return;
    this._lastBossHit = t;
    this._noise(t, 0.12, weak ? 0.2 : 0.13, 'bandpass', weak ? 2600 : 1500, 2);
    this._osc('triangle', weak ? 640 : 420, t, 0.12, weak ? 0.14 : 0.1, { slideTo: 120 });
    this._osc('sine', 130, t, 0.16, 0.12, { slideTo: 60 });
  }

  /** shell/round impact detonation, tuned per weapon */
  impact(type = 'orb') {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    this._playSample('impact', type === 'heavy' || type === 'flak' ? 0.14 : 0.085, type === 'plasma' ? 1.12 : 1);
    if (t - (this._lastImpact ?? 0) < 0.035) return;
    this._lastImpact = t;
    switch (type) {
      case 'heavy': case 'flak':
        this._noise(t, 0.24, 0.22, 'lowpass', 880);
        this._osc('sine', 140, t, 0.22, 0.16, { slideTo: 44 }); break;
      case 'missile': case 'homing':
        this._noise(t, 0.28, 0.24, 'lowpass', 1050);
        this._osc('sine', 180, t, 0.24, 0.18, { slideTo: 48 }); break;
      case 'plasma': case 'wave': case 'venom':
        this._noise(t, 0.16, 0.16, 'bandpass', 1600, 1.4);
        this._osc('triangle', 420, t, 0.16, 0.1, { slideTo: 120 }); break;
      default:
        this._noise(t, 0.1, 0.14, 'bandpass', 2000, 1.5);
        this._osc('triangle', 680, t, 0.08, 0.08, { slideTo: 300 });
    }
  }
  /** Distinct armour strike for player or wingmate lasers landing on a regular enemy. */
  enemyHit(level = 1) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    // Laser fire can land rapidly; retain a crisp confirmation without turning it into a buzz.
    if (t - (this._lastEnemyHit ?? -99) < 0.065) return;
    this._lastEnemyHit = t;
    const gain = 0.055 + Math.min(3, level) * 0.018;
    this._playSample('impact', gain, 1.28 + Math.min(3, level) * 0.035);
    this._noise(t, 0.075, 0.12 + gain * 0.65, 'bandpass', 3100, 2.4);
    this._osc('square', 1160 + Math.min(3, level) * 90, t, 0.07, 0.075 + gain * 0.4, { slideTo: 520 });
    this._osc('sine', 210, t, 0.09, 0.055, { slideTo: 92 });
  }
  hitTick() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    this._noise(t, 0.05, 0.12, 'bandpass', 2400, 2);
    this._osc('triangle', 880, t, 0.05, 0.08, { slideTo: 440 });
  }
  explosion(big = false) {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    this._playSample(big ? 'explosionBig' : 'explosion', big ? 0.5 : 0.25, big ? 0.86 : 1.02);
    this._noise(t, big ? 0.95 : 0.45, big ? 0.55 : 0.3, 'lowpass', big ? 900 : 1400);
    this._osc('sine', big ? 110 : 150, t, big ? 0.7 : 0.4, big ? 0.52 : 0.32, { slideTo: 36 });
    if (big) {
      this._osc('sine', 70, t + 0.04, 1.0, 0.42, { slideTo: 24 });   // deep sub thud
      this._noise(t + 0.07, 0.6, 0.3, 'lowpass', 520);               // rolling body
      this._noise(t + 0.2, 0.45, 0.14, 'highpass', 2600);            // debris crackle
    }
  }
  playerHit() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    this._playSample('shield', 0.16, 0.96);
    this._noise(t, 0.3, 0.4, 'bandpass', 900, 1.5);
    this._osc('sawtooth', 300, t, 0.3, 0.25, { slideTo: 70 });
  }
  roll() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    this._noise(t, 0.4, 0.16, 'bandpass', 3200, 2);
    this._osc('sine', 500, t, 0.35, 0.1, { slideTo: 1400, slideT: 0.35 });
  }
  boost(on = true) {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    this._noise(t, 0.5, 0.2, 'lowpass', 2200);
    this._osc('sawtooth', on ? 180 : 320, t, 0.4, 0.12, { slideTo: on ? 420 : 130, lp: 900 });
  }
  lockBeep() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    this._osc('square', 1560, t, 0.07, 0.14);
    this._osc('square', 2080, t + 0.08, 0.06, 0.12);
  }
  chargeStart() {
    if (!this.ctx || this._chargeNodes) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(120, t);
    o.frequency.linearRampToValueAtTime(760, t + 0.9);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.25);
    const flt = c.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 1200;
    o.connect(flt).connect(g).connect(this.sfxBus);
    o.start(t);
    this._chargeNodes = { o, g };
  }
  chargeEnd(fired) {
    if (!this.ctx || !this._chargeNodes) return;
    const t = this.ctx.currentTime;
    const { o, g } = this._chargeNodes;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    o.stop(t + 0.1);
    this._chargeNodes = null;
    if (fired) {
      this._playSample('chargedLaser', 0.16, 0.84);
      this._osc('sawtooth', 900, t, 0.3, 0.24, { slideTo: 180 });
      this._noise(t, 0.25, 0.2, 'highpass', 1200);
    }
  }
  /**
   * Physical missile ignition: the armament grade follows the current laser
   * grade, so each upgrade reads as a heavier, more authoritative launch.
   */
  missileLaunch(level = 1) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const grade = Math.max(1, Math.min(3, level | 0));
    const sample = grade === 3 ? 'missileMk3' : grade === 2 ? 'missileMk2' : 'missileMk1';
    const gain = grade === 3 ? 0.56 : grade === 2 ? 0.46 : 0.36;
    this._playSample(sample, gain, grade === 1 ? 1.03 : grade === 2 ? 0.98 : 0.93);

    // Keep a short low-end body beneath the real launch recording. This gives
    // the upgraded ordnance mass without reintroducing the old light UI chirp.
    if (grade === 1) {
      this._osc('sine', 142, t, 0.28, 0.14, { slideTo: 54, slideT: 0.25, lp: 720 });
      this._noise(t, 0.24, 0.09, 'lowpass', 1250);
    } else if (grade === 2) {
      this._osc('sine', 112, t, 0.42, 0.20, { slideTo: 40, slideT: 0.38, lp: 600 });
      this._noise(t, 0.38, 0.14, 'lowpass', 930);
    } else {
      this._osc('sine', 88, t, 0.58, 0.28, { slideTo: 32, slideT: 0.52, lp: 500 });
      this._osc('sine', 52, t + 0.05, 0.62, 0.20, { slideTo: 24, slideT: 0.56, lp: 360 });
      this._noise(t, 0.50, 0.18, 'lowpass', 760);
    }
  }
  bomb() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    this._playSample('explosionBig', 0.62, 0.72);
    this._osc('sine', 200, t, 0.5, 0.3, { slideTo: 60 });
    this._noise(t + 0.05, 1.1, 0.5, 'lowpass', 700);
    this._osc('sine', 90, t + 0.1, 0.9, 0.5, { slideTo: 30 });
  }
  ring() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    this._osc('sine', 1318, t, 0.1, 0.16);
    this._osc('sine', 1976, t + 0.07, 0.16, 0.14);
  }
  pickup() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    [880, 1108, 1318, 1760].forEach((f, i) => this._osc('square', f, t + i * 0.06, 0.09, 0.1));
  }
  blip() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    this._osc('square', 900 + Math.random() * 300, t, 0.03, 0.05);
  }
  alarm() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      this._osc('square', 740, t + i * 0.3, 0.14, 0.12, { slideTo: 620 });
    }
  }
  ui() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    this._osc('square', 700, t, 0.06, 0.1);
    this._osc('square', 1050, t + 0.07, 0.09, 0.1);
  }

  /* ---------------- music playback and procedural fallback ---------------- */
  playTrack(name, force = false) {
    if (!this.ctx || (!force && this.trackName === name)) return;
    this.stopMusic(false);
    this.trackName = name;
    // Prefer the original scene loop once decoded; retain the synthesizer as a resilient fallback.
    if (this._startExternalMusic(name)) return;
    const spec = TRACKS[name];
    if (!spec) return;
    this._seq = { spec, step: 0, nextT: this.ctx.currentTime + 0.08 };
    this._musicTimer = setInterval(() => this._schedule(), 40);
  }

  stopMusic(clearName = true) {
    if (this._musicTimer) { clearInterval(this._musicTimer); this._musicTimer = null; }
    this._stopExternalMusic();
    if (clearName) this.trackName = null;
  }

  _schedule() {
    const c = this.ctx, s = this._seq;
    if (!s) return;
    const stepDur = 60 / s.spec.bpm / 4;
    while (s.nextT < c.currentTime + 0.18) {
      this._playStep(s.spec, s.step, s.nextT, stepDur);
      const swing = s.step % 2 === 1 ? s.spec.swing * stepDur : 0;
      s.nextT += stepDur + swing;
      s.step = (s.step + 1) % 64;
    }
  }

  _playStep(spec, step, t, stepDur) {
    const bar = Math.floor(step / 16) % spec.chords.length;
    const beat = step % 16;
    const chord = spec.chords[bar];
    const root = chord[0];

    // drums
    if (spec.kick[beat]) {
      this._osc('sine', 140, t, 0.16, 0.5, { slideTo: 42, slideT: 0.12, bus: this.musicBus });
    }
    if (spec.snare[beat]) {
      const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
      const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1900;
      const g = this.ctx.createGain(); this._env(g, t, 0.003, 0.2, 0.13);
      src.connect(f).connect(g).connect(this.musicBus);
      src.start(t); src.stop(t + 0.2);
    }
    if (spec.hat[beat]) {
      const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
      const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 8200;
      const g = this.ctx.createGain(); this._env(g, t, 0.002, 0.07, 0.04);
      src.connect(f).connect(g).connect(this.musicBus);
      src.start(t); src.stop(t + 0.08);
    }

    // bass
    const bNote = spec.bass[beat];
    if (bNote !== null && bNote !== undefined) {
      this._osc('sawtooth', mtof(root - 12 + bNote), t, stepDur * 1.7, spec.bassGain, { lp: 420, bus: this.musicBus, a: 0.005 });
    }

    // pad on bar start
    if (beat === 0) {
      for (const n of chord) {
        this._osc('sawtooth', mtof(n) * 0.999, t, stepDur * 15, spec.padGain / chord.length, { lp: 750, a: 0.4, bus: this.musicBus });
        this._osc('sawtooth', mtof(n) * 1.004, t, stepDur * 15, spec.padGain / chord.length, { lp: 750, a: 0.4, bus: this.musicBus });
      }
    }

    // arp
    const arpNotes = chord.slice(1);
    let idx;
    if (spec.arp === 'up') idx = beat % arpNotes.length;
    else if (spec.arp === 'down') idx = (arpNotes.length - 1) - (beat % arpNotes.length);
    else { const cyc = beat % (arpNotes.length * 2 - 2); idx = cyc < arpNotes.length ? cyc : arpNotes.length * 2 - 2 - cyc; }
    if (beat % 2 === 0 || spec.hat[beat]) {
      this._osc('square', mtof(arpNotes[idx] + 12 * spec.arpOct), t, stepDur * 0.9, spec.arpGain,
        { lp: 2600, bus: this.musicBus, delaySend: 0.5, a: 0.004 });
    }

    // simple lead phrase every 4 bars
    if (spec.lead && step % 32 === 0) {
      const phrase = [chord[3], chord[2], chord[3], chord[1] + 12];
      phrase.forEach((n, i) => {
        this._osc('square', mtof(n + 12), t + i * stepDur * 4, stepDur * 3, 0.09,
          { lp: 3200, bus: this.musicBus, delaySend: 0.7, a: 0.01 });
      });
    }
  }
}

export const audio = new AudioEngine();
