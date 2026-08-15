<?php
declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';
require_once __DIR__ . '/../lib/coach.php';

auth_require();
require_method('GET');

/**
 * Empfehlung für eine einzelne Übung (SPEC.md §3, §7).
 *
 * Der Studio-Bildschirm braucht diesen Endpunkt nicht: plan.php hängt
 * dieselbe Empfehlung an jede Kachel, damit ein Request reicht. Hier steht
 * sie einzeln für die Auswertung und zum Nachsehen.
 */

$id = trim((string) ($_GET['id'] ?? ''));
if ($id === '') {
    fail('Ohne ID gibt es keine Empfehlung.');
}

$alle = (array) json_read(EXERCISES_FILE, []);
if (!isset($alle[$id])) {
    fail('Diese Übung gibt es nicht.', 404);
}

json_out([
    'exercise_id' => $id,
    'coach'       => coach_empfehlung($alle[$id]),
]);
