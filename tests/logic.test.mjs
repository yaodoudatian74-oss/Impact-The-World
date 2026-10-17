import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS, WEAPONS, STARTER_IDS, CHARACTER_IDS } from '../src/data/characters.js';
import { ENEMIES } from '../src/data/enemies.js';
import { REALMS, REALM_BY_ID, WORLD_HALF } from '../src/data/realms.js';
import { CHAPTERS } from '../src/data/stories.js';
import { ELEMENTS, findReaction } from '../src/data/elements.js';
import {
  characterStats, damageToEnemy, damageToCharacter, levelFactor, expToNext, enemyExp, addExp,
  resolveElement, recruitLevel, MAX_LEVEL, growth,
} from '../src/game/rules.js';
import { newSave, migrate, refreshAvailability, loadFrom, writeTo, decodeExplored, encodeExplored, SAVE_VERSION } from '../src/game/save.js';
import { createTerrain } from '../src/world/terrain.js';
import { mulberry32 } from '../src/core/rng.js';

// ------------------------------------------------------------------ content integrity
test('five starting characters, twelve recruitable, each with a unique weapon', () => {
  assert.equal(STARTER_IDS.length, 5);
  const rewards = CHAPTERS.map((c) => c.reward);
  assert.equal(new Set(rewards).size, 12);
  assert.equal(CHARACTER_IDS.length, 17);
  for (const id of rewards) assert.ok(!STARTER_IDS.includes(id), `${id} is a starter and a reward`);
  for (const id of CHARACTER_IDS) {
    const c = CHARACTERS[id];
    const w = WEAPONS[c.weaponId];
    assert.ok(w, `${id} weapon`);
    assert.equal(w.type, c.weapon, `${id} weapon type matches`);
    assert.ok(ELEMENTS[c.element], `${id} element`);
  }
  for (const id of rewards) assert.ok(WEAPONS[CHARACTERS[id].weaponId].exclusive, `${id} has an exclusive weapon`);
  const weaponIds = CHARACTER_IDS.map((id) => CHARACTERS[id].weaponId);
  assert.equal(new Set(weaponIds).size, weaponIds.length, 'no shared weapons');
});

test('every realm has exactly two chapters, and realms unlock in a chain', () => {
  assert.deepEqual(REALMS.map((r) => r.id), ['plains', 'volcano', 'ice', 'sea', 'heaven', 'space']);
  for (const r of REALMS) assert.equal(CHAPTERS.filter((c) => c.realm === r.id).length, 2, r.id);
  for (const r of REALMS.slice(1)) assert.ok(CHAPTERS.find((c) => c.id === r.unlockedBy), `${r.id} unlock chapter exists`);
});

test('chapter steps reference real enemies, bosses and in-bounds positions', () => {
  for (const ch of CHAPTERS) {
    assert.equal(ch.steps[0].type, 'talk', `${ch.id} starts with a talk`);
    assert.equal(ch.steps[ch.steps.length - 1].type, 'talk', `${ch.id} ends with meeting the recruit`);
    assert.equal(ch.steps[ch.steps.length - 1].npc.char, ch.reward, `${ch.id} final talk is the recruit`);
    assert.ok(ch.steps.some((s) => s.type === 'boss'), `${ch.id} has a boss`);
    for (const s of ch.steps) {
      if (s.type === 'defeat') assert.ok(ENEMIES[s.enemy] && !ENEMIES[s.enemy].boss, `${ch.id} enemy ${s.enemy}`);
      if (s.type === 'boss') assert.ok(ENEMIES[s.boss]?.boss, `${ch.id} boss ${s.boss}`);
      const pts = s.type === 'collect' ? s.points : s.type === 'talk' ? [[s.npc.x, s.npc.z]] : s.x !== undefined ? [[s.x, s.z]] : [];
      for (const [x, z] of pts) assert.ok(Math.abs(x) < WORLD_HALF - 100 && Math.abs(z) < WORLD_HALF - 100, `${ch.id} point in bounds`);
    }
  }
  for (const r of REALMS) for (const id of r.enemies) assert.ok(ENEMIES[id] && !ENEMIES[id].boss, `${r.id} pool ${id}`);
});

// ------------------------------------------------------------------ rules
test('level factor is 1 at equal levels and favours the higher level', () => {
  assert.equal(levelFactor(30, 30), 1);
  assert.ok(levelFactor(20, 40) < 1);
  assert.ok(levelFactor(40, 20) > 1);
});

