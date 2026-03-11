<?php
/**
 * ELBDESK Case Management API Bridge
 *
 * Connects the DGD Dashboard to ELBDESK for Gutachten case data.
 * Falls back to realistic demo data when ELBDESK API is not configured.
 *
 * Usage: elbdesk.php?action=status|cases|case_detail|cases_by_status|gutachter|revenue_summary|kpi_sync|sync
 */

require_once __DIR__ . '/config.php';

// Load ELBDESK config (optional - graceful fallback to demo mode)
$elbdeskConfigFile = __DIR__ . '/elbdesk_config.php';
$elbdeskConfigured = false;

if (file_exists($elbdeskConfigFile)) {
    require_once $elbdeskConfigFile;
    $elbdeskConfigured = defined('ELBDESK_API_URL') && ELBDESK_API_URL !== ''
                      && defined('ELBDESK_API_KEY') && ELBDESK_API_KEY !== '';
}

set_api_headers();
init_session();

// Auth check
if (empty($_SESSION['user_id'])) {
    json_error('Authentication required', 401);
}

$action = $_GET['action'] ?? '';

$validActions = ['status', 'cases', 'case_detail', 'cases_by_status', 'gutachter', 'revenue_summary', 'kpi_sync', 'sync'];

if (!in_array($action, $validActions)) {
    json_error('Invalid action. Valid: ' . implode(', ', $validActions), 400);
}

// ---------- Input Validation ----------

function elbdesk_validate_int(string $val, int $default, int $min = 0, int $max = 1000): int {
    $v = filter_var($val, FILTER_VALIDATE_INT);
    if ($v === false || $v < $min || $v > $max) return $default;
    return $v;
}

function elbdesk_validate_status(string $val): string {
    $allowed = ['offen', 'in_bearbeitung', 'abgeschlossen', 'storniert'];
    return in_array($val, $allowed) ? $val : 'offen';
}

function elbdesk_validate_id(string $val): string {
    if (!preg_match('/^[a-zA-Z0-9_-]+$/', $val)) {
        json_error('Invalid ID format', 400);
    }
    return $val;
}

// ---------- Cache Helpers ----------

if (!is_dir(ELBDESK_CACHE_DIR)) {
    mkdir(ELBDESK_CACHE_DIR, 0755, true);
}

function elbdesk_cache_key(string $action, array $params = []): string {
    $key = 'elbdesk_' . $action;
    if (!empty($params)) {
        $key .= '_' . md5(json_encode($params));
    }
    return ELBDESK_CACHE_DIR . '/' . $key . '.json';
}

function elbdesk_cache_get(string $cacheFile): ?array {
    if (!file_exists($cacheFile)) return null;
    $age = time() - filemtime($cacheFile);
    if ($age >= ELBDESK_CACHE_TTL) return null;
    $data = json_decode(file_get_contents($cacheFile), true);
    if ($data === null) return null;
    $data['source'] = 'cache';
    $data['cached_at'] = gmdate('Y-m-d\TH:i:s\Z', filemtime($cacheFile));
    return $data;
}

function elbdesk_cache_put(string $cacheFile, array $data): void {
    file_put_contents($cacheFile, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
}

function elbdesk_response(array $data, string $source = 'demo'): void {
    $data['status'] = 'success';
    $data['source'] = $source;
    $data['cached_at'] = now_iso();
    json_response($data);
}

// ---------- ELBDESK API Client ----------

function elbdesk_api_request(string $endpoint, string $method = 'GET', ?array $body = null): array {
    $url = rtrim(ELBDESK_API_URL, '/') . '/' . ltrim($endpoint, '/');

    $ch = curl_init($url);
    $headers = [
        'Content-Type: application/json',
        'Authorization: Bearer ' . ELBDESK_API_KEY,
        'Accept: application/json',
    ];

    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_FOLLOWLOCATION => true,
    ]);

    if ($method === 'POST' && $body !== null) {
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    }

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($error) {
        json_error('ELBDESK API connection failed: ' . $error, 502);
    }
    if ($httpCode !== 200) {
        $detail = '';
        $parsed = json_decode($response, true);
        if ($parsed && isset($parsed['message'])) {
            $detail = ': ' . $parsed['message'];
        }
        json_error('ELBDESK API returned HTTP ' . $httpCode . $detail, $httpCode >= 400 ? $httpCode : 502);
    }

    $data = json_decode($response, true);
    if ($data === null) {
        json_error('Invalid JSON response from ELBDESK API', 502);
    }
    return $data;
}

