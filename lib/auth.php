<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

/**
 * Login für genau einen Nutzer.
 *
 * Die Session muss lange halten, damit im Studio kein tägliches Einloggen
 * nötig ist. Auf Shared Hosting liegt session.save_path oft in einem Ordner,
 * den alle Kunden teilen, und deren Aufräumlauf löscht fremde Sessions nach
 * kurzer Zeit mit weg. Deshalb bekommt die App ihren eigenen Session-Ordner
 * (SESSION_DIR, neben index.php), sonst wäre man trotz 30-Tage-Cookie
 * ständig raus.
 *
 * Die 30 Tage zählen ab der letzten Benutzung, nicht ab dem Anmelden. Wer
 * regelmäßig trainiert, wird nie wieder nach dem Passwort gefragt; wer die
 * App einen Monat nicht öffnet, schon. Dafür sorgt auth_verlaengern().
 */

const SESSION_NAME = 'coach';

function auth_start(bool $erzwingen = false): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    /*
     * Ohne Cookie kann niemand angemeldet sein — dann gar nicht erst eine
     * Sitzung anfangen.
     *
     * Sonst legt jeder Aufruf eine leere Datei an, auch jeder Aufruf durch
     * ein Prüfskript oder einen Suchmaschinen-Roboter. So sind im Betrieb
     * über hundert Dateien mit null Byte aufgelaufen, von denen genau eine
     * eine echte Anmeldung war.
     *
     * $erzwingen brauchen Anmelden und Abmelden: Dort muss die Sitzung
     * entstehen beziehungsweise vernichtet werden.
     */
    $lifetime = max(1, (int) config()['session_lifetime_days']) * 86400;

    // Vor der Cookie-Abfrage: Aufräumen braucht keine Sitzung, und hinter
    // der Abfrage liefe es nur, wenn ohnehin jemand angemeldet vorbeikommt.
    auth_aufraeumen($lifetime);

    if (!$erzwingen && !isset($_COOKIE[SESSION_NAME])) {
        return;
    }

    ensure_dir(SESSION_DIR);
    session_save_path(SESSION_DIR);

    ini_set('session.gc_maxlifetime', (string) $lifetime);
    ini_set('session.use_strict_mode', '1');

    session_set_cookie_params([
        'lifetime' => $lifetime,
        'path'     => '/',
        'secure'   => auth_is_https(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);

    session_name(SESSION_NAME);
    session_start();

    auth_verlaengern($lifetime);
}

/**
 * Das Zeitfenster bei jeder Benutzung neu aufziehen.
 *
 * Zwei Dinge sind nötig, und keins davon passiert von allein:
 *
 * 1. Das Cookie. PHP schickt es nur mit, wenn die Session neu entsteht.
 *    Ohne Erneuerung lief es 30 Tage nach dem Anmelden ab, egal wie oft
 *    man die App benutzt hatte.
 * 2. Ein Schreibvorgang. Der Aufräumlauf richtet sich nach der Änderungs-
 *    zeit der Session-Datei, und session.lazy_write schreibt nur, wenn
 *    sich der Inhalt geändert hat. Bei reinem Lesen bliebe die Datei also
 *    stehen und altert weg, obwohl gerade jemand trainiert. Der Zeitstempel
 *    darin ändert sich bei jedem Aufruf und erzwingt das Schreiben.
 */
/**
 * Abgelaufene Sitzungsdateien entfernen, höchstens einmal am Tag.
 *
 * PHPs eigener Aufräumlauf würde das auch tun, aber erst nach 30 Tagen und
 * nur mit einer Wahrscheinlichkeit von 1:100. Das reicht nicht, um einen
 * Ordner sauber zu halten, in den man hineinsieht.
 *
 * Die Marke verhindert, dass bei jedem Aufruf der ganze Ordner gelesen wird.
 * Sie heißt nicht sess_*, wird also nicht selbst weggeräumt.
 */
function auth_aufraeumen(int $lifetime): void
{
    if (!is_dir(SESSION_DIR)) {
        return;
    }

    $marke = SESSION_DIR . '/.aufgeraeumt';

    if (is_file($marke) && filemtime($marke) > time() - 86400) {
        return;
    }

    @touch($marke);

    $abgelaufen = time() - $lifetime;
    // Leere Dateien tragen nichts und dürfen früher weg. Nicht sofort: Beim
    // Schreiben ist eine Datei kurz leer, und die wollen wir nicht erwischen.
    $leerUndAlt = time() - 3600;

    foreach (glob(SESSION_DIR . '/sess_*') ?: [] as $datei) {
        $zeit = @filemtime($datei);

        if ($zeit < $abgelaufen || (@filesize($datei) === 0 && $zeit < $leerUndAlt)) {
            @unlink($datei);
        }
    }
}

function auth_verlaengern(int $lifetime): void
{
    if (($_SESSION['logged_in'] ?? false) !== true) {
        return;
    }

    $_SESSION['zuletzt'] = time();

    if (headers_sent()) {
        return;
    }

    setcookie(session_name(), session_id(), [
        'expires'  => time() + $lifetime,
        'path'     => '/',
        'secure'   => auth_is_https(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

function auth_is_https(): bool
{
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
}

function auth_is_logged_in(): bool
{
    auth_start();
    return ($_SESSION['logged_in'] ?? false) === true;
}

/** Prüft das Passwort und meldet an. Bei Falscheingabe bewusst langsam. */
function auth_login(string $password): bool
{
    auth_start(true);

    if (!is_configured() || !password_verify($password, config()['password_hash'])) {
        // Bremst stures Durchprobieren aus. Ein Nutzer, ein Login, das reicht.
        usleep(700000);
        return false;
    }

    session_regenerate_id(true);
    $_SESSION['logged_in'] = true;
    $_SESSION['login_at']  = time();

    // Die neue Session-ID braucht ihr Cookie mit voller Laufzeit.
    auth_verlaengern(max(1, (int) config()['session_lifetime_days']) * 86400);

    return true;
}

function auth_logout(): void
{
    auth_start(true);
    $_SESSION = [];

    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', [
            'expires'  => time() - 42000,
            'path'     => $p['path'],
            'secure'   => $p['secure'],
            'httponly' => $p['httponly'],
            'samesite' => $p['samesite'] ?? 'Lax',
        ]);
    }

    session_destroy();
}

/**
 * Session-Gate für die API. Jeder Endpunkt ruft das auf, mit genau zwei
 * Ausnahmen: login.php setzt die Session erst, und export.php prüft
 * stattdessen den API-Key, weil n8n sich nicht einloggen kann.
 */
function auth_require(): void
{
    if (!auth_is_logged_in()) {
        http_response_code(401);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['error' => 'Nicht angemeldet'], JSON_UNESCAPED_UNICODE);
        exit;
    }
}
