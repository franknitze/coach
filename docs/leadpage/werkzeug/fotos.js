// Bildschirmfotos aller Ansichten der Live-App im iPhone-Format (390 x 844, 3x).
// Alle schreibenden API-Aufrufe werden abgefangen: Es entstehen keine Trainingsdaten.
const fs = require('fs'), os = require('os'), path = require('path');
const cache = path.join(os.homedir(), '.npm', '_npx');
const pw = fs.readdirSync(cache).map(d => path.join(cache, d, 'node_modules', 'playwright'))
  .filter(p => fs.existsSync(p)).map(p => ({ v: require(p + '/package.json').version, p }))
  .sort((a, b) => b.v.localeCompare(a.v, undefined, { numeric: true }))[0];
const { chromium } = require(pw.p);
const SID = fs.readFileSync('/tmp/coach_sid', 'utf8').trim();
const ZIEL = path.join(__dirname, '..', 'screenshots');
const nur = process.argv[2];

async function neu(browser, angemeldet) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, colorScheme: 'dark', locale: 'de-DE' });
  if (angemeldet) await ctx.addCookies([{ name: 'coach', value: SID, domain: 'coach.nitze.io', path: '/', secure: true, httpOnly: true }]);
  await ctx.route('**/api/**', route => {
    if (route.request().method() === 'GET') return route.continue();
    if (!angemeldet) return route.abort();
    console.log('  abgefangen', route.request().method(), route.request().url().split('/api/')[1]);
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('  FEHLER', e.message));
  await page.goto('https://coach.nitze.io/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  return page;
}
async function foto(page, name, oben = true) {
  if (oben) await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(async () => {
    const bilder = [...document.images];
    bilder.forEach(i => { i.loading = 'eager'; });
    await Promise.all(bilder.map(i => i.complete ? null : new Promise(r => { i.onload = i.onerror = r; })));
  });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(ZIEL, name + '.png') });
  console.log('foto', name);
}
async function knoepfe(page) {
  return page.$$eval('button, a, img, [data-uebung]', els => els.filter(e => e.offsetParent).map(e => e.tagName + ' ' + [...e.attributes].filter(a => a.name.startsWith('data-') || a.name === 'class').map(a => a.name + '=' + a.value).join(' ') + ' | ' + (e.innerText || '').replace(/\s+/g, ' ').slice(0, 50)));
}
const SCHRITTE = {
  async anmelden(b) { const p = await neu(b, false); await foto(p, '01-anmelden'); },
  async start(b) { const p = await neu(b, true); await foto(p, '02-start'); },
  async studio(b) {
    const p = await neu(b, true);
    await p.click('[data-gehe="studio"]'); await foto(p, '03-studio');
    if (nur) console.log((await knoepfe(p)).join('\n'));
  },
  async satz(b) {
    const p = await neu(b, true);
    await p.click('[data-gehe="studio"]');
    await p.click('[data-bestaetige]'); await p.waitForTimeout(1500); await foto(p, '04-pause', false);
  },
  async lupe(b) {
    const p = await neu(b, true);
    await p.click('[data-gehe="studio"]');
    await p.click('.ist-offen [data-foto]'); await foto(p, '05-lupe', false);
  },
  async einheit(b) {
    const p = await neu(b, true);
    await p.click('[data-einheit^="2026-10-14"]'); await foto(p, '06-einheit');
    if (nur) console.log((await knoepfe(p)).join('\n'));
  },
  async kalender(b) {
    const p = await neu(b, true);
    await p.click('[data-gehe="kalender"]'); await foto(p, '07-kalender');
  },
  async plan(b) {
    const p = await neu(b, true);
    await p.click('[data-gehe="plan"]'); await foto(p, '08-einstellungen');
    if (nur) console.log((await knoepfe(p)).join('\n'));
  },
  async verlauf(b) {
    const p = await neu(b, true);
    await p.click('[data-einheit^="2026-10-14"]');
    await p.click('[data-bearbeite="beinpresse"]'); await p.waitForTimeout(800); await foto(p, '09-verlauf');
    await p.evaluate(() => window.scrollTo(0, 700)); await foto(p, '10-verlauf-unten', false);
    if (nur) console.log((await knoepfe(p)).join('\n'));
  },
  async allgemein(b) {
    const p = await neu(b, true);
    await p.click('[data-gehe="plan"]'); await p.click('[data-bereich="allgemein"]'); await foto(p, '11-allgemein');
  },
};
(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  for (const [n, f] of Object.entries(SCHRITTE)) if (!nur || nur === n) await f(browser);
  await browser.close();
})();
