import * as THREE from 'three';
import { buildArwing } from './shipFactory.js';
import { flightRoute } from '../world/terrain.js';
import { audio } from '../core/audio.js';
import { dotTexture, rand, pick, clamp, damp, TAU, _v1 } from '../core/util.js';
import { PLAYER_Z } from './player.js';

function routeAt(game, worldZ) {
  const zoneId = game?.zone?.id;
  const chunks = game?.terrain?.chunks;
  if (chunks && chunks.length) {
    for (let i = 0; i < chunks.length; i++) {
      const ch = chunks[i];
      const cz = ch.position.z;
      if (worldZ <= cz + 12 && worldZ >= cz - 312) {
        return flightRoute(zoneId, ch.userData.virtualZ + (worldZ - cz));
      }
    }
  }
  return { center: 0, halfWidth: 74 };
}

/* Star Fox-style wingmates — each with a distinct airframe variant, contrails,
 * and self-driving patrol AI flying visibly alongside the player in formation. */

const TRAIL_LEN = 18;

const TEAM = [
  { // VEGA — cobalt forward-swept hunter: low, fast, sweeps close across the front
    name: 'VEGA', variant: 'hunter', wing: 0x2b74e8, darkWing: 0x183c82, engine: 0x5ae0ff, color: 0x66d9ff, role: 'point',
    yBand: [10, 48], zBand: [-86, -34], xStyle: 'sweep', wpInt: [1.3, 2.4], pace: 2.8,
    weaveX: 12, weaveY: 5, weaveFx: 1.9, weaveFy: 2.3,
    engageChance: 0.80, fireGap: [0.42, 0.78], burstChance: 0.55,
    bombCd: [15, 24], special: 'barrage', specialCd: [12, 19],
  },
  { // NOVA — emerald twin-boom guardian: mid altitude, disciplined flank cover
    name: 'NOVA', variant: 'escort', wing: 0x2eb864, darkWing: 0x196838, engine: 0x7affb2, color: 0x8bffb0, role: 'escort',
    yBand: [12, 42], zBand: [-58, -20], xStyle: 'weave', wpInt: [1.8, 3.0], pace: 2.2,
    weaveX: 14, weaveY: 4, weaveFx: 1.1, weaveFy: 1.4,
    engageChance: 0.48, fireGap: [0.58, 1.05], burstChance: 0.34,
    bombCd: [20, 32], special: 'volley', specialCd: [15, 24],
  },
  { // KIT — golden gull-wing ace: high agile sweeps, dives & barrel-loop bomb runs
    name: 'KIT', variant: 'ace', wing: 0xebaa2c, darkWing: 0x996412, engine: 0xffe06b, color: 0xffd66b, role: 'cover',
    yBand: [26, 74], zBand: [-94, -40], xStyle: 'rove', wpInt: [1.2, 2.3], pace: 2.5,
    weaveX: 18, weaveY: 10, weaveFx: 1.2, weaveFy: 1.5,
    engageChance: 0.62, fireGap: [0.52, 0.95], burstChance: 0.52,
    bombCd: [10, 16], special: 'loopbomb', specialCd: [12, 18],
  },
];

const PORTRAITS = {
  VEGA: './assets/ui/portrait_vega.png',
  NOVA: './assets/ui/portrait_nova.png',
  KIT: './assets/ui/portrait_kit.png',
};

