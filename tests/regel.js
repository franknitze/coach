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
     * titel, Einheiten (neueste zuletzt), erwarteter Status, erwartete
     * Ziel-Wiederholungen.
     *
     * target_reps befüllt seit dem 26.08.2026 den Wiederholungs-Regler im
     * Studio, deshalb gehört jeder Zweig festgenagelt: Steigt das Gewicht,
     * beginnt die Leiter unten wieder (rep_min 8); wird gehalten, ist das
     * Ziel eine Wiederholung mehr als der beste Satz, gedeckelt bei
     * rep_max 12.
     */
    const faelle = [
        ['gar keine Einheit',                    [],                                  'start',        8],
        ['einmal sauber (zu wenig)',             [s(80, 12, 12, 12)],                 'halten',      12],
        ['zweimal sauber an der Obergrenze',     [s(80, 12, 12, 12), s(80, 12, 12, 12)], 'steigern',  8],
        ['zweimal, aber einmal nur 11 Wdh',      [s(80, 12, 12, 11), s(80, 12, 12, 12)], 'halten',   12],
        ['zweimal, ein Satz leichter',           [s(80, 12, 12, 12),
                                                  [{ weight: 75, reps: 12 }, { weight: 80, reps: 12 }]], 'halten', 12],
        ['alle Sätze unter rep_min',             [s(85, 7, 6, 5)],                    'zurueckholen', 8],
        ['nur letzter Satz schwach (Ermüdung)',  [s(85, 10, 9, 7)],                   'halten',      11],
        ['mitten im Bereich',                    [s(80, 10, 9, 9)],                   'halten',      11],
        ['dreimal sauber (mehr als nötig)',      [s(80, 12, 12, 12), s(80, 12, 12, 12), s(80, 13, 12, 12)], 'steigern', 8],

        // Abgebrochene Einheiten. Zwei Sätze auf der Obergrenze sind kein
        // Beleg dafür, dass vier gehen; wer früher aufhört, hat es nicht
        // gezeigt. Sonst schiebt ein Abbruch das Gewicht hoch.
        ['zweimal sauber, aber nur 2 von 3 Sätzen', [s(80, 12, 12), s(80, 12, 12)],  'halten',      12],
        ['einmal voll, einmal abgebrochen',       [s(80, 12, 12), s(80, 12, 12, 12)], 'halten',     12],
        ['zweimal mit einem Satz zu viel',        [s(80, 12, 12, 12, 12), s(80, 12, 12, 12, 12)], 'steigern', 8],
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
        ['zweimal sauber bei 30 kg Hilfe', [s(30, 12, 12, 12), s(30, 12, 12, 12)],
                                                                 'steigern',     '27,5 kg Hilfe, 2,5 weniger'],
        ['sauber bei genau einem Schritt', [s(2.5, 12, 12, 12), s(2.5, 12, 12, 12)],
                                                                 'steigern',     'Heute ohne Hilfe'],
        ['zweimal sauber ohne Hilfe',      [s(0, 12, 12, 12), s(0, 12, 12, 12)],
                                                                 'steigern',     'Zusatzgewicht ist dran'],
        ['einmal sauber ohne Hilfe',       [s(0, 12, 12, 12)],   'halten',       'dann kommt Zusatzgewicht'],
        ['ohne Hilfe eingebrochen',        [s(0, 7, 6, 5)],      'zurueckholen', 'Mehr Hilfe'],
        ['ohne Hilfe mitten im Bereich',   [s(0, 10, 9, 9)],     'halten',       'Ohne Hilfe, Ziel 11'],
        ['ohne Hilfe, nur der beste oben', [s(0, 12, 12, 9)],    'halten',       'Ohne Hilfe, alle Sätze auf 12'],
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
