<?php
/**
 * One-time migration: Create admin account if not exists.
 * DELETE THIS FILE after use!
 */
require_once __DIR__ . '/api/config.php';
require_once __DIR__ . '/api/init_db.php';

$db = get_db();

// Check if daguirre exists
$stmt = $db->prepare("SELECT id FROM users WHERE username = 'daguirre'");
$stmt->execute();
if ($stmt->fetch()) {
    echo json_encode(['message' => 'Admin daguirre already exists']);
    exit;
}

// Create admin
$adminHash = password_hash('Dklf-dfmdf-7df9j', PASSWORD_DEFAULT);
$db->prepare("
    INSERT INTO users (id, username, email, password_hash, display_name, role, created_at)
    VALUES (:id, :username, :email, :hash, :display_name, 'admin', :created_at)
")->execute([
    ':id'           => function_exists('generate_uuid') ? generate_uuid() : bin2hex(random_bytes(16)),
    ':username'     => 'daguirre',
    ':email'        => 'd.aguirre@dgd-direkt.de',
    ':hash'         => $adminHash,
    ':display_name' => 'Daniel L. Aguirre',
    ':created_at'   => date('c'),
]);

// Also run column migration for invite_codes
$cols = $db->query("PRAGMA table_info(invite_codes)")->fetchAll(PDO::FETCH_COLUMN, 1);
if (!in_array('invited_email', $cols)) {
    $db->exec("ALTER TABLE invite_codes ADD COLUMN invited_email TEXT");
}
if (!in_array('invited_name', $cols)) {
    $db->exec("ALTER TABLE invite_codes ADD COLUMN invited_name TEXT");
}

echo json_encode(['message' => 'Admin daguirre created successfully', 'ok' => true]);