const COMMS = {
  ambient: {
    VEGA: [
      "I've got the left side. Keep your nose on the lead ship.",
      "Breaking high. I'll cut them off.",
      "Stay with me, Bowie — I've got a clean angle.",
      "They're trying to box us in. Not happening.",
    ],
    NOVA: [
      'Your six is clear for now.',
      "Formation's holding. Keep the pressure up.",
      "I've got the center lane covered.",
      "Easy does it. We're still in control.",
    ],
    KIT: [
      "I'm taking the high road — try to keep up!",
      'See that gap? Mine.',
      "I'll swing wide and meet you on the other side.",
      'That was close. Great flying, everyone.',
    ],
  },
  kill: {
    VEGA: ['Splash one. Who\'s next?', "That one's off your tail.", 'Clean hit — keep moving!', 'Bandit down. Stay on them.'],
    NOVA: ['Target neutralized. Your path is clear.', 'One less problem in the air.', 'Confirmed down. Stay on the route.', 'That threat is handled.'],
    KIT: ['Got one! That was a fun angle.', "Nice and tidy. Let's find another.", "He's gone. Did you catch that turn?", 'All clear on my side!'],
  },
  bombRun: {
    VEGA: ['Making a run. Clear the front!', 'Bomb out. Keep your distance.', "I'm cracking the formation open!"],
    NOVA: ['Dropping ordnance on the cluster. Give it room.', 'Marking the pack. Bomb away.', 'Opening a safe lane now.'],
    KIT: ['Big delivery coming through! Give me some space.', 'Looping in with a present.', "Heads up — this one's going to be loud!"],
  },
  barrage: {
    VEGA: ['Covering fire going out. Push through!', "I'm pinning them down — take the opening!", 'Barrage on the lead formation!'],
  },
  volley: {
    NOVA: ["I'm fanning the lane. Use the opening!", 'Screening fire out. Keep your line.', 'Cover volley deployed. Move while they scatter.'],
  },
  loopbomb: {
    KIT: ["Rolling over the top. Bomb's on the way!", 'Looping in now — keep clear below!', 'High pass, clean drop. Here we go!'],
  },
  danger: {
    VEGA: ["Bowie, I've got one glued to my tail!", "I'm tied up back here — shake this lancer!", 'Need a hand! Bandit on my six!'],
    NOVA: ["I'm taking fire. I need that pursuer cleared.", 'Hostile on my tail. Requesting cover.', 'I can hold for a moment — not much longer.'],
    KIT: ["Hey, I've got company back here!", "Can someone peel this guy off me?", "I'm dodging, but I could really use a hand!"],
  },
  rescued: {
    VEGA: ['Nice shot, Bowie. I owe you one.', 'That was close. You got there in time.', 'Tail is clear. Back in the fight!'],
    NOVA: ['Thank you. Rejoining formation now.', 'Pursuer destroyed. I am clear.', 'Good work. I have the lane again.'],
    KIT: ['Phew! Perfect timing!', 'You saved my paint job. Thanks!', "That's what I call teamwork!"],
  },
  retreat: {
    VEGA: ["I'm hit — breaking off before I lose the ship!", 'Taking damage. I am peeling away!', 'Too hot back here. I need a repair pass.'],
    NOVA: ["I'm losing power. Falling back to regroup.", 'Damage is climbing. I am withdrawing.', 'I need repairs. Cover the route without me.'],
    KIT: ["Okay, that's enough sparks for one day! Pulling back!", "I'm hurt — taking a quick repair loop.", "I'm heading out for a patch-up. Save some targets for me!"],
  },
  rejoin: {
    VEGA: ['Repairs are green. I am back in it!', 'I am rearmed and angry. Rejoining!', 'Back on your wing, Bowie.'],
    NOVA: ['Systems restored. Returning to formation.', 'Repairs complete. I have your flank again.', 'Back in position. Let us finish this.'],
    KIT: ['Fresh paint, full throttle — I am back!', 'All patched up! What did I miss?', 'Back in the sky. Let us make it count!'],
  },
};

