// Story chapters: two per realm. Clearing a chapter recruits one character with
// their exclusive weapon. Pure data.
//
// Step types: talk, goto, defeat, collect, boss. `lines` are [speaker, text] pairs.

const look = (skin, hair, hairStyle, outfit, outfit2, extra = {}) => ({ skin, hair, hairStyle, outfit, outfit2, accent: outfit2, height: 1, build: 1, ...extra });

const ring = (cx, cz, n, r) => Array.from({ length: n }, (_, i) => {
  const a = (i / n) * Math.PI * 2 + 0.6;
  return [Math.round(cx + Math.cos(a) * r), Math.round(cz + Math.sin(a) * r)];
});

export const CHAPTERS = [
  // ===================== 平原 =====================
  {
    id: 'plains1', realm: 'plains', title: '第1章 黎明の聖剣', level: 5, reward: 'seres',
    summary: '東の光の遺跡に立った光の柱。その正体を確かめに向かう。',
    steps: [
      { type: 'talk', label: '村長ヘルマンと話す', npc: { id: 'herman', name: '村長ヘルマン', x: 16, z: 12, look: look('#efcfb0', '#e8e8e8', 'short', '#7a5a3a', '#d8c8a0', { build: 1.1, extra: 'beard' }) },
        lines: [
          ['村長ヘルマン', 'おお、アレン。皆もそろっておるな。'],
          ['村長ヘルマン', '三日前の夜、空の「星の核」が砕けてから、魔物たちが急に凶暴になった。'],
          ['村長ヘルマン', 'そして昨晩、東の「光の遺跡」から天を貫く光の柱が立ったのじゃ。'],
          ['アレン', '光の柱……何かが目覚めたのかもしれない。'],
          ['村長ヘルマン', '遺跡への街道にはスライムどもが溢れておる。どうか様子を見てきてくれんか。'],
        ] },
      { type: 'goto', label: '東の街道へ向かう', x: 900, z: -300, radius: 45,
        lines: [['リナ', '見て、スライムがあんなに！ 遺跡の方から湧いてきてるみたい。']] },
      { type: 'defeat', label: '街道のスライムを倒す', enemy: 'slime_water', count: 6, x: 1500, z: -700 },
      { type: 'collect', label: '封印を解く「聖なる欠片」を集める', item: '聖なる欠片', points: ring(2000, -1050, 3, 90),
        lines: [['ミオ', '欠片が共鳴してる……遺跡の扉が開くよ！']] },
      { type: 'boss', label: '光の遺跡の主を倒す', boss: 'boss_king_slime', x: 2300, z: -1300, level: 8,
        lines: [['ガルド', 'でかいな……遺跡の光を吸って巨大化したのか。来るぞ！']] },
      { type: 'talk', label: '遺跡で目覚めた少女と話す', npc: { id: 'seres_npc', char: 'seres', x: 2300, z: -1290 },
        lines: [
          ['？？？', '……ありがとう。あの魔物のせいで、封印の眠りから覚められずにいました。'],
          ['セレス', '私はセレス。千年前、聖剣と共にこの遺跡に封じられた聖騎士見習いです。'],
          ['セレス', '星の核が砕けた波動で目覚めました。……この世界に、再び闇が迫っているのですね。'],
          ['アレン', '俺たちは砕けた星の核を取り戻す旅をしている。一緒に来てくれないか？'],
          ['セレス', '喜んで。この「黎明の聖剣」に誓って、あなた方の力になりましょう。'],
        ] },
    ],
  },
  {
    id: 'plains2', realm: 'plains', title: '第2章 翠嵐の射手', level: 11, reward: 'kai', requires: 'plains1',
    summary: '翠の森を襲う狼と、風の丘に舞い降りた暴風のグリフォン。',
    steps: [
      { type: 'talk', label: '行商人ロッタと話す', npc: { id: 'lotta', name: '行商人ロッタ', x: -18, z: 14, look: look('#f0cfb0', '#c87a3a', 'bun', '#a0603a', '#f0e0c0') },
        lines: [
          ['行商人ロッタ', 'ちょっと聞いておくれよ！ 北西の「翠の森」を通ったら、狼の群れに追い回されてさあ。'],
          ['行商人ロッタ', '森の狩人たちも困ってるみたいだったよ。なんでも空から巨大な魔獣が降りてきたとか……'],
          ['シズク', '……空から。グリフォンかもしれない。'],
          ['行商人ロッタ', '頼むよ、あの森を抜けないと商売あがったりなんだ！'],
        ] },
      { type: 'goto', label: '翠の森へ向かう', x: -1200, z: 900, radius: 45 },
      { type: 'talk', label: '傷ついた狩人と話す', npc: { id: 'hunter', name: '傷ついた狩人', x: -1300, z: 1000, look: look('#e0b890', '#4a3a2a', 'short', '#4f6b3a', '#a08a60', { extra: 'hood' }) },
        lines: [
          ['傷ついた狩人', 'うう……旅の方か。気をつけろ、狼どもが群れで襲ってくる……'],
          ['傷ついた狩人', '俺たちの頭領カイが、一人で「風の丘」へ向かった。暴風のグリフォンを止めると言って……'],
          ['傷ついた狩人', '頼む、カイを助けてやってくれ。'],
        ] },
      { type: 'defeat', label: '森の狼の群れを倒す', enemy: 'wolf', count: 8, x: -1800, z: 1500 },
      { type: 'collect', label: 'グリフォンの痕跡「風の羽根」を辿る', item: '風の羽根', points: ring(-2250, 1950, 3, 110) },
      { type: 'boss', label: '風の丘の暴風のグリフォンを倒す', boss: 'boss_griffin', x: -2800, z: 2500, level: 14,
        lines: [['カイ(遠くの声)', 'くそっ、こいつ……速すぎる！ 誰か！']] },
      { type: 'talk', label: '狩人カイと話す', npc: { id: 'kai_npc', char: 'kai', x: -2790, z: 2510 },
        lines: [
          ['カイ', 'はぁ、はぁ……助かった。まさかあいつを倒すなんてな。'],
          ['カイ', '俺はカイ。翠の森の狩人だ。風が騒いでる……世界中で何かが起きてるんだろ？'],
          ['アレン', '星の核が砕けたんだ。俺たちはそれを取り戻す旅をしている。'],
          ['カイ', 'なら、俺の弓も連れて行け。「翠嵐の弓」は風の声を聞く。きっと役に立つさ。'],
        ] },
    ],
  },

  // ===================== 火山 =====================
  {
    id: 'volcano1', realm: 'volcano', title: '第3章 紅蓮の大剣', level: 19, reward: 'ignis',
    summary: '暴れ出したマグマゴーレムと、一人で向かった鍛冶見習い。',
    steps: [
      { type: 'talk', label: '親方ドルガと話す', npc: { id: 'dorga', name: '親方ドルガ', x: 16, z: 2012, look: look('#c98a64', '#3a2a22', 'short', '#4a3428', '#c0582a', { build: 1.35, height: 0.92, extra: 'beard' }) },
        lines: [
          ['親方ドルガ', '平原からよく来たな！ ……と言いたいところだが、今はそれどころじゃねえ。'],
          ['親方ドルガ', '弟子のイグニスの馬鹿が、暴れ出したマグマゴーレムを止めるって一人で「溶岩の大窯」へ行っちまった。'],
          ['親方ドルガ', '大窯の熱を鎮めるには「冷却石」がいる。途中で拾えるはずだ。'],
          ['ガルド', '若いのは無茶をするもんだ。急ごう。'],
        ] },
      { type: 'goto', label: '溶岩の川へ向かう', x: 800, z: 1200, radius: 45,
        lines: [['ミオ', '溶岩に落ちたら大変……足元に気をつけてね。']] },
      { type: 'defeat', label: 'フレイムスライムを倒す', enemy: 'slime_fire', count: 6, x: 1300, z: 600 },
      { type: 'collect', label: '「冷却石」を集める', item: '冷却石', points: ring(1700, 180, 3, 100) },
      { type: 'boss', label: '溶岩の大窯のマグマロードを倒す', boss: 'boss_magma_lord', x: 2200, z: -300, level: 22,
        lines: [['イグニス(遠くの声)', 'うおおお！ まだだ、まだ倒れるかよ！']] },
      { type: 'talk', label: '鍛冶見習いイグニスと話す', npc: { id: 'ignis_npc', char: 'ignis', x: 2210, z: -290 },
        lines: [
          ['イグニス', 'くっ……俺一人じゃ止められなかった。あんたたち、何者だ？'],
          ['アレン', 'ドルガさんに頼まれて来たんだ。無事でよかった。'],
          ['イグニス', '親方が……。へっ、でかい借りができちまったな。'],
          ['イグニス', 'この「紅蓮の大剣」は俺が初めて打った剣だ。こいつで恩を返させてくれ！'],
        ] },
    ],
  },
  {
    id: 'volcano2', realm: 'volcano', title: '第4章 溶岩の宝珠', level: 25, reward: 'rubia', requires: 'volcano1',
    summary: '紅蓮竜に奪われた家宝の宝珠と、それを追った宝石商の娘。',
    steps: [
      { type: 'talk', label: '宝石商ガーネットと話す', npc: { id: 'garnet', name: '宝石商ガーネット', x: -16, z: 2014, look: look('#f0d0b8', '#5a2a3a', 'short', '#6a2a3a', '#e6b84a', { build: 1.15 }) },
        lines: [
          ['宝石商ガーネット', '旅のお方、どうか娘を……ルビアを助けてください！'],
          ['宝石商ガーネット', '我が家に伝わる「溶岩の宝珠」が紅蓮竜に奪われ、娘はそれを取り返しに「宝石の洞」へ……'],
          ['リナ', '竜から宝珠を取り返すって……すごい度胸ね。'],
        ] },
      { type: 'goto', label: '宝石の洞へ向かう', x: -1200, z: 1000, radius: 45 },
      { type: 'talk', label: '洞の鉱夫と話す', npc: { id: 'miner', name: '鉱夫ボッツ', x: -1240, z: 1050, look: look('#c99a74', '#2a2a2a', 'short', '#5a4a3a', '#d0a040', { build: 1.2, extra: 'hat' }) },
        lines: [
          ['鉱夫ボッツ', '赤い髪の嬢ちゃんなら、サラマンダーの群れを追って黒曜の崖へ行ったぜ。'],
          ['鉱夫ボッツ', '竜は宝珠の欠片を落としながら、山の大火口へ飛んでったって話だ。'],
        ] },
      { type: 'defeat', label: '黒曜の崖のサラマンダーを倒す', enemy: 'salamander', count: 8, x: -1600, z: 400 },
      { type: 'collect', label: '竜が落とした「宝珠の欠片」を集める', item: '宝珠の欠片', points: ring(-900, -420, 4, 120) },
      { type: 'boss', label: '大火口の紅蓮竜ヴォルガノスを倒す', boss: 'boss_crimson_dragon', x: 0, z: -1500, level: 28,
        lines: [['ルビア(遠くの声)', 'その宝珠を返しなさいよ、このトカゲ！']] },
      { type: 'talk', label: '宝石商の娘ルビアと話す', npc: { id: 'rubia_npc', char: 'rubia', x: 10, z: -1490 },
        lines: [
          ['ルビア', '……やるじゃない。あの竜を倒すなんて。'],
          ['ルビア', 'わたしはルビア。宝石商ガーネットの娘よ。宝珠は……よかった、無事ね。'],
          ['ルビア', 'ねえ、あなたたちの旅、わたしも連れて行って。この「溶岩の宝珠」の力、世界のために使いたいの。'],
        ] },
    ],
  },

  // ===================== 氷山 =====================
  {
    id: 'ice1', realm: 'ice', title: '第5章 雪月花', level: 34, reward: 'yuki',
    summary: '吹雪を鎮める儀式へ向かい、戻らない氷の巫女。',
    steps: [
      { type: 'talk', label: '里長セツと話す', npc: { id: 'setsu', name: '里長セツ', x: 16, z: 12, look: look('#f0dccc', '#ffffff', 'bun', '#8a3a3a', '#f0f0f0', { height: 0.9 }) },
        lines: [
          ['里長セツ', 'よくぞ参られた。だが今の里は、吹雪と魔物に閉ざされておる。'],
          ['里長セツ', '里の巫女ユキが、吹雪を鎮める儀式のため「氷晶の谷」へ向かったまま戻らぬのじゃ。'],
          ['里長セツ', '谷へは凍てつく湖を越えて行く。湖のそばに咲く「氷華」が、谷の結界を解く鍵となる。'],
        ] },
      { type: 'goto', label: '凍てつく湖へ向かう', x: 1000, z: 800, radius: 45,
        lines: [['シズク', '湖が完全に凍ってる。……この上を歩ける。']] },
      { type: 'defeat', label: '雪狼の群れを倒す', enemy: 'snow_wolf', count: 7, x: 1500, z: 1300 },
      { type: 'collect', label: '結界を解く「氷華」を集める', item: '氷華', points: ring(1900, 1700, 3, 100) },
      { type: 'boss', label: '氷晶の谷の巨人を倒す', boss: 'boss_ice_giant', x: 2400, z: 2200, level: 37 },
      { type: 'talk', label: '氷の巫女ユキと話す', npc: { id: 'yuki_npc', char: 'yuki', x: 2410, z: 2210 },
        lines: [
          ['ユキ', '……あなた方が、巨人を。かたじけのうございます。'],
          ['ユキ', '私はユキ。白霜の里の巫女です。巨人に儀式を阻まれ、ずっと谷に閉じ込められておりました。'],
          ['ユキ', '吹雪の源は、星の核の欠片の暴走……。この刀「雪月花」と共に、私もお供させてください。'],
        ] },
    ],
  },
  {
    id: 'ice2', realm: 'ice', title: '第6章 極光の雪書', level: 40, reward: 'noel', requires: 'ice1',
    summary: '氷の塔で消息を絶ったオーロラ学者と、目覚めた氷竜。',
    steps: [
      { type: 'talk', label: '研究助手ピピと話す', npc: { id: 'pipi', name: '研究助手ピピ', x: -16, z: 14, look: look('#f6e0d0', '#f0a040', 'bob', '#3a5a8a', '#ffffff', { height: 0.75, extra: 'glasses' }) },
        lines: [
          ['研究助手ピピ', 'た、大変です！ ノエル先生が「氷の塔」から帰ってこないんです！'],
          ['研究助手ピピ', '先生はオーロラの研究をしていて……塔のてっぺんで氷竜が目覚めたっていう手紙が最後で……'],
          ['シズク', '……竜。また大物。'],
        ] },
      { type: 'goto', label: '吹雪の峠へ向かう', x: -900, z: -1000, radius: 45 },
      { type: 'defeat', label: '峠の氷の精霊を倒す', enemy: 'frost_spirit', count: 7, x: -1500, z: -1500 },
      { type: 'collect', label: '塔の扉を開く「オーロラの欠片」を集める', item: 'オーロラの欠片', points: ring(-2000, -1950, 4, 110) },
      { type: 'boss', label: '氷の塔の氷竜グラシエスを倒す', boss: 'boss_frost_dragon', x: -2600, z: -2600, level: 43 },
      { type: 'talk', label: 'オーロラ学者ノエルと話す', npc: { id: 'noel_npc', char: 'noel', x: -2590, z: -2590 },
        lines: [
          ['ノエル', 'わぁ！ 本当に氷竜を倒しちゃったの!? すごいすごい！'],
          ['ノエル', 'わたしはノエル、オーロラ学者よ。氷竜が暴れていたのは、星の核の欠片が原因だったの。'],
          ['ノエル', 'ねぇ、旅についていっていい？ この「極光の雪書」に、世界の果てまで記録したいの！'],
        ] },
    ],
  },

  // ===================== 海底 =====================
  {
    id: 'sea1', realm: 'sea', title: '第7章 深海の三叉槍', level: 49, reward: 'marin',
    summary: '大海蛇を討つと城を飛び出したアトランティアの姫。',
    steps: [
      { type: 'talk', label: '海王ポセイドと話す', npc: { id: 'poseid', name: '海王ポセイド', x: 16, z: 12, look: look('#cfe0e8', '#e0f0ff', 'long', '#1c4f7a', '#e6c860', { build: 1.3, height: 1.15, extra: 'beard' }) },
        lines: [
          ['海王ポセイド', '地上の旅人よ、アトランティアへようこそ。……だが歓迎の宴は開けそうにない。'],
          ['海王ポセイド', '我が娘マリンが、大海蛇リヴァイアを討つと言って「深淵の裂け目」へ向かったのだ。'],
          ['海王ポセイド', '裂け目の結界を越えるには「真珠」の光が要る。どうか娘を……'],
          ['ミオ', '海の中でも息ができるなんて、不思議……。急ぎましょう！'],
        ] },
      { type: 'goto', label: '珊瑚の森へ向かう', x: 1200, z: -600, radius: 50 },
      { type: 'defeat', label: '珊瑚の森の牙鮫を倒す', enemy: 'shark', count: 6, x: 1700, z: -1100 },
      { type: 'collect', label: '結界を照らす「真珠」を集める', item: '真珠', points: ring(2100, -1500, 3, 100) },
      { type: 'boss', label: '深淵の裂け目の大海蛇リヴァイアを倒す', boss: 'boss_leviathan', x: 2700, z: -2100, level: 52 },
      { type: 'talk', label: 'アトランティアの姫マリンと話す', npc: { id: 'marin_npc', char: 'marin', x: 2710, z: -2090 },
        lines: [
          ['マリン', 'あはは、やったね！ リヴァイアをやっつけるなんて！'],
          ['マリン', 'あたしはマリン。アトランティアの姫……だけど、堅苦しいのは苦手なの。'],
          ['マリン', '父上には内緒で、あたしも一緒に行く！ この「深海の三叉槍」があれば百人力だよ！'],
        ] },
    ],
  },
  {
    id: 'sea2', realm: 'sea', title: '第8章 海王の大剣', level: 55, reward: 'orca', requires: 'sea1',
    summary: 'クラーケンに囚われた海の民の戦士長を救い出せ。',
    steps: [
      { type: 'talk', label: '海の民の少年ナギと話す', npc: { id: 'nagi', name: '海の民の少年ナギ', x: -16, z: 14, look: look('#b8d0dc', '#1b3a4a', 'spiky', '#2a6a8a', '#f0f0e0', { height: 0.72, extra: 'fin' }) },
        lines: [
          ['ナギ', 'お願い！ 戦士長のオルカさんを助けて！'],
          ['ナギ', 'クラーケンと戦って、深海の神殿に引きずり込まれちゃったんだ……'],
        ] },
      { type: 'goto', label: '沈没船へ向かう', x: -1300, z: 700, radius: 50 },
      { type: 'talk', label: '幽霊船長と話す', npc: { id: 'captain', name: '幽霊船長', x: -1330, z: 740, look: look('#c8d8e0', '#2a2a2a', 'long', '#2a2a3a', '#c9a54a', { extra: 'hat', ghost: true }) },
        lines: [
          ['幽霊船長', 'ヨーホー……生者がここへ来るとは珍しい。'],
          ['幽霊船長', 'オルカなら、魚人どもに担がれて神殿の方へ連れて行かれたぞ。クラーケンへの生贄にな。'],
        ] },
      { type: 'defeat', label: '魚人兵を倒す', enemy: 'fishman', count: 7, x: -1900, z: 1300 },
      { type: 'collect', label: '「神殿の鍵」を集める', item: '神殿の鍵', points: ring(-2300, 1900, 3, 110) },
      { type: 'boss', label: '深海の神殿のクラーケンを倒す', boss: 'boss_kraken', x: -2700, z: 2400, level: 58 },
      { type: 'talk', label: '海の戦士長オルカと話す', npc: { id: 'orca_npc', char: 'orca', x: -2690, z: 2410 },
        lines: [
          ['オルカ', 'ガッハッハ！ 助かったぞ、地上の勇者たち！'],
          ['オルカ', '俺はオルカ、海の民の戦士長だ。この借りは戦いで返すのが海の流儀よ！'],
          ['オルカ', '「海王の大剣」と共に、どこまでもついて行くぜ！'],
        ] },
    ],
  },

  // ===================== 天界 =====================
  {
    id: 'heaven1', realm: 'heaven', title: '第9章 天穿の聖槍', level: 64, reward: 'michaela',
    summary: '闇に堕ちた天使長を止めに向かった守護隊長。',
    steps: [
      { type: 'talk', label: '大天使ガブリエラと話す', npc: { id: 'gabriela', name: '大天使ガブリエラ', x: 16, z: 12, look: look('#fbeee2', '#f8e8c0', 'long', '#ffffff', '#d6b25a', { height: 1.1, extra: 'wings' }) },
        lines: [
          ['大天使ガブリエラ', '地上の勇者たちよ、天界へようこそ。……ですが、ここも闇に侵されつつあります。'],
          ['大天使ガブリエラ', '守護隊長ミカエラが、堕天使長ルシエルを止めるため「堕ちた聖堂」へ向かいました。'],
          ['セレス', 'ルシエル……千年前、虚無の王に魂を売った天使の名です。'],
          ['大天使ガブリエラ', '雲の回廊を越え、聖なる羽根を集めて聖堂の結界を解くのです。光の柱の上昇気流を使いなさい。'],
        ] },
      { type: 'goto', label: '雲の回廊へ向かう', x: 900, z: 700, radius: 50 },
      { type: 'defeat', label: '堕天使を倒す', enemy: 'fallen_angel', count: 6, x: 1500, z: 1300 },
      { type: 'collect', label: '「聖なる羽根」を集める', item: '聖なる羽根', points: ring(2000, 1800, 3, 90) },
      { type: 'boss', label: '堕ちた聖堂の堕天使長ルシエルを倒す', boss: 'boss_fallen_archangel', x: 2600, z: 2500, level: 67,
        lines: [['堕天使長ルシエル', '地を這う者どもが、天に何の用だ。虚無の王の御前に、ひれ伏すがいい！']] },
      { type: 'talk', label: '守護隊長ミカエラと話す', npc: { id: 'michaela_npc', char: 'michaela', x: 2610, z: 2510 },
        lines: [
          ['ミカエラ', '……感謝する。私一人では、ルシエルの闇に呑まれていただろう。'],
          ['ミカエラ', '私はミカエラ、天界守護隊長。地上の者に救われるとは、私もまだまだだな。'],
          ['ミカエラ', '虚無の王は宇宙の果てにいる。この「天穿の聖槍」と共に、最後まで戦おう。'],
        ] },
    ],
  },
  {
    id: 'heaven2', realm: 'heaven', title: '第10章 天使の祈祷書', level: 70, reward: 'lumina', requires: 'heaven1',
    summary: '闇に染まった守護竜と、玉座で祈り続ける小さな天使。',
    steps: [
      { type: 'talk', label: '司祭ラファと話す', npc: { id: 'rafa', name: '司祭ラファ', x: -16, z: 14, look: look('#f8e8dc', '#c0a080', 'short', '#f0ead8', '#6a8ad0', { extra: 'halo' }) },
        lines: [
          ['司祭ラファ', '大聖堂の小さな天使、ルミナが行方知れずなのです。'],
          ['司祭ラファ', 'あの子は「天空の玉座」で祈りを捧げていました。しかし玉座の守護竜セラフィムが闇に染まり……'],
        ] },
      { type: 'goto', label: '虹の泉へ向かう', x: -1000, z: -800, radius: 50 },
      { type: 'defeat', label: '光の精霊を倒す', enemy: 'light_spirit', count: 7, x: -1600, z: -1400 },
      { type: 'collect', label: '「祈りの灯」を集める', item: '祈りの灯', points: ring(-2100, -1850, 4, 100) },
      { type: 'boss', label: '天空の玉座の天空竜セラフィムを倒す', boss: 'boss_seraph_dragon', x: -2700, z: -2600, level: 73 },
      { type: 'talk', label: '小さな天使ルミナと話す', npc: { id: 'lumina_npc', char: 'lumina', x: -2690, z: -2590 },
        lines: [
          ['ルミナ', 'わぁ……セラフィムが元に戻った！ ありがとう！'],
          ['ルミナ', 'ルミナはルミナっていうの！ ずっと玉座でお祈りしてたけど、怖くて出られなかったの……'],
          ['ルミナ', 'ルミナも一緒に行く！ 「天使の祈祷書」で、みんなをいっぱい元気にしてあげる！'],
        ] },
    ],
  },

  // ===================== 宇宙 =====================
  {
    id: 'space1', realm: 'space', title: '第11章 流星の弓', level: 79, reward: 'stella',
    summary: '星の光を喰らう魔獣の巣へ向かった星詠みの少女。',
    steps: [
      { type: 'talk', label: '観測所長ガリレオと話す', npc: { id: 'galileo', name: '観測所長ガリレオ', x: 16, z: 12, look: look('#f0d8c8', '#d0d0d0', 'short', '#2a2a4a', '#9fb8ff', { extra: 'beard' }) },
        lines: [
          ['観測所長ガリレオ', 'よくぞ来た。ここは宇宙の果てに最も近い場所、星の観測所だ。'],
          ['観測所長ガリレオ', '星詠みのステラが「星喰らいの巣」の調査から戻らない。あの魔獣は星の光を喰らうのだ。'],
          ['観測所長ガリレオ', '隕石平原を越え、星のかけらを辿れば巣に着けるだろう。重力が弱いから跳びすぎに注意したまえ。'],
        ] },
      { type: 'goto', label: '隕石平原へ向かう', x: 1200, z: 1000, radius: 50 },
      { type: 'defeat', label: 'グレイ星人を倒す', enemy: 'alien', count: 7, x: 1800, z: 1500 },
      { type: 'collect', label: '「星のかけら」を辿る', item: '星のかけら', points: ring(2200, 1950, 3, 110) },
      { type: 'boss', label: '星喰らいの巣の魔獣を倒す', boss: 'boss_star_devourer', x: 2800, z: 2600, level: 82 },
      { type: 'talk', label: '星詠みステラと話す', npc: { id: 'stella_npc', char: 'stella', x: 2810, z: 2610 },
        lines: [
          ['ステラ', '……星の声が、あなたたちが来ると教えてくれていました。'],
          ['ステラ', '私はステラ、星詠み。虚無の王は、砕けた星の核の最後の欠片で世界を無に還そうとしています。'],
          ['ステラ', 'この「流星の弓」で、私も道を照らします。共に参りましょう。'],
        ] },
    ],
  },
  {
    id: 'space2', realm: 'space', title: '最終章 虚空の魔剣', level: 86, reward: 'nox', requires: 'space1', final: true,
    summary: '虚無の玉座に座す王との最後の戦い。',
    steps: [
      { type: 'talk', label: '星詠みの老人と話す', npc: { id: 'oldseer', name: '星詠みの老人', x: -16, z: 14, look: look('#e8d0c0', '#f0f0f0', 'long', '#3a2a5a', '#f5d76e', { extra: 'hood' }) },
        lines: [
          ['星詠みの老人', 'いよいよ最後の戦いじゃな。虚無の王ゼロは「虚無の玉座」におる。'],
          ['星詠みの老人', '王の傍らには、かつて王に仕えた影の騎士がいるという。その者もまた、囚われの身かもしれぬ。'],
          ['アレン', '行こう、みんな。全部終わらせるんだ。'],
        ] },
      { type: 'goto', label: '虚無の門へ向かう', x: -1200, z: -1000, radius: 50 },
      { type: 'defeat', label: '虚無の亡霊を倒す', enemy: 'void_wraith', count: 8, x: -1800, z: -1600 },
      { type: 'collect', label: '「星の核の欠片」を集める', item: '星の核の欠片', points: ring(-2300, -2100, 5, 120) },
      { type: 'boss', label: '虚無の玉座の王ゼロを倒す', boss: 'boss_void_king', x: -3000, z: -3000, level: 90,
        lines: [['虚無の王ゼロ', 'よくぞ来た、小さき者たち。全ては無に還る。お前たちも、星も、世界も。']] },
      { type: 'talk', label: '影の騎士と話す', npc: { id: 'nox_npc', char: 'nox', x: -2990, z: -2990 },
        lines: [
          ['ノクス', '……王の呪縛が解けた。俺はノクス。かつて虚無の王の剣だった者だ。'],
          ['ノクス', 'お前たちの光が、俺の闇を払った。償いをさせてくれ。'],
          ['ノクス', 'この「虚空の魔剣」、今度は世界を守るために振るおう。'],
          ['アレン', '見ろ、星の核が……元に戻っていく。'],
          ['ステラ', '六つの世界に、光が帰ってきました。'],
        ] },
    ],
    epilogue: '星の核は再び輝きを取り戻した。だが冒険は終わらない。広大な六つの世界には、まだ見ぬ宝と強敵が眠っている。',
  },
];

