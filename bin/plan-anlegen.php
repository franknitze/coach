<?php
declare(strict_types=1);

/**
 * Schreibt den Trainingsplan nach data/exercises.json und data/plan.json.
 *
 *   php bin/plan-anlegen.php                nur Fehlendes anlegen
 *   php bin/plan-anlegen.php --aktualisieren  Plandaten auffrischen
 *   php bin/plan-anlegen.php --neu            alles zurücksetzen
 *
 * DER STANDARD FASST NICHTS AN, WAS SCHON DA IST. Grund: die Zuordnung
 * von Fotos und Gerätenummern macht Frank in der App, und die steht in
 * derselben Datei wie der Plan. Ein Aufruf mit --force hat sie einmal
 * vollständig gelöscht. Deshalb gibt es --force nicht mehr.
 *
 * --aktualisieren schreibt nur die Felder, die aus dem Plan stammen:
 * Name, Ausführung, Suchbegriff, Sätze, Wiederholungen, Schrittweite,
 * Tag, Reihenfolge, Muskelgruppe. Foto und Gerätenummer bleiben stehen.
 *
 * --neu setzt wirklich alles zurück und legt vorher eine Sicherung an.
 *
 * Warum ein Skript und keine Datei im Repo: data/ ist ausgeschlossen, dort
 * liegen Passwort-Hash und Trainingsdaten. Der Plan selbst ist aber weder
 * geheim noch verzichtbar, und nach einem Serverneuaufbau soll er sich in
 * einem Befehl wiederherstellen lassen.
 *
 * Die Begründung zu Aufbau, Reihenfolge und Volumen steht in
 * TRAININGSPLAN.md. Wer hier Zahlen ändert, ändert sie dort mit.
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/../lib/config.php';
require_once __DIR__ . '/../lib/standardplan.php';

$aktualisieren = in_array('--aktualisieren', $argv, true);
$zuruecksetzen = in_array('--neu', $argv, true);

if (in_array('--force', $argv, true)) {
    fwrite(STDERR, "--force gibt es nicht mehr, es hat einmal alle Fotozuordnungen "
        . "gelöscht.\n  --aktualisieren  frischt die Plandaten auf, Fotos bleiben\n"
        . "  --neu            setzt alles zurück, mit Sicherung\n");
    exit(1);
}

$vorhanden = (array) json_read(EXERCISES_FILE, []);

/** Sicherung neben die Datei legen, bevor etwas überschrieben wird. */
function sichern(string $datei): void
{
    if (!is_file($datei)) {
        return;
    }
    $ziel = dirname($datei) . '/sicherung';
    ensure_dir($ziel);
    $name = basename($datei, '.json') . '-'
          . (new DateTimeImmutable('now'))->format('Ymd-His') . '.json';
    copy($datei, $ziel . '/' . $name);
    echo "Sicherung: " . basename($ziel) . '/' . $name . "\n";
}

/*
 * Die Plandaten stehen in lib/standardplan.php, weil api/setup.php sie
 * ebenfalls braucht: Dort werden sie beim allerersten Aufruf in eine leere
 * Installation geschrieben. Dieses Skript ist das Wartungswerkzeug danach.
 */
$uebungen = standardplan_uebungen();

/**
 * Welche Felder aus dem Plan stammen und bei --aktualisieren gesetzt werden.
 *
 * Alles, was hier NICHT steht, überlebt eine Auffrischung: Foto und
 * Gerätenummer werden in der App gesetzt und dürfen von einem Skript nicht
 * überschrieben werden. Genau das ist einmal passiert.
 */
const AUS_DEM_PLAN = [
    'name', 'muscle_group', 'day', 'order', 'target_sets',
    'rep_min', 'rep_max', 'weight_step', 'execution', 'search',
    'assisted',
];

/*
 * Zusammenführen statt überschreiben.
 *
 * Was in der App gesetzt wurde, hat Vorrang: Foto und Gerätenummer
 * überleben jede Planänderung. Übungen, die nicht mehr im Plan stehen,
 * bleiben ebenfalls erhalten; sie zu löschen wäre Datenverlust durch ein
 * Skript, und wer eine Übung loswerden will, tut das in der App.
 */
$neuAngelegt = 0;
$aufgefrischt = 0;
$unberuehrt = 0;
$ergebnis = $vorhanden;

if ($zuruecksetzen) {
    sichern(EXERCISES_FILE);
    $ergebnis = $uebungen;
    $neuAngelegt = count($uebungen);
} else {
    foreach ($uebungen as $id => $neu) {
        if (!isset($ergebnis[$id])) {
            $ergebnis[$id] = $neu;
            $neuAngelegt++;
            continue;
        }
        if (!$aktualisieren) {
            $unberuehrt++;
            continue;
        }
        $vorher = $ergebnis[$id];
        foreach (AUS_DEM_PLAN as $feld) {
            $ergebnis[$id][$feld] = $neu[$feld];
        }
        // Über JSON vergleichen, nicht direkt: aus der Datei kommt die
        // Schrittweite 5 als Ganzzahl zurück, im Plan steht sie als 5.0.
        // Ein direkter Vergleich meldete deshalb bei jedem Lauf 15
        // Änderungen, die keine sind, und legte jedes Mal eine Sicherung an.
        if (json_encode($ergebnis[$id]) !== json_encode($vorher)) {
            $aufgefrischt++;
        }
    }
    if ($aufgefrischt > 0 || $neuAngelegt > 0) {
        sichern(EXERCISES_FILE);
    }
}

json_write(EXERCISES_FILE, $ergebnis);

if ($zuruecksetzen || !is_file(PLAN_FILE)) {
    sichern(PLAN_FILE);
    json_write(PLAN_FILE, standardplan_plan());
}

$mitFoto = count(array_filter($ergebnis, fn (array $u): bool => !empty($u['photo'])));

$proTag = [];
foreach ($uebungen as $u) {
    $proTag[$u['day']]['anzahl'] = ($proTag[$u['day']]['anzahl'] ?? 0) + 1;
    $proTag[$u['day']]['saetze'] = ($proTag[$u['day']]['saetze'] ?? 0) + $u['target_sets'];
}

echo "Plan angelegt.\n";
foreach (['oberkoerper' => 'A Oberkörper', 'ganzkoerper' => 'B Ganzkörper',
          'unterkoerper' => 'C Unterkörper'] as $k => $name) {
    printf("  %-15s %2d Übungen, %2d Sätze\n", $name, $proTag[$k]['anzahl'], $proTag[$k]['saetze']);
}
echo "\n  neu angelegt: $neuAngelegt";
echo ", aufgefrischt: $aufgefrischt";
echo ", unberührt gelassen: $unberuehrt\n";
echo "  Übungen mit zugeordnetem Foto: $mitFoto\n";
