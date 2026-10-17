// Elements and their reactions. Pure data.

export const ELEMENTS = {
  fire: { name: '火', color: '#ff5a36', aura: true },
  water: { name: '水', color: '#3fa9ff', aura: true },
  thunder: { name: '雷', color: '#b26bff', aura: true },
  ice: { name: '氷', color: '#8ee8ff', aura: true },
  wind: { name: '風', color: '#5ef2c0', aura: false },
  earth: { name: '岩', color: '#e0b04a', aura: false },
  light: { name: '光', color: '#fff1a0', aura: true },
  dark: { name: '闇', color: '#a35cff', aura: true },
};

export const ELEMENT_IDS = Object.keys(ELEMENTS);

export const WEAPON_TYPES = {
  sword: { name: '片手剣' },
  greatsword: { name: '両手剣' },
  spear: { name: '長柄武器' },
  bow: { name: '弓' },
  catalyst: { name: '法器' },
};

// Reaction rules, keyed "incoming>aura". `mult` scales the triggering hit.
// `effect` names a side effect the combat system applies.
export const REACTIONS = {
  'fire>ice': { name: '融解', mult: 2.0 },
  'ice>fire': { name: '融解', mult: 1.5 },
  'water>fire': { name: '蒸発', mult: 2.0 },
  'fire>water': { name: '蒸発', mult: 1.5 },
  'thunder>fire': { name: '過負荷', mult: 1.2, effect: 'overload' },
  'fire>thunder': { name: '過負荷', mult: 1.2, effect: 'overload' },
  'thunder>water': { name: '感電', mult: 1.2, effect: 'electro' },
  'water>thunder': { name: '感電', mult: 1.2, effect: 'electro' },
  'thunder>ice': { name: '超電導', mult: 1.25, effect: 'superconduct' },
  'ice>thunder': { name: '超電導', mult: 1.25, effect: 'superconduct' },
  'water>ice': { name: '凍結', mult: 1.1, effect: 'freeze' },
  'ice>water': { name: '凍結', mult: 1.1, effect: 'freeze' },
  'light>dark': { name: '対消滅', mult: 2.5 },
  'dark>light': { name: '対消滅', mult: 2.5 },
};

// Wind, earth, light and dark react with any of the four basic auras.
const BASIC = ['fire', 'water', 'thunder', 'ice'];
for (const a of BASIC) {
  REACTIONS[`wind>${a}`] = { name: '拡散', mult: 1.2, effect: 'swirl' };
  REACTIONS[`earth>${a}`] = { name: '結晶', mult: 1.15, effect: 'crystallize' };
  REACTIONS[`light>${a}`] = { name: '輝光', mult: 1.4, effect: 'radiance' };
  REACTIONS[`dark>${a}`] = { name: '侵蝕', mult: 1.4, effect: 'corrode' };
}

export function findReaction(incoming, aura) {
  if (!incoming || !aura || incoming === aura) return null;
  return REACTIONS[`${incoming}>${aura}`] || null;
}
