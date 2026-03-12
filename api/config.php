<?php
/**
 * DGD Portal - Database Configuration & Helpers
 * Version: 2.0.0 (Plesk Auto-Deploy)
 *
 * SQLite PDO connection with WAL mode.
 * JSON response helpers and UUID generation.
 */

// ---------- paths ----------
define('DB_PATH', __DIR__ . '/../data/dgd_portal.db');
define('DATA_DIR', __DIR__ . '/../data');

// ---------- CORS & content-type ----------
function set_api_headers(): void
{
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');

    // Handle preflight
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

// ---------- database ----------
function get_db(): PDO
{
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }

    // Ensure data directory exists
    if (!is_dir(DATA_DIR)) {
        mkdir(DATA_DIR, 0755, true);
    }

    $pdo = new PDO('sqlite:' . DB_PATH, null, null, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);

    // WAL mode for better concurrent reads
    $pdo->exec('PRAGMA journal_mode=WAL');
    $pdo->exec('PRAGMA foreign_keys=ON');

    return $pdo;
}

// ---------- JSON responses ----------
function json_response($data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    exit;
}

function json_error(string $message, int $status = 400, array $extra = []): void
{
    http_response_code($status);
    $body = array_merge(['error' => true, 'message' => $message], $extra);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function json_success(string $message, array $extra = []): void
{
    $body = array_merge(['success' => true, 'message' => $message], $extra);
    json_response($body);
}

// ---------- UUID v4 ----------
function generate_uuid(): string
{
    return sprintf(
        '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        random_int(0, 0xffff), random_int(0, 0xffff),
        random_int(0, 0xffff),
        random_int(0, 0x0fff) | 0x4000,           // version 4
        random_int(0, 0x3fff) | 0x8000,            // variant 1
        random_int(0, 0xffff), random_int(0, 0xffff), random_int(0, 0xffff)
    );
}

// ---------- Haversine ----------
function haversine(float $lat1, float $lng1, float $lat2, float $lng2): float
{
    $R    = 6371; // Earth radius in km
    $dLat = deg2rad($lat2 - $lat1);
    $dLng = deg2rad($lng2 - $lng1);

    $a = sin($dLat / 2) * sin($dLat / 2) +
         cos(deg2rad($lat1)) * cos(deg2rad($lat2)) *
         sin($dLng / 2) * sin($dLng / 2);

    $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

    return round($R * $c, 1);
}

// ---------- Input helpers ----------
function get_json_body(): array
{
    $raw = file_get_contents('php://input');
    if (empty($raw)) {
        return [];
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        json_error('Invalid JSON body', 400);
    }
    return $decoded;
}

function now_iso(): string
{
    return gmdate('Y-m-d\TH:i:s\Z');
}
