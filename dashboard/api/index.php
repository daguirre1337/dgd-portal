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
require_once __DIR__ . '/handlers/crm.php';

// ---- Auto-initialize database if tables are missing ----
require_once __DIR__ . '/init_db.php';
$_db_check = get_db();
$_table_count = (int) $_db_check->query(
    "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='users'"
)->fetchColumn();
if ($_table_count === 0) {
    init_database();
} else {
    // Run migrations for new tables on existing DBs
    crm_ensure_tables();
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

    // Goals / OKR
    ['POST', "#/api/goals/({$UUID})/key-results$#i", 'handle_create_key_result', 'auth'],
    ['GET',  '#/api/goals/stats$#',                   'handle_goals_stats',       'auth'],
    ['GET',  "#/api/goals/({$UUID})$#i",              'handle_get_goal',          'auth'],
    ['GET',  '#/api/goals$#',                          'handle_list_goals',        'auth'],
    ['POST', '#/api/goals$#',                          'handle_create_goal',       'auth'],
    ['PUT',  "#/api/goals/({$UUID})$#i",               'handle_update_goal',       'auth'],
    ['DELETE', "#/api/goals/({$UUID})$#i",             'handle_delete_goal',       'auth'],
    ['PUT',  "#/api/key-results/({$UUID})$#i",         'handle_update_key_result', 'auth'],
    ['DELETE', "#/api/key-results/({$UUID})$#i",       'handle_delete_key_result', 'auth'],

    // Feedback
    ['GET',  '#/api/feedback/pulse-status$#',                   'handle_pulse_status',            'auth'],
    ['GET',  '#/api/feedback/trends$#',                          'handle_feedback_trends',         'auth'],
    ['GET',  "#/api/feedback/results/({$UUID})$#i",             'handle_feedback_results',        'auth'],
    ['GET',  "#/api/feedback/templates/({$UUID})$#i",           'handle_get_feedback_template',   'auth'],
    ['GET',  '#/api/feedback/templates$#',                       'handle_list_feedback_templates', 'auth'],
    ['POST', '#/api/feedback/templates$#',                       'handle_create_feedback_template','auth'],
    ['PUT',  "#/api/feedback/templates/({$UUID})$#i",           'handle_update_feedback_template','auth'],
    ['POST', '#/api/feedback/responses$#',                       'handle_submit_feedback_response','auth'],

    // Finance
    ['GET',    '#/api/finance/summary$#',                'handle_finance_summary',  'auth'],
    ['GET',    '#/api/finance/monthly$#',                'handle_finance_monthly',  'auth'],
    ['GET',    '#/api/finance/projects$#',               'handle_finance_projects', 'auth'],
    ['PUT',    "#/api/finance/expenses/({$UUID})$#i",    'handle_update_expense',   'auth'],
    ['DELETE', "#/api/finance/expenses/({$UUID})$#i",    'handle_delete_expense',   'auth'],
    ['POST',   '#/api/finance/expenses$#',               'handle_create_expense',   'auth'],
    ['GET',    '#/api/finance/expenses$#',               'handle_list_expenses',    'auth'],
    ['POST',   '#/api/finance/revenue$#',                'handle_create_revenue',   'auth'],
    ['GET',    '#/api/finance/revenue$#',                'handle_list_revenue',     'auth'],

    // Export / Reports
    ['GET',  '#/api/export$#',       'handle_export',              'auth'],

    // CRM
    ['GET',    '#/api/crm/stats$#',                                'handle_crm_stats',               'auth'],
    ['GET',    '#/api/crm/pipeline$#',                             'handle_crm_pipeline',            'auth'],
    ['POST',   '#/api/crm/import/trello$#',                        'handle_crm_import_trello',       'admin'],
    ['POST',   '#/api/crm/interactions$#',                         'handle_create_crm_interaction',  'auth'],
    ['GET',    "#/api/crm/contacts/({$UUID})/interactions$#i",     'handle_crm_contact_interactions', 'auth'],
    ['GET',    '#/api/crm/contacts$#',                             'handle_list_crm_contacts',       'auth'],
    ['POST',   '#/api/crm/contacts$#',                             'handle_create_crm_contact',      'auth'],
    ['PUT',    "#/api/crm/contacts/({$UUID})$#i",                  'handle_update_crm_contact',      'auth'],
    ['DELETE', "#/api/crm/contacts/({$UUID})$#i",                  'handle_delete_crm_contact',      'auth'],
    ['GET',    '#/api/crm/deals$#',                                'handle_list_crm_deals',          'auth'],
    ['POST',   '#/api/crm/deals$#',                                'handle_create_crm_deal',         'auth'],
    ['PUT',    "#/api/crm/deals/({$UUID})$#i",                     'handle_update_crm_deal',         'auth'],
    ['DELETE', "#/api/crm/deals/({$UUID})$#i",                     'handle_delete_crm_deal',         'auth'],

    // Admin
    ['GET',  '#/api/admin/users$#',            'handle_list_users',          'admin'],
    ['GET',  '#/api/admin/page-owners$#',      'handle_list_page_owners',    'auth'],
    ['PUT',  '#/api/admin/page-owners/([a-z-]+)$#', 'handle_update_page_owner', 'admin'],
    ['GET',  '#/api/invite-codes$#',           'handle_list_invite_codes',   'admin'],
    ['POST', '#/api/invite-codes$#',           'handle_create_invite_code',  'admin'],
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
