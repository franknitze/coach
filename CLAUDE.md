# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stand

`SPEC.md` (deutsch, ~290 Zeilen) ist die verbindliche Vorgabe und die einzige Quelle dafür, was gebaut wird. Vor jedem Implementierungsvorschlag lesen; das Dokument ist so geschrieben, dass sich der Plan ohne Rückfragen ableiten lässt. Die Phasen 0 bis 6 in §10 sind die vorgegebene Reihenfolge.

Die Phasen 0 bis 5 aus §10 sind gebaut und laufen live auf dem Server. Der Trainingsplan steht mit 25 Übungen in den Daten, jede mit zugeordnetem Bild. Offen sind nur noch zwei Dinge:

| Steht | Fehlt |
|---|---|
| `lib/`: `storage`, `config`, `auth`, `uebungen`, `training`, `coach`, `gewicht`, `fortschritt`, `standardplan` | **der n8n-Workflow**, der `export.php` abholt (siehe unten). `data/` auf dem Server hat damit **keine Sicherung**. |
| `api/`: `login`, `logout`, `exercises`, `settings`, `plan`, `session`, `history`, `coach`, `einheiten`, `gewicht`, `export`, `setup`, `passwort`, `fotos`, `foto-upload`, `foto-loeschen` | Phase 6 (KI-Coach), ausdrücklich optional |
| `index.php`, `assets/`: Start mit Rückblick und Fortschrittskurve, Studio, Einstellungen, Übungsdetail mit Verlauf, abgeschlossene Einheit, Kalender, Coach-Ansage | |
| `manifest.json`, `service-worker.js`, `assets/icons/`, Offline-Puffer | |
| `.htaccess`, `bin/` (init-config, plan-anlegen, fotos, deploy, icons), `tests/` (377 Prüfungen) | |

Der flüchtige Arbeitsstand steht in `STATE.md`. Die Datei ist **nicht versioniert** (siehe `.gitignore`): Sie handelt nur von dieser einen Installation und liegt ausschließlich auf Franks Rechner. Wer das Repo frisch klont, hat sie nicht, und das ist Absicht.

Drei Abweichungen von SPEC.md, alle bewusst:

- **`lib/`** gibt es in der Spezifikation nicht. Ohne gemeinsame Bibliothek müssten Pfadkonstante, atomares Schreiben, Session-Gate und Übungsprüfung in jedem Endpunkt neu stehen. `.htaccess` sperrt den Ordner nach außen.
- **`api/settings.php`** verwaltet die Struktur von `plan.json` (Rotation, Schwerpunkte), weil §3 den Namen `plan.php` für die Studio-Ansicht aus Phase 2 vergibt (heutiger Tag samt Übungen und letzten Werten). Zwei verschiedene Aufgaben, zwei Endpunkte.
- **Feld `station`** in `exercises.json`, optional, zusätzlich zum Schema in §4: die aufgeklebte Gerätenummer aus dem Studio. Sie ist der Grund, warum man das richtige Gerät wiederfindet, und trägt die Plakette in der Oberfläche.
- **Feld `rotation_index`** in jeder Session, zusätzlich zum Schema in §4. Die Rotation darf denselben Tag mehrfach enthalten (`oberkoerper, unterkoerper, oberkoerper`), über den Tagesnamen allein wäre die Position also nicht eindeutig und der Vorschlag würde zwischen zwei Positionen hängenbleiben. Ältere Einträge ohne das Feld fallen auf die Namenssuche zurück.

**Sätze werden einzeln gespeichert, nicht am Ende der Einheit.** Jede Bestätigung ist ein eigener POST auf `session.php` mit `set_index`. Damit ist der Aufruf wiederholbar: ein Doppel-Tap oder ein Wiederholungsversuch überschreibt denselben Satz, statt ihn ein zweites Mal anzuhängen, und dasselbe Feld erlaubt das Korrigieren eines bereits bestätigten Satzes. Im Studio kann der Akku leer werden; was bestätigt ist, liegt auf der Platte.

- **Der Export nimmt `password_hash` und `api_key` nicht mit** und lässt den Schlüssel auch als Header `X-API-Key` zu, nicht nur als `?key=` wie in §9. Query-Strings landen im Zugriffsprotokoll des Webservers, bei All-Inkl liest die Statistik dort mit; ein Header steht nicht drin. Der Weg über `?key=` funktioniert weiter. Und ein Backup, das regelmäßig auf einen Zweitserver wandert und durch n8n-Protokolle läuft, soll keine Geheimnisse tragen: Passwort und Schlüssel sind mit `bin/init-config.php` in zwei Minuten neu gesetzt, die Trainingsdaten nicht.

- **Kein Diagramm-Nachladen.** SPEC.md §2 empfiehlt uPlot oder Chart.js per CDN. Gebraucht wird eine Linie mit zwei Achsen, dafür lohnt keine Bibliothek, und ein CDN-Skript widerspricht der PWA, die offline laufen soll. Die Kurven sind Inline-SVG in `assets/app.js` (`chart()`), rund 60 Zeilen. Falls doch eine Bibliothek gewünscht ist, wäre sie selbst gehostet einzubinden, nicht per CDN.

**Die Reihenfolge der Sessions braucht ein zweites Kriterium.** `date` ist auf die Sekunde genau. Zwei Einträge derselben Sekunde wären nicht unterscheidbar, und „welche war die letzte" entschiede der Zufall, was den Tagesvorschlag verdreht. `logs_monat()` sortiert deshalb nach Datum **und** Position in der Datei.

`bin/init-config.php` richtet `data/` ein (Passwort-Hash, API-Key, Grundgerüst von `plan.json`). Läuft nur auf der Kommandozeile und wird nicht auf den Server geladen.

## Worum es geht

Persönliche Trainings-App für genau einen Nutzer (Frank), einziges Ziel Muskelaufbau. Sie läuft auf klassischem Shared Hosting bei All-Inkl: vanilla PHP, JSON-Dateien statt Datenbank, HTML/CSS/Vanilla-JS als Single-Page-App, PWA-Hülle für das Homescreen-Icon. Kein Framework, kein Build-Schritt, kein Docker. Backups zieht ein n8n-Workflow über einen schlüsselgeschützten Endpunkt.

Der zentrale Bedienfall ist das Studio: Eingabe nur mit dem Daumen, große Plus/Minus-Buttons, nie Tastatur, Felder mit dem letzten Ergebnis vorbefüllt, damit gleiche Leistung nur bestätigt werden muss.

## Entscheidungen, die den ganzen Code binden

Diese Punkte stehen verteilt in der Spezifikation und ergeben zusammen die Architektur.

**Das Frontend spricht ausschließlich mit der PHP-API, nie mit den JSON-Dateien.** Es gibt keinen Pfad, auf dem der Browser eine Datei aus `data/` direkt liest. Der Schutz von `data/` hat zwei Ebenen (§8): bevorzugt liegt der Ordner eine Ebene über dem Web-Root, zusätzlich sperrt eine `.htaccess`-Regel den Zugriff. Ob die Ebene über dem Web-Root bei diesem All-Inkl-Paket existiert, ist noch nicht geprüft. Deshalb steht der Pfad zu `data/` an **einer** Stelle (`DATA_DIR` in `lib/config.php`), damit der Umzug später eine Zeile ist und keine Suche über alle Endpunkte. Die Umgebungsvariable `COACH_DATA` sticht ihn; darüber laufen die Tests in einem eigenen Verzeichnis.

**Zwei getrennte Zugangswege.** Alle Endpunkte prüfen die Session, mit genau zwei Ausnahmen: `login.php` (setzt sie) und `export.php` (prüft stattdessen `api_key` gegen `config.json`, weil n8n sich nicht einloggen kann). Beim Anlegen eines neuen Endpunkts ist die Session-Prüfung der Normalfall.

**`api/passwort.php` prüft als einziger Endpunkt zusätzlich das Passwort selbst** und antwortet bei falscher Eingabe mit **403, nicht mit 401**. Der Grund liegt im Frontend: `api()` in `assets/app.js` liest eine 401 im angemeldeten Bereich als „Sitzung abgelaufen" und lädt die Seite neu. Mit 401 wäre die Meldung „Das aktuelle Passwort stimmt nicht" wortlos verschwunden und man stünde wieder auf der Startseite. Wer einen Endpunkt baut, der etwas ablehnt, obwohl der Nutzer angemeldet ist, nimmt 403.

Das alte Passwort wird trotz geprüfter Session verlangt. Sie hält 30 Tage und liegt auf einem Handy, das man auch mal liegen lässt; ohne die Abfrage genügte ein unbeaufsichtigtes Gerät, um den Zugang zu übernehmen. Geschrieben wird über `json_update()` und nicht mit einer neuen Datei: Ginge dabei der `api_key` verloren, holte das Backup ab sofort nichts mehr ab, und es fiele niemandem auf. Ein Test prüft genau das.

**JSON-Dateien als Datenhaltung heißt: jeder Schreibvorgang liest die ganze Datei, ändert sie und schreibt sie zurück.** Ohne Sperre (`flock`) oder atomares Schreiben (temporäre Datei plus `rename`) zerlegt ein abgebrochener Request eine Datei komplett. Es gibt nur einen Nutzer, aber Doppel-Tap auf einen Bestätigungs-Button und ein Service-Worker-Retry reichen für zwei parallele Requests.

