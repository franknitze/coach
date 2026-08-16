<?php
declare(strict_types=1);

require_once __DIR__ . '/logs.php';

/**
 * Regelbasierte progressive Überlastung, doppelte Progression (SPEC.md §7).
 *
 * Erst die Wiederholungen bis rep_max hochklettern, dann das Gewicht um
 * weight_step anheben und die Wiederholungen Richtung rep_min zurücksetzen.
 *
 * Die Regel steht hier und nicht in einem Endpunkt: api/coach.php gibt sie
 * einzeln aus, api/plan.php hängt sie an jede Kachel, damit der Studio-
 * Bildschirm mit einem Request auskommt. Zwei Zugänge, eine Regel. Wer sie
 * ändert, ändert sie hier und nirgends sonst.
 *
 * Deterministisch und ohne Sprachmodell. Der KI-Coach aus §7 wäre eine
 * zusätzliche Schicht darüber, kein Ersatz.
 */

/**
 * Wie viele Einheiten müssen sauber sein, bevor gesteigert wird.
 * SPEC.md §7 nennt 2 bis 3. Zwei ist der zügigere Wert; wer vorsichtiger
 * steigern will, setzt hier 3.
 */
const COACH_EINHEITEN = 2;

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
 * @return array{status: string, text: string, reason: string, target_weight: float|null}
 *         status ist einer von: start, steigern, zurueckholen, halten.
 *         text ist die Handlung, reason die Begründung darunter (oft leer).
 */
