import * as THREE from 'three';
import { buildArwing } from './shipFactory.js';
import { audio } from '../core/audio.js';
import { clamp, damp, rand, toonMat, _v1 } from '../core/util.js';

export const PLAYER_Z = -20;
const TRAIL_LEN = 30;

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.mesh = buildArwing({ variant: 'hero' });
    this.mesh.scale.setScalar(1.16);
    scene.add(this.mesh);

    this.x = 0; this.y = 14;
    this.vx = 0; this.vy = 0;
    this.steerX = 0; this.steerY = 0;
    this.pointerX = this.x; this.pointerY = this.y;
    this.pointerReady = false;
    this.bounds = { x: 215, yMin: 3.4, yMax: 126 };
    this.radius = 2.3;
    this._buildShadow();

    // barrel roll
    this.rollT = 0; this.rollDur = 0.62; this.rollDir = 0; this.rollAngle = 0;

    // boost & weapon feel
    this.meter = 100;
    this.speedFactor = 1;
    this.zShift = 0;
    this.recoilT = 0;
    this._deflectFlashT = 0;
    this._damageShieldT = 0;
    this._damageSmokeCd = 0;

    // weapons state
    this.fireCd = 0;
    this.charge = 0;
    this.charging = false;
    this.laserLevel = 1;
    this.bombs = 3;

    this.invuln = 0;
    this.alive = true;

    this._buildTrails();
    this._buildRollFx();
    this._buildShieldFx();
    this._buildChargeFx();
    this._buildBoostCone();
    this._buildWingpods();
    this._boostRingCd = 0;
    this._chargeGatherCd = 0;
    this._wingpodCd = 0;
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
        uniforms: { uColor: { value: new THREE.Color(0xf4fbff) }, uOpacity: { value: 0.62 } },
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
    // Bold Star Fox cel-shaded barrel-roll vortex arcs (STAR_FOX_2.jpeg)
    this.rollArcs = [];
    for (let i = 0; i < 4; i++) {
      const geo = new THREE.TorusGeometry(6.0 + i * 1.25, 0.58 - i * 0.1, 6, 28, Math.PI * 1.28);
      const mat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0xffffff : 0x9ef0ff,
        transparent: true, opacity: 0, depthWrite: false, fog: false,
        blending: THREE.AdditiveBlending,
      });
      const m = new THREE.Mesh(geo, mat);
      this.scene.add(m);
      this.rollArcs.push(m);
    }
  }

  _buildShieldFx() {
    // Geodesic Fresnel deflector bubble around the Arwing:
    // shimmers electric cyan during barrel-roll deflections & flares crimson on hull hits.
    const group = new THREE.Group();
    const shellGeo = new THREE.IcosahedronGeometry(4.65, 2);
    const shellMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      fog: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uColor: { value: new THREE.Color(0x66f0ff) },
        uOpacity: { value: 0.0 },
        uTime: { value: 0.0 },
      },
      vertexShader: /* glsl */`
        varying vec3 vNormal;
        varying vec3 vViewPos;
        varying vec3 vLocalPos;
        void main() {
          vLocalPos = position;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vViewPos = -mvPos.xyz;
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: /* glsl */`
        uniform vec3 uColor;
        uniform float uOpacity;
        uniform float uTime;
        varying vec3 vNormal;
        varying vec3 vViewPos;
        varying vec3 vLocalPos;
        void main() {
          vec3 N = normalize(vNormal);
          vec3 V = normalize(vViewPos);
          float fresnel = pow(1.0 - abs(dot(N, V)), 2.2);
          float scan = 0.72 + 0.28 * sin(vLocalPos.z * 3.8 - uTime * 14.0);
          float alpha = clamp((fresnel * 0.92 + 0.12) * scan * uOpacity, 0.0, 1.0);
          gl_FragColor = vec4(uColor * (1.05 + fresnel * 0.55), alpha);
        }
      `,
    });
    const shell = new THREE.Mesh(shellGeo, shellMat);
    group.add(shell);

    const cageGeo = new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(4.72, 1));
    const cageMat = new THREE.LineBasicMaterial({
      color: 0xa6fbff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
      blending: THREE.AdditiveBlending,
    });
    const cage = new THREE.LineSegments(cageGeo, cageMat);
    group.add(cage);

    group.visible = false;
    this.scene.add(group);
    this.shieldFx = { group, shell, shellMat, cage, cageMat };
  }

  _buildChargeFx() {
    // Crackling 3D gyroscopic plasma sphere + twin counter-rotating energy rings mounted at Arwing nose!
    const anchor = this.mesh.userData.noseAnchor;
    if (!anchor) return;
    const g = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.85, 1),
      new THREE.MeshBasicMaterial({ color: 0xe6fcff, transparent: true, opacity: 0.92, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })
    );
    const ringA = new THREE.Mesh(
      new THREE.TorusGeometry(1.55, 0.14, 6, 18),
      new THREE.MeshBasicMaterial({ color: 0x62e8ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })
    );
    const ringB = new THREE.Mesh(
      new THREE.TorusGeometry(1.22, 0.10, 5, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.78, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })
    );
    ringB.rotation.x = Math.PI / 2;
    g.add(core, ringA, ringB);
    g.visible = false;
    anchor.add(g);
    this.chargeFx = { group: g, core, ringA, ringB };
  }

  _buildBoostCone() {
    // Translucent aerodynamic Mach shock-cone wrapping the Arwing during Boost afterburner!
    const geo = new THREE.ConeGeometry(5.6, 11.5, 16, 1, true);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x8ef2ff, transparent: true, opacity: 0, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    });
    const cone = new THREE.Mesh(geo, mat);
    cone.position.set(0, 0.1, 1.2);
    cone.visible = false;
    this.mesh.add(cone);
    this.boostCone = cone;
  }

  _buildWingpods() {
    // Orbiting automated Interceptor Wingpods unlocked via Armory Upgrades!
    this.wingpods = [];
    const hullGeo = new THREE.OctahedronGeometry(0.95, 0);
    const ringGeo = new THREE.TorusGeometry(1.38, 0.12, 5, 14);
    const barrelGeo = new THREE.CylinderGeometry(0.14, 0.22, 1.6, 6);
    barrelGeo.rotateX(Math.PI / 2);
    for (let i = 0; i < 2; i++) {
      const g = new THREE.Group();
      const hull = new THREE.Mesh(hullGeo, toonMat(0x2e4c78, { emissive: 0x2688cc, emissiveIntensity: 0.45, flat: true }));
      hull.scale.set(0.9, 0.72, 1.45);
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x76f4ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
      const barrel = new THREE.Mesh(barrelGeo, toonMat(0x162236, { flat: true }));
      barrel.position.z = -1.0;
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.28, 6, 6), new THREE.MeshBasicMaterial({ color: 0xd8ffff, fog: false }));
      tip.position.z = -1.85;
      g.add(hull, ring, barrel, tip);
      g.visible = false;
      this.scene.add(g);
      this.wingpods.push({ group: g, ring, side: i === 0 ? -1 : 1 });
    }
  }

  triggerDeflect() {
    this._deflectFlashT = 0.28;
  }

  triggerDamageShield() {
    this._damageShieldT = 0.45;
  }

  get rolling() { return this.rollT > 0; }

  tryRoll(dir) {
    if (this.rollT > 0) return false;
    this.rollT = this.rollDur;
    this.rollDir = dir;
    this.vx += dir * 115;
    audio.roll();
    return true;
  }

  _releaseVelocity(value, maxSpeed, dt) {
    const speedRatio = clamp(Math.abs(value) / maxSpeed, 0, 1);
    const response = 8.6 + Math.pow(1 - speedRatio, 1.25) * 6.2;
    return damp(value, 0, response, dt);
  }

  _pointerSensitivity(velocity, maxSpeed, requested) {
    const speedRatio = clamp(Math.abs(velocity) / maxSpeed, 0, 1);
    const reversing = requested !== 0 && velocity * requested < 0;
    return reversing ? 1 : 1 - Math.pow(speedRatio, 1.2) * 0.38;
  }

  _buildShadow() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(8,10,26,.58)');
    grad.addColorStop(1, 'rgba(8,10,26,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(13, 8.5),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.scene.add(this.shadow);
  }

  update(dt, input, game) {
    this.time += dt;
    const B = this.bounds;
    const invertSign = input.settings?.invertY ? -1 : 1;
    const sens = clamp(input.settings?.sensitivity ?? 1.0, 0.55, 1.6);

    /* ---- steering: intent-aware key/stick ramp + filtered pointer target ---- */
    const ax = input.moveX;
    const ay = input.moveY * invertSign;
    const KEY_SPEED_X = 166 * (0.86 + sens * 0.14);
    const KEY_SPEED_Y = 124 * (0.86 + sens * 0.14);
    const POINTER_SPEED_X = 148 * (0.8 + sens * 0.2);
    const POINTER_SPEED_Y = 114 * (0.8 + sens * 0.2);
    const KEY_AXIS_RESPONSE = 9.2 * (0.85 + sens * 0.15);
    const KEY_VELOCITY_RESPONSE = 8.4;
    const TURN_VELOCITY_RESPONSE = 11.6;
    const POINTER_TARGET_RESPONSE = 7.2 * sens;
    const POINTER_VELOCITY_RESPONSE = 7.0 * (0.85 + sens * 0.15);
    const POINTER_REVERSE_RESPONSE = 10.4;
    const POINTER_BASE_GAIN = 3.25 * sens;
    const POINTER_DEADZONE_X = 1.8, POINTER_DEADZONE_Y = 1.4;
    const POINTER_SPEED_DEADZONE_X = 0.7, POINTER_SPEED_DEADZONE_Y = 0.5;
    let targetVx = 0, targetVy = 0;
    let coastingX = true, coastingY = true;
    let responseX = KEY_VELOCITY_RESPONSE, responseY = KEY_VELOCITY_RESPONSE;

    if (ax || ay) {
      this.steerX = damp(this.steerX, ax, KEY_AXIS_RESPONSE, dt);
      this.steerY = damp(this.steerY, ay, KEY_AXIS_RESPONSE, dt);
      targetVx = this.steerX * KEY_SPEED_X;
      targetVy = this.steerY * KEY_SPEED_Y;
      coastingX = !ax;
      coastingY = !ay;
      if (ax && this.vx * ax < 0) responseX = TURN_VELOCITY_RESPONSE;
      if (ay && this.vy * ay < 0) responseY = TURN_VELOCITY_RESPONSE;
      this.pointerReady = false;
      if (input.deactivateMouse) input.deactivateMouse();
      else input.mouse.active = false;
    } else if (input.mouse.active) {
      const rawX = clamp(input.mouse.nx * B.x * 1.15, -B.x, B.x);
      const mny = input.mouse.ny * invertSign;
      const rawY = clamp(mny * 0.5 + 0.5, 0, 1) * (B.yMax - B.yMin) + B.yMin;
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

    if (this.x > B.x) { this.x = B.x; this.vx = Math.min(this.vx, 0); }
    if (this.x < -B.x) { this.x = -B.x; this.vx = Math.max(this.vx, 0); }
    if (this.y > B.yMax) { this.y = B.yMax; this.vy = Math.min(this.vy, 0); }
    if (this.y < B.yMin) { this.y = B.yMin; this.vy = Math.max(this.vy, 0); }

    /* ---- barrel roll ---- */
    if (input.justPressed('RollLeft', 'KeyQ')) this.tryRoll(-1);
    if (input.justPressed('RollRight', 'KeyE')) this.tryRoll(1);
    if (this.rollT > 0) {
      this.rollT -= dt;
      const k = 1 - Math.max(this.rollT, 0) / this.rollDur;
      this.rollAngle = this.rollDir * k * Math.PI * 2;
    } else this.rollAngle = 0;

    /* ---- boost / brake ---- */
    let target = 1;
    const regenMul = game?.build?.boostRegenMul ?? 1;
    if (input.boosting && this.meter > 2) { target = 2.05; this.meter -= 30 * dt; }
    else if (input.braking && this.meter > 2) { target = 0.50; this.meter -= 23 * dt; }
    else this.meter = Math.min(100, this.meter + 28 * regenMul * dt);
    this.meter = Math.max(0, this.meter);
    this.speedFactor = damp(this.speedFactor, target, 7, dt);
    this.zShift = damp(this.zShift, (this.speedFactor - 1) * -6.0, 5.5, dt);

    if (this.invuln > 0) this.invuln -= dt;
    if (this.recoilT > 0) this.recoilT = Math.max(0, this.recoilT - dt);
    if (this._deflectFlashT > 0) this._deflectFlashT = Math.max(0, this._deflectFlashT - dt);
    if (this._damageShieldT > 0) this._damageShieldT = Math.max(0, this._damageShieldT - dt);

    /* ---- pose ---- */
    const bank = clamp(-this.vx * 0.0115, -1.15, 1.15);
    const pitch = clamp(this.vy * 0.011, -0.5, 0.5);
    const recoilZ = this.recoilT > 0 ? Math.sin((this.recoilT / 0.08) * Math.PI) * 0.42 : 0;
    const m = this.mesh;
    m.position.set(this.x, this.y, PLAYER_Z + this.zShift + recoilZ);
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
      this.shadow.material.opacity = clamp(0.58 - h / 115, 0.08, 0.58);
    }

    /* ---- dynamic engine glow, vectoring petals, spinning turbine & 3D plasma plumes ---- */
    const glow = m.userData.engineGlow;
    const bk = clamp((this.speedFactor - 1) / 0.85, 0, 1);
    const brakeK = clamp((1 - this.speedFactor) / 0.5, 0, 1);
    const flicker = 0.92 + Math.sin(this.time * 42) * 0.08;
    const gs = flicker * (0.85 + (this.speedFactor - 0.5) * 0.72);
    glow.scale.setScalar(gs);
    const glows = m.userData.engineGlows;
    if (glows) for (const g of glows) g.material.color.setRGB(0.35 + 0.65 * bk, 0.86 + 0.14 * bk, 1.0);
    const petals = m.userData.enginePetals;
    if (petals) for (let i = 0; i < petals.length; i++) {
      const p = petals[i];
      p.rotation.z = Math.sin(this.time * 5.2 + i * Math.PI) * (0.05 + bk * 0.16);
      p.scale.setScalar(0.95 + bk * 0.18 - brakeK * 0.10);
    }
    if (m.userData.turbineRing) {
      m.userData.turbineRing.rotation.z += dt * (4.5 + bk * 11.0 - brakeK * 2.0);
    }
    const plumes = m.userData.enginePlumes;
    if (plumes) {
      const lenScale = (0.78 + bk * 1.05 - brakeK * 0.36) * (0.90 + Math.sin(this.time * 52) * 0.10);
      const radScale = 0.92 + bk * 0.25 - brakeK * 0.15;
      for (const pl of plumes) pl.scale.set(radScale, radScale, lenScale);
    }

    /* ---- Articulated aerospace flight surfaces: wing sweep flex, ailerons, air-brakes & weapon pod coils ---- */
    const rollInput = clamp(this.vx / 150, -1, 1);
    const pitchInput = clamp(this.vy / 115, -1, 1);
    if (m.userData.wingL && m.userData.wingR) {
      const baseZ = m.userData.wingL.userData.baseRotZ ?? 0.08;
      const flexZ = baseZ - bk * 0.14 + brakeK * 0.16;
      m.userData.wingL.rotation.z = damp(m.userData.wingL.rotation.z, flexZ, 8, dt);
      m.userData.wingR.rotation.z = damp(m.userData.wingR.rotation.z, -flexZ, 8, dt);
    }
    if (m.userData.flapL && m.userData.flapR) {
      m.userData.flapL.rotation.x = damp(m.userData.flapL.rotation.x, -pitchInput * 0.48 - rollInput * 0.52, 14, dt);
      m.userData.flapR.rotation.x = damp(m.userData.flapR.rotation.x, -pitchInput * 0.48 + rollInput * 0.52, 14, dt);
    }
    if (m.userData.airBrakes) {
      const brakeAngle = brakeK * 0.82;
      for (const ab of m.userData.airBrakes) {
        ab.rotation.x = damp(ab.rotation.x, brakeAngle, 12, dt);
        if (ab.userData.glowMat) ab.userData.glowMat.emissiveIntensity = 0.12 + brakeK * 2.4;
      }
    }
    if (m.userData.weaponPods) {
      const over = (game?.overdriveT ?? 0) > 0;
      const crimson = !!game?.build?.crimsonLasers;
      const podCol = over ? 0xffe466 : crimson ? 0xff5a80 : this.laserLevel >= 4 ? 0xffc844 : this.laserLevel >= 3 ? 0x59d4ff : this.laserLevel === 2 ? 0x54ffbe : 0x54ff9e;
      const recoilKick = this.recoilT > 0 ? 1.8 : 0;
      for (const wp of m.userData.weaponPods) {
        wp.coilMat.emissive.setHex(podCol);
        wp.coilMat.emissiveIntensity = 0.85 + this.laserLevel * 0.45 + (over ? 1.1 : 0) + recoilKick;
        wp.muzzle.material.color.setHex(podCol);
        wp.muzzle.scale.setScalar(0.55 + this.laserLevel * 0.14 + (this.recoilT > 0 ? 0.45 : 0));
      }
    }

    /* ---- Aerodynamic Mach shock-cone & periodic slipstream rings during Boost ---- */
    if (this.boostCone) {
      const coneOp = bk > 0.25 ? (bk - 0.25) / 0.75 * (0.20 + Math.sin(this.time * 28) * 0.04) : 0;
      this.boostCone.visible = coneOp > 0.01;
      if (this.boostCone.visible) {
        this.boostCone.material.opacity = coneOp;
        this.boostCone.rotation.z += dt * 4.5;
        this.boostCone.scale.set(0.95 + bk * 0.16, 0.80 + bk * 0.14, 0.92 + bk * 0.35);
      }
    }
    if (bk > 0.55 && game?.state === 'playing' && game.particles?.boostRing) {
      this._boostRingCd -= dt;
      if (this._boostRingCd <= 0) {
        this._boostRingCd = 0.20;
        game.particles.boostRing(this.x, this.y, PLAYER_Z + this.zShift + 2.5, 0x7beeff);
      }
    }

    /* ---- Live 3D Nose Charge-Shot Singularity Core + converging energy motes ---- */
    if (this.chargeFx) {
      const active = this.charging && this.charge > 0.02;
      this.chargeFx.group.visible = active;
      if (active) {
        const k = clamp(this.charge, 0, 1);
        const full = k >= 0.96;
        const sc = 0.28 + k * 0.95 + (full ? Math.sin(this.time * 32) * 0.14 : 0);
        this.chargeFx.group.scale.setScalar(sc);
        this.chargeFx.core.material.color.setHex(full ? 0xffffff : 0xb8f6ff);
        this.chargeFx.ringA.rotation.z += dt * (8 + k * 14);
        this.chargeFx.ringA.rotation.x += dt * 5;
        this.chargeFx.ringB.rotation.y -= dt * (10 + k * 16);
        this._chargeGatherCd -= dt;
        if (this._chargeGatherCd <= 0 && game?.particles?.chargeGather) {
          this._chargeGatherCd = 0.055;
          m.userData.noseAnchor.getWorldPosition(_v1);
          game.particles.chargeGather(_v1.x, _v1.y, _v1.z, k);
        }
      }
    }

    /* ---- trails with dynamic Mach & barrel-roll color shift ---- */
    const boostK = clamp((this.speedFactor - 1) / 0.85, 0, 1);
    const bankMag = clamp(Math.abs(this.vx) / 140, 0, 1);
    for (const tr of this.trails) {
      tr.tip.getWorldPosition(_v1);
      tr.hist.unshift({ x: _v1.x, y: _v1.y, z: _v1.z });
      if (tr.hist.length > TRAIL_LEN) tr.hist.pop();
      const pa = tr.mesh.geometry.attributes.position.array;
      const aa = tr.mesh.geometry.attributes.aAlpha.array;
      for (let i = 0; i < TRAIL_LEN; i++) {
        const p = tr.hist[Math.min(i, tr.hist.length - 1)];
        const w = 0.13 + (i / TRAIL_LEN) * (0.98 + boostK * 0.55);
        pa[i * 6] = p.x; pa[i * 6 + 1] = p.y - w / 2; pa[i * 6 + 2] = p.z + i * 1.15;
        pa[i * 6 + 3] = p.x; pa[i * 6 + 4] = p.y + w / 2; pa[i * 6 + 5] = p.z + i * 1.15;
        const a = 1 - i / TRAIL_LEN;
        aa[i * 2] = aa[i * 2 + 1] = a * a;
      }
      tr.mesh.geometry.attributes.position.needsUpdate = true;
      tr.mesh.geometry.attributes.aAlpha.needsUpdate = true;
      const col = tr.mesh.material.uniforms.uColor.value;
      if (this.rolling) col.setHex(0xc4ffff);
      else if ((game?.overdriveT ?? 0) > 0) col.setHex(0xffe472);
      else if (game?.build?.crimsonLasers) col.setHex(0xff9eb4);
      else if (boostK > 0.25) col.setRGB(0.56 + (1 - boostK) * 0.40, 0.94, 1.0);
      else col.setHex(0xf4fbff);
      tr.mesh.material.uniforms.uOpacity.value = 0.36 + boostK * 0.50 + bankMag * 0.18 + (this.rolling ? 0.30 : 0);
    }

    /* ---- Orbiting automated Interceptor Wingpods (point-defense & close support!) ---- */
    if (this.wingpods) {
      const podCount = game?.state === 'title' ? 0 : (game?.build?.wingpodCount ?? 0);
      for (let i = 0; i < this.wingpods.length; i++) {
        const pod = this.wingpods[i];
        const active = i < podCount;
        pod.group.visible = active;
        if (!active) continue;
        const ang = this.time * 2.6 + i * Math.PI;
        const ox = pod.side * (6.4 + Math.sin(ang) * 1.1);
        const oy = 1.65 + Math.cos(ang * 1.3) * 1.15;
        const oz = PLAYER_Z + this.zShift - 1.2 + Math.sin(ang * 0.8) * 0.9;
        pod.group.position.set(this.x + ox, this.y + oy, oz);
        pod.group.rotation.set(pitch * 0.7, 0, bank * 0.5);
        pod.ring.rotation.z += dt * (pod.side * 6.5);
        pod.ring.rotation.x = Math.sin(this.time * 3.5 + i) * 0.4;
      }
      if (podCount > 0 && game?.state === 'playing' && game.proj) {
        this._wingpodCd -= dt;
        if (this._wingpodCd <= 0) {
          const fired = this._fireWingpodSupport(podCount, game);
          this._wingpodCd = fired ? (podCount >= 2 ? 0.32 : 0.54) : 0.14;
        }
      }
    }

    /* ---- roll swirl fx ---- */
    for (let i = 0; i < this.rollArcs.length; i++) {
      const arc = this.rollArcs[i];
      if (this.rolling) {
        const k = 1 - this.rollT / this.rollDur;
        arc.material.opacity = Math.sin(k * Math.PI) * (0.68 - i * 0.12);
        arc.position.set(this.x, this.y, PLAYER_Z + this.zShift + 1);
        arc.rotation.z = this.rollAngle * (1.35 + i * 0.35) + i * 1.7;
        arc.scale.setScalar(0.62 + k * 0.96);
      } else arc.material.opacity = Math.max(0, arc.material.opacity - dt * 4.5);
    }

    /* ---- 3D Fresnel energy shield dome ---- */
    if (this.shieldFx) {
      const { group, shellMat, cageMat } = this.shieldFx;
      const rollK = this.rolling ? Math.sin((1 - this.rollT / this.rollDur) * Math.PI) : 0;
      const defK = this._deflectFlashT / 0.28;
      const dmgK = this._damageShieldT / 0.45;
      const opacity = Math.max(rollK * 0.56, defK * 0.95, dmgK * 0.85);
      if (opacity > 0.015) {
        group.visible = true;
        group.position.set(this.x, this.y, PLAYER_Z + this.zShift);
        group.rotation.set(this.time * 0.9, this.time * 1.5, this.rollAngle * 0.5);
        const sc = 1.0 + defK * 0.18 + dmgK * 0.10;
        group.scale.set(sc * 1.28, sc * 0.82, sc * 1.48);
        shellMat.uniforms.uTime.value = this.time;
        shellMat.uniforms.uOpacity.value = opacity;
        if (dmgK > defK && dmgK > rollK * 0.8) {
          shellMat.uniforms.uColor.value.setHex(0xff526c);
          cageMat.color.setHex(0xffa676);
        } else if (defK > 0.05) {
          shellMat.uniforms.uColor.value.setHex(0xa8fff6);
          cageMat.color.setHex(0xffffff);
        } else {
          shellMat.uniforms.uColor.value.setHex(0x66e8ff);
          cageMat.color.setHex(0xa8f5ff);
        }
        cageMat.opacity = clamp(opacity * (defK > 0.1 ? 0.85 : 0.42), 0, 0.85);
      } else {
        group.visible = false;
      }
    }

    /* ---- low-HP engine damage smoke & electrical sparks ---- */
    if (game?.state === 'playing' && game.hp < (game.maxHp ?? 100) * 0.30 && game.particles) {
      this._damageSmokeCd -= dt;
      if (this._damageSmokeCd <= 0) {
        this._damageSmokeCd = 0.085;
        const sx = this.x + rand(-1.6, 1.6);
        const sy = this.y + rand(-0.4, 0.7);
        const sz = PLAYER_Z + this.zShift + 3.2;
        game.particles.smoke(sx, sy, sz, 0.34, 0x2b2528);
        if (Math.random() < 0.55) {
          game.particles.emit(sx, sy, sz, {
            count: 2, speed: 12, vz: 26, color: 0xffc864, color2: 0xff5a28,
            life: 0.28, size: 1.5, drag: 1.6,
          });
        }
      }
    }
  }

  _fireWingpodSupport(podCount, game) {
    const pod = this.wingpods[(this._wingpodIdx = ((this._wingpodIdx ?? 0) + 1) % podCount)];
    const origin = pod.group.position;
    // Priority 1: Automated point-defense interception of nearby missiles & cluster shells!
    let threat = null, bestD = 96;
    for (const eb of game.proj.ebullets) {
      if (!eb.active || eb.deflected || (!eb.homing && !eb.shootable)) continue;
      const bp = eb.mesh.position;
      if (bp.z < -130 || bp.z > PLAYER_Z + 10) continue;
      const d = origin.distanceTo(bp);
      if (d < bestD) { bestD = d; threat = eb; }
    }
    if (threat) {
      const bp = threat.mesh.position;
      threat.active = false; threat.mesh.visible = false; threat.targetWingmate = null; threat.splitT = 0;
      game.addScore(15);
      game.particles?.flash?.(bp.x, bp.y, bp.z, 0.85, 0x86f6ff);
      game.particles?.sparks?.(bp.x, bp.y, bp.z, 0.8, 0x9ef6ff);
      game.particles?.ring?.(bp.x, bp.y, bp.z, { color: 0x76f4ff, radius: 6.5, dur: 0.22, opacity: 0.55 });
      game.hud?.killPop?.(game._toScreen(bp), 15, 'POD INTERCEPT!', 'intercept-pop');
      audio.hitTick();
      return true;
    }
    // Priority 2: Snap-fire supporting cyan pulse at close enemies or rival ahead
    let targetPos = null, bestEd = 175;
    if (game.enemies) {
      for (const e of game.enemies.list) {
        if (e.dying) continue;
        const ep = e.mesh.position;
        if (ep.z < -195 || ep.z > PLAYER_Z - 12) continue;
        const d = origin.distanceTo(ep);
        if (d < bestEd) { bestEd = d; targetPos = ep; }
      }
    }
    if (!targetPos && game.rival?.active && game.rival.hp > 0 && game.rival.pos.z < PLAYER_Z - 10) {
      targetPos = game.rival.pos;
    }
    if (targetPos) {
      game.proj.fireAlly(origin, targetPos, 0x72f8ff);
      game.particles?.laserMuzzle?.(origin.x, origin.y, origin.z - 1.5, 2);
      return true;
    }
    return false;
  }

  /* ---- aim helpers (tuned for close-quarters Star Fox combat) ---- */
  aimNear(out) { return out.set(this.x + this.vx * 0.065, this.y + this.vy * 0.075, PLAYER_Z - 48); }
  aimFar(out) { return out.set(this.x + this.vx * 0.13, this.y + this.vy * 0.14, PLAYER_Z - 110); }
  muzzle(out) { return out.set(this.x, this.y - 0.1, PLAYER_Z - 5.5); }

  setZoneBounds(zone) {
    const tight = zone.terrain === 'gorge' || zone.terrain === 'ember';
    this.bounds.x = tight ? 175 : 205;
    this.bounds.yMin = 3.4;
    this.bounds.yMax = tight ? 118 : 124;
    this.floorY = zone.floorY ?? 0;
  }
}
