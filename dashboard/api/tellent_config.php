<?php
/**
 * TellentHR / KiwiHR API Configuration
 *
 * Reads API key from .env file in dashboard root.
 * The API will report "not configured" if key is missing.
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

define('KIWIHR_API_KEY', getenv('KIWIHR_API_KEY') ?: '');
define('KIWIHR_ENDPOINT', getenv('KIWIHR_ENDPOINT') ?: 'https://api.kiwihr.com/api/graphql/public');
define('TELLENT_CACHE_TTL', (int)(getenv('TELLENT_CACHE_TTL') ?: 300));
define('TELLENT_CACHE_DIR', __DIR__ . '/cache');
