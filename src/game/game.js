// Game orchestration: owns the scene, the fixed-timestep loop, realm travel, interactions and saving.

import * as THREE from 'three';
import { REALM_BY_ID } from '../data/realms.js';
import { CHARACTERS } from '../data/characters.js';
import { World, QUALITY } from '../world/world.js';
import { Player } from './player.js';
import { Enemies } from './enemies.js';
import { Effects } from './effects.js';
import { Combat } from './combat.js';
import { NPCs } from './npcs.js';
import { Quests } from './quests.js';
import { CameraRig } from './camera.js';
import { writeTo, clearFrom, decodeExplored, encodeExplored, EXPLORE_GRID } from './save.js';
import { addExp, expToNext } from './rules.js';
import { enemyLevelAt, WORLD_HALF } from '../data/realms.js';

const STEP = 1 / 60;

export class Game {
  constructor({ renderer, input, audio, ui, storage }) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;
    this.ui = ui;
    this.storage = storage;
    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(60, 1, 0.3, 6000);
    this.camera = new CameraRig(this.cam);
    this.time = 0;
    this.state = 'title';
    this.timers = [];
    this.qualityName = 'high';
    this.world = new World(this.scene, QUALITY.high);
    this.effects = new Effects(this.scene);
    this.enemies = new Enemies(this);
    this.npcs = new NPCs(this);
    this.player = new Player(this);
    this.combat = new Combat(this);
    this.quests = new Quests(this);
    this.acc = 0;
    this.lastFrame = 0;
    this.autosaveT = 0;
    this.exploreT = 0;
    this.warpHealT = 0;
    this.frameTimes = [];
    this.autoQualityDone = false;
    this.world.onChunksChanged = () => {};
    ui.attach(this);
  }

  // ---------------------------------------------------------------- lifecycle
  start(save) {
    this.save = save;
    this.audio.sfxOn = save.settings.sfx;
    this.audio.bgmOn = save.settings.bgm;
    this.input.sens = save.settings.sens;
    const q = save.settings.quality === 'auto' ? (this.input.isTouch ? 'medium' : 'high') : save.settings.quality;
    this.setQualityName(q);
    this.player.stamina = save.staminaMax;
    this.player.setParty(save.party);
    const [x, y, z] = save.pos;
    this.enterRealm(save.realm, x, z, y);
    this.state = 'play';
    this.ui.showHud(true);
    this.lastFrame = performance.now();
  }

  setQualityName(name) {
    this.qualityName = name;
    this.world.q = QUALITY[name];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, QUALITY[name].pixelRatio));
  }

  // Loads a realm and places the party. y = null puts them on the ground.
  enterRealm(realmId, x, z, y = null) {
    const realm = REALM_BY_ID[realmId];
    this.enemies.clear();
    this.effects.clear();
    this.timers = [];
    this.world.load(realmId, this.save);
    this.save.realm = realmId;
    this.explored = decodeExplored(this.save.explored[realmId]);
    this.player.setMounted(false);
    this.player.teleport(x, z, y);
    if (realm.mode === 'underwater' && y === null) this.player.pos.y = this.world.groundY(x, z) + 4;
    this.player.prevPos.copy(this.player.pos);
    this.player.mode = realm.mode === 'underwater' ? 'dive' : 'walk';
    this.world.primeAround(x, z);
    this.quests.setup();
    this.player.yaw = this.camera.yaw;
    this.camera.snap(this.player.pos);
    this.camera.update(0, this.player.pos, this.input, this.world);
    this.audio.startMusic(realm.bgm);
    this.ui.onRealmChanged(realm);
    this.ui.banner(realm.name, `推奨レベル ${realm.levels[0]}〜${realm.levels[1]}`, realm.color);
    this.markExplored(true);
  }

  // Arrival point in a realm: just in front of the town's warp point.
  realmSpawn(realmId) {
    const w = REALM_BY_ID[realmId].warps[0];
    return [w[0], w[1] + 6];
  }

  travelToRealm(realmId) {
    const [x, z] = this.realmSpawn(realmId);
    this.ui.fade(() => {
      this.enterRealm(realmId, x, z);
      this.player.reviveAll();
      this.saveNow();
    });
    this.audio.play('warp');
  }

  warpTo(w) {
    this.ui.fade(() => {
      this.player.setMounted(false);
      this.player.teleport(w.x, w.z + 5, this.world.realm.mode === 'underwater' ? w.y + 3 : null);
      this.world.primeAround(w.x, w.z);
      this.enemies.clear();
      this.camera.snap(this.player.pos);
      this.player.reviveAll();
      this.saveNow();
    });
    this.audio.play('warp');
  }

  schedule(delay, fn) { this.timers.push({ at: this.time + delay, fn }); }

  // ---------------------------------------------------------------- loop
  frame(now) {
    let dt = (now - this.lastFrame) / 1000;
    this.lastFrame = now;
    if (dt > 0.25) dt = 0.25;
    if (this.state === 'play') {
      this.acc += dt;
      while (this.acc >= STEP) {
        this.tick(STEP);
        this.acc -= STEP;
      }
      this.trackFrameTime(dt);
    }
    if (this.save) this.render(this.state === 'play' ? this.acc / STEP : 1, dt);
  }

  tick(dt) {
    this.time += dt;
    for (let i = this.timers.length - 1; i >= 0; i--) {
      if (this.timers[i].at <= this.time) { const t = this.timers[i]; this.timers.splice(i, 1); t.fn(); }
    }
    this.player.tick(dt);
    this.enemies.tick(dt);
    this.effects.tick(dt, (p) => this.projectileTargets(p), (x, z) => this.world.groundY(x, z));
    this.npcs.tick(dt);
    this.quests.tick(dt);
    this.checkPickups(dt);
    this.save.playTime += dt;
    this.autosaveT += dt;
    if (this.autosaveT > 20 && !this.player.dead) this.saveNow();
    this.exploreT += dt;
    if (this.exploreT > 0.5) { this.exploreT = 0; this.markExplored(false); }
    this.input.clearQueued();
  }

  projectileTargets(p) {
    if (p.team === 'player') return this.enemies.list.filter((e) => !e.dead);
    const pl = this.player;
    return pl.dead ? [] : [{ pos: pl.pos, radius: 0.5, height: 1 }];
  }

  render(alpha, dt) {
    const p = this.player;
    this.player.render(alpha);
    this.enemies.render(alpha);
    const focus = p.root.position;
    if (this.state === 'play') this.camera.update(dt, focus, this.input, this.world);
    else { this.input.takeLook(); this.input.takeZoom(); }
    this.world.update(dt, focus, this.cam);
    this.renderer.render(this.scene, this.cam);
    this.ui.frame(dt);
  }

  // Measures early frame times once and lowers quality on slow devices.
  trackFrameTime(dt) {
    if (this.autoQualityDone || this.save.settings.quality !== 'auto') return;
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 180) return;
    this.autoQualityDone = true;
    const sorted = [...this.frameTimes].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const order = ['high', 'medium', 'low'];
    let idx = order.indexOf(this.qualityName);
    if (median > 1 / 24) idx = 2;
    else if (median > 1 / 40) idx = Math.min(2, idx + 1);
    if (order[idx] !== this.qualityName) {
      this.applyQuality(order[idx]);
      this.ui.toast(`画質を自動調整しました（${{ high: '高', medium: '中', low: '低' }[order[idx]]}）`, '#c8c8d8');
    }
  }

  applyQuality(name) {
    this.setQualityName(name);
    const p = this.player.pos;
    this.enterRealm(this.world.realm.id, p.x, p.z, p.y);
  }

  // ---------------------------------------------------------------- interaction
  interactable() {
    const p = this.player.pos;
    const npc = this.npcs.nearest(p, 4.2);
    if (npc) return { kind: 'npc', label: `${npc.name}と話す`, target: npc };
    for (const c of this.world.chests) if (!c.opened && Math.hypot(c.x - p.x, c.z - p.z) < 3 && Math.abs(c.y - p.y) < 3) return { kind: 'chest', label: '宝箱を開ける', target: c };
    const gate = this.world.gate;
    if (gate && Math.hypot(gate.x - p.x, gate.z - p.z) < 8) return { kind: 'gate', label: '次元の門で別の世界へ', target: gate };
    for (const w of this.world.warps) if (Math.hypot(w.x - p.x, w.z - p.z) < 5) return { kind: 'warp', label: 'ワープポイント（地図を開く）', target: w };
    return null;
  }

  interact() {
    const it = this.interactable();
    if (!it) return;
    if (it.kind === 'npc') { this.quests.talkTo(it.target); }
    else if (it.kind === 'chest') this.openChest(it.target);
    else if (it.kind === 'gate') this.ui.openMenu('travel');
    else if (it.kind === 'warp') this.ui.openMenu('map');
  }

  openChest(c) {
    c.opened = true;
    const realm = this.world.realm;
    const lv = enemyLevelAt(realm, c.x, c.z);
    const exp = Math.round(expToNext(lv) * 0.6);
    for (const [id, entry] of Object.entries(this.save.roster)) {
      const up = addExp(entry, exp);
      if (up > 0) this.onLevelUp(id, entry.lv);
    }
    const pots = Math.random() < 0.45 ? 1 + (Math.random() < 0.3 ? 1 : 0) : 0;
    this.save.potions += pots;
    (this.save.chests[realm.id] ||= []).push(c.id);
    this.audio.play('chest');
    this.effects.sparks(new THREE.Vector3(c.x, c.y + 1, c.z), '#ffe58a', 20, 8, 0.9);
    this.ui.toast(`宝箱：経験値 +${exp}${pots ? `　回復薬 ×${pots}` : ''}`, '#ffe58a');
    let t = 0;
    this.effects.add(new THREE.Group(), 0.5, (e, k, dt) => { t += dt; c.lid.rotation.x = -Math.min(1.9, t * 5); });
    this.schedule(2.5, () => this.world.removeChest(c));
    this.saveSoon();
  }

  checkPickups(dt) {
    const p = this.player.pos;
    for (const s of [...this.world.shards]) {
      if (Math.hypot(s.x - p.x, s.z - p.z) < 2.4 && Math.abs(s.y + 1.4 - p.y) < 3) {
        (this.save.shards[this.world.realm.id] ||= []).push(s.id);
        this.save.staminaMax = Math.min(240, this.save.staminaMax + 2);
        this.audio.play('pickup');
        this.effects.sparks(new THREE.Vector3(s.x, s.y + 1.4, s.z), '#fff3a0', 16, 6, 0.7);
        this.ui.toast(`星のかけらを集めた！ スタミナ上限 ${this.save.staminaMax}`, '#fff3a0');
        this.world.removeShard(s);
        this.saveSoon();
      }
    }
    this.warpHealT = Math.max(0, this.warpHealT - dt);
    for (const w of this.world.warps) {
      const d = Math.hypot(w.x - p.x, w.z - p.z);
      if (d < 8 && !w.unlocked) {
        this.world.setWarpUnlocked(w);
        const list = (this.save.warps[this.world.realm.id] ||= []);
        if (!list.includes(w.id)) list.push(w.id);
        this.audio.play('warp');
        this.ui.banner('ワープポイント解放', w.name, '#6ad8ff');
        this.saveSoon();
      }
      if (d < 5 && this.warpHealT <= 0) {
        const hurt = this.player.members.some((m) => m.hp < this.player.statsOf(m).maxHp);
        this.warpHealT = 10;
        if (hurt) {
          this.player.reviveAll();
          this.ui.toast('ワープポイントの力で全員回復した', '#7dff9a');
          this.audio.play('heal');
        }
      }
    }
  }

  usePotion() {
    const m = this.player.active;
    if (this.save.potions <= 0) { this.ui.toast('回復薬がない', '#c8c8d8', true); return; }
    const max = this.player.statsOf(m).maxHp;
    if (m.hp >= max) { this.ui.toast('HPは満タンです', '#c8c8d8', true); return; }
    this.save.potions--;
    m.hp = Math.min(max, m.hp + Math.round(max * 0.45));
    this.audio.play('heal');
    this.effects.sparks(this.player.pos.clone().setY(this.player.pos.y + 1), '#7dff9a', 12, 4, 0.7);
    this.ui.toast(`回復薬を使った（残り ${this.save.potions}）`, '#7dff9a', true);
  }

  // Party members announce their level-ups; benched characters level quietly.
  onLevelUp(id, lv) {
    const m = this.player.members.find((x) => x.id === id);
    if (!m) return;
    if (m.hp > 0) m.hp = this.player.statsOf(m).maxHp;
    this.ui.toast(`${CHARACTERS[id].name} が Lv.${lv} に上がった！`, '#ffd36a');
    this.audio.play('levelup');
  }

  partyWiped() {
    this.state = 'dead';
    this.ui.showDeath(() => {
      const realm = this.world.realm;
      const p = this.player.pos;
      let best = null, bd = Infinity;
      for (const w of this.world.warps) {
        if (!w.unlocked) continue;
        const d = Math.hypot(w.x - p.x, w.z - p.z);
        if (d < bd) { bd = d; best = w; }
      }
      const w = best || { x: realm.warps[0][0], z: realm.warps[0][1], y: 0 };
      this.player.dead = false;
      this.player.reviveAll();
      this.player.teleport(w.x, w.z + 5, realm.mode === 'underwater' ? this.world.groundY(w.x, w.z) + 4 : null);
      this.world.primeAround(w.x, w.z);
      this.enemies.clear();
      this.effects.clear();
      this.timers = [];
      this.camera.snap(this.player.pos);
      this.state = 'play';
    });
  }

  // ---------------------------------------------------------------- party
  setParty(ids) {
    this.save.party = ids;
    this.player.setParty(ids);
    this.saveSoon();
  }

  // ---------------------------------------------------------------- map
  markExplored(force) {
    const p = this.player.pos;
    const cell = (WORLD_HALF * 2) / EXPLORE_GRID;
    const cx = Math.floor((p.x + WORLD_HALF) / cell), cz = Math.floor((p.z + WORLD_HALF) / cell);
    let changed = false;
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      if (dx * dx + dz * dz > 5) continue;
      const x = cx + dx, z = cz + dz;
      if (x < 0 || z < 0 || x >= EXPLORE_GRID || z >= EXPLORE_GRID) continue;
      const i = z * EXPLORE_GRID + x;
      if (!(this.explored[i >> 3] & (1 << (i & 7)))) { this.explored[i >> 3] |= 1 << (i & 7); changed = true; }
    }
    if (changed || force) this.save.explored[this.world.realm.id] = encodeExplored(this.explored);
  }

  isExplored(i) { return !!(this.explored[i >> 3] & (1 << (i & 7))); }

  // ---------------------------------------------------------------- saving
  saveNow() {
    this.autosaveT = 0;
    const p = this.player.pos;
    this.save.pos = [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10, Math.round(p.z * 10) / 10];
    return writeTo(this.storage, this.save);
  }

  saveSoon() { this.autosaveT = Math.max(this.autosaveT, 17); }

  resetSave() {
    clearFrom(this.storage);
    this.save = null;
    location.reload();
  }

  // Boss info for the HUD.
  activeBoss() {
    return this.enemies.list.find((e) => e.boss && !e.dead && e.state !== 'idle' && Math.hypot(e.pos.x - this.player.pos.x, e.pos.z - this.player.pos.z) < 120) || null;
  }
}