// ---------- Demo Data Generator ----------

function elbdesk_demo_cases(): array {
    $statuses = ['offen', 'offen', 'in_bearbeitung', 'in_bearbeitung', 'in_bearbeitung', 'abgeschlossen', 'abgeschlossen', 'abgeschlossen', 'abgeschlossen', 'storniert'];
    $damageTypes = ['Wasserschaden', 'Brandschaden', 'Sturmschaden', 'Schimmel', 'Baumaengel'];
    $gutachter = [
        ['id' => 'g1', 'name' => 'Dr. Thomas Mueller', 'email' => 't.mueller@dgd.digital'],
        ['id' => 'g2', 'name' => 'Sabine Richter', 'email' => 's.richter@dgd.digital'],
        ['id' => 'g3', 'name' => 'Klaus Hartmann', 'email' => 'k.hartmann@dgd.digital'],
        ['id' => 'g4', 'name' => 'Maria Schneider', 'email' => 'm.schneider@dgd.digital'],
        ['id' => 'g5', 'name' => 'Andreas Weber', 'email' => 'a.weber@dgd.digital'],
    ];
    $insurers = ['Allianz', 'HUK-COBURG', 'AXA', 'ERGO', 'Zurich', 'Generali', 'HDI', 'Provinzial'];
    $cities = ['Hamburg', 'Berlin', 'Muenchen', 'Koeln', 'Frankfurt', 'Duesseldorf', 'Stuttgart', 'Hannover', 'Bremen', 'Luebeck'];
    $streets = ['Hauptstr.', 'Bahnhofstr.', 'Gartenstr.', 'Schulstr.', 'Dorfstr.', 'Bergstr.', 'Lindenstr.', 'Kirchstr.'];

    $cases = [];
    // Seed for consistent demo data
    mt_srand(42);

    for ($i = 1; $i <= 47; $i++) {
        $status = $statuses[mt_rand(0, count($statuses) - 1)];
        $damageType = $damageTypes[mt_rand(0, count($damageTypes) - 1)];
        $assignedGutachter = $gutachter[mt_rand(0, count($gutachter) - 1)];
        $insurer = $insurers[mt_rand(0, count($insurers) - 1)];
        $city = $cities[mt_rand(0, count($cities) - 1)];
        $street = $streets[mt_rand(0, count($streets) - 1)] . ' ' . mt_rand(1, 120);

        // Spread dates across last 6 months
        $daysAgo = mt_rand(0, 180);
        $createdAt = date('Y-m-d', strtotime("-{$daysAgo} days"));
        $updatedAt = $daysAgo > 7 ? date('Y-m-d', strtotime("-" . mt_rand(0, max(0, $daysAgo - 5)) . " days")) : $createdAt;

        $schadensumme = mt_rand(800, 45000);
        $honorar = $status === 'abgeschlossen' ? round($schadensumme * (mt_rand(8, 15) / 100), 2) : 0;

        $cases[] = [
            'id' => 'ELB-' . str_pad($i, 5, '0', STR_PAD_LEFT),
            'aktenzeichen' => 'DGD-' . date('Y', strtotime($createdAt)) . '-' . str_pad($i, 4, '0', STR_PAD_LEFT),
            'status' => $status,
            'damage_type' => $damageType,
            'description' => $damageType . ' - ' . $street . ', ' . $city,
            'location' => ['street' => $street, 'city' => $city, 'plz' => str_pad(mt_rand(10000, 99999), 5, '0', STR_PAD_LEFT)],
            'insurer' => $insurer,
            'policyholder' => 'Kunde ' . $i,
            'gutachter' => $assignedGutachter,
            'schadensumme' => $schadensumme,
            'honorar' => $honorar,
            'created_at' => $createdAt . 'T' . str_pad(mt_rand(8, 17), 2, '0', STR_PAD_LEFT) . ':' . str_pad(mt_rand(0, 59), 2, '0', STR_PAD_LEFT) . ':00Z',
            'updated_at' => $updatedAt . 'T12:00:00Z',
            'priority' => ['normal', 'normal', 'normal', 'hoch', 'dringend'][mt_rand(0, 4)],
        ];
    }

    // Reset seed
    mt_srand();
    return $cases;
}