**Die Trainingsdaten liegen monatsweise** (`data/training/YYYY-MM.json`), damit die Dateien klein bleiben und das n8n-Backup handlich ist.

Der Ordner hieß bis zum 22.08.2026 `logs/`, so stand es auch in SPEC.md §3. Das war der falsche Name: Unter „logs" erwartet man Systemmeldungen und Fehlersuche, dort liegen aber die Trainingseinheiten. Mit umbenannt wurden `LOGS_DIR`, `lib/logs.php` und die zwölf `logs_*()`-Funktionen; `lib/config.php` benennt einen vorhandenen Ordner beim ersten Aufruf selbst um, damit eine bestehende Installation nach dem Update nicht ohne Historie dasteht.

**Die PHP-Sitzungsdateien liegen nicht in `data/`**, sondern in `sessions/` neben `index.php` (`SESSION_DIR`, überschreibbar per `COACH_SESSIONS`). `data/` ist für Trainingsdaten, Sitzungen sind Betrieb. Drei Dinge hängen daran und dürfen nicht vergessen werden: Die `.htaccess` sperrt den Ordner (im Hauptverzeichnis wäre er sonst abrufbar), `bin/deploy.sh` schließt ihn aus (sonst löscht `rsync --delete` bei jedem Deployment alle Anmeldungen), und die Tests setzen `COACH_SESSIONS`, sonst schreiben sie in den Projektordner.

Ein eigener Ordner überhaupt, weil die Vorgabe des Servers `session.gc_maxlifetime = 1440` ist, also 24 Minuten. Unsere 30 Tage gelten nur für unseren eigenen Prozess; im gemeinsamen Systemordner `/var/lib/php/sessions` räumt irgendwann ein fremder mit seiner eigenen Einstellung auf.

**Ohne Cookie fängt `auth_start()` keine Sitzung an.** Sonst legt jeder Aufruf eine leere Datei an, auch der eines Prüfskripts oder eines Suchmaschinen-Roboters: Im Betrieb waren so 107 Dateien aufgelaufen, von denen genau eine eine echte Anmeldung war. Anmelden und Abmelden rufen `auth_start(true)`. Dazu räumt `auth_aufraeumen()` höchstens einmal am Tag abgelaufene Dateien weg; PHPs eigener Lauf greift nur mit 1:100 und erst nach 30 Tagen.

**Die 30 Tage zählen ab der letzten Benutzung.** PHP schickt das Sitzungs-Cookie nur mit, wenn die Sitzung neu entsteht — ohne `auth_verlaengern()` lief es 30 Tage nach dem Anmelden ab, egal wie oft man die App benutzt hatte. Die Funktion setzt bei jedem angemeldeten Aufruf das Cookie neu und schreibt einen Zeitstempel in die Sitzung. Der Zeitstempel ist kein Beiwerk: `session.lazy_write` schreibt die Datei nur bei geändertem Inhalt, sonst altert sie weg, während jemand trainiert. Das hat eine Folge für die Leseseite: der Verlauf einer einzelnen Übung (`history.php`) und die Coach-Regel (`coach.php`) brauchen beide Sessions über Monatsgrenzen hinweg. Dieser Leser gehört einmal geschrieben und von beiden benutzt, nicht zweimal.

**Der Tagesvorschlag wird abgeleitet, nicht gespeichert.** „Heute: Unterkörper" entsteht aus `plan.json → rotation` plus dem `day` der letzten Session in den Logs. Es gibt kein Feld „aktueller Tag", das man pflegen müsste. Die manuelle Auswahl eines anderen Tags muss immer möglich bleiben, Frank soll nie ins Schema gezwungen sein.

**Die Progressionsregel lebt nur in `lib/coach.php`.** Doppelte Progression (§7): erst Wiederholungen bis `rep_max` hochklettern, dann Gewicht um `weight_step` rauf und Wiederholungen zurück Richtung `rep_min`. Deterministisch, ohne Sprachmodell. Das Frontend zeigt die Ansage nur an und rechnet nichts selbst nach.

Sie steht in `lib/` und nicht im Endpunkt, weil sie zwei Zugänge hat: `api/coach.php` gibt sie einzeln aus (so sieht §3 den Endpunkt vor), `api/plan.php` hängt sie an jede Kachel, damit der Studio-Bildschirm mit einem Request auskommt. Wer die Regel ändert, ändert sie an dieser einen Stelle.

Vier Festlegungen, die die Spezifikation offen lässt:

- **`COACH_EINHEITEN = 2`.** §7 nennt „N = 2..3". Zwei ist der zügigere Wert; wer vorsichtiger steigern will, setzt die Konstante auf 3. Eine einzelne saubere Einheit reicht bewusst nicht, sonst schiebt ein guter Tag das Gewicht hoch, das am nächsten Termin wieder einbricht.
- **„Eingebrochen" heißt: auch der beste Satz liegt unter `rep_min`.** Der letzte Satz fällt bei hartem Training regelmäßig ab, das ist Ermüdung und kein zu schweres Gewicht. Würde jeder einzelne schwache Satz die Warnung auslösen, stünde sie ständig da und niemand läse sie mehr.
- **Eine Einheit zählt nur mit ihrer Zielsatzzahl als sauber.** `coach_einheit_sauber()` prüft nicht nur, ob alle erfassten Sätze auf dem Arbeitsgewicht bis `rep_max` durchgingen, sondern auch, ob es überhaupt genug waren. Ohne das schöbe ausgerechnet ein Abbruch das Gewicht hoch: zwei Sätze auf der Obergrenze sind kein Beleg dafür, dass vier gehen. Fehlt `target_sets` (0), greift die Bedingung nicht, dann lässt sich nicht beurteilen, was vollständig gewesen wäre. Zwei Aufrufstellen, nicht eine — auch die Ansage „Noch eine saubere Einheit, dann geht es hoch" muss dieselbe Zählung benutzen, sonst verspricht die Kachel eine Steigerung, die dann ausbleibt.
- **Aufwärmsätze werden nicht mitprotokolliert** (Frank, 26.08.2026). `coach_einheit_sauber()` verlangt, dass **jeder** erfasste Satz auf dem Arbeitsgewicht liegt; ein leichterer lässt die Prüfung durchfallen. Das ist für den Einbruch mitten in der Einheit gedacht, trifft aber genauso eine Aufwärmleiter: Wer 80, 110, 130, 130 einträgt, bekommt nie eine Steigerung vorgeschlagen, auch wenn alle Arbeitssätze durchgehen. Nachgerechnet: dieselben vier Sätze auf 130 × 10 ergeben ohne Aufwärmzeilen „Heute 135 kg", mit ihnen „alle Sätze auf 10 bringen". Die Regel bleibt streng, **weil Frank sich entschieden hat, nur die Arbeitssätze einzutippen.** Wer das ändert, muss die Funktion mit ändern — Aufwärmen erkennt man daran, dass es **vor** dem ersten Satz auf Arbeitsgewicht liegt, ein Einbruch daran, dass er danach kommt.
- **Der Coach-Vorschlag befüllt die Eingabe — seit dem 26.08.2026, vorher nicht.** Bis dahin stand im Regler der letzte Wert, damit niemand im Halbschlaf eine Steigerung bestätigt, die er nicht geschafft hat. **Frank hat das umgedreht:** Im Feld soll stehen, was er erreichen soll.

  Anlass war eine widersprüchliche Kachel. `vorbelegung()` nahm den Satz an **derselben Position** wie der anstehende, und bei einer Aufwärmleiter war das der Aufwärmsatz: Oben stand „130 kg halten", im Regler 80 kg. Zwei Zahlen für dieselbe Übung, die sich widersprechen.

  Jetzt liefert `coach_empfehlung()` neben `target_weight` auch **`target_reps`**, und beide füllen die Regler. Die Zahlen gehören in `lib/coach.php` und nicht ins Frontend: Die Progressionsregel lebt an einer Stelle, sonst rechnet der Browser irgendwann etwas anderes als der Server. Jeder der acht Rückgabezweige setzt `target_reps`, und `tests/regel.js` nagelt alle zwölf Fälle darauf fest.

  Der Preis ist der, den die alte Regel vermeiden wollte: Ein unaufmerksames Bestätigen schreibt jetzt eine Wiederholung mehr ins Protokoll, als gemacht wurde. Das war Franks Abwägung.

  **Innerhalb einer Einheit gilt das nicht.** Steht schon ein Satz, wird der wiederholt — man steigert nicht von Satz zu Satz, sondern hält das Gewicht und zieht die Wiederholungen nach.

**`weight_step` gibt es zweimal:** global in `config.json` als Default (5), pro Übung in `exercises.json` als Überschreibung. Erlaubt sind 0,25, 0,5, 1, 1,25, 2,5 und 5. Jede Stelle, die Gewicht verändert, muss den Wert der Übung nehmen und auf den globalen zurückfallen.

SPEC.md §4 nennt nur die oberen drei. Die kleinen Stufen sind auf Franks Wunsch dazugekommen: an Kurzhanteln und an Maschinen mit Zusatzscheibe geht es feiner, und wo eine ganze Stufe zu viel wäre, bliebe die Progressionsregel sonst dauerhaft stehen. Die Liste steht an zwei Stellen und muss zusammenpassen: `WEIGHT_STEPS` in `lib/uebungen.php` prüft, die Auswahl in `assets/app.js` bietet an. Neue Werte müssen im Binärformat exakt sein, sonst scheitert der strikte Vergleich in `uebung_pruefen()`.

