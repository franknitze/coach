# Fitness-App „Muskelaufbau" — Spezifikation & Implementierungsplan

> Persönliche Trainings-Tracking-App mit einem einzigen Ziel: **Muskelaufbau / Kraft**.
> Schlank, schnell im Studio bedienbar, ohne überflüssige Features.
> Dieses Dokument ist die Vorgabe für die Umsetzung mit Claude Code.
>
> **Am 21.08.2026 mit dem gebauten Stand abgeglichen.** Wo die Umsetzung von
> der ursprünglichen Vorgabe abweicht, steht die Entscheidung samt Datum und
> Begründung an Ort und Stelle. Die Begründungen im Detail führt `CLAUDE.md`.

---

## 1. Ziel & Leitprinzipien

- **Einziges Ziel:** Muskelaufbau. Jedes Feature muss darauf einzahlen. Kein „Fitness-Schnickschnack".
- **Nur ein Nutzer:** Frank. Keine Nutzerverwaltung, kein Mehrbenutzer-System.
- **Schlank zuerst:** MVP läuft ohne teure Abhängigkeiten. Ausbaustufen (KI-Coach, Dashboard-Widgets) sind sauber angedockt, aber nicht Pflicht.
- **Wenig Klicks:** Bedienung im Studio komplett mit dem Daumen, keine Tastatur, große Buttons.
- **Automatisierung:** Backups laufen über n8n, keine händischen Eingriffe.

---

## 2. Technische Rahmenbedingungen

