<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

/**
 * Prüfung und Normalisierung der Übungsdaten.
 *
 * Liegt in lib/ und nicht im Endpunkt, weil die Studio-Ansicht und der Coach
 * später auf dieselben Regeln angewiesen sind: ein rep_max unter rep_min oder
 * eine Schrittweite, die es an keiner Hantelstange gibt, würde die
 * Progressionsregel aus §7 stillschweigend unbrauchbar machen.
 */

/** Schrittweiten, die es real an Geräten und Hanteln gibt (SPEC.md §4). */
const WEIGHT_STEPS = [1.25, 2.5, 5.0];

/** Aus einem Namen eine ID machen: "Bankdrücken" wird zu "bankdruecken". */
function slug(string $name): string
{
    $map = ['ä' => 'ae', 'ö' => 'oe', 'ü' => 'ue', 'ß' => 'ss'];
    $s = strtr(mb_strtolower(trim($name), 'UTF-8'), $map);
    $s = preg_replace('/[^a-z0-9]+/u', '-', $s) ?? '';
    return trim($s, '-');
}

/**
 * Prüft eine Übung und gibt sie normalisiert zurück.
 *
 * @throws InvalidArgumentException mit einer Meldung, die direkt in der
 *         Oberfläche angezeigt werden kann.
 */
function uebung_pruefen(array $roh, array $plan): array
{
    $name = trim((string) ($roh['name'] ?? ''));
    if ($name === '') {
        throw new InvalidArgumentException('Die Übung braucht einen Namen.');
    }

    $id = trim((string) ($roh['id'] ?? '')) ?: slug($name);
    if ($id === '') {
        throw new InvalidArgumentException('Aus dem Namen lässt sich keine ID bilden.');
    }

    $tage = array_keys((array) ($plan['days'] ?? []));
    $day  = (string) ($roh['day'] ?? '');
    if (!in_array($day, $tage, true)) {
        throw new InvalidArgumentException('Diesen Trainingstag gibt es im Plan nicht.');
    }

    $gruppen = array_keys((array) ($plan['muscle_priorities'] ?? []));
    $gruppe  = (string) ($roh['muscle_group'] ?? '');
    if (!in_array($gruppe, $gruppen, true)) {
        throw new InvalidArgumentException('Diese Muskelgruppe gibt es im Plan nicht.');
    }

    $repMin = (int) ($roh['rep_min'] ?? 0);
    $repMax = (int) ($roh['rep_max'] ?? 0);
    if ($repMin < 1 || $repMax < 1) {
        throw new InvalidArgumentException('Der Wiederholungsbereich fehlt.');
    }
    if ($repMin > $repMax) {
        throw new InvalidArgumentException('Die untere Wiederholungszahl liegt über der oberen.');
    }

    $saetze = (int) ($roh['target_sets'] ?? 0);
    if ($saetze < 1 || $saetze > 12) {
        throw new InvalidArgumentException('Zielsätze müssen zwischen 1 und 12 liegen.');
    }

    $step = (float) ($roh['weight_step'] ?? config()['default_weight_step']);
    if (!in_array($step, WEIGHT_STEPS, true)) {
        throw new InvalidArgumentException('Erlaubte Schrittweiten sind 1,25, 2,5 und 5 kg.');
    }

    return [
        'id'           => $id,
        'name'         => $name,
        'muscle_group' => $gruppe,
        'day'          => $day,
        'order'        => max(0, (int) ($roh['order'] ?? 0)),
        'target_sets'  => $saetze,
        'rep_min'      => $repMin,
        'rep_max'      => $repMax,
        'weight_step'  => $step,
        'photo'        => trim((string) ($roh['photo'] ?? '')),
        // Ergänzung zum Schema aus SPEC.md §4: die aufgeklebte Gerätenummer
        // aus dem Studio. Optional, dient dem Wiederfinden des Geräts.
        'station'      => trim((string) ($roh['station'] ?? '')),
    ];
}

/** Übungen eines Tages, nach order und dann nach Name sortiert. */
function uebungen_sortiert(array $uebungen): array
{
    usort($uebungen, function (array $a, array $b): int {
        return [$a['order'], $a['name']] <=> [$b['order'], $b['name']];
    });
    return $uebungen;
}
