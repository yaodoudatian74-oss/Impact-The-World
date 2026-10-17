// Playable characters and their weapons. Pure data.
//
// Skill templates (implemented in game/abilities.js):
//   spin     AOE around self, `hits` times
//   wave     piercing forward projectile
//   dash     dash forward, damaging along the path
//   rain     repeated AOE ticks at the target point
//   heal     heal the team, small AOE
//   shield   shield the active character, AOE slam
//   barrage  fan of (optionally homing) projectiles
//   meteor   delayed large impact at the target point
//   tornado  vortex that moves forward (or sits at the target) and pulls
//   beam     instant line damage
//   summon   turret that shoots nearby enemies
//   storm    random strikes around the character
//   blink    teleport to the target and slash
//   buff     team buff with a small AOE

export const STARTER_IDS = ['allen', 'rina', 'mio', 'gald', 'shizuku'];

export const CHARACTERS = {
  allen: {
    name: 'アレン', title: '風見の剣士', element: 'wind', weapon: 'sword', weaponId: 'w_allen',
    base: { hp: 1080, atk: 22, def: 62 },
    look: { skin: '#f2d1b3', hair: '#2f5b48', hairStyle: 'spiky', outfit: '#2c6e5e', outfit2: '#efe6cf', accent: '#7fe8c6', cape: '#1d4a40', height: 1.0, build: 1.0 },
    skill: { name: '旋風斬', type: 'spin', mult: 1.5, hits: 2, radius: 5.5, cd: 6, pull: 6, desc: '周囲を風の刃で2回斬りつけ、敵を引き寄せる。' },
    burst: { name: '大嵐の剣', type: 'tornado', mult: 0.6, ticks: 14, radius: 4.5, speed: 7, dur: 4.2, pull: 9, cost: 60, desc: '前方へ進む巨大な竜巻を放ち、敵を巻き込み続ける。' },
    profile: '風見の村の自警団で育った若き剣士。まっすぐな性格で、困っている人を放っておけない。星の核が砕けた夜、空に走る亀裂を見て旅立ちを決意した。',
  },
  rina: {
    name: 'リナ', title: '紅の射手', element: 'fire', weapon: 'bow', weaponId: 'w_rina',
    base: { hp: 920, atk: 24, def: 54 },
    look: { skin: '#f6d7bd', hair: '#c4372c', hairStyle: 'ponytail', outfit: '#7a2430', outfit2: '#f3c27a', accent: '#ffb05a', height: 0.95, build: 0.9 },
    skill: { name: '爆炎の連矢', type: 'barrage', mult: 0.9, count: 5, spread: 0.5, speed: 55, explode: 2.6, cd: 7, desc: '扇状に5本の炎の矢を放ち、着弾点で爆発させる。' },
    burst: { name: '紅蓮の矢雨', type: 'rain', mult: 0.95, ticks: 10, interval: 0.35, radius: 7, cost: 70, desc: '狙った地点に炎の矢を降らせ続ける。' },
    profile: '旅芸人一座で弓の曲芸を担当していた少女。明るく負けず嫌いで、一度狙った獲物は外さない。',
  },
  mio: {
    name: 'ミオ', title: '泉の癒し手', element: 'water', weapon: 'catalyst', weaponId: 'w_mio',
    base: { hp: 1150, atk: 18, def: 56 },
    look: { skin: '#f7dfca', hair: '#7fc4f0', hairStyle: 'long', outfit: '#3a6fb0', outfit2: '#f4f7ff', accent: '#a8e6ff', height: 0.92, build: 0.88, extra: 'hat' },
    skill: { name: '癒しの泉', type: 'heal', mult: 1.2, radius: 5, heal: 0.13, cd: 10, desc: '水の泉を湧かせてチーム全員のHPを回復し、周囲の敵に水ダメージを与える。' },
    burst: { name: '大海の慈雨', type: 'rain', mult: 0.7, ticks: 12, interval: 0.4, radius: 8, heal: 0.035, cost: 70, desc: '癒しの雨を降らせ、敵を打ちつつチーム全員を回復し続ける。' },
    profile: '湖畔の神殿で育った見習い神官。おっとりしているが芯は強く、仲間の怪我を見るとすぐ駆け寄る。',
  },
  gald: {
    name: 'ガルド', title: '岩鉄の守り手', element: 'earth', weapon: 'greatsword', weaponId: 'w_gald',
    base: { hp: 1250, atk: 23, def: 74 },
    look: { skin: '#d9a982', hair: '#5a3b22', hairStyle: 'short', outfit: '#6b5a3a', outfit2: '#b8a27a', accent: '#f0c060', height: 1.12, build: 1.3 },
    skill: { name: '岩盾の構え', type: 'shield', mult: 2.0, radius: 5, shield: 0.3, dur: 12, cd: 12, desc: '大剣を地面に叩きつけて周囲にダメージを与え、自身にシールドを張る。' },
    burst: { name: '大地崩壊', type: 'meteor', mult: 7.0, radius: 9, delay: 0.9, cost: 60, desc: '天から巨大な岩塊を落とし、広範囲を粉砕する。' },
    profile: '元・王国の重装兵。寡黙だが面倒見がよく、仲間からは「おやっさん」と呼ばれている。',
  },
  shizuku: {
    name: 'シズク', title: '雷鳴の槍士', element: 'thunder', weapon: 'spear', weaponId: 'w_shizuku',
    base: { hp: 980, atk: 24, def: 58 },
    look: { skin: '#f3d6c2', hair: '#2b2445', hairStyle: 'bob', outfit: '#3d2f66', outfit2: '#d8d0f0', accent: '#c48bff', height: 0.98, build: 0.92 },
    skill: { name: '雷閃', type: 'dash', mult: 2.2, dist: 12, radius: 2.5, cd: 5, desc: '雷をまとって前方へ突進し、通り道の敵を貫く。' },
    burst: { name: '天雷', type: 'storm', mult: 0.9, ticks: 18, interval: 0.3, radius: 10, cost: 70, desc: '周囲に落雷を呼び続ける。' },
    profile: '東の島国から来た槍の使い手。冷静沈着で無口だが、甘いものには目がない。',
  },

  // ---- Story recruits ----
  seres: {
    name: 'セレス', title: '黎明の聖騎士', element: 'light', weapon: 'sword', weaponId: 'w_seres',
    base: { hp: 1120, atk: 26, def: 66 },
    look: { skin: '#f8e0cc', hair: '#f3e3a3', hairStyle: 'long', outfit: '#e9e4d4', outfit2: '#c9a54a', accent: '#fff2a8', cape: '#3b4f9a', height: 1.02, build: 0.95 },
    skill: { name: '聖光斬', type: 'wave', mult: 2.7, speed: 40, range: 26, width: 3, cd: 6, desc: '光の斬撃を飛ばし、直線上の敵を全て切り裂く。' },
    burst: { name: '黎明の審判', type: 'beam', mult: 6.5, length: 32, width: 3.5, cost: 70, buff: { stat: 'atkPct', value: 0.2, dur: 12, team: true }, desc: '聖剣から光の奔流を放ち、チーム全体の攻撃力を12秒間20%上げる。' },
    profile: '千年前に聖剣と共に封印された聖騎士見習い。現代の世界に戸惑いながらも、再び剣を取る。',
  },
  kai: {
    name: 'カイ', title: '翠嵐の狩人', element: 'wind', weapon: 'bow', weaponId: 'w_kai',
    base: { hp: 960, atk: 25, def: 55 },
    look: { skin: '#e8c19c', hair: '#5f8d3a', hairStyle: 'short', outfit: '#3f6b2a', outfit2: '#c9b98a', accent: '#a6f07a', height: 1.0, build: 0.95, extra: 'hood' },
    skill: { name: '疾風の三矢', type: 'barrage', mult: 1.3, count: 3, spread: 0.25, speed: 60, homing: 3, cd: 6, desc: '敵を追尾する風の矢を3本放つ。' },
    burst: { name: '翠嵐の渦', type: 'tornado', mult: 0.55, ticks: 16, radius: 6, speed: 0, dur: 5, pull: 14, atTarget: true, cost: 60, desc: '狙った地点に巨大な風の渦を生み、敵を吸い寄せ続ける。' },
    profile: '翠の森に暮らす狩人の青年。風の声を聞く力を持ち、森の異変にいち早く気づいた。',
  },
  ignis: {
    name: 'イグニス', title: '紅蓮の剣鬼', element: 'fire', weapon: 'greatsword', weaponId: 'w_ignis',
    base: { hp: 1180, atk: 27, def: 64 },
    look: { skin: '#d7a17c', hair: '#ff6a2a', hairStyle: 'spiky', outfit: '#3a1d18', outfit2: '#b2422a', accent: '#ffb347', height: 1.1, build: 1.2, extra: 'horns' },
    skill: { name: '爆炎旋斬', type: 'spin', mult: 1.6, hits: 3, radius: 6, cd: 7, desc: '大剣を振り回し、炎の渦で周囲を3回斬る。' },
    burst: { name: '紅蓮天墜', type: 'meteor', mult: 8.5, radius: 10, delay: 1.0, cost: 70, desc: '炎をまとって跳躍し、大地へ叩きつける。' },
    profile: '炎鉄の砦の鍛冶見習い。熱くなると止まらない性格で、師匠の制止を振り切って火口へ向かった。',
  },
  rubia: {
    name: 'ルビア', title: '溶岩の宝石姫', element: 'earth', weapon: 'catalyst', weaponId: 'w_rubia',
    base: { hp: 1020, atk: 25, def: 62 },
    look: { skin: '#f4d2bf', hair: '#8e1f3c', hairStyle: 'twin', outfit: '#5a1f2c', outfit2: '#e6b84a', accent: '#ff7aa8', height: 0.9, build: 0.86 },
    skill: { name: '溶岩の守護石', type: 'summon', mult: 0.9, dur: 12, interval: 1.0, range: 18, cd: 12, desc: '溶岩の宝石を設置し、近くの敵を自動で攻撃させる。' },
    burst: { name: '宝珠流星群', type: 'rain', mult: 1.6, ticks: 8, interval: 0.45, radius: 8, cost: 70, desc: '宝石の流星を降らせ、狙った範囲を打ち砕く。' },
    profile: '火山の宝石商の一人娘。勝ち気で商売上手。奪われた家宝の宝珠を取り戻すため旅に加わる。',
  },
  yuki: {
    name: 'ユキ', title: '雪月花の巫女', element: 'ice', weapon: 'sword', weaponId: 'w_yuki',
    base: { hp: 1000, atk: 27, def: 58 },
    look: { skin: '#fbeee6', hair: '#e8f4ff', hairStyle: 'long', outfit: '#f2f5fb', outfit2: '#c43a4a', accent: '#bfefff', height: 0.96, build: 0.88 },
    skill: { name: '氷華一閃', type: 'dash', mult: 2.6, dist: 10, radius: 2.8, cd: 5, desc: '氷の花を咲かせながら一瞬で駆け抜ける。' },
    burst: { name: '雪月花・乱れ咲き', type: 'storm', mult: 1.0, ticks: 16, interval: 0.3, radius: 8, cost: 60, desc: '周囲に氷の花を咲き乱れさせ、敵を凍てつかせる。' },
    profile: '白霜の里の氷の巫女。物静かで礼儀正しいが、剣を握ると誰よりも鋭い。',
  },
  noel: {
    name: 'ノエル', title: '極光の学者', element: 'ice', weapon: 'catalyst', weaponId: 'w_noel',
    base: { hp: 960, atk: 26, def: 56 },
    look: { skin: '#f0d7c4', hair: '#7a6bd6', hairStyle: 'bun', outfit: '#2f3f78', outfit2: '#9ff2e0', accent: '#9ff2e0', height: 0.94, build: 0.9, extra: 'glasses' },
    skill: { name: 'オーロラの雪片', type: 'barrage', mult: 0.8, count: 6, spread: 0.9, speed: 30, homing: 4, cd: 7, desc: '敵を追尾する氷の結晶を6つ放つ。' },
    burst: { name: '極光の奔流', type: 'beam', mult: 7.0, length: 36, width: 4, cost: 70, desc: 'オーロラの光を収束させた冷気の奔流を放つ。' },
    profile: 'オーロラを研究する若き学者。好奇心旺盛でおしゃべり。氷の塔に閉じ込められていた。',
  },
  marin: {
    name: 'マリン', title: '深海の姫騎士', element: 'water', weapon: 'spear', weaponId: 'w_marin',
    base: { hp: 1060, atk: 26, def: 60 },
    look: { skin: '#f1dccf', hair: '#1fb5a8', hairStyle: 'long', outfit: '#16557a', outfit2: '#e9d8a6', accent: '#7ff7e8', height: 0.98, build: 0.9, extra: 'fin' },
    skill: { name: '渦潮の一突き', type: 'wave', mult: 2.5, speed: 34, range: 24, width: 3.2, cd: 6, desc: '槍の一突きで渦潮を放ち、直線上の敵を貫く。' },
    burst: { name: '大渦潮', type: 'tornado', mult: 0.7, ticks: 14, radius: 5.5, speed: 6, dur: 4.5, pull: 10, cost: 60, desc: '巨大な渦潮を前方に放ち、敵を飲み込む。' },
    profile: '海底都市アトランティアの姫。お転婆で、城を抜け出しては海の魔物と戦っていた。',
  },
  orca: {
    name: 'オルカ', title: '海王の戦士', element: 'water', weapon: 'greatsword', weaponId: 'w_orca',
    base: { hp: 1300, atk: 26, def: 72 },
    look: { skin: '#9fb6c9', hair: '#1b2a3a', hairStyle: 'short', outfit: '#1c2f44', outfit2: '#f2f2f2', accent: '#5ad0ff', height: 1.15, build: 1.3, extra: 'fin' },
    skill: { name: '海王の構え', type: 'shield', mult: 2.2, radius: 5.5, shield: 0.32, dur: 12, cd: 12, desc: '海流の鎧をまとい、周囲を薙ぎ払う。' },
    burst: { name: '大海嘯', type: 'spin', mult: 2.2, hits: 4, radius: 10, pull: 4, cost: 70, desc: '津波のような斬撃で周囲を4回薙ぎ払う。' },
    profile: '海の民の戦士長。豪快で笑い声が大きい。クラーケンとの戦いで深海に囚われていた。',
  },
  michaela: {
    name: 'ミカエラ', title: '天穿の熾天使', element: 'light', weapon: 'spear', weaponId: 'w_michaela',
    base: { hp: 1100, atk: 28, def: 64 },
    look: { skin: '#fbe9dc', hair: '#ffe08a', hairStyle: 'ponytail', outfit: '#f5f2ff', outfit2: '#d6b25a', accent: '#fff6c2', height: 1.04, build: 0.95, extra: 'wings' },
    skill: { name: '天翔突', type: 'blink', mult: 2.8, radius: 4, range: 20, cd: 7, desc: '光となって敵の元へ瞬時に飛び、聖槍で貫く。' },
    burst: { name: '天穿の聖槍', type: 'meteor', mult: 9.0, radius: 9, delay: 0.8, cost: 70, desc: '天空から巨大な光の槍を落とす。' },
    profile: '天界の守護隊長。誇り高く厳格だが、地上の者にも分け隔てなく接する。',
  },
  lumina: {
    name: 'ルミナ', title: '祈りの天使', element: 'light', weapon: 'catalyst', weaponId: 'w_lumina',
    base: { hp: 1160, atk: 23, def: 60 },
    look: { skin: '#fdf0e6', hair: '#fdf6ff', hairStyle: 'twin', outfit: '#fff8ee', outfit2: '#ffc6e0', accent: '#ffe7a8', height: 0.88, build: 0.85, extra: 'halo' },
    skill: { name: '祝福の光', type: 'heal', mult: 1.4, radius: 5.5, heal: 0.16, cd: 10, desc: '祝福の光でチーム全員を回復し、周囲の敵を焼く。' },
    burst: { name: '天使の祈り', type: 'buff', mult: 3.0, radius: 8, heal: 0.4, cost: 70, buff: { stat: 'atkPct', value: 0.25, dur: 12, team: true }, desc: 'チーム全員のHPを大きく回復し、攻撃力を12秒間25%上げる。' },
    profile: '天界の大聖堂で祈りを捧げる小さな天使。人懐っこく、誰とでもすぐ友達になる。',
  },
  stella: {
    name: 'ステラ', title: '星詠みの射手', element: 'thunder', weapon: 'bow', weaponId: 'w_stella',
    base: { hp: 990, atk: 28, def: 56 },
    look: { skin: '#f3dccb', hair: '#2d3a8c', hairStyle: 'long', outfit: '#141a3a', outfit2: '#f5d76e', accent: '#9fb8ff', height: 0.97, build: 0.9, extra: 'visor' },
    skill: { name: '流星の矢', type: 'barrage', mult: 0.9, count: 7, spread: 0.7, speed: 60, explode: 2.2, cd: 7, desc: '流星のような雷の矢を7本放つ。' },
    burst: { name: 'メテオシャワー', type: 'rain', mult: 1.25, ticks: 14, interval: 0.3, radius: 9, cost: 70, desc: '星々を呼び寄せ、雷の流星雨を降らせる。' },
    profile: '宇宙観測所に住む星詠みの少女。星の声を聞き、虚無の王の正体に気づいていた。',
  },
  nox: {
    name: 'ノクス', title: '虚空の剣聖', element: 'dark', weapon: 'sword', weaponId: 'w_nox',
    base: { hp: 1140, atk: 30, def: 64 },
    look: { skin: '#e6d4ce', hair: '#1a1024', hairStyle: 'spiky', outfit: '#140c1f', outfit2: '#5b2a86', accent: '#c58bff', cape: '#2a0f3d', height: 1.06, build: 1.0 },
    skill: { name: '虚空斬', type: 'blink', mult: 3.2, radius: 4.5, range: 22, cd: 6, desc: '虚空を渡って敵の背後に現れ、闇の刃で斬り裂く。' },
    burst: { name: '終焉の闇', type: 'tornado', mult: 1.1, ticks: 10, radius: 8, speed: 0, dur: 3.5, pull: 18, atTarget: true, cost: 80, desc: '小さな特異点を生み、周囲の敵を吸い込み砕く。' },
    profile: 'かつて虚無の王に仕えた影の騎士。王の呪縛から解き放たれ、償いのために剣を振るう。',
  },
};

