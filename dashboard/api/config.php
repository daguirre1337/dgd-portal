<?php
/**
 * DGD Dashboard - Database Configuration & Helpers
 * Version: 1.0.0
 *
 * SQLite PDO connection with WAL mode.
 * Session management, CORS headers, auth helpers, JSON response helpers.
 */

// ---------- paths ----------
define('DB_PATH', __DIR__ . '/../data/dashboard.db');
define('DATA_DIR', __DIR__ . '/../data');

// ---------- CORS & content-type ----------
function set_api_headers(): void
{
    header('Content-Type: application/json; charset=utf-8');

    // Allow credentials-based CORS for session cookies
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $allowed_origins = [
        'http://localhost:8000',
        'http://localhost:3000',
        'http://localhost:8083',
        'https://dgd.digital',
    ];

    if (in_array($origin, $allowed_origins, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
    }

    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Access-Control-Allow-Credentials: true');

    // Handle preflight
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

// ---------- session ----------
function init_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    session_set_cookie_params([
        'lifetime' => 86400,       // 24 hours
        'path'     => '/',
        'domain'   => '',
        'secure'   => isset($_SERVER['HTTPS']),
        'httponly'  => true,
        'samesite'  => 'Lax',
    ]);

    session_start();
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

// ---------- Auth helpers ----------
function requireAuth(): void
{
    init_session();
    if (empty($_SESSION['user_id'])) {
        json_error('Authentication required', 401);
    }
}

function requireAdmin(): void
{
    requireAuth();
    if (($_SESSION['role'] ?? '') !== 'admin') {
        json_error('Admin access required', 403);
    }
}

function getCurrentUser(PDO $pdo): ?array
{
    init_session();
    if (empty($_SESSION['user_id'])) {
        return null;
    }

    $stmt = $pdo->prepare("SELECT id, username, email, display_name, role, created_at, last_login FROM users WHERE id = :id");
    $stmt->execute([':id' => $_SESSION['user_id']]);
    return $stmt->fetch() ?: null;
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
