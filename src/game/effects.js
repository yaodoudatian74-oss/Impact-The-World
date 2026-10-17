// Visual effects and projectiles. Effects are pure visuals; projectiles carry a hit callback.

import * as THREE from 'three';
import { PRIM } from '../world/geo.js';

const RING = new THREE.RingGeometry(0.82, 1, 48);
const DISC = new THREE.CircleGeometry(1, 40);
const ARC = new THREE.RingGeometry(0.55, 1, 28, 1, -Math.PI * 0.6, Math.PI * 1.2);
const TWISTER = new THREE.CylinderGeometry(1, 0.25, 1, 14, 4, true);
const BEAM = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true);
const ARROW = new THREE.BoxGeometry(0.06, 0.06, 1.1);

function basic(color, opacity, additive = true) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
}

export class Effects {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.list = [];
    this.projectiles = [];
    this._v = new THREE.Vector3();
  }

  clear() {
    for (const e of this.list) this.dispose(e.obj);
    for (const p of this.projectiles) this.dispose(p.obj);
    this.list = [];
    this.projectiles = [];
  }

  dispose(obj) {
    this.group.remove(obj);
    obj.traverse((o) => { if (o.material) o.material.dispose(); });
  }

  add(obj, life, update) {
    this.group.add(obj);
    const e = { obj, life, max: life, update };
    this.list.push(e);
    return e;
  }

  // Expanding ground ring.
  ring(pos, radius, color, life = 0.45, y = 0.2) {
    const m = new THREE.Mesh(RING, basic(color, 0.9));
    m.rotation.x = -Math.PI / 2;
    m.position.set(pos.x, pos.y + y, pos.z);
    return this.add(m, life, (e, k) => { const s = radius * (0.3 + 0.7 * (1 - k)); m.scale.setScalar(s); m.material.opacity = k * 0.9; });
  }

  // Glowing sphere burst.
  burst(pos, radius, color, life = 0.35) {
    const m = new THREE.Mesh(PRIM.sphereMid, basic(color, 0.7));
    m.position.copy(pos);
    return this.add(m, life, (e, k) => { m.scale.setScalar(radius * (1.1 - k * 0.8)); m.material.opacity = k * 0.7; });
  }

  // Curved slash in front of an actor.
  slash(pos, yaw, radius, color, tilt = 0, life = 0.22) {
    const m = new THREE.Mesh(ARC, basic(color, 0.85));
    m.position.set(pos.x, pos.y + 1.1, pos.z);
    m.rotation.set(-Math.PI / 2 + tilt, 0, 0);
    const g = new THREE.Group();
    g.position.copy(m.position);
    m.position.set(0, 0, 0);
    g.rotation.y = yaw;
    m.rotation.z = Math.PI / 2;
    g.add(m);
    return this.add(g, life, (e, k) => { m.scale.setScalar(radius * (1.15 - k * 0.15)); m.rotation.z = Math.PI / 2 + (1 - k) * 0.6; m.material.opacity = k * 0.85; });
  }

  // Vertical pillar of light (lightning, holy beam, meteor trail).
  pillar(pos, radius, height, color, life = 0.4) {
    const m = new THREE.Mesh(BEAM, basic(color, 0.8));
    m.position.set(pos.x, pos.y + height / 2, pos.z);
    m.scale.set(radius, height, radius);
    return this.add(m, life, (e, k) => { m.material.opacity = k * 0.8; m.scale.x = m.scale.z = radius * k; });
  }

  // Horizontal beam from `from` along yaw.
  beam(from, yaw, length, width, color, life = 0.5) {
    const g = new THREE.Group();
    g.position.set(from.x, from.y + 1.1, from.z);
    g.rotation.y = yaw;
    const m = new THREE.Mesh(BEAM, basic(color, 0.85));
    m.rotation.x = Math.PI / 2;
    m.position.z = length / 2;
    m.scale.set(width / 2, length, width / 2);
    g.add(m);
    const core = new THREE.Mesh(BEAM, basic('#ffffff', 0.9));
    core.rotation.x = Math.PI / 2;
    core.position.z = length / 2;
    core.scale.set(width / 6, length, width / 6);
    g.add(core);
    return this.add(g, life, (e, k) => { m.material.opacity = k * 0.85; core.material.opacity = k; m.scale.x = m.scale.z = (width / 2) * (0.4 + k * 0.6); });
  }

  // Ground telegraph for incoming enemy attacks: fills up until it fires.
  telegraph(pos, radius, life, color = '#ff3a3a') {
    const g = new THREE.Group();
    g.position.set(pos.x, pos.y + 0.25, pos.z);
    const edge = new THREE.Mesh(RING, basic(color, 0.8, false));
    edge.rotation.x = -Math.PI / 2;
    edge.scale.setScalar(radius);
    const fill = new THREE.Mesh(DISC, basic(color, 0.28, false));
    fill.rotation.x = -Math.PI / 2;
    g.add(edge, fill);
    return this.add(g, life, (e, k) => { fill.scale.setScalar(radius * (1 - k)); });
  }

  telegraphLine(from, yaw, length, width, life, color = '#ff3a3a') {
    const g = new THREE.Group();
    g.position.set(from.x, from.y + 0.3, from.z);
    g.rotation.y = yaw;
    const m = new THREE.Mesh(PRIM.plane, basic(color, 0.3, false));
    m.rotation.x = -Math.PI / 2;
    m.position.z = length / 2;
    m.scale.set(width, length, 1);
    g.add(m);
    return this.add(g, life, (e, k) => { m.material.opacity = 0.2 + (1 - k) * 0.35; });
  }

  // Spinning vortex that follows `getPos` each frame.
  twister(getPos, radius, color, life) {
    const g = new THREE.Group();
    const a = new THREE.Mesh(TWISTER, basic(color, 0.45));
    const b = new THREE.Mesh(TWISTER, basic('#ffffff', 0.25));
    a.position.y = radius * 1.4; a.scale.set(radius, radius * 2.8, radius);
    b.position.y = radius * 1.2; b.scale.set(radius * 0.6, radius * 2.4, radius * 0.6);
    g.add(a, b);
    return this.add(g, life, (e, k, dt) => {
      g.position.copy(getPos());
      a.rotation.y += dt * 9; b.rotation.y -= dt * 12;
      const f = Math.min(1, k * 4, (1 - k) * 8 + 0.3);
      a.material.opacity = 0.45 * f; b.material.opacity = 0.25 * f;
    });
  }

  // Short-lived sparks flying outward.
  sparks(pos, color, count = 8, speed = 8, life = 0.5) {
    const g = new THREE.Group();
    g.position.copy(pos);
    const mat = basic(color, 1);
    const parts = [];
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(PRIM.octa, mat);
      m.scale.setScalar(0.12);
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8 + 0.2, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.5 + Math.random() * 0.5));
      parts.push({ m, v });
      g.add(m);
    }
    return this.add(g, life, (e, k, dt) => {
      for (const p of parts) { p.m.position.addScaledVector(p.v, dt); p.v.y -= 14 * dt; }
      mat.opacity = k;
    });
  }

  // Falling object (meteor, holy spear) that lands at `pos` after `delay`.
  faller(pos, color, size, delay) {
    const m = new THREE.Mesh(PRIM.sphereMid, basic(color, 0.95));
    const g = new THREE.Group();
    g.add(m);
    const trail = new THREE.Mesh(BEAM, basic(color, 0.4));
    trail.position.y = size * 3;
    trail.scale.set(size * 0.7, size * 6, size * 0.7);
    g.add(trail);
    g.position.set(pos.x, pos.y + 60, pos.z);
    m.scale.setScalar(size);
    return this.add(g, delay, (e, k) => { g.position.y = pos.y + 60 * k; });
  }

  // ------------------------------------------------------------- projectiles
  // opts: { pos, vel, radius, life, team, color, kind ('orb'|'arrow'), homing (target getter), turn, pierce, onHit(target), onEnd(pos) }
  projectile(opts) {
    const g = new THREE.Group();
    if (opts.kind === 'arrow') {
      const shaft = new THREE.Mesh(ARROW, basic(opts.color, 0.95));
      g.add(shaft);
      const tip = new THREE.Mesh(PRIM.octa, basic('#ffffff', 0.9));
      tip.scale.setScalar(0.12);
      tip.position.z = 0.55;
      g.add(tip);
    } else {
      const core = new THREE.Mesh(PRIM.sphereMid, basic('#ffffff', 0.95));
      core.scale.setScalar((opts.size || 0.35) * 0.5);
      const halo = new THREE.Mesh(PRIM.sphereMid, basic(opts.color, 0.6));
      halo.scale.setScalar(opts.size || 0.35);
      g.add(core, halo);
    }
    g.position.copy(opts.pos);
    this.group.add(g);
    const p = { ...opts, obj: g, age: 0, hits: new Set(), pos: opts.pos.clone(), vel: opts.vel.clone() };
    this.projectiles.push(p);
    return p;
  }

  // targetsFor(p) returns candidate targets with {pos (Vector3), radius}.
  tick(dt, targetsFor, groundAt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      e.life -= dt;
      if (e.life <= 0) { this.dispose(e.obj); this.list.splice(i, 1); continue; }
      e.update(e, e.life / e.max, dt);
    }
    const v = this._v;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.age += dt;
      let dead = p.age >= p.life;
      if (!dead && p.homing) {
        const t = p.homing();
        if (t) {
          v.copy(t).sub(p.pos);
          v.y += 0.8;
          const speed = p.vel.length();
          v.normalize().multiplyScalar(speed);
          p.vel.lerp(v, Math.min(1, (p.turn || 4) * dt));
          p.vel.setLength(speed);
        }
      }
      if (!dead) {
        p.pos.addScaledVector(p.vel, dt);
        if (groundAt && p.pos.y < groundAt(p.pos.x, p.pos.z) - 0.2 && !p.ignoreGround) dead = true;
        for (const t of targetsFor(p)) {
          if (p.hits.has(t)) continue;
          const dx = t.pos.x - p.pos.x, dz = t.pos.z - p.pos.z, dy = (t.pos.y + (t.height || 1)) - p.pos.y;
          const rr = p.radius + t.radius;
          if (dx * dx + dz * dz < rr * rr && Math.abs(dy) < rr + (t.height || 1)) {
            p.hits.add(t);
            p.onHit?.(t, p);
            if (!p.pierce) { dead = true; break; }
          }
        }
      }
      if (dead) {
        p.onEnd?.(p.pos, p);
        this.dispose(p.obj);
        this.projectiles.splice(i, 1);
        continue;
      }
      p.obj.position.copy(p.pos);
      if (p.vel.lengthSq() > 0.01) p.obj.lookAt(v.copy(p.pos).add(p.vel));
    }
  }
}
