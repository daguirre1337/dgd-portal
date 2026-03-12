<?php
/**
 * DGD Dashboard - Main API Router
 *
 * Declarative route table dispatching to handler modules.
 *
 * Auth Endpoints:
 *   POST /api/auth/login, /register, /logout  |  GET /api/auth/me
 *
 * Project & Milestone Endpoints:
 *   GET|POST /api/projects  |  PUT|DELETE /api/projects/{id}
 *   POST /api/projects/{id}/milestones  |  PUT /api/milestones/{id}
 *
 * KPI Endpoints:
 *   GET|POST /api/kpis  |  GET /api/kpis/{id}/history
 *
 * Goal/OKR Endpoints: (see handlers/goals.php)
 * Feedback Endpoints:  (see handlers/feedback.php)
 * Finance Endpoints:   (see handlers/finance.php)
 *
 * Admin Endpoints:
 *   GET|POST /api/invite-codes
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/router_core.php';
require_once __DIR__ . '/crud_helpers.php';

// Handler modules
require_once __DIR__ . '/handlers/auth.php';
require_once __DIR__ . '/handlers/projects.php';
require_once __DIR__ . '/handlers/kpis.php';
require_once __DIR__ . '/handlers/admin.php';

require_once __DIR__ . '/handlers/goals.php';
require_once __DIR__ . '/handlers/feedback.php';
require_once __DIR__ . '/handlers/finance.php';
require_once __DIR__ . '/handlers/export.php';

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
$method = $_SERVER['REQUEST_METHOD'];
$path   = rtrim(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH), '/');

// UUID pattern for route matching
$UUID = '[a-f0-9-]+';

// ---- Route Table ----
// Format: [HTTP_METHOD, regex_pattern, handler_function, auth_level]
// auth_level: 'none' = no auth, 'auth' = requireAuth(), 'admin' = requireAdmin()

$routes = [
    // Auth (no auth required)
    ['POST', '#/api/auth/login$#',    'handle_login',    'none'],
    ['POST', '#/api/auth/register$#', 'handle_register', 'none'],
    ['POST', '#/api/auth/logout$#',   'handle_logout',   'none'],
    ['GET',  '#/api/auth/me$#',       'handle_auth_me',  'auth'],

    // Projects & Milestones
    ['POST', "#/api/projects/({$UUID})/milestones$#i", 'handle_create_milestone', 'auth'],
    ['GET',  '#/api/projects$#',                        'handle_list_projects',    'auth'],
    ['POST', '#/api/projects$#',                        'handle_create_project',   'auth'],
    ['PUT',  "#/api/projects/({$UUID})$#i",             'handle_update_project',   'auth'],
    ['DELETE', "#/api/projects/({$UUID})$#i",           'handle_delete_project',   'auth'],
    ['PUT',  "#/api/milestones/({$UUID})$#i",           'handle_update_milestone', 'auth'],

    // KPIs
    ['GET',  "#/api/kpis/({$UUID})/history$#i", 'handle_kpi_history',  'auth'],
    ['GET',  '#/api/kpis$#',                     'handle_list_kpis',    'auth'],
    ['POST', '#/api/kpis$#',                     'handle_upsert_kpi',   'auth'],

    // Goals / OKR (read: auth, write: admin)
    ['POST', "#/api/goals/({$UUID})/key-results$#i", 'handle_create_key_result', 'admin'],
    ['GET',  '#/api/goals/stats$#',                   'handle_goals_stats',       'auth'],
    ['GET',  "#/api/goals/({$UUID})$#i",              'handle_get_goal',          'auth'],
    ['GET',  '#/api/goals$#',                          'handle_list_goals',        'auth'],
    ['POST', '#/api/goals$#',                          'handle_create_goal',       'admin'],
    ['PUT',  "#/api/goals/({$UUID})$#i",               'handle_update_goal',       'admin'],
    ['DELETE', "#/api/goals/({$UUID})$#i",             'handle_delete_goal',       'admin'],
    ['PUT',  "#/api/key-results/({$UUID})$#i",         'handle_update_key_result', 'admin'],
    ['DELETE', "#/api/key-results/({$UUID})$#i",       'handle_delete_key_result', 'admin'],

    // Feedback
    ['GET',  '#/api/feedback/pulse-status$#',                   'handle_pulse_status',            'auth'],
    ['GET',  '#/api/feedback/trends$#',                          'handle_feedback_trends',         'auth'],
    ['GET',  "#/api/feedback/results/({$UUID})$#i",             'handle_feedback_results',        'auth'],
    ['GET',  "#/api/feedback/templates/({$UUID})$#i",           'handle_get_feedback_template',   'auth'],
    ['GET',  '#/api/feedback/templates$#',                       'handle_list_feedback_templates', 'auth'],
    ['POST', '#/api/feedback/templates$#',                       'handle_create_feedback_template','auth'],
    ['PUT',  "#/api/feedback/templates/({$UUID})$#i",           'handle_update_feedback_template','auth'],
    ['POST', '#/api/feedback/responses$#',                       'handle_submit_feedback_response','auth'],

    // Finance (admin only)
    ['GET',    '#/api/finance/summary$#',                'handle_finance_summary',  'admin'],
    ['GET',    '#/api/finance/monthly$#',                'handle_finance_monthly',  'admin'],
    ['GET',    '#/api/finance/projects$#',               'handle_finance_projects', 'admin'],
    ['PUT',    "#/api/finance/expenses/({$UUID})$#i",    'handle_update_expense',   'admin'],
    ['DELETE', "#/api/finance/expenses/({$UUID})$#i",    'handle_delete_expense',   'admin'],
    ['POST',   '#/api/finance/expenses$#',               'handle_create_expense',   'admin'],
    ['GET',    '#/api/finance/expenses$#',               'handle_list_expenses',    'admin'],
    ['POST',   '#/api/finance/revenue$#',                'handle_create_revenue',   'admin'],
    ['GET',    '#/api/finance/revenue$#',                'handle_list_revenue',     'admin'],

    // Export / Reports
    ['GET',  '#/api/export$#',       'handle_export',              'auth'],

    // Admin
    ['GET',  '#/api/admin/users$#',                     'handle_list_users',          'admin'],
    ['PUT',  "#/api/admin/users/({$UUID})/role$#i",     'handle_update_user_role',    'admin'],
    ['DELETE', "#/api/admin/users/({$UUID})$#i",        'handle_delete_user',         'admin'],
    ['GET',  '#/api/invite-codes$#',                     'handle_list_invite_codes',   'admin'],
    ['POST', '#/api/invite-codes$#',                     'handle_create_invite_code',  'admin'],
];

// ---- Dispatch ----
try {
    if (!dispatch($method, $path, $routes)) {
        json_error('Not found: ' . $method . ' ' . $path, 404);
    }
} catch (PDOException $e) {
    error_log('DGD Dashboard DB Error: ' . $e->getMessage());
    json_error('Database error', 500);
} catch (Exception $e) {
    error_log('DGD Dashboard Error: ' . $e->getMessage());
    json_error('Internal server error', 500);
}
