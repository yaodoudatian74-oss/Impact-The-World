// Enemy spawning (world camps, quest enemies, bosses), AI and attack patterns.

import * as THREE from 'three';
import { ENEMIES } from '../data/enemies.js';
import { ELEMENTS } from '../data/elements.js';
import { enemyLevelAt, WORLD_HALF, CHUNK } from '../data/realms.js';
import { enemyStats, enemyExp, addExp } from './rules.js';
import { buildEnemyModel } from '../world/models.js';
import { damp, dampAngle, clamp } from '../core/math.js';

const SHAPE = {
  slime: [0.55, 1.0], beast: [0.6, 1.3], humanoid: [0.45, 1.8], golem: [0.85, 2.3], spirit: [0.55, 1.7], jelly: [0.6, 1.8],
  fish: [0.65, 1.3], dragon: [1.1, 2.4], serpent: [1.0, 2.2], kraken: [1.3, 3.8], drone: [0.6, 1.5],
};
const CAMP_RADIUS = 2; // chunks around the player with live camps
const RESPAWN = 300; // seconds before a cleared camp returns

const ecol = (e) => (e ? ELEMENTS[e].color : '#ffffff');

export class Enemies {
  constructor(game) {
    this.game = game;
    this.group = new THREE.Group();
    game.scene.add(this.group);
    this.list = [];
    this.camps = new Map();
    this.campKilled = new Map();
    this.campSpecs = new Map();
    this.campTimer = 0;
    this.nextId = 1;
  }

  clear() {
    for (const e of this.list) this.group.remove(e.model.root);
    this.list = [];
    this.camps.clear();
    this.campSpecs.clear();
  }

  spawn(defId, lv, x, z, opts = {}) {
    const def = ENEMIES[defId];
    const g = this.game;
    const st = enemyStats(defId, lv);
    const size = def.size || 1;
    const [r, h] = SHAPE[def.model] || [0.6, 1.6];
    const model = buildEnemyModel(def);
    const gy = g.world.groundY(x, z);
    const y = opts.y ?? (g.world.realm.mode === 'underwater' ? gy + 2 + (def.float || 0) : gy + (def.float || 0));
    const e = {
      id: this.nextId++, defId, def, lv, maxHp: st.maxHp, hp: st.maxHp, atk: st.atk,
      pos: new THREE.Vector3(x, y, z), prevPos: new THREE.Vector3(x, y, z), yaw: Math.random() * 6.28,
      home: new THREE.Vector3(x, y, z), wander: null, wanderT: Math.random() * 3,
      state: 'idle', attack: null, cd: 1 + Math.random(), knock: new THREE.Vector3(),
      aura: null, auraUntil: 0, auraRegen: 0, innate: def.element && ELEMENTS[def.element].aura ? def.element : null,
      icd: {}, frozenUntil: 0, resDownUntil: 0, flash: 0, lastHit: -99,
      radius: r * size, height: h * size, model, dead: false, deathT: 0, t: Math.random() * 10,
      camp: opts.camp ?? null, quest: opts.quest ?? null, boss: !!def.boss, minion: !!opts.minion,
      phase2: false, leash: def.boss ? 160 : 70, speedMul: 1,
    };
    if (e.innate) e.aura = e.innate;
    model.root.position.copy(e.pos);
    this.group.add(model.root);
    this.list.push(e);
    return e;
  }

  remove(e) {
    this.group.remove(e.model.root);
    const i = this.list.indexOf(e);
    if (i >= 0) this.list.splice(i, 1);
  }

  near(pos, r) {
    const out = [];
    for (const e of this.list) {
      if (e.dead) continue;
      const dx = e.pos.x - pos.x, dz = e.pos.z - pos.z;
      const rr = r + e.radius;
      if (dx * dx + dz * dz <= rr * rr && Math.abs(e.pos.y + e.height * 0.5 - pos.y) < r + e.height) out.push(e);
    }
    return out;
  }

  nearestTo(pos, r) {
    let best = null, bd = Infinity;
    for (const e of this.list) {
      if (e.dead) continue;
      const dx = e.pos.x - pos.x, dz = e.pos.z - pos.z, dy = e.pos.y - pos.y;
      const d = Math.sqrt(dx * dx + dz * dz + dy * dy * 0.5) - e.radius;
      if (d < r && d < bd) { bd = d; best = e; }
    }
    return best;
  }

