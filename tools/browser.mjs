// Shared headless-browser harness: serves the repo from a fake origin, maps the three.js CDN URL
// to node_modules, stubs web fonts, and collects console errors.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ORIGIN = 'http://itw.test';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };

export async function launch() {
  let chromium;
  try { ({ chromium } = await import('playwright')); } catch {
    ({ chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright'));
  }
  return chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
}

export async function newPage(browser, { viewport = { width: 1280, height: 720 }, touch = false, entry = '/index.html', errors = [] } = {}) {
  const ctx = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[console] ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === 'cdn.jsdelivr.net' && url.pathname.includes('/three@')) {
      return route.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(path.join(root, 'node_modules/three/build/three.module.min.js')) });
    }
    if (url.hostname.includes('fonts.')) return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    if (url.origin === ORIGIN) {
      let p = decodeURIComponent(url.pathname);
      if (p === '/' || p === '/index.html') p = entry;
      const f = path.join(root, p);
      if (fs.existsSync(f)) return route.fulfill({ status: 200, contentType: TYPES[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
      return route.fulfill({ status: 404, body: 'not found' });
    }
    return route.abort();
  });
  return page;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
