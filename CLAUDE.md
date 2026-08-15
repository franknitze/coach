# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stand: Spezifikation, kein Code

Der Ordner enthält bisher nur `SPEC.md` und 49 Gerätefotos. Kein PHP, kein Frontend, kein Paketmanager, keine Tests, keine Konfiguration.

`SPEC.md` (deutsch, ~290 Zeilen) ist die verbindliche Vorgabe und die einzige Quelle dafür, was gebaut wird. Vor jedem Implementierungsvorschlag lesen; das Dokument ist so geschrieben, dass sich der Plan ohne Rückfragen ableiten lässt. Die Phasen 0 bis 6 in §10 sind die vorgegebene Reihenfolge.

Zwei organisatorische Lücken, die vor der ersten Codezeile geschlossen gehören:

1. **Keine Versionierung.** Der Ordner hat kein eigenes Git-Repo. Er liegt zwar im OS-Repo `/Users/frank/AI-OS`, aber dort ist `/websites/` per `.gitignore` ausgeschlossen (`git check-ignore -v .` zeigt das). Änderungen sind aktuell also nirgends gesichert. Vor dem Start `git init` im Projektordner, dabei die 134 MB Fotos nicht ungefiltert aufnehmen.
2. **Nicht auf der Landkarte.** In `/Users/frank/AI-OS/CLAUDE.md` fehlt das Projekt in der Tabelle unter `websites/`. Beim ersten echten Schritt dort eintragen.

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

**PHP ist auf diesem Mac nicht installiert** (`php` fehlt im PATH). Für lokales Testen zuerst `brew install php`, danach im Web-Root:

```bash
php -S localhost:8000
```

Der eingebaute PHP-Server liest **keine** `.htaccess`. Der Schutz von `data/` lässt sich damit nicht prüfen, das geht nur auf dem echten All-Inkl-Host: die JSON-URL im Browser aufrufen und auf 403 prüfen.

Werte für `config.json` erzeugen:

```bash
php -r 'echo password_hash("PASSWORT", PASSWORD_DEFAULT), PHP_EOL;'   # password_hash
openssl rand -hex 32                                                   # api_key für n8n
```

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

## Konventionen

- Sprache durchgehend Deutsch, in der App wie in der Dokumentation. Für Texte gilt der `humanizer`-Skill.
- Kein Framework, keine Paketmanager-Abhängigkeit, keine Datenbank. Wenn eine Lösung eine dieser drei Sachen braucht, ist sie für dieses Projekt die falsche Lösung.
- Charts über eine schlanke Bibliothek per CDN (uPlot oder Chart.js), erst in Phase 3.
- `config.json` enthält den Passwort-Hash und den API-Key und gehört niemals in ein Repo.
- Übergeordnete Regeln und die Landkarte: `/Users/frank/AI-OS/CLAUDE.md`. Flüchtiger Arbeitsstand gehört in eine `STATE.md` (Skills `save-state` / `read-state`), nicht hierher.
