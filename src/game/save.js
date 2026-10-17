// Save data: creation, versioned migration, storage. Pure apart from the storage handle passed in.

import { STARTER_IDS, CHARACTERS } from '../data/characters.js';
import { CHAPTERS } from '../data/stories.js';
import { REALMS, REALM_BY_ID } from '../data/realms.js';

export const SAVE_VERSION = 2;
export const SAVE_KEY = 'impact-the-world-save';

export function newSave() {
  const roster = {};
  for (const id of STARTER_IDS) roster[id] = { lv: 1, exp: 0 };
  const story = {};
  for (const ch of CHAPTERS) story[ch.id] = { status: 'locked', step: 0 };
  const save = {
    v: SAVE_VERSION,
    roster,
    party: STARTER_IDS.slice(0, 4),
    story,
    tracked: 'plains1',
    realms: ['plains'],
    warps: {},
    chests: {},
    shards: {},
    explored: {},
    realm: 'plains',
    pos: [4, 0, 22],
    potions: 3,
    staminaMax: 100,
    settings: { quality: 'auto', sens: 1, sfx: true, bgm: true },
    playTime: 0,
    cleared: false,
  };
  refreshAvailability(save);
  return save;
}

// Chapters become available when their realm is open and their prerequisite is done.
export function refreshAvailability(save) {
  for (const ch of CHAPTERS) {
    const st = save.story[ch.id];
    if (st.status !== 'locked') continue;
    const realmOpen = save.realms.includes(ch.realm);
    const reqDone = !ch.requires || save.story[ch.requires]?.status === 'done';
    if (realmOpen && reqDone) st.status = 'available';
  }
  for (const r of REALMS) {
    if (r.unlockedBy && save.story[r.unlockedBy]?.status === 'done' && !save.realms.includes(r.id)) save.realms.push(r.id);
  }
  // A second pass picks up chapters in realms that were just unlocked.
  for (const ch of CHAPTERS) {
    const st = save.story[ch.id];
    if (st.status === 'locked' && save.realms.includes(ch.realm) && (!ch.requires || save.story[ch.requires]?.status === 'done')) st.status = 'available';
  }
}

// Brings any older save up to the current version. Unknown or broken data yields a fresh save.
export function migrate(data) {
  if (!data || typeof data !== 'object') return newSave();
  const save = structuredCloneSafe(data);
  const v = typeof save.v === 'number' ? save.v : 0;
  if (v < 1) {
    // v0: no version field, `chars` instead of `roster`, no shards/explored.
    if (save.chars && !save.roster) save.roster = save.chars;
    delete save.chars;
  }
  if (v < 2) {
    save.shards = save.shards || {};
    save.explored = save.explored || {};
    save.staminaMax = save.staminaMax || 100;
  }
  const fresh = newSave();
  for (const k of Object.keys(fresh)) if (save[k] === undefined) save[k] = fresh[k];
  // Repair references to content that no longer exists.
  for (const id of Object.keys(save.roster)) if (!CHARACTERS[id]) delete save.roster[id];
  for (const id of STARTER_IDS) if (!save.roster[id]) save.roster[id] = { lv: 1, exp: 0 };
  save.party = (save.party || []).filter((id) => save.roster[id]).slice(0, 4);
  if (save.party.length === 0) save.party = STARTER_IDS.slice(0, 4);
  for (const ch of CHAPTERS) if (!save.story[ch.id]) save.story[ch.id] = { status: 'locked', step: 0 };
  save.realms = save.realms.filter((r) => REALM_BY_ID[r]);
  if (!save.realms.includes('plains')) save.realms.unshift('plains');
  if (!REALM_BY_ID[save.realm] || !save.realms.includes(save.realm)) { save.realm = 'plains'; save.pos = [4, 0, 22]; }
  save.settings = { ...fresh.settings, ...save.settings };
  save.v = SAVE_VERSION;
  refreshAvailability(save);
  return save;
}

function structuredCloneSafe(o) {
  return JSON.parse(JSON.stringify(o));
}

export function loadFrom(storage) {
  try {
    const raw = storage?.getItem(SAVE_KEY);
    if (!raw) return null;
    return migrate(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeTo(storage, save) {
  try {
    storage?.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

export function clearFrom(storage) {
  try { storage?.removeItem(SAVE_KEY); } catch { /* storage unavailable */ }
}

// Explored map cells are a 64x64 bitmask per realm, stored as base64.
export const EXPLORE_GRID = 64;
export function decodeExplored(b64) {
  const bits = new Uint8Array((EXPLORE_GRID * EXPLORE_GRID) / 8);
  if (!b64) return bits;
  try {
    const bin = atob(b64);
    for (let i = 0; i < Math.min(bin.length, bits.length); i++) bits[i] = bin.charCodeAt(i);
  } catch { /* corrupt mask: start unexplored */ }
  return bits;
}
export function encodeExplored(bits) {
  let s = '';
  for (let i = 0; i < bits.length; i++) s += String.fromCharCode(bits[i]);
  return btoa(s);
}
