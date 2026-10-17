// Combat: hits on enemies (with elemental reactions), hits on the party, normal attacks and
// every skill/burst template. Rules (numbers) come from rules.js; this file applies them.

import * as THREE from 'three';
import { ELEMENTS } from '../data/elements.js';
import { damageToEnemy, damageToCharacter, resolveElement, skillCooldown } from './rules.js';
import { clamp } from '../core/math.js';

const ecol = (e) => (e ? ELEMENTS[e].color : '#ffffff');

// Normal attack strings per weapon type.
export const COMBOS = {
  sword: [
    { mult: 0.9, range: 3.3, arc: 2.3, time: 0.34, hitAt: 0.12, lunge: 3 },
    { mult: 1.0, range: 3.3, arc: 2.3, time: 0.34, hitAt: 0.12, lunge: 3 },
    { mult: 1.15, range: 3.4, arc: 2.5, time: 0.38, hitAt: 0.14, lunge: 3 },
    { mult: 1.7, range: 3.8, arc: 3.4, time: 0.55, hitAt: 0.22, lunge: 5 },
  ],
  greatsword: [
    { mult: 1.5, range: 4.0, arc: 2.6, time: 0.6, hitAt: 0.28, lunge: 2 },
    { mult: 1.7, range: 4.0, arc: 2.8, time: 0.62, hitAt: 0.28, lunge: 2 },
    { mult: 2.6, range: 4.6, arc: 6.3, time: 0.8, hitAt: 0.38, lunge: 1 },
  ],
  spear: [
    { mult: 0.7, range: 4.4, arc: 1.2, time: 0.26, hitAt: 0.1, lunge: 3.5 },
    { mult: 0.75, range: 4.4, arc: 1.2, time: 0.26, hitAt: 0.1, lunge: 3.5 },
    { mult: 0.8, range: 4.4, arc: 1.4, time: 0.28, hitAt: 0.1, lunge: 3.5 },
    { mult: 0.85, range: 4.6, arc: 1.4, time: 0.28, hitAt: 0.1, lunge: 3.5 },
    { mult: 1.4, range: 5.0, arc: 2.0, time: 0.45, hitAt: 0.18, lunge: 6 },
  ],
  bow: [
    { mult: 0.85, ranged: 'arrow', speed: 75, time: 0.34, hitAt: 0.16 },
    { mult: 0.9, ranged: 'arrow', speed: 75, time: 0.34, hitAt: 0.16 },
    { mult: 0.95, ranged: 'arrow', speed: 75, time: 0.36, hitAt: 0.16 },
    { mult: 1.5, ranged: 'arrow', speed: 85, time: 0.5, hitAt: 0.25, triple: true },
  ],
  catalyst: [
    { mult: 0.9, ranged: 'orb', speed: 30, time: 0.4, hitAt: 0.16, explode: 1.8 },
    { mult: 0.95, ranged: 'orb', speed: 30, time: 0.4, hitAt: 0.16, explode: 1.8 },
    { mult: 1.5, ranged: 'orb', speed: 26, time: 0.55, hitAt: 0.22, explode: 3.2 },
  ],
};

export class Combat {
  constructor(game) {
    this.game = game;
    this._v = new THREE.Vector3();
    this.summons = [];
    this.zones = [];
  }

  get time() { return this.game.time; }

