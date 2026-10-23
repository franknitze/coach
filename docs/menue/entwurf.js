/*
 * Entwurf: Menü oben rechts mit Kalender, Einstellungen, Trennstrich,
 * Abmelden. Legt Knopf und Menü per Skript über die echte Startseite der
 * Testumgebung. Ergebnis: entwurf-zu.png und entwurf-offen.png.
 *
 *   node docs/menue/entwurf.js
 */
const path = require('path');
const { testlauf, saetze, einheit } = require('../../tests/hilfen');

const LISTE = 'M228,128a12,12,0,0,1-12,12H40a12,12,0,0,1,0-24H216A12,12,0,0,1,228,128ZM40,76H216a12,12,0,0,0,0-24H40a12,12,0,0,0,0,24ZM216,180H40a12,12,0,0,0,0,24H216a12,12,0,0,0,0-24Z';

testlauf('Entwurf Menü', 8782, async (t) => {
    const { page } = t;
    t.training({ '2026-10': [
        einheit('2026-10-14', 'unterkoerper', 1, { beinpresse: saetze(120, 10, 10, 10, 10) }),
        einheit('2026-10-16', 'oberkoerper', 0, { bankdruecken: saetze(80, 8, 8, 8, 8), latzug: saetze(60, 10, 10, 10, 10) }),
    ] });
    await t.anmelden();
    await page.waitForTimeout(500);

    await page.evaluate((LISTE) => {
        const css = document.createElement('style');
        css.textContent = `
          .kopf { position: relative; }
          .menue-knopf { display: grid; place-items: center; width: 48px; height: 48px; margin-right: -10px;
            padding: 0; border: 0; background: transparent; color: var(--schrift); cursor: pointer; }
          .menue-knopf svg { width: 28px; height: 28px; fill: currentColor; }
          .menue { position: absolute; right: var(--rand); top: calc(100% - 6px); z-index: 25; min-width: 220px;
            padding: 6px 0; border: 1px solid var(--linie); border-radius: 14px; background: var(--raum-hoch);
            box-shadow: 0 12px 32px rgba(0,0,0,.45); }
          .menue button { display: block; width: 100%; min-height: 52px; padding: 0 18px; border: 0; background: transparent;
            color: var(--schrift); font: var(--s-text)/1 var(--sans); text-align: left; }
          .menue hr { height: 1px; margin: 6px 18px; border: 0; background: var(--linie); }
          .menue .leise { color: var(--schrift-leise); }`;
        document.head.appendChild(css);
        const kopf = document.querySelector('.kopf');
        const b = document.createElement('button');
        b.className = 'menue-knopf';
        b.setAttribute('aria-label', 'Menü');
        b.innerHTML = `<svg viewBox="0 0 256 256" aria-hidden="true"><path d="${LISTE}"/></svg>`;
        kopf.appendChild(b);
        const m = document.createElement('div');
        m.className = 'menue';
        m.hidden = true;
        m.innerHTML = '<button>Kalender</button><button>Einstellungen</button><hr><button class="leise">Abmelden</button>';
        kopf.appendChild(m);
        b.addEventListener('click', () => { m.hidden = false; });
        // Die bisherigen Verweise unten und Abmelden im Fuß fallen weg
        document.querySelectorAll('.verweis').forEach((v) => v.remove());
        const fuss = document.querySelector('.fuss');
        if (fuss) fuss.remove();
    }, LISTE);

    await page.screenshot({ path: path.join(__dirname, 'entwurf-zu.png') });
    await page.click('.menue-knopf');
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(__dirname, 'entwurf-offen.png') });
});
