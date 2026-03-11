<?php
/**
 * ELBDESK API Configuration
 *
 * Reads API URL and key from .env file in dashboard root.
 * The API falls back to demo mode if not configured.
 */

// Simple .env loader - reads dashboard/.env
$envFile = __DIR__ . '/../.env';
if (file_exists($envFile)) {
    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#') continue;
        if (strpos($line, '=') !== false) {
            [$key, $value] = explode('=', $line, 2);
            $key = trim($key);
            $value = trim($value, " \t\n\r\0\x0B\"'");
            if (!getenv($key)) {
                putenv("$key=$value");
            }
        }
    }
}

define('ELBDESK_API_URL', getenv('ELBDESK_API_URL') ?: '');
define('ELBDESK_API_KEY', getenv('ELBDESK_API_KEY') ?: '');
define('ELBDESK_CACHE_TTL', (int)(getenv('ELBDESK_CACHE_TTL') ?: 300));
define('ELBDESK_CACHE_DIR', __DIR__ . '/cache');
