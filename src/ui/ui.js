// DOM user interface: title, HUD, minimap, menus (map, party, story, settings, travel),
// dialogue, rewards and touch controls.

import * as THREE from 'three';
import { CHARACTERS, WEAPONS, CHARACTER_IDS } from '../data/characters.js';
import { ELEMENTS, WEAPON_TYPES } from '../data/elements.js';
import { REALMS, REALM_BY_ID, WORLD_HALF } from '../data/realms.js';
import { CHAPTERS } from '../data/stories.js';
import { characterStats, expToNext, MAX_LEVEL } from '../game/rules.js';
import { EXPLORE_GRID } from '../game/save.js';
import { portrait } from './portraits.js';
import { formatTime, clamp } from '../core/math.js';

const $ = (sel, root = document) => root.querySelector(sel);
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}
const ecol = (e) => (e ? ELEMENTS[e].color : '#ffffff');
const _v = new THREE.Vector3();

// Tap and click both go through pointerup so one gesture fires exactly once.
function tap(el, fn) {
  el.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); fn(e); });
  return el;
}

export class UI {
  constructor(root, renderer) {
    this.root = root;
    this.renderer = renderer;
    this.game = null;
    this.dialogueQueue = [];
    this.dialogueOpen = false;
    this.menuName = null;
    this.toastEls = [];
    this.selectedChar = null;
    this.mapRealm = null;
    this.hudCache = {};
    this.mmTimer = 0;
  }

  attach(game) {
    this.game = game;
    this.build();
    game.input.uiHandler = (a) => this.handleAction(a);
  }

  // ------------------------------------------------------------------ DOM construction
  build() {
    const r = this.root;
    const touch = this.game.input.isTouch;
    this.hud = h('div', { id: 'hud', class: touch ? 'is-touch' : '' });
    this.hud.hidden = true;
    r.append(this.hud);

    // Top-left: minimap and quest tracker
    this.mm = h('canvas', { id: 'minimap', width: 180, height: 180 });
    this.realmLabel = h('div', { class: 'realm-label' });
    this.questEl = h('button', { class: 'quest', type: 'button' }, h('div', { class: 'q-title' }), h('div', { class: 'q-text' }), h('div', { class: 'q-dist' }));
    tap(this.questEl, () => this.openMenu('story'));
    this.hud.append(h('div', { class: 'tl' }, h('div', { class: 'mm-wrap' }, this.mm, h('span', { class: 'mm-n' }, 'N')), this.realmLabel, this.questEl));

    // Top-right: menu buttons
    const mb = (act, label, key) => tap(h('button', { class: 'mbtn', type: 'button', 'aria-label': label }, h('span', {}, label), touch ? null : h('kbd', {}, key)), () => this.openMenu(act));
    this.hud.append(h('div', { class: 'tr' }, mb('map', '地図', 'M'), mb('party', '編成', 'C'), mb('story', '物語', 'J'), mb('pause', 'メニュー', 'Esc')));

    // Right: party
    this.partyEl = h('div', { class: 'party' });
    this.hud.append(this.partyEl);

    // Bottom: active character
    this.staminaEl = h('div', { class: 'stamina' }, h('i'));
    this.activeEl = h('div', { class: 'active' },
      h('div', { class: 'a-name' }, h('span', { class: 'lv' }), h('span', { class: 'nm' }), h('span', { class: 'el' })),
      h('div', { class: 'hpbar' }, h('i', { class: 'hp' }), h('i', { class: 'sh' })),
      h('div', { class: 'hpnum' }));
    this.hud.append(h('div', { class: 'bottom' }, this.staminaEl, this.activeEl));

    // Skills
    this.skillBtn = h('button', { class: 'skill', type: 'button', 'aria-label': '元素スキル' }, h('span', { class: 'ic' }), h('span', { class: 'cd' }), touch ? null : h('kbd', {}, 'E'));
    this.burstBtn = h('button', { class: 'burst', type: 'button', 'aria-label': '元素爆発' },
      h('svg', { viewBox: '0 0 100 100', class: 'ring', html: '<circle cx="50" cy="50" r="45" class="bg"/><circle cx="50" cy="50" r="45" class="fg" pathLength="100"/>' }),
      h('span', { class: 'ic' }), touch ? null : h('kbd', {}, 'Q'));
    this.potionEl = h('button', { class: 'potion', type: 'button', 'aria-label': '回復薬を使う' }, h('span', { class: 'n' }), touch ? null : h('kbd', {}, 'H'));
    tap(this.potionEl, () => this.game.input.press('potion'));
    if (!touch) {
      tap(this.skillBtn, () => this.game.input.press('skill'));
      tap(this.burstBtn, () => this.game.input.press('burst'));
    }
    this.hud.append(h('div', { class: 'skills' }, this.potionEl, this.skillBtn, this.burstBtn));

    this.bossEl = h('div', { class: 'boss' }, h('div', { class: 'nm' }), h('div', { class: 'bar' }, h('i')), h('div', { class: 'aura' }));
    this.promptEl = h('button', { class: 'prompt', type: 'button' }, touch ? null : h('kbd', {}, 'F'), h('span'));
    tap(this.promptEl, () => this.game.input.press('interact'));
    this.toastWrap = h('div', { class: 'toasts' });
    this.bannerEl = h('div', { class: 'banner' }, h('div', { class: 'b-title' }), h('div', { class: 'b-sub' }));
    this.markerEl = h('div', { class: 'marker' }, h('i'), h('span'));
    this.floaters = h('div', { class: 'floaters' });
    this.hurtEl = h('div', { class: 'hurt' });
    this.flashEl = h('div', { class: 'flash' }, h('div', { class: 'f-name' }), h('div', { class: 'f-skill' }));
    this.helpEl = touch ? null : h('div', { class: 'keyhelp' }, 'WASD 移動 ・ クリック 攻撃 ・ E スキル ・ Q 爆発 ・ Space ジャンプ/滑空 ・ Shift ダッシュ ・ R 騎乗 ・ 1-4 交代');
    this.hud.append(this.bossEl, this.promptEl, this.toastWrap, this.bannerEl, this.markerEl, this.floaters, this.hurtEl, this.flashEl);
    if (this.helpEl) this.hud.append(this.helpEl);

    // Pools for enemy bars and damage numbers
    this.barPool = Array.from({ length: 24 }, () => {
      const el = h('div', { class: 'ebar' }, h('span', { class: 'lv' }), h('div', { class: 'b' }, h('i')), h('i', { class: 'au' }));
      el.hidden = true;
      this.floaters.append(el);
      return el;
    });
    this.numPool = Array.from({ length: 48 }, () => { const el = h('div', { class: 'dmg' }); el.hidden = true; this.floaters.append(el); return el; });
    this.numIdx = 0;

    if (touch) this.buildTouch();

    this.menuEl = h('div', { class: 'overlay menu', role: 'dialog' });
    this.menuEl.hidden = true;
    this.dialogEl = h('div', { class: 'dialogue' }, h('div', { class: 'dl-name' }), h('div', { class: 'dl-text' }), h('div', { class: 'dl-next' }, '▼'));
    this.dialogEl.hidden = true;
    tap(this.dialogEl, () => this.advanceDialogue());
    this.rewardEl = h('div', { class: 'overlay reward' });
    this.rewardEl.hidden = true;
    this.deathEl = h('div', { class: 'overlay death' });
    this.deathEl.hidden = true;
    this.fadeEl = h('div', { class: 'fade' }, h('div', { class: 'spin' }), h('div', { class: 'ld' }, '読み込み中…'));
    r.append(this.menuEl, this.dialogEl, this.rewardEl, this.deathEl, this.fadeEl);
  }

