# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stand

`SPEC.md` (deutsch, ~290 Zeilen) ist die verbindliche Vorgabe und die einzige Quelle dafür, was gebaut wird. Vor jedem Implementierungsvorschlag lesen; das Dokument ist so geschrieben, dass sich der Plan ohne Rückfragen ableiten lässt. Die Phasen 0 bis 6 in §10 sind die vorgegebene Reihenfolge.

Gebaut sind Phase 0 (lokal), 1 und 2, also Fundament, Login, Verwaltung und Studio-Modus:

| Steht | Fehlt |
|---|---|
| `lib/storage.php`, `config.php`, `auth.php`, `uebungen.php`, `logs.php` | `api/history.php` (Phase 3), `coach.php` (Phase 4), `export.php` (Phase 5) |
| `api/`: `login`, `logout`, `exercises`, `settings`, `plan`, `session` | Verlaufskurven, Coach-Ansage auf der Kachel |
| `index.php`, `assets/app.css`, `assets/app.js`: Start, Studio, Mein Plan | `manifest.json`, `service-worker.js` |
| `.htaccess`, `bin/init-config.php` | alles auf dem Server, es ist noch nichts deployed |

Drei Abweichungen von SPEC.md, alle bewusst:

- **`lib/`** gibt es in der Spezifikation nicht. Ohne gemeinsame Bibliothek müssten Pfadkonstante, atomares Schreiben, Session-Gate und Übungsprüfung in jedem Endpunkt neu stehen. `.htaccess` sperrt den Ordner nach außen.
- **`api/settings.php`** verwaltet die Struktur von `plan.json` (Rotation, Schwerpunkte), weil §3 den Namen `plan.php` für die Studio-Ansicht aus Phase 2 vergibt (heutiger Tag samt Übungen und letzten Werten). Zwei verschiedene Aufgaben, zwei Endpunkte.
- **Feld `station`** in `exercises.json`, optional, zusätzlich zum Schema in §4: die aufgeklebte Gerätenummer aus dem Studio. Sie ist der Grund, warum man das richtige Gerät wiederfindet, und trägt die Plakette in der Oberfläche.
- **Feld `rotation_index`** in jeder Session, zusätzlich zum Schema in §4. Die Rotation darf denselben Tag mehrfach enthalten (`oberkoerper, unterkoerper, oberkoerper`), über den Tagesnamen allein wäre die Position also nicht eindeutig und der Vorschlag würde zwischen zwei Positionen hängenbleiben. Ältere Einträge ohne das Feld fallen auf die Namenssuche zurück.

**Sätze werden einzeln gespeichert, nicht am Ende der Einheit.** Jede Bestätigung ist ein eigener POST auf `session.php` mit `set_index`. Damit ist der Aufruf wiederholbar: ein Doppel-Tap oder ein Wiederholungsversuch überschreibt denselben Satz, statt ihn ein zweites Mal anzuhängen, und dasselbe Feld erlaubt das Korrigieren eines bereits bestätigten Satzes. Im Studio kann der Akku leer werden; was bestätigt ist, liegt auf der Platte.

**Die Reihenfolge der Sessions braucht ein zweites Kriterium.** `date` ist auf die Sekunde genau. Zwei Einträge derselben Sekunde wären nicht unterscheidbar, und „welche war die letzte" entschiede der Zufall, was den Tagesvorschlag verdreht. `logs_monat()` sortiert deshalb nach Datum **und** Position in der Datei.

`bin/init-config.php` richtet `data/` ein (Passwort-Hash, API-Key, Grundgerüst von `plan.json`). Läuft nur auf der Kommandozeile und wird nicht auf den Server geladen.

## Worum es geht

Persönliche Trainings-App für genau einen Nutzer (Frank), einziges Ziel Muskelaufbau. Sie läuft auf klassischem Shared Hosting bei All-Inkl: vanilla PHP, JSON-Dateien statt Datenbank, HTML/CSS/Vanilla-JS als Single-Page-App, PWA-Hülle für das Homescreen-Icon. Kein Framework, kein Build-Schritt, kein Docker. Backups zieht ein n8n-Workflow über einen schlüsselgeschützten Endpunkt.

Der zentrale Bedienfall ist das Studio: Eingabe nur mit dem Daumen, große Plus/Minus-Buttons, nie Tastatur, Felder mit dem letzten Ergebnis vorbefüllt, damit gleiche Leistung nur bestätigt werden muss.

## Entscheidungen, die den ganzen Code binden

Diese Punkte stehen verteilt in der Spezifikation und ergeben zusammen die Architektur.

**Das Frontend spricht ausschließlich mit der PHP-API, nie mit den JSON-Dateien.** Es gibt keinen Pfad, auf dem der Browser eine Datei aus `data/` direkt liest. Der Schutz von `data/` hat zwei Ebenen (§8): bevorzugt liegt der Ordner eine Ebene über dem Web-Root, zusätzlich sperrt eine `.htaccess`-Regel den Zugriff. Ob die Ebene über dem Web-Root bei diesem All-Inkl-Paket existiert, ist noch nicht geprüft. Deshalb gehört der Pfad zu `data/` in **eine** zentrale Konstante, damit der Umzug später eine Zeile ist und keine Suche über alle Endpunkte.

