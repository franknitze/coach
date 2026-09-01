/* Phase 4: die Coach-Ansage auf der Kachel. */

const { testlauf, saetze, einheit } = require('./hilfen');

module.exports = (port) => testlauf('Coach', port, async (t) => {
    const { page, ok } = t;

    // Die drei Zweige aus SPEC.md §7 nebeneinander auf einem Bildschirm:
    // bankdruecken zweimal sauber an der Obergrenze  -> steigern
    // latzug mitten im Bereich                        -> halten
    // schulterdruecken auch bester Satz unter rep_min -> zurueckholen
    t.training({
        '2026-08': [
            einheit('2026-08-05', 'oberkoerper', 0, {
                bankdruecken: saetze(80, 10, 10, 10, 10),
                latzug: saetze(60, 9, 9, 8),
                schulterdruecken: saetze(40, 9, 9, 8),
            }),
            einheit('2026-08-12', 'oberkoerper', 0, {
                bankdruecken: saetze(80, 10, 10, 10, 10),
                latzug: saetze(60, 10, 9, 9),
                schulterdruecken: saetze(45, 7, 6, 6),
            }),
        ],
    });

    await t.anmelden();
    await t.studio('Oberkörper');

    const bank = page.locator('.kachel', { hasText: 'Bankdrücken' });
    const latz = page.locator('.kachel', { hasText: 'Latzug' });
    const schu = page.locator('.kachel', { hasText: 'Schulterdrücken' });

    /* ---------- Die Ansage steht nicht mehr auf der Kachel ----------
     *
     * Bis zum 26.08.2026 stand dort "82,5 kg" beziehungsweise "Ziel 11
     * Wiederholungen", bei einer fälligen Steigerung in Orange. Frank hat
     * die Zeile entfernt: Auf der Kachel soll unter der Vorgabe nur noch
     * das letzte Ergebnis stehen.
     *
     * Die REGEL lebt weiter — sie befüllt die Regler. Geprüft wird sie
     * direkt in PHP (tests/regel.js, alle zwölf Zweige) und hier unten am
     * Ergebnis in der Oberfläche.
     */
    ok(await page.locator('.kachel__coach').count() === 0,
       'die Coach-Ansage steht auf keiner Kachel mehr');

    await latz.locator('.kachel__text').click();
    await page.waitForFunction(() =>
        document.querySelectorAll('.kachel:has(.satz--dran)').length === 1);
    ok(await latz.locator('.kachel__coach').count() === 0,
       'auch aufgeklappt nicht');

    await schu.locator('.kachel__text').click();
    await page.waitForFunction(() =>
        document.querySelector('.kachel:has(.satz--dran)').innerText.includes('Schulterdrücken'));
    ok((await schu.locator('.regler__wert').first().innerText()) === '45 kg',
       'Zurückholen wirkt trotzdem: der Regler hält das Gewicht');
    ok((await schu.locator('.regler__wert').nth(1).innerText()) === '8 Wdh',
       'und setzt die Wiederholungen auf die untere Grenze zurück');

    /* ---------- Die Regler stehen auf dem Tagesziel ----------
     *
     * Umgekehrte Festlegung: Bis zum 26.08.2026 blieb die Eingabe beim
     * letzten Wert, damit niemand im Halbschlaf eine Steigerung bestätigt,
     * die er nicht geschafft hat. Frank hat das umgedreht — im Feld soll
     * stehen, was er erreichen soll.
     *
     * Anlass war eine widersprüchliche Kachel: Oben stand "130 kg halten",
     * im Regler 80 kg, weil die Vorbelegung den Satz an derselben Position
     * nahm und das ein Aufwärmsatz war.
     *
     * Bankdrücken steht hier zweimal sauber auf 80 kg × 10, der Coach
     * steigert also auf 82,5 kg. Neues Gewicht heißt: die Wiederholungen
     * beginnen unten wieder, also bei rep_min.
     */
    await bank.locator('.kachel__text').click();
    await page.waitForSelector('.satz--dran');
    ok(await bank.locator('.regler__wert').first().innerText() === '82,5 kg',
       'die Eingabe steht auf dem Coach-Vorschlag, nicht mehr beim letzten Wert');
    ok(await bank.locator('.regler__wert').nth(1).innerText() === '6 Wdh',
       'und die Wiederholungen beginnen beim neuen Gewicht unten wieder');
});
