// Static scenery: decoration geometries per realm, hub towns and landmarks.

import { GeoBuilder, PRIM, jitter } from './geo.js';
import { mulberry32 } from '../core/rng.js';

const rng = mulberry32(42);

function tree(trunk, leaves, leaves2) {
  return new GeoBuilder()
    .add(PRIM.cyl6, trunk, { y: 1.6, sx: 0.28, sz: 0.28, sy: 3.2 })
    .add(PRIM.sphereLo, leaves, { y: 4.2, sx: 2.2, sy: 1.9, sz: 2.2 })
    .add(PRIM.sphereLo, leaves2, { y: 5.3, x: 0.5, sx: 1.5, sy: 1.4, sz: 1.5, ry: 0.5 })
    .add(PRIM.sphereLo, leaves2, { y: 3.8, x: -1.1, z: 0.6, s: 1.2, ry: 1 })
    .build();
}
function pine(trunk, a, b, snow) {
  const g = new GeoBuilder().add(PRIM.cyl6, trunk, { y: 1, sx: 0.25, sz: 0.25, sy: 2 });
  g.add(PRIM.cone6, a, { y: 3, sx: 1.9, sz: 1.9, sy: 3 });
  g.add(PRIM.cone6, b, { y: 4.8, sx: 1.4, sz: 1.4, sy: 2.6 });
  g.add(PRIM.cone6, snow || a, { y: 6.4, sx: 0.9, sz: 0.9, sy: 2 });
  return g.build();
}
function rock(color, color2) {
  return new GeoBuilder()
    .add(jitter(PRIM.dodeca.clone(), 0.5, rng), color, { y: 0.4, sx: 1.2, sy: 0.8, sz: 1 })
    .add(jitter(PRIM.dodeca.clone(), 0.4, rng), color2 || color, { y: 0.25, x: 0.9, s: 0.55 })
    .build();
}
function bush(color, color2) {
  return new GeoBuilder()
    .add(PRIM.sphereLo, color, { y: 0.5, sx: 1.1, sy: 0.8, sz: 1.1 })
    .add(PRIM.sphereLo, color2, { y: 0.6, x: 0.6, z: 0.3, s: 0.6 })
    .build();
}
function flowers(colors) {
  const g = new GeoBuilder();
  for (let i = 0; i < 5; i++) {
    const a = rng() * 6.28, r = rng() * 0.7;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    g.add(PRIM.cyl, '#4f8a3a', { x, z, y: 0.2, sx: 0.02, sz: 0.02, sy: 0.4 });
    g.add(PRIM.sphereLo, colors[i % colors.length], { x, z, y: 0.42, s: 0.1 });
  }
  return g.build();
}
function grass(color, color2) {
  const g = new GeoBuilder();
  for (let i = 0; i < 6; i++) {
    const a = rng() * 6.28, r = rng() * 0.5;
    g.add(PRIM.cone4, i % 2 ? color : color2, { x: Math.cos(a) * r, z: Math.sin(a) * r, y: 0.3, rx: (rng() - 0.5) * 0.5, rz: (rng() - 0.5) * 0.5, sx: 0.07, sz: 0.04, sy: 0.6 + rng() * 0.3 });
  }
  return g.build();
}
function crystal(c1, c2) {
  const g = new GeoBuilder();
  g.add(PRIM.octa, c1, { y: 1.2, sx: 0.4, sz: 0.4, sy: 1.4 });
  g.add(PRIM.octa, c2, { x: 0.5, y: 0.7, rz: -0.5, sx: 0.25, sz: 0.25, sy: 0.9 });
  g.add(PRIM.octa, c2, { x: -0.4, z: 0.3, y: 0.6, rz: 0.6, sx: 0.22, sz: 0.22, sy: 0.7 });
  return g.build();
}

