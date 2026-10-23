<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

/**
 * Lesen und Schreiben der Trainings-Logs.
 *
 * Die Trainingsdaten liegen monatsweise (data/training/YYYY-MM.json), damit die Dateien
 * klein bleiben und das n8n-Backup handlich ist. Der Preis dafür: fast jede
 * Frage an die Vergangenheit geht über Monatsgrenzen. "Was habe ich zuletzt
 * an der Beinpresse gemacht" kann drei Dateien zurückliegen.
 *
 * Deshalb steht der Leser hier und nicht im Endpunkt: plan.php braucht ihn
 * für die Vorbefüllung, history.php für die Kurven, coach.php für die
 * Progressionsregel. Alle drei sollen dieselbe Reihenfolge sehen.
 */

/**
 * Fängt $text mit $anfang an?
 *
 * Eigene Funktion statt str_starts_with, weil das erst ab PHP 8 existiert.
 * Welche Version All-Inkl für die Subdomain fährt, wird in KAS eingestellt
 * und kann sich ändern, ohne dass es jemand merkt. Ein Aufruf einer nicht
 * vorhandenen Funktion legt die ganze App lahm, und zwar erst auf dem
 * Server. Diese drei Zeilen sind billiger als diese Fehlersuche.
 */
function beginnt_mit(string $text, string $anfang): bool
{
    return strncmp($text, $anfang, strlen($anfang)) === 0;
}

