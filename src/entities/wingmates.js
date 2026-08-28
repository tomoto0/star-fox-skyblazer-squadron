import * as THREE from 'three';
import { buildArwing } from './shipFactory.js';
import { audio } from '../core/audio.js';
import { dotTexture, rand, pick, clamp, damp, TAU, _v1 } from '../core/util.js';
import { PLAYER_Z } from './player.js';

/* Star Fox-style wingmates — each with a distinct self-driving AI. They hold
 * formation, break off to engage enemies with their own lasers (and the odd
 * bomb run), get chased ("on my tail!"), and can be rescued for a bonus. */

/* Each wingmate flies its OWN patrol — it roves the forward airspace on
 * autonomous waypoints (never mirroring the player's x/y), with a personality:
 *  - yBand/zBand: the altitude + depth band it prefers (z relative to PLAYER_Z)
 *  - xStyle: how it chooses lateral waypoints ('sweep' = cross to the far side,
 *            'weave' = drift around a zone, 'rove' = roam anywhere)
 *  - special: its signature move ('barrage' rapid stream / 'volley' cover fan /
 *            'loopbomb' looping bomb run)                                     */
const TEAM = [
  { // VEGA — hot-headed hunter: low, fast, screams across the field chasing kills
    name: 'VEGA', wing: 0x2f6fd6, engine: 0x66d9ff, color: 0x66d9ff, role: 'point',
    yBand: [8, 62], zBand: [-95, -40], xStyle: 'sweep', wpInt: [1.4, 2.6], pace: 2.7,
    weaveX: 10, weaveY: 5, weaveFx: 1.9, weaveFy: 2.4,
    engageChance: 0.78, fireGap: [0.4, 0.8], burstChance: 0.55,
    bombCd: [16, 26], special: 'barrage', specialCd: [13, 20],
  },
  { // NOVA — disciplined guardian: mid altitude, tight defensive weave, screens
    name: 'NOVA', wing: 0x35a85a, engine: 0x8bffb0, color: 0x8bffb0, role: 'escort',
    yBand: [10, 46], zBand: [-62, -18], xStyle: 'weave', wpInt: [2.0, 3.4], pace: 2.1,
    weaveX: 14, weaveY: 4, weaveFx: 1.0, weaveFy: 1.3,
    engageChance: 0.42, fireGap: [0.6, 1.1], burstChance: 0.3,
    bombCd: [22, 34], special: 'volley', specialCd: [16, 26],
  },
  { // KIT — playful ace: soars high, loops + dives, roams wide, loves bombs
    name: 'KIT', wing: 0xd8a53a, engine: 0xffd66b, color: 0xffd66b, role: 'cover',
    yBand: [42, 150], zBand: [-125, -48], xStyle: 'rove', wpInt: [1.3, 2.5], pace: 2.4,
    weaveX: 18, weaveY: 12, weaveFx: 1.1, weaveFy: 1.45,
    engageChance: 0.58, fireGap: [0.55, 1.0], burstChance: 0.5,
    bombCd: [10, 16], special: 'loopbomb', specialCd: [12, 19],
  },
];

const PORTRAITS = {
  VEGA: './assets/ui/portrait_vega.png',
  NOVA: './assets/ui/portrait_nova.png',
  KIT: './assets/ui/portrait_kit.png',
};

