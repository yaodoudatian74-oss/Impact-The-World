// The party and the character you control: movement modes (walk, sprint, jump, glide, swim,
// dive, mount), attacks, skills, shields, buffs and switching between the four party members.

import * as THREE from 'three';
import { CHARACTERS, WEAPONS } from '../data/characters.js';
import { WORLD_HALF } from '../data/realms.js';
import { characterStats } from './rules.js';
import { COMBOS } from './combat.js';
import { buildCharacterModel, animateHumanoid, buildMount } from '../world/models.js';
import { PRIM, glow, mesh } from '../world/geo.js';
import { damp, dampAngle, clamp } from '../core/math.js';

const RADIUS = 0.45;

export class Player {
  constructor(game) {
    this.game = game;
    this.root = new THREE.Group();
    game.scene.add(this.root);
    this.modelHolder = new THREE.Group();
    this.root.add(this.modelHolder);
    this.pos = new THREE.Vector3();
    this.prevPos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.onGround = true;
    this.mode = 'walk';
    this.mounted = false;
    this.stamina = 100;
    this.staminaUseT = 0;
    this.members = [];
    this.activeIdx = 0;
    this.attack = null;
    this.lastCombo = -1;
    this.comboReset = 0;
    this.dashT = 0;
    this.dashVel = new THREE.Vector3();
    this.invulnUntil = 0;
    this.shield = { hp: 0, max: 0, until: 0 };
    this.castT = 0;
    this.switchCd = 0;
    this.lastSafe = new THREE.Vector3();
    this.lastSafeT = 0;
    this.lastHurt = -99;
    this.lastAttackT = -99;
    this.lavaCd = 0;
    this.dead = false;
    this.animT = 0;
    this.mount = buildMount();
    this.mount.root.visible = false;
    this.root.add(this.mount.root);
    this.glider = new THREE.Group();
    for (const s of [-1, 1]) this.glider.add(mesh(PRIM.cone4, glow('#bff4ff', 0.55, false), { x: s * 0.9, y: 1.45, z: -0.2, rz: s * Math.PI / 2, sx: 0.5, sy: 1.6, sz: 0.04 }));
    this.glider.visible = false;
    this.root.add(this.glider);
    this.shieldMesh = mesh(PRIM.sphereMid, glow('#f0d070', 0.18), { y: 1, s: 1.3 });
    this.shieldMesh.visible = false;
    this.root.add(this.shieldMesh);
    this._v = new THREE.Vector3();
  }

  get active() { return this.members[this.activeIdx]; }

  makeMember(id) {
    const def = CHARACTERS[id];
    const weapon = WEAPONS[def.weaponId];
    const entry = this.game.save.roster[id];
    const m = { id, def, weapon, entry, hp: 1, energy: 0, cdUntil: 0, buffs: [], model: null };
    m.hp = this.statsOf(m).maxHp;
    return m;
  }

  // Keeps runtime state (hp, energy) for members who stay in the party.
  setParty(ids) {
    const old = new Map(this.members.map((m) => [m.id, m]));
    this.members = ids.map((id) => old.get(id) || this.makeMember(id));
    for (const m of old.values()) if (!ids.includes(m.id) && m.model) this.modelHolder.remove(m.model.root);
    if (this.activeIdx >= this.members.length) this.activeIdx = 0;
    if (this.active.hp <= 0) {
      const alive = this.members.findIndex((m) => m.hp > 0);
      this.activeIdx = alive >= 0 ? alive : 0;
    }
    this.showActiveModel();
  }

  statsOf(m) {
    const t = this.game.time;
    if (m.buffs.length) m.buffs = m.buffs.filter((b) => b.until > t);
    return characterStats(m.id, m.entry.lv, m.buffs, this.shield.hp > 0 && t < this.shield.until);
  }

  showActiveModel() {
    for (const m of this.members) if (m.model) m.model.root.visible = false;
    const a = this.active;
    if (!a.model) {
      a.model = buildCharacterModel(a.def, a.weapon);
      this.modelHolder.add(a.model.root);
    }
    a.model.root.visible = true;
  }

