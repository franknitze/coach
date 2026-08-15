/* Die einmalige Einrichtung: Passwort setzen, danach abgeschaltet. */

const { testlauf } = require('./hilfen');
const fs = require('fs');

module.exports = (port) => testlauf('Einrichtung', port, async (t) => {
    const { page, ok, basis } = t;

    // Ausgangslage herstellen: config.json wegnehmen, die App ist "neu"
    const config = t.datenordner + '/config.json';
    const gesichert = fs.readFileSync(config, 'utf8');
    fs.unlinkSync(config);

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

    // Anmelden mit dem neuen Passwort
    await page.fill('#passwort', 'langgenug1');
    await page.click('#anmelden');
    await page.waitForSelector('#app', { timeout: 10000 });
    ok(true, 'Anmeldung mit dem selbst gesetzten Passwort geht');

    fs.writeFileSync(config, gesichert);
});
