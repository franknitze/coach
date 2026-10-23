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

    /* ---------- Eine geänderte Datei muss durchkommen ----------
     *
     * index.php hängt CSS und JS die Dateizeit an. Eine geänderte Datei hat
     * also eine andere URL und darf NICHT aus dem Cache bedient werden.
     * Vorher schlug der Service Worker mit ignoreSearch nach, fand den
     * alten Eintrag und lieferte ihn aus: jede Änderung war beim ersten
     * Laden unsichtbar. Der Test legt eine Attrappe unter der
     * unversionierten URL ab und prüft, dass sie nicht ausgeliefert wird.
     */

    await page.evaluate(async () => {
        const cache = await caches.open((await caches.keys())[0]);
        await cache.put('assets/app.js',
            new Response('/* ALTE FASSUNG */', { headers: { 'Content-Type': 'text/javascript' } }));
    });

    const geliefert = await page.evaluate(async () =>
        (await fetch('assets/app.js?v=999999999')).text());

    ok(!geliefert.includes('ALTE FASSUNG'),
       'mit Netz kommt nichts aus dem Cache, auch nicht bei passendem Eintrag');
    ok(geliefert.includes('zeichneStudio'),
       'ausgeliefert wird die echte Datei vom Server');

    // Und ohne Netz greift der Notnagel doch, sonst startet die App im
    // Funkloch nicht.
    await page.context().setOffline(true);
    const ohneNetz = await page.evaluate(async () => {
        try { return await (await fetch('assets/app.js')).text(); }
        catch (e) { return 'FEHLGESCHLAGEN'; }
    });
    ok(ohneNetz.includes('ALTE FASSUNG'),
       'ohne Netz wird der Cache-Eintrag doch bedient (Notnagel)');
    await page.context().setOffline(false);

    /* ---------- Die API darf niemals aus dem Cache kommen ---------- */

    await t.menue('plan');
    await page.waitForSelector('.zeile');

    const apiImCache = await page.evaluate(async () => {
        const namen = await caches.keys();
        const cache = await caches.open(namen[0]);
        return (await cache.keys()).map((r) => r.url).filter((u) => u.includes('/api/'));
    });
    ok(apiImCache.length === 0,
       'kein einziger API-Aufruf im Cache, sonst zeigte die App veraltete Sätze');

    /* ---------- Ohne Netz ---------- */

    // Gleich absichtlich. ERR_FAILED kommt von der Route-Sperre unten,
    // ERR_INTERNET_DISCONNECTED vom abgeschalteten Netz.
    t.konsoleErlauben(/ERR_INTERNET_DISCONNECTED|ERR_FAILED/);

    /*
     * Drei Sperren, und jede deckt etwas anderes ab.
     *
     * setOffline() allein genügt hier nicht: Wird die Seite nach dem
     * Neuladen vom Service Worker aus dem Cache bedient, meldet
     * navigator.onLine in Playwright 1.62 weiter true — und die
     * Statusleiste hängt genau daran. Das ist eine Grenze des Werkzeugs,
     * kein Befund über die App; auf dem iPhone setzt Safari die
     * Eigenschaft korrekt.
     *
     * addInitScript wirkt vor jedem Skript der Seite, also auch vor dem
     * ersten statusZeichnen() beim Hochfahren. Die Route-Sperre sorgt
     * zusätzlich dafür, dass API-Aufrufe wirklich scheitern, statt nur so
     * auszusehen.
     */
    await page.context().addInitScript(() => {
        Object.defineProperty(navigator, 'onLine', { get: () => false });
    });
    await page.context().route('**/api/**', function (route) { return route.abort(); });
    await page.context().setOffline(true);
    await page.reload();
    ok(await page.locator('.wortmarke').count() === 1,
       'ohne Netz startet die Hülle trotzdem');

    ok((await page.locator('.heute__tag').innerText()) === 'Oberkörper',
       'und zeigt den gemerkten Trainingstag statt einer Fehlermeldung');
    ok(await page.locator('#anmeldung').count() === 0,
       'und nicht die Anmeldeseite, die sich ohne Netz gar nicht abschicken ließe');

    const status = await page.locator('#status').innerText();
    ok(status.includes('Ohne Netz'), 'die Statusleiste sagt Bescheid: "' + status + '"');
    ok(!/Failed to fetch/i.test(await page.locator('body').innerText()),
       'nirgends englischer Browsertext auf dem Bildschirm');

    await page.context().unroute('**/api/**');
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
