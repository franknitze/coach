/*
 * Der Fall, für den die Pufferung gebaut ist: schlechter Empfang im Studio.
 *
 * Durchgespielt wird eine ganze Einheit ohne Netz, danach die Rückkehr
 * der Verbindung. Am Ende muss auf dem Server genau das stehen, was im
 * Studio getippt wurde, mit dem richtigen Datum.
 */

const { testlauf, saetze, einheit } = require('./hilfen');

module.exports = (port) => testlauf('Offline-Puffer', port, async (t) => {
    const { page, ok, basis } = t;

    t.logs({
        '2026-08': [
            einheit('2026-08-11', 'oberkoerper', 0, { bankdruecken: saetze(80, 10, 10, 10) }),
        ],
    });

    // Einmal mit Netz öffnen, damit der Tag im Puffer liegt.
    await t.anmelden();
    await t.studio('Oberkörper');
    ok(await page.locator('#status').isHidden(), 'mit Netz und leerem Puffer keine Statusleiste');

    /* ---------- Netz weg ---------- */

    t.konsoleErlauben(/ERR_INTERNET_DISCONNECTED|ERR_NETWORK_CHANGED|ERR_FAILED/);

    /*
     * Zwei Sperren statt einer. setOffline() setzt navigator.onLine auf
     * false, erfasst aber je nach Playwright-Fassung keine Anfragen, die
     * durch den Service Worker laufen — und genau so sendet der Puffer.
     * Dann kam gelegentlich doch ein Satz beim Server an, und der Lauf
     * scheiterte an der Prüfung, dass dort noch nichts stehen darf.
     *
     * Die Route-Sperre schließt den Weg unabhängig davon. Sie gilt nur für
     * die API: die Seite selbst soll weiter aus dem Cache kommen, das ist
     * ja der Punkt der Übung.
     */
    await page.route('**/api/**', function (route) { return route.abort(); });
    await page.context().setOffline(true);

    const bank = page.locator('.kachel', { hasText: 'Bankdrücken' });
    await bank.locator('.kachel__text').click();
    await page.waitForSelector('.satz--dran');

    // Bewusst vom vorbefüllten Wert abweichen: so beweist der Lauf, dass
    // die Eingabe durchkommt und nicht nur die Vorbelegung.
    await bank.locator('[data-aendere$="weight:1"]').click();
    await page.waitForFunction(() =>
        document.querySelector('.satz--dran .regler__wert').innerText === '82,5 kg');

    // Drei Sätze ohne Verbindung
    for (let i = 0; i < 3; i++) {
        await bank.locator('[data-bestaetige]').click();
        await page.waitForFunction((n) =>
            document.querySelectorAll('.satz--fertig').length === n, i + 1);
        await page.click('#pause-weg');
    }

    ok(await bank.locator('.satz--fertig').count() === 3, 'drei Sätze ohne Netz bestätigt');
    ok(await page.locator('.kachel', { hasText: 'Latzug' })
        .locator('.kachel__platzhalter').count() === 1,
       'ein ohne Netz nicht ladbares Foto weicht der Gerätenummer, kein kaputtes Bildsymbol');
    ok(await bank.locator('.punkt.ist-voll').count() === 3, 'die Kachel zeigt sie als erledigt');

    const status = await page.locator('#status').innerText();
    ok(status.includes('Ohne Netz') && status.includes('3 Sätze'),
       'die Statusleiste nennt Zahl und Lage: "' + status + '"');

    const gepuffert = await page.evaluate(() =>
        JSON.parse(localStorage.getItem('coach.warteschlange')));
    ok(gepuffert.length === 3, 'drei Einträge liegen im Puffer');
    ok(gepuffert.every((e) => typeof e.performed_at === 'string'),
       'jeder Eintrag trägt seinen Zeitpunkt, sonst landete er am falschen Tag');
    ok(gepuffert.map((e) => e.set_index).join() === '0,1,2',
       'die Satznummern sind fortlaufend, kein Eintrag überschreibt den anderen');

    /* ---------- Neu laden, immer noch ohne Netz ---------- */

    await page.reload();
    await page.waitForSelector('.heute__tag');
    ok((await page.locator('.heute__tag').innerText()) === 'Oberkörper',
       'nach dem Neuladen ohne Netz ist der Trainingstag noch da');
    await page.click('[data-gehe="studio"]');
    await page.waitForSelector('.kachel');
    ok(await page.locator('.kachel', { hasText: 'Bankdrücken' })
        .locator('.punkt.ist-voll').count() === 3,
       'und die drei Sätze sind nicht verloren');
    ok((await page.evaluate(() =>
        JSON.parse(localStorage.getItem('coach.warteschlange')).length)) === 3,
       'der Puffer hat das Neuladen überlebt');

    // Auf dem Server darf noch nichts stehen
    const vorher = await (await fetch(basis + '/api/export.php',
        { headers: { 'X-API-Key': 'testschluessel' } })).json();
    ok(vorher.summary.sessions === 1, 'auf dem Server steht bis hierher nur die alte Einheit');

    /* ---------- Netz zurück ---------- */

    await page.unroute('**/api/**');
    await page.context().setOffline(false);
    await page.evaluate(() => dispatchEvent(new Event('online')));

    await page.waitForFunction(() =>
        JSON.parse(localStorage.getItem('coach.warteschlange') || '[]').length === 0,
        null, { timeout: 15000 });
    ok(true, 'sobald Empfang da ist, leert sich der Puffer von selbst');
    ok(await page.locator('#status').isHidden(), 'die Statusleiste verschwindet wieder');

    const nachher = await (await fetch(basis + '/api/export.php',
        { headers: { 'X-API-Key': 'testschluessel' } })).json();
    ok(nachher.summary.sessions === 2, 'auf dem Server steht jetzt eine zweite Einheit');

    const heute = new Date().toISOString().slice(0, 10);
    const neu = Object.values(nachher.logs).flat()
        .find((s) => s.date.startsWith(heute));
    ok(!!neu, 'sie trägt das heutige Datum, nicht das der Übertragung');

    const gesichert = neu.exercises.find((e) => e.exercise_id === 'bankdruecken');
    ok(gesichert.sets.length === 3, 'genau drei Sätze, keine Verdopplung');
    ok(gesichert.sets.every((s) => s.weight === 82.5),
       'mit den Werten aus dem Studio: ' + JSON.stringify(gesichert.sets));

    /* ---------- Doppeltes Senden schadet nicht ---------- */

    await page.evaluate(() => {
        const alt = JSON.parse(localStorage.getItem('coach.plan.oberkoerper'));
        localStorage.setItem('coach.warteschlange', JSON.stringify([{
            day: 'oberkoerper', rotation_index: alt.rotation_index,
            exercise_id: 'bankdruecken', set_index: 1,
            weight: 82.5, reps: 10, performed_at: new Date().toISOString(),
        }]));
        dispatchEvent(new Event('online'));
    });
    await page.waitForFunction(() =>
        JSON.parse(localStorage.getItem('coach.warteschlange') || '[]').length === 0,
        null, { timeout: 15000 });

    const nochmal = await (await fetch(basis + '/api/export.php',
        { headers: { 'X-API-Key': 'testschluessel' } })).json();
    const wieder = Object.values(nochmal.logs).flat()
        .find((s) => s.date.startsWith(heute))
        .exercises.find((e) => e.exercise_id === 'bankdruecken');
    ok(wieder.sets.length === 3,
       'ein zweites Mal geschickter Satz überschreibt sich, statt sich zu verdoppeln');

    /* ---------- Ein Satz von gestern gehört zu gestern ----------
     *
     * Der eigentliche Grund für performed_at. Wer abends im Funkloch
     * trainiert und die App erst am nächsten Morgen wieder öffnet, darf
     * seine Einheit nicht im falschen Tag wiederfinden.
     */

    const gestern = new Date(Date.now() - 86400000);
    const gesternTag = gestern.toISOString().slice(0, 10);

    const antwort = await page.evaluate(async (wann) => {
        const r = await fetch('api/session.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                day: 'oberkoerper', rotation_index: 0, exercise_id: 'latzug',
                set_index: 0, weight: 60, reps: 12, performed_at: wann,
            }),
        });
        return r.status;
    }, gestern.toISOString());
    ok(antwort === 200, 'ein nachgereichter Satz von gestern wird angenommen');

    const spaet = await (await fetch(basis + '/api/export.php',
        { headers: { 'X-API-Key': 'testschluessel' } })).json();
    const gesternSession = Object.values(spaet.logs).flat()
        .find((s) => s.date.startsWith(gesternTag));
    ok(!!gesternSession && gesternSession.exercises.some((e) => e.exercise_id === 'latzug'),
       'und liegt unter dem ' + gesternTag + ', nicht unter heute');

    /* ---------- Grenzen des mitgeschickten Zeitpunkts ---------- */

    const grenzen = await page.evaluate(async () => {
        const schicken = async (wann) => {
            const r = await fetch('api/session.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    day: 'oberkoerper', rotation_index: 0, exercise_id: 'latzug',
                    set_index: 5, weight: 60, reps: 12, performed_at: wann,
                }),
            });
            return r.status;
        };
        return {
            zukunft: await schicken(new Date(Date.now() + 86400000).toISOString()),
            uralt: await schicken('2020-01-01T07:00:00+01:00'),
            unfug: await schicken('gestern irgendwann'),
        };
    });
    ok(grenzen.zukunft === 422, 'ein Zeitpunkt in der Zukunft wird abgelehnt');
    ok(grenzen.uralt === 422, 'ein Zeitpunkt vor Monaten wird abgelehnt');
    ok(grenzen.unfug === 422, 'unlesbare Zeitangaben werden abgelehnt');
});
