/*
 * Der Update-Prozess darf niemals Daten des Nutzers zerstören.
 *
 * Anlass: ein Deployment hat alle selbst hochgeladenen Fotos gelöscht und
 * ein "plan-anlegen.php --force" danach alle Fotozuordnungen. Beides war
 * kein Unfall im Betrieb, sondern der vorgesehene Ablauf. Dieser Lauf
 * hält fest, dass er es nicht mehr ist.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const WURZEL = path.resolve(__dirname, '..');

module.exports = function update() {
    console.log('### Update-Prozess ###');

    let bestanden = 0;
    let gescheitert = 0;
    const ok = (b, t) => {
        if (b) { bestanden++; console.log('  ok   ' + t); }
        else { gescheitert++; console.log('  FEHL ' + t); }
    };

    const ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'coach-update-'));
    fs.mkdirSync(path.join(ordner, 'training'));
    fs.writeFileSync(path.join(ordner, 'config.json'), JSON.stringify({
        password_hash: 'x', api_key: 'y', default_weight_step: 5,
        rest_timer_seconds: 120, session_lifetime_days: 30,
    }));

    const plan = (...args) => execFileSync('php',
        [path.join(WURZEL, 'bin/plan-anlegen.php'), ...args],
        { env: Object.assign({}, process.env, { COACH_DATA: ordner }) }).toString();

    const lies = () => JSON.parse(
        fs.readFileSync(path.join(ordner, 'exercises.json'), 'utf8'));

    plan();
    const angelegt = lies();
    ok(Object.keys(angelegt).length === 25, '25 Übungen angelegt');

    // So, wie Frank es in der App tut
    angelegt.bankdruecken.photo = 'foto-selbst-gemacht.jpg';
    angelegt.bankdruecken.station = '43';
    angelegt.bankdruecken.target_sets = 5;          // eigene Änderung
    angelegt.kniebeuge.photo = 'foto-noch-eines.jpg';
    fs.writeFileSync(path.join(ordner, 'exercises.json'),
        JSON.stringify(angelegt, null, 2));

    /* ---------- Der Standardlauf fasst nichts an ---------- */

    plan();
    let jetzt = lies();
    ok(jetzt.bankdruecken.photo === 'foto-selbst-gemacht.jpg',
       'ohne Argumente bleibt das Foto stehen');
    ok(jetzt.bankdruecken.target_sets === 5,
       'und auch eine eigene Änderung an den Sätzen');

    /* ---------- --aktualisieren frischt nur Plandaten auf ---------- */

    jetzt.bankdruecken.name = 'Von Hand verstellt';
    fs.writeFileSync(path.join(ordner, 'exercises.json'),
        JSON.stringify(jetzt, null, 2));

    plan('--aktualisieren');
    jetzt = lies();
    ok(jetzt.bankdruecken.name === 'Langhantel-Bankdrücken flach',
       'der Name kommt aus dem Plan zurück');
    ok(jetzt.bankdruecken.photo === 'foto-selbst-gemacht.jpg',
       'das Foto überlebt die Auffrischung');
    ok(jetzt.bankdruecken.station === '43',
       'die Gerätenummer auch');
    ok(jetzt.kniebeuge.photo === 'foto-noch-eines.jpg',
       'und die Zuordnung der anderen Übungen ebenso');

    /* ---------- Eigene Übungen bleiben erhalten ---------- */

    jetzt.eigene_uebung = {
        id: 'eigene_uebung', name: 'Selbst angelegt', muscle_group: 'brust',
        day: 'oberkoerper', order: 99, target_sets: 3, rep_min: 8, rep_max: 12,
        weight_step: 2.5, photo: 'meins.jpg', station: '', execution: '', video_url: '',
    };
    fs.writeFileSync(path.join(ordner, 'exercises.json'),
        JSON.stringify(jetzt, null, 2));

    plan('--aktualisieren');
    ok(lies().eigene_uebung !== undefined,
       'eine selbst angelegte Übung wird nicht weggeräumt');

    /* ---------- --force ist abgeschafft ---------- */

    let abgewiesen = false;
    try {
        plan('--force');
    } catch (e) {
        abgewiesen = true;
    }
    ok(abgewiesen, '--force wird abgewiesen, es hat einmal alles gelöscht');
    ok(lies().bankdruecken.photo === 'foto-selbst-gemacht.jpg',
       'und hat dabei nichts angefasst');

    /* ---------- --neu sichert vorher ---------- */

    plan('--neu');
    const sicherungen = fs.existsSync(path.join(ordner, 'sicherung'))
        ? fs.readdirSync(path.join(ordner, 'sicherung')) : [];
    ok(sicherungen.length > 0, '--neu legt vorher eine Sicherung an');
    ok(sicherungen.some((f) => {
        const alt = JSON.parse(
            fs.readFileSync(path.join(ordner, 'sicherung', f), 'utf8'));
        return alt.bankdruecken && alt.bankdruecken.photo === 'foto-selbst-gemacht.jpg';
    }), 'und in der Sicherung stehen die Fotos noch drin');

    /* ---------- Das Deployment fasst die Fotos nicht an ---------- */

    const deploy = fs.readFileSync(path.join(WURZEL, 'bin/deploy.sh'), 'utf8');
    ok(/--exclude 'assets\/img\/exercises\/'/.test(deploy),
       'bin/deploy.sh schließt den Fotoordner aus');
    // Kommentarzeilen ausnehmen: dort steht ausdrücklich, dass --delete
    // nicht vorkommen darf, und das soll den Test nicht auslösen.
    const fotosync = fs.readFileSync(path.join(WURZEL, 'bin/fotos-hochladen.sh'), 'utf8')
        .split('\n').filter((z) => !z.trim().startsWith('#')).join('\n');
    ok(!/--delete/.test(fotosync),
       'bin/fotos-hochladen.sh kennt kein --delete');
    ok(/--ignore-existing/.test(fotosync),
       'und überschreibt auch nichts Vorhandenes');

    fs.rmSync(ordner, { recursive: true, force: true });
    console.log('  ' + bestanden + ' bestanden, ' + gescheitert + ' Fehlschläge\n');
    return { bestanden, gescheitert };
};
