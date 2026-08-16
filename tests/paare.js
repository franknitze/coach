/*
 * Übungen im Wechsel (Supersätze).
 *
 * Drücken gegen Ziehen: nach einem Satz führt die App zur Partnerübung,
 * mit kürzerer Pause. Jeder Muskel bekommt trotzdem die volle Pause, weil
 * er ruht, während der Gegenspieler arbeitet.
 */

const { testlauf, saetze, einheit } = require('./hilfen');
const fs = require('fs');

module.exports = (port) => testlauf('Paare im Wechsel', port, async (t) => {
    const { page, ok } = t;

    // Zwei gepaarte Übungen und eine ungepaarte in derselben Einheit.
    const uebungen = JSON.parse(
        fs.readFileSync(t.datenordner + '/exercises.json', 'utf8'));
    uebungen.bankdruecken.partner = 'latzug';
    uebungen.bankdruecken.target_sets = 2;
    uebungen.latzug.partner = 'bankdruecken';
    uebungen.latzug.target_sets = 2;
    uebungen.schulterdruecken.partner = '';
    fs.writeFileSync(t.datenordner + '/exercises.json',
        JSON.stringify(uebungen, null, 2));

    t.logs({});
    await t.anmelden();
    await t.studio('Oberkörper');

    // Über data-uebung adressieren, nicht über den Text: seit die Kacheln
    // ihre Partnerübung nennen, steht "Bankdrücken" auch beim Latzug.
    const bank = page.locator('[data-uebung="bankdruecken"]');
    const latz = page.locator('[data-uebung="latzug"]');
    const schu = page.locator('[data-uebung="schulterdruecken"]');

    ok((await bank.innerText()).includes('Im Wechsel mit'),
       'die offene Kachel nennt ihre Partnerübung');
    ok((await bank.locator('.wechsel').innerText()).includes('Latzug'),
       'und zwar namentlich');

    /* ---------- Nach dem Satz geht es zum Partner ---------- */

    await bank.locator('[data-bestaetige]').click();
    await page.waitForFunction(() =>
        document.querySelector('.kachel.ist-offen').dataset.uebung === 'latzug');
    ok(true, 'nach dem Satz führt die App zum Latzug');
    ok(await bank.locator('.punkt.ist-voll').count() === 1,
       'der Satz beim Bankdrücken ist eingetragen');
    ok(!(await bank.getAttribute('class')).includes('ist-fertig'),
       'Bankdrücken ist noch nicht fertig, nur pausiert');

    const kurz = await page.locator('#pause-zeit').innerText();
    ok(kurz === '1:30', 'die Pause ist die kürzere von 90 Sekunden: ' + kurz);
    // Kleinschreibung vergleichen: die Leiste steht in Versalien.
    const leiste = (await page.locator('.pause__mini').innerText()).toLowerCase();
    ok(leiste.includes('latzug'),
       'die Pausenleiste sagt, was als Nächstes kommt: "' + leiste + '"');
    await page.click('#pause-weg');

    /* ---------- Und wieder zurück ---------- */

    await latz.locator('[data-bestaetige]').click();
    await page.waitForFunction(() =>
        document.querySelector('.kachel.ist-offen').dataset.uebung === 'bankdruecken');
    ok(true, 'nach dem Latzug geht es zurück zum Bankdrücken');
    await page.click('#pause-weg');

    /* ---------- Ist der Partner durch, endet der Wechsel ---------- */

    await bank.locator('[data-bestaetige]').click();     // Bankdrücken 2 von 2
    await page.waitForFunction(() =>
        document.querySelector('.kachel.ist-offen').dataset.uebung === 'latzug');
    await page.click('#pause-weg');

    await latz.locator('[data-bestaetige]').click();     // Latzug 2 von 2
    await page.waitForFunction(() =>
        document.querySelector('.kachel.ist-offen').dataset.uebung === 'schulterdruecken',
        null, { timeout: 10000 });
    ok(true, 'sind beide durch, geht es zur nächsten Übung');
    ok((await bank.getAttribute('class')).includes('ist-fertig')
       && (await latz.getAttribute('class')).includes('ist-fertig'),
       'beide Partner sind als erledigt gekennzeichnet');

    /* ---------- Ungepaarte Übung: volle Pause, kein Hinweis ---------- */

    ok(await schu.locator('.wechsel').count() === 0,
       'ohne Partner steht kein Wechselhinweis da');

    await schu.locator('[data-bestaetige]').click();
    await page.waitForSelector('#pause:not([hidden])');
    const lang = await page.locator('#pause-zeit').innerText();
    ok(lang === '2:00', 'und die volle Pause von zwei Minuten läuft: ' + lang);
});
