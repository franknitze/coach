<?php
declare(strict_types=1);

/**
 * Richtet data/ ein: config.json mit Passwort-Hash und API-Key, dazu die
 * leere Übungsbibliothek und den Plan aus SPEC.md §4.
 *
 * Läuft nur auf der Kommandozeile und wird nicht auf den Server geladen.
 *
 *   php bin/init-config.php
 *   php bin/init-config.php --force   (überschreibt eine vorhandene config.json)
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/../lib/config.php';

$force = in_array('--force', $argv, true);

if (is_file(CONFIG_FILE) && !$force) {
    fwrite(STDERR, "config.json gibt es schon. Mit --force überschreiben.\n");
    exit(1);
}

$password = prompt_hidden('Passwort für den Login: ');
if (strlen($password) < 8) {
    fwrite(STDERR, "Mindestens 8 Zeichen.\n");
    exit(1);
}
if ($password !== prompt_hidden('Passwort wiederholen: ')) {
    fwrite(STDERR, "Die beiden Eingaben stimmen nicht überein.\n");
    exit(1);
}

json_write(CONFIG_FILE, [
    'password_hash'         => password_hash($password, PASSWORD_DEFAULT),
    'api_key'               => bin2hex(random_bytes(32)),
    'default_weight_step'   => 5,
    'rest_timer_seconds'    => 120,
    'session_lifetime_days' => 30,
]);
chmod(CONFIG_FILE, 0600);
echo "config.json angelegt.\n";

if (!is_file(EXERCISES_FILE)) {
    // Bleibt leer bis zum Studiobesuch, siehe SPEC.md §11.
    json_write(EXERCISES_FILE, new stdClass());
    echo "exercises.json angelegt (noch leer).\n";
}

if (!is_file(PLAN_FILE)) {
    json_write(PLAN_FILE, [
        'days' => [
            'oberkoerper'  => ['label' => 'Oberkörper'],
            'unterkoerper' => ['label' => 'Unterkörper'],
        ],
        'rotation' => ['oberkoerper', 'unterkoerper'],
        'muscle_priorities' => [
            'brust'    => 'normal',
            'ruecken'  => 'normal',
            'beine'    => 'normal',
            'schulter' => 'normal',
            'bizeps'   => 'normal',
            'trizeps'  => 'normal',
        ],
    ]);
    echo "plan.json angelegt (Grundgerüst aus SPEC.md §4).\n";
}

ensure_dir(LOGS_DIR);
echo "\nFertig. data/ ist eingerichtet.\n";
echo "Der API-Key für den n8n-Backup-Workflow steht in data/config.json.\n";

/** Fragt eine Eingabe ab, ohne sie im Terminal anzuzeigen. */
function prompt_hidden(string $label): string
{
    echo $label;

    // Nur wenn wirklich ein Terminal dranhängt, sonst meckert stty los.
    $silenced = false;
    if (stream_isatty(STDIN) && DIRECTORY_SEPARATOR !== '\\') {
        shell_exec('stty -echo 2>/dev/null');
        $silenced = true;
    }

    $input = fgets(STDIN);

    if ($silenced) {
        shell_exec('stty echo');
        echo "\n";
    }

    return trim((string) $input);
}
