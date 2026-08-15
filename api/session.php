<?php
declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';
require_once __DIR__ . '/../lib/logs.php';

auth_require();
require_method('POST');

/**
 * Speichert einen einzelnen abgeschlossenen Satz.
 *
 * Satzweise und nicht am Ende der Einheit im Block: im Studio kann der Akku
 * leer werden, das Handy in die Tasche wandern oder die App verdrängt werden.
 * Was bestätigt ist, liegt auf der Platte.
 */

$eingabe = request_body();

$tag     = trim((string) ($eingabe['day'] ?? ''));
$uebung  = trim((string) ($eingabe['exercise_id'] ?? ''));
$index   = (int) ($eingabe['set_index'] ?? -1);
$gewicht = (float) ($eingabe['weight'] ?? -1);
$wdh     = (int) ($eingabe['reps'] ?? -1);
$rotIdx  = (int) ($eingabe['rotation_index'] ?? 0);

$plan = (array) json_read(PLAN_FILE, []);
if (!isset($plan['days'][$tag])) {
    fail('Diesen Trainingstag gibt es im Plan nicht.', 422);
}

$alle = (array) json_read(EXERCISES_FILE, []);
if (!isset($alle[$uebung])) {
    fail('Diese Übung gibt es nicht.', 422);
}

if ($index < 0 || $index > 49) {
    fail('Die Satznummer liegt außerhalb des Erwarteten.', 422);
}
if ($gewicht < 0 || $gewicht > 1000) {
    fail('Das Gewicht liegt außerhalb des Erwarteten.', 422);
}
if ($wdh < 1 || $wdh > 100) {
    fail('Die Wiederholungen liegen außerhalb des Erwarteten.', 422);
}

logs_satz_eintragen($tag, $rotIdx, $uebung, $index, $gewicht, $wdh);

$heutige = logs_heutige_session($tag);
$saetze  = [];
foreach ((array) ($heutige['exercises'] ?? []) as $eintrag) {
    if (($eintrag['exercise_id'] ?? '') === $uebung) {
        $saetze = $eintrag['sets'] ?? [];
    }
}

json_out(['exercise_id' => $uebung, 'sets' => $saetze]);