  switchTo(i, forced = false) {
    const g = this.game;
    if (i === this.activeIdx || i >= this.members.length) return;
    if (this.members[i].hp <= 0) { if (!forced) g.ui.toast(`${this.members[i].def.name}は戦闘不能（ワープポイントで復活）`, '#ff8a8a', true); return; }
    if (!forced && this.switchCd > 0) return;
    this.activeIdx = i;
    this.switchCd = 0.8;
    this.attack = null;
    this.showActiveModel();
    g.effects.burst(this.pos.clone().setY(this.pos.y + 1), 1.6, '#ffffff', 0.3);
    g.audio.play('switch');
  }

  addEnergy(member, amount, exact = false) {
    const cost = (m) => m.def.burst.cost;
    member.energy = Math.min(cost(member), member.energy + amount);
    if (!exact) for (const m of this.members) if (m !== member) m.energy = Math.min(cost(m), m.energy + amount * 0.25);
  }

  addBuff(buff, member) {
    const until = this.game.time + buff.dur;
    const targets = buff.team ? this.members : [member];
    for (const m of targets) {
      m.buffs = m.buffs.filter((b) => !(b.stat === buff.stat && b.src === member.id));
      m.buffs.push({ stat: buff.stat, value: buff.value, until, src: member.id });
    }
  }

  addShield(hp, dur) {
    const t = this.game.time;
    if (this.shield.until < t) this.shield.hp = 0;
    this.shield.hp = Math.max(this.shield.hp, hp);
    this.shield.max = this.shield.hp;
    this.shield.until = t + dur;
  }

  healTeam(amount, fx = true) {
    const g = this.game;
    for (const m of this.members) {
      if (m.hp <= 0) continue;
      m.hp = Math.min(this.statsOf(m).maxHp, m.hp + amount);
    }
    g.ui.damage(this._v.set(this.pos.x, this.pos.y + 2.4, this.pos.z), amount, '#7dff9a', false, null, false, true);
    if (fx) { g.effects.sparks(this.pos.clone().setY(this.pos.y + 1), '#7dff9a', 10, 4, 0.7); g.audio.play('heal'); }
  }

  reviveAll() {
    for (const m of this.members) m.hp = this.statsOf(m).maxHp;
    this.dead = false;
  }

  onMemberDown(m) {
    const g = this.game;
    g.ui.toast(`${m.def.name}が倒れた…`, '#ff8a8a');
    const next = this.members.findIndex((x) => x.hp > 0);
    if (next >= 0) this.switchTo(next, true);
    else { this.dead = true; g.partyWiped(); }
  }

  teleport(x, z, y = null) {
    const gy = this.game.world.groundY(x, z);
    this.pos.set(x, y ?? gy, z);
    if (y !== null && y < gy) this.pos.y = gy;
    this.prevPos.copy(this.pos);
    this.vel.set(0, 0, 0);
    this.onGround = y === null;
    this.lastSafe.copy(this.pos);
  }

  faceTo(p) {
    const dx = p.x - this.pos.x, dz = p.z - this.pos.z;
    if (dx * dx + dz * dz > 0.01) this.yaw = Math.atan2(dx, dz);
  }

  aimDir() {
    const cam = this.game.camera;
    return new THREE.Vector3(Math.sin(cam.yaw), -Math.sin(cam.pitch) * 0.4 + 0.05, Math.cos(cam.yaw)).normalize();
  }

  startDash(dir, speed, dur, iframe) {
    this.dashVel.set(dir.x, 0, dir.z).normalize().multiplyScalar(speed);
    this.dashT = dur;
    if (iframe) this.invulnUntil = Math.max(this.invulnUntil, this.game.time + dur + 0.1);
  }

  setMounted(on) {
    if (on === this.mounted) return;
    this.mounted = on;
    this.mount.root.visible = on;
    this.modelHolder.position.y = on ? 1.05 : 0;
    if (on) this.game.effects.burst(this.pos.clone().setY(this.pos.y + 1), 2, '#9ff2ff', 0.35);
  }

