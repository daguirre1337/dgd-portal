<?php
/**
 * DGD Dashboard - Main API Router
 *
 * Routes all /api/* requests to the appropriate handler.
 *
 * Auth Endpoints (no auth):
 *   POST /api/auth/login       - Login with username + password
 *   POST /api/auth/register    - Register with invite code
 *   POST /api/auth/logout      - Destroy session
 *
 * Auth Endpoints (auth required):
 *   GET  /api/auth/me          - Current user info
 *
 * Project Endpoints (auth required):
 *   GET    /api/projects           - List projects (optional ?status=&category=)
 *   POST   /api/projects           - Create project
 *   PUT    /api/projects/{id}      - Update project
 *   DELETE /api/projects/{id}      - Delete project + milestones
 *
 * Milestone Endpoints (auth required):
 *   POST /api/projects/{id}/milestones  - Create milestone
 *   PUT  /api/milestones/{id}           - Update milestone
 *
 * KPI Endpoints (auth required):
 *   GET  /api/kpis              - List all KPIs
 *   POST /api/kpis              - Create or update KPI
 *   GET  /api/kpis/{id}/history - KPI history for charts
 *
 * Goal/OKR Endpoints (auth required):
 *   GET    /api/goals                    - List goals (filter: type, quarter, year, status, owner)
 *   GET    /api/goals/stats              - Aggregated stats
 *   GET    /api/goals/{id}               - Single goal with key_results
 *   POST   /api/goals                    - Create goal
 *   PUT    /api/goals/{id}               - Update goal
 *   DELETE /api/goals/{id}               - Delete goal
 *   POST   /api/goals/{id}/key-results   - Create key result
 *   PUT    /api/key-results/{id}         - Update key result
 *   DELETE /api/key-results/{id}         - Delete key result
 *
 * Feedback Endpoints (auth required):
 *   GET  /api/feedback/templates              - List templates
 *   GET  /api/feedback/templates/{id}         - Single template
 *   POST /api/feedback/templates              - Create template
 *   PUT  /api/feedback/templates/{id}         - Update template
 *   POST /api/feedback/responses              - Submit response
 *   GET  /api/feedback/results/{template_id}  - Aggregated results
 *   GET  /api/feedback/pulse-status           - Pulse survey status
 *   GET  /api/feedback/trends                 - Pulse trends over time
 *
 * Finance Endpoints (auth required):
 *   GET    /api/finance/summary       - P&L summary
 *   GET    /api/finance/monthly       - Monthly breakdown
 *   POST   /api/finance/expenses      - Create expense
 *   GET    /api/finance/expenses      - List expenses
 *   PUT    /api/finance/expenses/{id} - Update expense
 *   DELETE /api/finance/expenses/{id} - Delete expense
 *   POST   /api/finance/revenue       - Create revenue entry
 *   GET    /api/finance/revenue       - List revenue entries
 *   GET    /api/finance/projects      - Projects with budget overview
 *
 * Admin Endpoints (admin only):
 *   GET  /api/invite-codes      - List invite codes
 *   POST /api/invite-codes      - Generate new invite code
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/goals.php';
require_once __DIR__ . '/feedback.php';
require_once __DIR__ . '/finance.php';

// ---- Auto-initialize database if tables are missing ----
require_once __DIR__ . '/init_db.php';
$_db_check = get_db();
$_table_count = (int) $_db_check->query(
    "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='users'"
)->fetchColumn();
if ($_table_count === 0) {
    init_database();
}
unset($_db_check, $_table_count);

// ---- Headers & Session ----
set_api_headers();
init_session();

// ---- Parse request ----
$method     = $_SERVER['REQUEST_METHOD'];
$requestUri = $_SERVER['REQUEST_URI'] ?? '/';

// Strip query string for route matching
$path = parse_url($requestUri, PHP_URL_PATH);

// Normalize: remove trailing slash
$path = rtrim($path, '/');

// ---- Router ----
try {
    // ============================================================
    //  AUTH ROUTES (no auth required)
    // ============================================================

    // POST /api/auth/login
    if ($method === 'POST' && preg_match('#/api/auth/login$#', $path)) {
        handle_login();
    }
    // POST /api/auth/register
    elseif ($method === 'POST' && preg_match('#/api/auth/register$#', $path)) {
        handle_register();
    }
    // POST /api/auth/logout
    elseif ($method === 'POST' && preg_match('#/api/auth/logout$#', $path)) {
        handle_logout();
    }

    // ============================================================
    //  AUTH ROUTES (auth required)
    // ============================================================

    // GET /api/auth/me
    elseif ($method === 'GET' && preg_match('#/api/auth/me$#', $path)) {
        handle_auth_me();
    }

    // ============================================================
    //  PROJECT ROUTES (auth required)
    // ============================================================

    // POST /api/projects/{id}/milestones
    elseif ($method === 'POST' && preg_match('#/api/projects/([a-f0-9-]+)/milestones$#i', $path, $m)) {
        handle_create_milestone($m[1]);
    }
    // GET /api/projects
    elseif ($method === 'GET' && preg_match('#/api/projects$#', $path)) {
        handle_list_projects();
    }
    // POST /api/projects
    elseif ($method === 'POST' && preg_match('#/api/projects$#', $path)) {
        handle_create_project();
    }
    // PUT /api/projects/{id}
    elseif ($method === 'PUT' && preg_match('#/api/projects/([a-f0-9-]+)$#i', $path, $m)) {
        handle_update_project($m[1]);
    }
    // DELETE /api/projects/{id}
    elseif ($method === 'DELETE' && preg_match('#/api/projects/([a-f0-9-]+)$#i', $path, $m)) {
        handle_delete_project($m[1]);
    }

    // ============================================================
    //  MILESTONE ROUTES (auth required)
    // ============================================================

    // PUT /api/milestones/{id}
    elseif ($method === 'PUT' && preg_match('#/api/milestones/([a-f0-9-]+)$#i', $path, $m)) {
        handle_update_milestone($m[1]);
    }

    // ============================================================
    //  KPI ROUTES (auth required)
    // ============================================================

    // GET /api/kpis/{id}/history
    elseif ($method === 'GET' && preg_match('#/api/kpis/([a-f0-9-]+)/history$#i', $path, $m)) {
        handle_kpi_history($m[1]);
    }
    // GET /api/kpis
    elseif ($method === 'GET' && preg_match('#/api/kpis$#', $path)) {
        handle_list_kpis();
    }
    // POST /api/kpis
    elseif ($method === 'POST' && preg_match('#/api/kpis$#', $path)) {
        handle_upsert_kpi();
    }

    // ============================================================
    //  GOAL / OKR ROUTES (auth required)
    // ============================================================

    // POST /api/goals/{id}/key-results
    elseif ($method === 'POST' && preg_match('#/api/goals/([a-f0-9-]+)/key-results$#i', $path, $m)) {
        handle_create_key_result($m[1]);
    }
    // GET /api/goals/stats
    elseif ($method === 'GET' && preg_match('#/api/goals/stats$#', $path)) {
        handle_goals_stats();
    }
    // GET /api/goals/{id}
    elseif ($method === 'GET' && preg_match('#/api/goals/([a-f0-9-]+)$#i', $path, $m)) {
        handle_get_goal($m[1]);
    }
    // GET /api/goals
    elseif ($method === 'GET' && preg_match('#/api/goals$#', $path)) {
        handle_list_goals();
    }
    // POST /api/goals
    elseif ($method === 'POST' && preg_match('#/api/goals$#', $path)) {
        handle_create_goal();
    }
    // PUT /api/goals/{id}
    elseif ($method === 'PUT' && preg_match('#/api/goals/([a-f0-9-]+)$#i', $path, $m)) {
        handle_update_goal($m[1]);
    }
    // DELETE /api/goals/{id}
    elseif ($method === 'DELETE' && preg_match('#/api/goals/([a-f0-9-]+)$#i', $path, $m)) {
        handle_delete_goal($m[1]);
    }
    // PUT /api/key-results/{id}
    elseif ($method === 'PUT' && preg_match('#/api/key-results/([a-f0-9-]+)$#i', $path, $m)) {
        handle_update_key_result($m[1]);
    }
    // DELETE /api/key-results/{id}
    elseif ($method === 'DELETE' && preg_match('#/api/key-results/([a-f0-9-]+)$#i', $path, $m)) {
        handle_delete_key_result($m[1]);
    }

    // ============================================================
    //  FEEDBACK ROUTES (auth required)
    // ============================================================

    // GET /api/feedback/pulse-status
    elseif ($method === 'GET' && preg_match('#/api/feedback/pulse-status$#', $path)) {
        handle_pulse_status();
    }
    // GET /api/feedback/trends
    elseif ($method === 'GET' && preg_match('#/api/feedback/trends$#', $path)) {
        handle_feedback_trends();
    }
    // GET /api/feedback/results/{template_id}
    elseif ($method === 'GET' && preg_match('#/api/feedback/results/([a-f0-9-]+)$#i', $path, $m)) {
        handle_feedback_results($m[1]);
    }
    // GET /api/feedback/templates/{id}
    elseif ($method === 'GET' && preg_match('#/api/feedback/templates/([a-f0-9-]+)$#i', $path, $m)) {
        handle_get_feedback_template($m[1]);
    }
    // GET /api/feedback/templates
    elseif ($method === 'GET' && preg_match('#/api/feedback/templates$#', $path)) {
        handle_list_feedback_templates();
    }
    // POST /api/feedback/templates
    elseif ($method === 'POST' && preg_match('#/api/feedback/templates$#', $path)) {
        handle_create_feedback_template();
    }
    // PUT /api/feedback/templates/{id}
    elseif ($method === 'PUT' && preg_match('#/api/feedback/templates/([a-f0-9-]+)$#i', $path, $m)) {
        handle_update_feedback_template($m[1]);
    }
    // POST /api/feedback/responses
    elseif ($method === 'POST' && preg_match('#/api/feedback/responses$#', $path)) {
        handle_submit_feedback_response();
    }

    // ============================================================
    //  FINANCE ROUTES (auth required)
    // ============================================================

    // GET /api/finance/summary
    elseif ($method === 'GET' && preg_match('#/api/finance/summary$#', $path)) {
        handle_finance_summary();
    }
    // GET /api/finance/monthly
    elseif ($method === 'GET' && preg_match('#/api/finance/monthly$#', $path)) {
        handle_finance_monthly();
    }
    // GET /api/finance/projects
    elseif ($method === 'GET' && preg_match('#/api/finance/projects$#', $path)) {
        handle_finance_projects();
    }
    // PUT /api/finance/expenses/{id}
    elseif ($method === 'PUT' && preg_match('#/api/finance/expenses/([a-f0-9-]+)$#i', $path, $m)) {
        handle_update_expense($m[1]);
    }
    // DELETE /api/finance/expenses/{id}
    elseif ($method === 'DELETE' && preg_match('#/api/finance/expenses/([a-f0-9-]+)$#i', $path, $m)) {
        handle_delete_expense($m[1]);
    }
    // POST /api/finance/expenses
    elseif ($method === 'POST' && preg_match('#/api/finance/expenses$#', $path)) {
        handle_create_expense();
    }
    // GET /api/finance/expenses
    elseif ($method === 'GET' && preg_match('#/api/finance/expenses$#', $path)) {
        handle_list_expenses();
    }
    // POST /api/finance/revenue
    elseif ($method === 'POST' && preg_match('#/api/finance/revenue$#', $path)) {
        handle_create_revenue();
    }
    // GET /api/finance/revenue
    elseif ($method === 'GET' && preg_match('#/api/finance/revenue$#', $path)) {
        handle_list_revenue();
    }

    // ============================================================
    //  ADMIN ROUTES (admin only)
    // ============================================================

    // GET /api/invite-codes
    elseif ($method === 'GET' && preg_match('#/api/invite-codes$#', $path)) {
        handle_list_invite_codes();
    }
    // POST /api/invite-codes
    elseif ($method === 'POST' && preg_match('#/api/invite-codes$#', $path)) {
        handle_create_invite_code();
    }

    // ============================================================
    //  FALLBACK
    // ============================================================
    else {
        json_error('Not found: ' . $method . ' ' . $path, 404);
    }

} catch (PDOException $e) {
    error_log('DGD Dashboard DB Error: ' . $e->getMessage());
    json_error('Database error', 500);
} catch (Exception $e) {
    error_log('DGD Dashboard Error: ' . $e->getMessage());
    json_error('Internal server error', 500);
}


// ============================================================
//  AUTH HANDLERS
// ============================================================

/**
 * POST /api/auth/login
 * Body: { username, password }
 */