// Short, conversational radio calls. Every bank is speaker-specific so the
// player learns who is talking from the wording before looking at the portrait.
// Keep lines compact: the HUD types at 42 characters per second during combat.
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
    KIT: ['Big delivery coming through! Give me some space.', "Looping in with a present.", "Heads up — this one's going to be loud!"],
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
    this.mesh = buildArwing({ wing: def.wing, engine: def.engine });
    this.mesh.scale.setScalar(0.62);
    scene.add(this.mesh);

    // Always-visible visual IFF: a colored roundel and the pilot portrait ride above
    // each wingmate. Sprites face the camera, keeping friendly identity legible while
    // the aircraft banks, dives, and crosses the player's line of sight.
    const portraitTexture = new THREE.TextureLoader().load(PORTRAITS[this.name]);
    portraitTexture.colorSpace = THREE.SRGBColorSpace;
    this.portraitRoundel = new THREE.Sprite(new THREE.SpriteMaterial({
      map: dotTexture(), color: this.color, transparent: true, opacity: 0.96,
      depthTest: false, depthWrite: false, fog: false,
    }));
    this.portraitRoundel.scale.set(21, 21, 1);
    this.portraitRoundel.position.set(0, 20, 0);
    this.portraitRoundel.renderOrder = 90;
    this.mesh.add(this.portraitRoundel);

    this.portrait = new THREE.Sprite(new THREE.SpriteMaterial({
      map: portraitTexture, color: 0xffffff, transparent: true,
      depthTest: false, depthWrite: false, fog: false,
    }));
    this.portrait.scale.set(16, 16, 1);
    this.portrait.position.set(0, 20, 0.1);
    this.portrait.renderOrder = 91;
    this.mesh.add(this.portrait);

    // "help!" marker
    this.marker = new THREE.Sprite(new THREE.SpriteMaterial({
      map: dotTexture(), color: 0xff3b52, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }));
    this.marker.scale.setScalar(6);
    this.mesh.add(this.marker);
    this.marker.position.set(0, 5, 0);
    // muzzle (nose) glow so their shots read
    this.phase = rand(TAU);
    this.danger = 0; this.hidden = 0;
    this.state = 'form'; this.engageT = 0; this.fireCd = rand(0.4, 1.2);
    // start somewhere inside its own patrol band (not glued to the player)
    this.x = rand(-90, 90);
    this.y = clamp((def.yBand[0] + def.yBand[1]) / 2, 8, 160);
    this.z = PLAYER_Z + (def.zBand[0] + def.zBand[1]) / 2;
    this.wp = new THREE.Vector3(this.x, this.y, this.z);
    this.wpT = rand(0, 1.2);
    this.bombCd = rand(def.bombCd[0], def.bombCd[1]);
    this.specialCd = rand(def.specialCd[0], def.specialCd[1]) * 0.6;
    this._loopT = 0;
    this.hp = 100; this.maxHp = 100;
    // Combat damage is event-based and briefly rate-limited. This prevents a
    // dense burst from deleting one wingmate's HP in a single visual instant.
    this.damageCooldown = 0;
    this.damageFlash = 0;
    this.targetedBy = 0;
    this.lastDamage = '';
    this.lastComms = '';
    this.vx = 0; this.vy = 0; this.vz = 0;   // smooth flight velocity
  }

  get pos() { return this.mesh.position; }

  /** Say a speaker-specific line without immediately repeating the last call. */
  comms(game, category, dur = 2.4) {
    const options = COMMS[category]?.[this.name] ?? [];
    if (!options.length) return '';
    const fresh = options.filter((line) => line !== this.lastComms);
    const text = pick(fresh.length ? fresh : options);
    this.lastComms = text;
    game.hud.say(this.name, text, dur);
    return text;
  }

  /** knocked out of the fight — retreat, repair, rejoin */
  shotDown(game) {
    if (this.hidden > 0) return;
    this.danger = 0;
    this.marker.material.opacity = 0;
    this.hidden = rand(8, 12);
    this.hp = 6;
    game.particles.explosion(this.x, this.y, this.z, false);
    this.comms(game, 'retreat', 2.8);
  }
  /** 'down' (shot down / regrouping), 'danger' (bandit on tail), 'targeted', or 'ok' */
  get statusState() {
    return this.hidden > 0 ? 'down' : this.danger > 0 ? 'danger' : this.targetedBy > 0 ? 'targeted' : 'ok';
  }

  /** Receive a real enemy hit; returns true only when damage was accepted. */
  takeDamage(amount, game, source = 'enemy') {
    if (this.hidden > 0 || this.damageCooldown > 0 || this.hp <= 0) return false;
    this.hp = Math.max(0, this.hp - Math.max(1, amount));
    this.damageCooldown = 0.22;
    this.damageFlash = 0.28;
    this.lastDamage = source;
    if (this.hp <= 0) this.shotDown(game);
    return true;
  }

  /** pick the nearest engageable enemy ahead of this wingmate */
  _target(enemies) {
    let best = null, bd = this.def.role === 'cover' ? 320 : 260;
    for (const e of enemies.list) {
      const ez = e.mesh.position.z;
      if (ez > this.z + 6 || ez < -600) continue;              // must be ahead
      if (this.def.role === 'cover' && e.mesh.position.y < 26) continue; // KIT prefers high targets
      const d = Math.hypot(e.mesh.position.x - this.x, e.mesh.position.y - this.y) + Math.abs(ez - this.z) * 0.4;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  update(dt, player, enemies, proj, game) {
    // HP changes only from actual impacts or the explicit unresolved rescue
    // consequence below. A tail warning must not silently drain 15 HP/s.
    this.damageCooldown = Math.max(0, this.damageCooldown - dt);
    this.damageFlash = Math.max(0, this.damageFlash - dt);
    if (this.hidden > 0) this.hp = Math.min(this.maxHp, this.hp + 11 * dt);
    else if (this.danger <= 0 && this.targetedBy <= 0) this.hp = Math.min(this.maxHp, this.hp + 1.0 * dt);

    if (this.hidden > 0) {
      this.hidden -= dt;
      this.mesh.visible = false;
      if (this.hidden <= 0) { this.mesh.visible = true; this.comms(game, 'rejoin', 2.4); }
      return;
    }
    this.mesh.visible = true;
    const t = performance.now() * 0.001;
    const d = this.def;

    // ---- decide state ----
    if (this.state === 'form') {
      this.engageT -= dt;
      if (this.engageT <= 0) {
        this.engageT = rand(1.5, 3.5);
        if (this.danger <= 0 && Math.random() < d.engageChance) {
          this.engaged = this._target(enemies);
          if (this.engaged) { this.state = 'engage'; this.engageDur = rand(2.2, 4.0); }
        }
      }
    } else { // engage
      this.engageDur -= dt;
      if (!this.engaged || !this.engaged.alive || this.engageDur <= 0 || this.danger > 0) {
        this.state = 'form'; this.engaged = null;
      }
    }

    // ---- movement target: OWN patrol waypoints (never mirrors the player) ----
    let tx, ty, tz, lag;
    if (this.state === 'engage' && this.engaged) {
      // dive onto the bandit's lane and press the attack
      const ep = this.engaged.mesh.position;
      tx = clamp(ep.x + Math.sin(t * 3 + this.phase) * 12, -245, 245);
      ty = clamp(ep.y + (d.role === 'cover' ? 10 : rand(-2, 6)), 8, 168);
      tz = clamp(ep.z + 34, PLAYER_Z + d.zBand[0] - 30, PLAYER_Z - 8);
      lag = d.pace * 1.7;
    } else {
      // roam its own patrol band; pick a fresh autonomous waypoint on a timer
      this.wpT -= dt;
      if (this.wpT <= 0) { this.wpT = rand(d.wpInt[0], d.wpInt[1]); this._pickWaypoint(); }
      tx = this.wp.x + Math.sin(t * d.weaveFx + this.phase) * d.weaveX;
      ty = clamp(this.wp.y + Math.sin(t * d.weaveFy + this.phase * 1.7) * d.weaveY, 6, 175);
      tz = this.wp.z + Math.sin(t * 0.7 + this.phase) * 6;
      lag = d.pace;
    }
    // steer like a real plane: capped speed + smooth acceleration — the ship
    // TRAVELS to distant waypoints instead of exponential-snapping onto them
    const maxV = (48 + d.pace * 15) * (this.state === 'engage' ? 1.1 : 1);
    this.vx = damp(this.vx, clamp((tx - this.x) * lag, -maxV, maxV), 5, dt);
    this.vy = damp(this.vy, clamp((ty - this.y) * lag, -maxV * 0.75, maxV * 0.75), 5, dt);
    this.vz = damp(this.vz, clamp((tz - this.z) * lag, -maxV * 0.6, maxV * 0.6), 5, dt);
    this.x += this.vx * dt; this.y += this.vy * dt; this.z += this.vz * dt;
    this.mesh.position.set(this.x, this.y, this.z);

    // bank from actual velocity; KIT (and anyone mid-special) rolls through loops
    const bank = clamp(-this.vx * 0.0065, -0.95, 0.95) + Math.sin(t * 0.7 + this.phase) * 0.05;
    if (this._loopT > 0) this._loopT -= dt;
    const loop = this._loopT > 0 ? (1 - this._loopT / 0.9) * TAU : (d.role === 'cover' ? Math.sin(t * 0.4 + this.phase) * 0.35 : 0);
    this.mesh.rotation.set(clamp(this.vy * -0.004, -0.5, 0.5), 0, bank + loop, 'ZYX');
    const gg = this.mesh.userData.engineGlow;
    if (gg) gg.scale.setScalar(0.85 + Math.sin(t * 6 + this.phase) * 0.08);

    // ---- firing: aimed shots, with the occasional rapid-fire burst ----
    this.fireCd -= dt;
    if (this.fireCd <= 0) {
      const tgt = this.engaged && this.engaged.alive ? this.engaged : this._target(enemies);
      if (tgt) {
        if (Math.random() < d.burstChance) {
          this.fireCd = rand(1.6, 2.6);
          this._burst(tgt.mesh.position, proj, 5 + (Math.random() * 3 | 0));
        } else {
          this.fireCd = rand(d.fireGap[0], d.fireGap[1]) * (this.state === 'engage' ? 0.7 : 1);
          _v1.copy(tgt.mesh.position); _v1.z -= 4;
          proj.fireAlly(this.mesh.position, _v1, this.color);
          audio.laser(1);
        }
      } else this.fireCd = rand(0.6, 1.1);
    }

    // ---- bomb run: any ally will drop a bomb on a dense cluster ----
    this.bombCd -= dt;
    if (this.bombCd <= 0) {
      const cluster = this._cluster(enemies);
      if (cluster) {
        this.bombCd = rand(d.bombCd[0], d.bombCd[1]);
        this.comms(game, 'bombRun', 2.0);
        game.allyBomb(cluster);
      } else this.bombCd = rand(2, 4);
    }

    // ---- signature special attack ----
    this._trySpecial(dt, player, enemies, proj, game);

    // ---- threat and enemy-lock markers ----
    if (this.danger > 0) {
      this.danger -= dt;
      this.marker.material.color.setHex(0xff3b52);
      this.marker.material.opacity = 0.6 + Math.sin(performance.now() * 0.02) * 0.4;
      if (this.danger <= 0) {
        // Ignoring a rescue call causes a controlled retreat, not an invisible
        // 112.5-HP drain. Direct hits remain the principal source of damage.
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
      this.marker.material.opacity = 0.22 + Math.sin(performance.now() * 0.018) * 0.12;
    } else {
      this.marker.material.opacity = 0;
    }
    this.portraitRoundel.material.opacity = this.damageFlash > 0 ? 1 : 0.96;
  }

  /** choose the next autonomous patrol waypoint in this pilot's own style */
  _pickWaypoint() {
    const d = this.def;
    let x;
    if (d.xStyle === 'sweep') x = (this.wp.x >= 0 ? -1 : 1) * rand(110, 235);     // cross to the far side
    else if (d.xStyle === 'rove') x = rand(-215, 215);                            // roam anywhere
    else x = clamp(this.wp.x + rand(-130, 130), -190, 190);                       // weave around a zone
    this.wp.set(x, rand(d.yBand[0], d.yBand[1]), PLAYER_Z + rand(d.zBand[0], d.zBand[1]));
  }

  /** rapid-fire burst of aimed shots */
  _burst(targetPos, proj, n) {
    const aim = targetPos.clone(); aim.z -= 4;
    for (let k = 0; k < n; k++) setTimeout(() => {
      if (this.hidden > 0) return;
      _v1.copy(aim); _v1.x += rand(-3, 3); _v1.y += rand(-3, 3);
      proj.fireAlly(this.mesh.position, _v1, this.color);
      audio.laser(1);
    }, k * 70);
  }

  /** signature special on a long cooldown: barrage / cover-volley / loop-bomb */
  _trySpecial(dt, player, enemies, proj, game) {
    this.specialCd -= dt;
    if (this.specialCd > 0 || this.danger > 0 || this.hidden > 0) return;
    const d = this.def;
    if (d.special === 'barrage') {
      if (!this._target(enemies)) { this.specialCd = 2.5; return; }               // only when there's work
      this.specialCd = rand(d.specialCd[0], d.specialCd[1]);
      this.comms(game, 'barrage', 2.2);
      for (let k = 0; k < 12; k++) setTimeout(() => {
        if (this.hidden > 0) return;
        _v1.set(player.x + rand(-45, 45), player.y + rand(-12, 34), PLAYER_Z - 120);
        proj.fireAlly(this.mesh.position, _v1, this.color); audio.laser(1);
      }, k * 55);
    } else if (d.special === 'volley') {
      this.specialCd = rand(d.specialCd[0], d.specialCd[1]);
      this.comms(game, 'volley', 2.2);
      audio.comms('targetEngaged', 0.18);
      for (let k = -3; k <= 3; k++) {
        _v1.set(this.mesh.position.x + k * 26, this.mesh.position.y + 8, this.mesh.position.z - 120);
        proj.fireAlly(this.mesh.position, _v1.clone(), this.color);
      }
      audio.laser(2);
    } else if (d.special === 'loopbomb') {
      const cluster = this._cluster(enemies);
      const tgt = cluster || _v1.set(player.x, player.y + 6, PLAYER_Z - 90).clone();
      this.specialCd = rand(d.specialCd[0], d.specialCd[1]);
      this._loopT = 0.9;   // barrel-loop flourish
      this.comms(game, 'loopbomb', 2.2);
      game.allyBomb(tgt);
    }
  }

  /** centre of a 3+ enemy cluster ahead, else null */
  _cluster(enemies) {
    const near = enemies.list.filter((e) => e.mesh.position.z > -360 && e.mesh.position.z < -60);
    if (near.length < 3) return null;
    let cx = 0, cy = 0, cz = 0;
    for (const e of near) { cx += e.mesh.position.x; cy += e.mesh.position.y; cz += e.mesh.position.z; }
    const n = near.length;
    // only if they're actually clustered (spread not too wide)
    const c = new THREE.Vector3(cx / n, cy / n, cz / n);
    let tight = 0;
    for (const e of near) if (e.mesh.position.distanceTo(c) < 40) tight++;
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
      w.danger = 0; w.hidden = 0; w.hp = w.maxHp;
      w.damageCooldown = 0; w.damageFlash = 0; w.targetedBy = 0; w.lastDamage = ''; w.lastComms = '';
      w.marker.material.opacity = 0; w.mesh.visible = true; w.state = 'form'; w.engaged = null;
    }
  }

  setVisible(v) { this._visible = v; for (const w of this.list) w.mesh.visible = v && w.hidden <= 0; }

  reportKill() {
    // occasional radio boast when an ally scores
    this._killLineT -= 0.016;
    if (this._killLineT <= 0 && Math.random() < 0.5) {
      this._killLineT = rand(3, 6);
      const available = this.list.filter((w) => w.hidden <= 0 && w.danger <= 0);
      if (available.length) pick(available).comms(this.game, 'kill', 2.2);
    }
  }

  onEnemyKilled(pos) {
    for (const w of this.list) {
      if (w.danger > 0 && w.hidden <= 0 && Math.hypot(pos.x - w.x, pos.y - w.y) < 40 && Math.abs(pos.z - w.z) < 70) {
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

    // push a compact status readout to the HUD
    this.game.hud.setWingStatus(this._visible
      ? this.list.map((w) => ({ name: w.name, color: w.color, hp: w.hp, maxHp: w.maxHp, state: w.statusState, targetedBy: w.targetedBy }))
      : null);

    // idle chatter
    this.chatTimer -= dt;
    if (this.chatTimer <= 0) {
      this.chatTimer = rand(10, 17);
      const available = this.list.filter((w) => w.hidden <= 0 && w.danger <= 0);
      if (available.length) pick(available).comms(this.game, 'ambient', 2.8);
    }

    // rescue event: a wingmate gets an enemy on its tail
    this.eventTimer -= dt;
    if (this.eventTimer <= 0 && this.game.state === 'playing' && !this.game.boss && !this.game.rival?.active) {
      this.eventTimer = rand(10, 16);
      const avail = this.list.filter((w) => w.danger <= 0 && w.hidden <= 0);
      if (avail.length) {
        const w = pick(avail);
        w.danger = 8.5; w.state = 'form'; w.engaged = null;
        w.marker.material.opacity = 1;
        // A paired tail section turns the warning into real, visible combat pressure.
        for (let i = 0; i < 2; i++) {
          const pursuer = enemies.spawn('lancer', {
            x: w.x + rand(-10, 10), y: w.y + rand(-4, 4), z: w.z - 30 - i * 12,
            speed: 0.76 + i * 0.05, fireCd: 0.3 + i * 0.18,
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
