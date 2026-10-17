// Browser smoke test: boots the game in headless Chromium (software WebGL), plays a scripted
// sequence, visits every realm, opens every menu and fails on any console error.
// Usage: node tools/smoke.mjs [--shots dir] [--dist]
import fs from 'node:fs';
import path from 'node:path';
import { launch, newPage as openPage, root, ORIGIN, sleep } from './browser.mjs';

const args = process.argv.slice(2);
const shotsDir = args.includes('--shots') ? args[args.indexOf('--shots') + 1] : null;
const useDist = args.includes('--dist');
if (shotsDir) fs.mkdirSync(shotsDir, { recursive: true });

const browser = await launch();
const errors = [];
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const newPage = (viewport, touch = false) => openPage(browser, { viewport, touch, errors, entry: useDist ? '/dist/wrapped.html' : '/index.html' });

if (useDist) {
  // Wrap the artifact fragment in a document the way the host does.
  const frag = fs.readFileSync(path.join(root, 'dist/game.html'), 'utf8');
  fs.writeFileSync(path.join(root, 'dist/wrapped.html'), `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>${frag}</body></html>`);
}

const shot = async (page, name) => { if (shotsDir) await page.screenshot({ path: path.join(shotsDir, `${name}.png`) }); };
const G = (page, fn, arg) => page.evaluate(fn, arg);
// Polls a page condition: headless software rendering can take a few hundred ms per frame.
async function until(page, fn, timeout = 3000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (await page.evaluate(fn)) return true;
    await sleep(80);
  }
  return false;
}

