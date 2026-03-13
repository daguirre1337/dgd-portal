<?php
/**
 * DGD Portal - Main API Router
 *
 * Routes all /api/dgd/* requests to the appropriate handler.
 *
 * Endpoints:
 *   GET  /api/dgd/partners          - List partners (optional filters)
 *   GET  /api/dgd/partners/nearby   - Nearby search by lat/lng
 *   GET  /api/dgd/partners/{id}     - Partner detail
 *   POST /api/dgd/waitlist          - Join partner waitlist + CRM lead + email
 *   POST /api/dgd/rente             - Rente partner signup + CRM lead + email
 *   POST /api/dgd/cases             - Create damage report + email
 *   GET  /api/dgd/cases/{ref}       - Check case status by reference ID
 *   GET  /api/dgd/geocode           - Nominatim geocoding proxy
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/email_helper.php';

// ---- Auto-initialize database if tables are missing ----
require_once __DIR__ . '/init_db.php';
$_db_check = get_db();
$_table_count = (int)$_db_check->query(
    "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='dgd_partners'"
)->fetchColumn();
if ($_table_count === 0) {
    init_database();
}
unset($_db_check, $_table_count);

// ---- Headers ----
set_api_headers();

// ---- Parse request ----
$method     = $_SERVER['REQUEST_METHOD'];
$requestUri = $_SERVER['REQUEST_URI'] ?? '/';

// Strip query string for route matching
$path = parse_url($requestUri, PHP_URL_PATH);

// Normalize: remove trailing slash, ensure leading /api/dgd prefix
$path = rtrim($path, '/');

// ---- Router ----
try {
    // GET /api/dgd/partners/nearby
    if ($method === 'GET' && preg_match('#/api/dgd/partners/nearby$#', $path)) {
        handle_partners_nearby();
    }
    // GET /api/dgd/partners/{id}
    elseif ($method === 'GET' && preg_match('#/api/dgd/partners/([a-f0-9-]+)$#i', $path, $m)) {
        handle_partner_detail($m[1]);
    }
    // GET /api/dgd/partners
    elseif ($method === 'GET' && preg_match('#/api/dgd/partners$#', $path)) {
        handle_partners_list();
    }
    // POST /api/dgd/waitlist
    elseif ($method === 'POST' && preg_match('#/api/dgd/waitlist$#', $path)) {
        handle_waitlist_join();
    }
    // GET /api/dgd/geocode
    elseif ($method === 'GET' && preg_match('#/api/dgd/geocode$#', $path)) {
        handle_geocode();
    }
    // POST /api/dgd/rente
    elseif ($method === 'POST' && preg_match('#/api/dgd/rente$#', $path)) {
        handle_rente_signup();
    }
    // POST /api/dgd/cases
    elseif ($method === 'POST' && preg_match('#/api/dgd/cases$#', $path)) {
        handle_create_case();
    }
    // GET /api/dgd/cases/{reference_id}
    elseif ($method === 'GET' && preg_match('#/api/dgd/cases/([A-Z0-9-]+)$#', $path, $m)) {
        handle_get_case($m[1]);
    }
    // Fallback
    else {
        json_error('Not found: ' . $method . ' ' . $path, 404);
    }
} catch (PDOException $e) {
    error_log('DGD API DB Error: ' . $e->getMessage());
    json_error('Database error', 500);
} catch (Exception $e) {
    error_log('DGD API Error: ' . $e->getMessage());
    json_error('Internal server error', 500);
}


// ============================================================
//  HANDLERS
// ============================================================

/**
 * GET /api/dgd/partners
 *
 * Query params:
 *   specialty  - Filter by specialty (kfz, gebaeude, hausrat, allgemein)
 *   available  - Filter by availability (1 or 0)
 *   city       - Filter by city name (partial match)
 *   plz        - Filter by PLZ prefix
 *   limit      - Max results (default 50, max 200)
 *   offset     - Pagination offset (default 0)
 */
