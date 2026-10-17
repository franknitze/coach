/* Phase 4: die Progressionsregel selbst, ohne Browser. */

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const WURZEL = path.resolve(__dirname, '..');

/**
 * Prüft coach_empfehlung() direkt in PHP. Kein Browser nötig, und die
 * Zweige aus SPEC.md §7 lassen sich einzeln durchspielen.
 */
module.exports = function regel() {
    console.log('### Progressionsregel ###');

    const ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'coach-regel-'));
    fs.mkdirSync(path.join(ordner, 'training'));
    fs.writeFileSync(path.join(ordner, 'config.json'), JSON.stringify({
        password_hash: '', api_key: '', default_weight_step: 5,
        rest_timer_seconds: 120, session_lifetime_days: 30,
    }));

    const s = (g, ...w) => w.map((r) => ({ weight: g, reps: r }));

    /*
     * titel, Einheiten (älteste zuerst), erwarteter Status, erwartete
     * Ziel-Wiederholungen. Übung: 3 Sätze, 8 bis 12 Wiederholungen.
     *
     * Die Regel (Frank, 17.10.2026): Eine Wiederholung mehr gibt es nur,
     * wenn ALLE Sätze das Ziel geschafft haben, sonst wird das Ziel
     * wiederholt. Schaffen alle Sätze die Obergrenze, steigt das Gewicht
     * sofort, beim ersten Mal, und es geht wieder bei rep_min los.
     */
    const faelle = [
        ['gar keine Einheit',                    [],                                  'start',        8],
        ['einmal alle an der Obergrenze',        [s(80, 12, 12, 12)],                 'steigern',     8],
        ['alle geschafft, mitten im Bereich',    [s(80, 9, 9, 9)],                    'halten',      10],
        ['ein Satz verfehlt das Ziel',           [s(80, 9, 9, 9), s(80, 10, 10, 8)],  'halten',      10],
        ['nur letzter Satz schwach',             [s(80, 9, 9, 9), s(80, 12, 12, 9)],  'halten',      10],
        ['zweimal, aber einmal nur 11 Wdh',      [s(80, 11, 11, 11), s(80, 12, 12, 11)], 'halten',   12],
        ['ein Satz leichter',                    [[{ weight: 75, reps: 12 }, { weight: 80, reps: 12 },
                                                   { weight: 80, reps: 12 }]],        'halten',       8],
        ['alle Sätze unter rep_min',             [s(85, 7, 6, 5)],                    'zurueckholen', 8],

        // Abgebrochen: Zwei Sätze auf der Obergrenze sind kein Beleg dafür,
        // dass drei gehen. Sonst schiebt ein Abbruch das Gewicht hoch.
        ['nur 2 von 3 Sätzen',                   [s(80, 12, 12)],                     'halten',       8],
        ['mit einem Satz zu viel',               [s(80, 12, 12, 12, 12)],             'steigern',     8],
    ];

    let bestanden = 0;
    let gescheitert = 0;

    for (const [titel, einheiten, erwartet, zielWdh] of faelle) {
        const sessions = einheiten.map((sets, i) => ({
            date: '2026-08-' + String(1 + i * 2).padStart(2, '0') + 'T07:00:00+02:00',
            day: 'oberkoerper', rotation_index: 0,
            exercises: [{ exercise_id: 'test', sets: sets }],
        }));
        fs.writeFileSync(path.join(ordner, 'training', '2026-08.json'), JSON.stringify(sessions));

        const ausgabe = execFileSync('php', ['-r', `
            require "${WURZEL}/lib/coach.php";
            $e = coach_empfehlung(['id' => 'test', 'rep_min' => 8, 'rep_max' => 12,
                                   'weight_step' => 2.5, 'target_sets' => 3]);
            echo $e['status'], "\\t", $e['text'], "\\t", $e['target_reps'];
        `], { env: Object.assign({}, process.env, { COACH_DATA: ordner }) }).toString();

        const [status, text, reps] = ausgabe.split('\t');

        if (status === erwartet && Number(reps) === zielWdh) {
            bestanden++;
            console.log('  ok   ' + titel.padEnd(36) + status.padEnd(13)
                + ('→ ' + reps + ' Wdh').padEnd(10) + text);
        } else {
            gescheitert++;
            console.log('  FEHL ' + titel.padEnd(36) + 'erwartet ' + erwartet + ' / '
                + zielWdh + ' Wdh, bekam ' + status + ' / ' + reps + ' Wdh');
        }
    }

    /* ---------- Die Beispieltabelle der Startseite, Zeile für Zeile ----------
     * 3 Sätze, 6 bis 10 Wiederholungen, Stufe 5 kg, Start 50 kg. Nach jeder
     * Zeile muss die App genau das Ziel der nächsten Zeile vorschlagen.
     */
    const tabelle = [
        [s(50, 6, 6, 6),    50, 7],
        [s(50, 7, 7, 7),    50, 8],
        [s(50, 8, 8, 6),    50, 8],
        [s(50, 8, 8, 8),    50, 9],
        [s(50, 9, 9, 9),    50, 10],
        [s(50, 10, 10, 10), 55, 6],
        [s(55, 6, 6, 6),    55, 7],
    ];

    for (let n = 1; n <= tabelle.length; n++) {
        const sessions = tabelle.slice(0, n).map(([sets], i) => ({
            date: '2026-08-' + String(1 + i * 2).padStart(2, '0') + 'T07:00:00+02:00',
            day: 'oberkoerper', rotation_index: 0,
            exercises: [{ exercise_id: 'test', sets: sets }],
        }));
        fs.writeFileSync(path.join(ordner, 'training', '2026-08.json'), JSON.stringify(sessions));

        const ausgabe = execFileSync('php', ['-r', `
            require "${WURZEL}/lib/coach.php";
            $e = coach_empfehlung(['id' => 'test', 'rep_min' => 6, 'rep_max' => 10,
                                   'weight_step' => 5, 'target_sets' => 3]);
            echo $e['target_weight'], "\t", $e['target_reps'];
        `], { env: Object.assign({}, process.env, { COACH_DATA: ordner }) }).toString();

        const [gewicht, wdh] = ausgabe.split('\t').map(Number);
        const [, sollGewicht, sollWdh] = tabelle[n - 1];
        const satz = tabelle[n - 1][0].map((x) => x.reps).join(', ');

        if (gewicht === sollGewicht && wdh === sollWdh) {
            bestanden++;
            console.log('  ok   Tabelle Zeile ' + n + ': nach ' + satz + ' kommt ' + sollGewicht + ' kg × ' + sollWdh);
        } else {
            gescheitert++;
            console.log('  FEHL Tabelle Zeile ' + n + ': nach ' + satz + ' erwartet ' + sollGewicht + ' kg × '
                + sollWdh + ', bekam ' + gewicht + ' kg × ' + wdh);
        }
    }

    // Die Texte dürfen nie über rep_max hinaus zielen
    fs.writeFileSync(path.join(ordner, 'training', '2026-08.json'), JSON.stringify([{
        date: '2026-08-01T07:00:00+02:00', day: 'oberkoerper', rotation_index: 0,
        exercises: [{ exercise_id: 'test', sets: s(80, 12, 12, 12) }],
    }]));
    const text = execFileSync('php', ['-r', `
        require "${WURZEL}/lib/coach.php";
        echo coach_empfehlung(['id' => 'test', 'rep_min' => 8, 'rep_max' => 12, 'weight_step' => 2.5])['text'];
    `], { env: Object.assign({}, process.env, { COACH_DATA: ordner }) }).toString();

    if (/\b13\b/.test(text)) {
        gescheitert++;
        console.log('  FEHL Ansage zielt über rep_max hinaus: ' + text);
    } else {
        bestanden++;
        console.log('  ok   Ansage zielt nie über rep_max hinaus');
    }

    /* ---------- Unterstützungsmaschine: die Leiter bis ans Ende ---------- */

    // Dort läuft alles andersherum, und sie hat ein Ende: bei 0 kg Hilfe
    // hängt man am eigenen Gewicht, wegnehmen lässt sich nichts mehr.
    // Ohne den letzten Fall stünde dort für immer "Heute ohne Hilfe".
    const hilfeFaelle = [
        ['keine Einheit',                 [],                    'start',        'Hilfe antasten'],
        ['alle oben bei 30 kg Hilfe',     [s(30, 12, 12, 12)],   'steigern',     '27,5 kg Hilfe, 2,5 weniger'],
        ['oben bei genau einem Schritt',  [s(2.5, 12, 12, 12)],  'steigern',     'Heute ohne Hilfe'],
        ['alle oben ohne Hilfe',          [s(0, 12, 12, 12)],    'steigern',     'Zusatzgewicht ist dran'],
        ['ohne Hilfe eingebrochen',       [s(0, 7, 6, 5)],       'zurueckholen', 'Mehr Hilfe'],
        ['ohne Hilfe mitten im Bereich',  [s(0, 9, 9, 9)],       'halten',       'Ohne Hilfe, Ziel 10'],
        ['ohne Hilfe, ein Satz verfehlt', [s(0, 10, 10, 10), s(0, 11, 11, 9)],
                                                                 'halten',       'Ohne Hilfe, Ziel 11'],
    ];

    for (const [titel, einheiten, erwartet, teil] of hilfeFaelle) {
        const sessions = einheiten.map((sets, i) => ({
            date: '2026-08-' + String(1 + i * 2).padStart(2, '0') + 'T07:00:00+02:00',
            day: 'oberkoerper', rotation_index: 0,
            exercises: [{ exercise_id: 'test', sets: sets }],
        }));
        fs.writeFileSync(path.join(ordner, 'training', '2026-08.json'), JSON.stringify(sessions));

        const ausgabe = execFileSync('php', ['-r', `
            require "${WURZEL}/lib/coach.php";
            $e = coach_empfehlung(['id' => 'test', 'rep_min' => 8, 'rep_max' => 12,
                                   'weight_step' => 2.5, 'assisted' => true]);
            echo $e['status'], "\\t", $e['text'];
        `], { env: Object.assign({}, process.env, { COACH_DATA: ordner }) }).toString();

        const [status, txt] = ausgabe.split('\t');

        if (status === erwartet && txt.includes(teil)) {
            bestanden++;
            console.log('  ok   Hilfe: ' + titel.padEnd(30) + status.padEnd(13) + txt);
        } else {
            gescheitert++;
            console.log('  FEHL Hilfe: ' + titel.padEnd(30) + 'erwartet ' + erwartet
                + ' mit "' + teil + '", bekam ' + status + ' mit "' + txt + '"');
        }
    }

    // Keine Ansage darf an der Maschine "0 kg" sagen: dort steht keine Last
    // auf der Stange, sondern das eigene Gewicht.
    fs.writeFileSync(path.join(ordner, 'training', '2026-08.json'), JSON.stringify([{
        date: '2026-08-01T07:00:00+02:00', day: 'oberkoerper', rotation_index: 0,
        exercises: [{ exercise_id: 'test', sets: s(0, 10, 9, 9) }],
    }]));
    const nullText = execFileSync('php', ['-r', `
        require "${WURZEL}/lib/coach.php";
        echo coach_empfehlung(['id' => 'test', 'rep_min' => 8, 'rep_max' => 12,
                               'weight_step' => 2.5, 'assisted' => true])['text'];
    `], { env: Object.assign({}, process.env, { COACH_DATA: ordner }) }).toString();

    if (/0 kg/.test(nullText)) {
        gescheitert++;
        console.log('  FEHL "0 kg" in der Ansage: ' + nullText);
    } else {
        bestanden++;
        console.log('  ok   ohne Hilfe steht nie "0 kg" in der Ansage');
    }

    fs.rmSync(ordner, { recursive: true, force: true });
    console.log('  ' + bestanden + ' bestanden, ' + gescheitert + ' Fehlschläge\n');
    return { bestanden, gescheitert };
};
