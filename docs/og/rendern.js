// Rendert die OG-Entwürfe als PNG (1200x630) über das installierte Chrome.
const path = require('path');
const fs = require('fs'), os = require('os');
// Playwright liegt nur im npx-Cache; die neueste Fassung nehmen (wie tests/hilfen.js).
function playwright() {
  const cache = path.join(os.homedir(), '.npm', '_npx');
  const kandidaten = fs.readdirSync(cache)
    .map(o => path.join(cache, o, 'node_modules', 'playwright'))
    .filter(p => fs.existsSync(p))
    .map(p => ({ p, v: require(path.join(p, 'package.json')).version.split('.').map(Number) }))
    .sort((a, b) => b.v[0] - a.v[0] || b.v[1] - a.v[1] || b.v[2] - a.v[2]);
  return require(kandidaten[0].p);
}
(async () => {
  const { chromium } = playwright();
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  for (const n of ['a', 'b', 'b2', 'c']) {
    await page.goto('file://' + path.join(__dirname, `entwurf-${n}.html`));
    await page.screenshot({ path: path.join(__dirname, `entwurf-${n}.png`) });
  }
  await browser.close();
})();
