// Fotografiert die Entwürfe in Desktop- und Handybreite, ganze Seite.
const fs = require('fs'), os = require('os'), path = require('path');
const cache = path.join(os.homedir(), '.npm', '_npx');
const pw = fs.readdirSync(cache).map(d => path.join(cache, d, 'node_modules', 'playwright'))
  .filter(p => fs.existsSync(p)).map(p => ({ v: require(p + '/package.json').version, p }))
  .sort((a, b) => b.v.localeCompare(a.v, undefined, { numeric: true }))[0];
const { chromium } = require(pw.p);
const dir = path.resolve(__dirname, '..');
const aus = process.argv[2] || '/tmp/entwuerfe';
fs.mkdirSync(aus, { recursive: true });
(async () => {
  const b = await chromium.launch({ channel: 'chrome' });
  for (const f of fs.readdirSync(dir).filter(f => /^entwurf-.*\.html$/.test(f))) {
    for (const [w, h, s] of [[1440, 900, 1], [390, 844, 2]]) {
      const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: s });
      p.on('pageerror', e => console.log(f, 'FEHLER', e.message));
      await p.goto('file://' + path.join(dir, f), { waitUntil: 'networkidle' });
      await p.evaluate(async () => { document.querySelectorAll('img').forEach(i => i.loading = 'eager'); await Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => i.onload = i.onerror = r))); });
      const ueber = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      const leer = await p.evaluate(() => [...document.querySelectorAll('i[class*="ph-"]')].filter(i => getComputedStyle(i, '::before').content === 'none' || getComputedStyle(i, '::before').content === '""').map(i => i.className));
      await p.waitForTimeout(400);
      await p.screenshot({ path: path.join(aus, f.replace('.html', `-${w}.png`)), fullPage: true });
      console.log(f, w, 'seitlicher Überlauf', ueber, 'leere Symbole', leer.join(',') || 'keine');
      await p.close();
    }
  }
  await b.close();
})();