// ------------------------------------------------------------------ desktop run
{
  const page = await newPage({ width: 1280, height: 720 });
  await page.goto(`${ORIGIN}/index.html`);
  await page.waitForSelector('.title-screen', { timeout: 30000 });
  check('title screen renders', true);
  await shot(page, '01-title');
  await page.click('.title-btns .tbtn-main');
  await page.waitForFunction(() => window.__game && window.__game.save && (window.__game.state === 'play' || window.__game.state === 'dialogue'), null, { timeout: 60000 });
  check('new game starts', true);
  await sleep(1200);
  await shot(page, '02-prologue');
  // Skip the prologue
  for (let i = 0; i < 30; i++) {
    const open = await G(page, () => window.__game.ui.dialogueOpen);
    if (!open) break;
    await page.keyboard.press('Space');
    await sleep(60);
  }
  check('prologue can be advanced', !(await G(page, () => window.__game.ui.dialogueOpen)));
  const st0 = await G(page, () => ({ state: window.__game.state, party: window.__game.save.party, roster: Object.keys(window.__game.save.roster) }));
  check('starts with 5 characters', st0.roster.length === 5, st0.roster.join(','));
  check('party of 4', st0.party.length === 4);
  await sleep(800);
  await shot(page, '03-village');

  // Walk forward and sprint
  const p0 = await G(page, () => window.__game.player.pos.toArray());
  await page.keyboard.down('KeyW');
  await sleep(1500);
  await page.keyboard.up('KeyW');
  const p1 = await G(page, () => window.__game.player.pos.toArray());
  check('player moves with W', Math.hypot(p1[0] - p0[0], p1[2] - p0[2]) > 3, `moved ${Math.hypot(p1[0] - p0[0], p1[2] - p0[2]).toFixed(1)}`);

  // Jump and glide
  const y0 = await G(page, () => window.__game.player.pos.y);
  await page.keyboard.press('Space');
  let air = 'walk', peak = 0;
  for (let i = 0; i < 20 && air === 'walk'; i++) {
    await sleep(50);
    const r = await G(page, () => ({ m: window.__game.player.mode, y: window.__game.player.pos.y }));
    air = r.m; peak = Math.max(peak, r.y - y0);
  }
  check('jump leaves the ground', air === 'air' || air === 'glide' || peak > 0.3, `${air} +${peak.toFixed(2)}`);
  await sleep(900);

  // Talk to the village chief -> chapter 1 starts
  await G(page, () => { const g = window.__game; g.player.teleport(16, 14.5); g.player.yaw = Math.PI; });
  await sleep(300);
  const prompt = await G(page, () => window.__game.interactable()?.label || null);
  check('interact prompt near NPC', !!prompt, prompt || 'none');
  await page.keyboard.press('KeyF');
  await sleep(400);
  await shot(page, '04-dialogue');
  for (let i = 0; i < 30; i++) {
    const open = await G(page, () => window.__game.ui.dialogueOpen);
    if (!open) break;
    await page.keyboard.press('KeyF');
    await sleep(60);
  }
  const s1 = await G(page, () => window.__game.save.story.plains1);
  check('chapter 1 accepted and advanced', s1.status === 'active' && s1.step === 1, JSON.stringify(s1));

  // Combat: spawn an enemy next to the player and fight it
  const hp0 = await G(page, () => {
    const g = window.__game;
    g.player.teleport(900, -330);
    g.world.primeAround(900, -330);
    const p = g.player.pos;
    const e = g.enemies.spawn('slime_water', 1, p.x + 2, p.z + 2);
    window.__testEnemy = e;
    return e.hp;
  });
  for (let i = 0; i < 6; i++) { await page.mouse.click(640, 400); await sleep(250); }
  await page.keyboard.press('KeyE');
  await sleep(1200);
  const hp1 = await G(page, () => window.__testEnemy.hp);
  check('attacks damage enemies', hp1 < hp0, `${hp0} -> ${hp1}`);
  await shot(page, '05-combat');

  // Burst with full energy
  await G(page, () => { const g = window.__game; g.player.active.energy = 100; g.enemies.spawn('wolf', 2, g.player.pos.x + 4, g.player.pos.z); });
  await page.keyboard.press('KeyQ');
  await sleep(500);
  await shot(page, '06-burst');
  await sleep(2500);

  // Switch character
  await page.keyboard.press('Digit2');
  const switched = await until(page, () => window.__game.player.activeIdx === 1);
  check('switch character with 2', switched);

  // Mount
  await G(page, () => { window.__game.enemies.clear(); });
  await page.keyboard.press('KeyR');
  const mounted = await until(page, () => window.__game.player.mounted);
  check('mount with R', mounted);
  await page.keyboard.down('KeyW');
  await sleep(1200);
  await page.keyboard.up('KeyW');
  await shot(page, '07-mount');
  await page.keyboard.press('KeyR');

  // Menus
  for (const [key, name] of [['KeyM', 'map'], ['KeyC', 'party'], ['KeyJ', 'story'], ['Escape', 'pause']]) {
    await page.keyboard.press(key);
    const opened = await until(page, new Function(`return window.__game.ui.menuName === '${name}'`));
    check(`menu ${name} opens`, opened);
    await sleep(300);
    await shot(page, `08-menu-${name}`);
    await page.keyboard.press('Escape');
    await until(page, () => !window.__game.ui.menuName);
  }
  check('menus close back to play', (await G(page, () => window.__game.state)) === 'play');

  // Visit every realm
  await G(page, () => { const s = window.__game.save; s.realms = ['plains', 'volcano', 'ice', 'sea', 'heaven', 'space']; });
  for (const id of ['volcano', 'ice', 'sea', 'heaven', 'space', 'plains']) {
    await G(page, (rid) => window.__game.travelToRealm(rid), id);
    await sleep(2200);
    const info = await G(page, () => ({ realm: window.__game.world.realm.id, y: window.__game.player.pos.y, chunks: window.__game.world.chunks.size, mode: window.__game.player.mode }));
    check(`realm ${id} loads`, info.realm === id && info.chunks > 0 && Number.isFinite(info.y), `chunks ${info.chunks}, mode ${info.mode}`);
    await page.keyboard.down('KeyW');
    await sleep(700);
    await page.keyboard.up('KeyW');
    await shot(page, `09-realm-${id}`);
  }

  // Recruit flow: finish chapter 1 directly and check reward
  const rec = await G(page, () => {
    const g = window.__game;
    const ch = g.quests.realmChapters().find((c) => c.id === 'plains1');
    g.save.story.plains1.step = ch.steps.length - 1;
    g.quests.setup();
    g.quests.advance(ch);
    return { roster: Object.keys(g.save.roster).length, realms: g.save.realms.slice(), state: g.state };
  });
  await sleep(400);
  await shot(page, '10-reward');
  check('clearing a chapter recruits a character', rec.roster === 6, `roster ${rec.roster}`);
  check('reward screen shows', rec.state === 'reward');
  await page.keyboard.press('KeyF');
  await sleep(300);

  // Save round trip
  const saved = await G(page, () => { window.__game.saveNow(); return JSON.parse(localStorage.getItem('impact-the-world-save')); });
  check('save written', !!saved && saved.v >= 1 && saved.roster.seres, saved ? `v${saved.v}` : 'none');

  // Abnormal input: rapid keys and two keys at once
  for (let i = 0; i < 20; i++) { await page.keyboard.press(i % 2 ? 'KeyE' : 'KeyQ'); }
  await page.keyboard.down('KeyW'); await page.keyboard.down('KeyS'); await sleep(300); await page.keyboard.up('KeyW'); await page.keyboard.up('KeyS');
  await page.setViewportSize({ width: 900, height: 600 });
  await sleep(300);
  await page.setViewportSize({ width: 1280, height: 720 });
  check('survives rapid input and resize', (await G(page, () => window.__game.state)) !== undefined);

  // Reload mid-game resumes from save
  await page.reload();
  await page.waitForSelector('.title-screen', { timeout: 30000 });
  const hasContinue = await page.$('.tbtn-main.primary');
  check('continue button after reload', !!hasContinue);
  await page.click('.tbtn-main.primary');
  await page.waitForFunction(() => window.__game && window.__game.state === 'play', null, { timeout: 60000 });
  const after = await G(page, () => Object.keys(window.__game.save.roster).length);
  check('continue restores roster', after === 6, String(after));
  const fps = await G(page, () => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(n / 2); }; requestAnimationFrame(f); }));
  console.log(`info  headless software-rendered fps ≈ ${fps.toFixed(1)}`);
  const info = await G(page, () => { const r = window.__game.renderer.info.render; return { calls: r.calls, tris: r.triangles }; });
  console.log(`info  draw calls ${info.calls}, triangles ${info.tris}`);
  await page.context().close();
}

