/* Phase 2: Tagesvorschlag, Kacheln, Satz-Eingabe, Pausen-Timer. */

const { testlauf, saetze, einheit } = require('./hilfen');

module.exports = (port) => testlauf('Studio', port, async (t) => {
    const { page, ok } = t;

    t.logs({
        '2026-07': [
            einheit('2026-07-29', 'oberkoerper', 2, { bankdruecken: saetze(75, 10) }),
        ],
        '2026-08': [
            einheit('2026-08-11', 'oberkoerper', 0, {
                bankdruecken: saetze(80, 12, 11, 10),
                latzug: saetze(60, 12),
            }),
            einheit('2026-08-13', 'unterkoerper', 1, { beinpresse: saetze(120, 10) }),
        ],
    });

    await t.anmelden();

    ok(await page.locator('.heute__tag').innerText() === 'Oberkörper',
       'nach unterkoerper/Index 1 folgt Index 2, also wieder Oberkörper');
    ok((await page.locator('.heute__zeile').innerText()).includes('zuletzt Di, 11. Aug'),
       'zeigt die letzte Einheit dieser Übungen, nicht die letzte überhaupt');
    ok(!(await page.locator('#pause').isVisible()), 'kein Pausen-Balken beim Laden');

    const knopf = await page.locator('[data-gehe="studio"]').boundingBox();
    ok(knopf.y > 600, 'Hauptaktion in der Daumenzone (y=' + Math.round(knopf.y) + ' von 844)');

    // Manuelle Tagwahl sticht den Vorschlag
    await page.locator('.tagknopf', { hasText: 'Unterkörper' }).click();
    await page.waitForFunction(() => document.querySelector('.heute__tag').innerText === 'Unterkörper');
    ok(await page.locator('.mini').first().innerText() === 'GEWÄHLT', 'manuelle Wahl wird gekennzeichnet');

    await t.studio('Oberkörper');
    ok(await page.locator('.kachel').count() === 3, '3 Kacheln für Oberkörper');

    const bank = page.locator('.kachel', { hasText: 'Bankdrücken' });
    ok((await bank.innerText()).includes('zuletzt 80 kg × 10'), 'Kachel zeigt das letzte Ergebnis');
    ok(await bank.locator('.punkt').count() === 4, '4 Punkte für 4 Zielsätze');
    ok(await bank.locator('.punkt.ist-voll').count() === 0, 'heute noch nichts erledigt');
    ok(await bank.locator('.kachel__platzhalter').innerText() === '43', 'Gerätenummer statt fehlendem Foto');

    await bank.locator('.kachel__kopf').click();
    await page.waitForSelector('.satz--dran');
    ok(await bank.locator('.regler__wert').first().innerText() === '80 kg', 'Gewicht vorbefüllt');
    ok(await bank.locator('.regler__wert').nth(1).innerText() === '12 Wdh', 'Wiederholungen vorbefüllt');

    await bank.locator('[data-aendere$="weight:1"]').click();
    await page.waitForFunction(() =>
        document.querySelector('.satz--dran .regler__wert').innerText === '82,5 kg');
    ok(true, 'Plus erhöht um die Schrittweite der Übung (2,5 kg)');

    await bank.locator('[data-aendere$="reps:-1"]').click();
    ok(await bank.locator('.regler__wert').nth(1).innerText() === '11 Wdh', 'Minus senkt die Wiederholungen');

    await bank.locator('[data-bestaetige]').click();
    await page.waitForSelector('.satz--fertig');
    ok((await bank.locator('.satz--fertig').innerText()).includes('82,5 kg × 11'), 'Satz steht als erledigt da');
    ok(await bank.locator('.punkt.ist-voll').count() === 1, 'ein Punkt ist gefüllt');
    ok(await page.locator('#pause').isVisible(), 'Pausen-Timer läuft');

    // Der Balken darf die unterste Kachel nicht verdecken
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(200);
    const letzte = await page.locator('.kachel').last().boundingBox();
    const balken = await page.locator('#pause').boundingBox();
    ok(letzte.y + letzte.height <= balken.y + 1, 'unterste Kachel bleibt neben dem Pausen-Balken erreichbar');

    await page.click('#pause-weg');
    ok(!(await page.locator('#pause').isVisible()), 'Überspringen blendet den Timer aus');
    ok(await bank.locator('.regler__wert').first().innerText() === '82,5 kg',
       'nächster Satz übernimmt den bestätigten Wert');

    await page.reload();
    await page.waitForSelector('[data-gehe="studio"], .leer__titel');
    ok((await page.locator('.heute__zeile').innerText()).includes('heute schon 1 Satz'),
       'Startseite meldet den heutigen Fortschritt');
    await page.click('[data-gehe="studio"]');
    await page.waitForSelector('.kachel');
    ok(await page.locator('.kachel', { hasText: 'Bankdrücken' }).locator('.punkt.ist-voll').count() === 1,
       'der Satz liegt nach dem Neuladen auf der Platte');
});
