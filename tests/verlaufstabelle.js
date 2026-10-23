/* Der Verlauf einer Übung als Tabelle auf der offenen Studio-Kachel. */

const { testlauf, saetze, einheit } = require('./hilfen');

module.exports = (port) => testlauf('Verlaufstabelle', port, async (t) => {
    const { page, ok } = t;

    const heute = new Date();
    const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
        + '-' + String(d.getDate()).padStart(2, '0');

    // Latzug: 3 bis 12 Wiederholungen laut Testdaten 8–12, 4 Sätze.
    // Zwei feste Einheiten mit bekanntem Ausgang, dazu 28 Füller, damit die
    // Liste länger wird als das Blatt, und eine angefangene Einheit von heute.
    const aug = [
        einheit('2026-08-19', 'oberkoerper', 0, {
            latzug: [{ weight: 50, reps: 8 }, { weight: 55, reps: 8 }, { weight: 60, reps: 8 }, { weight: 60, reps: 8 }],
        }),
        einheit('2026-08-21', 'oberkoerper', 0, { latzug: saetze(60, 9, 9, 9, 9) }),
    ];
    const sep = [];
    for (let i = 1; i <= 28; i++) {
        sep.push(einheit('2026-09-' + String(i).padStart(2, '0'), 'oberkoerper', 0, { latzug: saetze(60, 9, 9, 9, 8) }));
    }
    const monate = { '2026-08': aug, '2026-09': sep };
    const jetzt = iso(heute).slice(0, 7);
    (monate[jetzt] = monate[jetzt] || []).push(einheit(iso(heute), 'oberkoerper', 0, { latzug: saetze(60, 9) }));
    t.training(monate);

    await t.anmelden();
    await t.studio('Oberkörper');

    const latz = page.locator('.kachel', { hasText: 'Latzug' });
    const bank = page.locator('.kachel', { hasText: 'Bankdrücken' });

    ok(await page.locator('.kachel__verlauf').count() === 0, 'zugeklappt steht kein Verlaufsknopf da');

    await latz.locator('.kachel__text').click();
    await page.waitForSelector('.kachel.ist-offen .kachel__verlauf');
    ok(await page.locator('.kachel__verlauf').count() === 1, 'auf der offenen Kachel steht genau ein Verlaufsknopf');

    // Knopf auf Höhe der Punktreihe, rechts daneben
    const lage = await page.evaluate(() => {
        const k = document.querySelector('.kachel.ist-offen');
        const p = k.querySelector('.punkte').getBoundingClientRect();
        const letzter = [...k.querySelectorAll('.punkt')].pop().getBoundingClientRect();
        const b = k.querySelector('.kachel__verlauf').getBoundingClientRect();
        return { mitteP: p.top + p.height / 2, mitteB: b.top + b.height / 2, rechtsP: letzter.right, linksB: b.left,
                 rand: k.getBoundingClientRect().right - b.right };
    });
    ok(Math.abs(lage.mitteP - lage.mitteB) <= 2 && lage.linksB > lage.rechtsP,
       'der Knopf sitzt rechts neben der Punktreihe, auf ihrer Höhe');

    await page.click('.kachel__verlauf');
    await page.waitForSelector('#blatt:not([hidden])');
    ok((await page.locator('#blatt-name').innerText()) === 'Latzug', 'das Blatt nennt die Übung');
    ok((await page.locator('#blatt-nummer').innerText()) === '07', 'und ihre Gerätenummer');

    const zeilen = await page.$$eval('#blatt-zeilen tr', (tr) => tr.map((r) => ({
        text: [...r.cells].slice(0, 3).map((c) => c.textContent).join(' | '),
        ziel: r.cells[3].className,
    })));
    ok(zeilen.length === 30, 'eine Zeile je Einheit, die von heute fehlt (' + zeilen.length + ')');
    ok(zeilen[0].text === 'Mo 28.09.2026 | 60 kg | 9/9/9/8' && zeilen[0].ziel === 'ist-verfehlt',
       'neueste oben, ein Satz unter dem Ziel ist nicht erreicht: ' + zeilen[0].text);
    ok(zeilen[28].text === 'Fr 21.08.2026 | 60 kg | 9/9/9/9' && zeilen[28].ziel === 'ist-erreicht',
       'alle Sätze über dem Ziel ist erreicht: ' + zeilen[28].text);
    ok(zeilen[29].text === 'Mi 19.08.2026 | 50/55/60/60 kg | 8/8/8/8' && zeilen[29].ziel === 'ist-verfehlt',
       'abweichende Gewichte stehen mit Schrägstrich da, ein leichterer Satz ist nicht erreicht: ' + zeilen[29].text);

    // Der Schließen-Knopf bleibt stehen, die Liste läuft dahinter
    const vorher = await page.locator('#blatt-zu').boundingBox();
    const liste = await page.evaluate(() => {
        const l = document.getElementById('blatt-liste');
        const lang = l.scrollHeight > l.clientHeight + 50;
        l.scrollTop = l.scrollHeight;
        return { lang, gescrollt: l.scrollTop > 0 };
    });
    const nachher = await page.locator('#blatt-zu').boundingBox();
    const hoehe = page.viewportSize().height;
    ok(liste.lang && liste.gescrollt, 'die lange Liste läuft innerhalb des Blatts');
    ok(vorher.y === nachher.y && nachher.y + nachher.height <= hoehe,
       'der Schließen-Knopf bleibt dabei an seiner Stelle und ganz sichtbar');
    ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
       'die Tabelle läuft nicht seitlich über');

    await page.click('#blatt-zu');
    ok(await page.locator('#blatt').isHidden(), '"Schließen" schließt das Blatt');
    ok(await latz.evaluate((k) => k.classList.contains('ist-offen')), 'die Kachel bleibt dabei offen');

    await page.click('.kachel__verlauf');
    await page.mouse.click(195, 20);
    ok(await page.locator('#blatt').isHidden(), 'ein Tipp neben das Blatt schließt es ebenfalls');

    // Ohne Verlauf kein Knopf
    await bank.locator('.kachel__text').click();
    await page.waitForFunction(() => document.querySelector('.kachel.ist-offen').innerText.includes('Bankdrücken'));
    ok(await page.locator('.kachel__verlauf').count() === 0, 'eine Übung ohne Verlauf bekommt keinen Knopf');
});