// ------------------------------------------------------------------ phone run (touch)
{
  const page = await newPage({ width: 844, height: 390 }, true);
  await page.goto(`${ORIGIN}/index.html`);
  await page.waitForSelector('.title-screen', { timeout: 30000 });
  await shot(page, '20-phone-title');
  await page.tap('.title-btns .tbtn-main');
  await page.waitForFunction(() => window.__game && window.__game.save && window.__game.state !== 'title', null, { timeout: 60000 });
  for (let i = 0; i < 30; i++) {
    const open = await G(page, () => window.__game.ui.dialogueOpen);
    if (!open) break;
    await page.tap('.dialogue');
    await sleep(60);
  }
  await sleep(600);
  check('touch controls visible', await page.isVisible('.t-attack'));
  await page.tap('.t-attack');
  await sleep(300);
  await shot(page, '21-phone-hud');
  await page.tap('.mbtn');
  await sleep(500);
  check('phone map opens by tap', (await G(page, () => window.__game.ui.menuName)) === 'map');
  await shot(page, '22-phone-map');
  await page.tap('.m-close');
  await sleep(200);
  await page.context().close();
}

await browser.close();
if (errors.length) {
  console.log('\nConsole errors:');
  for (const e of [...new Set(errors)].slice(0, 30)) console.log('  ', e);
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed, ${new Set(errors).size} console errors`);
process.exit(failed || errors.length ? 1 : 0);
