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
    await page.click('[data-gehe="plan"]');
    await page.waitForSelector('.zeile');
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
    await page.click('.editor button[type="submit"]');
    await page.waitForFunction((n) => document.querySelectorAll('.zeile').length === n, vorher + 1);
    ok(true, 'Übung über das Formular angelegt');

    const zeile = await page.locator('.zeile', { hasText: 'Wadenheben' }).innerText();
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
