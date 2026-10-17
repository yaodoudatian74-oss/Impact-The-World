// Story playthrough: drives all 12 chapters through the real quest system (talk, travel, defeat,
// collect, boss) by teleporting the party and stepping the simulation directly, then checks that
// every chapter recruited its character and the final chapter ends the game.
// Usage: node tools/playthrough.mjs
import { launch, newPage, ORIGIN } from './browser.mjs';

const browser = await launch();
const errors = [];
const page = await newPage(browser, { errors });
await page.goto(`${ORIGIN}/index.html`);
await page.waitForSelector('.title-screen', { timeout: 30000 });
await page.click('.title-btns .tbtn-main');
await page.waitForFunction(() => window.__game && window.__game.state !== 'title' && window.__game.save, null, { timeout: 60000 });

const out = await page.evaluate(() => {
  const g = window.__game;
  const log = [];
  const problems = [];
  const step = (n) => { for (let i = 0; i < n; i++) { if (g.state === 'play') g.tick(1 / 60); } };
  const flush = () => {
    for (let k = 0; k < 600; k++) {
      if (g.ui.dialogueOpen) g.ui.advanceDialogue();
      else if (g.state === 'reward') g.ui.closeReward();
      else break;
    }
  };
  const tp = (x, z) => {
    g.player.teleport(x, z, g.world.realm.mode === 'underwater' ? g.world.groundY(x, z) + 2 : null);
    g.player.invulnUntil = 1e9;
  };
  flush();
  g.player.invulnUntil = 1e9;
  let last = '';
  let stuck = 0;
  for (let guard = 0; guard < 300; guard++) {
    flush();
    const ch = g.quests.trackedChapter();
    if (!ch) break;
    const st = g.save.story[ch.id];
    const sig = `${ch.id}:${st.status}:${st.step}`;
    if (sig === last) { if (++stuck > 4) { problems.push(`stuck at ${sig}`); break; } } else stuck = 0;
    last = sig;
    if (g.world.realm.id !== ch.realm) {
      if (!g.save.realms.includes(ch.realm)) { problems.push(`${ch.realm} not unlocked for ${ch.id}`); break; }
      const [x, z] = g.realmSpawn(ch.realm);
      g.enterRealm(ch.realm, x, z);
      g.state = 'play';
      flush();
    }
    if (st.status === 'available') {
      const npc = g.npcs.get(ch.steps[0].npc.id);
      if (!npc) { problems.push(`no giver for ${ch.id}`); break; }
      tp(npc.x, npc.z + 2);
      if (g.interactable()?.kind !== 'npc') problems.push(`giver ${npc.name} not interactable`);
      g.quests.talkTo(npc);
      flush();
      continue;
    }
    const s = ch.steps[st.step];
    const key = `${ch.id}:${st.step}`;
    if (s.type === 'talk') {
      const npc = g.npcs.get(s.npc.id);
      if (!npc) { problems.push(`no npc ${s.npc.id} for ${key}`); break; }
      tp(npc.x, npc.z + 2);
      g.quests.talkTo(npc);
      flush();
    } else if (s.type === 'goto') {
      tp(s.x, s.z);
      step(3);
      flush();
    } else if (s.type === 'defeat') {
      tp(s.x + 3, s.z);
      for (let k = 0; k < 60 && g.save.story[ch.id].step === st.step && g.save.story[ch.id].status === 'active'; k++) {
        step(3);
        const mine = g.enemies.list.filter((e) => e.quest === key && !e.dead);
        if (k === 1 && !mine.length) problems.push(`no quest enemies spawned at ${key}`);
        for (const e of mine) g.combat.hitEnemy(e, { member: g.player.active, mult: 1e6, kind: 'normal', element: null });
        step(45);
      }
      flush();
    } else if (s.type === 'collect') {
      for (const [x, z] of s.points) { tp(x, z); step(3); flush(); }
    } else if (s.type === 'boss') {
      tp(s.x + 25, s.z);
      step(3);
      flush();
      const boss = g.enemies.list.find((e) => e.quest === key && e.boss && !e.dead);
      if (!boss) { problems.push(`boss did not spawn at ${key}`); break; }
      g.combat.hitEnemy(boss, { member: g.player.active, mult: 1e7, kind: 'skill', element: null });
      step(130);
      flush();
    }
    if (g.save.story[ch.id].status === 'done') log.push({ ch: ch.id, recruit: ch.reward, roster: Object.keys(g.save.roster).length, realms: g.save.realms.length, level: g.save.roster.allen.lv });
  }
  return {
    log, problems,
    done: Object.values(g.save.story).filter((s) => s.status === 'done').length,
    roster: Object.keys(g.save.roster).length,
    realms: g.save.realms,
    cleared: g.save.cleared,
  };
});

console.table(out.log);
for (const p of out.problems) console.log('PROBLEM', p);
console.log(`chapters done ${out.done}/12, roster ${out.roster}/17, realms ${out.realms.length}/6, cleared ${out.cleared}`);
if (errors.length) { console.log('Console errors:'); for (const e of [...new Set(errors)].slice(0, 20)) console.log('  ', e); }
await browser.close();
const ok = out.done === 12 && out.roster === 17 && out.realms.length === 6 && out.cleared && !out.problems.length && !errors.length;
console.log(ok ? 'PLAYTHROUGH OK' : 'PLAYTHROUGH FAILED');
process.exit(ok ? 0 : 1);
