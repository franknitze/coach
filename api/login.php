<?php
declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';

// Einer von zwei Endpunkten ohne Session-Prüfung: hier wird sie erst gesetzt.
require_method('POST');

if (!is_configured()) {
    fail('App ist noch nicht eingerichtet (bin/init-config.php ausführen)', 503);
}

$password = (string) (request_body()['password'] ?? '');

if ($password === '' || !auth_login($password)) {
    fail('Passwort stimmt nicht', 401);
}

json_out(['ok' => true]);