**Ein Request pro Bildschirm.** `plan.php` liefert den Tag, die Übungen und die letzten Werte zusammen aus, sonst müsste der Studio-Bildschirm pro Kachel nachladen.

**Der Rückblick ist ein eigener Endpunkt und liefert die Sätze gleich mit.** `api/einheiten.php` gibt die letzten zehn Einheiten samt aller Sätze aus, gedeckelt in `EINHEITEN_DECKEL`. Zwei Entscheidungen darin:

Nicht an `plan.php` angehängt, obwohl der die Startseite ohnehin füllt: `plan.php` bedient auch das Studio, und dort wäre der Rückblick totes Gewicht auf genau dem Bildschirm mit der schlechtesten Verbindung. Umgekehrt nicht in Liste und Nachladen je Einheit getrennt: zehn Einheiten sind wenige Kilobyte, dafür öffnet sich die Detailansicht ohne Netz und ohne Wartezeit.

Name, Foto, Stationsnummer und Vorgabe reisen je Übung mit, statt sie im Browser gegen `exercises.json` zu verbinden. Eine seit damals gelöschte Übung stünde sonst ohne Namen da, und ihre Sätze wären niemandem mehr zuzuordnen.

**„Offen" ist enger als „unvollständig", und der Unterschied trägt die halbe Oberfläche.** Offen heißt: von **heute** und nicht durch — nur so eine Einheit lässt sich weitertrainieren. Unvollständig bleibt eine Einheit auch noch in drei Wochen; die ist Geschichte. Eine Einheit ist nur am selben Kalendertag offen, danach gilt sie als beendet, so als hätte man „Einheit beenden" gedrückt (Vorgabe von Frank, 22.08.2026).

Daran hängen drei Dinge, und die Regel steht deshalb in `lib/training.php` (`training_offen()`, `training_vollstaendig()`, `training_soll()`) und nicht im Endpunkt: `api/einheiten.php` markiert damit die Liste, `api/plan.php` fragt damit nach dem Tagesvorschlag, und die Oberfläche entscheidet damit, ob ein Antippen in die Leseansicht führt oder ins Studio.

**Eine offene Einheit sticht den Rotationsvorschlag.** Ohne das springt die Startseite nach einem Neuladen auf den nächsten Tag, obwohl man mitten in einem anderen steckt: `naechster_tag()` rückt schon ab dem ersten bestätigten Satz weiter. `zustand.tagWahl` hielt das im Browser fest — aber nur, solange die Seite nicht neu geladen wurde. Bei zwei offenen gewinnt die **zuletzt angefangene**.

Falle dabei: `training_monat()` liefert bereits neueste zuerst. Ein zusätzliches `array_reverse` macht daraus die älteste, und dann bietet die Startseite die Einheit an, die man zuerst liegengelassen hat. Das ist genau einmal passiert und fiel nur im Screenshot auf, nicht im Test — der Test dazu steht jetzt in `tests/einheiten.js`.

**Der Knopf unten verschwindet bei zwei offenen Einheiten.** Er geht immer in den Tag, der oben steht; bei einer offenen Einheit ist das eindeutig, bei zweien bediente er wortlos eine davon. Ein **frischer** Tag bleibt trotzdem startbar, sonst käme man bei zwei halben Einheiten aus der Startseite nicht mehr heraus.

**„Vollständig" wird gegen den heutigen Plan gerechnet.** Eine Einheit speichert nicht, was damals verlangt war. Ändert sich eine Zielsatzzahl, wechseln alte Einheiten die Markierung. Das ist der Preis dafür, die Vorgabe nicht in jede Session zu duplizieren; die Sätze selbst liegen fest. Geprüft wird je Übung, nicht über die Summe: acht Sätze Bankdrücken und keiner Latzug ergäben dieselbe Zahl wie vier und vier, wären aber eine halbe Einheit.

**Der Fortschritts-Index ist ein Mittelwert von Verhältnissen, keine Summe.** `lib/fortschritt.php` gibt je Einheit eine Punktzahl aus. Je Übung wird verglichen, was in dieser Einheit geschafft wurde, mit der **ersten** Einheit dieser Übung; der Tageswert ist der Mittelwert dieser Verhältnisse mal 100.

Der Grund für den Mittelwert: Aufsummierte Gewichte machen die Kurve zu einer Anzeige der Tagesart. Ein Oberkörpertag mit neun Übungen stünde immer über einem Unterkörpertag mit acht, und die Linie sägte zwischen beiden hin und her, ohne etwas über Fortschritt zu sagen. Ein Mittelwert hängt nicht davon ab, über wie viele Werte er geht.

Der Vergleichswert je Satz ist Epley (`Gewicht × (1 + Wdh/30)`), der beste Satz der Einheit zählt. Nur das Gewicht zu nehmen wäre falsch: Doppelte Progression klettert erst die Wiederholungen hoch, die Kurve bliebe wochenlang flach, während tatsächlich etwas passiert. Das Ergebnis ist eine Rechengröße für den Vergleich, keine Behauptung über ein echtes Einer-Maximum.

**Die Zahl der Sätze geht bewusst nicht ein.** Sonst wäre eine abgebrochene Einheit ein Rückschritt, obwohl vielleicht schwerer trainiert wurde, und ein zusätzlicher lockerer Satz zöge den Wert nach unten. Der Index misst, wie schwer, nicht wie viel; wie viel steht im Rückblick.

Eine neu aufgenommene Übung startet bei 100 und dellt den Tagesmittelwert einmalig. Das ist der Preis dafür, dass jeder Punkt der Kurve für sich nachrechenbar ist. Die Alternative wäre ein verketteter Index (Vergleich nur mit der vorigen Einheit, nur über gemeinsame Übungen); der hat keine Delle, dafür hängt jeder Punkt an allen vorherigen und ein Ausreißer verschiebt die Kurve dauerhaft. Auf Franks Wunsch die einfache Variante.

**Das Körpergewicht wird mit Datum gespeichert** (`data/gewicht.json`, `lib/gewicht.php`), nicht als eine aktuelle Zahl. An der Unterstützungsmaschine ist die bewegte Last „Körpergewicht minus Hilfe"; mit nur einem aktuellen Wert würde jeder Gang auf die Waage die gesamte Vergangenheit umrechnen, und fünf Kilo weniger auf der Waage erschienen in alten Einheiten als Rückschritt. Eintragen ist freiwillig: ohne Wert bleiben Klimmzug und Dips aus dem Index, alles andere rechnet weiter.

Das Eingabefeld ist `type="text"` mit `inputmode="decimal"`, nicht `type="number"`. Auf der deutschen Tastatur ist die Dezimaltaste ein Komma, und ein Zahlenfeld weist das als ungültig zurück — das Feld bliebe beim Absenden leer. Komma und Punkt sind beide erlaubt.

**Geprüft wird mit einem Muster, nicht mit `(float)`.** `gewicht_zahl()` verlangt `/^\d{1,3}(\.\d{1,2})?$/`, nachdem das Komma ersetzt ist. PHPs Umwandlung ist nachsichtig: `(float) "84,5kg"` ergibt 84,5 und `(float) "84,5,3"` ebenfalls, beides ohne einen Mucks — ein Vertipper käme als plausible Zahl in der Datei an und wäre später nicht mehr als solcher zu erkennen. Die Plausibilitätsgrenzen 30 bis 300 kg kommen zusätzlich, sie fangen den Faktor-Zehn-Fehler.

**`json_write()` legt `serialize_precision` selbst fest.** Auf der Kommandozeile steht sie auf -1, also auf der kürzesten verlustfrei rücklesbaren Form; im Webserver bei All-Inkl steht sie anders, und dort schrieb `json_encode` aus 96,8 die volle Binärentwicklung `96.7999999999999971578290569595992565155029296875`. Zurückgelesen ergibt das denselben Wert, kaputt ist also nichts — aber die Datei ist unlesbar, das n8n-Backup trägt es mit, und beim Vergleich zweier Stände sieht jede Kommazahl nach einem Unterschied aus. **Lokal fällt das nie auf**, weil dort die Kommandozeilen-Einstellung gilt; ein Test führt PHP deshalb ausdrücklich mit `serialize_precision=17` aus. Aufgefallen ist es erst am ersten Wert, der binär nicht exakt darstellbar war — die Trainingsgewichte sind alle Viertel und Halbe und damit exakt.

**Der Verwaltungsbereich zeigt `zustand.meldung` an.** Ohne das scheiterte eine abgelehnte Eingabe stumm: das Formular zeichnete sich leer neu und nichts sagte, warum. Wer dort einen Endpunkt anbindet, der etwas ablehnen kann, braucht diese Zeile.

**Im Kalender führt auch eine offene Einheit in die Leseansicht.** Eine Zelle kann nur eine Einheit halten; bei zwei Einheiten an einem Tag wäre wieder unklar, welche gemeint ist — genau die Mehrdeutigkeit, wegen der der Knopf auf der Startseite verschwindet. Fortgesetzt wird deshalb über die Liste der Startseite, wo jede offene Einheit eine eigene Zeile hat. Die Leseansicht einer offenen Einheit bietet den Ausgang ins Studio selbst an; dort ist eindeutig, um welche es geht.

