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
 * unter data/sessions/, sonst wäre man trotz 30-Tage-Cookie ständig raus.
 */

function auth_start(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    $lifetime = max(1, (int) config()['session_lifetime_days']) * 86400;

    $sessionDir = DATA_DIR . '/sessions';
    ensure_dir($sessionDir);
    session_save_path($sessionDir);

    ini_set('session.gc_maxlifetime', (string) $lifetime);
    ini_set('session.use_strict_mode', '1');

    session_set_cookie_params([
        'lifetime' => $lifetime,
        'path'     => '/',
        'secure'   => auth_is_https(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);

    session_name('coach');
    session_start();
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
    auth_start();

    if (!is_configured() || !password_verify($password, config()['password_hash'])) {
        // Bremst stures Durchprobieren aus. Ein Nutzer, ein Login, das reicht.
        usleep(700000);
        return false;
    }

    session_regenerate_id(true);
    $_SESSION['logged_in'] = true;
    $_SESSION['login_at']  = time();

    return true;
}

function auth_logout(): void
{
    auth_start();
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
