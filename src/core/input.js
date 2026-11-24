/** Keyboard, mouse, gamepad, and mobile touch input state. */
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.mouse = { x: 0, y: 0, nx: 0, ny: 0, down: false, rightDown: false, active: false };
    this._lastMouseX = null;
    this._lastMouseY = null;
    this._mouseWakeDist = 0;

    this.pressedThisFrame = new Set();
    this._justPressed = new Set();
    this._virtualKeys = new Map();
    this.onTouchAction = null;

    // Double-tap barrel roll tracker (A/D or ArrowLeft/ArrowRight within 250ms)
    this._lastTap = { dir: 0, t: 0 };

    // Shared pilot flight settings (kept in sync by Game)
    this.settings = {
      invertY: false,
      autoFire: false,
      sensitivity: 1.0,
    };

    // Gamepad state (Standard Gamepad API)
    this.gamepad = {
      connected: false,
      moveX: 0,
      moveY: 0,
      firing: false,
      chargeHeld: false,
      boosting: false,
      braking: false,
      prevButtons: [],
    };

    this.touch = {
      capable: this._detectTouchCapability(),
      enabled: false,
      moveX: 0,
      moveY: 0,
      stickPointer: null,
      buttonPointers: new Map(),
    };
    this.touchEl = document.getElementById('touch-controls');
    this.stickEl = document.getElementById('touch-stick');
    this.stickKnob = document.getElementById('touch-stick-knob');
    document.body.classList.toggle('touch-device', this.touch.capable);

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const k = e.code;
      this.keys.add(k);
      this._justPressed.add(k);

      // Record a Cmd(Command)-modified arrow as a distinct roll chord even
      // though macOS may swallow the arrow keyup while Meta is held.
      if (e.metaKey && (k === 'ArrowLeft' || k === 'ArrowRight')) {
        this._justPressed.add(k === 'ArrowLeft' ? 'RollLeft' : 'RollRight');
        this._lastTap.t = 0;
        e.preventDefault();
      } else if (k === 'KeyA' || k === 'ArrowLeft' || k === 'KeyD' || k === 'ArrowRight') {
        // Classic Star Fox double-tap left/right barrel roll (250ms window)
        const dir = (k === 'KeyA' || k === 'ArrowLeft') ? -1 : 1;
        const now = performance.now();
        if (this._lastTap.dir === dir && (now - this._lastTap.t) <= 250) {
          this._justPressed.add(dir < 0 ? 'RollLeft' : 'RollRight');
          this._lastTap.t = 0;
        } else {
          this._lastTap.dir = dir;
          this._lastTap.t = now;
        }
      }

      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ControlLeft'].includes(k)) {
        // Do not hijack Space/Arrows while typing in the callsign input
        const tag = document.activeElement?.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      // Meta/Cmd release: macOS often drops other keyups while Cmd is held,
      // so clear movement keys to avoid a stuck direction.
      if (e.code === 'MetaLeft' || e.code === 'MetaRight') {
        for (const c of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS']) this.keys.delete(c);
      }
    });

    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouse.down = false;
      this.mouse.rightDown = false;
      this._clearTouchState();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.keys.clear();
        this.mouse.down = false;
        this.mouse.rightDown = false;
        this._clearTouchState();
      }
    });

    canvas.addEventListener('mousemove', (e) => {
      const prevX = this._lastMouseX ?? e.clientX;
      const prevY = this._lastMouseY ?? e.clientY;
      const delta = Math.hypot(e.clientX - prevX, e.clientY - prevY);
      this._lastMouseX = e.clientX;
      this._lastMouseY = e.clientY;

      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = -((e.clientY / window.innerHeight) * 2 - 1);
      if (Number.isFinite(nx) && Number.isFinite(ny)) {
        this.mouse.nx = nx;
        this.mouse.ny = ny;
        // Require deliberate pointer movement (>= 8px) before stealing control
        // back from keyboard/gamepad steering, preventing trackpad micro-jitter.
        if (!this.mouse.active) {
          this._mouseWakeDist += delta;
          if (this._mouseWakeDist >= 8) {
            this.mouse.active = true;
            this._mouseWakeDist = 0;
          }
        }
      }
    });

    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.mouse.down = true; this._justPressed.add('MouseLeft'); }
      if (e.button === 2) { this.mouse.rightDown = true; this._justPressed.add('MouseRight'); }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.down = false;
      if (e.button === 2) this.mouse.rightDown = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    this._bindTouchControls();
  }

  /** Relinquish mouse steering (e.g. when keyboard/gamepad steers) and reset wake deadzone. */
  deactivateMouse() {
    this.mouse.active = false;
    this._mouseWakeDist = 0;
  }

  /** Poll connected standard Gamepad (call once per frame before player/weapons update). */
  pollGamepad() {
    const gpState = this.gamepad;
    const pads = navigator.getGamepads?.();
    let pad = null;
    if (pads) {
      for (const p of pads) {
        if (p && p.connected) { pad = p; break; }
      }
    }
    if (!pad) {
      gpState.connected = false;
      gpState.moveX = 0;
      gpState.moveY = 0;
      gpState.firing = false;
      gpState.chargeHeld = false;
      gpState.boosting = false;
      gpState.braking = false;
      gpState.prevButtons.length = 0;
      return;
    }

    gpState.connected = true;
    const deadzone = 0.16;
    const shapeAxis = (v) => {
      if (!Number.isFinite(v) || Math.abs(v) < deadzone) return 0;
      return Math.sign(v) * ((Math.abs(v) - deadzone) / (1 - deadzone));
    };

    const btn = (i) => !!pad.buttons[i]?.pressed;
    const btnVal = (i) => pad.buttons[i]?.value ?? (btn(i) ? 1 : 0);
    const rising = (i) => btn(i) && !gpState.prevButtons[i];

    let sx = shapeAxis(pad.axes[0] ?? 0);
    let sy = -shapeAxis(pad.axes[1] ?? 0); // push stick up = +1
    if (sx === 0) {
      if (btn(14)) sx = -1;
      else if (btn(15)) sx = 1;
    }
    if (sy === 0) {
      if (btn(12)) sy = 1;
      else if (btn(13)) sy = -1;
    }
    gpState.moveX = sx;
    gpState.moveY = sy;

    gpState.firing = btn(0) || btnVal(7) > 0.35;
    gpState.chargeHeld = btn(2) || btnVal(6) > 0.35;
    gpState.boosting = btn(3);
    gpState.braking = btn(10) || btn(11); // L3/R3 optional brake

    if (rising(1)) this.pressedThisFrame.add('KeyB');          // B/Circle: Bomb & Detonate
    if (rising(4)) this.pressedThisFrame.add('RollLeft');      // LB: Roll Left
    if (rising(5)) this.pressedThisFrame.add('RollRight');     // RB: Roll Right
    if (rising(9)) this.pressedThisFrame.add('GamepadPause');  // Start: Pause
    if (rising(0)) this.pressedThisFrame.add('GamepadConfirm');

    if (sx !== 0 || sy !== 0) this.deactivateMouse();

    gpState.prevButtons.length = pad.buttons.length;
    for (let i = 0; i < pad.buttons.length; i++) gpState.prevButtons[i] = btn(i);
  }

  _detectTouchCapability() {
    return navigator.maxTouchPoints > 0
      || window.matchMedia?.('(hover: none) and (pointer: coarse)').matches
      || window.matchMedia?.('(pointer: coarse)').matches;
  }

  /** Show controls only while the player can issue flight commands. */
  setTouchEnabled(enabled) {
    const active = !!enabled && this.touch.capable && !!this.touchEl;
    this.touch.enabled = active;
    this.touchEl?.classList.toggle('hidden', !active);
    if (!active) this._clearTouchState();
  }

  _bindTouchControls() {
    if (!this.touchEl || !this.stickEl) return;

    const ignore = (e) => {
      if (!this.touch.enabled) return true;
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    this.stickEl.addEventListener('pointerdown', (e) => {
      if (ignore(e) || this.touch.stickPointer !== null) return;
      this.touch.stickPointer = e.pointerId;
      this._capturePointer(this.stickEl, e.pointerId);
      this._updateStick(e);
    });
    this.stickEl.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.touch.stickPointer) return;
      if (ignore(e)) return;
      this._updateStick(e);
    });
    const releaseStick = (e) => {
      if (e.pointerId !== this.touch.stickPointer) return;
      e.preventDefault();
      this._resetStick();
    };
    this.stickEl.addEventListener('pointerup', releaseStick);
    this.stickEl.addEventListener('pointercancel', releaseStick);
    this.stickEl.addEventListener('lostpointercapture', () => this._resetStick());

    for (const button of this.touchEl.querySelectorAll('[data-touch], [data-touch-action]')) {
      button.addEventListener('pointerdown', (e) => {
        if (ignore(e)) return;
        this._capturePointer(button, e.pointerId);
        let pointers = this.touch.buttonPointers.get(button);
        if (!pointers) this.touch.buttonPointers.set(button, pointers = new Set());
        pointers.add(e.pointerId);
        button.classList.add('is-held');
        const code = button.dataset.touch;
        if (code) this._pressVirtual(code, e.pointerId);
        if (button.dataset.touchAction) this.onTouchAction?.(button.dataset.touchAction);
      });
      const releaseButton = (e) => {
        const pointers = this.touch.buttonPointers.get(button);
        if (!pointers?.has(e.pointerId)) return;
        e.preventDefault();
        pointers.delete(e.pointerId);
        if (!pointers.size) {
          this.touch.buttonPointers.delete(button);
          button.classList.remove('is-held');
        }
        const code = button.dataset.touch;
        if (code) this._releaseVirtual(code, e.pointerId);
      };
      button.addEventListener('pointerup', releaseButton);
      button.addEventListener('pointercancel', releaseButton);
      button.addEventListener('lostpointercapture', () => this._releaseAllButtonPointers(button));
    }
  }

  _capturePointer(element, pointerId) {
    try { element.setPointerCapture?.(pointerId); } catch { /* Safari/WebView and synthetic events can omit an active pointer. */ }
  }

  _updateStick(e) {
    const rect = this.stickEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const radius = Math.max(1, Math.min(rect.width, rect.height) * 0.31);
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const distance = Math.hypot(dx, dy);
    if (distance > radius) { dx = dx / distance * radius; dy = dy / distance * radius; }
    this.touch.moveX = dx / radius;
    this.touch.moveY = -dy / radius;
    this.stickKnob?.style.setProperty('--touch-stick-x', `${dx}px`);
    this.stickKnob?.style.setProperty('--touch-stick-y', `${dy}px`);
  }

  _resetStick() {
    this.touch.stickPointer = null;
    this.touch.moveX = 0;
    this.touch.moveY = 0;
    this.stickKnob?.style.setProperty('--touch-stick-x', '0px');
    this.stickKnob?.style.setProperty('--touch-stick-y', '0px');
  }

  _pressVirtual(code, pointerId) {
    let pointers = this._virtualKeys.get(code);
    if (!pointers) this._virtualKeys.set(code, pointers = new Set());
    if (!pointers.size) this._justPressed.add(code);
    pointers.add(pointerId);
  }

  _releaseVirtual(code, pointerId) {
    const pointers = this._virtualKeys.get(code);
    if (!pointers) return;
    pointers.delete(pointerId);
    if (!pointers.size) this._virtualKeys.delete(code);
  }

  _releaseAllButtonPointers(button) {
    const pointers = this.touch.buttonPointers.get(button);
    if (!pointers) return;
    const code = button.dataset.touch;
    if (code) for (const pointerId of pointers) this._releaseVirtual(code, pointerId);
    this.touch.buttonPointers.delete(button);
    button.classList.remove('is-held');
  }

  _clearTouchState() {
    this._resetStick();
    for (const button of [...this.touch.buttonPointers.keys()]) this._releaseAllButtonPointers(button);
    this._virtualKeys.clear();
  }

  /** Call once per frame after the game update. */
  endFrame() {
    this.pressedThisFrame = this._justPressed;
    this._justPressed = new Set();
  }

  down(...codes) {
    return codes.some((c) => c === 'MouseLeft'
      ? this.mouse.down
      : this.keys.has(c) || this._virtualKeys.has(c));
  }
  justPressed(...codes) { return codes.some((c) => this.pressedThisFrame.has(c)); }

  get moveX() {
    let x = 0;
    if (this.down('KeyA', 'ArrowLeft')) x -= 1;
    if (this.down('KeyD', 'ArrowRight')) x += 1;
    return x || this.touch.moveX || this.gamepad.moveX;
  }
  get moveY() {
    let y = 0;
    if (this.down('KeyS', 'ArrowDown')) y -= 1;
    if (this.down('KeyW', 'ArrowUp')) y += 1;
    return y || this.touch.moveY || this.gamepad.moveY;
  }
  get firing() { return this.down('Space', 'MouseLeft') || this.gamepad.firing || !!this.settings.autoFire; }
  get chargeHeld() { return this.down('KeyC') || !!this.mouse.rightDown || this.gamepad.chargeHeld; }
  get boosting() { return this.down('ShiftLeft', 'ShiftRight') || this.gamepad.boosting; }
  get braking() { return this.down('ControlLeft', 'ControlRight', 'KeyX') || this.gamepad.braking; }
}