export const CHAPTER_BY_ID = Object.fromEntries(CHAPTERS.map((c) => [c.id, c]));

// Flavor NPCs standing around each hub town.
export const TOWNSFOLK = {
  plains: [
    { id: 'tf_p1', name: '村の子ども', x: -30, z: -20, look: look('#f6dcc4', '#8a5a2a', 'short', '#d0603a', '#f0e0c0', { height: 0.65 }), lines: [['村の子ども', '大風車の上からは、平原のずっと向こうまで見えるんだって！']] },
    { id: 'tf_p2', name: '農夫ベン', x: 40, z: -34, look: look('#e0b890', '#6a4a2a', 'short', '#4a7a3a', '#c0a070', { extra: 'hat', build: 1.15 }), lines: [['農夫ベン', '[R]で精霊の馬を呼べるのを知ってるかい？ 広い平原を旅するなら必須だよ。'], ['農夫ベン', 'ワープポイントに触れておけば、地図からいつでも飛べるぞ。']] },
    { id: 'tf_p3', name: '旅の吟遊詩人', x: -44, z: 30, look: look('#f0d0b8', '#3a6aa0', 'long', '#6a3a8a', '#f0c060'), lines: [['旅の吟遊詩人', '六つの世界の伝説を知っているかい？ 平原、火山、氷山、海底、天界、そして宇宙……'], ['旅の吟遊詩人', '物語を一つ終えるたびに、新たな仲間が君を待っているのさ。']] },
  ],
  volcano: [
    { id: 'tf_v1', name: '砦の衛兵', x: 30, z: 1980, look: look('#d0a080', '#2a2a2a', 'short', '#5a3a2a', '#a0a0a0', { build: 1.2 }), lines: [['砦の衛兵', '火山の魔物は火に強い。水や氷の力で攻めるといい。蒸発や融解は強力だぞ。']] },
    { id: 'tf_v2', name: '火山学者', x: -36, z: 2030, look: look('#f0d8c0', '#aa4a2a', 'bob', '#7a5a3a', '#f0e0c0', { extra: 'glasses' }), lines: [['火山学者', '溶岩に触れると大やけどです。高台を進むのが安全ですよ。']] },
  ],
  ice: [
    { id: 'tf_i1', name: '里の猟師', x: 30, z: -24, look: look('#f0d8c8', '#4a3a2a', 'short', '#6a4a3a', '#f0f0f0', { extra: 'hood' }), lines: [['里の猟師', '氷の魔物には火が効く。融解のダメージは格別だ。']] },
    { id: 'tf_i2', name: '雪だるま職人', x: -30, z: -30, look: look('#f6e0d0', '#e0e0e0', 'twin', '#3a6aa0', '#ffffff', { height: 0.8 }), lines: [['雪だるま職人', '凍った湖の上なら、どこまでも歩いていけるよ！']] },
  ],
  sea: [
    { id: 'tf_s1', name: '人魚の歌い手', x: 30, z: -24, look: look('#e8e0f0', '#ff8ab0', 'long', '#3a8aa0', '#f0e0ff', { extra: 'fin' }), lines: [['人魚の歌い手', '海の中では[Space]で浮上、[Ctrl]か[C]で潜れるわ。']] },
    { id: 'tf_s2', name: '海底の学者', x: -34, z: -30, look: look('#c8d8e0', '#2a4a5a', 'short', '#2a4a6a', '#e0d8a0', { extra: 'glasses' }), lines: [['海底の学者', '海の魔物は雷に弱いものが多い。感電や凍結を狙ってみなさい。']] },
  ],
  heaven: [
    { id: 'tf_h1', name: '見習い天使', x: 30, z: -24, look: look('#fdf0e6', '#ffe0a0', 'bob', '#ffffff', '#ffd0e0', { height: 0.75, extra: 'halo' }), lines: [['見習い天使', '光の柱に入ると上昇気流で空高く舞い上がれるよ！ そのあと[Space]で滑空！']] },
    { id: 'tf_h2', name: '天界の門番', x: -34, z: -30, look: look('#f8e8dc', '#d0b070', 'short', '#f0ead8', '#d6b25a', { build: 1.2, extra: 'wings' }), lines: [['天界の門番', '雲海に落ちても心配はいらない。最後に立っていた島へ戻されるだろう。']] },
  ],
  space: [
    { id: 'tf_x1', name: '宇宙飛行士', x: 30, z: -24, look: look('#f0d8c8', '#3a3a3a', 'short', '#e8e8f0', '#ff8a3a', { extra: 'visor' }), lines: [['宇宙飛行士', 'ここでは重力が地上の3分の1。思い切りジャンプしてみな！']] },
    { id: 'tf_x2', name: '観測所の研究員', x: -34, z: -30, look: look('#f6e0d0', '#6a4ad0', 'bob', '#2a2a4a', '#9fb8ff', { extra: 'glasses' }), lines: [['観測所の研究員', '虚無の魔物は光に弱いわ。光と闇がぶつかる「対消滅」は凄まじい威力よ。']] },
  ],
};
