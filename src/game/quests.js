// Story chapters in the world: quest givers, objectives, quest enemies, bosses, items and rewards.

import * as THREE from 'three';
import { CHAPTERS, CHAPTER_BY_ID, TOWNSFOLK } from '../data/stories.js';
import { CHARACTERS } from '../data/characters.js';
import { ENEMIES } from '../data/enemies.js';
import { REALM_BY_ID } from '../data/realms.js';
import { refreshAvailability } from './save.js';
import { addExp, expToNext, recruitLevel } from './rules.js';
import { PRIM, glow, mesh } from '../world/geo.js';

const DEFEAT_RANGE = 170;
const BOSS_RANGE = 130;
const FAR = 280;

export class Quests {
  constructor(game) {
    this.game = game;
    this.items = [];
    this.group = new THREE.Group();
    game.scene.add(this.group);
  }

  get save() { return this.game.save; }
  state(id) { return this.save.story[id]; }

  realmChapters() { return CHAPTERS.filter((c) => c.realm === this.game.world.realm.id); }

  // Rebuilds quest NPCs and objects for the current realm.
  setup() {
    const g = this.game;
    g.npcs.clear();
    this.clearItems();
    for (const f of TOWNSFOLK[g.world.realm.id] || []) g.npcs.add({ ...f, kind: 'folk' });
    for (const ch of this.realmChapters()) {
      const st = this.state(ch.id);
      const npc = ch.steps[0].npc;
      if (st.status === 'available') g.npcs.add({ ...npc, kind: 'giver', chapterId: ch.id });
      else {
        // Givers stay in town once their chapter has started.
        if (st.status === 'done' || st.step > 0) g.npcs.add(this.folkGiver(ch, st.status === 'done'));
        if (st.status === 'active') this.setupStep(ch);
      }
    }
  }

  folkGiver(ch, done) {
    const npc = ch.steps[0].npc;
    const line = done ? [npc.name, 'あなた方のおかげで助かりました。旅のご無事を祈っています。'] : ch.steps[0].lines[ch.steps[0].lines.length - 1];
    return { ...npc, kind: 'folk', lines: [line] };
  }

  setupStep(ch) {
    const g = this.game;
    const st = this.state(ch.id);
    const step = ch.steps[st.step];
    if (!step) return;
    if (step.type === 'talk') g.npcs.add({ ...step.npc, kind: 'step', chapterId: ch.id });
    if (step.type === 'collect') {
      step.points.forEach(([x, z], i) => {
        if ((st.got || []).includes(i)) return;
        const y = g.world.realm.mode === 'underwater' ? g.world.groundY(x, z) + 1.5 : g.world.groundY(x, z);
        const obj = new THREE.Group();
        obj.position.set(x, y + 1.2, z);
        obj.add(mesh(PRIM.octa, glow('#7affea', 0.95, false), { s: 0.5, sy: 0.8 }));
        obj.add(mesh(PRIM.sphereLo, glow('#7affea', 0.25), { s: 1.2 }));
        obj.add(mesh(PRIM.cyl, glow('#7affea', 0.15), { y: 30, sx: 0.35, sz: 0.35, sy: 60 }));
        this.group.add(obj);
        this.items.push({ ch: ch.id, idx: i, x, y, z, obj });
      });
    }
  }

  clearItems() {
    for (const it of this.items) this.group.remove(it.obj);
    this.items = [];
  }

  teardownStep(ch) {
    const g = this.game;
    const st = this.state(ch.id);
    const step = ch.steps[st.step];
    if (!step) return;
    if (step.type === 'talk') g.npcs.remove(step.npc.id);
    for (let i = this.items.length - 1; i >= 0; i--) if (this.items[i].ch === ch.id) { this.group.remove(this.items[i].obj); this.items.splice(i, 1); }
  }

  questKey(ch) { return `${ch.id}:${this.state(ch.id).step}`; }