  // --------------------------------------------------------------- damage to enemies
  // hit: { member, mult, kind, element, knock, pos, noReaction }
  hitEnemy(e, hit) {
    if (!e || e.dead) return 0;
    const g = this.game;
    const member = hit.member;
    const stats = g.player.statsOf(member);
    let reactionMult = 1, reaction = null;
    const canApply = hit.element && !hit.noReaction && (hit.kind !== 'normal' || this.time >= (e.icd[member.id] || 0));
    if (canApply) {
      if (hit.kind === 'normal') e.icd[member.id] = this.time + 1.2;
      const prevAura = e.aura;
      const r = resolveElement(hit.element, e.aura);
      if (r.reaction) {
        reaction = r.reaction;
        reactionMult = reaction.mult;
        e.aura = null;
        e.auraRegen = this.time + 4;
        this.reactionEffect(e, reaction, prevAura, hit, member, stats);
      } else if (r.aura) {
        e.aura = r.aura;
        e.auraUntil = this.time + 9;
      }
    }
    let res = hit.element && e.def.element === hit.element ? 0.4 : 0;
    if (this.time < e.resDownUntil) res -= 0.4;
    const { amount, crit } = damageToEnemy({
      stats, attLv: member.entry.lv, defLv: e.lv, mult: hit.mult, kind: hit.kind, element: hit.element,
      res, reactionMult, roll: Math.random(),
    });
    e.hp -= amount;
    e.flash = 0.12;
    e.lastHit = this.time;
    if (e.state === 'idle' || e.state === 'return') e.state = 'chase';
    const head = this._v.set(e.pos.x, e.pos.y + e.height + 0.5, e.pos.z);
    g.ui.damage(head, amount, ecol(hit.element), crit, reaction ? reaction.name : null);
    if (hit.knock && !e.def.boss && !e.def.elite) {
      const from = hit.pos || g.player.pos;
      const dx = e.pos.x - from.x, dz = e.pos.z - from.z;
      const d = Math.hypot(dx, dz) || 1;
      e.knock.set((dx / d) * hit.knock, 0, (dz / d) * hit.knock);
    }
    // Energy for the burst: the attacker charges most, the rest of the party a little.
    const gain = (hit.kind === 'normal' ? 1.6 : hit.kind === 'skill' ? 2.6 : 0) * stats.er;
    if (gain) g.player.addEnergy(member, gain);
    g.audio.play(crit ? 'crit' : 'hit');
    if (e.hp <= 0) g.enemies.kill(e);
    return amount;
  }

  reactionEffect(e, reaction, aura, hit, member, stats) {
    const g = this.game;
    g.audio.play('reaction');
    const col = ecol(hit.element);
    g.effects.burst(this._v.set(e.pos.x, e.pos.y + e.height * 0.6, e.pos.z), 1.6 + e.radius, col, 0.4);
    switch (reaction.effect) {
      case 'overload':
        g.effects.burst(e.pos.clone().setY(e.pos.y + 1), 5, '#ff7a3a', 0.45);
        g.audio.play('boom');
        this.aoe(e.pos, 5, { member, mult: 1.6, kind: 'reaction', element: null, knock: 8, pos: e.pos }, e);
        break;
      case 'electro':
        for (let i = 1; i <= 3; i++) g.schedule(i * 0.6, () => { if (!e.dead) { g.effects.sparks(e.pos.clone().setY(e.pos.y + 1), '#b26bff', 6, 6, 0.4); this.hitEnemy(e, { member, mult: 0.45, kind: 'reaction', element: null }); } });
        break;
      case 'superconduct':
      case 'corrode':
        e.resDownUntil = this.time + 10;
        break;
      case 'freeze':
        e.frozenUntil = this.time + (e.def.boss ? 1.2 : 3);
        break;
      case 'swirl': {
        const el = aura;
        g.effects.ring(e.pos, 6, ecol(el), 0.5);
        for (const o of g.enemies.near(e.pos, 6)) {
          if (o === e) continue;
          this.hitEnemy(o, { member, mult: 0.7, kind: 'reaction', element: el, noReaction: false });
        }
        break;
      }
      case 'crystallize':
        g.player.addShield(Math.round(stats.maxHp * 0.15), 12);
        g.ui.toast('結晶シールド獲得', '#e0b04a');
        break;
      case 'radiance':
        g.player.healTeam(Math.round(stats.maxHp * 0.04), false);
        break;
      default: break;
    }
  }

  aoe(center, radius, hit, except = null) {
    let n = 0;
    for (const e of this.game.enemies.near(center, radius)) {
      if (e === except) continue;
      this.hitEnemy(e, { ...hit, pos: hit.pos || center });
      n++;
    }
    return n;
  }

