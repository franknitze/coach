/* Phase 2: Tagesvorschlag, Kacheln, Satz-Eingabe, Pausen-Timer. */

const fs = require('fs');
const path = require('path');

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

    /* ---------- Die App führt, sie listet nicht ---------- */

    ok(await page.locator('.satz--dran').count() === 1,
       'die erste unfertige Übung steht beim Betreten von selbst offen');
    ok((await page.locator('.kachel').first().getAttribute('class')).includes('ist-offen'),
       'und zwar die oberste, nicht irgendeine');
    const fortschritt = await page.locator('.fortschritt').innerText();
    ok(fortschritt.includes('0 von 3') && /0\/\d+ Sätze/.test(fortschritt),
       'oben steht, wo man in der Einheit ist: "' + fortschritt.replace(/\s+/g, ' ') + '"');

    /*
     * Der Ausgang steht auch in der offenen Einheit unter der letzten
     * Kachel. Eine Einheit wird nicht immer fertig, und dann muss man sie
     * trotzdem beenden können, ohne erst alles abzuhaken.
     */
    ok(await page.locator('.beenden').count() === 1,
       'unter der letzten Kachel steht der Ausgang, auch bei offener Einheit');
    ok(await page.locator('.beenden__stand').innerText() === '0 von 11 Sätzen',
       'mit dem Stand als Auskunft: "' + await page.locator('.beenden__stand').innerText() + '"');
    ok(await page.locator('.beenden .knopf--leise').count() === 1,
       'und zurückhaltend gesetzt, das Gelb gehört "Satz bestätigen"');

    const bank = page.locator('.kachel', { hasText: 'Bankdrücken' });
    ok((await bank.innerText()).includes('zuletzt 80 kg × 10'), 'Kachel zeigt das letzte Ergebnis');
    ok(await bank.locator('.punkt').count() === 4, '4 Punkte für 4 Zielsätze');
    ok(await bank.locator('.punkt.ist-voll').count() === 0, 'heute noch nichts erledigt');
    ok(await bank.locator('.kachel__platzhalter').innerText() === '43', 'Gerätenummer statt fehlendem Foto');

    /* ---------- Foto groß, Text klappt auf: zwei getrennte Ziele ---------- */

    const latz = page.locator('.kachel', { hasText: 'Latzug' });
    await latz.locator('.kachel__foto').click();
    await page.waitForSelector('#lupe:not([hidden])');
    ok(true, 'ein Tipp aufs Foto zeigt es groß');
    ok((await page.locator('#lupe-name').innerText()).includes('Latzug'),
       'mit dem Namen der Übung');
    ok((await page.locator('#lupe-nummer').innerText()) === '07',
       'und der Gerätenummer, damit man die Maschine findet');
    ok(!(await latz.getAttribute('class')).includes('ist-offen'),
       'das Foto klappt die angetippte Übung NICHT auf');
    ok((await page.locator('.kachel.ist-offen').innerText()).includes('Bankdrücken'),
       'und reißt auch die gerade offene Übung nicht weg');

    await page.click('#lupe');
    ok(await page.locator('#lupe').isHidden(), 'ein zweiter Tipp schließt wieder');

    await bank.locator('.kachel__text').click();
    await page.waitForSelector('.satz--dran');
    ok(await bank.locator('.regler__wert').first().innerText() === '80 kg', 'Gewicht vorbefüllt');
    ok(await bank.locator('.regler__wert').nth(1).innerText() === '12 Wdh', 'Wiederholungen vorbefüllt');

    await bank.locator('[data-aendere$="weight:1"]').click();
    await page.waitForFunction(() =>
        document.querySelector('.satz--dran .regler__wert').innerText === '82,5 kg');
    ok(true, 'Plus erhöht um die Schrittweite der Übung (2,5 kg)');

    await bank.locator('[data-aendere$="reps:-1"]').click();
    ok(await bank.locator('.regler__wert').nth(1).innerText() === '11 Wdh', 'Minus senkt die Wiederholungen');

    /*
     * Der Text allein genügt als Prüfung nicht. Die Knöpfe schreiben den
     * neuen Wert aus Geschwindigkeitsgründen direkt in die Anzeige, statt
     * neu zu zeichnen; ein textContent auf .regler__wert ersetzt dabei die
     * beiden Spans, die Zahl und Einheit verschieden groß setzen. Der Wert
     * stimmte danach, aber die Zahl schrumpfte auf die kleine Schrift.
     */
    const gross = await bank.locator('.regler__zahl').first()
        .evaluate((n) => getComputedStyle(n).fontSize);
    const klein = await bank.locator('.regler__einheit').first()
        .evaluate((n) => getComputedStyle(n).fontSize);
    ok(await bank.locator('.regler__zahl').count() === 2
       && parseFloat(gross) > parseFloat(klein) + 10,
       'nach dem Tippen steht die Zahl weiter groß über der Einheit: '
       + gross + ' gegen ' + klein);

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

    /* ---------- Ist eine Übung durch, rückt die App weiter ---------- */

    // Bankdrücken bis zum letzten Satz durchziehen und prüfen, dass die
    // App danach von selbst zur nächsten Übung rückt.
    while (await bank.locator('.punkt.ist-voll').count() < 4) {
        await bank.locator('[data-bestaetige]').click();
        await page.waitForTimeout(250);
        if (await page.locator('#pause:not([hidden])').count()) {
            await page.click('#pause-weg');
        }
    }
    ok(await bank.locator('.punkt.ist-voll').count() === 4, 'Bankdrücken vollständig');
    ok((await bank.getAttribute('class')).includes('ist-fertig'),
       'die erledigte Kachel ist als erledigt gekennzeichnet');
    ok(!(await bank.getAttribute('class')).includes('ist-offen'),
       'und klappt zu');

    const offen = await page.locator('.kachel.ist-offen').innerText();
    ok(offen.includes('Latzug'),
       'die nächste Übung öffnet sich von selbst: ' + offen.split('\n')[0]);
    ok((await page.locator('.fortschritt').innerText()).includes('1 von 3'),
       'der Fortschritt zählt mit');

    await page.reload();
    await page.waitForSelector('[data-gehe="studio"], .leer__titel');
    ok((await page.locator('.heute__zeile').innerText()).includes('heute schon 4 Sätze'),
       'Startseite meldet den heutigen Fortschritt: '
       + (await page.locator('.heute__zeile').innerText()));
    await page.click('[data-gehe="studio"]');
    await page.waitForSelector('.kachel');
    ok(await page.locator('.kachel', { hasText: 'Bankdrücken' }).locator('.punkt.ist-voll').count() === 4,
       'die Sätze liegen nach dem Neuladen auf der Platte');
    ok((await page.locator('.kachel.ist-offen').innerText()).includes('Latzug'),
       'und die App steht wieder bei der nächsten offenen Übung');

    /* ---------- Die Anleitung an der Übung ----------
     *
     * "Wie geht das nochmal" fragt man vor dem Gerät, nicht zu Hause in der
     * Verwaltung. Eingeklappt, weil der Weg über diese Kachel neunmal pro
     * Einheit führt und die Frage höchstens einmal auftaucht.
     */

    // Latzug ist gerade offen und hat in der Vorgabe keine Ausführung.
    ok(await page.locator('.kachel.ist-offen [data-anleitung]').count() === 0,
       'ohne hinterlegte Ausführung gibt es keinen Aufklapper');

    await page.locator('.kachel', { hasText: 'Bankdrücken' }).locator('.kachel__text').click();
    await page.waitForSelector('.kachel.ist-offen [data-anleitung]');
    const kachel = page.locator('.kachel.ist-offen');
    ok(await kachel.locator('[data-anleitung]').count() === 1,
       'die offene Kachel bietet die Ausführung an');
    ok(await kachel.locator('.ausfuehrung').count() === 0,
       'aber eingeklappt, die Regler bleiben oben');

    await kachel.locator('[data-anleitung]').click();
    await page.waitForSelector('.kachel .ausfuehrung');
    const text = await kachel.locator('.ausfuehrung__text').innerText();
    ok(text.length > 20, 'aufgeklappt steht die Ausführung da: "'
        + text.slice(0, 46) + '…"');
    ok(await kachel.locator('[data-anleitung]').getAttribute('aria-expanded') === 'true',
       'und der Aufklapper sagt es auch der Vorlesehilfe');

    const video = kachel.locator('.ausfuehrung__suche a').first();
    ok((await video.getAttribute('href')).includes('youtube.com'),
       'das Video ist von hier aus erreichbar');
    ok(await video.getAttribute('target') === '_blank',
       'und öffnet daneben, damit die Einheit nicht verlassen wird');

    // Die Regler müssen erreichbar bleiben, sonst verdeckt die Anleitung
    // genau das, wofür man die Kachel geöffnet hat.
    ok(await kachel.locator('.satz__fertig, .satz--dran').count() >= 1,
       'die Eingabe steht weiter darunter');

    await kachel.locator('[data-anleitung]').click();
    await page.waitForSelector('.kachel .ausfuehrung', { state: 'detached' });
    ok(true, 'ein zweiter Tipp klappt sie wieder zu');

    // Eine andere Übung fängt zugeklappt an
    await kachel.locator('[data-anleitung]').click();
    await page.waitForSelector('.kachel .ausfuehrung');
    await page.locator('.kachel', { hasText: 'Schulterdrücken' }).locator('.kachel__text').click();
    await page.waitForSelector('.kachel.ist-offen .satz--dran');
    ok(await page.locator('.kachel .ausfuehrung').count() === 0,
       'die nächste Übung beginnt wieder zugeklappt');

    /* ---------- Bei null verschwindet die Pause von selbst ----------
     *
     * Dort stand einmal ein grüner Zustand mit "Weiter". Der sagte nur,
     * was man ohnehin sieht, und kostete einen Tipp, bevor man wieder an
     * den Reglern war. Zwei Sekunden statt zwei Minuten, sonst wartet der
     * Testlauf mit.
     */
    const cfgDatei = path.join(t.datenordner, 'config.json');
    const cfg = JSON.parse(fs.readFileSync(cfgDatei, 'utf8'));
    cfg.rest_timer_seconds = 2;
    cfg.rest_pair_seconds = 2;
    fs.writeFileSync(cfgDatei, JSON.stringify(cfg, null, 2));

    t.logs({});
    await page.reload();
    await page.waitForSelector('.heute__tag');
    await t.studio('Oberkörper');
    await page.waitForSelector('.satz--dran');

    await page.locator('.kachel', { hasText: 'Bankdrücken' })
        .locator('[data-bestaetige]').click();
    await page.waitForSelector('#pause:not([hidden])');
    ok(true, 'nach einem Satz mitten in der Einheit läuft die Pause');

    await page.waitForSelector('#pause', { state: 'hidden', timeout: 8000 });
    ok(true, 'bei null verschwindet sie von selbst, ohne zweiten Zustand');
    ok(await page.locator('#pause-weg').innerText() === 'Überspringen',
       'der Knopf wurde nie zu "Weiter" — es gibt keinen Zustand danach');
    /* ---------- Nach dem letzten Satz keine Pause mehr ----------
     *
     * Eine Pause dient dem nächsten Satz. Nach dem letzten gibt es keinen,
     * und zwei Minuten Countdown hieße, jemanden vor dem Ausgang warten zu
     * lassen. Geprüft wird mit einem echten Tipp, nicht über die Logdatei:
     * die Pause startet ja im Bestätigen-Handler.
     */

    const heuteIso = new Date().toISOString().slice(0, 10);
    t.logs({
        [heuteIso.slice(0, 7)]: [
            einheit(heuteIso, 'oberkoerper', 0, {
                bankdruecken: saetze(80, 10, 10, 10, 10),
                latzug: saetze(60, 12, 12, 12, 12),
                schulterdruecken: saetze(30, 10, 10),   // einer fehlt noch
            }),
        ],
    });

    await page.reload();
    await page.waitForSelector('.heute__tag');
    await t.studio('Oberkörper');
    await page.waitForSelector('.satz--dran');

    const schluss = page.locator('.kachel', { hasText: 'Schulterdrücken' });
    ok(await schluss.locator('.satz--dran').count() === 1,
       'die App öffnet die einzige Übung, der noch ein Satz fehlt');

    await schluss.locator('[data-bestaetige]').click();
    await page.waitForSelector('.geschafft');
    ok(!(await page.locator('#pause').isVisible()),
       'nach dem letzten Satz des Tages läuft keine Pause mehr');

    /* ---------- Nach dem Abschluss geht die Rotation weiter ----------
     *
     * Der Fall aus dem Studio: Einheit fertig, "Einheit beenden" gedrückt,
     * und die Startseite bot weiter denselben, längst erledigten Tag an.
     * "Weiter trainieren" führte zurück in die fertige Einheit, wo nur
     * wieder "Einheit beenden" stand. Ein Kreis ohne Ausgang.
     */

    const heute = new Date().toISOString().slice(0, 10);
    t.logs({
        [heute.slice(0, 7)]: [
            einheit(heute, 'oberkoerper', 0, {
                bankdruecken: saetze(80, 10, 10, 10, 10),
                latzug: saetze(60, 12, 12, 12, 12),
                schulterdruecken: saetze(30, 10, 10, 10),
            }),
        ],
    });

    await page.reload();
    await page.waitForSelector('.heute__tag');
    ok(await page.locator('.heute__tag').innerText() === 'Unterkörper',
       'nach der heutigen Einheit schlägt der Server den nächsten Tag vor');

    // Von Hand zurück auf den erledigten Tag, so wie man es nach dem
    // letzten Satz vor sich hat.
    await page.locator('.tagknopf', { hasText: 'Oberkörper' }).click();
    await page.waitForFunction(() => document.querySelector('.heute__tag').innerText === 'Oberkörper');
    await page.click('[data-gehe="studio"]');
    await page.waitForSelector('.geschafft');
    ok(await page.locator('.geschafft').count() === 2,
       'die fertige Einheit bietet den Abschluss oben und unten an');
    ok(await page.locator('.beenden').count() === 0,
       'der leise Ausgang weicht dabei der Erfolgsmeldung');

    await page.locator('.geschafft [data-gehe="start"]').first().click();
    await page.waitForSelector('.heute__tag');
    ok(await page.locator('.heute__tag').innerText() === 'Unterkörper',
       '"Einheit beenden" gibt den festgehaltenen Tag frei, der nächste ist dran');
    ok((await page.locator('.fussleiste .knopf').innerText()) === 'Los geht\'s',
       'und der Knopf lädt zur neuen Einheit statt zum Weitermachen');
});