**Der Kalender beantwortet eine andere Frage als der Rückblick.** Die Liste sagt „was habe ich gemacht", das Monatsraster sagt „wie regelmäßig war ich" — und dafür ist die Lücke so wichtig wie der Eintrag. Deshalb ein Raster über alle Tage und nicht nur über die trainierten. Die Woche beginnt am Montag, weil der Plan in Mo/Mi/Fr denkt.

Er läuft über denselben Endpunkt, mit `?monat=YYYY-MM` statt der Zehnerliste. Ein Parameter und kein zweiter Endpunkt: dieselbe Sache in derselben Form, nur anders ausgewählt, und die ganze Anreicherung je Übung wäre sonst zweimal da. Der Fortschritts-Index bleibt beim Monatsabruf weg, er gehört zur Startseite.

Geblättert wird nur zwischen dem ältesten Monat mit Daten und dem laufenden; darüber hinaus sind die Knöpfe gesperrt. Ein Knopf, der ins Leere führt, ist schlimmer als keiner, weil man ihn zweimal drückt.

**„Zurück" merkt sich die Herkunft, an zwei Stellen.** `zustand.einheitHer` führt aus einer Einheit dorthin zurück, wo sie aufgeschlagen wurde (Startseite oder Kalendermonat), `zustand.uebungHer` aus dem Übungsverlauf entsprechend (Einstellungen oder Einheit). Ohne das landet man nach zwei Tippern in einer Ansicht, die man nie besucht hat.

**Die Ausführung steht in der Großansicht, nicht als Aufklapper auf der Kachel** (26.08.2026). Vorher klappte „Wie geht die Übung?" den Text unter dem Kachelkopf auf und schob die Regler nach unten — also genau das weg, wofür man die Kachel geöffnet hatte. Jetzt ist die Zeile ein Auslöser für dieselbe Lupe, die auch ein Tipp aufs Foto öffnet: Beides beantwortet „was ist das für ein Gerät und wie geht die Übung daran".

`lupeZeigen()` nimmt dafür die Übungskennung mit und holt sich die Übung über `uebungImStudio()` aus `zustand.studio`. Das Foto trägt sie als **`data-anleitung`** und nicht als `data-uebung` — letzteres sitzt schon auf der Kachel selbst, und zwei Elemente mit demselben Attribut brachten `tests/paare.js` zum Straucheln. Der Zweig `d.foto` wird im Klick-Handler vor `d.anleitung` geprüft, deshalb funktioniert dasselbe Attribut für beide Wege.

Ohne Foto wird das Bild in der Lupe ausgeblendet statt eine leere Fläche zu zeigen; die Anleitung muss auch dann erreichbar sein. Beim Schließen wird der Text geleert, sonst blitzt beim nächsten Öffnen der der vorigen Übung auf.

**Studio und Rückblick teilen sich den Kachelkopf.** `zeichneKachelKopf()` zeichnet Foto, Name, Vorgabe und Punktreihe für beide. Beim Zurückblicken ist „welches Gerät war das" dieselbe Frage wie im Studio, und eine zweite Darstellung dafür wäre eine zweite Bildsprache für denselben Gegenstand. Bewusst als eigene Funktion und nicht als Modus-Schalter quer durch `zeichneKachel()`: die hat schon genug Verzweigungen.

**Der Trainingstag wird festgehalten, nicht aus dem geladenen Tag abgeleitet.** `zustand.tagWahl` ist ein eigenes Feld, `null` heißt „dem Vorschlag des Servers folgen". Betreten des Studios hält den Tag fest, „Einheit beenden" gibt ihn frei. Der Grund für beide Richtungen: `naechster_tag()` rückt ab dem **ersten** bestätigten Satz weiter, weil die laufende Einheit dann die letzte in den Logs ist. Ohne Festhalten spränge die Ansicht mitten in der Einheit weg; ohne Freigeben bot die Startseite nach dem Ende weiter die abgeschlossene Einheit an, und „Weiter trainieren" führte in eine Liste, in der alles abgehakt war. Der geladene Tag (`zustand.studio.day.key`) darf diese Rolle nicht mitübernehmen, genau daran ist es einmal gescheitert.

Ausbaustufen (KI-Coach über eine Sprachmodell-API, Dashboard-Widgets) sind in §7 und §10 bewusst als andockbar beschrieben. Sie sind kein Teil des MVP und rechtfertigen keine zusätzliche Abstraktion vorab; die Logs sind als sauberes JSON schon API-tauglich.

## Befehle

Es gibt keinen Build, keinen Linter und kein Test-Framework, und laut Spezifikation soll das so bleiben.

PHP liegt über Homebrew lokal vor (8.5). Auf All-Inkl läuft eine andere Version, die vor dem Deployment zu prüfen ist. Der Code hält sich an PHP 8.0 und nutzt nichts Neueres.

```bash
php bin/init-config.php     # data/ einrichten, fragt zweimal nach dem Passwort
php bin/plan-anlegen.php    # den Trainingsplan hineinschreiben
php -S 127.0.0.1:8777       # lokal starten, dann http://127.0.0.1:8777
for f in lib/*.php api/*.php bin/*.php; do php -l "$f"; done   # Syntax-Check
```

Der eingebaute PHP-Server liest **keine** `.htaccess`. Der Schutz von `data/` lässt sich damit nicht prüfen, das geht nur auf dem echten All-Inkl-Host: die JSON-URL im Browser aufrufen und auf 403 prüfen.

## Der Trainingsplan

Er steht in **`TRAININGSPLAN.md`** (Begründung: Aufteilung, Reihenfolge, Volumen) und in **`lib/standardplan.php`** (die Zahlen, die nach `data/` geschrieben werden). Wer die Zahlen ändert, ändert die Begründung mit, sonst driften beide auseinander.

**Er wird beim Einrichten automatisch angelegt**, von `api/setup.php` beim ersten Aufruf im Browser und von `bin/init-config.php` auf der Kommandozeile. Beide benutzen dieselbe Quelle; zwei Einrichtungswege dürfen nicht zwei verschiedene Zustände hinterlassen.

Der Browser-Weg ist am 22.08.2026 auf einer zweiten Subdomain durchgespielt worden, aus einem frischen Klon heraus: Passwort setzen, danach standen drei Tage und 25 Übungen da, alle mit Bild. Damit ist auch `standardplan_bild()` unter Linux bestätigt — `glob()` auf `a1-*.jpg` ist dort abhängig von der Groß-/Kleinschreibung, auf macOS nicht.

Vorher legte nur `init-config.php` ein Grundgerüst mit zwei Tagen an und `setup.php` gar nichts. Der Browser-Weg endete damit in einer Sackgasse: Ohne Trainingstag lässt sich keine Übung anlegen (`uebung_pruefen()` prüft den Tag gegen den Plan), und Tage anlegen kann die Oberfläche nicht — `api/settings.php` ändert nur Schwerpunkte und Rotation. Wer kein SSH hatte, kam da nicht mehr heraus.

`bin/plan-anlegen.php` ist seitdem kein Einrichtungs-, sondern ein **Update-Werkzeug**: Es schiebt einen geänderten Standardplan in eine bestehende Installation, `--aktualisieren` ohne die Fotos anzutasten, `--neu` mit Sicherung. Es gehört nicht in die README, der Benutzer braucht es nie.

Ein Skript und keine Datei im Repo, weil `data/` ausgeschlossen ist: dort liegen Passwort-Hash und Trainingshistorie. Der Plan selbst ist weder geheim noch verzichtbar und muss sich nach einem Serverneuaufbau in einem Befehl wiederherstellen lassen.

Drei Punkte, die beim Aufstellen entschieden wurden und nicht versehentlich zurückgedreht werden sollten:

- **Die Rotation ist zweigliedrig**, nicht dreigliedrig. Über drei Termine (Mo/Mi/Fr) verschiebt sich der Wechsel dadurch von selbst, und jede Hälfte kommt im Schnitt 1,5-mal pro Woche dran, wie §12 es verlangt. Das dreigliedrige Beispiel, das ursprünglich in §4 stand, hätte sich jede Woche identisch wiederholt: Montag für immer Oberkörper, Unterkörper nur einmal pro Woche. In SPEC.md korrigiert.
- **Es gibt keine Startgewichte.** Die erste Einheit ist die Eichung, danach übernimmt die Progressionsregel. Der Coach sagt bei Übungen ohne Historie „Erste Einheit: Gewicht antasten". Startgewichte einzutragen wäre geraten und würde die Regel nur mit falschen Zahlen füttern.
- **Rumänisches Kreuzheben statt klassischem.** §12 nennt Kreuzheben als Beispiel. Die rumänische Variante trifft die Oberschenkelrückseite gezielter, verlangt weniger Technik unter Ermüdung und belastet den unteren Rücken geringer, was besser zum Gerätefokus aus §12 passt als schweres Kreuzheben nach vier Sätzen Kniebeuge.

Fotos aufbereiten: `sips -Z 900` verkleinert, entfernt aber **keine** Metadaten. Danach `python3 bin/exif-entfernen.py <dateien>`, sonst wandert der Studio-Standort aus dem GPS-EXIF mit ins Repo. Auf diesem Mac liegen weder exiftool noch ImageMagick, daher das eigene Skript.

## Training ohne Netz

Im Studio ist der Empfang schlecht. Das ist keine Randbedingung, sondern der Normalfall, unter dem die App funktionieren muss. Deshalb gilt über die PWA-Hülle hinaus:

