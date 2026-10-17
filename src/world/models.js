// Procedural character, weapon and enemy models built from primitives, plus their animation.
// Conventions: feet at y = 0, facing +Z. Limbs hang along -Y; negative X rotation swings them forward.

import * as THREE from 'three';
import { PRIM, toon, glow, mesh, pivot } from './geo.js';
import { lerp, clamp } from '../core/math.js';

const TORSO = new THREE.CylinderGeometry(1.15, 0.8, 1, 10);
const SKIRT = new THREE.CylinderGeometry(0.85, 1.25, 1, 10, 1, true);
const LIMB = new THREE.CylinderGeometry(1, 0.8, 1, 7);
const BOW_ARC = new THREE.TorusGeometry(0.62, 0.028, 5, 18, Math.PI * 0.78);
const SLASH_FLAT = new THREE.ConeGeometry(1, 1, 4);

const easeOut = (t) => 1 - (1 - t) * (1 - t);

// ------------------------------------------------------------------------------------------
// Weapons (grip at origin, blade along -Y)

export function buildWeapon(type, visual = {}, unique = false) {
  const g = new THREE.Group();
  const metal = toon(visual.color || '#c8d0d8', { unique, emissive: visual.glow, emissiveIntensity: 0.35 });
  const trim = toon(visual.guard || '#c9a54a', { unique });
  const grip = toon('#3a2a22');
  if (type === 'sword' || type === 'greatsword') {
    const big = type === 'greatsword';
    const L = big ? 1.35 : 0.9, W = big ? 0.17 : 0.075;
    g.add(mesh(PRIM.cyl, grip, { y: 0.08, sx: 0.028, sz: 0.028, sy: big ? 0.26 : 0.17 }));
    g.add(mesh(PRIM.box, trim, { y: -0.03, sx: big ? 0.36 : 0.24, sy: 0.05, sz: 0.07 }));
    g.add(mesh(PRIM.box, metal, { y: -0.06 - L / 2, sx: W, sy: L, sz: 0.022 }));
    g.add(mesh(SLASH_FLAT, metal, { y: -0.06 - L - 0.09, rx: Math.PI, sx: W * 0.72, sy: 0.18, sz: 0.016, ry: Math.PI / 4 }));
    if (visual.glow) g.add(mesh(PRIM.box, glow(visual.glow, 0.35), { y: -0.06 - L / 2, sx: W * 1.6, sy: L * 1.02, sz: 0.05 }));
  } else if (type === 'spear') {
    g.add(mesh(PRIM.cyl, grip, { y: -0.2, sx: 0.026, sz: 0.026, sy: 2.1 }));
    g.add(mesh(PRIM.torus, trim, { y: -1.2, rx: Math.PI / 2, s: 0.06 }));
    g.add(mesh(PRIM.cone4, metal, { y: -1.45, rx: Math.PI, sx: 0.07, sz: 0.03, sy: 0.42 }));
    if (visual.glow) g.add(mesh(PRIM.octa, glow(visual.glow, 0.6), { y: -1.45, s: 0.12, sy: 0.25 }));
  } else if (type === 'bow') {
    g.add(mesh(BOW_ARC, metal, { rz: -Math.PI * 0.39 }));
    g.add(mesh(PRIM.cyl, toon('#f4f0e0'), { x: 0.2, sx: 0.006, sz: 0.006, sy: 1.08 }));
    g.add(mesh(PRIM.cyl, trim, { x: 0.62, sx: 0.035, sz: 0.035, sy: 0.18 }));
    if (visual.glow) g.add(mesh(PRIM.octa, glow(visual.glow, 0.7), { x: 0.64, s: 0.07 }));
  } else if (type === 'catalyst') {
    const isBook = visual.book;
    if (isBook) {
      g.add(mesh(PRIM.box, metal, { sx: 0.26, sy: 0.32, sz: 0.07 }));
      g.add(mesh(PRIM.box, toon('#fffaf0'), { sx: 0.24, sy: 0.3, sz: 0.075, z: 0.004, x: 0.01 }));
      g.add(mesh(PRIM.box, trim, { sx: 0.05, sy: 0.32, sz: 0.08, x: -0.12 }));
    } else {
      g.add(mesh(PRIM.sphereMid, glow(visual.color || '#a8e6ff', 0.85, false), { s: 0.12 }));
      g.add(mesh(PRIM.torus, trim, { s: 0.2, rx: 1.2 }));
      g.add(mesh(PRIM.torus, trim, { s: 0.17, ry: 1.2 }));
    }
    if (visual.glow) g.add(mesh(PRIM.sphereLo, glow(visual.glow, 0.25), { s: 0.24 }));
  }
  return g;
}

// ------------------------------------------------------------------------------------------
// Humanoids (party members, NPCs and humanoid enemies)