// Decoration sets per realm. density = average instances per 128x128 chunk.
export function realmDecor(realmId) {
  switch (realmId) {
    case 'plains': return [
      { id: 'tree', geo: tree('#6b4a2e', '#4f8f35', '#68a840'), density: 9, scale: [0.8, 1.6], minH: 3, maxH: 140, minNy: 0.82, collider: 0.5, cluster: 0.55 },
      { id: 'pine', geo: pine('#5a3a24', '#2f6b3a', '#3a7a42'), density: 5, scale: [0.8, 1.5], minH: 30, maxH: 230, minNy: 0.75, collider: 0.4, cluster: 0.4 },
      { id: 'bush', geo: bush('#4f8a35', '#6aa640'), density: 12, scale: [0.6, 1.4], minH: 2, maxH: 150, minNy: 0.75 },
      { id: 'rock', geo: rock('#8a8478', '#6f6a60'), density: 5, scale: [0.6, 3.2], minH: -5, maxH: 400, minNy: 0, collider: 1.0 },
      { id: 'flowers', geo: flowers(['#ffe066', '#ff8ab0', '#ffffff', '#b08aff']), density: 26, scale: [0.8, 1.3], minH: 2, maxH: 100, minNy: 0.85, range: 2 },
      { id: 'grass', geo: grass('#5f9a3c', '#7fb84a'), density: 70, scale: [0.8, 1.4], minH: 1.5, maxH: 120, minNy: 0.8, range: 1 },
    ];
    case 'volcano': return [
      { id: 'deadtree', geo: new GeoBuilder().add(PRIM.cyl6, '#2a1f1a', { y: 1.8, sx: 0.25, sz: 0.25, sy: 3.6 }).add(PRIM.cyl6, '#2a1f1a', { y: 3, x: 0.6, rz: -0.9, sx: 0.12, sz: 0.12, sy: 1.6 }).add(PRIM.cyl6, '#2a1f1a', { y: 2.5, x: -0.5, rz: 0.8, sx: 0.1, sz: 0.1, sy: 1.3 }).build(), density: 5, scale: [0.8, 1.5], minH: 6, maxH: 400, minNy: 0.7, collider: 0.4 },
      { id: 'basalt', geo: new GeoBuilder().add(PRIM.cyl6, '#2c2826', { y: 1.5, sx: 0.6, sz: 0.6, sy: 3 }).add(PRIM.cyl6, '#3a3330', { y: 1, x: 1, sx: 0.55, sz: 0.55, sy: 2 }).add(PRIM.cyl6, '#252220', { y: 2, x: 0.4, z: 0.9, sx: 0.55, sz: 0.55, sy: 4 }).build(), density: 4, scale: [0.7, 2.2], minH: 5, maxH: 500, minNy: 0, collider: 1.2 },
      { id: 'obsidian', geo: new GeoBuilder().add(PRIM.octa, '#14101a', { y: 1, sx: 0.5, sz: 0.4, sy: 1.6, rz: 0.2 }).add(PRIM.octa, '#221a2a', { y: 0.6, x: 0.5, sx: 0.3, sz: 0.3, sy: 1, rz: -0.5 }).build(), density: 5, scale: [0.6, 2], minH: 4, maxH: 500, minNy: 0 },
      { id: 'firecrystal', geo: crystal('#ff8a3a', '#ffcf5a'), density: 3, scale: [0.6, 1.6], minH: 4, maxH: 500, minNy: 0.6, glow: true },
      { id: 'vrock', geo: rock('#4a3a34', '#5a2a20'), density: 7, scale: [0.6, 3], minH: 3, maxH: 600, minNy: 0, collider: 1.0 },
      { id: 'ashgrass', geo: grass('#6a4a3a', '#8a5a3a'), density: 22, scale: [0.8, 1.3], minH: 5, maxH: 200, minNy: 0.8, range: 1 },
    ];
    case 'ice': return [
      { id: 'snowpine', geo: pine('#4a3a2e', '#2f5a4a', '#3a6a58', '#f4f8ff'), density: 10, scale: [0.8, 1.7], minH: 2, maxH: 300, minNy: 0.78, collider: 0.4, cluster: 0.5 },
      { id: 'icespike', geo: new GeoBuilder().add(PRIM.cone6, '#bfe8ff', { y: 1.6, sx: 0.6, sz: 0.6, sy: 3.2 }).add(PRIM.cone6, '#e0f6ff', { y: 1, x: 0.7, rz: -0.3, sx: 0.4, sz: 0.4, sy: 2 }).build(), density: 5, scale: [0.6, 2.4], minH: -1, maxH: 600, minNy: 0, collider: 0.6 },
      { id: 'icecrystal', geo: crystal('#9ff0ff', '#e0fbff'), density: 3, scale: [0.6, 1.6], minH: 0, maxH: 600, minNy: 0.5, glow: true },
      { id: 'snowrock', geo: rock('#8a98ac', '#eef4fa'), density: 6, scale: [0.6, 3], minH: 0, maxH: 800, minNy: 0, collider: 1.0 },
      { id: 'snowbush', geo: bush('#e8f0f8', '#cfdcec'), density: 10, scale: [0.6, 1.3], minH: 1, maxH: 200, minNy: 0.8 },
    ];
    case 'sea': return [
      { id: 'coral', geo: new GeoBuilder().add(PRIM.cyl6, '#ff7a8a', { y: 0.8, sx: 0.12, sz: 0.12, sy: 1.6 }).add(PRIM.cyl6, '#ff8a9a', { y: 1.4, x: 0.35, rz: -0.6, sx: 0.09, sz: 0.09, sy: 1 }).add(PRIM.cyl6, '#ff6a7a', { y: 1.2, x: -0.3, rz: 0.7, sx: 0.09, sz: 0.09, sy: 0.9 }).add(PRIM.sphereLo, '#ffb0c0', { y: 1.7, x: 0.6, s: 0.15 }).build(), density: 14, scale: [0.8, 2.2], minH: -200, maxH: 60, minNy: 0.6 },
      { id: 'fan', geo: new GeoBuilder().add(PRIM.cyl, '#f0a050', { y: 1, rx: Math.PI / 2, sx: 1, sz: 1, sy: 0.05 }).add(PRIM.cyl, '#d07a30', { y: 0.3, sx: 0.06, sz: 0.06, sy: 0.6 }).build(), density: 10, scale: [0.7, 2], minH: -200, maxH: 60, minNy: 0.6 },
      { id: 'kelp', geo: (() => { const g = new GeoBuilder(); for (let i = 0; i < 7; i++) g.add(PRIM.box, i % 2 ? '#3f8a4a' : '#2f7a3a', { y: 0.9 + i * 1.6, x: Math.sin(i * 0.9) * 0.3, rz: Math.sin(i) * 0.25, sx: 0.4, sy: 1.7, sz: 0.06 }); return g.build(); })(), density: 18, scale: [0.6, 1.8], minH: -200, maxH: 40, minNy: 0.5 },
      { id: 'anemone', geo: new GeoBuilder().add(PRIM.sphereLo, '#a05ad0', { y: 0.3, s: 0.45 }).add(PRIM.cone6, '#e0a0ff', { y: 0.8, sx: 0.08, sz: 0.08, sy: 0.6 }).add(PRIM.cone6, '#e0a0ff', { y: 0.7, x: 0.25, rz: -0.5, sx: 0.08, sz: 0.08, sy: 0.6 }).add(PRIM.cone6, '#e0a0ff', { y: 0.7, x: -0.25, rz: 0.5, sx: 0.08, sz: 0.08, sy: 0.6 }).build(), density: 8, scale: [0.8, 2], minH: -200, maxH: 60, minNy: 0.6 },
      { id: 'searock', geo: rock('#2f5a5e', '#3a6a62'), density: 8, scale: [0.8, 4], minH: -300, maxH: 60, minNy: 0, collider: 1.0 },
      { id: 'pearl', geo: crystal('#bff4ff', '#ffffff'), density: 2, scale: [0.5, 1.2], minH: -300, maxH: 60, minNy: 0.5, glow: true },
    ];
    case 'heaven': return [
      { id: 'goldtree', geo: tree('#f4efe4', '#f0d070', '#ffe8a0'), density: 6, scale: [0.8, 1.6], minH: 10, maxH: 200, minNy: 0.8, collider: 0.5 },
      { id: 'pillar', geo: new GeoBuilder().add(PRIM.cyl, '#f6f2ea', { y: 3, sx: 0.5, sz: 0.5, sy: 6 }).add(PRIM.box, '#e8dcc0', { y: 6.2, sx: 1.4, sy: 0.4, sz: 1.4 }).add(PRIM.box, '#e8dcc0', { y: 0.2, sx: 1.3, sy: 0.4, sz: 1.3 }).build(), density: 1.5, scale: [0.6, 1.4], minH: 10, maxH: 200, minNy: 0.7, collider: 0.7 },
      { id: 'cloudbush', geo: bush('#ffffff', '#f0f4ff'), density: 10, scale: [0.6, 1.6], minH: 10, maxH: 200, minNy: 0.75 },
      { id: 'lightcrystal', geo: crystal('#fff1a0', '#ffffff'), density: 2.5, scale: [0.6, 1.5], minH: 10, maxH: 200, minNy: 0.6, glow: true },
      { id: 'hflowers', geo: flowers(['#fff6c0', '#ffd0e8', '#ffffff', '#c0e0ff']), density: 26, scale: [0.8, 1.3], minH: 10, maxH: 200, minNy: 0.85, range: 2 },
      { id: 'hgrass', geo: grass('#a8d88a', '#c8e8a0'), density: 50, scale: [0.8, 1.3], minH: 10, maxH: 200, minNy: 0.8, range: 1 },
    ];
    case 'space': return [
      { id: 'scrystal', geo: crystal('#60e0ff', '#d070ff'), density: 5, scale: [0.6, 2.5], minH: -100, maxH: 600, minNy: 0.5, glow: true },
      { id: 'mushroom', geo: new GeoBuilder().add(PRIM.cyl6, '#c8c0e0', { y: 1, sx: 0.15, sz: 0.15, sy: 2 }).add(PRIM.hemi, '#7a4ad0', { y: 2, sx: 0.9, sy: 0.6, sz: 0.9 }).add(PRIM.sphereLo, '#d0b0ff', { y: 2.2, x: 0.3, s: 0.12 }).build(), density: 5, scale: [0.6, 2], minH: -100, maxH: 300, minNy: 0.75, collider: 0.3 },
      { id: 'moonrock', geo: rock('#6a6678', '#8a8698'), density: 10, scale: [0.6, 3.5], minH: -100, maxH: 700, minNy: 0, collider: 1.0 },
      { id: 'asteroid', geo: rock('#4a4658', '#5a5668'), density: 1.2, scale: [3, 9], minH: -100, maxH: 700, minNy: 0, yOffset: [25, 90] },
      { id: 'antenna', geo: new GeoBuilder().add(PRIM.cyl6, '#9aa0b0', { y: 2, sx: 0.08, sz: 0.08, sy: 4 }).add(PRIM.sphereLo, '#ff4a6a', { y: 4.1, s: 0.18 }).add(PRIM.box, '#6a7080', { y: 0.2, sx: 0.8, sy: 0.4, sz: 0.8 }).build(), density: 0.4, scale: [0.8, 1.5], minH: -100, maxH: 500, minNy: 0.8, collider: 0.5 },
    ];
    default: return [];
  }
}

