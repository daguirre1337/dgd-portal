<?php
/**
 * DGD Dashboard - Files API Handlers
 *
 * Endpoints:
 *   GET    /api/files              - List files (search, sort)
 *   POST   /api/files              - Upload file (multipart/form-data)
 *   GET    /api/files/{id}         - Get file metadata
 *   GET    /api/files/{id}/download - Download file content
 *   DELETE /api/files/{id}         - Delete file + metadata
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../crud_helpers.php';


// ============================================================
//  TABLE SETUP
// ============================================================

function files_ensure_tables(): void
{
    $db = get_db();

    $db->exec("
        CREATE TABLE IF NOT EXISTS files (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            original_name TEXT NOT NULL,
            size INTEGER NOT NULL,
            mime_type TEXT NOT NULL,
            extension TEXT NOT NULL DEFAULT '',
            storage_path TEXT NOT NULL,
            uploaded_by TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (uploaded_by) REFERENCES users(id)
        )
    ");

    $db->exec("CREATE INDEX IF NOT EXISTS idx_files_name    ON files(name)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_files_created ON files(created_at)");
}


// ============================================================
//  HANDLERS
// ============================================================

/**
 * GET /api/files
 * Query params: ?q=search&sort=name|size|date&dir=asc|desc
 */
function handle_list_files(): void
{
    requireAuth();
    files_ensure_tables();
    $db = get_db();

    $where  = [];
    $params = [];

    // Search by name
    if (!empty($_GET['q'])) {
        $where[]         = 'f.name LIKE :q';
        $params[':q']    = '%' . $_GET['q'] . '%';
    }

    $whereClause = count($where) > 0 ? 'WHERE ' . implode(' AND ', $where) : '';

    // Sort
    $sortMap = [
        'name' => 'f.name',
        'size' => 'f.size',
        'date' => 'f.created_at',
    ];
    $sortCol = $sortMap[$_GET['sort'] ?? ''] ?? 'f.created_at';
    $sortDir = strtoupper($_GET['dir'] ?? 'DESC');
    if (!in_array($sortDir, ['ASC', 'DESC'], true)) {
        $sortDir = 'DESC';
    }

    $stmt = $db->prepare("
        SELECT f.*, u.display_name as uploaded_by_name
        FROM files f
        LEFT JOIN users u ON f.uploaded_by = u.id
        {$whereClause}
        ORDER BY {$sortCol} {$sortDir}
    ");
    $stmt->execute($params);
    $files = $stmt->fetchAll();

    foreach ($files as &$file) {
        $file['size'] = (int) $file['size'];
    }

    // Total size
    $sizeStmt = $db->prepare("SELECT COALESCE(SUM(f.size), 0) FROM files f {$whereClause}");
    $sizeStmt->execute($params);
    $totalSize = (int) $sizeStmt->fetchColumn();

    json_response([
        'files'      => $files,
        'total'      => count($files),
        'total_size' => $totalSize,
    ]);
}

/**
 * POST /api/files
 * Multipart form-data with field 'file'.
 * Max 20MB.
 */
function handle_upload_file(): void
{
    requireAuth();
    files_ensure_tables();

    // Validate file presence
    if (empty($_FILES['file']) || $_FILES['file']['error'] === UPLOAD_ERR_NO_FILE) {
        json_error('No file uploaded. Use multipart/form-data with field "file".', 400);
    }

    $file = $_FILES['file'];

    // Check for upload errors
    if ($file['error'] !== UPLOAD_ERR_OK) {
        $errorMessages = [
            UPLOAD_ERR_INI_SIZE   => 'File exceeds server upload limit',
            UPLOAD_ERR_FORM_SIZE  => 'File exceeds form upload limit',
            UPLOAD_ERR_PARTIAL    => 'File was only partially uploaded',
            UPLOAD_ERR_NO_TMP_DIR => 'Missing temporary folder',
            UPLOAD_ERR_CANT_WRITE => 'Failed to write file to disk',
            UPLOAD_ERR_EXTENSION  => 'Upload stopped by extension',
        ];
        $msg = $errorMessages[$file['error']] ?? 'Unknown upload error';
        json_error($msg, 400);
    }

    // Max 20MB
    $maxSize = 20 * 1024 * 1024;
    if ($file['size'] > $maxSize) {
        json_error('File too large. Maximum size is 20MB.', 400);
    }

    // Ensure upload directory exists
    $uploadDir = DATA_DIR . '/uploads';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }

    $originalName = basename($file['name']);
    $extension    = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
    $id           = generate_uuid();
    $storageName  = $id . ($extension !== '' ? '.' . $extension : '');
    $storagePath  = $uploadDir . '/' . $storageName;

    // Move uploaded file
    if (!move_uploaded_file($file['tmp_name'], $storagePath)) {
        json_error('Failed to save uploaded file', 500);
    }

    // Detect MIME type
    $mimeType = $file['type'] ?: 'application/octet-stream';
    if (function_exists('mime_content_type') && is_file($storagePath)) {
        $detected = mime_content_type($storagePath);
        if ($detected) {
            $mimeType = $detected;
        }
    }

    // Use custom name from form data, or fall back to original filename
    $displayName = trim($_POST['name'] ?? '') ?: $originalName;

    $db  = get_db();
    $now = now_iso();

    $db->prepare("
        INSERT INTO files (id, name, original_name, size, mime_type, extension, storage_path, uploaded_by, created_at)
        VALUES (:id, :name, :original_name, :size, :mime_type, :extension, :storage_path, :uploaded_by, :created_at)
    ")->execute([
        ':id'            => $id,
        ':name'          => $displayName,
        ':original_name' => $originalName,
        ':size'          => (int) $file['size'],
        ':mime_type'     => $mimeType,
        ':extension'     => $extension,
        ':storage_path'  => $storageName,
        ':uploaded_by'   => $_SESSION['user_id'],
        ':created_at'    => $now,
    ]);

    // Fetch and return the created record
    $stmt = $db->prepare("
        SELECT f.*, u.display_name as uploaded_by_name
        FROM files f
        LEFT JOIN users u ON f.uploaded_by = u.id
        WHERE f.id = :id
    ");
    $stmt->execute([':id' => $id]);
    $record = $stmt->fetch();
    $record['size'] = (int) $record['size'];

    json_response($record, 201);
}

