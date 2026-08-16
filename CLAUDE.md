# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stand

`SPEC.md` (deutsch, ~290 Zeilen) ist die verbindliche Vorgabe und die einzige Quelle dafür, was gebaut wird. Vor jedem Implementierungsvorschlag lesen; das Dokument ist so geschrieben, dass sich der Plan ohne Rückfragen ableiten lässt. Die Phasen 0 bis 6 in §10 sind die vorgegebene Reihenfolge.

Die Phasen 0 bis 5 aus §10 sind gebaut und laufen live auf dem Server. Der Trainingsplan steht mit 25 Übungen in den Daten, jede mit zugeordnetem Bild. Offen sind nur noch zwei Dinge:

| Steht | Fehlt |
|---|---|
| `lib/`: `storage`, `config`, `auth`, `uebungen`, `logs`, `coach` | **der n8n-Workflow**, der `export.php` abholt (siehe unten). `data/` auf dem Server hat damit **keine Sicherung**. |
| `api/`: `login`, `logout`, `exercises`, `settings`, `plan`, `session`, `history`, `coach`, `export`, `setup`, `fotos`, `foto-upload`, `foto-loeschen` | Phase 6 (KI-Coach, Dashboard-Widgets), ausdrücklich optional |
| `index.php`, `assets/`: Start, Studio, Mein Plan, Übungsdetail mit Verlauf, Coach-Ansage | |
| `manifest.json`, `service-worker.js`, `assets/icons/`, Offline-Puffer | |
| `.htaccess`, `bin/` (init-config, plan-anlegen, fotos, deploy, icons), `tests/` (244 Prüfungen) | |

Der flüchtige Arbeitsstand steht in `STATE.md`, nicht hier.

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

**JSON-Dateien als Datenhaltung heißt: jeder Schreibvorgang liest die ganze Datei, ändert sie und schreibt sie zurück.** Ohne Sperre (`flock`) oder atomares Schreiben (temporäre Datei plus `rename`) zerlegt ein abgebrochener Request eine Datei komplett. Es gibt nur einen Nutzer, aber Doppel-Tap auf einen Bestätigungs-Button und ein Service-Worker-Retry reichen für zwei parallele Requests.

**Logs liegen monatsweise** (`data/logs/YYYY-MM.json`), damit die Dateien klein bleiben und das n8n-Backup handlich ist. Das hat eine Folge für die Leseseite: der Verlauf einer einzelnen Übung (`history.php`) und die Coach-Regel (`coach.php`) brauchen beide Sessions über Monatsgrenzen hinweg. Dieser Leser gehört einmal geschrieben und von beiden benutzt, nicht zweimal.

**Der Tagesvorschlag wird abgeleitet, nicht gespeichert.** „Heute: Unterkörper" entsteht aus `plan.json → rotation` plus dem `day` der letzten Session in den Logs. Es gibt kein Feld „aktueller Tag", das man pflegen müsste. Die manuelle Auswahl eines anderen Tags muss immer möglich bleiben, Frank soll nie ins Schema gezwungen sein.

**Die Progressionsregel lebt nur in `lib/coach.php`.** Doppelte Progression (§7): erst Wiederholungen bis `rep_max` hochklettern, dann Gewicht um `weight_step` rauf und Wiederholungen zurück Richtung `rep_min`. Deterministisch, ohne Sprachmodell. Das Frontend zeigt die Ansage nur an und rechnet nichts selbst nach.

Sie steht in `lib/` und nicht im Endpunkt, weil sie zwei Zugänge hat: `api/coach.php` gibt sie einzeln aus (so sieht §3 den Endpunkt vor), `api/plan.php` hängt sie an jede Kachel, damit der Studio-Bildschirm mit einem Request auskommt. Wer die Regel ändert, ändert sie an dieser einen Stelle.

Drei Festlegungen, die die Spezifikation offen lässt:

- **`COACH_EINHEITEN = 2`.** §7 nennt „N = 2..3". Zwei ist der zügigere Wert; wer vorsichtiger steigern will, setzt die Konstante auf 3. Eine einzelne saubere Einheit reicht bewusst nicht, sonst schiebt ein guter Tag das Gewicht hoch, das am nächsten Termin wieder einbricht.
- **„Eingebrochen" heißt: auch der beste Satz liegt unter `rep_min`.** Der letzte Satz fällt bei hartem Training regelmäßig ab, das ist Ermüdung und kein zu schweres Gewicht. Würde jeder einzelne schwache Satz die Warnung auslösen, stünde sie ständig da und niemand läse sie mehr.
- **Der Coach-Vorschlag befüllt die Eingabe nicht.** Vorbefüllt wird weiter der letzte Wert (§5.2: gleiche Leistung nur bestätigen). Die App sagt, was fällig wäre; das Plus drückt Frank selbst. Sonst bestätigt er im Halbschlaf eine Steigerung, die er nicht geschafft hat.

**`weight_step` gibt es zweimal:** global in `config.json` als Default (5), pro Übung in `exercises.json` als Überschreibung. Erlaubt sind 1,25, 2,5 und 5. Jede Stelle, die Gewicht verändert, muss den Wert der Übung nehmen und auf den globalen zurückfallen.

**Ein Request pro Bildschirm.** `plan.php` liefert den Tag, die Übungen und die letzten Werte zusammen aus, sonst müsste der Studio-Bildschirm pro Kachel nachladen.

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

