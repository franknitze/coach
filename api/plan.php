<?php
declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';
require_once __DIR__ . '/../lib/uebungen.php';
require_once __DIR__ . '/../lib/training.php';
require_once __DIR__ . '/../lib/coach.php';

auth_require();
require_method('GET');

/**
 * Die Studio-Ansicht in einer Antwort: welcher Tag dran ist, welche Übungen
 * dazugehören, was beim letzten Mal dabei herauskam und was heute schon
 * geschafft ist.
 *
 * Bewusst ein Request und nicht einer pro Kachel. Im Studio hängt das Handy
 * womöglich an schlechtem WLAN, und die Kacheln sollen zusammen erscheinen
 * und nicht nacheinander eintrudeln.
 */

$plan     = (array) json_read(PLAN_FILE, []);
$rotation = array_values((array) ($plan['rotation'] ?? []));
$tage     = (array) ($plan['days'] ?? []);

if ($rotation === [] || $tage === []) {
    fail('Der Plan hat noch keine Tage oder keine Rotation.', 409);
}

$alle = (array) json_read(EXERCISES_FILE, []);

/*
 * Eine offene Einheit von heute sticht den Rotationsvorschlag.
 *
 * Ohne das springt die Startseite nach einem Neuladen auf den nächsten Tag,
 * obwohl man mitten in einem anderen steckt: naechster_tag() rückt schon ab
 * dem ersten bestätigten Satz weiter, weil die laufende Einheit dann die
 * letzte in der Historie ist. Im Browser hielt zustand.tagWahl das fest —
 * aber nur, solange die Seite nicht neu geladen wurde.
 *
 * Bei zwei offenen Einheiten gewinnt die zuletzt angefangene. Die andere
 * bleibt über die Liste auf der Startseite erreichbar.
 */
$offene = training_offene_heute($alle);

$vorschlag = $offene !== []
    ? ['day' => (string) $offene[0]['day'], 'index' => (int) ($offene[0]['rotation_index'] ?? 0)]
    : naechster_tag($rotation);

// Ein bewusst gewählter Tag sticht den Vorschlag: Krankheit, Reise,
// eine zusätzliche Einheit. Frank soll nie ins Schema gezwungen sein.
$gewuenscht = trim((string) ($_GET['day'] ?? ''));
$istVorschlag = $gewuenscht === '' || $gewuenscht === $vorschlag['day'];

if ($istVorschlag) {
    $tag            = $vorschlag['day'];
    $rotationIndex  = $vorschlag['index'];
} else {
    if (!isset($tage[$gewuenscht])) {
        fail('Diesen Trainingstag gibt es im Plan nicht.', 404);
    }
    $tag = $gewuenscht;
    $pos = array_search($tag, $rotation, true);
    $rotationIndex = $pos === false ? 0 : (int) $pos;
}

$heutige = training_heutige_session($tag);
$erledigt = [];
foreach ((array) ($heutige['exercises'] ?? []) as $eintrag) {
    $erledigt[$eintrag['exercise_id'] ?? ''] = $eintrag['sets'] ?? [];
}

$heute = [];

foreach ($alle as $uebung) {
    if (($uebung['day'] ?? '') !== $tag) {
        continue;
    }
    $id = $uebung['id'];
    $uebung['last']  = training_letzte_werte($id);
    $uebung['today'] = $erledigt[$id] ?? [];
    $uebung['coach'] = coach_empfehlung($uebung);
    $heute[] = $uebung;
}

json_out([
    'day'                => ['key' => $tag, 'label' => $tage[$tag]['label'] ?? $tag],
    'rotation_index'     => $rotationIndex,
    'is_suggestion'      => $istVorschlag,
    // Wie viele Einheiten heute noch offen sind. Die Startseite blendet den
    // Knopf unten aus, sobald es mehr als eine ist: Er könnte dann nicht
    // sagen, welche er fortsetzt, und genau das war der Fehler.
    'offene_einheiten'   => count($offene),
    'days'               => $tage,
    'exercises'          => uebungen_sortiert($heute),
    'rest_timer_seconds' => (int) config()['rest_timer_seconds'],
    'rest_pair_seconds'  => (int) config()['rest_pair_seconds'],
]);

/**
 * Welcher Tag logisch als Nächstes dran ist.
 *
 * Die Rotation darf denselben Tag mehrfach enthalten (SPEC.md §4:
 * oberkoerper, unterkoerper, oberkoerper). Über den Namen allein wäre die
 * Position also nicht eindeutig. Deshalb merkt sich jede Session ihren
 * rotation_index; für ältere Einträge ohne dieses Feld wird die erste
 * passende Position gesucht.
 */
function naechster_tag(array $rotation): array
{
    $letzte = training_letzte_session();

    if ($letzte === null) {
        return ['day' => $rotation[0], 'index' => 0];
    }

    if (isset($letzte['rotation_index'])) {
        $letzterIndex = (int) $letzte['rotation_index'];
    } else {
        $pos = array_search($letzte['day'] ?? '', $rotation, true);
        $letzterIndex = $pos === false ? -1 : (int) $pos;
    }

    $index = ($letzterIndex + 1) % count($rotation);
    return ['day' => $rotation[$index], 'index' => $index];
}
