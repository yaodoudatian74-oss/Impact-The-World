// Realm environment: streamed terrain chunks, distant terrain, decoration instancing, sky, water,
// particles, towns, landmarks and the static interactables that live in the world.

import * as THREE from 'three';
import { REALM_BY_ID, WORLD_HALF, CHUNK } from '../data/realms.js';
import { createTerrain } from './terrain.js';
import { realmDecor, buildTown, buildLandmark, buildWarpGeo } from './props.js';
import { PRIM, toon, glow, mesh, vcolLambert, vcolBasic, dotTexture, GeoBuilder } from './geo.js';
import { mulberry32 } from '../core/rng.js';
import { clamp } from '../core/math.js';

const CHUNKS = (WORLD_HALF * 2) / CHUNK; // 64
const SKIRT = 18;

export const QUALITY = {
  high: { radius: 3, segs: 24, decor: 1, particles: 1, farRes: 256, pixelRatio: 2 },
  medium: { radius: 2, segs: 20, decor: 0.7, particles: 0.7, farRes: 192, pixelRatio: 1.5 },
  low: { radius: 2, segs: 14, decor: 0.4, particles: 0.4, farRes: 128, pixelRatio: 1 },
};

const terrainMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
// Adds world-space value-noise detail so the ground does not look smeared up close.
terrainMat.onBeforeCompile = (sh) => {
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', `#include <common>
varying vec3 vWPos;
float tHash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float tNoise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(tHash(i), tHash(i + vec2(1.0, 0.0)), u.x), mix(tHash(i + vec2(0.0, 1.0)), tHash(i + vec2(1.0, 1.0)), u.x), u.y); }`)
    .replace('#include <color_fragment>', `#include <color_fragment>
  float dn = tNoise(vWPos.xz * 0.18) * 0.55 + tNoise(vWPos.xz * 0.9) * 0.3 + tNoise(vWPos.xz * 3.7) * 0.15;
  diffuseColor.rgb *= 0.72 + 0.56 * dn;`);
};
const UPDRAFT_GEO = new THREE.CylinderGeometry(4.5, 5.5, 140, 16, 1, true);
const updraftMat = new THREE.MeshBasicMaterial({ color: '#fff6c0', transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });

function fogShader(frag, vert) {
  return {
    vertexShader: `
      varying vec3 vW;
      #include <fog_pars_vertex>
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vec4 mvPosition = viewMatrix * w;
        gl_Position = projectionMatrix * mvPosition;
        ${vert || ''}
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform float time;
      uniform vec3 colA;
      uniform vec3 colB;
      uniform float opacity;
      varying vec3 vW;
      #include <fog_pars_fragment>
      ${frag}
      `,
  };
}

function makeSurfaceMaterial(kind, a, b, opacity) {
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    time: { value: 0 }, colA: { value: new THREE.Color(a) }, colB: { value: new THREE.Color(b) }, opacity: { value: opacity },
  }]);
  const bodies = {
    water: `void main() {
        float n = sin(vW.x * 0.15 + time * 1.2) * sin(vW.z * 0.13 - time * 0.9) + 0.5 * sin((vW.x + vW.z) * 0.07 + time * 0.6);
        vec3 c = mix(colB, colA, 0.62 + 0.18 * n);
        float sp = pow(max(0.0, sin(vW.x * 0.9 + time * 2.0) * sin(vW.z * 0.8 - time * 1.7)), 14.0);
        c += vec3(sp * 0.6);
        gl_FragColor = vec4(c, opacity);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
    lava: `void main() {
        vec2 p = vW.xz * 0.04;
        float n = sin(p.x * 3.1 + time * 0.7 + sin(p.y * 2.3 + time * 0.4) * 2.0) * sin(p.y * 2.7 - time * 0.5 + sin(p.x * 1.7) * 2.0);
        float m = smoothstep(-0.3, 0.9, n);
        vec3 c = mix(colA, colB, m);
        c *= 1.0 + 0.3 * sin(time * 2.0 + p.x * 4.0);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
    cloud: `void main() {
        vec2 p = vW.xz * 0.006;
        float n = sin(p.x * 3.0 + time * 0.05) * sin(p.y * 2.6 - time * 0.04) + 0.5 * sin(p.x * 7.1 + p.y * 5.3 + time * 0.08);
        vec3 c = mix(colB, colA, smoothstep(-0.8, 0.9, n));
        gl_FragColor = vec4(c, opacity);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  };
  const sh = fogShader(bodies[kind]);
  return new THREE.ShaderMaterial({ uniforms, vertexShader: sh.vertexShader, fragmentShader: sh.fragmentShader, fog: true, transparent: opacity < 1, depthWrite: opacity >= 1, side: THREE.DoubleSide });
}

