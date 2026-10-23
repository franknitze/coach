/*
 * Eine Übung entfernen (Frank, 23.10.2026): ausblenden, wieder aktivieren,
 * vollständig löschen. Ausblenden behält alle Daten, Löschen nimmt auch die
 * Sätze, vorher mit Sicherungskopie.
 */

const { testlauf, saetze, einheit } = require('./hilfen');
const fs = require('fs');
const path = require('path');

module.exports = (port) => testlauf('Übung entfernen', port, async (t) => {
    const { page, ok } = t;
    const daten = (datei) => JSON.parse(fs.readFileSync(path.join(t.datenordner, datei), 'utf8'));

    // Latzug kommt in drei Einheiten vor, in einer davon als einzige Übung.
    t.training({ '2026-09': [
        einheit('2026-09-01', 'oberkoerper', 0, { bankdruecken: saetze(80, 8, 8, 8, 8), latzug: saetze(60, 10, 10, 10, 10) }),
        einheit('2026-09-03', 'oberkoerper', 0, { latzug: saetze(60, 11, 11, 11, 11) }),
        einheit('2026-09-05', 'oberkoerper', 0, { bankdruecken: saetze(80, 9, 9, 9, 9), latzug: saetze(60, 12, 12, 12, 12) }),
    ] });
    const ex = daten('exercises.json');
    ex.latzug.order = 2;
    ex.schulterdruecken.order = 3;
    fs.writeFileSync(path.join(t.datenordner, 'exercises.json'), JSON.stringify(ex, null, 2));

    await t.anmelden();
    await page.click('#menue-knopf');
    ok(await page.locator('[data-menue="ausgeblendet"]').isHidden(), 'ohne ausgeblendete Übung kein Menüeintrag dafür');
    await page.click('#menue-knopf');

    /* ---------- Ausblenden ---------- */

    await t.menue('plan');
    await page.locator('.zeile', { hasText: 'Latzug' }).locator('.zeile__text').click();
    await page.waitForSelector('[data-entfernen]');
    ok(await page.locator('[data-entfernen]').innerText() === 'Entfernen', 'unter der Übung steht "Entfernen"');
    await page.click('[data-entfernen]');
    ok(await page.locator('#frage').isVisible(), 'es öffnet sich die Rückfrage');
    const knoepfe = await page.$$eval('#frage button', (b) => b.map((x) => x.textContent.trim()));
    ok(knoepfe.join(' | ') === 'Ausblenden | Vollständig löschen | Abbrechen', 'drei Wege: ' + knoepfe.join(' | '));

    await page.click('[data-frage-zu]');
    ok(await page.locator('#frage').isHidden() && daten('exercises.json').latzug && !daten('exercises.json').latzug.hidden,
       '"Abbrechen" ändert nichts');

    await page.click('[data-entfernen]');
    await page.click('[data-frage-ausblenden]');
    await page.waitForFunction(() => document.querySelectorAll('.zeile').length > 0);
    ok(daten('exercises.json').latzug.hidden === true, 'die Übung trägt hidden: true und steht weiter in exercises.json');
    ok(daten('training/2026-09.json').length === 3, 'alle drei Einheiten sind unverändert da');
    ok(await page.locator('.zeile', { hasText: 'Latzug' }).count() === 0, 'in den Einstellungen steht sie nicht mehr');
    ok((await page.locator('#rueckmeldung').innerText()) === 'Latzug ist ausgeblendet.', 'oben kommt eine Rückmeldung');

    // Studio und Rückblick
    await page.click('[data-gehe="start"]');
    await t.studio('Oberkörper');
    ok(await page.locator('.kachel', { hasText: 'Latzug' }).count() === 0, 'im Studio steht sie nicht mehr');
    await page.click('.kopfknopf[data-gehe="start"]');
    await page.waitForSelector('.rueckblick .einheit');
    const einheiten = await page.$$eval('.rueckblick .einheit', (e) => e.map((x) => x.innerText));
    ok(einheiten.length === 3, 'im Rückblick stehen weiter alle drei Einheiten');
    await page.locator('.rueckblick .einheit').nth(1).click();
    await page.waitForSelector('.kachel');
    ok((await page.locator('.kachel').first().innerText()).includes('Latzug'), 'die Leseansicht nennt die ausgeblendete Übung mit Namen');

    // Von dort aus bearbeitet und gespeichert bleibt sie ausgeblendet
    await page.locator('.kachel', { hasText: 'Latzug' }).locator('.kachel__text').click();
    await page.waitForSelector('.editor');
    ok(await page.locator('[data-aktivieren]').isVisible() && await page.locator('[data-entfernen]').count() === 0,
       'eine ausgeblendete Übung bietet im Formular "Wieder aktivieren" statt "Entfernen"');
    await page.click('.editor button[type="submit"]');
    await page.waitForFunction(() => !document.querySelector('.editor'));
    ok(daten('exercises.json').latzug.hidden === true, 'Speichern blendet sie nicht nebenbei wieder ein');
    await page.click('#menue-knopf');
    await page.click('#menue-knopf');

    /* ---------- Übersicht und wieder aktivieren ---------- */

    // In der Zwischenzeit rückt Schulterdrücken auf die alte Stelle des Latzugs
    const ex2 = daten('exercises.json');
    ex2.schulterdruecken.order = 2;
    fs.writeFileSync(path.join(t.datenordner, 'exercises.json'), JSON.stringify(ex2, null, 2));
    await page.reload();
    await page.waitForSelector('#menue-knopf');
    await page.click('#menue-knopf');
    ok(await page.locator('[data-menue="ausgeblendet"]').isVisible(), 'jetzt steht "Ausgeblendete Übungen" im Menü');
    await page.click('[data-menue="ausgeblendet"]');
    await page.waitForSelector('.zeile');
    const zeile = page.locator('.zeile', { hasText: 'Latzug' });
    ok(await zeile.count() === 1 && await zeile.locator('img').count() === 1
       && (await zeile.innerText()).includes('07') && (await zeile.innerText()).includes('Rücken'),
       'die Übersicht zeigt den Latzug als Zeile wie in den Einstellungen, mit Foto, Nummer und Daten');
    ok((await page.locator('.tag__name').first().innerText()).toLowerCase().includes('oberkörper'),
       'nach Trainingstag gruppiert');

    // Antippen öffnet die Übung, dort stehen Aktivieren und Löschen
    await zeile.locator('.zeile__text').click();
    await page.waitForSelector('.editor');
    ok(await page.locator('[data-aktivieren]').isVisible(), 'die Übung lässt sich öffnen, dort steht "Wieder aktivieren"');
    await page.click('[data-abbrechen]');
    await page.waitForSelector('.zeile');
    ok((await page.locator('.titel').innerText()) === 'Ausgeblendet', '"Abbrechen" führt zurück in die Übersicht');

    await zeile.locator('.zeile__text').click();
    await page.click('[data-aktivieren]');
    await page.waitForSelector('.tag__leer');
    ok((await page.locator('.titel').innerText()) === 'Ausgeblendet', 'nach dem Aktivieren steht man wieder in der Übersicht, jetzt leer');
    const zurueck = daten('exercises.json');
    ok(zurueck.latzug.hidden === false && zurueck.latzug.day === 'oberkoerper' && zurueck.latzug.order === 2,
       'wieder aktiviert: alter Tag, alte Stelle');
    ok(zurueck.schulterdruecken.order === 3, 'was inzwischen auf der Stelle stand, rückt eins nach');

    /* ---------- Vollständig löschen ---------- */

    await t.menue('plan');
    await page.locator('.zeile', { hasText: 'Latzug' }).locator('.zeile__text').click();
    await page.click('[data-entfernen]');
    await page.click('[data-frage-loeschen]');
    await page.waitForSelector('[data-frage-endgueltig]');
    const text = await page.locator('#frage').innerText();
    ok(text.includes('Wirklich alle Daten löschen?') && text.includes('3 Einheiten'),
       'zweite Frage mit der Zahl der Einheiten: ' + text.split('\n').slice(0, 2).join(' / '));
    await page.click('[data-frage-zu]');
    ok(daten('exercises.json').latzug, 'Abbrechen in der zweiten Frage löscht nichts');

    await page.click('[data-entfernen]');
    await page.click('[data-frage-loeschen]');
    await page.click('[data-frage-endgueltig]');
    await page.waitForFunction(() => document.getElementById('rueckmeldung').textContent === 'Latzug ist gelöscht.');
    await page.waitForFunction(() => document.querySelectorAll('.zeile').length > 0);
    ok(await page.locator('.zeile', { hasText: 'Latzug' }).count() === 0, 'nach dem Löschen steht man in der Liste, ohne Latzug');
    const danach = daten('training/2026-09.json');
    ok(!daten('exercises.json').latzug, 'die Übung ist aus exercises.json verschwunden');
    ok(danach.length === 2, 'die Einheit, in der nur der Latzug stand, ist weg');
    ok(danach.every((s) => s.exercises.every((e) => e.exercise_id !== 'latzug')), 'kein einziger Latzug-Satz ist übrig');
    ok(danach.every((s) => s.exercises.some((e) => e.exercise_id === 'bankdruecken')), 'das Bankdrücken der anderen Einheiten bleibt');
    const sicherung = fs.readdirSync(path.join(t.datenordner, 'sicherung'));
    ok(sicherung.some((f) => /^exercises-\d{8}-\d{6}-vor-loeschen\.json$/.test(f))
       && sicherung.some((f) => /^2026-09-\d{8}-\d{6}-vor-loeschen\.json$/.test(f)),
       'vorher liegt eine Sicherung beider Dateien in data/sicherung/: ' + sicherung.join(', '));
    const kopie = JSON.parse(fs.readFileSync(path.join(t.datenordner, 'sicherung',
        sicherung.find((f) => f.startsWith('2026-09'))), 'utf8'));
    ok(kopie.length === 3, 'die Sicherung enthält den Stand vor dem Löschen');
});