function elbdesk_demo_timeline(string $caseId, array $case): array {
    $events = [
        ['type' => 'erstellt', 'date' => $case['created_at'], 'user' => 'System', 'note' => 'Fall angelegt: ' . $case['damage_type']],
        ['type' => 'zugewiesen', 'date' => $case['created_at'], 'user' => 'System', 'note' => 'Gutachter zugewiesen: ' . $case['gutachter']['name']],
    ];
    if ($case['status'] !== 'offen') {
        $events[] = ['type' => 'besichtigung', 'date' => date('Y-m-d\TH:i:s\Z', strtotime($case['created_at'] . ' +3 days')), 'user' => $case['gutachter']['name'], 'note' => 'Ortstermin durchgefuehrt'];
        $events[] = ['type' => 'bericht', 'date' => date('Y-m-d\TH:i:s\Z', strtotime($case['created_at'] . ' +10 days')), 'user' => $case['gutachter']['name'], 'note' => 'Gutachten erstellt'];
    }
    if ($case['status'] === 'abgeschlossen') {
        $events[] = ['type' => 'abgeschlossen', 'date' => $case['updated_at'], 'user' => 'System', 'note' => 'Fall abgeschlossen. Honorar: ' . number_format($case['honorar'], 2, ',', '.') . ' EUR'];
    }
    if ($case['status'] === 'storniert') {
        $events[] = ['type' => 'storniert', 'date' => $case['updated_at'], 'user' => 'System', 'note' => 'Fall storniert'];
    }
    return $events;
}

function elbdesk_demo_gutachter(): array {
    return [
        ['id' => 'g1', 'name' => 'Dr. Thomas Mueller', 'email' => 't.mueller@dgd.digital', 'specialization' => 'Wasserschaden, Schimmel', 'active_cases' => 5, 'completed_total' => 127, 'rating' => 4.8, 'active' => true],
        ['id' => 'g2', 'name' => 'Sabine Richter', 'email' => 's.richter@dgd.digital', 'specialization' => 'Brandschaden, Sturmschaden', 'active_cases' => 3, 'completed_total' => 89, 'rating' => 4.6, 'active' => true],
        ['id' => 'g3', 'name' => 'Klaus Hartmann', 'email' => 'k.hartmann@dgd.digital', 'specialization' => 'Baumaengel, Wasserschaden', 'active_cases' => 4, 'completed_total' => 156, 'rating' => 4.9, 'active' => true],
        ['id' => 'g4', 'name' => 'Maria Schneider', 'email' => 'm.schneider@dgd.digital', 'specialization' => 'Sturmschaden, Brandschaden', 'active_cases' => 6, 'completed_total' => 71, 'rating' => 4.5, 'active' => true],
        ['id' => 'g5', 'name' => 'Andreas Weber', 'email' => 'a.weber@dgd.digital', 'specialization' => 'Schimmel, Baumaengel', 'active_cases' => 2, 'completed_total' => 203, 'rating' => 4.7, 'active' => true],
    ];
}

function elbdesk_demo_revenue(): array {
    $months = [];
    for ($i = 5; $i >= 0; $i--) {
        $month = date('Y-m', strtotime("-{$i} months"));
        $base = 18000 + ($i % 3) * 4000;
        $months[] = [
            'month' => $month,
            'revenue' => $base + mt_rand(-2000, 5000),
            'cases_completed' => mt_rand(6, 14),
            'avg_honorar' => round($base / mt_rand(6, 12), 2),
        ];
    }
    return $months;
}

// ---------- Action Handlers ----------

// Cache check helper - returns cached data if valid, or null
function elbdesk_try_cache(string $action, array $params = []): ?array {
    $cacheFile = elbdesk_cache_key($action, $params);
    $cached = elbdesk_cache_get($cacheFile);
    if ($cached !== null) {
        json_response($cached);
    }
    return null; // Not cached
}

// ===== STATUS =====
if ($action === 'status') {
    elbdesk_try_cache('status');

    if ($elbdeskConfigured) {
        $apiData = elbdesk_api_request('/api/v1/status');
        $result = ['data' => ['connected' => true, 'version' => $apiData['version'] ?? 'unknown', 'case_count' => $apiData['case_count'] ?? 0]];
        elbdesk_cache_put(elbdesk_cache_key('status'), $result);
        elbdesk_response($result, 'api');
    }

    $allCases = elbdesk_demo_cases();
    $result = ['data' => [
        'connected' => false,
        'mode' => 'demo',
        'version' => 'demo-1.0',
        'case_count' => count($allCases),
        'message' => 'ELBDESK API not configured. Showing demo data. Set ELBDESK_API_URL and ELBDESK_API_KEY in .env',
    ]];
    elbdesk_cache_put(elbdesk_cache_key('status'), $result);
    elbdesk_response($result, 'demo');
}

