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
 *   POST /api/dgd/waitlist          - Join partner waitlist
 *   GET  /api/dgd/geocode           - Nominatim geocoding proxy
 */

// Error reporting for debugging (remove in production)
error_reporting(E_ALL);
ini_set('display_errors', '1');

require_once __DIR__ . '/config.php';

// ---- Auto-initialize database if missing ----
if (!file_exists(DB_PATH)) {
    require_once __DIR__ . '/init_db.php';
    init_database();
}

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
