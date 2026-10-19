<?php
declare(strict_types=1);

/**
 * App-Shell und Session-Gate.
 *
 * Wer nicht angemeldet ist, sieht die Anmeldung, sonst die Startseite.
 * Mit "startseite": true in config.json sieht er statt der schlichten
 * Anmeldung die Vorstellung der App samt Anmeldeformular.
 * Der Studio-Modus aus SPEC.md §5.2 kommt in Phase 2 dazu und löst die
 * Übersicht hier unten ab.
 */

require_once __DIR__ . '/lib/auth.php';

$angemeldet   = auth_is_logged_in();
$eingerichtet = is_configured();
$uebungen     = $angemeldet ? (array) json_read(EXERCISES_FILE, []) : [];
$startseite   = !$angemeldet && $eingerichtet && config()['startseite'] === true;

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

/*
 * Texte und Adresse für Suchmaschinen und Vorschaubilder der Startseite.
 * Das Vorschaubild (Open Graph) braucht eine vollständige Adresse; sie wird
 * aus dem Aufruf gebaut, damit im öffentlichen Repo keine Domain fest steht.
 */
$titel        = 'Coach · Die Trainings-App, die auch offline weiterarbeitet';
$beschreibung = 'Coach führt dich durch jede Einheit im Studio, speichert jeden Satz sofort und sagt dir, wann das Gewicht hochgeht.';
$verzeichnis  = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/');
$adresse      = (($_SERVER['HTTPS'] ?? '') !== '' && ($_SERVER['HTTPS'] ?? '') !== 'off' ? 'https' : 'http')
              . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . $verzeichnis . '/';
?>
<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#1b1e24">
<?php if ($startseite): ?>
<meta name="robots" content="index, follow">
<meta name="description" content="<?= h($beschreibung) ?>">
<meta property="og:type" content="website">
<meta property="og:locale" content="de_DE">
<meta property="og:site_name" content="Coach">
<meta property="og:title" content="<?= h($titel) ?>">
<meta property="og:description" content="<?= h($beschreibung) ?>">
<meta property="og:url" content="<?= h($adresse) ?>">
<meta property="og:image" content="<?= h($adresse . 'assets/img/og.png') ?>">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Coach: die Trainings-App, die auch offline weiterarbeitet, mit dem Studio-Bildschirm auf einem Handy">
<meta name="twitter:card" content="summary_large_image">
<?php else: ?>
<meta name="robots" content="noindex, nofollow">
<?php endif; ?>
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Coach">
<title><?= h($startseite ? $titel : 'Coach') ?></title>
<link rel="manifest" href="manifest.json">
<link rel="icon" href="assets/icons/logo.svg" type="image/svg+xml">
<link rel="icon" href="assets/icons/icon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="assets/icons/icon-180.png">
<link rel="stylesheet" href="<?= h(version($startseite ? 'assets/startseite.css' : 'assets/app.css')) ?>">
</head>
<body>

<?php if ($startseite): ?>

    <?php require __DIR__ . '/lib/startseite.php'; ?>

<?php elseif (!$angemeldet): ?>

    <main class="tor">
        <header class="kopf">
            <span class="wortmarke"><img class="wortmarke__zeichen" src="assets/icons/logo.svg" alt="" width="24" height="24">Coach</span>
        </header>

        <div class="tor__mitte">
            <?php if (!$eingerichtet): ?>
                <h1 class="tor__titel">Passwort festlegen</h1>
                <p class="tor__hinweis">
                    Einmalig. Danach ist diese Seite verschwunden.
                </p>

                <form id="einrichtung" novalidate>
                    <label class="mini" for="passwort">Neues Passwort</label>
                    <input class="feld" id="passwort" type="password" name="password"
                           autocomplete="new-password" autofocus required>

                    <label class="mini" for="passwort2">Noch einmal</label>
                    <input class="feld" id="passwort2" type="password" name="password_repeat"
                           autocomplete="new-password" required>

                    <p class="hinweis">Mindestens 8 Zeichen.</p>
                    <p class="fehler" id="fehler" role="alert"></p>
                </form>
            <?php else: ?>
                <h1 class="tor__titel">Anmelden</h1>
                <p class="tor__hinweis">Danach 30 Tage angemeldet.</p>

                <form id="anmeldung" novalidate>
                    <label class="mini" for="passwort">Passwort</label>
                    <input class="feld" id="passwort" type="password" name="password"
                           autocomplete="current-password" autofocus required>
                    <p class="fehler" id="fehler" role="alert"></p>
                </form>
            <?php endif; ?>
        </div>

        <div class="tor__fuss">
            <?php if (!$eingerichtet): ?>
                <button class="knopf" type="submit" form="einrichtung" id="einrichten">
                    Passwort festlegen
                </button>
            <?php else: ?>
                <button class="knopf" type="submit" form="anmeldung" id="anmelden">
                    Anmelden
                </button>
            <?php endif; ?>
        </div>
    </main>

<?php else: ?>

    <header class="kopf">
        <span class="wortmarke"><img class="wortmarke__zeichen" src="assets/icons/logo.svg" alt="" width="24" height="24">Coach</span>
    </header>

    <!-- Sagt, ob Sätze noch im lokalen Puffer liegen. Steht außerhalb von
         #app, damit ein Neuzeichnen der Ansicht die Meldung nicht wegnimmt. -->
    <div class="status" id="status" hidden></div>

    <!-- Ab hier zeichnet assets/app.js gegen die JSON-API. -->
    <main class="inhalt" id="app">
        <p class="leer__text">Wird geladen.</p>
    </main>

    <!-- Großansicht eines Gerätefotos. Liegt außerhalb von #app, damit ein
         Neuzeichnen der Liste das offene Bild nicht wegnimmt. -->
    <div class="lupe" id="lupe" hidden>
        <img class="lupe__bild" id="lupe-bild" src="" alt="">
        <div class="lupe__fuss">
            <span class="plakette" id="lupe-nummer" hidden></span>
            <span class="lupe__name" id="lupe-name"></span>
        </div>
        <!-- Die Ausführung steht hier und nicht mehr als Aufklapper auf der
             Kachel: Wer wissen will, wie die Übung geht, schaut ohnehin auf
             das Bild des Geräts. Beides gehört zusammen. -->
        <div class="lupe__anleitung" id="lupe-anleitung"></div>
    </div>

    <!-- Abmelden steht ganz unten und leise, nicht im Kopf.
         Oben rechts lag es genau da, wo der Daumen beim Halten des Handys
         ohnehin liegt, und ein Fehlgriff kostet im Studio den Zugang: neu
         anmelden geht nur mit Netz, und im Funkloch gibt es keins. Der
         zweite Tipp bestätigt, so wie beim Löschen eines Fotos. -->
    <footer class="fuss">
        <button class="fuss__knopf" type="button" id="abmelden">Abmelden</button>
    </footer>

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
