/* Blättern in "Letzte Einheiten" auf der Startseite. */

const { testlauf, saetze, einheit } = require('./hilfen');

module.exports = (port) => testlauf('Blättern im Rückblick', port, async (t) => {
    const { page, ok } = t;

    // 24 Einheiten an festen Tagen im August und September 2026
    const aug = [], sep = [];
    for (let i = 1; i <= 12; i++) {
        aug.push(einheit('2026-08-' + String(i * 2).padStart(2, '0'), 'oberkoerper', 0, { bankdruecken: saetze(80, 8, 8, 8, 8) }));
        sep.push(einheit('2026-09-' + String(i * 2).padStart(2, '0'), 'unterkoerper', 1, { beinpresse: saetze(120, 10, 10, 10, 10) }));
    }
    t.training({ '2026-08': aug, '2026-09': sep });

    await t.anmelden();
    await page.waitForSelector('.rueckblick__steuer');

    const stand = () => page.evaluate(() => ({
        zahl: document.querySelector('.rueckblick__steuer .kal__zahl').textContent,
        zeilen: document.querySelectorAll('.rueckblick .einheit').length,
        erste: document.querySelector('.rueckblick .einheit .einheit__wann').textContent,
        aelter: document.querySelector('[data-seite="aelter"]').disabled,
        neuer: document.querySelector('[data-seite="neuer"]').disabled,
    }));

    ok(await page.locator('.rueckblick .tag__zahl').count() === 0, 'oben neben der Überschrift steht keine Zahl mehr');

    let s = await stand();
    ok(s.zahl === '1–10 von 24' && s.zeilen === 10, 'erste Seite: ' + s.zahl + ', ' + s.zeilen + ' Zeilen');
    ok(s.erste.startsWith('Do, 24. Sep'), 'oben steht die neueste Einheit: ' + s.erste);
    ok(!s.aelter && s.neuer, 'zurück zu älteren geht, zu neueren nicht');

    await page.click('[data-seite="aelter"]');
    await page.waitForFunction(() => document.querySelector('.rueckblick__steuer .kal__zahl').textContent === '11–20 von 24');
    s = await stand();
    ok(s.zeilen === 10 && s.erste.startsWith('Fr, 4. Sep'),
       'zweite Seite beginnt mit der elften Einheit: ' + s.erste);
    ok(!s.aelter && !s.neuer, 'in der Mitte gehen beide Richtungen');

    await page.click('[data-seite="aelter"]');
    await page.waitForFunction(() => document.querySelector('.rueckblick__steuer .kal__zahl').textContent === '21–24 von 24');
    s = await stand();
    ok(s.zeilen === 4 && s.erste.includes('8. Aug') && s.aelter && !s.neuer,
       'letzte Seite: vier Einheiten ab dem 8. August, weiter zurück geht nicht: ' + s.erste);

    await page.click('[data-seite="neuer"]');
    await page.waitForFunction(() => document.querySelector('.rueckblick__steuer .kal__zahl').textContent === '11–20 von 24');
    ok(true, 'und wieder vor');

    // Ohne Netz bleibt die Seite stehen
    await page.context().route('**/api/einheiten.php*', (r) => r.abort());
    t.konsoleErlauben(/Failed to load resource|ERR_FAILED|net::/);
    await page.click('[data-seite="aelter"]');
    await page.waitForTimeout(500);
    s = await stand();
    ok(s.zahl === '11–20 von 24' && s.zeilen === 10, 'scheitert das Laden, bleibt die bisherige Seite stehen');
    await page.context().unroute('**/api/einheiten.php*');

    // Wer auf die Startseite zurückkommt, steht wieder auf der ersten Seite
    await t.menue('plan');
    await page.click('[data-gehe="start"]');
    await page.waitForFunction(() => document.querySelector('.rueckblick__steuer .kal__zahl')
        && document.querySelector('.rueckblick__steuer .kal__zahl').textContent === '1–10 von 24');
    ok(true, 'zurück auf der Startseite steht wieder die erste Seite');

    // Mit höchstens zehn Einheiten keine Blätterzeile
    t.training({ '2026-09': sep.slice(0, 5) });
    await page.reload();
    await page.waitForSelector('.rueckblick .einheit');
    ok(await page.locator('.rueckblick__steuer').count() === 0, 'bei fünf Einheiten gibt es nichts zu blättern');
});
