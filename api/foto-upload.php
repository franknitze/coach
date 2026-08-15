<?php
declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';

auth_require();
require_method('POST');

/**
 * Nimmt ein Foto entgegen und legt es zu den Gerätefotos.
 *
 * Gedacht fürs Handy: das Formular öffnet direkt die Kamera, das Bild
 * landet hier, und danach lässt es sich in der Bildauswahl antippen.
 * Kein Dateiname zu merken, kein Skript, kein SFTP.
 *
 * Die Datei wird beim Speichern neu gezeichnet, nicht durchgereicht.
 * Das hat zwei Gründe, die beide nichts mit Sparsamkeit zu tun haben:
 *
 * 1. Sicherheit. Eine hochgeladene Datei ist erst dann sicher ein Bild,
 *    wenn sie sich als Bild einlesen und neu schreiben lässt. Alles, was
 *    sonst noch drinstecken könnte, überlebt das nicht.
 * 2. Die GPS-Koordinaten aus der Handykamera fallen dabei weg. Die
 *    Bilder liegen auf dem Server ohne Anmeldung.
 *
 * Die Kantenlänge bleibt großzügig: die Bilder sollen sich in der
 * Großansicht lohnen. Platz ist genug da.
 */

const MAX_KANTE = 1600;

if (!isset($_FILES['foto']) || !is_array($_FILES['foto'])) {
    fail('Es kam keine Datei an.', 422);
}

$datei = $_FILES['foto'];

if (($datei['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    $meldungen = [
        UPLOAD_ERR_INI_SIZE   => 'Die Datei ist größer als der Server erlaubt.',
        UPLOAD_ERR_FORM_SIZE  => 'Die Datei ist zu groß.',
        UPLOAD_ERR_PARTIAL    => 'Die Übertragung wurde abgebrochen.',
        UPLOAD_ERR_NO_FILE    => 'Es wurde keine Datei gewählt.',
        UPLOAD_ERR_NO_TMP_DIR => 'Auf dem Server fehlt ein Zwischenspeicher.',
        UPLOAD_ERR_CANT_WRITE => 'Der Server konnte nicht schreiben.',
    ];
    fail($meldungen[$datei['error']] ?? 'Der Upload ist fehlgeschlagen.', 422);
}

if (!is_uploaded_file($datei['tmp_name'])) {
    fail('Die Datei stammt nicht aus einem Upload.', 422);
}

// Nicht dem Dateinamen glauben, sondern dem Inhalt.
$masse = @getimagesize($datei['tmp_name']);
if ($masse === false) {
    fail('Das ist kein lesbares Bild.', 422);
}

$erlaubt = [
    IMAGETYPE_JPEG => 'imagecreatefromjpeg',
    IMAGETYPE_PNG  => 'imagecreatefrompng',
    IMAGETYPE_WEBP => 'imagecreatefromwebp',
];

$typ = $masse[2];
if (!isset($erlaubt[$typ]) || !function_exists($erlaubt[$typ])) {
    fail('Nur JPEG, PNG und WebP.', 422);
}

$bild = @$erlaubt[$typ]($datei['tmp_name']);
if ($bild === false) {
    fail('Das Bild ließ sich nicht öffnen.', 422);
}

// Aufrechte Handyfotos kommen gedreht an, die Lage steht nur im EXIF.
// Ohne diese Korrektur läge das Gerät auf der Kachel auf der Seite.
if ($typ === IMAGETYPE_JPEG && function_exists('exif_read_data')) {
    $exif = @exif_read_data($datei['tmp_name']);
    $drehung = ['3' => 180, '6' => -90, '8' => 90][$exif['Orientation'] ?? ''] ?? 0;
    if ($drehung !== 0) {
        $gedreht = imagerotate($bild, $drehung, 0);
        if ($gedreht !== false) {
            imagedestroy($bild);
            $bild = $gedreht;
        }
    }
}

$breite = imagesx($bild);
$hoehe  = imagesy($bild);
$faktor = min(1.0, MAX_KANTE / max($breite, $hoehe));

if ($faktor < 1.0) {
    $neu = imagescale($bild, (int) round($breite * $faktor), (int) round($hoehe * $faktor));
    if ($neu !== false) {
        imagedestroy($bild);
        $bild = $neu;
    }
}

$ordner = __DIR__ . '/../assets/img/exercises';
ensure_dir($ordner);

// Eigener Name statt des vom Client geschickten: darin kann alles stehen,
// von Pfadangaben bis zu Zeichen, die der Webserver anders auslegt.
$name = 'foto-' . (new DateTimeImmutable('now'))->format('Ymd-His')
      . '-' . bin2hex(random_bytes(3)) . '.jpg';

$breiteFertig = imagesx($bild);
$hoeheFertig  = imagesy($bild);

if (!imagejpeg($bild, $ordner . '/' . $name, 82)) {
    imagedestroy($bild);
    fail('Das Bild ließ sich nicht speichern.', 500);
}

imagedestroy($bild);

json_out([
    'photo'  => $name,
    'width'  => $breiteFertig,
    'height' => $hoeheFertig,
]);
