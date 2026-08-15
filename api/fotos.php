<?php
declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';

auth_require();
require_method('GET');

/**
 * Listet die verfügbaren Gerätefotos für die Bildauswahl.
 *
 * Es sind schlicht alle Webfassungen aus assets/img/exercises/, erzeugt
 * von bin/fotos.sh aus den Originalen in images/. Wer ein neues Foto
 * aufnimmt, legt es nach images/, lässt das Skript laufen, und es steht
 * hier zur Auswahl. Kein Eintrag von Hand, keine Dateinamen zu merken.
 */

$ordner = __DIR__ . '/../assets/img/exercises';
$dateien = glob($ordner . '/*.jpg') ?: [];

$fotos = [];
foreach ($dateien as $pfad) {
    $fotos[] = basename($pfad);
}

sort($fotos);

json_out(['photos' => $fotos]);