export function buildHumanoid(look, opts = {}) {
  const H = look.height ?? 1, B = look.build ?? 1;
  const unique = !!opts.unique;
  const tr = look.ghost ? { transparent: true, opacity: 0.55, unique } : { unique };
  const M = {
    skin: toon(look.skin, tr), hair: toon(look.hair, tr), outfit: toon(look.outfit, tr), outfit2: toon(look.outfit2, tr),
    accent: toon(look.accent || look.outfit2, tr), dark: toon('#221a2a', tr), boot: toon(shade(look.outfit, 0.55), tr),
  };
  const root = new THREE.Group();
  const body = pivot();
  root.add(body);
  const hips = pivot(0, 0.86, 0);
  body.add(hips);
  const torso = pivot();
  hips.add(torso);
  torso.add(mesh(TORSO, M.outfit, { y: 0.26, sx: 0.19 * B, sz: 0.14 * B, sy: 0.52 }));
  torso.add(mesh(PRIM.cyl, M.outfit2, { y: 0.03, sx: 0.165 * B, sz: 0.125 * B, sy: 0.07 }));
  torso.add(mesh(PRIM.box, M.outfit2, { y: 0.34, z: 0.12 * B, sx: 0.12 * B, sy: 0.24, sz: 0.04 }));
  torso.add(mesh(SKIRT, M.outfit, { y: -0.12, sx: 0.19 * B, sz: 0.15 * B, sy: 0.32 }));
  torso.add(mesh(PRIM.cyl, M.skin, { y: 0.56, sx: 0.06, sz: 0.06, sy: 0.1 }));

  // Head
  const head = pivot(0, 0.68, 0);
  torso.add(head);
  head.add(mesh(PRIM.sphere, M.skin, { sx: 0.2, sy: 0.215, sz: 0.2 }));
  const eyeM = opts.eyeColor ? toon(opts.eyeColor, { emissive: opts.eyeColor }) : M.dark;
  const eyeS = opts.bigEyes ? 1.8 : 1;
  for (const s of [-1, 1]) {
    head.add(mesh(PRIM.box, eyeM, { x: s * 0.075, y: -0.005, z: 0.183, sx: 0.045 * eyeS, sy: 0.07 * eyeS, sz: 0.025 }));
    if (!opts.eyeColor) head.add(mesh(PRIM.box, toon('#ffffff'), { x: s * 0.075 + 0.012, y: 0.018, z: 0.196, s: 0.016 }));
  }
  if (!opts.noHair) buildHair(head, look.hairStyle || 'short', M.hair);
  buildExtras(head, torso, look.extra, M, look);

  // Arms: shoulder -> elbow -> hand
  const arm = (side) => {
    const sh = pivot(side * 0.24 * B, 0.47, 0);
    torso.add(sh);
    sh.add(mesh(PRIM.sphere, M.outfit2, { s: 0.085 * B }));
    sh.add(mesh(LIMB, M.outfit, { y: -0.16, sx: 0.06 * B, sz: 0.06 * B, sy: 0.32 }));
    const el = pivot(0, -0.32, 0);
    sh.add(el);
    el.add(mesh(LIMB, M.skin, { y: -0.14, sx: 0.05 * B, sz: 0.05 * B, sy: 0.28 }));
    el.add(mesh(PRIM.cyl, M.accent, { y: -0.22, sx: 0.058 * B, sz: 0.058 * B, sy: 0.08 }));
    const hand = pivot(0, -0.31, 0);
    el.add(hand);
    hand.add(mesh(PRIM.sphere, M.skin, { s: 0.06 }));
    return { sh, el, hand };
  };
  const L = arm(1), R = arm(-1);
  // Legs
  const leg = (side) => {
    const p = pivot(side * 0.095 * B, 0, 0);
    hips.add(p);
    p.add(mesh(LIMB, M.outfit2, { y: -0.2, sx: 0.08 * B, sz: 0.08 * B, sy: 0.4 }));
    const knee = pivot(0, -0.4, 0);
    p.add(knee);
    knee.add(mesh(LIMB, M.outfit2, { y: -0.18, sx: 0.07 * B, sz: 0.07 * B, sy: 0.36 }));
    knee.add(mesh(PRIM.box, M.boot, { y: -0.38, z: 0.035, sx: 0.12 * B, sy: 0.12, sz: 0.2 }));
    return { p, knee };
  };
  const LL = leg(1), LR = leg(-1);

  let cape = null;
  if (look.cape) {
    cape = pivot(0, 0.5, -0.15 * B);
    torso.add(cape);
    cape.add(mesh(PRIM.box, toon(look.cape, tr), { y: -0.4, sx: 0.4 * B, sy: 0.82, sz: 0.025 }));
  }

  root.scale.setScalar(H * (opts.scale || 1));
  const model = {
    root, body, hips, torso, head, cape,
    armL: L.sh, armR: R.sh, elbowL: L.el, elbowR: R.el, handL: L.hand, handR: R.hand,
    legL: LL.p, legR: LR.p, kneeL: LL.knee, kneeR: LR.knee,
    wings: root.userData.wings || null, weapon: null, weaponType: null, catalystFloat: null,
    mats: Object.values(M),
  };
  return model;
}

function shade(hex, f) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(f);
  return `#${c.getHexString()}`;
}

function buildHair(head, style, m) {
  head.add(mesh(PRIM.sphere, m, { y: 0.035, z: -0.015, sx: 0.218, sy: 0.215, sz: 0.218 }));
  head.add(mesh(PRIM.box, m, { y: 0.12, z: 0.14, rx: -0.45, sx: 0.36, sy: 0.1, sz: 0.09 }));
  for (const s of [-1, 1]) head.add(mesh(PRIM.box, m, { x: s * 0.17, y: -0.02, z: 0.05, sx: 0.07, sy: 0.22, sz: 0.14 }));
  switch (style) {
    case 'spiky':
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        head.add(mesh(PRIM.cone6, m, { x: Math.cos(a) * 0.12, y: 0.2, z: Math.sin(a) * 0.12 - 0.04, rx: Math.sin(a) * 0.7 - 0.3, rz: -Math.cos(a) * 0.7, sx: 0.07, sz: 0.07, sy: 0.22 }));
      }
      break;
    case 'long':
      head.add(mesh(PRIM.box, m, { y: -0.24, z: -0.11, sx: 0.38, sy: 0.6, sz: 0.12 }));
      break;
    case 'ponytail':
      head.add(mesh(PRIM.sphere, m, { y: 0.08, z: -0.22, s: 0.07 }));
      head.add(mesh(PRIM.cone6, m, { y: -0.18, z: -0.3, rx: 0.25, sx: 0.08, sz: 0.08, sy: 0.5 }));
      break;
    case 'twin':
      for (const s of [-1, 1]) {
        head.add(mesh(PRIM.sphere, m, { x: s * 0.2, y: 0.08, z: -0.06, s: 0.065 }));
        head.add(mesh(PRIM.cone6, m, { x: s * 0.25, y: -0.2, z: -0.07, rz: s * -0.15, sx: 0.07, sz: 0.07, sy: 0.5 }));
      }
      break;
    case 'bob':
      head.add(mesh(PRIM.sphere, m, { y: -0.03, z: -0.02, sx: 0.24, sy: 0.2, sz: 0.235 }));
      break;
    case 'bun':
      head.add(mesh(PRIM.sphere, m, { y: 0.2, z: -0.13, s: 0.09 }));
      break;
    default:
      break;
  }
}

