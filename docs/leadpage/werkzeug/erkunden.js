// Erkundet die Live-App und legt Bildschirmfotos ab. Schreibende Aufrufe
// werden abgefangen und beantwortet, damit keine Trainingsdaten entstehen.
const fs = require('fs'), os = require('os'), path = require('path');
const cache = path.join(os.homedir(), '.npm', '_npx');
const pw = fs.readdirSync(cache).map(d => path.join(cache, d, 'node_modules', 'playwright'))
  .filter(p => fs.existsSync(p)).map(p => ({ v: require(p + '/package.json').version, p }))
  .sort((a, b) => b.v.localeCompare(a.v, undefined, { numeric: true }))[0];
const { chromium } = require(pw.p);
const SID = fs.readFileSync('/tmp/coach_sid', 'utf8').trim();
const ZIEL = path.join(__dirname, '..', 'screenshots');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, colorScheme: 'dark' });
  await ctx.addCookies([{ name: 'coach', value: SID, domain: 'coach.nitze.de', path: '/', secure: true, httpOnly: true }]);
  await ctx.route('**/api/**', route => {
    const m = route.request().method();
    if (m === 'GET') return route.continue();
    console.log('ABGEFANGEN', m, route.request().url());
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('FEHLER', e.message));
  await page.goto('https://coach.nitze.de/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(ZIEL, 'roh-start.png'), fullPage: true });
  const knoepfe = await page.$$eval('button, a, [data-einheit], [data-tag]', els => els.map(e => (e.tagName + ' ' + [...e.attributes].filter(a => a.name.startsWith('data-')).map(a => a.name + '=' + a.value).join(' ') + ' | ' + e.innerText.replace(/\s+/g, ' ').slice(0, 60))));
  console.log(knoepfe.join('\n'));
  await browser.close();
})();
