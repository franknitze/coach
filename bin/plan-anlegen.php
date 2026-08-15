<?php
declare(strict_types=1);

/**
 * Schreibt den Trainingsplan nach data/exercises.json und data/plan.json.
 *
 *   php bin/plan-anlegen.php
 *   php bin/plan-anlegen.php --force   (überschreibt vorhandene Übungen)
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

$force = in_array('--force', $argv, true);

$vorhanden = (array) json_read(EXERCISES_FILE, []);
if ($vorhanden !== [] && !$force) {
    fwrite(STDERR, "Es gibt schon " . count($vorhanden) . " Übungen. Mit --force überschreiben.\n");
    exit(1);
}

/**
 * Zwei Einheiten im Wechsel, Oberkörper und Unterkörper.
 *
 * KEINE festen Wochentage. Die App leitet den nächsten Tag aus der zuletzt
 * absolvierten Einheit ab, nicht aus dem Kalender. Urlaub, eine Woche mit
 * vier Einheiten, eine mit zweien: die Reihenfolge läuft einfach weiter.
 *
 * ZIEL IST MUSKELAUFBAU, und dafür ist das Wochenvolumen der Haupthebel
 * (SPEC.md §12: 15 bis 20 Sätze pro Woche für die großen Gruppen). Deshalb
 * bekommt jede große Gruppe pro Durchgang (A plus B) 10 bis 11 harte
 * Sätze. Das Volumen skaliert dann mit der Anwesenheit:
 *
 *   2 Einheiten/Woche → 10 bis 11 Sätze je großer Gruppe
 *   3 Einheiten/Woche → 15 bis 17   (Zielfenster)
 *   4 Einheiten/Woche → 20 bis 22   (oberes Ende)
 *
 * WIEDERHOLUNGEN BEWUSST SCHWER. Die Grundübungen laufen bei 5 bis 8, die
 * Maschinen bei 6 bis 12, jeder Arbeitssatz nah ans Muskelversagen. Hohe
 * Wiederholungszahlen bauen zwar auch Muskeln auf, aber nur bei echtem
 * Versagen, und genau daran scheitert es in der Praxis. Über 12
 * Wiederholungen gehen deshalb nur Waden und Bauch, wo schwere Sätze
 * technisch schlecht steuerbar sind.
 *
 * Innerhalb einer Einheit: schwer nach vorn, Brust und Rücken im Wechsel,
 * Arme zum Schluss. Die Nummern stammen von den gelben Geräteschildern.
 */
