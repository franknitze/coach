/* Phase 5: Manifest, Service Worker, Export. */

const { testlauf } = require('./hilfen');

module.exports = (port) => testlauf('PWA und Export', port, async (t) => {
    const { page, ok, basis } = t;

    /* ---------- Manifest ---------- */

    const manifest = await (await fetch(basis + '/manifest.json')).json();
    ok(manifest.display === 'standalone', 'Manifest startet ohne Browser-Leiste');
    ok(manifest.start_url === './' && manifest.scope === './',
       'Manifest liegt relativ, funktioniert also in jedem Unterordner');
    ok(manifest.theme_color === '#1b1e24', 'Themenfarbe ist der Studio-Grundton');
    ok(manifest.icons.every((i) => i.purpose.includes('maskable')),
       'Icons sind maskierbar, Android schneidet selbst zu');

    for (const icon of manifest.icons) {
        const antwort = await fetch(basis + '/' + icon.src);
        ok(antwort.ok && antwort.headers.get('content-type') === 'image/png',
           icon.src + ' wird ausgeliefert');
    }

    /* ---------- Versionierung ---------- */

    await t.anmelden();

    const css = await page.locator('link[rel=stylesheet]').getAttribute('href');
    ok(/\?v=\d{9,}/.test(css), 'CSS trägt die Dateizeit als Version: ' + css);
    ok(await page.locator('link[rel=manifest]').count() === 1, 'Manifest ist verlinkt');
    ok(await page.locator('link[rel=apple-touch-icon]').count() === 1, 'Homescreen-Symbol für iOS');

    /* ---------- Service Worker ---------- */

    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null,
        { timeout: 10000 });
    ok(true, 'Service Worker ist aktiv und steuert die Seite');

    const imCache = await page.evaluate(async () => {
        const namen = await caches.keys();
        const cache = await caches.open(namen[0]);
        return (await cache.keys()).map((r) => new URL(r.url).pathname);
    });
    ok(imCache.some((p) => p.endsWith('/assets/app.css')), 'CSS liegt im Cache');
    ok(imCache.some((p) => p.endsWith('/assets/app.js')), 'JS liegt im Cache');
    ok(imCache.some((p) => p.includes('icon-192')), 'Icon liegt im Cache');

    /* ---------- Die API darf niemals aus dem Cache kommen ---------- */

    await page.click('[data-gehe="plan"]');
    await page.waitForSelector('.zeile');

    const apiImCache = await page.evaluate(async () => {
        const namen = await caches.keys();
        const cache = await caches.open(namen[0]);
        return (await cache.keys()).map((r) => r.url).filter((u) => u.includes('/api/'));
    });
    ok(apiImCache.length === 0,
       'kein einziger API-Aufruf im Cache, sonst zeigte die App veraltete Sätze');

    /* ---------- Ohne Netz ---------- */

    t.konsoleErlauben(/ERR_INTERNET_DISCONNECTED/);   // gleich absichtlich

    await page.context().setOffline(true);
    await page.reload();
    ok(await page.locator('.wortmarke').count() === 1,
       'ohne Netz startet die Hülle trotzdem');

    const meldung = (await page.locator('#app').innerText()).trim();
    ok(meldung.includes('Keine Verbindung'),
       'und sagt auf Deutsch, woran es liegt: "' + meldung.split('\n')[0] + '"');
    ok(!/Failed to fetch/i.test(meldung), 'kein englischer Browsertext auf dem Bildschirm');

    await page.context().setOffline(false);

    /* ---------- Export ---------- */

    const ohne = await fetch(basis + '/api/export.php');
    ok(ohne.status === 401, 'Export ohne Schlüssel: 401');

    const falsch = await fetch(basis + '/api/export.php?key=falsch');
    ok(falsch.status === 401, 'Export mit falschem Schlüssel: 401');

    const perPost = await fetch(basis + '/api/export.php', { method: 'POST' });
    ok(perPost.status === 405, 'Export nur per GET');

    const mitHeader = await fetch(basis + '/api/export.php',
        { headers: { 'X-API-Key': 'testschluessel' } });
    ok(mitHeader.status === 200, 'Export mit Schlüssel im Header: 200');

    const daten = await mitHeader.json();
    ok(!('password_hash' in daten.settings) && !('api_key' in daten.settings),
       'der Export trägt keine Geheimnisse in das Backup');
    ok(daten.exercises && Object.keys(daten.exercises).length === 4,
       'alle Übungen sind im Export');
    ok(typeof daten.summary.sessions === 'number', 'Export nennt die Zahl der Einheiten');

    const perQuery = await fetch(basis + '/api/export.php?key=testschluessel');
    ok(perQuery.status === 200, 'der in SPEC.md §9 genannte Weg über ?key= geht weiter');
});