**Jeder bestätigte Satz geht IMMER zuerst in den lokalen Puffer, auch bei bester Verbindung.** Ein eigener Weg nur für den Offline-Fall wäre ein Weg, der selten läuft und deshalb nicht auffällt, wenn er kaputt ist. Der Satz gilt, sobald er im `localStorage` liegt; das Senden ist eine Frage von später.

Drei Eigenschaften tragen das:

- **`set_index` macht das Senden wiederholbar.** Derselbe Satz zweimal übertragen überschreibt sich, statt sich zu verdoppeln. Ohne das wäre jeder Wiederholungsversuch ein Risiko.
- **`performed_at` reist mit.** Ohne den Zeitpunkt landete ein Satz, der Dienstagabend im Funkloch entstand und Mittwoch übertragen wird, in der Mittwochs-Session. `session.php` grenzt den Wert ein: höchstens 15 Minuten in der Zukunft (die Handyuhr darf abweichen), höchstens 30 Tage zurück, damit sich damit nicht die Historie umschreiben lässt.
- **Die zuletzt geladene Studio-Ansicht wird mitgemerkt.** Ohne Netz ist sie die einzige Möglichkeit, im Studio überhaupt etwas zu sehen. Sie kann veraltet sein, aber Übungen und Zielvorgaben ändern sich selten.

`localStorage` statt IndexedDB: es geht um wenige Kilobyte, und die synchrone Schnittstelle spart eine ganze Klasse von Wettläufen. Zu wissen: iOS räumt den Speicher einer PWA nach sieben Tagen ohne Benutzung ab. Bei drei Einheiten pro Woche kein Thema, und der Puffer soll ohnehin binnen Stunden leer sein.

**Die Statusleiste ist Teil des Versprechens, kein Schmuck.** Ein stiller Puffer wäre schlimmer als gar keiner: man verließe sich darauf, ohne zu wissen, ob er noch voll ist. Sie nennt immer Zahl und Lage. Lehnt der Server einen Satz ab (4xx), wandert er sichtbar zur Seite statt endlos wiederholt zu werden; ein Netzfehler dagegen behält die Reihenfolge und macht beim nächsten Versuch an derselben Stelle weiter.

Was **nicht** offline geht: der Verwaltungsbereich (wird zu Hause bedient, der Verweis darauf verschwindet ohne Netz), die Verlaufskurven, und die Coach-Ansage bleibt auf dem Stand des letzten Ladens. Letzteres ist Absicht: die Regel lebt an einer Stelle, und die liegt auf dem Server.

## PWA

Drei Regeln im Service Worker, die Reihenfolge ist wichtig:

**Grundregel: mit Netz kommt NICHTS aus dem Cache.** Jede Anfrage geht an den Server, die Antwort von dort wird ausgeliefert. Der Cache ist ausschließlich der Notnagel, wenn gar keine Verbindung besteht. Vorgabe von Frank, und sie hat einen Anlass: eine frühere Fassung bediente statische Dateien zuerst aus dem Cache und erneuerte sie nur im Hintergrund. Zusammen mit einem unversionierten Eintrag und `ignoreSearch: true` blieb dadurch **jede Änderung beim Laden unsichtbar**. Eine App, bei der man nie sicher weiß, ob man den aktuellen Stand sieht, ist schlimmer als eine, die eine halbe Sekunde länger lädt.

Dazu auf HTTP-Ebene: `index.php` sendet `Cache-Control: no-store`, `.htaccess` ebenso für `.js` und `.css`. Nur die Gerätefotos dürfen eine Woche liegenbleiben, sie ändern sich praktisch nie und wiegen zusammen 2 MB.

1. **`api/` kommt nie aus dem Cache.** Ein zwischengespeicherter Trainingsstand wäre schlimmer als eine Fehlermeldung, weil die App Sätze zeigte, die längst anders auf der Platte liegen. Ein Test prüft, dass kein einziger API-Aufruf im Cache landet.
2. **Seitenaufrufe** wie alles andere: Netz zuerst, Cache nur als Notnagel. `index.php` entscheidet über das Session-Gate, und diese Entscheidung darf nicht altern. Gemerkt wird nur die **angemeldete** Hülle, erkennbar am Header `X-Angemeldet: 1`. Läge die Anmeldeseite im Cache, stünde man im Funkloch vor einem Formular, das sich nicht abschicken lässt.
3. **Ein neuer Service Worker, der einen alten ablöst, lädt die Seite einmal neu.** Die Bedingung `navigator.serviceWorker.controller` davor ist Pflicht: beim ersten Besuch übernimmt der Worker per `clients.claim()` ebenfalls, und ohne die Abfrage lüde die Seite mitten im Anmelden neu und nähme das eingetippte Passwort mit.

Zwei Dinge, die man leicht übersieht:

- **`CACHE` in `service-worker.js` hochzählen**, sobald sich die Liste der gecachten Dateien ändert. Sonst behalten bereits installierte Geräte den alten Stand.
- CSS und JS tragen die **Dateizeit als Version** (`version()` in `index.php`). Ein festes `?v=1` wäre wirkungslos gewesen: nach einem Deployment hätte der Browser die alte Datei behalten, und mit Service Worker zusätzlich aus dem Cache bedient.

Icons neu erzeugen: `node bin/icons.js`. Die PNG liegen im Repo, auf dem Server wird nichts gebaut.

## Der n8n-Backup-Workflow

Noch nicht angelegt. Was er braucht (SPEC.md §9):

- **Schedule-Trigger**, täglich reicht bei drei Einheiten pro Woche.
- **HTTP Request** auf `https://<domain>/api/export.php`, Methode GET, Header `X-API-Key` mit dem Wert aus `data/config.json`. Den Schlüssel als n8n-Credential hinterlegen, nicht in den Node schreiben.
- Antwort ist ein JSON-Bündel mit `settings`, `exercises`, `plan`, `logs` und einer `summary`. Über `summary.sessions` lässt sich ein Alarm bauen, falls die Zahl unerwartet fällt.
- **Ablage auf einem Zweitserver**, welcher, ist offen. Sinnvoll wäre ein Dateiname mit Datum, damit ältere Stände erhalten bleiben; ein einzelnes überschriebenes Backup wäre bei stiller Datenverfälschung wertlos.

## Tests

```bash
node tests/lauf.js            # alle, dauert etwa eine Minute
node tests/lauf.js coach      # einzeln, Namen siehe tests/lauf.js
```

Kein Test-Framework, wie in SPEC.md §2 vorgesehen. `tests/lauf.js` ist ein Skript, das die Läufe nacheinander startet und mit Exit-Code 1 endet, wenn etwas scheitert. Playwright steuert nur den Browser und läuft gegen das installierte Chrome, damit kein Browser nachgeladen wird. Fehlt Playwright, sagt die Fehlermeldung, was zu tun ist.

**Kein Testlauf darf einen festen Monat behaupten.** `tests/einheiten.js` schrieb seine Daten in den August 2026 und prüfte dann auf „Aug 2026", zwölf Trainingstage und fünf Leerfelder vor dem Ersten. Am 01.09.2026 fiel der Lauf mit fünf Fehlern um — richtig war er nur, solange gerade August war. Die Daten liegen jetzt im **Vormonat**, alles Weitere wird daraus gerechnet (Monatsmarke, Wochentag des Ersten, Datum der jüngsten Einheit). Vormonat und nicht laufender Monat, weil eine Einheit am heutigen Tag „offen" statt „unvollständig" wäre und die Prüfungen an genau einem Tag im Monat kippten.

**Jeder Lauf ist vollständig abgeschottet.** Er startet einen eigenen PHP-Server auf einem eigenen Port mit einem eigenen Datenverzeichnis im Temp-Ordner, gesetzt über `COACH_DATA`. Das ist keine Bequemlichkeit, sondern Notwehr: die Läufe löschen und schreiben Logdateien, und gegen `data/` ausgeführt kosteten sie die Trainingshistorie. Deshalb gilt:

- **Testcode darf `DATA_DIR` niemals umgehen** und nie mit festen Pfaden auf `data/` zugreifen.
- Antwortet auf dem Port schon etwas, bricht der Lauf ab statt weiterzumachen. Ein übriggebliebener Server aus einem abgestürzten Lauf hat ein anderes Datenverzeichnis, und der Lauf liefe stillschweigend gegen die falschen Daten. Genau das ist einmal passiert und hat einen halben Debug-Durchgang gekostet.
- Die Läufe sind unabhängig von der Reihenfolge; jeder setzt seinen Ausgangszustand über `t.logs()` selbst.

Was jeder Lauf abdeckt: `regel` prüft `coach_empfehlung()` direkt in PHP über alle Zweige aus §7, ohne Browser. `verwaltung` deckt Anmeldung und Übungsbibliothek ab, `studio` den Trainingsablauf samt Rotation und Pausen-Timer, `verlauf` die Kurven, `coach` die Ansage auf der Kachel, `fortschritt` den Index ohne Browser, `einheiten` den Rückblick samt Detailansicht, Kurve, Kalender und Körpergewicht, `pwa` Manifest, Service Worker und Export, `offline` eine ganze Einheit ohne Netz samt Übertragung danach.

Der Lauf `offline` ist der wichtigste, weil er den Alltagsfall abbildet: Verbindung weg, drei Sätze eintippen, neu laden, Verbindung zurück. Er prüft am Ende gegen `export.php`, dass auf dem Server genau das steht, was getippt wurde, unter dem richtigen Datum und ohne Verdopplung.

