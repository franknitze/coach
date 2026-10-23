<?php
declare(strict_types=1);

require_once __DIR__ . '/training.php';

/**
 * Regelbasierte progressive Überlastung, doppelte Progression (SPEC.md §7).
 *
 * Die Regel (Frank, 17.10.2026):
 * - Eine Wiederholung mehr gibt es nur, wenn ALLE Sätze das Ziel geschafft
 *   haben. Fehlt auch nur einem Satz etwas, wird das Ziel wiederholt.
 * - Schaffen alle Sätze die Obergrenze, steigt das Gewicht sofort um
 *   weight_step, und es geht wieder bei rep_min los.
 *
 * Bis zum 17.10.2026 richtete sich das Ziel nach dem BESTEN Satz, und das
 * Gewicht stieg erst nach zwei sauberen Einheiten hintereinander. Nach 8, 8, 6
 * kam so 9 statt 8, und nach 10, 10, 10 musste man die 10 ein zweites Mal
 * schaffen. Beides hat Frank verworfen.
 *
 * Das Ziel einer Einheit wird nicht gespeichert. Es entsteht, indem die
 * Regel über den ganzen Verlauf der Übung von der ersten Einheit an
 * nachgespielt wird (coach_nachspielen()). Nur so lässt sich sagen, ob
 * 8, 8, 6 ein verfehltes Ziel 8 war oder ein geschafftes Ziel 6.
 *
 * Die Regel steht hier und nicht in einem Endpunkt: api/coach.php gibt sie
 * einzeln aus, api/plan.php hängt sie an jede Kachel, damit der Studio-
 * Bildschirm mit einem Request auskommt. Zwei Zugänge, eine Regel. Wer sie
 * ändert, ändert sie hier und nirgends sonst.
 *
 * Deterministisch und ohne Sprachmodell. Der KI-Coach aus §7 wäre eine
 * zusätzliche Schicht darüber, kein Ersatz.
 */

/** Gewichte sind Kommazahlen, deshalb nie auf Gleichheit prüfen. */
function coach_gleich(float $a, float $b): bool
{
    return abs($a - $b) < 0.001;
}

function coach_zahl(float $wert): string
{
    return str_replace('.', ',', (string) (round($wert * 100) / 100));
}

/**
 * Wie das Arbeitsgewicht in einer Ansage heißt.
 *
 * An der Unterstützungsmaschine ist die Zahl keine Last, sondern die Hilfe,
 * und bei 0 ist sie gar keine Zahl mehr: dort hängt man am eigenen Gewicht.
 * "0 kg halten" wäre an dieser Stelle schlicht falsch.
 */
function coach_last(float $gewicht, bool $unterstuetzt): string
{
    if (!$unterstuetzt) {
        return coach_zahl($gewicht) . ' kg';
    }

    return $gewicht <= 0.0 ? 'ohne Hilfe' : coach_zahl($gewicht) . ' kg Hilfe';
}

/**
 * Empfehlung für eine Übung.
 *
 * @return array{status: string, text: string, reason: string,
 *               target_weight: float|null, target_reps: int}
 *         status ist einer von: start, steigern, zurueckholen, halten.
 *         text ist die Handlung, reason die Begründung darunter (oft leer).
 *
 *         target_weight und target_reps sind das, was heute ansteht. Sie
 *         befüllen im Studio die beiden Regler (Frank, 26.08.2026). Die
 *         Zahlen gehören hierher und nicht ins Frontend: Die Regel lebt an
 *         einer Stelle, sonst rechnet der Browser irgendwann etwas anderes
 *         als der Server.
 */
