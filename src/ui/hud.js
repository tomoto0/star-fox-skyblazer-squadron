import { audio } from '../core/audio.js';
import { clamp } from '../core/util.js';

const $ = (id) => document.getElementById(id);

function svgPortrait(bg, fg, glyph) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <rect width="100" height="100" fill="${bg}"/>
    <circle cx="50" cy="50" r="30" fill="none" stroke="${fg}" stroke-width="5" opacity=".8"/>
    <text x="50" y="64" font-size="42" font-family="sans-serif" font-weight="bold" fill="${fg}" text-anchor="middle">${glyph}</text>
  </svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

const PORTRAITS = {
  BOWIE: './assets/ui/portrait_bowie.png',
  THORNE: './assets/ui/portrait_thorne.png',
  REX: svgPortrait('#2c2464', '#f7b733', '★'),
  JUNO: svgPortrait('#1d4a66', '#7fe9ff', '✦'),
  VEGA: './assets/ui/portrait_vega.png',   // falcon ace
  NOVA: './assets/ui/portrait_nova.png',   // tree frog
  KIT: './assets/ui/portrait_kit.png',     // red fox
};

export class Hud {
  constructor() {
    this.el = {
      hud: $('hud'),
      hpFill: $('bar-hp-fill'), hpLag: $('bar-hp-lag'), hpVal: $('bar-hp-val'), hpBar: $('bar-hp'),
      boostFill: $('bar-boost-fill'),
      laserPips: $('laser-pips'), bombGems: $('bomb-gems'), upgradeBadges: $('upgrade-badges'),
      score: $('score'), lives: $('lives-num'),
      waveStatus: $('wave-status'), waveTag: $('wave-tag'), waveZone: $('wave-zone'),
      waveHostiles: $('wave-hostiles'), waveProgFill: $('wave-progress-fill'),
      btnAuto: $('btn-hud-autofire'), btnMute: $('btn-hud-mute'), btnPause: $('btn-hud-pause'),
      bossBar: $('boss-bar'), bossName: $('boss-name'), bossFill: $('boss-fill'),
      waveBanner: $('wave-banner'), waveTop: $('wave-banner-top'), waveSub: $('wave-banner-sub'),
      alert: $('alert-banner'),
      bossFillLag: $('boss-fill-lag'), bossTicks: $('boss-ticks'), bossPhase: $('boss-phase'), bossSkull: $('boss-skull'),
      callout: $('callout'), calloutIcon: $('callout-icon'), calloutText: $('callout-text'),
      bombPrompt: $('bomb-prompt'),
      combo: $('combo'), comboX: $('combo-x'), comboBarFill: $('combo-bar-fill'),
      wingStatus: $('wing-status'),
      rivalMark: $('rival-marker'), rivalMarkSvg: $('rival-marker')?.querySelector('svg'),
      threatLayer: $('threat-indicators'),
      dlg: $('dialogue'), dlgImg: $('dlg-img'), dlgName: $('dlg-name'), dlgText: $('dlg-text'),
      retNear: $('reticle-near'), retFar: $('reticle-far'), lockLayer: $('lock-markers'),
      killPopups: $('kill-popups'),
      chargeRing: $('charge-ring'), chargeArc: $('charge-arc'),
      hurt: $('hurt-flash'), white: $('white-flash'), vignette: $('vignette'),
      perfBadge: $('perf-badge'), contextLost: $('context-lost-banner'),
    };
    this._pips = []; this._gems = []; this._wingRows = {};
    // laser-power level → laser-bolt icons; bomb count → bomb icons
    const LASER_SVG = '<svg viewBox="0 0 22 12"><rect x="1.5" y="4" width="12.5" height="4" rx="2" fill="#ffe066"/><path d="M13 2 L21 6 L13 10 Z" fill="#ffab1f"/></svg>';
    const BOMB_SVG = '<svg viewBox="0 0 16 16"><circle cx="7.4" cy="10.1" r="4.7" fill="#23252f"/><ellipse cx="5.7" cy="8.4" rx="1.4" ry="1" fill="rgba(255,255,255,.4)"/><path d="M10 6 q2.3-1.8 1.7-4.3" stroke="#9a7a44" stroke-width="1.3" fill="none" stroke-linecap="round"/><circle cx="11.9" cy="1.7" r="1.8" fill="#ffb020"/><circle cx="11.9" cy="1.7" r=".8" fill="#fff2b0"/></svg>';
    for (let i = 0; i < 4; i++) {
      const p = document.createElement('div');
      p.className = i === 3 ? 'pip lv4' : 'pip';
      p.innerHTML = LASER_SVG;
      if (i === 3) p.style.display = 'none';
      this.el.laserPips.appendChild(p); this._pips.push(p);
    }
    for (let i = 0; i < 7; i++) {
      const g = document.createElement('div'); g.className = 'gem'; g.innerHTML = BOMB_SVG;
      if (i >= 5) g.style.display = 'none';
      this.el.bombGems.appendChild(g); this._gems.push(g);
    }
    this._lockPool = [];
    for (let i = 0; i < 8; i++) {
      const m = document.createElement('div'); m.className = 'lock-marker';
      m.style.display = 'none';
      this.el.lockLayer.appendChild(m);
      this._lockPool.push(m);
    }
    // Pool of 4 directional off-screen threat chevrons
    this._threatPool = [];
    if (this.el.threatLayer) {
      for (let i = 0; i < 4; i++) {
        const el = document.createElement('div');
        el.className = 'threat-arrow';
        el.innerHTML = '<svg viewBox="0 0 32 32"><path d="M16 3 L28 25 L16 19 L4 25 Z"/></svg>';
        el.style.display = 'none';
        this.el.threatLayer.appendChild(el);
        this._threatPool.push({ el, svg: el.querySelector('svg') });
      }
    }

    this._dlgQueue = [];
    this._dlgActive = null;
    this._dlgChar = 0; this._dlgTimer = 0;
    this._bannerT = 0; this._alertT = 0; this._score = -1;
    this._lastHpText = '';
    this._lastWaveKey = '';
    this._lastUpgKey = '';
  }