  // --------------------------------------------------------------- damage to the party
  // src: { atk, lv, mult, element, pos }
  hurtPlayer(src) {
    const g = this.game;
    const p = g.player;
    if (p.invulnUntil > this.time || p.dead) return false;
    const m = p.active;
    const stats = p.statsOf(m);
    let dmg = damageToCharacter({ enemyAtk: src.atk, enemyLv: src.lv, charLv: m.entry.lv, charDef: stats.def, mult: src.mult });
    if (p.shield.hp > 0 && this.time < p.shield.until) {
      const absorbed = Math.min(p.shield.hp, dmg);
      p.shield.hp -= absorbed;
      dmg -= absorbed;
      if (absorbed > 0) g.effects.burst(p.pos.clone().setY(p.pos.y + 1), 1.4, '#f0d070', 0.25);
    }
    if (dmg > 0) {
      m.hp -= dmg;
      g.ui.damage(this._v.set(p.pos.x, p.pos.y + 2.2, p.pos.z), dmg, '#ff5a5a', false, null, true);
      g.ui.hurtFlash();
      g.audio.play('hurt');
      g.camera.shake(0.25);
    }
    p.lastHurt = this.time;
    p.invulnUntil = this.time + 0.35;
    if (m.hp <= 0) { m.hp = 0; p.onMemberDown(m); }
    return true;
  }

