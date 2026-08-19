<?php
declare(strict_types=1);

/**
 * Lesen und Schreiben der JSON-Dateien.
 *
 * Es gibt keine Datenbank, jede Schreiboperation liest also die ganze Datei,
 * ändert sie und schreibt sie zurück. Damit ein abgebrochener Request keine
 * halbe Datei hinterlässt, wird immer in eine temporäre Datei geschrieben und
 * danach umbenannt. Wer Daten verändert, nimmt json_update() und nicht
 * json_read() plus json_write(), sonst fehlt die Sperre.
 */

/** Liest eine JSON-Datei. Fehlt sie oder ist sie leer, kommt $default zurück. */
function json_read(string $path, $default = null)
{
    if (!is_file($path)) {
        return $default;
    }
    $raw = file_get_contents($path);
    if ($raw === false || trim($raw) === '') {
        return $default;
    }
    $data = json_decode($raw, true);
    if ($data === null && json_last_error() !== JSON_ERROR_NONE) {
        throw new RuntimeException(
            'Kaputte JSON-Datei ' . basename($path) . ': ' . json_last_error_msg()
        );
    }
    return $data;
}

/**
 * Schreibt Daten als JSON.
 *
 * Erst in eine temporäre Datei im selben Ordner, dann rename(). Auf demselben
 * Dateisystem ist rename() atomar: es liegt entweder die alte oder die neue
 * Datei da, nie ein abgeschnittener Rest.
 */
function json_write(string $path, $data): void
{
    ensure_dir(dirname($path));

    /*
     * serialize_precision entscheidet, wie Kommazahlen in JSON landen. Auf
     * der Kommandozeile steht sie auf -1, also auf der kürzesten Form, die
     * sich verlustfrei zurücklesen lässt: aus 96,8 wird "96.8". Im
     * Webserver von All-Inkl steht sie anders, und dort schrieb dieselbe
     * Zahl als "96.7999999999999971578290569595992565155029296875" in die
     * Datei.
     *
     * Gelesen wird daraus wieder derselbe Wert, kaputt ist also nichts.
     * Aber die Datei ist nicht mehr zu lesen, das n8n-Backup trägt es mit,
     * und beim Vergleich zweier Stände sieht jede Zahl nach einem
     * Unterschied aus. Deshalb hier festgelegt statt der Umgebung
     * überlassen — lokal wäre es nie aufgefallen.
     */
    ini_set('serialize_precision', '-1');

    $json = json_encode(
        $data,
        JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
    );
    if ($json === false) {
        throw new RuntimeException('Daten lassen sich nicht als JSON kodieren: ' . json_last_error_msg());
    }

    $tmp = $path . '.' . bin2hex(random_bytes(6)) . '.tmp';
    if (file_put_contents($tmp, $json . "\n") === false) {
        throw new RuntimeException('Schreiben fehlgeschlagen: ' . basename($tmp));
    }
    if (!rename($tmp, $path)) {
        @unlink($tmp);
        throw new RuntimeException('Umbenennen fehlgeschlagen: ' . basename($path));
    }
}

/**
 * Liest, ändert und schreibt eine Datei unter exklusiver Sperre.
 *
 * $modify bekommt den aktuellen Inhalt und gibt den neuen zurück. Die Sperre
 * verhindert, dass ein Doppel-Tap auf einen Bestätigungs-Button oder ein
 * Service-Worker-Retry zwei Schreibvorgänge ineinander schiebt.
 */
function json_update(string $path, callable $modify, $default = [])
{
    ensure_dir(dirname($path));

    $lockPath = $path . '.lock';
    $lock = fopen($lockPath, 'c');
    if ($lock === false) {
        throw new RuntimeException('Sperrdatei lässt sich nicht öffnen: ' . basename($lockPath));
    }

    try {
        if (!flock($lock, LOCK_EX)) {
            throw new RuntimeException('Datei ist gesperrt: ' . basename($path));
        }
        $data = json_read($path, $default);
        $new = $modify($data);
        json_write($path, $new);
        return $new;
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}

function ensure_dir(string $dir): void
{
    if (is_dir($dir)) {
        return;
    }
    if (!mkdir($dir, 0755, true) && !is_dir($dir)) {
        throw new RuntimeException('Ordner lässt sich nicht anlegen: ' . $dir);
    }
}