  show() { this.el.hud.classList.remove('hidden'); }
  hide() { this.el.hud.classList.add('hidden'); }

  setBars(hp, boost, maxHp = 100) {
    const cap = Math.max(1, maxHp);
    const k = clamp(hp / cap, 0, 1);
    this.el.hpFill.style.transform = `scaleX(${k})`;
    if (this.el.hpLag) this.el.hpLag.style.transform = `scaleX(${k})`;
    this.el.hpFill.classList.toggle('low', k < 0.30);
    this.el.hpBar?.classList.toggle('overcap', cap > 100);
    if (this.el.hpVal) {
      const cur = Math.max(0, Math.ceil(hp));
      const txt = cap > 100 ? `${cur}/${cap}` : String(cur);
      if (txt !== this._lastHpText) {
        this._lastHpText = txt;
        this.el.hpVal.textContent = txt;
      }
    }
    this.el.boostFill.style.transform = `scaleX(${clamp(boost / 100, 0, 1)})`;
    this.el.hud.classList.toggle('is-low-hp', hp > 0 && k < 0.30);
  }

  setFlightState(speedFactor) {
    this.el.hud.classList.toggle('is-boosting', speedFactor > 1.32);
    this.el.hud.classList.toggle('is-braking', speedFactor < 0.78);
  }

  setWaveProgress(wave, totalWaves, zoneName, progress01, hostiles, modeLabel = '') {
    const el = this.el.waveStatus;
    if (!el) return;
    const bossVisible = !this.el.bossBar.classList.contains('hidden');
    el.classList.toggle('hidden', bossVisible);
    if (bossVisible) return;
    const tag = `W${String(wave).padStart(2, '0')} / ${String(totalWaves).padStart(2, '0')}`;
    const zone = modeLabel || zoneName || '';
    const hos = modeLabel ? 'ENGAGE' : `HOSTILES ${String(hostiles).padStart(2, '0')}`;
    const key = `${tag}|${zone}|${hos}`;
    if (key !== this._lastWaveKey) {
      this._lastWaveKey = key;
      if (this.el.waveTag) this.el.waveTag.textContent = tag;
      if (this.el.waveZone) this.el.waveZone.textContent = zone;
      if (this.el.waveHostiles) this.el.waveHostiles.textContent = hos;
    }
    if (this.el.waveProgFill) {
      this.el.waveProgFill.style.transform = `scaleX(${clamp(progress01, 0, 1)})`;
    }
  }