Nicht automatisiert, aber einmal geprüft und bei Änderungen zu wiederholen: die Sperre in `json_update()` mit 25 gleichzeitigen Prozessen, die denselben Zähler hochzählen. Es kamen 25 heraus.

**Screenshots der Oberfläche.** Die Chrome-Erweiterung von Claude bricht in diesem Projekt mit „Cannot access a chrome-extension:// URL of different extension" ab. Der Weg, der funktioniert, ist Playwright über `npx`, allerdings mit zwei Fallstricken: das Modul liegt nur im npx-Cache (`~/.npm/_npx/*/node_modules/playwright`), und die dort gecachten Chromium-Versionen passen nicht zur Playwright-Version. Deshalb das installierte Chrome verwenden statt einen Download anzustoßen:

```js
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
```

Damit läuft auch der Durchlauf durch die Oberfläche (anmelden, Übung anlegen, löschen, Schwerpunkt umschalten, neu laden).

Fotos aufbereiten (macOS bringt `sips` mit, ImageMagick und exiftool sind nicht installiert):

```bash
sips -Z 1200 --setProperty format jpeg images/IMG_1644.JPG --out assets/img/exercises/beinpresse.jpg
```

## Deployment (All-Inkl)

Eingerichtet und im Betrieb. **`bin/deploy.sh` ist der einzige Weg**, von Hand zu rsyncen ist der Fehler, der schon zweimal Daten gekostet hat. Das Skript prüft erst die Fotos und die PHP-Syntax, bricht bei jeder Datei über 400 KB ab, lädt dann hoch und prüft am Ende die Live-URLs. `bin/deploy.sh --trocken` zeigt vorher, was sich ändern würde.

**Wohin deployed wird, steht nicht in diesem Repo.** Server-Alias, Zielpfad und Domain liegen in `bin/ziel.conf`, das per `.gitignore` ausgeschlossen ist; die Vorlage dazu ist `bin/ziel.conf.beispiel`. Fehlt die Datei, bricht der Deploy mit einer Anleitung ab. Grund: Hostname, Paketkennung und Pfad sind zwar keine Zugangsdaten, sagen einem Fremden aber genau, wo die Kiste steht. Zugangsdaten stehen auch dort nicht, der Schlüssel liegt in `~/.ssh/config`.

- PHP auf dem Server ist **8.5**, auf der Kommandozeile heißt es `php85` (nicht `php`).
- `scp`/`rsync` immer mit `-o IdentityAgent=none -o IdentitiesOnly=yes`, sonst greift Franks 1Password-SSH-Agent über die `Host *`-Regel und der Login scheitert mit „Too many authentication failures".
- Zielpfade sind **relativ** zum chroot-Home, ein absoluter Pfad läuft ins Leere. SSH ist chrooted, PHP nicht.
- `data/` liegt **im** Web-Root und ist per `.htaccess` gesperrt (Vorgabe von Frank, abweichend von SPEC §8). Der 403 wird bei jedem Deploy geprüft, ebenso der 404 auf `lib/` und `bin/`.
- `bin/` liegt auf dem Server, weil `plan-anlegen.php` und `init-config.php` dort über die Kommandozeile laufen. Aus dem Browser ist davon nichts erreichbar.
- **Werkzeug-Ordner mit Punkt am Anfang sind ausgeschlossen** (`.claude/`, `.vscode/`, `.idea/`). Sie sind zwar gitignored, aber rsync liest das Arbeitsverzeichnis und nicht Git. `.htaccess` sperrt nur `data/`, `lib/` und `bin/`; ein hochgeladenes `.claude/settings.local.json` wäre schlicht abrufbar gewesen. Aufgefallen im Probelauf, hochgegangen ist nichts.

Das erprobte Vorgehen für denselben Host steht auch in `../lithium-rechner/CLAUDE.md`.

## Bilder: zwei Ordner, nur einer zählt

**Die Anwendung liest ausschließlich `assets/img/exercises/`.** Nirgends im Code steht ein anderer Bildpfad. Wer dort nicht liegt, ist für die App nicht vorhanden, egal was sonst auf der Platte herumliegt.

| Ordner | Was | Im Repo? | Auf dem Server? |
|---|---|---|---|
| `images/` | die Werkbank: 25 generierte Übungsbilder (2400x1792 PNG) und 49 iPhone-Aufnahmen aus dem Studio (`IMG_*.JPG`), zusammen rund 310 MB | nein | nein |
| `assets/img/exercises/` | 25 Webfassungen, 1200 px JPEG, je rund 200 KB | **ja** | **ja** |

`images/` ist Werkbank, nicht Anwendung. Der Ordner liegt auf Franks Mac, ist per `.gitignore` ausgeschlossen und wird von `bin/deploy.sh` übersprungen. Sein einziger Zweck: aus ihm rechnet `bin/fotos.sh` die Webfassung.

**Nicht alles darin gehört in die App.** Dateien, die `IMG_*` heißen, überspringt `bin/fotos.sh`: Das sind die iPhone-Rohaufnahmen, 49 unsortierte Gerätebilder, die die Bildauswahl zumüllen würden. Soll eine davon doch hinein, bekommt sie einen sprechenden Namen, dann greift das Skript sie ab. Die 25 gezeichneten Übungsbilder heißen nach Tag und Position im Plan (`a1` bis `a9` für Tag A, `b1` bis `b8`, `c1` bis `c8`), also etwa `b2-klimmzug-untergriff.png`.

**Die 25 gezeichneten Übungsbilder ordnet `lib/standardplan.php` beim Einrichten selbst zu**, abgeleitet aus Tag und Position (`a1`…`c8`). Der Dateiname trägt die Zuordnung schon, sie ein zweites Mal in die Plandaten zu schreiben liefe beim ersten Umbenennen auseinander. Fehlt eine Datei, bleibt das Feld leer.

Für **Fotos echter Geräte** gilt das nicht: Die Zuordnung passiert in der App unter „Einstellungen", nicht über Dateinamen. Auf einem Foto sieht man das Gerät, aber nicht, welche Übung jemand daran macht; das kann nur Frank entscheiden. Gespeichert wird sie als Feld `photo` in `data/exercises.json`, und weil `data/` nie deployed wird, reist eine lokal gemachte Zuordnung **nicht** mit auf den Server. Zugeordnet wird deshalb direkt auf dem Live-Server.

**Der Upload läuft auch ohne die GD-Bibliothek, dann aber roh.** Mit GD wird die Datei neu gezeichnet: 1600 px, gedreht nach EXIF, ohne Metadaten. Ohne GD wird sie geprüft (`getimagesize`, nur JPEG/PNG/WebP) und unverändert abgelegt, unter ihrer echten Endung — deshalb listet `api/fotos.php` auch `*.png` und `*.webp`, sonst tauchte so ein Bild nie in der Auswahl auf.

Der Rückfall ist Franks Entscheidung und gilt für diese App: ein Nutzer, eigene Aufnahmen, keine fremden Dateien. Das Neuschreiben bleibt trotzdem der Normalfall, denn nur es macht aus einer Datei, die wie ein Bild aussieht, sicher ein Bild — ein gültiges JPEG mit angehängtem Code überlebt es nicht. Wer die App mit mehreren Nutzern betreibt, braucht GD. **Der Zweig ohne GD ist nicht durch Tests abgedeckt**, weil GD hier in jeder Umgebung vorhanden ist (lokal 2.3.3, auf dem Server 2.3.0 in allen sieben PHP-Versionen).

Regeln fürs Aufbereiten, alle in `bin/fotos.sh` und in `tests/fotos.js` festgeschrieben:

- **1200 px lange Kante, JPEG Qualität 80, höchstens 400 KB.** Das Handy zeigt im Großformat 390 Punkte bei dreifacher Pixeldichte, also 1170 echte Pixel. Als PNG wären dieselben Bilder 7 MB statt 220 KB: PNG ist für Strichgrafik gedacht, nicht für gerenderte Bilder mit weichen Verläufen.
- **EXIF entfernen.** Alle 49 iPhone-Aufnahmen enthalten GPS-Koordinaten, also den Standort des Studios, und die Webfassungen liegen ohne Anmeldung im Netz. `sips` nimmt die Metadaten beim Verkleinern mit, deshalb hinterher `bin/exif-entfernen.py`.
- **Fotos nicht mit KI stilisieren.** Nur dezent vereinheitlichen (Zuschnitt, Ausrichtung), sonst geht die Wiedererkennung im Studio verloren. Die aufgeklebte Gerätenummer ist der Grund, warum man das richtige Gerät wiederfindet.

`bin/deploy.sh` hat dafür zwei Sicherungen, und beide sind aus Schaden entstanden. Die Ausschlussliste hält `fotos/`, `images/`, `data/` und `tests/` zurück. Darüber hinaus bricht das Skript ab, sobald irgendeine hochzuladende Datei über 400 KB liegt: Eine Ausschlussliste ist nur so gut wie ihr letzter Eintrag, und ein neu angelegter Quellordner fehlt darin garantiert. Genau so wären die 49 Originale samt GPS auf den öffentlichen Server gegangen.

## Offene Punkte aus §11