function handle_partners_list(): void
{
    $db = get_db();

    $where  = [];
    $params = [];

    // Specialty filter
    if (!empty($_GET['specialty'])) {
        $where[]             = 'specialty = :specialty';
        $params[':specialty'] = $_GET['specialty'];
    }

    // Availability filter
    if (isset($_GET['available']) && $_GET['available'] !== '') {
        $where[]              = 'available = :available';
        $params[':available'] = (int)$_GET['available'];
    }

    // City filter (partial match)
    if (!empty($_GET['city'])) {
        $where[]          = 'city LIKE :city';
        $params[':city']  = '%' . $_GET['city'] . '%';
    }

    // PLZ prefix filter
    if (!empty($_GET['plz'])) {
        $where[]         = 'plz LIKE :plz';
        $params[':plz']  = $_GET['plz'] . '%';
    }

    $whereClause = count($where) > 0 ? 'WHERE ' . implode(' AND ', $where) : '';

    $limit  = min(max((int)($_GET['limit'] ?? 50), 1), 200);
    $offset = max((int)($_GET['offset'] ?? 0), 0);

    // Count total
    $countStmt = $db->prepare("SELECT COUNT(*) FROM dgd_partners {$whereClause}");
    $countStmt->execute($params);
    $total = (int)$countStmt->fetchColumn();

    // Fetch rows
    $sql  = "SELECT * FROM dgd_partners {$whereClause} ORDER BY rating DESC, name ASC LIMIT :limit OFFSET :offset";
    $stmt = $db->prepare($sql);
    foreach ($params as $k => $v) {
        $stmt->bindValue($k, $v);
    }
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();
    $partners = $stmt->fetchAll();

    // Cast numeric fields
    $partners = array_map('cast_partner_types', $partners);

    json_response([
        'partners' => $partners,
        'total'    => $total,
        'limit'    => $limit,
        'offset'   => $offset,
    ]);
}


/**
 * GET /api/dgd/partners/nearby
 *
 * Query params (required):
 *   lat       - Latitude
 *   lng       - Longitude
 *
 * Optional:
 *   radius_km - Search radius in km (default 50)
 *   specialty - Filter by specialty
 *   limit     - Max results (default 20)
 */
function handle_partners_nearby(): void
{
    $lat = isset($_GET['lat']) ? (float)$_GET['lat'] : null;
    $lng = isset($_GET['lng']) ? (float)$_GET['lng'] : null;

    if ($lat === null || $lng === null) {
        json_error('Missing required parameters: lat, lng', 400);
    }

    if ($lat < -90 || $lat > 90 || $lng < -180 || $lng > 180) {
        json_error('Invalid coordinates', 400);
    }

    $radius_km = max((float)($_GET['radius_km'] ?? 50), 1);
    $limit     = min(max((int)($_GET['limit'] ?? 20), 1), 100);

    $db = get_db();

    // Build query - we fetch all available partners and compute distance in PHP
    // (SQLite has no native geo functions)
    $where  = ['available = 1'];
    $params = [];

    if (!empty($_GET['specialty'])) {
        $where[]             = 'specialty = :specialty';
        $params[':specialty'] = $_GET['specialty'];
    }

    $whereClause = 'WHERE ' . implode(' AND ', $where);

    // Bounding box pre-filter (rough, speeds up large datasets)
    $latDelta = $radius_km / 111.0;  // ~111 km per degree latitude
    $lngDelta = $radius_km / (111.0 * cos(deg2rad($lat)));

    $where[]           = 'lat BETWEEN :lat_min AND :lat_max';
    $where[]           = 'lng BETWEEN :lng_min AND :lng_max';
    $params[':lat_min'] = $lat - $latDelta;
    $params[':lat_max'] = $lat + $latDelta;
    $params[':lng_min'] = $lng - $lngDelta;
    $params[':lng_max'] = $lng + $lngDelta;

    $whereClause = 'WHERE ' . implode(' AND ', $where);

    $stmt = $db->prepare("SELECT * FROM dgd_partners {$whereClause}");
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    // Compute exact distance and filter
    $results = [];
    foreach ($rows as $row) {
        $dist = haversine($lat, $lng, (float)$row['lat'], (float)$row['lng']);
        if ($dist <= $radius_km) {
            $row['distance_km'] = $dist;
            $results[] = cast_partner_types($row);
        }
    }

    // Sort by distance
    usort($results, function($a, $b) { return $a['distance_km'] <=> $b['distance_km']; });

    // Apply limit
    $results = array_slice($results, 0, $limit);

    json_response([
        'partners'  => $results,
        'total'     => count($results),
        'search'    => [
            'lat'       => $lat,
            'lng'       => $lng,
            'radius_km' => $radius_km,
        ],
    ]);
}