// Weapon `atk` is the level-1 value; it grows with the wielder's level.
export const WEAPONS = {
  // Starter weapons
  w_allen: { name: '旅立ちの剣', type: 'sword', atk: 42, sub: { critRate: 0.06 }, passive: { name: '旅の勇気', desc: '攻撃力+10%。', atkPct: 0.1 }, visual: { color: '#c9d2dc', guard: '#c9a54a' } },
  w_rina: { name: '火打ちの弓', type: 'bow', atk: 40, sub: { critDmg: 0.15 }, passive: { name: '火打ち石', desc: '火元素ダメージ+12%。', elemDmg: 0.12 }, visual: { color: '#8a3b22', guard: '#ffb05a' } },
  w_mio: { name: '泉の小杖', type: 'catalyst', atk: 38, sub: { hpPct: 0.1 }, passive: { name: '清らかな泉', desc: '与える回復量+15%。', healBonus: 0.15 }, visual: { color: '#a8e6ff', guard: '#e8f4ff' } },
  w_gald: { name: '鉄塊の大剣', type: 'greatsword', atk: 44, sub: { defPct: 0.15 }, passive: { name: '鉄壁', desc: 'シールド量+20%。', shieldBonus: 0.2 }, visual: { color: '#9aa0a6', guard: '#6b5a3a' } },
  w_shizuku: { name: '雷光の槍', type: 'spear', atk: 42, sub: { er: 0.15 }, passive: { name: '稲光', desc: '元素爆発のダメージ+15%。', burstDmg: 0.15 }, visual: { color: '#b9b4d9', guard: '#c48bff' } },

  // Exclusive weapons from story chapters
  w_seres: { name: '黎明の聖剣', type: 'sword', atk: 48, exclusive: true, sub: { critDmg: 0.5 }, passive: { name: '夜明けの誓い', desc: '元素スキルのダメージ+30%。元素爆発後、自身の会心率+15%(10秒)。', skillDmg: 0.3, onBurst: { stat: 'critRate', value: 0.15, dur: 10 } }, visual: { color: '#fff3c4', guard: '#d6b25a', glow: '#fff2a8' } },
  w_kai: { name: '翠嵐の弓', type: 'bow', atk: 47, exclusive: true, sub: { er: 0.35 }, passive: { name: '風の囁き', desc: '移動速度+10%。元素スキル後、チーム全体の攻撃力+15%(8秒)。', moveSpeed: 0.1, onSkill: { stat: 'atkPct', value: 0.15, dur: 8, team: true } }, visual: { color: '#5f8d3a', guard: '#a6f07a', glow: '#a6f07a' } },
  w_ignis: { name: '紅蓮の大剣', type: 'greatsword', atk: 50, exclusive: true, sub: { atkPct: 0.25 }, passive: { name: '燃え盛る魂', desc: '火元素ダメージ+30%。元素スキル後、自身の攻撃力+20%(8秒)。', elemDmg: 0.3, onSkill: { stat: 'atkPct', value: 0.2, dur: 8 } }, visual: { color: '#ff7a3a', guard: '#3a1d18', glow: '#ff6a2a' } },
  w_rubia: { name: '溶岩の宝珠', type: 'catalyst', atk: 47, exclusive: true, sub: { critRate: 0.2 }, passive: { name: '宝石の輝き', desc: '元素爆発のダメージ+40%。元素スキルのクールタイム-20%。', burstDmg: 0.4, cdr: 0.2 }, visual: { color: '#ff3d6e', guard: '#e6b84a', glow: '#ff7aa8' } },
  w_yuki: { name: '雪月花', type: 'sword', atk: 49, exclusive: true, sub: { critRate: 0.22 }, passive: { name: '霜華', desc: '氷元素ダメージ+28%。通常攻撃のダメージ+20%。', elemDmg: 0.28, normalDmg: 0.2 }, visual: { color: '#dff6ff', guard: '#c43a4a', glow: '#bfefff' } },
  w_noel: { name: '極光の雪書', type: 'catalyst', atk: 48, exclusive: true, sub: { critDmg: 0.6 }, passive: { name: '極光観測', desc: '元素爆発のダメージ+35%。元素爆発後、チーム全体の会心ダメージ+25%(10秒)。', burstDmg: 0.35, onBurst: { stat: 'critDmg', value: 0.25, dur: 10, team: true } }, visual: { color: '#9ff2e0', guard: '#2f3f78', glow: '#9ff2e0' } },
  w_marin: { name: '深海の三叉槍', type: 'spear', atk: 49, exclusive: true, sub: { critRate: 0.2 }, passive: { name: '潮流', desc: '水元素ダメージ+28%。元素スキル後、エネルギーを10回復。', elemDmg: 0.28, onSkillEnergy: 10 }, visual: { color: '#7ff7e8', guard: '#e9d8a6', glow: '#7ff7e8' } },
  w_orca: { name: '海王の大剣', type: 'greatsword', atk: 51, exclusive: true, sub: { hpPct: 0.3 }, passive: { name: '大海の加護', desc: '最大HP+20%。シールド量+35%。シールド中、攻撃力+20%。', hpPct: 0.2, shieldBonus: 0.35, shieldAtk: 0.2 }, visual: { color: '#5ad0ff', guard: '#f2f2f2', glow: '#5ad0ff' } },
  w_michaela: { name: '天穿の聖槍', type: 'spear', atk: 51, exclusive: true, sub: { critDmg: 0.7 }, passive: { name: '熾天の翼', desc: '光元素ダメージ+30%。元素スキルのダメージ+25%。', elemDmg: 0.3, skillDmg: 0.25 }, visual: { color: '#fff6c2', guard: '#d6b25a', glow: '#fff1a0' } },
  w_lumina: { name: '天使の祈祷書', type: 'catalyst', atk: 46, exclusive: true, sub: { hpPct: 0.35 }, passive: { name: '天の恵み', desc: '与える回復量+40%。元素爆発後、チーム全体の与ダメージ+20%(12秒)。', healBonus: 0.4, onBurst: { stat: 'dmgPct', value: 0.2, dur: 12, team: true } }, visual: { color: '#ffe7a8', guard: '#ffc6e0', glow: '#ffffff' } },
  w_stella: { name: '流星の弓', type: 'bow', atk: 51, exclusive: true, sub: { critRate: 0.24 }, passive: { name: '星の導き', desc: '雷元素ダメージ+30%。元素爆発のダメージ+30%。', elemDmg: 0.3, burstDmg: 0.3 }, visual: { color: '#2d3a8c', guard: '#f5d76e', glow: '#9fb8ff' } },
  w_nox: { name: '虚空の魔剣', type: 'sword', atk: 54, exclusive: true, sub: { critDmg: 0.8 }, passive: { name: '虚ろなる刃', desc: '闇元素ダメージ+35%。元素スキル後、自身の攻撃力+30%(8秒)。', elemDmg: 0.35, onSkill: { stat: 'atkPct', value: 0.3, dur: 8 } }, visual: { color: '#2a0f3d', guard: '#c58bff', glow: '#a35cff' } },
};

export const CHARACTER_IDS = Object.keys(CHARACTERS);
