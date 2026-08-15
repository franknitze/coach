/*
 * Die Gerätefotos, ohne Browser geprüft.
 *
 * Anlass: zwei Fotos wurden ausgetauscht, ohne durch die Aufbereitung zu
 * laufen. Sie landeten als iPhone-Originale mit 3,1 MB und GPS-Koordinaten
 * auf dem öffentlichen Server. Die Bilder liegen dort ohne Anmeldung, der
 * Standort des Studios war damit im Netz.
 *
 * Gegen genau das läuft dieser Test. Er ist absichtlich der schnellste im
 * Bündel, damit er vor jedem Deployment mitlaufen kann.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ORDNER = path.resolve(__dirname, '../assets/img/exercises');
const MAX_KB = 400;         // aufbereitet liegen sie bei 110 bis 170 KB
const MAX_KANTE = 1200;     // sips verkleinert auf 900

module.exports = function fotos() {
    console.log('### Gerätefotos ###');

    let bestanden = 0;
    let gescheitert = 0;
    const ok = (b, t) => {
        if (b) { bestanden++; console.log('  ok   ' + t); }
        else { gescheitert++; console.log('  FEHL ' + t); }
    };

    if (!fs.existsSync(ORDNER)) {
        ok(false, 'Ordner assets/img/exercises fehlt');
        console.log('  ' + bestanden + ' bestanden, ' + gescheitert + ' Fehlschläge\n');
        return { bestanden, gescheitert };
    }

    const dateien = fs.readdirSync(ORDNER).filter((f) => f.endsWith('.jpg'));
    ok(dateien.length > 0, dateien.length + ' Fotos gefunden');

    const zuGross = [];
    const mitGps = [];
    const zuBreit = [];

    for (const datei of dateien) {
        const pfad = path.join(ORDNER, datei);
        const kb = Math.round(fs.statSync(pfad).size / 1024);
        if (kb > MAX_KB) {
            zuGross.push(datei + ' (' + kb + ' KB)');
        }

        // file(1) nennt sowohl die Abmessung als auch vorhandenes EXIF.
        const beschreibung = execFileSync('file', [pfad]).toString();

        if (/GPS-Data/.test(beschreibung)) {
            mitGps.push(datei);
        }

        // Nicht aus der file(1)-Ausgabe lesen: dort steht zuerst die
        // Auflösung in dpi. getimagesize nennt die echte Abmessung.
        const masse = execFileSync('php', ['-r',
            'list($w,$h) = getimagesize($argv[1]); echo $w . "x" . $h;',
            pfad]).toString();
        const kante = Math.max.apply(null, masse.split('x').map(Number));
        if (kante > MAX_KANTE) {
            zuBreit.push(datei + ' (' + masse + ')');
        }
    }

    ok(mitGps.length === 0,
       mitGps.length === 0
           ? 'kein Foto trägt GPS-Koordinaten'
           : 'GPS im EXIF: ' + mitGps.join(', ') + '  → bin/exif-entfernen.py');

    ok(zuGross.length === 0,
       zuGross.length === 0
           ? 'kein Foto über ' + MAX_KB + ' KB'
           : 'zu groß: ' + zuGross.join(', ') + '  → sips -Z 900');

    ok(zuBreit.length === 0,
       zuBreit.length === 0
           ? 'kein Foto breiter als ' + MAX_KANTE + ' Pixel'
           : 'zu hoch aufgelöst: ' + zuBreit.join(', ') + '  → sips -Z 900');

    // Jedes im Plan genannte Foto muss auch existieren.
    const planQuelle = fs.readFileSync(
        path.resolve(__dirname, '../bin/plan-anlegen.php'), 'utf8');
    const genannt = [...planQuelle.matchAll(/'([A-Za-z0-9_]+\.jpg)'/g)].map((m) => m[1]);
    const fehlend = [...new Set(genannt)].filter((f) => !dateien.includes(f));

    ok(fehlend.length === 0,
       fehlend.length === 0
           ? 'alle im Plan genannten Fotos sind vorhanden'
           : 'im Plan genannt, aber nicht da: ' + fehlend.join(', '));

    console.log('  ' + bestanden + ' bestanden, ' + gescheitert + ' Fehlschläge\n');
    return { bestanden, gescheitert };
};
