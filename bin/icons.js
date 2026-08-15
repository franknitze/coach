/*
 * Erzeugt die PWA-Icons in assets/icons/.
 *
 *   node bin/icons.js
 *
 * Einmalig nötig und danach nur, wenn sich das Symbol ändert. Die
 * erzeugten PNG liegen im Repo, damit auf dem Server nichts gebaut
 * werden muss.
 *
 * Gezeichnet wird die gelbe Geräteplakette auf dem dunklen Grundton der
 * App: dasselbe Zeichen, das im Studio an den Geräten klebt und in der
 * Oberfläche jede Übung markiert.
 *
 * Der Hintergrund läuft randlos durch, ohne eigene Rundung. Android
 * schneidet das Icon selbst zu (maskable), iOS rundet es ohnehin. Eine
 * mitgezeichnete Rundung ergäbe doppelte Ecken. Die Plakette bleibt
 * deshalb in der mittleren Zone, die beim Zuschneiden sicher übrig
 * bleibt.
 */

const fs = require('fs');
const path = require('path');

const ZIEL = path.resolve(__dirname, '../assets/icons');
const GROESSEN = [180, 192, 512];

function seite(kante) {
    const plakette = Math.round(kante * 0.52);
    const radius = Math.round(plakette * 0.16);
    const schrift = Math.round(plakette * 0.62);

    return `<!doctype html><meta charset="utf-8"><style>
        html, body { margin: 0; width: ${kante}px; height: ${kante}px; }
        body {
            display: grid; place-items: center;
            background: #1b1e24;
        }
        .plakette {
            display: grid; place-items: center;
            width: ${plakette}px; height: ${plakette}px;
            border-radius: ${radius}px;
            background: #f2b705;
            color: #1b1e24;
            font: 700 ${schrift}px/1 ui-monospace, "SF Mono", Menlo, monospace;
            padding-bottom: ${Math.round(schrift * 0.04)}px;
        }
    </style><div class="plakette">C</div>`;
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

    const { chromium } = playwright();
    const browser = await chromium.launch({ channel: 'chrome' });

    for (const kante of GROESSEN) {
        const page = await browser.newPage({
            viewport: { width: kante, height: kante },
            deviceScaleFactor: 1,
        });
        await page.setContent(seite(kante));
        const datei = path.join(ZIEL, 'icon-' + kante + '.png');
        await page.screenshot({ path: datei, omitBackground: false });
        await page.close();
        console.log('  ' + path.relative(path.resolve(__dirname, '..'), datei)
            + ' (' + fs.statSync(datei).size + ' Byte)');
    }

    await browser.close();
})();