  setQuickTools({ autoFire, muted }) {
    if (this.el.btnAuto) {
      this.el.btnAuto.classList.toggle('is-on', !!autoFire);
      this.el.btnAuto.setAttribute('aria-pressed', autoFire ? 'true' : 'false');
    }
    if (this.el.btnMute) {
      this.el.btnMute.classList.toggle('is-muted', !!muted);
      this.el.btnMute.textContent = muted ? 'MUTE' : 'SFX';
      this.el.btnMute.setAttribute('aria-pressed', muted ? 'true' : 'false');
    }
  }

  setBombPrompt(visible) {
    if (!this.el.bombPrompt) return;
    this.el.bombPrompt.classList.toggle('hidden', !visible);
  }

  setPerf(fps, tierName, isAuto, visible) {
    const el = this.el.perfBadge;
    if (!el) return;
    el.classList.toggle('hidden', !visible);
    if (!visible) return;
    const text = `${Math.round(fps)} FPS · ${isAuto ? `AUTO:${tierName}` : tierName}`;
    if (text !== this._lastPerfText) {
      this._lastPerfText = text;
      el.textContent = text;
      el.classList.toggle('is-lite', tierName === 'FAST' || tierName === 'LITE');
    }
  }

  setContextLost(lost) {
    this.el.contextLost?.classList.toggle('hidden', !lost);
  }

  setScore(v) {
    if (v === this._score) return;
    this._score = v;
    this.el.score.textContent = String(Math.min(v, 999999)).padStart(4, '0');
  }
  setLives(v) { this.el.lives.textContent = 'x ' + v; }
  setLaserLevel(lv, maxLv = 3) {
    const cap = Math.max(3, maxLv, lv);
    this._pips.forEach((p, i) => {
      p.style.display = i < cap ? '' : 'none';
      p.classList.toggle('on', i < lv);
    });
  }
  setBombs(n, maxBombs = 5) {
    const cap = Math.max(5, maxBombs, n);
    this._gems.forEach((g, i) => {
      g.style.display = i < cap ? '' : 'none';
      g.classList.toggle('on', i < n);
    });
  }
  setUpgrades(badges = [], overdriveT = 0) {
    const el = this.el.upgradeBadges;
    if (!el) return;
    const ovSec = overdriveT > 0 ? Math.ceil(overdriveT) : 0;
    const key = `${ovSec}|` + badges.map((b) => `${b.id}:${b.label}`).join(',');
    if (key === this._lastUpgKey) return;
    this._lastUpgKey = key;
    const show = badges.length > 0 || ovSec > 0;
    el.classList.toggle('hidden', !show);
    if (!show) { el.replaceChildren(); return; }
    el.replaceChildren();
    if (ovSec > 0) {
      const ov = document.createElement('span');
      ov.className = 'upg-badge overdrive';
      ov.textContent = `✦ OVERDRIVE ${ovSec}s`;
      el.appendChild(ov);
    }
    for (const b of badges) {
      const chip = document.createElement('span');
      chip.className = 'upg-badge' + (b.trophy ? ' trophy' : '');
      chip.style.setProperty('--upg-col', b.color);
      chip.textContent = `${b.icon} ${b.label}`;
      el.appendChild(chip);
    }
  }