// ---------------------------------------------------------------------------------------------
// Towns: returns { geo, glowGeo, colliders: [x, z, r][], spin: [{x,y,z,r}] }

export function buildTown(style, hub, heightAt) {
  const g = new GeoBuilder(), gl = new GeoBuilder();
  const colliders = [];
  const spinners = [];
  const r = mulberry32(hub.x * 31 + hub.z * 17 + style.length);
  const place = (dx, dz) => ({ x: hub.x + dx, z: hub.z + dz, y: heightAt(hub.x + dx, hub.z + dz) });
  const slots = [];
  for (let ring = 0; ring < 2; ring++) {
    const n = ring === 0 ? 7 : 10;
    const rad = ring === 0 ? 55 : 95;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + ring * 0.3 + 0.2;
      slots.push([Math.cos(a) * rad, Math.sin(a) * rad, a]);
    }
  }
  for (const [dx, dz, a] of slots) {
    const p = place(dx, dz);
    const face = -a + Math.PI / 2;
    const s = 0.9 + r() * 0.4;
    buildingAt(style, g, gl, p, face, s, r);
    colliders.push([p.x, p.z, 5.5 * s]);
  }
  // Plaza centerpiece
  const c = place(0, -28);
  if (style === 'village') {
    g.add(PRIM.cyl, '#8a8478', { x: c.x, y: c.y + 0.5, z: c.z, sx: 2.2, sz: 2.2, sy: 1 });
    g.add(PRIM.cyl, '#3f8fd0', { x: c.x, y: c.y + 0.95, z: c.z, sx: 1.9, sz: 1.9, sy: 0.1 });
    g.add(PRIM.box, '#6b4a2e', { x: c.x - 1.6, y: c.y + 2, z: c.z, sx: 0.2, sy: 3, sz: 0.2 });
    g.add(PRIM.box, '#6b4a2e', { x: c.x + 1.6, y: c.y + 2, z: c.z, sx: 0.2, sy: 3, sz: 0.2 });
    g.add(PRIM.cone4, '#a83a2a', { x: c.x, y: c.y + 4, z: c.z, ry: Math.PI / 4, sx: 2.6, sz: 2.6, sy: 1.4 });
  } else {
    g.add(PRIM.cyl, styleColors(style).trim, { x: c.x, y: c.y + 0.6, z: c.z, sx: 2.5, sz: 2.5, sy: 1.2 });
    gl.add(PRIM.octa, styleColors(style).glow, { x: c.x, y: c.y + 3, z: c.z, s: 1, sy: 1.6 });
  }
  colliders.push([c.x, c.z, 2.6]);
  // Lanterns around the plaza
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const p = place(Math.cos(a) * 30, Math.sin(a) * 30);
    g.add(PRIM.cyl6, '#3a3030', { x: p.x, y: p.y + 1.5, z: p.z, sx: 0.08, sz: 0.08, sy: 3 });
    gl.add(PRIM.box, styleColors(style).glow, { x: p.x, y: p.y + 3.1, z: p.z, s: 0.35 });
  }
  return { geo: g.build(), glowGeo: gl.build(), colliders, spinners };
}

