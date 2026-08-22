/* Phase 3: Verlaufskurven je Übung. */

const { testlauf, saetze, einheit } = require('./hilfen');

module.exports = (port) => testlauf('Verlauf', port, async (t) => {
    const { page, ok } = t;

    // Zehn Einheiten Bankdrücken von 70 auf 80 kg, über drei Monate verteilt.
    const proMonat = {};
    let tagInMs = Date.UTC(2026, 5, 2);
    for (let w = 0; w < 10; w++) {
        const gewicht = 70 + Math.floor(w / 2) * 2.5;
        const wdh = 8 + (w % 2) * 2;
        const iso = new Date(tagInMs).toISOString().slice(0, 10);
        const monat = iso.slice(0, 7);
        (proMonat[monat] = proMonat[monat] || []).push(
            einheit(iso, 'oberkoerper', 0, {
                bankdruecken: saetze(gewicht, wdh, Math.max(6, wdh - 1), Math.max(6, wdh - 2)),
            })
        );
        tagInMs += 7 * 86400000;
    }
    t.training(proMonat);

    await t.anmelden();
    await page.click('[data-gehe="plan"]');
    await page.waitForSelector('.zeile');

    await page.locator('.zeile', { hasText: 'Bankdrücken' }).click();
    await page.waitForSelector('.chart');
    ok(await page.locator('.titel').innerText() === 'Bankdrücken', 'Detailansicht trägt den Übungsnamen');
    ok(await page.locator('.chart').count() === 2, 'zwei getrennte Diagramme statt einer zweiten y-Achse');
    ok(await page.locator('.editor').count() === 1, 'Formular steht unter dem Verlauf');

    /* ---------- Ausführung und Nachschlagen ---------- */

    await page.click('[data-gehe="plan"]');
    await page.waitForSelector('.zeile');
    await page.locator('.zeile', { hasText: 'Bankdrücken' }).locator('.zeile__text').click();
    await page.waitForSelector('.editor');
    ok(await page.locator('#e-execution').count() === 1, 'Ausführung ist bearbeitbar');
    ok(await page.locator('#e-search').count() === 1, 'englischer Suchbegriff auch');
    await page.locator('[data-abbrechen]').click();
    await page.waitForSelector('.zeile');
    await page.locator('.zeile', { hasText: 'Bankdrücken' }).locator('.zeile__text').click();
    await page.waitForSelector('.chart');

    const lese = await page.locator('.verlauf__lese').innerText();
    ok(lese.includes('80 kg') && lese.includes('Volumen'),
       'Ableselinie zeigt die letzte Einheit: ' + lese.replace(/\s+/g, ' '));
    ok((await page.locator('.hinweis').first().innerText()).includes('10 Einheiten'),
       'nennt die Zahl der Einheiten');

    const achsen = await page.locator('.chart').first().locator('.ch-achse')
        .evaluateAll((ns) => ns.map((n) => n.textContent));
    ok(achsen.includes('80') && achsen.includes('70'),
       'y-Achse beschriftet die echten Grenzwerte: ' + achsen.join(' '));

    // Tippen wählt eine frühere Einheit, beide Diagramme folgen
    const kasten = await page.locator('.chart').first().boundingBox();
    await page.mouse.click(kasten.x + kasten.width * 0.18, kasten.y + kasten.height / 2);
    await page.waitForFunction((alt) =>
        document.querySelector('.verlauf__lese').innerText !== alt, lese);
    ok(true, 'Tippen wählt eine andere Einheit: '
        + (await page.locator('.verlauf__lese').innerText()).replace(/\s+/g, ' '));
    ok(await page.locator('.ch-kreuz').count() === 2, 'beide Diagramme zeigen dasselbe Fadenkreuz');

    // Übung ohne Verlauf
    await page.click('[data-gehe="plan"]');
    await page.waitForSelector('.zeile');
    await page.locator('.zeile', { hasText: 'Schulterdrücken' }).click();
    await page.waitForSelector('.editor');
    ok(await page.locator('.chart').count() === 0, 'ohne Daten kein Diagramm');
    ok((await page.locator('.tag__leer').first().innerText()).includes('Noch kein Verlauf'),
       'stattdessen eine Erklärung');
    ok(await page.locator('.titel').innerText() === 'Schulterdrücken',
       'kein Verlauf der vorher geöffneten Übung im Titel');

    // Speichern führt zurück in die Liste. Das Ausfüllen beginnt bewusst,
    // sobald das Formular da ist, also während der Verlauf noch lädt: eine
    // Eingabe darf nicht verlorengehen, wenn die Kurve nachträglich kommt.
    await page.fill('#e-station', '31');
    await page.click('.editor button[type="submit"]');
    await page.waitForSelector('.zeile');
    ok((await page.locator('.zeile', { hasText: 'Schulterdrücken' }).innerText()).includes('31'),
       'Eingabe überlebt das Nachladen des Verlaufs und wird gespeichert');

    // Dasselbe beim Antippen des Diagramms
    await page.locator('.zeile', { hasText: 'Bankdrücken' }).click();
    await page.waitForSelector('.chart');
    await page.fill('#e-order', '7');
    const k2 = await page.locator('.chart').first().boundingBox();
    await page.mouse.click(k2.x + k2.width * 0.3, k2.y + k2.height / 2);
    await page.waitForTimeout(200);
    ok(await page.locator('#e-order').inputValue() === '7',
       'Tippen im Diagramm lässt das Formular in Ruhe');
    await page.locator('[data-abbrechen]').click();
    await page.waitForSelector('.zeile');

    // Neue Übung: kein Verlaufsbereich
    await page.locator('[data-neu="unterkoerper"]').click();
    await page.waitForSelector('.editor');
    ok(await page.locator('.titel').innerText() === 'Neue Übung', 'neue Übung mit eigenem Titel');
    ok(await page.locator('.verlauf').count() === 0, 'bei einer neuen Übung kein Verlaufsbereich');
    await page.locator('[data-abbrechen]').click();
    await page.waitForSelector('.zeile');
    ok(true, 'Abbrechen führt zurück in die Liste');
});
