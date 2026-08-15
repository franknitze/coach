<?php
declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';
require_once __DIR__ . '/../lib/uebungen.php';

auth_require();

$plan = (array) json_read(PLAN_FILE, []);

switch ($_SERVER['REQUEST_METHOD'] ?? 'GET') {

    case 'GET':
        json_out(['exercises' => alsObjekt((array) json_read(EXERCISES_FILE, []))]);
        // kein break nötig, json_out beendet

    case 'POST':
        try {
            $uebung = uebung_pruefen(request_body(), $plan);
        } catch (InvalidArgumentException $e) {
            fail($e->getMessage(), 422);
        }

        $alle = json_update(EXERCISES_FILE, function (array $alle) use ($uebung): array {
            $alle[$uebung['id']] = $uebung;
            return $alle;
        });

        json_out(['exercise' => $uebung, 'exercises' => alsObjekt($alle)]);

    case 'DELETE':
        $id = trim((string) ($_GET['id'] ?? ''));
        if ($id === '') {
            fail('Ohne ID lässt sich nichts löschen.');
        }

        $gefunden = false;
        $alle = json_update(EXERCISES_FILE, function (array $alle) use ($id, &$gefunden): array {
            $gefunden = isset($alle[$id]);
            unset($alle[$id]);
            return $alle;
        });

        if (!$gefunden) {
            fail('Diese Übung gibt es nicht.', 404);
        }

        // Die Logs bleiben stehen. Eine gelöschte Übung soll den Verlauf
        // vergangener Trainings nicht mit aus der Datei nehmen.
        json_out(['exercises' => alsObjekt($alle)]);

    default:
        header('Allow: GET, POST, DELETE');
        fail('Methode nicht erlaubt', 405);
}

/**
 * Sorgt dafür, dass eine leere Bibliothek im JSON als {} und nicht als []
 * ankommt. Das Frontend erwartet ein Objekt mit der Übungs-ID als Schlüssel.
 */
function alsObjekt(array $daten)
{
    return $daten === [] ? new stdClass() : $daten;
}