function handle_login(): void
{
    $body = get_json_body();

    $username = trim($body['username'] ?? '');
    $password = $body['password'] ?? '';

    if (empty($username) || empty($password)) {
        json_error('Username and password are required', 400);
    }

    $db   = get_db();
    $stmt = $db->prepare("SELECT * FROM users WHERE username = :username");
    $stmt->execute([':username' => $username]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        json_error('Invalid username or password', 401);
    }

    // Update last_login
    $db->prepare("UPDATE users SET last_login = :now WHERE id = :id")
       ->execute([':now' => now_iso(), ':id' => $user['id']]);

    // Set session
    $_SESSION['user_id'] = $user['id'];
    $_SESSION['role']    = $user['role'];

    unset($user['password_hash']);

    json_success('Login successful', ['user' => $user]);
}

/**
 * POST /api/auth/register
 * Body: { username, email, password, display_name, invite_code }
 */
function handle_register(): void
{
    $body = get_json_body();

    $username    = trim($body['username'] ?? '');
    $email       = trim($body['email'] ?? '');
    $password    = $body['password'] ?? '';
    $displayName = trim($body['display_name'] ?? '');
    $inviteCode  = trim($body['invite_code'] ?? '');

    // Validate required fields
    $missing = [];
    if (empty($username))    $missing[] = 'username';
    if (empty($email))       $missing[] = 'email';
    if (empty($password))    $missing[] = 'password';
    if (empty($displayName)) $missing[] = 'display_name';
    if (empty($inviteCode))  $missing[] = 'invite_code';
    if (count($missing) > 0) {
        json_error('Missing required fields: ' . implode(', ', $missing), 400);
    }

    // Validate email
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        json_error('Invalid email address', 400);
    }

    // Validate password length
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

    // Check username/email uniqueness
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

    // Create user
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

        // Mark invite code as used
        $db->prepare("UPDATE invite_codes SET used_by = :user_id WHERE id = :id")
           ->execute([':user_id' => $userId, ':id' => $code['id']]);

        $db->commit();
    } catch (Exception $e) {
        $db->rollBack();
        throw $e;
    }

    // Auto-login
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

