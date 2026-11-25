import * as THREE from 'three';
import { buildArwing } from './shipFactory.js';
import { audio } from '../core/audio.js';
import { rand, pick, clamp, _v1, _v2 } from '../core/util.js';
import { PLAYER_Z } from './player.js';

/**
 * Escalating 2-Tier All-Range Rival Duel (Thorne):
 *  - Tier 1 (Wave 2): Crimson Ace — 2 phases, agile dogfighting, missiles, tail-dives & evasive barrel rolls.
 *  - Tier 2 (Wave 8+): Thorne MK-II "Crimson Phantom" — upgraded crimson overdrive aura,
 *    reactive Counter-Deflect Barrel Rolls (bounces rapid lasers right back at Bowie!),
 *    railgun snipes, twin boomerangs, cluster shells, swarm missiles & Phase-2 Crimson Wingmen!
 */
export class RivalDuel {
  constructor(scene, game) {
    this.scene = scene;
    this.game = game;
    this.mesh = buildArwing({ wing: 0xdc2848, darkWing: 0x161224, engine: 0xff3b52, variant: 'rival' });
    this.mesh.scale.setScalar(1.36);
    this.mesh.visible = false;
    scene.add(this.mesh);

    // 3D Crimson-Cyan Barrel-Roll Deflect Vortex Arcs (visible when Thorne rolls!)
    this.rollArcs = [];
    for (let i = 0; i < 3; i++) {
      const geo = new THREE.TorusGeometry(6.8 + i * 1.45, 0.56 - i * 0.1, 6, 26, Math.PI * 1.32);
      const mat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0xff4c74 : 0x8ef8ff,
        transparent: true, opacity: 0, depthWrite: false, fog: false,
        blending: THREE.AdditiveBlending,
      });
      const arc = new THREE.Mesh(geo, mat);
      arc.visible = false;
      scene.add(arc);
      this.rollArcs.push(arc);
    }

    // Tier-2 Crimson Overdrive energy ring around Thorne MK-II
    this.overdriveRing = new THREE.Mesh(
      new THREE.TorusGeometry(4.4, 0.22, 6, 24),
      new THREE.MeshBasicMaterial({
        color: 0xff3c68, transparent: true, opacity: 0.72,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
      })
    );
    this.overdriveRing.visible = false;
    this.mesh.add(this.overdriveRing);

    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3(0, 0, 40);
    this.wp = new THREE.Vector3();
    this.active = false;
    this.tier = 1;
    this.phase = 1;
    this.hp = 1; this.maxHp = 1;
    this.recoil = 0;
    this.rollT = 0; this.rollDur = 0.72; this.rollDir = 1; this.rollCd = 0;
    this.burstDmg = 0;
    this.railWindup = 0;
    this.attackIdx = 0;
    this.escortsSpawned = false;
    this._done = false;
    this._deflectMsgCd = 0;

    this.tauntsT1 = [
      "That the best you've got, Bowie?",
      "Too slow! You'll never hit me.",
      "Now you're on MY tail — big mistake.",
      "Come on, make it interesting!",
    ];
    this.tauntsT2 = [
      "Still firing straight? Watch me send it right back!",
      "My new MK-II reactor eats your lasers for breakfast!",
      "Charge shots won't save you now, Bowie!",
      "Crimson wingmen, box Skyblazer in!",
    ];
  }

  get rolling() { return this.rollT > 0; }

  start(tier = 1) {
    this.tier = tier >= 2 ? 2 : 1;
    this.active = true;
    this._done = false;
    this.phase = 1;
    this.hp = this.maxHp = this.tier >= 2 ? 440 : 190;
    this.pos.set(0, 28, -160);
    this.vel.set(0, 0, 44);
    this.mesh.visible = true;
    this.mesh.position.copy(this.pos);
    this.overdriveRing.visible = this.tier >= 2;
    this.wpT = 0;
    this.fireCd = this.tier >= 2 ? 1.15 : 1.35;
    this.tauntT = 4.6;
    this.flash = 0;
    this.tailWarn = 0;
    this.recoil = 0;
    this.rollT = 0;
    this.rollCd = this.tier >= 2 ? 2.4 : 3.2;
    this.burstDmg = 0;
    this.railWindup = 0;
    this.attackIdx = 0;
    this.escortsSpawned = false;
    this._deflectMsgCd = 0;
    this._newWaypoint();

    const title = this.tier >= 2 ? 'THORNE MK-II — CRIMSON PHANTOM' : 'THORNE — CRIMSON ACE';
    this.game.hud.showBoss(title, 2);
    this.game.hud.setBossPhase(1);
    this.game.hud.setBossHp(1);
    if (this.tier >= 2) {
      this.game.hud.say('THORNE', 'Miss me, Bowie? Let us test my MK-II deflector against your lasers!', 3.6);
    } else {
      this.game.hud.say('THORNE', 'Just you and me now, Bowie. Try to keep up!', 3.2);
    }
    audio.playTrack('boss');
  }

  end() {
    this.active = false;
    this.mesh.visible = false;
    this.overdriveRing.visible = false;
    this.rollT = 0;
    for (const arc of this.rollArcs) { arc.visible = false; arc.material.opacity = 0; }
    this.game.hud.hideBoss();
    this.game.hud.rivalMarker(null);
  }

  _triggerRoll(game) {
    this.rollDur = this.tier >= 2 ? 0.78 : 0.56;
    this.rollT = this.rollDur;
    this.rollDir = Math.random() < 0.5 ? -1 : 1;
    this.rollCd = this.tier >= 2 ? (this.phase >= 2 ? 3.8 : 4.6) : 5.4;
    this.burstDmg = 0;
    this.vel.x += this.rollDir * (this.tier >= 2 ? 75 : 55);
    audio.roll();
    if (this.tier >= 2 && this._deflectMsgCd <= 0) {
      this._deflectMsgCd = 6.5;
      game.hud?.alert?.('⚠ THORNE BARREL ROLL — CHARGE SHOT BREAKS IT!', 1.7);
    }
  }

  _newWaypoint() {
    const P = this.game.player;
    const p2 = this.phase >= 2;
    this.wpT = this.tier >= 2 ? rand(1.05, 1.85) : rand(1.25, 2.2);
    const tailChance = this.tier >= 2 ? (p2 ? 0.34 : 0.26) : (p2 ? 0.34 : 0.24);
    if (Math.random() < tailChance) {
      // Dive onto the player's six!
      this.wp.set(P.x + rand(-16, 16), P.y + rand(-6, 10), PLAYER_Z + rand(20, 38));
      this._tailing = true;
    } else {
      // High-G close-quarters dogfight passes across the cockpit!
      const spreadX = this.tier >= 2 ? 112 : 88;
      this.wp.set(clamp(P.x * 0.45 + rand(-spreadX, spreadX), -155, 155), rand(14, 78), rand(-148, -42));
      this._tailing = false;
    }
  }

  _spawnEscorts(game) {
    if (this.escortsSpawned || !game?.enemies) return;
    this.escortsSpawned = true;
    game.enemies.spawn('vanguard', { x: -115, y: 38, z: -155, side: -1, fireCd: 1.1 });
    game.enemies.spawn('harrier', { x: 115, y: 46, z: -165, side: 1, fireCd: 1.25 });
    game.hud.say('THORNE', 'Crimson Wing, flank Skyblazer — cut off his escape!', 3.2);
    game.hud.alert('⚠ CRIMSON ESCORTS INBOUND!', 1.8);
  }

  _fireArsenal(player, proj, game, onTail) {
    const P = player;
    const leadX = P.x + P.vx * 0.10;
    const leadY = P.y + P.vy * 0.08;
    _v1.set(leadX, leadY, PLAYER_Z).sub(this.pos);

    if (onTail) {
      proj.fireEnemy(this.pos.clone(), _v1.clone(), 'bolt', this.tier >= 2 ? 142 : 128);
      if (this.tier >= 2) {
        const off = _v1.clone(); off.x += rand(-10, 10); off.y += rand(-6, 6);
        proj.fireEnemy(this.pos.clone(), off, 'plasma');
      }
      return;
    }

    if (this.tier === 1) {
      const atk = this.attackIdx++ % 3;
      if (atk === 0) {
        // Twin aimed plasma bolts
        for (const s of [-1, 1]) {
          const orig = this.pos.clone(); orig.x += s * 3.8;
          _v1.set(leadX + s * 5, leadY, PLAYER_Z).sub(orig);
          proj.fireEnemy(orig, _v1.clone(), 'plasma');
        }
      } else if (atk === 1) {
        // Aimed rapid bolt + flanking shard
        proj.fireEnemy(this.pos.clone(), _v1.clone(), 'bolt');
        if (this.phase >= 2) {
          proj.fireEnemy(this.pos.clone(), _v1.clone().add(new THREE.Vector3(14, 0, 0)), 'shard');
          proj.fireEnemy(this.pos.clone(), _v1.clone().add(new THREE.Vector3(-14, 0, 0)), 'shard');
        }
      } else {
        // Homing ace missile (shootable or deflectable!)
        proj.fireEnemy(this.pos.clone(), _v1.clone(), this.phase >= 2 ? 'swarm' : 'missile');
      }
      return;
    }

    // ---- Tier 2 (MK-II Crimson Phantom) 5-attack Ace Arsenal! ----
    const atk = this.attackIdx++ % 5;
    if (atk === 0) {
      // Begin telegraphed Hypersonic Railgun Snipe!
      this.railWindup = 0.36;
      game.particles?.weaponTelegraph?.(this.pos.x, this.pos.y, this.pos.z + 4, 0xff4c78, 1.5);
      audio.alarm();
    } else if (atk === 1) {
      // Twin curving Boomerang wing-slicers!
      for (const s of [-1, 1]) {
        const orig = this.pos.clone(); orig.x += s * 5.2;
        _v1.set(leadX + s * 46, leadY + rand(-4, 4), PLAYER_Z).sub(orig);
        proj.fireEnemy(orig, _v1.clone(), 'boomerang', 102, null, { curveX: -s * 62 });
      }
    } else if (atk === 2) {
      // Airburst Cluster Shell + rapid bolt follow-up!
      proj.fireEnemy(this.pos.clone(), _v1.clone(), 'cluster');
      const off = _v1.clone(); off.x += rand(-12, 12);
      proj.fireEnemy(this.pos.clone(), off, 'bolt', 138);
    } else if (atk === 3) {
      // Twin Crimson Swarm Missiles!
      for (const s of [-1, 1]) {
        const orig = this.pos.clone(); orig.x += s * 4.5; orig.y += 1.2;
        _v1.set(leadX + s * 28, leadY + 12, PLAYER_Z).sub(orig);
        proj.fireEnemy(orig, _v1.clone(), 'swarm');
      }
    } else {
      // Three-round Ace Fan Plasma + Bolt center!
      for (const s of [-1, 0, 1]) {
        const orig = this.pos.clone(); orig.x += s * 3.5;
        _v1.set(leadX + s * 16, leadY, PLAYER_Z).sub(orig);
        proj.fireEnemy(orig, _v1.clone(), s === 0 ? 'bolt' : 'plasma');
      }
    }
  }

  update(dt, player, proj, game) {
    const P = player;
    this.wpT -= dt;
    if (this.wpT <= 0) this._newWaypoint();
    if (this.rollCd > 0) this.rollCd = Math.max(0, this.rollCd - dt);
    if (this._deflectMsgCd > 0) this._deflectMsgCd = Math.max(0, this._deflectMsgCd - dt);
    this.burstDmg = Math.max(0, this.burstDmg - dt * 5.5);

    // Phase 2 transition at 55% HP!
    if (this.phase === 1 && this.hp <= this.maxHp * 0.55) {
      this.phase = 2;
      game.hud.setBossPhase(2);
      game.hud.flash(0.38, 100);
      game.shake = Math.min(game.shake + 0.85, 1.9);
      audio.alarm();
      if (this.tier >= 2) {
        game.hud.alert('⚠ THORNE MK-II // CRIMSON OVERDRIVE!', 2.3);
        this._spawnEscorts(game);
      } else {
        game.hud.alert('⚠ THORNE // AFTERBURNER ENGAGED!', 2.0);
        game.hud.say('THORNE', "Alright, no more warming up. Let's see you dodge this!", 3.0);
      }
      this._triggerRoll(game);
    }

    // Steer smoothly toward current combat waypoint
    _v1.copy(this.wp).sub(this.pos);
    const dist = _v1.length();
    if (dist > 1) _v1.multiplyScalar(1 / dist);
    const baseSpd = this.tier >= 2 ? (this.phase >= 2 ? 122 : 108) : (this.phase >= 2 ? 104 : 90);
    const speed = this._tailing ? baseSpd + 16 : baseSpd;
    this.vel.lerp(_v1.multiplyScalar(speed), Math.min(1, dt * (this.tier >= 2 ? 3.1 : 2.6)));
    this.pos.addScaledVector(this.vel, dt);
    this.pos.x = clamp(this.pos.x, -175, 175);
    this.pos.y = clamp(this.pos.y, 7, 98);
    this.pos.z = clamp(this.pos.z, -210, PLAYER_Z + 48);
    this.mesh.position.copy(this.pos);
    _v2.copy(this.pos).add(this.vel);
    this.mesh.lookAt(_v2);

    // Roll animation & 3D vortex arcs
    let rollSpin = 0;
    if (this.rollT > 0) {
      this.rollT = Math.max(0, this.rollT - dt);
      const k = 1 - this.rollT / this.rollDur;
      rollSpin = this.rollDir * k * Math.PI * 2;
      for (let i = 0; i < this.rollArcs.length; i++) {
        const arc = this.rollArcs[i];
        arc.visible = true;
        arc.position.copy(this.pos);
        arc.rotation.z = rollSpin * (1.4 + i * 0.35) + i * 1.9;
        arc.material.opacity = Math.sin(k * Math.PI) * (0.76 - i * 0.14);
        arc.scale.setScalar(0.75 + k * 0.85);
      }
    } else {
      for (const arc of this.rollArcs) {
        if (arc.material.opacity > 0.01) {
          arc.material.opacity = Math.max(0, arc.material.opacity - dt * 5);
        } else {
          arc.visible = false;
        }
      }
    }

    this.recoil = Math.max(0, this.recoil - dt * 6);
    this.mesh.rotation.z += Math.sin(performance.now() * 0.004) * 0.2 + this.recoil * 0.28 + rollSpin;
    this.mesh.scale.setScalar(1.36 * (1 + this.recoil * 0.07));

    // Tier-2 Crimson Overdrive energy ring animation
    if (this.overdriveRing.visible) {
      this.overdriveRing.rotation.z += dt * (this.phase >= 2 ? 7.5 : 4.2);
      this.overdriveRing.rotation.x = Math.sin(performance.now() * 0.004) * 0.55;
      const pulse = 1.0 + Math.sin(performance.now() * 0.012) * (this.phase >= 2 ? 0.18 : 0.10);
      this.overdriveRing.scale.setScalar(pulse);
    }

    // Engine flicker + 3D plasma plumes
    const gg = this.mesh.userData.engineGlow;
    if (gg) gg.scale.setScalar((this.tier >= 2 ? 1.15 : 0.95) + Math.sin(performance.now() * 0.03) * 0.16);
    const plumes = this.mesh.userData.enginePlumes;
    if (plumes) {
      const len = (this.tier >= 2 ? 1.32 : 1.05) + Math.sin(performance.now() * 0.048) * 0.20;
      for (const pl of plumes) pl.scale.set(1.0, 1.0, len);
    }

    // On the player's tail → warn + fire from behind
    const onTail = this.pos.z > PLAYER_Z + 10;
    if (onTail) {
      this.tailWarn = 0.5;
      if (game.hud) game.hud.alert('⚠ ENEMY ON YOUR TAIL — ROLL!', 0.5);
    }

    // Telegraphed Tier-2 Hypersonic Railgun release!
    if (this.railWindup > 0) {
      this.railWindup -= dt;
      if (this.railWindup <= 0 && this.hp > 0) {
        _v1.set(P.x + P.vx * 0.05, P.y + P.vy * 0.05, PLAYER_Z).sub(this.pos);
        proj.fireEnemy(this.pos.clone(), _v1.clone(), 'rail');
        game.particles?.flash?.(this.pos.x, this.pos.y, this.pos.z + 3, 1.2, 0x72f4ff);
      }
    }

    // Fire weapons at the player
    this.fireCd -= dt;
    if (this.fireCd <= 0 && this.hp > 0 && !this.rolling) {
      const rateMul = this.phase >= 2 ? 0.80 : 1.0;
      this.fireCd = (onTail ? 0.68 : this.tier >= 2 ? rand(0.78, 1.22) : rand(0.88, 1.38)) * rateMul;
      this._fireArsenal(P, proj, game, onTail);
    }

    // Taunts
    this.tauntT -= dt;
    if (this.tauntT <= 0) {
      this.tauntT = rand(6, 9.5);
      game.hud.say('THORNE', pick(this.tier >= 2 ? this.tauntsT2 : this.tauntsT1), 2.6);
    }

    // ---- Player weapons vs Rival ----
    const R = 5.8;
    const armorPenBonus = game.build?.bossWeakMul ?? 1;
    for (const b of proj.lasers) {
      if (!b.active) continue;
      if (b.mesh.position.distanceTo(this.pos) < R + 1.9) {
        b.active = false; b.mesh.visible = false;
        if (this.rolling) {
          // Thorne's reactive Barrel Roll! Tier-2 deflects player lasers right back at Bowie!
          audio.deflect();
          game.particles.deflectBurst(this.pos.x, this.pos.y, this.pos.z);
          if (this.tier >= 2) {
            _v1.set(P.x + rand(-8, 8), P.y + rand(-5, 5), PLAYER_Z).sub(this.pos);
            proj.fireEnemy(this.pos.clone(), _v1.clone(), 'bolt', 138);
            game.hud.killPop(game._toScreen(this.pos), 0, 'DEFLECTED!', 'intercept-pop');
          }
          continue;
        }
        const dmg = b.dmg * (1 + (armorPenBonus - 1) * 0.65);
        this.burstDmg += dmg;
        this._hit(dmg, game);
        const rollThresh = this.tier >= 2 ? 14 : 20;
        if (this.burstDmg >= rollThresh && this.rollCd <= 0 && this.hp > 0) {
          this._triggerRoll(game);
        }
      }
    }

    // Player Charge Shots SHATTER Thorne's barrel roll & deal heavy stagger damage!
    for (const c of proj.charges) {
      if (!c.active) continue;
      if (c.mesh.position.distanceTo(this.pos) < R + 3.8) {
        c.active = false; c.mesh.visible = false;
        game.explodeAt(this.pos, true);
        const wasRolling = this.rolling;
        if (wasRolling) {
          this.rollT = 0;
          game.hud.killPop(game._toScreen(this.pos), 150, 'GUARD BREAK!', 'counter-kill');
          game.addScore(150);
        }
        const cDmg = Math.round((wasRolling ? 14 : 9) * (c.dmgMul ?? 1));
        this._hit(cDmg, game, true);
      }
    }

    // Deflected enemy bullets counter-hitting Thorne!
    for (const eb of proj.ebullets) {
      if (!eb.active || !eb.deflected) continue;
      if (eb.mesh.position.distanceTo(this.pos) < R + 3.4) {
        eb.active = false; eb.mesh.visible = false;
        this.rollT = 0;
        const cntDmg = Math.round(11 * (game.build?.reflectDmgMul ?? 1));
        this._hit(cntDmg, game, true);
        game.addScore(120);
        game.hud.killPop(game._toScreen(this.pos), 120, 'COUNTER!', 'counter-kill');
      }
    }

    // Smart Bombs blast Thorne hard & shatter his roll
    for (const b of proj.bombs) {
      if (!b.active) continue;
      if (b.mesh.position.distanceTo(this.pos) < R + 7) {
        this.rollT = 0;
        game._detonateBomb(b, false);
      }
    }

    // Ram collision
    _v1.set(P.x, P.y, PLAYER_Z);
    if (this.pos.distanceTo(_v1) < R + P.radius && P.invuln <= 0 && !P.rolling) {
      const ramPan = clamp((this.pos.x - P.x) / 10, -0.82, 0.82);
      game.damagePlayer(this.tier >= 2 ? 16 : 12, 'ram', { pan: ramPan });
      this.pos.z = PLAYER_Z - 32;
    }

    if (this.flash > 0) this.flash -= dt;
    game.hud.setBossHp(this.hp / this.maxHp);

    const s = game._toScreen(this.pos);
    game.hud.rivalMarker(s, this.flash > 0);

    if (this.hp <= 0) this._defeat(game);
  }

  _hit(dmg, game, heavy = false) {
    this.hp = Math.max(0, this.hp - dmg);
    this.flash = 0.09;
    this.recoil = heavy ? 1.45 : 1.0;
    audio.enemyHit(heavy ? 3 : 2, heavy);
    game.hud.hitConfirm?.(heavy);
    game.particles.laserImpact(this.pos.x, this.pos.y, this.pos.z, heavy ? 3 : 2, true);
  }

  /** Called by Game._areaDamage when a player Smart Bomb detonates nearby */
  takeBombDamage(dmg, game) {
    if (!this.active || this.hp <= 0) return;
    this.rollT = 0;
    this._hit(dmg, game, true);
  }

  _defeat(game) {
    if (this._done) return;
    this._done = true;
    const rewardScore = this.tier >= 2 ? 6000 : 2500;
    game.addScore(rewardScore);
    audio.stopMusic();
    // Fireworks
    let i = 0;
    const burst = setInterval(() => {
      game.explodeAt(_v1.set(this.pos.x + rand(-10, 10), this.pos.y + rand(-8, 8), this.pos.z + rand(-8, 8)), true);
      if (++i > 5) clearInterval(burst);
    }, 150);
    game.hud.flash(0.9, 200);
    if (this.tier >= 2) {
      game.hud.say('THORNE', "Tch… even my MK-II couldn't hold you! Take the overdrive core, Bowie — go win this war!", 3.8);
    } else {
      game.hud.say('THORNE', "Gah! You win this round, Bowie… next time I'll bring my real machine!", 3.4);
    }
    const defeatedTier = this.tier;
    setTimeout(() => {
      this.end();
      if (game.state === 'playing') game._rivalDefeated(defeatedTier);
    }, 1900);
  }
}