  /* ---- boss ---- */
  showBoss(name, phases = 1) {
    this.el.bossName.textContent = name;
    this.el.bossBar.classList.remove('hidden');
    this.el.waveStatus?.classList.add('hidden');
    // segmented ticks
    this.el.bossTicks.innerHTML = '';
    for (let i = 0; i < 10; i++) this.el.bossTicks.appendChild(document.createElement('i'));
    // phase pips
    this._bossPhases = phases;
    this.el.bossPhase.querySelectorAll('span').forEach((s, i) => {
      s.style.display = i < phases ? 'block' : 'none';
      s.classList.toggle('on', i === 0);
    });
    this.el.bossFill.style.transform = 'scaleX(1)';
    this.el.bossFillLag.style.transform = 'scaleX(1)';
  }
  setBossHp(k) {
    k = clamp(k, 0, 1);
    this.el.bossFill.style.transform = `scaleX(${k})`;
    this.el.bossFillLag.style.transform = `scaleX(${k})`;
  }
  setBossPhase(cur) {
    this.el.bossPhase.querySelectorAll('span').forEach((s, i) => s.classList.toggle('on', i < cur));
  }
  hideBoss() { this.el.bossBar.classList.add('hidden'); }

  /* ---- item callout ---- */
  callout(text, icon = '◆', color = '#ffd36b') {
    this.el.calloutText.textContent = text;
    this.el.calloutIcon.textContent = icon;
    this.el.calloutIcon.style.color = color;
    this.el.callout.classList.remove('hidden');
    // restart the animation
    this.el.callout.style.animation = 'none';
    void this.el.callout.offsetWidth;
    this.el.callout.style.animation = '';
    clearTimeout(this._calloutT);
    this._calloutT = setTimeout(() => this.el.callout.classList.add('hidden'), 1300);
  }

  /* ---- rival tracker: shows a box on the rival, or an edge arrow when off-screen ---- */
  rivalMarker(screen, hit) {
    const el = this.el.rivalMark;
    if (!el) return;
    if (!screen) {   // null = hide (out of duel or behind camera)
      el.classList.add('hidden');
      return;
    }
    el.classList.remove('hidden');
    const W = window.innerWidth, H = window.innerHeight, m = 40;
    const onscreen = screen.x >= 0 && screen.x <= W && screen.y >= 0 && screen.y <= H;
    let x = clamp(screen.x, m, W - m), y = clamp(screen.y, m, H - m);
    el.classList.toggle('onscreen', onscreen);
    if (onscreen) {
      if (this.el.rivalMarkSvg) this.el.rivalMarkSvg.style.transform = 'rotate(0deg)';
    } else if (this.el.rivalMarkSvg) {
      // point the arrow from screen centre toward the rival
      const ang = Math.atan2(screen.y - H / 2, screen.x - W / 2) * 180 / Math.PI + 90;
      this.el.rivalMarkSvg.style.transform = `rotate(${ang}deg)`;
    }
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.filter = hit ? 'brightness(2)' : 'none';
  }

  /* ---- off-screen threat edge indicators ---- */
  setThreats(list) {
    for (let i = 0; i < this._threatPool.length; i++) {
      const slot = this._threatPool[i];
      const item = list && list[i];
      if (!item) {
        slot.el.style.display = 'none';
        continue;
      }
      slot.el.style.display = 'block';
      slot.el.style.left = `${Math.round(item.x)}px`;
      slot.el.style.top = `${Math.round(item.y)}px`;
      slot.el.style.opacity = String(clamp(item.opacity ?? 0.85, 0.25, 1));
      slot.el.classList.toggle('is-missile', item.kind === 'missile');
      if (slot.svg) slot.svg.style.transform = `rotate(${Math.round(item.angleDeg)}deg)`;
    }
  }

  /* ---- combo ---- */
  setCombo(n, ratio = 1) {
    if (n >= 2) {
      this.el.comboX.textContent = 'x' + n;
      this.el.combo.classList.remove('hidden');
      this.el.combo.classList.remove('bump');
      void this.el.combo.offsetWidth;
      this.el.combo.classList.add('bump');
      this.setComboTimer(ratio);
    } else {
      this.el.combo.classList.add('hidden');
    }
  }
  setComboTimer(ratio) {
    if (this.el.comboBarFill) {
      this.el.comboBarFill.style.transform = `scaleX(${clamp(ratio, 0, 1)})`;
    }
  }