test('damage is positive, scales with multiplier, crit and reactions', () => {
  const stats = characterStats('allen', 10);
  const base = { stats, attLv: 10, defLv: 10, mult: 1, kind: 'normal', element: 'wind', res: 0, roll: 0.99 };
  const a = damageToEnemy(base).amount;
  const b = damageToEnemy({ ...base, mult: 2 }).amount;
  const crit = damageToEnemy({ ...base, roll: 0 });
  const melt = damageToEnemy({ ...base, reactionMult: 2 }).amount;
  assert.ok(a > 0);
  assert.ok(Math.abs(b / a - 2) < 0.02);
  assert.ok(crit.crit && crit.amount > a);
  assert.ok(Math.abs(melt / a - 2) < 0.02);
  assert.ok(damageToEnemy({ ...base, res: 0.9 }).amount < a);
  assert.ok(damageToEnemy({ ...base, res: -0.4 }).amount > a);
});

test('character damage taken never goes below 1 and grows with enemy level', () => {
  const low = damageToCharacter({ enemyAtk: 60, enemyLv: 1, charLv: 90, charDef: 9999, mult: 0.01 });
  assert.equal(low, 1);
  const s = characterStats('gald', 30);
  const d1 = damageToCharacter({ enemyAtk: 60 * growth(30), enemyLv: 30, charLv: 30, charDef: s.def, mult: 1 });
  const d2 = damageToCharacter({ enemyAtk: 60 * growth(45), enemyLv: 45, charLv: 30, charDef: s.def, mult: 1 });
  assert.ok(d2 > d1);
  // A normal enemy hit at equal level takes a small slice of HP, not a one-shot.
  assert.ok(d1 / s.maxHp < 0.15, `ratio ${d1 / s.maxHp}`);
});

test('buffs and passives change stats', () => {
  const base = characterStats('seres', 20);
  const buffed = characterStats('seres', 20, [{ stat: 'atkPct', value: 0.2 }]);
  assert.ok(buffed.atk > base.atk);
  assert.ok(base.skillDmg >= 0.3, 'exclusive weapon passive applied');
  const orca = characterStats('orca', 50, [], false), orcaS = characterStats('orca', 50, [], true);
  assert.ok(orcaS.atk > orca.atk, 'shield attack bonus');
});

test('elemental reactions resolve and consume the aura', () => {
  assert.equal(findReaction('fire', 'ice').name, '融解');
  assert.equal(findReaction('water', 'thunder').name, '感電');
  assert.equal(findReaction('wind', 'fire').name, '拡散');
  assert.equal(findReaction('light', 'dark').name, '対消滅');
  assert.equal(findReaction('fire', 'fire'), null);
  assert.deepEqual(resolveElement('fire', 'ice').aura, null);
  assert.equal(resolveElement('water', null).aura, 'water');
  assert.equal(resolveElement('wind', null).aura, null, 'wind leaves no aura');
});

test('experience and levelling', () => {
  const e = { lv: 1, exp: 0 };
  const gained = addExp(e, expToNext(1) + expToNext(2) + 5);
  assert.equal(gained, 2);
  assert.equal(e.lv, 3);
  assert.equal(e.exp, 5);
  const capped = { lv: MAX_LEVEL - 1, exp: 0 };
  addExp(capped, 1e12);
  assert.equal(capped.lv, MAX_LEVEL);
  assert.equal(capped.exp, 0);
  assert.ok(enemyExp(10, 10) > enemyExp(10, 30), 'over-levelled gets less');
  assert.ok(enemyExp(10, 10, 'boss') > enemyExp(10, 10, 'elite'));
  assert.equal(recruitLevel(25, [10, 12, 14, 16]), 25);
  assert.equal(recruitLevel(5, [40, 40, 40, 40]), 40);
});

// Simulated progression: a party that only fights its realm's enemies keeps pace with the realm levels.
test('progression keeps the party near each realm level', () => {
  const party = [{ lv: 1, exp: 0 }, { lv: 1, exp: 0 }, { lv: 1, exp: 0 }, { lv: 1, exp: 0 }];
  const rand = mulberry32(7);
  for (const r of REALMS) {
    for (const ch of CHAPTERS.filter((c) => c.realm === r.id)) {
      // ~25 normal kills, 2 elites and a boss per chapter, plus the chapter bonus.
      for (let i = 0; i < 25; i++) for (const m of party) addExp(m, enemyExp(ch.level + Math.round(rand() * 4 - 2), m.lv));
      for (let i = 0; i < 2; i++) for (const m of party) addExp(m, enemyExp(ch.level + 2, m.lv, 'elite'));
      for (const m of party) addExp(m, enemyExp(ch.level + 3, m.lv, 'boss'));
      for (const m of party) addExp(m, expToNext(Math.min(ch.level, 89)) * 2);
    }
    const lv = party[0].lv;
    assert.ok(lv >= r.levels[0] - 6, `${r.id}: party level ${lv} too far below ${r.levels[0]}`);
  }
});

