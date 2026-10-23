/*
 * Entwurf: Verlaufsknopf auf der Studio-Kachel und Verlaufstabelle.
 * Läuft über die Testumgebung (eigener Server, eigene Daten) und legt
 * Knopf und Tabelle per Skript über die echte Oberfläche. Ergebnis:
 * entwurf-kachel.png und entwurf-tabelle.png in diesem Ordner.
 *
 *   node docs/verlauf/entwurf.js
 */
const fs = require('fs');
const path = require('path');
const { testlauf, saetze, einheit } = require('../../tests/hilfen');

// Verlauf von Kabelrudern wie auf dem Server, Stand vor der Einheit vom 23.10.
const verlauf = [
    ['2026-08-19', [[45, 10], [55, 10], [65, 10]]],
    ['2026-08-26', [[45, 10], [55, 10], [65, 10]]],
    ['2026-09-04', [[65, 11], [65, 11], [65, 11]]],
    ['2026-09-11', [[65, 12], [65, 12], [65, 12]]],
    ['2026-09-21', [[65, 12], [65, 12], [65, 12]]],
    ['2026-09-28', [[65, 10], [65, 10], [65, 10]]],
    ['2026-10-02', [[65, 11], [65, 11], [65, 11]]],
    ['2026-10-16', [[65, 12], [65, 12], [65, 12]]],
];
// Ziel erreicht je Einheit, nachgespielt mit coach_nachspielen().
const erreicht = [false, false, true, true, true, true, true, true];

const ICON = {
    uhr: 'M140,80v41.21l34.17,20.5a12,12,0,1,1-12.34,20.58l-40-24A12,12,0,0,1,116,128V80a12,12,0,0,1,24,0ZM128,28A99.38,99.38,0,0,0,57.24,57.34c-4.69,4.74-9,9.37-13.24,14V64a12,12,0,0,0-24,0v40a12,12,0,0,0,12,12H72a12,12,0,0,0,0-24H57.77C63,86,68.37,80.22,74.26,74.26a76,76,0,1,1,1.58,109,12,12,0,0,0-16.48,17.46A100,100,0,1,0,128,28Z',
    check: 'M232.49,80.49l-128,128a12,12,0,0,1-17,0l-56-56a12,12,0,1,1,17-17L96,183,215.51,63.51a12,12,0,0,1,17,17Z',
    x: 'M208.49,191.51a12,12,0,0,1-17,17L128,145,64.49,208.49a12,12,0,0,1-17-17L111,128,47.51,64.49a12,12,0,0,1,17-17L128,111l63.51-63.52a12,12,0,0,1,17,17L145,128Z',
};