  // ------------------------------------------------------------------ per tick
  tick(dt) {
    const g = this.game;
    if (g.state !== 'play') return;
    const p = g.player.pos;
    for (const ch of this.realmChapters()) {
      const st = this.state(ch.id);
      if (st.status !== 'active') continue;
      const step = ch.steps[st.step];
      if (!step) continue;
      const key = this.questKey(ch);
      const d = step.x !== undefined ? Math.hypot(p.x - step.x, p.z - step.z) : Infinity;
      if (step.type === 'goto' && d < step.radius) {
        this.advance(ch, step.lines);
        return;
      }
      if (step.type === 'defeat') {
        const mine = g.enemies.list.filter((e) => e.quest === key && !e.dead);
        if (d < DEFEAT_RANGE) {
          const remaining = step.count - (st.kills || 0);
          const want = Math.min(4, remaining) - mine.length;
          for (let i = 0; i < want; i++) {
            const a = Math.random() * Math.PI * 2, r = 6 + Math.random() * 10;
            const e = g.enemies.spawn(step.enemy, ch.level, step.x + Math.cos(a) * r, step.z + Math.sin(a) * r, { quest: key });
            e.home.set(step.x, e.pos.y, step.z);
            e.leash = 90;
          }
        } else if (d > FAR) for (const e of mine) g.enemies.remove(e);
      }
      if (step.type === 'boss') {
        const boss = g.enemies.list.find((e) => e.quest === key && !e.dead);
        if (!boss && d < BOSS_RANGE && !st.bossDown) {
          const e = g.enemies.spawn(step.boss, step.level || ch.level + 3, step.x, step.z, { quest: key });
          e.state = 'idle';
          g.ui.banner(ENEMIES[step.boss].name, `Lv.${e.lv}  ボス戦`, '#ff6a6a');
          g.audio.play('boom');
          if (step.lines) g.ui.dialogue(step.lines);
        } else if (boss && d > FAR) g.enemies.remove(boss);
      }
    }
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      if (!it) continue; // a pickup can finish the step and shrink the list
      it.obj.rotation.y += dt * 2;
      it.obj.position.y = it.y + 1.2 + Math.sin(g.time * 3 + it.idx) * 0.2;
      if (Math.hypot(p.x - it.x, p.z - it.z) < 3 && Math.abs(p.y - it.y) < 5) this.pickItem(it);
    }
  }

  pickItem(it) {
    const g = this.game;
    const ch = CHAPTER_BY_ID[it.ch];
    const st = this.state(ch.id);
    const step = ch.steps[st.step];
    st.got = [...(st.got || []), it.idx];
    this.group.remove(it.obj);
    this.items.splice(this.items.indexOf(it), 1);
    g.audio.play('pickup');
    g.effects.sparks(new THREE.Vector3(it.x, it.y + 1.5, it.z), '#7affea', 14, 6, 0.6);
    g.ui.toast(`${step.item} を手に入れた (${st.got.length}/${step.points.length})`, '#7affea');
    if (st.got.length >= step.points.length) this.advance(ch, step.lines);
    else g.saveSoon();
  }

  onEnemyKilled(e) {
    if (!e.quest) return;
    const [id, stepIdx] = e.quest.split(':');
    const ch = CHAPTER_BY_ID[id];
    const st = this.state(id);
    if (!ch || st.status !== 'active' || String(st.step) !== stepIdx) return;
    const step = ch.steps[st.step];
    if (step.type === 'defeat') {
      st.kills = (st.kills || 0) + 1;
      this.game.ui.toast(`${step.label} (${Math.min(st.kills, step.count)}/${step.count})`, '#ffd36a', true);
      if (st.kills >= step.count) {
        for (const o of this.game.enemies.list) if (o.quest === e.quest && !o.dead) this.game.enemies.remove(o);
        this.advance(ch);
      }
    } else if (step.type === 'boss') {
      st.bossDown = true;
      for (const o of this.game.enemies.list) if (o.minion && !o.dead) this.game.enemies.kill(o);
      this.game.ui.banner('ボス撃破！', ENEMIES[step.boss].name, '#ffd36a');
      this.game.schedule(1.5, () => this.advance(ch));
    }
  }

  // Called when the player presses interact next to an NPC.
  talkTo(npc) {
    const g = this.game;
    if (npc.kind === 'giver') {
      const ch = CHAPTER_BY_ID[npc.chapterId];
      const st = this.state(ch.id);
      st.status = 'active';
      st.step = 0;
      this.save.tracked = ch.id;
      g.ui.banner(ch.title, ch.summary, '#ffd36a');
      g.ui.dialogue(ch.steps[0].lines, () => {
        g.npcs.remove(npc.id);
        this.advance(ch);
        g.npcs.add(this.folkGiver(ch, false));
      });
      return;
    }
    if (npc.kind === 'step') {
      const ch = CHAPTER_BY_ID[npc.chapterId];
      const step = ch.steps[this.state(ch.id).step];
      g.ui.dialogue(step.lines, () => this.advance(ch));
      return;
    }
    g.ui.dialogue(npc.lines || [[npc.name, '……。']]);
  }

  advance(ch, lines) {
    const g = this.game;
    const go = () => {
      const st = this.state(ch.id);
      this.teardownStep(ch);
      st.step++;
      st.kills = 0;
      st.got = [];
      st.bossDown = false;
      if (st.step >= ch.steps.length) { this.completeChapter(ch); return; }
      this.setupStep(ch);
      g.audio.play('quest');
      g.ui.toast(`目標更新: ${ch.steps[st.step].label}`, '#ffd36a');
      g.saveNow();
    };
    if (lines && lines.length) g.ui.dialogue(lines, go);
    else go();
  }

  completeChapter(ch) {
    const g = this.game;
    const save = this.save;
    const st = this.state(ch.id);
    st.status = 'done';
    const realmsBefore = new Set(save.realms);
    const party = g.player.members.map((m) => m.entry.lv);
    const isNew = !save.roster[ch.reward];
    if (isNew) save.roster[ch.reward] = { lv: recruitLevel(ch.level, party), exp: 0 };
    for (const entry of Object.values(save.roster)) addExp(entry, expToNext(Math.min(ch.level, 89)) * 2);
    refreshAvailability(save);
    const newRealms = save.realms.filter((r) => !realmsBefore.has(r));
    const next = CHAPTERS.find((c) => save.story[c.id].status === 'available' && c.realm === ch.realm)
      || CHAPTERS.find((c) => save.story[c.id].status === 'available' || save.story[c.id].status === 'active');
    save.tracked = next ? next.id : null;
    g.saveNow();
    g.audio.play('reward');
    g.ui.reward(ch, ch.reward, isNew, () => {
      for (const r of newRealms) g.ui.banner(`新たな世界「${REALM_BY_ID[r].name}」が解放された！`, '村の「次元の門」かマップから渡れます', '#9fd8ff');
      if (ch.final) {
        save.cleared = true;
        g.saveNow();
        g.ui.dialogue([['', ch.epilogue], ['', 'THE END ── クリアおめでとう！ 6つの世界の探索は、これからも自由に続けられます。']]);
      }
      this.setup();
      g.player.setParty(save.party);
    });
  }

  // ------------------------------------------------------------------ HUD helpers
  trackedChapter() {
    const id = this.save.tracked;
    if (!id) return null;
    const ch = CHAPTER_BY_ID[id];
    const st = this.state(id);
    if (!ch || st.status === 'done' || st.status === 'locked') return null;
    return ch;
  }

  objective() {
    const ch = this.trackedChapter();
    if (!ch) return null;
    const st = this.state(ch.id);
    const realm = REALM_BY_ID[ch.realm];
    if (st.status === 'available') {
      return { title: ch.title, text: `${ch.steps[0].label}（${realm.hub.name}）`, realm: ch.realm };
    }
    const step = ch.steps[st.step];
    let text = step.label;
    if (step.type === 'defeat') text += ` (${st.kills || 0}/${step.count})`;
    if (step.type === 'collect') text += ` (${(st.got || []).length}/${step.points.length})`;
    return { title: ch.title, text, realm: ch.realm };
  }

  // World position the tracked objective points at, if it is in the current realm.
  marker() {
    const ch = this.trackedChapter();
    if (!ch || ch.realm !== this.game.world.realm.id) return null;
    const st = this.state(ch.id);
    if (st.status === 'available') { const n = ch.steps[0].npc; return { x: n.x, z: n.z }; }
    const step = ch.steps[st.step];
    if (step.type === 'talk') return { x: step.npc.x, z: step.npc.z };
    if (step.type === 'collect') {
      const p = this.game.player.pos;
      let best = null, bd = Infinity;
      step.points.forEach(([x, z], i) => {
        if ((st.got || []).includes(i)) return;
        const d = Math.hypot(p.x - x, p.z - z);
        if (d < bd) { bd = d; best = { x, z }; }
      });
      return best;
    }
    return { x: step.x, z: step.z };
  }

  recruitName(ch) { return CHARACTERS[ch.reward].name; }
}
