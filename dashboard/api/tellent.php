<?php
/**
 * TellentHR / KiwiHR GraphQL API Proxy
 *
 * Proxies requests to the KiwiHR GraphQL API, keeping the API key server-side.
 * Caches responses as JSON files to reduce API calls.
 *
 * Usage: tellent.php?action=employees|absences|projects|status
 */

require_once __DIR__ . '/config.php';

// Load Tellent config (optional - graceful fallback if not configured)
$tellentConfigFile = __DIR__ . '/tellent_config.php';
$tellentConfigured = false;

if (file_exists($tellentConfigFile)) {
    require_once $tellentConfigFile;
    $tellentConfigured = defined('KIWIHR_API_KEY') && KIWIHR_API_KEY !== '' && KIWIHR_API_KEY !== 'DEIN_API_KEY_HIER';
}

set_api_headers();
init_session();

// Auth check
if (empty($_SESSION['user_id'])) {
    json_error('Authentication required', 401);
}

// Check if Tellent is configured
if (!$tellentConfigured) {
    json_response([
        'configured' => false,
        'error' => 'TellentHR API not configured. Add your API key to api/tellent_config.php'
    ]);
}

$action = $_GET['action'] ?? '';

// ---------- GraphQL Queries ----------

$queries = [
    'status' => '{
        users(limit: 1) {
            pageInfo { count }
        }
    }',

    'employees' => '{ users(limit: 200) { items { id firstName lastName email isActive invitationStatus position { name } team { name } teams { name } employmentStartDate } pageInfo { count } } }',

    'absences' => '{
        timeOffTypes(limit: 50) {
            items {
                id
                name
                color
            }
        }
    }',

    'projects' => '{
        projects(limit: 100) {
            items {
                id
                name
                status
            }
            pageInfo { count }
        }
    }',

    'teams' => '{
        teams(limit: 50) {
            items {
                id
                name
            }
            pageInfo { count }
        }
    }',

    'positions' => '{
        positions(limit: 100) {
            items {
                id
                name
            }
            pageInfo { count }
        }
    }',

    'timeoff_balances' => '{
        timeOffBalances {
            items {
                ... on VacationTimeOffBalance { id user { id firstName lastName } available used requested planned totalAvailable periodStartDate periodEndDate timeOffRule { timeOffType { name color } } }
                ... on SickLeaveTimeOffBalance { id user { id firstName lastName } available used requested timeOffRule { timeOffType { name color } } }
                ... on GenericTimeOffBalance { id user { id firstName lastName } available used requested timeOffRule { timeOffType { name color } } }
                ... on CompensatoryTimeOffBalance { id user { id firstName lastName } available used requested timeOffRule { timeOffType { name color } } }
                ... on RemoteTimeOffBalance { id user { id firstName lastName } available used requested timeOffRule { timeOffType { name color } } }
                ... on CustomTimeOffBalance { id user { id firstName lastName } available used requested timeOffRule { timeOffType { name color } } }
            }
            pageInfo { count }
        }
    }',

    'overtime' => '{
        overtimeBalanceStatements(limit: 200) {
            items {
                balance
                user { id firstName lastName }
            }
            pageInfo { count }
        }
    }',
];

// Dynamic queries that need parameters
$dynamicActions = ['attendance', 'timesheet', 'timeoff_usage'];

$validActions = array_merge(array_keys($queries), $dynamicActions);

if (!in_array($action, $validActions)) {
    json_error('Invalid action. Valid: ' . implode(', ', $validActions), 400);
}

// ---------- Input Validation for Dynamic Queries ----------

function validate_date(string $val, string $default): string {
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $val)) {
        return $default;
    }
    return $val;
}

function validate_id(string $val): string {
    if (!preg_match('/^[a-zA-Z0-9_-]+$/', $val)) {
        json_error('Invalid ID format', 400);
    }
    return $val;
}