  trySkill() {
    const g = this.game, m = this.active;
    if (this.castT > 0 || this.mode === 'swim' || this.mode === 'glide') return;
    if (g.time < m.cdUntil) { g.ui.toast('元素スキルはクールタイム中', '#c8c8d8', true); return; }
    this.setMounted(false);
    this.attack = null;
    m.cdUntil = g.time + g.combat.cast(m, 'skill');
    this.lastAttackT = g.time;
  }

  tryBurst() {
    const g = this.game, m = this.active;
    if (this.castT > 0 || this.mode === 'swim' || this.mode === 'glide') return;
    if (m.energy < m.def.burst.cost) { g.ui.toast('元素エネルギーが足りない', '#c8c8d8', true); return; }
    this.setMounted(false);
    this.attack = null;
    m.energy = 0;
    g.combat.cast(m, 'burst');
    this.lastAttackT = g.time;
  }

  // ------------------------------------------------------------------ simulation step
  tick(dt) {
    const g = this.game, input = g.input, world = g.world, realm = world.realm, t = g.time;
    this.prevPos.copy(this.pos);
    if (this.dead) return;
    const m = this.active;
    const stats = this.statsOf(m);
    this.switchCd = Math.max(0, this.switchCd - dt);
    this.castT = Math.max(0, this.castT - dt);
    this.comboReset = Math.max(0, this.comboReset - dt);
    this.lavaCd = Math.max(0, this.lavaCd - dt);

    for (let i = 0; i < 4; i++) if (input.consume(`switch${i + 1}`)) this.switchTo(i);
    if (input.consume('mount')) {
      if (this.mounted) this.setMounted(false);
      else if (this.mode === 'walk' || this.mode === 'dive') this.setMounted(true);
    }
    if (input.consume('potion')) g.usePotion();
    if (input.consume('interact')) g.interact();
    if (input.consume('skill')) this.trySkill();
    if (input.consume('burst')) this.tryBurst();
    const wantsAttack = input.consume('attack') || (input.isHeld('attack') && !this.attack);
    const dashPressed = input.consume('dash');
    const jumpPressed = input.consume('jump');

    const mv = input.moveVector();
    const moving = Math.hypot(mv.x, mv.y) > 0.1;
    const cy = g.camera.yaw;
    const fx = Math.sin(cy), fz = Math.cos(cy);
    let dirX = fx * mv.y - fz * mv.x, dirZ = fz * mv.y + fx * mv.x;
    const dl = Math.hypot(dirX, dirZ) || 1;
    dirX /= dl; dirZ /= dl;

    // Normal attacks
    const combo = COMBOS[m.def.weapon];
    const canAttack = this.mode !== 'swim' && this.mode !== 'glide' && this.castT <= 0;
    if (this.attack) {
      const a = this.attack;
      a.t += dt;
      const step = combo[a.combo];
      if (!a.hitDone && a.t >= step.hitAt) { a.hitDone = true; g.combat.normalAttack(m, step); }
      if (wantsAttack && a.t > step.time * 0.4) a.queued = true;
      if (step.lunge && a.t < step.hitAt && this.mode !== 'dive') {
        const close = g.enemies.nearestTo(this.pos, 1.8);
        if (!close) { this.pos.x += Math.sin(this.yaw) * step.lunge * dt; this.pos.z += Math.cos(this.yaw) * step.lunge * dt; }
      }
      if (a.t >= step.time) {
        if (a.queued) this.beginAttack((a.combo + 1) % combo.length);
        else { this.lastCombo = a.combo; this.attack = null; this.comboReset = 0.7; }
      }
    } else if (wantsAttack && canAttack) {
      this.beginAttack(this.comboReset > 0 ? (this.lastCombo + 1) % combo.length : 0);
    }

    // Dash (also cancels an attack)
    if (dashPressed && !this.mounted && this.stamina >= 18 && (this.onGround || this.mode === 'dive') && this.dashT <= 0) {
      const dir = moving ? new THREE.Vector3(dirX, 0, dirZ) : new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      this.startDash(dir, 21, 0.24, true);
      this.attack = null;
      this.stamina -= 18;
      this.staminaUseT = t;
      this.yaw = Math.atan2(dir.x, dir.z);
      g.effects.sparks(this.pos.clone().setY(this.pos.y + 0.6), '#ffffff', 6, 5, 0.3);
      g.audio.play('dash');
    }

    if (realm.mode === 'underwater') this.tickDive(dt, mv, moving, dirX, dirZ, stats);
    else this.tickGround(dt, mv, moving, dirX, dirZ, stats, jumpPressed);

    // Facing
    // While attacking or casting, the yaw set when the action started is kept.
    if (!this.attack && this.castT <= 0 && moving && this.dashT <= 0) this.yaw = dampAngle(this.yaw, Math.atan2(dirX, dirZ), 12, dt);

    // Stamina recovery
    if (t - this.staminaUseT > 0.6) this.stamina = Math.min(g.save.staminaMax, this.stamina + 30 * dt);

    // Out-of-combat regeneration
    if (t - this.lastHurt > 6 && t - this.lastAttackT > 6) {
      for (const mem of this.members) if (mem.hp > 0) { const mx = this.statsOf(mem).maxHp; mem.hp = Math.min(mx, mem.hp + mx * 0.01 * dt); }
    }
    if (this.shield.until < t) this.shield.hp = 0;
    this.animT += dt;
  }

