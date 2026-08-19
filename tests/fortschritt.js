/* Der Fortschritts-Index, direkt in PHP geprüft. Kein Browser nötig. */

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const WURZEL = path.resolve(__dirname, '..');

module.exports = function fortschritt() {
    console.log('### Fortschritts-Index ###');

    const ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'coach-index-'));
    fs.mkdirSync(path.join(ordner, 'logs'));
    fs.writeFileSync(path.join(ordner, 'config.json'), JSON.stringify({
        password_hash: '', api_key: '', default_weight_step: 5,
        rest_timer_seconds: 120, session_lifetime_days: 30,
    }));

    let bestanden = 0;
    let gescheitert = 0;

    const ok = (bedingung, text) => {
        if (bedingung) {
            bestanden++;
            console.log('  ok   ' + text);
        } else {
            gescheitert++;
            console.log('  FEHL ' + text);
        }
    };

    const s = (g, ...w) => w.map((r) => ({ weight: g, reps: r }));

    /** Schreibt Logs und Körpergewicht, rechnet den Index und gibt ihn zurück. */
    function rechne(sessions, uebungen, gewichte) {
        fs.writeFileSync(path.join(ordner, 'logs', '2026-08.json'), JSON.stringify(sessions));
        fs.writeFileSync(path.join(ordner, 'gewicht.json'), JSON.stringify(gewichte || []));

        const ausgabe = execFileSync('php', ['-r', `
            require "${WURZEL}/lib/fortschritt.php";
            $u = json_decode('${JSON.stringify(uebungen)}', true);
            echo json_encode(fortschritt_punkte($u));
        `], { env: Object.assign({}, process.env, { COACH_DATA: ordner }) }).toString();

        return JSON.parse(ausgabe);
    }

    const einheit = (tag, uebungen) => ({
        date: tag + 'T07:00:00+02:00', day: 'oberkoerper', rotation_index: 0,
        exercises: Object.entries(uebungen).map(([id, sets]) => ({ exercise_id: id, sets })),
    });

    const normal = { bank: { id: 'bank' }, latz: { id: 'latz' }, schulter: { id: 'schulter' } };

    /* ---------- Die erste Einheit ist der Nullpunkt ---------- */

    let p = rechne([
        einheit('2026-08-01', { bank: s(50, 5), latz: s(60, 10) }),
    ], normal);
    ok(p.length === 1 && p[0].wert === 100, 'die erste Einheit steht auf 100: ' + p[0].wert);

    /* ---------- Mehr Gewicht und mehr Wiederholungen heben den Wert ---------- */

    p = rechne([
        einheit('2026-08-01', { bank: s(50, 5), latz: s(60, 10) }),
        // bank 55×5: 64,17 / 58,33 = 1,100   latz 60×12: 84 / 80 = 1,05
        einheit('2026-08-03', { bank: s(55, 5), latz: s(60, 12) }),
    ], normal);
    ok(p[1].wert === 107.5,
       'Gewicht (+10 %) und Wiederholungen (+5 %) ergeben im Mittel 107,5: ' + p[1].wert);

    /* ---------- Die Zahl der Übungen verschiebt die Skala nicht ---------- */

    // Jede Übung genau +10 %. Der Mittelwert muss dann bei jeder Anzahl
    // 110 ergeben — das ist die Eigenschaft, wegen der es ein Mittelwert
    // ist und keine Summe.
    const zwei = rechne([
        einheit('2026-08-01', { bank: s(50, 5), latz: s(60, 10) }),
        einheit('2026-08-03', { bank: s(55, 5), latz: s(66, 10) }),
    ], normal);
    const drei = rechne([
        einheit('2026-08-01', { bank: s(50, 5), latz: s(60, 10), schulter: s(30, 10) }),
        einheit('2026-08-03', { bank: s(55, 5), latz: s(66, 10), schulter: s(33, 10) }),
    ], normal);
    ok(zwei[1].wert === 110 && drei[1].wert === 110,
       'zwei und drei Übungen mit je +10 % ergeben beide 110: '
       + zwei[1].wert + ' und ' + drei[1].wert);

    /* ---------- Eine neu aufgenommene Übung startet bei 100 ---------- */

    p = rechne([
        einheit('2026-08-01', { bank: s(50, 5), latz: s(60, 10) }),
        einheit('2026-08-03', { bank: s(55, 5), latz: s(60, 12) }),
        // schulter kommt neu dazu und zieht den Mittelwert auf (1,10+1,05+1,00)/3
        einheit('2026-08-05', { bank: s(55, 5), latz: s(60, 12), schulter: s(30, 10) }),
    ], normal);
    ok(p[2].wert === 105 && p[2].uebungen === 3,
       'eine neue Übung startet bei 100 und dellt den Mittelwert: ' + p[2].wert);

    /* ---------- Ein Abbruch ist kein Rückschritt ---------- */

    p = rechne([
        einheit('2026-08-01', { bank: s(50, 5, 5, 5, 5), latz: s(60, 10, 10, 10) }),
        // Nur ein Satz je Übung, aber dieselben Werte: der Index misst
        // nicht, wie viel, sondern wie schwer.
        einheit('2026-08-03', { bank: s(50, 5), latz: s(60, 10) }),
    ], normal);
    ok(p[1].wert === 100,
       'weniger Sätze bei gleichem Gewicht senken den Wert nicht: ' + p[1].wert);

    /* ---------- Unterstützungsmaschine: weniger Hilfe hebt den Wert ---------- */

    const hilfe = { klimm: { id: 'klimm', assisted: true } };

    p = rechne([
        einheit('2026-08-01', { klimm: s(30, 8) }),
        einheit('2026-08-03', { klimm: s(20, 8) }),
    ], hilfe, [{ date: '2026-08-01', kg: 90 }]);
    ok(p.length === 2 && p[1].wert > 100,
       'weniger Hilfe heißt mehr Last und hebt den Wert: ' + (p[1] && p[1].wert));

    /* ---------- Ohne Körpergewicht bleibt sie draußen ---------- */

    p = rechne([
        einheit('2026-08-01', { klimm: s(30, 8) }),
        einheit('2026-08-03', { klimm: s(20, 8) }),
    ], hilfe, []);
    ok(p.length === 0,
       'ohne eingetragenes Körpergewicht liefert eine reine Hilfe-Einheit keinen Punkt');

    /* ---------- Das Körpergewicht wirkt mit seinem Datum ---------- */

    // Am 3.8. wog er 5 kg weniger. Dieselbe Hilfe heißt dann weniger Last,
    // der Wert sinkt. Mit nur einem aktuellen Wert wäre die erste Einheit
    // rückwirkend mitverändert worden und der Unterschied unsichtbar.
    p = rechne([
        einheit('2026-08-01', { klimm: s(30, 8) }),
        einheit('2026-08-03', { klimm: s(30, 8) }),
    ], hilfe, [{ date: '2026-08-01', kg: 90 }, { date: '2026-08-03', kg: 85 }]);
    ok(p[1].wert < 100,
       'ein späterer Eintrag gilt erst ab seinem Datum, die alte Einheit bleibt: ' + p[1].wert);

    /* ---------- Kommazahlen landen kurz in der Datei ---------- */

    /*
     * Mit serialize_precision=17 — so steht sie im Webserver bei All-Inkl,
     * anders als auf der Kommandozeile — schrieb json_encode aus 96,8 die
     * volle Binärentwicklung "96.79999999999999715...". Gelesen wird daraus
     * derselbe Wert, aber die Datei ist unlesbar und das Backup trägt es
     * mit. Deshalb legt json_write() die Einstellung selbst fest.
     */
    fs.writeFileSync(path.join(ordner, 'gewicht.json'), '[]');
    execFileSync('php', ['-d', 'serialize_precision=17', '-r', `
        require "${WURZEL}/lib/gewicht.php";
        gewicht_setzen("2026-08-19", gewicht_zahl("96,8"));
    `], { env: Object.assign({}, process.env, { COACH_DATA: ordner }) });

    const roh = fs.readFileSync(path.join(ordner, 'gewicht.json'), 'utf8');
    ok(roh.includes('96.8') && !roh.includes('96.79'),
       'auch bei serialize_precision=17 steht 96.8 in der Datei');

    fs.rmSync(ordner, { recursive: true, force: true });
    console.log('  ' + bestanden + ' bestanden, ' + gescheitert + ' Fehlschläge\n');
    return { bestanden, gescheitert };
};
