/*
 * Unterstützungsmaschine: weniger Gewicht ist schwerer.
 *
 * An einer Klimmzug- oder Dip-Maschine nimmt ein Gegengewicht Körpergewicht
 * ab. Fortschritt heißt dort weniger Gewicht. Ohne diese Umkehr schickte
 * die Progressionsregel in die falsche Richtung und machte die Übung mit
 * jeder "Steigerung" leichter.
 */

const { testlauf, saetze, einheit } = require('./hilfen');
const fs = require('fs');

module.exports = (port) => testlauf('Unterstützung', port, async (t) => {
    const { page, ok } = t;

    const uebungen = JSON.parse(
        fs.readFileSync(t.datenordner + '/exercises.json', 'utf8'));
    uebungen.latzug.assisted = true;
    uebungen.latzug.name = 'Klimmzug unterstützt';
    uebungen.latzug.rep_max = 10;
    uebungen.bankdruecken.assisted = false;
    fs.writeFileSync(t.datenordner + '/exercises.json',
        JSON.stringify(uebungen, null, 2));

    // Zweimal sauber an der Obergrenze, bei beiden Übungen. Davor eine
    // Einheit mit mehr Hilfe, damit der Verlauf eine Richtung hat.
    t.training({
        '2026-08': [
            einheit('2026-08-01', 'oberkoerper', 0, {
                latzug: saetze(35, 10, 9, 8, 8),
                bankdruecken: saetze(75, 10, 10, 9, 8),
            }),
            einheit('2026-08-05', 'oberkoerper', 0, {
                latzug: saetze(30, 10, 10, 10, 10),
                bankdruecken: saetze(80, 10, 10, 10, 10),
            }),
            einheit('2026-08-12', 'oberkoerper', 0, {
                latzug: saetze(30, 10, 10, 10, 10),
                bankdruecken: saetze(80, 10, 10, 10, 10),
            }),
        ],
    });

    await t.anmelden();
    await t.studio('Oberkörper');

    /* ---------- Die Empfehlung zeigt in die richtige Richtung ---------- */

    const bank = page.locator('[data-uebung="bankdruecken"]');
    const hilfe = page.locator('[data-uebung="latzug"]');

    /*
     * Seit dem 26.08.2026 steht die Ansage nicht mehr auf der Kachel. Die
     * Richtung zeigt sich also am Regler: Er ist mit dem Tagesziel
     * vorbelegt, und das rechnet an der Unterstützungsmaschine nach unten.
     */
    await bank.locator('.kachel__text').click();
    await page.waitForSelector('.satz--dran');
    ok((await bank.locator('.regler__wert').first().innerText()) === '82,5 kg',
       'normal: aus 80 kg werden 82,5');

    await hilfe.locator('.kachel__text').click();
    await page.waitForFunction(() =>
        document.querySelector('.kachel:has(.satz--dran)').innerText.includes('Klimmzug'));
    const hilfeWert = await hilfe.locator('.regler__wert').first().innerText();
    ok(hilfeWert === '25 kg',
       'unterstützt: aus 30 kg Hilfe werden 25 → "' + hilfeWert + '"');
    ok(hilfeWert !== '35 kg',
       'und ausdrücklich NICHT 35, das wäre leichter statt schwerer');

    /* ---------- Die Eingabe warnt vor der Richtung ---------- */

    const warnung = await hilfe.locator('.wechsel--hilfe').innerText();
    ok(/weniger Gewicht heißt schwerer/i.test(warnung),
       'über den Reglern steht die Umkehr: "' + warnung.split('.')[0] + '"');
    ok((await hilfe.locator('.regler__schritt').innerText()).includes('Hilfe'),
       'und an der Schrittweite steht, dass es Unterstützung ist');

    ok((await hilfe.locator('.kachel__zuletzt').innerText()).includes('kg Hilfe'),
       'das letzte Ergebnis nennt es ebenfalls Hilfe');

    await bank.locator('.kachel__text').click();
    await page.waitForSelector('.satz--dran');
    ok(await bank.locator('.wechsel--hilfe').count() === 0,
       'bei einer normalen Übung steht keine Umkehr da');

    /* ---------- Im Formular umstellbar ---------- */

    // Im Studio führt der Weg über den Startbildschirm zurück in den Plan.
    await page.click('.kopfknopf[data-gehe="start"]');
    await page.waitForSelector('#menue-knopf');
    await t.menue('plan');
    await page.waitForSelector('.zeile');
    await page.locator('.zeile', { hasText: 'Klimmzug' }).locator('.zeile__text').click();
    await page.waitForSelector('#e-assisted');
    ok(await page.locator('#e-assisted').inputValue() === '1',
       'im Formular steht die Gewichtsrichtung auf Unterstützung');

    /* ---------- Der Verlauf misst nicht das Gegenteil ---------- */

    await page.locator('[data-abbrechen]').click();
    await page.waitForSelector('.zeile');
    await page.locator('.zeile', { hasText: 'Klimmzug' }).click();
    await page.waitForSelector('.chart');

    const kopf = await page.locator('.chart__kopf').first().innerText();
    ok(/geringste unterst/i.test(kopf),
       'das erste Diagramm zeigt die geringste Hilfe, nicht das schwerste Gewicht');
    const zweiter = await page.locator('.chart__kopf').nth(1).innerText();
    ok(/wiederholungen/i.test(zweiter) && !/volumen/i.test(zweiter),
       'statt Volumen zählt die Wiederholungsmenge: "'
       + zweiter.replace(/\s+/g, ' ') + '"');
    ok(/fallende Kurve/i.test(await page.locator('.chart__fuss').innerText()),
       'unter der Kurve steht, dass fallend gut ist');
    ok((await page.locator('.verlauf__lese').innerText()).includes('kg Hilfe'),
       'die Ableselinie nennt die Zahl Hilfe');

    const werte = await page.locator('.chart').first().locator('.ch-achse')
        .evaluateAll((ns) => ns.map((n) => n.textContent));
    ok(werte.includes('35') && werte.includes('30'),
       'die y-Achse spannt über die tatsächliche Hilfe: ' + werte.join(' '));

    // Zum Vergleich die normale Übung: dort bleibt alles beim Alten
    await t.menue('plan');
    await page.waitForSelector('.zeile');
    await page.locator('.zeile', { hasText: 'Bankdrücken' }).click();
    await page.waitForSelector('.chart');
    ok(/schwerstes gewicht/i.test(
        await page.locator('.chart__kopf').first().innerText()),
       'ohne Unterstützung heißt es weiter "Schwerstes Gewicht"');
    ok(await page.locator('.chart__fuss').count() === 0,
       'und ohne Leseanleitung');
    ok((await page.locator('.verlauf__lese').innerText()).includes('80 kg ×'),
       'die Ableselinie zeigt dort das schwerste Gewicht: 80 kg');

    await t.menue('plan');
    await page.waitForSelector('.zeile');
    await page.locator('.zeile', { hasText: 'Klimmzug' }).locator('.zeile__text').click();
    await page.waitForSelector('#e-assisted');
    await page.selectOption('#e-assisted', '');
    await page.click('.editor button[type="submit"]');
    await page.waitForSelector('.zeile');
    const gespeichert = JSON.parse(
        fs.readFileSync(t.datenordner + '/exercises.json', 'utf8'));
    ok(gespeichert.latzug.assisted === false,
       'und lässt sich auf normal zurückstellen');
});
