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
 * Drei Einheiten im Wechsel: A Oberkörper, B Ganzkörper, C Unterkörper.
 *
 * Der Plan und seine Begründung stehen in TRAININGSPLAN.md. Wer hier
 * Zahlen ändert, ändert sie dort mit.
 *
 * HIER STEHEN BEWEGUNGEN, KEINE GERÄTE. Weder Gerätenummer noch Foto sind
 * gesetzt, und das ist Absicht: welche Bewegung an welchem Gerät
 * ausgeführt wird, entscheidet, wer das Studio kennt. Beides wird in der
 * App unter "Mein Plan" zugeordnet und landet dann in data/exercises.json,
 * wo es jedes Deployment überlebt.
 *
 * Warum drei Tage: jede Muskelgruppe wird pro Durchgang zweimal getroffen,
 * der Oberkörper an A und B, der Unterkörper an B und C. Zweimal pro Woche
 * ist für Muskelaufbau der belegte Richtwert.
 *
 * Reihenfolge innerhalb einer Einheit: schwer zuerst, Drücken und Ziehen
 * im Wechsel, Isolation zum Schluss. Die Arme stehen am Beintag, weil sie
 * am Oberkörpertag nach 21 Sätzen Drücken und Ziehen ausgelastet sind.
 */
$plan = [
    // id, Name, Muskelgruppe, Tag, Reihenfolge, Nummer, Sätze, Wdh von, Wdh bis, Schritt, Foto

    // A: Oberkörper, 30 Sätze. Brust 10, Rücken 11, Schulter 3, Arme je 3.
    ['bankdruecken',      'Bankdrücken flach',           'brust',      'oberkoerper', 1, '', 4,  5,  8, 2.5, ''],
    ['ziehen_weit',       'Vertikales Ziehen, weit',     'ruecken',    'oberkoerper', 2, '', 4,  6, 10, 5.0, ''],
    ['schraegbank',       'Schrägbankdrücken',           'brust',      'oberkoerper', 3, '', 3,  8, 10, 2.5, ''],
    ['rudern_schwer',     'Rudern vorgebeugt',           'ruecken',    'oberkoerper', 4, '', 4,  6, 10, 2.5, ''],
    ['ueberkopfdruecken', 'Überkopfdrücken',             'schulter',   'oberkoerper', 5, '', 3,  8, 10, 2.5, ''],
    ['rudern_eng',        'Rudern eng',                  'ruecken',    'oberkoerper', 6, '', 3, 10, 12, 5.0, ''],
    ['fliegende',         'Fliegende am Kabel',          'brust',      'oberkoerper', 7, '', 3, 12, 15, 5.0, ''],
    ['trizeps_ueberkopf', 'Trizepsstrecken über Kopf',   'trizeps',    'oberkoerper', 8, '', 3, 10, 15, 5.0, ''],
    ['curl_schraeg',      'Curl auf der Schrägbank',     'bizeps',     'oberkoerper', 9, '', 3,  8, 12, 2.5, ''],

    // B: Ganzkörper, 30 Sätze. Die Klammer zwischen beiden Hälften.
    ['kniebeuge',         'Kniebeuge',                   'quadrizeps', 'ganzkoerper', 1, '', 4,  5,  8, 2.5, ''],
    ['ziehen_eng',        'Vertikales Ziehen, eng',      'ruecken',    'ganzkoerper', 2, '', 4,  6, 10, 5.0, ''],
    ['druecken_schraeg',  'Schrägbankdrücken oder Dips', 'brust',      'ganzkoerper', 3, '', 4,  6, 10, 2.5, ''],
    ['kreuzheben_rum',    'Rumänisches Kreuzheben',      'beinbeuger', 'ganzkoerper', 4, '', 4,  8, 10, 2.5, ''],
    ['seitheben',         'Seitheben',                   'schulter',   'ganzkoerper', 5, '', 4, 12, 20, 2.5, ''],
    ['reverse_fly',       'Reverse Fly',                 'schulter',   'ganzkoerper', 6, '', 3, 15, 20, 5.0, ''],
    ['beinbeugen_b',      'Beinbeugen',                  'beinbeuger', 'ganzkoerper', 7, '', 3, 10, 15, 5.0, ''],
    ['waden_stehend',     'Wadenheben stehend',          'waden',      'ganzkoerper', 8, '', 4,  8, 12, 5.0, ''],

    // C: Unterkörper, 28 Sätze. Arme hier, weil sie hier frisch sind.
    ['beinpresse',        'Beinpresse',                  'quadrizeps', 'unterkoerper', 1, '', 4,  6, 10, 5.0, ''],
    ['beinbeugen_sitz',   'Beinbeugen sitzend',          'beinbeuger', 'unterkoerper', 2, '', 4,  8, 12, 5.0, ''],
    ['einbeinig',         'Ausfallschritt einbeinig',    'quadrizeps', 'unterkoerper', 3, '', 3,  8, 12, 2.5, ''],
    ['beinstrecken',      'Beinstrecken',                'quadrizeps', 'unterkoerper', 4, '', 4, 12, 20, 5.0, ''],
    ['waden_sitzend',     'Wadenheben sitzend',          'waden',      'unterkoerper', 5, '', 4, 12, 20, 5.0, ''],
    ['curl_stehend',      'Curl',                        'bizeps',     'unterkoerper', 6, '', 3,  8, 12, 2.5, ''],
    ['trizepsdruecken',   'Trizepsdrücken',              'trizeps',    'unterkoerper', 7, '', 3, 10, 15, 5.0, ''],
    ['bauch_gewicht',     'Bauch mit Zusatzgewicht',     'bauch',      'unterkoerper', 8, '', 3, 10, 15, 5.0, ''],
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
        'ganzkoerper'  => ['label' => 'Ganzkörper'],
        'unterkoerper' => ['label' => 'Unterkörper'],
    ],
    // A, B, C der Reihe nach. Nicht an Wochentage gebunden: was zählt,
    // ist die Reihenfolge, nicht der Kalender.
    'rotation' => ['oberkoerper', 'ganzkoerper', 'unterkoerper'],
    // Feiner aufgeteilt als die sechs Gruppen im Beispiel von SPEC.md §4.
    // Beine in Quadrizeps und Beinbeuger zu trennen und Waden und Bauch
    // eigens zu führen, macht das Wochenvolumen erst ablesbar: sonst
    // stünden 25 Sätze unter "Beine" und niemand wüsste, wie sie liegen.
    'muscle_priorities' => [
        'brust' => 'normal', 'ruecken' => 'normal', 'schulter' => 'normal',
        'quadrizeps' => 'normal', 'beinbeuger' => 'normal', 'waden' => 'normal',
        'bizeps' => 'normal', 'trizeps' => 'normal', 'bauch' => 'normal',
    ],
]);

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
echo "\nJe Durchgang: Rücken 15, Quadrizeps 15, Brust 14 Sätze.\n";
echo "Weder Gerätenummern noch Fotos gesetzt: das wird in der App zugeordnet.\n";
echo "Startgewichte gibt es bewusst keine. Die erste Einheit ist die Eichung.\n";