  /* ---- wingmate status panel ---- */
  setWingStatus(list) {
    const panel = this.el.wingStatus;
    if (!panel) return;
    if (!list || list.length === 0) { panel.classList.add('hidden'); return; }
    panel.classList.remove('hidden');
    for (const w of list) {
      let row = this._wingRows[w.name];
      if (!row) row = this._wingRows[w.name] = this._makeWingRow(w);
      const k = clamp(w.hp / w.maxHp, 0, 1);
      row.fill.style.transform = `scaleX(${k})`;
      row.fill.style.background = w.state === 'down' ? '#5a6472'
        : k > 0.55 ? '#7dffa8' : k > 0.28 ? '#ffd45e' : '#ff5a6a';
      row.el.classList.toggle('down', w.state === 'down');
      row.el.classList.toggle('danger', w.state === 'danger');
      row.el.classList.toggle('targeted', w.state === 'targeted');
      row.state.textContent = w.state === 'down' ? 'DOWN'
        : w.state === 'danger' ? '⚠'
          : w.state === 'targeted' ? `LOCK${w.targetedBy > 1 ? `×${w.targetedBy}` : ''}`
            : Math.round(w.hp);
    }
  }
  _makeWingRow(w) {
    const el = document.createElement('div'); el.className = 'wing-row';
    const img = document.createElement('img'); img.className = 'wing-pic';
    img.src = PORTRAITS[w.name] ?? PORTRAITS.REX;
    const info = document.createElement('div'); info.className = 'wing-info';
    const name = document.createElement('div'); name.className = 'wing-name'; name.textContent = w.name;
    const bar = document.createElement('div'); bar.className = 'wing-hpbar';
    const fill = document.createElement('div'); fill.className = 'wing-hpfill';
    bar.appendChild(fill); info.appendChild(name); info.appendChild(bar);
    const state = document.createElement('div'); state.className = 'wing-state';
    el.append(img, info, state);
    if (w.color !== undefined) el.style.setProperty('--wing-accent', '#' + w.color.toString(16).padStart(6, '0'));
    this.el.wingStatus.appendChild(el);
    return { el, fill, state };
  }

  /* ---- banners ---- */
  banner(top, sub, dur = 2.6) {
    this.el.waveTop.textContent = top;
    this.el.waveSub.textContent = sub;
    this.el.waveBanner.classList.remove('hidden');
    this._bannerT = dur;
  }
  alert(text, dur = 2.2) {
    this.el.alert.textContent = text;
    this.el.alert.classList.remove('hidden');
    this._alertT = dur;
  }

  /* ---- dialogue ---- */
  say(who, text, dur = 3.4) {
    this._dlgQueue.push({ who, text, dur });
  }
  clearDialogue() {
    this._dlgQueue.length = 0;
    this._dlgActive = null;
    this.el.dlg.classList.add('hidden');
  }

