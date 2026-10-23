/* Phase 1: Übungsbibliothek anlegen, ändern, löschen. */

const fs = require('fs');
const path = require('path');

const { testlauf, PASSWORT } = require('./hilfen');

module.exports = (port) => testlauf('Verwaltung', port, async (t) => {
    const { page, ok } = t;
    await page.goto('http://127.0.0.1:' + port + '/');

    // Ohne Anmeldung kommt man nicht rein
    ok(await page.locator('#anmeldung').count() === 1, 'ohne Anmeldung nur das Anmeldeformular');
    ok(await page.locator('#app').count() === 0, 'kein App-Bereich vor der Anmeldung');

    await page.fill('#passwort', 'falsch');
    await page.click('#anmelden');
    await page.waitForFunction(() => document.getElementById('fehler').textContent.length > 0);
    ok((await page.locator('#fehler').innerText()).includes('Passwort'), 'falsches Passwort wird abgewiesen');

    await t.anmelden();

    /* ---------- Abmelden: unten und in zwei Schritten ----------
     *
     * Der Knopf saß oben rechts im Kopf, also da, wo der Daumen beim
     * Halten des Handys ohnehin liegt. Ein Fehlgriff kostet im Studio den
     * Zugang, denn Anmelden braucht das Netz, das dort oft fehlt.
     */

    /*
     * Seit dem 23.10.2026 steht Abmelden im Menü oben rechts (Franks
     * Vorgabe), abgesetzt durch einen Trennstrich unter Kalender und
     * Einstellungen. Die Nachfrage bleibt.
     */
    ok(await page.locator('#menue').isHidden(), 'das Menü ist zu');
    ok(await page.locator('#abmelden').isHidden(), 'Abmelden ist ohne Menü nicht zu sehen');
    await page.click('#menue-knopf');
    ok(await page.locator('#menue').isVisible(), 'der Knopf oben rechts öffnet das Menü');
    const reihe = await page.$$eval('#menue > *', (k) => k.map((e) => e.tagName === 'HR' ? '---' : e.textContent.trim()));
    ok(reihe.join(' | ') === 'Kalender | Einstellungen | --- | Abmelden',
       'Reihenfolge: Kalender, Einstellungen, Trennstrich, Abmelden: ' + reihe.join(' | '));
    ok(await page.locator('#menue [data-menue="kalender"]').isHidden()
       && await page.locator('#menue [data-menue="plan"]').isVisible(),
       'ohne eine einzige Einheit fehlt der Kalender, Einstellungen sind da');

    const raus = page.locator('#abmelden');
    await raus.click();
    ok((await raus.innerText()).toLowerCase().includes('wirklich'),
       'ein Tipp fragt erst nach: "' + (await raus.innerText()) + '"');
    ok(await page.locator('#menue').isVisible() && await page.locator('#app').count() === 1,
       'das Menü bleibt dabei offen, und niemand ist abgemeldet');

    // Jede andere Berührung nimmt die Frage zurück und schließt das Menü
    await page.locator('.wortmarke').click();
    ok(await page.locator('#menue').isHidden(), 'ein Tipp daneben schließt das Menü');
    await page.click('#menue-knopf');
    ok((await raus.innerText()) === 'Abmelden',
       'und nimmt die Frage zurück');

    await raus.click();
    await raus.click();
    await page.waitForSelector('#anmeldung');
    ok(true, 'zweimal getippt meldet ab');

    await t.anmelden();

    // Der Bereich heißt in der Oberfläche "Einstellungen". Intern bleibt er
    // "plan", weil daran api/settings.php und plan.json hängen; die beiden
    // Namen dürfen auseinanderlaufen, aber nicht unbemerkt.
    ok(await page.locator('#menue [data-menue="plan"]').innerText() === 'Einstellungen',
       'der Eintrag im Menü heißt Einstellungen');
    ok(await page.locator('.verweis').count() === 0,
       'unter dem Rückblick stehen keine Verweise mehr, beides ist im Menü');

    await t.menue('plan');
    await page.waitForSelector('.zeile');
    ok(await page.locator('.titel').innerText() === 'Einstellungen',
       'und die Überschrift dort ebenso');

    const vorher = await page.locator('.zeile').count();

    // Anlegen
    await page.locator('[data-neu="unterkoerper"]').click();
    await page.waitForSelector('.editor');
    await page.fill('#e-name', 'Wadenheben');
    await page.fill('#e-station', '21');
    await page.selectOption('#e-group', 'beine');
    await page.fill('#e-sets', '3');
    await page.fill('#e-min', '10');
    await page.fill('#e-max', '15');

    // Die Schrittweiten stehen an zwei Stellen: die Auswahl hier und die
    // Prüfung in lib/uebungen.php. Driften sie auseinander, bietet das
    // Formular einen Wert an, den der Server ablehnt.
    const stufen = await page.locator('#e-step option').allInnerTexts();
    ok(stufen.join(' ') === '0,25 kg 0,5 kg 1 kg 1,25 kg 2,5 kg 5 kg',
       'sechs Schrittweiten zur Auswahl: ' + stufen.join(' · '));
    await page.selectOption('#e-step', '0.25');

    await page.click('.editor button[type="submit"]');
    await page.waitForFunction((n) => document.querySelectorAll('.zeile').length === n, vorher + 1);
    ok(true, 'Übung über das Formular angelegt');

    const zeile = await page.locator('.zeile', { hasText: 'Wadenheben' }).innerText();
    ok(zeile.includes('0,25 kg'), 'der Server nimmt die kleinste Schrittweite an');
    ok(zeile.includes('21'), 'Gerätenummer steht als Plakette in der Liste');
    ok(zeile.includes('Beine'), 'Muskelgruppe lesbar statt als Schlüssel');
    ok(!(await page.locator('.zeile').first().innerText()).includes('ruecken'), 'nirgends ein roher Schlüssel');

    // Pflichtfeld
    await page.locator('[data-neu="unterkoerper"]').click();
    await page.fill('#e-name', '   ');
    await page.click('.editor button[type="submit"]');
    await page.waitForFunction(() => {
        const p = document.querySelector('.editor .fehler');
        return p && p.textContent.trim().length > 0;
    });
    ok(true, 'leerer Name wird abgefangen: "'
        + (await page.locator('.editor .fehler').innerText()).trim() + '"');
    await page.locator('[data-abbrechen]').click();
    await page.waitForSelector('.zeile');

    // Löschen in zwei Schritten
    await page.locator('.zeile', { hasText: 'Wadenheben' }).click();
    await page.waitForSelector('.editor');
    ok(await page.locator('[data-frage]').isVisible(), 'erster Schritt: "Übung löschen"');
    await page.locator('[data-frage]').click();
    ok(await page.locator('[data-loesche]').isVisible(), 'zweiter Schritt: "Wirklich löschen"');
    await page.locator('[data-loesche]').click();
    await page.waitForFunction((n) => document.querySelectorAll('.zeile').length === n, vorher);
    ok(true, 'gelöscht, Liste wieder bei ' + vorher);

    /* ---------- Schwerpunkte: am 22.08.2026 aus der Oberfläche genommen ----
     *
     * Der Schalter schrieb einen Wert, den kein Codepfad las. Der Lauf steht
     * hier auskommentiert, damit er mit dem Schalter zusammen zurückkommt.
     * Die Prüfung, dass er WEG ist, steht weiter unten und läuft.
     *
     * await page.click('[data-bereich="allgemein"]');
     * await page.waitForSelector('.prio');
     * await page.locator('[data-prio="trizeps"][data-wert="focus"]').click();
     * await page.waitForTimeout(400);
     * await page.reload();
     * // Auf den fertig gezeichneten Bereich warten, nicht auf #app: das
     * // steht schon mit "Wird geladen" im HTML, bevor die API antwortete.
     * await page.waitForSelector('[data-gehe="plan"]');
     * await t.menue('plan');
     * await page.click('[data-bereich="allgemein"]');
     * await page.waitForSelector('.prio');
     * const an = await page.locator('[data-prio="trizeps"][data-wert="focus"]')
     *     .getAttribute('class');
     * ok(an.includes('ist-an'), 'Schwerpunkt überlebt das Neuladen');
     */
    /* ---------- Die 30 Tage zählen ab der letzten Benutzung ----------
     *
     * Vorher lief das Cookie 30 Tage nach dem Anmelden ab, egal wie oft man
     * die App benutzt hatte: PHP schickt es nur mit, wenn die Session neu
     * entsteht. Wer täglich trainiert, wäre trotzdem nach einem Monat
     * ausgesperrt worden.
     */

    const kekse = async () => (await page.context().cookies())
        .find((c) => c.name === 'coach');

    const sessionOrdner = path.join(t.datenordner, 'sessions');
    const sessionZeit = () => {
        const ordner = sessionOrdner;
        return Math.max(...fs.readdirSync(ordner)
            .map((f) => fs.statSync(path.join(ordner, f)).mtimeMs));
    };

    const vorherKeks = (await kekse()).expires;
    const vorherDatei = sessionZeit();
    ok(vorherKeks > Date.now() / 1000 + 86400 * 29,
       'nach dem Anmelden läuft das Cookie in rund 30 Tagen ab');

    await page.waitForTimeout(1500);
    await page.reload();
    await page.waitForSelector('#app');

    const nachherKeks = (await kekse()).expires;
    ok(nachherKeks > vorherKeks,
       'jede Benutzung schiebt das Ablaufdatum weiter: +'
       + Math.round(nachherKeks - vorherKeks) + ' Sekunden');
    ok(sessionZeit() > vorherDatei,
       'und die Session-Datei wird angefasst, sonst räumt der Aufräumlauf sie weg');

    /* ---------- Ohne Cookie entsteht keine Sitzungsdatei ----------
     *
     * Vorher legte jeder Aufruf eine an, auch der eines Prüfskripts. Im
     * Betrieb waren so über hundert Dateien mit null Byte aufgelaufen, von
     * denen genau eine eine echte Anmeldung war.
     */
    const vorherAnzahl = fs.readdirSync(sessionOrdner).length;

    const ohneKeks = await page.context().browser().newContext();
    const fremd = await ohneKeks.newPage();
    await fremd.goto(t.basis + '/');
    await fremd.waitForSelector('#anmeldung');
    await fremd.goto(t.basis + '/api/exercises.php');
    await ohneKeks.close();

    ok(fs.readdirSync(sessionOrdner).length === vorherAnzahl,
       'zwei Aufrufe ohne Anmeldung legen keine Sitzungsdatei an');

    /* ---------- Abgelaufene Dateien fliegen raus ---------- */

    const uralt = path.join(sessionOrdner, 'sess_' + 'a'.repeat(32));
    fs.writeFileSync(uralt, '');
    const lange_her = Date.now() / 1000 - 86400 * 40;
    fs.utimesSync(uralt, lange_her, lange_her);
    // Die Marke zurückdatieren, sonst hält der Lauf sich an "einmal am Tag".
    const marke = path.join(sessionOrdner, '.aufgeraeumt');
    if (fs.existsSync(marke)) fs.utimesSync(marke, lange_her, lange_her);

    await page.reload();
    await page.waitForSelector('#app');
    ok(!fs.existsSync(uralt),
       'eine 40 Tage alte Sitzungsdatei wird beim nächsten Aufruf entfernt');

    // Leere tragen nichts und dürfen früher weg, aber nicht sofort: Beim
    // Schreiben ist eine Datei kurz leer.
    const leerAlt = path.join(sessionOrdner, 'sess_' + 'b'.repeat(32));
    const leerNeu = path.join(sessionOrdner, 'sess_' + 'c'.repeat(32));
    fs.writeFileSync(leerAlt, '');
    fs.writeFileSync(leerNeu, '');
    const zweiStunden = Date.now() / 1000 - 7200;
    fs.utimesSync(leerAlt, zweiStunden, zweiStunden);
    fs.utimesSync(marke, lange_her, lange_her);

    await page.reload();
    await page.waitForSelector('#app');
    ok(!fs.existsSync(leerAlt), 'eine leere Datei von vor zwei Stunden fliegt raus');
    ok(fs.existsSync(leerNeu), 'eine gerade erst entstandene bleibt liegen');

    /* ---------- Einstellungen: zwei Bereiche ----------
     *
     * Die Seite trug alles auf einmal: Übungen, Körpergewicht,
     * Schwerpunkte. Das Passwort wäre der vierte Block gewesen, ganz
     * unten, hinter 25 Übungszeilen.
     */

    await t.menue('plan');
    await page.waitForSelector('.schalter--breit');

    const bereiche = await page.locator('.schalter--breit .schalter__teil').allInnerTexts();
    ok(bereiche.join('|') === 'Übungen|Allgemein',
       'zwei Bereiche zur Auswahl: ' + bereiche.join(', '));

    ok(await page.locator('[data-bereich="uebungen"].ist-an').count() === 1,
       'Übungen ist der Bereich, in dem man landet');
    ok(await page.locator('.zeile').count() > 0, 'und zeigt die Übungsbibliothek');
    ok(await page.locator('#passwort-form').count() === 0,
       'das Passwortformular steht dort nicht mit herum');

    await page.click('[data-bereich="allgemein"]');
    await page.waitForSelector('#passwort-form');
    ok(await page.locator('.zeile__text').count() === 0,
       'Allgemein zeigt keine Übungen');
    ok(await page.locator('#gewicht-form').count() === 1, 'dafür das Körpergewicht');

    /*
     * Der Schwerpunkt-Schalter ist am 22.08.2026 aus der Oberfläche genommen
     * worden: Er schrieb "focus" nach plan.json, und den Wert las kein
     * Codepfad. Etwas anzuzeigen, das nichts bewirkt, ist schlechter als es
     * wegzulassen. Diese Prüfung hält den Zustand fest — wer den Schalter
     * zurückholt, ohne die Wirkung zu bauen, sieht hier Rot.
     */
    ok(await page.locator('.prio').count() === 0,
       'der Schwerpunkt-Schalter steht nicht mehr in der Oberfläche');

    /* ---------- Passwort ändern ----------
     *
     * Ging bis zum 22.08.2026 nur über die Kommandozeile. Wer die App auf
     * gewöhnlichem Webspace ohne SSH betreibt, konnte sein Passwort also
     * überhaupt nicht wechseln.
     */

    const konfig = () => JSON.parse(
        fs.readFileSync(path.join(t.datenordner, 'config.json'), 'utf8'));

    const konfigVorher = konfig();

    /**
     * Füllt die drei Felder, schickt ab und gibt die Rückmeldung zurück.
     *
     * Gewartet wird auf das geleerte erste Feld: Die Felder leeren sich
     * nur durch das Neuzeichnen nach der Antwort, das ist also der
     * eindeutige Moment. Auf den Text der Meldung zu warten ginge nicht,
     * die vorige steht bis dahin noch da.
     */
    async function passwortSenden(alt, neu, wiederholung) {
        await page.fill('#p-alt', alt);
        await page.fill('#p-neu', neu);
        await page.fill('#p-neu2', wiederholung === undefined ? neu : wiederholung);
        await page.click('#passwort-form button[type="submit"]');
        await page.waitForFunction(() => {
            const f = document.getElementById('p-alt');
            return f && f.value === '';
        });
        const m = page.locator('#passwort-form .fehler, #passwort-form .quittung');
        return await m.count() === 0 ? '' : (await m.first().innerText()).trim();
    }

    let meldung = await passwortSenden('das-ist-nicht-das-passwort', 'egal-egal-egal');
    ok(meldung === 'Das aktuelle Passwort stimmt nicht.',
       'ein falsches aktuelles Passwort wird abgewiesen: "' + meldung + '"');

    /*
     * Und die Meldung bleibt stehen. Der Endpunkt antwortet mit 403 und
     * nicht mit 401: Auf eine 401 lädt das Frontend im angemeldeten
     * Bereich die Seite neu, weil das dort "Sitzung abgelaufen" heißt.
     * Man stünde wortlos wieder auf der Startseite.
     */
    ok(await page.locator('#passwort-form').count() === 1,
       'und man steht weiter im Formular, die Seite lädt nicht neu');
    ok(konfig().password_hash === konfigVorher.password_hash,
       'das Passwort auf der Platte ist unverändert');

    meldung = await passwortSenden(PASSWORT, 'kurz');
    ok(meldung.includes('8 Zeichen'), 'zu kurz wird abgewiesen: "' + meldung + '"');

    meldung = await passwortSenden(PASSWORT, 'lang-genug-1', 'lang-genug-2');
    ok(meldung.includes('nicht überein'),
       'zwei verschiedene Eingaben werden abgewiesen: "' + meldung + '"');

    ok(konfig().password_hash === konfigVorher.password_hash,
       'nach drei Fehlversuchen steht immer noch das alte Passwort');

    const NEU = 'das-neue-testpasswort';
    meldung = await passwortSenden(PASSWORT, NEU);
    ok(meldung === 'Passwort geändert.', 'die Bestätigung steht da: "' + meldung + '"');
    ok(await page.locator('#passwort-form .quittung').count() === 1,
       'als Bestätigung und nicht als Fehler');

    const konfigNachher = konfig();
    ok(konfigNachher.password_hash !== konfigVorher.password_hash, 'der Hash ist ein anderer');

    /*
     * Der Rest von config.json muss stehen bleiben. Ginge der api_key
     * verloren, holte das n8n-Backup ab sofort nichts mehr ab, und es
     * würde niemandem auffallen.
     */
    ok(konfigNachher.api_key === konfigVorher.api_key,
       'der API-Schlüssel für das Backup bleibt unangetastet');
    ok(konfigNachher.session_lifetime_days === konfigVorher.session_lifetime_days,
       'die übrigen Einstellungen auch');

    // Angemeldet bleibt man: die Session bekommt nur eine neue Kennung.
    await page.reload();
    await page.waitForSelector('#app .heute__tag');
    ok(await page.locator('#anmeldung').count() === 0,
       'man bleibt angemeldet, obwohl das Passwort ein anderes ist');

    /* ---------- Und es gilt wirklich ---------- */

    const raus2 = page.locator('#abmelden');
    await page.click('#menue-knopf');
    await raus2.click();
    await raus2.click();
    await page.waitForSelector('#anmeldung');

    await page.fill('#passwort', PASSWORT);
    await page.click('#anmelden');
    await page.waitForFunction(() => document.getElementById('fehler').textContent.length > 0);
    ok(await page.locator('#app').count() === 0, 'das alte Passwort lässt niemanden mehr rein');

    await page.fill('#passwort', NEU);
    await page.click('#anmelden');
    await page.waitForSelector('#app .heute__tag');
    ok(true, 'das neue Passwort tut es');
});
