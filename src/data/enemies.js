// Enemy definitions. Pure data. Stats are level-1 values and grow with level.
//
// model archetypes (world/models.js): slime, beast, humanoid, golem, spirit, jelly, fish,
//   dragon, serpent, kraken, drone
// attacks (game/enemies.js): melee, hop, shoot, slam, charge, ring, breath, summon, meteor, laser
// `float` makes the enemy hover that many units above the ground.

export const ENEMIES = {
  // ---- 平原 ----
  slime_water: { name: 'ウォータースライム', model: 'slime', color: '#4fa8ff', element: 'water', hp: 300, atk: 60, speed: 3.6, size: 1.1, attacks: ['hop'] },
  slime_wind: { name: 'ウィンドスライム', model: 'slime', color: '#72f0c2', element: 'wind', hp: 280, atk: 60, speed: 4.2, size: 1.0, attacks: ['hop'] },
  wolf: { name: '草原オオカミ', model: 'beast', color: '#8a8f99', color2: '#d9d4c8', hp: 420, atk: 72, speed: 7.5, size: 1.1, attacks: ['melee', 'charge'] },
  goblin: { name: 'ゴブリン弓兵', model: 'humanoid', color: '#6f9a3c', color2: '#7a5a3a', hp: 380, atk: 66, speed: 4.2, size: 0.8, attacks: ['shoot'], keepAway: 12, weapon: 'bow' },
  rock_golem: { name: '岩ゴーレム', model: 'golem', color: '#8f8577', color2: '#e0b04a', element: 'earth', hp: 1400, atk: 90, speed: 2.6, size: 1.6, attacks: ['melee', 'slam'], elite: true },
  boss_king_slime: { name: 'キングスライム', model: 'slime', color: '#3f8cff', element: 'water', hp: 4200, atk: 85, speed: 4, size: 5.5, attacks: ['hop', 'slam', 'summon', 'ring'], summon: 'slime_water', boss: true, crown: true },
  boss_griffin: { name: '暴風のグリフォン', model: 'dragon', color: '#c9a66b', color2: '#f5f0e6', element: 'wind', hp: 5000, atk: 95, speed: 9, size: 3.2, attacks: ['charge', 'breath', 'slam', 'ring'], boss: true, float: 3, beak: true },

  // ---- 火山 ----
  slime_fire: { name: 'フレイムスライム', model: 'slime', color: '#ff6a2a', element: 'fire', hp: 320, atk: 64, speed: 3.8, size: 1.1, attacks: ['hop'] },
  salamander: { name: 'サラマンダー', model: 'beast', color: '#c23a1a', color2: '#ffb347', element: 'fire', hp: 460, atk: 74, speed: 5, size: 1.0, attacks: ['shoot', 'melee'], lizard: true },
  fire_imp: { name: 'ファイアインプ', model: 'spirit', color: '#ff7a2a', color2: '#ffd36a', element: 'fire', hp: 340, atk: 70, speed: 5.5, size: 0.9, attacks: ['shoot', 'ring'], float: 2.5, keepAway: 10 },
  magma_golem: { name: 'マグマゴーレム', model: 'golem', color: '#3a2a26', color2: '#ff6a2a', element: 'fire', hp: 1500, atk: 95, speed: 2.6, size: 1.7, attacks: ['melee', 'slam'], elite: true },
  boss_magma_lord: { name: '溶岩巨人マグマロード', model: 'golem', color: '#2b1d1a', color2: '#ff5a1a', element: 'fire', hp: 5500, atk: 100, speed: 3.2, size: 5, attacks: ['melee', 'slam', 'meteor', 'ring'], boss: true },
  boss_crimson_dragon: { name: '紅蓮竜ヴォルガノス', model: 'dragon', color: '#a01c1c', color2: '#ffb347', element: 'fire', hp: 6000, atk: 108, speed: 8, size: 4, attacks: ['breath', 'charge', 'meteor', 'slam'], boss: true, float: 4 },

  // ---- 氷山 ----
  slime_ice: { name: 'フロストスライム', model: 'slime', color: '#a8ecff', element: 'ice', hp: 330, atk: 64, speed: 3.6, size: 1.1, attacks: ['hop'] },
  snow_wolf: { name: '雪狼', model: 'beast', color: '#e8f0f8', color2: '#8fb3d9', element: 'ice', hp: 480, atk: 76, speed: 8, size: 1.15, attacks: ['melee', 'charge'] },
  yeti: { name: 'イエティ', model: 'humanoid', color: '#f0f4fa', color2: '#7aa0c8', element: 'ice', hp: 900, atk: 90, speed: 3.6, size: 1.6, attacks: ['melee', 'slam'], bulky: true, elite: true },
  frost_spirit: { name: '氷の精霊', model: 'spirit', color: '#8ee8ff', color2: '#ffffff', element: 'ice', hp: 360, atk: 70, speed: 4.5, size: 1.0, attacks: ['shoot', 'ring'], float: 2.5, keepAway: 11 },
  boss_ice_giant: { name: '氷晶の巨人', model: 'golem', color: '#9fd8f5', color2: '#ffffff', element: 'ice', hp: 6000, atk: 104, speed: 3, size: 5.2, attacks: ['melee', 'slam', 'meteor', 'ring'], boss: true },
  boss_frost_dragon: { name: '氷竜グラシエス', model: 'dragon', color: '#bfe8ff', color2: '#4a7ab0', element: 'ice', hp: 6500, atk: 112, speed: 8, size: 4.2, attacks: ['breath', 'charge', 'ring', 'meteor'], boss: true, float: 4 },

  // ---- 海底 ----
  jellyfish: { name: 'エレキクラゲ', model: 'jelly', color: '#c48bff', color2: '#ffffff', element: 'thunder', hp: 360, atk: 68, speed: 3, size: 1.2, attacks: ['ring', 'melee'], float: 3 },
  shark: { name: '牙鮫', model: 'fish', color: '#5a7a96', color2: '#e8eef2', hp: 520, atk: 80, speed: 8.5, size: 1.6, attacks: ['charge', 'melee'], float: 2.5 },
  fishman: { name: '魚人兵', model: 'humanoid', color: '#3f9f8a', color2: '#e9d8a6', element: 'water', hp: 520, atk: 76, speed: 4.5, size: 1.0, attacks: ['melee', 'shoot'], weapon: 'spear', fin: true },
  sea_turtle: { name: '岩甲ガメ', model: 'golem', color: '#4a6a4a', color2: '#c9b26b', element: 'earth', hp: 1600, atk: 92, speed: 2.4, size: 1.6, attacks: ['slam', 'melee'], elite: true },
  boss_leviathan: { name: '大海蛇リヴァイア', model: 'serpent', color: '#1f6f8f', color2: '#9ff2e0', element: 'water', hp: 6500, atk: 110, speed: 9, size: 3.2, attacks: ['charge', 'breath', 'ring', 'laser'], boss: true, float: 5 },
  boss_kraken: { name: 'クラーケン', model: 'kraken', color: '#7a2a5a', color2: '#ffb0d0', element: 'thunder', hp: 7000, atk: 116, speed: 4, size: 4.5, attacks: ['slam', 'ring', 'summon', 'laser'], summon: 'jellyfish', boss: true, float: 3 },

  // ---- 天界 ----
  angel_soldier: { name: '天使兵', model: 'humanoid', color: '#f5f2ff', color2: '#d6b25a', element: 'light', hp: 560, atk: 80, speed: 5, size: 1.0, attacks: ['melee', 'charge'], weapon: 'spear', wings: true },
  light_spirit: { name: '光の精霊', model: 'spirit', color: '#fff1a0', color2: '#ffffff', element: 'light', hp: 420, atk: 76, speed: 4.5, size: 1.0, attacks: ['shoot', 'laser'], float: 3, keepAway: 12 },
  fallen_angel: { name: '堕天使', model: 'humanoid', color: '#2a2036', color2: '#a35cff', element: 'dark', hp: 620, atk: 84, speed: 5.5, size: 1.05, attacks: ['melee', 'shoot'], weapon: 'sword', wings: true },
  sky_golem: { name: '天空の守護像', model: 'golem', color: '#f0ece0', color2: '#ffe08a', element: 'light', hp: 1800, atk: 98, speed: 2.4, size: 1.8, attacks: ['slam', 'laser'], elite: true },
  boss_fallen_archangel: { name: '堕天使長ルシエル', model: 'humanoid', color: '#1c1428', color2: '#a35cff', element: 'dark', hp: 7000, atk: 118, speed: 7, size: 3.2, attacks: ['melee', 'charge', 'meteor', 'ring', 'laser'], weapon: 'sword', wings: true, boss: true, float: 1 },
  boss_seraph_dragon: { name: '天空竜セラフィム', model: 'dragon', color: '#fff8e0', color2: '#ffd36a', element: 'light', hp: 7500, atk: 122, speed: 9, size: 4.4, attacks: ['breath', 'laser', 'meteor', 'charge'], boss: true, float: 5 },

  // ---- 宇宙 ----
  alien: { name: 'グレイ星人', model: 'humanoid', color: '#9fb0a8', color2: '#40ffd0', element: 'thunder', hp: 620, atk: 84, speed: 5, size: 0.9, attacks: ['melee', 'shoot'], alien: true },
  mech_drone: { name: '機械ドローン', model: 'drone', color: '#b8c0cc', color2: '#ff3a5a', hp: 520, atk: 82, speed: 5.5, size: 1.0, attacks: ['shoot', 'laser'], float: 3, keepAway: 13 },
  star_golem: { name: '星屑ゴーレム', model: 'golem', color: '#3a3f6a', color2: '#9fb8ff', element: 'earth', hp: 2000, atk: 102, speed: 2.6, size: 1.8, attacks: ['slam', 'melee', 'meteor'], elite: true },
  void_wraith: { name: '虚無の亡霊', model: 'spirit', color: '#3a1458', color2: '#c58bff', element: 'dark', hp: 560, atk: 86, speed: 5, size: 1.1, attacks: ['shoot', 'ring'], float: 2.5, keepAway: 10 },
  boss_star_devourer: { name: '星喰らいの魔獣', model: 'beast', color: '#1c1f3a', color2: '#ff6ad5', element: 'dark', hp: 8000, atk: 126, speed: 8, size: 4.5, attacks: ['charge', 'slam', 'breath', 'meteor'], boss: true },
  boss_void_king: { name: '虚無の王ゼロ', model: 'humanoid', color: '#0a0612', color2: '#ff3a8a', element: 'dark', hp: 9500, atk: 132, speed: 7, size: 4, attacks: ['melee', 'meteor', 'laser', 'ring', 'summon', 'charge'], summon: 'void_wraith', weapon: 'greatsword', boss: true, crown: true, float: 1.5 },
};

export const ENEMY_IDS = Object.keys(ENEMIES);
