<?php
declare(strict_types=1);

/**
 * App-Shell und Session-Gate.
 *
 * Wer nicht angemeldet ist, sieht die Anmeldung, sonst die Startseite.
 * Der Studio-Modus aus SPEC.md §5.2 kommt in Phase 2 dazu und löst die
 * Übersicht hier unten ab.
 */

require_once __DIR__ . '/lib/auth.php';

$angemeldet   = auth_is_logged_in();
$eingerichtet = is_configured();
$uebungen     = $angemeldet ? (array) json_read(EXERCISES_FILE, []) : [];

/*
 * Der Service Worker legt nur die angemeldete Hülle in den Cache. Ohne
 * diese Auskunft könnte dort die Anmeldeseite landen, und im Funkloch
 * stünde Frank vor einem Formular, das er nicht abschicken kann.
 */
header('X-Angemeldet: ' . ($angemeldet ? '1' : '0'));

/*
 * Die Seite selbst wird nie zwischengespeichert. Sie entscheidet über das
 * Session-Gate und verweist auf die aktuellen Versionen von CSS und JS;
 * eine alte Fassung davon aus dem Browser-Cache hält den ganzen Rest auf
 * altem Stand.
 */
header('Cache-Control: no-store, must-revalidate');
header('Pragma: no-cache');

function h(string $text): string
{
    return htmlspecialchars($text, ENT_QUOTES, 'UTF-8');
}

/**
 * Hängt die Änderungszeit als Version an eine Datei.
 *
 * Ein festes ?v=1 wäre wirkungslos: nach einem Deployment behielte der
 * Browser die alte CSS-Datei, und mit dem Service Worker läge sie
 * zusätzlich im Cache. Über die Dateizeit ändert sich die URL bei jeder
 * echten Änderung und sonst nie.
 */
function version(string $pfad): string
{
    $voll = __DIR__ . '/' . $pfad;
    $zeit = is_file($voll) ? filemtime($voll) : time();
    return $pfad . '?v=' . $zeit;
}
?>
<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#1b1e24">
<meta name="robots" content="noindex, nofollow">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Coach">
<title>Coach</title>
<link rel="manifest" href="manifest.json">
<link rel="apple-touch-icon" href="assets/icons/icon-180.png">
<link rel="stylesheet" href="<?= h(version('assets/app.css')) ?>">
</head>
<body>

<?php if (!$angemeldet): ?>

    <main class="tor">
        <header class="kopf">
            <span class="wortmarke">Coach</span>
        </header>

        <div class="tor__mitte">
            <h1 class="tor__titel">Anmelden</h1>
            <p class="tor__hinweis">Danach 30 Tage angemeldet.</p>

            <?php if (!$eingerichtet): ?>
                <p class="fehler">
                    Noch nicht eingerichtet. Auf dem Server einmal
                    <code>php bin/init-config.php</code> ausführen.
                </p>
            <?php else: ?>
                <form id="anmeldung" novalidate>
                    <label class="mini" for="passwort">Passwort</label>
                    <input class="feld" id="passwort" type="password" name="password"
                           autocomplete="current-password" autofocus required>
                    <p class="fehler" id="fehler" role="alert"></p>
                </form>
            <?php endif; ?>
        </div>

        <?php if ($eingerichtet): ?>
            <div class="tor__fuss">
                <button class="knopf" type="submit" form="anmeldung" id="anmelden">
                    Anmelden
                </button>
            </div>
        <?php endif; ?>
    </main>

<?php else: ?>

    <header class="kopf">
        <span class="wortmarke">Coach</span>
        <button class="kopfknopf" type="button" id="abmelden">Abmelden</button>
    </header>

    <!-- Sagt, ob Sätze noch im lokalen Puffer liegen. Steht außerhalb von
         #app, damit ein Neuzeichnen der Ansicht die Meldung nicht wegnimmt. -->
    <div class="status" id="status" hidden></div>

    <!-- Ab hier zeichnet assets/app.js gegen die JSON-API. -->
    <main class="inhalt" id="app">
        <p class="leer__text">Wird geladen.</p>
    </main>

    <!-- Der Pausen-Timer liegt außerhalb von #app, damit das Sekundenzählen
         nicht die ganze Übungsliste neu zeichnet. -->
    <div class="pause" id="pause" hidden>
        <span class="pause__mini">Pause</span>
        <span class="pause__zeit" id="pause-zeit">0:00</span>
        <button class="pause__weg" type="button" id="pause-weg">Überspringen</button>
    </div>

<?php endif; ?>

<script src="<?= h(version('assets/app.js')) ?>"></script>
<script>
// Der Service Worker braucht einen sicheren Kontext. Auf dem eingebauten
// PHP-Server über http läuft er nicht, das ist im Betrieb egal: All-Inkl
// liefert per HTTPS aus.
if ('serviceWorker' in navigator) {
    addEventListener('load', function () {
        navigator.serviceWorker.register('service-worker.js').catch(function () {
            // Ohne Service Worker funktioniert die App vollständig, sie
            // startet nur nicht ganz so schnell. Kein Grund für eine Meldung.
        });
    });

    /*
     * Löst ein NEUER Service Worker einen alten ab, wird einmal neu
     * geladen, damit man nicht mit dem vorherigen Stand weiterarbeitet.
     *
     * Die Abfrage auf einen bereits vorhandenen Controller ist der Kern:
     * beim allerersten Besuch übernimmt der Service Worker per
     * clients.claim() ebenfalls, und ohne diese Bedingung lüde die Seite
     * mitten im Anmelden neu und nähme das eingetippte Passwort mit.
     */
    if (navigator.serviceWorker.controller) {
        var neugeladen = false;
        navigator.serviceWorker.addEventListener('controllerchange', function () {
            if (!neugeladen) {
                neugeladen = true;
                location.reload();
            }
        });
    }
}
</script>
</body>
</html>
