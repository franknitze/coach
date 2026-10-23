/* Der Rückblick: Liste der Einheiten auf der Startseite und ihre Detailansicht. */

const { testlauf, saetze, einheit } = require('./hilfen');

module.exports = (port) => testlauf('Rückblick', port, async (t) => {
    const { page, ok } = t;

    /*
     * Zwölf Einheiten, damit der Deckel von zehn greift. Die jüngste ist
     * absichtlich unvollständig: Bankdrücken hat zwei von vier Sätzen,
     * Schulterdrücken fehlt ganz.
     */
    /*
     * Die Daten liegen im VORmonat, nicht in einem festen Monat.
     *
     * Vorher stand hier der August 2026 und der Lauf behauptete "Aug 2026",
     * zwölf Trainingstage und fünf Leerfelder. Am 01.09.2026 fiel er
     * deshalb um — richtig war er nur, solange gerade August war. Ein Test,
     * der jeden Monatswechsel rot wird, sagt nichts mehr aus.
     *
     * Vormonat und nicht laufender Monat: Läge eine Einheit auf dem
     * heutigen Tag, wäre sie "offen" statt "unvollständig", und die
     * Prüfungen weiter unten kippten an genau einem Tag im Monat.
     */
    const WOCHENTAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    const MONATE = ['Jan', 'Feb', 'März', 'Apr', 'Mai', 'Juni',
                    'Juli', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
    const marke = (d) => MONATE[d.getMonth()] + ' ' + d.getFullYear();
    const schluessel = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    const tagIso = (d, tag) => schluessel(d) + '-' + String(tag).padStart(2, '0');

    const heuteD  = new Date();
    const jetzt   = new Date(heuteD.getFullYear(), heuteD.getMonth(), 1);
    const vor1    = new Date(heuteD.getFullYear(), heuteD.getMonth() - 1, 1);
    const vor2    = new Date(heuteD.getFullYear(), heuteD.getMonth() - 2, 1);

    const sessions = [];
    for (let i = 1; i <= 11; i++) {
        sessions.push(einheit(tagIso(vor1, i), 'oberkoerper', 0, {
            bankdruecken: saetze(70 + i, 8, 8, 8, 8),
            latzug: saetze(50 + i, 10, 10, 10, 10),
            schulterdruecken: saetze(30, 10, 10, 10),
        }));
    }
    sessions.push(einheit(tagIso(vor1, 12), 'oberkoerper', 0, {
        bankdruecken: saetze(85, 8, 7),
        latzug: saetze(62, 10, 10, 10, 10),
    }));

    // Eine Einheit im Monat davor, damit der Kalender etwas zum Blättern hat.
    const training = {};
    training[schluessel(vor2)] = [einheit(tagIso(vor2, 28), 'unterkoerper', 1, {
        beinpresse: saetze(120, 10, 10, 10, 10),
    })];
    training[schluessel(vor1)] = sessions;
    t.training(training);
    await t.anmelden();

    /* ---------- Die Liste auf der Startseite ---------- */

    await page.waitForSelector('.rueckblick .einheit');
    ok(await page.locator('.einheit').count() === 10,
       'höchstens zehn Einheiten, auch wenn zwölf da sind');

    const erste = await page.locator('.einheit').first().innerText();
    const juengste = new Date(vor1.getFullYear(), vor1.getMonth(), 12);
    const juengsteText = WOCHENTAGE[juengste.getDay()] + ', 12. ' + MONATE[juengste.getMonth()];
    ok(erste.includes(juengsteText),
       'die jüngste steht oben: "' + erste.split('\n')[0] + '"');
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

    await t.menue('kalender');
    await page.waitForSelector('.kal__tag');

    ok(await page.locator('.titel').innerText() === marke(jetzt),
       'der Kalender öffnet im laufenden Monat: ' + marke(jetzt));

    const wochenkopf = await page.locator('.kal__kopf').allInnerTexts();
    ok(wochenkopf.join(' ') === 'Mo Di Mi Do Fr Sa So',
       'die Woche beginnt am Montag: ' + wochenkopf.join(' '));

    ok(await page.locator('.kal__tag.ist-heute').count() === 1,
       'der heutige Tag ist gekennzeichnet');
    ok(await page.locator('[aria-label="Monat vor"]').isDisabled(),
       'vorwärts über den laufenden Monat hinaus geht nicht');

    /* ---------- Blättern nur dorthin, wo etwas ist ---------- */

    ok(!(await page.locator('[aria-label="Monat zurück"]').isDisabled()),
       'zurück geht, in den Vormonaten steht etwas');

    await page.locator('[aria-label="Monat zurück"]').click();
    await page.waitForFunction((t) =>
        document.querySelector('.titel').innerText === t, marke(vor1));
    ok(await page.locator('.kal__tag.ist-training').count() === 12,
       'zwölf Trainingstage im Vormonat');
    ok((await page.locator('.kal__zahl').innerText()) === '12 Einheiten',
       'und die Zahl darüber sagt dasselbe');

    /*
     * Vor dem Ersten stehen so viele leere Felder, wie der Monat Wochentage
     * nach Montag beginnt. Fällt der Erste auf einen Montag, sind es null.
     * Ohne diese Prüfung rutscht der ganze Monat um einen Wochentag, ohne
     * dass es auffällt.
     */
    const versatz = (vor1.getDay() + 6) % 7;
    ok(await page.locator('.kal__leer').count() === versatz,
       'der Monat beginnt am richtigen Wochentag: ' + versatz + ' leere Felder');

    await page.locator('[aria-label="Monat zurück"]').click();
    await page.waitForFunction((t) =>
        document.querySelector('.titel').innerText === t, marke(vor2));
    ok(await page.locator('.kal__tag.ist-training').count() === 1,
       'der Monat davor hat eine Einheit');
    ok(await page.locator('[aria-label="Monat zurück"]').isDisabled(),
       'weiter zurück gibt es nichts mehr');

    /* ---------- Von einem Tag in die Einheit und zurück ---------- */

    await page.locator('.kal__tag.ist-training').click();
    await page.waitForSelector('.einheit__bilanz');
    ok(await page.locator('.titel').innerText() === 'Unterkörper',
       'ein Tipp auf den Tag öffnet seine Einheit');

    await page.locator('.kopfknopf', { hasText: 'Zurück' }).click();
    await page.waitForSelector('.kal__tag');
    ok(await page.locator('.titel').innerText() === marke(vor2),
       '"Zurück" führt in den Kalendermonat, aus dem man kam');

    await page.locator('.kopfknopf', { hasText: 'Zurück' }).click();
    await page.waitForSelector('.rueckblick');
    ok(await page.locator('.heute__tag').count() === 1, 'und von dort auf die Startseite');

    /* ---------- Körpergewicht eintragen ---------- */

    await t.menue('plan');
    // Das Körpergewicht steht seit dem 22.08.2026 im Bereich "Allgemein".
    await page.click('[data-bereich="allgemein"]');
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

    /*
     * Gleich hoch, egal was drinsteht. Ein Datumsfeld bringt in WebKit ein
     * eigenes Bedienelement mit eigener Höhe mit und war dadurch 4px höher
     * als das Feld daneben — in Chrome nicht zu sehen, in Safari schon.
     * Diese Prüfung ist deshalb nur mit COACH_BROWSER=webkit aussagekräftig.
     */
    const hoehen = await page.evaluate(() => [
        document.querySelector('#g-datum').getBoundingClientRect().height,
        document.querySelector('#g-kg').getBoundingClientRect().height,
    ]);
    ok(Math.abs(hoehen[0] - hoehen[1]) < 1,
       'Datum und Gewicht stehen gleich hoch: '
       + hoehen.map(Math.round).join(' und ') + 'px');

    await page.fill('#gewicht-form input[name="date"]', tagIso(vor1, 4));
    await page.fill('#gewicht-form input[name="kg"]', '84,5');
    await page.click('#gewicht-form button[type="submit"]');
    await page.waitForSelector('.zeile--schmal');
    ok((await page.locator('.zeile--schmal').innerText()).includes('84,5 kg'),
       'der Eintrag steht in der Liste');
    const wiegetag = new Date(vor1.getFullYear(), vor1.getMonth(), 4);
    ok((await page.locator('.zeile--schmal').innerText()).includes(
       WOCHENTAGE[wiegetag.getDay()] + ', 4. ' + MONATE[wiegetag.getMonth()]),
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

    /* ---------- Eine Einheit, die noch läuft ------------------------------
     *
     * Frank hat eine Einheit begonnen, oben auf "Pause" getippt und stand
     * danach vor zwei Problemen:
     *
     * 1. Der Eintrag in der Liste führte in die Leseansicht — die zeigt nur,
     *    was schon gemacht ist. Genau die Übungen, die noch fehlten, waren
     *    dort nicht zu sehen.
     * 2. Standen zwei unvollständige Einheiten in der Liste, bediente der
     *    Knopf unten wortlos eine davon.
     */

    const heute = new Date();
    const iso = (d) => d.toISOString().slice(0, 10);
    const heuteIso = iso(heute);

    // Eine angefangene Oberkörper-Einheit von heute: 1 von 4 Sätzen.
    t.training({
        [heuteIso.slice(0, 7)]: [
            einheit(heuteIso, 'oberkoerper', 0, { bankdruecken: saetze(60, 8) }),
        ],
    });

    await page.goto('http://127.0.0.1:' + port + '/');
    await page.waitForSelector('.heute__tag');

    ok(await page.locator('.einheit--offen').count() === 1,
       'die angefangene Einheit ist in der Liste als offen markiert');
    ok((await page.locator('.einheit--offen .einheit__marke').innerText()) === 'offen',
       'sie trägt das Wort "offen", nicht "unvollständig"');
    ok((await page.locator('.einheit--offen .einheit__weiter').innerText()) === 'Weiter',
       'und sagt, was das Antippen tut');

    /*
     * Nach dem Neuladen steht sie wieder oben. Vorher sprang die Anzeige auf
     * den nächsten Tag der Rotation: naechster_tag() rückt schon ab dem
     * ersten bestätigten Satz weiter, und zustand.tagWahl hielt das nur
     * fest, solange die Seite nicht neu geladen wurde.
     */
    ok((await page.locator('.heute__tag').innerText()) === 'Oberkörper',
       'nach dem Neuladen steht die offene Einheit oben, nicht der nächste Tag');

    // Bei genau einer offenen Einheit bleibt der Knopf: er ist eindeutig.
    ok((await page.locator('.fussleiste .knopf').innerText()) === 'Weiter trainieren',
       'bei einer offenen Einheit bleibt der Knopf unten stehen');

    /* ---------- Antippen führt ins Studio, nicht in die Leseansicht ------- */

    await page.locator('.einheit--offen').click();
    await page.waitForSelector('.kachel');
    ok(await page.locator('[data-gehe="start"]').count() > 0
       && (await page.locator('.titel').innerText()) === 'Oberkörper',
       'ein Tipp auf die offene Einheit führt ins Studio');

    const kacheln = await page.locator('.kachel').count();
    ok(kacheln === 3,
       'und zeigt ALLE drei Übungen des Tages, nicht nur die eine gemachte: ' + kacheln);

    /* ---------- Zwei offene Einheiten: der Knopf verschwindet ------------- */

    t.training({
        [heuteIso.slice(0, 7)]: [
            einheit(heuteIso, 'oberkoerper', 0, { bankdruecken: saetze(60, 8) }),
            einheit(heuteIso, 'unterkoerper', 1, { beinpresse: saetze(100, 10) }),
        ],
    });

    await page.goto('http://127.0.0.1:' + port + '/');
    await page.waitForSelector('.heute__tag');

    ok(await page.locator('.einheit--offen').count() === 2,
       'beide angefangenen Einheiten sind als offen markiert');

    /*
     * Bei zwei offenen gewinnt oben die ZULETZT angefangene — die, in der
     * man gerade steckt. training_monat() liefert schon neueste zuerst; ein
     * zusätzliches array_reverse hatte daraus die älteste gemacht, und das
     * fiel nur im Screenshot auf.
     */
    ok((await page.locator('.heute__tag').innerText()) === 'Unterkörper',
       'oben steht die zuletzt angefangene Einheit, nicht die erste');
    ok(await page.locator('.fussleiste .knopf').count() === 0,
       'der Knopf unten verschwindet — er könnte nicht sagen, welche er fortsetzt');

    /*
     * Ein frischer Tag bleibt trotzdem startbar. Ohne das käme man bei zwei
     * halben Einheiten aus der Startseite nicht mehr heraus.
     */
    await page.locator('.tagknopf', { hasText: 'Unterkörper' }).click();
    await page.waitForFunction(() => document.querySelector('.heute__tag').innerText
        === 'Unterkörper');
    ok(await page.locator('.fussleiste .knopf').count() === 0,
       'auf dem zweiten offenen Tag bleibt der Knopf ebenfalls weg');

    /* ---------- Eine alte unvollständige Einheit ist KEINE offene --------- */

    const alt = new Date(heute.getTime() - 40 * 86400000);
    t.training({
        [iso(alt).slice(0, 7)]: [
            einheit(iso(alt), 'oberkoerper', 0, { bankdruecken: saetze(60, 8) }),
        ],
    });

    await page.goto('http://127.0.0.1:' + port + '/');
    await page.waitForSelector('.heute__tag');

    ok(await page.locator('.einheit--offen').count() === 0,
       'eine unvollständige Einheit von vor 40 Tagen gilt nicht als offen');
    ok((await page.locator('.einheit__offen').first().innerText()) === 'unvollständig',
       'sie heißt weiter "unvollständig"');

    await page.locator('.einheit').first().click();
    await page.waitForSelector('.einheit__bilanz');
    ok(await page.locator('[data-weiter]').count() === 0,
       'und lässt sich nicht weitertrainieren — sie ist Geschichte');
});
