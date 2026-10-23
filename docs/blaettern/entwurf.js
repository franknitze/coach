/*
 * Entwurf: Blättern in "Letzte Einheiten". Unter der Liste dieselbe
 * Steuerzeile wie im Kalender: ← ältere, Bereich, → neuere. Legt die Zeile
 * per Skript über die echte Startseite der Testumgebung (24 Einheiten).
 *
 *   node docs/blaettern/entwurf.js
 */
const path = require('path');
const { testlauf, saetze, einheit } = require('../../tests/hilfen');

testlauf('Entwurf Blättern', 8780, async (t) => {
    const { page } = t;
    const sep = [], okt = [];
    for (let i = 1; i <= 14; i++) sep.push(einheit('2026-09-' + String(i * 2).padStart(2, '0'), i % 2 ? 'oberkoerper' : 'unterkoerper', 0,
        i % 2 ? { bankdruecken: saetze(80, 8, 8, 8, 8), latzug: saetze(60, 10, 10, 10, 10) } : { beinpresse: saetze(120, 10, 10, 10, 10) }));
    for (let i = 1; i <= 10; i++) okt.push(einheit('2026-10-' + String(i * 2).padStart(2, '0'), i % 2 ? 'oberkoerper' : 'unterkoerper', 0,
        i % 2 ? { bankdruecken: saetze(80, 8, 8, 8, 8), latzug: saetze(60, 10, 10, 10, 10) } : { beinpresse: saetze(120, 10, 10, 10, 10) }));
    t.training({ '2026-09': sep, '2026-10': okt });
    await t.anmelden();
    await page.waitForTimeout(500);

    await page.evaluate(() => {
        const r = document.querySelector('.rueckblick');
        const zahl = r.querySelector('.tag__zahl');
        if (zahl) zahl.remove();
        const css = document.createElement('style');
        css.textContent = '.rueckblick .kal__steuer { margin: 14px 0 0; }';
        document.head.appendChild(css);
        const z = document.createElement('div');
        z.className = 'kal__steuer';
        z.innerHTML = '<button class="kopfknopf" aria-label="Ältere Einheiten">←</button>'
            + '<span class="kal__zahl">1–10 von 24</span>'
            + '<button class="kopfknopf" disabled aria-label="Neuere Einheiten">→</button>';
        r.appendChild(z);
        window.scrollTo(0, document.documentElement.scrollHeight);
    });
    await page.screenshot({ path: path.join(__dirname, 'entwurf.png') });
});
