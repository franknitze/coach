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

function h(string $text): string
{
    return htmlspecialchars($text, ENT_QUOTES, 'UTF-8');
}
?>
<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#1b1e24">
<meta name="robots" content="noindex, nofollow">
<title>Coach</title>
<link rel="stylesheet" href="assets/app.css?v=1">
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

<script src="assets/app.js?v=1"></script>
</body>
</html>