  kill(e) {
    if (e.dead) return;
    const g = this.game;
    e.dead = true;
    e.deathT = 0;
    e.hp = 0;
    g.effects.burst(e.pos.clone().setY(e.pos.y + e.height * 0.5), e.radius * 2 + 1, ecol(e.def.element), 0.5);
    g.effects.sparks(e.pos.clone().setY(e.pos.y + 1), '#ffffff', e.boss ? 30 : 10, e.boss ? 14 : 7, 0.7);
    const kind = e.boss ? 'boss' : e.def.elite ? 'elite' : 'normal';
    // Experience: party members get the full amount, everyone else in the roster 60%.
    const party = new Set(g.player.members.map((m) => m.id));
    for (const [id, entry] of Object.entries(g.save.roster)) {
      const amount = Math.round(enemyExp(e.lv, entry.lv, kind) * (party.has(id) ? 1 : 0.6));
      const up = addExp(entry, amount);
      if (up > 0) g.onLevelUp(id, entry.lv);
    }
    const drop = e.boss ? 2 : e.def.elite ? (Math.random() < 0.35 ? 1 : 0) : (Math.random() < 0.08 ? 1 : 0);
    if (drop) { g.save.potions += drop; g.ui.toast(`回復薬 ×${drop} を手に入れた`, '#7dff9a', true); }
    g.quests.onEnemyKilled(e);
    if (e.camp !== null) {
      const alive = this.list.some((o) => o !== e && !o.dead && o.camp === e.camp);
      if (!alive) { this.campKilled.set(e.camp, g.time); this.camps.delete(e.camp); }
    }
    if (e.boss) { g.camera.shake(1); g.audio.play('boom'); }
  }

  // ---------------------------------------------------------------- world camps
  campSpec(cx, cz) {
    const k = cz * 64 + cx;
    if (this.campSpecs.has(k)) return this.campSpecs.get(k);
    const g = this.game, world = g.world, T = world.T, realm = world.realm;
    const r = T.chunkRng(cx, cz, 777);
    let spec = null;
    if (r() < 0.32) {
      const x0 = -WORLD_HALF + cx * CHUNK, z0 = -WORLD_HALF + cz * CHUNK;
      for (let i = 0; i < 6 && !spec; i++) {
        const x = x0 + 16 + r() * (CHUNK - 32), z = z0 + 16 + r() * (CHUNK - 32);
        if (Math.hypot(x - realm.hub.x, z - realm.hub.z) < 260) continue;
        if (!this.standable(x, z, null)) continue;
        if (T.zones.some((zn) => zn.kind === 'arena' && Math.hypot(x - zn.x, z - zn.z) < zn.r + 40)) continue;
        const lv = clamp(enemyLevelAt(realm, x, z) + Math.round(r() * 2 - 1), realm.levels[0], realm.levels[1]);
        const pool = realm.enemies;
        const elites = pool.filter((id) => ENEMIES[id].elite);
        const normals = pool.filter((id) => !ENEMIES[id].elite);
        let members;
        if (elites.length && r() < 0.16) members = [elites[Math.floor(r() * elites.length)]];
        else {
          const main = normals[Math.floor(r() * normals.length)];
          const other = normals[Math.floor(r() * normals.length)];
          const n = 2 + Math.floor(r() * 3);
          members = Array.from({ length: n }, (_, j) => (j === n - 1 && r() < 0.4 ? other : main));
        }
        spec = { x, z, lv, members };
      }
    }
    this.campSpecs.set(k, spec);
    return spec;
  }

  standable(x, z, def) {
    const w = this.game.world;
    if (w.realm.mode === 'underwater' || (def && def.float)) return true;
    const h = w.T.height(x, z);
    if (w.waterLevel !== null && h < w.waterLevel - 1.2) return false;
    if (w.lavaLevel !== null && h < w.lavaLevel + 1) return false;
    if (w.cloudSea !== null && h < 5) return false;
    return true;
  }