function coach_empfehlung(array $uebung): array
{
    $repMin = (int) ($uebung['rep_min'] ?? 8);
    $repMax = (int) ($uebung['rep_max'] ?? 12);
    $schritt = (float) ($uebung['weight_step'] ?? config()['default_weight_step']);

    /*
     * An einer Unterstützungsmaschine läuft alles andersherum: das
     * Gegengewicht nimmt Körpergewicht ab, mehr davon macht die Übung
     * leichter. Fortschritt heißt dann weniger Gewicht.
     */
    $unterstuetzt = !empty($uebung['assisted']);

    $einheiten = logs_letzte_einheiten((string) $uebung['id'], COACH_EINHEITEN);

    if ($einheiten === []) {
        // Kurz halten. Der Wiederholungsbereich steht auf der Kachel schon
        // eine Zeile darüber, und beim ersten Training trägt jede Kachel
        // diesen Hinweis. Ein ganzer Satz wäre dort achtmal dieselbe Tapete.
        return [
            'status'        => 'start',
            'target_weight' => null,
            'reason'        => '',
            'text'          => $unterstuetzt
                ? 'Erste Einheit: Hilfe antasten'
                : 'Erste Einheit: Gewicht antasten',
        ];
    }

    $letzte = $einheiten[0];
    $gewichte = array_map(
        static fn (array $satz): float => (float) ($satz['weight'] ?? 0),
        $letzte['sets']
    );
    // Das Arbeitsgewicht ist der schwerste Satz, an der
    // Unterstützungsmaschine also der mit der GERINGSTEN Hilfe.
    $aktGewicht = $unterstuetzt ? min($gewichte) : max($gewichte);

    // Zweig 1: steigern.
    // Verlangt werden volle COACH_EINHEITEN. Eine einzelne saubere Einheit
    // reicht nicht, sonst schiebt ein guter Tag das Gewicht hoch, das am
    // nächsten Termin wieder einbricht.
    if (coach_sauber($einheiten, $aktGewicht, $repMax)) {
        $ziel = $unterstuetzt
            ? max(0.0, $aktGewicht - $schritt)
            : $aktGewicht + $schritt;

        /*
         * Ende der Leiter. Die Hilfe steht schon auf 0, es lässt sich nichts
         * mehr wegnehmen; weiter geht es nur noch mit Zusatzgewicht, und
         * dafür ist die Übung umzustellen. Ohne diesen Zweig stünde hier
         * für immer "Heute ohne Unterstützung", ein Vorschlag, der nichts
         * mehr vorschlägt.
         */
        if ($unterstuetzt && $aktGewicht <= 0.0) {
            return [
                'status'        => 'steigern',
                'target_weight' => 0.0,
                'text'          => 'Zusatzgewicht ist dran',
                'reason'        => COACH_EINHEITEN . ' Einheiten ohne Hilfe × '
                                 . $repMax . '. Im Plan die Gewichtsrichtung auf '
                                 . '"mehr Gewicht ist schwerer" stellen, dann zählt '
                                 . 'die App wieder nach oben.',
            ];
        }

        if ($unterstuetzt && $ziel <= 0.0) {
            return [
                'status'        => 'steigern',
                'target_weight' => 0.0,
                'text'          => 'Heute ohne Hilfe',
                'reason'        => COACH_EINHEITEN . ' Einheiten sauber bei '
                                 . coach_zahl($aktGewicht) . ' kg Hilfe',
            ];
        }

        return [
            'status'        => 'steigern',
            'target_weight' => $ziel,
            // Erst die Handlung, dann die Begründung. Auf der Kachel steht
            // die Handlung vorn und hervorgehoben, die Begründung leise
            // darunter: gelesen wird im Studio nur die erste Zeile.
            'text'          => $unterstuetzt
                ? 'Heute ' . coach_zahl($ziel) . ' kg Hilfe, ' . coach_zahl($schritt) . ' weniger'
                : 'Heute ' . coach_zahl($ziel) . ' kg',
            'reason'        => COACH_EINHEITEN . ' Einheiten sauber, '
                             . coach_last($aktGewicht, $unterstuetzt) . ' × ' . $repMax,
        ];
    }

    // Zweig 2: eingebrochen.
    // Geprüft wird der beste Satz der letzten Einheit, nicht irgendeiner:
    // der letzte Satz fällt bei hartem Training regelmäßig ab, das ist
    // normale Ermüdung und kein zu schweres Gewicht. Erst wenn auch der
    // beste Satz unter rep_min bleibt, stimmt das Gewicht nicht mehr.
    $besteWdh = max(array_map(
        static fn (array $satz): int => (int) ($satz['reps'] ?? 0),
        $letzte['sets']
    ));

    if ($besteWdh < $repMin) {
        return [
            'status'        => 'zurueckholen',
            'target_weight' => $aktGewicht,
            'reason'        => '',
            'text'          => $unterstuetzt
                ? 'Mehr Hilfe, bis ' . $repMin . ' Wiederholungen wieder gehen.'
                : coach_zahl($aktGewicht) . ' kg halten, Wiederholungen zurück auf '
                  . $repMin . '.',
        ];
    }

    // Zweig 3: halten. Was genau noch fehlt, hängt davon ab, wie nah die
    // letzte Einheit an der Obergrenze war. "Eine Wiederholung mehr" wäre
    // falsch, sobald rep_max schon erreicht ist: dann fehlt keine
    // Wiederholung mehr, sondern eine zweite saubere Einheit.
    $letzteSauber = coach_einheit_sauber($letzte, $aktGewicht, $repMax);

    // Ohne Hilfe gibt es nichts mehr zu halten, dort steht nur noch das
    // eigene Gewicht auf der Stange. "0 kg halten" wäre eine leere Ansage.
    $last = coach_last($aktGewicht, $unterstuetzt);
    $halten = $unterstuetzt && $aktGewicht <= 0.0 ? 'Ohne Hilfe' : $last . ' halten';

    if ($letzteSauber) {
        $fehlend = COACH_EINHEITEN - 1;
        $danach = !$unterstuetzt        ? 'geht es hoch.'
                : ($aktGewicht <= 0.0   ? 'kommt Zusatzgewicht.'
                                        : 'geht die Hilfe runter.');
        // "mit ohne Hilfe" wäre kein Deutsch.
        $womit = $unterstuetzt && $aktGewicht <= 0.0 ? 'ohne Hilfe' : 'mit ' . $last;
        return [
            'status'        => 'halten',
            'target_weight' => $aktGewicht,
            'reason'        => '',
            'text'          => 'Noch ' . ($fehlend === 1 ? 'eine saubere Einheit' : $fehlend
                             . ' saubere Einheiten') . ' ' . $womit
                             . ' × ' . $repMax . ', dann ' . $danach,
        ];
    }

    if ($besteWdh >= $repMax) {
        return [
            'status'        => 'halten',
            'target_weight' => $aktGewicht,
            'reason'        => '',
            'text'          => $halten . ', alle Sätze auf ' . $repMax . ' bringen.',
        ];
    }

    return [
        'status'        => 'halten',
        'target_weight' => $aktGewicht,
        'reason'        => '',
        'text'          => $halten . ', Ziel '
                         . min($besteWdh + 1, $repMax) . ' Wiederholungen.',
    ];
}

/**
 * Sind alle Arbeitssätze der letzten Einheiten beim aktuellen Gewicht
 * bis rep_max durchgegangen?
 *
 * Ein Satz mit abweichendem Gewicht lässt die Prüfung durchfallen. Das ist
 * gewollt: wer zwischendurch leichter geworden ist, hat die Stufe nicht
 * sauber abgeschlossen.
 */
function coach_sauber(array $einheiten, float $aktGewicht, int $repMax): bool
{
    if (count($einheiten) < COACH_EINHEITEN) {
        return false;
    }

    foreach ($einheiten as $einheit) {
        if (!coach_einheit_sauber($einheit, $aktGewicht, $repMax)) {
            return false;
        }
    }

    return true;
}

/** Eine einzelne Einheit: alle Sätze beim Gewicht und bis rep_max durch. */
function coach_einheit_sauber(array $einheit, float $aktGewicht, int $repMax): bool
{
    if (empty($einheit['sets'])) {
        return false;
    }

    foreach ($einheit['sets'] as $satz) {
        if (!coach_gleich((float) ($satz['weight'] ?? 0), $aktGewicht)) {
            return false;
        }
        if ((int) ($satz['reps'] ?? 0) < $repMax) {
            return false;
        }
    }

    return true;
}
