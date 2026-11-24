import * as THREE from 'three';
import { buildArwing } from './shipFactory.js';
import { audio } from '../core/audio.js';
import { rand, pick, clamp, damp, _v1, _v2 } from '../core/util.js';
import { PLAYER_Z } from './player.js';

/**
 * All-Range-style rival duel. The rival Arwing (Thorne) flies freely through
 * and around the arena — swooping in front, looping away off-screen, and
 * dropping onto the player's tail (barrel-roll to shake). An off-screen
 * indicator tracks it. Defeat it to win the duel.
 */
export class RivalDuel {
  constructor(scene, game) {
    this.scene = scene;
    this.game = game;
    this.mesh = buildArwing({ wing: 0xdc2848, darkWing: 0x161224, engine: 0xff3b52, variant: 'rival' });
    this.mesh.scale.setScalar(1.36);
    this.mesh.visible = false;
    scene.add(this.mesh);
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3(0, 0, 40);
    this.wp = new THREE.Vector3();
    this.active = false;
    this.hp = 1; this.maxHp = 1;
    this.recoil = 0;
    this.taunts = [
      "That the best you've got, Bowie?",
      "Too slow! You'll never hit me.",
      "Now you're on MY tail — big mistake.",
      "Come on, make it interesting!",
    ];
  }

  start() {
    this.active = true;
    this.hp = this.maxHp = 100;
    this.pos.set(0, 26, -155);
    this.vel.set(0, 0, 40);
    this.mesh.visible = true;
    this.mesh.position.copy(this.pos);
    this.wpT = 0; this.fireCd = 1.4; this.tauntT = 5; this.flash = 0; this.tailWarn = 0; this.recoil = 0;
    this._newWaypoint();
    this.game.hud.showBoss('THORNE — RIVAL', 1);
    this.game.hud.setBossHp(1);
    this.game.hud.say('THORNE', 'Just you and me now, Bowie. Try to keep up!', 3.2);
    audio.playTrack('boss');
  }

  end() {
    this.active = false;
    this.mesh.visible = false;
    this.game.hud.hideBoss();
    this.game.hud.rivalMarker(null);
  }

  _newWaypoint() {
    const P = this.game.player;
    this.wpT = rand(1.3, 2.3);
    if (Math.random() < 0.30) {
      // dive onto the player's tail
      this.wp.set(P.x + rand(-14, 14), P.y + rand(-6, 10), PLAYER_Z + rand(20, 38));
      this._tailing = true;
    } else {
      // tight close-quarters dogfight passes right in front of the cockpit!
      this.wp.set(clamp(P.x * 0.45 + rand(-88, 88), -145, 145), rand(14, 72), rand(-142, -40));
      this._tailing = false;
    }
  }

  update(dt, player, proj, game) {
    const P = player;
    this.wpT -= dt;
    if (this.wpT <= 0) this._newWaypoint();

    // steer toward the waypoint (smooth), keep a lively speed
    _v1.copy(this.wp).sub(this.pos);
    const dist = _v1.length();
    if (dist > 1) _v1.multiplyScalar(1 / dist);
    const speed = this._tailing ? 105 : 88;
    this.vel.lerp(_v1.multiplyScalar(speed), Math.min(1, dt * 2.6));
    this.pos.addScaledVector(this.vel, dt);
    this.pos.x = clamp(this.pos.x, -175, 175);
    this.pos.y = clamp(this.pos.y, 7, 98);
    this.pos.z = clamp(this.pos.z, -210, PLAYER_Z + 48);
    this.mesh.position.copy(this.pos);
    _v2.copy(this.pos).add(this.vel);
    this.mesh.lookAt(_v2);
    this.recoil = Math.max(0, this.recoil - dt * 6);
    this.mesh.rotation.z += Math.sin(performance.now() * 0.004) * 0.2 + this.recoil * 0.28;
    this.mesh.scale.setScalar(1.36 * (1 + this.recoil * 0.07));

    // engine flicker + 3D plasma plumes
    const gg = this.mesh.userData.engineGlow;
    if (gg) gg.scale.setScalar(0.95 + Math.sin(performance.now() * 0.03) * 0.14);
    const plumes = this.mesh.userData.enginePlumes;
    if (plumes) {
      const len = 1.05 + Math.sin(performance.now() * 0.048) * 0.18;
      for (const pl of plumes) pl.scale.set(1.0, 1.0, len);
    }

    // on the player's tail → warn + fire from behind
    const onTail = this.pos.z > PLAYER_Z + 10;
    if (onTail) {
      this.tailWarn = 0.5;
      if (game.hud) game.hud.alert('⚠ ENEMY ON YOUR TAIL — ROLL!', 0.5);
    }

    // fire at the player
    this.fireCd -= dt;
    if (this.fireCd <= 0 && this.hp > 0) {
      this.fireCd = onTail ? 0.72 : rand(0.9, 1.45);
      _v1.set(P.x + P.vx * 0.08, P.y + P.vy * 0.06, PLAYER_Z).sub(this.pos);
      proj.fireEnemy(this.pos.clone(), _v1.clone(), onTail ? 'bolt' : 'plasma');
    }

    // taunts
    this.tauntT -= dt;
    if (this.tauntT <= 0) { this.tauntT = rand(6, 10); game.hud.say('THORNE', pick(this.taunts), 2.6); }

    // ---- player weapons vs rival ----
    const R = 5.6;
    for (const b of proj.lasers) {
      if (!b.active) continue;
      if (b.mesh.position.distanceTo(this.pos) < R + 1.8) {
        b.active = false; b.mesh.visible = false;
        this._hit(b.dmg, game);
      }
    }
    for (const c of proj.charges) {
      if (!c.active) continue;
      if (c.mesh.position.distanceTo(this.pos) < R + 3.5) { c.active = false; c.mesh.visible = false; game.explodeAt(this.pos, true); this._hit(6, game); }
    }
    for (const b of proj.bombs) {
      if (!b.active) continue;
      if (b.mesh.position.distanceTo(this.pos) < R + 6) game._detonateBomb(b, false);
    }

    // ram
    _v1.set(P.x, P.y, PLAYER_Z);
    if (this.pos.distanceTo(_v1) < R + P.radius && P.invuln <= 0 && !P.rolling) {
      game.damagePlayer(12, 'ram');
      this.pos.z = PLAYER_Z - 32;
    }

    if (this.flash > 0) { this.flash -= dt; }
    game.hud.setBossHp(this.hp / this.maxHp);

    const s = game._toScreen(this.pos);
    game.hud.rivalMarker(s, this.flash > 0);

    if (this.hp <= 0) this._defeat(game);
  }

  _hit(dmg, game) {
    this.hp = Math.max(0, this.hp - dmg);
    this.flash = 0.09;
    this.recoil = 1.0;
    audio.enemyHit(2);
    game.hud.hitConfirm?.();
    game.particles.laserImpact(this.pos.x, this.pos.y, this.pos.z, 2, true);
  }

  _defeat(game) {
    if (this._done) return;
    this._done = true;
    game.addScore(2500);
    audio.stopMusic();
    // fireworks
    let i = 0;
    const burst = setInterval(() => {
      game.explodeAt(_v1.set(this.pos.x + rand(-10, 10), this.pos.y + rand(-8, 8), this.pos.z + rand(-8, 8)), true);
      if (++i > 5) clearInterval(burst);
    }, 150);
    game.hud.flash(0.9, 200);
    game.hud.say('THORNE', "Gah! You win this round, Bowie… we'll meet again!", 3.4);
    setTimeout(() => { this.end(); game._rivalDefeated(); }, 1900);
  }
}