  streamCamps() {
    const g = this.game, p = g.player.pos;
    const pcx = g.world.chunkCoord(p.x), pcz = g.world.chunkCoord(p.z);
    for (let dz = -CAMP_RADIUS; dz <= CAMP_RADIUS; dz++) for (let dx = -CAMP_RADIUS; dx <= CAMP_RADIUS; dx++) {
      const cx = pcx + dx, cz = pcz + dz;
      if (cx < 0 || cz < 0 || cx >= 64 || cz >= 64) continue;
      const k = cz * 64 + cx;
      if (this.camps.has(k)) continue;
      const killed = this.campKilled.get(k);
      if (killed !== undefined && g.time - killed < RESPAWN) continue;
      const spec = this.campSpec(cx, cz);
      if (!spec) continue;
      const list = spec.members.map((id, i) => {
        const a = (i / spec.members.length) * Math.PI * 2;
        return this.spawn(id, spec.lv, spec.x + Math.cos(a) * 5, spec.z + Math.sin(a) * 5, { camp: k });
      });
      this.camps.set(k, list);
    }
    for (const [k, list] of this.camps) {
      const cx = k % 64, cz = Math.floor(k / 64);
      if (Math.max(Math.abs(cx - pcx), Math.abs(cz - pcz)) <= CAMP_RADIUS + 1) continue;
      if (list.some((e) => !e.dead && (e.state === 'chase' || e.attack))) continue;
      for (const e of list) if (!e.dead) this.remove(e);
      this.camps.delete(k);
    }
  }

