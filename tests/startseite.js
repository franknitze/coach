/* Die Startseite für Besucher: nur mit Schalter, und die Anmeldung darauf funktioniert. */

const { testlauf, PASSWORT } = require('./hilfen');
const fs = require('fs');

module.exports = (port) => testlauf('Startseite', port, async (t) => {
    const { page, ok, basis } = t;
    const config = t.datenordner + '/config.json';
    const ohneSchalter = JSON.parse(fs.readFileSync(config, 'utf8'));

    const schalter = (an) => {
        const c = Object.assign({}, ohneSchalter);
        if (an) {
            c.startseite = true;
        }
        fs.writeFileSync(config, JSON.stringify(c));
    };

    // Ohne Schalter: die schlichte Anmeldung, wie bei jeder Installation aus dem Repo
    schalter(false);
    await page.goto(basis + '/');
    ok(await page.locator('.einstieg').count() === 0, 'ohne Schalter keine Startseite');
    ok(await page.locator('#anmeldung').count() === 1, 'ohne Schalter die schlichte Anmeldung');
    ok(await page.locator('meta[name="robots"][content="noindex, nofollow"]').count() === 1,
       'ohne Schalter bleibt die Seite aus Suchmaschinen heraus');
    ok(await page.locator('meta[property^="og:"]').count() === 0, 'ohne Schalter kein Vorschaubild');

    // Favicon und Logo, auf beiden Anmeldeseiten
    // Am Inhalt geprüft, nicht am Status: Der eingebaute PHP-Server liefert
    // für eine fehlende Datei index.php mit 200 aus.
    const anfang = async (datei) => Buffer.from(await (await fetch(basis + datei)).arrayBuffer()).subarray(0, 8);
    ok((await anfang('/favicon.ico')).subarray(0, 4).equals(Buffer.from([0, 0, 1, 0])), '/favicon.ico ist ein Icon');
    ok((await anfang('/assets/icons/logo.svg')).toString().startsWith('<svg'), 'logo.svg ist ein SVG');
    ok((await anfang('/assets/icons/icon-32.png')).subarray(1, 4).toString() === 'PNG', 'icon-32.png ist ein PNG');
    ok(await page.locator('link[rel="icon"][href="assets/icons/logo.svg"]').count() === 1,
       'die schlichte Anmeldung verweist auf das Favicon');
    ok(await page.locator('.wortmarke img[src="assets/icons/logo.svg"]').count() === 1,
       'und zeigt das Logo im Kopf');

    // Mit Schalter
    schalter(true);
    await page.goto(basis + '/');
    ok(await page.locator('.einstieg').count() === 1, 'mit Schalter erscheint die Startseite');
    ok((await page.locator('h1').innerText()) === 'Die Trainings-App, die auch offline weiterarbeitet',
       'die Überschrift steht da');
    ok(await page.locator('link[rel="icon"][href="assets/icons/logo.svg"]').count() === 1,
       'die Startseite verweist auf das Favicon');
    ok(await page.locator('.marke img[src="assets/icons/logo.svg"]').count() === 1,
       'und zeigt das Logo im Kopf');
    ok(await page.locator('meta[name="robots"][content="index, follow"]').count() === 1,
       'die Startseite darf in Suchmaschinen');
    const og = (name) => page.locator(`meta[property="og:${name}"]`).getAttribute('content');
    ok((await og('image')) === basis + '/assets/img/og.png', 'das Vorschaubild steht mit voller Adresse da');
    ok((await anfang('/assets/img/og.png')).subarray(1, 4).toString() === 'PNG', 'og.png ist ein PNG');
    ok((await og('title')) === 'Coach · Die Trainings-App, die auch offline weiterarbeitet'
       && (await og('url')) === basis + '/', 'Titel und Adresse des Vorschaubilds stimmen');
    ok(await page.locator('meta[name="twitter:card"][content="summary_large_image"]').count() === 1,
       'das Vorschaubild wird groß angezeigt');
    ok(await page.locator('a[href="https://github.com/franknitze/coach"]').count() >= 2,
       'Verweise auf GitHub sind da');
    ok(await page.locator('a[href="https://tidycal.com/cato-services/erstgespraech"]').count() >= 2,
       'Verweise auf das Erstgespräch sind da');

    // Reihenfolge oben: Überschrift, Unterzeile, Knöpfe, dann die Anmeldung
    const reihe = await page.evaluate(() => ['.teaser', 'h1', '.unter', '.voraussetzung', '.aktionen--oben', '#anmeldung']
        .map((s) => document.querySelector(s).getBoundingClientRect().top));
    ok(reihe.every((y, i) => i === 0 || y > reihe[i - 1]),
       'oben stehen Aufhänger, Überschrift, Unterzeile, Voraussetzung, Knöpfe, Anmeldung untereinander');

    const zeilen = await page.$$eval('#beispiel tbody tr', (tr) => tr.map((r) => [...r.cells].map((c) => c.textContent.trim()).join(' | ')));
    ok(zeilen.length === 7 && zeilen[2] === '3 | 50 kg | 8 | 8, 8, 6 | Übung nicht geschafft'
       && zeilen[3] === '4 | 50 kg | 8 | 8, 8, 8 | Übung geschafft'
       && zeilen[6] === '7 | 55 kg | 6 | 6, 6, 6 | Übung geschafft, neues Gewicht',
       'die Beispieltabelle steht da, mit verfehlter Zeile und neuem Gewicht');

    await page.evaluate(() => document.querySelectorAll('img').forEach((i) => { i.loading = 'eager'; }));
    await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 15000 });
    const kaputt = await page.evaluate(() => [...document.images].filter((i) => i.naturalWidth === 0).map((i) => i.getAttribute('src')));
    ok(kaputt.length === 0, 'alle Bilder laden' + (kaputt.length ? ': ' + kaputt.join(', ') : ''));

    const symbole = await page.evaluate(() => [...document.querySelectorAll('use')]
        .filter((u) => !document.querySelector(u.getAttribute('href'))).length);
    ok(symbole === 0, 'jedes Symbol hat seine Vorlage im Sprite');

    const fremd = await page.evaluate(() => performance.getEntriesByType('resource')
        .map((r) => r.name).filter((n) => !n.startsWith(location.origin)));
    ok(fremd.length === 0, 'nichts wird von fremden Servern geladen' + (fremd.length ? ': ' + fremd.join(', ') : ''));

    ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
       'auf dem Handy läuft nichts seitlich über');

    // Falsches Passwort
    await page.fill('#passwort', 'falsch-falsch');
    await page.click('#anmelden');
    await page.waitForFunction(() => document.getElementById('fehler').textContent.length > 0);
    ok(await page.locator('#fehler').isVisible(), 'ein falsches Passwort meldet sich sichtbar');
    ok(await page.locator('.einstieg').count() === 1, 'und man bleibt auf der Startseite');

    // Richtiges Passwort
    await page.fill('#passwort', PASSWORT);
    await page.click('#anmelden');
    await page.waitForSelector('#app .heute__tag, #app .leer__titel', { timeout: 10000 });
    ok(await page.locator('.einstieg').count() === 0, 'nach der Anmeldung steht die App da, nicht die Startseite');

    // Ohne Passwort gewinnt die Einrichtung, auch mit Schalter
    await page.context().clearCookies();
    fs.writeFileSync(config, JSON.stringify({ startseite: true }));
    await page.goto(basis + '/');
    ok(await page.locator('#einrichtung').count() === 1, 'ohne Passwort erscheint die Einrichtung, auch mit Schalter');
    ok(await page.locator('.einstieg').count() === 0, 'und nicht die Startseite');

    fs.writeFileSync(config, JSON.stringify(ohneSchalter));
});