// ===== CASES (with pagination) =====
if ($action === 'cases') {
    $limit  = elbdesk_validate_int($_GET['limit'] ?? '20', 20, 1, 100);
    $offset = elbdesk_validate_int($_GET['offset'] ?? '0', 0, 0, 10000);
    $params = ['limit' => $limit, 'offset' => $offset];

    elbdesk_try_cache('cases', $params);

    if ($elbdeskConfigured) {
        $apiData = elbdesk_api_request("/api/v1/cases?limit={$limit}&offset={$offset}");
        $result = ['data' => ['cases' => $apiData['cases'] ?? [], 'total' => $apiData['total'] ?? 0, 'limit' => $limit, 'offset' => $offset]];
        elbdesk_cache_put(elbdesk_cache_key('cases', $params), $result);
        elbdesk_response($result, 'api');
    }

    $allCases = elbdesk_demo_cases();
    $sliced = array_slice($allCases, $offset, $limit);
    $result = ['data' => ['cases' => $sliced, 'total' => count($allCases), 'limit' => $limit, 'offset' => $offset]];
    elbdesk_cache_put(elbdesk_cache_key('cases', $params), $result);
    elbdesk_response($result, 'demo');
}

// ===== CASE DETAIL =====
if ($action === 'case_detail') {
    $caseId = elbdesk_validate_id($_GET['id'] ?? '');

    elbdesk_try_cache('case_detail', ['id' => $caseId]);

    if ($elbdeskConfigured) {
        $apiData = elbdesk_api_request("/api/v1/cases/{$caseId}");
        $result = ['data' => $apiData];
        elbdesk_cache_put(elbdesk_cache_key('case_detail', ['id' => $caseId]), $result);
        elbdesk_response($result, 'api');
    }

    $allCases = elbdesk_demo_cases();
    $found = null;
    foreach ($allCases as $c) {
        if ($c['id'] === $caseId) { $found = $c; break; }
    }
    if (!$found) {
        json_error('Case not found: ' . $caseId, 404);
    }
    $found['timeline'] = elbdesk_demo_timeline($caseId, $found);
    $result = ['data' => $found];
    elbdesk_cache_put(elbdesk_cache_key('case_detail', ['id' => $caseId]), $result);
    elbdesk_response($result, 'demo');
}

// ===== CASES BY STATUS =====
if ($action === 'cases_by_status') {
    $status = elbdesk_validate_status($_GET['status'] ?? 'offen');
    $limit  = elbdesk_validate_int($_GET['limit'] ?? '20', 20, 1, 100);
    $offset = elbdesk_validate_int($_GET['offset'] ?? '0', 0, 0, 10000);
    $params = ['status' => $status, 'limit' => $limit, 'offset' => $offset];

    elbdesk_try_cache('cases_by_status', $params);

    if ($elbdeskConfigured) {
        $apiData = elbdesk_api_request("/api/v1/cases?status={$status}&limit={$limit}&offset={$offset}");
        $result = ['data' => ['cases' => $apiData['cases'] ?? [], 'total' => $apiData['total'] ?? 0, 'status_filter' => $status, 'limit' => $limit, 'offset' => $offset]];
        elbdesk_cache_put(elbdesk_cache_key('cases_by_status', $params), $result);
        elbdesk_response($result, 'api');
    }

    $allCases = elbdesk_demo_cases();
    $filtered = array_values(array_filter($allCases, fn($c) => $c['status'] === $status));
    $sliced = array_slice($filtered, $offset, $limit);
    $result = ['data' => ['cases' => $sliced, 'total' => count($filtered), 'status_filter' => $status, 'limit' => $limit, 'offset' => $offset]];
    elbdesk_cache_put(elbdesk_cache_key('cases_by_status', $params), $result);
    elbdesk_response($result, 'demo');
}

// ===== GUTACHTER =====
if ($action === 'gutachter') {
    elbdesk_try_cache('gutachter');

    if ($elbdeskConfigured) {
        $apiData = elbdesk_api_request('/api/v1/gutachter');
        $result = ['data' => ['gutachter' => $apiData['gutachter'] ?? [], 'total' => count($apiData['gutachter'] ?? [])]];
        elbdesk_cache_put(elbdesk_cache_key('gutachter'), $result);
        elbdesk_response($result, 'api');
    }

    $list = elbdesk_demo_gutachter();
    $result = ['data' => ['gutachter' => $list, 'total' => count($list)]];
    elbdesk_cache_put(elbdesk_cache_key('gutachter'), $result);
    elbdesk_response($result, 'demo');
}

