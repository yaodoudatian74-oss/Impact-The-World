// Boot: renderer, error reporting, title screen and the animation loop.

import * as THREE from 'three';
import { Game } from './game/game.js';
import { UI } from './ui/ui.js';
import { Input } from './core/input.js';
import { Audio } from './core/audio.js';
import { newSave, loadFrom, migrate } from './game/save.js';
import { REALM_BY_ID } from './data/realms.js';
import { CHAPTERS } from './data/stories.js';
import { formatTime } from './core/math.js';

function showError(msg) {
  const el = document.getElementById('error');
  if (!el) return;
  el.hidden = false;
  el.querySelector('.err-msg').textContent = msg;
}

addEventListener('error', (e) => showError(`${e.message || 'エラーが発生しました'}${e.filename ? `\n${e.filename.split('/').pop()}:${e.lineno}` : ''}`));
addEventListener('unhandledrejection', (e) => showError(String(e.reason?.message || e.reason || 'エラーが発生しました')));

function safeStorage() {
  try {
    const s = window.localStorage;
    const k = '__itw_probe';
    s.setItem(k, '1');
    s.removeItem(k);
    return s;
  } catch {
    return null;
  }
}

const PROLOGUE = [
  ['', '── 世界「アストラリア」。六つの世界は、空に輝く「星の核」によって結ばれていた。'],
  ['', 'だが三日前の夜、星の核は何者かに砕かれ、各地で魔物たちが暴れ始めた。'],
  ['アレン', 'みんな、準備はいいか？ 砕けた星の核を取り戻しに行こう！'],
  ['リナ', 'もちろん！ 弓の腕、見せてあげる。'],
  ['ミオ', '怪我をしたら、すぐに言ってくださいね。'],
  ['ガルド', '背中は任せろ。'],
  ['シズク', '……行こう。'],
  ['', '村長ヘルマンが話をしたがっている。頭上に「！」マークのある人に話しかけよう。物語をクリアするたびに、新しい仲間と専用武器が手に入る。'],
];

function boot(hotData) {
  const canvas = document.getElementById('game');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch {
    showError('WebGLを初期化できませんでした。ブラウザのハードウェアアクセラレーションを有効にしてください。');
    return;
  }
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  const storage = safeStorage();
  const input = new Input(canvas);
  const audio = new Audio();
  const ui = new UI(document.getElementById('ui'), renderer);
  const game = new Game({ renderer, input, audio, ui, storage });
  window.__game = game;

  const resize = () => {
    renderer.setSize(innerWidth, innerHeight);
    game.cam.aspect = innerWidth / innerHeight;
    game.cam.updateProjectionMatrix();
  };
  addEventListener('resize', resize);
  resize();

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); showError('グラフィックの描画が中断されました。ページを再読み込みしてください（進行状況は自動セーブされています）。'); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { audio.suspend(); if (game.save && game.state === 'play') game.saveNow(); }
    else { audio.resume(); game.lastFrame = performance.now(); }
  });
  addEventListener('pagehide', () => { if (game.save && game.state !== 'title') game.saveNow(); });
  const unlockAudio = () => audio.unlock();
  addEventListener('pointerdown', unlockAudio);
  addEventListener('keydown', unlockAudio);

  const loop = (now) => {
    requestAnimationFrame(loop);
    if (document.hidden) return;
    game.frame(now);
  };
  requestAnimationFrame(loop);

  const start = (save, isNew) => {
    audio.unlock();
    ui.fade(() => {
      game.start(save);
      if (isNew) ui.dialogue(PROLOGUE);
      game.saveNow();
    });
  };

  window.claude?.hot?.snapshot?.(() => (game.save ? { save: game.save } : {}));

  if (hotData && hotData.save) { start(migrate(hotData.save), false); return; }
  const existing = loadFrom(storage);
  let summary = '';
  if (existing) {
    const done = CHAPTERS.filter((c) => existing.story[c.id].status === 'done').length;
    summary = `${REALM_BY_ID[existing.realm].name}・物語 ${done}/${CHAPTERS.length}・${formatTime(existing.playTime)}`;
  }
  ui.showTitle({
    hasSave: !!existing,
    summary,
    onNew: () => start(newSave(), true),
    onContinue: () => start(existing, false),
  });
}

// Offline support when served as a normal website (not inside an embedded viewer).
if ('serviceWorker' in navigator && location.protocol === 'https:' && !window.claude) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

const hot = window.claude?.hot;
if (hot?.ready) hot.ready(boot);
else boot(hot?.data ?? {});
