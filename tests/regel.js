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
    fs.mkdirSync(path.join(ordner, 'logs'));
    fs.writeFileSync(path.join(ordner, 'config.json'), JSON.stringify({
        password_hash: '', api_key: '', default_weight_step: 5,
        rest_timer_seconds: 120, session_lifetime_days: 30,
    }));

    const s = (g, ...w) => w.map((r) => ({ weight: g, reps: r }));

    // titel, Einheiten (neueste zuletzt), erwarteter Status
    const faelle = [
        ['gar keine Einheit',                    [],                                  'start'],
        ['einmal sauber (zu wenig)',             [s(80, 12, 12, 12)],                 'halten'],
        ['zweimal sauber an der Obergrenze',     [s(80, 12, 12, 12), s(80, 12, 12, 12)], 'steigern'],
        ['zweimal, aber einmal nur 11 Wdh',      [s(80, 12, 12, 11), s(80, 12, 12, 12)], 'halten'],
        ['zweimal, ein Satz leichter',           [s(80, 12, 12, 12),
                                                  [{ weight: 75, reps: 12 }, { weight: 80, reps: 12 }]], 'halten'],
        ['alle Sätze unter rep_min',             [s(85, 7, 6, 5)],                    'zurueckholen'],
        ['nur letzter Satz schwach (Ermüdung)',  [s(85, 10, 9, 7)],                   'halten'],
        ['mitten im Bereich',                    [s(80, 10, 9, 9)],                   'halten'],
        ['dreimal sauber (mehr als nötig)',      [s(80, 12, 12, 12), s(80, 12, 12, 12), s(80, 13, 12, 12)], 'steigern'],
    ];

    let bestanden = 0;
    let gescheitert = 0;

    for (const [titel, einheiten, erwartet] of faelle) {
        const sessions = einheiten.map((sets, i) => ({
            date: '2026-08-' + String(1 + i * 2).padStart(2, '0') + 'T07:00:00+02:00',
            day: 'oberkoerper', rotation_index: 0,
            exercises: [{ exercise_id: 'test', sets: sets }],
        }));
        fs.writeFileSync(path.join(ordner, 'logs', '2026-08.json'), JSON.stringify(sessions));

        const ausgabe = execFileSync('php', ['-r', `
            require "${WURZEL}/lib/coach.php";
            $e = coach_empfehlung(['id' => 'test', 'rep_min' => 8, 'rep_max' => 12, 'weight_step' => 2.5]);
            echo $e['status'], "\\t", $e['text'];
        `], { env: Object.assign({}, process.env, { COACH_DATA: ordner }) }).toString();

        const [status, text] = ausgabe.split('\t');

        if (status === erwartet) {
            bestanden++;
            console.log('  ok   ' + titel.padEnd(36) + status.padEnd(13) + text);
        } else {
            gescheitert++;
            console.log('  FEHL ' + titel.padEnd(36) + 'erwartet ' + erwartet + ', bekam ' + status);
        }
    }

    // Die Texte dürfen nie über rep_max hinaus zielen
    fs.writeFileSync(path.join(ordner, 'logs', '2026-08.json'), JSON.stringify([{
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

    fs.rmSync(ordner, { recursive: true, force: true });
    console.log('  ' + bestanden + ' bestanden, ' + gescheitert + ' Fehlschläge\n');
    return { bestanden, gescheitert };
};
