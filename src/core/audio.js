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
    this.volume = 1.0;
    this._chargeNodes = null;
    this._musicTimer = null;
    this.trackName = null;
    this.musicBuffers = new Map();
    this.sfxBuffers = new Map();
    this._musicSource = null;
    this._musicGain = null;
    this._externalLoaded = false;
    this._engine = null;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = this.enabled ? 0.55 * this.volume : 0;
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -14; this.comp.ratio.value = 6;
    this.master.connect(this.comp).connect(c.destination);
    this.sfxBus = c.createGain(); this.sfxBus.gain.value = 0.9; this.sfxBus.connect(this.master);
    this.musicBus = c.createGain(); this.musicBus.gain.value = 0.62;
    // Transparent lowpass on music bus that dips briefly on heavy cockpit impacts (concussion feel!)
    this.musicShockFilter = c.createBiquadFilter();
    this.musicShockFilter.type = 'lowpass';
    this.musicShockFilter.frequency.value = 22000;
    this.musicShockFilter.Q.value = 0.9;
    this.musicBus.connect(this.musicShockFilter).connect(this.master);
    // Warm asymmetric waveshaper for gritty hull-impact crunch & electrical shield overload
    this.hitDrive = c.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i * 2) / 255 - 1;
      curve[i] = Math.tanh(x * 3.4);
    }
    this.hitDrive.curve = curve;
    this.hitDrive.oversample = '2x';
    this.hitDriveGain = c.createGain();
    this.hitDriveGain.gain.value = 0.62;
    this.hitDrive.connect(this.hitDriveGain).connect(this.sfxBus);
    this._engineShockUntil = 0;
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
  _syncMaster() {
    if (this.master) this.master.gain.value = this.enabled ? 0.55 * this.volume : 0;
  }
  setMuted(muted) {
    this.enabled = !muted;
    this._syncMaster();
    return this.enabled;
  }
  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, Number.isFinite(vol) ? vol : 1));
    this._syncMaster();
    return this.volume;
  }
  toggleMute() {
    return this.setMuted(this.enabled);
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

  _noise(t, dur, peak, filterType = 'lowpass', freq = 3000, q = 1, opts = {}) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    const flt = c.createBiquadFilter();
    flt.type = filterType;
    flt.frequency.setValueAtTime(freq, t);
    if (opts.freqEnd) flt.frequency.exponentialRampToValueAtTime(Math.max(opts.freqEnd, 20), t + dur);
    flt.Q.value = q;
    const g = c.createGain();
    this._env(g, t, opts.a ?? 0.004, peak, dur);
    let tail = src.connect(flt).connect(g);
    if (opts.pan && typeof c.createStereoPanner === 'function') {
      const panner = c.createStereoPanner();
      panner.pan.setValueAtTime(Math.max(-0.85, Math.min(0.85, opts.pan)), t);
      tail = tail.connect(panner);
    }
    tail.connect(opts.bus ?? this.sfxBus);
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

  _playSample(name, gain = 0.12, rate = 1, pan = 0, delay = 0) {
    if (!this.ctx || !this.enabled) return;
    const buffer = this.sfxBuffers.get(name);
    if (!buffer) return;
    const c = this.ctx;
    const t = c.currentTime + Math.max(0, delay);
    const source = c.createBufferSource();
    const level = c.createGain();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    level.gain.value = gain;
    let tail = source.connect(level);
    if (pan && typeof c.createStereoPanner === 'function') {
      const panner = c.createStereoPanner();
      panner.pan.setValueAtTime(Math.max(-0.85, Math.min(0.85, pan)), t);
      tail = tail.connect(panner);
    }
    tail.connect(this.sfxBus);
    source.start(t);
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

  /* ---------------- continuous dynamic Arwing turbine hum ---------------- */
  _ensureEngine() {
    if (!this.ctx || this._engine) return;
    const c = this.ctx, t = c.currentTime;
    const bus = c.createGain();
    bus.gain.setValueAtTime(0.0001, t);
    bus.connect(this.sfxBus);

    // Warm dual-detuned turbine drone (low-pass filtered so it never muddies BGM)
    const oscA = c.createOscillator(); oscA.type = 'sawtooth'; oscA.frequency.setValueAtTime(86, t);
    const oscB = c.createOscillator(); oscB.type = 'triangle'; oscB.frequency.setValueAtTime(129, t);
    const toneLp = c.createBiquadFilter(); toneLp.type = 'lowpass'; toneLp.frequency.setValueAtTime(240, t); toneLp.Q.value = 1.4;
    const toneGain = c.createGain(); toneGain.gain.setValueAtTime(0.55, t);
    oscA.connect(toneLp); oscB.connect(toneLp);
    toneLp.connect(toneGain).connect(bus);

    // Filtered aerodynamic jet slipstream bed
    const jetSrc = c.createBufferSource(); jetSrc.buffer = this.noiseBuf; jetSrc.loop = true;
    const jetBp = c.createBiquadFilter(); jetBp.type = 'bandpass'; jetBp.frequency.setValueAtTime(680, t); jetBp.Q.value = 1.2;
    const jetGain = c.createGain(); jetGain.gain.setValueAtTime(0.32, t);
    jetSrc.connect(jetBp).connect(jetGain).connect(bus);

    oscA.start(t); oscB.start(t); jetSrc.start(t);
    this._engine = { bus, oscA, oscB, toneLp, jetBp, jetGain };
  }

  /** Smoothly modulate the Arwing's continuous turbine & afterburner jet bed. */
  updateEngine(speedFactor = 1, bankMag = 0, rolling = false, active = true) {
    if (!this.ctx || !this.enabled) return;
    if (!active) {
      if (this._engine) {
        const t = this.ctx.currentTime;
        this._engine.bus.gain.cancelScheduledValues(t);
        this._engine.bus.gain.setTargetAtTime(0.0001, t, 0.06);
      }
      return;
    }
    this._ensureEngine();
    if (!this._engine) return;
    const c = this.ctx, t = c.currentTime, e = this._engine;
    const bk = Math.max(0, Math.min(1, (speedFactor - 1) / 0.95));
    const brake = Math.max(0, Math.min(1, (1 - speedFactor) / 0.5));
    const shocked = t < (this._engineShockUntil ?? 0);
    const shockMul = shocked ? 0.42 : 1;
    const pitchDrop = shocked ? 0.72 : 1;
    const targetGain = (0.026 + bk * 0.055 + brake * 0.016 + bankMag * 0.014 + (rolling ? 0.022 : 0)) * shockMul;
    const pitchA = (84 + bk * 62 - brake * 22 + bankMag * 14 + (rolling ? 26 : 0)) * pitchDrop;
    const pitchB = pitchA * (1.50 + bk * 0.14);
    e.bus.gain.setTargetAtTime(targetGain, t, shocked ? 0.02 : 0.07);
    e.oscA.frequency.setTargetAtTime(pitchA, t, shocked ? 0.025 : 0.06);
    e.oscB.frequency.setTargetAtTime(pitchB, t, shocked ? 0.025 : 0.06);
    e.toneLp.frequency.setTargetAtTime(shocked ? 140 : (220 + bk * 560 + (rolling ? 280 : 0)), t, 0.05);
    e.jetBp.frequency.setTargetAtTime(620 + bk * 1150 - brake * 220 + bankMag * 260, t, 0.07);
    e.jetGain.gain.setTargetAtTime((0.28 + bk * 0.45 + brake * 0.24) * shockMul, t, 0.06);
  }

  /* ---------------- game SFX ---------------- */
  laser(level = 1) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const lvl = Math.min(3, Math.max(1, level | 0));
    const jit = 0.97 + Math.random() * 0.06;
    this._playSample(lvl >= 3 ? 'chargedLaser' : 'laser', lvl >= 3 ? 0.14 : lvl === 2 ? 0.10 : 0.08, (lvl >= 3 ? 0.96 : lvl === 2 ? 1.02 : 1.10) * jit);
    if (lvl === 1) {
      this._osc('square', 1180 * jit, t, 0.085, 0.15, { slideTo: 480, slideT: 0.085 });
      this._osc('sawtooth', 590 * jit, t, 0.065, 0.08, { slideTo: 270 });
    } else if (lvl === 2) {
      // Richer dual-detuned twin-cannon punch
      this._osc('square', 1280 * jit, t, 0.095, 0.14, { slideTo: 510, slideT: 0.095 });
      this._osc('sawtooth', 1320 * jit, t, 0.09, 0.10, { slideTo: 420, lp: 2800 });
      this._osc('sine', 240, t, 0.075, 0.11, { slideTo: 95 });
    } else {
      // Hyper Blue L3: heavy plasma lance crack + metallic ring + sub-punch
      this._osc('sawtooth', 1520 * jit, t, 0.11, 0.16, { slideTo: 440, slideT: 0.11, lp: 3800 });
      this._osc('triangle', 2100 * jit, t, 0.075, 0.11, { slideTo: 920 });
      this._osc('sine', 210, t, 0.10, 0.16, { slideTo: 64 });
      this._noise(t, 0.045, 0.09, 'bandpass', 2800, 1.8);
    }
  }
  /** Lighter, crisp support-fighter laser report so wingmate volleys never drown player fire. */
  allyLaser() {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    if (t - (this._lastAllyLaser ?? -99) < 0.072) return;
    this._lastAllyLaser = t;
    const jit = 0.95 + Math.random() * 0.10;
    this._osc('triangle', 1420 * jit, t, 0.055, 0.045, { slideTo: 640 });
    this._osc('square', 920 * jit, t, 0.045, 0.028, { slideTo: 420, lp: 2200 });
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
      case 'heavy': case 'flak': case 'cluster': case 'mortar':
        this._osc('square', type === 'mortar' ? 220 : 300, t, 0.22, 0.088, { slideTo: 76, lp: 1100 });
        this._noise(t, 0.14, 0.075, 'lowpass', 760); break;
      case 'rail':
        this._osc('sawtooth', 1880, t, 0.11, 0.078, { slideTo: 320, lp: 4200 });
        this._osc('triangle', 2600, t, 0.07, 0.055, { slideTo: 980 });
        this._noise(t, 0.06, 0.06, 'highpass', 2400); break;
      case 'bolt': case 'shard':
        this._osc('sawtooth', 1320, t, 0.06, 0.05, { slideTo: 520 }); break;
      case 'missile': case 'homing': case 'swarm': case 'torpedo':
        this._noise(t, 0.30, 0.055, 'highpass', 1700);
        this._osc('sine', 480, t, 0.28, 0.048, { slideTo: 1220, slideT: 0.28 }); break;
      case 'plasma': case 'wave': case 'superwave': case 'pursuit': case 'spiral': case 'boomerang':
        this._osc('triangle', type === 'boomerang' ? 920 : type === 'spiral' ? 840 : 700, t, 0.16, 0.062, { slideTo: 260 });
        this._osc('sine', type === 'superwave' ? 220 : 360, t, 0.18, 0.048, { slideTo: 140 }); break;
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
  /** Punchy metallic armor-shatter feedback when fire hits a boss; weakpoints crack & ring dramatically! */
  bossHit(weak = false) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    if (t - (this._lastBossHit ?? 0) < 0.055) return;
    this._lastBossHit = t;
    if (weak) {
      // Crisp destructo-crunch + resonant armor-breach ping on weakpoint hits!
      this._playSample('explosion', 0.34, 1.48 + Math.random() * 0.14);
      this._playSample('impact', 0.30, 1.32 + Math.random() * 0.12);
      this._noise(t, 0.13, 0.32, 'bandpass', 2400, 1.6);
      this._noise(t, 0.10, 0.22, 'lowpass', 950, 1.0);
      this._osc('sawtooth', 980, t, 0.09, 0.20, { slideTo: 280, lp: 2800 });
      this._osc('triangle', 1680, t, 0.075, 0.15, { slideTo: 920 });
      this._osc('sine', 210, t, 0.15, 0.30, { slideTo: 54 });
    } else {
      // Heavy metallic deflection clang on armored boss plating
      this._playSample('impact', 0.22, 0.84 + Math.random() * 0.10);
      this._noise(t, 0.095, 0.18, 'bandpass', 1450, 2.2);
      this._osc('square', 390, t, 0.09, 0.12, { slideTo: 120, lp: 1400 });
      this._osc('sine', 145, t, 0.12, 0.16, { slideTo: 58 });
    }
  }

  /** shell/round impact detonation, tuned per weapon */
  impact(type = 'orb') {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    this._playSample('impact', type === 'heavy' || type === 'flak' ? 0.14 : 0.085, type === 'plasma' ? 1.12 : 1);
    if (t - (this._lastImpact ?? 0) < 0.035) return;
    this._lastImpact = t;
    switch (type) {
      case 'heavy': case 'flak': case 'cluster': case 'mortar': case 'superwave':
        this._noise(t, 0.26, 0.24, 'lowpass', 920);
        this._osc('sine', 140, t, 0.24, 0.18, { slideTo: 42 }); break;
      case 'missile': case 'homing': case 'swarm': case 'torpedo':
        this._noise(t, 0.30, 0.24, 'lowpass', 1100);
        this._osc('sine', 180, t, 0.24, 0.18, { slideTo: 46 }); break;
      case 'rail':
        this._noise(t, 0.14, 0.22, 'highpass', 2200);
        this._osc('sawtooth', 1420, t, 0.12, 0.14, { slideTo: 220, lp: 3400 }); break;
      case 'plasma': case 'wave': case 'venom': case 'pursuit': case 'spiral': case 'boomerang':
        this._noise(t, 0.16, 0.16, 'bandpass', 1650, 1.4);
        this._osc('triangle', 460, t, 0.16, 0.11, { slideTo: 120 }); break;
      default:
        this._noise(t, 0.1, 0.14, 'bandpass', 2000, 1.5);
        this._osc('triangle', 680, t, 0.08, 0.08, { slideTo: 300 });
    }
  }
  /** Unmistakable, visceral hull-breaching crunch when player or wingmate lasers connect on an enemy! */
  enemyHit(level = 1, critical = false) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    // Snappy 52ms throttle lets rapid laser volleys chew through armor with crisp percussive clarity.
    if (t - (this._lastEnemyHit ?? -99) < 0.052) return;
    this._lastEnemyHit = t;
    const lvl = Math.min(3, Math.max(1, level | 0));
    const jit = 0.94 + Math.random() * 0.12;
    // Layered metallic crunch + miniature blast pop so hits unmistakably read as damaging armor!
    this._playSample('explosion', (0.20 + lvl * 0.035) * (critical ? 1.25 : 1), (1.62 + lvl * 0.06) * jit);
    this._playSample('impact', (0.22 + lvl * 0.035) * (critical ? 1.2 : 1), (1.16 + lvl * 0.05) * jit);
    // Crisp high-mid armor crack + low-mid punch body
    this._noise(t, 0.095, 0.24 + lvl * 0.03, 'bandpass', critical ? 2750 : 2150, 1.5);
    this._noise(t, 0.085, 0.18 + lvl * 0.025, 'lowpass', 920, 0.9);
    // Sub-punch hull thump + bright tactical confirmation snap (rises sharply when hull is critical!)
    this._osc('sine', 260 + lvl * 18, t, 0.11, 0.24 + lvl * 0.025, { slideTo: 64 });
    this._osc('sawtooth', (critical ? 1240 : 880) + lvl * 70, t, 0.072, 0.15 + lvl * 0.018, { slideTo: 310, lp: 3200 });
    this._osc('triangle', (critical ? 1920 : 1460) + lvl * 95, t, 0.055, critical ? 0.17 : 0.11, { slideTo: critical ? 1280 : 860 });
  }
  hitTick() {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    if (t - (this._lastHitTick ?? -99) < 0.045) return;
    this._lastHitTick = t;
    this._playSample('impact', 0.17, 1.38 + Math.random() * 0.14);
    this._noise(t, 0.065, 0.17, 'bandpass', 2500, 1.9);
    this._osc('triangle', 1040, t, 0.06, 0.13, { slideTo: 480 });
  }
  explosion(big = false) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const jit = 0.94 + Math.random() * 0.12;
    this._playSample(big ? 'explosionBig' : 'explosion', big ? 0.54 : 0.30, (big ? 0.86 : 1.04) * jit);
    // Crisp initial crack transient + rolling blast body + sub-bass chest thump
    this._noise(t, big ? 0.12 : 0.07, big ? 0.42 : 0.26, 'bandpass', 2200, 1.2);
    this._noise(t, big ? 1.0 : 0.48, big ? 0.56 : 0.32, 'lowpass', big ? 920 : 1450);
    this._osc('sine', big ? 118 : 162, t, big ? 0.72 : 0.40, big ? 0.56 : 0.36, { slideTo: 34 });
    if (big) {
      this._osc('sine', 72, t + 0.04, 1.05, 0.46, { slideTo: 22 });
      this._noise(t + 0.07, 0.65, 0.32, 'lowpass', 500);
      this._noise(t + 0.20, 0.48, 0.16, 'highpass', 2500);
    }
  }
  /**
   * Visceral, multi-layered cockpit impact sound tailored by weapon class, impact source,
   * damage severity, remaining shield ratio, and stereo wing strike pan!
   * Layers:
   *   1. Stereo metallic armor transient + real impact/explosion samples
   *   2. Centered sub-bass fuselage thump & shockwave
   *   3. Inharmonic titanium hull resonance (+ metal scrape on terrain/structure crash)
   *   4. Deflector shield overload + staggered L/R electrical spark crackles
   *   5. Brief BGM concussion filter duck + Arwing turbine stutter
   *   6. Cockpit master-caution warning chirp when shields fall below 30%
   */
  playerHit(opts = {}) {
    if (!this.ctx || !this.enabled) return;
    const c = this.ctx;
    const t = c.currentTime;
    const dmg = Number.isFinite(opts.dmg) ? opts.dmg : 12;
    const src = opts.src ?? 'bullet';
    const btype = opts.btype ?? 'orb';
    const hpRatio = Number.isFinite(opts.hpRatio) ? Math.max(0, Math.min(1, opts.hpRatio)) : 1;
    const pan = Math.max(-0.82, Math.min(0.82, Number.isFinite(opts.pan) ? opts.pan : 0));
    const jit = 0.94 + Math.random() * 0.12;

    const explosive = src === 'mine' || src === 'ram' || btype === 'heavy' || btype === 'flak'
      || btype === 'cluster' || btype === 'mortar' || btype === 'missile' || btype === 'homing'
      || btype === 'swarm' || btype === 'torpedo' || btype === 'superwave';
    const energy = btype === 'rail' || btype === 'plasma' || btype === 'wave' || btype === 'superwave'
      || btype === 'boomerang' || btype === 'spiral' || btype === 'pursuit';
    const isCrash = src === 'crash';
    const isRail = btype === 'rail';
    const sev = Math.max(0.45, Math.min(1.4, dmg / 18));
    const heavy = explosive || isCrash || isRail || sev >= 0.95;
    const critical = hpRatio > 0 && hpRatio <= 0.30;
    const driveBus = this.hitDrive ?? this.sfxBus;

    // Helper for panned oscillators (keeps sub-bass centered while panning hull/sparks!)
    const hitOsc = (type, f0, f1, startT, dur, peak, lp = 0, oscPan = 0, useDrive = false) => {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f0, startT);
      if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(f1, 16), startT + dur);
      const g = c.createGain();
      this._env(g, startT, 0.003, peak, dur);
      let node = o;
      if (lp > 0) {
        const flt = c.createBiquadFilter();
        flt.type = 'lowpass'; flt.frequency.setValueAtTime(lp, startT);
        node = node.connect(flt);
      }
      node = node.connect(g);
      if (oscPan && typeof c.createStereoPanner === 'function') {
        const p = c.createStereoPanner();
        p.pan.setValueAtTime(Math.max(-0.85, Math.min(0.85, oscPan)), startT);
        node = node.connect(p);
      }
      node.connect(useDrive ? driveBus : this.sfxBus);
      o.start(startT); o.stop(startT + dur + 0.08);
    };

    // ---- Layer 1: Stereo metallic hull-strike transient + real layered samples ----
    this._playSample('impact', (heavy ? 0.44 : 0.32) * Math.min(1.25, sev), (heavy ? 0.76 : 0.94) * jit, pan);
    this._playSample('shield', (energy ? 0.34 : 0.24) * Math.min(1.25, sev), (heavy ? 0.84 : 1.02) * jit, pan * 0.6);
    if (explosive || heavy) {
      this._playSample('explosion', (explosive ? 0.40 : 0.24) * Math.min(1.2, sev), (explosive ? 0.92 : 1.15) * jit, pan * 0.5, 0.008);
    }
    if (explosive || src === 'mine' || btype === 'superwave') {
      this._playSample('explosionBig', 0.34 * Math.min(1.25, sev), 0.92 * jit, 0, 0.012);
    }
    // Overdriven armor-crack impulse (0-24ms)
    this._noise(t, 0.026, 0.46 * sev, 'bandpass', heavy ? 1950 : 2650, 1.3, { freqEnd: 780, pan, bus: driveBus, a: 0.0015 });

    // ---- Layer 2: Centered sub-bass cockpit thump & pressure jolt ----
    hitOsc('sine', heavy ? 132 : 156, heavy ? 28 : 40, t, heavy ? 0.34 : 0.22, 0.48 * Math.min(1.2, sev));
    if (heavy) {
      hitOsc('sine', 76, 22, t + 0.012, 0.44, 0.38 * Math.min(1.2, sev));
      this._noise(t + 0.01, 0.38, 0.32 * Math.min(1.2, sev), 'lowpass', 620, 0.9, { freqEnd: 160 });
    }

    // ---- Layer 3: Inharmonic titanium airframe resonance (real metal fuselage ring!) ----
    const hullModes = heavy ? [242, 418, 695] : [312, 538, 882];
    hullModes.forEach((f, idx) => {
      const mPan = idx === 1 ? -pan * 0.35 : pan * 0.75;
      hitOsc(
        idx === 0 ? 'sawtooth' : 'triangle',
        f * jit,
        f * (heavy ? 0.54 : 0.68) * jit,
        t + idx * 0.006,
        (heavy ? 0.30 : 0.19) - idx * 0.03,
        (0.15 - idx * 0.035) * Math.min(1.2, sev),
        1950,
        mPan,
        idx === 0
      );
    });

    // Source-specific physical flavor:
    if (isCrash) {
      // Raw metal-shearing cliff/structure hull scrape + secondary frame shudder!
      this._noise(t, 0.42, 0.42, 'bandpass', opts.isStructure ? 2850 : 2100, 4.2, { freqEnd: 520, pan, bus: driveBus });
      hitOsc('sawtooth', 198 * jit, 74, t + 0.02, 0.36, 0.24, 1100, pan * 0.7, true);
      hitOsc('sine', 112, 34, t + 0.085, 0.22, 0.26);
    } else if (isRail) {
      // Supersonic electromagnetic rail-lance whip crack + high-voltage hull ring!
      hitOsc('sawtooth', 2480 * jit, 240, t, 0.18, 0.24, 4800, pan, true);
      this._noise(t, 0.14, 0.34, 'highpass', 3200, 1.4, { freqEnd: 1200, pan });
    } else if (energy) {
      // Plasma / wave shield destabilization downward zap
      hitOsc('sawtooth', 1180 * jit, 155, t, 0.24, 0.19, 2600, pan * 0.7, true);
      hitOsc('triangle', 1760 * jit, 420, t + 0.015, 0.18, 0.12, 0, -pan * 0.4);
    } else if (explosive) {
      // Metallic canopy shrapnel pings rattling off the cockpit glass!
      for (let i = 0; i < 3; i++) {
        const pt = t + 0.045 + i * 0.038 + Math.random() * 0.015;
        const pSide = (i % 2 ? 0.65 : -0.65);
        hitOsc('triangle', (2100 + i * 480) * jit, 1280 + i * 220, pt, 0.055, 0.085, 0, pSide);
      }
    }

    // ---- Layer 4: Deflector shield overload + staggered L/R electrical spark crackles ----
    this._noise(t + 0.015, heavy ? 0.28 : 0.18, 0.24 * Math.min(1.2, sev), 'bandpass', 1650, 2.0, { freqEnd: 560, pan: pan * 0.5 });
    const sparkCount = critical ? 5 : heavy ? 4 : 3;
    for (let i = 0; i < sparkCount; i++) {
      const st = t + 0.032 + i * 0.048 + Math.random() * 0.018;
      const sPan = (i % 2 === 0 ? 1 : -1) * (0.42 + Math.random() * 0.32);
      this._noise(st, 0.020 + Math.random() * 0.014, (0.14 + (critical ? 0.06 : 0)) * (1 - i * 0.12), 'highpass', 3600 + i * 420, 1.6, { pan: sPan, a: 0.001 });
      if (i < 2 || critical) {
        hitOsc('square', (2600 + i * 520) * jit, 980, st, 0.022, 0.048, 4200, sPan);
      }
    }

    // ---- Layer 5: Dynamic BGM concussion duck + Arwing turbine brief shock stutter ----
    if (this.musicBus && this.musicShockFilter) {
      const duckGain = critical ? 0.22 : heavy ? 0.28 : 0.40;
      const duckCutoff = critical ? 680 : heavy ? 980 : 1850;
      const recov = critical ? 0.44 : heavy ? 0.32 : 0.22;
      const mg = this.musicBus.gain;
      mg.cancelScheduledValues(t);
      mg.setValueAtTime(Math.max(mg.value, 0.05), t);
      mg.linearRampToValueAtTime(duckGain, t + 0.018);
      mg.exponentialRampToValueAtTime(0.62, t + recov);
      const mf = this.musicShockFilter.frequency;
      mf.cancelScheduledValues(t);
      mf.setValueAtTime(Math.max(mf.value, 200), t);
      mf.exponentialRampToValueAtTime(duckCutoff, t + 0.020);
      mf.exponentialRampToValueAtTime(22000, t + recov);
    }
    this._engineShockUntil = Math.max(this._engineShockUntil ?? 0, t + (heavy ? 0.28 : 0.17));

    // ---- Layer 6: Cockpit Master-Caution alert when shield drops into critical (<= 30%) ----
    if (critical && t - (this._lastCritWarn ?? -99) > 0.72) {
      this._lastCritWarn = t;
      for (let k = 0; k < 2; k++) {
        const wt = t + 0.11 + k * 0.135;
        hitOsc('square', 1040, 820, wt, 0.085, 0.125, 2900, 0);
        hitOsc('triangle', 1560, 1230, wt, 0.075, 0.085, 0, 0);
      }
    }
  }

  /** Metallic deflector-shield glancing scrape when barrel-rolling past cliffs or structures */
  shieldScrape(pan = 0) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const p = Math.max(-0.82, Math.min(0.82, pan));
    this._playSample('shield', 0.24, 1.18, p);
    this._playSample('impact', 0.22, 1.12, p);
    this._noise(t, 0.22, 0.26, 'bandpass', 2900, 3.6, { freqEnd: 1100, pan: p, bus: this.hitDrive ?? this.sfxBus });
    this._osc('triangle', 1480, t, 0.14, 0.13, { slideTo: 620 });
    this._osc('sine', 190, t, 0.12, 0.16, { slideTo: 72 });
  }
  roll() {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    // Iconic Star Fox barrel-roll twin turbine sweep + crisp mechanical wing-snap + deflector hum!
    this._playSample('shield', 0.09, 1.55);
    this._noise(t, 0.44, 0.19, 'bandpass', 3000, 1.8);
    this._osc('sine', 440, t, 0.36, 0.12, { slideTo: 1520, slideT: 0.34 });
    this._osc('triangle', 880, t + 0.04, 0.28, 0.08, { slideTo: 1760, slideT: 0.24 });
    this._osc('square', 280, t, 0.045, 0.07, { slideTo: 140, lp: 1200 });
  }
  deflect() {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    if (t - (this._lastDeflect ?? -99) < 0.045) return;
    this._lastDeflect = t;
    // Crystalline Star Fox counter-deflection "KSHING-ZING!" with harmonic shimmer
    this._playSample('shield', 0.15, 1.48);
    this._noise(t, 0.07, 0.14, 'highpass', 3400);
    this._osc('triangle', 1320, t, 0.10, 0.16, { slideTo: 2480, slideT: 0.09, delaySend: 0.18 });
    this._osc('sine', 1980, t + 0.02, 0.14, 0.12, { slideTo: 1120 });
    this._osc('sine', 2640, t + 0.03, 0.12, 0.08, { slideTo: 3120 });
  }
  boost(on = true) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    if (on) {
      // Mach sonic-boom thump + surging afterburner ignition roar!
      this._osc('sine', 165, t, 0.32, 0.30, { slideTo: 48 });
      this._noise(t, 0.56, 0.26, 'bandpass', 1800, 0.9);
      this._osc('sawtooth', 160, t, 0.46, 0.14, { slideTo: 520, slideT: 0.42, lp: 1400 });
      this._osc('triangle', 340, t + 0.03, 0.34, 0.08, { slideTo: 920, slideT: 0.30 });
    } else {
      // Pneumatic air-brake hiss + downward turbine deceleration sweep
      this._noise(t, 0.42, 0.20, 'highpass', 1900);
      this._osc('sawtooth', 360, t, 0.38, 0.12, { slideTo: 110, lp: 900 });
    }
  }
  lockBeep(step = 0) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const mul = 1 + Math.min(3, Math.max(0, step)) * 0.15;
    this._osc('square', 1560 * mul, t, 0.06, 0.12, { lp: 4200 });
    this._osc('triangle', 2120 * mul, t + 0.06, 0.075, 0.13, { delaySend: 0.15 });
  }
  chargeStart() {
    if (!this.ctx || this._chargeNodes) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(125, t);
    o.frequency.linearRampToValueAtTime(780, t + 0.72);
    const o2 = c.createOscillator(); o2.type = 'triangle';
    o2.frequency.setValueAtTime(250, t);
    o2.frequency.linearRampToValueAtTime(1560, t + 0.72);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.095, t + 0.22);
    const flt = c.createBiquadFilter(); flt.type = 'lowpass';
    flt.frequency.setValueAtTime(900, t);
    flt.frequency.linearRampToValueAtTime(2800, t + 0.72);
    o.connect(flt); o2.connect(flt);
    flt.connect(g).connect(this.sfxBus);
    o.start(t); o2.start(t);
    this._chargeNodes = { o, o2, g };
  }
  chargeFull() {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    this._osc('sine', 1760, t, 0.10, 0.12, { delaySend: 0.22 });
    this._osc('triangle', 2637, t + 0.055, 0.14, 0.10, { delaySend: 0.25 });
  }
  chargeEnd(fired) {
    if (!this.ctx || !this._chargeNodes) return;
    const t = this.ctx.currentTime;
    const { o, o2, g } = this._chargeNodes;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    o.stop(t + 0.1);
    if (o2) o2.stop(t + 0.1);
    this._chargeNodes = null;
    if (fired) {
      this._playSample('chargedLaser', 0.22, 0.82);
      this._osc('sawtooth', 960, t, 0.32, 0.24, { slideTo: 165, lp: 2800 });
      this._osc('sine', 240, t, 0.26, 0.26, { slideTo: 52 });
      this._noise(t, 0.26, 0.22, 'highpass', 1200);
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
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    // Brief vacuum-implosion inhale right into seismic Smart Bomb Nova shockwave!
    this._osc('sine', 420, t, 0.075, 0.14, { slideTo: 95 });
    this._playSample('explosionBig', 0.68, 0.70);
    this._osc('sine', 210, t + 0.05, 0.56, 0.36, { slideTo: 54 });
    this._noise(t + 0.06, 1.25, 0.56, 'lowpass', 740);
    this._osc('sine', 86, t + 0.09, 1.05, 0.55, { slideTo: 24 });
    this._osc('triangle', 1480, t + 0.08, 0.38, 0.10, { slideTo: 420, delaySend: 0.28 });
  }
  ring() {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    this._osc('sine', 1318, t, 0.11, 0.16, { delaySend: 0.22 });
    this._osc('triangle', 1976, t + 0.065, 0.18, 0.14, { delaySend: 0.26 });
    this._osc('sine', 2637, t + 0.13, 0.20, 0.09, { delaySend: 0.24 });
  }
  pickup() {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    [880, 1108, 1318, 1760].forEach((f, i) => {
      this._osc('triangle', f, t + i * 0.055, 0.12, 0.13, { delaySend: 0.20 });
      this._osc('sine', f * 2, t + i * 0.055, 0.08, 0.05);
    });
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
