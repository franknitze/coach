/*
 * Keine Paare mehr (Frank, 23.10.2026). Auch eine Übung, die in alten Daten
 * noch ein Feld "partner" trägt, wird am Stück gemacht: nach dem Satz bleibt
 * sie offen, die Pause ist die volle.
 */

const { testlauf } = require('./hilfen');
const fs = require('fs');

module.exports = (port) => testlauf('Ohne Paare', port, async (t) => {
    const { page, ok } = t;

    const uebungen = JSON.parse(fs.readFileSync(t.datenordner + '/exercises.json', 'utf8'));
    uebungen.bankdruecken.partner = 'latzug';
    uebungen.bankdruecken.target_sets = 2;
    uebungen.latzug.partner = 'bankdruecken';
    fs.writeFileSync(t.datenordner + '/exercises.json', JSON.stringify(uebungen, null, 2));

    t.training({});
    await t.anmelden();
    await t.studio('Oberkörper');

    const bank = page.locator('[data-uebung="bankdruecken"]');
    ok(await page.locator('.wechsel:not(.wechsel--hilfe)').count() === 0,
       'kein Hinweis "Im Wechsel mit" auf der Kachel');

    await bank.locator('[data-bestaetige]').click();
    await page.waitForSelector('#pause-zeit');
    await page.waitForTimeout(300);
    ok(await page.evaluate(() => document.querySelector('.kachel.ist-offen').dataset.uebung) === 'bankdruecken',
       'nach dem ersten Satz bleibt Bankdrücken offen, die App springt nicht zum Latzug');
    const zeit = await page.locator('#pause-zeit').innerText();
    ok(zeit === '2:00' || zeit === '1:59', 'die Pause ist die volle von zwei Minuten: ' + zeit);
    ok((await page.locator('.pause__mini').innerText()).toLowerCase() === 'pause',
       'die Pausenleiste nennt keine nächste Übung');
    await page.click('#pause-weg');

    await bank.locator('[data-bestaetige]').click();
    await page.waitForFunction(() => document.querySelector('.kachel.ist-offen').dataset.uebung !== 'bankdruecken');
    ok(await page.evaluate(() => document.querySelector('.kachel.ist-offen').dataset.uebung) === 'latzug',
       'erst wenn Bankdrücken durch ist, geht es zur nächsten Übung der Reihe');
});
