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
define('LOGS_DIR', DATA_DIR . '/logs');

define('CONFIG_FILE',    DATA_DIR . '/config.json');
define('EXERCISES_FILE', DATA_DIR . '/exercises.json');
define('PLAN_FILE',      DATA_DIR . '/plan.json');

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
            // Pause beim Wechsel zwischen zwei gepaarten Übungen. Kürzer,
            // weil jeder einzelne Muskel trotzdem auf die volle Pause
            // kommt: er ruht, während der Gegenspieler arbeitet.
            'rest_pair_seconds'     => 90,
            'session_lifetime_days' => 30,
        ];
    }

    return $config;
}

/** Ist die App überhaupt eingerichtet, also gibt es ein Passwort? */
function is_configured(): bool
{
    return config()['password_hash'] !== '';
}