/**
 * POST /api/auth/logout
 */
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

/**
 * GET /api/auth/me
 */
function handle_auth_me(): void
{
    requireAuth();
    $db   = get_db();
    $user = getCurrentUser($db);

    if (!$user) {
        json_error('User not found', 404);
    }

    json_response(['user' => $user]);
}


// ============================================================
//  PROJECT HANDLERS
// ============================================================

/**
 * GET /api/projects
 * Query params: ?status=aktiv&category=portal
 */
function handle_list_projects(): void
{
    requireAuth();
    $db = get_db();

    $where  = [];
    $params = [];

    if (!empty($_GET['status'])) {
        $where[]            = 'p.status = :status';
        $params[':status']  = $_GET['status'];
    }

    if (!empty($_GET['category'])) {
        $where[]              = 'p.category = :category';
        $params[':category']  = $_GET['category'];
    }

    $whereClause = count($where) > 0 ? 'WHERE ' . implode(' AND ', $where) : '';

    // Fetch projects
    $stmt = $db->prepare("
        SELECT p.* FROM projects p
        {$whereClause}
        ORDER BY
            CASE p.status
                WHEN 'aktiv' THEN 1
                WHEN 'geplant' THEN 2
                WHEN 'abgeschlossen' THEN 3
                WHEN 'pausiert' THEN 4
                ELSE 5
            END,
            p.start_date DESC
    ");
    $stmt->execute($params);
    $projects = $stmt->fetchAll();

    // Attach milestones to each project
    $msStmt = $db->prepare("SELECT * FROM milestones WHERE project_id = :pid ORDER BY date ASC");
    foreach ($projects as &$proj) {
        $proj['progress'] = (int) $proj['progress'];
        $msStmt->execute([':pid' => $proj['id']]);
        $milestones = $msStmt->fetchAll();
        foreach ($milestones as &$ms) {
            $ms['completed'] = (int) $ms['completed'];
        }
        $proj['milestones'] = $milestones;
    }

    json_response([
        'projects' => $projects,
        'total'    => count($projects),
    ]);
}

/**
 * POST /api/projects
 * Body: { title, description?, category?, status?, priority?, start_date?, end_date?, progress?, owner?, tags? }
 */
function handle_create_project(): void
{
    requireAuth();
    $body = get_json_body();

    if (empty($body['title'])) {
        json_error('Title is required', 400);
    }

    $db  = get_db();
    $id  = generate_uuid();
    $now = now_iso();

    $db->prepare("
        INSERT INTO projects (id, title, description, category, status, priority, start_date, end_date, progress, owner, tags, created_by, created_at, updated_at)
        VALUES (:id, :title, :description, :category, :status, :priority, :start_date, :end_date, :progress, :owner, :tags, :created_by, :created_at, :updated_at)
    ")->execute([
        ':id'          => $id,
        ':title'       => trim($body['title']),
        ':description' => trim($body['description'] ?? ''),
        ':category'    => trim($body['category'] ?? 'intern'),
        ':status'      => trim($body['status'] ?? 'geplant'),
        ':priority'    => trim($body['priority'] ?? 'mittel'),
        ':start_date'  => $body['start_date'] ?? null,
        ':end_date'    => $body['end_date'] ?? null,
        ':progress'    => (int) ($body['progress'] ?? 0),
        ':owner'       => trim($body['owner'] ?? ''),
        ':tags'        => trim($body['tags'] ?? ''),
        ':created_by'  => $_SESSION['user_id'],
        ':created_at'  => $now,
        ':updated_at'  => $now,
    ]);

    json_success('Project created', ['id' => $id]);
}

