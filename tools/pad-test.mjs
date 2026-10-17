// Gamepad test: installs a fake standard-mapping pad (Xbox layout) in the page and drives the real
// game and menus with it. Covers title, dialogue, movement, jump, character cycling, burst, menus.
// Usage: node tools/pad-test.mjs
import { launch, newPage, ORIGIN, sleep } from './browser.mjs';

const browser = await launch();
const errors = [];
const page = await newPage(browser, { errors });
await page.addInitScript(() => {
  const pad = {
    id: 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)',
    connected: true, mapping: 'standard', axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  window.__pad = pad;
  navigator.getGamepads = () => [pad];
});
await page.goto(`${ORIGIN}/index.html`);
await page.waitForSelector('.title-screen', { timeout: 30000 });

const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const G = (fn) => page.evaluate(fn);
const setBtn = (i, on) => page.evaluate(([i, on]) => { window.__pad.buttons[i] = { pressed: on, value: on ? 1 : 0 }; }, [i, on]);
const setAxes = (x, y) => page.evaluate(([x, y]) => { window.__pad.axes[0] = x; window.__pad.axes[1] = y; }, [x, y]);
// Holds a button long enough for a frame to see it (headless frames can take several hundred ms; real pads poll at 60 Hz).
async function tap(i, ms = 700) { await setBtn(i, true); await sleep(ms); await setBtn(i, false); await sleep(250); }
const PAD = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, RT: 7, SELECT: 8, START: 9, UP: 12, DOWN: 13 };

// Title: the first button gets focus; A presses it.
await sleep(400);
await tap(PAD.A);
await page.waitForFunction(() => window.__game && window.__game.save && window.__game.state !== 'title', null, { timeout: 60000 });
check('A on title starts a new game', true);

// Skip the prologue with A.
// Headless frames are slow (~7 fps), so each press is held long enough for a poll to see it.
for (let i = 0; i < 80; i++) {
  if (!(await G(() => window.__game.ui.dialogueOpen))) break;
  await tap(PAD.A, 700);
}
await page.waitForFunction(() => !window.__game.ui.dialogueOpen && window.__game.state === 'play', null, { timeout: 15000 }).catch(() => {});
check('A advances dialogue to the end', !(await G(() => window.__game.ui.dialogueOpen)));

// Left stick walks forward.
const p0 = await G(() => window.__game.player.pos.toArray());
await setAxes(0, -1);
await sleep(1200);
await setAxes(0, 0);
const p1 = await G(() => window.__game.player.pos.toArray());
check('left stick moves the player', Math.hypot(p1[0] - p0[0], p1[2] - p0[2]) > 2, `moved ${Math.hypot(p1[0] - p0[0], p1[2] - p0[2]).toFixed(1)}`);

// A jumps when nothing is in reach.
await G(() => { window.__game.npcs.list.forEach((n) => { n.x = 1e4; n.z = 1e4; }); });
await setBtn(PAD.A, true);
let air = false;
for (let i = 0; i < 12 && !air; i++) { await sleep(60); air = await G(() => window.__game.player.mode === 'air'); }
await setBtn(PAD.A, false);
check('A jumps', air);

// LB / RB cycle characters.
// A press can fall inside a headless frame stall; retry only until the switch is seen, so it never double-switches.
for (let k = 0; k < 3 && (await G(() => window.__game.player.activeIdx)) !== 1; k++) { await tap(PAD.RB); await sleep(400); }
const idx1 = await G(() => window.__game.player.activeIdx);
check('RB switches to the next character', idx1 === 1, `active ${idx1}`);
await sleep(1000); // character switching has a 0.8 s cooldown
await tap(PAD.LB);
await sleep(300);
check('LB switches back', (await G(() => window.__game.player.activeIdx)) === 0);

// RT attacks (held), Y bursts when energy is full.
await G(() => { window.__game.player.active.energy = 100; });
await tap(PAD.Y);
const energy = await G(() => window.__game.player.active.energy);
check('Y fires the burst', energy === 0, `energy ${energy}`);

// Start opens the pause menu; B closes it.
await sleep(600);
await setBtn(PAD.START, true);
const startOpened = await page.waitForFunction(() => window.__game.ui.menuName === 'pause', null, { timeout: 4000 }).then(() => true, () => false);
await setBtn(PAD.START, false);
check('Start opens the menu', startOpened);
await sleep(3000); // menus draw character portraits, which stalls headless frames for a moment
for (let k = 0; k < 3 && (await G(() => window.__game.ui.menuName)); k++) { await tap(PAD.B); await sleep(500); }
const closed = await page.waitForFunction(() => !window.__game.ui.menuName, null, { timeout: 4000 }).then(() => true, () => false);
check('B closes the menu', closed);

// Select opens the map; D-pad moves focus through the realm tabs; A clicks the focused control.
await sleep(300);
await sleep(500);
await setBtn(PAD.SELECT, true);
const mapOpened = await page.waitForFunction(() => window.__game.ui.menuName === 'map', null, { timeout: 4000 }).then(() => true, () => false);
await setBtn(PAD.SELECT, false);
check('Select opens the map', mapOpened);
await sleep(2500); // opening the map finishes its image in one go, which stalls frames for a moment
await tap(PAD.RB);
await sleep(200);
const tabName = await G(() => window.__game.ui.menuName);
check('RB moves to the next menu tab', tabName === 'party', `menu ${tabName}`);
await tap(PAD.DOWN);
const focused = await G(() => document.querySelector('.gp-focus')?.textContent || '');
check('D-pad moves focus in menus', focused.length > 0, `focus ${focused}`);
await tap(PAD.B);

// Potion via D-pad up (no effect at full HP, but must not error).
await tap(PAD.UP);

console.log(errors.length ? `console errors: ${errors.slice(0, 5).join(' | ')}` : 'no console errors');
await browser.close();
const ok = results.every(Boolean) && !errors.length;
console.log(`${results.filter(Boolean).length}/${results.length} checks passed`);
process.exit(ok ? 0 : 1);