// ===== REVENUE SUMMARY =====
if ($action === 'revenue_summary') {
    elbdesk_try_cache('revenue_summary');

    if ($elbdeskConfigured) {
        $apiData = elbdesk_api_request('/api/v1/reports/revenue');
        $result = ['data' => ['months' => $apiData['months'] ?? [], 'total_revenue' => $apiData['total_revenue'] ?? 0]];
        elbdesk_cache_put(elbdesk_cache_key('revenue_summary'), $result);
        elbdesk_response($result, 'api');
    }

    $months = elbdesk_demo_revenue();
    $totalRevenue = array_sum(array_column($months, 'revenue'));
    $result = ['data' => ['months' => $months, 'total_revenue' => $totalRevenue, 'currency' => 'EUR', 'period' => 'last_6_months']];
    elbdesk_cache_put(elbdesk_cache_key('revenue_summary'), $result);
    elbdesk_response($result, 'demo');
}

// ===== KPI SYNC =====
if ($action === 'kpi_sync') {
    elbdesk_try_cache('kpi_sync');

    if ($elbdeskConfigured) {
        $casesData = elbdesk_api_request('/api/v1/cases?limit=1000');
        $cases = $casesData['cases'] ?? [];
    } else {
        $cases = elbdesk_demo_cases();
    }
    $source = $elbdeskConfigured ? 'api' : 'demo';

    // Calculate KPIs from case data
    $total = count($cases);
    $byStatus = ['offen' => 0, 'in_bearbeitung' => 0, 'abgeschlossen' => 0, 'storniert' => 0];
    $totalHonorar = 0;
    $processingDays = [];
    $thisMonth = date('Y-m');
    $casesThisMonth = 0;

    foreach ($cases as $c) {
        $st = $c['status'] ?? 'offen';
        if (isset($byStatus[$st])) $byStatus[$st]++;

        $totalHonorar += $c['honorar'] ?? 0;

        if ($st === 'abgeschlossen' && isset($c['created_at'], $c['updated_at'])) {
            $created = strtotime(substr($c['created_at'], 0, 10));
            $updated = strtotime(substr($c['updated_at'], 0, 10));
            if ($created && $updated && $updated >= $created) {
                $processingDays[] = ($updated - $created) / 86400;
            }
        }

        if (substr($c['created_at'] ?? '', 0, 7) === $thisMonth) {
            $casesThisMonth++;
        }
    }

    $avgProcessingDays = !empty($processingDays) ? round(array_sum($processingDays) / count($processingDays), 1) : 0;
    $completionRate = $total > 0 ? round(($byStatus['abgeschlossen'] / $total) * 100, 1) : 0;

    $result = ['data' => [
        'total_cases' => $total,
        'cases_this_month' => $casesThisMonth,
        'by_status' => $byStatus,
        'avg_processing_days' => $avgProcessingDays,
        'completion_rate_pct' => $completionRate,
        'total_revenue' => round($totalHonorar, 2),
        'avg_honorar' => $byStatus['abgeschlossen'] > 0 ? round($totalHonorar / $byStatus['abgeschlossen'], 2) : 0,
        'active_gutachter' => count(elbdesk_demo_gutachter()),
        'calculated_at' => now_iso(),
    ]];

    elbdesk_cache_put(elbdesk_cache_key('kpi_sync'), $result);
    elbdesk_response($result, $source);
}