/**
 * GET /api/dgd/partners/{id}
 */
function handle_partner_detail(string $id): void
{
    $db   = get_db();
    $stmt = $db->prepare("SELECT * FROM dgd_partners WHERE id = :id");
    $stmt->execute([':id' => $id]);
    $partner = $stmt->fetch();

    if (!$partner) {
        json_error('Partner not found', 404);
    }

    json_response(['partner' => cast_partner_types($partner)]);
}


/**
 * POST /api/dgd/waitlist
 *
 * Body (JSON):
 *   name       - required
 *   email      - required
 *   phone      - required
 *   specialty  - required
 *   plz        - required
 *   city       - required
 *   company, other_specialty, experience_years, certifications, message - optional
 */
function handle_waitlist_join(): void
{
    $body = get_json_body();

    // Required fields
    $required = ['name', 'email', 'phone', 'specialty', 'plz', 'city'];
    $missing  = [];
    foreach ($required as $field) {
        if (empty($body[$field])) {
            $missing[] = $field;
        }
    }
    if (count($missing) > 0) {
        json_error('Missing required fields: ' . implode(', ', $missing), 400);
    }

    // Basic email validation
    if (!filter_var($body['email'], FILTER_VALIDATE_EMAIL)) {
        json_error('Invalid email address', 400);
    }

    // Check for duplicate email + specialty
    $db   = get_db();
    $dup  = $db->prepare("SELECT id FROM dgd_waitlist WHERE email = :email AND specialty = :specialty AND status = 'pending'");
    $dup->execute([':email' => $body['email'], ':specialty' => $body['specialty']]);
    if ($dup->fetch()) {
        json_error('You are already on the waitlist for this specialty', 409);
    }

    $now = now_iso();
    $id  = generate_uuid();

    $stmt = $db->prepare("
        INSERT INTO dgd_waitlist
            (id, name, company, email, phone, specialty, other_specialty,
             plz, city, experience_years, certifications, message,
             status, created_at, updated_at)
        VALUES
            (:id, :name, :company, :email, :phone, :specialty, :other_specialty,
             :plz, :city, :experience_years, :certifications, :message,
             'pending', :created_at, :updated_at)
    ");

    $stmt->execute([
        ':id'               => $id,
        ':name'             => trim($body['name']),
        ':company'          => trim($body['company'] ?? ''),
        ':email'            => trim($body['email']),
        ':phone'            => trim($body['phone']),
        ':specialty'        => trim($body['specialty']),
        ':other_specialty'  => trim($body['other_specialty'] ?? ''),
        ':plz'              => trim($body['plz']),
        ':city'             => trim($body['city']),
        ':experience_years' => !empty($body['experience_years']) ? (int)$body['experience_years'] : null,
        ':certifications'   => trim($body['certifications'] ?? ''),
        ':message'          => trim($body['message'] ?? ''),
        ':created_at'       => $now,
        ':updated_at'       => $now,
    ]);

    // Send notification email
    send_notification_email(
        MAIL_NOTIFY_ADDRESS,
        'Neue Partner-Bewerbung: ' . trim($body['name']),
        build_partner_email_body($body, 'partner')
    );

    // Create CRM lead in dashboard
    create_crm_lead([
        'name'         => trim($body['name']),
        'email'        => trim($body['email']),
        'phone'        => trim($body['phone']),
        'organization' => trim($body['company'] ?? ''),
        'role'         => trim($body['specialty'] ?? 'kfz') . ' Gutachter',
        'source'       => 'website-partner',
        'tags'         => json_encode(['Website-Anfrage', 'Partner', trim($body['specialty'] ?? '')]),
        'notes'        => 'PLZ: ' . trim($body['plz'] ?? '') . ' ' . trim($body['city'] ?? '')
                        . ($body['message'] ? "\n" . trim($body['message']) : ''),
    ]);

    json_success('Successfully joined the waitlist', [
        'id'         => $id,
        'status'     => 'pending',
        'created_at' => $now,
    ]);
}


/**
 * GET /api/dgd/geocode
 *
 * Nominatim proxy to avoid CORS issues and set proper User-Agent.
 *
 * Query params:
 *   q      - Search query (forward geocoding)
 *   lat    - Latitude  (reverse geocoding, requires lng)
 *   lng    - Longitude (reverse geocoding, requires lat)
 *   limit  - Max results (default 5, max 10)
 */
function handle_geocode(): void
{
    $q   = $_GET['q'] ?? '';
    $lat = $_GET['lat'] ?? '';
    $lng = $_GET['lng'] ?? '';

    if (empty($q) && (empty($lat) || empty($lng))) {
        json_error('Provide either q (search) or lat+lng (reverse geocode)', 400);
    }

    $limit = min(max((int)($_GET['limit'] ?? 5), 1), 10);

    // Build Nominatim URL
    if (!empty($q)) {
        // Forward geocode
        $url = 'https://nominatim.openstreetmap.org/search?'
             . http_build_query([
                   'q'              => $q,
                   'format'         => 'json',
                   'addressdetails' => 1,
                   'limit'          => $limit,
                   'countrycodes'   => 'de',
               ]);
    } else {
        // Reverse geocode
        $url = 'https://nominatim.openstreetmap.org/reverse?'
             . http_build_query([
                   'lat'            => (float)$lat,
                   'lon'            => (float)$lng,
                   'format'         => 'json',
                   'addressdetails' => 1,
               ]);
    }

    $opts = [
        'http' => [
            'method'  => 'GET',
            'header'  => "User-Agent: DGD-Portal/1.0 (info@dgd.digital)\r\n"
                       . "Accept: application/json\r\n",
            'timeout' => 5,
        ],
    ];
    $ctx    = stream_context_create($opts);
    $result = @file_get_contents($url, false, $ctx);

    if ($result === false) {
        json_error('Geocoding service unavailable', 502);
    }

    $decoded = json_decode($result, true);
    if ($decoded === null) {
        json_error('Invalid response from geocoding service', 502);
    }

    // For reverse geocode, Nominatim returns a single object, wrap in array
    if (!empty($lat) && !empty($lng) && isset($decoded['lat'])) {
        $decoded = [$decoded];
    }

    json_response([
        'results' => $decoded,
        'count'   => is_array($decoded) ? count($decoded) : 0,
    ]);
}


/**
 * POST /api/dgd/rente
 *
 * Body (JSON):
 *   name       - required
 *   phone      - required
 *   email, plz, experience_years, retirement_date, message - optional
 */
function handle_rente_signup(): void
{
    $body = get_json_body();

    if (empty($body['name']) || empty($body['phone'])) {
        json_error('Name und Telefonnummer sind Pflichtfelder.', 400);
    }

    $db = get_db();

    // Ensure table exists
    $db->exec("
        CREATE TABLE IF NOT EXISTS dgd_rente_partners (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            email TEXT DEFAULT '',
            plz TEXT DEFAULT '',
            experience_years INTEGER,
            retirement_date TEXT DEFAULT '',
            message TEXT DEFAULT '',
            status TEXT DEFAULT 'new',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    ");

    // Duplicate check on phone
    $dup = $db->prepare("SELECT id FROM dgd_rente_partners WHERE phone = :phone AND status = 'new'");
    $dup->execute([':phone' => trim($body['phone'])]);
    if ($dup->fetch()) {
        json_error('Sie sind bereits als Empfehlungspartner registriert.', 409);
    }

    $now = now_iso();
    $id  = generate_uuid();

    $stmt = $db->prepare("
        INSERT INTO dgd_rente_partners
            (id, name, phone, email, plz, experience_years, retirement_date, message, status, created_at, updated_at)
        VALUES
            (:id, :name, :phone, :email, :plz, :experience_years, :retirement_date, :message, 'new', :created_at, :updated_at)
    ");

    $stmt->execute([
        ':id'               => $id,
        ':name'             => trim($body['name']),
        ':phone'            => trim($body['phone']),
        ':email'            => trim($body['email'] ?? ''),
        ':plz'              => trim($body['plz'] ?? ''),
        ':experience_years' => !empty($body['experience_years']) ? (int)$body['experience_years'] : null,
        ':retirement_date'  => trim($body['retirement_date'] ?? ''),
        ':message'          => trim($body['message'] ?? ''),
        ':created_at'       => $now,
        ':updated_at'       => $now,
    ]);

    // Send notification email
    send_notification_email(
        MAIL_NOTIFY_ADDRESS,
        'Neuer Empfehlungspartner (Rente): ' . trim($body['name']),
        build_partner_email_body($body, 'rente')
    );

    // Create CRM lead in dashboard
    create_crm_lead([
        'name'         => trim($body['name']),
        'email'        => trim($body['email'] ?? ''),
        'phone'        => trim($body['phone']),
        'organization' => '',
        'role'         => 'Empfehlungspartner (Rente)',
        'source'       => 'website-rente',
        'tags'         => json_encode(['Website-Anfrage', 'Rente-Partner']),
        'notes'        => 'PLZ: ' . trim($body['plz'] ?? '')
                        . ($body['message'] ? "\n" . trim($body['message']) : ''),
    ]);

    json_success('Vielen Dank! Wir melden uns innerhalb von 24 Stunden.', [
        'id'         => $id,
        'status'     => 'new',
        'created_at' => $now,
    ]);
}


// ============================================================
//  CASES HANDLERS (Schadensmeldungen)
// ============================================================

/**
 * POST /api/dgd/cases
 *
 * Body (JSON):
 *   name                 - required
 *   email                - required
 *   phone                - required
 *   accident_date, accident_location, accident_description,
 *   license_plate, vehicle_brand, vehicle_model,
 *   insurance_opponent, claim_number - optional
 */
function handle_create_case(): void
{
    $body = get_json_body();

    // Required fields
    $required = ['name', 'email', 'phone'];
    $missing  = [];
    foreach ($required as $field) {
        if (empty(trim($body[$field] ?? ''))) {
            $missing[] = $field;
        }
    }
    if (count($missing) > 0) {
        json_error('Pflichtfelder fehlen: ' . implode(', ', $missing), 400);
    }

    if (!filter_var($body['email'], FILTER_VALIDATE_EMAIL)) {
        json_error('Ungueltige E-Mail-Adresse', 400);
    }

    $db  = get_db();

    // Ensure dgd_cases table exists
    $db->exec("
        CREATE TABLE IF NOT EXISTS dgd_cases (
            id TEXT PRIMARY KEY,
            reference_id TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            phone TEXT NOT NULL,
            accident_date TEXT,
            accident_location TEXT,
            accident_description TEXT DEFAULT '',
            license_plate TEXT DEFAULT '',
            vehicle_brand TEXT DEFAULT '',
            vehicle_model TEXT DEFAULT '',
            insurance_opponent TEXT DEFAULT '',
            claim_number TEXT DEFAULT '',
            status TEXT DEFAULT 'new',
            notes TEXT DEFAULT '',
            created_at TEXT,
            updated_at TEXT
        )
    ");

    $now = now_iso();
    $id  = generate_uuid();

    // Generate reference ID: DGD-YYYY-NNNNN
    $year = date('Y');
    $count = (int)$db->query("SELECT COUNT(*) FROM dgd_cases WHERE reference_id LIKE 'DGD-{$year}-%'")->fetchColumn();
    $reference_id = sprintf('DGD-%s-%05d', $year, $count + 1);

    $stmt = $db->prepare("
        INSERT INTO dgd_cases
            (id, reference_id, name, email, phone,
             accident_date, accident_location, accident_description,
             license_plate, vehicle_brand, vehicle_model,
             insurance_opponent, claim_number,
             status, created_at, updated_at)
        VALUES
            (:id, :ref, :name, :email, :phone,
             :accident_date, :accident_location, :accident_description,
             :license_plate, :vehicle_brand, :vehicle_model,
             :insurance_opponent, :claim_number,
             'new', :created_at, :updated_at)
    ");

    $stmt->execute([
        ':id'                   => $id,
        ':ref'                  => $reference_id,
        ':name'                 => trim($body['name']),
        ':email'                => trim($body['email']),
        ':phone'                => trim($body['phone']),
        ':accident_date'        => trim($body['accident_date'] ?? ''),
        ':accident_location'    => trim($body['accident_location'] ?? ''),
        ':accident_description' => trim($body['accident_description'] ?? ''),
        ':license_plate'        => trim($body['license_plate'] ?? ''),
        ':vehicle_brand'        => trim($body['vehicle_brand'] ?? ''),
        ':vehicle_model'        => trim($body['vehicle_model'] ?? ''),
        ':insurance_opponent'   => trim($body['insurance_opponent'] ?? ''),
        ':claim_number'         => trim($body['claim_number'] ?? ''),
        ':created_at'           => $now,
        ':updated_at'           => $now,
    ]);

    // Send notification email to kontakt@dgd-direkt.de
    $email_data = array_merge($body, ['reference_id' => $reference_id]);
    send_notification_email(
        MAIL_NOTIFY_ADDRESS,
        'Neue Schadensmeldung ' . $reference_id . ': ' . trim($body['name']),
        build_case_email_body($email_data)
    );

    json_success('Ihre Schadensmeldung wurde erfolgreich eingereicht.', [
        'id'           => $id,
        'reference_id' => $reference_id,
        'status'       => 'new',
        'created_at'   => $now,
    ]);
}

/**
 * GET /api/dgd/cases/{reference_id}
 *
 * Returns limited case info (privacy: no full details).
 */
function handle_get_case(string $ref): void
{
    $db   = get_db();

    // Ensure dgd_cases table exists
    $db->exec("
        CREATE TABLE IF NOT EXISTS dgd_cases (
            id TEXT PRIMARY KEY,
            reference_id TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            phone TEXT NOT NULL,
            accident_date TEXT,
            accident_location TEXT,
            accident_description TEXT DEFAULT '',
            license_plate TEXT DEFAULT '',
            vehicle_brand TEXT DEFAULT '',
            vehicle_model TEXT DEFAULT '',
            insurance_opponent TEXT DEFAULT '',
            claim_number TEXT DEFAULT '',
            status TEXT DEFAULT 'new',
            notes TEXT DEFAULT '',
            created_at TEXT,
            updated_at TEXT
        )
    ");

    $stmt = $db->prepare("SELECT reference_id, name, status, created_at, updated_at FROM dgd_cases WHERE reference_id = :ref");
    $stmt->execute([':ref' => $ref]);
    $case = $stmt->fetch();

    if (!$case) {
        json_error('Vorgang nicht gefunden. Bitte pruefen Sie Ihre Referenznummer.', 404);
    }

    // Map status to German labels
    $status_labels = [
        'new'         => 'Eingegangen',
        'in_progress' => 'In Bearbeitung',
        'assigned'    => 'Gutachter zugewiesen',
        'inspection'  => 'Besichtigung geplant',
        'report'      => 'Gutachten wird erstellt',
        'completed'   => 'Abgeschlossen',
        'cancelled'   => 'Storniert',
    ];

    json_response([
        'case' => [
            'reference_id' => $case['reference_id'],
            'name'         => $case['name'],
            'status'       => $case['status'],
            'status_label' => $status_labels[$case['status']] ?? $case['status'],
            'created_at'   => $case['created_at'],
            'updated_at'   => $case['updated_at'],
        ],
    ]);
}


// ============================================================
//  CRM LEAD HELPER (writes directly to dashboard.db)
// ============================================================

/**
 * Create a CRM contact/lead in the dashboard database.
 *
 * This bypasses the dashboard API (which requires auth) by writing
 * directly to the dashboard SQLite database.
 *
 * @param array $data Keys: name, email, phone, organization, role, source, tags, notes
 */
function create_crm_lead(array $data): void
{
    try {
        $dashboard_db_path = __DIR__ . '/../dashboard/data/dashboard.db';
        $dashboard_data_dir = dirname($dashboard_db_path);

        // Ensure dashboard data directory exists
        if (!is_dir($dashboard_data_dir)) {
            mkdir($dashboard_data_dir, 0755, true);
        }

        $crm_db = new PDO('sqlite:' . $dashboard_db_path, null, null, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
        $crm_db->exec('PRAGMA journal_mode=WAL');
        $crm_db->exec('PRAGMA foreign_keys=ON');

        // Ensure crm_contacts table exists (safety check)
        $crm_db->exec("
            CREATE TABLE IF NOT EXISTS crm_contacts (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT,
                phone TEXT,
                organization TEXT,
                role TEXT,
                tags TEXT DEFAULT '[]',
                notes TEXT DEFAULT '',
                pipeline_stage TEXT DEFAULT 'lead',
                deal_value REAL DEFAULT 0,
                source TEXT DEFAULT 'manual',
                assigned_to TEXT DEFAULT '',
                last_contacted TEXT,
                next_followup TEXT,
                health_score INTEGER DEFAULT 100,
                created_by TEXT,
                created_at TEXT,
                updated_at TEXT
            )
        ");

        $id  = generate_uuid();
        $now = now_iso();

        $crm_db->prepare("
            INSERT INTO crm_contacts
                (id, name, email, phone, organization, role, tags, notes,
                 pipeline_stage, deal_value, source, assigned_to, health_score,
                 created_by, created_at, updated_at)
            VALUES
                (:id, :name, :email, :phone, :org, :role, :tags, :notes,
                 'lead', 0, :source, '', 100,
                 'system-portal', :now, :now2)
        ")->execute([
            ':id'     => $id,
            ':name'   => $data['name'] ?? '',
            ':email'  => $data['email'] ?? '',
            ':phone'  => $data['phone'] ?? '',
            ':org'    => $data['organization'] ?? '',
            ':role'   => $data['role'] ?? '',
            ':tags'   => $data['tags'] ?? '[]',
            ':notes'  => $data['notes'] ?? '',
            ':source' => $data['source'] ?? 'website',
            ':now'    => $now,
            ':now2'   => $now,
        ]);

        error_log("DGD CRM: Lead created - {$data['name']} (source: {$data['source']}, id: {$id})");
    } catch (Exception $e) {
        // Don't fail the main form submission if CRM insert fails
        error_log("DGD CRM Error: Failed to create lead - " . $e->getMessage());
    }
}


// ============================================================
//  HELPERS
// ============================================================

/**
 * Cast SQLite string fields to proper PHP types for JSON output.
 */
function cast_partner_types(array $row): array
{
    $intFields   = ['radius_km', 'review_count', 'available', 'verified'];
    $floatFields = ['lat', 'lng', 'rating'];

    foreach ($intFields as $f) {
        if (isset($row[$f])) {
            $row[$f] = (int)$row[$f];
        }
    }
    foreach ($floatFields as $f) {
        if (isset($row[$f])) {
            $row[$f] = (float)$row[$f];
        }
    }

    // distance_km from nearby search
    if (isset($row['distance_km'])) {
        $row['distance_km'] = (float)$row['distance_km'];
    }

    return $row;
}