function styleColors(style) {
  return {
    village: { wall: '#efe2c4', roof: '#b0452f', trim: '#6b4a2e', glow: '#ffd890' },
    fort: { wall: '#5a4a44', roof: '#2a2220', trim: '#3a2a26', glow: '#ff9a3a' },
    snow: { wall: '#8a5a3a', roof: '#f4f8ff', trim: '#5a3a24', glow: '#ffe0a0' },
    atlantis: { wall: '#d8f0f0', roof: '#3fb0c0', trim: '#c8a860', glow: '#7ff7e8' },
    temple: { wall: '#f8f4ec', roof: '#e8c860', trim: '#d6b25a', glow: '#fff6c0' },
    station: { wall: '#c8ccd8', roof: '#6a7080', trim: '#4a5060', glow: '#7ad0ff' },
  }[style];
}

function buildingAt(style, g, gl, p, face, s, r) {
  const C = styleColors(style);
  const rot = (lx, lz) => [p.x + (lx * Math.cos(face) + lz * Math.sin(face)) * s, p.z + (-lx * Math.sin(face) + lz * Math.cos(face)) * s];
  const at = (lx, ly, lz, t) => {
    const [x, z] = rot(lx, lz);
    return { ...t, x, z, y: p.y + ly * s, ry: face + (t.ry || 0), sx: (t.sx ?? t.s ?? 1) * s, sy: (t.sy ?? t.s ?? 1) * s, sz: (t.sz ?? t.s ?? 1) * s };
  };
  switch (style) {
    case 'village': {
      const w = 7 + r() * 3, d = 6 + r() * 2, h = 4 + r() * 1.5;
      g.add(PRIM.box, C.wall, at(0, h / 2 - 1, 0, { sx: w, sy: h + 2, sz: d }));
      g.add(PRIM.cone4, C.roof, at(0, h + 2.2, 0, { ry: Math.PI / 4, sx: w * 0.82, sy: 3.4, sz: d * 0.82 }));
      g.add(PRIM.box, C.trim, at(0, 1.1, d / 2 + 0.05, { sx: 1.4, sy: 2.2, sz: 0.2 }));
      gl.add(PRIM.box, C.glow, at(w / 4, 2.6, d / 2 + 0.06, { sx: 1, sy: 1, sz: 0.1 }));
      gl.add(PRIM.box, C.glow, at(-w / 4, 2.6, d / 2 + 0.06, { sx: 1, sy: 1, sz: 0.1 }));
      g.add(PRIM.box, '#8a7a6a', at(w / 3, h + 3, -d / 4, { sx: 0.8, sy: 2.5, sz: 0.8 }));
      break;
    }
    case 'fort': {
      const w = 7 + r() * 2;
      g.add(PRIM.box, C.wall, at(0, 3, 0, { sx: w, sy: 8, sz: w }));
      for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(PRIM.box, C.trim, at(lx * w * 0.42, 7.6, lz * w * 0.42, { sx: 1.2, sy: 1.4, sz: 1.2 }));
      g.add(PRIM.cyl6, C.roof, at(w * 0.25, 9, 0, { sx: 0.8, sz: 0.8, sy: 4 }));
      gl.add(PRIM.box, C.glow, at(0, 1.4, w / 2 + 0.05, { sx: 2, sy: 2.8, sz: 0.1 }));
      break;
    }
    case 'snow': {
      if (r() < 0.4) {
        g.add(PRIM.hemi, '#f4f8ff', at(0, -0.5, 0, { s: 4.5 }));
        g.add(PRIM.cyl, '#e8eef8', at(0, 1, 4, { rx: Math.PI / 2, sx: 1.5, sz: 1.5, sy: 2.5 }));
        gl.add(PRIM.cyl, C.glow, at(0, 1, 5.3, { rx: Math.PI / 2, sx: 1, sz: 1, sy: 0.1 }));
      } else {
        const w = 7, d = 6;
        g.add(PRIM.box, C.wall, at(0, 1.5, 0, { sx: w, sy: 5, sz: d }));
        g.add(PRIM.cone4, C.roof, at(0, 5.6, 0, { ry: Math.PI / 4, sx: w * 0.85, sy: 3.4, sz: d * 0.85 }));
        gl.add(PRIM.box, C.glow, at(0, 1.8, d / 2 + 0.05, { sx: 1.2, sy: 1.2, sz: 0.1 }));
      }
      break;
    }
    case 'atlantis': {
      g.add(PRIM.cyl, C.wall, at(0, 3, 0, { sx: 3.2, sz: 3.2, sy: 10 }));
      g.add(PRIM.hemi, C.roof, at(0, 8, 0, { s: 3.6 }));
      g.add(PRIM.cyl, C.trim, at(0, 8, 0, { sx: 3.7, sz: 3.7, sy: 0.4 }));
      gl.add(PRIM.box, C.glow, at(0, 3, 3.2, { sx: 1.4, sy: 2.4, sz: 0.1 }));
      gl.add(PRIM.sphereLo, C.glow, at(0, 12, 0, { s: 0.6 }));
      break;
    }
    case 'temple': {
      g.add(PRIM.box, C.wall, at(0, 0.3, 0, { sx: 9, sy: 0.6, sz: 9 }));
      for (const [lx, lz] of [[-3.5, -3.5], [3.5, -3.5], [-3.5, 3.5], [3.5, 3.5]]) g.add(PRIM.cyl, C.wall, at(lx, 3.5, lz, { sx: 0.5, sz: 0.5, sy: 6 }));
      g.add(PRIM.box, C.wall, at(0, 6.8, 0, { sx: 9, sy: 0.6, sz: 9 }));
      g.add(PRIM.hemi, C.roof, at(0, 7, 0, { s: 3.6 }));
      gl.add(PRIM.octa, C.glow, at(0, 2.5, 0, { s: 0.8, sy: 1.3 }));
      break;
    }
    case 'station': {
      g.add(PRIM.hemi, C.wall, at(0, 0, 0, { s: 5 }));
      g.add(PRIM.cyl, C.trim, at(0, 0.3, 0, { sx: 5.2, sz: 5.2, sy: 0.6 }));
      g.add(PRIM.cyl6, C.roof, at(3, 5, 0, { sx: 0.12, sz: 0.12, sy: 5 }));
      g.add(PRIM.hemi, '#e0e4ec', at(3, 7.5, 0, { rx: 2.2, s: 1.4 }));
      gl.add(PRIM.box, C.glow, at(0, 1.5, 5, { sx: 1.6, sy: 2.4, sz: 0.2 }));
      gl.add(PRIM.box, C.glow, at(0, 3.8, 3.3, { sx: 4, sy: 0.3, sz: 0.2 }));
      break;
    }
    default: break;
  }
}

