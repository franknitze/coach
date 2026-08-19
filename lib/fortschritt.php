<?php
declare(strict_types=1);

require_once __DIR__ . '/logs.php';
require_once __DIR__ . '/gewicht.php';

/**
 * Der Fortschritts-Index: eine Punktzahl je Trainingstag.
 *
 * Das Problem, das er löst: Ein Tag mit 9 Übungen und einer mit 5 sind
 * nicht vergleichbar, wenn man Gewichte aufsummiert. Die Kurve zeigte dann
 * die Tagesart und nicht den Fortschritt.
 *
 * Deshalb ein Index und keine Summe. Je Übung wird verglichen, was heute
 * geschafft wurde, mit dem, was bei der ERSTEN Einheit an dieser Übung
 * geschafft wurde: 100 heißt wie am Anfang, 115 heißt 15 Prozent darüber.
 * Der Tageswert ist der MITTELWERT dieser Verhältnisse. Ein Mittelwert
 * hängt nicht davon ab, über wie viele Werte er geht — damit liegen alle
 * Trainingstage auf derselben Skala, und die Kurve ist eine durchgehende
 * Linie statt eines Zickzacks zwischen Tagesarten.
 *
 * Eine neu aufgenommene Übung startet bei 100 und zieht den Mittelwert
 * einmalig etwas nach unten. Das ist der Preis dafür, dass jeder Punkt der
 * Kurve für sich nachrechenbar bleibt; die Alternative wäre ein verketteter
 * Index, bei dem jeder Punkt an allen vorherigen hängt.
 */

/**
 * Wie viel eine Leistung "wert" ist, für den Vergleich innerhalb einer Übung.
 *
 * Epley-Formel. Ohne sie zählte nur das Gewicht, und die Kurve bliebe
 * wochenlang flach, während die doppelte Progression aus §7 in Wirklichkeit
 * die Wiederholungen hochklettert. Das Ergebnis ist eine Rechengröße für
 * den Vergleich, keine Behauptung über ein echtes Einer-Maximum.
 */
function fortschritt_satzwert(float $gewicht, int $wiederholungen): float
{
    return $gewicht * (1 + $wiederholungen / 30);
}

/**
 * Die Last eines Satzes.
 *
 * An der Unterstützungsmaschine ist die Zahl nicht die Last, sondern das
 * Gegengewicht: Bewegt wird "Körpergewicht minus Hilfe". Ohne eingetragenes
 * Körpergewicht gibt es dafür keinen Maßstab, dann liefert die Funktion
 * null und die Übung bleibt aus dem Index heraus.
 */
function fortschritt_last(float $gewicht, bool $unterstuetzt, ?float $koerper): ?float
{
    if (!$unterstuetzt) {
        return $gewicht;
    }

    if ($koerper === null) {
        return null;
    }

    return max(0.0, $koerper - $gewicht);
}

/** Der beste Satz einer Übung in einer Einheit, als Rechenwert. */
function fortschritt_leistung(array $sets, bool $unterstuetzt, ?float $koerper): ?float
{
    $bester = null;

    foreach ($sets as $satz) {
        $last = fortschritt_last(
            (float) ($satz['weight'] ?? 0),
            $unterstuetzt,
            $koerper
        );

        if ($last === null) {
            return null;
        }

        $wert = fortschritt_satzwert($last, (int) ($satz['reps'] ?? 0));
        if ($bester === null || $wert > $bester) {
            $bester = $wert;
        }
    }

    return $bester;
}

/**
 * Ein Punkt je Einheit, älteste zuerst.
 *
 * @return list<array{date: string, day: string, wert: float, uebungen: int}>
 */
function fortschritt_punkte(array $uebungen): array
{
    // Älteste zuerst: Die Basis einer Übung ist ihre erste Einheit, und die
    // erkennt man nur, wenn man vorwärts durchgeht.
    $sessions = [];
    foreach (array_reverse(logs_monate()) as $monat) {
        foreach (array_reverse(logs_monat($monat)) as $session) {
            $sessions[] = $session;
        }
    }

    $basis = [];      // uebungId => Leistung der ersten Einheit
    $punkte = [];

    foreach ($sessions as $session) {
        $datum   = substr((string) ($session['date'] ?? ''), 0, 10);
        $koerper = gewicht_am($datum);

        $verhaeltnisse = [];

        foreach ((array) ($session['exercises'] ?? []) as $eintrag) {
            $id   = (string) ($eintrag['exercise_id'] ?? '');
            $sets = (array) ($eintrag['sets'] ?? []);

            if ($sets === []) {
                continue;
            }

            $leistung = fortschritt_leistung(
                $sets,
                !empty($uebungen[$id]['assisted']),
                $koerper
            );

            // Kein Maßstab: unterstützte Übung ohne Körpergewicht, oder ein
            // Satz mit 0 kg. Beides wäre eine Division durch null.
            if ($leistung === null || $leistung <= 0) {
                continue;
            }

            if (!isset($basis[$id])) {
                $basis[$id] = $leistung;
            }

            $verhaeltnisse[] = $leistung / $basis[$id];
        }

        if ($verhaeltnisse === []) {
            continue;
        }

        $punkte[] = [
            'date'     => (string) ($session['date'] ?? ''),
            'day'      => (string) ($session['day'] ?? ''),
            'uebungen' => count($verhaeltnisse),
            'wert'     => round(array_sum($verhaeltnisse) / count($verhaeltnisse) * 100, 1),
        ];
    }

    return $punkte;
}