function buildExtras(head, torso, extra, M, look) {
  if (!extra) return;
  switch (extra) {
    case 'halo':
      head.add(mesh(PRIM.torus, glow('#ffe9a0', 0.9), { y: 0.33, rx: Math.PI / 2, s: 0.15 }));
      break;
    case 'wings': {
      const w = new THREE.Group();
      const wm = toon('#ffffff', { emissive: '#fff4d0', emissiveIntensity: 0.25 });
      for (const s of [-1, 1]) {
        const p = pivot(s * 0.08, 0.42, -0.15);
        p.add(mesh(PRIM.cone4, wm, { x: s * 0.36, y: 0.12, rz: s * 1.1, sx: 0.2, sy: 0.75, sz: 0.03 }));
        p.add(mesh(PRIM.cone4, wm, { x: s * 0.28, y: -0.08, rz: s * 1.5, sx: 0.14, sy: 0.55, sz: 0.03 }));
        p.userData.side = s;
        w.add(p);
      }
      torso.add(w);
      torso.parent.parent.parent.userData.wings = w;
      break;
    }
    case 'horns':
      for (const s of [-1, 1]) head.add(mesh(PRIM.cone6, M.dark, { x: s * 0.12, y: 0.2, z: 0.02, rz: s * -0.5, sx: 0.035, sz: 0.035, sy: 0.16 }));
      break;
    case 'fin':
      for (const s of [-1, 1]) head.add(mesh(PRIM.cone4, M.accent, { x: s * 0.21, y: 0.02, z: -0.03, rz: s * -1.2, sx: 0.06, sz: 0.02, sy: 0.16 }));
      break;
    case 'hat':
      head.add(mesh(PRIM.cyl, M.outfit, { y: 0.17, sx: 0.32, sz: 0.32, sy: 0.025 }));
      head.add(mesh(PRIM.cone, M.outfit, { y: 0.34, z: -0.03, rx: -0.15, sx: 0.17, sz: 0.17, sy: 0.36 }));
      head.add(mesh(PRIM.cyl, M.outfit2, { y: 0.2, sx: 0.175, sz: 0.175, sy: 0.04 }));
      break;
    case 'hood':
      head.add(mesh(PRIM.sphere, M.outfit, { y: 0.02, z: -0.05, sx: 0.25, sy: 0.25, sz: 0.25 }));
      break;
    case 'glasses':
      for (const s of [-1, 1]) head.add(mesh(PRIM.torus, M.dark, { x: s * 0.075, z: 0.19, s: 0.05 }));
      break;
    case 'visor':
      head.add(mesh(PRIM.box, glow(look.accent || '#9fb8ff', 0.85, false), { y: 0.0, z: 0.17, sx: 0.36, sy: 0.07, sz: 0.06 }));
      break;
    case 'beard':
      head.add(mesh(PRIM.sphere, M.hair, { y: -0.13, z: 0.1, sx: 0.15, sy: 0.12, sz: 0.11 }));
      break;
    case 'ears':
      for (const s of [-1, 1]) head.add(mesh(PRIM.cone4, M.skin, { x: s * 0.23, y: 0.04, rz: s * -1.3, sx: 0.05, sz: 0.03, sy: 0.18 }));
      break;
    case 'crown':
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        head.add(mesh(PRIM.cone4, glow('#ffd36a', 0.95, false), { x: Math.cos(a) * 0.15, y: 0.27, z: Math.sin(a) * 0.15, sx: 0.04, sz: 0.04, sy: 0.14 }));
      }
      break;
    default:
      break;
  }
}

// Weapon placement per type: [parent, rest X rotation, attack X rotation].
const HOLD = {
  sword: { hand: 'R', rest: -1.15, atk: -1.15 },
  greatsword: { hand: 'R', rest: 2.5, atk: -1.0 },
  spear: { hand: 'R', rest: Math.PI, atk: -1.57 },
  bow: { hand: 'L', rest: 0, atk: 1.57 },
  catalyst: { hand: 'F', rest: 0, atk: 0 },
};

export function attachWeapon(model, type, visual) {
  if (model.weapon) model.weapon.parent.remove(model.weapon);
  const w = buildWeapon(type, visual);
  const hold = HOLD[type];
  if (hold.hand === 'F') {
    const f = pivot(0.38, 0.5, 0.15);
    model.torso.add(f);
    f.add(w);
    model.catalystFloat = f;
  } else {
    (hold.hand === 'R' ? model.handR : model.handL).add(w);
    w.rotation.x = hold.rest;
  }
  model.weapon = w;
  model.weaponType = type;
}

// Character for a party member or recruit.
export function buildCharacterModel(charDef, weaponDef) {
  const m = buildHumanoid(charDef.look);
  attachWeapon(m, charDef.weapon, { ...weaponDef.visual, book: weaponDef.name.includes('書') });
  return m;
}

