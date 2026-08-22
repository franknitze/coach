<?php
declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';
require_once __DIR__ . '/../lib/training.php';

auth_require();
require_method('GET');

/**
 * Verlauf einer einzelnen Übung für die Auswertung (SPEC.md §5.4).
 */

$id = trim((string) ($_GET['id'] ?? ''));
if ($id === '') {
    fail('Ohne ID gibt es keinen Verlauf.');
}

$alle = (array) json_read(EXERCISES_FILE, []);
if (!isset($alle[$id])) {
    fail('Diese Übung gibt es nicht.', 404);
}

json_out([
    'exercise' => $alle[$id],
    'points'   => training_verlauf($id, !empty($alle[$id]['assisted'])),
]);
