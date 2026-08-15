/*
 * Frontend der Trainings-App.
 *
 * Redet ausschließlich über die JSON-API in api/, nie direkt mit den
 * Dateien in data/. Kein Framework, kein Build-Schritt.
 *
 * Drei Ansichten: "start" (welcher Tag ist dran), "studio" (trainieren),
 * "plan" (Übungsbibliothek und Schwerpunkte pflegen).
 */

(function () {
    'use strict';

    /* ---------- API ---------- */

    async function api(pfad, optionen) {
        const einstellungen = Object.assign({ headers: {} }, optionen || {});

        if (einstellungen.daten !== undefined) {
            einstellungen.method = einstellungen.method || 'POST';
            einstellungen.headers['Content-Type'] = 'application/json';
            einstellungen.body = JSON.stringify(einstellungen.daten);
            delete einstellungen.daten;
        }

        // Ein fehlgeschlagener fetch wirft einen englischen Browsertext
        // ("Failed to fetch"). Im Studio ist schlechter Empfang der
        // wahrscheinlichste Fehlerfall überhaupt, und dann soll dort auf
        // Deutsch stehen, was los ist.
        let antwort;
        try {
            antwort = await fetch(pfad, einstellungen);
        } catch (e) {
            throw new Error('Keine Verbindung. Die App braucht Netz, '
                + 'um Übungen zu laden und Sätze zu speichern.');
        }

        let inhalt = {};
        try {
            inhalt = await antwort.json();
        } catch (e) {
            throw new Error('Server antwortet nicht wie erwartet.');
        }

        // 401 heißt im angemeldeten Bereich "Sitzung abgelaufen", dort ist
        // Neuladen richtig. Auf dem Anmeldebildschirm heißt derselbe Code
        // "falsches Passwort", und dann muss die Meldung stehen bleiben,
        // sonst lädt die Seite wortlos neu und niemand weiß, warum.
        if (antwort.status === 401 && document.getElementById('app')) {
            location.reload();
            throw new Error('Nicht angemeldet.');
        }
        if (!antwort.ok) {
            throw new Error(inhalt.error || 'Etwas ist schiefgelaufen.');
        }
        return inhalt;
    }

    /* ---------- Werkzeuge ---------- */

    function esc(wert) {
        return String(wert === undefined || wert === null ? '' : wert)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    /** 2.5 wird zu "2,5", 5 bleibt "5". */
    function zahl(wert) {
        return String(Math.round(wert * 100) / 100).replace('.', ',');
    }

    /*
     * In plan.json sind die Muskelgruppen umlautfreie Schlüssel, damit sie
     * sich als JSON-Schlüssel und in IDs sauber verhalten. Angezeigt wird
     * aber der lesbare Name: "ruecken" ist kein Wort.
     */
    const GRUPPEN = {
        brust: 'Brust', ruecken: 'Rücken', beine: 'Beine',
        schulter: 'Schulter', bizeps: 'Bizeps', trizeps: 'Trizeps',
    };

    function gruppenName(schluessel) {
        return GRUPPEN[schluessel]
            || String(schluessel).charAt(0).toUpperCase() + String(schluessel).slice(1);
    }

    const WOCHENTAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    const MONATE = ['Jan', 'Feb', 'März', 'Apr', 'Mai', 'Juni',
                    'Juli', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

    function datum(iso) {
        const d = new Date(iso);
        if (isNaN(d)) {
            return '';
        }
        return WOCHENTAGE[d.getDay()] + ', ' + d.getDate() + '. ' + MONATE[d.getMonth()];
    }

    /** Kurzform für die Kachel, damit die Zeile nicht umbricht: "11.8." */
    function datumKurz(iso) {
        const d = new Date(iso);
        return isNaN(d) ? '' : d.getDate() + '.' + (d.getMonth() + 1) + '.';
    }

    /* ---------- Anmeldung ---------- */

    const anmeldung = document.getElementById('anmeldung');

    if (anmeldung) {
        const knopf  = document.getElementById('anmelden');
        const fehler = document.getElementById('fehler');
        const feld   = anmeldung.querySelector('input[name="password"]');

        anmeldung.addEventListener('submit', async function (e) {
            e.preventDefault();
            fehler.textContent = '';
            knopf.disabled = true;
            knopf.textContent = 'Moment';

            try {
                await api('api/login.php', { daten: { password: feld.value } });
                location.reload();
            } catch (err) {
                fehler.textContent = err.message;
                knopf.disabled = false;
                knopf.textContent = 'Anmelden';
                feld.value = '';
                feld.focus();
            }
        });
    }

    /* ---------- Angemeldeter Bereich ---------- */

    const app = document.getElementById('app');
    if (!app) {
        return;
    }

    const abmelden = document.getElementById('abmelden');
    if (abmelden) {
        abmelden.addEventListener('click', async function () {
            await api('api/logout.php', { method: 'POST' });
            location.reload();
        });
    }

    const zustand = {
        plan: null,
        uebungen: {},
        studio: null,          // Antwort von api/plan.php
        ansicht: 'start',
        offen: null,           // aufgeklappte Übung im Studio
        entwurf: {},           // laufende Eingabe je Übung
        uebungId: null,        // Übung in der Detailansicht, null = neue
        neuTag: null,          // Trainingstag einer neu angelegten Übung
        verlauf: null,         // Antwort von api/history.php
        punktIndex: null,      // gewählte Einheit im Diagramm, null = letzte
        loeschfrage: null,
        meldung: '',
    };

    /* ---------- Pausen-Timer ----------
     *
     * Liegt außerhalb von #app und zählt per textContent herunter. Ein
     * Neuzeichnen der Übungsliste im Sekundentakt wäre Verschwendung und
     * würde bei jedem Tick den Scrollzustand anfassen.
     */

    const pauseBox  = document.getElementById('pause');
    const pauseZeit = document.getElementById('pause-zeit');
    const pauseWeg  = document.getElementById('pause-weg');
    let pauseUhr = null;

    function pauseStarten(sekunden) {
        if (!sekunden) {
            return;
        }
        pauseBeenden();

        const ende = Date.now() + sekunden * 1000;
        pauseBox.hidden = false;
        document.body.classList.add('hat-pause');
        pauseBox.classList.remove('ist-um');
        pauseWeg.textContent = 'Überspringen';

        function tick() {
            const rest = Math.max(0, Math.round((ende - Date.now()) / 1000));
            pauseZeit.textContent = Math.floor(rest / 60) + ':'
                + String(rest % 60).padStart(2, '0');

            if (rest === 0) {
                clearInterval(pauseUhr);
                pauseUhr = null;
                pauseBox.classList.add('ist-um');
                pauseWeg.textContent = 'Weiter';
                try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) {}
            }
        }

        tick();
        pauseUhr = setInterval(tick, 250);
    }

    function pauseBeenden() {
        if (pauseUhr) {
            clearInterval(pauseUhr);
            pauseUhr = null;
        }
        pauseBox.hidden = true;
        pauseBox.classList.remove('ist-um');
        document.body.classList.remove('hat-pause');
    }

    pauseWeg.addEventListener('click', pauseBeenden);

    /* ---------- Ansicht: Start ---------- */

    function zeichneStart() {
        const s = zustand.studio;

        if (!s) {
            return '<section class="leer">'
                + '<h1 class="leer__titel">Der Plan fehlt noch</h1>'
                + '<p class="leer__text">Ohne Übungen gibt es nichts zu starten. '
                + 'Trag ein, an welchen Geräten du trainierst, dann kann es losgehen.</p>'
                + '<div class="werkzeuge"><button class="knopf" data-gehe="plan">'
                + 'Plan anlegen</button></div></section>';
        }

        const anzahl = s.exercises.length;

        // Was heute an diesem Tag schon steht, sticht die Angabe zur letzten
        // Einheit: "zuletzt trainiert" mit dem heutigen Datum ist keine
        // Auskunft, "heute schon 2 Sätze" schon.
        const heuteSaetze = s.exercises.reduce(function (summe, u) {
            return summe + ((u.today && u.today.length) || 0);
        }, 0);

        const letzte = s.exercises
            .map(function (u) { return u.last && u.last.date; })
            .filter(Boolean)
            .sort()
            .pop();

        let zusatz = '';
        if (heuteSaetze > 0) {
            zusatz = ' · heute schon ' + heuteSaetze
                   + (heuteSaetze === 1 ? ' Satz' : ' Sätze');
        } else if (letzte) {
            zusatz = ' · zuletzt ' + esc(datum(letzte));
        }

        let html = '<div class="start"><section class="heute">'
            + '<span class="mini">' + (s.is_suggestion ? 'Heute' : 'Gewählt') + '</span>'
            + '<h1 class="heute__tag">' + esc(s.day.label) + '</h1>'
            + '<p class="heute__zeile">' + anzahl + (anzahl === 1 ? ' Übung' : ' Übungen')
            + zusatz + '</p></section>';

        if (anzahl === 0) {
            html += '<p class="tag__leer">Für diesen Tag ist noch keine Übung '
                 + 'eingetragen. Wähle einen anderen Tag oder ergänze den Plan.</p>';
        }

        html += '<div class="tagwahl"><span class="mini">Anderer Tag</span><div class="tagwahl__reihe">';
        Object.keys(s.days).forEach(function (t) {
            html += '<button class="tagknopf' + (t === s.day.key ? ' ist-an' : '')
                 + '" data-tag="' + esc(t) + '">' + esc(s.days[t].label) + '</button>';
        });
        html += '</div></div>';

        html += '<button class="verweis" data-gehe="plan">Mein Plan</button>';

        if (anzahl > 0) {
            html += '<div class="fussleiste"><button class="knopf" data-gehe="studio">'
                 + (heuteSaetze > 0 ? 'Weiter trainieren' : 'Los geht\'s')
                 + '</button></div>';
        }

        return html + '</div>';
    }

    /* ---------- Ansicht: Studio ---------- */

    function zeichneStudio() {
        const s = zustand.studio;

        let html = '<div class="titelzeile">'
            + '<h1 class="titel">' + esc(s.day.label) + '</h1>'
            + '<button class="kopfknopf" data-gehe="start">Fertig</button>'
            + '</div>';

        if (zustand.meldung) {
            html += '<p class="fehler">' + esc(zustand.meldung) + '</p>';
        }

        s.exercises.forEach(function (u) {
            html += zeichneKachel(u);
        });

        return html;
    }

    function zeichneKachel(u) {
        const offen  = zustand.offen === u.id;
        const heute  = u.today || [];
        const ziel   = u.target_sets;

        const bild = u.photo
            ? '<img class="kachel__bild" src="assets/img/exercises/' + esc(u.photo)
              + '" alt="" loading="lazy">'
            : '<span class="kachel__platzhalter">'
              + (u.station ? esc(u.station) : '?') + '</span>';

        let punkte = '';
        for (let i = 0; i < ziel; i++) {
            punkte += '<span class="punkt' + (i < heute.length ? ' ist-voll' : '') + '"></span>';
        }

        // Die Ansage steht laut SPEC.md §5.2 auf der Kachel. Hervorgehoben
        // wird nur die fällige Steigerung, denn genau das bedeutet das
        // Orange in dieser App. Die übrigen Hinweise bleiben zurückhaltend,
        // sonst schreit jede Kachel und keine sagt mehr etwas.
        const c = u.coach;
        let ansage = '';
        if (c && c.text) {
            ansage = '<span class="kachel__coach'
                   + (c.status === 'steigern' ? ' ist-faellig' : '') + '">'
                   + esc(c.text) + '</span>';
            if (c.reason) {
                ansage += '<span class="kachel__grund">' + esc(c.reason) + '</span>';
            }
        }

        let html = '<section class="kachel' + (offen ? ' ist-offen' : '') + '">'
            + '<button class="kachel__kopf" data-oeffne="' + esc(u.id) + '">'
            + bild
            + '<span class="kachel__text">'
            + '<span class="kachel__name">' + esc(u.name) + '</span>'
            + '<span class="kachel__ziel">' + ziel + ' Sätze · '
            + u.rep_min + '–' + u.rep_max + ' Wdh</span>'
            + '<span class="kachel__zuletzt">' + esc(letztesErgebnis(u)) + '</span>'
            + ansage
            + '<span class="punkte">' + punkte + '</span>'
            + '</span></button>';

        if (offen) {
            html += zeichneSaetze(u);
        }

        return html + '</section>';
    }

    function letztesErgebnis(u) {
        if (!u.last || !u.last.sets || u.last.sets.length === 0) {
            return 'noch kein Ergebnis';
        }
        const s = u.last.sets[u.last.sets.length - 1];
        return 'zuletzt ' + zahl(s.weight) + ' kg × ' + s.reps
             + (u.last.date ? ' · ' + datumKurz(u.last.date) : '');
    }

    /**
     * Vorbelegung des nächsten Satzes.
     *
     * Reihenfolge: was heute schon lag, sonst derselbe Satz der letzten
     * Einheit, sonst deren letzter Satz, sonst der untere Wiederholungsrand.
     * Ziel ist, dass gleiche Leistung nur bestätigt und nicht getippt wird.
     */
    function vorbelegung(u) {
        const heute = u.today || [];
        if (heute.length > 0) {
            return { weight: heute[heute.length - 1].weight, reps: heute[heute.length - 1].reps };
        }
        const alt = (u.last && u.last.sets) || [];
        if (alt.length > 0) {
            const passend = alt[heute.length] || alt[alt.length - 1];
            return { weight: passend.weight, reps: passend.reps };
        }
        return { weight: 0, reps: u.rep_min };
    }

    function zeichneSaetze(u) {
        const heute = u.today || [];
        let html = '<div class="saetze">';

        heute.forEach(function (satz, i) {
            html += '<div class="satz satz--fertig">'
                + '<span class="satz__mini">Satz ' + (i + 1) + '</span>'
                + '<span class="satz__wert">' + zahl(satz.weight) + ' kg × ' + satz.reps + '</span>'
                + '<button class="satz__korr" data-korrigiere="' + esc(u.id) + ':' + i
                + '">ändern</button></div>';
        });

        if (heute.length >= u.target_sets && zustand.entwurf[u.id] === undefined) {
            html += '<p class="satz__fertig">Alle ' + u.target_sets + ' Sätze stehen.</p>'
                 + '<button class="zufuegen" data-extra="' + esc(u.id) + '">'
                 + 'Noch einen Satz</button></div>';
            return html;
        }

        const e = zustand.entwurf[u.id] || vorbelegung(u);
        const nummer = (zustand.entwurf[u.id] && zustand.entwurf[u.id].index !== undefined)
            ? zustand.entwurf[u.id].index + 1
            : heute.length + 1;

        html += '<div class="satz satz--dran">'
            + '<span class="satz__mini">Satz ' + nummer + '</span>'
            + regler(u.id, 'weight', zahl(e.weight) + ' kg', '± ' + zahl(u.weight_step) + ' kg')
            + regler(u.id, 'reps', e.reps + ' Wdh', '')
            + '<button class="knopf satz__ok" data-bestaetige="' + esc(u.id) + '">'
            + 'Satz bestätigen</button>'
            + '</div>';

        return html + '</div>';
    }

    /*
     * $schritt wird nur beim Gewicht beschriftet, weil die Schrittweite dort
     * je Übung verschieden ist (1,25 / 2,5 / 5 kg). Bei Wiederholungen ist
     * eine 1 selbstverständlich und wäre eine Zahl ohne Aussage.
     */
    function regler(id, feld, anzeige, schritt) {
        return '<div class="regler">'
            + '<button class="regler__knopf" data-aendere="' + esc(id) + ':' + feld
            + ':-1" aria-label="weniger">−</button>'
            + '<span class="regler__wert">' + esc(anzeige) + '</span>'
            + '<button class="regler__knopf" data-aendere="' + esc(id) + ':' + feld
            + ':1" aria-label="mehr">+</button>'
            + (schritt ? '<span class="regler__schritt">' + esc(schritt) + '</span>' : '')
            + '</div>';
    }

    /* ---------- Verlaufsdiagramm ----------
     *
     * Inline-SVG statt einer Diagramm-Bibliothek: gebraucht wird eine
     * Linie mit zwei Achsen, dafür lohnt kein Nachladen, und die PWA soll
     * ohne Netz laufen.
     *
     * Bewusst zwei getrennte Diagramme statt einer zweiten y-Achse.
     * Gewicht (kg) und Volumen (kg mal Wiederholungen) haben ganz andere
     * Größenordnungen; in ein Achsenkreuz gezwungen suggerieren sich
     * kreuzende Linien Zusammenhänge, die es nicht gibt.
     *
     * Die Linie ist neutral eingefärbt, nicht gelb und nicht orange:
     * beide Farben haben in dieser App eine feste Bedeutung ("hier
     * tippen" und "Steigerung fällig") und verlören sie als Datenfarbe.
     */

    const CH = { w: 340, h: 128, l: 50, r: 8, t: 14, b: 22 };

    function chartGeometrie(punkte, feld) {
        const innenB = CH.w - CH.l - CH.r;
        const innenH = CH.h - CH.t - CH.b;

        const werte = punkte.map(function (p) { return p[feld]; });
        let unten = Math.min.apply(null, werte);
        let oben  = Math.max.apply(null, werte);

        // Waagerechte Linie mittig statt am Rand kleben lassen.
        if (unten === oben) {
            unten -= 1;
            oben  += 1;
        }
        const luft = (oben - unten) * 0.15;

        const zeiten = punkte.map(function (p) { return new Date(p.date).getTime(); });
        const t0 = zeiten[0];
        const t1 = zeiten[zeiten.length - 1];

        return {
            zeiten: zeiten,
            datenUnten: Math.min.apply(null, werte),
            datenOben: Math.max.apply(null, werte),
            // x folgt der echten Zeit, nicht der Position: eine Pause von
            // drei Wochen soll als Lücke sichtbar sein.
            x: function (i) {
                return t1 === t0
                    ? CH.l + innenB / 2
                    : CH.l + (zeiten[i] - t0) / (t1 - t0) * innenB;
            },
            y: function (v) {
                return CH.t + innenH - (v - (unten - luft)) / ((oben + luft) - (unten - luft)) * innenH;
            },
        };
    }

    function chart(punkte, feld, einheit, gewaehlt) {
        const g = chartGeometrie(punkte, feld);
        const xy = punkte.map(function (p, i) { return [g.x(i), g.y(p[feld])]; });

        const pfad = xy.map(function (p, i) {
            return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1);
        }).join(' ');

        const yOben  = g.y(g.datenOben);
        const yUnten = g.y(g.datenUnten);

        let svg = '<svg class="chart" viewBox="0 0 ' + CH.w + ' ' + CH.h + '" '
            + 'data-feld="' + feld + '" role="img" '
            + 'aria-label="Verlauf ' + esc(einheit) + '">';

        // Zurückhaltendes Raster: nur die beiden echten Datenwerte.
        svg += '<line class="ch-raster" x1="' + CH.l + '" y1="' + yOben.toFixed(1)
             + '" x2="' + (CH.w - CH.r) + '" y2="' + yOben.toFixed(1) + '"></line>'
             + '<line class="ch-raster" x1="' + CH.l + '" y1="' + yUnten.toFixed(1)
             + '" x2="' + (CH.w - CH.r) + '" y2="' + yUnten.toFixed(1) + '"></line>'
             + '<text class="ch-achse" x="' + (CH.l - 8) + '" y="' + (yOben + 4).toFixed(1)
             + '" text-anchor="end">' + esc(zahl(g.datenOben)) + '</text>'
             + '<text class="ch-achse" x="' + (CH.l - 8) + '" y="' + (yUnten + 4).toFixed(1)
             + '" text-anchor="end">' + esc(zahl(g.datenUnten)) + '</text>';

        if (punkte.length > 1) {
            svg += '<path class="ch-linie" d="' + pfad + '"></path>';
        }

        // Fadenkreuz auf dem gewählten Punkt.
        const p = xy[gewaehlt];
        if (p) {
            svg += '<line class="ch-kreuz" x1="' + p[0].toFixed(1) + '" y1="' + CH.t
                 + '" x2="' + p[0].toFixed(1) + '" y2="' + (CH.h - CH.b) + '"></line>'
                 + '<circle class="ch-punkt" cx="' + p[0].toFixed(1) + '" cy="'
                 + p[1].toFixed(1) + '" r="5"></circle>';
        }

        svg += '<text class="ch-achse" x="' + CH.l + '" y="' + (CH.h - 6)
             + '">' + esc(datumKurz(punkte[0].date)) + '</text>';
        if (punkte.length > 1) {
            svg += '<text class="ch-achse" x="' + (CH.w - CH.r) + '" y="' + (CH.h - 6)
                 + '" text-anchor="end">'
                 + esc(datumKurz(punkte[punkte.length - 1].date)) + '</text>';
        }

        return svg + '</svg>';
    }

    /* ---------- Ansicht: eine Übung ---------- */

    function zeichneUebung() {
        const neu = zustand.uebungId === null;
        // Die Bibliothek ist die Quelle für die Stammdaten, nicht die
        // Verlaufsantwort: die kommt später und wäre beim ersten
        // Bildaufbau noch die der vorher geöffneten Übung.
        const u = neu ? { day: zustand.neuTag } : zustand.uebungen[zustand.uebungId];

        if (!u) {
            return '<p class="fehler">Diese Übung gibt es nicht mehr.</p>';
        }

        let html = '<div class="titelzeile">'
            + '<h1 class="titel">' + esc(neu ? 'Neue Übung' : u.name) + '</h1>'
            + '<button class="kopfknopf" data-gehe="plan">Zurück</button>'
            + '</div>';

        // Der Verlauf steht in einem eigenen Behälter, damit er sich
        // aktualisieren lässt, ohne das Formular darunter neu zu zeichnen.
        // Sonst verliert eine Eingabe ihren Text, sobald die Kurve
        // nachlädt oder man einen Punkt antippt.
        if (!neu) {
            html += '<div id="verlaufteil">' + zeichneVerlauf() + '</div>';
        }

        return html + zeichneEditor(neu ? { day: zustand.neuTag } : u);
    }

    /** Zeichnet nur den Verlaufsteil neu, nicht die ganze Ansicht. */
    function verlaufZeichnen() {
        const behaelter = document.getElementById('verlaufteil');
        if (behaelter) {
            behaelter.innerHTML = zeichneVerlauf();
        }
    }

    function zeichneVerlauf() {
        const punkte = (zustand.verlauf && zustand.verlauf.points) || [];

        if (punkte.length === 0) {
            return '<p class="tag__leer">Noch kein Verlauf. Sobald du diese Übung '
                 + 'trainiert hast, steht hier die Kurve.</p>';
        }

        const i = Math.min(zustand.punktIndex === null ? punkte.length - 1 : zustand.punktIndex,
                           punkte.length - 1);
        const p = punkte[i];

        // Bei einem einzigen Datenpunkt ist eine Kurve eine Lüge: es gibt
        // keinen Verlauf, nur einen Wert.
        if (punkte.length === 1) {
            return '<section class="verlauf">'
                + '<p class="verlauf__lese">' + esc(datum(p.date)) + ' · '
                + esc(zahl(p.max_weight)) + ' kg × ' + p.top_reps + ' · '
                + p.sets + (p.sets === 1 ? ' Satz' : ' Sätze') + '</p>'
                + '<p class="tag__leer">Eine Einheit reicht für keine Kurve. '
                + 'Ab der zweiten wird hier ein Verlauf sichtbar.</p></section>';
        }

        return '<section class="verlauf">'
            + '<div class="verlauf__lese">'
            + '<span class="verlauf__datum">' + esc(datum(p.date)) + '</span>'
            + '<span class="verlauf__werte">'
            + esc(zahl(p.max_weight)) + ' kg × ' + p.top_reps + '  ·  '
            + p.sets + (p.sets === 1 ? ' Satz' : ' Sätze') + '  ·  '
            + esc(zahl(p.volume)) + ' Volumen</span></div>'

            + '<div class="chart__kopf"><span class="mini">Schwerstes Gewicht</span>'
            + '<span class="chart__einheit">kg</span></div>'
            + chart(punkte, 'max_weight', 'Kilogramm', i)

            + '<div class="chart__kopf"><span class="mini">Volumen</span>'
            + '<span class="chart__einheit">kg × Wdh</span></div>'
            + chart(punkte, 'volume', 'Volumen', i)

            + '<p class="hinweis">' + punkte.length + ' Einheiten. '
            + 'Tippen wählt eine Einheit aus.</p>'
            + '</section>';
    }

    /* ---------- Ansicht: Mein Plan ---------- */

    function zeichnePlan() {
        const tage = zustand.plan.days || {};
        let html = '<div class="titelzeile">'
            + '<h1 class="titel">Mein Plan</h1>'
            + '<button class="kopfknopf" data-gehe="start">Fertig</button>'
            + '</div>';

        Object.keys(tage).forEach(function (tag) {
            const liste = Object.values(zustand.uebungen)
                .filter(function (u) { return u.day === tag; })
                .sort(function (a, b) {
                    return (a.order - b.order) || a.name.localeCompare(b.name, 'de');
                });

            html += '<section class="tag">'
                + '<div class="tag__kopf">'
                + '<span class="tag__name">' + esc(tage[tag].label) + '</span>'
                + '<span class="tag__zahl">' + liste.length + '</span>'
                + '</div>';

            if (liste.length === 0) {
                html += '<p class="tag__leer">Noch nichts eingetragen.</p>';
            }

            liste.forEach(function (u) {
                html += zeichneZeile(u);
            });

            html += '<button class="zufuegen" data-neu="' + esc(tag) + '">'
                 + 'Übung zufügen</button></section>';
        });

        return html + zeichneSchwerpunkte();
    }

    function zeichneZeile(u) {
        const plakette = u.station
            ? '<span class="plakette">' + esc(u.station) + '</span>'
            : '<span class="plakette plakette--leer" title="Keine Gerätenummer">–</span>';

        return '<button class="zeile" data-bearbeite="' + esc(u.id) + '">'
            + plakette
            + '<span class="zeile__text">'
            + '<span class="zeile__name">' + esc(u.name) + '</span>'
            + '<span class="zeile__daten">'
            + esc(gruppenName(u.muscle_group)) + ' · ' + u.target_sets + '×'
            + u.rep_min + '–' + u.rep_max + ' · ' + zahl(u.weight_step) + ' kg'
            + '</span></span></button>';
    }

    function zeichneEditor(u) {
        const neu  = !u.id;
        const tage = zustand.plan.days || {};
        const grpn = Object.keys(zustand.plan.muscle_priorities || {});
        const wert = function (feld, ersatz) {
            return u[feld] === undefined || u[feld] === '' ? ersatz : u[feld];
        };

        let html = '<form class="editor" data-id="' + esc(u.id || '') + '">'
            + '<label class="mini" for="e-name">Name</label>'
            + '<input class="feld feld--text" id="e-name" name="name" required '
            + 'value="' + esc(u.name || '') + '" placeholder="Beinpresse">'

            + '<div class="paar">'
            + '<div><label class="mini" for="e-station">Gerätenummer</label>'
            + '<input class="feld feld--text" id="e-station" name="station" '
            + 'value="' + esc(u.station || '') + '" placeholder="43" inputmode="numeric"></div>'
            + '<div><label class="mini" for="e-order">Reihenfolge</label>'
            + '<input class="feld feld--text" id="e-order" name="order" type="number" min="0" '
            + 'value="' + esc(wert('order', 0)) + '"></div>'
            + '</div>'

            + '<div class="paar">'
            + '<div><label class="mini" for="e-day">Trainingstag</label>'
            + '<select class="feld feld--text" id="e-day" name="day">';
        Object.keys(tage).forEach(function (t) {
            html += '<option value="' + esc(t) + '"'
                 + (t === u.day ? ' selected' : '') + '>' + esc(tage[t].label) + '</option>';
        });
        html += '</select></div>'
            + '<div><label class="mini" for="e-group">Muskelgruppe</label>'
            + '<select class="feld feld--text" id="e-group" name="muscle_group">';
        grpn.forEach(function (g) {
            html += '<option value="' + esc(g) + '"'
                 + (g === u.muscle_group ? ' selected' : '') + '>'
                 + esc(gruppenName(g)) + '</option>';
        });
        html += '</select></div></div>'

            + '<div class="drei">'
            + '<div><label class="mini" for="e-sets">Sätze</label>'
            + '<input class="feld feld--text" id="e-sets" name="target_sets" type="number" '
            + 'min="1" max="12" value="' + esc(wert('target_sets', 4)) + '"></div>'
            + '<div><label class="mini" for="e-min">Wdh von</label>'
            + '<input class="feld feld--text" id="e-min" name="rep_min" type="number" '
            + 'min="1" value="' + esc(wert('rep_min', 8)) + '"></div>'
            + '<div><label class="mini" for="e-max">Wdh bis</label>'
            + '<input class="feld feld--text" id="e-max" name="rep_max" type="number" '
            + 'min="1" value="' + esc(wert('rep_max', 12)) + '"></div>'
            + '</div>'

            + '<label class="mini" for="e-step">Schrittweite</label>'
            + '<select class="feld feld--text" id="e-step" name="weight_step">';
        [1.25, 2.5, 5].forEach(function (s) {
            const gewaehlt = parseFloat(wert('weight_step', 5)) === s;
            html += '<option value="' + s + '"' + (gewaehlt ? ' selected' : '') + '>'
                 + zahl(s) + ' kg</option>';
        });
        html += '</select>'

            + '<label class="mini" for="e-photo">Foto</label>'
            + '<input class="feld feld--text" id="e-photo" name="photo" '
            + 'value="' + esc(u.photo || '') + '" placeholder="'
            + esc((u.id || 'uebung') + '.jpg') + '">'
            + '<p class="hinweis">Dateiname aus assets/img/exercises/</p>'

            + '<p class="fehler" role="alert">' + esc(zustand.meldung) + '</p>'

            + '<div class="werkzeuge">'
            + '<button class="knopf" type="submit">Speichern</button>'
            + '<button class="knopf knopf--leise" type="button" data-abbrechen>Abbrechen</button>'
            + '</div>';

        if (!neu) {
            html += zustand.loeschfrage === u.id
                ? '<button class="loeschen loeschen--scharf" type="button" data-loesche="'
                  + esc(u.id) + '">Wirklich löschen</button>'
                : '<button class="loeschen" type="button" data-frage="' + esc(u.id)
                  + '">Übung löschen</button>';
        }

        return html + '</form>';
    }

    function zeichneSchwerpunkte() {
        const p = zustand.plan.muscle_priorities || {};

        let html = '<section class="tag">'
            + '<div class="tag__kopf"><span class="tag__name">Schwerpunkte</span></div>'
            + '<p class="tag__leer">Eine Gruppe auf Schwerpunkt setzen heißt: mehr '
            + 'Sätze pro Woche für diese Gruppe.</p>';

        Object.keys(p).forEach(function (gruppe) {
            const fokus = p[gruppe] === 'focus';
            html += '<div class="prio">'
                + '<span class="prio__name">' + esc(gruppenName(gruppe)) + '</span>'
                + '<span class="schalter">'
                + '<button type="button" class="schalter__teil' + (fokus ? '' : ' ist-an')
                + '" data-prio="' + esc(gruppe) + '" data-wert="normal">normal</button>'
                + '<button type="button" class="schalter__teil' + (fokus ? ' ist-an' : '')
                + '" data-prio="' + esc(gruppe) + '" data-wert="focus">Schwerpunkt</button>'
                + '</span></div>';
        });

        return html + '</section>';
    }

    /* ---------- Zeichnen ---------- */

    function zeichnen() {
        if (zustand.ansicht === 'plan') {
            app.innerHTML = zeichnePlan();
        } else if (zustand.ansicht === 'uebung') {
            app.innerHTML = zeichneUebung();
        } else if (zustand.ansicht === 'studio') {
            app.innerHTML = zeichneStudio();
        } else {
            app.innerHTML = zeichneStart();
        }
    }

    async function verlaufLaden(id) {
        zustand.verlauf = null;
        zustand.punktIndex = null;
        try {
            zustand.verlauf = await api('api/history.php?id=' + encodeURIComponent(id));
        } catch (err) {
            zustand.meldung = err.message;
        }
    }

    async function studioLaden(tag) {
        const pfad = 'api/plan.php' + (tag ? '?day=' + encodeURIComponent(tag) : '');
        zustand.studio = await api(pfad);
    }

    function uebungImStudio(id) {
        return (zustand.studio.exercises || []).find(function (u) { return u.id === id; });
    }

    /* ---------- Ereignisse ---------- */

    app.addEventListener('click', async function (e) {
        const ziel = e.target.closest('[data-gehe], [data-tag], [data-oeffne], [data-aendere], '
            + '[data-bestaetige], [data-korrigiere], [data-extra], [data-bearbeite], '
            + '[data-neu], [data-abbrechen], [data-frage], [data-loesche], [data-prio]');
        if (!ziel) {
            return;
        }
        const d = ziel.dataset;

        /* --- Navigation --- */

        if (d.gehe) {
            zustand.ansicht = d.gehe;
            zustand.uebungId = null;
            zustand.offen = null;
            zustand.meldung = '';
            if (d.gehe !== 'studio') {
                pauseBeenden();
            }
            if (d.gehe === 'start' || d.gehe === 'studio') {
                try {
                    await studioLaden(zustand.studio && zustand.studio.day.key);
                } catch (err) {
                    zustand.meldung = err.message;
                }
            }
            return zeichnen();
        }

        if (d.tag) {
            try {
                await studioLaden(d.tag);
            } catch (err) {
                zustand.meldung = err.message;
            }
            return zeichnen();
        }

        /* --- Studio --- */

        if (d.oeffne) {
            zustand.offen = zustand.offen === d.oeffne ? null : d.oeffne;
            delete zustand.entwurf[d.oeffne];
            return zeichnen();
        }

        if (d.aendere) {
            const teile = d.aendere.split(':');
            const u = uebungImStudio(teile[0]);
            if (!u) {
                return;
            }
            const e2 = zustand.entwurf[u.id] || vorbelegung(u);
            const richtung = parseInt(teile[2], 10);

            if (teile[1] === 'weight') {
                e2.weight = Math.max(0, Math.round(
                    (e2.weight + richtung * u.weight_step) * 100) / 100);
            } else {
                e2.reps = Math.max(1, e2.reps + richtung);
            }

            zustand.entwurf[u.id] = e2;
            return zeichnen();
        }

        if (d.korrigiere) {
            const teile = d.korrigiere.split(':');
            const u = uebungImStudio(teile[0]);
            const i = parseInt(teile[1], 10);
            if (u && u.today[i]) {
                zustand.entwurf[u.id] = {
                    weight: u.today[i].weight,
                    reps: u.today[i].reps,
                    index: i,
                };
            }
            return zeichnen();
        }

        if (d.extra) {
            const u = uebungImStudio(d.extra);
            if (u) {
                zustand.entwurf[u.id] = vorbelegung(u);
            }
            return zeichnen();
        }

        if (d.bestaetige) {
            const u = uebungImStudio(d.bestaetige);
            if (!u) {
                return;
            }
            const e2 = zustand.entwurf[u.id] || vorbelegung(u);
            const index = e2.index !== undefined ? e2.index : (u.today || []).length;

            ziel.disabled = true;
            ziel.textContent = 'Moment';

            try {
                const antwort = await api('api/session.php', {
                    daten: {
                        day: zustand.studio.day.key,
                        rotation_index: zustand.studio.rotation_index,
                        exercise_id: u.id,
                        set_index: index,
                        weight: e2.weight,
                        reps: e2.reps,
                    },
                });
                u.today = antwort.sets || [];
                delete zustand.entwurf[u.id];
                zustand.meldung = '';
                zeichnen();
                pauseStarten(zustand.studio.rest_timer_seconds);
            } catch (err) {
                zustand.meldung = err.message;
                zeichnen();
            }
            return;
        }

        /* --- Mein Plan --- */

        if (d.bearbeite) {
            zustand.ansicht = 'uebung';
            zustand.uebungId = d.bearbeite;
            zustand.loeschfrage = null;
            zustand.meldung = '';
            // Erst leeren, dann zeichnen. Sonst zeigt der erste Bildaufbau
            // den Verlauf der zuvor geöffneten Übung.
            zustand.verlauf = null;
            zustand.punktIndex = null;
            zeichnen();                 // Gerüst sofort, Kurve sobald geladen
            await verlaufLaden(d.bearbeite);
            return verlaufZeichnen();
        }

        if (d.neu) {
            zustand.ansicht = 'uebung';
            zustand.uebungId = null;
            zustand.neuTag = d.neu;
            zustand.verlauf = null;
            zustand.meldung = '';
            return zeichnen();
        }

        if (ziel.hasAttribute('data-abbrechen')) {
            zustand.ansicht = 'plan';
            zustand.loeschfrage = null;
            zustand.meldung = '';
            return zeichnen();
        }

        // Löschen in zwei Schritten statt über einen Browser-Dialog.
        if (d.frage) {
            zustand.loeschfrage = d.frage;
            return zeichnen();
        }

        if (d.loesche) {
            try {
                const antwort = await api(
                    'api/exercises.php?id=' + encodeURIComponent(d.loesche),
                    { method: 'DELETE' }
                );
                zustand.uebungen = antwort.exercises || {};
                zustand.ansicht = 'plan';
                zustand.uebungId = null;
                zustand.loeschfrage = null;
            } catch (err) {
                zustand.meldung = err.message;
            }
            return zeichnen();
        }

        if (d.prio) {
            zustand.plan.muscle_priorities[d.prio] = d.wert;
            zeichnen();
            try {
                await api('api/settings.php', {
                    daten: { muscle_priorities: zustand.plan.muscle_priorities },
                });
            } catch (err) {
                zustand.meldung = err.message;
                zeichnen();
            }
        }
    });

    app.addEventListener('submit', async function (e) {
        const form = e.target.closest('.editor');
        if (!form) {
            return;
        }
        e.preventDefault();

        const daten = {};
        new FormData(form).forEach(function (wert, schluessel) {
            daten[schluessel] = wert;
        });
        if (form.dataset.id) {
            daten.id = form.dataset.id;
        }

        const knopf = form.querySelector('button[type="submit"]');
        knopf.disabled = true;
        knopf.textContent = 'Moment';

        try {
            const antwort = await api('api/exercises.php', { daten: daten });
            zustand.uebungen = antwort.exercises || {};
            zustand.ansicht = 'plan';
            zustand.uebungId = null;
            zustand.meldung = '';
        } catch (err) {
            zustand.meldung = err.message;
        }
        zeichnen();
    });

    /*
     * Tippen im Diagramm wählt eine Einheit aus. Auf dem Handy gibt es kein
     * Hover, also übernimmt der Fingertipp die Rolle des Fadenkreuzes.
     * Gerechnet wird in viewBox-Koordinaten, weil das SVG mitskaliert.
     */
    app.addEventListener('pointerdown', function (e) {
        const svg = e.target.closest('.chart');
        if (!svg || !zustand.verlauf) {
            return;
        }

        const punkte = zustand.verlauf.points || [];
        if (punkte.length < 2) {
            return;
        }

        const kasten = svg.getBoundingClientRect();
        const x = (e.clientX - kasten.left) / kasten.width * CH.w;
        const g = chartGeometrie(punkte, svg.dataset.feld);

        let naechster = 0;
        let abstand = Infinity;
        punkte.forEach(function (p, i) {
            const d = Math.abs(g.x(i) - x);
            if (d < abstand) {
                abstand = d;
                naechster = i;
            }
        });

        zustand.punktIndex = naechster;
        verlaufZeichnen();
    });

    /* ---------- Start ---------- */

    (async function laden() {
        try {
            const [einstellungen, uebungen] = await Promise.all([
                api('api/settings.php'),
                api('api/exercises.php'),
            ]);
            zustand.plan = einstellungen.plan || {};
            zustand.uebungen = uebungen.exercises || {};

            if (Object.keys(zustand.uebungen).length > 0) {
                try {
                    await studioLaden(null);
                } catch (err) {
                    zustand.meldung = err.message;
                }
            }

            zeichnen();
        } catch (err) {
            app.innerHTML = '<p class="fehler">' + esc(err.message) + '</p>';
        }
    })();
})();
