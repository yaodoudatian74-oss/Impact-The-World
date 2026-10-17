// Builds dist/game.html: one self-contained page (bundled JS and CSS inlined, three.js from the CDN).
// The same file is what gets published as the shareable web version.
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

const result = await esbuild.build({
  entryPoints: [path.join(root, 'src/main.js')],
  bundle: true,
  format: 'esm',
  minify: true,
  external: ['three'],
  write: false,
  target: 'es2020',
  legalComments: 'none',
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = read('style.css');
const html = read('index.html');
const title = html.match(/<title>[\s\S]*?<\/title>/)[0];
const fonts = html.match(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>/)[0];
const importmap = html.match(/<script type="importmap">[\s\S]*?<\/script>/)[0];
const body = html.match(/<body>([\s\S]*)<\/body>/)[1].replace(/<script type="module" src="src\/main\.js"><\/script>\s*/, '');

// Page fragment (the artifact host wraps it in its own document skeleton).
const fragment = `${title}
<meta name="theme-color" content="#120e1e">
${fonts}
<style>
${css}
</style>
${importmap}
${body.trim()}
<script type="module">
${js}
</script>
`;
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/game.html'), fragment);
console.log(`dist/game.html  ${(fragment.length / 1024).toFixed(0)} KB`);
