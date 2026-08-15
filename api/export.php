<?php
declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';
require_once __DIR__ . '/../lib/logs.php';

/**
 * Schlüsselgeschützter Export für das n8n-Backup (SPEC.md §9).
 *
 * Der zweite von zwei Endpunkten ohne Session-Prüfung. n8n kann sich nicht
 * einloggen, deshalb der API-Key. Kein Export-Knopf in der Oberfläche, das
 * Backup läuft ohne Zutun.
 *
 * Zwei Abweichungen von §9, beide bewusst:
 *
 * 1. Der Schlüssel darf auch als Header X-API-Key kommen. §9 nennt nur
 *    ?key=..., und das funktioniert weiter. Aber Query-Strings landen im
 *    Zugriffsprotokoll des Webservers, und bei All-Inkl liest die die
 *    Statistik mit. Ein Header steht dort nicht drin. n8n sollte den
 *    Header nehmen.
 *
 * 2. password_hash und api_key sind NICHT im Export. Ein Backup, das
 *    stündlich auf einen Zweitserver wandert und durch n8n-Protokolle
 *    läuft, soll keine Geheimnisse tragen. Verloren geht dabei nichts,
 *    was sich nicht neu setzen ließe: bin/init-config.php erzeugt beides
 *    in zwei Minuten neu. Die Trainingsdaten sind das, was unersetzlich
 *    ist, und die sind vollständig drin.
 */

require_method('GET');

$erwartet = (string) config()['api_key'];

if ($erwartet === '') {
    fail('Export ist nicht eingerichtet (bin/init-config.php ausführen).', 503);
}

$geliefert = (string) ($_SERVER['HTTP_X_API_KEY'] ?? $_GET['key'] ?? '');

// hash_equals vergleicht in konstanter Zeit. Ein normaler Vergleich bricht
// beim ersten falschen Zeichen ab und verrät über die Antwortzeit, wie weit
// ein Rateversuch gekommen ist.
if ($geliefert === '' || !hash_equals($erwartet, $geliefert)) {
    usleep(500000);
    fail('Schlüssel stimmt nicht.', 401);
}

$einstellungen = config();
unset($einstellungen['password_hash'], $einstellungen['api_key']);

$logs = [];
foreach (logs_monate() as $monat) {
    $logs[$monat] = json_read(LOGS_DIR . '/' . $monat . '.json', []);
}

$einheiten = 0;
foreach ($logs as $sessions) {
    $einheiten += count((array) $sessions);
}

json_out([
    'exported_at' => (new DateTimeImmutable('now'))->format(DateTimeInterface::ATOM),
    'note'        => 'Ohne password_hash und api_key. Beide lassen sich mit '
                   . 'bin/init-config.php neu setzen; die Trainingsdaten nicht.',
    'settings'    => $einstellungen,
    'exercises'   => json_read(EXERCISES_FILE, new stdClass()),
    'plan'        => json_read(PLAN_FILE, new stdClass()),
    'logs'        => $logs,
    'summary'     => [
        'months'    => count($logs),
        'sessions'  => $einheiten,
        'exercises' => count((array) json_read(EXERCISES_FILE, [])),
    ],
]);