// Build dynamic queries
if ($action === 'attendance') {
    $dateFrom = validate_date($_GET['from'] ?? '', date('Y-m-01'));
    $dateTo   = validate_date($_GET['to'] ?? '', date('Y-m-d'));
    $queries['attendance'] = '{
        attendanceStatements(filter: {
            date: { operator: BETWEEN, value: { min: "' . $dateFrom . '", max: "' . $dateTo . '" } }
        }) {
            items {
                expectedTime trackedTime totalTime timeOffTime holidayTime
                expectedDays trackedDays totalDays balance overtime
                user { id firstName lastName }
            }
            pageInfo { count }
        }
    }';
} elseif ($action === 'timesheet') {
    $userId = validate_id($_GET['userId'] ?? '');
    $date   = validate_date($_GET['date'] ?? '', date('Y-m-d'));
    if (!$userId) {
        json_error('userId parameter required for timesheet action', 400);
    }
    $queries['timesheet'] = '{
        timesheet(userId: "' . $userId . '", date: "' . $date . '") {
            id date expectedTime trackedTime totalTime breakTime timeOffTime holidayTime
            isWorkday isApproved
            timesheetEntries { id startAt endAt note }
            timeOffs { name isAbsence }
            holidays { name }
        }
    }';
} elseif ($action === 'timeoff_usage') {
    $dateFrom = validate_date($_GET['from'] ?? '', date('Y-01-01'));
    $dateTo   = validate_date($_GET['to'] ?? '', date('Y-12-31'));
    $typeIds  = $_GET['typeIds'] ?? '124726,124727,124728,124729';
    // Validate each ID is numeric
    $typeIdArr = array_map(function($id) {
        $id = trim($id);
        if (!preg_match('/^\d+$/', $id)) {
            json_error('Invalid typeId: must be numeric', 400);
        }
        return '"' . $id . '"';
    }, explode(',', $typeIds));
    $queries['timeoff_usage'] = '{
        timeOffRequestUsageStatements(
            dateFrom: "' . $dateFrom . '"
            dateTo: "' . $dateTo . '"
            timeOffTypeIds: [' . implode(',', $typeIdArr) . ']
            limit: 200
        ) {
            items {
                user { id firstName lastName }
                items { requestCount usage }
            }
            pageInfo { count }
        }
    }';
}

// ---------- Cache Check ----------

if (!is_dir(TELLENT_CACHE_DIR)) {
    mkdir(TELLENT_CACHE_DIR, 0755, true);
}

$cacheKey = $action;
if (in_array($action, $dynamicActions)) {
    $cacheKey .= '_' . md5($queries[$action]);
}
$cacheFile = TELLENT_CACHE_DIR . '/tellent_' . $cacheKey . '.json';

if (file_exists($cacheFile)) {
    $cacheAge = time() - filemtime($cacheFile);
    if ($cacheAge < TELLENT_CACHE_TTL) {
        $cached = file_get_contents($cacheFile);
        $data = json_decode($cached, true);
        if ($data !== null) {
            $data['_cached'] = true;
            $data['_cacheAge'] = $cacheAge;
            json_response($data);
        }
    }
}

// ---------- GraphQL Request ----------

$payload = json_encode(['query' => $queries[$action]]);

$ch = curl_init(KIWIHR_ENDPOINT);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => $payload,
    CURLOPT_HTTPHEADER     => [
        'Content-Type: application/json',
        'X-Api-Key: ' . KIWIHR_API_KEY,
    ],
    CURLOPT_TIMEOUT        => 15,
    CURLOPT_CONNECTTIMEOUT => 5,
    CURLOPT_FOLLOWLOCATION => true,
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
unset($ch);

if ($curlError) {
    json_error('KiwiHR API connection failed: ' . $curlError, 502);
}

if ($httpCode !== 200) {
    $detail = '';
    $parsed = json_decode($response, true);
    if ($parsed && isset($parsed['errors'][0]['message'])) {
        $detail = ': ' . $parsed['errors'][0]['message'];
    }
    json_error('KiwiHR API returned HTTP ' . $httpCode . $detail, $httpCode >= 400 ? $httpCode : 502);
}

$data = json_decode($response, true);

if (!$data || isset($data['errors'])) {
    $errorMsg = 'GraphQL error';
    if (isset($data['errors'][0]['message'])) {
        $errorMsg = $data['errors'][0]['message'];
    }
    json_error($errorMsg, 400);
}

// ---------- Build Response ----------

$result = [
    'configured' => true,
    'action'     => $action,
    '_cached'    => false,
];

if ($action === 'status') {
    $count = $data['data']['users']['pageInfo']['count'] ?? 0;
    $result['ok'] = true;
    $result['employeeCount'] = $count;
} else {
    $result['data'] = $data['data'] ?? [];
}

// ---------- Write Cache ----------

file_put_contents($cacheFile, json_encode($result, JSON_UNESCAPED_UNICODE));

json_response($result);
