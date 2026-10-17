const browser = Object.fromEntries([
  'window', 'document', 'navigator', 'location', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'clearTimeout',
  'setInterval', 'clearInterval', 'addEventListener', 'removeEventListener', 'innerWidth', 'innerHeight', 'devicePixelRatio', 'matchMedia',
  'localStorage', 'atob', 'btoa', 'console', 'structuredClone', 'URL', 'self', 'caches', 'fetch', 'ImageData',
].map((k) => [k, 'readonly']));
const node = Object.fromEntries(['process', 'console', 'Buffer'].map((k) => [k, 'readonly']));

export default [
  { ignores: ['node_modules/**', 'dist/**'] },
  {
    files: ['src/**/*.js', 'sw.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: browser },
    rules: { 'no-undef': 'error', 'no-unused-vars': ['error', { args: 'after-used', argsIgnorePattern: '^_' }], 'no-unreachable': 'error', 'no-dupe-keys': 'error', 'no-redeclare': 'error' },
  },
  {
    files: ['tools/**/*.mjs', 'tests/**/*.mjs', 'eslint.config.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...node, ...browser } },
    rules: { 'no-undef': 'error', 'no-unused-vars': 'error' },
  },
];