/** Monatsdateien, neueste zuerst. */
function training_monate(): array
{
    $dateien = glob(TRAINING_DIR . '/*.json') ?: [];
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
function training_monat(string $monat): array
{
    $sessions = array_values((array) json_read(TRAINING_DIR . '/' . $monat . '.json', []));

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
function training_rueckwaerts(callable $besucher): void
{
    foreach (training_monate() as $monat) {
        foreach (training_monat($monat) as $session) {
            if ($besucher($session) === true) {
                return;
            }
        }
    }
}

/** Die jüngste Session, oder null wenn noch nie trainiert wurde. */
function training_letzte_session(): ?array
{
    $treffer = null;

    training_rueckwaerts(function (array $session) use (&$treffer): bool {
        $treffer = $session;
        return true;
    });

    return $treffer;
}

/**
 * Die jüngsten $anzahl Sessions für den Rückblick auf der Startseite.
 *
 * Bewusst mit Deckel: zehn Einträge sind das, was man beim Zurückblicken
 * überblickt, und die Antwort trägt die Sätze gleich mit. Ohne Deckel läse
 * jeder Aufruf der Startseite die gesamte Historie ein.
 */
function training_letzte_sessions(int $anzahl, int $versatz = 0): array
{
    $gefunden = [];
    $uebersprungen = 0;

    // $versatz überspringt die jüngsten Einheiten, damit lässt sich im
    // Rückblick seitenweise zurückblättern (Frank, 23.10.2026).
    training_rueckwaerts(function (array $session) use ($anzahl, $versatz, &$gefunden, &$uebersprungen): bool {
        if ($uebersprungen < $versatz) {
            $uebersprungen++;
            return false;
        }
        $gefunden[] = $session;
        return count($gefunden) >= $anzahl;
    });

    return $gefunden;
}

/**
 * Wie viele Sessions es insgesamt gibt.
 *
 * Für die Auskunft "10 von 23" unter der Liste. Zählen heißt hier alle
 * Monatsdateien lesen; das ist der eine Fall, in dem das nötig ist, und er
 * betrifft eine Zahl und keine Schleife über Sätze.
 */
function training_anzahl_sessions(): int
{
    $summe = 0;

    foreach (training_monate() as $monat) {
        $summe += count(training_monat($monat));
    }

    return $summe;
}

/**
 * Die zuletzt geleisteten Sätze einer Übung, samt Datum.
 *
 * Das ist die Grundlage der Vorbefüllung: gleiche Leistung bedeutet im
 * Studio nur bestätigen, nichts ändern.
 */
function training_letzte_werte(string $uebungId): ?array
{
    $treffer = null;

    training_rueckwaerts(function (array $session) use ($uebungId, &$treffer): bool {
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
function training_letzte_einheiten(string $uebungId, int $anzahl): array
{
    $gefunden = [];

    training_rueckwaerts(function (array $session) use ($uebungId, $anzahl, &$gefunden): bool {
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
 * Der komplette Verlauf einer Übung, älteste Einheit zuerst.
 *
 * Rechnet je Einheit aus:
 * - work_weight: das Arbeitsgewicht des Tages. Normalerweise der schwerste
 *   Satz; an einer Unterstützungsmaschine ($unterstuetzt) der mit der
 *   geringsten Hilfe, denn dort ist weniger Gewicht die schwerere Übung.
 * - top_reps: die Wiederholungen dieses Satzes.
 * - volume: Summe aus Gewicht mal Wiederholungen über alle Sätze. SPEC.md
 *   §5.4 nennt es "Gewicht × Wdh × Sätze"; die Summe ist dasselbe, sobald
 *   die Sätze unterschiedlich ausfallen, was der Normalfall ist.
 * - reps_total: Summe der Wiederholungen. Für Unterstützungsübungen die
 *   ehrlichere Menge: dort wäre "Gewicht × Wdh" die abgenommene Last und
 *   stiege genau dann, wenn man sich mehr helfen lässt.
 *
 * Gerechnet wird hier und nicht im Browser: das Frontend zeigt an, es
 * rechnet nicht. Sonst driften Kurve und spätere Coach-Ansage auseinander.
 */
function training_verlauf(string $uebungId, bool $unterstuetzt = false): array
{
    $punkte = [];

    training_rueckwaerts(function (array $session) use ($uebungId, $unterstuetzt, &$punkte): bool {
        foreach ((array) ($session['exercises'] ?? []) as $eintrag) {
            if (($eintrag['exercise_id'] ?? '') !== $uebungId) {
                continue;
            }
            $saetze = (array) ($eintrag['sets'] ?? []);
            if ($saetze === []) {
                continue;
            }

            $arbeit  = null;
            $topWdh  = 0;
            $volumen = 0.0;
            $wdhGes  = 0;

            foreach ($saetze as $satz) {
                $gewicht = (float) ($satz['weight'] ?? 0);
                $wdh     = (int) ($satz['reps'] ?? 0);
                $volumen += $gewicht * $wdh;
                $wdhGes  += $wdh;

                $besser = $arbeit === null
                    || ($unterstuetzt ? $gewicht < $arbeit : $gewicht > $arbeit);
                if ($besser) {
                    $arbeit = $gewicht;
                    $topWdh = $wdh;
                }
            }

            $punkte[] = [
                'date'        => $session['date'] ?? '',
                'work_weight' => $arbeit ?? 0.0,
                'top_reps'    => $topWdh,
                'volume'      => round($volumen, 1),
                'reps_total'  => $wdhGes,
                'sets'        => count($saetze),
            ];
        }
        return false;   // den ganzen Verlauf durchgehen, nicht abbrechen
    });

    return array_reverse($punkte);
}

/**
 * Trägt einen Satz in die heutige Session ein und legt sie an, falls es
 * sie noch nicht gibt.
 *
 * $satzIndex macht den Aufruf wiederholbar: ein Doppel-Tap auf den
 * Bestätigungs-Button oder ein Wiederholungsversuch des Service Workers
 * überschreibt denselben Satz, statt ihn ein zweites Mal anzuhängen.
 */
function training_satz_eintragen(
    string $tag,
    int $rotationIndex,
    string $uebungId,
    int $satzIndex,
    float $gewicht,
    int $wiederholungen,
    ?DateTimeImmutable $zeitpunkt = null
): array {
    // Der Zeitpunkt darf vom Client kommen, weil Sätze bei schlechtem
    // Empfang lokal gepuffert und später nachgereicht werden. Ohne ihn
    // landete ein Satz vom Dienstagabend in der Mittwochs-Session.
    $jetzt  = $zeitpunkt ?? new DateTimeImmutable('now');
    $monat  = $jetzt->format('Y-m');
    $heute  = $jetzt->format('Y-m-d');
    $datei  = TRAINING_DIR . '/' . $monat . '.json';

    $satz = ['weight' => $gewicht, 'reps' => $wiederholungen];

    $sessions = json_update($datei, function (array $sessions) use (
        $tag, $rotationIndex, $uebungId, $satzIndex, $satz, $heute, $jetzt
    ): array {
        // Heutige Session desselben Trainingstags suchen.
        $i = null;
        foreach ($sessions as $index => $session) {
            if (beginnt_mit((string) ($session['date'] ?? ''), $heute)
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

/** Die Session dieses Trainingstags an diesem Kalendertag, oder null. */
function training_session_am(string $tag, ?DateTimeImmutable $zeitpunkt = null): ?array
{
    $wann = $zeitpunkt ?? new DateTimeImmutable('now');
    $tagesdatum = $wann->format('Y-m-d');

    foreach (training_monat($wann->format('Y-m')) as $session) {
        if (beginnt_mit((string) ($session['date'] ?? ''), $tagesdatum)
            && ($session['day'] ?? '') === $tag) {
            return $session;
        }
    }

    return null;
}

/** Die heutige Session dieses Trainingstags, oder null. */
function training_heutige_session(string $tag): ?array
{
    return training_session_am($tag, null);
}

/**
 * Was der heutige Plan für einen Trainingstag verlangt: Übungs-ID => Zielsätze.
 *
 * Eine Einheit speichert nicht, was damals verlangt war. Gerechnet wird
 * deshalb immer gegen den heutigen Stand; ändert sich eine Zielsatzzahl,
 * ändert sich die Beurteilung alter Einheiten mit. Das ist der Preis dafür,
 * die Vorgabe nicht in jede Session zu duplizieren.
 */
function training_soll(string $tag, array $uebungen): array
{
    $soll = [];

    foreach ($uebungen as $uebung) {
        if (($uebung['day'] ?? '') === $tag) {
            $soll[(string) $uebung['id']] = (int) ($uebung['target_sets'] ?? 0);
        }
    }

    return $soll;
}

/**
 * Hat eine Einheit jede für ihren Tag vorgesehene Übung durchgezogen?
 *
 * Je Übung geprüft, nicht über die Summe: acht Sätze Bankdrücken und keiner
 * Latzug ergäben dieselbe Zahl wie vier und vier, wären aber eine halbe
 * Einheit.
 *
 * Die Regel steht hier und nicht im Endpunkt, weil zwei Stellen sie brauchen:
 * api/einheiten.php für die Markierung in der Liste und training_offen() für
 * die Frage, ob eine Einheit noch weitergeht.
 */
function training_vollstaendig(array $session, array $uebungen): bool
{
    $soll = training_soll((string) ($session['day'] ?? ''), $uebungen);

    if ($soll === []) {
        return false;
    }

    $gemacht = [];
    foreach ((array) ($session['exercises'] ?? []) as $eintrag) {
        $gemacht[(string) ($eintrag['exercise_id'] ?? '')]
            = count((array) ($eintrag['sets'] ?? []));
    }

    foreach ($soll as $id => $ziel) {
        if (($gemacht[$id] ?? 0) < $ziel) {
            return false;
        }
    }

    return true;
}

/**
 * Läuft diese Einheit noch, kann man sie also weitertrainieren?
 *
 * Zwei Bedingungen, und die erste ist die wichtigere: Sie muss von HEUTE
 * sein. "Unvollständig" bleibt eine Einheit auch noch in drei Wochen — die
 * lässt sich nicht fortsetzen, die ist Geschichte. Eine Einheit ist nur am
 * selben Kalendertag offen; danach gilt sie als beendet, so als hätte man
 * "Einheit beenden" gedrückt (Vorgabe von Frank, 22.08.2026).
 */
function training_offen(array $session, array $uebungen): bool
{
    $heute = (new DateTimeImmutable('now'))->format('Y-m-d');

    if (!beginnt_mit((string) ($session['date'] ?? ''), $heute)) {
        return false;
    }

    return !training_vollstaendig($session, $uebungen);
}

/**
 * Alle offenen Einheiten von heute, die zuletzt angefangene zuerst.
 *
 * Braucht api/plan.php, um nach einem Neuladen wieder die Einheit
 * anzubieten, in der man steckt, statt den nächsten Tag der Rotation.
 */
function training_offene_heute(array $uebungen): array
{
    $heute  = new DateTimeImmutable('now');
    $offene = [];

    foreach (training_monat($heute->format('Y-m')) as $session) {
        if (training_offen($session, $uebungen)) {
            $offene[] = $session;
        }
    }

    // training_monat() liefert bereits neueste zuerst — nach Datum und, bei
    // gleicher Sekunde, nach Position in der Datei. Nicht noch einmal drehen:
    // dann stünde die ÄLTESTE offene Einheit vorn, und die Startseite böte
    // nach dem Neuladen die an, die man zuerst liegengelassen hat.
    return $offene;
}
