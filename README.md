# Coach

Trainings-App für eine Person. Sie führt durch die Einheit im Studio, hält
jeden Satz fest und sagt, wann das Gewicht hochgeht.

Die Bedienung ist auf den Daumen ausgelegt: große Plus- und Minus-Knöpfe, die
Felder stehen schon auf dem letzten Ergebnis. Bestätigte Sätze liegen sofort im
Browser und gehen erst danach zum Server, damit schlechter Empfang im Studio
nichts kostet. Auf dem Homescreen sieht sie aus wie eine App und öffnet auch
ohne Netz.

Sie läuft auf gewöhnlichem Webspace: PHP, JSON-Dateien statt Datenbank, kein
Build-Schritt. Hochladen genügt.

Was die App tut und warum sie so gebaut ist: [SPEC.md](SPEC.md). Wer am Code
arbeitet: [CLAUDE.md](CLAUDE.md).

## Installation

Gebraucht werden PHP 8.0 oder neuer, Apache und HTTPS. Das haben die üblichen
Hosting-Pakete. Keine Datenbank, keine Abhängigkeiten.

1. Den Inhalt des Repos ins Web-Root laden. `tests/` kann draußen bleiben.
2. Die Adresse im Browser aufrufen.
3. Passwort setzen.

HTTPS ist Pflicht: ohne verschlüsselte Verbindung legt kein Browser die App auf
den Homescreen, und offline funktioniert sie dann auch nicht.

## Passwort

Die App ist passwortgeschützt. Beim ersten Aufruf im Browser legst du das
Passwort fest, mindestens acht Zeichen. Danach bleibst du 30 Tage angemeldet.

Mach das gleich nach dem Hochladen. Bis dahin könnte es jeder setzen, der die
Adresse kennt.

Später ändern geht nur über die Kommandozeile:

```bash
php bin/init-config.php --force
```

## Schutz der Daten

Die mitgelieferte `.htaccess` erledigt das. Sie sperrt:

- `data/` mit Passwort-Hash, API-Schlüssel und Trainingsdaten
- `lib/` und `bin/`, den internen Code
- Verzeichnislisten und die `.lock`- und `.tmp`-Dateien

Beim Einrichten legt die App eine zweite `.htaccess` in `data/` an, als
Reserve. Normalerweise ist hier nichts zu tun.

### Wenn du nicht Apache benutzt

nginx und Caddy lesen keine `.htaccess`. Dann greift die mitgelieferte Sperre
nicht, und `data/` wäre über den Browser abrufbar. Zwei Dinge sind nötig:

`data/` aus dem Web-Root nehmen. Den Pfad setzt die Umgebungsvariable
`COACH_DATA`; im Code steht er an genau einer Stelle.

Die Sperren in die Serverkonfiguration übertragen, für nginx etwa so:

```nginx
location ~ ^/(data|lib|bin)(/|$)   { return 404; }
location ~ \.(lock|tmp)$           { return 404; }
location ~ \.(js|css)$             { add_header Cache-Control "no-store"; }
location = /service-worker.js      { add_header Cache-Control "no-store"; }
```

## Der Trainingsplan

Beim Einrichten legt die App drei Trainingstage und 25 Übungen an: Oberkörper,
Ganzkörper, Unterkörper im Wechsel. Du kannst also sofort loslegen. Warum der
Plan so aussieht, steht in [TRAININGSPLAN.md](TRAININGSPLAN.md).

Alles daran lässt sich unter „Einstellungen" ändern: Übungen anlegen, löschen,
Zielsätze und Wiederholungsbereiche anpassen, Fotos hochladen und zuordnen.

Zu jeder Übung gehört ein gezeichnetes Bild, das zeigt, wie sie aussieht.
Eigene Fotos vom Gerät kannst du in den Einstellungen hochladen und
zuordnen — im Studio findet man die Maschine schneller über ein Foto als
über den Namen.

Die Zeitzone steht in `lib/config.php` auf `Europe/Berlin`. Sie entscheidet,
welcher Kalendertag für eine Einheit gilt.

## Kopier dir ab und zu den Ordner data/

Alles, was du trainiert hast, steht in `data/` auf dem Server. Die App legt
keine Kopie an, weder auf dem Handy noch anderswo. Verlierst du den Server,
verlierst du die Historie.

Deshalb: **`data/` ab und zu per FTP auf deinen Rechner laden.** Dann liegen
die Daten an zwei Stellen, und genau darum geht es. Der Ordner ist ein paar
Kilobyte groß, das dauert Sekunden.

Wer das automatisieren will: `api/export.php` gibt alle Daten auf einmal als
JSON aus, damit ein Cronjob sie abholen kann. Wie das eingerichtet wird, steht
in [CLAUDE.md](CLAUDE.md).

## Optional: die Bilderweiterung GD

**Coach läuft ohne GD.** Ist sie da, wird sie an einer einzigen Stelle benutzt,
beim Hochladen eines Gerätefotos, und bringt dort vier Vorteile:

- Das Bild schrumpft auf 1600 Pixel. Ein Handyfoto hat sonst mehrere Megabyte
  und muss im Studio über schlechten Empfang geladen werden.
- Hochkant aufgenommene Fotos stehen richtig herum statt auf der Seite.
- Alle Metadaten fallen weg, auch der Aufnahmeort. Die Gerätefotos liegen ohne
  Anmeldung im Netz.
- Aus einer Datei, die wie ein Bild aussieht, wird sicher ein Bild. Ein
  gültiges JPEG kann hinter den Bilddaten Code tragen; beim Neuschreiben
  überlebt nur, was Bildpunkt ist.

Ohne GD wird die Datei geprüft und unverändert abgelegt: volle Größe,
Metadaten bleiben drin, hochkant fotografierte Geräte liegen auf der Seite.

GD ist die Bildbibliothek von PHP. Fürs Drehen gehört die Erweiterung `exif`
dazu.

**Beim Hoster** ist meist beides schon an. Sonst im Kundenmenü unter den
PHP-Einstellungen `gd` einschalten; `exif` steht in der Liste gleich daneben.
Zu installieren gibt es nichts.

**Auf einem eigenen Server:**

```bash
php -m | grep -E 'gd|exif'          # was ist schon da?

sudo apt install php8.4-gd          # Debian, Ubuntu
sudo dnf install php-gd             # Fedora, RHEL

sudo systemctl restart php8.4-fpm   # oder apache2, je nach Aufbau
```

Passe die Versionsnummer an deine PHP-Version an. `exif` liegt bei den meisten
Distributionen schon im PHP-Grundpaket — ob sie da ist, zeigt der erste Befehl.

## Entwicklung

```bash
php -S 127.0.0.1:8777        # lokal starten
node tests/lauf.js           # alle Testläufe, rund zwei Minuten
node tests/lauf.js studio    # ein einzelner Lauf
```

Die Tests brauchen Playwright und laufen gegen das installierte Chrome.
`COACH_BROWSER=webkit` läuft gegen WebKit, dieselbe Engine wie Safari. Jeder
Lauf startet einen eigenen PHP-Server mit eigenem Datenverzeichnis über
`COACH_DATA`; das echte `data/` wird nie angefasst.