// ===== SYNC (full sync to local DB) =====
if ($action === 'sync') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST' && ($_GET['confirm'] ?? '') !== 'yes') {
        json_error('Sync requires POST request or ?confirm=yes parameter', 405);
    }

    if ($elbdeskConfigured) {
        $casesData = elbdesk_api_request('/api/v1/cases?limit=1000');
        $cases = $casesData['cases'] ?? [];
    } else {
        $cases = elbdesk_demo_cases();
    }
    $source = $elbdeskConfigured ? 'api' : 'demo';

    $db = get_db();

    // Create elbdesk_cases table if not exists
    $db->exec("CREATE TABLE IF NOT EXISTS elbdesk_cases (
        id TEXT PRIMARY KEY,
        aktenzeichen TEXT,
        status TEXT NOT NULL DEFAULT 'offen',
        damage_type TEXT,
        description TEXT,
        location_street TEXT,
        location_city TEXT,
        location_plz TEXT,
        insurer TEXT,
        policyholder TEXT,
        gutachter_id TEXT,
        gutachter_name TEXT,
        schadensumme REAL DEFAULT 0,
        honorar REAL DEFAULT 0,
        priority TEXT DEFAULT 'normal',
        created_at TEXT,
        updated_at TEXT,
        synced_at TEXT
    )");

    // Create elbdesk_sync_log table if not exists
    $db->exec("CREATE TABLE IF NOT EXISTS elbdesk_sync_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        synced_at TEXT NOT NULL,
        source TEXT NOT NULL,
        cases_synced INTEGER DEFAULT 0,
        cases_new INTEGER DEFAULT 0,
        cases_updated INTEGER DEFAULT 0,
        duration_ms INTEGER DEFAULT 0
    )");

    $startTime = microtime(true);
    $synced = 0;
    $newCount = 0;
    $updatedCount = 0;

    $insertStmt = $db->prepare("INSERT OR REPLACE INTO elbdesk_cases
        (id, aktenzeichen, status, damage_type, description, location_street, location_city, location_plz,
         insurer, policyholder, gutachter_id, gutachter_name, schadensumme, honorar, priority, created_at, updated_at, synced_at)
        VALUES (:id, :aktenzeichen, :status, :damage_type, :description, :location_street, :location_city, :location_plz,
                :insurer, :policyholder, :gutachter_id, :gutachter_name, :schadensumme, :honorar, :priority, :created_at, :updated_at, :synced_at)
    ");

    // Check existing IDs
    $existingIds = [];
    foreach ($db->query("SELECT id FROM elbdesk_cases")->fetchAll() as $row) {
        $existingIds[$row['id']] = true;
    }

    $db->beginTransaction();
    try {
        foreach ($cases as $c) {
            $isNew = !isset($existingIds[$c['id']]);
            $insertStmt->execute([
                ':id' => $c['id'],
                ':aktenzeichen' => $c['aktenzeichen'] ?? null,
                ':status' => $c['status'],
                ':damage_type' => $c['damage_type'] ?? null,
                ':description' => $c['description'] ?? null,
                ':location_street' => $c['location']['street'] ?? null,
                ':location_city' => $c['location']['city'] ?? null,
                ':location_plz' => $c['location']['plz'] ?? null,
                ':insurer' => $c['insurer'] ?? null,
                ':policyholder' => $c['policyholder'] ?? null,
                ':gutachter_id' => $c['gutachter']['id'] ?? null,
                ':gutachter_name' => $c['gutachter']['name'] ?? null,
                ':schadensumme' => $c['schadensumme'] ?? 0,
                ':honorar' => $c['honorar'] ?? 0,
                ':priority' => $c['priority'] ?? 'normal',
                ':created_at' => $c['created_at'] ?? null,
                ':updated_at' => $c['updated_at'] ?? null,
                ':synced_at' => now_iso(),
            ]);
            $synced++;
            if ($isNew) $newCount++;
            else $updatedCount++;
        }
        $db->commit();
    } catch (Exception $e) {
        $db->rollBack();
        json_error('Sync failed: ' . $e->getMessage(), 500);
    }

    $durationMs = round((microtime(true) - $startTime) * 1000);

    // Log sync
    $logStmt = $db->prepare("INSERT INTO elbdesk_sync_log (synced_at, source, cases_synced, cases_new, cases_updated, duration_ms) VALUES (:at, :src, :synced, :new, :updated, :ms)");
    $logStmt->execute([':at' => now_iso(), ':src' => $source, ':synced' => $synced, ':new' => $newCount, ':updated' => $updatedCount, ':ms' => $durationMs]);

    // Invalidate all elbdesk caches after sync
    $cacheFiles = glob(ELBDESK_CACHE_DIR . '/elbdesk_*.json');
    if ($cacheFiles) {
        foreach ($cacheFiles as $f) { unlink($f); }
    }

    $result = ['data' => [
        'cases_synced' => $synced,
        'cases_new' => $newCount,
        'cases_updated' => $updatedCount,
        'duration_ms' => $durationMs,
        'synced_at' => now_iso(),
    ]];
    elbdesk_response($result, $source);
}

json_error('Unhandled action: ' . $action, 500);
