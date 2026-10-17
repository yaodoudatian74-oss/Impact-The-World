// The six realms. Pure data; terrain shapes live in world/terrain.js keyed by id.
// Each realm is a square world WORLD_HALF*2 units wide (about 8 km).

export const WORLD_HALF = 4096;
export const CHUNK = 128;

export const REALMS = [
  {
    id: 'plains', name: 'エメラルド平原', short: '平原', color: '#8fe07a', seed: 1101, levels: [1, 15], gravity: 1, mode: 'ground',
    desc: 'どこまでも続く緑の大地。風車の村、森、湖、古代遺跡が点在する始まりの地。',
    sky: { top: '#3d82d6', horizon: '#cfe7f6', bottom: '#a8cbe0', sun: '#fff4c8' },
    fog: { color: '#c6deef', near: 380, far: 2700 },
    light: { sun: '#fff1d6', sunI: 2.4, hemiSky: '#d6ecff', hemiGround: '#6b8a45', hemiI: 1.25, dir: [0.45, 0.85, 0.3] },
    water: { level: 0, color: '#2f8fd0', deep: '#14507e', opacity: 0.78 },
    particles: { type: 'pollen', color: '#fff7c0', count: 260 },
    enemies: ['slime_water', 'slime_wind', 'wolf', 'goblin', 'rock_golem'],
    hub: { x: 0, z: 0, name: '風見の村', style: 'village' },
    warps: [
      [0, 40, '風見の村'], [900, -330, '東の街道'], [2230, -1240, '光の遺跡'], [-1150, 880, '翠の森'],
      [-2700, 2430, '風の丘'], [-2420, -2480, '世界樹'], [2880, 2420, '古城跡'], [3200, -3100, '東の果て'],
    ],
    landmarks: [
      { type: 'ruins', x: 2300, z: -1300, s: 1.3, name: '光の遺跡' },
      { type: 'stonecircle', x: -2800, z: 2500, s: 1.2, name: '風の丘' },
      { type: 'worldtree', x: -2500, z: -2600, s: 1, name: '世界樹' },
      { type: 'castle', x: 3000, z: 2500, s: 1, name: '古城跡' },
      { type: 'windmill', x: 420, z: 520, s: 1, name: '大風車' },
    ],
    unlockedBy: null,
    bgm: { root: 62, scale: [0, 2, 4, 7, 9], tempo: 96 },
  },
  {
    id: 'volcano', name: 'ヴォルカニア火山', short: '火山', color: '#ff7a4a', seed: 2203, levels: [15, 30], gravity: 1, mode: 'ground',
    desc: '大地が燃える灼熱の火山地帯。溶岩の川が流れ、空は灰に覆われている。溶岩に触れると大ダメージ。',
    sky: { top: '#3a1410', horizon: '#c0582a', bottom: '#5a2418', sun: '#ffb070' },
    fog: { color: '#8a4a32', near: 200, far: 1900 },
    light: { sun: '#ffc79a', sunI: 2.0, hemiSky: '#ff9a6a', hemiGround: '#3a1a12', hemiI: 1.0, dir: [-0.3, 0.7, 0.5] },
    lava: { level: 0, color: '#ff5a10' },
    particles: { type: 'embers', color: '#ff8a3a', count: 320 },
    enemies: ['slime_fire', 'salamander', 'fire_imp', 'magma_golem'],
    hub: { x: 0, z: 2000, name: '炎鉄の砦', style: 'fort' },
    volcanoes: [
      { x: 0, z: -1500, r: 1400, h: 620, crater: 0.13 },
      { x: 2600, z: 1500, r: 700, h: 300, crater: 0.15 },
      { x: -2800, z: -400, r: 800, h: 360, crater: 0.15 },
    ],
    warps: [
      [0, 2050, '炎鉄の砦'], [800, 1230, '溶岩の川'], [2140, -280, '溶岩の大窯'], [-1180, 1030, '宝石の洞'],
      [-1580, 440, '黒曜の崖'], [300, -620, '火口への道'], [-3000, 2900, '灰の荒野'], [3100, -2800, '焦熱の果て'],
    ],
    landmarks: [
      { type: 'forge', x: 2200, z: -300, s: 1.2, name: '溶岩の大窯' },
      { type: 'crystalcave', x: -1200, z: 1000, s: 1, name: '宝石の洞' },
      { type: 'obelisk', x: -1600, z: 400, s: 1.2, name: '黒曜の崖' },
    ],
    unlockedBy: 'plains1',
    bgm: { root: 57, scale: [0, 1, 4, 5, 7, 8, 10], tempo: 112 },
  },
  {
    id: 'ice', name: 'フロストピーク', short: '氷山', color: '#a8e6ff', seed: 3307, levels: [30, 45], gravity: 1, mode: 'ground',
    desc: '万年雪に閉ざされた氷の山脈。凍った湖の上を歩き、吹雪の向こうの氷の塔を目指せ。',
    sky: { top: '#6f8fb8', horizon: '#e4eef8', bottom: '#c9d8e8', sun: '#ffffff' },
    fog: { color: '#dbe6f2', near: 220, far: 2000 },
    light: { sun: '#f2f7ff', sunI: 2.2, hemiSky: '#e8f2ff', hemiGround: '#8aa0b8', hemiI: 1.3, dir: [0.3, 0.6, -0.5] },
    ice: { level: 0 },
    particles: { type: 'snow', color: '#ffffff', count: 520 },
    enemies: ['slime_ice', 'snow_wolf', 'yeti', 'frost_spirit'],
    hub: { x: 0, z: 0, name: '白霜の里', style: 'snow' },
    warps: [
      [0, 40, '白霜の里'], [1000, 840, '凍てつく湖'], [2330, 2160, '氷晶の谷'], [-900, -960, '吹雪の峠'],
      [-2540, -2560, '氷の塔'], [2600, -2400, '氷河の大地'], [-2800, 2600, '静寂の雪原'], [3300, 400, '極北の崖'],
    ],
    landmarks: [
      { type: 'icespire', x: 2400, z: 2200, s: 1.2, name: '氷晶の谷' },
      { type: 'icetower', x: -2600, z: -2600, s: 1, name: '氷の塔' },
      { type: 'shrine', x: 1000, z: 800, s: 1, name: '湖の祠' },
    ],
    unlockedBy: 'volcano1',
    bgm: { root: 64, scale: [0, 2, 3, 7, 8], tempo: 78 },
  },
  {
    id: 'sea', name: 'アトランティア海底', short: '海底', color: '#3fd8e8', seed: 4409, levels: [45, 60], gravity: 0.25, mode: 'underwater',
    desc: '光の差し込む深い海の底。珊瑚の森と沈没船、海底都市が眠る。自由に泳いで探索しよう。',
    sky: { top: '#2a8ab8', horizon: '#0d4a72', bottom: '#041a2e', sun: '#bff4ff' },
    fog: { color: '#0d5a80', near: 30, far: 520 },
    light: { sun: '#bff0ff', sunI: 1.8, hemiSky: '#6fd0f0', hemiGround: '#0a2a40', hemiI: 1.4, dir: [0.1, 1, 0.2] },
    surface: 70,
    particles: { type: 'bubbles', color: '#c8f4ff', count: 360 },
    enemies: ['jellyfish', 'shark', 'fishman', 'sea_turtle'],
    hub: { x: 0, z: 0, name: '海底都市アトランティア', style: 'atlantis' },
    warps: [
      [0, 50, 'アトランティア'], [1200, -560, '珊瑚の森'], [2620, -2040, '深淵の裂け目'], [-1260, 700, '沈没船'],
      [-2620, 2340, '深海の神殿'], [2400, 2600, '真珠の浅瀬'], [-2800, -2600, '海溝の底'], [3200, 200, '鯨の墓場'],
    ],
    landmarks: [
      { type: 'shipwreck', x: -1300, z: 700, s: 1.2, name: '沈没船' },
      { type: 'seatemple', x: -2700, z: 2400, s: 1.1, name: '深海の神殿' },
      { type: 'giantcoral', x: 1200, z: -600, s: 1.3, name: '珊瑚の森' },
      { type: 'bones', x: 3200, z: 200, s: 1.2, name: '鯨の墓場' },
    ],
    unlockedBy: 'ice1',
    bgm: { root: 60, scale: [0, 2, 4, 6, 7, 9, 11], tempo: 70 },
  },
  {
    id: 'heaven', name: 'セレスティア天界', short: '天界', color: '#ffe08a', seed: 5501, levels: [60, 75], gravity: 1, mode: 'sky',
    desc: '雲海に浮かぶ島々の世界。光の柱の上昇気流に乗り、翼で島から島へ渡ろう。雲海に落ちると島に戻される。',
    sky: { top: '#3f86e6', horizon: '#dfeaf8', bottom: '#f4f0ff', sun: '#fff4c8' },
    fog: { color: '#d8e4f4', near: 450, far: 3100 },
    light: { sun: '#fff2d8', sunI: 2.0, hemiSky: '#eef4ff', hemiGround: '#b8a888', hemiI: 1.05, dir: [0.4, 0.9, 0.2] },
    cloudSea: -60,
    particles: { type: 'motes', color: '#fff3b0', count: 260 },
    enemies: ['angel_soldier', 'light_spirit', 'fallen_angel', 'sky_golem'],
    hub: { x: 0, z: 0, name: '天空神殿', style: 'temple' },
    warps: [
      [0, 50, '天空神殿'], [900, 740, '雲の回廊'], [2540, 2440, '堕ちた聖堂'], [-1000, -760, '虹の泉'],
      [-2620, -2540, '天空の玉座'], [2600, -2200, '黄金の庭'], [-2600, 2400, '風鳴りの島'], [0, 3200, '光の果て'],
    ],
    landmarks: [
      { type: 'cathedral', x: 2600, z: 2500, s: 1.1, name: '堕ちた聖堂' },
      { type: 'throne', x: -2700, z: -2600, s: 1.2, name: '天空の玉座' },
      { type: 'fountain', x: -1000, z: -800, s: 1, name: '虹の泉' },
      { type: 'goldtree', x: 2600, z: -2200, s: 1.2, name: '黄金の庭' },
    ],
    unlockedBy: 'sea1',
    bgm: { root: 67, scale: [0, 2, 4, 5, 7, 9, 11], tempo: 84 },
  },
  {
    id: 'space', name: 'コスモス宇宙', short: '宇宙', color: '#b48aff', seed: 6607, levels: [75, 90], gravity: 0.35, mode: 'ground',
    desc: '星の海に浮かぶ月面の世界。重力が弱く、大きく跳べる。巨大な惑星が空を覆う最後の地。',
    sky: { top: '#020208', horizon: '#120c2a', bottom: '#05030c', sun: '#ffffff' },
    fog: { color: '#0b0820', near: 700, far: 3400 },
    light: { sun: '#e8ecff', sunI: 2.6, hemiSky: '#8a7aff', hemiGround: '#20183a', hemiI: 0.9, dir: [-0.5, 0.6, 0.4] },
    particles: { type: 'stardust', color: '#bcd0ff', count: 300 },
    enemies: ['alien', 'mech_drone', 'star_golem', 'void_wraith'],
    hub: { x: 0, z: 0, name: '星の観測所', style: 'station' },
    warps: [
      [0, 50, '星の観測所'], [1200, 1040, '隕石平原'], [2740, 2560, '星喰らいの巣'], [-1200, -960, '虚無の門'],
      [-2940, -2940, '虚無の玉座'], [2600, -2600, '水晶の荒野'], [-2600, 2600, '古代宇宙船'], [3300, 0, '銀河の縁'],
    ],
    landmarks: [
      { type: 'nest', x: 2800, z: 2600, s: 1.2, name: '星喰らいの巣' },
      { type: 'voidgate', x: -1200, z: -1000, s: 1.1, name: '虚無の門' },
      { type: 'voidthrone', x: -3000, z: -3000, s: 1.3, name: '虚無の玉座' },
      { type: 'spaceship', x: -2600, z: 2600, s: 1.2, name: '古代宇宙船' },
    ],
    unlockedBy: 'heaven1',
    bgm: { root: 55, scale: [0, 3, 5, 7, 10], tempo: 66 },
  },
];

export const REALM_BY_ID = Object.fromEntries(REALMS.map((r) => [r.id, r]));

// Enemy level for a spot: grows with distance from the realm's hub.
export function enemyLevelAt(realm, x, z) {
  const [lo, hi] = realm.levels;
  const d = Math.hypot(x - realm.hub.x, z - realm.hub.z);
  const t = Math.min(1, d / 3600);
  return Math.round(lo + (hi - lo) * t);
}