Beide Blocker sind erledigt: Der Trainingsplan steht (`TRAININGSPLAN.md` plus `bin/plan-anlegen.php`), und die Serverfrage ist entschieden. `data/` liegt **im** Web-Root und wird per `.htaccess` gesperrt, nicht eine Ebene darüber; so wollte Frank es. Die Bildzuordnung ist ebenfalls durch, alle 25 Übungen haben ein Bild.

Was heute offen ist, steht in `STATE.md`.

## Gestaltung

**Für Arbeit an der Oberfläche immer den `frontend-design`-Skill benutzen** (Vorgabe von Frank).

Die Richtung ist aus Franks Studio abgeleitet, nicht aus einer Fitness-App-Schablone. Die Tokens stehen in `:root` in `assets/app.css`:

- **Dunkler Grund** (`--raum` `#1b1e24`) nach dem grau-blauen Sprenkelteppich, warmes Off-White als Schrift nach den ockerfarbenen Wänden. Trainiert wird morgens um sieben, ein weißer Bildschirm blendet.
- **Zwei Akzente mit fester Bedeutung, sonst nirgends:** `--tag` `#f2b705` (das Gelb der Gerätenummern-Schilder) heißt „hier tippen". `--vinyl` `#c8562b` (das Orange des Bankpolsters) heißt „Steigerung fällig" und ist für die Coach-Ansage aus §7 reserviert. Wer eines der beiden dekorativ verwendet, nimmt ihm die Aussage.
- **Monospace für alle Zahlen und Kürzel, Sans für Fließtext.** Ein Trainingslog ist eine Zahlentabelle. Keine Webfonts, die PWA muss offline laufen.
- **Hauptaktionen sitzen unten am Rand**, nicht mittig. Bedienung mit dem Daumen heißt Daumenzone. Touch-Ziele ab 56px, `env(safe-area-inset-*)` beachten.
- **Signature ist die Geräteplakette** (`.plakette`): das gelbe Nummernschild, das im Studio an den Geräten klebt. Sie trägt die echte Stationsnummer. Nie mit erfundenen Nummern dekorieren.

**Die Nummer steht unter dem Foto, nicht darauf** (22.08.2026). Bis dahin trat sie nur an die Stelle eines **fehlenden** Fotos — und weil alle 25 Übungen ein Bild haben, war sie unsichtbar: Frank trug drei Nummern ein und sah nirgends etwas. Sichtbar war sie einzig in der vergrößerten Ansicht, nach einem Tipp aufs Bild. Im Studio hilft sie aber beim **Suchen**, und dafür muss sie ohne Zutun dastehen.

Unter dem Bild und nicht darauf, weil daneben die Textspalte rund 130 Punkte hoch ist und das Foto nur 76 — der Platz lag ohnehin brach. So bleibt das Foto unversehrt und die Nummer bekommt die volle Bildbreite. Vorgabe von Frank war „mindestens ein Viertelbild", kleiner sei auf dem Handy nicht lesbar; eine Ecklösung auf dem Bild hätte genau dieses Viertel verdeckt.

**Alle gelben Nummernfelder einer Liste sind gleich breit**, nämlich so breit wie das Foto daneben (76 auf der Kachel, 56 in der Zeile). Inhaltsbreite ergab eine ausgefranste linke Kante, weil „7" schmaler ist als „43". Die Regel hängt am direkten Kind (`.zeile > .plakette`, `.kachel__kopf > .plakette`); die Plakette unter einem Foto steckt in `.kachel__geraet` und holt ihre Breite von dort.

**Auf der aufgeklappten Kachel wird die Nummer quadratisch und so groß wie das Foto** (76×76, Schrift `--s-gross`; Vorgabe von Frank, 26.08.2026). Diese eine Übung steht man gerade an, und dort sucht man das Gerät nicht mehr, sondern gleicht ab. Auf den zugeklappten Kacheln bleibt sie flach, sonst würde die Liste doppelt so lang. Bei `aspect-ratio` muss das `padding` auf 0, sonst zählt es zur Höhe und der Kasten wird höher als breit.

**Auf dem iPhone gehört die App über Safari auf den Homescreen, nicht über Chrome** (26.08.2026). Über Chrome installiert verstellte sich beim Drehen ins Querformat der Seitenzoom und blieb auch nach dem Zurückdrehen verstellt — betroffen war nur das Studio, nicht die Startseite. Ursache ist der Container: `apple-mobile-web-app-capable` wertet nur Safari aus. In der App selbst war nichts zu finden (kein Überlauf, kein `resize`-Handler, keine gespeicherte Breite, `-webkit-text-size-adjust` gesetzt), und Playwrights WebKit bildet den Dreh-Zoom nicht nach. **`maximum-scale=1` wäre die falsche Abhilfe:** Es schaltet das Aufziehen mit zwei Fingern ab, und genau das ist im verstellten Zustand der einzige Ausweg.

Ohne Foto bleibt es beim Alten: Dann steht die Nummer **an der Stelle** des Bildes (Frank, 22.08.2026). Die beiden Ansichten formen diesen Fall unterschiedlich — Quadrat auf der Kachel, Balken in der Zeile —, was bewusst so bleibt.

**Die Pausenfarbe ist kein dritter Akzent.** `--ruhe` (dunkles Rot) tritt ausschließlich im Pausen-Panel auf und sagt dort „warte". Bewusst dunkel: die Pause dauert zwei Minuten, ein leuchtender Block über ein Drittel des Bildschirms blendet morgens um sieben. Gelb und Orange bleiben unangetastet.

**Bei null verschwindet das Panel, es gibt keinen Zustand danach.** Dort stand einmal ein helles Grün mit „Weiter". Es sagte nur, was ohnehin zu sehen ist, und kostete einen Tipp, bevor man wieder an den Reglern war. Dass die Pause vorbei ist, erkennt man daran, dass sie weg ist. Das Rütteln bleibt, es erreicht einen auch dann, wenn man nicht aufs Handy schaut.

**Nach dem letzten Satz einer Einheit startet keine Pause.** Sie dient dem nächsten Satz; gibt es keinen, hieße Herunterzählen, jemanden vor dem Ausgang warten zu lassen. Geprüft wird der ganze Tag und nicht nur die eigene Übung, denn der letzte Satz kann mitten in der Liste liegen, wenn man sie nicht der Reihe nach abarbeitet.

**Der Ausgang aus einer Einheit steht immer unter der letzten Kachel**, fertig oder nicht. Der letzte Satz wird ganz unten bestätigt, und dort steht man dann; eine Meldung neun Kacheln weiter oben sieht man nicht. Bei offener Einheit tritt er zurück (kein Rahmen, kein Gelb), weil bis dahin auf „Satz bestätigen" getippt wird. Eine Einheit wird nicht immer fertig, und dann muss sie sich trotzdem beenden lassen, ohne dass man erst alles abhakt.

**Schriftgrößen kommen aus der Skala in `:root`, sie werden nicht erfunden.** Neun Stufen (`--s-marke` 11 bis `--s-riesig` 44, Verhältnis rund 1,2). Vorher standen 21 verschiedene Größen im Stylesheet, elf davon innerhalb von zehn Pixeln — jede in dem Moment entstanden, in dem sie gebraucht wurde. Genau deshalb konnte eine Abschnittsüberschrift auf 12px landen, während der Fließtext daneben auf 17px stand: Es gab nichts, woran sich das hätte brechen können. Wer eine Zwischengröße zu brauchen glaubt, braucht sie in aller Regel nicht. Eine bewusste Ausnahme trägt die Zahl im Pausen-Panel (`min(24vw, 92px)`): Sie ist keine Schrift im Fließtext, sondern eine Anzeige, die man aus zwei Metern lesen soll.

**Eingabefelder brauchen Polsterung, nicht `min-height`.** `.feld` holte seine Höhe aus `min-height` bei `line-height: 1`. Chrome zentriert den Text darin trotzdem, **iOS Safari nicht** — dort klebt er am oberen Rand. Ein Datumsfeld bringt auf iOS zusätzlich sein eigenes Bedienelement mit eigener Höhe mit, deshalb waren zwei Felder nebeneinander ungleich hoch und die Kalenderschaltfläche lag außerhalb des Kastens, sodass sich das Datum nicht ändern ließ. Höhe also über `padding`, `line-height: normal`, und `appearance: none` am Datumsfeld. Achtung beim `font`-Kurzschreiber: `font: 17px/1 …` setzt `line-height` still wieder auf 1.

**Formulare gegen WebKit prüfen, nicht nur gegen Chrome.** Die App läuft ausschließlich auf Franks iPhone, die Testläufe aber gegen das installierte Chrome. Bei Formularelementen — Datumsfeldern zuallererst — gehen Blink und WebKit am weitesten auseinander, und genau dort ist mehrfach etwas durchgerutscht, das im Chrome-Bild einwandfrei aussah.

```bash
COACH_BROWSER=webkit node tests/lauf.js verwaltung einheiten studio
```

Das ist dieselbe Engine wie Safari (WebKit 26.5 gegen Safari 26.5 auf diesem Mac), nur nicht die iOS-Fassung. Voreinstellung bleibt Chrome, damit kein Browser nachgeladen werden muss.

**Drei Läufe gehen unter WebKit nicht:** `pwa` und `offline` (Playwrights WebKit bricht bei `page.reload()` im Offline-Zustand mit einem internen Fehler ab und bedient den Cache-Notnagel nicht) sowie `bilder` (Abbruch beim Klick, vermutlich der Datei-Upload; nicht weiter eingegrenzt). Alles davon sind Grenzen des Werkzeugs, keine Befunde über die App. Die übrigen zwölf Läufe sind unter beiden Engines grün:

