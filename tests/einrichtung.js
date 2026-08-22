/* Die einmalige Einrichtung: Passwort setzen, danach abgeschaltet. */

const { testlauf } = require('./hilfen');
const fs = require('fs');

module.exports = (port) => testlauf('Einrichtung', port, async (t) => {
    const { page, ok, basis } = t;

    /*
     * Ausgangslage herstellen: wirklich leer, nicht nur ohne Passwort.
     *
     * Der Testlauf legt sonst schon Plan und Übungen an, und setup.php
     * überspringt vorhandene Dateien zu Recht. Um zu prüfen, was eine
     * frische Installation bekommt, müssen alle drei weg.
     */
    const config = t.datenordner + '/config.json';
    const gesichert = fs.readFileSync(config, 'utf8');
    const beiseite = {};

    for (const datei of ['config.json', 'plan.json', 'exercises.json']) {
        const pfad = t.datenordner + '/' + datei;
        beiseite[datei] = fs.readFileSync(pfad, 'utf8');
        fs.unlinkSync(pfad);
    }

    await page.goto(basis + '/');
    ok(await page.locator('#einrichtung').count() === 1, 'ohne Passwort erscheint die Einrichtung');
    ok(await page.locator('#anmeldung').count() === 0, 'und nicht die Anmeldung');

    // Zu kurz
    await page.fill('#passwort', 'kurz');
    await page.fill('#passwort2', 'kurz');
    await page.click('#einrichten');
    await page.waitForFunction(() => document.getElementById('fehler').textContent.length > 0);
    ok((await page.locator('#fehler').innerText()).includes('8 Zeichen'),
       'zu kurzes Passwort wird abgewiesen');

    // Tippfehler in der Wiederholung
    await page.fill('#passwort', 'langgenug1');
    await page.fill('#passwort2', 'langgenug2');
    await page.click('#einrichten');
    await page.waitForFunction(() =>
        document.getElementById('fehler').textContent.includes('überein'));
    ok(true, 'abweichende Wiederholung wird abgewiesen');

    // Richtig
    await page.fill('#passwort', 'langgenug1');
    await page.fill('#passwort2', 'langgenug1');
    await page.click('#einrichten');
    await page.waitForSelector('#anmeldung', { timeout: 10000 });
    ok(true, 'nach dem Festlegen zeigt die Seite die Anmeldung');
    ok(fs.existsSync(config), 'config.json ist angelegt');

    const neu = JSON.parse(fs.readFileSync(config, 'utf8'));
    ok(typeof neu.password_hash === 'string' && neu.password_hash.startsWith('$'),
       'das Passwort liegt als Hash da, nicht im Klartext');
    ok(/^[0-9a-f]{64}$/.test(neu.api_key), 'ein API-Key für n8n ist erzeugt');
    ok(fs.existsSync(t.datenordner + '/.htaccess'), 'die Zugriffssperre in data/ steht');

    // Der Endpunkt ist jetzt tot
    const nochmal = await page.evaluate(async () => {
        const r = await fetch('api/setup.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: 'fremdes1', password_repeat: 'fremdes1' }),
        });
        return r.status;
    });
    ok(nochmal === 409, 'ein zweiter Versuch wird abgewiesen (409)');

    const danach = JSON.parse(fs.readFileSync(config, 'utf8'));
    ok(danach.password_hash === neu.password_hash, 'das gesetzte Passwort bleibt unverändert');

    /*
     * Der Plan muss beim Einrichten mitkommen. Ohne ihn endete der Weg über
     * den Browser in einer Sackgasse: Ohne Trainingstag lässt sich keine
     * Übung anlegen, und Tage anlegen kann die Oberfläche nicht. Wer kein
     * SSH hatte, kam da nicht mehr heraus.
     */
    const plan = JSON.parse(fs.readFileSync(t.datenordner + '/plan.json', 'utf8'));
    ok(Object.keys(plan.days).join(',') === 'oberkoerper,ganzkoerper,unterkoerper',
       'beim Einrichten entstehen drei Trainingstage: ' + Object.keys(plan.days).join(', '));
    ok(plan.rotation.length === 3, 'mit einer Rotation über alle drei');

    const geliefert = JSON.parse(fs.readFileSync(t.datenordner + '/exercises.json', 'utf8'));
    ok(Object.keys(geliefert).length === 25,
       'und 25 Übungen: ' + Object.keys(geliefert).length);
    ok(Object.values(geliefert).every((u) => /^[abc]\d-.+\.jpg$/.test(u.photo)),
       'jede Übung hat ihr gezeichnetes Bild, abgeleitet aus Tag und Position');
    ok(Object.values(geliefert).every((u) => u.station === ''),
       'die Gerätenummer bleibt leer, die klebt am Gerät im eigenen Studio');

    // Anmelden mit dem neuen Passwort
    await page.fill('#passwort', 'langgenug1');
    await page.click('#anmelden');
    await page.waitForSelector('#app', { timeout: 10000 });
    ok(true, 'Anmeldung mit dem selbst gesetzten Passwort geht');

    // Und man landet nicht bei "Der Plan fehlt noch", sondern im Training.
    await page.waitForSelector('.heute__tag');
    ok((await page.locator('.heute__tag').innerText()).length > 0,
       'die Startseite bietet sofort einen Trainingstag an: '
       + await page.locator('.heute__tag').innerText());

    for (const [datei, inhalt] of Object.entries(beiseite)) {
        fs.writeFileSync(t.datenordner + '/' + datei, inhalt);
    }
    fs.writeFileSync(config, gesichert);
});
