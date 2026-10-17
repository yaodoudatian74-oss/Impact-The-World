// Pure game rules: stat growth, damage, experience. No three.js, unit tested.

import { CHARACTERS, WEAPONS } from '../data/characters.js';
import { ENEMIES } from '../data/enemies.js';
import { ELEMENTS, findReaction } from '../data/elements.js';
import { clamp } from '../core/math.js';

export const MAX_LEVEL = 90;

export const growth = (lv) => 1 + (lv - 1) * 0.09;

export function expToNext(lv) {
  if (lv >= MAX_LEVEL) return Infinity;
  return Math.floor(40 + 12 * Math.pow(lv, 1.7));
}

// Experience granted by an enemy, reduced when the receiver out-levels it.
export function enemyExp(enemyLv, receiverLv, kind = 'normal') {
  const kindMult = kind === 'boss' ? 25 : kind === 'elite' ? 3 : 1;
  const base = expToNext(Math.min(enemyLv, MAX_LEVEL - 1)) / 5;
  const gap = receiverLv - enemyLv;
  const factor = gap > 0 ? clamp(1 - gap * 0.08, 0.1, 1) : 1;
  return Math.max(1, Math.round(base * kindMult * factor));
}

// Adds experience, returns the number of levels gained. Mutates `entry` {lv, exp}.
export function addExp(entry, amount) {
  let gained = 0;
  entry.exp += amount;
  while (entry.lv < MAX_LEVEL && entry.exp >= expToNext(entry.lv)) {
    entry.exp -= expToNext(entry.lv);
    entry.lv++;
    gained++;
  }
  if (entry.lv >= MAX_LEVEL) entry.exp = 0;
  return gained;
}

const STAT_KEYS = ['atkPct', 'hpPct', 'defPct', 'critRate', 'critDmg', 'er', 'elemDmg', 'normalDmg', 'skillDmg', 'burstDmg', 'healBonus', 'shieldBonus', 'cdr', 'moveSpeed', 'dmgPct', 'shieldAtk'];

// Full stat block for a character at a level, with optional active buffs [{stat, value}].
export function characterStats(id, lv, buffs = [], shielded = false) {
  const c = CHARACTERS[id];
  const w = WEAPONS[c.weaponId];
  const g = growth(lv);
  const mods = {};
  for (const k of STAT_KEYS) mods[k] = 0;
  for (const src of [w.sub, w.passive]) {
    for (const k of STAT_KEYS) if (typeof src[k] === 'number') mods[k] += src[k];
  }
  for (const b of buffs) if (b.stat in mods) mods[b.stat] += b.value;
  if (shielded) mods.atkPct += mods.shieldAtk;
  const baseAtk = c.base.atk * g + w.atk * g;
  return {
    maxHp: Math.round(c.base.hp * g * (1 + mods.hpPct)),
    atk: Math.round(baseAtk * (1 + mods.atkPct)),
    def: Math.round(c.base.def * g * (1 + mods.defPct)),
    critRate: clamp(0.05 + mods.critRate, 0, 1),
    critDmg: 0.5 + mods.critDmg,
    er: 1 + mods.er,
    elemDmg: mods.elemDmg,
    normalDmg: mods.normalDmg,
    skillDmg: mods.skillDmg,
    burstDmg: mods.burstDmg,
    dmgPct: mods.dmgPct,
    healBonus: mods.healBonus,
    shieldBonus: mods.shieldBonus,
    cdr: clamp(mods.cdr, 0, 0.6),
    moveSpeed: mods.moveSpeed,
  };
}

export function enemyStats(id, lv) {
  const e = ENEMIES[id];
  const g = growth(lv);
  return { maxHp: Math.round(e.hp * g), atk: Math.round(e.atk * g) };
}

// Level gap scaling: 1.0 at equal level, smaller when the attacker is lower.
export function levelFactor(attLv, defLv) {
  return ((attLv + 100) / (attLv + 100 + defLv + 100)) * 2;
}

export function resistMult(res) {
  if (res >= 0) return 1 - Math.min(res, 0.9);
  return 1 - res / 2;
}

// Damage from a character hit on an enemy.
// kind: 'normal' | 'skill' | 'burst' | 'reaction'
export function damageToEnemy({ stats, attLv, defLv, mult, kind, element, res = 0, reactionMult = 1, roll }) {
  let bonus = stats.dmgPct + (element ? stats.elemDmg : 0);
  if (kind === 'normal') bonus += stats.normalDmg;
  else if (kind === 'skill') bonus += stats.skillDmg;
  else if (kind === 'burst') bonus += stats.burstDmg;
  const crit = kind !== 'reaction' && roll < stats.critRate;
  const amount = stats.atk * mult * (1 + bonus) * levelFactor(attLv, defLv) * resistMult(res) * reactionMult * (crit ? 1 + stats.critDmg : 1);
  return { amount: Math.max(1, Math.round(amount)), crit };
}

// Damage from an enemy hit on a character, before shields.
export function damageToCharacter({ enemyAtk, enemyLv, charLv, charDef, mult }) {
  const reduction = charDef / (charDef + 600 * growth(enemyLv));
  return Math.max(1, Math.round(enemyAtk * mult * levelFactor(enemyLv, charLv) * (1 - reduction)));
}

// Resolves an elemental hit against an aura. Returns the reaction (or null) and the aura left behind.
export function resolveElement(incoming, aura) {
  const reaction = findReaction(incoming, aura);
  if (reaction) return { reaction, aura: null };
  if (incoming && ELEMENTS[incoming]?.aura) return { reaction: null, aura: incoming };
  return { reaction: null, aura };
}

export function skillCooldown(base, stats) {
  return base * (1 - stats.cdr);
}

// Joining level for a recruited character: the chapter level or the party average, whichever is higher.
export function recruitLevel(chapterLevel, partyLevels) {
  const avg = partyLevels.length ? Math.round(partyLevels.reduce((a, b) => a + b, 0) / partyLevels.length) : 1;
  return clamp(Math.max(chapterLevel, avg), 1, MAX_LEVEL);
}