```bash
COACH_BROWSER=webkit node tests/lauf.js fotos regel fortschritt update verwaltung \
    studio verlauf coach paare hilfe einrichtung einheiten
```

**Offline wird in Tests doppelt abgesichert.** `setOffline()` allein genügt nicht: Anfragen durch den Service Worker gehen je nach Playwright-Fassung trotzdem durch, und wird die Seite nach dem Neuladen aus dem Cache bedient, meldet `navigator.onLine` weiter `true` — woran die Statusleiste hängt. `tests/pwa.js` und `tests/offline.js` sperren deshalb zusätzlich die API per `context.route(...).abort()`, und `pwa` überschreibt `navigator.onLine` per `addInitScript`, damit schon der erste `statusZeichnen()`-Aufruf beim Hochfahren die Wahrheit sieht.

**Die Sperre muss am Kontext hängen, nicht an der Seite.** `page.route()` fängt keine Anfragen ab, die der Service Worker selbst stellt — und genau so geht der Offline-Puffer hinaus. Mit `page.route()` kam gelegentlich doch ein Satz beim Server an, aber nur im Gesamtlauf und nicht bei einzelnen Läufen: die Sorte Fehlschlag, die man dreimal für einen Zufall hält. Auf dem iPhone setzt Safari die Eigenschaft korrekt; das ist reine Werkzeug-Nachhilfe.

**Testläufe legen echte Dateien in `assets/img/exercises/` ab.** `api/foto-upload.php` schreibt auf einen festen Pfad neben dem Code, den `COACH_DATA` nicht umleitet — der Browser lädt die Bilder ja per URL von dort. Der `bilder`-Lauf räumt selbst wieder auf, aber nur wenn er bis zum Ende kommt; nach einem Abbruch blieb eine 500-KB-Datei liegen und stand beim nächsten Deploy zum Hochladen an (abgefangen von der 400-KB-Grenze). `tests/hilfen.js` entfernt deshalb nach jedem Lauf, was neu dazukam und wie eine hochgeladene Datei heißt.

`tests/hilfen.js` sortiert die Playwright-Fassungen aus dem npx-Cache nach Version **absteigend**. Dort liegen sieben nebeneinander (1.52 bis 1.62), und jede erwartet eine bestimmte Browser-Fassung. Wer einfach die erste nimmt, die er findet, bekommt „Executable doesn't exist" für einen Browser, der sehr wohl da ist.

Ein iOS-Simulator bliebe der Goldstandard, dafür fehlt auf diesem Mac das volle Xcode (App Store, rund 15 GB, dazu die Simulator-Laufzeit als eigener Download; danach `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`, braucht Franks Passwort). Solange er fehlt gilt: **Was WebKit nicht abdeckt — der native Datumswähler, Tastaturverhalten, Scrollen — gilt erst als geprüft, wenn Frank es auf dem Gerät gesehen hat.**

**Der Schwerpunkt-Schalter ist auskommentiert, nicht gelöscht** (22.08.2026). Er schrieb `focus` nach `plan.json`, und den **Wert** las kein einziger Codepfad — weder `lib/coach.php` noch `api/plan.php`. Die Beschriftung versprach „mehr Sätze pro Woche für diese Gruppe"; drei Gruppen standen auf dem Server so eingestellt, ohne jede Wirkung. SPEC.md §7 hatte es zugesagt, gebaut wurde es nie. Zurückholen ist eine Zeile in `zeichnePlan()`; `zeichneSchwerpunkte()`, der Zweig `d.prio`, `.prio` und der auskommentierte Testlauf stehen unverändert da. Ein Test hält fest, dass der Schalter derzeit **nicht** in der Oberfläche steht.

**`muscle_priorities` in `plan.json` darf trotzdem nicht aufgeräumt werden.** Seine **Schlüssel** sind die Liste der gültigen Muskelgruppen: `uebung_pruefen()` prüft jede Übung dagegen, und die Auswahl im Übungsformular wird daraus gebaut. Ohne das Objekt ließe sich keine Übung mehr anlegen. Der Wert dahinter ist es, der niemanden interessiert.

**Die Einstellungen haben zwei Bereiche, „Übungen" und „Allgemein"** (22.08.2026). Vorher trug die Seite alles untereinander: Übungen, Körpergewicht, Schwerpunkte. Das Passwort wäre der vierte Block gewesen, hinter 25 Übungszeilen.

Umgeschaltet wird mit **demselben Schalter, der auch die Schwerpunkte umlegt** (`.schalter`, hier als `.schalter--breit`). „Eins von zweien" hat in dieser App eine Form; ein Reiter im Stil einer fremden Bibliothek wäre eine zweite Bildsprache für denselben Handgriff. Er füllt die Breite und ist 48px hoch, weil er hier die Seite gliedert und nicht beiläufig in einer Zeile sitzt.

Der leere Fall („Hier ist noch kein Plan") steht jetzt **innerhalb** des Übungsbereichs. Vorher endete dort die ganze Seite — ausgerechnet in einer kaputten Installation kam man so weder ans Passwort noch ans Körpergewicht.

**Formulare in der App prüfen selbst, der Browser nicht.** Die Anmeldeformulare in `index.php` tragen `novalidate`, das Passwortformular ebenso. Die eingebaute Prüfung käme als Sprechblase in fremder Gestalt, säße woanders und sagte je nach Browser etwas anderes; außerdem verdeckte sie den Weg zum Server, auf dem die Regel tatsächlich lebt. Wer `required` oder `minlength` setzt, hebelt die eigene Meldung aus — genau daran ist der erste Testlauf gescheitert.

**Eine Bestätigung ist kein Kasten.** `.quittung` ist reiner Text in der Schriftfarbe, fett, an derselben Stelle wie `.fehler` und nur durch die Farbe von ihr unterschieden. Mit Rahmen, Fläche und Rundung sah sie aus wie ein viertes, leeres Eingabefeld unter den dreien darüber. Kein Grün: Gelb heißt „hier tippen", Orange heißt „Steigerung fällig", ein dritter Akzent nur für „hat geklappt" wäre einer zu viel.

**Der Verwaltungsbereich heißt in der Oberfläche „Einstellungen", intern `plan`.** `data-gehe="plan"`, `zustand.ansicht === 'plan'`, `zeichnePlan()` — daran hängen `api/settings.php` und `plan.json`. Die beiden Namen dürfen auseinanderlaufen, aber nicht unbemerkt: zwei Tests in `tests/verwaltung.js` halten die sichtbare Beschriftung fest. SPEC.md §5.3 heißt seit dem Abgleich vom 21.08.2026 ebenfalls „Einstellungen" und nennt den internen Namen dazu.

**Diagramme** (Phase 3, `chart()` in `app.js`):

- **Nie eine zweite y-Achse.** Schwerstes Gewicht (kg) und Volumen (kg mal Wiederholungen) haben ganz andere Größenordnungen. In ein Achsenkreuz gezwungen suggerieren sich kreuzende Linien Zusammenhänge, die es nicht gibt. Deshalb zwei getrennte Diagramme mit gemeinsamer Auswahl.
- **Die Datenlinie trägt die Schriftfarbe, nicht Gelb und nicht Orange.** Beide Akzente haben eine feste Bedeutung und verlören sie als Datenfarbe. Gelb bleibt dem gewählten Punkt vorbehalten, weil das die Interaktion ist.
- **x folgt der echten Zeit, nicht der Position im Array.** Eine Trainingspause von drei Wochen soll als Lücke sichtbar sein.
- Die y-Achse ist bewusst nicht bei null verankert, sonst wäre der Unterschied zwischen 80 und 85 kg nicht zu sehen. Beschriftet sind die tatsächlichen Grenzwerte, damit der Ausschnitt ablesbar bleibt. Für Balken gälte das Gegenteil.
- **Bei einer einzigen Einheit gibt es keine Kurve**, sondern den Wert als Zeile. Eine Linie aus einem Punkt behauptet einen Verlauf, den es nicht gibt.

## Konventionen

- Sprache durchgehend Deutsch, in der App wie in der Dokumentation. Für Texte gilt der `humanizer`-Skill.
- Kein Framework, keine Paketmanager-Abhängigkeit, keine Datenbank. Wenn eine Lösung eine dieser drei Sachen braucht, ist sie für dieses Projekt die falsche Lösung.
- Charts über eine schlanke Bibliothek per CDN (uPlot oder Chart.js), erst in Phase 3.
- `config.json` enthält den Passwort-Hash und den API-Key und gehört niemals in ein Repo.
- **`HELP.md`** ist die Endnutzer-Hilfe: Verhalten plus Begründung, in der Sprache dessen, der die App benutzt. Nicht mit dieser Datei verwechseln — hier steht, warum der Code so ist, dort, warum die App sich so verhält. Gepflegt über den `save-help`-Skill. Was in der Oberfläche nicht existiert, kommt dort auch nicht vor.
- Übergeordnete Regeln und die Landkarte: `/Users/frank/AI-OS/CLAUDE.md`. Flüchtiger Arbeitsstand gehört in die (nicht versionierte) `STATE.md` (Skills `save-state` / `read-state`), nicht hierher.
