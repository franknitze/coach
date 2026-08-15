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
 * Die Begründung zu Aufteilung, Reihenfolge und Volumen steht in
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
 * Oberkörper: schwer nach vorn, Brust und Rücken im Wechsel, Arme zum
 * Schluss. Unterkörper: Kniebeuge zuerst, dann Maschinen, Waden und Bauch
 * am Ende. Die Gerätenummern stammen von den gelben Schildern im Studio.
 */
$plan = [
    // id, Name, Muskelgruppe, Tag, Reihenfolge, Nummer, Sätze, Wdh von, Wdh bis, Schritt, Foto
    ['bankdruecken',     'Bankdrücken Langhantel',     'brust',    'oberkoerper', 1, '43', 4,  6,  8, 2.5, 'bankdruecken.jpg'],
    ['latzug',           'Latzug',                     'ruecken',  'oberkoerper', 2, '26', 4,  8, 10, 5.0, 'latzug.jpg'],
    ['brustpresse',      'Brustpresse',                'brust',    'oberkoerper', 3, '33', 3,  8, 12, 2.5, 'brustpresse.jpg'],
    ['rudern',           'Rudern sitzend am Kabel',    'ruecken',  'oberkoerper', 4, '25', 4,  8, 12, 5.0, 'rudern.jpg'],
    ['schulterdruecken', 'Schulterdrücken Kurzhantel', 'schulter', 'oberkoerper', 5, '',   3,  8, 12, 2.5, 'schulterdruecken.jpg'],
    ['butterfly',        'Butterfly',                  'brust',    'oberkoerper', 6, '36', 2, 12, 15, 5.0, 'butterfly.jpg'],
    ['trizepsdruecken',  'Trizepsdrücken am Seil',     'trizeps',  'oberkoerper', 7, '26', 3, 10, 15, 5.0, 'trizepsdruecken.jpg'],
    ['bizepscurl',       'Bizepscurl SZ-Stange',       'bizeps',   'oberkoerper', 8, '',   3,  8, 12, 2.5, 'bizepscurl.jpg'],

    ['kniebeuge',        'Kniebeuge Langhantel',       'beine',    'unterkoerper', 1, '39', 4,  6,  8, 2.5, 'kniebeuge.jpg'],
    ['beinpresse',       'Beinpresse',                 'beine',    'unterkoerper', 2, '23', 4,  8, 12, 5.0, 'beinpresse.jpg'],
    ['kreuzheben_rum',   'Rumänisches Kreuzheben',     'beine',    'unterkoerper', 3, '39', 3,  8, 10, 2.5, 'kniebeuge.jpg'],
    ['beinbeuger',       'Beinbeuger liegend',         'beine',    'unterkoerper', 4, '',   3, 10, 12, 5.0, 'beinbeuger.jpg'],
    ['beinstrecker',     'Beinstrecker',               'beine',    'unterkoerper', 5, '18', 3, 12, 15, 5.0, 'beinstrecker.jpg'],
    ['wadenheben',       'Wadenheben stehend',         'beine',    'unterkoerper', 6, '7',  4, 10, 15, 5.0, 'wadenheben.jpg'],
    ['beinheben',        'Beinheben',                  'beine',    'unterkoerper', 7, '',   3, 10, 15, 5.0, 'beinheben.jpg'],
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
    /*
     * Zweigliedrig, nicht dreigliedrig. Über die drei Termine Montag,
     * Mittwoch und Freitag verschiebt sich der Wechsel dadurch von selbst
     * und jede Hälfte kommt im Schnitt 1,5-mal pro Woche dran. Eine
     * dreigliedrige Rotation würde sich jede Woche identisch wiederholen.
     */
    'rotation' => ['oberkoerper', 'unterkoerper'],
    'muscle_priorities' => [
        'brust' => 'normal', 'ruecken' => 'normal', 'beine' => 'normal',
        'schulter' => 'normal', 'bizeps' => 'normal', 'trizeps' => 'normal',
    ],
]);

$ok = $uk = $saetzeOk = $saetzeUk = 0;
foreach ($uebungen as $u) {
    if ($u['day'] === 'oberkoerper') { $ok++; $saetzeOk += $u['target_sets']; }
    else { $uk++; $saetzeUk += $u['target_sets']; }
}

echo "Plan angelegt.\n";
echo "  Oberkörper:  $ok Übungen, $saetzeOk Sätze\n";
echo "  Unterkörper: $uk Übungen, $saetzeUk Sätze\n";
echo "  Rotation: Oberkörper und Unterkörper im Wechsel (Mo/Mi/Fr)\n";
echo "\nStartgewichte gibt es bewusst keine. Die erste Einheit ist die Eichung.\n";
