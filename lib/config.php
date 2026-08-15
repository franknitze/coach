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
define('DATA_DIR', getenv('COACH_DATA') ?: __DIR__ . '/../data');
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
