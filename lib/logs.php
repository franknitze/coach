<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

/**
 * Lesen und Schreiben der Trainings-Logs.
 *
 * Die Logs liegen monatsweise (data/logs/YYYY-MM.json), damit die Dateien
 * klein bleiben und das n8n-Backup handlich ist. Der Preis dafür: fast jede
 * Frage an die Vergangenheit geht über Monatsgrenzen. "Was habe ich zuletzt
 * an der Beinpresse gemacht" kann drei Dateien zurückliegen.
 *
 * Deshalb steht der Leser hier und nicht im Endpunkt: plan.php braucht ihn
 * für die Vorbefüllung, history.php für die Kurven, coach.php für die
 * Progressionsregel. Alle drei sollen dieselbe Reihenfolge sehen.
 */

/** Monatsdateien, neueste zuerst. */
function logs_monate(): array
{
    $dateien = glob(LOGS_DIR . '/*.json') ?: [];
    $monate = [];

    foreach ($dateien as $datei) {
        $name = basename($datei, '.json');
        if (preg_match('/^\d{4}-\d{2}$/', $name)) {
            $monate[] = $name;
        }
    }

    rsort($monate);
    return $monate;
}

/**
 * Alle Sessions eines Monats, neueste zuerst.
 *
 * Zweites Sortierkriterium ist die Position in der Datei. Das Datumsfeld ist
 * auf die Sekunde genau; zwei Einträge derselben Sekunde wären sonst nicht
 * unterscheidbar, und "welche Session war die letzte" entschiede der Zufall.
 * Angehängt wird hinten, später in der Datei heißt also später entstanden.
 */
function logs_monat(string $monat): array
{
    $sessions = array_values((array) json_read(LOGS_DIR . '/' . $monat . '.json', []));

    $mitPosition = [];
    foreach ($sessions as $position => $session) {
        $mitPosition[] = ['pos' => $position, 'session' => $session];
    }

    usort($mitPosition, function (array $a, array $b): int {
        $vergleich = strcmp(
            (string) ($b['session']['date'] ?? ''),
            (string) ($a['session']['date'] ?? '')
        );
        return $vergleich !== 0 ? $vergleich : ($b['pos'] <=> $a['pos']);
    });

    return array_column($mitPosition, 'session');
}

/**
 * Geht die Sessions von der neuesten rückwärts durch und ruft $besucher
 * für jede auf. Gibt $besucher true zurück, wird abgebrochen.
 *
 * Rückwärts und abbrechbar, damit die Vorbefüllung nicht jedes Mal die
 * gesamte Trainingshistorie einliest.
 */
function logs_rueckwaerts(callable $besucher): void
{
    foreach (logs_monate() as $monat) {
        foreach (logs_monat($monat) as $session) {
            if ($besucher($session) === true) {
                return;
            }
        }
    }
}

/** Die jüngste Session, oder null wenn noch nie trainiert wurde. */
function logs_letzte_session(): ?array
{
    $treffer = null;

    logs_rueckwaerts(function (array $session) use (&$treffer): bool {
        $treffer = $session;
        return true;
    });

    return $treffer;
}

/**
 * Die zuletzt geleisteten Sätze einer Übung, samt Datum.
 *
 * Das ist die Grundlage der Vorbefüllung: gleiche Leistung bedeutet im
 * Studio nur bestätigen, nichts ändern.
 */
function logs_letzte_werte(string $uebungId): ?array
{
    $treffer = null;

    logs_rueckwaerts(function (array $session) use ($uebungId, &$treffer): bool {
        foreach ((array) ($session['exercises'] ?? []) as $eintrag) {
            if (($eintrag['exercise_id'] ?? '') === $uebungId
                && !empty($eintrag['sets'])) {
                $treffer = [
                    'date' => $session['date'] ?? '',
                    'sets' => $eintrag['sets'],
                ];
                return true;
            }
        }
        return false;
    });

    return $treffer;
}

/**
 * Die letzten $anzahl Einheiten einer Übung, neueste zuerst.
 * Grundlage der Progressionsregel aus SPEC.md §7 (Phase 4).
 */
function logs_letzte_einheiten(string $uebungId, int $anzahl): array
{
    $gefunden = [];

    logs_rueckwaerts(function (array $session) use ($uebungId, $anzahl, &$gefunden): bool {
        foreach ((array) ($session['exercises'] ?? []) as $eintrag) {
            if (($eintrag['exercise_id'] ?? '') === $uebungId && !empty($eintrag['sets'])) {
                $gefunden[] = [
                    'date' => $session['date'] ?? '',
                    'sets' => $eintrag['sets'],
                ];
            }
        }
        return count($gefunden) >= $anzahl;
    });

    return array_slice($gefunden, 0, $anzahl);
}

/**
 * Trägt einen Satz in die heutige Session ein und legt sie an, falls es
 * sie noch nicht gibt.
 *
 * $satzIndex macht den Aufruf wiederholbar: ein Doppel-Tap auf den
 * Bestätigungs-Button oder ein Wiederholungsversuch des Service Workers
 * überschreibt denselben Satz, statt ihn ein zweites Mal anzuhängen.
 */
function logs_satz_eintragen(
    string $tag,
    int $rotationIndex,
    string $uebungId,
    int $satzIndex,
    float $gewicht,
    int $wiederholungen
): array {
    $jetzt  = new DateTimeImmutable('now');
    $monat  = $jetzt->format('Y-m');
    $heute  = $jetzt->format('Y-m-d');
    $datei  = LOGS_DIR . '/' . $monat . '.json';

    $satz = ['weight' => $gewicht, 'reps' => $wiederholungen];

    $sessions = json_update($datei, function (array $sessions) use (
        $tag, $rotationIndex, $uebungId, $satzIndex, $satz, $heute, $jetzt
    ): array {
        // Heutige Session desselben Trainingstags suchen.
        $i = null;
        foreach ($sessions as $index => $session) {
            if (str_starts_with((string) ($session['date'] ?? ''), $heute)
                && ($session['day'] ?? '') === $tag) {
                $i = $index;
                break;
            }
        }

        if ($i === null) {
            $sessions[] = [
                'date'           => $jetzt->format(DateTimeInterface::ATOM),
                'day'            => $tag,
                'rotation_index' => $rotationIndex,
                'exercises'      => [],
            ];
            $i = array_key_last($sessions);
        }

        // Übungseintrag in dieser Session suchen.
        $j = null;
        foreach ($sessions[$i]['exercises'] as $index => $eintrag) {
            if (($eintrag['exercise_id'] ?? '') === $uebungId) {
                $j = $index;
                break;
            }
        }

        if ($j === null) {
            $sessions[$i]['exercises'][] = ['exercise_id' => $uebungId, 'sets' => []];
            $j = array_key_last($sessions[$i]['exercises']);
        }

        $sessions[$i]['exercises'][$j]['sets'][$satzIndex] = $satz;
        ksort($sessions[$i]['exercises'][$j]['sets']);
        $sessions[$i]['exercises'][$j]['sets'] =
            array_values($sessions[$i]['exercises'][$j]['sets']);

        return $sessions;
    }, []);

    return $sessions;
}

/** Die heutige Session dieses Trainingstags, oder null. */
function logs_heutige_session(string $tag): ?array
{
    $heute = (new DateTimeImmutable('now'))->format('Y-m-d');

    foreach (logs_monat((new DateTimeImmutable('now'))->format('Y-m')) as $session) {
        if (str_starts_with((string) ($session['date'] ?? ''), $heute)
            && ($session['day'] ?? '') === $tag) {
            return $session;
        }
    }

    return null;
}