  beginAttack(index) {
    const g = this.game, m = this.active;
    this.setMounted(false);
    const step = COMBOS[m.def.weapon][index];
    const ranged = !!step.ranged;
    const target = g.enemies.nearestTo(this.pos, ranged ? 32 : 9);
    if (target) this.faceTo(target.pos);
    else if (ranged) this.yaw = g.camera.yaw;
    this.attack = { combo: index, t: 0, hitDone: false, queued: false };
    this.lastAttackT = g.time;
  }

  tickGround(dt, mv, moving, dirX, dirZ, stats, jumpPressed) {
    const g = this.game, input = g.input, world = g.world, realm = world.realm, t = g.time;
    const pos = this.pos, vel = this.vel;
    const wasGround = this.onGround;
    let speed = 7.2 * (1 + stats.moveSpeed);
    const sprinting = input.isHeld('sprint') && moving && this.stamina > 0;
    if (this.mounted) speed = input.isHeld('sprint') ? 34 : 26;
    else if (this.mode === 'swim') {
      speed = sprinting ? 8.5 : 4.6;
      if (sprinting) { this.stamina -= 12 * dt; this.staminaUseT = t; }
    } else if (this.mode === 'glide') speed = 10.5;
    else if (sprinting && this.onGround) { speed = 11.5; this.stamina -= 14 * dt; this.staminaUseT = t; }
    if (this.attack) speed *= COMBOS[this.active.def.weapon][0].ranged ? 0.35 : 0.1;
    if (this.castT > 0) speed = 0;

    // Steep uphill slows you down.
    if (moving && this.onGround) {
      const ahead = world.groundY(pos.x + dirX * 1.5, pos.z + dirZ * 1.5);
      const slope = (ahead - world.groundY(pos.x, pos.z)) / 1.5;
      if (slope > 0.8) speed *= clamp(1.5 - slope * 0.6, this.mounted ? 0.35 : 0.3, 1);
    }

    const tvx = moving ? dirX * speed : 0, tvz = moving ? dirZ * speed : 0;
    const accel = this.onGround ? 14 : this.mode === 'glide' ? 3 : 4;
    vel.x = damp(vel.x, tvx, accel, dt);
    vel.z = damp(vel.z, tvz, accel, dt);
    if (this.dashT > 0) { vel.x = this.dashVel.x; vel.z = this.dashVel.z; this.dashT -= dt; }

    // Jump / glide toggle
    if (jumpPressed) {
      if (this.onGround || this.mode === 'swim') {
        vel.y = this.mounted ? 13 : 11.5;
        this.onGround = false;
        this.mode = 'air';
        g.audio.play('jump');
      } else if (this.mode === 'air' && this.stamina > 5 && vel.y < 6) {
        this.mode = 'glide';
        this.setMounted(false);
      } else if (this.mode === 'glide') this.mode = 'air';
    }

    const G = 32 * realm.gravity;
    if (this.mode === 'glide') {
      vel.y = Math.max(vel.y - G * dt, -3.2);
      this.stamina -= 3.5 * dt;
      this.staminaUseT = t;
      if (this.stamina <= 0) this.mode = 'air';
    } else if (!this.onGround) vel.y -= G * dt;

    // Updrafts (heaven)
    for (const u of world.updrafts) {
      const dx = pos.x - u.x, dz = pos.z - u.z;
      if (dx * dx + dz * dz < (u.r + 1.5) ** 2 && pos.y < u.y + u.top) {
        vel.y = Math.max(vel.y, 24);
        this.onGround = false;
        if (this.mode === 'walk' || this.mode === 'swim') this.mode = 'air';
        this.setMounted(false);
      }
    }

    pos.x += vel.x * dt;
    pos.z += vel.z * dt;
    pos.y += vel.y * dt;
    pos.x = clamp(pos.x, -WORLD_HALF + 30, WORLD_HALF - 30);
    pos.z = clamp(pos.z, -WORLD_HALF + 30, WORLD_HALF - 30);
    world.resolveCollisions(pos, RADIUS);
    g.npcs.pushOut(pos, RADIUS);

    const gy = world.groundY(pos.x, pos.z);
    const wl = world.waterLevel;
    if (wl !== null && gy < wl - 1.3 && pos.y < wl - 0.95) {
      if (this.mode !== 'swim') { g.effects.ring(pos.clone().setY(wl - 0.2), 2.5, '#ffffff', 0.4, 0); }
      this.mode = 'swim';
      pos.y = wl - 1.05;
      vel.y = 0;
      this.onGround = false;
      this.setMounted(false);
      this.attack = null;
    } else if (pos.y <= gy) {
      pos.y = gy;
      vel.y = 0;
      this.onGround = true;
      this.mode = 'walk';
    } else if (wasGround && vel.y <= 0 && pos.y - gy < 1.6 && this.mode === 'walk') {
      pos.y = gy;
      this.onGround = true;
    } else {
      this.onGround = false;
      if (this.mode === 'walk' || (this.mode === 'swim' && !(wl !== null && gy < wl - 1.3))) this.mode = 'air';
    }

    // Lava burns and bounces you out.
    const ll = world.lavaLevel;
    if (ll !== null && gy < ll + 0.3 && pos.y < ll + 0.4) {
      vel.y = 15;
      this.onGround = false;
      this.mode = 'air';
      if (this.lavaCd <= 0) {
        this.lavaCd = 0.6;
        const m = this.active;
        const dmg = Math.round(this.statsOf(m).maxHp * 0.12);
        m.hp -= dmg;
        g.ui.damage(this._v.set(pos.x, pos.y + 2, pos.z), dmg, '#ff7a2a', false, '溶岩', true);
        g.ui.hurtFlash();
        g.audio.play('hurt');
        this.lastHurt = t;
        if (m.hp <= 0) { m.hp = 0; this.onMemberDown(m); }
      }
    }

    // Falling into the cloud sea returns you to safe ground.
    if (world.cloudSea !== null && pos.y < world.cloudSea - 12) {
      g.ui.toast('雲海に落ちてしまった…', '#ffffff');
      this.teleport(this.lastSafe.x, this.lastSafe.z);
      const m = this.active;
      m.hp = Math.max(1, m.hp - Math.round(this.statsOf(m).maxHp * 0.1));
      g.effects.burst(this.pos.clone().setY(this.pos.y + 1), 2, '#ffffff', 0.4);
    }

    if (this.onGround && this.mode === 'walk' && t - this.lastSafeT > 1 && (ll === null || gy > ll + 1) && (world.cloudSea === null || gy > 5)) {
      this.lastSafe.copy(pos);
      this.lastSafeT = t;
    }
  }

