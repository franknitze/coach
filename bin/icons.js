/*
 * Erzeugt Logo, Favicon und PWA-Icons in assets/icons/ sowie favicon.ico
 * im Hauptverzeichnis.
 *
 *   node bin/icons.js
 *
 * Nur nötig, wenn sich das Zeichen ändert. Die erzeugten Dateien liegen im
 * Repo, damit auf dem Server nichts gebaut werden muss.
 *
 * Das Zeichen ist die gelbe Geräteplakette mit einem gezeichneten C
 * (Entwurf B, Frank, 17.10.2026; Entwürfe in docs/logo/entwuerfe.html).
 * Das C ist ein Pfad und keine Schrift: Ein Buchstabe aus der Systemschrift
 * sähe auf jedem Rechner anders aus.
 *
 * Die App-Icons laufen randlos gelb durch, ohne eigene Rundung. Android
 * schneidet sie selbst zu (maskable), iOS rundet ohnehin; eine
 * mitgezeichnete Rundung ergäbe doppelte Ecken. Das C liegt in der
 * mittleren Zone, die beim Zuschneiden sicher übrig bleibt.
 */

const fs = require('fs');
const path = require('path');

const WURZEL = path.resolve(__dirname, '..');
const ZIEL = path.join(WURZEL, 'assets/icons');
const GROESSEN = [32, 180, 192, 512];

const GELB = '#f2b705';
const RAUM = '#1b1e24';
const C = `<path d="M44.3 23.4 A15 15 0 1 0 44.3 40.6" fill="none" stroke="${RAUM}" stroke-width="9"/>`;

/** Plakette mit Rundung, für Kopfzeile und Browser-Tab. */
const LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">`
    + `<rect width="64" height="64" rx="14" fill="${GELB}"/>${C}</svg>\n`;

/** Randlos, für die App-Icons. */
const RANDLOS = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">`
    + `<rect width="64" height="64" fill="${GELB}"/>${C}</svg>`;

function seite(kante, svg) {
    return `<!doctype html><meta charset="utf-8"><style>
        html, body { margin: 0; width: ${kante}px; height: ${kante}px; background: transparent; }
        img { display: block; width: ${kante}px; height: ${kante}px; }
    </style><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}">`;
}

/** favicon.ico mit einem eingebetteten PNG, das lesen alle Browser. */
function ico(png, kante) {
    const kopf = Buffer.alloc(6 + 16);
    kopf.writeUInt16LE(0, 0);
    kopf.writeUInt16LE(1, 2);
    kopf.writeUInt16LE(1, 4);
    kopf.writeUInt8(kante, 6);
    kopf.writeUInt8(kante, 7);
    kopf.writeUInt8(0, 8);
    kopf.writeUInt8(0, 9);
    kopf.writeUInt16LE(1, 10);
    kopf.writeUInt16LE(32, 12);
    kopf.writeUInt32LE(png.length, 14);
    kopf.writeUInt32LE(22, 18);
    return Buffer.concat([kopf, png]);
}

function playwright() {
    const os = require('os');
    const kandidaten = [];
    try { kandidaten.push(require.resolve('playwright')); } catch (e) { /* weiter */ }
    const cache = path.join(os.homedir(), '.npm', '_npx');
    if (fs.existsSync(cache)) {
        for (const ordner of fs.readdirSync(cache)) {
            const p = path.join(cache, ordner, 'node_modules', 'playwright');
            if (fs.existsSync(p)) kandidaten.push(p);
        }
    }
    for (const p of kandidaten) {
        try { return require(p); } catch (e) { /* nächster */ }
    }
    throw new Error('Playwright nicht gefunden.');
}

(async function () {
    fs.mkdirSync(ZIEL, { recursive: true });
    fs.writeFileSync(path.join(ZIEL, 'logo.svg'), LOGO);
    console.log('  assets/icons/logo.svg');

    const { chromium } = playwright();
    const browser = await chromium.launch({ channel: 'chrome' });

    for (const kante of GROESSEN) {
        const page = await browser.newPage({
            viewport: { width: kante, height: kante },
            deviceScaleFactor: 1,
        });
        // Das kleine Favicon mit Rundung wie im Tab, die App-Icons randlos.
        await page.setContent(seite(kante, kante === 32 ? LOGO : RANDLOS));
        const datei = path.join(ZIEL, 'icon-' + kante + '.png');
        await page.screenshot({ path: datei, omitBackground: true });
        await page.close();
        console.log('  ' + path.relative(WURZEL, datei) + ' (' + fs.statSync(datei).size + ' Byte)');
    }

    await browser.close();

    fs.writeFileSync(path.join(WURZEL, 'favicon.ico'), ico(fs.readFileSync(path.join(ZIEL, 'icon-32.png')), 32));
    console.log('  favicon.ico');
})();