function makeSkyMaterial(sky, sunDir) {
  return new THREE.ShaderMaterial({
    uniforms: {
      top: { value: new THREE.Color(sky.top) }, horizon: { value: new THREE.Color(sky.horizon) }, bottom: { value: new THREE.Color(sky.bottom) },
      sunColor: { value: new THREE.Color(sky.sun) }, sunDir: { value: sunDir.clone().normalize() },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: `
      uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; uniform vec3 sunColor; uniform vec3 sunDir;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float y = d.y;
        vec3 c = y > 0.0 ? mix(horizon, top, pow(smoothstep(0.0, 1.0, y), 0.55)) : mix(horizon, bottom, smoothstep(0.0, 0.35, -y));
        float s = max(dot(d, sunDir), 0.0);
        c += sunColor * (pow(s, 900.0) * 6.0 + pow(s, 14.0) * 0.28);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
  });
}

export class World {
  constructor(scene, quality = QUALITY.high) {
    this.scene = scene;
    this.q = quality;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.chunks = new Map();
    this.queue = [];
    this.time = 0;
    this.focusChunk = [-999, -999];
    this.farDirty = false;
    this.decorDirty = false;
    this.staticColliders = Array.from({ length: CHUNKS * CHUNKS }, () => []);
    this.chests = [];
    this.shards = [];
    this.updrafts = [];
    this.warps = [];
    this.realm = null;
    this.mapCanvas = null;
    this.mapProgress = 0;
    this.onChunksChanged = null;
  }

  // ---------------------------------------------------------------- loading
  load(realmId, saveState) {
    this.unload();
    const realm = REALM_BY_ID[realmId];
    this.realm = realm;
    this.save = saveState;
    this.T = createTerrain(realm);
    this.waterLevel = realm.water ? realm.water.level : null;
    this.lavaLevel = realm.lava ? realm.lava.level : null;
    this.iceLevel = realm.ice ? realm.ice.level : null;
    this.cloudSea = realm.cloudSea ?? null;
    this.surface = realm.surface ?? null;
    this.decorTypes = realmDecor(realm.id).map((d) => ({ ...d, density: d.density * this.q.decor }));

    this.buildLights();
    this.buildSky();
    this.buildFar();
    this.buildSurfaces();
    this.buildParticles();
    this.buildDecorMeshes();
    this.buildTownAndLandmarks();
    this.buildWarps();
    this.startMap();
  }

  unload() {
    for (const c of this.chunks.values()) this.disposeChunk(c);
    this.chunks.clear();
    this.queue = [];
    while (this.group.children.length) {
      const o = this.group.children.pop();
      o.traverse((n) => {
        if (n.geometry && !Object.values(PRIM).includes(n.geometry)) n.geometry.dispose();
        if (n.material && n.material.isShaderMaterial) n.material.dispose();
      });
    }
    this.staticColliders.forEach((a) => { a.length = 0; });
    this.chests = [];
    this.shards = [];
    this.updrafts = [];
    this.warps = [];
    this.decorMeshes = [];
    this.focusChunk = [-999, -999];
  }

  buildLights() {
    const L = this.realm.light;
    const hemi = new THREE.HemisphereLight(L.hemiSky, L.hemiGround, L.hemiI);
    this.group.add(hemi);
    const sun = new THREE.DirectionalLight(L.sun, L.sunI);
    this.sunDir = new THREE.Vector3(...L.dir).normalize();
    sun.position.copy(this.sunDir).multiplyScalar(100);
    this.group.add(sun);
    this.group.add(sun.target);
    this.sunLight = sun;
    const f = this.realm.fog;
    this.scene.fog = new THREE.Fog(f.color, f.near, f.far);
    this.scene.background = new THREE.Color(f.color);
  }

  buildSky() {
    const realm = this.realm;
    const sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 32, 16), makeSkyMaterial(realm.sky, this.sunDir));
    sky.renderOrder = -1000;
    sky.frustumCulled = false;
    this.sky = sky;
    this.group.add(sky);
    const r = mulberry32(realm.seed);
    if (realm.id === 'space' || realm.id === 'sea') {
      // Stars (space) or drifting plankton glints (sea) on the sky sphere.
      const n = realm.id === 'space' ? 2600 : 0;
      if (n) {
        const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
        const c = new THREE.Color();
        for (let i = 0; i < n; i++) {
          const u = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - u * u);
          pos.set([Math.cos(a) * s * 2800, Math.abs(u) * 2800 * (u < -0.2 ? -1 : 1), Math.sin(a) * s * 2800], i * 3);
          c.setHSL(0.55 + r() * 0.2, 0.5, 0.7 + r() * 0.3);
          col.set([c.r, c.g, c.b], i * 3);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        const stars = new THREE.Points(g, new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, fog: false, depthWrite: false, transparent: true }));
        stars.renderOrder = -999;
        stars.frustumCulled = false;
        sky.add(stars);
      }
    }
    if (realm.id === 'space') {
      const planet = (x, y, z, rad, c1, c2, ring) => {
        const g = new THREE.Group();
        g.add(new THREE.Mesh(new THREE.SphereGeometry(rad, 48, 24), new THREE.MeshLambertMaterial({ color: c1, emissive: c2, emissiveIntensity: 0.25, fog: false })));
        if (ring) {
          const rm = new THREE.Mesh(new THREE.RingGeometry(rad * 1.4, rad * 2.2, 64), new THREE.MeshBasicMaterial({ color: c2, transparent: true, opacity: 0.55, side: THREE.DoubleSide, fog: false }));
          rm.rotation.x = 1.2;
          g.add(rm);
        }
        g.position.set(x, y, z);
        g.renderOrder = -998;
        sky.add(g);
      };
      planet(-1400, 900, -2000, 520, '#5a7ad8', '#3ad0ff', true);
      planet(1800, 500, 1200, 220, '#d86a4a', '#ffb070', false);
      planet(600, 1600, 1800, 140, '#b0e080', '#40ff90', false);
      // Nebula glow
      const neb = (x, y, z, s, c) => {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(), color: c, transparent: true, opacity: 0.35, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
        sp.position.set(x, y, z);
        sp.scale.setScalar(s);
        sp.renderOrder = -999;
        sky.add(sp);
      };
      neb(800, 1200, -2200, 2200, '#a040ff');
      neb(-1800, 600, 1400, 1800, '#2060ff');
      neb(2000, 300, -600, 1400, '#ff40a0');
    }
    if (realm.id === 'plains' || realm.id === 'heaven' || realm.id === 'ice') {
      const n = realm.id === 'heaven' ? 260 : 120;
      const g = new GeoBuilder()
        .add(PRIM.sphereLo, '#ffffff', { sx: 1, sy: 0.45, sz: 1 })
        .add(PRIM.sphereLo, '#f4f6ff', { x: 0.8, y: 0.1, sx: 0.7, sy: 0.4, sz: 0.7 })
        .add(PRIM.sphereLo, '#f8f8ff', { x: -0.7, y: 0.05, sx: 0.6, sy: 0.35, sz: 0.6 })
        .build();
      const clouds = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, emissive: '#ffffff', emissiveIntensity: 0.35 }), n);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
      for (let i = 0; i < n; i++) {
        const sc = 40 + r() * 120;
        const y = realm.id === 'heaven' ? (r() < 0.5 ? -40 + r() * 60 : 160 + r() * 300) : 380 + r() * 350;
        p.set((r() * 2 - 1) * WORLD_HALF, y, (r() * 2 - 1) * WORLD_HALF);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6.28);
        s.set(sc, sc * (0.6 + r() * 0.5), sc);
        m.compose(p, q, s);
        clouds.setMatrixAt(i, m);
      }
      clouds.frustumCulled = false;
      this.clouds = clouds;
      this.group.add(clouds);
    }
  }

  // Low-resolution mesh of the whole realm, with holes where detailed chunks are loaded.
  buildFar() {
    const R = this.q.farRes;
    const step = (WORLD_HALF * 2) / R;
    const n = R + 1;
    const pos = new Float32Array(n * n * 3), nor = new Float32Array(n * n * 3), col = new Float32Array(n * n * 3);
    const H = new Float32Array(n * n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) H[j * n + i] = this.T.height(-WORLD_HALF + i * step, -WORLD_HALF + j * step);
    const c = [0, 0, 0];
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const k = j * n + i;
      const x = -WORLD_HALF + i * step, z = -WORLD_HALF + j * step;
      const hL = H[j * n + Math.max(0, i - 1)], hR = H[j * n + Math.min(R, i + 1)];
      const hD = H[Math.max(0, j - 1) * n + i], hU = H[Math.min(R, j + 1) * n + i];
      const nx = hL - hR, ny = 2 * step, nz = hD - hU;
      const len = Math.hypot(nx, ny, nz);
      pos.set([x, H[k] - 0.6, z], k * 3);
      nor.set([nx / len, ny / len, nz / len], k * 3);
      this.T.color(x, z, H[k], ny / len, c);
      col.set(c, k * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.farIndex = new Uint32Array(R * R * 6);
    g.setIndex(new THREE.BufferAttribute(this.farIndex, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), WORLD_HALF * 1.5);
    this.far = new THREE.Mesh(g, terrainMat);
    this.far.frustumCulled = false;
    this.farRes = R;
    this.group.add(this.far);
    this.rebuildFarIndex();
  }

  rebuildFarIndex() {
    const R = this.farRes, n = R + 1;
    const per = R / CHUNKS; // far cells per chunk
    let o = 0;
    const idx = this.farIndex;
    for (let j = 0; j < R; j++) {
      const cz = Math.floor(j / per);
      for (let i = 0; i < R; i++) {
        const cx = Math.floor(i / per);
        const ch = this.chunks.get(cz * CHUNKS + cx);
        if (ch && ch.mesh) continue;
        const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
        idx[o++] = a; idx[o++] = c; idx[o++] = b;
        idx[o++] = b; idx[o++] = c; idx[o++] = d;
      }
    }
    const g = this.far.geometry;
    g.index.needsUpdate = true;
    g.setDrawRange(0, o);
  }

  buildSurfaces() {
    const realm = this.realm;
    const size = 9000;
    if (realm.water) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), makeSurfaceMaterial('water', realm.water.color, realm.water.deep, realm.water.opacity));
      m.rotation.x = -Math.PI / 2;
      m.position.y = realm.water.level;
      m.renderOrder = 5;
      this.surfaceMesh = m;
      this.group.add(m);
    }
    if (realm.lava) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), makeSurfaceMaterial('lava', '#ff3a00', '#ffd040', 1));
      m.rotation.x = -Math.PI / 2;
      m.position.y = realm.lava.level;
      this.surfaceMesh = m;
      this.group.add(m);
    }
    if (realm.ice) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshLambertMaterial({ color: '#d4eeff', transparent: true, opacity: 0.88, emissive: '#3a6a90', emissiveIntensity: 0.15 }));
      m.rotation.x = -Math.PI / 2;
      m.position.y = realm.ice.level;
      this.surfaceMesh = m;
      this.group.add(m);
    }
    if (realm.cloudSea !== undefined) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), makeSurfaceMaterial('cloud', '#ffffff', '#e8e4f4', 0.97));
      m.rotation.x = -Math.PI / 2;
      m.position.y = realm.cloudSea;
      this.surfaceMesh = m;
      this.group.add(m);
    }
    if (realm.surface !== undefined) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), makeSurfaceMaterial('water', '#9ff0ff', '#3ab0d8', 0.65));
      m.rotation.x = Math.PI / 2;
      m.position.y = realm.surface;
      this.surfaceMesh = m;
      this.group.add(m);
      // Light shafts from the surface that follow the player.
      const rays = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({ color: '#bff4ff', transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
      const r = mulberry32(9);
      for (let i = 0; i < 14; i++) {
        const ray = new THREE.Mesh(new THREE.CylinderGeometry(3 + r() * 5, 10 + r() * 10, 220, 8, 1, true), mat);
        ray.position.set((r() - 0.5) * 160, 0, (r() - 0.5) * 160);
        ray.rotation.z = 0.15;
        rays.add(ray);
      }
      this.rays = rays;
      this.group.add(rays);
    }
  }

  buildParticles() {
    const P = this.realm.particles;
    const n = Math.round(P.count * this.q.particles);
    const pos = new Float32Array(n * 3);
    const r = mulberry32(5);
    for (let i = 0; i < n; i++) pos.set([(r() - 0.5) * 80, (r() - 0.5) * 50, (r() - 0.5) * 80], i * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const additive = P.type === 'embers' || P.type === 'motes' || P.type === 'stardust';
    const size = { snow: 0.45, embers: 0.35, pollen: 0.22, bubbles: 0.4, motes: 0.4, stardust: 0.3 }[P.type] || 0.3;
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: P.color, size, map: dotTexture(), transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, opacity: 0.9 }));
    pts.frustumCulled = false;
    this.particles = { pts, n, type: P.type, seeds: Float32Array.from({ length: n }, () => r()) };
    this.group.add(pts);
  }

  buildDecorMeshes() {
    const R = this.q.radius;
    this.decorMeshes = this.decorTypes.map((d) => {
      const range = Math.min(d.range ?? R, R);
      const cap = Math.ceil(d.density * (2 * range + 1) ** 2 * 2.2) + 16;
      const m = new THREE.InstancedMesh(d.geo, d.glow ? vcolBasic : vcolLambert, cap);
      m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
      m.count = 0;
      m.frustumCulled = false;
      this.group.add(m);
      return { def: d, mesh: m, cap, range };
    });
  }

  buildTownAndLandmarks() {
    const realm = this.realm;
    const h = (x, z) => this.T.height(x, z);
    const town = buildTown(realm.hub.style, realm.hub, h);
    this.group.add(new THREE.Mesh(town.geo, vcolLambert));
    this.group.add(new THREE.Mesh(town.glowGeo, vcolBasic));
    for (const [x, z, r] of town.colliders) this.addStaticCollider(x, z, r);
    this.landmarks = [];
    for (const l of realm.landmarks) {
      const lm = buildLandmark(l.type, l.s);
      const y = h(l.x, l.z);
      const g = new THREE.Group();
      g.position.set(l.x, y, l.z);
      g.add(new THREE.Mesh(lm.geo, vcolLambert));
      if (lm.glowGeo) g.add(new THREE.Mesh(lm.glowGeo, vcolBasic));
      if (l.type === 'windmill') {
        const blades = new THREE.Group();
        blades.position.set(0, 20 * l.s, 4.4 * l.s);
        for (let i = 0; i < 4; i++) {
          const arm = new THREE.Group();
          arm.rotation.z = (i * Math.PI) / 2;
          arm.add(mesh(PRIM.box, toon('#e8dcc0'), { y: 9 * l.s, sx: 2.2 * l.s, sy: 18 * l.s, sz: 0.3 }));
          blades.add(arm);
        }
        g.add(blades);
        this.windmill = blades;
      }
      this.group.add(g);
      for (const [dx, dz, r] of lm.colliders) this.addStaticCollider(l.x + dx, l.z + dz, r);
      this.landmarks.push({ ...l, y });
    }
    // Dimension gate in the hub: opens realm travel.
    const gate = new THREE.Group();
    const gx = realm.hub.x, gz = realm.hub.z - 8;
    gate.position.set(gx, h(gx, gz), gz);
    gate.add(mesh(PRIM.torus, toon('#c9a54a'), { y: 6.5, s: 5.2 }));
    const disc = mesh(new THREE.CircleGeometry(5, 32), new THREE.MeshBasicMaterial({ color: '#8a6aff', transparent: true, opacity: 0.55, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }), { y: 6.5 });
    gate.add(disc);
    gate.add(mesh(PRIM.box, toon('#6a5a4a'), { y: 0.4, sx: 12, sy: 0.8, sz: 3 }));
    this.gate = { x: gx, z: gz, y: gate.position.y, obj: gate, disc };
    this.group.add(gate);
    this.addStaticCollider(gx - 5.3, gz, 0.8);
    this.addStaticCollider(gx + 5.3, gz, 0.8);
  }

  buildWarps() {
    const geo = buildWarpGeo();
    const unlocked = new Set(this.save.warps[this.realm.id] || []);
    this.realm.warps.forEach(([x, z, name], i) => {
      const id = `w${i}`;
      const y = this.T.height(x, z);
      const g = new THREE.Group();
      g.position.set(x, y, z);
      g.add(new THREE.Mesh(geo, vcolLambert));
      const on = unlocked.has(id) || i === 0;
      const crystal = mesh(PRIM.octa, glow(on ? '#6ad8ff' : '#8a8a9a', 0.95, false), { y: 4.6, s: 0.8, sy: 1.3 });
      g.add(crystal);
      const beam = mesh(PRIM.cyl, glow('#6ad8ff', 0.12), { y: 40, sx: 0.6, sz: 0.6, sy: 80 });
      beam.visible = on;
      g.add(beam);
      this.group.add(g);
      this.addStaticCollider(x, z, 1.6);
      this.warps.push({ id, name, x, y, z, crystal, beam, unlocked: on });
      if (this.realm.id === 'heaven' && i > 0) {
        const ux = x + 16, uz = z - 16;
        const u = { x: ux, z: uz, y: this.T.height(ux, uz), r: 5, top: 150, obj: this.makeUpdraft(ux, uz), static: true };
        this.group.add(u.obj);
        this.updrafts.push(u);
      }
    });
  }

  setWarpUnlocked(w) {
    w.unlocked = true;
    w.crystal.material = glow('#6ad8ff', 0.95, false);
    w.beam.visible = true;
  }

  addStaticCollider(x, z, r) {
    const cx0 = this.chunkCoord(x - r), cx1 = this.chunkCoord(x + r);
    const cz0 = this.chunkCoord(z - r), cz1 = this.chunkCoord(z + r);
    for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) this.staticColliders[cz * CHUNKS + cx].push([x, z, r]);
  }

  chunkCoord(v) { return clamp(Math.floor((v + WORLD_HALF) / CHUNK), 0, CHUNKS - 1); }

  // ---------------------------------------------------------------- queries
  height(x, z) { return this.T.height(x, z); }

  // Walkable surface: terrain, or the frozen lake sheet in the ice realm.
  groundY(x, z) {
    const h = this.T.height(x, z);
    if (this.iceLevel !== null && h < this.iceLevel) return this.iceLevel;
    return h;
  }

  // Calls fn(x, z, r) for every solid circle near (x, z).
  forColliders(x, z, fn) {
    const cx = this.chunkCoord(x), cz = this.chunkCoord(z);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const kx = cx + dx, kz = cz + dz;
      if (kx < 0 || kz < 0 || kx >= CHUNKS || kz >= CHUNKS) continue;
      const k = kz * CHUNKS + kx;
      for (const c of this.staticColliders[k]) fn(c[0], c[1], c[2]);
      const ch = this.chunks.get(k);
      if (ch && ch.colliders) for (const c of ch.colliders) fn(c[0], c[1], c[2]);
    }
  }

  // Pushes a circle at pos out of colliders. Mutates pos (Vector3).
  resolveCollisions(pos, radius) {
    this.forColliders(pos.x, pos.z, (cx, cz, r) => {
      const dx = pos.x - cx, dz = pos.z - cz;
      const min = r + radius;
      const d2 = dx * dx + dz * dz;
      if (d2 < min * min && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * min;
        pos.z = cz + (dz / d) * min;
      }
    });
  }

  // ---------------------------------------------------------------- streaming
  update(dt, focus, camera) {
    this.time += dt;
    const cx = this.chunkCoord(focus.x), cz = this.chunkCoord(focus.z);
    if (cx !== this.focusChunk[0] || cz !== this.focusChunk[1]) {
      this.focusChunk = [cx, cz];
      this.refreshChunkSet(cx, cz);
    }
    // Build a few chunks per frame, nearest first.
    let built = 0;
    const t0 = performance.now();
    while (this.queue.length && built < 3 && performance.now() - t0 < 8) {
      const k = this.queue.shift();
      const ch = this.chunks.get(k);
      if (ch && !ch.mesh) { this.buildChunk(ch); built++; }
    }
    if (built) { this.farDirty = true; this.decorDirty = true; }
    if (this.farDirty) { this.rebuildFarIndex(); this.farDirty = false; }
    if (this.decorDirty) { this.rebuildDecor(); this.decorDirty = false; this.onChunksChanged?.(); }

    // Environment follows the camera.
    this.sky.position.copy(camera.position);
    if (this.surfaceMesh) {
      this.surfaceMesh.position.x = focus.x;
      this.surfaceMesh.position.z = focus.z;
      if (this.surfaceMesh.material.uniforms) this.surfaceMesh.material.uniforms.time.value = this.time;
    }
    if (this.rays) { this.rays.position.set(focus.x, this.surface - 110, focus.z); this.rays.rotation.y = this.time * 0.02; }
    this.sunLight.position.copy(focus).addScaledVector(this.sunDir, 200);
    this.sunLight.target.position.copy(focus);
    if (this.windmill) this.windmill.rotation.z += dt * 0.4;
    if (this.gate) this.gate.disc.material.opacity = 0.45 + Math.sin(this.time * 2) * 0.15;
    for (const w of this.warps) { w.crystal.rotation.y += dt; w.crystal.position.y = 4.6 + Math.sin(this.time * 2 + w.x) * 0.25; }
    for (const s of this.shards) { s.obj.rotation.y += dt * 2; s.obj.position.y = s.y + 1.4 + Math.sin(this.time * 3 + s.x) * 0.25; }
    updraftMat.opacity = 0.18 + Math.sin(this.time * 3) * 0.05;
    this.updateParticles(dt, camera.position);
    this.stepMap();
  }

  refreshChunkSet(cx, cz) {
    const R = this.q.radius;
    const want = new Set();
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      const x = cx + dx, z = cz + dz;
      if (x < 0 || z < 0 || x >= CHUNKS || z >= CHUNKS) continue;
      want.add(z * CHUNKS + x);
    }
    let changed = false;
    for (const [k, ch] of this.chunks) {
      const x = k % CHUNKS, z = Math.floor(k / CHUNKS);
      if (Math.max(Math.abs(x - cx), Math.abs(z - cz)) > R + 1) { this.disposeChunk(ch); this.chunks.delete(k); changed = true; }
    }
    for (const k of want) if (!this.chunks.has(k)) this.chunks.set(k, { k, cx: k % CHUNKS, cz: Math.floor(k / CHUNKS), mesh: null });
    this.queue = [...this.chunks.values()].filter((c) => !c.mesh).sort((a, b) => Math.max(Math.abs(a.cx - cx), Math.abs(a.cz - cz)) - Math.max(Math.abs(b.cx - cx), Math.abs(b.cz - cz))).map((c) => c.k);
    if (changed) { this.farDirty = true; this.decorDirty = true; }
  }

  // Synchronously builds everything around a point (used right after loading or warping).
  primeAround(x, z) {
    const cx = this.chunkCoord(x), cz = this.chunkCoord(z);
    this.focusChunk = [cx, cz];
    this.refreshChunkSet(cx, cz);
    for (const k of this.queue) { const ch = this.chunks.get(k); if (ch && !ch.mesh) this.buildChunk(ch); }
    this.queue = [];
    this.rebuildFarIndex();
    this.rebuildDecor();
    this.onChunksChanged?.();
  }

  buildChunk(ch) {
    const S = this.q.segs;
    const step = CHUNK / S;
    const x0 = -WORLD_HALF + ch.cx * CHUNK, z0 = -WORLD_HALF + ch.cz * CHUNK;
    const G = S + 3; // includes a ring of skirt vertices
    const Hs = new Float32Array(G * G);
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) Hs[j * G + i] = this.T.height(x0 + (i - 1) * step, z0 + (j - 1) * step);
    const pos = new Float32Array(G * G * 3), nor = new Float32Array(G * G * 3), col = new Float32Array(G * G * 3);
    const c = [0, 0, 0];
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
      const ii = clamp(i, 1, S + 1), jj = clamp(j, 1, S + 1);
      const skirt = ii !== i || jj !== j;
      const x = x0 + (ii - 1) * step, z = z0 + (jj - 1) * step;
      const h = Hs[jj * G + ii];
      const k = (j * G + i) * 3;
      pos[k] = x; pos[k + 1] = skirt ? h - SKIRT : h; pos[k + 2] = z;
      const nx = Hs[jj * G + ii - 1] - Hs[jj * G + ii + 1];
      const nz = Hs[(jj - 1) * G + ii] - Hs[(jj + 1) * G + ii];
      const ny = 2 * step;
      const len = Math.hypot(nx, ny, nz);
      nor[k] = nx / len; nor[k + 1] = ny / len; nor[k + 2] = nz / len;
      this.T.color(x, z, h, ny / len, c);
      col[k] = c[0]; col[k + 1] = c[1]; col[k + 2] = c[2];
    }
    const idx = new Uint16Array((G - 1) * (G - 1) * 6);
    let o = 0;
    for (let j = 0; j < G - 1; j++) for (let i = 0; i < G - 1; i++) {
      const a = j * G + i, b = a + 1, cc = a + G, d = cc + 1;
      idx[o++] = a; idx[o++] = cc; idx[o++] = b;
      idx[o++] = b; idx[o++] = cc; idx[o++] = d;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeBoundingSphere();
    ch.mesh = new THREE.Mesh(g, terrainMat);
    this.group.add(ch.mesh);
    this.populateChunk(ch, x0, z0);
  }

  // Deterministic decorations and interactables for a chunk.
  populateChunk(ch, x0, z0) {
    const T = this.T;
    const realm = this.realm;
    ch.decor = [];
    ch.colliders = [];
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const blocked = (x, z, pad) => {
      for (const zn of T.zones) {
        const r = zn.kind === 'hub' ? 115 : zn.kind === 'warp' ? 6 : zn.r * 0.75;
        const dx = x - zn.x, dz = z - zn.z;
        if (dx * dx + dz * dz < (r + pad) * (r + pad)) return true;
      }
      return false;
    };
    const slopeNy = (x, z) => {
      const e = 2;
      const hx = T.height(x + e, z) - T.height(x - e, z), hz = T.height(x, z + e) - T.height(x, z - e);
      return (2 * e) / Math.hypot(hx, 2 * e, hz);
    };
    const wet = (h) => (this.waterLevel !== null && h < this.waterLevel + 0.8) || (this.lavaLevel !== null && h < this.lavaLevel + 2.5) || (this.cloudSea !== null && h < 8);
    this.decorTypes.forEach((d, ti) => {
      const r = T.chunkRng(ch.cx, ch.cz, ti + 1);
      const count = Math.floor(d.density * (0.4 + r() * 1.2));
      const mats = [], cols = [];
      let px = x0 + r() * CHUNK, pz = z0 + r() * CHUNK;
      for (let i = 0; i < count; i++) {
        if (d.cluster && i > 0 && r() < d.cluster) { px = clamp(px + (r() - 0.5) * 24, x0, x0 + CHUNK); pz = clamp(pz + (r() - 0.5) * 24, z0, z0 + CHUNK); }
        else { px = x0 + r() * CHUNK; pz = z0 + r() * CHUNK; }
        const h = T.height(px, pz);
        if (h < d.minH || h > d.maxH || wet(h)) continue;
        if (this.iceLevel !== null && h < this.iceLevel + 0.2 && d.id !== 'icespike') continue;
        if (d.minNy > 0 && slopeNy(px, pz) < d.minNy) continue;
        if (blocked(px, pz, d.collider ? 4 : 0)) continue;
        if (d.collider && T.roadDist(px, pz) < 5) continue;
        const sc = d.scale[0] + r() * (d.scale[1] - d.scale[0]);
        const yo = d.yOffset ? d.yOffset[0] + r() * (d.yOffset[1] - d.yOffset[0]) : -0.15 * sc;
        p.set(px, h + yo, pz);
        q.setFromAxisAngle(up, r() * Math.PI * 2);
        s.setScalar(sc);
        m.compose(p, q, s);
        mats.push(...m.elements);
        const tint = 0.85 + r() * 0.3;
        cols.push(tint, tint, tint);
        if (d.collider && !d.yOffset) ch.colliders.push([px, pz, d.collider * sc]);
      }
      ch.decor[ti] = { m: new Float32Array(mats), c: new Float32Array(cols) };
    });

    // Interactables
    ch.chests = [];
    ch.shards = [];
    ch.updrafts = [];
    const rr = T.chunkRng(ch.cx, ch.cz, 99);
    const nearHub = Math.hypot(x0 + 64 - realm.hub.x, z0 + 64 - realm.hub.z) < 220;
    const tryPoint = (tries, ok) => {
      for (let i = 0; i < tries; i++) {
        const x = x0 + 10 + rr() * (CHUNK - 20), z = z0 + 10 + rr() * (CHUNK - 20);
        const h = T.height(x, z);
        if (ok(x, z, h)) return [x, z, h];
      }
      return null;
    };
    const dry = (x, z, h) => !wet(h) && !blocked(x, z, 3) && (this.iceLevel === null || h > this.iceLevel);
    if (!nearHub && rr() < 0.09) {
      const pt = tryPoint(6, dry);
      const id = `c${ch.k}`;
      if (pt && !(this.save.chests[realm.id] || []).includes(id)) ch.chests.push(this.makeChest(id, pt[0], this.groundY(pt[0], pt[1]), pt[1]));
    }
    if (!nearHub && rr() < 0.05) {
      const pt = tryPoint(6, dry);
      const id = `s${ch.k}`;
      if (pt && !(this.save.shards[realm.id] || []).includes(id)) ch.shards.push(this.makeShard(id, pt[0], this.groundY(pt[0], pt[1]), pt[1]));
    }
    if (realm.id === 'heaven' && rr() < 0.14) {
      const pt = tryPoint(10, (x, z, h) => h > 12 && (T.height(x + 40, z) < -100 || T.height(x - 40, z) < -100 || T.height(x, z + 40) < -100 || T.height(x, z - 40) < -100));
      if (pt) ch.updrafts.push({ x: pt[0], z: pt[1], y: pt[2], r: 5, top: 140, obj: this.makeUpdraft(pt[0], pt[1]) });
    }
    for (const c of ch.chests) this.group.add(c.obj);
    for (const s2 of ch.shards) this.group.add(s2.obj);
    for (const u of ch.updrafts) this.group.add(u.obj);
    this.collectInteractables();
  }

  collectInteractables() {
    this.chests = [];
    this.shards = [];
    const staticUp = this.updrafts.filter((u) => u.static);
    this.updrafts = staticUp;
    for (const ch of this.chunks.values()) {
      if (!ch.mesh) continue;
      this.chests.push(...ch.chests);
      this.shards.push(...ch.shards);
      this.updrafts.push(...ch.updrafts);
    }
  }

  makeChest(id, x, y, z) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = (x * 13 + z * 7) % 6.28;
    const wood = toon('#8a5a2e'), gold = toon('#f0c040', { emissive: '#a07010', emissiveIntensity: 0.3 });
    g.add(mesh(PRIM.box, wood, { y: 0.4, sx: 1.3, sy: 0.8, sz: 0.85 }));
    g.add(mesh(PRIM.box, gold, { y: 0.4, sx: 1.34, sy: 0.12, sz: 0.89 }));
    const lid = new THREE.Group();
    lid.position.set(0, 0.8, -0.42);
    lid.add(mesh(PRIM.box, wood, { y: 0.15, z: 0.42, sx: 1.3, sy: 0.3, sz: 0.85 }));
    lid.add(mesh(PRIM.box, gold, { y: 0.15, z: 0.85, sx: 0.2, sy: 0.25, sz: 0.06 }));
    g.add(lid);
    g.add(mesh(PRIM.sphereLo, glow('#ffe58a', 0.25), { y: 0.6, s: 1.4 }));
    return { id, x, y, z, obj: g, lid, opened: false };
  }

  makeShard(id, x, y, z) {
    const g = new THREE.Group();
    g.position.set(x, y + 1.4, z);
    g.add(mesh(PRIM.octa, glow('#fff3a0', 0.95, false), { s: 0.45, sy: 0.7 }));
    g.add(mesh(PRIM.sphereLo, glow('#ffe060', 0.25), { s: 1.1 }));
    return { id, x, y, z, obj: g };
  }

  makeUpdraft(x, z) {
    const y = this.T.height(x, z);
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.add(mesh(UPDRAFT_GEO, updraftMat, { y: 70 }));
    g.add(mesh(PRIM.torus, glow('#fff1a0', 0.8), { y: 0.3, rx: Math.PI / 2, s: 5 }));
    return g;
  }

  disposeChunk(ch) {
    if (ch.mesh) { this.group.remove(ch.mesh); ch.mesh.geometry.dispose(); ch.mesh = null; }
    for (const c of ch.chests || []) this.group.remove(c.obj);
    for (const s of ch.shards || []) this.group.remove(s.obj);
    for (const u of ch.updrafts || []) this.group.remove(u.obj);
    ch.chests = ch.shards = ch.updrafts = [];
    ch.colliders = null;
    this.collectInteractables();
  }

  removeChest(chest) {
    for (const ch of this.chunks.values()) {
      const i = ch.chests ? ch.chests.indexOf(chest) : -1;
      if (i >= 0) { ch.chests.splice(i, 1); break; }
    }
    this.group.remove(chest.obj);
    this.collectInteractables();
  }

  removeShard(shard) {
    for (const ch of this.chunks.values()) {
      const i = ch.shards ? ch.shards.indexOf(shard) : -1;
      if (i >= 0) { ch.shards.splice(i, 1); break; }
    }
    this.group.remove(shard.obj);
    this.collectInteractables();
  }

  rebuildDecor() {
    const [fx, fz] = this.focusChunk;
    for (let ti = 0; ti < this.decorMeshes.length; ti++) {
      const dm = this.decorMeshes[ti];
      const im = dm.mesh;
      let n = 0;
      for (const ch of this.chunks.values()) {
        if (!ch.mesh || !ch.decor) continue;
        if (Math.max(Math.abs(ch.cx - fx), Math.abs(ch.cz - fz)) > dm.range) continue;
        const d = ch.decor[ti];
        const cnt = d.c.length / 3;
        const fit = Math.min(cnt, dm.cap - n);
        if (fit <= 0) break;
        im.instanceMatrix.array.set(d.m.subarray(0, fit * 16), n * 16);
        im.instanceColor.array.set(d.c.subarray(0, fit * 3), n * 3);
        n += fit;
      }
      im.count = n;
      im.instanceMatrix.needsUpdate = true;
      im.instanceColor.needsUpdate = true;
    }
  }

  updateParticles(dt, cam) {
    const P = this.particles;
    const a = P.pts.geometry.attributes.position.array;
    const t = this.time;
    for (let i = 0; i < P.n; i++) {
      const k = i * 3, sd = P.seeds[i];
      switch (P.type) {
        case 'snow': a[k + 1] -= dt * (2 + sd * 2); a[k] += Math.sin(t + sd * 10) * dt * 0.8; break;
        case 'embers': a[k + 1] += dt * (1.5 + sd * 2); a[k] += Math.sin(t * 2 + sd * 10) * dt * 0.6; break;
        case 'bubbles': a[k + 1] += dt * (1.2 + sd * 1.5); a[k] += Math.sin(t * 3 + sd * 10) * dt * 0.3; break;
        case 'pollen': case 'motes': a[k] += Math.sin(t * 0.5 + sd * 10) * dt * 0.6; a[k + 1] += Math.cos(t * 0.7 + sd * 7) * dt * 0.3; a[k + 2] += Math.cos(t * 0.4 + sd * 5) * dt * 0.6; break;
        default: a[k] += dt * 0.3 * (sd - 0.5); break;
      }
      // Wrap into a box around the camera (stored relative to the points object).
      if (a[k + 1] < -25) a[k + 1] += 50; else if (a[k + 1] > 25) a[k + 1] -= 50;
      if (a[k] < -40) a[k] += 80; else if (a[k] > 40) a[k] -= 80;
      if (a[k + 2] < -40) a[k + 2] += 80; else if (a[k + 2] > 40) a[k + 2] -= 80;
    }
    // Keep the box centred on the camera while letting particles stay still in world space.
    const o = P.pts.position;
    const dx = cam.x - o.x, dy = cam.y - o.y, dz = cam.z - o.z;
    if (dx || dy || dz) {
      for (let i = 0; i < P.n; i++) { const k = i * 3; a[k] -= dx; a[k + 1] -= dy; a[k + 2] -= dz; }
      o.set(cam.x, cam.y, cam.z);
    }
    P.pts.geometry.attributes.position.needsUpdate = true;
  }

  // ---------------------------------------------------------------- map image
  startMap() {
    const S = 512;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    this.mapCanvas = c;
    this.mapCtx = c.getContext('2d');
    this.mapImg = this.mapCtx.createImageData(S, S);
    this.mapProgress = 0;
    this.mapReady = false;
  }

  stepMap(rows = 24) {
    if (this.mapReady || !this.mapCanvas) return;
    const S = 512, step = (WORLD_HALF * 2) / S;
    const d = this.mapImg.data;
    const c = [0, 0, 0];
    const realm = this.realm;
    const end = Math.min(S, this.mapProgress + rows);
    for (let j = this.mapProgress; j < end; j++) {
      for (let i = 0; i < S; i++) {
        const x = -WORLD_HALF + (i + 0.5) * step, z = -WORLD_HALF + (j + 0.5) * step;
        const h = this.T.height(x, z);
        const hx = this.T.height(x + step, z) - h, hz = this.T.height(x, z + step) - h;
        const ny = step / Math.hypot(hx, step, hz);
        this.T.color(x, z, h, ny, c);
        let r = Math.pow(c[0], 1 / 2.2), g = Math.pow(c[1], 1 / 2.2), b = Math.pow(c[2], 1 / 2.2);
        const shadeV = clamp(0.85 + (-hx + -hz) * 0.03, 0.45, 1.25);
        r *= shadeV; g *= shadeV; b *= shadeV;
        if (realm.water && h < realm.water.level) { const k = clamp(-h / 8, 0, 1); r = 0.25 - k * 0.1; g = 0.55 - k * 0.15; b = 0.85 - k * 0.1; }
        if (realm.lava && h < realm.lava.level + 0.5) { r = 1; g = 0.42; b = 0.1; }
        if (realm.cloudSea !== undefined && h < realm.cloudSea) { r = 0.93; g = 0.93; b = 0.98; }
        if (realm.ice && h < realm.ice.level) { r = 0.75; g = 0.9; b = 1; }
        const o = (j * S + i) * 4;
        d[o] = clamp(r * 255, 0, 255); d[o + 1] = clamp(g * 255, 0, 255); d[o + 2] = clamp(b * 255, 0, 255); d[o + 3] = 255;
      }
    }
    this.mapCtx.putImageData(this.mapImg, 0, 0, 0, this.mapProgress, S, end - this.mapProgress);
    this.mapProgress = end;
    this.mapReady = end >= S;
  }

  finishMap() { while (!this.mapReady && this.mapCanvas) this.stepMap(64); }
}
