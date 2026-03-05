<?php
error_reporting(E_ALL);
ini_set('display_errors', '1');
header('Content-Type: text/plain');

echo "PHP Version: " . phpversion() . "\n";
echo "Extensions: " . implode(', ', get_loaded_extensions()) . "\n";
echo "SQLite3: " . (extension_loaded('pdo_sqlite') ? 'YES' : 'NO') . "\n";

echo "\n--- Testing config.php ---\n";
try {
    require_once __DIR__ . '/config.php';
    echo "config.php loaded OK\n";
} catch (Throwable $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}

echo "\n--- Testing DB ---\n";
try {
    $db = get_db();
    echo "DB connected OK\n";
    $tables = $db->query("SELECT name FROM sqlite_master WHERE type='table'")->fetchAll(PDO::FETCH_COLUMN);
    echo "Tables: " . implode(', ', $tables) . "\n";
} catch (Throwable $e) {
    echo "DB ERROR: " . $e->getMessage() . "\n";
}