  // ---------------------------------------------------------------- AI
  tick(dt) {
    const g = this.game;
    this.campTimer -= dt;
    if (this.campTimer <= 0) { this.campTimer = 0.5; this.streamCamps(); }
    const p = g.player;
    const pp = p.pos;
    const under = g.world.realm.mode === 'underwater';
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      e.prevPos.copy(e.pos);
      e.t += dt;
      e.flash = Math.max(0, e.flash - dt);
      if (e.dead) {
        e.deathT += dt;
        if (e.deathT > 0.7) this.remove(e);
        continue;
      }
      if (!e.aura && e.innate && g.time > e.auraRegen) e.aura = e.innate;
      if (e.aura && e.aura !== e.innate && g.time > e.auraUntil) e.aura = e.innate;
      const dx = pp.x - e.pos.x, dz = pp.z - e.pos.z;
      const dist = Math.hypot(dx, dz);
      // Far-away enemies sleep (quest and boss enemies included, they keep their state).
      if (dist > 220 && !e.boss) continue;
      if (g.time < e.frozenUntil) { e.attack = null; continue; }

      // Knockback
      if (e.knock.lengthSq() > 0.01) {
        e.pos.addScaledVector(e.knock, dt * 6);
        e.knock.multiplyScalar(Math.max(0, 1 - dt * 6));
      }
      // Phase two for bosses
      if (e.boss && !e.phase2 && e.hp < e.maxHp * 0.5) {
        e.phase2 = true;
        e.speedMul = 1.25;
        g.ui.banner(`${e.def.name}が怒り狂っている！`, '攻撃が激しくなった', '#ff6a6a');
        g.effects.ring(e.pos, 12, '#ff3a3a', 0.8);
      }

      const aggro = e.boss ? 60 : e.quest ? 40 : 20;
      const inHub = Math.hypot(pp.x - g.world.realm.hub.x, pp.z - g.world.realm.hub.z) < 140;
      if (e.state === 'idle' && dist < aggro && !p.dead && !inHub) e.state = 'chase';
      if (e.state === 'chase') {
        const fromHome = Math.hypot(e.pos.x - e.home.x, e.pos.z - e.home.z);
        if (p.dead || inHub || dist > (e.boss ? 140 : 50) || fromHome > e.leash) { e.state = 'return'; e.attack = null; }
      }

      if (e.attack) this.runAttack(e, dt, dist);
      else if (e.state === 'chase') {
        e.cd -= dt;
        const prefer = e.def.keepAway || (2 + e.radius);
        let mvx = 0, mvz = 0;
        if (dist > prefer) { mvx = dx / dist; mvz = dz / dist; }
        else if (e.def.keepAway && dist < prefer * 0.6) { mvx = -dx / dist; mvz = -dz / dist; }
        if (e.def.keepAway) { mvx += (-dz / dist) * 0.4 * Math.sin(e.t * 0.7); mvz += (dx / dist) * 0.4 * Math.sin(e.t * 0.7); }
        this.move(e, mvx, mvz, e.def.speed * e.speedMul, dt);
        e.yaw = dampAngle(e.yaw, Math.atan2(dx, dz), 8, dt);
        if (e.cd <= 0) this.chooseAttack(e, dist);
      } else if (e.state === 'return') {
        const hx = e.home.x - e.pos.x, hz = e.home.z - e.pos.z;
        const hd = Math.hypot(hx, hz);
        if (hd < 2) { e.state = 'idle'; e.hp = e.maxHp; }
        else { this.move(e, hx / hd, hz / hd, e.def.speed * 1.4, dt); e.yaw = dampAngle(e.yaw, Math.atan2(hx, hz), 6, dt); }
      } else {
        // Idle wander around home
        e.wanderT -= dt;
        if (e.wanderT <= 0) {
          e.wanderT = 3 + Math.random() * 4;
          e.wander = Math.random() < 0.6 ? new THREE.Vector3(e.home.x + (Math.random() - 0.5) * 14, 0, e.home.z + (Math.random() - 0.5) * 14) : null;
        }
        if (e.wander) {
          const wx = e.wander.x - e.pos.x, wz = e.wander.z - e.pos.z;
          const wd = Math.hypot(wx, wz);
          if (wd > 1) { this.move(e, wx / wd, wz / wd, e.def.speed * 0.35, dt); e.yaw = dampAngle(e.yaw, Math.atan2(wx, wz), 4, dt); }
          else e.wander = null;
        }
      }

      // Height: hover or stand
      const gy = g.world.groundY(e.pos.x, e.pos.z);
      if (under) {
        const want = e.state === 'chase' ? clamp(pp.y + 0.3, gy + 0.8, g.world.surface - 2) : gy + 2 + (e.def.float || 0);
        e.pos.y = clamp(damp(e.pos.y, want, 2, dt), gy + 0.3, g.world.surface - 1);
      } else if (!(e.attack && e.attack.airborne)) {
        const want = gy + (e.def.float || 0);
        e.pos.y = e.def.float ? damp(e.pos.y, want, 5, dt) : want;
      }
      if (dist < 60) g.world.resolveCollisions(e.pos, e.radius * 0.8);
    }
    // Keep enemies from stacking on the player.
    for (const e of this.list) {
      if (e.dead) continue;
      const dx = e.pos.x - pp.x, dz = e.pos.z - pp.z;
      const d = Math.hypot(dx, dz);
      const min = e.radius + 0.5;
      if (d < min && d > 0.01 && Math.abs(e.pos.y - pp.y) < e.height) { e.pos.x = pp.x + (dx / d) * min; e.pos.z = pp.z + (dz / d) * min; }
    }
  }

  move(e, mx, mz, speed, dt) {
    const nx = e.pos.x + mx * speed * dt, nz = e.pos.z + mz * speed * dt;
    if (!this.standable(nx, nz, e.def)) return;
    if (!e.boss && Math.hypot(nx - this.game.world.realm.hub.x, nz - this.game.world.realm.hub.z) < 135) return;
    e.pos.x = nx;
    e.pos.z = nz;
  }

  chooseAttack(e, dist) {
    const options = e.def.attacks.filter((a) => dist <= ATTACKS[a].range(e));
    if (!options.length) { e.cd = 0.2; return; }
    if (e.def.attacks.includes('summon') && this.list.filter((o) => o.minion && !o.dead).length >= 5) {
      const i = options.indexOf('summon');
      if (i >= 0) options.splice(i, 1);
      if (!options.length) { e.cd = 0.2; return; }
    }
    const name = options[Math.floor(Math.random() * options.length)];
    e.attack = { name, t: 0, done: false, fired: 0, airborne: false };
    ATTACKS[name].start(e, this.game);
  }

  runAttack(e, dt, dist) {
    const a = e.attack;
    const def = ATTACKS[a.name];
    a.t += dt;
    def.update(e, this.game, dt, a, dist);
    if (a.t >= def.dur) {
      e.attack = null;
      const base = e.boss ? 0.7 + Math.random() * 0.9 : e.def.elite ? 1.2 + Math.random() : 1.6 + Math.random() * 1.4;
      e.cd = base * (e.phase2 ? 0.7 : 1);
    }
  }

  // ---------------------------------------------------------------- rendering
  render(alpha) {
    for (const e of this.list) {
      const m = e.model;
      m.root.position.lerpVectors(e.prevPos, e.pos, alpha);
      m.root.rotation.y = e.yaw;
      const moving = e.prevPos.distanceToSquared(e.pos) > 1e-5;
      m.anim({ t: e.t, speed: moving ? 1 : 0, phase: e.attack ? e.attack.t / ATTACKS[e.attack.name].dur : 0, attacking: !!e.attack });
      const frozen = this.game.time < e.frozenUntil;
      const em = e.flash > 0 ? 0.9 : frozen ? 0.6 : 0;
      for (const mat of m.mats) {
        if (!mat.emissive) continue;
        if (!mat.userData.baseE) mat.userData.baseE = { c: mat.emissive.clone(), i: mat.emissiveIntensity };
        if (em > 0) { mat.emissive.set(frozen && e.flash <= 0 ? '#88ccff' : '#ffffff'); mat.emissiveIntensity = em; }
        else { mat.emissive.copy(mat.userData.baseE.c); mat.emissiveIntensity = mat.userData.baseE.i; }
      }
      if (e.dead) {
        const k = Math.max(0, 1 - e.deathT / 0.7);
        m.root.scale.setScalar((e.def.size || 1) * k);
      }
    }
  }
}

