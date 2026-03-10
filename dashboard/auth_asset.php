<?php
/**
 * Auth-gated asset serving.
 * JS and CSS files are only served to authenticated users.
 * Prevents information leakage of dashboard structure and API endpoints.
 */

session_set_cookie_params([
    'lifetime' => 86400,
    'path'     => '/',
    'domain'   => '',
    'secure'   => isset($_SERVER['HTTPS']),
    'httponly'  => true,
    'samesite'  => 'Lax',
]);
session_start();

// Not authenticated -> 403
if (empty($_SESSION['user_id'])) {
    http_response_code(403);
    header('Content-Type: text/plain');
    echo 'Authentication required';
    exit;
}

// Validate requested file
$file = $_GET['file'] ?? '';

// Sanitize: only allow js/ and css/ subdirectories, only .js and .css extensions
if (!preg_match('#^(js|css)(/[a-zA-Z0-9_\-]+)+\.(js|css)$#', $file)) {
    http_response_code(400);
    echo 'Invalid file request';
    exit;
}

$filepath = __DIR__ . '/' . $file;

if (!file_exists($filepath) || !is_file($filepath)) {
    http_response_code(404);
    echo 'File not found';
    exit;
}

// Serve with correct content type and caching
$ext = pathinfo($filepath, PATHINFO_EXTENSION);
$content_types = [
    'js'  => 'application/javascript; charset=utf-8',
    'css' => 'text/css; charset=utf-8',
];

header('Content-Type: ' . ($content_types[$ext] ?? 'application/octet-stream'));
header('Cache-Control: private, max-age=3600');
header('X-Content-Type-Options: nosniff');

readfile($filepath);
