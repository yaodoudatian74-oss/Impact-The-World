// Terrain shape and color for each realm. Pure (no three.js) so it can be tested in node.
// height(x, z) is the single source of truth for the ground; meshes, physics and the map all sample it.

import { createNoise2D, fbm, ridged, hashInts, mulberry32 } from '../core/rng.js';
import { smoothstep, lerp, clamp, distToSegment } from '../core/math.js';
import { WORLD_HALF } from '../data/realms.js';
import { CHAPTERS } from '../data/stories.js';

export function hexLin(hex) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return c;
}
function mix(out, a, b, t) {
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  out[2] = a[2] + (b[2] - a[2]) * t;
  return out;
}
function set(out, a) { out[0] = a[0]; out[1] = a[1]; out[2] = a[2]; return out; }

const BUCKET = 512;
const BUCKETS = (WORLD_HALF * 2) / BUCKET;

// Places the story and the realm data put on the map: flattened ground and connecting roads.
export function collectPlaces(realm) {
  const zones = [];
  const paths = [];
  const hub = realm.hub;
  zones.push({ x: hub.x, z: hub.z, r: 150, kind: 'hub' });
  for (const w of realm.warps) zones.push({ x: w[0], z: w[1], r: 26, kind: 'warp' });
  for (const l of realm.landmarks) zones.push({ x: l.x, z: l.z, r: 80 * l.s, kind: 'landmark' });
  for (const ch of CHAPTERS) {
    if (ch.realm !== realm.id) continue;
    let prev = [hub.x, hub.z];
    for (const st of ch.steps) {
      const pts = [];
      if (st.type === 'collect') for (const p of st.points) zones.push({ x: p[0], z: p[1], r: 16, kind: 'item' });
      if (st.type === 'boss') { zones.push({ x: st.x, z: st.z, r: 95, kind: 'arena' }); pts.push([st.x, st.z]); }
      else if (st.type === 'goto' || st.type === 'defeat') { zones.push({ x: st.x, z: st.z, r: 60, kind: 'spot' }); pts.push([st.x, st.z]); }
      else if (st.type === 'talk' && Math.hypot(st.npc.x - hub.x, st.npc.z - hub.z) > 200) { zones.push({ x: st.npc.x, z: st.npc.z, r: 30, kind: 'spot' }); pts.push([st.npc.x, st.npc.z]); }
      else if (st.type === 'collect') { const c = centroid(st.points); pts.push(c); }
      for (const p of pts) { paths.push([prev[0], prev[1], p[0], p[1]]); prev = p; }
    }
  }
  for (const w of realm.warps) {
    // Connect each warp to the nearest place already on the road network.
    let best = null, bd = Infinity;
    for (const z of zones) {
      if (z.kind === 'warp' || z.kind === 'item') continue;
      const d = Math.hypot(z.x - w[0], z.z - w[1]);
      if (d > 1 && d < bd) { bd = d; best = z; }
    }
    if (best && bd < 2600) paths.push([best.x, best.z, w[0], w[1]]);
  }
  return { zones, paths };
}

function centroid(points) {
  let x = 0, z = 0;
  for (const p of points) { x += p[0]; z += p[1]; }
  return [x / points.length, z / points.length];
}

function bucketize(items, bounds, margin) {
  const grid = Array.from({ length: BUCKETS * BUCKETS }, () => []);
  for (const it of items) {
    const [x0, z0, x1, z1] = bounds(it);
    const bx0 = clamp(Math.floor((x0 - margin + WORLD_HALF) / BUCKET), 0, BUCKETS - 1);
    const bx1 = clamp(Math.floor((x1 + margin + WORLD_HALF) / BUCKET), 0, BUCKETS - 1);
    const bz0 = clamp(Math.floor((z0 - margin + WORLD_HALF) / BUCKET), 0, BUCKETS - 1);
    const bz1 = clamp(Math.floor((z1 + margin + WORLD_HALF) / BUCKET), 0, BUCKETS - 1);
    for (let bz = bz0; bz <= bz1; bz++) for (let bx = bx0; bx <= bx1; bx++) grid[bz * BUCKETS + bx].push(it);
  }
  return grid;
}
const bucketOf = (x, z) => clamp(Math.floor((z + WORLD_HALF) / BUCKET), 0, BUCKETS - 1) * BUCKETS + clamp(Math.floor((x + WORLD_HALF) / BUCKET), 0, BUCKETS - 1);