// st: { t, speed (0..2), air, glide, swim, mount, attack: {kind, phase, combo} | null, cast }
export function animateHumanoid(m, st) {
  const t = st.t;
  const sp = clamp(st.speed, 0, 1.6);
  const freq = 4 + sp * 4.5;
  const sw = Math.sin(t * freq) * Math.min(1, sp);
  let legL = sw * 0.75, legR = -sw * 0.75, kneeL = Math.max(0, -sw) * 0.9, kneeR = Math.max(0, sw) * 0.9;
  let armLx = -sw * 0.6, armRx = sw * 0.6, armLz = 0.08, armRz = -0.08, elL = -0.25, elR = -0.25;
  let bodyX = sp > 1.05 ? 0.18 : 0.04 * sp, torsoY = 0, hipsY = 0.86 + Math.abs(Math.sin(t * freq)) * 0.035 * Math.min(1, sp);
  let weaponRot = HOLD[m.weaponType]?.rest ?? 0;

  if (st.mount) {
    legL = legR = -1.3; kneeL = kneeR = 1.4; armLx = armRx = -0.6; elL = elR = -0.6; bodyX = 0.1; hipsY = 0.86;
  } else if (st.swim) {
    bodyX = 1.25;
    legL = Math.sin(t * 6) * 0.4; legR = -legL; kneeL = kneeR = 0.2;
    armLx = -2.6 + Math.sin(t * 3) * 0.5; armRx = -2.6 - Math.sin(t * 3) * 0.5; armLz = 0.3; armRz = -0.3;
  } else if (st.glide) {
    bodyX = 0.9; armLx = armRx = -0.2; armLz = 1.45; armRz = -1.45; legL = 0.2; legR = 0.3; kneeL = kneeR = 0.3; elL = elR = 0;
  } else if (st.air) {
    legL = -0.7; legR = 0.25; kneeL = 1.1; kneeR = 0.4; armLx = -0.8; armRx = -0.5; armLz = 0.5; armRz = -0.5;
  } else if (sp < 0.05) {
    // Idle breathing
    const b = Math.sin(t * 2) * 0.03;
    armLx = b; armRx = -b; armLz = 0.1 + b; armRz = -0.1 - b;
  }

  const a = st.attack;
  if (a) {
    const p = clamp(a.phase, 0, 1);
    const kind = m.weaponType;
    const w = HOLD[kind];
    weaponRot = lerp(w.rest, w.atk, Math.min(1, p * 4));
    if (kind === 'sword' || kind === 'greatsword') {
      const e = easeOut(clamp(p * 1.6, 0, 1));
      if (a.combo % 2 === 0) { armRx = lerp(-2.7, -0.3, e); armRz = -0.2; torsoY = lerp(0.3, -0.2, e); }
      else { armRx = -1.45; armRz = lerp(-1.3, 0.6, e); torsoY = lerp(1.0, -1.1, e); }
      elR = -0.15;
      if (a.combo === 3) { armRx = lerp(-3.0, -0.2, e); torsoY = lerp(-0.6, 0.4, e); bodyX = lerp(-0.1, 0.3, e); }
    } else if (kind === 'spear') {
      const e = easeOut(clamp(p * 1.8, 0, 1));
      armRx = -1.45; elR = lerp(-1.6, 0, e); torsoY = lerp(0.5, -0.3, e); armLx = -1.2; elL = -1.2;
      weaponRot = -1.57 + (1 - e) * 0.1;
    } else if (kind === 'bow') {
      armLx = -1.55; elL = 0; armRx = -1.5; elR = -1.9 + p * 0.5; armRz = 0.25; torsoY = 0.3;
    } else if (kind === 'catalyst') {
      const e = Math.sin(p * Math.PI);
      armRx = -1.2 - e * 0.5; armLx = -0.6 - e * 0.4; elR = -0.2; torsoY = -0.2 + e * 0.3;
    }
  }
  if (st.cast > 0) {
    const c = st.cast;
    armLx = lerp(armLx, -2.8, c); armRx = lerp(armRx, -2.8, c); armLz = lerp(armLz, 0.4, c); armRz = lerp(armRz, -0.4, c);
  }

  m.legL.rotation.x = legL; m.legR.rotation.x = legR; m.kneeL.rotation.x = kneeL; m.kneeR.rotation.x = kneeR;
  m.armL.rotation.x = armLx; m.armR.rotation.x = armRx; m.armL.rotation.z = armLz; m.armR.rotation.z = armRz;
  m.elbowL.rotation.x = elL; m.elbowR.rotation.x = elR;
  m.body.rotation.x = bodyX;
  m.torso.rotation.y = torsoY;
  m.hips.position.y = hipsY;
  if (m.weapon && HOLD[m.weaponType].hand !== 'F') m.weapon.rotation.x = weaponRot;
  if (m.catalystFloat) {
    m.catalystFloat.position.y = 0.55 + Math.sin(t * 2.4) * 0.06;
    m.catalystFloat.rotation.y = t * 1.5;
    if (st.attack) m.catalystFloat.position.z = 0.15 + Math.sin(clamp(st.attack.phase, 0, 1) * Math.PI) * 0.4;
    else m.catalystFloat.position.z = 0.15;
  }
  if (m.cape) m.cape.rotation.x = 0.15 + Math.min(1, sp) * 0.5 + Math.sin(t * 5) * 0.05 + (st.glide ? 0.9 : 0);
  if (m.wings) for (const w of m.wings.children) w.rotation.y = w.userData.side * (0.2 + Math.sin(t * (st.glide || st.air ? 9 : 2)) * (st.glide || st.air ? 0.5 : 0.12));
}

// Spirit mount summoned with R.
export function buildMount(color = '#9ff2ff') {
  const g = new THREE.Group();
  const body = toon(color, { emissive: color, emissiveIntensity: 0.35 });
  const mane = glow('#ffffff', 0.7);
  g.add(mesh(PRIM.sphere, body, { y: 1.05, sx: 0.42, sy: 0.42, sz: 0.85 }));
  const neck = pivot(0, 1.3, 0.65);
  g.add(neck);
  neck.add(mesh(PRIM.cyl, body, { y: 0.25, rx: 0.5, sx: 0.17, sz: 0.2, sy: 0.6 }));
  neck.add(mesh(PRIM.box, body, { y: 0.55, z: 0.3, rx: 0.3, sx: 0.22, sy: 0.24, sz: 0.5 }));
  neck.add(mesh(PRIM.cone4, mane, { y: 0.45, z: -0.05, rx: -0.6, sx: 0.06, sz: 0.2, sy: 0.6 }));
  for (const s of [-1, 1]) neck.add(mesh(PRIM.cone4, body, { x: s * 0.08, y: 0.78, z: 0.22, sx: 0.04, sz: 0.04, sy: 0.15 }));
  const legs = [];
  for (const [x, z] of [[-0.25, 0.55], [0.25, 0.55], [-0.25, -0.55], [0.25, -0.55]]) {
    const p = pivot(x, 0.95, z);
    p.add(mesh(LIMB, body, { y: -0.45, sx: 0.08, sz: 0.08, sy: 0.9 }));
    p.add(mesh(PRIM.sphere, mane, { y: -0.9, s: 0.1 }));
    g.add(p);
    legs.push(p);
  }
  const tail = pivot(0, 1.15, -0.85);
  tail.add(mesh(PRIM.cone4, mane, { y: -0.3, z: -0.2, rx: 2.4, sx: 0.1, sz: 0.2, sy: 0.8 }));
  g.add(tail);
  g.add(mesh(PRIM.box, toon('#c9a54a'), { y: 1.45, sx: 0.46, sy: 0.08, sz: 0.5 }));
  return {
    root: g,
    animate(t, speed) {
      const f = 10;
      legs[0].rotation.x = Math.sin(t * f) * 0.7 * speed;
      legs[3].rotation.x = Math.sin(t * f) * 0.7 * speed;
      legs[1].rotation.x = -Math.sin(t * f) * 0.7 * speed;
      legs[2].rotation.x = -Math.sin(t * f) * 0.7 * speed;
      neck.rotation.x = Math.sin(t * f * 2) * 0.05 * speed;
      tail.rotation.x = Math.sin(t * 4) * 0.2;
    },
  };
}

