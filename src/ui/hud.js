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
      hud: $('hud'), hpFill: $('bar-hp-fill'), boostFill: $('bar-boost-fill'),
      laserPips: $('laser-pips'), bombGems: $('bomb-gems'),
      score: $('score'), lives: $('lives-num'),
      bossBar: $('boss-bar'), bossName: $('boss-name'), bossFill: $('boss-fill'),
      waveBanner: $('wave-banner'), waveTop: $('wave-banner-top'), waveSub: $('wave-banner-sub'),
      alert: $('alert-banner'),
      bossFillLag: $('boss-fill-lag'), bossTicks: $('boss-ticks'), bossPhase: $('boss-phase'), bossSkull: $('boss-skull'),
      callout: $('callout'), calloutIcon: $('callout-icon'), calloutText: $('callout-text'),
      combo: $('combo'), comboX: $('combo-x'),
      wingStatus: $('wing-status'),
      rivalMark: $('rival-marker'), rivalMarkSvg: $('rival-marker')?.querySelector('svg'),
      dlg: $('dialogue'), dlgImg: $('dlg-img'), dlgName: $('dlg-name'), dlgText: $('dlg-text'),
      retNear: $('reticle-near'), retFar: $('reticle-far'), lockLayer: $('lock-markers'),
      chargeRing: $('charge-ring'), chargeArc: $('charge-arc'),
      hurt: $('hurt-flash'), white: $('white-flash'), vignette: $('vignette'),
    };
    this._pips = []; this._gems = []; this._wingRows = {};
    // laser-power level → laser-bolt icons; bomb count → bomb icons
    const LASER_SVG = '<svg viewBox="0 0 22 12"><rect x="1.5" y="4" width="12.5" height="4" rx="2" fill="#ffe066"/><path d="M13 2 L21 6 L13 10 Z" fill="#ffab1f"/></svg>';
    const BOMB_SVG = '<svg viewBox="0 0 16 16"><circle cx="7.4" cy="10.1" r="4.7" fill="#23252f"/><ellipse cx="5.7" cy="8.4" rx="1.4" ry="1" fill="rgba(255,255,255,.4)"/><path d="M10 6 q2.3-1.8 1.7-4.3" stroke="#9a7a44" stroke-width="1.3" fill="none" stroke-linecap="round"/><circle cx="11.9" cy="1.7" r="1.8" fill="#ffb020"/><circle cx="11.9" cy="1.7" r=".8" fill="#fff2b0"/></svg>';
    for (let i = 0; i < 3; i++) {
      const p = document.createElement('div'); p.className = 'pip'; p.innerHTML = LASER_SVG;
      this.el.laserPips.appendChild(p); this._pips.push(p);
    }
    for (let i = 0; i < 5; i++) {
      const g = document.createElement('div'); g.className = 'gem'; g.innerHTML = BOMB_SVG;
      this.el.bombGems.appendChild(g); this._gems.push(g);
    }
    this._lockPool = [];
    for (let i = 0; i < 6; i++) {
      const m = document.createElement('div'); m.className = 'lock-marker';
      m.style.display = 'none';
      this.el.lockLayer.appendChild(m);
      this._lockPool.push(m);
    }
    this._dlgQueue = [];
    this._dlgActive = null;
    this._dlgChar = 0; this._dlgTimer = 0;
    this._bannerT = 0; this._score = -1;
  }

  show() { this.el.hud.classList.remove('hidden'); }
  hide() { this.el.hud.classList.add('hidden'); }

  setBars(hp, boost) {
    this.el.hpFill.style.transform = `scaleX(${clamp(hp / 100, 0, 1)})`;
    this.el.hpFill.classList.toggle('low', hp < 30);
    this.el.boostFill.style.transform = `scaleX(${clamp(boost / 100, 0, 1)})`;
  }
  setScore(v) {
    if (v === this._score) return;
    this._score = v;
    this.el.score.textContent = String(Math.min(v, 999999)).padStart(4, '0');
  }
  setLives(v) { this.el.lives.textContent = 'x ' + v; }
  setLaserLevel(lv) { this._pips.forEach((p, i) => p.classList.toggle('on', i < lv)); }
  setBombs(n) { this._gems.forEach((g, i) => g.classList.toggle('on', i < n)); }

  /* ---- boss ---- */
  showBoss(name, phases = 1) {
    this.el.bossName.textContent = name;
    this.el.bossBar.classList.remove('hidden');
    // segmented ticks
    this.el.bossTicks.innerHTML = '';
    const segs = clamp(Math.round(name.length > 0 ? 10 : 10), 6, 12);
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

  /* ---- combo ---- */
  setCombo(n) {
    if (n >= 2) {
      this.el.comboX.textContent = 'x' + n;
      this.el.combo.classList.remove('hidden');
      this.el.combo.classList.remove('bump');
      void this.el.combo.offsetWidth;
      this.el.combo.classList.add('bump');
    } else {
      this.el.combo.classList.add('hidden');
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

  /* ---- reticle & locks (screen-space px) ---- */
  reticle(near, far, locked) {
    const rn = this.el.retNear, rf = this.el.retFar;
    rn.style.transform = `translate(${near.x - 46}px, ${near.y - 46}px)`;
    rf.style.transform = `translate(${far.x - 27}px, ${far.y - 27}px)`;
    rn.classList.toggle('locked', locked);
    rf.classList.toggle('locked', locked);
  }
  charge(k, x, y) {
    if (k <= 0) { this.el.chargeRing.classList.add('hidden'); return; }
    this.el.chargeRing.classList.remove('hidden');
    this.el.chargeRing.style.transform = `translate(${x - 30}px, ${y + 40}px)`;
    this.el.chargeArc.style.strokeDashoffset = String(150.8 * (1 - clamp(k, 0, 1)));
  }
  locks(positions) {
    this._lockPool.forEach((m, i) => {
      if (i < positions.length) {
        m.style.display = 'block';
        m.style.transform = `translate(${positions[i].x - 23}px, ${positions[i].y - 23}px)`;
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
