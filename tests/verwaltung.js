/* Phase 1: Übungsbibliothek anlegen, ändern, löschen. */

const { testlauf } = require('./hilfen');

module.exports = (port) => testlauf('Verwaltung', port, async (t) => {
    const { page, ok } = t;
    await page.goto('http://127.0.0.1:' + port + '/');

    // Ohne Anmeldung kommt man nicht rein
    ok(await page.locator('#anmeldung').count() === 1, 'ohne Anmeldung nur das Anmeldeformular');
    ok(await page.locator('#app').count() === 0, 'kein App-Bereich vor der Anmeldung');

    await page.fill('#passwort', 'falsch');
    await page.click('#anmelden');
    await page.waitForFunction(() => document.getElementById('fehler').textContent.length > 0);
    ok((await page.locator('#fehler').innerText()).includes('Passwort'), 'falsches Passwort wird abgewiesen');

    await t.anmelden();

    /* ---------- Abmelden: unten und in zwei Schritten ----------
     *
     * Der Knopf saß oben rechts im Kopf, also da, wo der Daumen beim
     * Halten des Handys ohnehin liegt. Ein Fehlgriff kostet im Studio den
     * Zugang, denn Anmelden braucht das Netz, das dort oft fehlt.
     */

    ok(await page.locator('.kopf #abmelden').count() === 0,
       'im Kopf steht kein Abmelden mehr');
    ok(await page.locator('.fuss #abmelden').count() === 1,
       'es steht in der Fußzeile');

    const raus = page.locator('#abmelden');
    await raus.click();
    ok((await raus.innerText()).toLowerCase().includes('wirklich'),
       'ein Tipp fragt erst nach: "' + (await raus.innerText()) + '"');
    ok(await page.locator('#app').count() === 1,
       'und meldet noch niemanden ab');

    // Jede andere Berührung nimmt die Frage zurück
    await page.locator('.kopf').click();
    ok((await raus.innerText()) === 'Abmelden',
       'ein Tipp woanders nimmt die Frage zurück');

    await raus.click();
    await raus.click();
    await page.waitForSelector('#anmeldung');
    ok(true, 'zweimal getippt meldet ab');

    await t.anmelden();

    // Der Bereich heißt in der Oberfläche "Einstellungen". Intern bleibt er
    // "plan", weil daran api/settings.php und plan.json hängen; die beiden
    // Namen dürfen auseinanderlaufen, aber nicht unbemerkt.
    ok(await page.locator('[data-gehe="plan"]').innerText() === 'Einstellungen',
       'der Verweis auf der Startseite heißt Einstellungen');

    await page.click('[data-gehe="plan"]');
    await page.waitForSelector('.zeile');
    ok(await page.locator('.titel').innerText() === 'Einstellungen',
       'und die Überschrift dort ebenso');

    const vorher = await page.locator('.zeile').count();

    // Anlegen
    await page.locator('[data-neu="unterkoerper"]').click();
    await page.waitForSelector('.editor');
    await page.fill('#e-name', 'Wadenheben');
    await page.fill('#e-station', '21');
    await page.selectOption('#e-group', 'beine');
    await page.fill('#e-sets', '3');
    await page.fill('#e-min', '10');
    await page.fill('#e-max', '15');

    // Die Schrittweiten stehen an zwei Stellen: die Auswahl hier und die
    // Prüfung in lib/uebungen.php. Driften sie auseinander, bietet das
    // Formular einen Wert an, den der Server ablehnt.
    const stufen = await page.locator('#e-step option').allInnerTexts();
    ok(stufen.join(' ') === '0,25 kg 0,5 kg 1 kg 1,25 kg 2,5 kg 5 kg',
       'sechs Schrittweiten zur Auswahl: ' + stufen.join(' · '));
    await page.selectOption('#e-step', '0.25');

    await page.click('.editor button[type="submit"]');
    await page.waitForFunction((n) => document.querySelectorAll('.zeile').length === n, vorher + 1);
    ok(true, 'Übung über das Formular angelegt');

    const zeile = await page.locator('.zeile', { hasText: 'Wadenheben' }).innerText();
    ok(zeile.includes('0,25 kg'), 'der Server nimmt die kleinste Schrittweite an');
    ok(zeile.includes('21'), 'Gerätenummer steht als Plakette in der Liste');
    ok(zeile.includes('Beine'), 'Muskelgruppe lesbar statt als Schlüssel');
    ok(!(await page.locator('.zeile').first().innerText()).includes('ruecken'), 'nirgends ein roher Schlüssel');

    // Pflichtfeld
    await page.locator('[data-neu="unterkoerper"]').click();
    await page.fill('#e-name', '   ');
    await page.click('.editor button[type="submit"]');
    await page.waitForFunction(() => {
        const p = document.querySelector('.editor .fehler');
        return p && p.textContent.trim().length > 0;
    });
    ok(true, 'leerer Name wird abgefangen: "'
        + (await page.locator('.editor .fehler').innerText()).trim() + '"');
    await page.locator('[data-abbrechen]').click();
    await page.waitForSelector('.zeile');

    // Löschen in zwei Schritten
    await page.locator('.zeile', { hasText: 'Wadenheben' }).click();
    await page.waitForSelector('.editor');
    ok(await page.locator('[data-frage]').isVisible(), 'erster Schritt: "Übung löschen"');
    await page.locator('[data-frage]').click();
    ok(await page.locator('[data-loesche]').isVisible(), 'zweiter Schritt: "Wirklich löschen"');
    await page.locator('[data-loesche]').click();
    await page.waitForFunction((n) => document.querySelectorAll('.zeile').length === n, vorher);
    ok(true, 'gelöscht, Liste wieder bei ' + vorher);

    // Schwerpunkt
    await page.locator('[data-prio="trizeps"][data-wert="focus"]').click();
    await page.waitForTimeout(400);
    await page.reload();
    // Auf den fertig gezeichneten Bereich warten, nicht auf #app: das steht
    // schon mit "Wird geladen" im HTML, bevor die API geantwortet hat.
    await page.waitForSelector('[data-gehe="plan"]');
    await page.click('[data-gehe="plan"]');
    await page.waitForSelector('.prio');
    const an = await page.locator('[data-prio="trizeps"][data-wert="focus"]').getAttribute('class');
    ok(an.includes('ist-an'), 'Schwerpunkt überlebt das Neuladen');
});