// ------------------------------------------------------------------------------------------
// Enemies. Each builder returns { root, mats, anim(st) } with st = { t, speed, phase, attacking }.

export function buildEnemyModel(def) {
  const builder = ENEMY_BUILDERS[def.model] || ENEMY_BUILDERS.slime;
  const m = builder(def);
  m.root.scale.multiplyScalar(def.size || 1);
  return m;
}

function mats(def) {
  const main = toon(def.color, { unique: true });
  const second = toon(def.color2 || '#ffffff', { unique: true });
  const eye = toon('#1a1420', { unique: true });
  return { main, second, eye, all: [main, second] };
}

const ENEMY_BUILDERS = {
  slime(def) {
    const M = mats(def);
    const root = new THREE.Group();
    const body = pivot();
    root.add(body);
    const jelly = toon(def.color, { unique: true, transparent: true, opacity: 0.82 });
    body.add(mesh(PRIM.sphere, jelly, { y: 0.45, sx: 0.55, sy: 0.45, sz: 0.55 }));
    body.add(mesh(PRIM.sphere, M.second, { y: 0.45, s: 0.2 }));
    for (const s of [-1, 1]) body.add(mesh(PRIM.sphere, M.eye, { x: s * 0.17, y: 0.55, z: 0.45, sx: 0.06, sy: 0.1, sz: 0.04 }));
    if (def.crown) for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      body.add(mesh(PRIM.cone4, glow('#ffd36a', 0.95, false), { x: Math.cos(a) * 0.18, y: 0.95, z: Math.sin(a) * 0.18, sx: 0.06, sz: 0.06, sy: 0.18 }));
    }
    if (def.element) body.add(mesh(PRIM.octa, glow(elemColor(def.element), 0.8), { y: 0.45, s: 0.12 }));
    return {
      root, mats: [jelly, M.second],
      anim(st) {
        const hop = st.attacking ? Math.sin(st.phase * Math.PI) : Math.abs(Math.sin(st.t * 5)) * Math.min(1, st.speed);
        body.position.y = hop * 0.9;
        const sq = 1 + Math.sin(st.t * 10) * 0.06 - hop * 0.15;
        body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
      },
    };
  },

  beast(def) {
    const M = mats(def);
    const root = new THREE.Group();
    const body = pivot(0, 0.75, 0);
    root.add(body);
    const lizard = def.lizard;
    body.add(mesh(PRIM.sphere, M.main, { sx: 0.38, sy: lizard ? 0.25 : 0.34, sz: lizard ? 0.85 : 0.75 }));
    body.add(mesh(PRIM.sphere, M.second, { y: -0.1, sx: 0.3, sy: 0.22, sz: 0.6 }));
    const head = pivot(0, lizard ? 0.05 : 0.18, lizard ? 0.85 : 0.72);
    body.add(head);
    head.add(mesh(PRIM.box, M.main, { sx: 0.34, sy: 0.3, sz: 0.4 }));
    head.add(mesh(PRIM.box, M.second, { y: -0.06, z: 0.28, sx: 0.22, sy: 0.16, sz: 0.3 }));
    for (const s of [-1, 1]) {
      head.add(mesh(PRIM.box, toon('#ffef6a', { emissive: '#ff9a2a', emissiveIntensity: 0.6 }), { x: s * 0.11, y: 0.07, z: 0.2, s: 0.06 }));
      if (!lizard) head.add(mesh(PRIM.cone4, M.main, { x: s * 0.12, y: 0.24, z: -0.08, sx: 0.07, sz: 0.05, sy: 0.18 }));
    }
    if (def.boss) for (const s of [-1, 1]) head.add(mesh(PRIM.cone6, glow(def.color2, 0.9, false), { x: s * 0.16, y: 0.25, z: 0, rz: s * -0.5, rx: -0.5, sx: 0.06, sz: 0.06, sy: 0.4 }));
    const legs = [];
    const ly = lizard ? 0.5 : 0.75;
    for (const [x, z] of [[-0.22, 0.42], [0.22, 0.42], [-0.22, -0.42], [0.22, -0.42]]) {
      const p = pivot(x * (lizard ? 1.4 : 1), 0.75 - 0.1, z);
      p.add(mesh(LIMB, M.main, { y: -ly / 2 + 0.05, rz: lizard ? Math.sign(x) * 0.6 : 0, sx: 0.08, sz: 0.08, sy: ly }));
      root.add(p);
      legs.push(p);
    }
    const tail = pivot(0, 0.1, lizard ? -0.8 : -0.7);
    tail.add(mesh(PRIM.cone6, M.main, { z: -0.35, rx: -Math.PI / 2 + 0.3, sx: 0.1, sz: 0.1, sy: lizard ? 0.9 : 0.6 }));
    body.add(tail);
    if (def.element) body.add(mesh(PRIM.octa, glow(elemColor(def.element), 0.7), { y: 0.38, s: 0.1 }));
    return {
      root, mats: M.all,
      anim(st) {
        const f = 6 + st.speed * 6;
        const s = Math.sin(st.t * f) * Math.min(1, st.speed) * 0.7;
        legs[0].rotation.x = s; legs[3].rotation.x = s; legs[1].rotation.x = -s; legs[2].rotation.x = -s;
        body.position.y = 0.75 + Math.abs(Math.sin(st.t * f)) * 0.06 * st.speed;
        tail.rotation.y = Math.sin(st.t * 4) * 0.4;
        head.rotation.x = st.attacking ? -Math.sin(st.phase * Math.PI) * 0.6 : Math.sin(st.t * 1.5) * 0.05;
        body.rotation.x = st.attacking ? -Math.sin(st.phase * Math.PI) * 0.25 : 0;
      },
    };
  },

  humanoid(def) {
    const look = {
      skin: def.alien ? def.color : def.bulky ? def.color : (def.fin ? def.color : '#e8c8b0'),
      hair: def.color2, hairStyle: def.bulky || def.alien ? 'none' : 'spiky', outfit: def.color, outfit2: def.color2, accent: def.color2,
      height: 1, build: def.bulky ? 1.6 : 1, cape: def.boss ? def.color2 : null,
      extra: def.wings ? 'wings' : def.fin ? 'fin' : def.crown ? 'crown' : def.model === 'humanoid' && def.color === '#6f9a3c' ? 'ears' : null,
    };
    if (def.color === '#6f9a3c') look.skin = '#7fa84a';
    const m = buildHumanoid(look, { unique: true, noHair: def.bulky || def.alien, eyeColor: def.boss || def.alien ? def.color2 : '#ff4a3a', bigEyes: def.alien });
    if (def.alien) m.head.scale.set(1.35, 1.45, 1.3);
    if (def.crown && def.wings) buildExtras(m.head, m.torso, 'crown', {}, look);
    if (def.weapon) attachWeapon(m, def.weapon, { color: def.color2, guard: def.color, glow: def.boss ? def.color2 : null });
    if (def.element) m.torso.add(mesh(PRIM.octa, glow(elemColor(def.element), 0.8), { y: 0.3, z: 0.18, s: 0.06 }));
    return {
      root: m.root, mats: m.mats,
      anim(st) {
        animateHumanoid(m, {
          t: st.t, speed: st.speed, air: false,
          attack: st.attacking && m.weaponType ? { phase: st.phase, combo: Math.floor(st.t) % 2 } : null,
          cast: st.attacking && !m.weaponType ? Math.sin(st.phase * Math.PI) : 0,
        });
        if (st.attacking && !m.weaponType) { m.armR.rotation.x = -1.6 * Math.sin(st.phase * Math.PI); }
        if (def.float) m.body.position.y = Math.sin(st.t * 2) * 0.1;
      },
    };
  },

  golem(def) {
    const M = mats(def);
    const root = new THREE.Group();
    const body = pivot(0, 1.2, 0);
    root.add(body);
    const core = glow(def.color2, 0.9, false);
    body.add(mesh(PRIM.box, M.main, { sx: 1.1, sy: 0.9, sz: 0.7 }));
    body.add(mesh(PRIM.box, core, { z: 0.36, sx: 0.3, sy: 0.3, sz: 0.04 }));
    body.add(mesh(PRIM.box, M.main, { y: 0.55, sx: 0.5, sy: 0.4, sz: 0.5 }));
    for (const s of [-1, 1]) body.add(mesh(PRIM.box, core, { x: s * 0.11, y: 0.6, z: 0.26, sx: 0.1, sy: 0.06, sz: 0.02 }));
    const arms = [];
    for (const s of [-1, 1]) {
      const p = pivot(s * 0.75, 0.3, 0);
      p.add(mesh(PRIM.box, M.main, { y: -0.45, sx: 0.38, sy: 0.9, sz: 0.4 }));
      p.add(mesh(PRIM.dodeca, M.main, { y: -1.0, s: 0.32 }));
      p.add(mesh(PRIM.box, core, { y: -0.4, x: s * 0.2, sx: 0.02, sy: 0.3, sz: 0.1 }));
      body.add(p);
      arms.push(p);
    }
    const legs = [];
    for (const s of [-1, 1]) {
      const p = pivot(s * 0.32, 0.75, 0);
      p.add(mesh(PRIM.box, M.main, { y: -0.38, sx: 0.36, sy: 0.75, sz: 0.4 }));
      root.add(p);
      legs.push(p);
    }
    for (let i = 0; i < 4; i++) body.add(mesh(PRIM.octa, toon(def.color2, { emissive: def.color2, emissiveIntensity: 0.5 }), { x: (i - 1.5) * 0.25, y: 0.5, z: -0.3, rz: 0.3, s: 0.12, sy: 0.25 }));
    return {
      root, mats: M.all,
      anim(st) {
        const s = Math.sin(st.t * 5) * Math.min(1, st.speed) * 0.5;
        legs[0].rotation.x = s; legs[1].rotation.x = -s;
        if (st.attacking) {
          const p = st.phase;
          const r = p < 0.5 ? lerp(0, -2.6, p * 2) : lerp(-2.6, -0.2, (p - 0.5) * 2);
          arms[0].rotation.x = r; arms[1].rotation.x = r;
        } else { arms[0].rotation.x = -s; arms[1].rotation.x = s; }
        body.position.y = 1.2 + Math.abs(Math.sin(st.t * 5)) * 0.05 * st.speed;
      },
    };
  },

  spirit(def) {
    const M = mats(def);
    const root = new THREE.Group();
    const body = pivot(0, 1.0, 0);
    root.add(body);
    const coreMat = toon(def.color, { unique: true, emissive: def.color, emissiveIntensity: 0.7 });
    body.add(mesh(PRIM.octa, coreMat, { s: 0.4, sy: 0.55 }));
    body.add(mesh(PRIM.sphereLo, glow(def.color2, 0.35), { s: 0.62 }));
    for (const s of [-1, 1]) body.add(mesh(PRIM.box, M.eye, { x: s * 0.1, y: 0.06, z: 0.3, sx: 0.06, sy: 0.1, sz: 0.04 }));
    const orbit = pivot();
    body.add(orbit);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      orbit.add(mesh(PRIM.octa, coreMat, { x: Math.cos(a) * 0.75, z: Math.sin(a) * 0.75, s: 0.12, sy: 0.2 }));
    }
    body.add(mesh(PRIM.cone6, glow(def.color, 0.5), { y: -0.6, rx: Math.PI, sx: 0.25, sz: 0.25, sy: 0.6 }));
    return {
      root, mats: [coreMat],
      anim(st) {
        body.position.y = 1.0 + Math.sin(st.t * 2.5) * 0.15;
        orbit.rotation.y = st.t * (st.attacking ? 6 : 1.5);
        body.rotation.y = Math.sin(st.t) * 0.2;
        const s = st.attacking ? 1 + Math.sin(st.phase * Math.PI) * 0.25 : 1;
        body.scale.setScalar(s);
      },
    };
  },

  jelly(def) {
    const root = new THREE.Group();
    const body = pivot(0, 1.0, 0);
    root.add(body);
    const bell = toon(def.color, { unique: true, transparent: true, opacity: 0.7, emissive: def.color, emissiveIntensity: 0.4 });
    body.add(mesh(PRIM.hemi, bell, { sx: 0.6, sy: 0.5, sz: 0.6 }));
    body.add(mesh(PRIM.sphere, glow(def.color2, 0.6), { y: 0.15, s: 0.18 }));
    const tents = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const p = pivot(Math.cos(a) * 0.35, 0, Math.sin(a) * 0.35);
      p.add(mesh(PRIM.cyl, glow(def.color, 0.6), { y: -0.45, sx: 0.025, sz: 0.025, sy: 0.9 }));
      body.add(p);
      tents.push(p);
    }
    return {
      root, mats: [bell],
      anim(st) {
        const pulse = Math.sin(st.t * 3);
        body.scale.set(1 + pulse * 0.08, 1 - pulse * 0.1, 1 + pulse * 0.08);
        body.position.y = 1 + Math.sin(st.t * 1.5) * 0.25;
        tents.forEach((p, i) => { p.rotation.x = Math.sin(st.t * 3 + i) * 0.3; p.rotation.z = Math.cos(st.t * 3 + i) * 0.3; });
      },
    };
  },

  fish(def) {
    const M = mats(def);
    const root = new THREE.Group();
    const body = pivot(0, 0.6, 0);
    root.add(body);
    body.add(mesh(PRIM.sphere, M.main, { sx: 0.35, sy: 0.38, sz: 1.0 }));
    body.add(mesh(PRIM.sphere, M.second, { y: -0.12, sx: 0.3, sy: 0.25, sz: 0.85 }));
    body.add(mesh(PRIM.cone4, M.main, { y: 0.45, z: -0.05, rx: -0.3, sx: 0.05, sz: 0.25, sy: 0.4 }));
    for (const s of [-1, 1]) {
      body.add(mesh(PRIM.cone4, M.main, { x: s * 0.35, y: -0.1, z: 0.2, rz: s * 1.9, sx: 0.04, sz: 0.2, sy: 0.35 }));
      body.add(mesh(PRIM.sphere, M.eye, { x: s * 0.2, y: 0.08, z: 0.75, s: 0.05 }));
    }
    body.add(mesh(PRIM.box, toon('#ffffff'), { y: -0.12, z: 0.88, sx: 0.2, sy: 0.04, sz: 0.06 }));
    const tail = pivot(0, 0, -0.95);
    tail.add(mesh(PRIM.cone4, M.main, { z: -0.25, rx: Math.PI / 2, sx: 0.04, sz: 0.4, sy: 0.5 }));
    body.add(tail);
    return {
      root, mats: M.all,
      anim(st) {
        tail.rotation.y = Math.sin(st.t * (6 + st.speed * 8)) * 0.5;
        body.rotation.y = Math.sin(st.t * (6 + st.speed * 8)) * 0.08;
        body.position.y = 0.6 + Math.sin(st.t * 1.2) * 0.1;
        body.rotation.x = st.attacking ? -Math.sin(st.phase * Math.PI) * 0.3 : 0;
      },
    };
  },

  dragon(def) {
    const M = mats(def);
    const root = new THREE.Group();
    const body = pivot(0, 1.3, 0);
    root.add(body);
    body.add(mesh(PRIM.sphere, M.main, { sx: 0.6, sy: 0.55, sz: 1.1 }));
    body.add(mesh(PRIM.sphere, M.second, { y: -0.2, z: 0.1, sx: 0.45, sy: 0.35, sz: 0.9 }));
    const neck = pivot(0, 0.25, 0.9);
    body.add(neck);
    neck.add(mesh(PRIM.cyl, M.main, { y: 0.35, z: 0.15, rx: 0.6, sx: 0.22, sz: 0.22, sy: 0.8 }));
    const head = pivot(0, 0.75, 0.55);
    neck.add(head);
    head.add(mesh(PRIM.box, M.main, { sx: 0.4, sy: 0.35, sz: 0.55 }));
    if (def.beak) head.add(mesh(PRIM.cone4, toon('#f0c040'), { z: 0.45, rx: Math.PI / 2, sx: 0.12, sz: 0.1, sy: 0.35 }));
    else head.add(mesh(PRIM.box, M.second, { y: -0.12, z: 0.35, sx: 0.3, sy: 0.14, sz: 0.4 }));
    for (const s of [-1, 1]) {
      head.add(mesh(PRIM.box, glow('#ffe56a', 0.95, false), { x: s * 0.17, y: 0.06, z: 0.22, s: 0.07 }));
      head.add(mesh(PRIM.cone6, M.second, { x: s * 0.14, y: 0.25, z: -0.2, rx: -0.9, sx: 0.05, sz: 0.05, sy: 0.4 }));
    }
    const wings = [];
    for (const s of [-1, 1]) {
      const p = pivot(s * 0.45, 0.35, 0.15);
      p.add(mesh(PRIM.cone4, M.second, { x: s * 1.1, rz: s * Math.PI / 2, ry: 0, sx: 0.9, sy: 2.0, sz: 0.04 }));
      p.add(mesh(PRIM.cyl, M.main, { x: s * 1.0, rz: Math.PI / 2, sx: 0.06, sz: 0.06, sy: 2.0 }));
      body.add(p);
      wings.push(p);
    }
    const legs = [];
    for (const [x, z] of [[-0.35, 0.5], [0.35, 0.5], [-0.35, -0.5], [0.35, -0.5]]) {
      const p = pivot(x, -0.3, z);
      p.add(mesh(LIMB, M.main, { y: -0.45, sx: 0.12, sz: 0.12, sy: 0.9 }));
      body.add(p);
      legs.push(p);
    }
    const tail = pivot(0, 0, -1.0);
    tail.add(mesh(PRIM.cone6, M.main, { z: -0.8, rx: -Math.PI / 2, sx: 0.22, sz: 0.22, sy: 1.6 }));
    body.add(tail);
    if (def.element) body.add(mesh(PRIM.octa, glow(elemColor(def.element), 0.8), { y: 0.5, s: 0.18 }));
    return {
      root, mats: M.all,
      anim(st) {
        const flap = Math.sin(st.t * (st.speed > 0.5 ? 7 : 3));
        wings[0].rotation.z = flap * 0.6; wings[1].rotation.z = -flap * 0.6;
        body.position.y = 1.3 + flap * 0.08;
        tail.rotation.y = Math.sin(st.t * 2) * 0.35;
        neck.rotation.x = st.attacking ? -Math.sin(st.phase * Math.PI) * 0.7 : Math.sin(st.t) * 0.08;
        legs.forEach((l, i) => { l.rotation.x = Math.sin(st.t * 6 + i * 1.6) * 0.4 * Math.min(1, st.speed); });
      },
    };
  },

  serpent(def) {
    const M = mats(def);
    const root = new THREE.Group();
    const segs = [];
    for (let i = 0; i < 12; i++) {
      const r = 0.5 * (1 - i / 16);
      const s = mesh(PRIM.sphere, i % 2 ? M.second : M.main, { s: r });
      root.add(s);
      segs.push(s);
    }
    const head = pivot();
    root.add(head);
    head.add(mesh(PRIM.box, M.main, { sx: 0.6, sy: 0.45, sz: 0.9 }));
    head.add(mesh(PRIM.box, M.second, { y: -0.18, z: 0.25, sx: 0.5, sy: 0.15, sz: 0.6 }));
    for (const s of [-1, 1]) {
      head.add(mesh(PRIM.box, glow('#e8ff6a', 0.95, false), { x: s * 0.25, y: 0.1, z: 0.3, s: 0.09 }));
      head.add(mesh(PRIM.cone4, M.second, { x: s * 0.25, y: 0.35, z: -0.25, rx: -0.9, sx: 0.08, sz: 0.04, sy: 0.6 }));
    }
    return {
      root, mats: M.all,
      anim(st) {
        const t = st.t * 3;
        head.position.set(0, 1.4 + Math.sin(t) * 0.2, 0.6);
        head.rotation.x = st.attacking ? -Math.sin(st.phase * Math.PI) * 0.5 : 0;
        segs.forEach((s, i) => {
          s.position.set(Math.sin(t - i * 0.6) * 0.5, 1.3 + Math.sin(t * 0.5 - i * 0.4) * 0.3, -i * 0.55);
        });
      },
    };
  },

  kraken(def) {
    const M = mats(def);
    const root = new THREE.Group();
    const body = pivot(0, 2.2, 0);
    root.add(body);
    body.add(mesh(PRIM.sphere, M.main, { y: 0.5, sx: 0.9, sy: 1.2, sz: 0.9 }));
    for (const s of [-1, 1]) {
      body.add(mesh(PRIM.sphere, toon('#fff6c0', { emissive: '#ffd040', emissiveIntensity: 0.5 }), { x: s * 0.35, y: 0.2, z: 0.75, s: 0.18 }));
      body.add(mesh(PRIM.sphere, M.eye, { x: s * 0.35, y: 0.2, z: 0.88, s: 0.08 }));
    }
    const tents = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const chain = [];
      let parent = pivot(Math.cos(a) * 0.6, -0.4, Math.sin(a) * 0.6);
      body.add(parent);
      for (let k = 0; k < 4; k++) {
        const seg = pivot(0, k === 0 ? 0 : -0.55, 0);
        parent.add(seg);
        seg.add(mesh(LIMB, k % 2 ? M.second : M.main, { y: -0.28, sx: 0.16 - k * 0.03, sz: 0.16 - k * 0.03, sy: 0.6 }));
        chain.push(seg);
        parent = seg;
      }
      tents.push({ chain, a });
    }
    return {
      root, mats: M.all,
      anim(st) {
        body.position.y = 2.2 + Math.sin(st.t * 1.4) * 0.2;
        for (const { chain, a } of tents) {
          chain.forEach((seg, k) => {
            const w = Math.sin(st.t * 2.5 + a * 2 + k * 0.8) * (0.35 + (st.attacking ? 0.4 : 0));
            seg.rotation.x = Math.cos(a) * 0.3 + w * Math.sin(a);
            seg.rotation.z = -Math.sin(a) * 0.3 + w * Math.cos(a);
          });
        }
      },
    };
  },

  drone(def) {
    const M = mats(def);
    const root = new THREE.Group();
    const body = pivot(0, 1.0, 0);
    root.add(body);
    body.add(mesh(PRIM.sphereMid, M.main, { s: 0.45 }));
    const eyeM = toon(def.color2, { unique: true, emissive: def.color2, emissiveIntensity: 1 });
    body.add(mesh(PRIM.sphere, eyeM, { z: 0.38, s: 0.14 }));
    const ring = pivot();
    body.add(ring);
    ring.add(mesh(PRIM.torus, M.second, { rx: Math.PI / 2, s: 0.7 }));
    for (const s of [-1, 1]) body.add(mesh(PRIM.box, M.second, { x: s * 0.55, sx: 0.3, sy: 0.05, sz: 0.25 }));
    body.add(mesh(PRIM.cone6, glow(def.color2, 0.5), { y: -0.55, rx: Math.PI, sx: 0.15, sz: 0.15, sy: 0.4 }));
    return {
      root, mats: [M.main, M.second, eyeM],
      anim(st) {
        ring.rotation.z = st.t * 3;
        body.position.y = 1 + Math.sin(st.t * 3) * 0.1;
        body.rotation.z = Math.sin(st.t * 1.3) * 0.1;
      },
    };
  },
};

const ELEM_COL = { fire: '#ff5a36', water: '#3fa9ff', thunder: '#b26bff', ice: '#8ee8ff', wind: '#5ef2c0', earth: '#e0b04a', light: '#fff1a0', dark: '#a35cff' };
export const elemColor = (e) => ELEM_COL[e] || '#ffffff';