class Wingmate {
  constructor(scene, def) {
    this.scene = scene;
    this.def = def;
    this.name = def.name;
    this.color = def.color;
    this.mesh = buildArwing({ wing: def.wing, darkWing: def.darkWing, engine: def.engine, variant: def.variant });
    // Peer-sized squadron fighters so ally craft read boldly alongside the player!
    this.mesh.scale.setScalar(0.96);
    scene.add(this.mesh);

    // Sleek, compact IFF portrait badge so it identifies the pilot without dwarfing the 3D craft.
    const portraitTexture = new THREE.TextureLoader().load(PORTRAITS[this.name]);
    portraitTexture.colorSpace = THREE.SRGBColorSpace;
    this.portraitRoundel = new THREE.Sprite(new THREE.SpriteMaterial({
      map: dotTexture(), color: this.color, transparent: true, opacity: 0.92,
      depthTest: false, depthWrite: false, fog: false,
    }));
    this.portraitRoundel.scale.set(10.5, 10.5, 1);
    this.portraitRoundel.position.set(0, 9.8, 0);
    this.portraitRoundel.renderOrder = 90;
    this.mesh.add(this.portraitRoundel);

    this.portrait = new THREE.Sprite(new THREE.SpriteMaterial({
      map: portraitTexture, color: 0xffffff, transparent: true,
      depthTest: false, depthWrite: false, fog: false,
    }));
    this.portrait.scale.set(8.2, 8.2, 1);
    this.portrait.position.set(0, 9.8, 0.1);
    this.portrait.renderOrder = 91;
    this.mesh.add(this.portrait);

    this.marker = new THREE.Sprite(new THREE.SpriteMaterial({
      map: dotTexture(), color: 0xff3b52, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }));
    this.marker.scale.setScalar(7.5);
    this.mesh.add(this.marker);
    this.marker.position.set(0, 4.8, 0);

    this._buildTrails();

    this.phase = rand(TAU);
    this.danger = 0; this.hidden = 0;
    this.state = 'form'; this.engageT = 0; this.fireCd = rand(0.4, 1.1);
    this.x = rand(-65, 65);
    this.y = clamp((def.yBand[0] + def.yBand[1]) / 2, 10, 72);
    this.z = PLAYER_Z + (def.zBand[0] + def.zBand[1]) / 2;
    this.wp = new THREE.Vector3(this.x, this.y, this.z);
    this.wpT = rand(0, 1.2);
    this.bombCd = rand(def.bombCd[0], def.bombCd[1]);
    this.specialCd = rand(def.specialCd[0], def.specialCd[1]) * 0.6;
    this._loopT = 0;
    this.hp = 100; this.maxHp = 100;
    this.damageCooldown = 0;
    this.damageFlash = 0;
    this.targetedBy = 0;
    this.lastDamage = '';
    this.lastComms = '';
    this.vx = 0; this.vy = 0; this.vz = 0;
    this._avoidBank = 0;
    this._burstQueue = [];
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
      const col = new THREE.Color(this.color).lerp(new THREE.Color(0xffffff), 0.68);
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
        uniforms: { uColor: { value: col }, uOpacity: { value: 0.42 } },
        vertexShader: `attribute float aAlpha; varying float vA; void main(){ vA = aAlpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying float vA; void main(){ gl_FragColor = vec4(uColor, vA * uOpacity); }`,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      this.scene.add(mesh);
      this.trails.push({ tip, mesh, hist: [] });
    }
  }

  _setTrailsVisible(v) {
    for (const tr of this.trails) {
      tr.mesh.visible = v;
      if (!v) tr.hist.length = 0;
    }
  }

  _updateTrails() {
    for (const tr of this.trails) {
      tr.mesh.visible = this.mesh.visible;
      if (!this.mesh.visible) continue;
      tr.tip.getWorldPosition(_v1);
      tr.hist.unshift({ x: _v1.x, y: _v1.y, z: _v1.z });
      if (tr.hist.length > TRAIL_LEN) tr.hist.pop();
      const pa = tr.mesh.geometry.attributes.position.array;
      const aa = tr.mesh.geometry.attributes.aAlpha.array;
      for (let i = 0; i < TRAIL_LEN; i++) {
        const p = tr.hist[Math.min(i, tr.hist.length - 1)];
        const w = 0.08 + (i / TRAIL_LEN) * 0.65;
        pa[i * 6] = p.x; pa[i * 6 + 1] = p.y - w / 2; pa[i * 6 + 2] = p.z + i * 1.15;
        pa[i * 6 + 3] = p.x; pa[i * 6 + 4] = p.y + w / 2; pa[i * 6 + 5] = p.z + i * 1.15;
        const a = 1 - i / TRAIL_LEN;
        aa[i * 2] = aa[i * 2 + 1] = a * a;
      }
      tr.mesh.geometry.attributes.position.needsUpdate = true;
      tr.mesh.geometry.attributes.aAlpha.needsUpdate = true;
    }
  }

  get pos() { return this.mesh.position; }

  comms(game, category, dur = 2.4) {
    const options = COMMS[category]?.[this.name] ?? [];
    if (!options.length) return '';
    const fresh = options.filter((line) => line !== this.lastComms);
    const text = pick(fresh.length ? fresh : options);
    this.lastComms = text;
    game.hud.say(this.name, text, dur);
    return text;
  }

  shotDown(game) {
    if (this.hidden > 0) return;
    this.danger = 0;
    this._burstQueue.length = 0;
    this.marker.material.opacity = 0;
    this.hidden = rand(8, 12);
    this.hp = 6;
    game.particles.explosion(this.x, this.y, this.z, false);
    this.comms(game, 'retreat', 2.8);
  }

  get statusState() {
    return this.hidden > 0 ? 'down' : this.danger > 0 ? 'danger' : this.targetedBy > 0 ? 'targeted' : 'ok';
  }

  takeDamage(amount, game, source = 'enemy') {
    if (this.hidden > 0 || this.damageCooldown > 0 || this.hp <= 0) return false;
    this.hp = Math.max(0, this.hp - Math.max(1, amount));
    this.damageCooldown = 0.22;
    this.damageFlash = 0.28;
    this.lastDamage = source;
    if (this.hp <= 0) this.shotDown(game);
    return true;
  }

  _target(enemies) {
    let best = null, bd = this.def.role === 'cover' ? 280 : 230;
    for (const e of enemies.list) {
      if (e.dying) continue;
      const ez = e.mesh.position.z;
      if (ez > this.z + 6 || ez < -360) continue;
      if (this.def.role === 'cover' && e.mesh.position.y < 18) continue;
      const d = Math.hypot(e.mesh.position.x - this.x, e.mesh.position.y - this.y) + Math.abs(ez - this.z) * 0.45;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  update(dt, player, enemies, proj, game) {
    // Pause-safe queued wingmate laser bursts
    for (let i = this._burstQueue.length - 1; i >= 0; i--) {
      const q = this._burstQueue[i];
      q.t -= dt;
      if (q.t <= 0) {
        this._burstQueue.splice(i, 1);
        if (this.hidden <= 0) q.fn();
      }
    }
    this.damageCooldown = Math.max(0, this.damageCooldown - dt);
    this.damageFlash = Math.max(0, this.damageFlash - dt);
    if (this.hidden > 0) this.hp = Math.min(this.maxHp, this.hp + 11 * dt);
    else if (this.danger <= 0 && this.targetedBy <= 0) this.hp = Math.min(this.maxHp, this.hp + 1.0 * dt);

    if (this.hidden > 0) {
      this.hidden -= dt;
      this.mesh.visible = false;
      this._setTrailsVisible(false);
      if (this.hidden <= 0) { this.mesh.visible = true; this.comms(game, 'rejoin', 2.4); }
      return;
    }
    this.mesh.visible = true;
    const t = performance.now() * 0.001;
    const d = this.def;

    if (this.state === 'form') {
      this.engageT -= dt;
      if (this.engageT <= 0) {
        this.engageT = rand(1.3, 3.0);
        if (this.danger <= 0 && Math.random() < d.engageChance) {
          this.engaged = this._target(enemies);
          if (this.engaged) { this.state = 'engage'; this.engageDur = rand(2.2, 3.8); }
        }
      }
    } else {
      this.engageDur -= dt;
      if (!this.engaged || !this.engaged.alive || this.engaged.dying || this.engageDur <= 0 || this.danger > 0) {
        this.state = 'form'; this.engaged = null;
      }
    }

    let tx, ty, tz, lag;
    const floorMin = Math.max(8.5, (game?.zone?.floorY ?? 0) + 8.5);
    if (this.state === 'engage' && this.engaged) {
      const ep = this.engaged.mesh.position;
      tx = clamp(ep.x + Math.sin(t * 3 + this.phase) * 14, -155, 155);
      ty = clamp(ep.y + (d.role === 'cover' ? 9 : rand(-2, 6)), floorMin, 92);
      tz = clamp(ep.z + 32, PLAYER_Z + d.zBand[0] - 20, PLAYER_Z - 8);
      lag = d.pace * 1.75;
    } else {
      this.wpT -= dt;
      if (this.wpT <= 0) { this.wpT = rand(d.wpInt[0], d.wpInt[1]); this._pickWaypoint(player, game); }
      tx = this.wp.x + Math.sin(t * d.weaveFx + this.phase) * d.weaveX;
      ty = clamp(this.wp.y + Math.sin(t * d.weaveFy + this.phase * 1.7) * d.weaveY, floorMin, 92);
      tz = this.wp.z + Math.sin(t * 0.7 + this.phase) * 6;
      lag = d.pace;
    }

    // ---- Predictive 3D obstacle avoidance (rocks, cliffs, arches, towers & artificial structures) ----
    let avoidX = 0, avoidY = 0, avoidWeight = 0;
    const route = routeAt(game, this.z);
    if (game?.forEachWorldObstacle) {
      game.forEachWorldObstacle((cx, cy, cz, rh, hy) => {
        const dzAhead = this.z - cz; // > 0 when obstacle is ahead approaching the wingmate
        if (dzAhead < -20 || dzAhead > 76) return;
        const padH = rh + 17.5;
        const dx = this.x - cx;
        const absDx = Math.abs(dx);
        if (absDx >= padH) return;
        const minY = cy - hy - 8.5;
        const maxY = cy + hy + 11.5;
        if (this.y < minY || this.y > maxY) return;

        const zUrg = dzAhead >= 0 ? clamp(1 - dzAhead / 76, 0.14, 1) : clamp(1 + dzAhead / 20, 0.08, 1);
        const xUrg = clamp(1 - absDx / padH, 0.10, 1);
        const w = zUrg * (0.45 + 0.55 * xUrg);
        const topClearY = cy + hy + 10.5;
        // Climb gracefully over low rocks/decks; bank sharply toward the open route around tall cliffs/towers.
        if (topClearY <= 92 && (this.y >= cy + hy * 0.22 || (topClearY - this.y) < 17)) {
          avoidY += (topClearY - this.y + 9.5) * w * 2.3;
          const slipDir = absDx > 2.5 ? Math.sign(dx) : (Math.sign(route.center - cx) || (this.phase > Math.PI ? 1 : -1));
          avoidX += slipDir * 14 * w;
        } else {
          const dir = absDx > 3.2 ? Math.sign(dx) : (Math.sign(route.center - cx) || (this.phase > Math.PI ? 1 : -1));
          avoidX += dir * (padH - absDx + 20) * w * 2.7;
          if (this.y < floorMin + 9) avoidY += 15 * w;
        }
        if (w > avoidWeight) avoidWeight = w;
      });
    }
    avoidX = clamp(avoidX, -145, 145);
    avoidY = clamp(avoidY, -46, 84);

    const baseMaxV = (52 + d.pace * 16) * (this.state === 'engage' ? 1.12 : 1);
    const maxV = baseMaxV * (1 + avoidWeight * 0.52);
    const resp = 5 + avoidWeight * 8.5;
    this.vx = damp(this.vx, clamp((tx - this.x) * lag + avoidX * 1.45, -maxV, maxV), resp, dt);
    this.vy = damp(this.vy, clamp((ty - this.y) * lag + avoidY * 1.45, -maxV * 0.82, maxV * 0.85), resp, dt);
    this.vz = damp(this.vz, clamp((tz - this.z) * lag, -baseMaxV * 0.6, baseMaxV * 0.6), 5, dt);
    this.x += this.vx * dt; this.y += this.vy * dt; this.z += this.vz * dt;

    // ---- Hard non-penetration safety net: allies NEVER clip through cliffs, rocks, ground or structures ----
    if (game?.forEachWorldObstacle) {
      game.forEachWorldObstacle((cx, cy, cz, rh, hy) => {
        const padY = hy + 3.8;
        if (Math.abs(this.y - cy) >= padY) return;
        const padR = rh + 5.2;
        const dx = this.x - cx;
        const dz = this.z - cz;
        if (Math.abs(dx) >= padR || Math.abs(dz) >= padR) return;
        const distSq = dx * dx + dz * dz;
        if (distSq >= padR * padR) return;
        if (this.y >= cy + hy * 0.42 && cy + padY <= 96) {
          this.y = cy + padY + 0.6;
          this.vy = Math.max(this.vy, 20);
        } else {
          const dirX = Math.abs(dx) > 0.4 ? Math.sign(dx) : (Math.sign(route.center - cx) || 1);
          const needX = Math.sqrt(Math.max(1, padR * padR - dz * dz)) + 1.4;
          this.x = clamp(cx + dirX * needX, -188, 188);
          this.vx = dirX * Math.max(Math.abs(this.vx), 48);
        }
      });
    }
    this.x = clamp(this.x, -188, 188);
    this.y = clamp(this.y, floorMin, 96);
    this.mesh.position.set(this.x, this.y, this.z);

    this._avoidBank = damp(this._avoidBank, clamp(-avoidX * 0.0095, -0.72, 0.72), 8, dt);
    const bank = clamp(-this.vx * 0.0075 + this._avoidBank, -1.18, 1.18) + Math.sin(t * 0.7 + this.phase) * 0.05;
    if (this._loopT > 0) this._loopT -= dt;
    const loop = this._loopT > 0 ? (1 - this._loopT / 0.9) * TAU : (d.role === 'cover' ? Math.sin(t * 0.4 + this.phase) * 0.35 : 0);
    this.mesh.rotation.set(clamp(this.vy * 0.0048, -0.48, 0.48), 0, bank + loop, 'ZYX');

    const gg = this.mesh.userData.engineGlow;
    if (gg) gg.scale.setScalar(0.88 + Math.sin(t * 8 + this.phase) * 0.1);
    const plumes = this.mesh.userData.enginePlumes;
    if (plumes) {
      const pLen = 0.85 + Math.sin(t * 44 + this.phase) * 0.14 + (this.state === 'engage' ? 0.25 : 0);
      for (const pl of plumes) pl.scale.set(0.9, 0.9, pLen);
    }

    this._updateTrails();

    this.fireCd -= dt;
    if (this.fireCd <= 0) {
      const tgt = this.engaged && this.engaged.alive && !this.engaged.dying ? this.engaged : this._target(enemies);
      if (tgt) {
        if (Math.random() < d.burstChance) {
          this.fireCd = rand(1.6, 2.5);
          this._burst(tgt.mesh.position, proj, 4 + (Math.random() * 3 | 0));
        } else {
          this.fireCd = rand(d.fireGap[0], d.fireGap[1]) * (this.state === 'engage' ? 0.72 : 1);
          _v1.copy(tgt.mesh.position); _v1.z -= 4;
          proj.fireAlly(this.mesh.position, _v1, this.color);
          audio.laser(1);
        }
      } else this.fireCd = rand(0.6, 1.1);
    }

    this.bombCd -= dt;
    if (this.bombCd <= 0) {
      const cluster = this._cluster(enemies);
      if (cluster) {
        this.bombCd = rand(d.bombCd[0], d.bombCd[1]);
        this.comms(game, 'bombRun', 2.0);
        game.allyBomb(cluster);
      } else this.bombCd = rand(2, 4);
    }

    this._trySpecial(dt, player, enemies, proj, game);

    if (this.danger > 0) {
      this.danger -= dt;
      this.marker.material.color.setHex(0xff3b52);
      this.marker.material.opacity = 0.65 + Math.sin(performance.now() * 0.02) * 0.35;
      if (this.danger <= 0) {
        this.marker.material.opacity = 0;
        this.hp = Math.max(0, this.hp - 14);
        if (this.hp <= 0) this.shotDown(game);
        else {
          this.hidden = rand(5, 7.5);
          game.particles.impact(this.x, this.y, this.z, 'heavy', 0.9);
          this.comms(game, 'retreat', 2.8);
        }
      }
    } else if (this.targetedBy > 0) {
      this.marker.material.color.setHex(0xffc55a);
      this.marker.material.opacity = 0.25 + Math.sin(performance.now() * 0.018) * 0.14;
    } else {
      this.marker.material.opacity = 0;
    }
    this.portraitRoundel.material.opacity = this.damageFlash > 0 ? 1 : 0.90;
  }

  _pickWaypoint(player, game) {
    const d = this.def;
    const tz = PLAYER_Z + rand(d.zBand[0], d.zBand[1]);
    const route = routeAt(game, tz);
    const playerAnchor = player ? clamp(player.x * 0.55, -80, 80) : route.center;
    const anchorX = playerAnchor * 0.62 + route.center * 0.38;
    let x;
    if (d.xStyle === 'sweep') x = anchorX + (this.wp.x >= anchorX ? -1 : 1) * rand(42, 92);
    else if (d.xStyle === 'rove') x = anchorX + rand(-96, 96);
    else x = clamp(this.wp.x + rand(-68, 68), anchorX - 84, anchorX + 84);
    const corridorHalf = Math.max(46, route.halfWidth + 14);
    x = clamp(x, route.center - corridorHalf, route.center + corridorHalf);
    x = clamp(x, -150, 150);
    const minY = Math.max(d.yBand[0], (game?.zone?.floorY ?? 0) + 9.5);
    this.wp.set(x, rand(minY, Math.max(minY + 8, d.yBand[1])), tz);
  }

  _burst(targetPos, proj, n) {
    const ax = targetPos.x, ay = targetPos.y, az = targetPos.z - 4;
    for (let k = 0; k < n; k++) {
      this._burstQueue.push({
        t: k * 0.07,
        fn: () => {
          _v1.set(ax + rand(-3, 3), ay + rand(-3, 3), az);
          proj.fireAlly(this.mesh.position, _v1, this.color);
          audio.laser(1);
        },
      });
    }
  }

  _trySpecial(dt, player, enemies, proj, game) {
    this.specialCd -= dt;
    if (this.specialCd > 0 || this.danger > 0 || this.hidden > 0) return;
    const d = this.def;
    if (d.special === 'barrage') {
      if (!this._target(enemies)) { this.specialCd = 2.5; return; }
      this.specialCd = rand(d.specialCd[0], d.specialCd[1]);
      this.comms(game, 'barrage', 2.2);
      for (let k = 0; k < 10; k++) {
        this._burstQueue.push({
          t: k * 0.055,
          fn: () => {
            _v1.set(player.x + rand(-40, 40), player.y + rand(-10, 26), PLAYER_Z - 110);
            proj.fireAlly(this.mesh.position, _v1, this.color);
            audio.laser(1);
          },
        });
      }
    } else if (d.special === 'volley') {
      this.specialCd = rand(d.specialCd[0], d.specialCd[1]);
      this.comms(game, 'volley', 2.2);
      audio.comms('targetEngaged', 0.18);
      for (let k = -3; k <= 3; k++) {
        _v1.set(this.mesh.position.x + k * 22, this.mesh.position.y + 6, this.mesh.position.z - 110);
        proj.fireAlly(this.mesh.position, _v1, this.color);
      }
      audio.laser(2);
    } else if (d.special === 'loopbomb') {
      const cluster = this._cluster(enemies);
      const tgt = cluster || _v1.set(player.x, player.y + 6, PLAYER_Z - 85).clone();
      this.specialCd = rand(d.specialCd[0], d.specialCd[1]);
      this._loopT = 0.9;
      this.comms(game, 'loopbomb', 2.2);
      game.allyBomb(tgt);
    }
  }

  _cluster(enemies) {
    const near = enemies.list.filter((e) => !e.dying && e.mesh.position.z > -250 && e.mesh.position.z < -50);
    if (near.length < 3) return null;
    let cx = 0, cy = 0, cz = 0;
    for (const e of near) { cx += e.mesh.position.x; cy += e.mesh.position.y; cz += e.mesh.position.z; }
    const n = near.length;
    const c = new THREE.Vector3(cx / n, cy / n, cz / n);
    let tight = 0;
    for (const e of near) if (e.mesh.position.distanceTo(c) < 46) tight++;
    return tight >= 3 ? c : null;
  }
}

export class Wingmates {
  constructor(scene, game) {
    this.scene = scene;
    this.game = game;
    this.list = TEAM.map((d) => new Wingmate(scene, d));
    this._killLineT = 0;
    this.reset();
  }

  reset() {
    this.chatTimer = rand(5, 9);
    this.eventTimer = rand(9, 14);
    for (const w of this.list) {
      w.danger = 0; w.hidden = 0; w.hp = w.maxHp; w._burstQueue.length = 0;
      w.damageCooldown = 0; w.damageFlash = 0; w.targetedBy = 0; w.lastDamage = ''; w.lastComms = '';
      w.marker.material.opacity = 0; w.mesh.visible = true; w.state = 'form'; w.engaged = null;
      w._setTrailsVisible(true);
    }
  }

  setVisible(v) {
    this._visible = v;
    for (const w of this.list) {
      const show = v && w.hidden <= 0;
      w.mesh.visible = show;
      w._setTrailsVisible(show);
    }
  }

  reportKill() {
    this._killLineT -= 0.016;
    if (this._killLineT <= 0 && Math.random() < 0.5) {
      this._killLineT = rand(3, 6);
      const available = this.list.filter((w) => w.hidden <= 0 && w.danger <= 0);
      if (available.length) pick(available).comms(this.game, 'kill', 2.2);
    }
  }

  onEnemyKilled(pos) {
    for (const w of this.list) {
      if (w.danger > 0 && w.hidden <= 0 && Math.hypot(pos.x - w.x, pos.y - w.y) < 48 && Math.abs(pos.z - w.z) < 75) {
        w.danger = 0;
        w.hp = Math.max(w.hp, 62);
        w.marker.material.opacity = 0;
        this.game.addScore(300);
        this.game.hud.callout('WINGMATE SAVED', '✈', '#8bffb0');
        w.comms(this.game, 'rescued', 2.8);
        audio.comms('targetDestroyed', 0.26);
        return;
      }
    }
  }

  update(dt, player, enemies, proj) {
    for (const w of this.list) w.update(dt, player, enemies, proj, this.game);

    this.game.hud.setWingStatus(this._visible
      ? this.list.map((w) => ({ name: w.name, color: w.color, hp: w.hp, maxHp: w.maxHp, state: w.statusState, targetedBy: w.targetedBy }))
      : null);

    this.chatTimer -= dt;
    if (this.chatTimer <= 0) {
      this.chatTimer = rand(10, 17);
      const available = this.list.filter((w) => w.hidden <= 0 && w.danger <= 0);
      if (available.length) pick(available).comms(this.game, 'ambient', 2.8);
    }

    this.eventTimer -= dt;
    if (this.eventTimer <= 0 && this.game.state === 'playing' && !this.game.boss && !this.game.rival?.active) {
      this.eventTimer = rand(10, 16);
      const avail = this.list.filter((w) => w.danger <= 0 && w.hidden <= 0);
      if (avail.length) {
        const w = pick(avail);
        w.danger = 8.5; w.state = 'form'; w.engaged = null;
        w.marker.material.opacity = 1;
        for (let i = 0; i < 2; i++) {
          const pursuer = enemies.spawn('lancer', {
            x: w.x + rand(-10, 10), y: w.y + rand(-4, 4), z: w.z - 28 - i * 12,
            speed: 0.72 + i * 0.05, fireCd: 0.35 + i * 0.18,
          });
          pursuer.forcedWingmate = w;
          pursuer.allyTarget = w;
          pursuer.allyTargetT = 9.0;
        }
        w.comms(this.game, 'danger', 3.0);
        audio.comms(Math.random() < 0.5 ? 'watchMyBack' : 'coverMe', 0.28);
        this.game.hud.alert('⚠ WINGMATE IN DANGER', 1.6);
      }
    }
  }
}
