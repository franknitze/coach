<?php
declare(strict_types=1);

require_once __DIR__ . '/storage.php';

/*
 * Feste Zeitzone, unabhängig davon, wie der Server eingestellt ist.
 * Ohne sie entscheidet die Serverzeit darüber, welcher Kalendertag gilt,
 * und ein Training am späten Abend landet unter dem Folgetag.
 */
date_default_timezone_set('Europe/Berlin');

/**
 * Der einzige Ort, an dem der Pfad zu data/ steht.
 *
 * Auf dem Server soll data/ möglichst eine Ebene über dem Web-Root liegen
 * (SPEC.md §8). Ob das bei diesem All-Inkl-Paket geht, ist noch nicht geprüft.
 * Wenn ja, ändert sich genau diese eine Zeile, sonst nichts im Code.
 *
 * COACH_DATA aus der Umgebung sticht den Standardpfad. Gedacht ist das für
 * die Tests: die schreiben und löschen Logdateien und dürfen dabei niemals
 * an die echte Trainingshistorie kommen. Im Betrieb bleibt die Variable
 * ungesetzt, dann gilt der Pfad aus der Zeile darunter.
 */
define('DATA_DIR', coach_datenpfad());

/**
 * Wo liegt data/?
 *
 * COACH_DATA sticht den Standardpfad. Gelesen wird sowohl über getenv()
 * als auch aus $_SERVER: unter Apache kommt die Variable per SetEnv aus
 * der .htaccess, und je nach PHP-Anbindung (mod_php, FastCGI, FPM) landet
 * sie mal im einen, mal im anderen. Auf beides zu schauen kostet nichts
 * und erspart die Suche, warum die App plötzlich ein leeres data/ sieht.
 */
function coach_datenpfad(): string
{
    $ausUmgebung = getenv('COACH_DATA');
    if (is_string($ausUmgebung) && $ausUmgebung !== '') {
        return $ausUmgebung;
    }
    if (!empty($_SERVER['COACH_DATA'])) {
        return (string) $_SERVER['COACH_DATA'];
    }
    return __DIR__ . '/../data';
}
define('TRAINING_DIR', DATA_DIR . '/training');

/*
 * Der Ordner hieß bis zum 22.08.2026 logs/. Das war der falsche Name: Unter
 * "logs" erwartet man Systemmeldungen und Fehlersuche, dort liegen aber die
 * Trainingseinheiten.
 *
 * Die Umbenennung passiert von selbst, damit eine bestehende Installation
 * nach dem Update nicht ohne Historie dasteht. rename() ist ein einziger
 * Schritt im Dateisystem; es gibt keinen Moment, in dem die Daten halb hier
 * und halb dort liegen. Danach greift die Bedingung nie wieder.
 */
if (!is_dir(TRAINING_DIR) && is_dir(DATA_DIR . '/logs')) {
    @rename(DATA_DIR . '/logs', TRAINING_DIR);
}


define('CONFIG_FILE',    DATA_DIR . '/config.json');
define('EXERCISES_FILE', DATA_DIR . '/exercises.json');
define('PLAN_FILE',      DATA_DIR . '/plan.json');
define('GEWICHT_FILE',   DATA_DIR . '/gewicht.json');

/*
 * Die Sitzungsdateien von PHP. Sie gehören nicht nach data/ — dort liegen
 * Trainingsdaten, hier liegt Betrieb: eine Datei je angemeldetem Browser,
 * Inhalt "angemeldet ja, seit wann". Deshalb ein eigener Ordner neben
 * index.php.
 *
 * Warum überhaupt ein eigener und nicht der des Servers: Dessen Vorgabe ist,
 * Sitzungen nach 24 Minuten wegzuräumen. Unsere 30 Tage gelten nur für
 * unseren eigenen Prozess; im gemeinsamen Systemordner räumt irgendwann ein
 * fremder mit seiner eigenen Einstellung auf.
 *
 * COACH_SESSIONS sticht den Pfad, so wie COACH_DATA den der Daten. Die Tests
 * brauchen das: Sie dürfen keine Dateien im Projektordner hinterlassen.
 */
define('SESSION_DIR', coach_sessionpfad());

function coach_sessionpfad(): string
{
    $aus_umgebung = getenv('COACH_SESSIONS') ?: ($_ENV['COACH_SESSIONS'] ?? '');
    return $aus_umgebung !== '' ? rtrim($aus_umgebung, '/') : __DIR__ . '/../sessions';
}

// Einmalig: die Sitzungen lagen bis zum 22.08.2026 unter data/sessions/.
// Umziehen statt löschen, damit eine laufende Anmeldung erhalten bleibt.
if (!is_dir(SESSION_DIR) && is_dir(DATA_DIR . '/sessions')) {
    @rename(DATA_DIR . '/sessions', SESSION_DIR);
}

/** Globale Einstellungen aus config.json, mit den Vorgaben aus SPEC.md §4. */
function config(): array
{
    static $config = null;

    if ($config === null) {
        $config = json_read(CONFIG_FILE, []);
        if (!is_array($config)) {
            $config = [];
        }
        $config += [
            'password_hash'         => '',
            'api_key'               => '',
            'default_weight_step'   => 5,
            'rest_timer_seconds'    => 120,
            'session_lifetime_days' => 30,
            // Startseite mit Vorstellung der App statt der schlichten
            // Anmeldung (lib/startseite.php). Aus, damit eine Installation
            // aus dem Repo keine Werbeseite für Cato Services zeigt.
            'startseite'            => false,
        ];
    }

    return $config;
}

/** Ist die App überhaupt eingerichtet, also gibt es ein Passwort? */
function is_configured(): bool
{
    return config()['password_hash'] !== '';
}