// ------------------------------------------------------------------------------------------------
// Attack patterns. range(e) decides when the AI may pick it; update runs every tick while active.

function hurtIf(g, e, cond, mult) {
  if (cond) g.combat.hurtPlayer({ atk: e.atk, lv: e.lv, mult, element: e.def.element, pos: e.pos });
}
const facing = (e, g) => { const p = g.player.pos; e.yaw = Math.atan2(p.x - e.pos.x, p.z - e.pos.z); };
const toPlayer = (e, g) => new THREE.Vector3(g.player.pos.x - e.pos.x, 0, g.player.pos.z - e.pos.z).normalize();
const pdist = (e, g) => Math.hypot(g.player.pos.x - e.pos.x, g.player.pos.z - e.pos.z);
const vdist = (e, g) => Math.abs(g.player.pos.y + 1 - (e.pos.y + e.height * 0.5));

function enemyShot(g, e, dir, speed, mult, size = 0.4) {
  const o = e.pos.clone().setY(e.pos.y + e.height * 0.6);
  g.effects.projectile({
    pos: o, vel: dir.clone().multiplyScalar(speed), radius: size + 0.15, life: 3, team: 'enemy', color: ecol(e.def.element) === '#ffffff' ? '#ff5a5a' : ecol(e.def.element), kind: 'orb', size,
    onHit: () => hurtIf(g, e, true, mult),
  });
}

