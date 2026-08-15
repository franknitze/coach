/* Phase 4: die Coach-Ansage auf der Kachel. */

const { testlauf, saetze, einheit } = require('./hilfen');

module.exports = (port) => testlauf('Coach', port, async (t) => {
    const { page, ok } = t;

    // Die drei Zweige aus SPEC.md §7 nebeneinander auf einem Bildschirm:
    // bankdruecken zweimal sauber an der Obergrenze  -> steigern
    // latzug mitten im Bereich                        -> halten
    // schulterdruecken auch bester Satz unter rep_min -> zurueckholen
    t.logs({
        '2026-08': [
            einheit('2026-08-05', 'oberkoerper', 0, {
                bankdruecken: saetze(80, 10, 10, 10),
                latzug: saetze(60, 9, 9, 8),
                schulterdruecken: saetze(40, 9, 9, 8),
            }),
            einheit('2026-08-12', 'oberkoerper', 0, {
                bankdruecken: saetze(80, 10, 10, 10),
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

    ok((await bank.locator('.kachel__coach').innerText()).includes('82,5 kg'),
       'Handlung steht vorn: "' + (await bank.locator('.kachel__coach').innerText()) + '"');
    ok((await bank.locator('.kachel__grund').innerText()).includes('sauber'),
       'Begründung leise darunter: "' + (await bank.locator('.kachel__grund').innerText()) + '"');
    ok(await latz.locator('.kachel__grund').count() === 0, 'ohne Begründung keine zweite Zeile');

    ok(await bank.locator('.kachel__coach.ist-faellig').count() === 1, 'fällige Steigerung hervorgehoben');
    ok(await latz.locator('.kachel__coach.ist-faellig').count() === 0, 'Halten bleibt zurückhaltend');
    ok(await schu.locator('.kachel__coach.ist-faellig').count() === 0, 'Zurückholen bleibt zurückhaltend');

    ok((await latz.locator('.kachel__coach').innerText()).includes('Ziel 11'),
       'Halten nennt das nächste Wiederholungsziel');
    ok((await schu.locator('.kachel__coach').innerText()).includes('zurück auf 8'),
       'Zurückholen nennt die untere Grenze');

    const faellig = await bank.locator('.kachel__coach').evaluate((n) => getComputedStyle(n).color);
    const leise = await latz.locator('.kachel__coach').evaluate((n) => getComputedStyle(n).color);
    ok(faellig === 'rgb(200, 86, 43)', 'fällige Steigerung trägt das Orange: ' + faellig);
    ok(faellig !== leise, 'die beiden unterscheiden sich sichtbar');

    // Der Coach entscheidet nicht für Frank
    await bank.locator('.kachel__kopf').click();
    await page.waitForSelector('.satz--dran');
    ok(await bank.locator('.regler__wert').first().innerText() === '80 kg',
       'Eingabe bleibt beim letzten Wert, nicht beim Coach-Vorschlag');
});
