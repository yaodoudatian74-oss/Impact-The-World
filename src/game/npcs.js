// Non-player characters: townsfolk, quest givers and story characters waiting to be recruited.

import * as THREE from 'three';
import { CHARACTERS, WEAPONS } from '../data/characters.js';
import { buildHumanoid, buildCharacterModel, animateHumanoid } from '../world/models.js';
import { dampAngle } from '../core/math.js';

let markerTex = null;
function markerTexture() {
  if (markerTex) return markerTex;
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#ffd36a';
  g.strokeStyle = '#5a3a00';
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(32, 6); g.lineTo(54, 30); g.lineTo(32, 54); g.lineTo(10, 30); g.closePath();
  g.fill(); g.stroke();
  g.font = 'bold 40px sans-serif';
  g.textAlign = 'center';
  g.fillStyle = '#5a3a00';
  g.fillText('!', 32, 45);
  g.fillStyle = 'rgba(255,211,106,0.35)';
  g.fillRect(28, 60, 8, 60);
  markerTex = new THREE.CanvasTexture(c);
  return markerTex;
}

export class NPCs {
  constructor(game) {
    this.game = game;
    this.group = new THREE.Group();
    game.scene.add(this.group);
    this.list = [];
  }

  clear() {
    for (const n of this.list) this.group.remove(n.root);
    this.list = [];
  }

  // spec: { id, name, x, z, look | char, lines, kind: 'folk'|'giver'|'step', chapterId }
  add(spec) {
    this.remove(spec.id);
    let model, name = spec.name;
    if (spec.char) {
      const def = CHARACTERS[spec.char];
      model = buildCharacterModel(def, WEAPONS[def.weaponId]);
      name = name || def.name;
    } else model = buildHumanoid(spec.look);
    const root = new THREE.Group();
    root.add(model.root);
    const y = this.game.world.groundY(spec.x, spec.z);
    root.position.set(spec.x, y, spec.z);
    const n = { ...spec, name, model, root, x: spec.x, y, z: spec.z, yaw: Math.random() * 6.28, t: Math.random() * 10, marker: null };
    if (spec.kind === 'giver' || spec.kind === 'step') {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: markerTexture(), depthTest: false, transparent: true }));
      sp.scale.set(0.9, 1.8, 1);
      sp.position.y = 2.9;
      sp.renderOrder = 10;
      root.add(sp);
      n.marker = sp;
    }
    root.rotation.y = n.yaw;
    this.group.add(root);
    this.list.push(n);
    return n;
  }

  remove(id) {
    const i = this.list.findIndex((n) => n.id === id);
    if (i < 0) return;
    this.group.remove(this.list[i].root);
    this.list.splice(i, 1);
  }

  get(id) { return this.list.find((n) => n.id === id); }

  nearest(pos, r) {
    let best = null, bd = r;
    for (const n of this.list) {
      const d = Math.hypot(n.x - pos.x, n.z - pos.z);
      if (d < bd && Math.abs(n.y - pos.y) < 4) { bd = d; best = n; }
    }
    return best;
  }

  pushOut(pos, radius) {
    for (const n of this.list) {
      const dx = pos.x - n.x, dz = pos.z - n.z;
      const d = Math.hypot(dx, dz), min = radius + 0.45;
      if (d < min && d > 0.001 && Math.abs(pos.y - n.y) < 2) { pos.x = n.x + (dx / d) * min; pos.z = n.z + (dz / d) * min; }
    }
  }

  tick(dt) {
    const p = this.game.player.pos;
    for (const n of this.list) {
      n.t += dt;
      const d = Math.hypot(p.x - n.x, p.z - n.z);
      n.root.visible = d < 240;
      if (!n.root.visible) continue;
      if (d < 9) n.yaw = dampAngle(n.yaw, Math.atan2(p.x - n.x, p.z - n.z), 5, dt);
      n.root.rotation.y = n.yaw;
      if (n.marker) n.marker.position.y = 2.9 + Math.sin(n.t * 3) * 0.12;
      animateHumanoid(n.model, { t: n.t, speed: 0 });
    }
  }
}