function coach_empfehlung(array $uebung): array
{
    $repMin = (int) ($uebung['rep_min'] ?? 8);
    $repMax = (int) ($uebung['rep_max'] ?? 12);
    $schritt = (float) ($uebung['weight_step'] ?? config()['default_weight_step']);
    $zielSaetze = (int) ($uebung['target_sets'] ?? 0);

    /*
     * An einer Unterstützungsmaschine läuft alles andersherum: das
     * Gegengewicht nimmt Körpergewicht ab, mehr davon macht die Übung
     * leichter. Fortschritt heißt dann weniger Gewicht.
     */
    $unterstuetzt = !empty($uebung['assisted']);

    // Neueste zuerst geliefert, nachgespielt wird von der ältesten an.
    $einheiten = array_reverse(training_letzte_einheiten((string) $uebung['id'], PHP_INT_MAX));

    if ($einheiten === []) {
        return [
            'status'        => 'start',
            'target_weight' => null,
            'target_reps'   => $repMin,
            'reason'        => '',
            'text'          => $unterstuetzt
                ? 'Erste Einheit: Hilfe antasten'
                : 'Erste Einheit: Gewicht antasten',
        ];
    }

    $stand = coach_nachspielen($einheiten, $repMin, $repMax, $schritt, $zielSaetze, $unterstuetzt);
    $gewicht = $stand['gewicht'];
    $ziel = $stand['ziel'];
    $vorher = $stand['vorher'];

    if ($stand['ereignis'] === 'zusatz') {
        /*
         * Ende der Leiter. Die Hilfe steht schon auf 0, es lässt sich nichts
         * mehr wegnehmen; weiter geht es nur noch mit Zusatzgewicht, und
         * dafür ist die Übung umzustellen.
         */
        return [
            'status'        => 'steigern',
            'target_weight' => 0.0,
            'target_reps'   => $repMin,
            'text'          => 'Zusatzgewicht ist dran',
            'reason'        => 'Alle Sätze ohne Hilfe × ' . $repMax . '. Im Plan die '
                             . 'Gewichtsrichtung auf "mehr Gewicht ist schwerer" stellen, '
                             . 'dann zählt die App wieder nach oben.',
        ];
    }

    if ($stand['ereignis'] === 'steigern') {
        $text = !$unterstuetzt
            ? 'Heute ' . coach_zahl($gewicht) . ' kg'
            : ($gewicht <= 0.0
                ? 'Heute ohne Hilfe'
                : 'Heute ' . coach_zahl($gewicht) . ' kg Hilfe, ' . coach_zahl($schritt) . ' weniger');
        return [
            'status'        => 'steigern',
            'target_weight' => $gewicht,
            'target_reps'   => $repMin,
            'text'          => $text,
            'reason'        => 'Alle Sätze ' . coach_last($vorher, $unterstuetzt) . ' × ' . $repMax,
        ];
    }

    if ($stand['ereignis'] === 'zurueckholen') {
        return [
            'status'        => 'zurueckholen',
            'target_weight' => $gewicht,
            'target_reps'   => $ziel,
            'reason'        => '',
            'text'          => $unterstuetzt
                ? 'Mehr Hilfe, bis ' . $repMin . ' Wiederholungen wieder gehen.'
                : coach_zahl($gewicht) . ' kg halten, Wiederholungen zurück auf ' . $repMin . '.',
        ];
    }

    // Ohne Hilfe gibt es nichts mehr zu halten, dort steht nur noch das
    // eigene Gewicht auf der Stange. "0 kg halten" wäre eine leere Ansage.
    $halten = $unterstuetzt && $gewicht <= 0.0
        ? 'Ohne Hilfe'
        : coach_last($gewicht, $unterstuetzt) . ' halten';

    return [
        'status'        => 'halten',
        'target_weight' => $gewicht,
        'target_reps'   => $ziel,
        'reason'        => '',
        'text'          => $ziel >= $repMax
            ? $halten . ', alle Sätze auf ' . $repMax . ' bringen.'
            : $halten . ', Ziel ' . $ziel . ' Wiederholungen.',
    ];
}

/**
 * Spielt die Regel über alle Einheiten einer Übung nach, älteste zuerst.
 *
 * Zustand: das Gewicht, das ansteht, und das Ziel an Wiederholungen. Die
 * erste Einheit legt das Gewicht fest (es gibt keine Startgewichte), das
 * Ziel beginnt bei rep_min. Danach je Einheit:
 *
 * - Geschafft heißt: so viele Sätze wie verlangt, alle auf dem Gewicht, und
 *   jeder einzelne mindestens beim Ziel. Dann steigt das Ziel auf die
 *   schwächste Wiederholungszahl plus eins. Liegt auch der schwächste Satz an
 *   der Obergrenze, steigt stattdessen das Gewicht und das Ziel fällt auf
 *   rep_min.
 * - Nicht geschafft: das Ziel bleibt. Bleibt sogar der beste Satz unter
 *   rep_min, geht das Ziel auf rep_min zurück.
 *
 * Weicht das Gewicht einer Einheit vom anstehenden ab (eigene Wahl im
 * Studio), gilt ab da das tatsächlich gehobene. Das Ziel bleibt dabei.
 *
 * Aufwärmsätze werden nicht eingetragen (Frank, 26.08.2026). Ein leichterer
 * Satz lässt die Einheit als nicht geschafft zählen.
 *
 * @return array{gewicht: float, ziel: int, vorher: float, ereignis: string, ereignisse: array}
 *         ereignis der letzten Einheit: weiter, halten, zurueckholen,
 *         steigern oder zusatz. vorher ist das Gewicht vor einer Steigerung.
 *         ereignisse hält das Ereignis jeder Einheit fest, mit denselben
 *         Schlüsseln wie $einheiten; Einheiten ohne Satz fehlen darin.
 */
