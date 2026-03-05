<?php
/**
 * DGD Portal - Database Initialization
 *
 * Creates tables and inserts demo partner data on first run.
 * Called automatically from index.php when the DB file is missing.
 */

require_once __DIR__ . '/config.php';

function init_database(): void
{
    $db = get_db();

    // ---- partners table ----
    $db->exec("
        CREATE TABLE IF NOT EXISTS dgd_partners (
            id              TEXT PRIMARY KEY,
            name            TEXT NOT NULL,
            company         TEXT,
            email           TEXT,
            phone           TEXT,
            specialty       TEXT,
            plz             TEXT NOT NULL,
            city            TEXT NOT NULL,
            address         TEXT,
            lat             REAL NOT NULL,
            lng             REAL NOT NULL,
            radius_km       INTEGER DEFAULT 30,
            rating          REAL DEFAULT 5.0,
            review_count    INTEGER DEFAULT 0,
            available       INTEGER DEFAULT 1,
            verified        INTEGER DEFAULT 1,
            description     TEXT,
            image_url       TEXT,
            created_at      TEXT,
            updated_at      TEXT
        )
    ");

    // ---- waitlist table ----
    $db->exec("
        CREATE TABLE IF NOT EXISTS dgd_waitlist (
            id               TEXT PRIMARY KEY,
            name             TEXT NOT NULL,
            company          TEXT,
            email            TEXT NOT NULL,
            phone            TEXT NOT NULL,
            specialty        TEXT NOT NULL,
            other_specialty  TEXT,
            plz              TEXT NOT NULL,
            city             TEXT NOT NULL,
            experience_years INTEGER,
            certifications   TEXT,
            message          TEXT,
            status           TEXT DEFAULT 'pending',
            created_at       TEXT,
            updated_at       TEXT
        )
    ");

    // ---- indexes ----
    $db->exec("CREATE INDEX IF NOT EXISTS idx_partners_specialty ON dgd_partners(specialty)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_partners_plz       ON dgd_partners(plz)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_partners_available  ON dgd_partners(available)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_partners_coords    ON dgd_partners(lat, lng)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_waitlist_status     ON dgd_waitlist(status)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_waitlist_email      ON dgd_waitlist(email)");

    // ---- demo data (only if table is empty) ----
    $count = $db->query("SELECT COUNT(*) FROM dgd_partners")->fetchColumn();
    if ((int)$count > 0) {
        return; // already seeded
    }

    $now = now_iso();

    $partners = [
        [
            'id'          => generate_uuid(),
            'name'        => 'Hans Mueller',
            'company'     => 'Mueller Kfz-Gutachten',
            'email'       => 'h.mueller@example.de',
            'phone'       => '+49 30 1234567',
            'specialty'   => 'kfz',
            'plz'         => '10115',
            'city'        => 'Berlin',
            'address'     => 'Friedrichstr. 100',
            'lat'         => 52.5200,
            'lng'         => 13.4050,
            'radius_km'   => 40,
            'rating'      => 4.8,
            'review_count'=> 127,
            'description' => 'Erfahrener Kfz-Sachverstaendiger mit ueber 15 Jahren Erfahrung in der Unfallschadenregulierung. TUeV-zertifiziert.',
        ],
        [
            'id'          => generate_uuid(),
            'name'        => 'Peter Schmidt',
            'company'     => 'Schmidt Gutachten Hamburg',
            'email'       => 'p.schmidt@example.de',
            'phone'       => '+49 40 2345678',
            'specialty'   => 'kfz',
            'plz'         => '20095',
            'city'        => 'Hamburg',
            'address'     => 'Moenckebergstr. 22',
            'lat'         => 53.5511,
            'lng'         => 9.9937,
            'radius_km'   => 35,
            'rating'      => 4.6,
            'review_count'=> 89,
            'description' => 'Spezialist fuer Kfz-Schaden und Wertgutachten. Schnelle Terminvergabe, faire Preise.',
        ],
        [
            'id'          => generate_uuid(),
            'name'        => 'Anna Weber',
            'company'     => 'Weber Sachverstaendigenbuero',
            'email'       => 'a.weber@example.de',
            'phone'       => '+49 89 3456789',
            'specialty'   => 'kfz',
            'plz'         => '80331',
            'city'        => 'Muenchen',
            'address'     => 'Marienplatz 8',
            'lat'         => 48.1351,
            'lng'         => 11.5820,
            'radius_km'   => 50,
            'rating'      => 4.9,
            'review_count'=> 203,
            'description' => 'Top-bewertete Sachverstaendige in Muenchen. Spezialisiert auf Unfallgutachten und Fahrzeugbewertung.',
        ],
        [
            'id'          => generate_uuid(),
            'name'        => 'Klaus Fischer',
            'company'     => 'Fischer Baugutachten',
            'email'       => 'k.fischer@example.de',
            'phone'       => '+49 221 4567890',
            'specialty'   => 'gebaeude',
            'plz'         => '50667',
            'city'        => 'Koeln',
            'address'     => 'Domkloster 4',
            'lat'         => 50.9375,
            'lng'         => 6.9603,
            'radius_km'   => 30,
            'rating'      => 4.7,
            'review_count'=> 64,
            'description' => 'Gebaeude-Sachverstaendiger fuer Bauschaden, Schimmelpilz und Wertermittlung. IHK-zertifiziert.',
        ],
        [
            'id'          => generate_uuid(),
            'name'        => 'Sabine Braun',
            'company'     => 'Braun Kfz-Sachverstaendige',
            'email'       => 's.braun@example.de',
            'phone'       => '+49 69 5678901',
            'specialty'   => 'kfz',
            'plz'         => '60311',
            'city'        => 'Frankfurt',
            'address'     => 'Zeil 42',
            'lat'         => 50.1109,
            'lng'         => 8.6821,
            'radius_km'   => 30,
            'rating'      => 4.5,
            'review_count'=> 56,
            'description' => 'Unabhaengige Kfz-Sachverstaendige im Rhein-Main-Gebiet. Unfallgutachten, Kurzgutachten, Beweissicherung.',
        ],
        [
            'id'          => generate_uuid(),
            'name'        => 'Thomas Wagner',
            'company'     => 'Wagner Gutachten Stuttgart',
            'email'       => 't.wagner@example.de',
            'phone'       => '+49 711 6789012',
            'specialty'   => 'hausrat',
            'plz'         => '70173',
            'city'        => 'Stuttgart',
            'address'     => 'Koenigstr. 15',
            'lat'         => 48.7758,
            'lng'         => 9.1829,
            'radius_km'   => 25,
            'rating'      => 4.4,
            'review_count'=> 38,
            'description' => 'Sachverstaendiger fuer Hausrat und Inventarbewertung. Versicherungsgutachten und Schadensbewertung.',
        ],
        [
            'id'          => generate_uuid(),
            'name'        => 'Maria Hofmann',
            'company'     => 'Hofmann Automotive Experts',
            'email'       => 'm.hofmann@example.de',
            'phone'       => '+49 211 7890123',
            'specialty'   => 'kfz',
            'plz'         => '40213',
            'city'        => 'Duesseldorf',
            'address'     => 'Schadowstr. 30',
            'lat'         => 51.2277,
            'lng'         => 6.7735,
            'radius_km'   => 30,
            'rating'      => 4.8,
            'review_count'=> 112,
            'description' => 'Kfz-Sachverstaendige mit Schwerpunkt Oldtimer-Bewertung und Unfallrekonstruktion.',
        ],
        [
            'id'          => generate_uuid(),
            'name'        => 'Stefan Becker',
            'company'     => 'Becker Bau-Sachverstaendige',
            'email'       => 's.becker@example.de',
            'phone'       => '+49 341 8901234',
            'specialty'   => 'gebaeude',
            'plz'         => '04109',
            'city'        => 'Leipzig',
            'address'     => 'Grimmaische Str. 12',
            'lat'         => 51.3397,
            'lng'         => 12.3731,
            'radius_km'   => 40,
            'rating'      => 4.3,
            'review_count'=> 41,
            'description' => 'Gebaeude-Sachverstaendiger in Sachsen. Energieberatung, Baubegleitung und Schadensbegutachtung.',
        ],
        [
            'id'          => generate_uuid(),
            'name'        => 'Julia Richter',
            'company'     => 'Richter Allgemeine Gutachten',
            'email'       => 'j.richter@example.de',
            'phone'       => '+49 351 9012345',
            'specialty'   => 'allgemein',
            'plz'         => '01067',
            'city'        => 'Dresden',
            'address'     => 'Prager Str. 5',
            'lat'         => 51.0504,
            'lng'         => 13.7373,
            'radius_km'   => 35,
            'rating'      => 4.6,
            'review_count'=> 73,
            'description' => 'Allgemeine Sachverstaendige fuer verschiedene Fachgebiete. Gerichtsgutachten und Privatgutachten.',
        ],
        [
            'id'          => generate_uuid(),
            'name'        => 'Michael Koch',
            'company'     => 'Koch Kfz-Gutachten Hannover',
            'email'       => 'm.koch@example.de',
            'phone'       => '+49 511 0123456',
            'specialty'   => 'kfz',
            'plz'         => '30159',
            'city'        => 'Hannover',
            'address'     => 'Georgstr. 18',
            'lat'         => 52.3759,
            'lng'         => 9.7320,
            'radius_km'   => 30,
            'rating'      => 4.2,
            'review_count'=> 35,
            'description' => 'Kfz-Sachverstaendiger in Niedersachsen. Haftpflicht- und Kaskogutachten, Restwertermittlung.',
        ],
        [
            'id'          => generate_uuid(),
            'name'        => 'Laura Schaefer',
            'company'     => 'Schaefer Sachverstaendigenbuero',
            'email'       => 'l.schaefer@example.de',
            'phone'       => '+49 911 1234560',
            'specialty'   => 'kfz',
            'plz'         => '90402',
            'city'        => 'Nuernberg',
            'address'     => 'Breite Gasse 25',
            'lat'         => 49.4521,
            'lng'         => 11.0767,
            'radius_km'   => 35,
            'rating'      => 4.7,
            'review_count'=> 91,
            'description' => 'Kfz-Sachverstaendige in Franken. Unfallanalyse, Fahrzeugbewertung und technische Gutachten.',
        ],
        [
            'id'          => generate_uuid(),
            'name'        => 'Frank Zimmermann',
            'company'     => 'Zimmermann Gebaeudegutachten',
            'email'       => 'f.zimmermann@example.de',
            'phone'       => '+49 231 2345670',
            'specialty'   => 'gebaeude',
            'plz'         => '44135',
            'city'        => 'Dortmund',
            'address'     => 'Westenhellweg 50',
            'lat'         => 51.5136,
            'lng'         => 7.4653,
            'radius_km'   => 30,
            'rating'      => 4.5,
            'review_count'=> 58,
            'description' => 'Gebaeude-Sachverstaendiger im Ruhrgebiet. Feuchtigkeitsschaeden, Rissbildung und Baumaengel.',
        ],
    ];

    $stmt = $db->prepare("
        INSERT INTO dgd_partners
            (id, name, company, email, phone, specialty, plz, city, address,
             lat, lng, radius_km, rating, review_count, available, verified,
             description, image_url, created_at, updated_at)
        VALUES
            (:id, :name, :company, :email, :phone, :specialty, :plz, :city, :address,
             :lat, :lng, :radius_km, :rating, :review_count, 1, 1,
             :description, NULL, :created_at, :updated_at)
    ");

    $db->beginTransaction();
    try {
        foreach ($partners as $p) {
            $stmt->execute([
                ':id'           => $p['id'],
                ':name'         => $p['name'],
                ':company'      => $p['company'],
                ':email'        => $p['email'],
                ':phone'        => $p['phone'],
                ':specialty'    => $p['specialty'],
                ':plz'          => $p['plz'],
                ':city'         => $p['city'],
                ':address'      => $p['address'],
                ':lat'          => $p['lat'],
                ':lng'          => $p['lng'],
                ':radius_km'    => $p['radius_km'],
                ':rating'       => $p['rating'],
                ':review_count' => $p['review_count'],
                ':description'  => $p['description'],
                ':created_at'   => $now,
                ':updated_at'   => $now,
            ]);
        }
        $db->commit();
    } catch (Exception $e) {
        $db->rollBack();
        throw $e;
    }
}

// Run when called directly (php init_db.php) or from require
if (php_sapi_name() === 'cli' && basename(__FILE__) === basename($argv[0] ?? '')) {
    try {
        init_database();
        echo "Database initialized successfully at " . DB_PATH . "\n";
        $db = get_db();
        $count = $db->query("SELECT COUNT(*) FROM dgd_partners")->fetchColumn();
        echo "Partners seeded: {$count}\n";
    } catch (Exception $e) {
        echo "ERROR: " . $e->getMessage() . "\n";
        exit(1);
    }
}
