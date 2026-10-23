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

/**
 * Schrittweiten, die es real an Geräten und Hanteln gibt.
 *
 * SPEC.md §4 nennt nur 1,25, 2,5 und 5. Die drei kleinen Werte darunter
 * sind auf Franks Wunsch dazugekommen: an Kurzhanteln und an Maschinen mit
 * Zusatzscheibe geht es feiner, und wo eine ganze Stufe zu viel ist,
 * würde die Progressionsregel sonst dauerhaft stehenbleiben.
 *
 * Alle sechs Werte sind im Binärformat exakt darstellbar, deshalb hält der
 * strikte Vergleich in uebung_pruefen() stand.
 */
const WEIGHT_STEPS = [0.25, 0.5, 1.0, 1.25, 2.5, 5.0];

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
        throw new InvalidArgumentException(
            'Erlaubte Schrittweiten sind 0,25, 0,5, 1, 1,25, 2,5 und 5 kg.'
        );
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
        /*
         * Ausführung: Ein Name allein ist mehrdeutig, "Überkopfdrücken" kann
         * sitzend oder stehend sein, mit Lang- oder Kurzhantel.
         */
        // Ausgeblendet (Frank, 23.10.2026): nicht mehr in Plan und Studio,
        // aber mit allen Angaben erhalten, damit Rückblick und
        // Fortschrittskurve weiter stimmen. Wird über "Entfernen" gesetzt,
        // nicht über das Formular.
        'hidden'       => !empty($roh['hidden']),
        'execution'    => trim((string) ($roh['execution'] ?? '')),
        // Ein fest hinterlegtes Video statt einer Suche (Frank, 23.10.2026):
        // Dass eine Suche genau das Video findet, das die Übung erklärt, ist
        // Zufall. Der Suchbegriff und der Google-Knopf sind dafür entfallen.
        'video_url'    => video_link((string) ($roh['video_url'] ?? '')),
        /*
         * Unterstützungsmaschine: mehr Gewicht heißt LEICHTER.
         *
         * An einer Klimmzug- oder Dip-Maschine hebt das Gegengewicht einen
         * Teil des Körpergewichts an. Fortschritt heißt hier also weniger
         * Gewicht, nicht mehr. Ohne dieses Feld schickte die
         * Progressionsregel genau in die falsche Richtung.
         */
        'assisted'     => !empty($roh['assisted']),
        // Ergänzung zum Schema aus SPEC.md §4: die aufgeklebte Gerätenummer
        // aus dem Studio. Optional, dient dem Wiederfinden des Geräts.
        'station'      => trim((string) ($roh['station'] ?? '')),
    ];
}

/** Übungen eines Tages, nach order und dann nach Name sortiert. */
/**
 * Prüft einen YouTube-Link. Leer ist erlaubt. Angenommen werden nur
 * https-Adressen auf youtube.com und youtu.be: Der Knopf heißt "Video" und
 * öffnet sich im Studio mit einem Tipp, dahinter soll nichts anderes liegen.
 *
 * @throws InvalidArgumentException mit einer Meldung für die Oberfläche
 */
function video_link(string $roh): string
{
    $link = trim($roh);
    if ($link === '') {
        return '';
    }
    $teile = parse_url($link);
    $host = strtolower((string) ($teile['host'] ?? ''));
    $erlaubt = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'];
    if (($teile['scheme'] ?? '') !== 'https' || !in_array($host, $erlaubt, true)) {
        throw new InvalidArgumentException(
            'Das ist kein YouTube-Link. Er beginnt mit https://www.youtube.com/ oder https://youtu.be/.');
    }
    return $link;
}

/** Steht die Übung in Plan und Studio, also nicht ausgeblendet? */
function uebung_sichtbar(array $uebung): bool
{
    return empty($uebung['hidden']);
}

function uebungen_sortiert(array $uebungen): array
{
    usort($uebungen, function (array $a, array $b): int {
        return [$a['order'], $a['name']] <=> [$b['order'], $b['name']];
    });
    return $uebungen;
}