  // --------------------------------------------------------------- normal attacks
  normalAttack(member, step) {
    const g = this.game;
    const p = g.player;
    const el = member.def.element;
    if (step.ranged) {
      const origin = p.pos.clone().setY(p.pos.y + 1.3);
      const target = g.enemies.nearestTo(p.pos, 32);
      const dir = new THREE.Vector3();
      if (target) dir.set(target.pos.x - origin.x, target.pos.y + target.height * 0.6 - origin.y, target.pos.z - origin.z).normalize();
      else dir.copy(p.aimDir());
      const shots = step.triple ? [-0.12, 0, 0.12] : [0];
      for (const off of shots) {
        const d = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), off);
        g.effects.projectile({
          pos: origin.clone(), vel: d.multiplyScalar(step.speed), radius: step.ranged === 'orb' ? 0.7 : 0.5, life: 1.2, team: 'player',
          color: ecol(el), kind: step.ranged, size: 0.32,
          homing: step.ranged === 'orb' && target ? () => (target.dead ? null : target.pos) : null, turn: 6,
          onHit: (e) => this.hitEnemy(e, { member, mult: step.mult, kind: 'normal', element: el, knock: 1.5 }),
          onEnd: step.explode ? (pos) => { g.effects.burst(pos, step.explode, ecol(el), 0.25); } : null,
        });
      }
      g.audio.play(step.ranged === 'orb' ? 'magic' : 'shoot');
      return;
    }
    // Melee arc in front of the character.
    const yaw = p.yaw;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    g.effects.slash(p.pos, yaw, step.range, ecol(el), step.arc > 6 ? 0 : (p.attack.combo % 2 ? 0.25 : -0.25));
    if (step.arc > 6) g.effects.ring(p.pos, step.range, ecol(el), 0.35);
    g.audio.play('slash');
    for (const e of g.enemies.near(p.pos, step.range + 2)) {
      const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > step.range + e.radius) continue;
      if (Math.abs(e.pos.y - p.pos.y) > 3 + e.height) continue;
      const ang = Math.acos(clamp((dx * fx + dz * fz) / (d || 1), -1, 1));
      if (d > 1.2 && ang > step.arc / 2) continue;
      this.hitEnemy(e, { member, mult: step.mult, kind: 'normal', element: el, knock: step.mult > 1.4 ? 4 : 1.5 });
    }
  }

  // --------------------------------------------------------------- skills and bursts
  cast(member, kind) {
    const g = this.game;
    const p = g.player;
    const def = kind === 'burst' ? member.def.burst : member.def.skill;
    const stats = p.statsOf(member);
    const el = member.def.element;
    const col = ecol(el);
    const hit = (mult, extra = {}) => ({ member, mult, kind, element: el, ...extra });
    const target = g.enemies.nearestTo(p.pos, def.range || 26);
    if (target) p.faceTo(target.pos);
    const fwd = new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw));
    const tpos = target ? target.pos.clone() : p.pos.clone().addScaledVector(fwd, 10);
    tpos.y = g.world.groundY(tpos.x, tpos.z);
    if (g.world.realm.mode === 'underwater' && target) tpos.y = target.pos.y;
    g.audio.play(kind === 'burst' ? 'burst' : 'skill');
    if (kind === 'burst') { g.camera.punch(); g.ui.burstFlash(col, member.def.name, def.name); }
    p.castT = 0.35;

    switch (def.type) {
      case 'spin':
        for (let i = 0; i < def.hits; i++) {
          g.schedule(i * 0.22, () => {
            g.effects.ring(p.pos, def.radius, col, 0.4);
            g.effects.twister(() => p.pos, def.radius * 0.45, col, 0.3);
            for (const e of g.enemies.near(p.pos, def.radius)) {
              this.hitEnemy(e, hit(def.mult, { knock: def.pull ? 0 : 3 }));
              if (def.pull) this.pull(e, p.pos, def.pull * 0.12);
            }
          });
        }
        break;
      case 'wave': {
        const origin = p.pos.clone().setY(p.pos.y + 1.1);
        const proj = g.effects.projectile({
          pos: origin, vel: fwd.clone().multiplyScalar(def.speed), radius: def.width / 2, life: def.range / def.speed, team: 'player', color: col,
          kind: 'orb', size: def.width * 0.35, pierce: true, ignoreGround: true,
          onHit: (e) => this.hitEnemy(e, hit(def.mult, { knock: 3 })),
        });
        const yaw = p.yaw;
        let trail = 0;
        g.effects.add(new THREE.Group(), def.range / def.speed, (e, k, dt) => {
          trail -= dt;
          if (trail <= 0) { trail = 0.06; g.effects.slash(proj.pos.clone().setY(proj.pos.y - 1.1), yaw, def.width, col, 0, 0.14); }
        });
        break;
      }
      case 'dash': {
        p.startDash(fwd, def.dist / 0.26, 0.26, true);
        const hitSet = new Set();
        g.effects.add(new THREE.Group(), 0.32, () => {
          g.effects.sparks(p.pos.clone().setY(p.pos.y + 1), col, 2, 4, 0.3);
          for (const en of g.enemies.near(p.pos, def.radius)) {
            if (hitSet.has(en)) continue;
            hitSet.add(en);
            this.hitEnemy(en, hit(def.mult, { knock: 4 }));
          }
        });
        break;
      }
      case 'rain':
        for (let i = 0; i < def.ticks; i++) {
          g.schedule(0.2 + i * def.interval, () => {
            const off = new THREE.Vector3((Math.random() - 0.5) * def.radius, 0, (Math.random() - 0.5) * def.radius);
            const pt = tpos.clone().add(off);
            pt.y = g.world.realm.mode === 'underwater' ? tpos.y : g.world.groundY(pt.x, pt.z);
            g.effects.pillar(pt, 0.5, 20, col, 0.25);
            g.effects.ring(pt, 2.8, col, 0.3);
            this.aoe(tpos, def.radius * 0.75, hit(def.mult));
            if (def.heal) p.healTeam(Math.round(stats.maxHp * def.heal * (1 + stats.healBonus)), i === 0);
          });
        }
        g.effects.ring(tpos, def.radius, col, def.ticks * def.interval + 0.4);
        break;
      case 'heal':
        p.healTeam(Math.round(stats.maxHp * def.heal * (1 + stats.healBonus)), true);
        g.effects.ring(p.pos, def.radius, col, 0.6);
        g.effects.pillar(p.pos, 2.5, 8, col, 0.6);
        this.aoe(p.pos, def.radius, hit(def.mult, { knock: 2 }));
        break;
      case 'shield':
        p.addShield(Math.round(stats.maxHp * def.shield * (1 + stats.shieldBonus)), def.dur);
        g.effects.ring(p.pos, def.radius, col, 0.5);
        g.effects.burst(p.pos.clone().setY(p.pos.y + 1), 2.5, col, 0.4);
        g.camera.shake(0.3);
        g.audio.play('boom');
        this.aoe(p.pos, def.radius, hit(def.mult, { knock: 5 }));
        break;
      case 'barrage': {
        const n = def.count;
        const enemies = g.enemies.near(p.pos, 30);
        for (let i = 0; i < n; i++) {
          const a = (n === 1 ? 0 : (i / (n - 1) - 0.5)) * def.spread * 2;
          const dir = fwd.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
          const tgt = def.homing && enemies.length ? enemies[i % enemies.length] : null;
          g.schedule(i * 0.04, () => {
            g.effects.projectile({
              pos: p.pos.clone().setY(p.pos.y + 1.3), vel: dir.multiplyScalar(def.speed), radius: 0.8, life: 1.4, team: 'player',
              color: col, kind: member.def.weapon === 'bow' ? 'arrow' : 'orb', size: 0.4,
              homing: tgt ? () => (tgt.dead ? null : tgt.pos) : null, turn: def.homing || 0,
              onHit: (e) => {
                if (def.explode) { g.effects.burst(e.pos.clone().setY(e.pos.y + 1), def.explode, col, 0.3); this.aoe(e.pos, def.explode, hit(def.mult)); }
                else this.hitEnemy(e, hit(def.mult, { knock: 1.5 }));
              },
            });
          });
        }
        break;
      }
      case 'meteor': {
        g.effects.telegraph(tpos, def.radius, def.delay, col);
        g.effects.faller(tpos, col, def.radius * 0.35, def.delay);
        g.schedule(def.delay, () => {
          g.effects.burst(tpos.clone().setY(tpos.y + 1), def.radius, col, 0.6);
          g.effects.ring(tpos, def.radius * 1.3, col, 0.6);
          g.effects.sparks(tpos.clone().setY(tpos.y + 1), col, 18, 16, 0.8);
          g.camera.shake(0.7);
          g.audio.play('boom');
          this.aoe(tpos, def.radius, hit(def.mult, { knock: 7, pos: tpos }));
        });
        break;
      }
      case 'tornado': {
        const pos = def.atTarget ? tpos.clone() : p.pos.clone().addScaledVector(fwd, 3);
        const vel = fwd.clone().multiplyScalar(def.speed);
        const tickEvery = def.dur / def.ticks;
        let acc = 0;
        g.effects.twister(() => pos, def.radius, col, def.dur);
        g.effects.add(new THREE.Group(), def.dur, (e, k, dt) => {
          pos.addScaledVector(vel, dt);
          if (g.world.realm.mode !== 'underwater') pos.y = g.world.groundY(pos.x, pos.z);
          acc += dt;
          for (const en of g.enemies.near(pos, def.radius * 2.5)) this.pull(en, pos, def.pull * dt);
          if (acc >= tickEvery) {
            acc -= tickEvery;
            this.aoe(pos, def.radius, hit(def.mult));
          }
        });
        break;
      }
      case 'beam': {
        const yaw = p.yaw;
        g.effects.beam(p.pos, yaw, def.length, def.width, col, 0.6);
        g.camera.shake(0.4);
        for (const e of g.enemies.near(p.pos, def.length + 2)) {
          const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z;
          const along = dx * fwd.x + dz * fwd.z;
          const side = Math.abs(dx * fwd.z - dz * fwd.x);
          if (along > -1 && along < def.length && side < def.width / 2 + e.radius) this.hitEnemy(e, hit(def.mult, { knock: 5 }));
        }
        break;
      }
      case 'summon': {
        const pos = p.pos.clone().addScaledVector(fwd, 2);
        const turret = new THREE.Group();
        turret.position.copy(pos);
        const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.6), new THREE.MeshBasicMaterial({ color: col }));
        core.position.y = 1.6;
        turret.add(core);
        let fireT = 0;
        g.effects.add(turret, def.dur, (e, k, dt) => {
          core.rotation.y += dt * 3;
          core.position.y = 1.6 + Math.sin(g.time * 3) * 0.2;
          fireT -= dt;
          if (fireT <= 0) {
            fireT = def.interval;
            const t = g.enemies.nearestTo(pos, def.range);
            if (t) {
              const o = pos.clone().setY(pos.y + 1.6);
              const v = new THREE.Vector3(t.pos.x - o.x, t.pos.y + 1 - o.y, t.pos.z - o.z).normalize().multiplyScalar(30);
              g.effects.projectile({ pos: o, vel: v, radius: 0.8, life: 1.2, team: 'player', color: col, kind: 'orb', size: 0.35, homing: () => (t.dead ? null : t.pos), turn: 6, onHit: (en) => this.hitEnemy(en, hit(def.mult)) });
            }
          }
        });
        break;
      }
      case 'storm':
        for (let i = 0; i < def.ticks; i++) {
          g.schedule(0.1 + i * def.interval, () => {
            const list = g.enemies.near(p.pos, def.radius);
            const e = list.length ? list[Math.floor(Math.random() * list.length)] : null;
            const pt = e ? e.pos.clone() : p.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * def.radius * 2, 0, (Math.random() - 0.5) * def.radius * 2));
            if (!e) pt.y = g.world.groundY(pt.x, pt.z);
            g.effects.pillar(pt, 0.6, 30, col, 0.25);
            g.effects.ring(pt, 2.5, col, 0.3);
            this.aoe(pt, 2.8, hit(def.mult));
          });
        }
        break;
      case 'blink': {
        if (target) {
          const back = new THREE.Vector3(target.pos.x - p.pos.x, 0, target.pos.z - p.pos.z).normalize();
          g.effects.burst(p.pos.clone().setY(p.pos.y + 1), 1.5, col, 0.3);
          p.teleport(target.pos.x + back.x * (target.radius + 1.2), target.pos.z + back.z * (target.radius + 1.2), g.world.realm.mode === 'underwater' ? target.pos.y : null);
          p.faceTo(target.pos);
        } else {
          p.startDash(fwd, 40, 0.2, true);
        }
        g.schedule(0.12, () => {
          g.effects.slash(p.pos, p.yaw, def.radius, col, 0.3, 0.3);
          g.effects.ring(p.pos, def.radius, col, 0.4);
          this.aoe(p.pos, def.radius, hit(def.mult, { knock: 3 }));
        });
        p.invulnUntil = g.time + 0.5;
        break;
      }
      case 'buff':
        p.healTeam(Math.round(stats.maxHp * def.heal * (1 + stats.healBonus)), true);
        g.effects.ring(p.pos, def.radius, col, 0.8);
        g.effects.pillar(p.pos, 4, 30, col, 0.8);
        this.aoe(p.pos, def.radius, hit(def.mult, { knock: 4 }));
        break;
      default: break;
    }
    if (def.buff) p.addBuff(def.buff, member);
    if (kind === 'burst') p.invulnUntil = Math.max(p.invulnUntil, g.time + 0.6);
    // Weapon passives triggered by casting.
    const pass = member.weapon.passive;
    if (kind === 'skill' && pass.onSkill) p.addBuff(pass.onSkill, member);
    if (kind === 'burst' && pass.onBurst) p.addBuff(pass.onBurst, member);
    if (kind === 'skill' && pass.onSkillEnergy) p.addEnergy(member, pass.onSkillEnergy, true);
    return skillCooldown(def.cd || 0, stats);
  }

  pull(e, center, amount) {
    if (e.def.boss || e.dead) return;
    const dx = center.x - e.pos.x, dz = center.z - e.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.6) return;
    const k = Math.min(amount, d - 0.5);
    e.pos.x += (dx / d) * k;
    e.pos.z += (dz / d) * k;
  }
}
