<?php
declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';
require_once __DIR__ . '/../lib/gewicht.php';

auth_require();

/**
 * Das Körpergewicht mit Datum.
 *
 * Gebraucht vom Fortschritts-Index: An der Unterstützungsmaschine ist die
 * bewegte Last "Körpergewicht minus Hilfe". Warum die Einträge ein Datum
 * tragen und nicht bloß ein aktueller Wert gespeichert wird, steht in
 * lib/gewicht.php.
 */

switch ($_SERVER['REQUEST_METHOD'] ?? 'GET') {

    case 'GET':
        json_out(['gewicht' => gewicht_liste()]);

    case 'POST':
        $eingabe = request_body();
        $tag = trim((string) ($eingabe['date'] ?? ''));

        try {
            $liste = !empty($eingabe['weg'])
                ? gewicht_entfernen($tag)
                : gewicht_setzen($tag, gewicht_zahl((string) ($eingabe['kg'] ?? '')));
        } catch (InvalidArgumentException $e) {
            fail($e->getMessage(), 422);
        }

        json_out(['gewicht' => $liste]);

    default:
        header('Allow: GET, POST');
        fail('Methode nicht erlaubt', 405);
}