/**
 * PUT /api/projects/{id}
 * Body: partial update fields
 */
function handle_update_project(string $id): void
{
    requireAuth();
    $body = get_json_body();

    $db = get_db();

    // Check project exists
    $exists = $db->prepare("SELECT id FROM projects WHERE id = :id");
    $exists->execute([':id' => $id]);
    if (!$exists->fetch()) {
        json_error('Project not found', 404);
    }

    $allowed = ['title', 'description', 'category', 'status', 'priority', 'start_date', 'end_date', 'progress', 'owner', 'tags'];
    $sets    = [];
    $params  = [':id' => $id, ':updated_at' => now_iso()];

    foreach ($allowed as $field) {
        if (array_key_exists($field, $body)) {
            $sets[]            = "{$field} = :{$field}";
            $params[":{$field}"] = $field === 'progress' ? (int) $body[$field] : trim((string) $body[$field]);
        }
    }

    if (empty($sets)) {
        json_error('No fields to update', 400);
    }

    $sets[] = 'updated_at = :updated_at';
    $sql = "UPDATE projects SET " . implode(', ', $sets) . " WHERE id = :id";

    $db->prepare($sql)->execute($params);

    json_success('Project updated');
}

/**
 * DELETE /api/projects/{id}
 */
function handle_delete_project(string $id): void
{
    requireAuth();
    $db = get_db();

    // Check project exists
    $exists = $db->prepare("SELECT id FROM projects WHERE id = :id");
    $exists->execute([':id' => $id]);
    if (!$exists->fetch()) {
        json_error('Project not found', 404);
    }

    // Milestones cascade via FK ON DELETE CASCADE
    $db->prepare("DELETE FROM projects WHERE id = :id")->execute([':id' => $id]);

    json_success('Project deleted');
}


