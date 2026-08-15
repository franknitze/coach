<?php
declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';

auth_require();
require_method('POST');

/**
 * Löscht ein Gerätefoto und nimmt es aus allen Übungen heraus.
 *
 * Ohne das sammeln sich Fehlversuche an: ein verwackeltes Bild, ein
 * falsches Gerät, und beides steht für immer in der Auswahl.
 *
 * Der Dateiname kommt vom Client, deshalb wird er auf den nackten
 * Basisnamen reduziert und danach geprüft, ob die Datei wirklich im
 * Bilderordner liegt. Sonst ließe sich mit ../ irgendetwas löschen.
 */

$roh = (string) (request_body()['photo'] ?? '');
$name = basename(trim($roh));

if ($name === '' || !preg_match('/^[A-Za-z0-9._-]+\.(jpg|jpeg|png|webp)$/i', $name)) {
    fail('Kein gültiger Dateiname.', 422);
}

$ordner = realpath(__DIR__ . '/../assets/img/exercises');
$pfad   = realpath($ordner . '/' . $name);

if ($ordner === false || $pfad === false || strpos($pfad, $ordner . DIRECTORY_SEPARATOR) !== 0) {
    fail('Diese Datei gibt es nicht.', 404);
}

if (!unlink($pfad)) {
    fail('Die Datei ließ sich nicht löschen.', 500);
}

// Übungen, die darauf zeigten, verlieren ihre Zuordnung. Sonst zeigte die
// Kachel auf ein Bild, das es nicht mehr gibt.
$betroffen = 0;
$alle = json_update(EXERCISES_FILE, function (array $alle) use ($name, &$betroffen): array {
    foreach ($alle as $id => $uebung) {
        if (($uebung['photo'] ?? '') === $name) {
            $alle[$id]['photo'] = '';
            $betroffen++;
        }
    }
    return $alle;
});

json_out([
    'deleted'   => $name,
    'exercises' => $alle === [] ? new stdClass() : $alle,
    'cleared'   => $betroffen,
]);
