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
    this.mesh = buildArwing({ wing: 0x24222e, darkWing: 0x0c0d14, engine: 0xff3b52 });
    this.mesh.scale.setScalar(1.05);
    this.mesh.visible = false;
    scene.add(this.mesh);
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3(0, 0, 40);
    this.wp = new THREE.Vector3();
    this.active = false;
    this.hp = 1; this.maxHp = 1;
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
    this.pos.set(0, 34, -230);
    this.vel.set(0, 0, 40);
    this.mesh.visible = true;
    this.mesh.position.copy(this.pos);
    this.wpT = 0; this.fireCd = 1.6; this.tauntT = 5; this.flash = 0; this.tailWarn = 0;
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
    this.wpT = rand(1.4, 2.6);
    if (Math.random() < 0.32) {
      // dive onto the player's tail (behind the camera-facing plane)
      this.wp.set(P.x + rand(-14, 14), P.y + rand(-6, 10), PLAYER_Z + rand(24, 46));
      this._tailing = true;
    } else {
      // strafe / swoop somewhere in the forward arena
      this.wp.set(rand(-140, 140), rand(14, 115), rand(-230, -50));
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
    const speed = this._tailing ? 108 : 90;
    this.vel.lerp(_v1.multiplyScalar(speed), Math.min(1, dt * 2.4));
    this.pos.addScaledVector(this.vel, dt);
    // keep inside the arena vertically / laterally
    this.pos.x = clamp(this.pos.x, -260, 260);
    this.pos.y = clamp(this.pos.y, 6, 150);
    this.pos.z = clamp(this.pos.z, -320, PLAYER_Z + 55);
    this.mesh.position.copy(this.pos);
    // bank into the turn + face travel direction
    _v2.copy(this.pos).add(this.vel);
    this.mesh.lookAt(_v2);
    this.mesh.rotation.z += Math.sin(performance.now() * 0.004) * 0.2;

    // engine flicker
    const gg = this.mesh.userData.engineGlow;
    if (gg) gg.scale.setScalar(0.9 + Math.sin(performance.now() * 0.03) * 0.12);

    // on the player's tail → warn + fire from behind
    const onTail = this.pos.z > PLAYER_Z + 10;
    if (onTail) {
      this.tailWarn = 0.5;
      if (game.hud) game.hud.alert('⚠ ENEMY ON YOUR TAIL — ROLL!', 0.5);
    }

    // fire at the player
    this.fireCd -= dt;
    if (this.fireCd <= 0 && this.hp > 0) {
      this.fireCd = onTail ? 0.7 : rand(0.9, 1.45);
      _v1.set(P.x + P.vx * 0.08, P.y + P.vy * 0.06, PLAYER_Z).sub(this.pos);
      proj.fireEnemy(this.pos.clone(), _v1.clone(), onTail ? 'bolt' : 'plasma');
    }

    // taunts
    this.tauntT -= dt;
    if (this.tauntT <= 0) { this.tauntT = rand(6, 10); game.hud.say('THORNE', pick(this.taunts), 2.6); }

    // ---- player weapons vs rival ----
    const R = 4.2;
    for (const b of proj.lasers) {
      if (!b.active) continue;
      if (b.mesh.position.distanceTo(this.pos) < R + 1.5) {
        b.active = false; b.mesh.visible = false;
        this._hit(b.dmg, game);
      }
    }
    for (const c of proj.charges) {
      if (!c.active) continue;
      if (c.mesh.position.distanceTo(this.pos) < R + 3) { c.active = false; c.mesh.visible = false; game.explodeAt(this.pos, true); this._hit(6, game); }
    }
    for (const b of proj.bombs) {
      if (!b.active) continue;
      if (b.mesh.position.distanceTo(this.pos) < R + 6) game._detonateBomb(b, false);
    }
    // area weapons (bomb/charge blasts) also damage via proximity handled by _hit calls above

    // ram
    _v1.set(P.x, P.y, PLAYER_Z);
    if (this.pos.distanceTo(_v1) < R + P.radius && P.invuln <= 0 && !P.rolling) {
      game.damagePlayer(12, 'ram');
      this.pos.z = PLAYER_Z - 30; // bounce forward
    }

    if (this.flash > 0) { this.flash -= dt; }
    game.hud.setBossHp(this.hp / this.maxHp);

    // off-screen / on-screen indicator
    const s = game._toScreen(this.pos);
    game.hud.rivalMarker(s, this.flash > 0);

    if (this.hp <= 0) this._defeat(game);
  }

  _hit(dmg, game) {
    this.hp = Math.max(0, this.hp - dmg);
    this.flash = 0.08;
    audio.hitTick();
    game.particles.emit(this.pos.x, this.pos.y, this.pos.z, { count: 6, speed: 16, color: 0xffd0d8, life: 0.3, size: 2 });
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
