<?php
/**
 * DGD Dashboard - Auth Gate
 *
 * Server-side authentication check BEFORE serving any dashboard content.
 * Unauthenticated users see ONLY the login page (login.html).
 * Authenticated users get the full dashboard (index.html).
 *
 * This prevents information leakage of dashboard structure, JS files,
 * and internal navigation to unauthenticated visitors.
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

// Check if user has an active session
if (empty($_SESSION['user_id'])) {
    // Not authenticated -> show login page only
    readfile(__DIR__ . '/login.html');
    exit;
}

// Authenticated -> serve full dashboard
readfile(__DIR__ . '/index.html');
