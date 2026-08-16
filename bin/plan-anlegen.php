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
    // id, Name, Muskelgruppe, Tag, Reihenfolge, Sätze, Wdh von, Wdh bis,
    // Schritt, Ausführung, englischer Suchbegriff

    // ---------- A: Oberkörper, 30 Sätze ----------
    ['bankdruecken', 'Langhantel-Bankdrücken flach', 'brust', 'oberkoerper', 1, 4, 5, 8, 2.5,
     'Griff etwa eine Handbreit außerhalb der Schultern. Ellenbogen rund 45 Grad zum Körper, nicht seitlich abspreizen. Stange zur unteren Brust, kurz auflegen ohne abfedern.',
     'barbell bench press'],

    ['latzug_weit', 'Latzug weit zur Brust', 'ruecken', 'oberkoerper', 2, 4, 6, 10, 5.0,
     'Weiter Obergriff, etwa anderthalb Schulterbreiten. Zur oberen Brust ziehen, nicht in den Nacken. Brust raus, Schultern nach hinten unten, oben vollständig ausstrecken lassen.',
     'wide grip lat pulldown to chest'],

    ['schraegbank_kh', 'Kurzhantel-Schrägbankdrücken 30 Grad', 'brust', 'oberkoerper', 3, 3, 8, 10, 2.5,
     'Bank auf 30 Grad, steiler trifft zunehmend die Schulter statt die Brust. Hanteln bis auf Brusthöhe ablassen, unten kurz die Dehnung halten.',
     'incline dumbbell press 30 degrees'],

    ['rudern_brustauflage', 'Rudern mit Brustauflage', 'ruecken', 'oberkoerper', 4, 4, 6, 10, 2.5,
     'Brust liegt auf der Schrägbank oder am Gerät auf. Zum unteren Brustkorb ziehen, Ellenbogen dicht am Körper. Die Auflage nimmt den unteren Rücken aus der Übung, deshalb diese Variante und nicht freies Vorgebeugtes Rudern.',
     'chest supported row'],

    ['schulterdruecken_kh', 'Kurzhantel-Schulterdrücken sitzend', 'schulter', 'oberkoerper', 5, 3, 8, 10, 2.5,
     'Rückenlehne fast senkrecht, etwa 80 Grad. Hanteln auf Ohrhöhe starten, Ellenbogen leicht vor der Körperlinie. Oben nicht vollständig durchdrücken.',
     'seated dumbbell shoulder press'],

    ['kabelrudern_eng', 'Kabelrudern sitzend, enger Parallelgriff', 'ruecken', 'oberkoerper', 6, 3, 10, 12, 5.0,
     'Enger Griff mit den Handflächen zueinander. Zum Bauchnabel ziehen, Oberkörper aufrecht und ruhig, kein Schwung aus der Hüfte. Vorne die Schulterblätter weit auseinanderlaufen lassen.',
     'seated cable row close neutral grip'],

    ['kabel_fliegende', 'Kabel-Fliegende auf Brusthöhe, stehend', 'brust', 'oberkoerper', 7, 3, 12, 15, 5.0,
     'Beide Rollen auf Brusthöhe, einen Schritt nach vorn. Arme leicht gebeugt und in diesem Winkel fixiert, Bewegung nur aus der Schulter. Vorne die Hände übereinanderführen, nicht nur bis auf Schulterbreite.',
     'standing cable chest fly mid pulley'],

    ['trizeps_ueberkopf', 'Trizepsdrücken über Kopf am Kabel mit Seil', 'trizeps', 'oberkoerper', 8, 3, 10, 15, 5.0,
     'Rolle unten, Seil über den Kopf greifen, mit dem Rücken zum Gerät. Oberarme neben den Ohren fixiert, nur die Unterarme bewegen sich. Diese Variante, weil der Trizeps über Kopf gedehnt arbeitet.',
     'overhead cable triceps extension rope'],

    ['curl_schraeg', 'Kurzhantel-Curl auf der Schrägbank 45 Grad', 'bizeps', 'oberkoerper', 9, 3, 8, 12, 2.5,
     'Bank auf 45 Grad, Arme hängen senkrecht nach unten hinter der Körperlinie. Oberarme bleiben unten, nur der Unterarm bewegt sich. Der Bizeps arbeitet hier gedehnt, das ist der Zweck der Schrägbank.',
     'incline dumbbell curl'],

    // ---------- B: Ganzkörper, 30 Sätze ----------
    // Ersetzt die Langhantel-Kniebeuge: die Stange hinter dem Kopf
    // abzulegen verlangt Außenrotation und Streckung der Schulter
    // gleichzeitig, und das gibt nicht jedes Schultergelenk her. Die
    // Hackenschmidt-Maschine trainiert dasselbe Muster ohne jede
    // Beteiligung der Schulter.
    ['kniebeuge', 'Hackenschmidt-Kniebeuge', 'quadrizeps', 'ganzkoerper', 1, 4, 5, 8, 2.5,
     'Rücken liegt am Polster an, Schultern unter den Auflagen, Füße schulterbreit mittig auf der Platte. Mindestens bis Oberschenkel waagerecht. Die Schulter ist an dieser Übung nicht beteiligt, deshalb steht sie hier statt der Langhantel-Kniebeuge. Gibt es keine Hackenschmidt-Maschine: schwere Beinpresse mit hoher Fußstellung, oder eine Safety Squat Bar, falls das Studio eine hat.',
     'hack squat machine'],

    ['klimmzug_eng', 'Klimmzug im Untergriff, unterstützt', 'ruecken', 'ganzkoerper', 2, 4, 6, 10, 5.0,
     'An der Unterstützungsmaschine, Knie oder Füße auf dem Polster. Untergriff etwa schulterbreit, Handflächen zum Gesicht. Bis das Kinn über die Stange, unten vollständig ausstrecken. ACHTUNG: hier zählt weniger Gewicht als Fortschritt, das Gegengewicht nimmt Körpergewicht ab.',
     'assisted chin up machine'],

    ['dips_brust', 'Dips vorgeneigt, unterstützt', 'brust', 'ganzkoerper', 3, 4, 6, 10, 2.5,
     'An der Unterstützungsmaschine, Knie auf dem Polster. Oberkörper deutlich nach vorn geneigt und Ellenbogen leicht abgespreizt, dann trägt die Brust. Aufrecht mit engen Ellenbogen wäre es eine Trizepsübung. Bis Oberarm waagerecht, nicht tiefer. ACHTUNG: weniger Gewicht ist hier der Fortschritt.',
     'assisted dip machine chest'],

    ['kreuzheben_rum', 'Rumänisches Kreuzheben mit der Langhantel', 'beinbeuger', 'ganzkoerper', 4, 4, 8, 10, 2.5,
     'Aus dem Stand starten, nicht vom Boden. Knie leicht gebeugt und in diesem Winkel bleiben, Hüfte weit nach hinten, Stange dicht am Bein entlang bis etwa Mitte Schienbein. Rücken durchgehend gerade.',
     'romanian deadlift barbell'],

    ['seitheben_kabel', 'Kabel-Seitheben einarmig', 'schulter', 'ganzkoerper', 5, 4, 12, 20, 2.5,
     'Rolle ganz unten, Kabel läuft vor dem Körper zur Gegenseite. Arm fast gestreckt seitlich bis Schulterhöhe. Am Kabel, weil unten anders als mit der Kurzhantel bereits Last auf dem Muskel liegt.',
     'single arm cable lateral raise'],

    ['face_pull', 'Face Pull am Kabel mit Seil', 'schulter', 'ganzkoerper', 6, 3, 15, 20, 5.0,
     'Rolle auf Gesichtshöhe. Seil zum Gesicht ziehen, Hände laufen dabei nach außen auseinander, Ellenbogen bleiben hoch. Trifft die hintere Schulter und den oberen Rücken.',
     'cable face pull'],

    ['beinbeuger_liegend', 'Beinbeuger liegend', 'beinbeuger', 'ganzkoerper', 7, 3, 10, 15, 5.0,
     'Bauchlage, Polster knapp über der Ferse. Hüfte bleibt auf der Bank, kein Hohlkreuz beim Anziehen. Oben kurz halten, langsam ablassen.',
     'lying leg curl'],

    ['waden_stehend', 'Wadenheben stehend, Knie gestreckt', 'waden', 'ganzkoerper', 8, 4, 8, 12, 5.0,
     'Fußballen auf der Kante, Fersen tief ablassen bis es zieht. Knie durchgehend gestreckt, dann arbeitet der Zwillingswadenmuskel. Oben eine Sekunde halten.',
     'standing calf raise'],

    // ---------- C: Unterkörper, 28 Sätze ----------
    ['beinpresse', 'Beinpresse 45 Grad', 'quadrizeps', 'unterkoerper', 1, 4, 6, 10, 5.0,
     'Füße schulterbreit, mittig auf der Platte. Tiefer heißt mehr Bewegungsumfang, aber nur so weit, wie das Becken flach auf der Lehne bleibt. Knie nicht vollständig durchdrücken.',
     '45 degree leg press'],

    ['beinbeuger_sitzend', 'Beinbeuger sitzend', 'beinbeuger', 'unterkoerper', 2, 4, 8, 12, 5.0,
     'Sitzend, weil die Hüfte dabei gebeugt ist und die Oberschenkelrückseite dadurch gedehnt arbeitet. Das ergänzt die liegende Variante von Tag B, es ist nicht dieselbe Übung.',
     'seated leg curl'],

    ['split_squat', 'Bulgarian Split Squat', 'quadrizeps', 'unterkoerper', 3, 3, 8, 12, 2.5,
     'Hinterer Fuß erhöht auf einer Bank, vorderer Fuß weit genug vorn, dass das Knie über dem Fußgelenk bleibt. Oberkörper leicht vorgeneigt. Wiederholungen gelten je Bein.',
     'bulgarian split squat rear foot elevated'],

    ['beinstrecker', 'Beinstrecker sitzend', 'quadrizeps', 'unterkoerper', 4, 4, 12, 20, 5.0,
     'Rückenlehne so, dass das Kniegelenk genau auf der Drehachse liegt. Oben eine Sekunde vollständig strecken, langsam ablassen.',
     'seated leg extension'],

    ['waden_sitzend', 'Wadenheben sitzend, Knie 90 Grad', 'waden', 'unterkoerper', 5, 4, 12, 20, 5.0,
     'Knie im rechten Winkel unter dem Polster. Bei gebeugtem Knie arbeitet der darunterliegende Schollenmuskel, den die stehende Variante kaum trifft. Deshalb beide im Plan.',
     'seated calf raise'],

    ['curl_sz', 'SZ-Curl stehend', 'bizeps', 'unterkoerper', 6, 3, 8, 12, 2.5,
     'SZ-Stange im Untergriff, Griff etwa schulterbreit an der ersten Biegung. Oberarme bleiben am Körper, kein Schwung aus der Hüfte.',
     'ez bar curl'],

    ['trizepsdruecken', 'Trizepsdrücken am Kabel mit Seil', 'trizeps', 'unterkoerper', 7, 3, 10, 15, 5.0,
     'Rolle oben, Ellenbogen am Körper fixiert. Unten die Seilenden auseinanderziehen, dann arbeitet der äußere Kopf mit.',
     'cable triceps pushdown rope'],

    ['bauch_kabel', 'Kabel-Crunch kniend', 'bauch', 'unterkoerper', 8, 3, 10, 15, 5.0,
     'Kniend vor dem Kabelturm, Seil neben dem Kopf. Mit dem Brustkorb Richtung Becken einrollen, die Hüfte bleibt stehen. Mit Zusatzgewicht, weil der Bauch wie jeder Muskel Last braucht.',
     'kneeling cable crunch'],
];

