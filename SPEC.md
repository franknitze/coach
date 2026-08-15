# Fitness-App „Muskelaufbau" — Spezifikation & Implementierungsplan

> Persönliche Trainings-Tracking-App mit einem einzigen Ziel: **Muskelaufbau / Kraft**.
> Schlank, schnell im Studio bedienbar, ohne überflüssige Features.
> Dieses Dokument ist die Vorgabe für die Umsetzung mit Claude Code.

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
| Charts | Schlanke Diagramm-Bibliothek per CDN (Empfehlung: **uPlot** oder **Chart.js**) |
| HTTPS | Pflicht (All-Inkl Let's Encrypt) |

> **Grundsatz:** Kein direkter Datei-Zugriff aus dem Browser. Das Frontend redet nur über die PHP-API, nie direkt mit den JSON-Dateien.

---

## 3. Ordnerstruktur

```
/ (öffentlicher Web-Root, bei All-Inkl meist die Domain-Ebene)
├── index.php              # App-Shell, Session-Gate
├── manifest.json          # PWA-Manifest
├── service-worker.js      # PWA-Cache (App-Shell offline)
├── .htaccess              # Sperrt direkten Zugriff auf /data (Fallback, s. §8)
│
├── api/
│   ├── login.php          # POST: Passwort prüfen, Session setzen
│   ├── logout.php
│   ├── plan.php           # GET: heutiger/gewählter Tag + Übungen + letzte Werte
│   ├── session.php        # POST: abgeschlossene Sätze speichern
│   ├── exercises.php      # GET/POST/DELETE: Übungsbibliothek (CRUD)
│   ├── history.php        # GET: Verlauf einer Übung
│   ├── coach.php          # GET: regelbasierte Empfehlung pro Übung
│   └── export.php         # GET: schlüsselgeschützter Endpunkt für n8n-Backup
│
├── assets/
│   ├── app.js
│   ├── app.css
│   └── img/exercises/     # echte Gerätefotos (nachzureichen)
│
└── data/                  # IDEAL: eine Ebene ÜBER dem Web-Root (s. §8)
    ├── config.json        # Passwort-Hash, API-Key, globale Settings
    ├── exercises.json     # Übungsbibliothek
    ├── plan.json          # Tage, Rotation, Muskelgruppen-Prioritäten
    └── logs/
        └── 2026-08.json   # Trainings-Logs, ein Array pro Monat
```

**Wichtig:** Ob `data/` außerhalb des Web-Roots liegen kann, hängt von der All-Inkl-Konfiguration ab und wird bei der Einrichtung geprüft (§8). Deshalb ist die `.htaccess`-Sperre der sichere Standard, der immer greift.

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
    "weight_step": 5
  }
}
```
- `weight_step` überschreibt pro Übung den globalen Default (erlaubte Werte: `1.25`, `2.5`, `5`).
- `photo` verweist auf eine Datei in `assets/img/exercises/`.

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

### `logs/YYYY-MM.json` — Trainings-Logs (Array von Sessions)
```json
[
  {
    "date": "2026-08-11T07:05:00+02:00",
    "day": "unterkoerper",
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
- Monatsweise Dateien halten die Logs klein und machen das n8n-Backup handlich.

---

## 5. Bildschirme & Abläufe

### 5.1 Startseite (= ausbaubares Dashboard)
- Erkennt anhand der letzten Session, welcher Tag logisch als Nächstes dran ist, und zeigt groß: **„Heute: Unterkörper"** + großer **„Los geht's"**-Button.
- Direkt daneben: manuelle Auswahl eines anderen Tags (Frank ist nie ins Schema gezwungen — Krankheit, zusätzliche Einheit etc.).
- Modular gedacht: heute nur der Trainingsstart; später wachsen hier Widgets an (Wochenübersicht, Fortschrittskurven).

### 5.2 Studio-Modus (nach „Los geht's")
- Liste der heutigen Übungen als **große Kacheln** untereinander.
- Jede Kachel zeigt: **Foto des richtigen Geräts**, Name, Zielvorgabe (z.B. „4 Sätze, 8–12 Wdh"), **letztes Ergebnis** („zuletzt: 80 kg × 10").
- Coach-Ansage direkt auf der Kachel, wenn eine Steigerung fällig ist (§7).
- Tippen klappt die Kachel auf → pro Satz eine Zeile mit zwei großen Werten: **Gewicht** und **Wiederholungen**.
- **Eingabe ausschließlich über große Plus/Minus-Buttons**, nie Tastatur:
  - Wiederholungen: 1er-Schritte.
  - Gewicht: Default 5 kg, pro Übung einstellbar (`weight_step`).
- Felder sind mit dem letzten Wert **vorbefüllt** → gleiche Leistung = nur bestätigen, kein Ändern.
- Ein großer Bestätigungs-Button pro Satz → optional startet danach der **Pausen-Timer** (`rest_timer_seconds`).

### 5.3 Verwaltungsbereich („Mein Plan" / Einstellungen)
- Ruhig zuhause bedienbar, getrennt vom schnellen Studio-Modus.
- **Übungsbibliothek:** Übung anlegen/ändern/entfernen (Name, Foto, Muskelgruppe, Zielsätze, Wdh-Bereich, Schrittweite, Tag-Zuordnung, Reihenfolge).
- Muskelgruppen-Priorität pro Gruppe setzen (`normal`/`focus`).
- Plan ist eine frei pflegbare Liste, nichts Festgemauertes.

### 5.4 Auswertung (pro Übung)
- In der Bibliothek eine Übung antippen → **Verlaufskurve**.
- Darstellbar: max. Gewicht über Zeit **und** Trainingsvolumen (= Gewicht × Wdh × Sätze) — Volumen ist die aussagekräftigste Größe für Muskelaufbau.
- Zeigt auf einen Blick: echte Steigerung oder Stagnation.

---

## 6. Login & Sicherheit

- **Einzel-Login** für Frank. Passwort wird **niemals im Klartext** gespeichert, nur als Hash via PHP `password_hash()` / `password_verify()`.
- Nach erfolgreichem Login **Session** mit langer Lebensdauer (`session_lifetime_days`, z.B. 30 Tage) → kein tägliches Neu-Einloggen im Studio.
- Alle API-Endpunkte außer `login.php` und `export.php` prüfen die Session.

---

## 7. Coach-Logik (regelbasierte progressive Überlastung)

**Modell: Doppelte Progression.** Erst Wiederholungen hochklettern, dann Gewicht rauf und Wdh zurücksetzen.

Pseudocode pro Übung (Grundlage: letzte Sessions bei aktuellem Gewicht):

```
regel(uebung):
  letzte = letzte N Sessions dieser Übung   # z.B. N = 2..3
  akt_gewicht = Gewicht der letzten Session

  wenn in ALLEN Arbeitssätzen der letzten N Sessions
     die Wiederholungen >= rep_max erreicht wurden bei akt_gewicht:
        -> Empfehlung: "Steigern auf akt_gewicht + weight_step,
                        Wdh zurück Richtung rep_min"

  sonst wenn Wiederholungen unter rep_min eingebrochen sind:
        -> Empfehlung: "Gewicht halten, Wiederholungen zurückholen"

  sonst:
        -> Empfehlung: "Gewicht halten, eine Wdh mehr anpeilen"
```

- Diese Regel ist kostenlos, deterministisch und deckt den Großteil des Nutzens ab.
- Ausgabe erscheint als konkrete Ansage auf der Übungskachel (z.B. „3 Einheiten sauber 80 kg × 12 → heute 85 kg").

### Ausbaustufe: KI-Coach (optional, später)
- Zusätzliche Analyse per Sprachmodell-API für übergreifende Muster: Stagnation über mehrere Übungen, Vorschlag Erholungswoche, Balance zwischen Muskelgruppen.
- **Datenstruktur ist bereits API-tauglich** (Logs als sauberes JSON) → andockbar ohne Umbau.

### Priorisierung → Volumen
- Muskelgruppen mit `focus` bekommen im Plan mehr Volumen (mehr Sätze/Übungen pro Woche). Fließt in Plan-Design und Coach-Vorschläge ein.

---

## 8. Datei-Schutz (All-Inkl-spezifisch)

Zwei Wege, kombiniert:

1. **Bevorzugt:** `data/` **eine Ebene über dem öffentlichen Ordner** ablegen. Dann ist der Ordner aus dem Browser gar nicht erreichbar, PHP liest ihn aber weiterhin.
   → Ob diese Ebene bei diesem All-Inkl-Paket existiert, wird bei der Einrichtung per SFTP geprüft (evtl. landet man direkt im öffentlichen Bereich).
2. **Sicherer Standard (immer):** `.htaccess`-Regel, die den direkten Zugriff auf `*.json` bzw. den `data/`-Pfad sperrt. Greift unabhängig von der Ordnerstruktur.

> Falls Weg 1 möglich ist, beide kombinieren („doppelt hält besser"). Falls nicht, reicht Weg 2.

---

## 9. Automatisiertes Backup via n8n

- **Kein** manueller Export-Button.
- `export.php` ist ein schlüsselgeschützter Endpunkt: `GET /api/export.php?key=<API_KEY>` liefert alle Daten (Bundle der `data/`-Inhalte als JSON oder ZIP).
- Der Schlüssel wird gegen `config.json → api_key` geprüft. Kein Login-Durchklicken nötig.
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
- `history.php` + Verlaufskurven pro Übung (Gewicht & Volumen) mit schlanker Chart-Lib.

**Phase 4 — Coach (regelbasiert)**
- `coach.php` mit doppelter Progression, Ansage auf der Kachel.

**Phase 5 — Automatisierung & PWA**
- `export.php` (schlüsselgeschützt) + n8n-Workflow.
- `manifest.json` + `service-worker.js` (App-Shell offline, Homescreen-Icon).

**Phase 6 — Optional / später**
- KI-Coach über Sprachmodell-API.
- Dashboard-Widgets auf der Startseite (Wochenübersicht, Trends).

---

## 11. Offene Punkte (warten auf Frank)

- [x] **Gerätefotos** aus dem Studio — echte Fotos verwenden (Wiedererkennung), höchstens dezent vereinheitlichen (Zuschnitt/Ausrichtung), nicht KI-stilisieren. *(49 Originale in `images/`, aufgenommen 12.08.2026; 14 davon verkleinert und ohne EXIF unter `assets/img/exercises/`)*
- [ ] **Serverstruktur** bei All-Inkl prüfen: gibt es eine Ebene über dem Web-Root für `data/`? *(bei Einrichtung, 2-Minuten-Check)*
- [x] **Konkreter Trainingsplan**: Übungen je Tag (Oberkörper/Unterkörper-Split, 3x/Woche rotierend), plus **aktuelle Geräte + Startgewichte/Wdh** als realistische Startwerte. *(Steht in `TRAININGSPLAN.md` und in `data/`. Aufgestellt aus §12 und der Geräteaufnahme, kein Studiobesuch nötig gewesen. **Startgewichte gibt es bewusst keine**: die erste Einheit ist die Eichung, danach übernimmt die Progressionsregel aus §7. Offen bleiben zwei Gerätenummern, die auf den Fotos nicht lesbar sind, siehe TRAININGSPLAN.md.)*

---

## 12. Trainings-Eckdaten (für das Plan-Design)

- Im Schnitt 3× pro Woche, morgens ~7–9 Uhr, ca. 1,5 h pro Einheit. **Nicht an feste Wochentage gebunden**: mal sind es zwei Einheiten, mal vier, dazwischen liegt Urlaub. Was zählt, ist die Reihenfolge der Einheiten, nicht der Kalender.
- >2 Jahre Erfahrung, bereits recht kräftig → oberes Volumen (~15–20 Sätze/Woche für große Gruppen). **Das ist die wichtigste Vorgabe für den Plan**, Volumen ist der Haupthebel für Muskelaufbau.
- Wiederholungsbereich 6–15, nah ans Muskelversagen. **Schwerpunkt auf dem unteren Ende:** Grundübungen 5–8, Maschinen 6–12. Über 12 nur dort, wo schwere Sätze technisch schlecht steuerbar sind (Waden, Bauch). Hohe Wiederholungszahlen bauen zwar auch Muskeln auf, aber nur bei echtem Versagen, und daran scheitert es in der Praxis.
- Split: Oberkörper/Unterkörper im Wechsel. Jede Einheit lädt **wenige Gruppen hoch** (10–11 Sätze je großer Gruppe pro Durchgang) statt viele Gruppen wenig. Nur so ist das Volumenziel in 1,5 h erreichbar. Die Frequenz je Gruppe ergibt sich daraus, wie oft trainiert wird: bei 3 Einheiten/Woche 1,5×, bei 4 Einheiten 2×.
- Gerätefokus (geringeres Verletzungsrisiko), ergänzt um wenige effiziente Grundübungen (z.B. Kreuzheben am Unterkörpertag).