function coach_nachspielen(array $einheiten, int $repMin, int $repMax, float $schritt,
                           int $zielSaetze, bool $unterstuetzt): array
{
    $gewicht = null;
    $ziel = $repMin;
    $vorher = 0.0;
    $ereignis = 'halten';
    $ereignisse = [];

    foreach ($einheiten as $schluessel => $einheit) {
        $saetze = (array) ($einheit['sets'] ?? []);
        if ($saetze === []) {
            continue;
        }

        $gewichte = array_map(static fn (array $satz): float => (float) ($satz['weight'] ?? 0), $saetze);
        $wdh = array_map(static fn (array $satz): int => (int) ($satz['reps'] ?? 0), $saetze);

        // Das Arbeitsgewicht ist der schwerste Satz, an der
        // Unterstützungsmaschine der mit der GERINGSTEN Hilfe.
        $gehoben = $unterstuetzt ? min($gewichte) : max($gewichte);
        if ($gewicht === null || !coach_gleich($gehoben, $gewicht)) {
            $gewicht = $gehoben;
        }

        $vollstaendig = $zielSaetze <= 0 || count($saetze) >= $zielSaetze;
        $alleAufGewicht = true;
        foreach ($gewichte as $g) {
            if (!coach_gleich($g, $gewicht)) {
                $alleAufGewicht = false;
            }
        }
        $schwaechster = min($wdh);
        $bester = max($wdh);

        if ($vollstaendig && $alleAufGewicht && $schwaechster >= $ziel) {
            if ($schwaechster >= $repMax) {
                $vorher = $gewicht;
                if ($unterstuetzt && $gewicht <= 0.0) {
                    $ereignis = 'zusatz';
                } else {
                    $gewicht = $unterstuetzt ? max(0.0, $gewicht - $schritt) : $gewicht + $schritt;
                    $ereignis = 'steigern';
                }
                $ziel = $repMin;
            } else {
                $ziel = min($schwaechster + 1, $repMax);
                $ereignis = 'weiter';
            }
        } elseif ($bester < $repMin) {
            $ziel = $repMin;
            $ereignis = 'zurueckholen';
        } else {
            $ereignis = 'halten';
        }
        $ereignisse[$schluessel] = $ereignis;
    }

    return ['gewicht' => (float) $gewicht, 'ziel' => $ziel, 'vorher' => $vorher,
            'ereignis' => $ereignis, 'ereignisse' => $ereignisse];
}

/**
 * Der Verlauf einer Übung für die Tabelle auf der Studio-Kachel, neueste
 * Einheit zuerst.
 *
 * Je Einheit: Datum, die Sätze und ob das Ziel erreicht wurde. "Erreicht"
 * ist dasselbe "geschafft" wie in coach_nachspielen(), also alle Sätze auf
 * dem Gewicht, so viele wie verlangt und jeder mindestens beim Ziel. Es wird
 * aus derselben Nachspielung gelesen und nicht ein zweites Mal gerechnet,
 * sonst könnte die Tabelle etwas anderes sagen als die Regler.
 *
 * Die Einheit von heute fehlt: Sie läuft womöglich noch, und ein halber Tag
 * stünde als nicht erreicht da. Was heute gemacht ist, zeigt die Punktreihe.
 *
 * @return list<array{date: string, sets: array, achieved: bool}>
 */
function coach_verlauf(array $uebung): array
{
    $einheiten = array_reverse(training_letzte_einheiten((string) $uebung['id'], PHP_INT_MAX));
    if ($einheiten === []) {
        return [];
    }

    $stand = coach_nachspielen(
        $einheiten,
        (int) ($uebung['rep_min'] ?? 8),
        (int) ($uebung['rep_max'] ?? 12),
        (float) ($uebung['weight_step'] ?? config()['default_weight_step']),
        (int) ($uebung['target_sets'] ?? 0),
        !empty($uebung['assisted'])
    );

    $heute = (new DateTimeImmutable('now'))->format('Y-m-d');
    $verlauf = [];
    foreach ($stand['ereignisse'] as $schluessel => $ereignis) {
        $einheit = $einheiten[$schluessel];
        if (beginnt_mit((string) $einheit['date'], $heute)) {
            continue;
        }
        $verlauf[] = [
            'date'     => (string) $einheit['date'],
            'sets'     => array_map(static fn (array $satz): array => [
                'weight' => (float) ($satz['weight'] ?? 0),
                'reps'   => (int) ($satz['reps'] ?? 0),
            ], array_values((array) $einheit['sets'])),
            'achieved' => in_array($ereignis, ['weiter', 'steigern', 'zusatz'], true),
        ];
    }

    return array_reverse($verlauf);
}