/** Welche Felder aus dem Plan stammen und bei --aktualisieren gesetzt werden. */
const AUS_DEM_PLAN = [
    'name', 'muscle_group', 'day', 'order', 'target_sets',
    'rep_min', 'rep_max', 'weight_step', 'execution', 'search', 'partner',
    'assisted',
];

/*
 * Paare, die im Wechsel ausgeführt werden.
 *
 * Drücken gegen Ziehen: während die eine Seite arbeitet, erholt sich die
 * andere. Jeder Muskel bekommt weiterhin die volle Pause, die Einheit wird
 * aber kürzer, ohne dass ein Satz wegfällt.
 *
 * DIE AUSWAHL FOLGT DER PRAXIS, NICHT DER THEORIE. Ein Wechsel geht nur,
 * wenn er im Studio wirklich durchführbar ist. Bedingung:
 *
 * 1. Kein Umbau zwischen den Sätzen. Also Eigengewicht, Kabelzug mit
 *    Steckgewicht oder Kurzhanteln, keine Langhantel mit Scheiben.
 * 2. Beide Stationen liegen nah beieinander und sind klein genug, dass
 *    man sie kurz belegen kann.
 *
 * Deshalb NICHT gepaart, obwohl es fachlich naheläge:
 * - Bankdrücken mit Latzug: zwei weit auseinanderliegende Stationen, und
 *   die beladene Bank steht morgens nicht lange leer.
 * - Schrägbankdrücken mit Rudern: dasselbe Problem, zwei belegte Plätze.
 * - Beinübungen überhaupt: dort teilen sich die Übungen den Kreislauf,
 *   mit halber Pause sinkt das Gewicht.
 */