export function createTerrain(realm) {
  const seed = realm.seed;
  const N = {};
  'abcdefghij'.split('').forEach((k, i) => { N[k] = createNoise2D(seed * 31 + i * 977); });
  const { zones, paths } = collectPlaces(realm);
  const zoneGrid = bucketize(zones, (z) => [z.x - z.r, z.z - z.r, z.x + z.r, z.z + z.r], 0);
  const pathGrid = bucketize(paths, (p) => [Math.min(p[0], p[2]), Math.min(p[1], p[3]), Math.max(p[0], p[2]), Math.max(p[1], p[3])], 40);
  const shape = SHAPES[realm.id](N, realm);

  // Distance to the nearest road segment (Infinity when none is close).
  function roadDist(x, z) {
    const list = pathGrid[bucketOf(x, z)];
    let best = Infinity;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      const d = distToSegment(x, z, p[0], p[1], p[2], p[3]);
      if (d < best) best = d;
    }
    return best;
  }

  function rawHeight(x, z) {
    return shape.height(x, z, roadDist, zoneBoost);
  }

  // Heaven uses zones to guarantee islands under every important place.
  function zoneBoost(x, z) {
    const list = zoneGrid[bucketOf(x, z)];
    let b = 0;
    for (let i = 0; i < list.length; i++) {
      const zn = list[i];
      const dx = x - zn.x, dz = z - zn.z;
      const r = zn.r * 1.6 + 30;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) b = Math.max(b, smoothstep(r, r * 0.45, Math.sqrt(d2)));
    }
    return b;
  }

  function height(x, z) {
    let h = rawHeight(x, z);
    const list = zoneGrid[bucketOf(x, z)];
    for (let i = 0; i < list.length; i++) {
      const zn = list[i];
      if (zn.h === undefined) continue;
      const dx = x - zn.x, dz = z - zn.z;
      if (dx > zn.r || dx < -zn.r || dz > zn.r || dz < -zn.r) continue;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d >= zn.r) continue;
      const w = smoothstep(zn.r, zn.r * 0.55, d);
      h = lerp(h, zn.h, w);
    }
    return h;
  }

  // Flatten targets resolve in priority order, so a zone inside another (a warp inside the
  // town) takes the already-flattened height instead of digging its own pit.
  const priority = { hub: 0, arena: 1, landmark: 2, spot: 3, item: 4, warp: 5 };
  for (const zn of [...zones].sort((a, b) => priority[a.kind] - priority[b.kind])) {
    let t = height(zn.x, zn.z);
    if (shape.minFlat !== undefined) t = Math.max(t, shape.minFlat);
    zn.h = t;
  }

  const tmp = [0, 0, 0];
  function color(x, z, h, ny, out) {
    return shape.color(x, z, h, ny, out || tmp, roadDist);
  }

  // Deterministic per-chunk generator for decorations and points of interest.
  function chunkRng(cx, cz, salt = 0) {
    return mulberry32(hashInts(cx + 7919, cz - 104729, seed + salt));
  }

  return { realm, height, color, roadDist, zones, paths, chunkRng, shape };
}

// ---------------------------------------------------------------------------------------------
// Realm shapes. Each returns { height(x, z, roadDist, zoneBoost), color(...), minFlat? }

const P = {
  grassA: hexLin('#5f9a3c'), grassB: hexLin('#86b04a'), meadow: hexLin('#b6c65a'), sand: hexLin('#d8c48c'), mud: hexLin('#6b6a4a'),
  rock: hexLin('#7d7466'), rockDark: hexLin('#5a544c'), snow: hexLin('#f2f4f8'), dirt: hexLin('#a88a5a'), flower: hexLin('#e7c0d8'),
  basalt: hexLin('#2c2422'), basalt2: hexLin('#43332c'), ash: hexLin('#6e6560'), magmaGlow: hexLin('#ff7a2a'), redRock: hexLin('#7a3424'), crater: hexLin('#3a1814'),
  snowB: hexLin('#e6eef8'), snowShade: hexLin('#c4d4ea'), iceRock: hexLin('#5c6a7e'), iceDeep: hexLin('#7ab0d8'),
  seaSand: hexLin('#c8b88a'), seaRock: hexLin('#2f5a5e'), coralA: hexLin('#e07a8a'), coralB: hexLin('#f0a050'), trench: hexLin('#0e2a40'), seaGrass: hexLin('#3f8a6a'),
  cloudGrass: hexLin('#7fc46a'), cloudGold: hexLin('#d8c46a'), marble: hexLin('#f4efe4'), cliff: hexLin('#cdbfa6'), cliffShade: hexLin('#8a84a8'),
  regolith: hexLin('#8a8698'), regolithDark: hexLin('#4a4658'), crystalA: hexLin('#60e0ff'), crystalB: hexLin('#d070ff'), moonDust: hexLin('#b4b0c4'),
};