| Punkt | Entscheidung |
|---|---|
| Hosting | Klassisches Shared Hosting bei **All-Inkl** (kein VPS, kein Docker) |
| Backend | **PHP** (vanilla, kein Framework nötig — All-Inkl liefert PHP standardmäßig) |
| Datenhaltung | **JSON-Dateien** auf dem Server, **keine Datenbank** |
| Frontend | HTML + CSS + Vanilla-JS als leichte Single-Page-App, spricht eine kleine JSON-API im PHP-Backend an |
| App-Feeling | **PWA** (manifest + service worker) → Homescreen-Icon, App-Look |
| Charts | **Inline-SVG, keine Bibliothek.** Gebraucht wird eine Linie mit zwei Achsen; dafür lohnt kein Nachladen, und ein CDN-Skript widerspricht der PWA, die ohne Netz laufen soll. *(Geändert 19.08.2026, vorher: uPlot oder Chart.js per CDN.)* |
| HTTPS | Pflicht (All-Inkl Let's Encrypt) |

> **Grundsatz:** Kein direkter Datei-Zugriff aus dem Browser. Das Frontend redet nur über die PHP-API, nie direkt mit den JSON-Dateien.

---

## 3. Ordnerstruktur

```
/ (öffentlicher Web-Root, bei All-Inkl die Domain-Ebene)
├── index.php              # App-Shell, Session-Gate
├── manifest.json          # PWA-Manifest
├── service-worker.js      # PWA-Cache (App-Shell offline)
├── .htaccess              # Sperrt data/, lib/ und bin/ (s. §8)
│
├── api/
│   ├── _bootstrap.php     # Session, JSON-Antworten, Methodenprüfung
│   ├── login.php          # POST: Passwort prüfen, Session setzen
│   ├── logout.php
│   ├── setup.php          # POST: einmalig Passwort setzen und Plan anlegen
│   ├── passwort.php       # POST: Passwort ändern (verlangt das alte)
│   ├── plan.php           # GET: heutiger/gewählter Tag + Übungen + letzte Werte
│   ├── session.php        # POST: einen Satz speichern (einzeln, nicht am Ende)
│   ├── exercises.php      # GET/POST/DELETE: Übungsbibliothek (CRUD)
│   ├── settings.php       # GET/POST: Struktur von plan.json (Rotation, Schwerpunkte)
│   ├── history.php        # GET: Verlauf einer Übung
│   ├── coach.php          # GET: regelbasierte Empfehlung pro Übung
│   ├── einheiten.php      # GET: Rückblick, letzte Einheiten oder ein Monat
│   ├── gewicht.php        # GET/POST: Körpergewicht mit Datum
│   ├── fotos.php          # GET: verfügbare Gerätefotos
│   ├── foto-upload.php    # POST: Foto vom Handy annehmen
│   ├── foto-loeschen.php  # POST: Foto entfernen
│   └── export.php         # GET: schlüsselgeschützter Endpunkt für n8n-Backup
│
├── lib/                   # gemeinsame Bibliothek, von außen gesperrt
│   ├── storage.php        # atomares Schreiben, Sperren
│   ├── config.php         # Pfade, Konstanten, Zeitzone
│   ├── auth.php           # Session-Gate
│   ├── uebungen.php       # Prüfung der Übungsdaten
│   ├── logs.php           # Leser über Monatsgrenzen hinweg
│   ├── coach.php          # die Progressionsregel aus §7
│   ├── standardplan.php   # der mitgelieferte Plan: 3 Tage, 25 Übungen
│   ├── gewicht.php        # Körpergewicht mit Datum
│   └── fortschritt.php    # der Fortschritts-Index
│
├── sessions/              # PHP-Sitzungsdateien, von außen gesperrt
│
├── assets/
│   ├── app.js
│   ├── app.css
│   ├── icons/             # PWA-Icons
│   └── img/exercises/     # Gerätefotos, 1200 px JPEG
│
├── bin/                   # Werkzeuge, nur Kommandozeile, von außen gesperrt
│   ├── init-config.php    # data/ einrichten
│   ├── plan-anlegen.php   # den Trainingsplan hineinschreiben
│   ├── fotos.sh           # Webfassungen aus den Originalen rechnen
│   ├── deploy.sh          # der einzige Weg auf den Server
│   └── …
│
├── tests/                 # Testläufe, nicht auf dem Server
│
└── data/                  # im Web-Root, per .htaccess gesperrt (s. §8)
    ├── config.json        # Passwort-Hash, API-Key, globale Settings
    ├── exercises.json     # Übungsbibliothek
    ├── plan.json          # Tage, Rotation, Muskelgruppen-Prioritäten
    ├── gewicht.json       # Körpergewicht mit Datum
    └── training/
        └── 2026-08.json   # Trainingseinheiten, ein Array pro Monat
```

`lib/` steht nicht im ursprünglichen Entwurf. Ohne gemeinsame Bibliothek müssten Pfadkonstante, atomares Schreiben, Session-Gate und Übungsprüfung in jedem Endpunkt neu stehen.

`settings.php` gibt es, weil §3 den Namen `plan.php` für die Studio-Ansicht aus Phase 2 vergibt. Zwei verschiedene Aufgaben, zwei Endpunkte.

**Entschieden (19.08.2026):** `data/` liegt **im** Web-Root und wird per `.htaccess` gesperrt, nicht eine Ebene darüber. Siehe §8.

---

## 4. Datenmodell (JSON-Schemas)

### `config.json`
```json
{
  "password_hash": "$2y$...",
  "api_key": "langer-zufaelliger-string-fuer-n8n",
  "default_weight_step": 5,
  "rest_timer_seconds": 120,
  "session_lifetime_days": 30
}
```

- Supersets (gepaarte Übungen mit kürzerer Pause, `rest_pair_seconds`) gibt es seit dem 23.10.2026 nicht mehr. Jede Übung wird am Stück gemacht, die Pause ist immer `rest_timer_seconds`.

### `exercises.json` — Übungsbibliothek (Objekt, Key = Übungs-ID)
```json
{
  "beinpresse": {
    "id": "beinpresse",
    "name": "Beinpresse",
    "muscle_group": "beine",
    "photo": "beinpresse.jpg",
    "day": "unterkoerper",
    "order": 2,
    "target_sets": 4,
    "rep_min": 8,
    "rep_max": 12,
    "weight_step": 5,
    "station": "12",
    "assisted": false,
    "execution": "Rücken flach an die Lehne, Knie nicht ganz durchdrücken.",
    "video_url": "https://www.youtube.com/watch?v=…"
  }
}
```
- `weight_step` überschreibt pro Übung den globalen Default. Erlaubt sind `0.25`, `0.5`, `1`, `1.25`, `2.5` und `5`. *(Die drei kleinen Stufen kamen am 19.08.2026 dazu: an Kurzhanteln und an Maschinen mit Zusatzscheibe geht es feiner, und wo eine ganze Stufe zu viel wäre, bliebe die Progressionsregel sonst stehen.)*
- `photo` verweist auf eine Datei in `assets/img/exercises/`.
- `station` ist die aufgeklebte Gerätenummer aus dem Studio, optional. Sie ist der Grund, warum man das richtige Gerät wiederfindet, und trägt die gelbe Plakette in der Oberfläche.
- `assisted` kennzeichnet eine Unterstützungsmaschine: Dort hebt ein Gegengewicht einen Teil des Körpergewichts an, **weniger Gewicht heißt schwerer**. Ohne dieses Feld schickte die Progressionsregel dort in die falsche Richtung.
- `execution` trägt die Ausführung in einem Satz, `video_url` ein selbst hinterlegtes YouTube-Video (nur https auf youtube.com oder youtu.be, leer erlaubt). Bis zum 23.10.2026 stand hier ein englischer Suchbegriff mit Knöpfen für YouTube- und Google-Suche; die sind entfallen, weil eine Suche nur zufällig das richtige Video findet.
- `hidden` (seit 23.10.2026): ausgeblendet. Die Übung steht nicht mehr in Plan und Studio, ihre Sätze zählen weiter in Rückblick und Fortschritt. Vollständiges Löschen entfernt dagegen auch alle Sätze, nach Rückfrage und mit Sicherungskopie in `data/sicherung/`.

### `plan.json` — Struktur des Trainingsplans
```json
{
  "days": {
    "oberkoerper": { "label": "Oberkörper" },
    "unterkoerper": { "label": "Unterkörper" }
  },
  "rotation": ["oberkoerper", "unterkoerper"],
  "muscle_priorities": {
    "brust":    "normal",
    "ruecken":  "normal",
    "beine":    "normal",
    "schulter": "normal",
    "bizeps":   "normal",
    "trizeps":  "normal"
  }
}
```
- `rotation` ist **zweigliedrig**. Über drei Termine pro Woche (Mo/Mi/Fr) verschiebt sich der Wechsel dadurch von selbst: Woche 1 ist OK/UK/OK, Woche 2 ist UK/OK/UK, und jede Hälfte kommt im Schnitt 1,5-mal pro Woche dran, wie §12 es verlangt. *(Korrigiert 15.08.2026: die frühere dreigliedrige Fassung `[OK, UK, OK]` hätte sich jede Woche identisch wiederholt, Montag wäre für immer Oberkörper gewesen und der Unterkörper nur einmal pro Woche drangekommen.)*
- `muscle_priorities`: `"normal"` oder `"focus"`. `focus` → diese Gruppe bekommt mehr Volumen. Default überall `normal`; Priorisierung ist vorhanden, aber optional nutzbar.

### `training/YYYY-MM.json` — Trainingseinheiten (Array von Sessions)
```json
[
  {
    "date": "2026-08-11T07:05:00+02:00",
    "day": "unterkoerper",
    "rotation_index": 1,
    "exercises": [
      {
        "exercise_id": "beinpresse",
        "sets": [
          { "weight": 80, "reps": 12 },
          { "weight": 80, "reps": 11 },
          { "weight": 80, "reps": 10 }
        ]
      }
    ]
  }
]
```
- Monatsweise Dateien halten die Einheiten klein und machen das n8n-Backup handlich.
- Der Ordner hieß bis zum 22.08.2026 `logs/`. Unter „logs“ erwartet man Systemmeldungen, nicht Trainingsdaten; umbenannt am 22.08.2026, bestehende Installationen ziehen beim ersten Aufruf selbst um.
- `rotation_index` merkt sich die Position in der Rotation. Über den Tagesnamen allein wäre sie nicht eindeutig, sobald derselbe Tag mehrfach in der Rotation steht; der Tagesvorschlag bliebe dann zwischen zwei Positionen hängen. Ältere Einträge ohne das Feld fallen auf die Namenssuche zurück.
- **Sätze werden einzeln gespeichert, nicht am Ende der Einheit.** Jede Bestätigung ist ein eigener POST auf `session.php` mit `set_index`. Damit ist der Aufruf wiederholbar: ein Doppel-Tap oder ein Wiederholungsversuch überschreibt denselben Satz, statt ihn anzuhängen. Im Studio kann der Akku leer werden; was bestätigt ist, liegt auf der Platte.

### `gewicht.json` — Körpergewicht mit Datum
```json
[
  { "date": "2026-08-19", "kg": 96.8 },
  { "date": "2026-08-21", "kg": 96.3 }
]
```
- Gebraucht vom Fortschritts-Index (§5.1): An der Unterstützungsmaschine ist die bewegte Last „Körpergewicht minus Hilfe".
- Mit Datum und nicht als eine aktuelle Zahl. Sonst würde jeder Gang auf die Waage die gesamte Vergangenheit umrechnen, und fünf Kilo weniger erschienen in alten Einheiten als Rückschritt.
- Eintragen ist freiwillig. Ohne Eintrag bleiben die unterstützten Übungen aus dem Index heraus, alles andere rechnet weiter.

---

## 5. Bildschirme & Abläufe

### 5.1 Startseite (Dashboard)
- Erkennt anhand der letzten Session, welcher Tag logisch als Nächstes dran ist, und zeigt groß: **„Heute: Unterkörper"** + großer **„Los geht's"**-Button.
- Direkt darunter die manuelle Auswahl eines anderen Tags (Frank ist nie ins Schema gezwungen — Krankheit, zusätzliche Einheit etc.).
- **Fortschritt** als Punktzahl und Kurve über alle Einheiten. Je Übung wird verglichen, was in dieser Einheit geschafft wurde, mit der ersten Einheit dieser Übung; der Tageswert ist der **Mittelwert** dieser Verhältnisse mal 100. Mittelwert und nicht Summe: Sonst zeigte die Kurve die Tagesart statt den Fortschritt, weil ein Tag mit neun Übungen immer über einem mit acht stünde. Der Vergleichswert je Satz ist Epley (`Gewicht × (1 + Wdh/30)`), der beste Satz zählt — nur das Gewicht zu nehmen ließe die Kurve wochenlang flach, während die doppelte Progression aus §7 die Wiederholungen hochklettert.
- **Rückblick:** die letzten zehn Einheiten mit Datum, Trainingstag und Umfang. Antippen öffnet die Einheit (§5.5).
- **Offene Einheiten** (ergänzt 22.08.2026). „Offen" ist enger als „unvollständig": von **heute** und nicht durch. Nur so eine lässt sich weitertrainieren; danach gilt eine Einheit als beendet, so als hätte man „Einheit beenden" gedrückt. Sie steht in der Liste mit gelbem Balken, dem Wort „offen" und „Weiter", und ein Tipp führt ins **Studio** statt in die Leseansicht — dort fehlten sonst genau die Übungen, die noch dran sind. Eine offene Einheit sticht außerdem den Rotationsvorschlag: sonst springt die Startseite nach einem Neuladen auf den nächsten Tag, obwohl man mitten in einem anderen steckt. Bei zwei offenen gewinnt oben die zuletzt angefangene, und die Hauptaktion unten **verschwindet** — sie könnte nicht sagen, welche sie fortsetzt. Ein frischer Tag bleibt über sie startbar.
- Verweise auf den **Kalender** (§5.6) und auf die Einstellungen (§5.3).
- Die Hauptaktion klebt am unteren Rand, damit sie bei wachsender Liste in der Daumenzone bleibt.

### 5.2 Studio-Modus (nach „Los geht's")
- Liste der heutigen Übungen als **große Kacheln** untereinander.
- Jede Kachel zeigt: **Foto des richtigen Geräts**, Name, Zielvorgabe (z.B. „4 Sätze, 8–12 Wdh"), **letztes Ergebnis** („zuletzt: 80 kg × 10").
- Ist eine **Gerätenummer** hinterlegt, steht sie als gelbes Schild **unter** dem Foto, in voller Bildbreite (ergänzt 22.08.2026). Vorher trat sie nur an die Stelle eines fehlenden Fotos und war damit praktisch unsichtbar, weil jede Übung ein Bild hat. Im Studio sucht man das Gerät über die Nummer, also muss sie ohne Zutun dastehen. Ohne Foto steht sie weiterhin an dessen Stelle.
- Coach-Ansage direkt auf der Kachel, wenn eine Steigerung fällig ist (§7).
- Tippen klappt die Kachel auf → pro Satz eine Zeile mit zwei großen Werten: **Gewicht** und **Wiederholungen**.
- **Eingabe ausschließlich über große Plus/Minus-Buttons**, nie Tastatur:
  - Wiederholungen: 1er-Schritte.
  - Gewicht: Default 5 kg, pro Übung einstellbar (`weight_step`).
- Felder sind mit dem **Tagesziel vorbefüllt**: Arbeitsgewicht und Ziel-Wiederholungen aus der Coach-Regel (`target_weight`, `target_reps`). Geändert am 26.08.2026; bis dahin stand dort der letzte Wert. Innerhalb einer Einheit wird der zuletzt bestätigte Satz wiederholt.
- Die **Punktreihe im Kachelkopf** ist die Fortschrittsanzeige: gefüllt = erledigt, leer = steht aus. Erledigte Sätze werden **nicht aufgelistet** (Vorgabe vom 26.08.2026); unter dem Kachelkopf stehen nur die Regler. Die Punkte sind dafür größer geworden. Damit entfällt auch das nachträgliche Ändern eines Satzes.
- Ein großer Bestätigungs-Button pro Satz → danach läuft der **Pausen-Timer** (`rest_timer_seconds`), als Panel über dem unteren Bildschirmdrittel. Nach dem letzten Satz einer Einheit startet keine Pause: Sie dient dem nächsten Satz, und den gibt es dann nicht. Bei null verschwindet das Panel von selbst, es gibt keinen Zustand danach.
- **Keine Supersets** (Frank, 23.10.2026): Nach einem Satz bleibt die Übung offen, bis alle ihre Sätze durch sind, dann geht es zur nächsten offenen. Der frühere Sprung zur Partnerübung mit kürzerer Pause ist entfallen: Frank hatte ihn nie bemerkt, und eine Liste, die nicht der Reihe nach läuft, kostet die Übersicht.
- Ein Tipp aufs **Foto** öffnet die **Großansicht**: Bild, Gerätenummer, Name, Ausführungstext und, falls hinterlegt, der Knopf „Video ansehen“. Geändert am 26.08.2026: Vorher klappte der Text als eigene Zeile auf der Kachel auf und schob die Regler nach unten — also genau das weg, wofür die Kachel geöffnet war. Foto und Ausführung beantworten dieselbe Frage, deshalb stehen sie zusammen.
- Hat eine Übung **kein Foto**, bleibt die Zeile **„Wie geht die Übung?"** als einziger Weg dorthin stehen; die Großansicht zeigt dann nur den Text. Mit Foto entfällt sie.
- Der Ausgang aus der Einheit steht **immer** unter der letzten Kachel, fertig oder nicht. Der letzte Satz wird ganz unten bestätigt, und eine Meldung neun Kacheln weiter oben sieht man nicht. Eine Einheit wird nicht immer fertig.
- **Ohne Netz:** Jeder bestätigte Satz geht zuerst in den lokalen Puffer, auch bei bester Verbindung. Der Satz gilt, sobald er dort liegt; das Senden ist eine Frage von später. Eine Statusleiste nennt jederzeit Zahl und Lage. Im Studio ist schlechter Empfang der Normalfall, kein Sonderfall.

### 5.3 Verwaltungsbereich („Einstellungen")
- Ruhig zuhause bedienbar, getrennt vom schnellen Studio-Modus. In der Oberfläche heißt er **„Einstellungen"**, intern `plan`.
- **Zwei Bereiche zur Auswahl, „Übungen" und „Allgemein"** (ergänzt 22.08.2026, auf Wunsch von Frank). Die Seite trug vorher alles untereinander; das Passwort wäre der vierte Block hinter 25 Übungszeilen gewesen. Umgeschaltet wird mit demselben Schalter, der auch die Schwerpunkte umlegt — „eins von zweien" hat in dieser App eine Form. „Übungen" ist der Bereich, in dem man landet.

**Übungen**
- **Übungsbibliothek:** Übung anlegen/ändern/entfernen (Name, Foto, Gerätenummer, Muskelgruppe, Zielsätze, Wdh-Bereich, Schrittweite, Gewichtsrichtung, Tag-Zuordnung, Reihenfolge, Ausführung, Suchbegriff).
- **Foto vom Handy hochladen** und einer Übung zuordnen. Das Formular öffnet direkt die Kamera; die Zuordnung kann nur ein Mensch treffen, weil man auf einem Foto das Gerät sieht, aber nicht die Übung.
- Plan ist eine frei pflegbare Liste, nichts Festgemauertes.

**Allgemein**
- **Körpergewicht** mit Datum eintragen, für den Fortschritts-Index.
- Muskelgruppen-Priorität pro Gruppe setzen (`normal`/`focus`).
- **Passwort ändern** (ergänzt 22.08.2026). Verlangt das alte Passwort, obwohl die Session schon geprüft ist: Sie hält 30 Tage und liegt auf einem Handy, das man liegen lässt. Der Endpunkt antwortet bei falschem alten Passwort mit **403 und nicht 401** — auf eine 401 lädt das Frontend im angemeldeten Bereich neu, weil das dort „Sitzung abgelaufen" heißt, und die Meldung wäre wortlos weg. Angemeldet bleibt man; Anmeldungen in anderen Browsern bleiben ebenfalls bestehen.

### 5.4 Auswertung (pro Übung)
- In den Einstellungen eine Übung antippen → **Verlaufskurve**.
- **Zwei getrennte Diagramme**, nie eine zweite y-Achse: Arbeitsgewicht über Zeit und Trainingsvolumen (Gewicht × Wdh). Kilogramm und Volumen haben ganz andere Größenordnungen; in ein Achsenkreuz gezwungen suggerieren sich kreuzende Linien Zusammenhänge, die es nicht gibt.
- An der Unterstützungsmaschine zeigt das erste Diagramm die **geringste Hilfe** und das zweite die Wiederholungen statt des Volumens. „Gewicht × Wdh" wäre dort die abgenommene Last und stiege, wenn man sich mehr helfen lässt.
- x folgt der echten Zeit, nicht der Position: Eine Trainingspause von drei Wochen soll als Lücke sichtbar sein.
- Bei einer einzigen Einheit gibt es keine Kurve, sondern den Wert als Zeile. Eine Linie aus einem Punkt behauptet einen Verlauf, den es nicht gibt.

### 5.5 Eine abgeschlossene Einheit
- Über den Rückblick der Startseite oder über den Kalender erreichbar.
- Oben eine Zusammenfassung (Datum, Beginn, Trainingstag, Umfang, ob vollständig), darunter **dieselben Kacheln wie im Studio**, nur ausgefüllt: Foto, Name, Vorgabe, Punktreihe und die Sätze dieser Einheit. Beim Zurückblicken ist „welches Gerät war das" dieselbe Frage wie im Studio.
- Rein lesend. Antippen einer Übung führt in ihren Verlauf (§5.4). Ausnahme: Ist die Einheit offen (§5.1), steht hier ein „Weiter trainieren". Über die Startseite ist dieser Fall gar nicht erreichbar — dort führt eine offene Einheit direkt ins Studio —, über den Kalender schon, und dann stünde man vor einer Ansicht ohne Weg zurück ins Training.
- „Vollständig" wird gegen den heutigen Plan gerechnet und je Übung geprüft, nicht über die Summe. Ändert sich eine Zielsatzzahl, wechseln alte Einheiten die Markierung; das ist der Preis dafür, die Vorgabe nicht in jede Session zu duplizieren.

### 5.6 Kalender
- Monatsraster über **alle** Tage, nicht nur die trainierten: Die Liste sagt „was habe ich gemacht", das Raster sagt „wie regelmäßig war ich", und dafür ist die Lücke so wichtig wie der Eintrag.
- Woche beginnt am Montag. Trainierte Tage sind gefüllt und tragen das Kürzel des Trainingstags; Antippen öffnet die Einheit (§5.5) — auch bei einer offenen. Eine Zelle kann nur eine Einheit halten, bei zweien an einem Tag wäre unklar welche; fortgesetzt wird deshalb über die Liste der Startseite oder über den Knopf in der Einheit selbst.
- Geblättert wird nur zwischen dem ältesten Monat mit Daten und dem laufenden.

---

## 6. Login & Sicherheit

- **Einzel-Login** für Frank. Passwort wird **niemals im Klartext** gespeichert, nur als Hash via PHP `password_hash()` / `password_verify()`.
- Nach erfolgreichem Login **Session** mit langer Lebensdauer (`session_lifetime_days`, z.B. 30 Tage) → kein tägliches Neu-Einloggen im Studio.
- Alle API-Endpunkte außer `login.php`, `setup.php` und `export.php` prüfen die Session. `passwort.php` prüft als einziger zusätzlich noch das Passwort selbst. `setup.php` ist der einzige, der sich selbst abschaltet: Er arbeitet nur, solange kein Passwort gesetzt ist, danach antwortet er dauerhaft mit 409.

---

## 7. Coach-Logik (regelbasierte progressive Überlastung)

**Modell: Doppelte Progression.** Erst Wiederholungen hochklettern, dann Gewicht rauf und Wdh zurücksetzen.

Regel (Frank, 17.10.2026), nachgespielt über alle Sessions der Übung, älteste zuerst:

```
regel(uebung):
  gewicht = Arbeitsgewicht der ersten Session, ziel = rep_min
  für jede Session:
    geschafft = Zielsatzzahl erreicht
                und alle Sätze bei gewicht
                und jeder Satz >= ziel Wiederholungen
    wenn geschafft und schwächster Satz >= rep_max:
        -> gewicht + weight_step, ziel = rep_min
    sonst wenn geschafft:
        -> ziel = schwächster Satz + 1
    sonst wenn bester Satz < rep_min:
        -> ziel = rep_min
    sonst:
        -> ziel bleibt (wiederholen)
```

Beispiel, 3 Sätze, 6 bis 10 Wdh, Stufe 5 kg: 6,6,6 → 7 · 7,7,7 → 8 · 8,8,6 → 8 · 8,8,8 → 9 · 9,9,9 → 10 · 10,10,10 → 55 kg × 6.

- Diese Regel ist kostenlos, deterministisch und deckt den Großteil des Nutzens ab.
- Das Ziel einer Einheit wird nicht gespeichert, sondern aus dem Verlauf nachgespielt (`coach_nachspielen()` in `lib/coach.php`). Nur so ist 8, 8, 6 als verfehltes Ziel 8 erkennbar.

**Festgelegt bei der Umsetzung**, wo die Regel oben offen bleibt:

- **Eine Wiederholung mehr nur, wenn alle Sätze das Ziel geschafft haben.** Bis zum 17.10.2026 zählte der beste Satz, und nach 8, 8, 6 kam 9. Frank hat das verworfen.
- **Einmal alle Sätze an der Obergrenze genügt.** Bis zum 17.10.2026 waren es zwei saubere Einheiten hintereinander (`COACH_EINHEITEN = 2`). Frank hat das verworfen: Geschafft ist geschafft.
- **Die Zielsatzzahl gehört zu „geschafft“.** Zwei Sätze auf der Obergrenze sind kein Beleg dafür, dass drei gehen; ohne diese Bedingung schöbe ausgerechnet ein Abbruch das Gewicht hoch.
- **„Eingebrochen“ heißt: auch der beste Satz liegt unter `rep_min`.** Dann geht das Ziel auf `rep_min` zurück, das Gewicht bleibt.
- **An der Unterstützungsmaschine** (`assisted`) läuft die Regel andersherum: Arbeitsgewicht ist der Satz mit der geringsten Hilfe, Steigern heißt weniger Gewicht. Bei 0 kg Hilfe endet die Leiter, und die Ansage nennt den Wechsel auf Zusatzgewicht.
- **Der Vorschlag befüllt die Eingabe** (seit 26.08.2026, vorher ausdrücklich nicht). `coach_empfehlung()` liefert dazu `target_weight` und `target_reps`; beim Steigern beginnen die Wiederholungen wieder bei `rep_min`. Umgekehrt auf Franks Wunsch: Im Feld soll stehen, was er erreichen soll. Der Preis ist der, den die alte Regel vermeiden wollte — ein unaufmerksames Bestätigen schreibt eine Wiederholung zu viel ins Protokoll.

### Ausbaustufe: KI-Coach (optional, später)
- Zusätzliche Analyse per Sprachmodell-API für übergreifende Muster: Stagnation über mehrere Übungen, Vorschlag Erholungswoche, Balance zwischen Muskelgruppen.
- **Datenstruktur ist bereits API-tauglich** (Logs als sauberes JSON) → andockbar ohne Umbau.

### Priorisierung → Volumen
- Muskelgruppen mit `focus` bekommen im Plan mehr Volumen (mehr Sätze/Übungen pro Woche). Fließt in Plan-Design und Coach-Vorschläge ein.

---

## 8. Datei-Schutz (All-Inkl-spezifisch)

**Entschieden (19.08.2026):** `data/` liegt **im** Web-Root und wird per `.htaccess` gesperrt. So wollte Frank es; die Ebene über dem Web-Root wird nicht genutzt.

Der Schutz hat trotzdem zwei Riegel:

1. Die `.htaccess` im Web-Root sperrt den kompletten `data/`-Baum, dazu `lib/` und `bin/`, Verzeichnislisten und die `.lock`- und `.tmp`-Dateien des atomaren Schreibens.
2. In `data/` liegt eine **zweite** `.htaccess` mit derselben Sperre, von `api/setup.php` angelegt. Geht die äußere bei einem Deployment verloren oder greift eine Regel nach einer Änderung an der Serverkonfiguration nicht mehr, wäre sonst der Passwort-Hash herunterladbar.

Der Pfad zu `data/` steht an genau einer Stelle (`DATA_DIR` in `lib/config.php`, überschreibbar per `COACH_DATA`). Ein Umzug über den Web-Root hinaus wäre damit eine Zeile.

Geprüft wird der Schutz bei jedem Deployment: `bin/deploy.sh` ruft `data/config.json`, `lib/config.php` und `bin/plan-anlegen.php` live ab und erwartet 403 beziehungsweise 404. Der eingebaute PHP-Server liest keine `.htaccess`, lokal lässt sich das also nicht prüfen.

---

## 9. Automatisiertes Backup via n8n

- **Kein** manueller Export-Button.
- `export.php` ist ein schlüsselgeschützter Endpunkt und liefert alle Daten als ein JSON-Bündel: `settings`, `exercises`, `plan`, `logs` und eine `summary`.
- Der Schlüssel wird gegen `config.json → api_key` geprüft. Kein Login-Durchklicken nötig.
- **Bevorzugt als Header** `X-API-Key`, `?key=` funktioniert weiter. Query-Strings landen im Zugriffsprotokoll des Webservers, bei All-Inkl liest die Statistik dort mit; ein Header steht nicht drin.
- **Passwort-Hash und API-Key sind im Export nicht enthalten.** Ein Backup, das regelmäßig auf einen Zweitserver wandert und durch n8n-Protokolle läuft, soll keine Geheimnisse tragen. Beide sind mit `bin/init-config.php` in zwei Minuten neu gesetzt, die Trainingsdaten nicht.
- Ein **n8n-Workflow** zieht den Endpunkt regelmäßig (Schedule-Trigger) und legt die Daten automatisiert auf einem Zweitserver ab. Kein händischer Eingriff.

---

## 10. Implementierungsplan (Phasen für Claude Code)

**Phase 0 — Server-Setup & Grundgerüst**
- All-Inkl-Ordnerstruktur per SFTP prüfen (existiert eine Ebene über dem Web-Root?).
- HTTPS/Let's Encrypt sicherstellen.
- `data/`-Ordner + `.htaccess`-Sperre anlegen.
- `config.json` initialisieren: Passwort-Hash erzeugen, zufälligen `api_key` setzen.

**Phase 1 — Auth & Verwaltung**
- `login.php` / `logout.php` + Session-Gate in `index.php`.
- App-Shell (HTML/CSS/JS-Grundgerüst, responsive, große Touch-Ziele).
- Übungsbibliothek-CRUD (`exercises.php`) + Verwaltungs-UI.
- Plan-Verwaltung (`plan.json`): Tage, Rotation, Muskel-Prioritäten.

**Phase 2 — Studio-Modus (Kern)**
- Startseite mit intelligentem Tagesvorschlag + „Los geht's" + manueller Tag-Auswahl.
- Übungskacheln mit Foto, Zielvorgabe, letztem Ergebnis.
- Satz-Eingabe über Plus/Minus-Buttons, Vorbefüllung, Speichern (`session.php`).
- Pausen-Timer.

**Phase 3 — Auswertung**
- `history.php` + Verlaufskurven pro Übung (Gewicht & Volumen), als Inline-SVG statt mit einer Bibliothek (§2).

**Phase 4 — Coach (regelbasiert)**
- `coach.php` mit doppelter Progression, Ansage auf der Kachel.

**Phase 5 — Automatisierung & PWA**
- `export.php` (schlüsselgeschützt) + n8n-Workflow.
- `manifest.json` + `service-worker.js` (App-Shell offline, Homescreen-Icon).

**Phase 6 — Optional / später**
- KI-Coach über Sprachmodell-API. *(Offen.)*
- ~~Dashboard-Widgets auf der Startseite~~ *(Erledigt 19.08.2026: Rückblick, Fortschritts-Index mit Kurve und Kalender, siehe §5.1, §5.5, §5.6.)*

**Stand 21.08.2026:** Phasen 0 bis 5 sind gebaut und laufen. Aus Phase 6 fehlt nur noch der KI-Coach. Der einzige offene Punkt außerhalb des Codes ist der n8n-Workflow aus §9 — bis er steht, ist `data/` auf dem Server die einzige Kopie der Trainingsdaten.

---

## 11. Offene Punkte (warten auf Frank)

- [x] **Gerätefotos** aus dem Studio — echte Fotos verwenden (Wiedererkennung), höchstens dezent vereinheitlichen (Zuschnitt/Ausrichtung), nicht KI-stilisieren. *(Erledigt: alle 25 Übungen haben ein Bild, 1200 px JPEG, ohne EXIF. Die Zuordnung passiert in der App unter „Einstellungen", nicht über Dateinamen — auf einem Foto sieht man das Gerät, aber nicht die Übung.)*
- [x] **Serverstruktur** bei All-Inkl prüfen: gibt es eine Ebene über dem Web-Root für `data/`? *(Entschieden 19.08.2026: `data/` bleibt im Web-Root und wird per `.htaccess` gesperrt, siehe §8.)*
- [ ] **Gerätenummern eintragen.** Das Feld `station` ist bei allen 25 Übungen leer. Solange es das ist, bleibt die gelbe Plakette ungenutzt — sie erscheint nur dort, wo ein Foto fehlt, und Fotos gibt es überall. Die Nummern stehen auf den Geräten im Studio und müssten einmal abgetippt werden.
- [x] **Konkreter Trainingsplan**: Übungen je Tag (Oberkörper/Unterkörper-Split, 3x/Woche rotierend), plus **aktuelle Geräte + Startgewichte/Wdh** als realistische Startwerte. *(Steht in `TRAININGSPLAN.md` und in `data/`. Aufgestellt aus §12 und der Geräteaufnahme, kein Studiobesuch nötig gewesen. **Startgewichte gibt es bewusst keine**: die erste Einheit ist die Eichung, danach übernimmt die Progressionsregel aus §7. Offen bleiben zwei Gerätenummern, die auf den Fotos nicht lesbar sind, siehe TRAININGSPLAN.md.)*

---

## 12. Trainings-Eckdaten (für das Plan-Design)

- Im Schnitt 3× pro Woche, morgens ~7–9 Uhr, ca. 1,5 h pro Einheit. **Nicht an feste Wochentage gebunden**: mal sind es zwei Einheiten, mal vier, dazwischen liegt Urlaub. Was zählt, ist die Reihenfolge der Einheiten, nicht der Kalender.
- >2 Jahre Erfahrung, bereits recht kräftig → oberes Volumen (~15–20 Sätze/Woche für große Gruppen). **Das ist die wichtigste Vorgabe für den Plan**, Volumen ist der Haupthebel für Muskelaufbau.
- Wiederholungsbereich 6–15, nah ans Muskelversagen. **Schwerpunkt auf dem unteren Ende:** Grundübungen 5–8, Maschinen 6–12. Über 12 nur dort, wo schwere Sätze technisch schlecht steuerbar sind (Waden, Bauch). Hohe Wiederholungszahlen bauen zwar auch Muskeln auf, aber nur bei echtem Versagen, und daran scheitert es in der Praxis.
- Split: Oberkörper/Unterkörper im Wechsel. Jede Einheit lädt **wenige Gruppen hoch** (10–11 Sätze je großer Gruppe pro Durchgang) statt viele Gruppen wenig. Nur so ist das Volumenziel in 1,5 h erreichbar. Die Frequenz je Gruppe ergibt sich daraus, wie oft trainiert wird: bei 3 Einheiten/Woche 1,5×, bei 4 Einheiten 2×.
- Gerätefokus (geringeres Verletzungsrisiko), ergänzt um wenige effiziente Grundübungen (z.B. Kreuzheben am Unterkörpertag).