**Zwei getrennte Zugangswege.** Alle Endpunkte prüfen die Session, mit genau zwei Ausnahmen: `login.php` (setzt sie) und `export.php` (prüft stattdessen `api_key` gegen `config.json`, weil n8n sich nicht einloggen kann). Beim Anlegen eines neuen Endpunkts ist die Session-Prüfung der Normalfall.

**JSON-Dateien als Datenhaltung heißt: jeder Schreibvorgang liest die ganze Datei, ändert sie und schreibt sie zurück.** Ohne Sperre (`flock`) oder atomares Schreiben (temporäre Datei plus `rename`) zerlegt ein abgebrochener Request eine Datei komplett. Es gibt nur einen Nutzer, aber Doppel-Tap auf einen Bestätigungs-Button und ein Service-Worker-Retry reichen für zwei parallele Requests.

**Logs liegen monatsweise** (`data/logs/YYYY-MM.json`), damit die Dateien klein bleiben und das n8n-Backup handlich ist. Das hat eine Folge für die Leseseite: der Verlauf einer einzelnen Übung (`history.php`) und die Coach-Regel (`coach.php`) brauchen beide Sessions über Monatsgrenzen hinweg. Dieser Leser gehört einmal geschrieben und von beiden benutzt, nicht zweimal.

**Der Tagesvorschlag wird abgeleitet, nicht gespeichert.** „Heute: Unterkörper" entsteht aus `plan.json → rotation` plus dem `day` der letzten Session in den Logs. Es gibt kein Feld „aktueller Tag", das man pflegen müsste. Die manuelle Auswahl eines anderen Tags muss immer möglich bleiben, Frank soll nie ins Schema gezwungen sein.

**Die Progressionsregel lebt nur in `coach.php`.** Doppelte Progression (§7): erst Wiederholungen bis `rep_max` hochklettern, dann Gewicht um `weight_step` rauf und Wiederholungen zurück Richtung `rep_min`. Die Regel ist deterministisch und ohne Sprachmodell. Das Frontend zeigt die Ansage nur an und rechnet nichts selbst nach.

**`weight_step` gibt es zweimal:** global in `config.json` als Default (5), pro Übung in `exercises.json` als Überschreibung. Erlaubt sind 1,25, 2,5 und 5. Jede Stelle, die Gewicht verändert, muss den Wert der Übung nehmen und auf den globalen zurückfallen.

**Ein Request pro Bildschirm.** `plan.php` liefert den Tag, die Übungen und die letzten Werte zusammen aus, sonst müsste der Studio-Bildschirm pro Kachel nachladen.

Ausbaustufen (KI-Coach über eine Sprachmodell-API, Dashboard-Widgets) sind in §7 und §10 bewusst als andockbar beschrieben. Sie sind kein Teil des MVP und rechtfertigen keine zusätzliche Abstraktion vorab; die Logs sind als sauberes JSON schon API-tauglich.

## Befehle

Es gibt keinen Build, keinen Linter und kein Test-Framework, und laut Spezifikation soll das so bleiben.

PHP liegt über Homebrew lokal vor (8.5). Auf All-Inkl läuft eine andere Version, die vor dem Deployment zu prüfen ist. Der Code hält sich an PHP 8.0 und nutzt nichts Neueres.

```bash
php bin/init-config.php     # data/ einrichten, fragt zweimal nach dem Passwort
php -S 127.0.0.1:8777       # lokal starten, dann http://127.0.0.1:8777
for f in lib/*.php api/*.php bin/*.php; do php -l "$f"; done   # Syntax-Check
```

Der eingebaute PHP-Server liest **keine** `.htaccess`. Der Schutz von `data/` lässt sich damit nicht prüfen, das geht nur auf dem echten All-Inkl-Host: die JSON-URL im Browser aufrufen und auf 403 prüfen.

Es gibt kein Test-Framework, und laut Spezifikation soll das so bleiben. Geprüft wird mit `curl` gegen den laufenden Server. Der Anmeldeablauf muss diese Antworten liefern:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST localhost:8777/api/logout.php          # 401 ohne Session
curl -s -o /dev/null -w "%{http_code}\n" localhost:8777/api/login.php                   # 405, nur POST
curl -s -X POST localhost:8777/api/login.php -H 'Content-Type: application/json' \
     -d '{"password":"falsch"}'                                                         # 401
