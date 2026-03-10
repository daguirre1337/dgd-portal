<?php
/**
 * PHP Built-in Server Router
 *
 * Replaces .htaccess rewrite rules for local development.
 * Usage: php -S localhost:8083 router.php
 */

$uri = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));

// Block access to data/ and .db files
if (preg_match('#^/data/#', $uri) || preg_match('#\.db$#', $uri)) {
    http_response_code(403);
    echo '403 Forbidden';
    return true;
}

// TellentHR API proxy
if (preg_match('#^/api/tellent\.php$#', $uri) || preg_match('#^/api/tellent$#', $uri)) {
    // Pass query string through
    $_SERVER['REQUEST_URI'] = $_SERVER['REQUEST_URI'];
    require __DIR__ . '/api/tellent.php';
    return true;
}

// API routing -> api/index.php
if (preg_match('#^/api/#', $uri)) {
    require __DIR__ . '/api/index.php';
    return true;
}

// Serve static files if they exist
$filePath = __DIR__ . $uri;
if ($uri !== '/' && file_exists($filePath) && is_file($filePath)) {
    return false; // Let PHP's built-in server handle it
}

// Serve showcase builder assets from parent portal directory
if (preg_match('#^/(js|css)/showcase-#', $uri)) {
    $parentFile = dirname(__DIR__) . $uri;
    if (file_exists($parentFile) && is_file($parentFile)) {
        $ext = pathinfo($parentFile, PATHINFO_EXTENSION);
        $mimeTypes = ['js' => 'application/javascript', 'css' => 'text/css'];
        header('Content-Type: ' . ($mimeTypes[$ext] ?? 'application/octet-stream'));
        readfile($parentFile);
        return true;
    }
}

// Default: serve index.html (SPA fallback)
if ($uri === '/' || !file_exists($filePath)) {
    require __DIR__ . '/index.html';
    return true;
}

return false;
