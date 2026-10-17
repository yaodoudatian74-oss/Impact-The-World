// Third-person orbit camera with terrain avoidance and shake.

import * as THREE from 'three';
import { clamp } from '../core/math.js';

export class CameraRig {
  constructor(camera) {
    this.cam = camera;
    this.yaw = Math.PI;
    this.pitch = 0.28;
    this.dist = 8;
    this.target = new THREE.Vector3();
    this.shakeAmt = 0;
    this.punchT = 0;
    this._o = new THREE.Vector3();
  }

  shake(a) { this.shakeAmt = Math.max(this.shakeAmt, a); }
  punch() { this.punchT = 0.6; }

  snap(focus) { this.target.set(focus.x, focus.y + 1.6, focus.z); }

  update(dt, focus, input, world) {
    const look = input.takeLook();
    this.yaw -= look.dx * 0.0032;
    this.pitch = clamp(this.pitch + look.dy * 0.0028, -0.55, 1.35);
    this.dist = clamp(this.dist + input.takeZoom() * 0.9, 3, 20);
    const k = 1 - Math.exp(-14 * dt);
    this.target.x += (focus.x - this.target.x) * k;
    this.target.y += (focus.y + 1.6 - this.target.y) * k;
    this.target.z += (focus.z - this.target.z) * k;
    this.punchT = Math.max(0, this.punchT - dt);
    const d = this.dist * (1 - Math.sin((this.punchT / 0.6) * Math.PI) * 0.18);
    const cp = Math.cos(this.pitch);
    const o = this._o.set(-Math.sin(this.yaw) * cp * d, Math.sin(this.pitch) * d, -Math.cos(this.yaw) * cp * d);
    // Pull the camera in when a hill sits between it and the character.
    let reach = 1;
    for (let i = 1; i <= 10; i++) {
      const t = i / 10;
      const x = this.target.x + o.x * t, z = this.target.z + o.z * t;
      if (this.target.y + o.y * t < world.groundY(x, z) + 0.5) { reach = Math.max(0.12, (i - 1.5) / 10); break; }
    }
    this.reach = reach < (this.reach ?? 1) ? reach : Math.min(reach, (this.reach ?? 1) + dt * 1.5);
    o.multiplyScalar(this.reach);
    const p = this.cam.position.copy(this.target).add(o);
    const gy = world.groundY(p.x, p.z) + 0.7;
    if (p.y < gy) p.y = gy;
    if (world.surface !== null && p.y > world.surface - 0.6) p.y = world.surface - 0.6;
    if (this.shakeAmt > 0) {
      const s = this.shakeAmt * 0.35;
      p.x += (Math.random() - 0.5) * s;
      p.y += (Math.random() - 0.5) * s;
      p.z += (Math.random() - 0.5) * s;
      this.shakeAmt = Math.max(0, this.shakeAmt - dt * 2.5);
    }
    this.cam.lookAt(this.target);
  }
}