```

Die Sperre beim parallelen Schreiben ist mit 25 gleichzeitigen Prozessen geprüft, die denselben Zähler hochzählen: es kamen 25 heraus. Wer an `json_update()` etwas ändert, sollte das wiederholen.

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

Noch nicht eingerichtet. Das Vorgehen für den gleichen Host steht erprobt in `../lithium-rechner/CLAUDE.md` und gilt hier genauso:

- SSH-Alias `allinkl` aus `~/.ssh/config` (HostName `KENNUNG.kasserver.com`, Key `~/.ssh/SSH-SCHLUESSEL`).
- `scp`/`rsync` immer mit `-o IdentityAgent=none -o IdentitiesOnly=yes`, sonst greift Franks 1Password-SSH-Agent über die `Host *`-Regel und der Login scheitert mit „Too many authentication failures".
- Zielpfade sind **relativ** zum chroot-Home (`www/htdocs/KENNUNG/<domain>/`), ein absoluter Pfad läuft ins Leere.
- Domain und Zielordner für diese App stehen noch nicht fest.

Anders als beim Lithium-Rechner (eine einzelne Datei) braucht diese App einen Abgleich mehrerer Ordner. `data/` darf dabei **nie** überschrieben oder mitgeladen werden, dort liegen die echten Trainingsdaten und der Passwort-Hash.

## Die Fotos in `images/`

49 iPhone-Originale, alle 2268x4032 hochkant, zusammen 134 MB, Dateinamen `IMG_16xx.JPG` ohne jede Zuordnung. Das ist das Rohmaterial für den offenen Punkt „Gerätefotos" aus §11: echte Studio-Geräte, teils mit aufgeklebter Gerätenummer, die für die Wiedererkennung wichtig ist.

Beim Aufbereiten für `assets/img/exercises/`:

- Nach Übungs-ID benennen (`beinpresse.jpg`), so verweist `exercises.json → photo` darauf.
- Verkleinern. In voller Auflösung sind sie für Kacheln auf dem Handy sinnlos groß.
- **EXIF entfernen.** Alle 49 Dateien enthalten GPS-Koordinaten, also den Standort des Studios.
- Nicht mit KI stilisieren. Nur dezent vereinheitlichen (Zuschnitt, Ausrichtung), sonst geht die Wiedererkennung im Studio verloren.

Die Originale in `images/` bleiben liegen, aufbereitet wird in einen eigenen Ordner.

## Offene Punkte aus §11

Zwei davon blockieren Phasen:

- **Konkreter Trainingsplan** (Übungen je Tag, aktuelle Geräte, Startgewichte, Wiederholungen). Ohne diese Werte lassen sich `exercises.json` und `plan.json` nicht mit echten Daten füllen. Braucht einen Studiobesuch.
- **Serverstruktur bei All-Inkl** (existiert eine Ebene über dem Web-Root?). Zwei-Minuten-Check per SFTP, entscheidet Phase 0.

Die Zuordnung Foto zu Gerät hängt am Trainingsplan mit dran.

## Gestaltung

**Für Arbeit an der Oberfläche immer den `frontend-design`-Skill benutzen** (Vorgabe von Frank).

Die Richtung ist aus Franks Studio abgeleitet, nicht aus einer Fitness-App-Schablone. Die Tokens stehen in `:root` in `assets/app.css`:

- **Dunkler Grund** (`--raum` `#1b1e24`) nach dem grau-blauen Sprenkelteppich, warmes Off-White als Schrift nach den ockerfarbenen Wänden. Trainiert wird morgens um sieben, ein weißer Bildschirm blendet.
- **Zwei Akzente mit fester Bedeutung, sonst nirgends:** `--tag` `#f2b705` (das Gelb der Gerätenummern-Schilder) heißt „hier tippen". `--vinyl` `#c8562b` (das Orange des Bankpolsters) heißt „Steigerung fällig" und ist für die Coach-Ansage aus §7 reserviert. Wer eines der beiden dekorativ verwendet, nimmt ihm die Aussage.
- **Monospace für alle Zahlen und Kürzel, Sans für Fließtext.** Ein Trainingslog ist eine Zahlentabelle. Keine Webfonts, die PWA muss offline laufen.
- **Hauptaktionen sitzen unten am Rand**, nicht mittig. Bedienung mit dem Daumen heißt Daumenzone. Touch-Ziele ab 56px, `env(safe-area-inset-*)` beachten.
- **Signature ist die Geräteplakette** (`.plakette`): das gelbe Nummernschild, das im Studio an den Geräten klebt. Sie trägt ab Phase 2 auf jeder Übungskachel die echte Stationsnummer, damit er das Gerät findet. Bis dahin ist sie definiert, aber ungenutzt, und soll nicht mit erfundenen Nummern dekoriert werden.

## Konventionen

- Sprache durchgehend Deutsch, in der App wie in der Dokumentation. Für Texte gilt der `humanizer`-Skill.
- Kein Framework, keine Paketmanager-Abhängigkeit, keine Datenbank. Wenn eine Lösung eine dieser drei Sachen braucht, ist sie für dieses Projekt die falsche Lösung.
- Charts über eine schlanke Bibliothek per CDN (uPlot oder Chart.js), erst in Phase 3.
- `config.json` enthält den Passwort-Hash und den API-Key und gehört niemals in ein Repo.
- Übergeordnete Regeln und die Landkarte: `/Users/frank/AI-OS/CLAUDE.md`. Flüchtiger Arbeitsstand gehört in eine `STATE.md` (Skills `save-state` / `read-state`), nicht hierher.
