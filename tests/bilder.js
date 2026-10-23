/* Fotos hochladen und einer Übung zuordnen. */

const { testlauf } = require('./hilfen');
const fs = require('fs');
const path = require('path');

module.exports = (port) => testlauf('Bilder', port, async (t) => {
    const { page, ok } = t;

    await t.anmelden();
    await t.menue('plan');
    await page.waitForSelector('.zeile');
    await page.locator('.zeile').first().click();
    await page.waitForSelector('.editor');

    /* ---------- Auswahl statt Dateiname ---------- */

    ok(await page.locator('#bildwahl').count() === 1, 'die Bildauswahl ist da');
    ok(await page.locator('#e-upload').count() === 1, 'und ein Knopf zum Hochladen');
    ok(await page.locator('input[name="photo"][type="hidden"]').count() === 1,
       'die Zuordnung liegt in einem versteckten Feld, kein Dateiname zu tippen');

    const vorher = await page.locator('.bildwahl__stueck').count();

    /* ---------- Hochladen ---------- */

    // Ein echtes, aufrecht stehendes JPEG erzeugen, damit auch das Drehen
    // und Verkleinern durchlaufen wird.
    const quelle = path.resolve(__dirname, '../images');
    const originale = fs.readdirSync(quelle).filter((f) => /\.jpe?g$/i.test(f));
    ok(originale.length > 0, 'Originalfotos zum Testen vorhanden');

    await page.locator('#e-upload').setInputFiles(path.join(quelle, originale[0]));
    await page.waitForFunction((n) =>
        document.querySelectorAll('.bildwahl__stueck').length === n + 1, vorher,
        { timeout: 30000 });
    ok(true, 'das hochgeladene Foto steht sofort in der Auswahl');

    const gewaehlt = await page.locator('input[name="photo"]').inputValue();
    ok(/^foto-\d{8}-\d{6}-[0-9a-f]{6}\.jpg$/.test(gewaehlt),
       'es ist gleich ausgewählt, unter eigenem Namen: ' + gewaehlt);

    const abgelegt = path.resolve(__dirname, '../assets/img/exercises', gewaehlt);
    ok(fs.existsSync(abgelegt), 'die Datei liegt bei den Gerätefotos');

    const beschreibung = require('child_process')
        .execFileSync('file', [abgelegt]).toString();
    ok(!/GPS-Data/.test(beschreibung),
       'ohne GPS-Koordinaten, obwohl das Original welche hatte');

    // file(1) nennt zuerst die Auflösungsangabe in dpi, nicht die
    // Abmessung. getimagesize liest sie zuverlässig.
    const masse = require('child_process').execFileSync('php', ['-r',
        'list($w,$h) = getimagesize($argv[1]); echo $w . "x" . $h;',
        abgelegt]).toString();
    const kante = Math.max.apply(null, masse.split('x').map(Number));
    ok(kante <= 1600 && kante > 100,
       'auf eine sinnvolle Kantenlänge gebracht: ' + masse);

    /* ---------- Zuordnung speichern ---------- */

    await page.click('.editor button[type="submit"]');
    await page.waitForSelector('.zeile');

    const gespeichert = JSON.parse(
        fs.readFileSync(t.datenordner + '/exercises.json', 'utf8'));
    const mitFoto = Object.values(gespeichert).filter((u) => u.photo === gewaehlt);
    ok(mitFoto.length === 1, 'die Zuordnung steht in exercises.json');

    /* ---------- Abwählen geht auch ---------- */

    await page.locator('.zeile').first().click();
    await page.waitForSelector('.editor');
    await page.locator('.bildwahl__keins').click();
    ok(await page.locator('input[name="photo"]').inputValue() === '',
       '"kein Foto" hebt die Zuordnung wieder auf');

    /* ---------- Bild wieder löschen ---------- */

    const weg = page.locator('[data-bildweg="' + gewaehlt + '"]');
    ok(await weg.count() === 1, 'jedes Bild hat einen Löschknopf');

    await weg.click();
    await page.waitForFunction((n) =>
        document.querySelector('[data-bildweg="' + n + '"]').textContent.includes('wirklich'),
        gewaehlt);
    ok(true, 'erster Tipp fragt nach');

    await page.locator('[data-bildweg="' + gewaehlt + '"]').click();
    await page.waitForFunction((n) =>
        document.querySelectorAll('[data-bildweg="' + n + '"]').length === 0, gewaehlt,
        { timeout: 10000 });
    ok(true, 'zweiter Tipp löscht');
    ok(!fs.existsSync(abgelegt), 'die Datei ist vom Server verschwunden');

    const danach = JSON.parse(
        fs.readFileSync(t.datenordner + '/exercises.json', 'utf8'));
    ok(Object.values(danach).every((u) => u.photo !== gewaehlt),
       'und keine Übung zeigt mehr auf das gelöschte Bild');
});