  /* ---- reticle & locks (resolution-independent centering) ---- */
  reticle(near, far, locked, snapped = false) {
    const rn = this.el.retNear, rf = this.el.retFar;
    rn.style.transform = `translate3d(${near.x}px, ${near.y}px, 0) translate(-50%, -50%)`;
    rf.style.transform = `translate3d(${far.x}px, ${far.y}px, 0) translate(-50%, -50%)`;
    rn.classList.toggle('locked', !!locked);
    rf.classList.toggle('locked', !!locked);
    rn.classList.toggle('snapped', !locked && !!snapped);
    rf.classList.toggle('snapped', !locked && !!snapped);
  }
  /** Brief tactile flash on the targeting reticles when lasers hit or destroy an enemy */
  hitConfirm(isKill = false) {
    const rn = this.el.retNear, rf = this.el.retFar;
    if (!rn || !rf) return;
    const cls = isKill ? 'kill-tick' : 'hit-tick';
    rn.classList.add(cls); rf.classList.add(cls);
    clearTimeout(isKill ? this._killTickT : this._hitTickT);
    const t = setTimeout(() => { rn.classList.remove(cls); rf.classList.remove(cls); }, isKill ? 150 : 75);
    if (isKill) this._killTickT = t; else this._hitTickT = t;
  }
  /** Floating Star Fox-style score/close-kill/counter popup right at the target's screen position */
  killPop(screen, points, tag = '', style = '') {
    const layer = this.el.killPopups;
    if (!layer || !screen) return;
    if (screen.x < 20 || screen.x > window.innerWidth - 20 || screen.y < 20 || screen.y > window.innerHeight - 20) return;
    // Cap concurrent popups so heavy chain explosions stay fast in the DOM
    while (layer.children.length >= 12) layer.firstElementChild?.remove();
    const el = document.createElement('div');
    el.className = 'kill-pop' + (tag ? ' close-kill' : '') + (style ? ` ${style}` : '');
    el.style.left = `${Math.round(screen.x)}px`;
    el.style.top = `${Math.round(screen.y)}px`;
    el.textContent = points > 0 ? `+${points}` : tag;
    if (points > 0 && tag) {
      const sub = document.createElement('small');
      sub.textContent = tag;
      el.appendChild(sub);
    }
    layer.appendChild(el);
    setTimeout(() => el.remove(), 840);
  }
  charge(k, x, y) {
    if (k <= 0) { this.el.chargeRing.classList.add('hidden'); return; }
    this.el.chargeRing.classList.remove('hidden');
    this.el.chargeRing.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, 34px)`;
    this.el.chargeArc.style.strokeDashoffset = String(150.8 * (1 - clamp(k, 0, 1)));
  }
  locks(positions) {
    this._lockPool.forEach((m, i) => {
      if (i < positions.length) {
        m.style.display = 'block';
        m.style.left = `${positions[i].x}px`;
        m.style.top = `${positions[i].y}px`;
      } else m.style.display = 'none';
    });
  }

  /* ---- flashes ---- */
  hurt() {
    this.el.hurt.style.opacity = 1;
    setTimeout(() => (this.el.hurt.style.opacity = 0), 120);
  }
  flash(op = 0.8, ms = 90) {
    this.el.white.style.transition = 'none';
    this.el.white.style.opacity = op;
    setTimeout(() => {
      this.el.white.style.transition = 'opacity .35s';
      this.el.white.style.opacity = 0;
    }, ms);
  }

  update(dt) {
    if (this._bannerT > 0) {
      this._bannerT -= dt;
      if (this._bannerT <= 0) this.el.waveBanner.classList.add('hidden');
    }
    if (this._alertT > 0) {
      this._alertT -= dt;
      if (this._alertT <= 0) this.el.alert.classList.add('hidden');
    }
    // dialogue typewriter
    if (!this._dlgActive && this._dlgQueue.length) {
      this._dlgActive = this._dlgQueue.shift();
      this._dlgChar = 0; this._dlgTimer = 0;
      this.el.dlgImg.src = PORTRAITS[this._dlgActive.who] ?? PORTRAITS.REX;
      this.el.dlgName.textContent = this._dlgActive.who.charAt(0) + this._dlgActive.who.slice(1).toLowerCase();
      this.el.dlg.classList.toggle('command-comms', ['REX', 'THORNE', 'BOWIE'].includes(this._dlgActive.who));
      this.el.dlgText.textContent = '';
      this.el.dlg.classList.remove('hidden');
    }
    if (this._dlgActive) {
      this._dlgTimer += dt;
      const want = Math.min(this._dlgActive.text.length, Math.floor(this._dlgTimer * 42));
      if (want > this._dlgChar) {
        this._dlgChar = want;
        this.el.dlgText.textContent = this._dlgActive.text.slice(0, want);
        if (want % 3 === 0) audio.blip();
      }
      if (this._dlgTimer > this._dlgActive.dur) {
        this._dlgActive = null;
        if (!this._dlgQueue.length) this.el.dlg.classList.add('hidden');
      }
    }
  }
}