// ---------------------------------------------------------------------------------------------
// Landmarks: big set pieces. Returns { geo, glowGeo, colliders: [dx, dz, r][] } relative to the origin.

export function buildLandmark(type, s) {
  const g = new GeoBuilder(), gl = new GeoBuilder();
  const col = [];
  const r = mulberry32(type.length * 977 + Math.round(s * 100));
  const ringOf = (n, rad, fn) => { for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; fn(Math.cos(a) * rad, Math.sin(a) * rad, a, i); } };
  switch (type) {
    case 'ruins':
      ringOf(10, 26, (x, z, a, i) => {
        const h = i % 3 === 0 ? 5 : 12 + r() * 6;
        g.add(PRIM.cyl, '#d8d0bc', { x, z, y: h / 2, sx: 1.3, sz: 1.3, sy: h });
        col.push([x, z, 1.6]);
      });
      g.add(PRIM.box, '#c8c0aa', { y: 0.4, sx: 30, sy: 0.8, sz: 30 });
      g.add(PRIM.box, '#d8d0bc', { y: 18, x: 0, z: -26, sx: 18, sy: 2, sz: 3 });
      gl.add(PRIM.cyl, '#fff2a8', { y: 60, sx: 3, sz: 3, sy: 120 });
      break;
    case 'stonecircle':
      ringOf(12, 22, (x, z, a) => { g.add(PRIM.box, '#8a8a90', { x, z, y: 4, ry: -a, sx: 2.4, sy: 8 + r() * 4, sz: 1.4 }); col.push([x, z, 1.8]); });
      gl.add(PRIM.torus, '#7fe8c6', { y: 0.5, rx: Math.PI / 2, s: 14 });
      break;
    case 'worldtree':
      g.add(PRIM.cyl6, '#5a3a24', { y: 60, sx: 12, sz: 12, sy: 120 });
      ringOf(6, 10, (x, z) => g.add(PRIM.cone6, '#5a3a24', { x, z, y: 6, rz: x * 0.05, rx: -z * 0.05, sx: 5, sz: 5, sy: 14 }));
      g.add(PRIM.sphereLo, '#3f8f35', { y: 130, sx: 70, sy: 40, sz: 70 });
      g.add(PRIM.sphereLo, '#58a840', { y: 155, x: 20, sx: 45, sy: 30, sz: 45 });
      g.add(PRIM.sphereLo, '#4a9a3a', { y: 115, x: -35, z: 20, sx: 40, sy: 25, sz: 40 });
      ringOf(14, 60, (x, z) => gl.add(PRIM.sphereLo, '#fff6a0', { x, z, y: 105 + r() * 30, s: 2 }));
      col.push([0, 0, 13]);
      break;
    case 'castle':
      for (const [x, z] of [[-30, -30], [30, -30], [-30, 30], [30, 30]]) {
        g.add(PRIM.cyl, '#8a8478', { x, z, y: 14, sx: 6, sz: 6, sy: 28 });
        g.add(PRIM.cone, '#4a5a8a', { x, z, y: 33, sx: 7, sz: 7, sy: 10 });
        col.push([x, z, 6.5]);
      }
      for (const [x, z, ry] of [[0, -30, 0], [0, 30, 0], [-30, 0, Math.PI / 2], [30, 0, Math.PI / 2]]) {
        g.add(PRIM.box, '#9a9488', { x, z, y: 8, ry, sx: 54, sy: 16, sz: 3 });
      }
      g.add(PRIM.box, '#8a8478', { y: 18, sx: 20, sy: 36, sz: 20 });
      g.add(PRIM.cone4, '#4a5a8a', { y: 42, ry: Math.PI / 4, sx: 16, sz: 16, sy: 12 });
      col.push([0, 0, 14]);
      for (let i = -2; i <= 2; i++) { col.push([i * 10, -30, 3]); col.push([i * 10, 30, 3]); col.push([-30, i * 10, 3]); col.push([30, i * 10, 3]); }
      break;
    case 'windmill':
      g.add(PRIM.cyl6, '#efe2c4', { y: 10, sx: 4, sz: 4, sy: 20 });
      g.add(PRIM.cone6, '#b0452f', { y: 23, sx: 5, sz: 5, sy: 6 });
      col.push([0, 0, 4.5]);
      break;
    case 'forge':
      g.add(PRIM.box, '#3a2a26', { y: 10, sx: 40, sy: 20, sz: 30 });
      g.add(PRIM.cyl6, '#2a1f1a', { x: 12, y: 30, sx: 4, sz: 4, sy: 24 });
      g.add(PRIM.cyl6, '#2a1f1a', { x: -12, y: 26, sx: 3, sz: 3, sy: 18 });
      gl.add(PRIM.box, '#ff6a1a', { y: 6, z: 15.1, sx: 12, sy: 10, sz: 0.4 });
      gl.add(PRIM.sphereLo, '#ff8a3a', { x: 12, y: 43, s: 3 });
      col.push([0, -2, 20], [-12, 6, 10], [12, 6, 10]);
      break;
    case 'crystalcave':
      g.add(jitter(PRIM.dodeca.clone(), 0.3, r), '#3a2e2a', { y: 6, sx: 30, sy: 16, sz: 24 });
      ringOf(10, 22, (x, z) => gl.add(PRIM.octa, r() > 0.5 ? '#ff4a7a' : '#ff9a3a', { x, z, y: 4, sx: 1.5, sz: 1.5, sy: 5 + r() * 4, rz: (r() - 0.5) }));
      col.push([0, 0, 22]);
      break;
    case 'obelisk':
      g.add(PRIM.cone4, '#14101a', { y: 25, sx: 5, sz: 5, sy: 50 });
      gl.add(PRIM.octa, '#ff5a2a', { y: 52, s: 2 });
      col.push([0, 0, 4]);
      break;
    case 'icespire':
      g.add(PRIM.cone6, '#9fd8f5', { y: 50, sx: 14, sz: 14, sy: 100 });
      ringOf(6, 18, (x, z) => g.add(PRIM.cone6, '#c8eeff', { x, z, y: 18, rz: x * 0.03, rx: -z * 0.03, sx: 6, sz: 6, sy: 36 }));
      gl.add(PRIM.octa, '#e0fbff', { y: 105, s: 6 });
      col.push([0, 0, 14]);
      break;
    case 'icetower':
      g.add(PRIM.cyl, '#d8ecf8', { y: 40, sx: 10, sz: 10, sy: 80 });
      g.add(PRIM.cone, '#9fd0f0', { y: 90, sx: 12, sz: 12, sy: 20 });
      ringOf(4, 10, (x, z) => gl.add(PRIM.box, '#9ff2e0', { x, z, y: 60, sx: 2, sy: 4, sz: 2 }));
      col.push([0, 0, 11]);
      break;
    case 'shrine':
      g.add(PRIM.box, '#c43a4a', { x: -5, y: 6, sx: 1, sy: 12, sz: 1 });
      g.add(PRIM.box, '#c43a4a', { x: 5, y: 6, sx: 1, sy: 12, sz: 1 });
      g.add(PRIM.box, '#2a2224', { y: 12.5, sx: 15, sy: 1.2, sz: 1.6 });
      g.add(PRIM.box, '#c43a4a', { y: 10.5, sx: 12, sy: 0.8, sz: 1 });
      col.push([-5, 0, 1], [5, 0, 1]);
      break;
    case 'shipwreck':
      g.add(PRIM.sphere, '#5a4030', { y: 4, rz: 0.25, sx: 9, sy: 6, sz: 28 });
      g.add(PRIM.cyl6, '#4a3424', { y: 18, x: 2, rz: 0.4, sx: 0.8, sz: 0.8, sy: 26 });
      g.add(PRIM.box, '#d8d0c0', { y: 22, x: 6, rz: 0.4, sx: 0.3, sy: 12, sz: 10 });
      col.push([0, -12, 7], [0, 0, 8], [0, 12, 7]);
      break;
    case 'seatemple':
      g.add(PRIM.box, '#d8f0f0', { y: 1, sx: 50, sy: 2, sz: 50 });
      ringOf(12, 22, (x, z) => { g.add(PRIM.cyl, '#c8e8e8', { x, z, y: 9, sx: 1.6, sz: 1.6, sy: 16 }); col.push([x, z, 2]); });
      g.add(PRIM.hemi, '#3fb0c0', { y: 17, s: 18 });
      gl.add(PRIM.sphereLo, '#7ff7e8', { y: 30, s: 3 });
      break;
    case 'giantcoral':
      ringOf(7, 20, (x, z, a, i) => {
        const h = 20 + r() * 25;
        g.add(PRIM.cyl6, i % 2 ? '#ff7a8a' : '#f0a050', { x, z, y: h / 2, sx: 2.2, sz: 2.2, sy: h });
        g.add(PRIM.sphereLo, i % 2 ? '#ffb0c0' : '#ffd080', { x, z, y: h, s: 5 });
        col.push([x, z, 2.6]);
      });
      break;
    case 'bones':
      for (let i = 0; i < 8; i++) {
        g.add(PRIM.torus, '#e8e0d0', { z: (i - 4) * 9, y: 4, s: 16 - Math.abs(i - 3.5) * 1.6, sz: 1, rz: 0 });
      }
      g.add(PRIM.sphere, '#e8e0d0', { z: 42, y: 8, sx: 12, sy: 9, sz: 14 });
      break;
    case 'cathedral':
      g.add(PRIM.box, '#f6f2ea', { y: 15, sx: 30, sy: 30, sz: 50 });
      g.add(PRIM.cone4, '#2a2036', { y: 38, ry: Math.PI / 4, sx: 24, sz: 36, sy: 16 });
      for (const x of [-15, 15]) { g.add(PRIM.cyl, '#f6f2ea', { x, z: 25, y: 25, sx: 4, sz: 4, sy: 50 }); g.add(PRIM.cone, '#2a2036', { x, z: 25, y: 55, sx: 5, sz: 5, sy: 12 }); col.push([x, 25, 4.5]); }
      gl.add(PRIM.cyl, '#a35cff', { y: 22, z: 25.2, rx: Math.PI / 2, sx: 7, sz: 7, sy: 0.4 });
      col.push([0, -8, 16], [0, 8, 16]);
      break;
    case 'throne':
      g.add(PRIM.cyl, '#f8f4ec', { y: 3, sx: 40, sz: 40, sy: 6 });
      g.add(PRIM.box, '#f0d070', { y: 14, z: -25, sx: 14, sy: 22, sz: 4 });
      g.add(PRIM.box, '#f8f4ec', { y: 8, z: -20, sx: 14, sy: 4, sz: 10 });
      ringOf(8, 36, (x, z) => { g.add(PRIM.cyl, '#f8f4ec', { x, z, y: 14, sx: 1.4, sz: 1.4, sy: 22 }); col.push([x, z, 1.8]); });
      gl.add(PRIM.torus, '#ffe08a', { y: 30, z: -25, s: 8 });
      col.push([0, -23, 8]);
      break;
    case 'fountain':
      g.add(PRIM.cyl, '#f8f4ec', { y: 1, sx: 16, sz: 16, sy: 2 });
      g.add(PRIM.cyl, '#f8f4ec', { y: 4, sx: 7, sz: 7, sy: 2 });
      g.add(PRIM.cyl, '#f8f4ec', { y: 7, sx: 2, sz: 2, sy: 6 });
      gl.add(PRIM.cyl, '#8ae0ff', { y: 2.1, sx: 15, sz: 15, sy: 0.2 });
      gl.add(PRIM.torus, '#ff8ab0', { y: 14, rx: 0, s: 12 });
      gl.add(PRIM.torus, '#ffe06a', { y: 14, rx: 0, s: 10.5 });
      gl.add(PRIM.torus, '#8ae0ff', { y: 14, rx: 0, s: 9 });
      col.push([0, 0, 16]);
      break;
    case 'goldtree':
      g.add(PRIM.cyl6, '#f4efe4', { y: 25, sx: 4, sz: 4, sy: 50 });
      g.add(PRIM.sphereLo, '#f0d070', { y: 55, sx: 26, sy: 18, sz: 26 });
      g.add(PRIM.sphereLo, '#ffe8a0', { y: 66, x: 8, sx: 16, sy: 12, sz: 16 });
      col.push([0, 0, 4.5]);
      break;
    case 'nest':
      ringOf(16, 34, (x, z, a) => { g.add(PRIM.cone6, '#2a2440', { x, z, y: 8, rz: Math.cos(a) * 0.5, rx: -Math.sin(a) * 0.5, sx: 3, sz: 3, sy: 18 }); col.push([x, z, 2.5]); });
      gl.add(PRIM.torus, '#ff6ad5', { y: 0.6, rx: Math.PI / 2, s: 28 });
      break;
    case 'voidgate':
      g.add(PRIM.torus, '#140c1f', { y: 22, s: 18 });
      gl.add(PRIM.cyl, '#a35cff', { y: 22, rx: Math.PI / 2, sx: 16, sz: 16, sy: 0.3 });
      g.add(PRIM.box, '#140c1f', { x: -18, y: 2, sx: 4, sy: 4, sz: 6 });
      g.add(PRIM.box, '#140c1f', { x: 18, y: 2, sx: 4, sy: 4, sz: 6 });
      col.push([-18, 0, 3], [18, 0, 3]);
      break;
    case 'voidthrone':
      g.add(PRIM.cyl6, '#140c1f', { y: 2, sx: 60, sz: 60, sy: 4 });
      ringOf(10, 55, (x, z) => { g.add(PRIM.cone4, '#2a0f3d', { x, z, y: 20, sx: 3, sz: 3, sy: 40 }); col.push([x, z, 2.5]); });
      g.add(PRIM.box, '#2a0f3d', { y: 15, z: -45, sx: 16, sy: 26, sz: 4 });
      gl.add(PRIM.octa, '#ff3a8a', { y: 40, z: -45, s: 4 });
      col.push([0, -45, 9]);
      break;
    case 'spaceship':
      g.add(PRIM.sphere, '#a8b0c0', { y: 8, rz: 0.15, sx: 12, sy: 8, sz: 40 });
      g.add(PRIM.cone4, '#7a8090', { y: 10, z: -32, x: 10, rz: -0.8, sx: 2, sz: 10, sy: 18 });
      g.add(PRIM.cone4, '#7a8090', { y: 10, z: -32, x: -10, rz: 0.8, sx: 2, sz: 10, sy: 18 });
      gl.add(PRIM.cyl, '#7ad0ff', { y: 9, z: -40, rx: Math.PI / 2, sx: 5, sz: 5, sy: 1 });
      col.push([0, -20, 10], [0, 0, 11], [0, 20, 10]);
      break;
    default: break;
  }
  const scaleAll = (b) => { const geo = b.build(); geo.scale(s, s, s); geo.computeBoundingSphere(); return geo; };
  return { geo: scaleAll(g), glowGeo: gl.parts.length ? scaleAll(gl) : null, colliders: col.map(([x, z, rr]) => [x * s, z * s, rr * s]) };
}

// Warp point: stone base with a floating crystal.
export function buildWarpGeo() {
  return new GeoBuilder()
    .add(PRIM.cyl6, '#8a8a98', { y: 0.3, sx: 2.2, sz: 2.2, sy: 0.6 })
    .add(PRIM.cyl6, '#a8a8b8', { y: 0.8, sx: 1.6, sz: 1.6, sy: 0.4 })
    .add(PRIM.cone4, '#6a6a7a', { y: 2, sx: 0.5, sz: 0.5, sy: 2.4 })
    .build();
}

