/*
 * Alle Testläufe hintereinander.
 *
 *   node tests/lauf.js            alles
 *   node tests/lauf.js studio     nur einen Lauf
 *
 * Jeder Lauf bekommt seinen eigenen Port und sein eigenes Datenverzeichnis
 * im Temp-Ordner. Das echte data/ wird nicht angefasst, und die Läufe sind
 * unabhängig von ihrer Reihenfolge.
 */

const laeufe = {
    fotos:      { port: null, modul: './fotos' },
    regel:      { port: null, modul: './regel' },
    verwaltung: { port: 8791, modul: './verwaltung' },
    studio:     { port: 8792, modul: './studio' },
    verlauf:    { port: 8793, modul: './verlauf' },
    coach:      { port: 8794, modul: './coach' },
    einrichtung:{ port: 8790, modul: './einrichtung' },
    bilder:     { port: 8789, modul: './bilder' },
    pwa:        { port: 8795, modul: './pwa' },
    offline:    { port: 8796, modul: './offline' },
};

(async function () {
    const gewuenscht = process.argv.slice(2);
    const namen = gewuenscht.length ? gewuenscht : Object.keys(laeufe);

    let bestanden = 0;
    let gescheitert = 0;

    for (const name of namen) {
        const lauf = laeufe[name];
        if (!lauf) {
            console.log('Unbekannt: ' + name + '. Bekannt sind: '
                + Object.keys(laeufe).join(', '));
            process.exit(2);
        }

        const fn = require(lauf.modul);
        const ergebnis = lauf.port === null ? fn() : await fn(lauf.port);
        bestanden += ergebnis.bestanden;
        gescheitert += ergebnis.gescheitert;
    }

    console.log('══ ' + bestanden + ' bestanden, ' + gescheitert + ' Fehlschläge ══');
    process.exit(gescheitert === 0 ? 0 : 1);
})();
