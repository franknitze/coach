<?php
declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';
require_once __DIR__ . '/../lib/uebungen.php';
require_once __DIR__ . '/../lib/training.php';
require_once __DIR__ . '/../lib/fortschritt.php';

auth_require();
require_method('GET');

/**
 * Der Rückblick: die letzten Einheiten mit allen Sätzen in einer Antwort.
 *
 * Bewusst samt Sätzen und nicht als bloße Liste mit Nachladen je Einheit.
 * Zehn Einheiten sind wenige Kilobyte, dafür öffnet sich die Detailansicht
 * beim Antippen ohne Netz und ohne Wartezeit.
 *
 * Und bewusst ein eigener Endpunkt statt eines Anhängsels an plan.php:
 * der bedient auch das Studio, und dort wäre der Rückblick totes Gewicht
 * auf genau dem Bildschirm mit der schlechtesten Verbindung.
 */

const EINHEITEN_DECKEL = 10;

/*
 * Ohne ?monat die letzten zehn Einheiten für den Rückblick, mit ?monat alle
 * eines Monats für den Kalender. Ein Parameter und kein zweiter Endpunkt:
 * Es ist dieselbe Sache in derselben Form, nur anders ausgewählt, und die
 * ganze Anreicherung darunter wäre sonst zweimal da.
 *
 * Der Deckel gilt nur für die Liste. Ein Monat hat höchstens gut zwanzig
 * Einheiten, das ist von sich aus begrenzt.
 */
$monat = trim((string) ($_GET['monat'] ?? ''));

if ($monat !== '' && !preg_match('/^\d{4}-\d{2}$/', $monat)) {
    fail('Der Monat muss YYYY-MM sein.');
}

$grenze = (int) ($_GET['limit'] ?? EINHEITEN_DECKEL);
$grenze = max(1, min(EINHEITEN_DECKEL, $grenze));

// Wie viele der jüngsten Einheiten übersprungen werden: Blättern im
// Rückblick, Seite für Seite um $grenze.
$versatz = max(0, (int) ($_GET['offset'] ?? 0));

$plan      = (array) json_read(PLAN_FILE, []);
$tage      = (array) ($plan['days'] ?? []);
$uebungen  = (array) json_read(EXERCISES_FILE, []);

$ergebnis = [];

$quelle = $monat === '' ? training_letzte_sessions($grenze, $versatz) : training_monat($monat);

foreach ($quelle as $session) {
    $tag  = (string) ($session['day'] ?? '');
    $soll = training_soll($tag, $uebungen);

    $eintraege  = [];
    $saetze     = 0;
    $proUebung  = [];

    foreach ((array) ($session['exercises'] ?? []) as $eintrag) {
        $id   = (string) ($eintrag['exercise_id'] ?? '');
        $sets = array_values((array) ($eintrag['sets'] ?? []));
        $saetze += count($sets);
        $proUebung[$id] = count($sets);

        /*
         * Name, Foto und Vorgabe reisen mit, statt sie im Browser gegen die
         * Übungsliste zu verbinden. Eine seit damals gelöschte Übung stünde
         * sonst ohne Namen da, und ihre Sätze wären nicht mehr zuzuordnen.
         */
        $u = $uebungen[$id] ?? [];

        $eintraege[] = [
            'id'          => $id,
            'name'        => (string) ($u['name'] ?? $id),
            'photo'       => (string) ($u['photo'] ?? ''),
            'station'     => (string) ($u['station'] ?? ''),
            'target_sets' => (int) ($u['target_sets'] ?? count($sets)),
            'rep_min'     => (int) ($u['rep_min'] ?? 0),
            'rep_max'     => (int) ($u['rep_max'] ?? 0),
            'assisted'    => !empty($u['assisted']),
            'geloescht'   => !isset($uebungen[$id]),
            'sets'        => $sets,
        ];
    }

    // Soll-Sätze des Tages nach heutigem Plan, für "19 von 24".
    $sollSaetze = array_sum($soll);

    /*
     * Vollständig heißt: jede heute für diesen Tag vorgesehene Übung hat
     * ihre Zielsatzzahl erreicht. Die Summe allein genügt nicht — acht
     * Sätze Bankdrücken und keiner Latzug ergäben dieselbe Zahl wie vier
     * und vier, wären aber eine halbe Einheit.
     */
    $vollstaendig = training_vollstaendig($session, $uebungen);

    /*
     * "Offen" ist enger als "unvollständig": nur eine Einheit von heute
     * lässt sich weitertrainieren. Ein halber Trainingstag von vor drei
     * Wochen bleibt für immer unvollständig, ist aber Geschichte. Die
     * Oberfläche hängt daran, ob ein Antippen in die Einheit führt (lesen)
     * oder ins Studio (weitermachen).
     */
    $offen = training_offen($session, $uebungen);

    $ergebnis[] = [
        // Datum und Tag zusammen: an einem Kalendertag kann es zwei
        // Einheiten verschiedener Trainingstage geben, das Datum allein
        // wäre also nicht eindeutig.
        'key'          => substr((string) ($session['date'] ?? ''), 0, 10) . '|' . $tag,
        'date'         => (string) ($session['date'] ?? ''),
        'day'          => $tag,
        'label'        => (string) ($tage[$tag]['label'] ?? $tag),
        'set_count'    => $saetze,
        'set_target'   => $sollSaetze,
        'vollstaendig' => $vollstaendig,
        'offen'        => $offen,
        'exercises'    => $eintraege,
    ];
}

/*
 * Der Fortschritts-Index reist mit, statt einen eigenen Endpunkt zu haben:
 * Rückblick und Kurve stehen auf demselben Bildschirm, und der soll mit
 * einem Request auskommen. Er rechnet über ALLE Einheiten, nicht nur über
 * die zehn der Liste — die Basis einer Übung ist ihre allererste.
 */
/*
 * Beim Monatsabruf bleibt der Fortschritts-Index weg: Er rechnet über die
 * gesamte Historie und gehört zur Startseite, nicht in den Kalender. Die
 * Liste der Monate reist immer mit, damit der Kalender weiß, wie weit er
 * zurückblättern kann.
 */
$antwort = [
    'sessions' => $ergebnis,
    'monat'    => $monat,
    'monate'   => training_monate(),
];

if ($monat === '') {
    $antwort['total']       = training_anzahl_sessions();
    $antwort['limit']       = $grenze;
    $antwort['offset']      = $versatz;
    $antwort['fortschritt'] = fortschritt_punkte($uebungen);
}

json_out($antwort);
