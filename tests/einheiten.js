/* Der Rückblick: Liste der Einheiten auf der Startseite und ihre Detailansicht. */

const { testlauf, saetze, einheit } = require('./hilfen');

module.exports = (port) => testlauf('Rückblick', port, async (t) => {
    const { page, ok } = t;

    /*
     * Zwölf Einheiten, damit der Deckel von zehn greift. Die jüngste ist
     * absichtlich unvollständig: Bankdrücken hat zwei von vier Sätzen,
     * Schulterdrücken fehlt ganz.
     */
    const sessions = [];
    for (let i = 1; i <= 11; i++) {
        sessions.push(einheit('2026-08-' + String(i).padStart(2, '0'), 'oberkoerper', 0, {
            bankdruecken: saetze(70 + i, 8, 8, 8, 8),
            latzug: saetze(50 + i, 10, 10, 10, 10),
            schulterdruecken: saetze(30, 10, 10, 10),
        }));
    }
    sessions.push(einheit('2026-08-12', 'oberkoerper', 0, {
        bankdruecken: saetze(85, 8, 7),
        latzug: saetze(62, 10, 10, 10, 10),
    }));

    // Eine Einheit im Vormonat, damit der Kalender etwas zum Blättern hat.
    t.logs({
        '2026-07': [einheit('2026-07-28', 'unterkoerper', 1, {
            beinpresse: saetze(120, 10, 10, 10, 10),
        })],
        '2026-08': sessions,
    });
    await t.anmelden();

    /* ---------- Die Liste auf der Startseite ---------- */

    await page.waitForSelector('.rueckblick .einheit');
    ok(await page.locator('.einheit').count() === 10,
       'höchstens zehn Einheiten, auch wenn zwölf da sind');

    const erste = await page.locator('.einheit').first().innerText();
    ok(erste.includes('Mi, 12. Aug'), 'die jüngste steht oben: "' + erste.split('\n')[0] + '"');
    ok(erste.includes('Oberkörper'), 'mit der Kategorie');

    const rest = await page.locator('.rueckblick .tag__zahl').innerText();
    ok(rest === '10 von 13',
       'der Deckel steht in der Abschnittsmarke: "' + rest + '"');

    /* ---------- Abgebrochene Einheiten sind erkennbar ---------- */

    ok((await page.locator('.einheit').first().locator('.einheit__offen').count()) === 1,
       'die abgebrochene Einheit ist als unvollständig gekennzeichnet');
    ok(erste.includes('6 von 11 Sätzen'),
       'und nennt Stand und Soll: "' + erste.split('\n')[1] + '"');
    ok((await page.locator('.einheit').nth(1).locator('.einheit__offen').count()) === 0,
       'die vollständige daneben bleibt ohne Vermerk');

    /* ---------- Die Fortschrittskurve ---------- */

    ok(await page.locator('.start .chart').count() === 1,
       'über der Liste steht die Fortschrittskurve');
    const stand = (await page.locator('.fortschritt__stand').innerText()).replace(/\s+/g, ' ');
    ok(/^\d/.test(stand) && stand.includes('Punkte'),
       'mit dem heutigen Stand: "' + stand + '"');
    const seit = await page.locator('.abschnitt .tag__zahl').first().innerText();
    ok(seit.includes('seit dem Start'),
       'und dem Abstand zum Start in der Abschnittsmarke: "' + seit + '"');

    // Die Kurve auf der Startseite trägt dieselbe Klasse wie die im
    // Übungsverlauf. Ein Tipp darauf darf nicht in fremde Daten laufen.
    await page.locator('.start .chart').click({ position: { x: 100, y: 40 } });
    await page.waitForTimeout(200);
    ok(await page.locator('.heute__tag').count() === 1,
       'ein Tipp auf die Kurve wirft die Startseite nicht um');

    /* ---------- Der Startknopf bleibt trotz der Liste im Bild ---------- */

    const knopf = await page.locator('.fussleiste .knopf').boundingBox();
    ok(knopf.y + knopf.height <= 844 + 1,
       'der Startknopf steht bei zehn Einträgen im Bild (unten bei y='
       + Math.round(knopf.y + knopf.height) + ' von 844)');

    /* ---------- Detailansicht: dieselben Kacheln, ausgefüllt ---------- */

    await page.locator('.einheit').first().click();
    await page.waitForSelector('.kachel');

    ok(await page.locator('.titel').innerText() === 'Oberkörper',
       'die Einheit trägt ihren Trainingstag als Titel');
    const bilanz = await page.locator('.einheit__bilanz').innerText();
    ok(bilanz.includes('2 Übungen') && bilanz.includes('6 von 11 Sätzen')
       && bilanz.includes('unvollständig'),
       'die Zusammenfassung oben: "' + bilanz + '"');

    ok(await page.locator('.kachel').count() === 2,
       'nur die Übungen, die in dieser Einheit vorkamen');

    const bank = page.locator('.kachel', { hasText: 'Bankdrücken' });
    ok(await bank.locator('.kachel__werte').innerText() === '85×8 · 85×7',
       'die Sätze dieser Einheit stehen auf der Kachel');
    ok(await bank.locator('.punkt').count() === 4
       && await bank.locator('.punkt.ist-voll').count() === 2,
       'die Punkte zeigen diese Einheit: 2 von 4');

    /*
     * Im Studio steht in dieser Zeile die Vorgabe, hier zählt sie, was
     * gemacht wurde. Stünde auch im Rückblick "4 Sätze", behauptete die
     * Kachel etwas, das nicht stattgefunden hat.
     */
    const kopf = (await bank.locator('.kachel__ziel').innerText()).replace(/\s+/g, ' ');
    ok(kopf === '2/4 Sätze · 6–10 Wdh',
       'die Kopfzeile zählt die gemachten Sätze mit der Vorgabe dahinter: "' + kopf + '"');

    const voll = (await page.locator('.kachel', { hasText: 'Latzug' })
        .locator('.kachel__ziel').innerText()).replace(/\s+/g, ' ');
    ok(voll === '4 Sätze · 8–12 Wdh',
       'bei erreichter Vorgabe fällt der Bezug weg, "4/4" wäre Rauschen: "' + voll + '"');

    ok(await page.locator('.kachel__coach').count() === 0,
       'keine Coach-Ansage an einer abgeschlossenen Einheit');
    ok(await page.locator('.satz--dran').count() === 0, 'und kein Regler');

    /* ---------- Von hier in den Verlauf und zurück ---------- */

    await bank.locator('.kachel__text').click();
    await page.waitForSelector('.chart, .verlauf__lese');
    ok((await page.locator('.titel').innerText()).includes('Bankdrücken'),
       'die Übung öffnet ihren Verlauf');

    await page.locator('.kopfknopf', { hasText: 'Zurück' }).click();
    await page.waitForSelector('.einheit__bilanz');
    ok(await page.locator('.titel').innerText() === 'Oberkörper',
       '"Zurück" führt in die Einheit, aus der man kam, nicht in den Plan');

    await page.locator('.kopfknopf', { hasText: 'Zurück' }).click();
    await page.waitForSelector('.rueckblick');
    ok(await page.locator('.heute__tag').count() === 1,
       'und von dort auf die Startseite');

    /*
     * Die Startseite war ein einziger Textblock: vier gleich aussehende
     * Beschriftungen untereinander, ohne Trennung. Jetzt trägt jeder
     * Abschnitt dieselbe Marke wie in den Einstellungen.
     */
    const abschnitte = await page.locator('.start .tag__name').allInnerTexts();
    // Versalien kommen aus dem CSS, innerText liefert sie so, wie sie stehen.
    ok(abschnitte.join(' · ') === 'FORTSCHRITT · LETZTE EINHEITEN',
       'die Abschnitte sind benannt und abgesetzt: ' + abschnitte.join(' · '));
    ok(!(await page.locator('.start').innerText()).includes('ANDERER TAG'),
       '"Anderer Tag" ist weg, die Knöpfe gehören zu "Heute"');
    ok(await page.locator('.tagknopf').count() === 2,
       'die Tagesknöpfe stehen weiter da');

    /* ---------- Der Kalender ---------- */

    await page.locator('[data-gehe="kalender"]').click();
    await page.waitForSelector('.kal__tag');

    ok(await page.locator('.titel').innerText() === 'Aug 2026',
       'der Kalender öffnet im laufenden Monat');
    ok(await page.locator('.kal__tag.ist-training').count() === 12,
       'zwölf Trainingstage im August');
    ok((await page.locator('.kal__zahl').innerText()) === '12 Einheiten',
       'und die Zahl darüber sagt dasselbe');

    const wochenkopf = await page.locator('.kal__kopf').allInnerTexts();
    ok(wochenkopf.join(' ') === 'Mo Di Mi Do Fr Sa So',
       'die Woche beginnt am Montag: ' + wochenkopf.join(' '));

    ok(await page.locator('.kal__tag.ist-heute').count() === 1,
       'der heutige Tag ist gekennzeichnet');

    // Der 1. August 2026 ist ein Samstag: davor müssen fünf leere Felder
    // stehen, sonst rutscht der ganze Monat um einen Wochentag.
    ok(await page.locator('.kal__leer').count() === 5,
       'der Monat beginnt am richtigen Wochentag');

    /* ---------- Blättern nur dorthin, wo etwas ist ---------- */

    ok(await page.locator('[aria-label="Monat vor"]').isDisabled(),
       'vorwärts über den laufenden Monat hinaus geht nicht');
    ok(!(await page.locator('[aria-label="Monat zurück"]').isDisabled()),
       'zurück schon, im Juli steht eine Einheit');

    await page.locator('[aria-label="Monat zurück"]').click();
    await page.waitForFunction(() =>
        document.querySelector('.titel').innerText === 'Juli 2026');
    ok(await page.locator('.kal__tag.ist-training').count() === 1,
       'der Juli hat eine Einheit');
    ok(await page.locator('[aria-label="Monat zurück"]').isDisabled(),
       'weiter zurück gibt es nichts mehr');

    /* ---------- Von einem Tag in die Einheit und zurück ---------- */

    await page.locator('.kal__tag.ist-training').click();
    await page.waitForSelector('.einheit__bilanz');
    ok(await page.locator('.titel').innerText() === 'Unterkörper',
       'ein Tipp auf den Tag öffnet seine Einheit');

    await page.locator('.kopfknopf', { hasText: 'Zurück' }).click();
    await page.waitForSelector('.kal__tag');
    ok(await page.locator('.titel').innerText() === 'Juli 2026',
       '"Zurück" führt in den Kalendermonat, aus dem man kam');

    await page.locator('.kopfknopf', { hasText: 'Zurück' }).click();
    await page.waitForSelector('.rueckblick');
    ok(await page.locator('.heute__tag').count() === 1, 'und von dort auf die Startseite');

    /* ---------- Körpergewicht eintragen ---------- */

    await page.click('[data-gehe="plan"]');
    await page.waitForSelector('#gewicht-form');

    /*
     * Das Formular soll aussehen wie das Übungsformular: beschriftete
     * Felder statt zweier nackter Kästen nebeneinander.
     */
    const marken = await page.locator('#gewicht-form .mini').allInnerTexts();
    ok(marken.join(' ') === 'DATUM GEWICHT IN KG',
       'beide Felder sind beschriftet: ' + marken.join(' · '));
    ok(await page.locator('#gewicht-form input[type="date"]').getAttribute('max')
       === new Date().toISOString().slice(0, 10),
       'in der Zukunft war noch niemand auf der Waage');

    await page.fill('#gewicht-form input[name="date"]', '2026-08-04');
    await page.fill('#gewicht-form input[name="kg"]', '84,5');
    await page.click('#gewicht-form button[type="submit"]');
    await page.waitForSelector('.zeile--schmal');
    ok((await page.locator('.zeile--schmal').innerText()).includes('84,5 kg'),
       'der Eintrag steht in der Liste');
    ok((await page.locator('.zeile--schmal').innerText()).includes('Di, 4. Aug'),
       'mit seinem Datum, nicht mit heute');

    ok((await page.locator('.zeile--schmal').innerText()).includes('84,5'),
       'Komma wird angenommen, die deutsche Tastatur hat keine Punkttaste');

    /*
     * Was nicht durchgehen darf. PHPs Umwandlung ist nachsichtig:
     * (float) "84,5kg" ergibt 84,5 und (float) "84,5,3" ebenfalls, beides
     * ohne Fehler. Ein Vertipper käme so als plausible Zahl in der Datei an.
     */
    const muell = [
        ['8,5',      'ein Tippfehler um den Faktor zehn'],
        ['84,5kg',   'eine Zahl mit angehängtem Text'],
        ['84,5,3',   'zwei Kommas'],
        ['1e2',      'wissenschaftliche Schreibweise'],
        ['abc',      'gar keine Zahl'],
    ];

    /*
     * Gewartet wird darauf, dass das Feld wieder leer ist. Das heißt: die
     * Antwort ist da und die Ansicht neu gezeichnet. Auf ".fehler" zu
     * warten reicht nicht — der steht schon von der vorigen Ablehnung da,
     * und der nächste Tipp liefe in eine noch laufende Anfrage.
     */
    const abgearbeitet = () => page.waitForFunction(() => {
        const f = document.querySelector('#gewicht-form input[name="kg"]');
        return f && f.value === '';
    });

    for (const [wert, was] of muell) {
        await page.fill('#gewicht-form input[name="kg"]', wert);
        await page.click('#gewicht-form button[type="submit"]');
        await abgearbeitet();
        ok(await page.locator('.zeile--schmal').count() === 1
           && (await page.locator('.fehler').innerText()).length > 10,
           'abgelehnt und begründet — ' + was + ': "' + wert + '"');
    }

    // Punkt geht auch, nur tippt ihn auf dem Handy niemand. Das Datumsfeld
    // steht nach dem Neuzeichnen wieder auf heute, also ein zweiter Eintrag.
    await page.fill('#gewicht-form input[name="kg"]', '85.5');
    await page.click('#gewicht-form button[type="submit"]');
    await page.waitForFunction(() =>
        document.querySelectorAll('.zeile--schmal').length === 2);
    const zeilen = await page.locator('.zeile--schmal').allInnerTexts();
    ok(zeilen[0].includes('85,5'), 'ein Punkt als Dezimaltrenner geht ebenfalls');
    ok(zeilen[1].includes('84,5'), 'und die jüngste Wägung steht oben');
    ok(await page.locator('.fehler').count() === 0,
       'nach der geglückten Eingabe ist die Fehlermeldung weg');

    // Derselbe Tag noch einmal: ein Datum trägt genau einen Wert.
    await page.fill('#gewicht-form input[name="kg"]', '86');
    await page.click('#gewicht-form button[type="submit"]');
    await page.waitForFunction(() =>
        document.querySelector('.zeile--schmal').innerText.includes('86 kg'));
    ok(await page.locator('.zeile--schmal').count() === 2,
       'derselbe Tag überschreibt, statt einen dritten Eintrag anzulegen');

    await page.locator('[data-gewichtweg]').first().click();
    await page.waitForFunction(() =>
        document.querySelectorAll('.zeile--schmal').length === 1);
    ok(true, 'löschen entfernt einen Eintrag wieder');
});