  tickDive(dt, mv, moving, dirX, dirZ, stats) {
    const g = this.game, input = g.input, world = g.world, t = g.time;
    const pos = this.pos, vel = this.vel;
    this.mode = 'dive';
    let speed = this.mounted ? 22 : 7.5 * (1 + stats.moveSpeed);
    if (!this.mounted && input.isHeld('sprint') && moving && this.stamina > 0) { speed = 12; this.stamina -= 12 * dt; this.staminaUseT = t; }
    if (this.attack) speed *= 0.25;
    if (this.castT > 0) speed = 0;
    let vy = 0;
    if (moving && mv.y > 0.2) vy = -Math.sin(g.camera.pitch) * mv.y * 0.9;
    if (input.isHeld('jump')) vy += 0.8;
    if (input.isHeld('down')) vy -= 0.8;
    const tv = new THREE.Vector3(moving ? dirX * speed : 0, vy * speed, moving ? dirZ * speed : 0);
    vel.x = damp(vel.x, tv.x, 4, dt);
    vel.y = damp(vel.y, tv.y, 4, dt);
    vel.z = damp(vel.z, tv.z, 4, dt);
    if (this.dashT > 0) { vel.x = this.dashVel.x; vel.z = this.dashVel.z; this.dashT -= dt; }
    pos.addScaledVector(vel, dt);
    pos.x = clamp(pos.x, -WORLD_HALF + 30, WORLD_HALF - 30);
    pos.z = clamp(pos.z, -WORLD_HALF + 30, WORLD_HALF - 30);
    world.resolveCollisions(pos, RADIUS);
    g.npcs.pushOut(pos, RADIUS);
    const gy = world.groundY(pos.x, pos.z);
    pos.y = clamp(pos.y, gy + 0.3, world.surface - 1.5);
    this.onGround = pos.y <= gy + 0.35;
    if (this.onGround && t - this.lastSafeT > 1) { this.lastSafe.copy(pos); this.lastSafeT = t; }
  }

