<?php
/**
 * DGD Dashboard - Admin Handlers
 *
 * GET  /api/admin/users               - List all registered users (admin only)
 * PUT  /api/admin/users/{id}/role     - Change user role (admin only)
 * DELETE /api/admin/users/{id}        - Delete user (admin only)
 * GET  /api/invite-codes              - List invite codes (admin only)
 * POST /api/invite-codes              - Generate new invite code (admin only)
 * POST /api/invite-codes/{id}/send    - Send invite email via Cortex/PHP (admin only)
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

function handle_update_user_role(string $userId): void
{
    $body = get_json_body();
    $role = trim($body['role'] ?? '');

    if (!in_array($role, ['admin', 'member'], true)) {
        json_error('Invalid role. Allowed: admin, member', 400);
    }

    // Prevent self-demotion
    if ($userId === $_SESSION['user_id'] && $role !== 'admin') {
        json_error('Cannot remove your own admin role', 403);
    }

    $db = get_db();
    $stmt = $db->prepare("UPDATE users SET role = :role WHERE id = :id");
    $stmt->execute([':role' => $role, ':id' => $userId]);

    if ($stmt->rowCount() === 0) {
        json_error('User not found', 404);
    }

    json_success('Role updated', ['user_id' => $userId, 'role' => $role]);
}

function handle_delete_user(string $userId): void
{
    // Prevent self-deletion
    if ($userId === $_SESSION['user_id']) {
        json_error('Cannot delete your own account', 403);
    }

    $db = get_db();
    $stmt = $db->prepare("DELETE FROM users WHERE id = :id");
    $stmt->execute([':id' => $userId]);

    if ($stmt->rowCount() === 0) {
        json_error('User not found', 404);
    }

    json_success('User deleted', ['user_id' => $userId]);
}

function handle_send_invite(string $codeId): void
{
    $db = get_db();

    $stmt = $db->prepare("SELECT * FROM invite_codes WHERE id = :id");
    $stmt->execute([':id' => $codeId]);
    $invite = $stmt->fetch();

    if (!$invite) {
        json_error('Invite code not found', 404);
    }
    if (empty($invite['invited_email'])) {
        json_error('No email address for this invite', 400);
    }
    if ($invite['used_by']) {
        json_error('Invite already redeemed', 400);
    }

    $email = $invite['invited_email'];
    $name  = $invite['invited_name'] ?: '';
    $code  = $invite['code'];

    // Build registration URL
    $dashUrl = 'https://dgd.digital/dashboard/';
    $registerUrl = $dashUrl . '#register?code=' . urlencode($code);

    $greeting = $name ? "Hallo {$name}" : 'Hallo';
    $senderName = '';
    $sender = $db->prepare("SELECT display_name FROM users WHERE id = :id");
    $sender->execute([':id' => $_SESSION['user_id']]);
    $senderRow = $sender->fetch();
    if ($senderRow) {
        $senderName = $senderRow['display_name'];
    }

    $subject = 'Einladung zum DGD Dashboard';
    $body = "{$greeting},\n\n"
        . "du wurdest zum internen DGD Dashboard eingeladen.\n\n"
        . "Registriere dich hier:\n{$registerUrl}\n\n"
        . "Dein Einladungscode: {$code}\n\n"
        . "Viele Gruesse,\n"
        . ($senderName ?: 'DGD Team');

    $sentVia = null;

    // Attempt 1: Cortex (localhost:8000) - direct gmail_send, no approval
    $cortexPayload = json_encode([
        'tool' => 'gmail_send',
        'params' => [
            'to'      => $email,
            'subject' => $subject,
            'body'    => $body,
            'task_id' => 'invite-' . $codeId,
        ],
        'skip_approval' => true,
    ]);

    $ch = curl_init('http://localhost:8000/api/execute-tool');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $cortexPayload,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_TIMEOUT        => 8,
        CURLOPT_CONNECTTIMEOUT => 3,
    ]);
    $cortexResponse = curl_exec($ch);
    $cortexHttpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $cortexError = curl_error($ch);
    curl_close($ch);

    if (!$cortexError && $cortexHttpCode >= 200 && $cortexHttpCode < 300) {
        $cortexData = json_decode($cortexResponse, true);
        if (!empty($cortexData['result']) || !empty($cortexData['success'])) {
            $sentVia = 'cortex';
        }
    }

    // Attempt 2: PHP mail() fallback
    if (!$sentVia) {
        $headers = "From: DGD Dashboard <noreply@dgd.digital>\r\n"
            . "Reply-To: d.aguirre@dgd-direkt.de\r\n"
            . "Content-Type: text/plain; charset=UTF-8\r\n"
            . "MIME-Version: 1.0\r\n";

        $mailSent = @mail($email, $subject, $body, $headers);
        if ($mailSent) {
            $sentVia = 'php_mail';
        }
    }

    if (!$sentVia) {
        json_error('E-Mail konnte nicht gesendet werden. Weder Cortex noch PHP mail() verfuegbar.', 502);
    }

    // Update invite code with send info
    $db->prepare("UPDATE invite_codes SET email_sent_at = :sent_at, sent_via = :via WHERE id = :id")
       ->execute([
           ':sent_at' => now_iso(),
           ':via'     => $sentVia,
           ':id'      => $codeId,
       ]);

    json_success('Einladung gesendet', [
        'sent_via' => $sentVia,
        'email'    => $email,
        'code'     => $code,
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