$plan = [
    // id, Name, Muskelgruppe, Tag, Reihenfolge, Nummer, Sätze, Wdh von, Wdh bis, Schritt, Foto

    // A: Oberkörper. Brust 10 Sätze, Rücken 10, Schulter 3, Arme je 2.
    ['bankdruecken',     'Bankdrücken Langhantel',      'brust',    'oberkoerper', 1, '43', 4,  5,  8, 2.5, 'bankdruecken.jpg'],
    ['latzug',           'Latzug',                      'ruecken',  'oberkoerper', 2, '26', 4,  6, 10, 5.0, 'latzug.jpg'],
    ['brustpresse',      'Brustpresse',                 'brust',    'oberkoerper', 3, '33', 3,  6, 10, 2.5, 'brustpresse.jpg'],
    ['rudern',           'Rudern sitzend am Kabel',     'ruecken',  'oberkoerper', 4, '25', 4,  6, 10, 5.0, 'rudern.jpg'],
    ['schulterdruecken', 'Schulterdrücken Kurzhantel',  'schulter', 'oberkoerper', 5, '',   3,  6, 10, 2.5, 'schulterdruecken.jpg'],
    ['butterfly',        'Butterfly',                   'brust',    'oberkoerper', 6, '36', 3,  8, 12, 5.0, 'butterfly.jpg'],
    ['latzug_eng',       'Latzug eng',                  'ruecken',  'oberkoerper', 7, '34', 2,  8, 12, 5.0, 'latzug_eng.jpg'],
    ['trizepsdruecken',  'Trizepsdrücken am Seil',      'trizeps',  'oberkoerper', 8, '26', 2,  8, 12, 5.0, 'trizepsdruecken.jpg'],
    ['bizepscurl',       'Bizepscurl SZ-Stange',        'bizeps',   'oberkoerper', 9, '',   2,  8, 12, 2.5, 'bizepscurl.jpg'],

    // B: Unterkörper. Quadrizeps 11 Sätze, Oberschenkelrückseite 8, Waden 4.
    ['kniebeuge',        'Kniebeuge Langhantel',        'beine',    'unterkoerper', 1, '39', 4,  5,  8, 2.5, 'kniebeuge.jpg'],
    ['beinpresse',       'Beinpresse',                  'beine',    'unterkoerper', 2, '23', 4,  6, 10, 5.0, 'beinpresse.jpg'],
    ['kreuzheben_rum',   'Rumänisches Kreuzheben',      'beine',    'unterkoerper', 3, '39', 4,  6, 10, 2.5, 'kniebeuge.jpg'],
    ['beinbeuger',       'Beinbeuger liegend',          'beine',    'unterkoerper', 4, '',   4,  8, 12, 5.0, 'beinbeuger.jpg'],
    ['beinstrecker',     'Beinstrecker',                'beine',    'unterkoerper', 5, '18', 3,  8, 12, 5.0, 'beinstrecker.jpg'],
    ['wadenheben',       'Wadenheben stehend',          'beine',    'unterkoerper', 6, '7',  4, 10, 15, 5.0, 'wadenheben.jpg'],
    ['beinheben',        'Beinheben',                   'beine',    'unterkoerper', 7, '',   2, 10, 15, 5.0, 'beinheben.jpg'],
];

$uebungen = [];
foreach ($plan as $z) {
    $uebungen[$z[0]] = [
        'id' => $z[0], 'name' => $z[1], 'muscle_group' => $z[2], 'day' => $z[3],
        'order' => $z[4], 'station' => $z[5], 'target_sets' => $z[6],
        'rep_min' => $z[7], 'rep_max' => $z[8], 'weight_step' => $z[9],
        'photo' => $z[10],
    ];
}

json_write(EXERCISES_FILE, $uebungen);

json_write(PLAN_FILE, [
    'days' => [
        'oberkoerper'  => ['label' => 'Oberkörper'],
        'unterkoerper' => ['label' => 'Unterkörper'],
    ],
    // Zwei Einträge, immer im Wechsel. Nicht an Wochentage gebunden:
    // was zählt, ist die Reihenfolge, nicht der Kalender.
    'rotation' => ['oberkoerper', 'unterkoerper'],
    'muscle_priorities' => [
        'brust' => 'normal', 'ruecken' => 'normal', 'beine' => 'normal',
        'schulter' => 'normal', 'bizeps' => 'normal', 'trizeps' => 'normal',
    ],
]);

$proTag = [];
foreach ($uebungen as $u) {
    $proTag[$u['day']]['anzahl'] = ($proTag[$u['day']]['anzahl'] ?? 0) + 1;
    $proTag[$u['day']]['saetze'] = ($proTag[$u['day']]['saetze'] ?? 0) + $u['target_sets'];
}

echo "Plan angelegt.\n";
foreach (['oberkoerper' => 'A Oberkörper', 'unterkoerper' => 'B Unterkörper'] as $k => $name) {
    printf("  %-15s %2d Übungen, %2d Sätze\n", $name, $proTag[$k]['anzahl'], $proTag[$k]['saetze']);
}
echo "\nJe Durchgang (A+B): Brust 10, Rücken 10, Quadrizeps 11 Sätze.\n";
echo "Bei 3 Einheiten pro Woche sind das 15 bis 17 Sätze je großer Gruppe.\n";
echo "Startgewichte gibt es bewusst keine. Die erste Einheit ist die Eichung.\n";