// ============================================================
//  MILESTONE HANDLERS
// ============================================================

/**
 * POST /api/projects/{id}/milestones
 * Body: { title, date, completed? }
 */
function handle_create_milestone(string $projectId): void
{
    requireAuth();
    $body = get_json_body();

    if (empty($body['title']) || empty($body['date'])) {
        json_error('Title and date are required', 400);
    }

    $db = get_db();

    // Verify project exists
    $exists = $db->prepare("SELECT id FROM projects WHERE id = :id");
    $exists->execute([':id' => $projectId]);
    if (!$exists->fetch()) {
        json_error('Project not found', 404);
    }

    $id  = generate_uuid();
    $now = now_iso();

    $db->prepare("
        INSERT INTO milestones (id, project_id, title, date, completed, created_at)
        VALUES (:id, :project_id, :title, :date, :completed, :created_at)
    ")->execute([
        ':id'         => $id,
        ':project_id' => $projectId,
        ':title'      => trim($body['title']),
        ':date'       => trim($body['date']),
        ':completed'  => (int) ($body['completed'] ?? 0),
        ':created_at' => $now,
    ]);

    json_success('Milestone created', ['id' => $id]);
}

/**
 * PUT /api/milestones/{id}
 * Body: { title?, date?, completed? }
 */
