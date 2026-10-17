// Geometry and material helpers: vertex-colored merged meshes and cached materials.

import * as THREE from 'three';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _c = new THREE.Color();

// Collects primitives with a color and transform, then merges them into one vertex-colored geometry.
export class GeoBuilder {
  constructor() { this.parts = []; }

  add(geo, color, t = {}) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    _p.set(t.x || 0, t.y || 0, t.z || 0);
    _e.set(t.rx || 0, t.ry || 0, t.rz || 0);
    _q.setFromEuler(_e);
    const s = t.s ?? 1;
    _s.set(t.sx ?? s, t.sy ?? s, t.sz ?? s);
    _m.compose(_p, _q, _s);
    g.applyMatrix4(_m);
    if (!g.attributes.normal) g.computeVertexNormals();
    _c.set(color);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color') g.deleteAttribute(k);
    this.parts.push(g);
    return this;
  }

  build() {
    let total = 0;
    for (const g of this.parts) total += g.attributes.position.count;
    const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3);
    let o = 0;
    for (const g of this.parts) {
      pos.set(g.attributes.position.array, o * 3);
      nor.set(g.attributes.normal.array, o * 3);
      col.set(g.attributes.color.array, o * 3);
      o += g.attributes.position.count;
      g.dispose();
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    out.setAttribute('color', new THREE.BufferAttribute(col, 3));
    out.computeBoundingSphere();
    this.parts = [];
    return out;
  }
}

// Randomly displaces vertices (keeps shared positions together) for organic rocks.
export function jitter(geo, amount, rand) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const p = g.attributes.position;
  const map = new Map();
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    let d = map.get(key);
    if (!d) { d = [(rand() - 0.5) * amount, (rand() - 0.5) * amount, (rand() - 0.5) * amount]; map.set(key, d); }
    p.setXYZ(i, p.getX(i) + d[0], p.getY(i) + d[1], p.getZ(i) + d[2]);
  }
  g.computeVertexNormals();
  return g;
}

// Shared primitive geometries (unit sized).
export const PRIM = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sphere: new THREE.SphereGeometry(1, 12, 9),
  sphereLo: new THREE.IcosahedronGeometry(1, 0),
  sphereMid: new THREE.IcosahedronGeometry(1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 8),
  cyl6: new THREE.CylinderGeometry(1, 1, 1, 6),
  cone: new THREE.ConeGeometry(1, 1, 8),
  cone6: new THREE.ConeGeometry(1, 1, 6),
  cone4: new THREE.ConeGeometry(1, 1, 4),
  octa: new THREE.OctahedronGeometry(1, 0),
  dodeca: new THREE.DodecahedronGeometry(1, 0),
  torus: new THREE.TorusGeometry(1, 0.12, 6, 20),
  hemi: new THREE.SphereGeometry(1, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2),
  plane: new THREE.PlaneGeometry(1, 1),
};

// Three-step gradient for anime-like toon shading.
let toonGradient = null;
function gradient() {
  if (!toonGradient) {
    toonGradient = new THREE.DataTexture(new Uint8Array([90, 170, 255]), 3, 1, THREE.RedFormat);
    toonGradient.minFilter = THREE.NearestFilter;
    toonGradient.magFilter = THREE.NearestFilter;
    toonGradient.generateMipmaps = false;
    toonGradient.needsUpdate = true;
  }
  return toonGradient;
}

const matCache = new Map();
export function toon(color, opts = {}) {
  const key = `t|${color}|${opts.emissive || ''}|${opts.transparent ? opts.opacity : ''}`;
  if (!opts.unique && matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshToonMaterial({ color, gradientMap: gradient() });
  if (opts.emissive) { m.emissive = new THREE.Color(opts.emissive); m.emissiveIntensity = opts.emissiveIntensity ?? 0.8; }
  if (opts.transparent) { m.transparent = true; m.opacity = opts.opacity ?? 0.6; m.depthWrite = false; }
  if (!opts.unique) matCache.set(key, m);
  return m;
}

export function glow(color, opacity = 0.9, additive = true) {
  const key = `g|${color}|${opacity}|${additive}`;
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, fog: true });
  matCache.set(key, m);
  return m;
}

export const vcolLambert = new THREE.MeshLambertMaterial({ vertexColors: true });
export const vcolBasic = new THREE.MeshBasicMaterial({ vertexColors: true });

// Soft round sprite used by particles.
let dotTex = null;
export function dotTexture() {
  if (dotTex) return dotTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.7)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  dotTex = new THREE.CanvasTexture(c);
  return dotTex;
}

export function mesh(geo, mat, t = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(t.x || 0, t.y || 0, t.z || 0);
  m.rotation.set(t.rx || 0, t.ry || 0, t.rz || 0);
  const s = t.s ?? 1;
  m.scale.set(t.sx ?? s, t.sy ?? s, t.sz ?? s);
  return m;
}

export function pivot(x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  return g;
}

export function disposeTree(obj) {
  obj.traverse((o) => {
    if (o.geometry && !Object.values(PRIM).includes(o.geometry)) o.geometry.dispose();
  });
}
