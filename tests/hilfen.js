/*
 * Gemeinsame Basis der Testläufe.
 *
 * Jeder Lauf startet einen eigenen PHP-Server auf einem eigenen Port mit
 * einem eigenen Datenverzeichnis unter dem Temp-Ordner. Die echten Daten in
 * data/ werden nie angefasst: die Tests schreiben und löschen Logdateien,
 * und ein Fehlgriff würde die Trainingshistorie kosten.
 *
 * Kein Test-Framework, wie in SPEC.md §2 vorgesehen. Playwright wird nur
 * zum Fernsteuern des Browsers gebraucht und läuft gegen das installierte
 * Chrome, damit kein Browser nachgeladen werden muss.
 */

const { execFileSync, spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const WURZEL = path.resolve(__dirname, '..');
const PASSWORT = 'test-nur-fuer-den-testlauf';

/**
 * Playwright liegt je nach Rechner im npx-Cache oder in node_modules, und
 * dort oft in mehreren Versionen nebeneinander.
 *
 * Neueste zuerst, und das ist keine Kosmetik: Jede Playwright-Version
 * erwartet eine bestimmte Browser-Fassung im Cache. Wer einfach die erste
 * nimmt, die er findet, erwischt womöglich eine, für die nie ein Browser
 * heruntergeladen wurde — und bekommt "Executable doesn't exist" für einen
 * Browser, der sehr wohl da ist.
 */
function playwrightModule() {
    const pfade = [];
    try {
        pfade.push(path.dirname(require.resolve('playwright/package.json')));
    } catch (e) { /* nicht lokal installiert, weitersuchen */ }

    const cache = path.join(os.homedir(), '.npm', '_npx');
    if (fs.existsSync(cache)) {
        for (const ordner of fs.readdirSync(cache)) {
            const p = path.join(cache, ordner, 'node_modules', 'playwright');
            if (fs.existsSync(p)) {
                pfade.push(p);
            }
        }
    }

    const gefunden = [];
    for (const p of pfade) {
        try {
            gefunden.push({
                pfad: p,
                version: require(path.join(p, 'package.json')).version,
                pw: require(p),
            });
        } catch (e) { /* nächster Kandidat */ }
    }

    if (gefunden.length === 0) {
        throw new Error(
            'Playwright nicht gefunden. Einmal "npx playwright@1.62 --version" ausführen, '
            + 'das legt es im npx-Cache ab.'
        );
    }

    gefunden.sort(function (a, b) {
        return b.version.localeCompare(a.version, undefined, { numeric: true });
    });
    return gefunden;
}

/**
 * Startet den Browser für den Testlauf.
 *
 * Voreinstellung ist das installierte Chrome, damit kein Browser
 * nachgeladen werden muss. COACH_BROWSER=webkit läuft stattdessen gegen
 * WebKit — dieselbe Engine wie Safari, und damit die einzige Möglichkeit
 * auf diesem Rechner, Darstellungsunterschiede zu sehen, die die App auf
 * dem iPhone betreffen. Chrome und WebKit gehen bei Formularelementen am
 * weitesten auseinander, und genau dort ist mehrfach etwas durchgerutscht.
 */
async function browserStarten() {
    const module = playwrightModule();

    if ((process.env.COACH_BROWSER || 'chrome') !== 'webkit') {
        return module[0].pw.chromium.launch({ channel: 'chrome' });
    }

    let letzter = null;
    for (const k of module) {
        try {
            return await k.pw.webkit.launch();
        } catch (e) {
            letzter = e;
        }
    }

    throw new Error('WebKit lässt sich nicht starten. Einmal "npx playwright@'
        + module[0].version + ' install webkit" ausführen. Zuletzt: '
        + String(letzter && letzter.message).split('\n')[0]);
}

/** Legt data/ für den Testlauf an: Passwort, leerer Plan, drei Übungen. */
function datenAnlegen(ordner) {
    fs.mkdirSync(path.join(ordner, 'training'), { recursive: true });

    const hash = execFileSync('php', [
        '-r', 'echo password_hash($argv[1], PASSWORD_DEFAULT);', PASSWORT,
    ]).toString();

    schreibe(ordner, 'config.json', {
        password_hash: hash,
        api_key: 'testschluessel',
        default_weight_step: 5,
        rest_timer_seconds: 120,
        session_lifetime_days: 30,
    });

    schreibe(ordner, 'plan.json', {
        days: {
            oberkoerper:  { label: 'Oberkörper' },
            unterkoerper: { label: 'Unterkörper' },
        },
        rotation: ['oberkoerper', 'unterkoerper', 'oberkoerper'],
        muscle_priorities: {
            brust: 'normal', ruecken: 'normal', beine: 'normal',
            schulter: 'normal', bizeps: 'normal', trizeps: 'normal',
        },
    });

    schreibe(ordner, 'exercises.json', {
        bankdruecken: {
            id: 'bankdruecken', name: 'Bankdrücken', muscle_group: 'brust',
            day: 'oberkoerper', order: 1, target_sets: 4, rep_min: 6, rep_max: 10,
            weight_step: 2.5, photo: '', station: '43',
            execution: 'Ellenbogen rund 45 Grad, Stange zur unteren Brust.',
            search: 'barbell bench press',
        },
        latzug: {
            id: 'latzug', name: 'Latzug', muscle_group: 'ruecken',
            day: 'oberkoerper', order: 2, target_sets: 4, rep_min: 8, rep_max: 12,
            weight_step: 5, photo: 'a2-latzug-weit-brust.jpg', station: '07',
        },
        schulterdruecken: {
            id: 'schulterdruecken', name: 'Schulterdrücken', muscle_group: 'schulter',
            day: 'oberkoerper', order: 3, target_sets: 3, rep_min: 8, rep_max: 12,
            weight_step: 2.5, photo: '', station: '',
        },
        beinpresse: {
            id: 'beinpresse', name: 'Beinpresse', muscle_group: 'beine',
            day: 'unterkoerper', order: 1, target_sets: 4, rep_min: 8, rep_max: 12,
            weight_step: 5, photo: '', station: '12',
        },
    });
}

function schreibe(ordner, datei, inhalt) {
    fs.writeFileSync(path.join(ordner, datei), JSON.stringify(inhalt, null, 2));
}

/**
 * Startet Server und Browser, führt $lauf aus und räumt danach auf.
 *
 * $lauf bekommt ein Objekt mit page, ok() für eine Prüfung, training() zum
 * Setzen des Ausgangszustands und anmelden().
 */
async function testlauf(name, port, lauf) {
    console.log('### ' + name + ' ###');

    // Antwortet auf dem Port schon jemand, wäre das ein übriggebliebener
    // Server aus einem abgebrochenen Lauf. Der hätte ein anderes
    // Datenverzeichnis, und der Testlauf liefe stillschweigend gegen die
    // falschen Daten. Genau das ist einmal passiert.
    if (!(await portFrei(port))) {
        console.log('  FEHL Auf Port ' + port + ' antwortet bereits etwas. '
            + 'Vermutlich ein Server aus einem abgebrochenen Lauf: '
            + 'pkill -f "php -S 127.0.0.1:' + port + '"');
        console.log('  0 bestanden, 1 Fehlschläge\n');
        return { bestanden: 0, gescheitert: 1 };
    }

    const ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'coach-test-'));
    datenAnlegen(ordner);

    /*
     * Die Gerätefotos sind der eine Ort, den COACH_DATA nicht umleitet:
     * api/foto-upload.php schreibt auf einen festen Pfad neben dem Code,
     * weil der Browser die Bilder von dort per URL lädt. Ein Testlauf legt
     * also echte Dateien im Projekt ab. Der Bilder-Lauf räumt sie selbst
     * wieder weg — aber nur, wenn er bis zum Ende kommt. Bricht er vorher
     * ab, bleibt eine 500-KB-Datei liegen, und beim nächsten Deploy steht
     * sie zum Hochladen an.
     *
     * Deshalb hier ein Netz, das nicht davon abhängt, dass ein Lauf sauber
     * endet: was während des Laufs dazukam und wie eine hochgeladene Datei
     * heißt, fliegt hinterher raus.
     */
    const fotoOrdner = path.join(WURZEL, 'assets', 'img', 'exercises');
    const fotosVorher = fs.existsSync(fotoOrdner) ? fs.readdirSync(fotoOrdner) : [];

    // Dieselben Upload-Grenzen wie auf dem Server, sonst scheitert der
    // Bilder-Test an der 2-MB-Vorgabe des eingebauten PHP-Servers.
    const server = spawn('php', [
        '-d', 'upload_max_filesize=512M', '-d', 'post_max_size=512M',
        '-S', '127.0.0.1:' + port, '-t', WURZEL,
    ], {
        cwd: WURZEL,
        env: Object.assign({}, process.env, {
            COACH_DATA: ordner,
            // Sonst schreibt der Lauf Sitzungsdateien in den Projektordner.
            COACH_SESSIONS: path.join(ordner, 'sessions'),
        }),
        stdio: 'ignore',
    });

    // Auch bei Strg-C oder einem Absturz den Server mitnehmen.
    const aufraeumen = () => { try { server.kill('SIGKILL'); } catch (e) {} };
    process.on('exit', aufraeumen);
    process.on('SIGINT', () => { aufraeumen(); process.exit(130); });

    const browser = await browserStarten();
    const page = await browser.newPage({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
    });

    const fehlerAusDemBrowser = [];
    // Muster, die ein Lauf ausdrücklich erwartet, etwa beim Offline-Test.
    const erlaubteKonsole = [
        // "Failed to load resource" mit 4xx ist Browser-Rauschen aus einem
        // fehlgeschlagenen fetch, und die Tests prüfen diese Antworten
        // ohnehin einzeln. 5xx bleibt ein Befund, das wäre ein Serverfehler.
        /Failed to load resource.*status of 4\d\d/,
    ];

    page.on('console', (m) => {
        if (m.type() !== 'error') {
            return;
        }
        if (erlaubteKonsole.some((muster) => muster.test(m.text()))) {
            return;
        }
        fehlerAusDemBrowser.push(m.text());
    });
    page.on('pageerror', (e) => fehlerAusDemBrowser.push('pageerror: ' + e.message));

    let bestanden = 0;
    let gescheitert = 0;

    const hilfen = {
        page,
        basis: 'http://127.0.0.1:' + port,
        datenordner: ordner,

        ok(bedingung, text) {
            if (bedingung) {
                bestanden++;
                console.log('  ok   ' + text);
            } else {
                gescheitert++;
                console.log('  FEHL ' + text);
            }
        },

        /**
         * Erlaubt eine Sorte Konsolenfehler, die dieser Lauf absichtlich
         * auslöst. Ohne das würde der Offline-Test an seinen eigenen
         * Netzwerkfehlern scheitern.
         */
        konsoleErlauben(muster) {
            erlaubteKonsole.push(muster);
        },

        /** Setzt die Logdateien auf einen festen Ausgangszustand. */
        training(proMonat) {
            const ziel = path.join(ordner, 'training');
            for (const f of fs.readdirSync(ziel)) {
                fs.unlinkSync(path.join(ziel, f));
            }
            for (const [monat, sessions] of Object.entries(proMonat)) {
                fs.writeFileSync(
                    path.join(ziel, monat + '.json'),
                    JSON.stringify(sessions, null, 2)
                );
            }
        },

        async anmelden() {
            await page.goto('http://127.0.0.1:' + port + '/');
            await page.fill('#passwort', PASSWORT);
            await page.click('#anmelden');
            await page.waitForSelector('#app .heute__tag, #app .leer__titel');
        },

        /** Öffnet das Menü oben rechts und wählt einen Eintrag (kalender, plan). */
        async menue(ziel) {
            await page.click('#menue-knopf');
            await page.click('#menue [data-menue="' + ziel + '"]');
        },

        /** Wechselt in den Studio-Modus eines bestimmten Trainingstags. */
        async studio(tagLabel) {
            await page.locator('.tagknopf', { hasText: tagLabel }).click();
            await page.waitForFunction(
                (t) => document.querySelector('.heute__tag').innerText === t, tagLabel
            );
            await page.click('[data-gehe="studio"]');
            await page.waitForSelector('.kachel');
        },
    };

    try {
        await warteAufServer(hilfen.basis);
        await lauf(hilfen);
    } catch (e) {
        gescheitert++;
        console.log('  FEHL Abbruch: ' + e.message.split('\n')[0]);
    } finally {
        await browser.close();
        server.kill();
        process.off('exit', aufraeumen);
        fs.rmSync(ordner, { recursive: true, force: true });

        const uebrig = (fs.existsSync(fotoOrdner) ? fs.readdirSync(fotoOrdner) : [])
            .filter((f) => !fotosVorher.includes(f) && /^foto-\d{8}-\d{6}-/.test(f));

        for (const f of uebrig) {
            fs.unlinkSync(path.join(fotoOrdner, f));
            console.log('  ---  liegengebliebenes Testfoto entfernt: ' + f);
        }
    }

    if (fehlerAusDemBrowser.length) {
        gescheitert++;
        console.log('  FEHL Konsolenfehler: ' + fehlerAusDemBrowser.join(' | '));
    }

    console.log('  ' + bestanden + ' bestanden, ' + gescheitert + ' Fehlschläge\n');
    return { bestanden, gescheitert };
}

async function portFrei(port) {
    try {
        await fetch('http://127.0.0.1:' + port + '/', {
            signal: AbortSignal.timeout(400),
        });
        return false;   // es antwortet jemand
    } catch (e) {
        return true;
    }
}

async function warteAufServer(basis) {
    for (let versuch = 0; versuch < 50; versuch++) {
        try {
            await fetch(basis + '/index.php');
            return;
        } catch (e) {
            await new Promise((r) => setTimeout(r, 100));
        }
    }
    throw new Error('PHP-Server ist nicht hochgekommen: ' + basis);
}

/** Baut die Sätze einer Übung: saetze(80, 10, 9, 8) */
function saetze(gewicht, ...wiederholungen) {
    return wiederholungen.map((reps) => ({ weight: gewicht, reps: reps }));
}

/** Baut eine Session für die Logdateien. */
function einheit(datum, tag, rotationIndex, uebungen) {
    return {
        date: datum + 'T07:05:00+02:00',
        day: tag,
        rotation_index: rotationIndex,
        exercises: Object.entries(uebungen).map(([id, sets]) => ({
            exercise_id: id, sets: sets,
        })),
    };
}

module.exports = { testlauf, saetze, einheit, PASSWORT };