Er steht in **`TRAININGSPLAN.md`** (Begründung: Aufteilung, Reihenfolge, Volumen) und in **`bin/plan-anlegen.php`** (die Zahlen, die nach `data/` geschrieben werden). Wer die Zahlen ändert, ändert die Begründung mit, sonst driften beide auseinander.

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
node tests/lauf.js coach      # einzeln: regel, verwaltung, studio, verlauf, coach
```

Kein Test-Framework, wie in SPEC.md §2 vorgesehen. `tests/lauf.js` ist ein Skript, das die Läufe nacheinander startet und mit Exit-Code 1 endet, wenn etwas scheitert. Playwright steuert nur den Browser und läuft gegen das installierte Chrome, damit kein Browser nachgeladen wird. Fehlt Playwright, sagt die Fehlermeldung, was zu tun ist.

**Jeder Lauf ist vollständig abgeschottet.** Er startet einen eigenen PHP-Server auf einem eigenen Port mit einem eigenen Datenverzeichnis im Temp-Ordner, gesetzt über `COACH_DATA`. Das ist keine Bequemlichkeit, sondern Notwehr: die Läufe löschen und schreiben Logdateien, und gegen `data/` ausgeführt kosteten sie die Trainingshistorie. Deshalb gilt:

- **Testcode darf `DATA_DIR` niemals umgehen** und nie mit festen Pfaden auf `data/` zugreifen.
- Antwortet auf dem Port schon etwas, bricht der Lauf ab statt weiterzumachen. Ein übriggebliebener Server aus einem abgestürzten Lauf hat ein anderes Datenverzeichnis, und der Lauf liefe stillschweigend gegen die falschen Daten. Genau das ist einmal passiert und hat einen halben Debug-Durchgang gekostet.
- Die Läufe sind unabhängig von der Reihenfolge; jeder setzt seinen Ausgangszustand über `t.logs()` selbst.

Was jeder Lauf abdeckt: `regel` prüft `coach_empfehlung()` direkt in PHP über alle Zweige aus §7, ohne Browser. `verwaltung` deckt Anmeldung und Übungsbibliothek ab, `studio` den Trainingsablauf samt Rotation und Pausen-Timer, `verlauf` die Kurven, `coach` die Ansage auf der Kachel, `pwa` Manifest, Service Worker und Export, `offline` eine ganze Einheit ohne Netz samt Übertragung danach.

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

Das erprobte Vorgehen für denselben Host steht auch in `../lithium-rechner/CLAUDE.md`.

## Bilder: zwei Ordner, nur einer zählt

**Die Anwendung liest ausschließlich `assets/img/exercises/`.** Nirgends im Code steht ein anderer Bildpfad. Wer dort nicht liegt, ist für die App nicht vorhanden, egal was sonst auf der Platte herumliegt.

| Ordner | Was | Im Repo? | Auf dem Server? |
|---|---|---|---|
| `images/` | die Werkbank: 25 generierte Übungsbilder (2400x1792 PNG) und 49 iPhone-Aufnahmen aus dem Studio (`IMG_*.JPG`), zusammen rund 310 MB | nein | nein |
| `assets/img/exercises/` | 25 Webfassungen, 1200 px JPEG, je rund 200 KB | **ja** | **ja** |

`images/` ist Werkbank, nicht Anwendung. Der Ordner liegt auf Franks Mac, ist per `.gitignore` ausgeschlossen und wird von `bin/deploy.sh` übersprungen. Sein einziger Zweck: aus ihm rechnet `bin/fotos.sh` die Webfassung.

**Nicht alles darin gehört in die App.** Dateien, die `IMG_*` heißen, überspringt `bin/fotos.sh`: Das sind die iPhone-Rohaufnahmen, 49 unsortierte Gerätebilder, die die Bildauswahl zumüllen würden. Soll eine davon doch hinein, bekommt sie einen sprechenden Namen, dann greift das Skript sie ab. Die 25 gezeichneten Übungsbilder heißen nach Tag und Position im Plan (`a1` bis `a9` für Tag A, `b1` bis `b8`, `c1` bis `c8`), also etwa `b2-klimmzug-untergriff.png`.

Die Zuordnung Bild zu Übung passiert **in der App** unter „Mein Plan", nicht über Dateinamen. Auf einem Foto sieht man das Gerät, aber nicht, welche Übung jemand daran macht; das kann nur Frank entscheiden. Gespeichert wird sie als Feld `photo` in `data/exercises.json`, und weil `data/` nie deployed wird, reist eine lokal gemachte Zuordnung **nicht** mit auf den Server. Zugeordnet wird deshalb direkt auf dem Live-Server.

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
- **Signature ist die Geräteplakette** (`.plakette`): das gelbe Nummernschild, das im Studio an den Geräten klebt. Sie trägt die echte Stationsnummer, in der Liste klein, auf der Übungskachel groß als Ersatz für ein fehlendes Foto. Nie mit erfundenen Nummern dekorieren.

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
- Übergeordnete Regeln und die Landkarte: `/Users/frank/AI-OS/CLAUDE.md`. Flüchtiger Arbeitsstand gehört in eine `STATE.md` (Skills `save-state` / `read-state`), nicht hierher.