/**
 * GET /api/files/{id}
 * Returns file metadata as JSON.
 */
function handle_get_file(string $id): void
{
    requireAuth();
    files_ensure_tables();
    $db = get_db();

    $stmt = $db->prepare("
        SELECT f.*, u.display_name as uploaded_by_name
        FROM files f
        LEFT JOIN users u ON f.uploaded_by = u.id
        WHERE f.id = :id
    ");
    $stmt->execute([':id' => $id]);
    $file = $stmt->fetch();

    if (!$file) {
        json_error('File not found', 404);
    }

    $file['size'] = (int) $file['size'];

    json_response($file);
}

/**
 * GET /api/files/{id}/download
 * Streams the actual file content with proper headers.
 */
function handle_download_file(string $id): void
{
    requireAuth();
    files_ensure_tables();
    $db = get_db();

    $stmt = $db->prepare("SELECT * FROM files WHERE id = :id");
    $stmt->execute([':id' => $id]);
    $file = $stmt->fetch();

    if (!$file) {
        json_error('File not found', 404);
    }

    $filePath = DATA_DIR . '/uploads/' . $file['storage_path'];

    if (!is_file($filePath)) {
        json_error('File not found on disk', 404);
    }

    // Clear any previous output buffering
    while (ob_get_level()) {
        ob_end_clean();
    }

    header('Content-Type: ' . $file['mime_type']);
    header('Content-Disposition: attachment; filename="' . addslashes($file['original_name']) . '"');
    header('Content-Length: ' . $file['size']);
    header('Cache-Control: no-cache, must-revalidate');

    readfile($filePath);
    exit;
}

/**
 * DELETE /api/files/{id}
 * Deletes both the file on disk and its metadata.
 */
function handle_delete_file(string $id): void
{
    requireAuth();
    files_ensure_tables();
    $db = get_db();

    $stmt = $db->prepare("SELECT * FROM files WHERE id = :id");
    $stmt->execute([':id' => $id]);
    $file = $stmt->fetch();

    if (!$file) {
        json_error('File not found', 404);
    }

    // Delete from disk
    $filePath = DATA_DIR . '/uploads/' . $file['storage_path'];
    if (is_file($filePath)) {
        unlink($filePath);
    }

    // Delete metadata
    $db->prepare("DELETE FROM files WHERE id = :id")->execute([':id' => $id]);

    json_success('File deleted');
}


// ============================================================
//  SEED DATA
// ============================================================

function files_seed_data(string $adminId): void
{
    // No seed data needed for files
}