testlauf('Entwurf Verlauf', 8799, async (t) => {
    const { page } = t;
    const ex = JSON.parse(fs.readFileSync(t.datenordner + '/exercises.json', 'utf8'));
    ex.kabelrudern_eng = {
        id: 'kabelrudern_eng', name: 'Kabelrudern sitzend, enger Parallelgriff', muscle_group: 'ruecken',
        day: 'oberkoerper', order: 0, target_sets: 3, rep_min: 10, rep_max: 12, weight_step: 5,
        photo: 'a6-kabelrudern-sitzend-enger-parallelgriff.jpg', station: '25',
    };
    fs.writeFileSync(t.datenordner + '/exercises.json', JSON.stringify(ex));
    const monate = {};
    for (const [d, s] of verlauf) {
        (monate[d.slice(0, 7)] = monate[d.slice(0, 7)] || [])
            .push(einheit(d, 'oberkoerper', 0, { kabelrudern_eng: s.map(([w, r]) => ({ weight: w, reps: r })) }));
    }
    t.training(monate);

    await t.anmelden();
    await t.studio('Oberkörper');
    const kachel = page.locator('.kachel', { hasText: 'Kabelrudern' });
    await kachel.locator('.kachel__text').click();
    await page.waitForTimeout(400);

    await page.evaluate(({ verlauf, erreicht, ICON }) => {
        const svg = (d, k) => `<svg class="${k}" viewBox="0 0 256 256" aria-hidden="true"><path d="${d}"/></svg>`;
        const css = document.createElement('style');
        css.textContent = `
          .kachel { position: relative; }
          .verlauf-knopf { position: absolute; right: 14px; top: 132px; width: 56px; height: 44px;
            display: grid; place-items: center; border: 1px solid var(--linie, #343a45); border-radius: 12px;
            background: transparent; color: var(--text, #ece8df); }
          .verlauf-knopf svg { width: 24px; height: 24px; fill: currentColor; }
          .blatt { position: fixed; inset: 0; z-index: 30; display: flex; flex-direction: column; justify-content: flex-end;
            background: rgba(12,14,18,.72); }
          .blatt__innen { background: var(--flaeche, #23272f); border-top: 1px solid var(--linie, #343a45);
            border-radius: 20px 20px 0 0; padding: 20px 16px calc(env(safe-area-inset-bottom) + 16px); max-height: 86vh; overflow-y: auto; }
          .blatt__kopf { display: flex; gap: 12px; align-items: center; margin-bottom: 14px; }
          .blatt__kopf .plakette { flex: none; }
          .blatt__name { font-weight: 700; font-size: 19px; line-height: 1.2; }
          .verlauf { width: 100%; border-collapse: collapse; font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 15px; table-layout: fixed; }
          .verlauf th { text-align: left; font: 600 13px ui-monospace, "SF Mono", Menlo, monospace; color: var(--leise, #a6a39b);
            padding: 0 6px 8px; border-bottom: 1px solid var(--linie, #343a45); }
          .verlauf td { padding: 5px 6px; vertical-align: top; } .verlauf tr.neu td { border-top: 1px solid var(--linie, #343a45); padding-top: 12px; } .verlauf tbody tr:not(.neu) + tr.neu td, .verlauf tbody tr.neu:first-child td { } .verlauf tbody tr:last-child td { padding-bottom: 12px; }
          .verlauf th:nth-child(1){width:34%} .verlauf th:nth-child(2){width:28%} .verlauf td:nth-child(2), .verlauf td:nth-child(3), .verlauf th:nth-child(2), .verlauf th:nth-child(3){text-align:right} .verlauf th:last-child, .verlauf td:last-child { text-align: center; width: 15%; }
          .verlauf td:first-child { white-space: nowrap; }
          .verlauf svg { width: 20px; height: 20px; }
          .verlauf thead th { border-bottom: 0; } .verlauf .ja { fill: var(--text, #ece8df); }
          .verlauf .nein { fill: var(--leise, #a6a39b); }
          .blatt__zu { margin-top: 16px; width: 100%; min-height: 56px; border-radius: 14px; border: 1px solid var(--linie, #343a45);
            background: transparent; color: var(--text, #ece8df); font: 600 17px -apple-system, system-ui, sans-serif; }`;
        document.head.appendChild(css);

        const k = [...document.querySelectorAll('.kachel')].find((e) => e.innerText.includes('Kabelrudern'));
        const b = document.createElement('button');
        b.className = 'verlauf-knopf';
        b.setAttribute('aria-label', 'Verlauf von Kabelrudern');
        b.innerHTML = svg(ICON.uhr, '');
        k.appendChild(b);
        // Höhe an der Punktreihe ausrichten
        const p = k.querySelector('.punkte').getBoundingClientRect(), kr = k.getBoundingClientRect();
        b.style.top = (p.top - kr.top + p.height / 2 - 22) + 'px';

        const datum = (d) => { const [y, m, t] = d.split('-'); return t + '.' + m + '.' + y.slice(2); };
        // Eine Zeile je Satz; Datum und Ziel stehen in der ersten Zeile der Einheit.
        const zeilen = verlauf.map(([d, sets], i) => sets.map(([w, r], j) =>
            `<tr class="${j === 0 ? 'neu' : ''}"><td>${j === 0 ? datum(d) : ''}</td><td>${w} kg</td><td>${r}</td>
              <td>${j === 0 ? (erreicht[i] ? svg(ICON.check, 'ja') + '<span class="sr">erreicht</span>' : svg(ICON.x, 'nein') + '<span class="sr">nicht erreicht</span>') : ''}</td></tr>`
        ).join('')).reverse().join('');
        const blatt = document.createElement('div');
        blatt.className = 'blatt';
        blatt.hidden = true;
        blatt.innerHTML = `<div class="blatt__innen">
            <div class="blatt__kopf"><span class="plakette">25</span><span class="blatt__name">Kabelrudern sitzend, enger Parallelgriff</span></div>
            <table class="verlauf"><thead><tr><th>Datum</th><th>Gewicht</th><th>Wdh</th><th>Ziel</th></tr></thead><tbody>${zeilen}</tbody></table>
            <button class="blatt__zu">Schließen</button></div>`;
        document.body.appendChild(blatt);
        const st = document.createElement('style');
        st.textContent = '.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}';
        document.head.appendChild(st);
        b.addEventListener('click', () => { blatt.hidden = false; });
    }, { verlauf, erreicht, ICON });

    await kachel.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollTo(0, [...document.querySelectorAll('.kachel')]
        .find((e) => e.innerText.includes('Kabelrudern')).getBoundingClientRect().top + scrollY - 16));
    await page.screenshot({ path: path.join(__dirname, 'entwurf-kachel.png') });
    await page.click('.verlauf-knopf');
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(__dirname, 'entwurf-tabelle.png') });
});