const SHAPES = {
  plains(N) {
    const edgeMountain = (x, z) => {
      const e = Math.max(Math.abs(x), Math.abs(z));
      return smoothstep(3450, 4060, e) * (260 + 220 * ridged(N.g, x / 420, z / 420, 3));
    };
    return {
      minFlat: 3,
      height(x, z, roadDist) {
        let h = fbm(N.a, x / 1100, z / 1100, 4) * 26 + 16;
        h += fbm(N.b, x / 260, z / 260, 3) * 7;
        const mMask = smoothstep(0.12, 0.5, fbm(N.c, x / 2300, z / 2300, 2));
        h += mMask * ridged(N.d, x / 620, z / 620, 4) * 240;
        const lake = smoothstep(0.34, 0.5, fbm(N.e, x / 950, z / 950, 3));
        h = lerp(h, -7, lake * (1 - mMask * 0.8));
        const rv = Math.abs(fbm(N.f, x / 1700, z / 1700, 3));
        const river = 1 - smoothstep(0.008, 0.026, rv);
        h = lerp(h, -3.5, river * (1 - mMask * 0.6));
        h += edgeMountain(x, z);
        const rd = roadDist(x, z);
        if (rd < 14) h = lerp(h, Math.max(h * 0.85, 2), smoothstep(14, 4, rd) * 0.5);
        return h;
      },
      color(x, z, h, ny, out, roadDist) {
        if (h < -0.6) return mix(out, P.mud, P.sand, clamp((h + 6) / 6, 0, 1));
        if (h < 2.2) return set(out, P.sand);
        const n = fbm(N.h, x / 140, z / 140, 2);
        mix(out, P.grassA, P.grassB, clamp(n * 0.8 + 0.5, 0, 1));
        const meadow = smoothstep(0.25, 0.55, fbm(N.i, x / 500, z / 500, 2));
        if (meadow > 0) mix(out, out, P.meadow, meadow * 0.6);
        const fl = smoothstep(0.55, 0.7, N.j(x / 40, z / 40)) * meadow;
        if (fl > 0) mix(out, out, P.flower, fl * 0.7);
        const rock = smoothstep(0.86, 0.7, ny) + smoothstep(110, 160, h);
        if (rock > 0) mix(out, out, ny < 0.6 ? P.rockDark : P.rock, clamp(rock, 0, 1));
        if (h > 210) mix(out, out, P.snow, smoothstep(210, 260, h) * smoothstep(0.55, 0.8, ny));
        const rd = roadDist(x, z);
        if (rd < 7) mix(out, out, P.dirt, smoothstep(7, 3, rd) * 0.9);
        return out;
      },
    };
  },

  volcano(N, realm) {
    const vols = realm.volcanoes;
    return {
      minFlat: 6,
      height(x, z, roadDist) {
        let h = fbm(N.a, x / 900, z / 900, 4) * 34 + 30;
        h += ridged(N.b, x / 340, z / 340, 4) * 42 * (0.5 + 0.5 * fbm(N.c, x / 1500, z / 1500, 2));
        for (const v of vols) {
          const d = Math.hypot(x - v.x, z - v.z);
          if (d >= v.r) continue;
          const t = 1 - d / v.r;
          const cr = v.r * v.crater;
          const rimH = v.h * Math.pow(1 - v.crater, 1.6);
          if (d > cr) h += v.h * Math.pow(t, 1.6) * (0.92 + 0.08 * N.d(x / 60, z / 60));
          else {
            const floor = rimH - v.h * 0.22;
            h += floor + (rimH - floor) * Math.pow(d / cr, 3);
          }
        }
        const basin = smoothstep(0.33, 0.46, fbm(N.e, x / 760, z / 760, 3));
        h = lerp(h, -9, basin);
        const rv = Math.abs(fbm(N.f, x / 1400, z / 1400, 3));
        h = lerp(h, -5, 1 - smoothstep(0.01, 0.03, rv));
        const e = Math.max(Math.abs(x), Math.abs(z));
        h += smoothstep(3450, 4060, e) * (300 + 200 * ridged(N.g, x / 400, z / 400, 3));
        const rd = roadDist(x, z);
        if (rd < 12) h = Math.max(h, lerp(h, 6, smoothstep(12, 3, rd)));
        return h;
      },
      color(x, z, h, ny, out, roadDist) {
        if (h < 2.5) return mix(out, P.magmaGlow, P.redRock, clamp(h / 2.5, 0, 1));
        const n = fbm(N.h, x / 120, z / 120, 2);
        mix(out, P.basalt, P.basalt2, clamp(n + 0.5, 0, 1));
        if (h < 8) mix(out, out, P.redRock, smoothstep(8, 3, h));
        const ash = smoothstep(0.85, 0.65, ny) * 0.5 + smoothstep(180, 320, h) * 0.6;
        if (ash > 0) mix(out, out, P.ash, clamp(ash, 0, 1));
        const glow = smoothstep(0.6, 0.75, N.i(x / 30, z / 30)) * smoothstep(0.9, 0.7, ny);
        if (glow > 0) mix(out, out, P.magmaGlow, glow * 0.6);
        const rd = roadDist(x, z);
        if (rd < 6) mix(out, out, P.redRock, smoothstep(6, 2, rd) * 0.7);
        return out;
      },
    };
  },

  ice(N) {
    return {
      minFlat: 2,
      height(x, z, roadDist) {
        let h = fbm(N.a, x / 1000, z / 1000, 4) * 40 + 30;
        const mMask = smoothstep(0.0, 0.45, fbm(N.c, x / 2000, z / 2000, 2));
        h += mMask * ridged(N.d, x / 560, z / 560, 5) * 430;
        h += fbm(N.b, x / 200, z / 200, 2) * 6;
        const lake = smoothstep(0.2, 0.36, fbm(N.e, x / 820, z / 820, 3));
        h = lerp(h, -4, lake * (1 - mMask * 0.7));
        const e = Math.max(Math.abs(x), Math.abs(z));
        h += smoothstep(3450, 4060, e) * (320 + 260 * ridged(N.g, x / 400, z / 400, 3));
        const rd = roadDist(x, z);
        if (rd < 12) h = lerp(h, Math.max(4, h * 0.9), smoothstep(12, 3, rd) * 0.5);
        return h;
      },
      color(x, z, h, ny, out, roadDist) {
        if (h < 0.3) return set(out, P.iceDeep);
        const n = fbm(N.h, x / 160, z / 160, 2);
        mix(out, P.snowB, P.snowShade, clamp(n * 0.7 + 0.35, 0, 1));
        const rock = smoothstep(0.78, 0.55, ny);
        if (rock > 0) mix(out, out, P.iceRock, rock);
        const rd = roadDist(x, z);
        if (rd < 6) mix(out, out, P.snowShade, smoothstep(6, 2, rd) * 0.8);
        return out;
      },
    };
  },

  sea(N) {
    return {
      height(x, z) {
        let h = fbm(N.a, x / 900, z / 900, 4) * 34 - 62;
        h += ridged(N.b, x / 380, z / 380, 4) * 46;
        const tr = Math.abs(fbm(N.c, x / 2100, z / 2100, 3));
        h -= (1 - smoothstep(0.02, 0.09, tr)) * 140;
        const plateau = smoothstep(0.2, 0.4, fbm(N.d, x / 640, z / 640, 3));
        h = lerp(h, -24 + N.e(x / 90, z / 90) * 6, plateau);
        const e = Math.max(Math.abs(x), Math.abs(z));
        h += smoothstep(3450, 4060, e) * 120;
        return Math.min(h, 45);
      },
      color(x, z, h, ny, out) {
        const n = fbm(N.h, x / 150, z / 150, 2);
        mix(out, P.seaSand, P.seaGrass, clamp(n * 0.6 + 0.3, 0, 1));
        if (h < -110) mix(out, out, P.trench, smoothstep(-110, -170, h));
        const coral = smoothstep(-40, -26, h) * smoothstep(0.2, 0.55, fbm(N.i, x / 220, z / 220, 2));
        if (coral > 0) mix(out, out, N.j(x / 80, z / 80) > 0 ? P.coralA : P.coralB, coral * 0.7);
        const rock = smoothstep(0.82, 0.6, ny);
        if (rock > 0) mix(out, out, P.seaRock, rock);
        return out;
      },
    };
  },

  heaven(N) {
    return {
      height(x, z, roadDist, zoneBoost) {
        let mask = fbm(N.a, x / 1000, z / 1000, 3) * 0.72 + fbm(N.b, x / 260, z / 260, 2) * 0.28;
        mask = Math.max(mask, zoneBoost(x, z) * 0.6);
        const rd = roadDist(x, z);
        if (rd < 30) {
          const gaps = smoothstep(-0.62, -0.42, N.c(x / 150, z / 150));
          mask = Math.max(mask, smoothstep(30, 10, rd) * 0.4 * gaps);
        }
        const island = smoothstep(-0.04, 0.08, mask);
        if (island <= 0) return -260;
        const top = 34 + fbm(N.d, x / 400, z / 400, 3) * 22 + ridged(N.e, x / 300, z / 300, 3) * 40 * smoothstep(0.2, 0.5, mask);
        return lerp(-260, top, island);
      },
      color(x, z, h, ny, out, roadDist) {
        if (h < 10) return mix(out, P.cliffShade, P.cliff, clamp((h + 260) / 270, 0, 1));
        const n = fbm(N.h, x / 140, z / 140, 2);
        mix(out, P.cloudGrass, P.cloudGold, clamp(n * 0.7 + 0.4, 0, 1));
        const rock = smoothstep(0.8, 0.6, ny);
        if (rock > 0) mix(out, out, P.cliff, rock);
        const rd = roadDist(x, z);
        if (rd < 6) mix(out, out, P.marble, smoothstep(6, 2.5, rd));
        return out;
      },
    };
  },

  space(N) {
    const CELL = 260;
    function craters(x, z) {
      const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
      let h = 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const hsh = hashInts(cx + dx, cz + dz, 6607);
        if ((hsh & 7) > 4) continue;
        const r1 = ((hsh >>> 3) & 1023) / 1023, r2 = ((hsh >>> 13) & 1023) / 1023, r3 = ((hsh >>> 23) & 511) / 511;
        const px = (cx + dx + 0.2 + r1 * 0.6) * CELL, pz = (cz + dz + 0.2 + r2 * 0.6) * CELL;
        const R = 25 + r3 * 95;
        const d = Math.hypot(x - px, z - pz);
        const t = d / R;
        if (t > 1.8) continue;
        const depth = R * 0.32;
        if (t < 1) h -= (1 - t * t) * depth;
        h += depth * 0.4 * Math.exp(-((t - 1) * (t - 1)) / 0.06);
      }
      return h;
    }
    return {
      height(x, z, roadDist) {
        let h = fbm(N.a, x / 1200, z / 1200, 4) * 40 + 10;
        h += ridged(N.b, x / 500, z / 500, 4) * 100 * smoothstep(0.1, 0.5, fbm(N.c, x / 2500, z / 2500, 2));
        h += craters(x, z);
        h += fbm(N.d, x / 90, z / 90, 2) * 2;
        const e = Math.max(Math.abs(x), Math.abs(z));
        h += smoothstep(3450, 4060, e) * (260 + 200 * ridged(N.g, x / 400, z / 400, 3));
        const rd = roadDist(x, z);
        if (rd < 10) h = lerp(h, h * 0.8 + 2, smoothstep(10, 3, rd) * 0.5);
        return h;
      },
      color(x, z, h, ny, out, roadDist) {
        const n = fbm(N.h, x / 160, z / 160, 2);
        mix(out, P.regolith, P.moonDust, clamp(n * 0.7 + 0.4, 0, 1));
        if (h < 0) mix(out, out, P.regolithDark, smoothstep(0, -30, h));
        const rock = smoothstep(0.8, 0.55, ny);
        if (rock > 0) mix(out, out, P.regolithDark, rock * 0.8);
        const cr = smoothstep(0.45, 0.6, fbm(N.i, x / 420, z / 420, 2));
        if (cr > 0) mix(out, out, N.j(x / 50, z / 50) > 0 ? P.crystalA : P.crystalB, cr * 0.45);
        const rd = roadDist(x, z);
        if (rd < 5) mix(out, out, P.regolithDark, smoothstep(5, 2, rd) * 0.6);
        return out;
      },
    };
  },
};