function handle_update_milestone(string $id): void
{
    requireAuth();
    $body = get_json_body();

    $db = get_db();

    // Check milestone exists
    $exists = $db->prepare("SELECT id FROM milestones WHERE id = :id");
    $exists->execute([':id' => $id]);
    if (!$exists->fetch()) {
        json_error('Milestone not found', 404);
    }

    $allowed = ['title', 'date', 'completed'];
    $sets    = [];
    $params  = [':id' => $id];

    foreach ($allowed as $field) {
        if (array_key_exists($field, $body)) {
            $sets[]              = "{$field} = :{$field}";
            $params[":{$field}"] = $field === 'completed' ? (int) $body[$field] : trim((string) $body[$field]);
        }
    }

    if (empty($sets)) {
        json_error('No fields to update', 400);
    }

    $sql = "UPDATE milestones SET " . implode(', ', $sets) . " WHERE id = :id";
    $db->prepare($sql)->execute($params);

    json_success('Milestone updated');
}


// ============================================================
//  KPI HANDLERS
// ============================================================

/**
 * GET /api/kpis
 */
function handle_list_kpis(): void
{
    requireAuth();
    $db = get_db();

    $stmt = $db->query("SELECT * FROM kpis ORDER BY category, name");
    $kpis = $stmt->fetchAll();

    // Cast numeric fields
    foreach ($kpis as &$kpi) {
        $kpi['value']         = (float) $kpi['value'];
        $kpi['target']        = $kpi['target'] !== null ? (float) $kpi['target'] : null;
        $kpi['warning_low']   = $kpi['warning_low'] ?? null;
        $kpi['warning_high']  = $kpi['warning_high'] ?? null;
        $kpi['critical_low']  = $kpi['critical_low'] ?? null;
        $kpi['critical_high'] = $kpi['critical_high'] ?? null;
        if ($kpi['warning_low'] !== null)   $kpi['warning_low']   = (float) $kpi['warning_low'];
        if ($kpi['warning_high'] !== null)  $kpi['warning_high']  = (float) $kpi['warning_high'];
        if ($kpi['critical_low'] !== null)  $kpi['critical_low']  = (float) $kpi['critical_low'];
        if ($kpi['critical_high'] !== null) $kpi['critical_high'] = (float) $kpi['critical_high'];
    }

    json_response([
        'kpis'  => $kpis,
        'total' => count($kpis),
    ]);
}

/**
 * POST /api/kpis
 * Body: { id?, name, category?, value, unit?, target?, trend?, icon?,
 *         data_source?, warning_low?, warning_high?, critical_low?, critical_high? }
 * If id is provided and exists, update. Otherwise create.
 */
function handle_upsert_kpi(): void
{
    requireAuth();
    $body = get_json_body();

    if (empty($body['name'])) {
        json_error('Name is required', 400);
    }
    if (!isset($body['value'])) {
        json_error('Value is required', 400);
    }

    $db  = get_db();
    $now = now_iso();

    $existingId = $body['id'] ?? null;
    $existing   = null;

    if ($existingId) {
        $stmt = $db->prepare("SELECT id FROM kpis WHERE id = :id");
        $stmt->execute([':id' => $existingId]);
        $existing = $stmt->fetch();
    }

    if ($existing) {
        // Update existing KPI
        $db->prepare("
            UPDATE kpis SET
                name = :name, category = :category, value = :value,
                unit = :unit, target = :target, trend = :trend,
                icon = :icon, data_source = :data_source,
                warning_low = :warning_low, warning_high = :warning_high,
                critical_low = :critical_low, critical_high = :critical_high,
                updated_at = :updated_at
            WHERE id = :id
        ")->execute([
            ':id'            => $existingId,
            ':name'          => trim($body['name']),
            ':category'      => trim($body['category'] ?? 'portal'),
            ':value'         => (float) $body['value'],
            ':unit'          => trim($body['unit'] ?? ''),
            ':target'        => isset($body['target']) ? (float) $body['target'] : null,
            ':trend'         => trim($body['trend'] ?? 'stable'),
            ':icon'          => trim($body['icon'] ?? ''),
            ':data_source'   => trim($body['data_source'] ?? 'manual'),
            ':warning_low'   => isset($body['warning_low']) ? (float) $body['warning_low'] : null,
            ':warning_high'  => isset($body['warning_high']) ? (float) $body['warning_high'] : null,
            ':critical_low'  => isset($body['critical_low']) ? (float) $body['critical_low'] : null,
            ':critical_high' => isset($body['critical_high']) ? (float) $body['critical_high'] : null,
            ':updated_at'    => $now,
        ]);

        $kpiId = $existingId;
    } else {
        // Create new KPI
        $kpiId = generate_uuid();

        $db->prepare("
            INSERT INTO kpis (id, name, category, value, unit, target, trend, period, source, data_source, icon,
                              warning_low, warning_high, critical_low, critical_high, updated_at)
            VALUES (:id, :name, :category, :value, :unit, :target, :trend, 'monat', 'manual', :data_source, :icon,
                    :warning_low, :warning_high, :critical_low, :critical_high, :updated_at)
        ")->execute([
            ':id'            => $kpiId,
            ':name'          => trim($body['name']),
            ':category'      => trim($body['category'] ?? 'portal'),
            ':value'         => (float) $body['value'],
            ':unit'          => trim($body['unit'] ?? ''),
            ':target'        => isset($body['target']) ? (float) $body['target'] : null,
            ':trend'         => trim($body['trend'] ?? 'stable'),
            ':icon'          => trim($body['icon'] ?? ''),
            ':data_source'   => trim($body['data_source'] ?? 'manual'),
            ':warning_low'   => isset($body['warning_low']) ? (float) $body['warning_low'] : null,
            ':warning_high'  => isset($body['warning_high']) ? (float) $body['warning_high'] : null,
            ':critical_low'  => isset($body['critical_low']) ? (float) $body['critical_low'] : null,
            ':critical_high' => isset($body['critical_high']) ? (float) $body['critical_high'] : null,
            ':updated_at'    => $now,
        ]);
    }

    // Insert history entry
    $db->prepare("
        INSERT INTO kpi_history (id, kpi_id, value, recorded_at)
        VALUES (:id, :kpi_id, :value, :recorded_at)
    ")->execute([
        ':id'          => generate_uuid(),
        ':kpi_id'      => $kpiId,
        ':value'       => (float) $body['value'],
        ':recorded_at' => $now,
    ]);

    json_success($existing ? 'KPI updated' : 'KPI created', ['id' => $kpiId]);
}