$paare = [
    ['dips_brust', 'klimmzug_eng'],            // beides Eigengewicht, oft dasselbe Gestell
    ['kabel_fliegende', 'kabelrudern_eng'],    // beides Kabel, Steckgewicht
    ['trizeps_ueberkopf', 'curl_schraeg'],     // Kabel und Kurzhantel, kleiner Platzbedarf
];

/*
 * Übungen an der Unterstützungsmaschine. Dort hebt ein Gegengewicht einen
 * Teil des Körpergewichts an: mehr Gewicht heißt LEICHTER. Ohne diese
 * Kennzeichnung schickte die Progressionsregel in die falsche Richtung.
 */
$unterstuetzt = ['klimmzug_eng', 'dips_brust'];

$partnerVon = [];
foreach ($paare as [$a, $b]) {
    $partnerVon[$a] = $b;
    $partnerVon[$b] = $a;
}

$uebungen = [];
foreach ($plan as $z) {
    $uebungen[$z[0]] = [
        'id' => $z[0], 'name' => $z[1], 'muscle_group' => $z[2], 'day' => $z[3],
        'order' => $z[4], 'target_sets' => $z[5],
        'rep_min' => $z[6], 'rep_max' => $z[7], 'weight_step' => $z[8],
        // Ausführung und englischer Suchbegriff: die Namen allein sind
        // mehrdeutig. "Überkopfdrücken" kann sitzend oder stehend sein,
        // mit Lang- oder Kurzhantel, und "Fliegende am Kabel" gibt es von
        // oben, von der Mitte und von unten. Ohne diese Angaben lässt
        // sich nicht nachschlagen, welche Übung gemeint ist.
        'execution' => $z[9],
        'search'    => $z[10],
        // Übung, mit der diese im Wechsel ausgeführt wird, oder leer.
        'partner'   => $partnerVon[$z[0]] ?? '',
        'assisted'  => in_array($z[0], $unterstuetzt, true),
        // Gerät und Foto bleiben leer, das wird in der App zugeordnet.
        'station' => '', 'photo' => '',
    ];
}

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
echo "  Paare im Wechsel: " . count($paare) . "\n";
