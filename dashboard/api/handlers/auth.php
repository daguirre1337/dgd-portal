<?php
/**
 * DGD Dashboard - Auth Handlers
 *
 * POST /api/auth/login       - Login with username + password
 * POST /api/auth/register    - Register with invite code
 * POST /api/auth/logout      - Destroy session
 * GET  /api/auth/me          - Current user info
 */

function handle_login(): void
{
    $body = get_json_body();

    $login    = trim($body['username'] ?? '');
    $password = $body['password'] ?? '';

    if (empty($login) || empty($password)) {
        json_error('Username and password are required', 400);
    }

    $db = get_db();
    // Allow login with username OR email
    $stmt = $db->prepare("SELECT * FROM users WHERE username = :login OR email = :login");
    $stmt->execute([':login' => $login]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        json_error('Invalid username or password', 401);
    }

    $db->prepare("UPDATE users SET last_login = :now WHERE id = :id")
       ->execute([':now' => now_iso(), ':id' => $user['id']]);

    $_SESSION['user_id'] = $user['id'];
    $_SESSION['role']    = $user['role'];

    unset($user['password_hash']);
    json_success('Login successful', ['user' => $user]);
}

function handle_register(): void
{
    $body = get_json_body();

    $username    = trim($body['username'] ?? '');
    $email       = trim($body['email'] ?? '');
    $password    = $body['password'] ?? '';
    $displayName = trim($body['display_name'] ?? '');
    $inviteCode  = trim($body['invite_code'] ?? '');

    $missing = [];
    if (empty($username))    $missing[] = 'username';
    if (empty($email))       $missing[] = 'email';
    if (empty($password))    $missing[] = 'password';
    if (empty($displayName)) $missing[] = 'display_name';
    if (empty($inviteCode))  $missing[] = 'invite_code';
    if (count($missing) > 0) {
        json_error('Missing required fields: ' . implode(', ', $missing), 400);
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        json_error('Invalid email address', 400);
    }
    if (strlen($password) < 8) {
        json_error('Password must be at least 8 characters', 400);
    }

    $db = get_db();

    // Check invite code
    $codeStmt = $db->prepare("SELECT * FROM invite_codes WHERE code = :code");
    $codeStmt->execute([':code' => $inviteCode]);
    $code = $codeStmt->fetch();

    if (!$code) {
        json_error('Invalid invite code', 400);
    }
    if (!empty($code['used_by'])) {
        json_error('Invite code has already been used', 400);
    }
    if (!empty($code['expires_at']) && $code['expires_at'] < now_iso()) {
        json_error('Invite code has expired', 400);
    }

    // Check uniqueness
    $dupUser = $db->prepare("SELECT id FROM users WHERE username = :u");
    $dupUser->execute([':u' => $username]);
    if ($dupUser->fetch()) {
        json_error('Username already taken', 409);
    }

    $dupEmail = $db->prepare("SELECT id FROM users WHERE email = :e");
    $dupEmail->execute([':e' => $email]);
    if ($dupEmail->fetch()) {
        json_error('Email already registered', 409);
    }

    $userId = generate_uuid();
    $hash   = password_hash($password, PASSWORD_DEFAULT);
    $now    = now_iso();

    $db->beginTransaction();
    try {
        $db->prepare("
            INSERT INTO users (id, username, email, password_hash, display_name, role, invite_code_used, created_at)
            VALUES (:id, :username, :email, :hash, :display_name, 'member', :invite_code, :created_at)
        ")->execute([
            ':id'           => $userId,
            ':username'     => $username,
            ':email'        => $email,
            ':hash'         => $hash,
            ':display_name' => $displayName,
            ':invite_code'  => $inviteCode,
            ':created_at'   => $now,
        ]);

        $db->prepare("UPDATE invite_codes SET used_by = :user_id WHERE id = :id")
           ->execute([':user_id' => $userId, ':id' => $code['id']]);

        $db->commit();
    } catch (Exception $e) {
        $db->rollBack();
        throw $e;
    }

    $_SESSION['user_id'] = $userId;
    $_SESSION['role']    = 'member';

    json_success('Registration successful', [
        'user' => [
            'id'           => $userId,
            'username'     => $username,
            'email'        => $email,
            'display_name' => $displayName,
            'role'         => 'member',
            'created_at'   => $now,
        ],
    ]);
}

function handle_logout(): void
{
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(
            session_name(), '', time() - 42000,
            $params['path'], $params['domain'],
            $params['secure'], $params['httponly']
        );
    }
    session_destroy();
    json_success('Logged out');
}

function handle_auth_me(): void
{
    $db   = get_db();
    $user = getCurrentUser($db);

    if (!$user) {
        json_error('User not found', 404);
    }

    json_response(['user' => $user]);
}
