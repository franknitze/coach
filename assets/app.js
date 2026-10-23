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
            const fehler = new Error('Keine Verbindung.');
            fehler.netz = true;   // unterscheidet "später nochmal" von "nie"
            throw fehler;
        }

        // Eine Antwort, die kein JSON ist, gilt als Netzfehler und damit als
        // wiederholbar. Sie sieht nur aus wie ein Serverfehler: im Studio
        // steckt dahinter eine abgeschnittene Antwort, eine HTML-Fehlerseite
        // des Hosters oder eine Zwischenseite des Mobilfunknetzes, und all
        // das geht beim naechsten Versuch durch. Am 07.09.2026 hat genau
        // dieser Fall einen Satz in den Papierkorb geschoben, obwohl PHP ihn
        // laengst geschrieben hatte. Wiederholen ist wegen set_index
        // gefahrlos: derselbe Satz ueberschreibt sich, statt sich zu
        // verdoppeln.
        let inhalt = {};
        try {
            inhalt = await antwort.json();
        } catch (e) {
            const fehler = new Error('Server antwortet nicht wie erwartet.');
            fehler.netz = true;
            throw fehler;
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
     * Wie ein Ergebnis heißt. An der Unterstützungsmaschine ist die Zahl
     * keine Last, sondern die Hilfe, und bei 0 ist sie gar keine Zahl mehr:
     * dort hängt man am eigenen Gewicht. "0 kg Hilfe" gäbe nichts an.
     * Gegenstück zu coach_last() in lib/coach.php.
     */
    function last(gewicht, hilfe) {
        if (!hilfe) {
            return zahl(gewicht) + ' kg';
        }
        return gewicht <= 0 ? 'ohne Hilfe' : zahl(gewicht) + ' kg Hilfe';
    }

    /*
     * In plan.json sind die Muskelgruppen umlautfreie Schlüssel, damit sie
     * sich als JSON-Schlüssel und in IDs sauber verhalten. Angezeigt wird
     * aber der lesbare Name: "ruecken" ist kein Wort.
     */
    const GRUPPEN = {
        brust: 'Brust', ruecken: 'Rücken', schulter: 'Schulter',
        quadrizeps: 'Quadrizeps', beinbeuger: 'Beinbeuger', waden: 'Waden',
        bizeps: 'Bizeps', trizeps: 'Trizeps', bauch: 'Bauch',
        beine: 'Beine',   // aus älteren Plänen
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

    /** Der Monat eines Datums als "2026-08". */
    function monatVon(d) {
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    }

    /** $schritte Monate weiter oder zurück, als "2026-08". */
    function monatVerschieben(monat, schritte) {
        const teile = monat.split('-');
        return monatVon(new Date(Number(teile[0]), Number(teile[1]) - 1 + schritte, 1));
    }

    /** Beginn einer Einheit: der Zeitpunkt ihres ersten Satzes, "07:05". */
    function uhrzeit(iso) {
        const d = new Date(iso);
        if (isNaN(d)) {
            return '';
        }
        return String(d.getHours()).padStart(2, '0') + ':'
             + String(d.getMinutes()).padStart(2, '0');
    }

    /** Kurzform für die Kachel, damit die Zeile nicht umbricht: "11.8." */
    function datumKurz(iso) {
        const d = new Date(iso);
        return isNaN(d) ? '' : d.getDate() + '.' + (d.getMonth() + 1) + '.';
    }

    /* ---------- Anmeldung ---------- */

    /* ---------- Einmalige Einrichtung ---------- */

    const einrichtung = document.getElementById('einrichtung');

    if (einrichtung) {
        const knopf  = document.getElementById('einrichten');
        const fehler = document.getElementById('fehler');

        einrichtung.addEventListener('submit', async function (e) {
            e.preventDefault();
            fehler.textContent = '';
            knopf.disabled = true;
            knopf.textContent = 'Moment';

            const daten = {};
            new FormData(einrichtung).forEach(function (wert, schluessel) {
                daten[schluessel] = wert;
            });

            try {
                await api('api/setup.php', { daten: daten });
                location.reload();   // ab jetzt zeigt die Seite die Anmeldung
            } catch (err) {
                fehler.textContent = err.message;
                knopf.disabled = false;
                knopf.textContent = 'Passwort festlegen';
            }
        });
    }

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

    /*
     * Abmelden in zwei Schritten, wie das Löschen eines Fotos.
     *
     * Der Knopf steht im Menü oben rechts, dicht unter Kalender und
     * Einstellungen. Die Frage kostet einen Tipp und verhindert
     * den Fehlgriff, der im Studio teuer wäre: Anmelden braucht das Netz,
     * das dort oft fehlt, und bis dahin lägen die gepufferten Sätze fest.
     * Jede andere Berührung nimmt die Frage zurück.
     */
    const abmelden = document.getElementById('abmelden');
    if (abmelden) {
        let gefragt = false;

        const zuruecknehmen = function () {
            if (!gefragt) {
                return;
            }
            gefragt = false;
            abmelden.textContent = 'Abmelden';
            abmelden.classList.remove('ist-scharf');
        };

        abmelden.addEventListener('click', async function () {
            if (!gefragt) {
                gefragt = true;
                abmelden.textContent = 'Wirklich abmelden?';
                abmelden.classList.add('ist-scharf');
                return;
            }
            await api('api/logout.php', { method: 'POST' });
            location.reload();
        });

        document.addEventListener('click', function (e) {
            if (!e.target.closest('#abmelden')) {
                zuruecknehmen();
            }
        }, true);
    }

    /* ---------- Menü oben rechts ----------
     *
     * Kalender, Einstellungen, abgesetzt Abmelden (Frank, 23.10.2026). Die
     * Einträge blenden sich aus, wenn sie ins Leere führten: Kalender erst
     * mit der ersten Einheit, Einstellungen nur mit geladenem Plan, denn der
     * Verwaltungsbereich braucht das Netz. Ein Tipp daneben schließt.
     */
    const menueKnopf = document.getElementById('menue-knopf');
    const menue = document.getElementById('menue');

    function menueOeffnen() {
        const kalender = menue.querySelector('[data-menue="kalender"]');
        const plan = menue.querySelector('[data-menue="plan"]');
        kalender.hidden = !(zustand.einheiten && (zustand.einheiten.sessions || []).length > 0);
        plan.hidden = !zustand.plan;
        menue.querySelector('[data-menue="ausgeblendet"]').hidden = !(zustand.plan
            && Object.values(zustand.uebungen || {}).some(function (u) { return u.hidden; }));
        menue.hidden = false;
        menueKnopf.setAttribute('aria-expanded', 'true');
    }

    function menueSchliessen() {
        if (menue && !menue.hidden) {
            menue.hidden = true;
            menueKnopf.setAttribute('aria-expanded', 'false');
        }
    }

    if (menueKnopf && menue) {
        menueKnopf.addEventListener('click', function () {
            if (menue.hidden) {
                menueOeffnen();
            } else {
                menueSchliessen();
            }
        });
        menue.addEventListener('click', function (e) {
            const eintrag = e.target.closest('[data-menue]');
            if (eintrag) {
                menueSchliessen();
                window.scrollTo(0, 0);
                gehe(eintrag.dataset.menue, false);
            }
        });
        document.addEventListener('click', function (e) {
            if (!e.target.closest('#menue, #menue-knopf')) {
                menueSchliessen();
            }
        });
        addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                menueSchliessen();
            }
        });
    }

    const zustand = {
        plan: null,
        uebungen: {},
        studio: null,          // Antwort von api/plan.php
        tagWahl: null,         // festgehaltener Trainingstag, null = Vorschlag folgen
        ansicht: 'start',
        offen: null,           // aufgeklappte Übung im Studio
        entwurf: {},           // laufende Eingabe je Übung
        uebungId: null,        // Übung in der Detailansicht, null = neue
        neuTag: null,          // Trainingstag einer neu angelegten Übung
        fotos: null,           // Dateinamen aus api/fotos.php
        bildLoeschfrage: null, // Foto, das gerade zum Löschen angefragt ist
        gewicht: null,         // Antwort von api/gewicht.php, Körpergewicht mit Datum
        einheiten: null,       // Antwort von api/einheiten.php, der Rückblick
        kalender: null,        // Antwort von api/einheiten.php?monat=…
        einheitKey: null,      // aufgeschlagene Einheit im Rückblick
        einheitHer: 'start',   // wohin "Zurück" aus einer Einheit führt
        uebungHer: 'plan',     // wohin "Zurück" aus dem Übungsverlauf führt
        verlauf: null,         // Antwort von api/history.php
        punktIndex: null,      // gewählte Einheit im Diagramm, null = letzte
        ausPuffer: false,      // Studio-Ansicht kommt aus dem lokalen Stand
        planBereich: 'uebungen',  // gewählter Bereich der Einstellungen
        passwortText: '',      // Rückmeldung des Passwortformulars
        passwortOk: false,     // true = Bestätigung, false = Fehler
        meldung: '',
    };

    /* ---------- Puffer für schlechten Empfang ----------
     *
     * Im Studio ist der Empfang schlecht. Deshalb geht jeder bestätigte
     * Satz IMMER zuerst in einen lokalen Puffer und erst danach ans
     * Netz, auch wenn gerade Verbindung besteht. Ein zweiter Weg nur für
     * den Offline-Fall wäre ein Weg, der selten läuft und deshalb nie
     * auffällt, wenn er kaputt ist.
     *
     * Dass das gefahrlos geht, liegt an set_index: derselbe Satz zweimal
     * geschickt überschreibt sich, statt sich zu verdoppeln. Und jeder
     * Eintrag trägt performed_at, damit ein am Dienstagabend gepufferter
     * Satz nicht in der Mittwochs-Session landet.
     *
     * localStorage statt IndexedDB: es geht um wenige Kilobyte, und die
     * synchrone Schnittstelle spart eine ganze Klasse von Wettläufen.
     * Zu bedenken: iOS räumt den Speicher einer PWA nach sieben Tagen
     * ohne Benutzung ab. Bei drei Einheiten pro Woche ist das kein
     * Thema, und der Puffer soll ohnehin binnen Stunden leer sein.
     */

    const SCHLUESSEL = {
        warteschlange: 'coach.warteschlange',
        gescheitert:   'coach.gescheitert',
        plan:          'coach.plan.',
        zuletzt:       'coach.plan.zuletzt',
    };

    function gelesen(schluessel, ersatz) {
        try {
            const roh = localStorage.getItem(schluessel);
            return roh === null ? ersatz : JSON.parse(roh);
        } catch (e) {
            return ersatz;   // privater Modus oder kaputter Eintrag
        }
    }

    function geschrieben(schluessel, wert) {
        try {
            localStorage.setItem(schluessel, JSON.stringify(wert));
            return true;
        } catch (e) {
            return false;    // Speicher voll oder gesperrt
        }
    }

    const warteschlange = {
        holen() { return gelesen(SCHLUESSEL.warteschlange, []); },
        setzen(liste) { return geschrieben(SCHLUESSEL.warteschlange, liste); },
        anhaengen(eintrag) {
            const liste = this.holen();
            liste.push(eintrag);
            return this.setzen(liste);
        },
    };

    const gescheitert = {
        holen() { return gelesen(SCHLUESSEL.gescheitert, []); },
        anhaengen(eintrag, grund) {
            const liste = this.holen();
            liste.push({ eintrag: eintrag, grund: grund });
            geschrieben(SCHLUESSEL.gescheitert, liste);
        },
        leeren() { geschrieben(SCHLUESSEL.gescheitert, []); },
    };

    /** Merkt sich die Studio-Ansicht, damit sie ohne Netz da ist. */
    function planMerken() {
        if (!zustand.studio) {
            return;
        }
        const tag = zustand.studio.day.key;
        geschrieben(SCHLUESSEL.plan + tag, zustand.studio);
        geschrieben(SCHLUESSEL.zuletzt, tag);
    }

    function planErinnern(tag) {
        const schluessel = tag || gelesen(SCHLUESSEL.zuletzt, null);
        return schluessel ? gelesen(SCHLUESSEL.plan + schluessel, null) : null;
    }

    /* ---------- Statusleiste ----------
     *
     * Frank muss jederzeit sehen können, ob seine Sätze sicher sind.
     * Ein stiller Puffer wäre schlimmer als gar keiner: man verließe
     * sich darauf, ohne zu wissen, ob er noch voll ist.
     */

    const statusBox = document.getElementById('status');
    let sendetGerade = false;

    /*
     * Wie lange eine Ablehnung stehen bleibt, bevor sie von selbst geht.
     *
     * Sie blieb bis zum 09.09.2026 fuer immer stehen: gescheitert.leeren()
     * gab es, aber keine Zeile rief es auf. Auf Franks Handy hing die
     * Meldung dadurch zwei Tage lang, ohne dass ein Neuladen half.
     *
     * Ein Knopf zum Wegwischen waere die falsche Abhilfe, denn er verlangte
     * einen Handgriff fuer etwas, das der Benutzer ohnehin nicht aendern
     * kann: Der Satz ist entweder auf der Platte oder verloren, und beides
     * entscheidet sich ohne sein Zutun (Vorgabe von Frank, 09.09.2026).
     * Also kurz zeigen, was passiert ist, und dann verschwinden.
     */
    const KAPUTT_SEKUNDEN = 8;
    let kaputtTimer = null;

    /**
     * "Beinpresse 130 kg x 7" - damit die Meldung den Satz benennt.
     *
     * Der Name kommt zuerst aus dem geladenen Trainingstag und erst danach
     * aus der Uebungsbibliothek. Der Grund ist genau der Fall, um den es
     * hier geht: Wer im Funkloch geladen hat, bei dem ist die Bibliothek
     * leer geblieben, weil api/exercises.php nicht geantwortet hat. Der
     * gemerkte Studio-Plan traegt die Namen dagegen mit. Ohne diese
     * Reihenfolge staende in der Meldung die Kennung ("bankdruecken").
     */
    function satzNennen(eintrag) {
        if (!eintrag) {
            return 'Ein Satz';
        }
        const imTag = (zustand.studio && (zustand.studio.exercises || [])
            .find(function (u) { return u.id === eintrag.exercise_id; })) || null;
        const inBibliothek = zustand.uebungen
            ? zustand.uebungen[eintrag.exercise_id] : null;
        const name = (imTag && imTag.name) || (inBibliothek && inBibliothek.name)
            || eintrag.exercise_id || 'Ein Satz';
        return name + ' ' + zahl(eintrag.weight) + ' kg × ' + eintrag.reps;
    }

    function statusZeichnen() {
        if (!statusBox) {
            return;
        }

        const offen = warteschlange.holen().length;
        const kaputt = gescheitert.holen();
        const ohneNetz = !navigator.onLine;

        let text = '';
        let art = '';

        if (kaputt.length) {
            art = 'ist-kaputt';
            text = kaputt.length === 1
                ? satzNennen(kaputt[0].eintrag) + ' ließ sich nicht sichern.'
                : kaputt.length + ' Sätze ließen sich nicht sichern.';

            if (kaputtTimer === null) {
                kaputtTimer = setTimeout(function () {
                    kaputtTimer = null;
                    gescheitert.leeren();
                    statusZeichnen();
                }, KAPUTT_SEKUNDEN * 1000);
            }
        } else if (ohneNetz && offen) {
            art = 'ist-offline';
            text = 'Ohne Netz · ' + offen + (offen === 1 ? ' Satz' : ' Sätze')
                 + ' liegen hier, bis wieder Empfang da ist';
        } else if (ohneNetz) {
            art = 'ist-offline';
            text = 'Ohne Netz · gespeichert wird trotzdem';
        } else if (offen) {
            art = '';
            text = offen + (offen === 1 ? ' Satz wird' : ' Sätze werden') + ' gesichert';
        }

        statusBox.hidden = text === '';
        statusBox.className = 'status ' + art;
        statusBox.textContent = text;
    }

    /**
     * Arbeitet den Puffer ab, einen Eintrag nach dem anderen.
     *
     * Bricht bei einem Netzfehler ab und behält den Rest: beim nächsten
     * Versuch geht es an derselben Stelle weiter, und die Reihenfolge
     * bleibt erhalten. Eine Ablehnung des Servers (4xx) wird dagegen nie
     * gutgehen, der Eintrag wandert dann sichtbar zur Seite statt
     * endlos wiederholt zu werden.
     */
    async function puffernSenden() {
        if (sendetGerade || !navigator.onLine) {
            statusZeichnen();
            return;
        }

        sendetGerade = true;
        statusZeichnen();

        try {
            let liste = warteschlange.holen();

            while (liste.length) {
                const eintrag = liste[0];
                try {
                    await api('api/session.php', { daten: eintrag });
                } catch (err) {
                    if (err.netz) {
                        break;                     // später an derselben Stelle weiter
                    }
                    gescheitert.anhaengen(eintrag, err.message);
                }
                liste = liste.slice(1);
                warteschlange.setzen(liste);
                statusZeichnen();
            }
        } finally {
            sendetGerade = false;
            statusZeichnen();
        }
    }

    addEventListener('online', puffernSenden);
    addEventListener('offline', statusZeichnen);

    /* ---------- Gerätefoto groß ----------
     *
     * Im Studio sucht man mit dem Bild die Maschine. Ein Vorschaubild von
     * 76 Pixeln taugt dafür nicht. Ein Tipp zeigt es formatfüllend, der
     * nächste schließt wieder, dazu die Gerätenummer groß daneben.
     */

    const lupe       = document.getElementById('lupe');
    const lupeBild   = document.getElementById('lupe-bild');
    const lupeName   = document.getElementById('lupe-name');
    const lupeNummer = document.getElementById('lupe-nummer');
    const lupeAnleitung = document.getElementById('lupe-anleitung');

    /**
     * Die Großansicht: Foto, Gerätenummer, Name — und die Ausführung.
     *
     * Die Ausführung war bis zum 26.08.2026 ein Aufklapper auf der Kachel.
     * Sie steht jetzt hier, weil beides dieselbe Frage beantwortet: "Was ist
     * das für ein Gerät und wie geht die Übung daran?" Auf der Kachel kostete
     * sie außerdem Platz an der Stelle, an der man eintippt.
     *
     * Ohne Foto wird das Bild ausgeblendet statt eine leere Fläche zu zeigen —
     * die Anleitung soll auch dann erreichbar sein.
     */
    function lupeZeigen(datei, name, nummer, uebungId) {
        if (!lupe) {
            return;
        }
        lupeBild.hidden = !datei;
        lupeBild.src = datei ? 'assets/img/exercises/' + datei : '';
        lupeBild.alt = name;
        lupeName.textContent = name;
        lupeNummer.textContent = nummer;
        lupeNummer.hidden = !nummer;

        const u = uebungImStudio(uebungId);
        lupeAnleitung.innerHTML = u ? zeichneAusfuehrung(u) : '';

        lupe.hidden = false;
    }

    /** Die Übung aus der geladenen Studio-Ansicht, oder null. */
    function uebungImStudio(id) {
        if (!id || !zustand.studio) {
            return null;
        }
        return (zustand.studio.exercises || []).find(function (u) {
            return u.id === id;
        }) || null;
    }

    /*
     * Symbole aus Phosphor Icons (MIT), Stärke "bold", als Pfad direkt im
     * Code: Die PWA soll offline laufen und nichts nachladen.
     */
    const SYMBOLE = {
        verlauf: 'M140,80v41.21l34.17,20.5a12,12,0,1,1-12.34,20.58l-40-24A12,12,0,0,1,116,128V80a12,12,0,0,1,24,0ZM128,28A99.38,99.38,0,0,0,57.24,57.34c-4.69,4.74-9,9.37-13.24,14V64a12,12,0,0,0-24,0v40a12,12,0,0,0,12,12H72a12,12,0,0,0,0-24H57.77C63,86,68.37,80.22,74.26,74.26a76,76,0,1,1,1.58,109,12,12,0,0,0-16.48,17.46A100,100,0,1,0,128,28Z',
        ja:      'M232.49,80.49l-128,128a12,12,0,0,1-17,0l-56-56a12,12,0,1,1,17-17L96,183,215.51,63.51a12,12,0,0,1,17,17Z',
        nein:    'M208.49,191.51a12,12,0,0,1-17,17L128,145,64.49,208.49a12,12,0,0,1-17-17L111,128,47.51,64.49a12,12,0,0,1,17-17L128,111l63.51-63.52a12,12,0,0,1,17,17L145,128Z',
    };

    function symbol(pfad) {
        return '<svg class="sym" viewBox="0 0 256 256" aria-hidden="true"><path d="' + pfad + '"/></svg>';
    }

    /* ---------- Verlauf einer Übung ----------
     *
     * Eine Zeile je Einheit, neueste oben: "Fr 16.10.2026 · 65 kg · 12/12/12
     * · Haken" (Vorgabe von Frank, 23.10.2026). Eine Zeile je Satz nahm zu
     * viel Platz weg. Weichen die Gewichte innerhalb der Einheit ab, stehen
     * sie mit Schrägstrich in derselben Reihenfolge wie die Wiederholungen.
     *
     * Die Zahlen kommen fertig aus api/plan.php (coach_verlauf()), auch das
     * Erreicht. Hier wird nur gesetzt, nichts gerechnet.
     *
     * Der Knopf zum Schließen steht fest unten, die Tabelle läuft dahinter
     * durch (Frank, 23.10.2026): Bei einer langen Liste soll man nicht erst
     * bis ans Ende wischen müssen, um wieder an die Regler zu kommen.
     */
    const blatt = document.getElementById('blatt');

    function datumVoll(iso) {
        const d = new Date(iso);
        const zwei = function (n) { return (n < 10 ? '0' : '') + n; };
        return WOCHENTAGE[d.getDay()] + ' ' + zwei(d.getDate()) + '.' + zwei(d.getMonth() + 1) + '.' + d.getFullYear();
    }

    function verlaufGewicht(saetze, hilfe) {
        const gewichte = saetze.map(function (s) { return s.weight; });
        const gleich = gewichte.every(function (g) { return g === gewichte[0]; });
        if (gleich) {
            return last(gewichte[0], hilfe);
        }
        return gewichte.map(zahl).join('/') + (hilfe ? ' kg Hilfe' : ' kg');
    }

    function verlaufZeigen(uebungId) {
        const u = uebungImStudio(uebungId);
        if (!blatt || !u) {
            return;
        }
        document.getElementById('blatt-nummer').textContent = u.station || '';
        document.getElementById('blatt-nummer').hidden = !u.station;
        document.getElementById('blatt-name').textContent = u.name;
        document.getElementById('blatt-zeilen').innerHTML = (u.history || []).map(function (e) {
            return '<tr><td>' + esc(datumVoll(e.date)) + '</td>'
                + '<td>' + esc(verlaufGewicht(e.sets, u.assisted)) + '</td>'
                + '<td>' + e.sets.map(function (s) { return s.reps; }).join('/') + '</td>'
                + '<td class="' + (e.achieved ? 'ist-erreicht' : 'ist-verfehlt') + '">'
                + symbol(e.achieved ? SYMBOLE.ja : SYMBOLE.nein)
                + '<span class="unsichtbar">' + (e.achieved ? 'erreicht' : 'nicht erreicht') + '</span></td></tr>';
        }).join('');
        blatt.hidden = false;
        document.getElementById('blatt-liste').scrollTop = 0;
    }

    function verlaufSchliessen() {
        if (blatt && !blatt.hidden) {
            blatt.hidden = true;
        }
    }

    if (blatt) {
        // Ein Tipp neben das Blatt schließt es ebenso wie der Knopf.
        blatt.addEventListener('click', function (e) {
            if (e.target === blatt || e.target.closest('#blatt-zu')) {
                verlaufSchliessen();
            }
        });
        addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                verlaufSchliessen();
            }
        });
    }

    function lupeSchliessen() {
        if (lupe && !lupe.hidden) {
            lupe.hidden = true;
            lupeBild.src = '';        // Speicher freigeben
            lupeAnleitung.innerHTML = '';
        }
    }

    /*
     * Lädt ein Foto nicht, tritt die Geräteplakette an seine Stelle.
     *
     * Im Funkloch ist genau das der Normalfall, solange das Bild noch nicht
     * im Cache liegt. Ein kaputtes Bildsymbol auf jeder Kachel sähe nach
     * Fehler aus; die Nummer ist ohnehin das, womit man das Gerät findet.
     *
     * Fehler von Bildern steigen nicht auf, deshalb in der Capture-Phase.
     */
    document.addEventListener('error', function (e) {
        const bild = e.target;
        if (!bild.classList || !bild.classList.contains('kachel__bild')) {
            return;
        }
        const knopf = bild.closest('.kachel__foto');
        if (knopf) {
            knopf.outerHTML = '<span class="kachel__platzhalter">'
                + esc(knopf.dataset.nummer || '?') + '</span>';
        }
    }, true);

    if (lupe) {
        // Egal wohin man tippt, es geht zu. Genau das erwartet man.
        lupe.addEventListener('click', lupeSchliessen);
        addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                lupeSchliessen();
            }
        });
    }

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

        const beschriftung = document.querySelector('.pause__mini');
        if (beschriftung) {
            beschriftung.textContent = 'Pause';
        }

        const ende = Date.now() + sekunden * 1000;
        pauseBox.hidden = false;
        document.body.classList.add('hat-pause');

        function tick() {
            const rest = Math.max(0, Math.round((ende - Date.now()) / 1000));
            pauseZeit.textContent = Math.floor(rest / 60) + ':'
                + String(rest % 60).padStart(2, '0');

            /*
             * Bei null verschwindet das Panel einfach, ohne einen zweiten
             * Zustand mit "Weiter". Dass die Pause vorbei ist, sieht man
             * daran, dass sie weg ist — eine Bestätigung dafür wäre eine
             * Meldung ohne Auskunft und ein zusätzlicher Tipp, bevor man
             * wieder an den Reglern ist. Das Rütteln bleibt: es erreicht
             * einen auch dann, wenn man nicht aufs Handy schaut.
             */
            if (rest === 0) {
                try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) {}
                pauseBeenden();
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
            + zusatz + '</p>';

        if (anzahl === 0) {
            html += '<p class="tag__leer">Für diesen Tag ist noch keine Übung '
                 + 'eingetragen. Wähle einen anderen Tag oder ergänze den Plan.</p>';
        }

        /*
         * Die Tagesknöpfe gehören zu "Heute" und stehen deshalb im selben
         * Abschnitt. Sie sind keine eigene Rubrik, sondern die Alternativen
         * zu dem Tag, der darüber steht; eine Überschrift "Anderer Tag"
         * machte daraus einen dritten Block und zerschnitt den Zusammenhang.
         */
        html += '<div class="tagwahl__reihe">';
        Object.keys(s.days).forEach(function (t) {
            html += '<button class="tagknopf' + (t === s.day.key ? ' ist-an' : '')
                 + '" data-tag="' + esc(t) + '">' + esc(s.days[t].label) + '</button>';
        });
        html += '</div></section>';

        html += zeichneRueckblick();

        // Kalender und Einstellungen stehen seit dem 23.10.2026 im Menü oben
        // rechts (menueOeffnen()), nicht mehr als Verweise unter dem Rückblick.

        /*
         * Der Knopf unten verschwindet, wenn er nicht mehr sagen könnte,
         * welche Einheit er fortsetzt.
         *
         * Er geht immer in den Tag, der oben steht. Solange es höchstens
         * eine offene Einheit gibt, ist das eindeutig. Bei zweien war es das
         * nicht mehr: In der Liste standen zwei unvollständige Einheiten,
         * und der Knopf bediente wortlos eine davon.
         *
         * Ein FRISCHER Tag bleibt trotzdem startbar. Sonst könnte man bei
         * zwei halben Einheiten gar nichts Neues mehr anfangen, und die
         * Tagesknöpfe darüber führten ins Leere.
         */
        const offeneGesamt = (s.offene_einheiten || 0);
        const dieserOffen  = heuteSaetze > 0;
        const mehrdeutig   = dieserOffen && offeneGesamt > 1;

        if (anzahl > 0 && !mehrdeutig) {
            html += '<div class="fussleiste"><button class="knopf" data-gehe="studio">'
                 + (heuteSaetze > 0 ? 'Weiter trainieren' : 'Los geht\'s')
                 + '</button></div>';
        }

        return html + '</div>';
    }

    /**
     * Der Rückblick auf der Startseite: die letzten Einheiten als Liste.
     *
     * Zwei Zeilen je Eintrag statt einer. "Mi, 19. Aug · Oberkörper ·
     * 9 Übungen · 30 Sätze" bricht auf 390 Punkten ohnehin um, dann lieber
     * kontrolliert: oben, wann und was, darunter der Umfang.
     */
    function zeichneRueckblick() {
        const r = zustand.einheiten;
        if (!r || !r.sessions || r.sessions.length === 0) {
            return '';
        }

        let html = zeichneFortschritt()
                 + '<section class="abschnitt rueckblick">'
                 + '<div class="tag__kopf">'
                 + '<span class="tag__name">Letzte Einheiten</span>'
                 // Wie viele es insgesamt sind, steht seit dem 23.10.2026 in
                 // der Blätterzeile unter der Liste, nicht mehr hier.
                 + '</div>';

        /*
         * Eine offene Einheit führt ins Studio, jede andere in die
         * Leseansicht. Vorher führten beide in die Leseansicht — und die
         * zeigt nur, was schon gemacht ist. Wer eine Einheit pausiert hatte
         * und weitermachen wollte, sah dort genau die Übungen nicht, die
         * noch fehlten.
         *
         * "Offen" heißt: von heute und nicht durch. Ein halber Trainingstag
         * von vor drei Wochen bleibt unvollständig, ist aber Geschichte.
         */
        r.sessions.forEach(function (e) {
            html += e.offen
                 ? '<button class="einheit einheit--offen" data-weiter="'
                   + esc(e.day) + '">'
                 : '<button class="einheit" data-einheit="' + esc(e.key) + '">';

            html += '<span class="einheit__wann">' + esc(datum(e.date)) + ' · '
                 + esc(e.label)
                 + (e.offen
                     ? ' · <span class="einheit__marke">offen</span>'
                     : (e.vollstaendig ? ''
                        : ' · <span class="einheit__offen">unvollständig</span>'))
                 + '</span>'
                 + '<span class="einheit__umfang">' + e.exercises.length
                 + (e.exercises.length === 1 ? ' Übung · ' : ' Übungen · ')
                 + (e.vollstaendig || !e.set_target
                     ? e.set_count + (e.set_count === 1 ? ' Satz' : ' Sätze')
                     : e.set_count + ' von ' + e.set_target + ' Sätzen')
                 + '</span>'
                 + (e.offen ? '<span class="einheit__weiter">Weiter</span>' : '')
                 + '</button>';
        });

        /*
         * Blättern, sobald es mehr Einheiten gibt als auf eine Seite passen
         * (Frank, 23.10.2026). Dieselbe Zeile wie im Kalender, aber die
         * Richtung folgt der Liste, nicht der Zeitachse: Die neuesten stehen
         * oben und auf der ersten Seite, also führt RECHTS weiter zu älteren
         * Einheiten und links zurück zu neueren. Andersherum, wie im
         * Kalender, hat Frank es als verkehrt empfunden. Am jeweiligen Ende
         * ist der Knopf gesperrt.
         */
        const versatz = r.offset || 0;
        if (r.total > r.sessions.length || versatz > 0) {
            const bis = versatz + r.sessions.length;
            html += '<div class="kal__steuer rueckblick__steuer">'
                 + '<button class="kopfknopf" data-seite="neuer"'
                 + (versatz === 0 ? ' disabled' : '') + ' aria-label="Neuere Einheiten">←</button>'
                 + '<span class="kal__zahl">' + (versatz + 1) + '–' + bis + ' von ' + r.total + '</span>'
                 + '<button class="kopfknopf" data-seite="aelter"'
                 + (bis >= r.total ? ' disabled' : '') + ' aria-label="Ältere Einheiten">→</button>'
                 + '</div>';
        }

        return html + '</section>';
    }

    /**
     * Die Fortschrittskurve über alle Einheiten.
     *
     * Ein Index, keine Summe: je Übung das Verhältnis zur eigenen ersten
     * Einheit, gemittelt über die Übungen des Tages. Deshalb liegen Tage
     * mit fünf und mit zwanzig Übungen auf derselben Skala und die Kurve
     * springt nicht zwischen den Tagesarten. Gerechnet wird auf dem
     * Server, hier wird nur gezeichnet.
     */
    function zeichneFortschritt() {
        const punkte = (zustand.einheiten && zustand.einheiten.fortschritt) || [];
        if (punkte.length === 0) {
            return '';
        }

        const jetzt = punkte[punkte.length - 1];

        // Aus einem Punkt keine Linie machen: sie behauptete einen Verlauf,
        // den es nicht gibt. Dieselbe Regel wie beim Übungsverlauf.
        if (punkte.length === 1) {
            return '<section class="abschnitt">'
                 + '<div class="tag__kopf"><span class="tag__name">Fortschritt</span></div>'
                 + '<p class="fortschritt__stand"><b>' + esc(zahl(jetzt.wert))
                 + '</b> Punkte</p>'
                 + '<p class="hinweis">Der Startwert. Ab der zweiten Einheit '
                 + 'entsteht hier eine Kurve.</p>'
                 + '</section>';
        }

        const erste = punkte[0];
        const diff = Math.round((jetzt.wert - erste.wert) * 10) / 10;

        return '<section class="abschnitt">'
             + '<div class="tag__kopf"><span class="tag__name">Fortschritt</span>'
             + '<span class="tag__zahl">seit dem Start '
             + (diff >= 0 ? '+' : '−') + esc(zahl(Math.abs(diff))) + '</span></div>'
             + '<p class="fortschritt__stand"><b>' + esc(zahl(jetzt.wert))
             + '</b> Punkte</p>'
             + chart(punkte, 'wert', 'Fortschritt', punkte.length - 1)
             + '</section>';
    }

    /**
     * Der Kalender: ein Monatsraster mit den Trainingstagen.
     *
     * Er beantwortet eine andere Frage als der Rückblick. Die Liste sagt
     * "was habe ich gemacht", das Raster sagt "wie regelmäßig war ich" —
     * und dafür ist die Lücke genauso wichtig wie der Eintrag. Deshalb ein
     * Raster mit allen Tagen und nicht nur den trainierten.
     *
     * Woche beginnt am Montag, nicht am Sonntag: Der Trainingsplan denkt in
     * Mo/Mi/Fr, und mit dem Sonntag vorn läge das Wochenende auseinander.
     */
    function zeichneKalender() {
        const k = zustand.kalender;
        if (!k) {
            return '<p class="tag__leer">Wird geladen.</p>';
        }

        const teile  = k.monat.split('-');
        const jahr   = Number(teile[0]);
        const monat  = Number(teile[1]);
        const erster = new Date(jahr, monat - 1, 1);
        const tage   = new Date(jahr, monat, 0).getDate();

        // getDay() zählt ab Sonntag, das Raster ab Montag.
        const versatz = (erster.getDay() + 6) % 7;

        const proTag = {};
        (k.sessions || []).forEach(function (e) {
            proTag[e.date.slice(0, 10)] = e;
        });

        const heute = new Date().toISOString().slice(0, 10);

        /*
         * Blättern nur dort, wo es etwas zu sehen gibt: vom ältesten Monat
         * mit Daten bis zum laufenden. Ein Knopf, der ins Leere führt, ist
         * schlimmer als keiner, weil man ihn im Studio zweimal drückt.
         */
        const monate = (k.monate || []).slice().sort();
        const aeltester = monate.length ? monate[0] : k.monat;
        const juengster = monatVon(new Date());
        const zurueck = k.monat > aeltester ? monatVerschieben(k.monat, -1) : '';
        const vor     = k.monat < juengster ? monatVerschieben(k.monat, 1) : '';

        let html = '<div class="titelzeile">'
            + '<h1 class="titel">' + esc(MONATE[monat - 1]) + ' ' + jahr + '</h1>'
            + '<button class="kopfknopf" data-gehe="start">Zurück</button>'
            + '</div>'
            + '<div class="kal__steuer">'
            + '<button class="kopfknopf" data-monat="' + esc(zurueck) + '"'
            + (zurueck ? '' : ' disabled') + ' aria-label="Monat zurück">←</button>'
            + '<span class="kal__zahl">' + (k.sessions || []).length
            + ((k.sessions || []).length === 1 ? ' Einheit' : ' Einheiten') + '</span>'
            + '<button class="kopfknopf" data-monat="' + esc(vor) + '"'
            + (vor ? '' : ' disabled') + ' aria-label="Monat vor">→</button>'
            + '</div>'
            + '<div class="kal">';

        ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].forEach(function (w) {
            html += '<span class="kal__kopf">' + w + '</span>';
        });

        for (let i = 0; i < versatz; i++) {
            html += '<span class="kal__leer"></span>';
        }

        for (let t = 1; t <= tage; t++) {
            const iso = jahr + '-' + String(monat).padStart(2, '0') + '-'
                      + String(t).padStart(2, '0');
            const e = proTag[iso];
            const istHeute = iso === heute ? ' ist-heute' : '';

            if (!e) {
                html += '<span class="kal__tag' + istHeute + '">' + t + '</span>';
                continue;
            }

            // Zwei Buchstaben statt einem: "O" und "U" sind auf Armlänge
            // schwer zu unterscheiden, "Ob" und "Un" nicht.
            html += '<button class="kal__tag ist-training' + istHeute
                 + '" data-einheit="' + esc(e.key) + '">'
                 + t + '<span class="kal__art">' + esc(e.label.slice(0, 2)) + '</span>'
                 + '</button>';
        }

        html += '</div>';

        if ((k.sessions || []).length === 0) {
            html += '<p class="tag__leer">In diesem Monat kein Training.</p>';
        }

        return html;
    }

    /**
     * Eine abgeschlossene Einheit, in derselben Darstellung wie das Studio.
     *
     * Dieselben Kacheln mit Foto und Geräteplakette: Beim Zurückblicken ist
     * "welches Gerät war das" dieselbe Frage wie im Studio, und eine zweite
     * Darstellung für denselben Gegenstand wäre eine zweite Bildsprache.
     *
     * Unterschiede zum Studio: die Punkte zeigen DIESE Einheit statt heute,
     * statt "zuletzt ..." stehen die Sätze dieser Einheit, und es gibt keine
     * Coach-Ansage. Die sagt, was als Nächstes fällig wäre — an einer
     * abgeschlossenen Einheit ist das eine Aussage über die Zukunft am
     * falschen Ort.
     */
    function zeichneEinheit() {
        const e = einheitFinden(zustand.einheitKey);

        if (!e) {
            return '<p class="tag__leer">Diese Einheit ist gerade nicht geladen.</p>'
                 + '<div class="werkzeuge"><button class="knopf knopf--leise" '
                 + 'data-gehe="start">Zur Übersicht</button></div>';
        }

        const saetze = e.exercises.reduce(function (n, u) { return n + u.sets.length; }, 0);

        let html = '<div class="titelzeile">'
            + '<div><span class="mini">' + esc(datum(e.date)) + ' · '
            + esc(uhrzeit(e.date)) + '</span>'
            + '<h1 class="titel">' + esc(e.label) + '</h1></div>'
            + '<button class="kopfknopf" data-gehe="' + esc(zustand.einheitHer)
            + '">Zurück</button>'
            + '</div>'
            + '<p class="einheit__bilanz">' + e.exercises.length
            + (e.exercises.length === 1 ? ' Übung · ' : ' Übungen · ')
            + (e.vollstaendig || !e.set_target
                ? saetze + (saetze === 1 ? ' Satz' : ' Sätze')
                : saetze + ' von ' + e.set_target + ' Sätzen')
            + ' · ' + (e.offen
                ? '<span class="einheit__marke">offen</span>'
                : (e.vollstaendig
                    ? 'vollständig'
                    : '<span class="einheit__offen">unvollständig</span>'))
            + '</p>';

        /*
         * Eine offene Einheit ist über die Liste der Startseite gar nicht
         * hier zu erreichen — dort führt sie direkt ins Studio. Über den
         * Kalender schon, und dann stünde man vor einer Ansicht, die nur
         * die erledigten Übungen zeigt und keinen Weg zurück ins Training.
         *
         * Hier ist eindeutig, welche Einheit gemeint ist. Deshalb der
         * Ausgang, den der Knopf auf der Startseite bei zwei offenen
         * Einheiten nicht anbieten kann.
         */
        if (e.offen) {
            html += '<p class="tag__leer">Diese Einheit läuft noch. Es fehlen '
                 + 'die Übungen, die heute noch nicht dran waren.</p>'
                 + '<div class="werkzeuge"><button class="knopf" data-weiter="'
                 + esc(e.day) + '">Weiter trainieren</button></div>';
        }

        e.exercises.forEach(function (u) {
            const werte = u.sets.map(function (satz) {
                return zahl(satz.weight) + '×' + satz.reps;
            }).join(' · ');

            html += '<section class="kachel">'
                + zeichneKachelKopf(u, {
                    voll: u.sets.length,
                    rueckweg: true,
                    knopf: u.geloescht ? 'disabled' : 'data-bearbeite="' + esc(u.id) + '"',
                    zeilen: '<span class="kachel__werte">' + esc(werte) + '</span>'
                        + (u.geloescht
                            ? '<span class="kachel__grund">Übung gibt es nicht mehr</span>'
                            : ''),
                })
                + '</section>';
        });

        return html;
    }

    /* ---------- Ansicht: Studio ---------- */

    /** Erste Übung, die heute noch nicht vollständig ist. */
    function naechsteOffene() {
        return (zustand.studio.exercises || []).find(function (u) {
            return (u.today || []).length < u.target_sets;
        }) || null;
    }

    function zeichneStudio() {
        const s = zustand.studio;

        // Die App soll führen, nicht auflisten: beim Betreten steht die
        // nächste unfertige Übung offen da, mit den Reglern. Es gibt immer
        // genau eine Sache zu tun, ohne dass man erst raten muss, dass die
        // Kacheln antippbar sind.
        if (zustand.offen === null) {
            const dran = naechsteOffene();
            zustand.offen = dran ? dran.id : null;
        }

        const zielSaetze = s.exercises.reduce(function (n, u) { return n + u.target_sets; }, 0);
        const fertigSaetze = s.exercises.reduce(function (n, u) {
            return n + Math.min((u.today || []).length, u.target_sets);
        }, 0);
        const fertigeUebungen = s.exercises.filter(function (u) {
            return (u.today || []).length >= u.target_sets;
        }).length;

        let html = '<div class="titelzeile">'
            + '<h1 class="titel">' + esc(s.day.label) + '</h1>'
            + '<button class="kopfknopf" data-gehe="start">Pause</button>'
            + '</div>';

        // Wo stehe ich in dieser Einheit? Ohne das ist eine Liste aus neun
        // gleich aussehenden Kacheln nicht einzuordnen.
        html += '<div class="fortschritt">'
            + '<span class="fortschritt__zahl">' + fertigeUebungen + ' von '
            + s.exercises.length + ' Übungen</span>'
            + '<span class="fortschritt__balken"><span class="fortschritt__voll" style="width:'
            + Math.round(fertigSaetze / Math.max(1, zielSaetze) * 100) + '%"></span></span>'
            + '<span class="fortschritt__zahl">' + fertigSaetze + '/' + zielSaetze + ' Sätze</span>'
            + '</div>';

        if (zustand.meldung) {
            html += '<p class="fehler">' + esc(zustand.meldung) + '</p>';
        }

        const alleDurch = fertigeUebungen === s.exercises.length;

        // Die Erfolgsmeldung nur, wenn es etwas zu melden gibt.
        if (alleDurch) {
            html += zeichneGeschafft(zielSaetze, '');
        }

        s.exercises.forEach(function (u) {
            html += zeichneKachel(u);
        });

        /*
         * Der Abschluss steht unter der letzten Kachel IMMER, fertig oder
         * nicht. Zwei Gründe.
         *
         * Erstens wird der letzte Satz ganz unten in der Liste bestätigt,
         * und genau dort steht man dann: die Meldung oben bekommt man nicht
         * zu sehen, ohne über neun Kacheln zurück zu scrollen, um einen
         * Knopf zu suchen, von dem man nicht weiß, dass es ihn gibt.
         *
         * Zweitens wird eine Einheit nicht immer fertig. Früher weg,
         * Gerät besetzt, keine Kraft mehr — dann muss sich die Einheit
         * trotzdem beenden lassen, ohne dass man erst alles abhaken muss.
         *
         * Unfertig tritt der Knopf zurück: kein Rahmen, kein Gelb. Gelb
         * heißt in dieser App "hier tippen", und getippt wird bis dahin
         * auf "Satz bestätigen".
         */
        html += alleDurch
            ? zeichneGeschafft(zielSaetze, ' geschafft--unten')
            : zeichneBeenden(fertigSaetze, zielSaetze);

        return html;
    }

    function zeichneGeschafft(zielSaetze, zusatz) {
        return '<section class="geschafft' + zusatz + '">'
            + '<p class="geschafft__titel">' + zielSaetze + ' Sätze, alle durch.</p>'
            + '<p class="leer__text">Beim nächsten Mal ist '
            + esc(naechsterTagName()) + ' dran.</p>'
            + '<button class="knopf" data-gehe="start" data-abschluss="1">'
            + 'Einheit beenden</button>'
            + '</section>';
    }

    /**
     * Der Ausgang bei noch offener Einheit, mit dem Stand als Auskunft.
     *
     * Er heißt "Einheit pausieren", nicht "beenden" (Frank, 23.10.2026): Die
     * Einheit bleibt bis zum Ende des Tages offen und lässt sich von der
     * Startseite aus fortsetzen. "Beenden" steht nur da, wo alles durch ist.
     */
    function zeichneBeenden(fertigSaetze, zielSaetze) {
        return '<section class="beenden">'
            + '<p class="beenden__stand">' + fertigSaetze + ' von ' + zielSaetze
            + ' Sätzen</p>'
            + '<button class="knopf knopf--leise" data-gehe="start" data-abschluss="1">'
            + 'Einheit pausieren</button>'
            + '</section>';
    }

    /** Welcher Tag nach dieser Einheit kommt, für die Abschlussmeldung. */
    function naechsterTagName() {
        const tage = Object.keys(zustand.studio.days || {});
        const jetzt = zustand.studio.day.key;
        const andere = tage.filter(function (t) { return t !== jetzt; });
        return andere.length ? zustand.studio.days[andere[0]].label : 'die nächste Einheit';
    }

    function zeichneKachel(u) {
        const offen  = zustand.offen === u.id;
        const heute  = u.today || [];
        const ziel   = u.target_sets;

        /*
         * Das Foto ist ein eigenes Ziel und liegt NICHT im Aufklapp-Knopf.
         * Ein Tipp darauf zeigt das Gerät groß; im Studio sucht man damit
         * die Maschine, und dafür ist ein 76-Pixel-Bild zu klein.
         *
         * Ohne Foto bleibt die Geräteplakette Teil der Aufklappfläche, dort
         * gäbe es ja nichts zu vergrößern.
         */
        // Die Ansage steht laut SPEC.md §5.2 auf der Kachel. Hervorgehoben
        // wird nur die fällige Steigerung, denn genau das bedeutet das
        // Orange in dieser App. Die übrigen Hinweise bleiben zurückhaltend,
        // sonst schreit jede Kachel und keine sagt mehr etwas.
        // Die Ansage steht auf der offenen Kachel, weil dort gehandelt wird.
        // Auf den zugeklappten nur die fällige Steigerung, denn die muss man
        // vorher wissen. Sonst stünde derselbe Hinweis neunmal untereinander
        // und niemand läse ihn mehr.
        const fertig = heute.length >= ziel;

        let html = '<section class="kachel' + (offen ? ' ist-offen' : '')
            + (fertig ? ' ist-fertig' : '') + '" data-uebung="' + esc(u.id) + '">'
            + zeichneKachelKopf(u, {
                voll: heute.length,
                knopf: 'data-oeffne="' + esc(u.id) + '"',
                zeilen: letztesErgebnis(u)
                    ? '<span class="kachel__zuletzt">' + esc(letztesErgebnis(u)) + '</span>'
                    : '',
                // Nur auf der offenen Kachel: Dort steht man vor dem Gerät
                // und fragt "was war beim letzten Mal". Auf den
                // zugeklappten wäre es neunmal derselbe Knopf.
                verlauf: offen && (u.history || []).length > 0,
            });

        if (offen) {
            html += zeichneAnleitung(u) + zeichneSaetze(u);
        }

        return html + '</section>';
    }

    /**
     * Der Kopf einer Übungskachel: Foto, Name, Vorgabe, Punktreihe.
     *
     * Von zwei Ansichten benutzt, dem Studio und dem Rückblick auf eine
     * abgeschlossene Einheit. Beide zeigen dieselbe Sache, und im Studio wie
     * beim Zurückblicken hängt "welches Gerät war das" am Foto und an der
     * Geräteplakette. Eine zweite Darstellung dafür wäre eine zweite
     * Bildsprache für denselben Gegenstand.
     *
     * Herausgezogen statt zeichneKachel() mit einem Modus-Schalter zu
     * durchziehen: die Funktion hat schon genug Verzweigungen, und ein
     * zweiter Modus quer durch alle hindurch wäre nachher nicht mehr
     * auseinanderzuhalten.
     *
     * $opts.voll     wie viele Punkte gefüllt sind
     * $opts.knopf    data-Attribut der Textfläche (wohin ein Tipp führt)
     * $opts.zeilen   zusätzliche Zeilen unter der Vorgabe, fertiges HTML
     * $opts.rueckweg true im Rückblick: dann zählt die Zeile, was gemacht
     *                wurde, nicht was vorgesehen war
     * $opts.verlauf  true: rechts neben der Punktreihe der Knopf zur
     *                Verlaufstabelle
     */
    function zeichneKachelKopf(u, opts) {
        const ziel = u.target_sets;

        /*
         * Im Studio steht die Zielsatzzahl da, denn das ist die Vorgabe:
         * was man noch schuldet. Im Rückblick wäre dieselbe Zahl eine
         * Behauptung über etwas, das nicht stattgefunden hat — dort zählt,
         * was gemacht wurde, und die Vorgabe steht als Bezug dahinter.
         * Erreicht oder übertroffen braucht es den Bezug nicht mehr,
         * "4/4" wäre nur Rauschen.
         */
        const knapp = opts.rueckweg && opts.voll < ziel;
        const anzahl = opts.rueckweg
            ? '<b class="kachel__zahl">' + opts.voll + '</b>'
              + (knapp ? '<span class="kachel__von">/' + ziel + '</span>' : '')
            : '<b class="kachel__zahl">' + ziel + '</b>';

        /*
         * Das Foto ist ein eigenes Ziel und liegt NICHT im Aufklapp-Knopf.
         * Ein Tipp darauf zeigt das Gerät groß; im Studio sucht man damit
         * die Maschine, und dafür ist ein 76-Pixel-Bild zu klein.
         *
         * Ohne Foto bleibt die Geräteplakette Teil der Aufklappfläche, dort
         * gäbe es ja nichts zu vergrößern.
         */
        const bild = u.photo
            // Foto und Nummer in einer Spalte. Ohne die Klammer stellte das
            // Flex-Layout sie nebeneinander statt untereinander.
            ? '<span class="kachel__geraet">'
              + '<button class="kachel__foto" data-foto="' + esc(u.photo)
              // data-anleitung statt data-uebung: das trägt schon die Kachel
              // selbst, und der Foto-Zweig wird im Handler zuerst geprüft.
              + '" data-anleitung="' + esc(u.id)
              + '" data-name="' + esc(u.name) + '" data-nummer="' + esc(u.station || '')
              + '" aria-label="Foto von ' + esc(u.name) + ' vergrößern">'
              + '<img class="kachel__bild" src="assets/img/exercises/' + esc(u.photo)
              + '" alt="" loading="lazy"></button>'
              // Die Nummer steht UNTER dem Bild, nicht darauf: daneben ist
              // die Textspalte höher, hier liegt der Platz ohnehin brach.
              + (u.station
                  ? '<span class="plakette plakette--unten">' + esc(u.station) + '</span>'
                  : '')
              + '</span>'
            : '<span class="kachel__platzhalter">'
              + (u.station ? esc(u.station) : '?') + '</span>';

        // Höchstens so viele Punkte wie Ziel, mindestens so viele wie
        // Sätze: ein zusätzlich gemachter Satz soll nicht unsichtbar sein.
        let punkte = '';
        for (let i = 0; i < Math.max(ziel, opts.voll); i++) {
            punkte += '<span class="punkt' + (i < opts.voll ? ' ist-voll' : '') + '"></span>';
        }

        // Zwei getrennte Ziele nebeneinander: das Foto vergrößert, der Text
        // führt weiter. Verschachtelte Knöpfe wären ungültiges HTML, deshalb
        // ist der Kopf ein div und nicht selbst ein Knopf.
        const text = '<button class="kachel__text" ' + opts.knopf + '>'
            + '<span class="kachel__name">' + esc(u.name) + '</span>'
            + '<span class="kachel__ziel">'
            + anzahl + ' Sätze · '
            + '<b class="kachel__zahl">' + u.rep_min + '–' + u.rep_max + '</b> Wdh</span>'
            + opts.zeilen
            + '<span class="punkte">' + punkte + '</span>'
            + '</button>';

        // Der Verlaufsknopf kann nicht in die Textfläche, die ist selbst ein
        // Knopf. Er liegt deshalb mit ihr in einer Spalte und unten rechts
        // darüber, auf Höhe der Punktreihe (Frank, 23.10.2026).
        const spalte = opts.verlauf
            ? '<div class="kachel__spalte">' + text
              + '<button class="kachel__verlauf" type="button" data-verlauf="' + esc(u.id)
              + '" aria-label="Verlauf von ' + esc(u.name) + '">'
              + symbol(SYMBOLE.verlauf) + '</button></div>'
            : text;

        return '<div class="kachel__kopf">' + bild + spalte + '</div>';
    }

    /**
     * Die Ausführung auf der offenen Kachel, eingeklappt.
     *
     * Dieselbe Auskunft steht in den Einstellungen, aber gebraucht wird sie
     * hier: vor dem Gerät, kurz bevor man den Satz macht. Verwaltung liest
     * man zu Hause, "wie ging das nochmal" fragt man im Studio.
     *
     * Eingeklappt und leise, weil der Weg über diese Kachel neunmal pro
     * Einheit führt und die Frage höchstens einmal auftaucht. Stünde der
     * Text offen da, schöbe er bei jeder Übung die Regler nach unten, an
     * denen tatsächlich gearbeitet wird.
     *
     * Aufklappen statt Popup: eine Überlagerung müsste weggetippt werden,
     * bevor man weitermachen kann, und mit Pausen-Timer und Bildlupe
     * liegen schon zwei davon übereinander.
     */
    /**
     * Der Verweis auf die Ausführung — nur noch als Notausgang.
     *
     * Mit Foto führt ein Tipp aufs Bild in die Großansicht, und dort steht
     * die Ausführung. Eine eigene Zeile wäre ein zweiter Weg zum selben Ort
     * und säße ausgerechnet zwischen Kachelkopf und Reglern, also da, wo man
     * eintippt (Frank, 26.08.2026).
     *
     * OHNE Foto bleibt sie stehen: Dann gibt es keinen anderen Weg zur
     * Anleitung, denn der Platzhalter mit der Gerätenummer klappt die Kachel
     * auf und öffnet keine Großansicht. Im mitgelieferten Plan hat jede
     * Übung ein Bild, aber angelegte Übungen müssen keins haben.
     */
    function zeichneAnleitung(u) {
        if (u.photo || (!u.execution && !u.search)) {
            return '';
        }

        return '<button class="anleitung" type="button" '
             + 'data-anleitung="' + esc(u.id) + '">'
             + '<span class="anleitung__pfeil" aria-hidden="true"></span>'
             + 'Wie geht die Übung?</button>';
    }

    function letztesErgebnis(u) {
        if (!u.last || !u.last.sets || u.last.sets.length === 0) {
            // Die Coach-Zeile sagt beim ersten Mal schon, dass hier nichts
            // steht. Zweimal dieselbe Auskunft untereinander ist eine zu viel.
            return '';
        }
        const s = u.last.sets[u.last.sets.length - 1];
        return 'Zuletzt ' + last(s.weight, u.assisted) + ' × ' + s.reps;
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

        /*
         * Mitten in der Übung: den Satz wiederholen, den man gerade gemacht
         * hat. Innerhalb einer Einheit steigert man nicht von Satz zu Satz,
         * sondern hält das Gewicht und zieht die Wiederholungen nach.
         */
        if (heute.length > 0) {
            const l = heute[heute.length - 1];
            return { weight: l.weight, reps: l.reps };
        }

        /*
         * Erster Satz: das, was heute ansteht — Arbeitsgewicht und
         * Ziel-Wiederholungen aus der Coach-Regel.
         *
         * Bis zum 26.08.2026 stand hier der letzte Wert, und zwar der Satz
         * an DERSELBEN Position. Das spielte eine Aufwärmleiter nach: Wer
         * 80, 110, 130, 130 eingetragen hatte, bekam für Satz 1 wieder 80
         * vorgelegt, während die Kachel darüber "130 kg halten" sagte. Zwei
         * Zahlen für dieselbe Übung, die sich widersprechen.
         *
         * Die Umkehr ist Franks Entscheidung und kehrt die Festlegung vom
         * 19.08. um ("Der Coach-Vorschlag befüllt die Eingabe nicht"). Der
         * Preis: Ein unaufmerksames Bestätigen schreibt jetzt eine
         * Wiederholung mehr ins Protokoll, als man gemacht hat. Dafür steht
         * im Feld das, was man erreichen soll.
         *
         * Gerechnet wird auf dem Server. Die Progressionsregel lebt an einer
         * Stelle; ein zweiter Rechenweg im Browser liefe irgendwann
         * auseinander.
         */
        const c = u.coach || {};
        if (c.target_weight !== null && c.target_weight !== undefined) {
            return {
                weight: c.target_weight,
                reps: c.target_reps || u.rep_min,
            };
        }

        return { weight: 0, reps: u.rep_min };
    }

    function zeichneSaetze(u) {
        const heute = u.today || [];
        let html = '<div class="saetze">';

        /*
         * Die erledigten Sätze werden nicht mehr aufgelistet (Vorgabe von
         * Frank, 26.08.2026). Was gemacht ist, sagt die Punktreihe im
         * Kachelkopf; die Zeilen darunter standen zwischen ihr und den
         * Reglern und schoben die Eingabe mit jedem Satz weiter nach unten.
         *
         * Damit entfällt auch das nachträgliche Ändern eines Satzes über
         * "ändern". Der Zweig d.korrigiere bleibt im Klick-Handler stehen,
         * falls die Liste zurückkommt.
         */

        if (heute.length >= u.target_sets && zustand.entwurf[u.id] === undefined) {
            html += '<p class="satz__fertig">Alle ' + u.target_sets + ' Sätze stehen.</p>'
                 + '<button class="zufuegen" data-extra="' + esc(u.id) + '">'
                 + 'Noch einen Satz</button></div>';
            return html;
        }

        const e = zustand.entwurf[u.id] || vorbelegung(u);

        /*
         * An der Unterstützungsmaschine ist die Richtung umgekehrt. Das
         * gehört sichtbar dorthin, wo eingetippt wird, sonst dreht man
         * das Gewicht nach oben und macht die Übung damit leichter.
         */
        const hilfeHinweis = u.assisted
            ? '<p class="wechsel wechsel--hilfe">Unterstützungsmaschine: '
              + '<strong>weniger Gewicht heißt schwerer.</strong> '
              + 'Das Gegengewicht nimmt dir Körpergewicht ab.</p>'
            : '';

        html += hilfeHinweis
            /*
             * Kein "Satz N", weder hier noch über den erledigten Sätzen.
             * Die Punktreihe im Kachelkopf sagt dasselbe und ist von weiter
             * weg zu lesen; die Reihenfolge der Zeilen sagt es noch einmal.
             * Vorgabe von Frank, 26.08.2026: In der Satzliste steht nur,
             * was gemacht wurde, kein Text darum herum.
             */
            + '<div class="satz satz--dran">'
            + regler(u.id, 'weight', zahl(e.weight), 'kg',
                u.assisted
                    ? '± ' + zahl(u.weight_step) + ' kg Hilfe · weniger ist schwerer'
                    : '± ' + zahl(u.weight_step) + ' kg')
            + regler(u.id, 'reps', e.reps, 'Wdh', '')
            + '<button class="knopf satz__ok" data-bestaetige="' + esc(u.id) + '">'
            + 'Satz bestätigen</button>'
            + '</div>';

        return html + '</div>';
    }

    /*
     * $schritt wird nur beim Gewicht beschriftet, weil die Schrittweite dort
     * je Übung verschieden ist (0,25 bis 5 kg). Bei Wiederholungen ist
     * eine 1 selbstverständlich und wäre eine Zahl ohne Aussage.
     *
     * Zahl und Einheit stehen getrennt, damit die Zahl groß und die Einheit
     * klein gesetzt werden kann: Abgelesen wird die 45, das "kg" weiß man.
     * Das Leerzeichen zwischen beiden ist echter Text und kein CSS-Abstand,
     * damit der Wert als "45 kg" auslesbar bleibt.
     */
    function regler(id, feld, wert, einheit, schritt) {
        return '<div class="regler">'
            + '<button class="regler__knopf" data-aendere="' + esc(id) + ':' + feld
            + ':-1" aria-label="weniger">−</button>'
            + '<span class="regler__wert"><span class="regler__zahl">' + esc(wert)
            + '</span> <span class="regler__einheit">' + esc(einheit) + '</span></span>'
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
            + '<button class="kopfknopf" data-gehe="' + esc(zustand.uebungHer)
            + '">Zurück</button>'
            + '</div>';

        // Der Verlauf steht in einem eigenen Behälter, damit er sich
        // aktualisieren lässt, ohne das Formular darunter neu zu zeichnen.
        // Sonst verliert eine Eingabe ihren Text, sobald die Kurve
        // nachlädt oder man einen Punkt antippt.
        if (!neu) {
            html += zeichneAusfuehrung(u);
            html += '<div id="verlaufteil">' + zeichneVerlauf() + '</div>';
        }

        return html + zeichneEditor(neu ? { day: zustand.neuTag } : u);
    }

    /**
     * Ausführung und Nachschlagelink.
     *
     * Steht ganz oben in der Übungsansicht, noch vor dem Verlauf: wer eine
     * Übung aufmacht, will meist zuerst wissen, wie sie geht.
     */
    function zeichneAusfuehrung(u) {
        if (!u.execution && !u.search) {
            return '';
        }

        let html = '<section class="ausfuehrung">';

        if (u.execution) {
            html += '<p class="ausfuehrung__text">' + esc(u.execution) + '</p>';
        }

        if (u.search) {
            // Videos zu Kraftübungen sind fast durchweg englisch, und der
            // englische Name ist eindeutiger als jede deutsche Übersetzung.
            const suche = encodeURIComponent(u.search);
            html += '<div class="ausfuehrung__suche">'
                 + '<span class="ausfuehrung__begriff">' + esc(u.search) + '</span>'
                 + '<a class="kopfknopf" target="_blank" rel="noopener" '
                 + 'href="https://www.youtube.com/results?search_query=' + suche + '">Video</a>'
                 + '<a class="kopfknopf" target="_blank" rel="noopener" '
                 + 'href="https://www.google.com/search?q=' + suche + '">Google</a>'
                 + '</div>';
        }

        return html + '</section>';
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

        /*
         * An einer Unterstützungsmaschine misst dieselbe Zahl das Gegenteil.
         * Das Arbeitsgewicht ist die geringste Hilfe, und die Kurve fällt,
         * wenn es besser läuft. "Gewicht × Wdh" wäre dort die abgenommene
         * Last: sie stiege genau dann, wenn man sich mehr helfen lässt.
         * Deshalb zählt im zweiten Diagramm die Wiederholungsmenge.
         */
        const hilfe = !!(zustand.verlauf.exercise && zustand.verlauf.exercise.assisted);
        const gewichtKopf = hilfe ? 'Geringste Unterstützung' : 'Schwerstes Gewicht';
        const mengeFeld   = hilfe ? 'reps_total' : 'volume';
        const mengeKopf   = hilfe ? 'Wiederholungen' : 'Volumen';
        const mengeEinh   = hilfe ? 'Wdh gesamt' : 'kg × Wdh';
        const kg          = (w) => last(w, hilfe);

        // Bei einem einzigen Datenpunkt ist eine Kurve eine Lüge: es gibt
        // keinen Verlauf, nur einen Wert.
        if (punkte.length === 1) {
            return '<section class="verlauf">'
                + '<p class="verlauf__lese">' + esc(datum(p.date)) + ' · '
                + esc(kg(p.work_weight)) + ' × ' + p.top_reps + ' · '
                + p.sets + (p.sets === 1 ? ' Satz' : ' Sätze') + '</p>'
                + '<p class="tag__leer">Eine Einheit reicht für keine Kurve. '
                + 'Ab der zweiten wird hier ein Verlauf sichtbar.</p></section>';
        }

        return '<section class="verlauf">'
            + '<div class="verlauf__lese">'
            + '<span class="verlauf__datum">' + esc(datum(p.date)) + '</span>'
            + '<span class="verlauf__werte">'
            + esc(kg(p.work_weight)) + ' × ' + p.top_reps + '  ·  '
            + p.sets + (p.sets === 1 ? ' Satz' : ' Sätze') + '  ·  '
            + (hilfe ? p.reps_total + ' Wdh' : esc(zahl(p.volume)) + ' Volumen')
            + '</span></div>'

            + '<div class="chart__kopf"><span class="mini">' + gewichtKopf + '</span>'
            + '<span class="chart__einheit">kg</span></div>'
            + chart(punkte, 'work_weight', 'Kilogramm', i)
            + (hilfe ? '<p class="chart__fuss">Eine fallende Kurve ist der Fortschritt: '
                     + 'weniger Hilfe heißt mehr eigene Kraft.</p>' : '')

            + '<div class="chart__kopf"><span class="mini">' + mengeKopf + '</span>'
            + '<span class="chart__einheit">' + mengeEinh + '</span></div>'
            + chart(punkte, mengeFeld, mengeKopf, i)

            + '<p class="hinweis">' + punkte.length + ' Einheiten. '
            + 'Tippen wählt eine Einheit aus.</p>'
            + '</section>';
    }

    /* ---------- Ansicht: Einstellungen (intern "plan") ---------- */

    function zeichnePlan() {
        let html = '<div class="titelzeile">'
            + '<h1 class="titel">Einstellungen</h1>'
            + '<button class="kopfknopf" data-gehe="start">Fertig</button>'
            + '</div>';

        /*
         * Zwei Bereiche statt einer langen Seite. Die Übungen sind das,
         * wofür man hierher kommt; alles andere ändert man einmal im Jahr
         * und soll dabei nicht im Weg stehen.
         *
         * Dieselbe Bauform wie der Schalter bei den Schwerpunkten: "eins
         * von zweien" sieht in dieser App so aus. Ein Reiter im Stil einer
         * fremden Bibliothek wäre eine zweite Bildsprache für denselben
         * Handgriff.
         */
        const bereich = zustand.planBereich === 'allgemein' ? 'allgemein' : 'uebungen';

        html += '<div class="schalter schalter--breit">'
            + '<button type="button" class="schalter__teil'
            + (bereich === 'uebungen' ? ' ist-an' : '')
            + '" data-bereich="uebungen">Übungen</button>'
            + '<button type="button" class="schalter__teil'
            + (bereich === 'allgemein' ? ' ist-an' : '')
            + '" data-bereich="allgemein">Allgemein</button>'
            + '</div>';

        // Ohne das scheiterte eine abgelehnte Eingabe stumm: das Formular
        // zeichnete sich leer neu und nichts sagte, warum.
        if (zustand.meldung) {
            html += '<p class="fehler" role="alert">' + esc(zustand.meldung) + '</p>';
        }

        /*
         * Die Schwerpunkte sind am 22.08.2026 aus der Oberfläche genommen
         * worden, aber nicht aus dem Code.
         *
         * Der Schalter schrieb "focus" nach plan.json, und dort las den Wert
         * niemand: nicht lib/coach.php, nicht api/plan.php, nirgends. Die
         * Beschriftung versprach "mehr Sätze pro Woche für diese Gruppe" —
         * passiert ist nichts. Auf dem Server standen drei Gruppen auf
         * Schwerpunkt, ohne jede Wirkung. Etwas anzuzeigen, das nichts tut,
         * ist schlechter als es wegzulassen.
         *
         * Wieder einschalten heißt: den Aufruf unten zurückholen.
         * zeichneSchwerpunkte(), der Zweig d.prio im Klick-Handler, das
         * Attribut data-prio im Selektor und die CSS-Klasse .prio stehen
         * unverändert da. Vorher muss aber entschieden sein, WAS ein
         * Schwerpunkt bewirken soll — der offene Punkt steht in STATE.md.
         *
         * ACHTUNG, nicht aufräumen: muscle_priorities in plan.json bleibt.
         * Seine SCHLÜSSEL sind die Liste der gültigen Muskelgruppen.
         * lib/uebungen.php prüft jede Übung dagegen, und die Auswahl im
         * Übungsformular wird daraus gebaut. Ohne das Objekt ließe sich
         * keine Übung mehr anlegen.
         */
        if (bereich === 'allgemein') {
            // Hier hing zwischen Gewicht und Passwort:
            //     + zeichneSchwerpunkte()
            return html + zeichneGewicht() + zeichnePasswort();
        }

        return html + zeichneUebungsliste();
    }

    /**
     * Bereich "Übungen": die Bibliothek, nach Trainingstagen sortiert.
     *
     * Der leere Fall steht hier und nicht eine Ebene höher. Ohne Plan gibt
     * es keine Übungen, aber Körpergewicht und Passwort lassen sich
     * trotzdem bedienen — vorher endete an dieser Stelle die ganze Seite.
     */
    function zeichneUebungsliste() {
        const tage = zustand.plan.days || {};
        let html = '';

        // Ein leerer Bildschirm mit Überschriften lässt einen ratlos
        // zurück, weil man nach einem Knopf sucht, den es nicht gibt.
        if (Object.keys(tage).length === 0) {
            return '<section class="leer">'
                + '<h2 class="leer__titel">Hier ist noch kein Plan</h2>'
                + '<p class="leer__text">Es sind weder Trainingstage noch Übungen '
                + 'hinterlegt. Der Plan wird auf dem Server einmalig angelegt, '
                + 'danach lässt er sich hier ändern.</p>'
                + '<ul class="schritte"><li>php bin/plan-anlegen.php</li></ul>'
                + '</section>';
        }

        Object.keys(tage).forEach(function (tag) {
            const liste = Object.values(zustand.uebungen)
                .filter(function (u) { return u.day === tag && !u.hidden; })
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

            html += '<button class="knopf knopf--zufuegen" data-neu="' + esc(tag) + '">'
                 + 'Übung zufügen</button></section>';
        });

        return html;
    }

    /* ---------- Ausgeblendete Übungen ----------
     *
     * Über das Menü erreichbar, sobald es mindestens eine gibt (Frank,
     * 23.10.2026). Jede lässt sich wieder aktivieren, sie kommt dann an ihre
     * alte Stelle im alten Trainingstag zurück, oder vollständig löschen.
     */
    function zeichneAusgeblendet() {
        const tage = (zustand.plan && zustand.plan.days) || {};
        const liste = Object.values(zustand.uebungen || {})
            .filter(function (u) { return u.hidden; })
            .sort(function (a, b) { return a.name.localeCompare(b.name, 'de'); });

        let html = '<div class="titelzeile">'
            + '<h1 class="titel">Ausgeblendet</h1>'
            + '<button class="kopfknopf" data-gehe="start">Fertig</button>'
            + '</div>'
            + '<p class="leer__text ausgeblendet__hinweis">Ausgeblendete Übungen stehen nicht mehr in Plan und Studio. '
            + 'Ihre Sätze zählen weiter im Rückblick und in der Fortschrittskurve.</p>';

        if (liste.length === 0) {
            return html + '<p class="tag__leer">Keine ausgeblendeten Übungen.</p>';
        }

        // Dieselben Zeilen wie in den Einstellungen, nach Trainingstag
        // gruppiert (Frank, 23.10.2026): am Foto und an der Gerätenummer
        // erkennt man die Übung, und ein Tipp öffnet sie. Aktivieren und
        // Löschen stehen dort im Formular.
        Object.keys(tage).forEach(function (tag) {
            const imTag = liste.filter(function (u) { return u.day === tag; });
            if (imTag.length === 0) {
                return;
            }
            html += '<section class="tag">'
                + '<div class="tag__kopf">'
                + '<span class="tag__name">' + esc(tage[tag].label) + '</span>'
                + '<span class="tag__zahl">' + imTag.length + '</span>'
                + '</div>';
            imTag.forEach(function (u) { html += zeichneZeile(u); });
            html += '</section>';
        });
        return html;
    }

    /*
     * Der Dialog zum Entfernen. Zwei Stufen: erst ausblenden oder löschen,
     * beim Löschen noch einmal "wirklich?" mit der Zahl der betroffenen
     * Einheiten. Er liegt außerhalb von #app und baut seinen Inhalt selbst.
     */
    const frage = document.getElementById('frage');

    function frageZeigen(html) {
        document.getElementById('frage-inhalt').innerHTML = html;
        frage.hidden = false;
    }

    function frageSchliessen() {
        if (frage && !frage.hidden) {
            frage.hidden = true;
            document.getElementById('frage-inhalt').innerHTML = '';
        }
    }

    function frageEntfernen(id) {
        const u = zustand.uebungen[id];
        if (!u) {
            return;
        }
        frageZeigen('<h2 class="frage__titel">' + esc(u.name) + ' entfernen</h2>'
            + '<p class="frage__text"><strong>Ausblenden</strong> nimmt die Übung aus Plan und Studio. '
            + 'Alle Sätze bleiben erhalten und zählen weiter im Rückblick und in der Fortschrittskurve. '
            + 'Über das Menü lässt sie sich wieder aktivieren.</p>'
            + '<p class="frage__text"><strong>Vollständig löschen</strong> entfernt die Übung und alle ihre Sätze.</p>'
            + '<button class="knopf" type="button" data-frage-ausblenden="' + esc(id) + '">Ausblenden</button>'
            + '<button class="loeschen loeschen--scharf" type="button" data-frage-loeschen="' + esc(id)
            + '">Vollständig löschen</button>'
            + '<button class="knopf knopf--leise" type="button" data-frage-zu>Abbrechen</button>');
    }

    async function frageEndgueltig(id) {
        const u = zustand.uebungen[id];
        if (!u) {
            return;
        }
        let anzahl = null;
        try {
            anzahl = (await api('api/exercises.php?usage=' + encodeURIComponent(id))).sessions;
        } catch (err) {
            frageZeigen('<h2 class="frage__titel">Gerade keine Verbindung</h2>'
                + '<p class="frage__text">' + esc(err.message) + ' Löschen geht nur mit Netz.</p>'
                + '<button class="knopf knopf--leise" type="button" data-frage-zu>Schließen</button>');
            return;
        }
        frageZeigen('<h2 class="frage__titel">Wirklich alle Daten löschen?</h2>'
            + '<p class="frage__text">' + esc(u.name) + ' und ' + (anzahl === 0
                ? 'ihre Einstellungen werden gelöscht. Sätze gibt es keine.'
                : 'ihre Sätze aus ' + anzahl + (anzahl === 1 ? ' Einheit' : ' Einheiten')
                  + ' werden gelöscht. Einheiten, in denen sonst nichts stand, fallen mit weg.')
            + '</p><p class="frage__text">In der App lässt sich das nicht rückgängig machen. '
            + 'Auf dem Server bleibt eine Sicherungskopie in data/sicherung/.</p>'
            + '<button class="loeschen loeschen--scharf" type="button" data-frage-endgueltig="' + esc(id)
            + '">Endgültig löschen</button>'
            + '<button class="knopf knopf--leise" type="button" data-frage-zu>Abbrechen</button>');
    }

    async function uebungAusblenden(id, ausblenden) {
        const name = (zustand.uebungen[id] || {}).name || id;
        try {
            const antwort = await api('api/exercises.php?id=' + encodeURIComponent(id)
                + '&hidden=' + (ausblenden ? '1' : '0'), { method: 'POST' });
            zustand.uebungen = antwort.exercises || {};
        } catch (err) {
            hinweis(err.message, true);
            return false;
        }
        hinweis(name + (ausblenden ? ' ist ausgeblendet.' : ' ist wieder im Plan.'));
        return true;
    }

    async function uebungAktivieren(id) {
        if (await uebungAusblenden(id, false)) {
            if (zustand.ansicht === 'uebung') {
                zustand.ansicht = ausDemFormular();
                zustand.uebungId = null;
            }
            zeichnen();
        }
    }

    /**
     * Wohin es aus dem Übungsformular zurückgeht: in die Übersicht der
     * ausgeblendeten Übungen, wenn man von dort kam, sonst in die
     * Einstellungen wie bisher.
     */
    function ausDemFormular() {
        return zustand.uebungHer === 'ausgeblendet' ? 'ausgeblendet' : 'plan';
    }

    async function uebungLoeschen(id) {
        const name = (zustand.uebungen[id] || {}).name || id;
        try {
            const antwort = await api('api/exercises.php?id=' + encodeURIComponent(id), { method: 'DELETE' });
            zustand.uebungen = antwort.exercises || {};
        } catch (err) {
            hinweis(err.message, true);
            return;
        }
        hinweis(name + ' ist gelöscht.');
        if (zustand.ansicht === 'uebung') {
            zustand.ansicht = ausDemFormular();
            zustand.uebungId = null;
        }
        einheitenHolen();   // Rückblick und Kurve rechnen sich ohne die Sätze anders
        zeichnen();
    }

    if (frage) {
        frage.addEventListener('click', async function (e) {
            const k = e.target.closest('button');
            if (e.target === frage || (k && k.hasAttribute('data-frage-zu'))) {
                return frageSchliessen();
            }
            if (!k) {
                return;
            }
            const d = k.dataset;
            if (d.frageAusblenden) {
                frageSchliessen();
                if (await uebungAusblenden(d.frageAusblenden, true)) {
                    zustand.ansicht = 'plan';
                    zustand.uebungId = null;
                    zeichnen();
                }
            } else if (d.frageLoeschen) {
                await frageEndgueltig(d.frageLoeschen);
            } else if (d.frageEndgueltig) {
                frageSchliessen();
                await uebungLoeschen(d.frageEndgueltig);
            }
        });
        addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                frageSchliessen();
            }
        });
    }

    /*
     * Rückmeldung nach Ausblenden, Aktivieren, Löschen: oben mittig, legt
     * sich über die Seite und geht von selbst. Ein Fehler bleibt länger.
     */
    let hinweisUhr = null;
    function hinweis(text, fehler) {
        const box = document.getElementById('rueckmeldung');
        if (!box) {
            return;
        }
        box.textContent = text;
        box.classList.toggle('ist-fehler', !!fehler);
        box.hidden = false;
        clearTimeout(hinweisUhr);
        hinweisUhr = setTimeout(function () { box.hidden = true; }, fehler ? 8000 : 4000);
    }

    function zeichneZeile(u) {
        /*
         * Vorschaubild wo vorhanden, sonst die Gerätenummer. Auch hier ist
         * das Bild ein eigenes Ziel: antippen zeigt es groß, der Rest der
         * Zeile führt in die Übung. Man erkennt ein Gerät schneller am
         * Bild als am Namen.
         */
        const vorschau = u.photo
            ? '<span class="kachel__geraet">'
              + '<button class="zeile__foto" data-foto="' + esc(u.photo)
              + '" data-anleitung="' + esc(u.id)
              + '" data-name="' + esc(u.name) + '" data-nummer="' + esc(u.station || '')
              + '" aria-label="Foto vergrößern">'
              + '<img src="assets/img/exercises/' + esc(u.photo)
              + '" alt="" loading="lazy" class="kachel__bild"></button>'
              + (u.station
                  ? '<span class="plakette plakette--unten">' + esc(u.station) + '</span>'
                  : '')
              + '</span>'
            : (u.station
                ? '<span class="plakette">' + esc(u.station) + '</span>'
                : '<span class="plakette plakette--leer" title="Kein Foto, keine Nummer">–</span>');

        return '<div class="zeile">'
            + vorschau
            + '<button class="zeile__text" data-bearbeite="' + esc(u.id) + '">'
            + '<span class="zeile__name">' + esc(u.name) + '</span>'
            + '<span class="zeile__daten">'
            + esc(gruppenName(u.muscle_group)) + ' · ' + u.target_sets + '×'
            + u.rep_min + '–' + u.rep_max + ' · ' + zahl(u.weight_step) + ' kg'
            + '</span></button></div>';
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
        [0.25, 0.5, 1, 1.25, 2.5, 5].forEach(function (s) {
            const gewaehlt = parseFloat(wert('weight_step', 5)) === s;
            html += '<option value="' + s + '"' + (gewaehlt ? ' selected' : '') + '>'
                 + zahl(s) + ' kg</option>';
        });
        html += '</select>'

            + '<label class="mini" for="e-assisted">Gewichtsrichtung</label>'
            + '<select class="feld feld--text" id="e-assisted" name="assisted">'
            + '<option value=""' + (u.assisted ? '' : ' selected')
            + '>mehr Gewicht ist schwerer (normal)</option>'
            + '<option value="1"' + (u.assisted ? ' selected' : '')
            + '>weniger Gewicht ist schwerer (Unterstützungsmaschine)</option>'
            + '</select>'

            + '<label class="mini" for="e-execution">Ausführung</label>'
            + '<textarea class="feld feld--text feld--lang" id="e-execution" '
            + 'name="execution" rows="4" placeholder="Wie genau wird die Übung '
            + 'ausgeführt?">' + esc(u.execution || '') + '</textarea>'

            + '<label class="mini" for="e-search">Englischer Suchbegriff</label>'
            + '<input class="feld feld--text" id="e-search" name="search" '
            + 'value="' + esc(u.search || '') + '" placeholder="z. B. incline dumbbell curl">'

            + '<label class="mini">Foto</label>'
            + zeichneBildauswahl(u.photo || '')

            + '<p class="fehler" role="alert">' + esc(zustand.meldung) + '</p>'

            + '<div class="werkzeuge">'
            + '<button class="knopf" type="submit">Speichern</button>'
            + '<button class="knopf knopf--leise" type="button" data-abbrechen>Abbrechen</button>'
            + '</div>';

        // "Entfernen" fragt, ob ausgeblendet oder vollständig gelöscht wird
        // (Frank, 23.10.2026). Eine schon ausgeblendete Übung, die man aus
        // dem Rückblick heraus öffnet, bekommt gleich ihre beiden Wege.
        if (!neu) {
            html += u.hidden
                ? '<button class="loeschen" type="button" data-aktivieren="' + esc(u.id)
                  + '">Wieder aktivieren</button>'
                  + '<button class="loeschen" type="button" data-endgueltig="' + esc(u.id)
                  + '">Vollständig löschen</button>'
                : '<button class="loeschen" type="button" data-entfernen="' + esc(u.id)
                  + '">Entfernen</button>';
        }

        return html + '</form>';
    }

    /**
     * Bildauswahl: alle Studiofotos zum Antippen.
     *
     * Vorher stand hier ein Textfeld für einen Dateinamen. Das setzt
     * voraus, dass man weiß, wie die Datei heißt, und dass jemand die
     * Zuordnung vorher richtig geraten hat. Beides ist nicht der Fall:
     * auf einem Foto sieht man das Gerät, aber nicht, welche Übung
     * jemand daran macht. Das kann nur Frank entscheiden, also gehört
     * die Entscheidung in die App und nicht in eine Konfigurationsdatei.
     */
    function zeichneBildauswahl(gewaehlt) {
        const fotos = zustand.fotos || [];

        if (fotos.length === 0) {
            return '<p class="hinweis">Keine Fotos gefunden. Originale nach '
                 + '<code>images/</code> legen und <code>bin/fotos.sh</code> laufen lassen.</p>';
        }

        let html = '<input type="hidden" name="photo" id="e-photo" value="'
                 + esc(gewaehlt) + '">'

                 // Kamera direkt: capture lässt das Handy die Kamera öffnen,
                 // statt in der Fotomediathek zu landen. Man steht ja vor
                 // dem Gerät, wenn man merkt, dass das Bild fehlt.
                 + '<label class="hochladen">'
                 + '<input type="file" id="e-upload" accept="image/*" capture="environment">'
                 + '<span id="hochladen-text">Foto aufnehmen oder wählen</span>'
                 + '</label>'

                 + '<div class="bildwahl" id="bildwahl">'
                 + '<button type="button" class="bildwahl__keins'
                 + (gewaehlt ? '' : ' ist-gewaehlt') + '" data-bild="">kein Foto</button>';

        fotos.forEach(function (datei) {
            html += '<span class="bildwahl__feld">'
                 + '<button type="button" class="bildwahl__stueck'
                 + (datei === gewaehlt ? ' ist-gewaehlt' : '')
                 + '" data-bild="' + esc(datei) + '" title="' + esc(datei) + '">'
                 + '<img src="assets/img/exercises/' + esc(datei)
                 + '" alt="" loading="lazy"></button>'
                 // Löschen in zwei Schritten, wie überall sonst in der App:
                 // ein Bild ist schnell weg und nicht wiederzuholen.
                 + '<button type="button" class="bildwahl__weg'
                 + (zustand.bildLoeschfrage === datei ? ' ist-scharf' : '')
                 + '" data-bildweg="' + esc(datei) + '" title="Foto löschen">'
                 + (zustand.bildLoeschfrage === datei ? 'wirklich?' : '×')
                 + '</button></span>';
        });

        return html + '</div><p class="hinweis">' + fotos.length
             + ' Fotos aus dem Studio. Antippen wählt aus.</p>';
    }

    /**
     * Zeichnet nur die Bildauswahl neu.
     *
     * Die ganze Ansicht neu zu zeichnen würde halb eingetippte Werte im
     * Formular darüber wegnehmen.
     */
    function zeichnenNurAuswahl() {
        const alt = document.getElementById('bildwahl');
        const versteckt = document.getElementById('e-photo');
        if (!alt || !versteckt) {
            return;
        }
        const huelle = document.createElement('div');
        huelle.innerHTML = zeichneBildauswahl(versteckt.value);
        alt.replaceWith(huelle.querySelector('#bildwahl'));
    }

    /**
     * Körpergewicht eintragen, in den Einstellungen.
     *
     * Mit Datum und als Liste, nicht als eine aktuelle Zahl: Der
     * Fortschritts-Index rechnet an der Unterstützungsmaschine
     * "Körpergewicht minus Hilfe", und mit nur einem Wert würde jeder Gang
     * auf die Waage rückwirkend alle alten Einheiten umrechnen. Details in
     * lib/gewicht.php.
     *
     * Freiwillig: ohne Eintrag bleiben Klimmzug und Dips aus dem Index,
     * alles andere rechnet weiter.
     */
    function zeichneGewicht() {
        const liste = (zustand.gewicht && zustand.gewicht.gewicht) || [];
        const heute = new Date().toISOString().slice(0, 10);

        let html = '<section class="tag">'
            + '<div class="tag__kopf"><span class="tag__name">Körpergewicht</span></div>'
            + '<p class="tag__leer">Nur nötig für Klimmzug und Dips: dort ist die '
            + 'bewegte Last dein Gewicht minus der Hilfe. Jeder Eintrag gilt ab '
            + 'seinem Datum.</p>'
            /*
             * Dieselbe Form wie das Übungsformular: Beschriftung darüber,
             * zwei Felder nebeneinander, Knopf darunter. Vorher standen
             * Datum und Kilo ohne Beschriftung nebeneinander, beide in der
             * großen Monospace des Passwortfelds — das Datum füllte sein
             * Feld bis an den Rand und schob die Kalenderschaltfläche
             * hinaus, und welches Feld was war, stand nirgends.
             */
            + '<form class="formular" id="gewicht-form">'
            + '<div class="paar">'
            + '<div><label class="mini" for="g-datum">Datum</label>'
            + '<input class="feld feld--text" type="date" id="g-datum" name="date" '
            + 'value="' + esc(heute) + '" max="' + esc(heute) + '"></div>'
            /*
             * type="text" und nicht type="number": Auf der deutschen
             * Tastatur ist die Dezimaltaste ein Komma, und ein
             * Zahlenfeld weist das als ungültig zurück — das Feld bliebe
             * beim Absenden einfach leer. Die App schreibt Zahlen
             * ohnehin überall mit Komma, also nimmt sie hier auch eins
             * entgegen. Die Prüfung macht der Server.
             */
            + '<div><label class="mini" for="g-kg">Gewicht in kg</label>'
            + '<input class="feld feld--text" type="text" id="g-kg" name="kg" '
            + 'inputmode="decimal" placeholder="84,5"></div>'
            + '</div>'
            + '<button class="knopf" type="submit">Eintragen</button>'
            + '</form>';

        // Jüngste zuerst: der letzte Gang auf die Waage ist der, den man
        // sucht, wenn man hier hereinschaut.
        liste.slice().reverse().forEach(function (e) {
            html += '<div class="zeile zeile--schmal">'
                + '<span class="zeile__name">' + esc(datum(e.date)) + '</span>'
                + '<span class="zeile__daten">' + esc(zahl(e.kg)) + ' kg</span>'
                + '<button class="satz__korr" data-gewichtweg="' + esc(e.date)
                + '">löschen</button></div>';
        });

        return html + '</section>';
    }

    function zeichneSchwerpunkte() {
        const p = zustand.plan.muscle_priorities || {};

        // Ohne Muskelgruppen gäbe es eine Überschrift ohne einen einzigen
        // Schalter darunter. Eine Rubrik, die nichts enthält, ist keine
        // Rubrik, sondern ein Fehler auf dem Bildschirm.
        if (Object.keys(p).length === 0) {
            return '';
        }

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

    /**
     * Bereich "Allgemein": Passwort ändern.
     *
     * Das alte Passwort wird mit abgefragt, obwohl man angemeldet ist. Die
     * Anmeldung hält 30 Tage und liegt auf einem Handy, das man auch mal
     * liegen lässt; ohne die Abfrage genügte ein unbeaufsichtigtes Gerät,
     * um den Zugang zu übernehmen.
     *
     * Die drei Felder tragen autocomplete-Angaben, damit ein Passwort-
     * verwalter das alte einsetzen und das neue anbieten kann. Ohne sie
     * hält iOS alle drei für dasselbe Feld.
     */
    function zeichnePasswort() {
        let html = '<section class="tag">'
            + '<div class="tag__kopf"><span class="tag__name">Passwort</span></div>'
            + '<p class="tag__leer">Mindestens 8 Zeichen. Auf diesem Gerät '
            + 'bleibst du angemeldet.</p>'

            /*
             * novalidate wie bei den Anmeldeformularen in index.php: Die
             * App prüft selbst und schreibt die Meldung an ihre Stelle im
             * Formular. Die eingebaute Prüfung des Browsers käme als
             * Sprechblase in fremder Gestalt, säße woanders und sagte je
             * nach Browser etwas anderes.
             */
            + '<form class="formular" id="passwort-form" novalidate>'
            + '<label class="mini" for="p-alt">Aktuelles Passwort</label>'
            + '<input class="feld feld--text" type="password" id="p-alt" '
            + 'name="current" autocomplete="current-password">'

            + '<label class="mini" for="p-neu">Neues Passwort</label>'
            + '<input class="feld feld--text" type="password" id="p-neu" '
            + 'name="password" autocomplete="new-password">'

            + '<label class="mini" for="p-neu2">Noch einmal</label>'
            + '<input class="feld feld--text" type="password" id="p-neu2" '
            + 'name="password_repeat" autocomplete="new-password">';

        /*
         * Rückmeldung direkt über dem Knopf, nicht oben am Seitenkopf.
         * Wer gerade auf "Passwort ändern" getippt hat, schaut dorthin,
         * wo sein Daumen ist.
         */
        if (zustand.passwortText) {
            html += zustand.passwortOk
                ? '<p class="quittung" role="status">' + esc(zustand.passwortText) + '</p>'
                : '<p class="fehler" role="alert">' + esc(zustand.passwortText) + '</p>';
        }

        return html + '<button class="knopf" type="submit">Passwort ändern</button>'
            + '</form></section>';
    }

    /* ---------- Zeichnen ---------- */

    function zeichnen() {
        if (zustand.ansicht === 'plan') {
            app.innerHTML = zeichnePlan();
        } else if (zustand.ansicht === 'uebung') {
            app.innerHTML = zeichneUebung();
        } else if (zustand.ansicht === 'kalender') {
            app.innerHTML = zeichneKalender();
        } else if (zustand.ansicht === 'ausgeblendet') {
            app.innerHTML = zeichneAusgeblendet();
        } else if (zustand.ansicht === 'einheit') {
            app.innerHTML = zeichneEinheit();
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

    /** Holt einen Monat für den Kalender. */
    async function kalenderLaden(monat) {
        try {
            zustand.kalender = await api('api/einheiten.php?monat='
                + encodeURIComponent(monat));
        } catch (err) {
            zustand.meldung = err.message;
        }
    }

    /**
     * Eine Einheit anhand ihres Schlüssels finden.
     *
     * Sie kann aus dem Rückblick der Startseite kommen oder aus einem
     * Kalendermonat. Beide Wege führen in dieselbe Detailansicht, also
     * sucht sie in beiden Beständen statt zu wissen, woher man kam.
     */
    function einheitFinden(key) {
        const quellen = [
            (zustand.einheiten && zustand.einheiten.sessions) || [],
            (zustand.kalender && zustand.kalender.sessions) || [],
        ];

        for (const liste of quellen) {
            const treffer = liste.find(function (x) { return x.key === key; });
            if (treffer) {
                return treffer;
            }
        }

        return null;
    }

    /**
     * Holt den Rückblick nach.
     *
     * Im Hintergrund und ohne await: die Startseite soll sofort stehen, der
     * Rückblick ist eine Zugabe. Ohne Netz fehlt er ganz — zurückgeblickt
     * wird zu Hause, und ein Puffer dafür wäre Aufwand für einen Fall, den
     * es nicht gibt.
     */
    function einheitenHolen() {
        api('api/einheiten.php?offset=' + (zustand.rueckblickVersatz || 0))
            .then(function (antwort) {
                zustand.einheiten = antwort;
                if (zustand.ansicht === 'start') {
                    zeichnen();
                }
            })
            .catch(function () { zustand.einheiten = null; });
    }

    /**
     * Eine Seite im Rückblick weiter. Klappt das Laden nicht (Funkloch),
     * bleibt die bisherige Seite stehen, statt die Liste wegzunehmen.
     */
    async function rueckblickBlaettern(richtung) {
        const r = zustand.einheiten;
        if (!r) {
            return;
        }
        const schritt = r.limit || 10;
        const vorher = zustand.rueckblickVersatz || 0;
        const neu = richtung === 'aelter' ? vorher + schritt : Math.max(0, vorher - schritt);
        try {
            zustand.einheiten = await api('api/einheiten.php?offset=' + neu);
            zustand.rueckblickVersatz = neu;
        } catch (err) {
            return;
        }
        zeichnen();
    }

    /**
     * Holt die Studio-Ansicht, mit dem lokalen Stand als Rückfall.
     *
     * Ohne Netz ist der gemerkte Stand die einzige Möglichkeit, im Studio
     * überhaupt etwas zu sehen. Er kann veraltet sein, aber ein veralteter
     * Plan ist im Zweifel richtig: Übungen und Zielvorgaben ändern sich
     * selten, und die eigenen Sätze von heute stecken mit drin.
     */
    async function studioLaden(tag) {
        const pfad = 'api/plan.php' + (tag ? '?day=' + encodeURIComponent(tag) : '');

        try {
            zustand.studio = await api(pfad);
            zustand.ausPuffer = false;
            planMerken();
        } catch (err) {
            const gemerkt = planErinnern(tag);
            if (!gemerkt) {
                throw err;
            }
            zustand.studio = gemerkt;
            zustand.ausPuffer = true;
        }
    }

    function uebungImStudio(id) {
        return (zustand.studio.exercises || []).find(function (u) { return u.id === id; });
    }

    /* ---------- Ereignisse ---------- */

    /**
     * Wechselt die Ansicht. Aufgerufen vom Klick auf ein data-gehe in #app
     * und vom Menü oben rechts, das außerhalb von #app liegt.
     *
     * abschluss: true für den Ausgang aus einer Einheit (pausieren oder
     * beenden).
     */
    async function gehe(ziel, abschluss) {
        zustand.ansicht = ziel;
        zustand.uebungId = null;
        zustand.offen = null;
        zustand.meldung = '';
        zustand.passwortText = '';
        if (ziel !== 'studio') {
            pauseBeenden();
        }
        /*
         * "Einheit beenden" gibt den Tag wieder frei. Ohne das bot die
         * Startseite weiter die gerade abgeschlossene Einheit an, und
         * "Weiter trainieren" führte zurück in eine Liste, in der alles
         * abgehakt war und nur wieder "Einheit beenden" stand.
         */
        if (abschluss) {
            zustand.tagWahl = null;
        }

        if (ziel === 'start' || ziel === 'studio') {
            try {
                await studioLaden(zustand.tagWahl);

                /*
                 * Wer das Studio betritt, hält den Tag fest. Der Server
                 * schlägt ab dem ersten bestätigten Satz schon den
                 * nächsten Tag vor, weil die laufende Einheit dann die
                 * letzte in den Logs ist. Ohne das Festhalten spränge
                 * die Ansicht mitten in der Einheit weg.
                 */
                if (ziel === 'studio' && zustand.studio) {
                    zustand.tagWahl = zustand.studio.day.key;
                }
            } catch (err) {
                zustand.meldung = err.message;
            }
        }

        // Nach einer Einheit steht ein Eintrag mehr im Rückblick, und der
        // steht auf der ersten Seite.
        if (ziel === 'start') {
            zustand.rueckblickVersatz = 0;
            einheitenHolen();
        }

        // Beim ersten Betreten den laufenden Monat. Kommt man aus einer
        // Einheit zurück, bleibt der Monat stehen, den man angesehen hat.
        if (ziel === 'kalender' && !zustand.kalender) {
            await kalenderLaden(monatVon(new Date()));
        }

        zeichnen();

        // Der Ausgang aus der Einheit liegt unter der letzten Kachel. Ohne
        // das stünde man danach unten auf der Startseite statt bei
        // Trainingstag und Knopf (Frank, 23.10.2026).
        if (abschluss) {
            window.scrollTo(0, 0);
        }
        return;
    }

    app.addEventListener('click', async function (e) {
        const ziel = e.target.closest('[data-gehe], [data-tag], [data-monat], [data-einheit], [data-oeffne], '
            + '[data-foto], [data-bild], [data-bildweg], '
            + '[data-bestaetige], [data-korrigiere], [data-extra], [data-bearbeite], '
            + '[data-neu], [data-abbrechen], [data-prio], '
            + '[data-gewichtweg], [data-bereich], [data-weiter], '
            + '[data-anleitung], [data-verlauf], [data-seite], [data-entfernen], [data-aktivieren], [data-endgueltig]');
        if (!ziel) {
            return;
        }
        const d = ziel.dataset;

        /* --- Navigation --- */

        if (d.gehe) {
            return gehe(d.gehe, !!d.abschluss);
        }

        /*
         * Bereichswechsel in den Einstellungen. Eine stehengebliebene
         * Rückmeldung geht dabei weg: "Passwort geändert." unter dem
         * Gewichtsformular hätte niemand mehr zuzuordnen.
         */
        if (d.bereich) {
            zustand.planBereich = d.bereich;
            zustand.meldung = '';
            zustand.passwortText = '';
            window.scrollTo(0, 0);
            return zeichnen();
        }

        /*
         * Eine offene Einheit aus der Liste fortsetzen.
         *
         * Nicht derselbe Weg wie data-tag: Der lädt den Tag und bleibt auf
         * der Startseite. Hier soll man direkt im Studio landen, denn man
         * hat auf eine Einheit getippt, um weiterzumachen.
         *
         * tagWahl wird erst nach dem Laden gesetzt, sonst hielte ein
         * Fehlschlag einen Tag fest, den man nie zu sehen bekam.
         */
        if (d.weiter) {
            try {
                await studioLaden(d.weiter);
                zustand.tagWahl = d.weiter;
                zustand.ansicht = 'studio';
                window.scrollTo(0, 0);
            } catch (err) {
                zustand.meldung = err.message;
            }
            return zeichnen();
        }

        if (d.monat) {
            await kalenderLaden(d.monat);
            window.scrollTo(0, 0);
            return zeichnen();
        }

        if (d.einheit) {
            // Von wo aus aufgeschlagen? Dorthin führt "Zurück" wieder.
            zustand.einheitHer = zustand.ansicht === 'kalender' ? 'kalender' : 'start';
            zustand.einheitKey = d.einheit;
            zustand.ansicht = 'einheit';
            zustand.meldung = '';
            window.scrollTo(0, 0);
            return zeichnen();
        }

        if (d.tag) {
            try {
                await studioLaden(d.tag);
                zustand.tagWahl = d.tag;   // erst nach dem Laden, sonst hielte ein Fehlschlag fest
            } catch (err) {
                zustand.meldung = err.message;
            }
            return zeichnen();
        }

        /* --- Studio --- */

        if (d.bildweg) {
            if (zustand.bildLoeschfrage !== d.bildweg) {
                zustand.bildLoeschfrage = d.bildweg;   // erster Schritt
                return zeichnenNurAuswahl();
            }

            try {
                const antwort = await api('api/foto-loeschen.php',
                    { daten: { photo: d.bildweg } });
                zustand.uebungen = antwort.exercises || {};
                zustand.fotos = (zustand.fotos || [])
                    .filter(function (f) { return f !== d.bildweg; });

                const versteckt = document.getElementById('e-photo');
                if (versteckt && versteckt.value === d.bildweg) {
                    versteckt.value = '';
                }
            } catch (err) {
                zustand.meldung = err.message;
            }
            zustand.bildLoeschfrage = null;
            return zeichnenNurAuswahl();
        }

        if (ziel.dataset.bild !== undefined) {
            zustand.bildLoeschfrage = null;
            // Nur die Markierung umsetzen, nicht die ganze Ansicht neu
            // zeichnen: sonst verlöre das halb ausgefüllte Formular
            // darüber seine Eingaben.
            const feld = document.getElementById('e-photo');
            if (feld) {
                feld.value = ziel.dataset.bild;
                const wahl = document.getElementById('bildwahl');
                wahl.querySelectorAll('.ist-gewaehlt').forEach(function (k) {
                    k.classList.remove('ist-gewaehlt');
                });
                ziel.classList.add('ist-gewaehlt');
            }
            return;
        }

        if (d.foto) {
            // Nicht die Übung auf- oder zuklappen: das Foto hat sein
            // eigenes Ziel, sonst würde ein Blick aufs Gerät die Kachel
            // schließen, an der man gerade arbeitet.
            lupeZeigen(d.foto, d.name || '', d.nummer || '', d.anleitung || '');
            return;
        }

        if (d.verlauf) {
            verlaufZeigen(d.verlauf);
            return;
        }

        if (d.seite) {
            return rueckblickBlaettern(d.seite);
        }

        if (d.entfernen) {
            return frageEntfernen(d.entfernen);
        }

        if (d.endgueltig) {
            return frageEndgueltig(d.endgueltig);
        }

        if (d.aktivieren) {
            return uebungAktivieren(d.aktivieren);
        }

        if (d.oeffne) {
            zustand.offen = zustand.offen === d.oeffne ? null : d.oeffne;
            delete zustand.entwurf[d.oeffne];
            return zeichnen();
        }

        if (d.anleitung) {
            const u = uebungImStudio(d.anleitung);
            if (u) {
                lupeZeigen(u.photo || '', u.name, u.station || '', u.id);
            }
            return;
        }

        // data-aendere läuft nicht über den Klick, sondern über
        // pointerdown mit Wiederholung beim Halten (siehe weiter unten).

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

            const eintrag = {
                day: zustand.studio.day.key,
                rotation_index: zustand.studio.rotation_index,
                exercise_id: u.id,
                set_index: index,
                weight: e2.weight,
                reps: e2.reps,
                performed_at: new Date().toISOString(),
            };

            // Erst lokal festhalten, dann anzeigen, dann senden. Der Satz
            // gilt, sobald er im Puffer liegt; ob das Netz mitspielt, ist
            // eine Frage von später und nicht von jetzt.
            const gemerkt = warteschlange.anhaengen(eintrag);

            if (!gemerkt) {
                zustand.meldung = 'Der Satz lässt sich nicht zwischenspeichern. '
                    + 'Ist der Speicher des Browsers voll oder gesperrt?';
                return zeichnen();
            }

            const heute = (u.today || []).slice();
            heute[index] = { weight: e2.weight, reps: e2.reps };
            u.today = heute;

            delete zustand.entwurf[u.id];
            zustand.meldung = '';

            /*
             * Wohin als Nächstes? Ist die Übung durch, zur nächsten offenen,
             * sonst bleibt sie offen. Jede Übung wird am Stück gemacht.
             *
             * Bis zum 23.10.2026 sprang die App bei gepaarten Übungen nach
             * jedem Satz zur Partnerübung, mit kürzerer Pause. Frank hat das
             * herausgenommen: Er hatte es nie bemerkt, und es kostet die
             * Übersicht, wenn die Liste nicht der Reihe nach läuft.
             */
            let gewechselt = false;

            if (heute.length >= u.target_sets) {
                const dran = naechsteOffene();
                zustand.offen = dran ? dran.id : null;
                gewechselt = true;
            }

            planMerken();
            zeichnen();

            if (gewechselt && zustand.offen) {
                const kachel = app.querySelector('[data-uebung="' + zustand.offen + '"]');
                if (kachel) {
                    kachel.scrollIntoView({ block: 'start', behavior: 'smooth' });
                }
            }

            /*
             * Eine Pause dient dem nächsten Satz. Ist die Einheit durch,
             * gibt es keinen mehr — dann zwei Minuten herunterzuzählen
             * hieße, jemanden vor dem Ausgang warten zu lassen. Läuft
             * gerade noch eine Pause vom vorigen Satz, wird sie beendet.
             *
             * Geprüft wird der ganze Tag und nicht nur die eigene Übung:
             * Der letzte Satz kann irgendwo mitten in der Liste liegen,
             * wenn man sie nicht der Reihe nach abarbeitet.
             */
            const nochOffen = (zustand.studio.exercises || []).some(function (x) {
                return ((x.today || []).length) < x.target_sets;
            });

            if (!nochOffen) {
                pauseBeenden();
                puffernSenden();
                return;
            }

            pauseStarten(zustand.studio.rest_timer_seconds);

            puffernSenden();   // bewusst ohne await: die Pause läuft schon
            return;
        }

        /* --- Einstellungen --- */

        if (d.bearbeite) {
            zustand.uebungHer = ['einheit', 'ausgeblendet'].indexOf(zustand.ansicht) >= 0
                ? zustand.ansicht : 'plan';
            zustand.ansicht = 'uebung';
            zustand.uebungId = d.bearbeite;
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
            zustand.ansicht = ausDemFormular();
            zustand.meldung = '';
            return zeichnen();
        }

        if (d.gewichtweg) {
            try {
                zustand.gewicht = await api('api/gewicht.php',
                    { daten: { date: d.gewichtweg, weg: true } });
                einheitenHolen();   // die Kurve rechnet sich damit anders
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

    /*
     * Foto hochladen.
     *
     * Läuft über FormData und nicht über die JSON-Hilfsfunktion, weil eine
     * Datei nun mal nicht in JSON passt. Nach dem Hochladen wird das neue
     * Bild sofort ausgewählt: wer gerade das Gerät fotografiert hat, will
     * es nicht anschließend in einem Raster suchen.
     *
     * Der Rest des Formulars wird dabei nicht neu gezeichnet, sonst wären
     * halb eingetippte Werte weg.
     */
    app.addEventListener('change', async function (e) {
        const feld = e.target;
        if (feld.id !== 'e-upload' || !feld.files || !feld.files[0]) {
            return;
        }

        const anzeige = document.getElementById('hochladen-text');
        const alterText = anzeige ? anzeige.textContent : '';
        if (anzeige) {
            anzeige.textContent = 'Wird hochgeladen';
        }

        const paket = new FormData();
        paket.append('foto', feld.files[0]);

        try {
            const antwort = await fetch('api/foto-upload.php', {
                method: 'POST',
                body: paket,
            });
            const inhalt = await antwort.json();

            if (!antwort.ok) {
                throw new Error(inhalt.error || 'Der Upload ist fehlgeschlagen.');
            }

            const datei = inhalt.photo;
            zustand.fotos = [datei].concat(zustand.fotos || []);

            // Neues Bild vorn einhängen und gleich auswählen.
            const wahl = document.getElementById('bildwahl');
            const versteckt = document.getElementById('e-photo');
            if (wahl && versteckt) {
                wahl.querySelectorAll('.ist-gewaehlt').forEach(function (k) {
                    k.classList.remove('ist-gewaehlt');
                });
                const knopf = document.createElement('button');
                knopf.type = 'button';
                knopf.className = 'bildwahl__stueck ist-gewaehlt';
                knopf.dataset.bild = datei;
                knopf.title = datei;
                knopf.innerHTML = '<img src="assets/img/exercises/' + esc(datei) + '" alt="">';
                wahl.insertBefore(knopf, wahl.children[1] || null);
                versteckt.value = datei;
            }

            if (anzeige) {
                anzeige.textContent = 'Foto übernommen, noch speichern';
            }
        } catch (err) {
            if (anzeige) {
                anzeige.textContent = err.message;
            }
        }

        feld.value = '';   // damit dieselbe Datei erneut gewählt werden kann
        setTimeout(function () {
            if (anzeige && anzeige.textContent !== alterText) {
                anzeige.textContent = alterText;
            }
        }, 4000);
    });

    app.addEventListener('submit', async function (e) {
        const gform = e.target.closest('#gewicht-form');
        if (gform) {
            e.preventDefault();
            const daten = {};
            new FormData(gform).forEach(function (wert, schluessel) {
                daten[schluessel] = wert;
            });

            try {
                zustand.gewicht = await api('api/gewicht.php', { daten: daten });
                zustand.meldung = '';
                einheitenHolen();   // die Kurve rechnet sich damit anders
            } catch (err) {
                zustand.meldung = err.message;
            }
            return zeichnen();
        }

        const pform = e.target.closest('#passwort-form');
        if (pform) {
            e.preventDefault();
            const daten = {};
            new FormData(pform).forEach(function (wert, schluessel) {
                daten[schluessel] = wert;
            });

            const knopf = pform.querySelector('button[type="submit"]');
            knopf.disabled = true;
            knopf.textContent = 'Moment';

            try {
                await api('api/passwort.php', { daten: daten });
                zustand.passwortText = 'Passwort geändert.';
                zustand.passwortOk = true;
            } catch (err) {
                zustand.passwortText = err.message;
                zustand.passwortOk = false;
            }
            // Neu zeichnen leert die drei Felder. Nach einem Fehlschlag
            // ist das gewollt: welches der drei falsch war, weiß man
            // nicht, und ein halb gefülltes Formular lädt zum Raten ein.
            return zeichnen();
        }

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
            zustand.ansicht = ausDemFormular();
            zustand.uebungId = null;
            zustand.meldung = '';
        } catch (err) {
            zustand.meldung = err.message;
        }
        zeichnen();
    });

    /* ---------- Plus und Minus, mit Wiederholung beim Halten ----------
     *
     * Ein Tipp ist eine Stufe, Gedrückthalten läuft weiter und wird
     * schneller. Ohne das wäre die erste Einheit unbedienbar: von 0 auf
     * 80 kg in 2,5er-Schritten sind 32 Antipper. Eine Tastatur verbietet
     * SPEC.md §5.2, und ein sinnvoller Startwert lässt sich nicht raten.
     *
     * Beim Halten wird nur die Zahl im DOM ausgetauscht und nicht die
     * ganze Ansicht neu gezeichnet: sonst würde der Knopf unter dem
     * Daumen zehnmal pro Sekunde ersetzt.
     */

    let haltenVerzoegerung = null;
    let haltenTakt = null;

    function haltenStoppen() {
        clearTimeout(haltenVerzoegerung);
        clearInterval(haltenTakt);
        haltenVerzoegerung = haltenTakt = null;
    }

    function schrittAnwenden(spec, knopf) {
        const teile = spec.split(':');
        const u = uebungImStudio(teile[0]);
        if (!u) {
            return false;
        }

        const e2 = zustand.entwurf[u.id] || vorbelegung(u);
        const richtung = parseInt(teile[2], 10);

        if (teile[1] === 'weight') {
            e2.weight = Math.max(0, Math.round((e2.weight + richtung * u.weight_step) * 100) / 100);
        } else {
            e2.reps = Math.max(1, e2.reps + richtung);
        }
        zustand.entwurf[u.id] = e2;

        /*
         * Nur die Zahl anfassen, nicht die ganze Anzeige.
         *
         * Hier stand `anzeige.textContent = …` auf `.regler__wert`, und das
         * ersetzt den gesamten Inhalt — also auch die beiden Spans, die die
         * Zahl groß und die Einheit klein setzen. Nach dem ersten Tipp auf
         * Plus war der Wert reiner Text und schrumpfte auf die kleine
         * Schrift des Elternelements.
         *
         * Die Einheit bleibt unberührt: aus kg wird beim Zählen kein Wdh.
         */
        const zahlEl = knopf && knopf.isConnected
            ? knopf.closest('.regler').querySelector('.regler__zahl')
            : null;

        if (zahlEl) {
            zahlEl.textContent = teile[1] === 'weight'
                ? zahl(e2.weight)
                : String(e2.reps);
            return true;
        }

        zeichnen();   // Knopf nicht mehr im DOM, dann eben ganz neu
        return false;
    }

    app.addEventListener('pointerdown', function (e) {
        const knopf = e.target.closest('[data-aendere]');
        if (!knopf) {
            return;
        }
        e.preventDefault();

        const spec = knopf.dataset.aendere;
        if (!schrittAnwenden(spec, knopf)) {
            return;
        }

        // Erst nach einer kurzen Weile loslaufen, damit ein normaler Tipp
        // eine einzelne Stufe bleibt. Danach beschleunigen, damit auch
        // große Sprünge in wenigen Sekunden erreichbar sind.
        let takt = 130;

        function weiter() {
            if (!schrittAnwenden(spec, knopf)) {
                haltenStoppen();
                return;
            }
            if (takt > 45) {
                takt -= 10;
                clearInterval(haltenTakt);
                haltenTakt = setInterval(weiter, takt);
            }
        }

        haltenVerzoegerung = setTimeout(function () {
            haltenTakt = setInterval(weiter, takt);
        }, 350);
    });

    ['pointerup', 'pointercancel', 'blur'].forEach(function (ereignis) {
        addEventListener(ereignis, haltenStoppen);
    });

    /*
     * Tippen im Diagramm wählt eine Einheit aus. Auf dem Handy gibt es kein
     * Hover, also übernimmt der Fingertipp die Rolle des Fadenkreuzes.
     * Gerechnet wird in viewBox-Koordinaten, weil das SVG mitskaliert.
     */
    app.addEventListener('pointerdown', function (e) {
        const svg = e.target.closest('.chart');
        // Nur in der Verlaufsansicht. Die Fortschrittskurve auf der
        // Startseite trägt dieselbe Klasse, hätte hier aber ganz andere
        // Punkte — ohne diese Bedingung liefe der Tipp in fremde Daten.
        if (!svg || zustand.ansicht !== 'uebung' || !zustand.verlauf) {
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
        statusZeichnen();
        puffernSenden();       // was vom letzten Mal liegengeblieben ist

        try {
            const [einstellungen, uebungen] = await Promise.all([
                api('api/settings.php'),
                api('api/exercises.php'),
            ]);
            zustand.plan = einstellungen.plan || {};
            zustand.uebungen = uebungen.exercises || {};

            // Jetzt erst steht der Uebungsname zur Verfuegung. Ohne das
            // naechte die Statusleiste einen abgelehnten Satz mit seiner
            // Kennung statt mit seinem Namen.
            statusZeichnen();

            // Die Fotoliste im Hintergrund holen, sie wird erst im
            // Verwaltungsbereich gebraucht und soll den Start nicht bremsen.
            api('api/gewicht.php')
                .then(function (a) { zustand.gewicht = a; })
                .catch(function () { zustand.gewicht = null; });

            api('api/fotos.php')
                .then(function (a) { zustand.fotos = a.photos || []; })
                .catch(function () { zustand.fotos = []; });

            if (Object.keys(zustand.uebungen).length > 0) {
                try {
                    await studioLaden(null);
                } catch (err) {
                    zustand.meldung = err.message;
                }
                einheitenHolen();
            }

            zeichnen();
            return;
        } catch (err) {
            if (!err.netz) {
                app.innerHTML = '<p class="fehler">' + esc(err.message) + '</p>';
                return;
            }
        }

        // Ohne Netz: mit dem zuletzt gemerkten Stand weiterarbeiten. Die
        // Verwaltung bleibt zu (sie braucht den Server), das Studio geht.
        const gemerkt = planErinnern(null);

        if (!gemerkt) {
            app.innerHTML = '<p class="fehler">Keine Verbindung, und hier liegt '
                + 'noch kein Trainingstag bereit. Einmal mit Netz öffnen, danach '
                + 'geht es auch im Funkloch.</p>';
            return;
        }

        zustand.studio = gemerkt;
        zustand.ausPuffer = true;
        zustand.plan = null;
        zeichnen();
    })();
})();
