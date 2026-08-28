import * as THREE from 'three';
import { buildArwing } from './shipFactory.js';
import { clamp, damp, _v1 } from '../core/util.js';

export const PLAYER_Z = -20;
const TRAIL_LEN = 26;

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.mesh = buildArwing();
    this.mesh.scale.setScalar(1.15);
    scene.add(this.mesh);

    this.x = 0; this.y = 14;
    this.vx = 0; this.vy = 0;
    // Steering and pointer targets are deliberately separate from velocity.
    // This gives keys a short, predictable ramp and filters trackpad jitter
    // before it can become a full-speed lateral snap.
    this.steerX = 0; this.steerY = 0;
    this.pointerX = this.x; this.pointerY = this.y;
    this.pointerReady = false;
    this.bounds = { x: 285, yMin: 3.2, yMax: 188 };
    this.radius = 2.3;
    this._buildShadow();

    // barrel roll
    this.rollT = 0; this.rollDur = 0.62; this.rollDir = 0; this.rollAngle = 0;
    this._lastTap = { code: null, t: 0 };

    // boost
    this.meter = 100;
    this.speedFactor = 1;
    this.zShift = 0;

    // weapons state
    this.fireCd = 0;
    this.charge = 0;         // 0..1 while holding
    this.charging = false;
    this.laserLevel = 1;     // 1..3
    this.bombs = 3;

    this.invuln = 0;         // respawn / roll i-frames
    this.alive = true;

    this._buildTrails();
    this._buildRollFx();
    this.time = 0;
  }

  _buildTrails() {
    this.trails = [];
    for (const tip of [this.mesh.userData.tipL, this.mesh.userData.tipR]) {
      const geo = new THREE.BufferGeometry();
      const posArr = new Float32Array(TRAIL_LEN * 2 * 3);
      geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
      const alphaArr = new Float32Array(TRAIL_LEN * 2);
      geo.setAttribute('aAlpha', new THREE.BufferAttribute(alphaArr, 1));
      const idx = [];
      for (let i = 0; i < TRAIL_LEN - 1; i++) {
        const a = i * 2, b = i * 2 + 1, c = i * 2 + 2, d = i * 2 + 3;
        idx.push(a, b, c, b, d, c);
      }
      geo.setIndex(idx);
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
        uniforms: { uColor: { value: new THREE.Color(0xffffff) }, uOpacity: { value: 0.5 } },
        vertexShader: `attribute float aAlpha; varying float vA; void main(){ vA = aAlpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying float vA; void main(){ gl_FragColor = vec4(uColor, vA * uOpacity); }`,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      this.scene.add(mesh);
      this.trails.push({ tip, mesh, hist: [] });
    }
  }

  _buildRollFx() {
    // white swirl arcs during barrel roll (concept 2)
    this.rollArcs = [];
    for (let i = 0; i < 3; i++) {
      const geo = new THREE.TorusGeometry(6.2 + i * 1.1, 0.5 - i * 0.1, 6, 26, Math.PI * 1.15);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, fog: false,
      });
      const m = new THREE.Mesh(geo, mat);
      this.scene.add(m);
      this.rollArcs.push(m);
    }
  }

  get rolling() { return this.rollT > 0; }

  tryRoll(dir) {
    if (this.rollT > 0) return false;
    this.rollT = this.rollDur;
    this.rollDir = dir;
    this.vx += dir * 115;
    return true;
  }

  _releaseVelocity(value, maxSpeed, dt) {
    // A two-stage decay: keep the opening of a release readable, then settle
    // firmly at low speed so the ship neither slides nor jitters around aim.
    const speedRatio = clamp(Math.abs(value) / maxSpeed, 0, 1);
    const response = 8.6 + Math.pow(1 - speedRatio, 1.25) * 6.2;
    return damp(value, 0, response, dt);
  }

  _pointerSensitivity(velocity, maxSpeed, requested) {
    const speedRatio = clamp(Math.abs(velocity) / maxSpeed, 0, 1);
    const reversing = requested !== 0 && velocity * requested < 0;
    // Preserve full authority when cancelling momentum. Otherwise, smoothly
    // reduce same-direction sensitivity at speed to keep trackpad input stable.
    return reversing ? 1 : 1 - Math.pow(speedRatio, 1.2) * 0.38;
  }

  _buildShadow() {
    // soft blob shadow projected on the ground — big depth cue over the wide field
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(8,10,26,.55)');
    grad.addColorStop(1, 'rgba(8,10,26,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(11, 7),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.scene.add(this.shadow);
  }

  update(dt, input, game) {
    this.time += dt;
    const B = this.bounds;

    /* ---- steering: intent-aware key ramp + filtered trackpad target ---- */
    const ax = input.moveX, ay = input.moveY;
    const KEY_SPEED_X = 174, KEY_SPEED_Y = 133;
    const POINTER_SPEED_X = 154, POINTER_SPEED_Y = 122;
    const KEY_AXIS_RESPONSE = 9.2;       // ~9 frames to 75% stick intent
    const KEY_VELOCITY_RESPONSE = 8.4;
    const TURN_VELOCITY_RESPONSE = 11.6; // cancel drift before reversing
    const POINTER_TARGET_RESPONSE = 7.2;
    const POINTER_VELOCITY_RESPONSE = 7.0;
    const POINTER_REVERSE_RESPONSE = 10.4;
    const POINTER_BASE_GAIN = 3.25;
    const POINTER_DEADZONE_X = 1.8, POINTER_DEADZONE_Y = 1.4;
    const POINTER_SPEED_DEADZONE_X = 0.7, POINTER_SPEED_DEADZONE_Y = 0.5;
    let targetVx = 0, targetVy = 0;
    let coastingX = true, coastingY = true;
    let responseX = KEY_VELOCITY_RESPONSE, responseY = KEY_VELOCITY_RESPONSE;

    if (ax || ay) {
      // The ramp stays quick enough for combat, but requires several frames
      // to build force. A requested reversal gets extra braking authority.
      this.steerX = damp(this.steerX, ax, KEY_AXIS_RESPONSE, dt);
      this.steerY = damp(this.steerY, ay, KEY_AXIS_RESPONSE, dt);
      targetVx = this.steerX * KEY_SPEED_X;
      targetVy = this.steerY * KEY_SPEED_Y;
      coastingX = !ax;
      coastingY = !ay;
      if (ax && this.vx * ax < 0) responseX = TURN_VELOCITY_RESPONSE;
      if (ay && this.vy * ay < 0) responseY = TURN_VELOCITY_RESPONSE;
      this.pointerReady = false;
      input.mouse.active = false; // keyboard takes over until the pointer moves again
    } else if (input.mouse.active) {
      const rawX = clamp(input.mouse.nx * B.x * 1.15, -B.x, B.x);
      const rawY = clamp(input.mouse.ny * 0.5 + 0.5, 0, 1) * (B.yMax - B.yMin) + B.yMin;
      // Re-anchor on the first pointer event after a keyboard manoeuvre, then
      // smooth the target before converting it to thrust.
      if (!this.pointerReady) {
        this.pointerX = this.x;
        this.pointerY = this.y;
        this.pointerReady = true;
      }
      this.pointerX = damp(this.pointerX, rawX, POINTER_TARGET_RESPONSE, dt);
      this.pointerY = damp(this.pointerY, rawY, POINTER_TARGET_RESPONSE, dt);
      const dx = this.pointerX - this.x;
      const dy = this.pointerY - this.y;
      const speedX = clamp(Math.abs(this.vx) / POINTER_SPEED_X, 0, 1);
      const speedY = clamp(Math.abs(this.vy) / POINTER_SPEED_Y, 0, 1);
      // At speed the dead zone grows gently, absorbing incidental trackpad
      // motion; at rest it stays narrow for precise target adjustment.
      const deadzoneX = POINTER_DEADZONE_X + speedX * POINTER_SPEED_DEADZONE_X;
      const deadzoneY = POINTER_DEADZONE_Y + speedY * POINTER_SPEED_DEADZONE_Y;
      const filteredX = Math.sign(dx) * Math.max(0, Math.abs(dx) - deadzoneX);
      const filteredY = Math.sign(dy) * Math.max(0, Math.abs(dy) - deadzoneY);
      const gainX = this._pointerSensitivity(this.vx, POINTER_SPEED_X, filteredX);
      const gainY = this._pointerSensitivity(this.vy, POINTER_SPEED_Y, filteredY);
      targetVx = clamp(filteredX * POINTER_BASE_GAIN * gainX, -POINTER_SPEED_X, POINTER_SPEED_X);
      targetVy = clamp(filteredY * POINTER_BASE_GAIN * gainY, -POINTER_SPEED_Y, POINTER_SPEED_Y);
      coastingX = filteredX === 0;
      coastingY = filteredY === 0;
      responseX = this.vx * filteredX < 0 ? POINTER_REVERSE_RESPONSE : POINTER_VELOCITY_RESPONSE;
      responseY = this.vy * filteredY < 0 ? POINTER_REVERSE_RESPONSE : POINTER_VELOCITY_RESPONSE;
      this.steerX = damp(this.steerX, 0, KEY_AXIS_RESPONSE, dt);
      this.steerY = damp(this.steerY, 0, KEY_AXIS_RESPONSE, dt);
    } else {
      this.steerX = damp(this.steerX, 0, KEY_AXIS_RESPONSE, dt);
      this.steerY = damp(this.steerY, 0, KEY_AXIS_RESPONSE, dt);
    }

    this.vx = coastingX ? this._releaseVelocity(this.vx, KEY_SPEED_X, dt) : damp(this.vx, targetVx, responseX, dt);
    this.vy = coastingY ? this._releaseVelocity(this.vy, KEY_SPEED_Y, dt) : damp(this.vy, targetVy, responseY, dt);
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // soft bounds
    if (this.x > B.x) { this.x = B.x; this.vx = Math.min(this.vx, 0); }
    if (this.x < -B.x) { this.x = -B.x; this.vx = Math.max(this.vx, 0); }
    if (this.y > B.yMax) { this.y = B.yMax; this.vy = Math.min(this.vy, 0); }
    if (this.y < B.yMin) { this.y = B.yMin; this.vy = Math.max(this.vy, 0); }

    /* ---- barrel roll (Command / Ctrl + ← or →) ---- */
    if (input.justPressed('RollLeft')) this.tryRoll(-1);
    if (input.justPressed('RollRight')) this.tryRoll(1);
    // Q/E kept as an accessible alternative
    if (input.justPressed('KeyQ')) this.tryRoll(-1);
    if (input.justPressed('KeyE')) this.tryRoll(1);
    if (this.rollT > 0) {
      this.rollT -= dt;
      const k = 1 - Math.max(this.rollT, 0) / this.rollDur;
      this.rollAngle = this.rollDir * k * Math.PI * 2;
    } else this.rollAngle = 0;

    /* ---- boost / brake ---- */
    let target = 1;
    if (input.boosting && this.meter > 2) { target = 2.05; this.meter -= 30 * dt; }
    else if (input.braking && this.meter > 2) { target = 0.50; this.meter -= 23 * dt; }
    else this.meter = Math.min(100, this.meter + 28 * dt);
    this.meter = Math.max(0, this.meter);
    this.speedFactor = damp(this.speedFactor, target, 7, dt);
    this.zShift = damp(this.zShift, (this.speedFactor - 1) * -6.5, 5.5, dt);

    if (this.invuln > 0) this.invuln -= dt;

    /* ---- pose ---- */
    const bank = clamp(-this.vx * 0.0115, -1.15, 1.15);
    const pitch = clamp(this.vy * 0.011, -0.5, 0.5);
    const m = this.mesh;
    m.position.set(this.x, this.y, PLAYER_Z + this.zShift);
    m.rotation.set(pitch, clamp(-this.vx * 0.0032, -0.34, 0.34), bank + this.rollAngle, 'ZYX');

    // respawn blink
    m.visible = !(this.invuln > 0 && this.rollT <= 0 && Math.floor(this.time * 14) % 2 === 0);

    /* ---- ground shadow ---- */
    if (this.shadow) {
      const floorY = this.floorY ?? 0;
      this.shadow.position.set(this.x, floorY + 0.25, PLAYER_Z + this.zShift + 2);
      const h = clamp(this.y - floorY, 0, 60);
      const s = 1 + h / 44;
      this.shadow.scale.set(s, s, 1);
      this.shadow.material.opacity = clamp(0.55 - h / 120, 0.08, 0.55);
    }

    /* ---- engine glow (grouped twin nozzles) — flares hotter on boost ---- */
    const glow = m.userData.engineGlow;
    const bk = clamp((this.speedFactor - 1) / 0.85, 0, 1);
    const gs = (0.9 + Math.sin(this.time * 31) * 0.08) * (0.8 + (this.speedFactor - 0.5) * 0.7);
    glow.scale.setScalar(gs);
    const glows = m.userData.engineGlows;
    if (glows) for (const g of glows) g.material.color.setRGB(0.4 + 0.6 * bk, 0.85 + 0.15 * bk, 1.0);
    const petals = m.userData.enginePetals;
    if (petals) for (let i = 0; i < petals.length; i++) {
      const p = petals[i];
      p.rotation.z = Math.sin(this.time * 5.2 + i * Math.PI) * (0.05 + bk * 0.13);
      p.scale.setScalar(0.96 + bk * 0.12);
    }

    /* ---- trails ---- */
    const boostK = clamp((this.speedFactor - 1) / 0.85, 0, 1);
    for (const tr of this.trails) {
      tr.tip.getWorldPosition(_v1);
      tr.hist.unshift({ x: _v1.x, y: _v1.y, z: _v1.z });
      if (tr.hist.length > TRAIL_LEN) tr.hist.pop();
      const pa = tr.mesh.geometry.attributes.position.array;
      const aa = tr.mesh.geometry.attributes.aAlpha.array;
      for (let i = 0; i < TRAIL_LEN; i++) {
        const p = tr.hist[Math.min(i, tr.hist.length - 1)];
        const w = 0.06 + (i / TRAIL_LEN) * 0.85;
        pa[i * 6] = p.x; pa[i * 6 + 1] = p.y - w / 2; pa[i * 6 + 2] = p.z + i * 1.1;
        pa[i * 6 + 3] = p.x; pa[i * 6 + 4] = p.y + w / 2; pa[i * 6 + 5] = p.z + i * 1.1;
        const a = (1 - i / TRAIL_LEN);
        aa[i * 2] = aa[i * 2 + 1] = a * a;
      }
      tr.mesh.geometry.attributes.position.needsUpdate = true;
      tr.mesh.geometry.attributes.aAlpha.needsUpdate = true;
      tr.mesh.material.uniforms.uOpacity.value = 0.28 + boostK * 0.5 + (this.rolling ? 0.3 : 0);
    }

    /* ---- roll swirl fx ---- */
    for (let i = 0; i < this.rollArcs.length; i++) {
      const arc = this.rollArcs[i];
      if (this.rolling) {
        const k = 1 - this.rollT / this.rollDur;
        arc.material.opacity = Math.sin(k * Math.PI) * (0.55 - i * 0.13);
        arc.position.set(this.x, this.y, PLAYER_Z + this.zShift + 1);
        arc.rotation.z = this.rollAngle * (1.3 + i * 0.35) + i * 2.1;
        arc.scale.setScalar(0.6 + k * 0.9);
      } else arc.material.opacity = Math.max(0, arc.material.opacity - dt * 4);
    }
  }

  /* ---- aim helpers ---- */
  aimNear(out) { return out.set(this.x + this.vx * 0.07, this.y + this.vy * 0.08, PLAYER_Z - 62); }
  aimFar(out) { return out.set(this.x + this.vx * 0.15, this.y + this.vy * 0.16, PLAYER_Z - 150); }
  muzzle(out) { return out.set(this.x, this.y - 0.1, PLAYER_Z - 5); }

  setZoneBounds(zone) {
    // enormous lateral corridor + very tall vertical envelope
    const tight = zone.terrain === 'gorge' || zone.terrain === 'ember';
    this.bounds.x = tight ? 255 : 285;
    this.bounds.yMin = 3.2;
    this.bounds.yMax = tight ? 188 : 185;
    this.floorY = zone.floorY ?? 0;
  }
}
