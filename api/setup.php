<?php
declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';
require_once __DIR__ . '/../lib/standardplan.php';

/**
 * Einmalige Einrichtung: Passwort setzen.
 *
 * Der dritte und letzte Endpunkt ohne Session-Prüfung, und der einzige,
 * der sich selbst abschaltet. Er arbeitet ausschließlich, solange es noch
 * kein Passwort gibt. Sobald eines gesetzt ist, antwortet er mit 409 und
 * ist damit für immer tot.
 *
 * Warum es ihn gibt: ohne ihn ließe sich die App nur über SSH in Betrieb
 * nehmen. Das Passwort tippt so nur Frank selbst ein, über HTTPS, in seine
 * eigene App. Es geht durch keine fremde Hand.
 *
 * Das Zeitfenster ist der Preis: zwischen dem Hochladen und dem Setzen des
 * Passworts könnte jeder, der die Adresse kennt, sich selbst eines setzen.
 * Deshalb gehört die Einrichtung unmittelbar nach dem Deployment erledigt.
 */

require_method('POST');

if (is_configured()) {
    fail('Die App ist bereits eingerichtet.', 409);
}

$eingabe = request_body();
$passwort = (string) ($eingabe['password'] ?? '');

if (mb_strlen($passwort) < 8) {
    fail('Das Passwort braucht mindestens 8 Zeichen.', 422);
}
if ($passwort !== (string) ($eingabe['password_repeat'] ?? '')) {
    fail('Die beiden Eingaben stimmen nicht überein.', 422);
}

ensure_dir(DATA_DIR);
ensure_dir(TRAINING_DIR);

// Der Riegel im Datenverzeichnis, falls er beim Aufspielen verlorenging.
$riegel = DATA_DIR . '/.htaccess';
if (!is_file($riegel)) {
    file_put_contents($riegel, implode("\n", [
        '# Kein Zugriff aus dem Browser. Von api/setup.php angelegt.',
        '<IfModule mod_authz_core.c>',
        '    Require all denied',
        '</IfModule>',
        '<IfModule !mod_authz_core.c>',
        '    Order allow,deny',
        '    Deny from all',
        '</IfModule>',
        '',
    ]));
}

// Noch einmal prüfen, diesmal unter Sperre: zwei gleichzeitige Aufrufe
// dürfen nicht beide ein Passwort setzen.
$geschrieben = false;

json_update(CONFIG_FILE, function (array $vorhanden) use ($passwort, &$geschrieben): array {
    if (!empty($vorhanden['password_hash'])) {
        return $vorhanden;   // jemand war schneller
    }
    $geschrieben = true;
    return [
        'password_hash'         => password_hash($passwort, PASSWORD_DEFAULT),
        'api_key'               => bin2hex(random_bytes(32)),
        'default_weight_step'   => 5,
        'rest_timer_seconds'    => 120,
        'session_lifetime_days' => 30,
    ];
});

if (!$geschrieben) {
    fail('Die App ist bereits eingerichtet.', 409);
}

@chmod(CONFIG_FILE, 0600);

/*
 * Der mitgelieferte Plan, aber nur in eine wirklich leere Installation.
 *
 * Ohne ihn endet die Einrichtung über den Browser in einer Sackgasse: Ohne
 * Trainingstag lässt sich keine Übung anlegen (lib/uebungen.php prüft den
 * Tag gegen den Plan), und Tage anlegen kann die Oberfläche nicht. Wer
 * kein SSH hat, käme da nicht mehr heraus.
 *
 * Vorhandene Dateien bleiben unangetastet. Hierher kommt man ohnehin nur,
 * solange es kein Passwort gibt, aber ein Plan könnte schon von
 * bin/plan-anlegen.php stammen.
 */
if (!is_file(PLAN_FILE)) {
    json_write(PLAN_FILE, standardplan_plan());
}

if (!is_file(EXERCISES_FILE)) {
    json_write(EXERCISES_FILE, standardplan_uebungen());
}

json_out(['ok' => true]);
