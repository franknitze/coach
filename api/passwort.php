<?php
declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';

auth_require();

/**
 * Passwort ändern.
 *
 * Bis hierher ging das nur über die Kommandozeile
 * (bin/init-config.php --force). Wer die App auf gewöhnlichem Webspace
 * betreibt und keinen SSH-Zugang hat, konnte sein Passwort also überhaupt
 * nicht wechseln — und genau das steht in der README als der Normalfall.
 *
 * Das alte Passwort wird trotz geprüfter Session verlangt. Sie hält 30 Tage
 * und liegt auf einem Handy, das man auch mal liegen lässt; ohne die Abfrage
 * genügte ein unbeaufsichtigtes Gerät, um den Zugang zu übernehmen. Das
 * passiert alle paar Jahre einmal, die zwei Sekunden Tippen fallen nicht
 * ins Gewicht.
 *
 * Der Fehlercode ist bewusst 403 und nicht 401. Im angemeldeten Bereich
 * bedeutet 401 "Sitzung abgelaufen", und das Frontend lädt daraufhin die
 * Seite neu — die Meldung "Passwort stimmt nicht" wäre wortlos weg.
 */

require_method('POST');

$eingabe = request_body();
$alt     = (string) ($eingabe['current'] ?? '');
$neu     = (string) ($eingabe['password'] ?? '');

if (!password_verify($alt, (string) config()['password_hash'])) {
    // Genauso gebremst wie beim Anmelden. Wer hier steht, ist zwar
    // angemeldet, aber das macht dies zum bequemsten Ort zum Durchprobieren.
    usleep(700000);
    fail('Das aktuelle Passwort stimmt nicht.', 403);
}

if (mb_strlen($neu) < 8) {
    fail('Das neue Passwort braucht mindestens 8 Zeichen.', 422);
}

if ($neu !== (string) ($eingabe['password_repeat'] ?? '')) {
    fail('Die beiden neuen Eingaben stimmen nicht überein.', 422);
}

/*
 * Unter Sperre und über die ganze Datei, nicht neu geschrieben: Alles
 * andere in config.json muss stehen bleiben, allen voran der api_key.
 * Ginge der verloren, holte das Backup nichts mehr ab.
 */
json_update(CONFIG_FILE, function (array $vorhanden) use ($neu): array {
    $vorhanden['password_hash'] = password_hash($neu, PASSWORD_DEFAULT);
    return $vorhanden;
});

@chmod(CONFIG_FILE, 0600);

/*
 * Neue Session-ID, wie beim Anmelden: kostet nichts und nimmt einer
 * womöglich abgegriffenen ID die Gültigkeit. Danach das Cookie neu setzen,
 * sonst zeigt der Browser noch auf die alte, gelöschte Sitzung und man
 * stünde nach dem Ändern des Passworts vor dem Anmeldeformular.
 *
 * Anmeldungen in anderen Browsern bleiben bestehen, jede hat ihre eigene
 * Datei. Wer sie loswerden will, meldet sich dort ab.
 */
session_regenerate_id(true);
auth_verlaengern(max(1, (int) config()['session_lifetime_days']) * 86400);

json_out(['ok' => true]);