  // ------------------------------------------------------------------ rendering
  render(alpha) {
    const g = this.game;
    this.root.position.lerpVectors(this.prevPos, this.pos, alpha);
    this.root.rotation.y = this.yaw;
    const m = this.active;
    if (!m || !m.model) return;
    const hs = Math.hypot(this.vel.x, this.vel.z);
    const st = {
      t: this.animT,
      speed: this.mode === 'glide' ? 0 : hs / 7.2,
      air: this.mode === 'air',
      glide: this.mode === 'glide',
      swim: this.mode === 'swim' || (this.mode === 'dive' && hs > 1.5),
      mount: this.mounted,
      attack: this.attack ? { phase: this.attack.t / COMBOS[m.def.weapon][this.attack.combo].time, combo: this.attack.combo } : null,
      cast: this.castT > 0 ? Math.sin((this.castT / 0.35) * Math.PI) : 0,
    };
    if (this.mode === 'dive' && hs <= 1.5) { st.speed = 0.4; st.air = true; }
    animateHumanoid(m.model, st);
    if (this.mode === 'swim') this.modelHolder.position.y = Math.sin(this.animT * 2) * 0.05 - 0.2;
    else if (!this.mounted) this.modelHolder.position.y = 0;
    if (this.mounted) this.mount.animate(this.animT, Math.min(1.5, hs / 20));
    this.glider.visible = this.mode === 'glide';
    const shielded = this.shield.hp > 0 && g.time < this.shield.until;
    this.shieldMesh.visible = shielded;
    if (shielded) this.shieldMesh.scale.setScalar(1.3 + Math.sin(this.animT * 4) * 0.04);
    // Blink while invulnerable after a hit (not during dashes and bursts).
    m.model.root.visible = !(this.invulnUntil > g.time && this.lastHurt > g.time - 0.4 && Math.floor(this.animT * 20) % 2 === 0);
  }
}
