<?php
declare(strict_types=1);

/**
 * Gemeinsamer Kopf aller API-Endpunkte: JSON-Antworten, saubere Fehler,
 * keine PHP-Warnungen im Antwortkörper.
 */

require_once __DIR__ . '/../lib/config.php';
require_once __DIR__ . '/../lib/auth.php';

// Fehler gehören ins Log, nicht in die JSON-Antwort. Eine PHP-Warnung vor dem
// ersten { macht die Antwort für das Frontend unlesbar.
ini_set('display_errors', '0');
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

set_exception_handler(function (Throwable $e): void {
    error_log('[coach] ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
    http_response_code(500);
    echo json_encode(['error' => 'Serverfehler'], JSON_UNESCAPED_UNICODE);
});

function json_out($data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail(string $message, int $status = 400): void
{
    json_out(['error' => $message], $status);
}

/** Erlaubt nur die angegebene Methode, sonst 405. */
function require_method(string $method): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== $method) {
        header('Allow: ' . $method);
        fail('Methode nicht erlaubt', 405);
    }
}

/** Liest den Request-Body als JSON. */
function request_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}
