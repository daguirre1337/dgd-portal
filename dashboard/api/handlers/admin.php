<?php
/**
 * DGD Dashboard - Admin Handlers
 *
 * GET  /api/admin/users               - List all registered users (admin only)
 * GET  /api/invite-codes              - List invite codes (admin only)
 * POST /api/invite-codes              - Generate new invite code (admin only)
 * GET  /api/admin/page-owners         - List page owners
 * PUT  /api/admin/page-owners/{view}  - Update page owner (admin only)
 */

function handle_list_users(): void
{
    $db = get_db();

    $stmt = $db->query("
        SELECT id, username, email, display_name, role, created_at, last_login
        FROM users
        ORDER BY created_at DESC
    ");

    json_response([
        'users' => $stmt->fetchAll(),
    ]);
}

function handle_list_invite_codes(): void
{
    $db = get_db();

    $stmt = $db->query("
        SELECT
            ic.*,
            u_created.display_name AS created_by_name,
            u_used.display_name AS used_by_name
        FROM invite_codes ic
        LEFT JOIN users u_created ON ic.created_by = u_created.id
        LEFT JOIN users u_used    ON ic.used_by = u_used.id
        ORDER BY ic.created_at DESC
    ");

    $codes = $stmt->fetchAll();

    json_response([
        'codes' => $codes,
        'total' => count($codes),
    ]);
}

function handle_create_invite_code(): void
{
    $body = get_json_body();

    $code = trim($body['code'] ?? '');
    if (empty($code)) {
        $code = 'DGD-' . strtoupper(bin2hex(random_bytes(2))) . '-' . strtoupper(bin2hex(random_bytes(2)));
    }

    $invitedEmail = trim($body['invited_email'] ?? '');
    $invitedName  = trim($body['invited_name'] ?? '');

    if (!empty($invitedEmail) && !filter_var($invitedEmail, FILTER_VALIDATE_EMAIL)) {
        json_error('Invalid email address', 400);
    }

    $db = get_db();

    $dup = $db->prepare("SELECT id FROM invite_codes WHERE code = :code");
    $dup->execute([':code' => $code]);
    if ($dup->fetch()) {
        json_error('Invite code already exists', 409);
    }

    $id  = generate_uuid();
    $now = now_iso();

    $db->prepare("
        INSERT INTO invite_codes (id, code, created_by, invited_email, invited_name, expires_at, created_at)
        VALUES (:id, :code, :created_by, :invited_email, :invited_name, :expires_at, :created_at)
    ")->execute([
        ':id'            => $id,
        ':code'          => $code,
        ':created_by'    => $_SESSION['user_id'],
        ':invited_email' => $invitedEmail ?: null,
        ':invited_name'  => $invitedName ?: null,
        ':expires_at'    => $body['expires_at'] ?? null,
        ':created_at'    => $now,
    ]);

    json_success('Invite code created', [
        'id'    => $id,
        'code'  => $code,
        'email' => $invitedEmail ?: null,
        'name'  => $invitedName ?: null,
    ]);
}

// ---- Page Owners ----

function handle_list_page_owners(): void
{
    $db = get_db();
    $stmt = $db->query("SELECT view_name, owner_name, updated_at FROM page_owners ORDER BY view_name");
    $rows = $stmt->fetchAll();

    // Return as map for easy lookup
    $map = [];
    foreach ($rows as $r) {
        $map[$r['view_name']] = $r['owner_name'];
    }

    json_response(['owners' => $map]);
}

function handle_update_page_owner(string $viewName): void
{
    $body = get_json_body();
    $ownerName = trim($body['owner_name'] ?? '');

    if (empty($ownerName)) {
        json_error('owner_name is required', 400);
    }

    $db = get_db();
    $db->prepare("
        INSERT INTO page_owners (view_name, owner_name, updated_by, updated_at)
        VALUES (:view, :owner, :user, :now)
        ON CONFLICT(view_name) DO UPDATE SET
            owner_name = :owner, updated_by = :user, updated_at = :now
    ")->execute([
        ':view'  => $viewName,
        ':owner' => $ownerName,
        ':user'  => $_SESSION['user_id'],
        ':now'   => now_iso(),
    ]);

    json_success('Page owner updated', ['view_name' => $viewName, 'owner_name' => $ownerName]);
}