/**
 * GET /api/kpis/{id}/history
 */
function handle_kpi_history(string $kpiId): void
{
    requireAuth();
    $db = get_db();

    // Verify KPI exists
    $kpiStmt = $db->prepare("SELECT id, name, unit FROM kpis WHERE id = :id");
    $kpiStmt->execute([':id' => $kpiId]);
    $kpi = $kpiStmt->fetch();

    if (!$kpi) {
        json_error('KPI not found', 404);
    }

    $limit = min(max((int) ($_GET['limit'] ?? 100), 1), 500);

    $stmt = $db->prepare("
        SELECT id, value, recorded_at
        FROM kpi_history
        WHERE kpi_id = :kpi_id
        ORDER BY recorded_at ASC
        LIMIT :limit
    ");
    $stmt->bindValue(':kpi_id', $kpiId);
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->execute();
    $history = $stmt->fetchAll();

    foreach ($history as &$entry) {
        $entry['value'] = (float) $entry['value'];
    }

    json_response([
        'kpi'     => $kpi,
        'history' => $history,
        'total'   => count($history),
    ]);
}


// ============================================================
//  ADMIN HANDLERS
// ============================================================

/**
 * GET /api/invite-codes
 */
function handle_list_invite_codes(): void
{
    requireAdmin();
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

/**
 * POST /api/invite-codes
 * Body: { code?, expires_at? }
 */
function handle_create_invite_code(): void
{
    requireAdmin();
    $body = get_json_body();

    $code = trim($body['code'] ?? '');
    if (empty($code)) {
        // Generate random code: DGD-XXXX-XXXX
        $code = 'DGD-' . strtoupper(bin2hex(random_bytes(2))) . '-' . strtoupper(bin2hex(random_bytes(2)));
    }

    $db = get_db();

    // Check uniqueness
    $dup = $db->prepare("SELECT id FROM invite_codes WHERE code = :code");
    $dup->execute([':code' => $code]);
    if ($dup->fetch()) {
        json_error('Invite code already exists', 409);
    }

    $id  = generate_uuid();
    $now = now_iso();

    $db->prepare("
        INSERT INTO invite_codes (id, code, created_by, expires_at, created_at)
        VALUES (:id, :code, :created_by, :expires_at, :created_at)
    ")->execute([
        ':id'         => $id,
        ':code'       => $code,
        ':created_by' => $_SESSION['user_id'],
        ':expires_at' => $body['expires_at'] ?? null,
        ':created_at' => $now,
    ]);

    json_success('Invite code created', ['id' => $id, 'code' => $code]);
}
