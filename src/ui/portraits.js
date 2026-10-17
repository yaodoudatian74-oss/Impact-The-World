// Renders small head-and-shoulders portraits of characters with the game's own renderer.

import * as THREE from 'three';
import { CHARACTERS, WEAPONS } from '../data/characters.js';
import { buildCharacterModel, animateHumanoid } from '../world/models.js';

const cache = new Map();
let rig = null;

function setup() {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff', '#8a7a9a', 2.2));
  const key = new THREE.DirectionalLight('#fff4e0', 2.2);
  key.position.set(1.5, 2.5, 3);
  scene.add(key);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  const size = 160;
  const rt = new THREE.WebGLRenderTarget(size, size);
  rt.texture.colorSpace = THREE.SRGBColorSpace;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  rig = { scene, cam, rt, size, canvas, ctx: canvas.getContext('2d'), buf: new Uint8Array(size * size * 4) };
}

export function portrait(renderer, id) {
  if (cache.has(id)) return cache.get(id);
  try {
    if (!rig) setup();
    const def = CHARACTERS[id];
    const model = buildCharacterModel(def, WEAPONS[def.weaponId]);
    animateHumanoid(model, { t: 0.5, speed: 0 });
    model.root.rotation.y = 0.35;
    rig.scene.add(model.root);
    const h = (def.look.height || 1);
    rig.cam.position.set(0.35, 1.52 * h, 2.0);
    rig.cam.lookAt(0, 1.42 * h, 0);
    const prevTarget = renderer.getRenderTarget();
    const prevClear = renderer.getClearAlpha();
    renderer.setRenderTarget(rig.rt);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(rig.scene, rig.cam);
    renderer.readRenderTargetPixels(rig.rt, 0, 0, rig.size, rig.size, rig.buf);
    renderer.setRenderTarget(prevTarget);
    renderer.setClearAlpha(prevClear);
    rig.scene.remove(model.root);
    const img = rig.ctx.createImageData(rig.size, rig.size);
    const row = rig.size * 4;
    for (let y = 0; y < rig.size; y++) img.data.set(rig.buf.subarray((rig.size - 1 - y) * row, (rig.size - y) * row), y * row);
    rig.ctx.putImageData(img, 0, 0);
    const url = rig.canvas.toDataURL('image/png');
    cache.set(id, url);
    return url;
  } catch {
    cache.set(id, '');
    return '';
  }
}