const ATTACKS = {
  melee: {
    dur: 1.0, range: (e) => 2.6 + e.radius,
    start: (e, g) => { facing(e, g); },
    update(e, g, dt, a) {
      if (a.t > 0.3 && a.t < 0.5) { const d = toPlayer(e, g); e.pos.x += d.x * 7 * dt; e.pos.z += d.z * 7 * dt; }
      if (!a.done && a.t >= 0.5) {
        a.done = true;
        g.effects.slash(e.pos, e.yaw, 2.2 + e.radius, '#ff6a5a', 0, 0.2);
        hurtIf(g, e, pdist(e, g) < 2.8 + e.radius && vdist(e, g) < 2.5 + e.height * 0.5, 1.0);
      }
    },
  },
  hop: {
    dur: 1.0, range: () => 9,
    start: (e, g, a = e.attack) => { a.from = e.pos.clone(); a.to = g.player.pos.clone(); a.airborne = true; facing(e, g); },
    update(e, g, dt, a) {
      const k = clamp((a.t - 0.2) / 0.6, 0, 1);
      if (a.t >= 0.2 && a.t < 0.8) {
        e.pos.x = a.from.x + (a.to.x - a.from.x) * k;
        e.pos.z = a.from.z + (a.to.z - a.from.z) * k;
        const gy = g.world.groundY(e.pos.x, e.pos.z);
        e.pos.y = Math.max(gy, gy + Math.sin(k * Math.PI) * (2 + e.radius * 2));
        if (g.world.realm.mode === 'underwater') e.pos.y = a.from.y + (a.to.y - a.from.y) * k + Math.sin(k * Math.PI) * 2;
      }
      if (!a.done && a.t >= 0.8) {
        a.done = true;
        a.airborne = false;
        const r = 1.6 + e.radius * 1.2;
        g.effects.ring(e.pos, r, ecol(e.def.element), 0.35);
        if (e.boss) g.camera.shake(0.5);
        hurtIf(g, e, pdist(e, g) < r && vdist(e, g) < 3 + e.height * 0.3, 1.1);
      }
    },
  },
  shoot: {
    dur: 0.9, range: (e) => (e.boss ? 38 : 26),
    start: (e, g) => facing(e, g),
    update(e, g, dt, a) {
      facing(e, g);
      if (!a.done && a.t >= 0.5) {
        a.done = true;
        const o = e.pos.clone().setY(e.pos.y + e.height * 0.6);
        const target = g.player.pos.clone().setY(g.player.pos.y + 1);
        const dir = target.sub(o).normalize();
        const n = e.boss ? 3 : 1;
        for (let i = 0; i < n; i++) enemyShot(g, e, dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), (i - (n - 1) / 2) * 0.2), e.boss ? 26 : 22, 0.9);
        g.audio.play('shoot');
      }
    },
  },
  slam: {
    dur: 1.5, range: (e) => 3 + e.radius * 2,
    start(e, g) {
      const a = e.attack;
      a.r = Math.min(3.5 + e.radius * 2.5, 15);
      g.effects.telegraph(e.pos, a.r, 1.1);
    },
    update(e, g, dt, a) {
      if (!a.done && a.t >= 1.1) {
        a.done = true;
        g.effects.ring(e.pos, a.r, '#ffb08a', 0.45);
        g.effects.sparks(e.pos.clone().setY(e.pos.y + 0.5), '#d0a080', 14, 10, 0.6);
        g.camera.shake(e.boss ? 0.8 : 0.35);
        g.audio.play('boom');
        hurtIf(g, e, pdist(e, g) < a.r && vdist(e, g) < 3 + e.height * 0.4, 1.7);
      }
    },
  },
  charge: {
    dur: 1.4, range: () => 22,
    start(e, g) { facing(e, g); g.effects.telegraphLine(e.pos, e.yaw, 18, e.radius * 2 + 1, 0.5); },
    update(e, g, dt, a) {
      if (a.t >= 0.5 && a.t < 1.1) {
        const sp = Math.max(e.def.speed * 2.6, 18);
        const nx = e.pos.x + Math.sin(e.yaw) * sp * dt, nz = e.pos.z + Math.cos(e.yaw) * sp * dt;
        if (g.enemies.standable(nx, nz, e.def)) { e.pos.x = nx; e.pos.z = nz; }
        if (!a.done && pdist(e, g) < e.radius + 1.3 && vdist(e, g) < 2.5 + e.height * 0.3) { a.done = true; hurtIf(g, e, true, 1.3); }
      }
    },
  },
  ring: {
    dur: 1.1, range: (e) => (e.boss ? 30 : 20),
    start(e, g) { g.effects.burst(e.pos.clone().setY(e.pos.y + e.height * 0.5), e.radius + 1, ecol(e.def.element), 0.6); },
    update(e, g, dt, a) {
      if (!a.done && a.t >= 0.6) {
        a.done = true;
        const n = e.boss ? 16 : 10;
        const off = Math.random();
        for (let i = 0; i < n; i++) {
          const ang = ((i + off) / n) * Math.PI * 2;
          enemyShot(g, e, new THREE.Vector3(Math.sin(ang), 0, Math.cos(ang)), 14, 0.75, 0.45);
        }
      }
    },
  },
  breath: {
    dur: 1.5, range: () => 17,
    start: (e, g) => facing(e, g),
    update(e, g, dt, a) {
      if (a.t < 0.5) facing(e, g);
      if (a.t >= 0.5 && a.t < 1.2) {
        a.acc = (a.acc || 0) + dt;
        if (a.acc >= 0.08) {
          a.acc = 0;
          const dir = new THREE.Vector3(Math.sin(e.yaw), 0, Math.cos(e.yaw)).applyAxisAngle(new THREE.Vector3(0, 1, 0), (Math.random() - 0.5) * 0.7);
          const o = e.pos.clone().setY(e.pos.y + e.height * 0.6);
          const tgt = g.player.pos.clone().setY(g.player.pos.y + 1);
          dir.y = (tgt.y - o.y) / Math.max(4, o.distanceTo(tgt));
          enemyShot(g, e, dir.normalize(), 20, 0.55, 0.5);
        }
      }
    },
  },
  summon: {
    dur: 1.2, range: () => 40,
    start(e, g) { g.effects.ring(e.pos, 6, '#c08aff', 0.8); },
    update(e, g, dt, a) {
      if (!a.done && a.t >= 0.6) {
        a.done = true;
        const id = e.def.summon || e.defId;
        for (let i = 0; i < 3; i++) {
          const ang = Math.random() * Math.PI * 2;
          const m = g.enemies.spawn(id, Math.max(1, e.lv - 3), e.pos.x + Math.cos(ang) * 6, e.pos.z + Math.sin(ang) * 6, { minion: true, quest: null });
          m.state = 'chase';
          m.leash = 999;
          g.effects.burst(m.pos.clone().setY(m.pos.y + 1), 1.5, '#c08aff', 0.4);
        }
      }
    },
  },
  meteor: {
    dur: 2.0, range: () => 40,
    start(e, g) {
      const a = e.attack;
      const p = g.player.pos;
      a.pts = [p.clone()];
      for (let i = 0; i < (e.boss ? 3 : 1); i++) a.pts.push(p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 14, 0, (Math.random() - 0.5) * 14)));
      for (const pt of a.pts) {
        if (g.world.realm.mode !== 'underwater') pt.y = g.world.groundY(pt.x, pt.z);
        g.effects.telegraph(pt, 4.5, 1.4);
        g.effects.faller(pt, ecol(e.def.element) === '#ffffff' ? '#ff6a3a' : ecol(e.def.element), 1.2, 1.4);
      }
    },
    update(e, g, dt, a) {
      if (!a.done && a.t >= 1.4) {
        a.done = true;
        g.camera.shake(0.6);
        g.audio.play('boom');
        let hit = false;
        for (const pt of a.pts) {
          g.effects.burst(pt.clone().setY(pt.y + 1), 4.5, '#ff8a4a', 0.4);
          if (!hit && Math.hypot(g.player.pos.x - pt.x, g.player.pos.z - pt.z) < 4.5 && Math.abs(g.player.pos.y - pt.y) < 4) hit = true;
        }
        hurtIf(g, e, hit, 1.5);
      }
    },
  },
  laser: {
    dur: 1.8, range: () => 32,
    start(e, g) {
      facing(e, g);
      e.attack.yaw = e.yaw;
      g.effects.telegraphLine(e.pos, e.yaw, 34, 3, 1.2);
    },
    update(e, g, dt, a) {
      e.yaw = a.yaw;
      if (!a.done && a.t >= 1.2) {
        a.done = true;
        g.effects.beam(e.pos, a.yaw, 34, 3, ecol(e.def.element) === '#ffffff' ? '#ff4a6a' : ecol(e.def.element), 0.5);
        g.camera.shake(0.4);
        const p = g.player.pos;
        const fx = Math.sin(a.yaw), fz = Math.cos(a.yaw);
        const dx = p.x - e.pos.x, dz = p.z - e.pos.z;
        const along = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx);
        hurtIf(g, e, along > 0 && along < 34 && side < 2 && Math.abs(p.y - e.pos.y) < 4, 1.9);
      }
    },
  },
};

export const ENEMY_ATTACKS = Object.keys(ATTACKS);