  buildTouch() {
    const input = this.game.input;
    const layer = h('div', { class: 'touch' });
    const stick = h('div', { class: 'stick' }, h('div', { class: 'knob' }));
    stick.hidden = true;
    const look = h('div', { class: 'look-zone' });
    layer.append(look, stick);
    let moveId = null, ox = 0, oy = 0;
    const lookIds = new Map();
    look.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      look.setPointerCapture(e.pointerId);
      const leftZone = e.clientX < innerWidth * 0.42 && e.clientY > innerHeight * 0.35;
      if (leftZone && moveId === null) {
        moveId = e.pointerId; ox = e.clientX; oy = e.clientY;
        stick.hidden = false;
        stick.style.transform = `translate(${ox - 60}px, ${oy - 60}px)`;
        stick.firstChild.style.transform = 'translate(0px, 0px)';
      } else lookIds.set(e.pointerId, { x: e.clientX, y: e.clientY });
    });
    look.addEventListener('pointermove', (e) => {
      if (e.pointerId === moveId) {
        let dx = e.clientX - ox, dy = e.clientY - oy;
        const d = Math.hypot(dx, dy), max = 55;
        if (d > max) { dx *= max / d; dy *= max / d; }
        stick.firstChild.style.transform = `translate(${dx}px, ${dy}px)`;
        input.touchMove.x = dx / max;
        input.touchMove.y = -dy / max;
        input.setHeld('sprint', d > max * 0.98 && Math.hypot(e.clientX - ox, e.clientY - oy) > 90);
      } else if (lookIds.has(e.pointerId)) {
        const l = lookIds.get(e.pointerId);
        input.look.dx += (e.clientX - l.x) * 2.2 * input.sens;
        input.look.dy += (e.clientY - l.y) * 2.2 * input.sens;
        l.x = e.clientX; l.y = e.clientY;
      }
    });
    const end = (e) => {
      if (e.pointerId === moveId) { moveId = null; stick.hidden = true; input.touchMove.x = 0; input.touchMove.y = 0; input.setHeld('sprint', false); }
      lookIds.delete(e.pointerId);
    };
    look.addEventListener('pointerup', end);
    look.addEventListener('pointercancel', end);

    const btn = (cls, label, action, hold) => {
      const b = h('button', { class: `tbtn ${cls}`, type: 'button', 'aria-label': label }, h('span', {}, label));
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (action) input.press(action); if (hold) input.setHeld(hold, true); b.classList.add('on'); });
      const up = (e) => { e.preventDefault(); if (hold) input.setHeld(hold, false); b.classList.remove('on'); };
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('pointerleave', up);
      return b;
    };
    this.tAttack = btn('t-attack', '攻撃', 'attack', 'attack');
    const tSkill = btn('t-skill', 'E', 'skill');
    const tBurst = btn('t-burst', 'Q', 'burst');
    const tJump = btn('t-jump', '跳', 'jump', 'jump');
    const tDash = btn('t-dash', '駆', 'dash', 'sprint');
    const tMount = btn('t-mount', '騎', 'mount');
    const tDown = btn('t-down', '潜', null, 'down');
    const tPotion = btn('t-potion', '薬', 'potion');
    this.tDown = tDown;
    this.tSkill = tSkill;
    this.tBurst = tBurst;
    this.tPotion = tPotion;
    layer.append(h('div', { class: 't-cluster' }, this.tAttack, tSkill, tBurst, tJump, tDash, tMount, tDown, tPotion));
    this.root.append(layer);
    this.touchLayer = layer;
    layer.hidden = true;
  }

  showHud(on) {
    this.hud.hidden = !on;
    if (this.touchLayer) this.touchLayer.hidden = !on;
  }

  // ------------------------------------------------------------------ title
  showTitle({ hasSave, summary, onNew, onContinue }) {
    const reals = REALMS.map((r) => h('li', { style: `--c:${r.color}` }, r.short));
    let confirmNew = false;
    const newBtn = h('button', { class: 'tbtn-main', type: 'button' }, 'はじめから');
    const warn = h('p', { class: 'warn' });
    warn.hidden = true;
    tap(newBtn, () => {
      if (hasSave && !confirmNew) {
        confirmNew = true;
        warn.hidden = false;
        warn.textContent = '今のセーブデータは上書きされます。もう一度押すと新しく始めます。';
        newBtn.textContent = '上書きしてはじめる';
        return;
      }
      el.remove();
      onNew();
    });
    const contBtn = hasSave ? tap(h('button', { class: 'tbtn-main primary', type: 'button' }, 'つづきから', h('small', {}, summary)), () => { el.remove(); onContinue(); }) : null;
    const el = h('div', { class: 'title-screen' },
      h('div', { class: 'stars' }),
      h('div', { class: 't-inner' },
        h('p', { class: 'eyebrow' }, 'IMPACT THE WORLD'),
        h('h1', {}, '幻想ワールド'),
        h('p', { class: 'lead' }, '砕けた「星の核」を取り戻す旅へ。6つの世界をめぐり、物語を終えるたびに新たな仲間と専用武器が加わる。'),
        h('ul', { class: 'realms' }, reals),
        h('div', { class: 'title-btns' }, contBtn, newBtn),
        warn,
        h('p', { class: 'hint' }, this.game.input.isTouch ? '左側ドラッグで移動、右側ドラッグで視点。' : 'WASDで移動、マウスで視点、クリックで攻撃。'),
      ));
    this.root.append(el);
  }

  // ------------------------------------------------------------------ action routing
  handleAction(a) {
    const g = this.game;
    if (!g || !g.save) return false;
    if (g.state === 'reward') { if (a === 'interact' || a === 'jump' || a === 'attack') this.closeReward(); return true; }
    if (this.dialogueOpen) { if (a === 'interact' || a === 'jump' || a === 'attack' || a === 'menu') this.advanceDialogue(); return true; }
    if (g.state === 'dead') return true;
    if (this.menuName) {
      if (a === 'menu' || a === this.menuName || (a === 'map' && this.menuName === 'travel')) { this.closeMenu(); return true; }
      if (['map', 'party', 'story'].includes(a)) { this.openMenu(a); return true; }
      return true;
    }
    if (g.state !== 'play') return false;
    if (a === 'map' || a === 'party' || a === 'story') { this.openMenu(a); return true; }
    if (a === 'menu') { this.openMenu('pause'); return true; }
    if (a === 'attack' && !g.input.isTouch && !g.input.locked) g.input.wantsLock = true;
    return false;
  }

  // ------------------------------------------------------------------ per-frame HUD
  frame(dt) {
    const g = this.game;
    if (!g.save || this.hud.hidden) return;
    const p = g.player;
    const m = p.active;
    const stats = p.statsOf(m);
    const c = this.hudCache;

    // Active character
    const key = `${m.id}|${m.entry.lv}`;
    if (c.active !== key) {
      c.active = key;
      $('.lv', this.activeEl).textContent = `Lv.${m.entry.lv}`;
      $('.nm', this.activeEl).textContent = m.def.name;
      const el = $('.el', this.activeEl);
      el.textContent = ELEMENTS[m.def.element].name;
      el.style.background = ecol(m.def.element);
      this.activeEl.style.setProperty('--ec', ecol(m.def.element));
      $('.ic', this.skillBtn).textContent = m.def.skill.name;
      $('.ic', this.burstBtn).textContent = m.def.burst.name;
      this.skillBtn.style.setProperty('--ec', ecol(m.def.element));
      this.burstBtn.style.setProperty('--ec', ecol(m.def.element));
      if (this.tSkill) { this.tSkill.style.setProperty('--ec', ecol(m.def.element)); this.tBurst.style.setProperty('--ec', ecol(m.def.element)); }
    }
    const hpPct = clamp(m.hp / stats.maxHp, 0, 1) * 100;
    const shielded = p.shield.hp > 0 && g.time < p.shield.until;
    $('.hp', this.activeEl).style.width = `${hpPct}%`;
    $('.sh', this.activeEl).style.width = shielded ? `${clamp(p.shield.hp / stats.maxHp, 0, 1) * 100}%` : '0%';
    $('.hpnum', this.activeEl).textContent = `${Math.ceil(m.hp)} / ${stats.maxHp}`;
    const stMax = g.save.staminaMax;
    this.staminaEl.firstChild.style.width = `${(p.stamina / stMax) * 100}%`;
    this.staminaEl.classList.toggle('low', p.stamina < stMax * 0.25);
    this.staminaEl.classList.toggle('full', p.stamina >= stMax - 0.5);

    // Skills
    const cd = Math.max(0, m.cdUntil - g.time);
    const cdTxt = cd > 0 ? cd.toFixed(1) : '';
    $('.cd', this.skillBtn).textContent = cdTxt;
    this.skillBtn.classList.toggle('cooling', cd > 0);
    const en = m.energy / m.def.burst.cost;
    this.burstBtn.querySelector('.fg').style.strokeDashoffset = `${100 - en * 100}`;
    this.burstBtn.classList.toggle('ready', en >= 1);
    if (this.tSkill) {
      this.tSkill.classList.toggle('cooling', cd > 0);
      this.tSkill.dataset.cd = cdTxt;
      this.tBurst.classList.toggle('ready', en >= 1);
      this.tBurst.style.setProperty('--en', `${en * 100}%`);
      this.tDown.hidden = g.world.realm.mode !== 'underwater';
    }
    $('.n', this.potionEl).textContent = `回復薬 ×${g.save.potions}`;
    if (this.tPotion) this.tPotion.dataset.n = g.save.potions;

    // Party list
    this.updateParty(p);

    // Prompt
    const it = g.state === 'play' ? g.interactable() : null;
    this.promptEl.hidden = !it;
    if (it) $('span', this.promptEl).textContent = it.label;

    // Boss bar
    const boss = g.activeBoss();
    this.bossEl.hidden = !boss;
    if (boss) {
      $('.nm', this.bossEl).textContent = `${boss.def.name}  Lv.${boss.lv}`;
      $('.bar i', this.bossEl).style.width = `${(boss.hp / boss.maxHp) * 100}%`;
      const au = $('.aura', this.bossEl);
      au.style.background = boss.aura ? ecol(boss.aura) : 'transparent';
      au.title = boss.aura ? `${ELEMENTS[boss.aura].name}元素付着` : '';
    }

    this.updateQuest();
    this.updateEnemyBars();
    this.mmTimer -= dt;
    if (this.mmTimer <= 0) { this.mmTimer = 0.05; this.drawMinimap(); }
  }

  updateParty(p) {
    const c = this.hudCache;
    const key = p.members.map((m) => m.id).join(',');
    if (c.party !== key) {
      c.party = key;
      this.partyEl.replaceChildren(...p.members.map((m, i) => {
        const row = h('button', { class: 'pm', type: 'button', style: `--ec:${ecol(m.def.element)}` },
          h('span', { class: 'key' }, String(i + 1)),
          h('span', { class: 'face', style: `background-image:url(${portrait(this.renderer, m.id)})` }),
          h('span', { class: 'info' }, h('span', { class: 'nm' }, m.def.name), h('span', { class: 'bar' }, h('i'))),
          h('span', { class: 'en' }));
        tap(row, () => this.game.input.press(`switch${i + 1}`));
        return row;
      }));
    }
    const rows = this.partyEl.children;
    p.members.forEach((m, i) => {
      const row = rows[i];
      if (!row) return;
      const st = p.statsOf(m);
      row.classList.toggle('on', i === p.activeIdx);
      row.classList.toggle('down', m.hp <= 0);
      row.querySelector('.bar i').style.width = `${clamp(m.hp / st.maxHp, 0, 1) * 100}%`;
      row.querySelector('.en').classList.toggle('full', m.energy >= m.def.burst.cost);
    });
  }

  updateQuest() {
    const g = this.game;
    const obj = g.quests.objective();
    const c = this.hudCache;
    const txt = obj ? `${obj.title}|${obj.text}|${obj.realm}` : '';
    if (c.quest !== txt) {
      c.quest = txt;
      this.questEl.hidden = !obj;
      if (obj) {
        $('.q-title', this.questEl).textContent = obj.title;
        $('.q-text', this.questEl).textContent = obj.text;
      }
    }
    const mk = g.quests.marker();
    const dEl = $('.q-dist', this.questEl);
    if (obj && obj.realm !== g.world.realm.id) {
      dEl.textContent = `→ ${REALM_BY_ID[obj.realm].name}へ（次元の門）`;
      this.markerEl.hidden = true;
      return;
    }
    if (!mk) { dEl.textContent = ''; this.markerEl.hidden = true; return; }
    const pp = g.player.pos;
    const dist = Math.hypot(mk.x - pp.x, mk.z - pp.z);
    dEl.textContent = `${Math.round(dist)}m`;
    // Screen-space objective marker, clamped to the screen edge.
    const gy = g.world.realm.mode === 'underwater' ? pp.y : g.world.groundY(mk.x, mk.z);
    _v.set(mk.x, gy + 3, mk.z).project(g.cam);
    let x = _v.x, y = _v.y;
    const behind = _v.z > 1;
    if (behind) { x = -x; y = -y; }
    const edge = 0.88;
    const off = behind || Math.abs(x) > edge || Math.abs(y) > edge;
    if (off) {
      const s = edge / Math.max(Math.abs(x), Math.abs(y), 0.001);
      x *= s; y *= s;
      if (behind) y = -edge;
    }
    this.markerEl.hidden = dist < 4;
    this.markerEl.style.transform = `translate(${((x + 1) / 2) * innerWidth}px, ${((1 - y) / 2) * innerHeight}px)`;
    this.markerEl.classList.toggle('off', off);
    $('span', this.markerEl).textContent = `${Math.round(dist)}m`;
  }

  updateEnemyBars() {
    const g = this.game;
    const pp = g.player.pos;
    let n = 0;
    for (const e of g.enemies.list) {
      if (n >= this.barPool.length) break;
      if (e.dead || e.boss) continue;
      const d = Math.hypot(e.pos.x - pp.x, e.pos.z - pp.z);
      if (d > 40) continue;
      _v.set(e.pos.x, e.pos.y + e.height + 0.6, e.pos.z).project(g.cam);
      if (_v.z > 1 || Math.abs(_v.x) > 1.1 || Math.abs(_v.y) > 1.1) continue;
      const el = this.barPool[n++];
      el.hidden = false;
      el.style.transform = `translate(${((_v.x + 1) / 2) * innerWidth}px, ${((1 - _v.y) / 2) * innerHeight}px)`;
      el.querySelector('.b i').style.width = `${(e.hp / e.maxHp) * 100}%`;
      el.querySelector('.lv').textContent = `Lv.${e.lv}${e.def.elite ? ' ★' : ''}`;
      const au = el.querySelector('.au');
      au.style.background = e.aura ? ecol(e.aura) : 'transparent';
      el.classList.toggle('frozen', g.time < e.frozenUntil);
      el.classList.toggle('quest', !!e.quest);
    }
    for (let i = n; i < this.barPool.length; i++) this.barPool[i].hidden = true;
  }

  drawMinimap() {
    const g = this.game;
    const cv = this.mm, ctx = cv.getContext('2d');
    const S = cv.width, R = S / 2;
    const world = g.world;
    const pp = g.player.pos;
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath();
    ctx.arc(R, R, R - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#1a1626';
    ctx.fillRect(0, 0, S, S);
    const viewR = 420; // world units from centre to edge
    const k = R / viewR;
    ctx.translate(R, R);
    ctx.rotate(g.camera.yaw - Math.PI);
    if (world.mapCanvas) {
      const px = 512 / (WORLD_HALF * 2);
      const sx = (pp.x + WORLD_HALF) * px, sz = (pp.z + WORLD_HALF) * px;
      const src = viewR * px * 1.5;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(world.mapCanvas, sx - src, sz - src, src * 2, src * 2, -viewR * 1.5 * k, -viewR * 1.5 * k, viewR * 3 * k, viewR * 3 * k);
    }
    const dot = (x, z, col, r = 4, shape = 'circle') => {
      const dx = (x - pp.x) * k, dz = (z - pp.z) * k;
      const d = Math.hypot(dx, dz);
      let ox = dx, oz = dz;
      if (d > R - 8) { ox = (dx / d) * (R - 8); oz = (dz / d) * (R - 8); }
      ctx.fillStyle = col;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (shape === 'diamond') { ctx.moveTo(ox, oz - r * 1.4); ctx.lineTo(ox + r, oz); ctx.lineTo(ox, oz + r * 1.4); ctx.lineTo(ox - r, oz); ctx.closePath(); }
      else ctx.arc(ox, oz, r, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    };
    for (const w of world.warps) if (Math.hypot(w.x - pp.x, w.z - pp.z) < viewR * 1.2) dot(w.x, w.z, w.unlocked ? '#6ad8ff' : '#8a8a9a', 4, 'diamond');
    for (const e of g.enemies.list) if (!e.dead && Math.hypot(e.pos.x - pp.x, e.pos.z - pp.z) < viewR) dot(e.pos.x, e.pos.z, e.boss ? '#ff3a6a' : '#ff6a5a', e.boss ? 5 : 2.5);
    for (const n of g.npcs.list) if (n.kind !== 'folk') dot(n.x, n.z, '#ffd36a', 4, 'diamond');
    if (world.gate) dot(world.gate.x, world.gate.z, '#b48aff', 4);
    const mk = g.quests.marker();
    if (mk) dot(mk.x, mk.z, '#ffd36a', 5.5, 'diamond');
    ctx.restore();
    // Player arrow (screen-up is the camera direction)
    ctx.save();
    ctx.translate(R, R);
    ctx.rotate(g.camera.yaw - g.player.yaw);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#1a1626';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -9); ctx.lineTo(6, 7); ctx.lineTo(0, 3); ctx.lineTo(-6, 7); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
    const lbl = `${world.realm.name}　${Math.round(pp.x)}, ${Math.round(pp.z)}`;
    if (this.hudCache.lbl !== lbl) { this.hudCache.lbl = lbl; this.realmLabel.textContent = lbl; }
    const n = this.mm.parentNode.querySelector('.mm-n');
    const a = Math.PI - g.camera.yaw;
    n.style.transform = `translate(${Math.sin(a) * (R - 12)}px, ${-Math.cos(a) * (R - 12)}px)`;
  }

  // ------------------------------------------------------------------ feedback
  toast(text, color = '#ffffff', minor = false) {
    if (minor && this.toastEls.some((t) => t.textContent === text)) return;
    const el = h('div', { class: `toast${minor ? ' minor' : ''}`, style: `--c:${color}` }, text);
    this.toastWrap.append(el);
    this.toastEls.push(el);
    while (this.toastEls.length > 5) this.toastEls.shift().remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => { el.remove(); this.toastEls = this.toastEls.filter((t) => t !== el); }, 400); }, minor ? 1400 : 3200);
  }

  banner(title, sub, color = '#ffffff') {
    this.bannerQueue = this.bannerQueue || [];
    this.bannerQueue.push({ title, sub, color });
    if (!this.bannerBusy) this.nextBanner();
  }

  nextBanner() {
    const b = this.bannerQueue.shift();
    if (!b) { this.bannerBusy = false; return; }
    this.bannerBusy = true;
    $('.b-title', this.bannerEl).textContent = b.title;
    $('.b-sub', this.bannerEl).textContent = b.sub || '';
    this.bannerEl.style.setProperty('--c', b.color);
    this.bannerEl.classList.remove('show');
    void this.bannerEl.offsetWidth;
    this.bannerEl.classList.add('show');
    setTimeout(() => { this.bannerEl.classList.remove('show'); setTimeout(() => this.nextBanner(), 350); }, 2600);
  }

  damage(pos, amount, color, crit, label, onPlayer = false, heal = false) {
    _v.copy(pos).project(this.game.cam);
    if (_v.z > 1 || Math.abs(_v.x) > 1.2 || Math.abs(_v.y) > 1.2) return;
    const el = this.numPool[this.numIdx];
    this.numIdx = (this.numIdx + 1) % this.numPool.length;
    el.hidden = false;
    el.className = `dmg${crit ? ' crit' : ''}${onPlayer ? ' me' : ''}${heal ? ' heal' : ''}`;
    el.style.setProperty('--c', color);
    el.textContent = '';
    if (label) el.append(h('small', {}, label));
    el.append(`${heal ? '+' : ''}${amount}`);
    const x = ((_v.x + 1) / 2) * innerWidth + (Math.random() - 0.5) * 30;
    const y = ((1 - _v.y) / 2) * innerHeight;
    el.getAnimations().forEach((a) => a.cancel());
    const anim = el.animate([
      { transform: `translate(${x}px, ${y}px) scale(${crit ? 1.5 : 1})`, opacity: 1 },
      { transform: `translate(${x}px, ${y - 30}px) scale(1)`, opacity: 1, offset: 0.4 },
      { transform: `translate(${x}px, ${y - 55}px) scale(0.9)`, opacity: 0 },
    ], { duration: 900, easing: 'ease-out' });
    anim.onfinish = () => { el.hidden = true; };
  }

  hurtFlash() {
    this.hurtEl.classList.remove('on');
    void this.hurtEl.offsetWidth;
    this.hurtEl.classList.add('on');
  }

  burstFlash(color, name, skill) {
    this.flashEl.style.setProperty('--c', color);
    $('.f-name', this.flashEl).textContent = name;
    $('.f-skill', this.flashEl).textContent = skill;
    this.flashEl.classList.remove('on');
    void this.flashEl.offsetWidth;
    this.flashEl.classList.add('on');
  }

  fade(fn) {
    this.fadeEl.classList.add('on');
    setTimeout(() => {
      requestAnimationFrame(() => {
        try { fn(); } finally {
          setTimeout(() => this.fadeEl.classList.remove('on'), 120);
        }
      });
    }, 320);
  }

  onRealmChanged(realm) {
    document.documentElement.style.setProperty('--realm', realm.color);
    this.hudCache = {};
  }

  // ------------------------------------------------------------------ dialogue
  dialogue(lines, onDone) {
    this.dialogueQueue.push({ lines: lines.slice(), onDone });
    if (!this.dialogueOpen) this.nextDialogue();
  }

  nextDialogue() {
    const g = this.game;
    const d = this.dialogueQueue[0];
    if (!d) {
      this.dialogueOpen = false;
      this.dialogEl.hidden = true;
      if (g.state === 'dialogue') g.state = 'play';
      return;
    }
    this.dialogueOpen = true;
    if (g.state === 'play') g.state = 'dialogue';
    g.input.exitLock();
    this.dialogEl.hidden = false;
    this.showLine();
  }

  showLine() {
    const d = this.dialogueQueue[0];
    const [name, text] = d.lines[0];
    $('.dl-name', this.dialogEl).textContent = name;
    $('.dl-name', this.dialogEl).hidden = !name;
    const t = $('.dl-text', this.dialogEl);
    t.textContent = '';
    this.typing = { text, i: 0 };
    clearInterval(this.typeTimer);
    this.typeTimer = setInterval(() => {
      if (!this.typing) return;
      this.typing.i += 2;
      t.textContent = this.typing.text.slice(0, this.typing.i);
      if (this.typing.i >= this.typing.text.length) { clearInterval(this.typeTimer); this.typing = null; }
    }, 30);
    this.game.audio.play('ui');
  }

  advanceDialogue() {
    if (!this.dialogueOpen) return;
    const t = $('.dl-text', this.dialogEl);
    if (this.typing) { t.textContent = this.typing.text; this.typing = null; clearInterval(this.typeTimer); return; }
    const d = this.dialogueQueue[0];
    d.lines.shift();
    if (d.lines.length) { this.showLine(); return; }
    this.dialogueQueue.shift();
    this.dialogueOpen = false;
    this.dialogEl.hidden = true;
    if (this.game.state === 'dialogue') this.game.state = 'play';
    this.game.input.clearQueued();
    try { d.onDone?.(); } finally { if (!this.dialogueOpen) this.nextDialogue(); }
  }

  // ------------------------------------------------------------------ reward
  reward(ch, charId, isNew, onDone) {
    const g = this.game;
    const def = CHARACTERS[charId];
    const w = WEAPONS[def.weaponId];
    g.state = 'reward';
    g.input.exitLock();
    this.rewardDone = onDone;
    const card = h('div', { class: 'r-card', style: `--ec:${ecol(def.element)}` },
      h('p', { class: 'eyebrow' }, `${ch.title} クリア`),
      h('h2', {}, isNew ? '新たな仲間が加わった！' : '物語をクリアした！'),
      h('div', { class: 'r-body' },
        h('div', { class: 'r-face', style: `background-image:url(${portrait(this.renderer, charId)})` }),
        h('div', { class: 'r-info' },
          h('div', { class: 'r-title' }, def.title),
          h('div', { class: 'r-name' }, def.name),
          h('div', { class: 'r-tags' }, h('span', { class: 'tag el' }, `${ELEMENTS[def.element].name}元素`), h('span', { class: 'tag' }, WEAPON_TYPES[def.weapon].name), h('span', { class: 'tag' }, `Lv.${g.save.roster[charId].lv}`)))),
      h('div', { class: 'r-weapon' },
        h('div', { class: 'rw-label' }, '専用武器'),
        h('div', { class: 'rw-name' }, w.name),
        h('div', { class: 'rw-pass' }, h('b', {}, `${w.passive.name}：`), w.passive.desc)),
      h('ul', { class: 'r-skills' },
        h('li', {}, h('b', {}, `E ${def.skill.name}`), def.skill.desc),
        h('li', {}, h('b', {}, `Q ${def.burst.name}`), def.burst.desc)),
      h('p', { class: 'r-hint' }, '「編成」からパーティに入れられます。全員に経験値ボーナス！'),
      tap(h('button', { class: 'tbtn-main primary', type: 'button' }, '受け取る'), () => this.closeReward()));
    this.rewardEl.replaceChildren(card);
    this.rewardEl.hidden = false;
  }

  closeReward() {
    this.rewardEl.hidden = true;
    this.game.state = 'play';
    this.game.input.clearQueued();
    const fn = this.rewardDone;
    this.rewardDone = null;
    fn?.();
  }

  showDeath(onRevive) {
    this.game.input.exitLock();
    this.deathEl.replaceChildren(h('div', { class: 'd-card' },
      h('h2', {}, 'パーティが全滅した…'),
      h('p', {}, '近くのワープポイントで態勢を立て直そう。'),
      tap(h('button', { class: 'tbtn-main primary', type: 'button' }, 'ワープポイントで復活'), () => { this.deathEl.hidden = true; this.fade(onRevive); })));
    this.deathEl.hidden = false;
  }

  // ------------------------------------------------------------------ menus
  openMenu(name) {
    const g = this.game;
    if (!g.save || g.state === 'reward' || g.state === 'dead' || this.dialogueOpen) return;
    g.input.exitLock();
    this.menuName = name;
    g.state = 'menu';
    this.menuEl.hidden = false;
    this.renderMenu();
    g.audio.play('ui');
  }

  closeMenu() {
    this.menuName = null;
    this.menuEl.hidden = true;
    this.menuEl.replaceChildren();
    if (this.game.state === 'menu') this.game.state = 'play';
    this.game.input.clearQueued();
  }

  renderMenu() {
    const tabs = [['map', '地図'], ['party', '編成'], ['story', '物語'], ['pause', '設定']];
    const head = h('div', { class: 'm-head' },
      h('nav', { class: 'm-tabs' }, tabs.map(([k, l]) => tap(h('button', { type: 'button', class: (this.menuName === k || (k === 'map' && this.menuName === 'travel')) ? 'on' : '' }, l), () => { this.menuName = k; this.renderMenu(); }))),
      tap(h('button', { class: 'm-close', type: 'button', 'aria-label': '閉じる' }, '×'), () => this.closeMenu()));
    let body;
    switch (this.menuName) {
      case 'map': body = this.mapMenu(); break;
      case 'travel': body = this.travelMenu(); break;
      case 'party': body = this.partyMenu(); break;
      case 'story': body = this.storyMenu(); break;
      default: body = this.pauseMenu(); break;
    }
    this.menuEl.replaceChildren(h('div', { class: 'm-panel' }, head, h('div', { class: 'm-body' }, body)));
  }

  // ---- Map
  mapMenu() {
    const g = this.game;
    g.world.finishMap();
    const realm = g.world.realm;
    const wrap = h('div', { class: 'map-menu' });
    const tabs = h('div', { class: 'realm-tabs' }, REALMS.map((r) => {
      const open = g.save.realms.includes(r.id);
      const b = h('button', { type: 'button', class: `${r.id === realm.id ? 'on' : ''}${open ? '' : ' locked'}` }, r.short);
      tap(b, () => { if (r.id !== realm.id) { this.menuName = 'travel'; this.travelFocus = r.id; this.renderMenu(); } });
      return b;
    }));
    const size = Math.min(innerWidth - 40, innerHeight - 190, 760);
    const cv = h('canvas', { class: 'bigmap', width: size * 2, height: size * 2, style: `width:${size}px;height:${size}px` });
    const info = h('div', { class: 'map-info' }, h('b', {}, realm.name), h('span', {}, realm.desc));
    const warpsList = h('div', { class: 'warp-list' });
    const draw = () => {
      const ctx = cv.getContext('2d');
      const S = cv.width;
      const k = S / (WORLD_HALF * 2);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(g.world.mapCanvas, 0, 0, S, S);
      // Unexplored fog
      const cell = S / EXPLORE_GRID;
      ctx.fillStyle = 'rgba(16,12,28,0.72)';
      for (let i = 0; i < EXPLORE_GRID * EXPLORE_GRID; i++) if (!g.isExplored(i)) ctx.fillRect((i % EXPLORE_GRID) * cell - 0.5, Math.floor(i / EXPLORE_GRID) * cell - 0.5, cell + 1, cell + 1);
      const toPx = (x, z) => [(x + WORLD_HALF) * k, (z + WORLD_HALF) * k];
      ctx.font = `${Math.round(S / 50)}px "Zen Maru Gothic", sans-serif`;
      ctx.textAlign = 'center';
      for (const l of realm.landmarks) {
        const [x, y] = toPx(l.x, l.z);
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillText(l.name, x + 1, y - 11);
        ctx.fillStyle = '#fff6dc';
        ctx.fillText(l.name, x, y - 12);
        ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill();
      }
      const [hx, hy] = toPx(realm.hub.x, realm.hub.z);
      ctx.fillStyle = '#ffd36a';
      ctx.beginPath(); ctx.arc(hx, hy, 9, 0, 7); ctx.fill();
      ctx.fillStyle = '#1a1626';
      ctx.fillText('町', hx, hy + 5);
      for (const w of g.world.warps) {
        const [x, y] = toPx(w.x, w.z);
        ctx.fillStyle = w.unlocked ? '#6ad8ff' : '#7a7a8a';
        ctx.strokeStyle = '#0a0a14';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x, y - 12); ctx.lineTo(x + 8, y); ctx.lineTo(x, y + 12); ctx.lineTo(x - 8, y); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      const mk = g.quests.marker();
      if (mk) {
        const [x, y] = toPx(mk.x, mk.z);
        ctx.strokeStyle = '#ffd36a'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(x, y, 16, 0, 7); ctx.stroke();
        ctx.fillStyle = '#ffd36a'; ctx.beginPath(); ctx.arc(x, y, 6, 0, 7); ctx.fill();
      }
      const pp = g.player.pos;
      const [px, py] = toPx(pp.x, pp.z);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(Math.PI - g.player.yaw);
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#1a1626'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(10, 11); ctx.lineTo(0, 5); ctx.lineTo(-10, 11); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    };
    draw();
    cv.addEventListener('click', (e) => {
      const rect = cv.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * WORLD_HALF * 2 - WORLD_HALF;
      const z = ((e.clientY - rect.top) / rect.height) * WORLD_HALF * 2 - WORLD_HALF;
      let best = null, bd = 160;
      for (const w of g.world.warps) { const d = Math.hypot(w.x - x, w.z - z); if (d < bd) { bd = d; best = w; } }
      if (best) this.confirmWarp(best);
    });
    for (const w of g.world.warps) {
      const b = h('button', { type: 'button', class: `warp-btn${w.unlocked ? '' : ' locked'}`, disabled: !w.unlocked }, h('i'), w.name);
      tap(b, () => this.confirmWarp(w));
      warpsList.append(b);
    }
    wrap.append(tabs, h('div', { class: 'map-row' }, h('div', { class: 'map-frame' }, cv), h('div', { class: 'map-side' }, info, h('h3', {}, 'ワープポイント'), warpsList, h('p', { class: 'muted' }, '水色のワープポイントへ移動できます。近づくと解放されます。'))));
    return wrap;
  }

  confirmWarp(w) {
    if (!w.unlocked) { this.toast('まだ解放されていないワープポイントです', '#c8c8d8', true); return; }
    this.closeMenu();
    this.game.warpTo(w);
  }

  travelMenu() {
    const g = this.game;
    const list = h('div', { class: 'travel' });
    for (const r of REALMS) {
      const open = g.save.realms.includes(r.id);
      const here = r.id === g.world.realm.id;
      const done = CHAPTERS.filter((c) => c.realm === r.id && g.save.story[c.id].status === 'done').length;
      const unlockCh = r.unlockedBy ? CHAPTERS.find((c) => c.id === r.unlockedBy) : null;
      const card = h('div', { class: `realm-card${open ? '' : ' locked'}${this.travelFocus === r.id ? ' focus' : ''}`, style: `--c:${r.color};--t:${r.color}` },
        h('div', { class: 'rc-top' }, h('b', {}, r.name), h('span', {}, `Lv.${r.levels[0]}〜${r.levels[1]}`)),
        h('p', {}, r.desc),
        h('div', { class: 'rc-foot' },
          h('span', { class: 'muted' }, open ? `物語 ${done}/2 クリア` : `解放条件: ${unlockCh ? unlockCh.title : ''}をクリア`),
          here ? h('span', { class: 'here' }, '現在地') : open ? tap(h('button', { type: 'button', class: 'tbtn-main primary small' }, 'この世界へ渡る'), () => { this.closeMenu(); g.travelToRealm(r.id); }) : h('span', { class: 'lock' }, '未解放')));
      list.append(card);
    }
    this.travelFocus = null;
    return h('div', {}, h('p', { class: 'muted' }, '次元の門を通って6つの世界を行き来できます。渡った先では町のワープポイントに着きます。'), list);
  }

  // ---- Party
  partyMenu() {
    const g = this.game;
    const save = g.save;
    const owned = CHARACTER_IDS.filter((id) => save.roster[id]);
    if (!this.selectedChar || !save.roster[this.selectedChar]) this.selectedChar = save.party[g.player.activeIdx] || owned[0];
    const party = save.party.slice();
    const slots = h('div', { class: 'slots' }, [0, 1, 2, 3].map((i) => {
      const id = party[i];
      const def = id ? CHARACTERS[id] : null;
      const b = h('button', { type: 'button', class: `slot${id === this.selectedChar ? ' on' : ''}`, style: def ? `--ec:${ecol(def.element)}` : '' },
        h('span', { class: 'k' }, String(i + 1)),
        def ? h('span', { class: 'face', style: `background-image:url(${portrait(this.renderer, id)})` }) : h('span', { class: 'face empty' }),
        h('span', { class: 'nm' }, def ? def.name : '空き'));
      tap(b, () => { if (id) { this.selectedChar = id; this.renderMenu(); } });
      return b;
    }));
    const grid = h('div', { class: 'roster' }, CHARACTER_IDS.map((id) => {
      const def = CHARACTERS[id];
      const have = !!save.roster[id];
      const inParty = party.includes(id);
      const b = h('button', { type: 'button', class: `rcard${have ? '' : ' locked'}${id === this.selectedChar ? ' on' : ''}${inParty ? ' inparty' : ''}`, style: `--ec:${ecol(def.element)}`, disabled: !have },
        have ? h('span', { class: 'face', style: `background-image:url(${portrait(this.renderer, id)})` }) : h('span', { class: 'face q' }, '？'),
        h('span', { class: 'nm' }, have ? def.name : '？？？'),
        have ? h('span', { class: 'lv' }, `Lv.${save.roster[id].lv}`) : h('span', { class: 'lv' }, this.whereToGet(id)));
      tap(b, () => { if (have) { this.selectedChar = id; this.renderMenu(); } });
      return b;
    }));
    const id = this.selectedChar;
    const def = CHARACTERS[id];
    const w = WEAPONS[def.weaponId];
    const entry = save.roster[id];
    const st = characterStats(id, entry.lv);
    const inParty = party.includes(id);
    const actions = h('div', { class: 'p-actions' });
    if (inParty) {
      if (party.length > 1) actions.append(tap(h('button', { type: 'button', class: 'tbtn-main small' }, 'パーティから外す'), () => { g.setParty(party.filter((x) => x !== id)); this.renderMenu(); }));
    } else if (party.length < 4) actions.append(tap(h('button', { type: 'button', class: 'tbtn-main primary small' }, 'パーティに入れる'), () => { g.setParty([...party, id]); this.renderMenu(); }));
    else {
      actions.append(h('span', { class: 'muted' }, '入れ替え：'));
      party.forEach((pid, i) => actions.append(tap(h('button', { type: 'button', class: 'tbtn-main small' }, `${i + 1}. ${CHARACTERS[pid].name}と交代`), () => { const np = party.slice(); np[i] = id; g.setParty(np); this.renderMenu(); })));
    }
    const exp = entry.lv >= MAX_LEVEL ? 'MAX' : `${entry.exp} / ${expToNext(entry.lv)}`;
    const detail = h('div', { class: 'detail', style: `--ec:${ecol(def.element)}` },
      h('div', { class: 'd-top' },
        h('div', { class: 'd-face', style: `background-image:url(${portrait(this.renderer, id)})` }),
        h('div', {},
          h('div', { class: 'd-title' }, def.title),
          h('div', { class: 'd-name' }, def.name),
          h('div', { class: 'r-tags' }, h('span', { class: 'tag el' }, `${ELEMENTS[def.element].name}元素`), h('span', { class: 'tag' }, WEAPON_TYPES[def.weapon].name), h('span', { class: 'tag' }, `Lv.${entry.lv}`)),
          h('div', { class: 'muted small' }, `経験値 ${exp}`))),
      h('dl', { class: 'stats' },
        h('dt', {}, 'HP'), h('dd', {}, st.maxHp), h('dt', {}, '攻撃力'), h('dd', {}, st.atk), h('dt', {}, '防御力'), h('dd', {}, st.def),
        h('dt', {}, '会心率'), h('dd', {}, `${Math.round(st.critRate * 100)}%`), h('dt', {}, '会心ダメージ'), h('dd', {}, `${Math.round(st.critDmg * 100)}%`), h('dt', {}, '元素チャージ'), h('dd', {}, `${Math.round(st.er * 100)}%`)),
      h('div', { class: 'r-weapon' },
        h('div', { class: 'rw-label' }, w.exclusive ? '専用武器' : '初期武器'),
        h('div', { class: 'rw-name' }, `${w.name}　`, h('span', { class: 'muted small' }, `基礎攻撃力 ${Math.round(w.atk * (1 + (entry.lv - 1) * 0.09))}`)),
        h('div', { class: 'rw-pass' }, h('b', {}, `${w.passive.name}：`), w.passive.desc)),
      h('ul', { class: 'r-skills' },
        h('li', {}, h('b', {}, `E ${def.skill.name}`), def.skill.desc),
        h('li', {}, h('b', {}, `Q ${def.burst.name}（エネルギー${def.burst.cost}）`), def.burst.desc)),
      h('p', { class: 'profile' }, def.profile),
      actions);
    return h('div', { class: 'party-menu' }, h('div', { class: 'pm-left' }, h('h3', {}, 'パーティ（最大4人）'), slots, h('h3', {}, `仲間 ${owned.length}/${CHARACTER_IDS.length}`), grid), detail);
  }

  whereToGet(id) {
    const ch = CHAPTERS.find((c) => c.reward === id);
    return ch ? `${REALM_BY_ID[ch.realm].short}の物語` : '';
  }

  // ---- Story
  storyMenu() {
    const g = this.game;
    const save = g.save;
    const groups = REALMS.map((r) => {
      const open = save.realms.includes(r.id);
      const items = CHAPTERS.filter((c) => c.realm === r.id).map((c) => {
        const st = save.story[c.id];
        const label = { locked: '未解放', available: '受注可能', active: '進行中', done: 'クリア' }[st.status];
        const rewardDef = CHARACTERS[c.reward];
        const tracked = save.tracked === c.id;
        const canTrack = st.status === 'available' || st.status === 'active';
        const item = h('div', { class: `chapter ${st.status}${tracked ? ' tracked' : ''}` },
          h('div', { class: 'c-top' }, h('b', {}, c.title), h('span', { class: `pill ${st.status}` }, label)),
          h('p', {}, st.status === 'locked' ? (open ? '前の章をクリアすると解放されます。' : `${r.name}が解放されると始まります。`) : c.summary),
          h('div', { class: 'c-foot' },
            h('span', { class: 'c-reward', style: `--ec:${ecol(rewardDef.element)}` }, '報酬：', st.status === 'locked' ? '？？？' : `${rewardDef.name}（${ELEMENTS[rewardDef.element].name}・${WEAPON_TYPES[rewardDef.weapon].name}）＋専用武器`),
            canTrack ? (tracked ? h('span', { class: 'here' }, '追跡中') : tap(h('button', { type: 'button', class: 'tbtn-main small' }, '追跡する'), () => { save.tracked = c.id; this.renderMenu(); })) : null));
        if (st.status === 'active') item.append(h('div', { class: 'c-step' }, `現在の目標：${c.steps[st.step].label}`));
        if (st.status === 'available') item.append(h('div', { class: 'c-step' }, `${r.hub.name}の「${c.steps[0].npc.name}」に話しかけよう`));
        return item;
      });
      return h('section', { class: `story-realm${open ? '' : ' locked'}`, style: `--c:${r.color}` }, h('h3', {}, r.name, h('span', { class: 'muted small' }, `　推奨Lv.${r.levels[0]}〜${r.levels[1]}`)), items);
    });
    const done = CHAPTERS.filter((c) => save.story[c.id].status === 'done').length;
    return h('div', { class: 'story-menu' }, h('p', { class: 'muted' }, `物語の進行 ${done}/${CHAPTERS.length}　・　プレイ時間 ${formatTime(save.playTime)}`), groups);
  }

  // ---- Settings
  pauseMenu() {
    const g = this.game;
    const s = g.save.settings;
    const sel = h('select', { id: 'set-quality' }, [['auto', '自動'], ['high', '高'], ['medium', '中'], ['low', '低']].map(([v, l]) => h('option', { value: v, selected: s.quality === v }, l)));
    sel.addEventListener('change', () => {
      s.quality = sel.value;
      g.saveNow();
      this.closeMenu();
      g.autoQualityDone = s.quality !== 'auto';
      g.ui.fade(() => g.applyQuality(s.quality === 'auto' ? g.qualityName : s.quality));
    });
    const sens = h('input', { id: 'set-sens', type: 'range', min: '0.3', max: '2.5', step: '0.1', value: String(s.sens) });
    sens.addEventListener('input', () => { s.sens = Number(sens.value); g.input.sens = s.sens; });
    const toggle = (id, label, key, apply) => {
      const cb = h('input', { id, type: 'checkbox', checked: s[key] });
      cb.addEventListener('change', () => { s[key] = cb.checked; apply(cb.checked); g.saveSoon(); });
      return h('label', { class: 'set-row', for: id }, h('span', {}, label), cb);
    };
    const saveBtn = tap(h('button', { type: 'button', class: 'tbtn-main primary small' }, 'セーブする'), () => { const ok = g.saveNow(); this.toast(ok ? 'セーブしました' : 'この環境ではセーブできません', ok ? '#7dff9a' : '#ff8a8a'); });
    let armed = false;
    const resetBtn = h('button', { type: 'button', class: 'tbtn-main small danger' }, 'セーブデータを消して最初から');
    tap(resetBtn, () => {
      if (!armed) { armed = true; resetBtn.textContent = '本当に消す（もう一度押す）'; return; }
      g.resetSave();
    });
    const help = this.game.input.isTouch
      ? [['左ドラッグ', '移動（端まで倒すとダッシュ）'], ['右ドラッグ', '視点'], ['攻撃', '通常攻撃（長押しで連続）'], ['E / Q', '元素スキル / 元素爆発'], ['跳', 'ジャンプ・空中でもう一度押すと滑空'], ['駆', 'ダッシュ回避'], ['騎', '精霊の馬に乗る'], ['顔アイコン', 'キャラ交代']]
      : [['WASD', '移動'], ['マウス / ドラッグ', '視点（クリックで固定、Escで解除）'], ['左クリック', '通常攻撃（押しっぱなしで連続）'], ['E', '元素スキル'], ['Q', '元素爆発'], ['Space', 'ジャンプ・空中で滑空・水中で浮上'], ['Ctrl / X', '水中で潜る'], ['Shift', 'ダッシュ回避（押し続けて走る）'], ['R', '精霊の馬に乗る / 降りる'], ['F', '話す・調べる'], ['1〜4', 'キャラ交代'], ['H', '回復薬'], ['M / C / J', '地図 / 編成 / 物語']];
    return h('div', { class: 'pause-menu' },
      h('section', {}, h('h3', {}, '設定'),
        h('label', { class: 'set-row', for: 'set-quality' }, h('span', {}, '画質'), sel),
        h('label', { class: 'set-row', for: 'set-sens' }, h('span', {}, '視点感度'), sens),
        toggle('set-sfx', '効果音', 'sfx', (v) => { g.audio.sfxOn = v; }),
        toggle('set-bgm', 'BGM', 'bgm', (v) => { g.audio.bgmOn = v; if (v) g.audio.startMusic(g.world.realm.bgm); else g.audio.stopMusic(); }),
        h('div', { class: 'set-btns' }, saveBtn, resetBtn),
        h('p', { class: 'muted small' }, 'セーブはこのブラウザに保存されます。20秒ごとと物語の進行時にも自動セーブします。')),
      h('section', {}, h('h3', {}, '操作方法'), h('dl', { class: 'keys' }, help.map(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]))),
      h('section', {}, h('h3', {}, '元素反応'), h('dl', { class: 'keys' },
        [['融解', '火×氷　大ダメージ'], ['蒸発', '火×水　大ダメージ'], ['過負荷', '雷×火　爆発'], ['感電', '雷×水　継続ダメージ'], ['超電導', '雷×氷　耐性ダウン'], ['凍結', '水×氷　敵を凍らせる'], ['拡散', '風×元素　周囲に広がる'], ['結晶', '岩×元素　シールド'], ['輝光', '光×元素　回復'], ['侵蝕', '闇×元素　耐性ダウン'], ['対消滅', '光×闇　超大ダメージ']].map(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]))));
  }
}