// ------------------------------------------------------------------ save
test('new save: five owned, plains open, chapter 1 available', () => {
  const s = newSave();
  assert.equal(s.v, SAVE_VERSION);
  assert.equal(Object.keys(s.roster).length, 5);
  assert.deepEqual(s.realms, ['plains']);
  assert.equal(s.story.plains1.status, 'available');
  assert.equal(s.story.plains2.status, 'locked');
  assert.equal(s.story.volcano1.status, 'locked');
});

test('finishing chapters unlocks the next chapter and realm', () => {
  const s = newSave();
  s.story.plains1.status = 'done';
  refreshAvailability(s);
  assert.equal(s.story.plains2.status, 'available');
  assert.ok(s.realms.includes('volcano'));
  assert.equal(s.story.volcano1.status, 'available');
  assert.equal(s.story.volcano2.status, 'locked');
});

test('migrates a v0 save and repairs broken data', () => {
  const v0 = { chars: { allen: { lv: 7, exp: 3 }, ghost: { lv: 1, exp: 0 } }, party: ['allen', 'ghost'], story: { plains1: { status: 'done', step: 6 } }, realms: ['plains', 'atlantis'], realm: 'atlantis', pos: [1, 2, 3] };
  const s = migrate(v0);
  assert.equal(s.v, SAVE_VERSION);
  assert.equal(s.roster.allen.lv, 7);
  assert.ok(!s.roster.ghost);
  assert.ok(s.roster.rina, 'missing starters restored');
  assert.deepEqual(s.party, ['allen']);
  assert.equal(s.realm, 'plains');
  assert.ok(s.realms.includes('volcano'), 'plains1 done unlocks volcano');
  assert.deepEqual(s.shards, {});
  assert.equal(migrate(null).v, SAVE_VERSION);
  assert.equal(migrate('garbage').v, SAVE_VERSION);
});

test('storage round trip and failure handling', () => {
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
  const s = newSave();
  s.potions = 9;
  assert.ok(writeTo(storage, s));
  assert.equal(loadFrom(storage).potions, 9);
  const broken = { getItem: () => '{not json', setItem: () => { throw new Error('quota'); } };
  assert.equal(loadFrom(broken), null);
  assert.equal(writeTo(broken, s), false);
  assert.equal(loadFrom(null), null);
});

test('explored mask encodes and decodes', () => {
  const bits = decodeExplored(null);
  bits[3] = 0b10100001;
  bits[511] = 255;
  const back = decodeExplored(encodeExplored(bits));
  assert.deepEqual([...back], [...bits]);
  assert.equal(decodeExplored('%%%')[0], 0);
});

// ------------------------------------------------------------------ terrain
test('terrain is deterministic and story places are walkable', () => {
  for (const r of REALMS) {
    const a = createTerrain(r), b = createTerrain(r);
    for (let i = 0; i < 20; i++) {
      const x = (i * 397) % 7000 - 3500, z = (i * 811) % 7000 - 3500;
      assert.equal(a.height(x, z), b.height(x, z));
      assert.ok(Number.isFinite(a.height(x, z)));
    }
    const hubH = a.height(r.hub.x, r.hub.z);
    if (r.water) assert.ok(hubH > r.water.level + 1, `${r.id} hub above water`);
    if (r.lava) assert.ok(hubH > r.lava.level + 3, `${r.id} hub above lava`);
    if (r.cloudSea !== undefined) {
      for (const ch of CHAPTERS.filter((c) => c.realm === r.id)) for (const s of ch.steps) {
        const pts = s.type === 'collect' ? s.points : s.type === 'talk' ? [[s.npc.x, s.npc.z]] : s.x !== undefined ? [[s.x, s.z]] : [];
        for (const [x, z] of pts) assert.ok(a.height(x, z) > 5, `${ch.id} ${s.type} on an island (h=${a.height(x, z).toFixed(1)})`);
      }
      for (const w of r.warps) assert.ok(a.height(w[0], w[1]) > 5, `heaven warp ${w[2]} on an island`);
    }
    if (r.lava) for (const ch of CHAPTERS.filter((c) => c.realm === r.id)) for (const s of ch.steps) {
      if (s.x === undefined) continue;
      assert.ok(a.height(s.x, s.z) > r.lava.level + 3, `${ch.id} ${s.type} above lava`);
    }
    if (r.water) for (const ch of CHAPTERS.filter((c) => c.realm === r.id)) for (const s of ch.steps) {
      if (s.x === undefined) continue;
      assert.ok(a.height(s.x, s.z) > r.water.level, `${ch.id} ${s.type} above water`);
    }
  }
});

test('realm lookups', () => {
  assert.equal(REALM_BY_ID.sea.mode, 'underwater');
  assert.ok(REALM_BY_ID.space.gravity < 1);
});
