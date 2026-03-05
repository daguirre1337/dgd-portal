<?php
/**
 * DGD Portal - Partner-Import Script
 *
 * Importiert Partner-Daten aus CSV, JSON oder SQL-Dumps
 * in die dgd_partners SQLite-Tabelle.
 *
 * Verwendung:
 *   php import_partners.php partners.csv
 *   php import_partners.php partners.json
 *   php import_partners.php --sql dump.sql
 *   php import_partners.php partners.csv --update
 *   php import_partners.php partners.csv --dry-run
 *   php import_partners.php partners.csv --update --dry-run
 *
 * PHP 7.3+ kompatibel.
 */

if (php_sapi_name() !== 'cli') {
    die('Nur CLI-Ausfuehrung erlaubt.');
}

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/init_db.php';

// ============================================================
// Konstanten & Konfiguration
// ============================================================

/** Nominatim Rate-Limit: 1 Request pro Sekunde */
define('GEOCODE_DELAY_US', 1100000); // 1.1 Sekunden in Mikrosekunden

/**
 * Spalten-Mapping: Quellname (lowercase) => Zielname in dgd_partners.
 * Unterstuetzt gaengige Firebase-, SQL- und deutsche Varianten.
 */
function get_field_mappings()
{
    return array(
        // name
        'name'          => 'name',
        'vollname'      => 'name',
        'full_name'     => 'name',
        'fullname'      => 'name',
        'vor_und_nachname' => 'name',
        'partner_name'  => 'name',
        'kontakt'       => 'name',
        'ansprechpartner' => 'name',

        // company
        'firma'         => 'company',
        'company'       => 'company',
        'unternehmen'   => 'company',
        'firmenname'    => 'company',
        'company_name'  => 'company',
        'betrieb'       => 'company',
        'buero'         => 'company',

        // email
        'email'         => 'email',
        'e_mail'        => 'email',
        'e-mail'        => 'email',
        'mail'          => 'email',
        'email_address' => 'email',
        'emailadresse'  => 'email',

        // phone
        'telefon'       => 'phone',
        'phone'         => 'phone',
        'tel'           => 'phone',
        'telefonnummer' => 'phone',
        'phone_number'  => 'phone',
        'mobil'         => 'phone',
        'handy'         => 'phone',
        'fon'           => 'phone',

        // plz
        'plz'           => 'plz',
        'zip'           => 'plz',
        'postleitzahl'  => 'plz',
        'postal_code'   => 'plz',
        'zipcode'       => 'plz',
        'zip_code'      => 'plz',

        // city
        'stadt'         => 'city',
        'city'          => 'city',
        'ort'           => 'city',
        'wohnort'       => 'city',
        'standort'      => 'city',
        'town'          => 'city',

        // address
        'strasse'       => 'address',
        'street'        => 'address',
        'address'       => 'address',
        'adresse'       => 'address',
        'anschrift'     => 'address',
        'street_address' => 'address',
        'strasseundnr'  => 'address',

        // lat
        'lat'           => 'lat',
        'latitude'      => 'lat',
        'breitengrad'   => 'lat',
        'geo_lat'       => 'lat',

        // lng
        'lng'           => 'lng',
        'lon'           => 'lng',
        'longitude'     => 'lng',
        'laengengrad'   => 'lng',
        'geo_lng'       => 'lng',
        'geo_lon'       => 'lng',

        // specialty
        'spezialisierung' => 'specialty',
        'specialty'       => 'specialty',
        'fachgebiet'      => 'specialty',
        'fachrichtung'    => 'specialty',
        'bereich'         => 'specialty',
        'kategorie'       => 'specialty',
        'spezialgebiet'   => 'specialty',

        // radius_km
        'radius_km'     => 'radius_km',
        'radius'        => 'radius_km',
        'einsatzradius'  => 'radius_km',
        'umkreis'       => 'radius_km',

        // rating
        'rating'        => 'rating',
        'bewertung'     => 'rating',
        'sterne'        => 'rating',
        'score'         => 'rating',

        // review_count
        'review_count'  => 'review_count',
        'reviews'       => 'review_count',
        'bewertungen'   => 'review_count',
        'anzahl_bewertungen' => 'review_count',

        // description
        'description'   => 'description',
        'beschreibung'  => 'description',
        'info'          => 'description',
        'ueber'         => 'description',
        'about'         => 'description',
        'profil'        => 'description',

        // image_url
        'image_url'     => 'image_url',
        'bild'          => 'image_url',
        'foto'          => 'image_url',
        'image'         => 'image_url',
        'photo'         => 'image_url',
        'profilbild'    => 'image_url',
        'avatar'        => 'image_url',
    );
}

// ============================================================
// Hilfs-Funktionen
// ============================================================

/**
 * Gibt eine farbige Zeile auf der Konsole aus.
 *
 * @param string $msg
 * @param string $type  info|ok|warn|error
 * @return void
 */
function cli_log($msg, $type = 'info')
{
    $prefix = '';
    switch ($type) {
        case 'ok':
            $prefix = "\033[32m[OK]\033[0m ";
            break;
        case 'warn':
            $prefix = "\033[33m[WARNUNG]\033[0m ";
            break;
        case 'error':
            $prefix = "\033[31m[FEHLER]\033[0m ";
            break;
        default:
            $prefix = "\033[36m[INFO]\033[0m ";
    }
    fwrite(STDERR, $prefix . $msg . "\n");
}

/**
 * Mapt einen Quell-Feldnamen auf den Ziel-Feldnamen.
 *
 * @param string $source_field
 * @return string|null  Zielfeld oder null wenn unbekannt
 */
function map_field($source_field)
{
    $mappings = get_field_mappings();
    // Normalisieren: lowercase, Leerzeichen/Bindestriche zu Unterstrichen
    $key = strtolower(trim($source_field));
    $key = preg_replace('/[\s\-]+/', '_', $key);

    if (isset($mappings[$key])) {
        return $mappings[$key];
    }

    return null;
}

/**
 * Mapt ein assoziatives Array (Rohdaten) auf die dgd_partners-Feldnamen.
 *
 * @param array $row
 * @return array  Gemappte Felder
 */
function map_row(array $row)
{
    $mapped = array();
    foreach ($row as $key => $value) {
        $target = map_field($key);
        if ($target !== null && !isset($mapped[$target])) {
            $mapped[$target] = $value;
        }
    }
    return $mapped;
}

/**
 * Geocoding ueber Nominatim (OpenStreetMap).
 * Rate-Limit: max 1 Request/Sekunde.
 *
 * @param string $plz
 * @param string $city
 * @param string $address
 * @return array|null  ['lat' => float, 'lng' => float] oder null
 */
function geocode($plz, $city, $address = '')
{
    $query_parts = array();
    if (!empty($address)) {
        $query_parts[] = $address;
    }
    if (!empty($plz)) {
        $query_parts[] = $plz;
    }
    if (!empty($city)) {
        $query_parts[] = $city;
    }
    $query_parts[] = 'Deutschland';

    $query = implode(', ', $query_parts);

    $url = 'https://nominatim.openstreetmap.org/search?' . http_build_query(array(
        'q'      => $query,
        'format' => 'json',
        'limit'  => 1,
    ));

    $ctx = stream_context_create(array(
        'http' => array(
            'method'  => 'GET',
            'header'  => "User-Agent: DGD-Portal-Import/1.0\r\n",
            'timeout' => 10,
        ),
    ));

    $response = @file_get_contents($url, false, $ctx);
    if ($response === false) {
        return null;
    }

    $data = json_decode($response, true);
    if (!is_array($data) || count($data) === 0) {
        return null;
    }

    $lat = isset($data[0]['lat']) ? (float) $data[0]['lat'] : null;
    $lon = isset($data[0]['lon']) ? (float) $data[0]['lon'] : null;

    if ($lat === null || $lon === null) {
        return null;
    }

    return array('lat' => $lat, 'lng' => $lon);
}

/**
 * Prueft ob ein Partner bereits in der DB existiert.
 *
 * @param PDO    $db
 * @param string $email
 * @param string $name
 * @param string $plz
 * @return array|null  Bestehender Datensatz oder null
 */
function find_existing_partner(PDO $db, $email, $name, $plz)
{
    // Pruefen nach Email (primaer)
    if (!empty($email)) {
        $stmt = $db->prepare('SELECT * FROM dgd_partners WHERE LOWER(email) = LOWER(:email) LIMIT 1');
        $stmt->execute(array(':email' => $email));
        $existing = $stmt->fetch();
        if ($existing) {
            return $existing;
        }
    }

    // Pruefen nach Name + PLZ (sekundaer)
    if (!empty($name) && !empty($plz)) {
        $stmt = $db->prepare('SELECT * FROM dgd_partners WHERE LOWER(name) = LOWER(:name) AND plz = :plz LIMIT 1');
        $stmt->execute(array(':name' => $name, ':plz' => $plz));
        $existing = $stmt->fetch();
        if ($existing) {
            return $existing;
        }
    }

    return null;
}

/**
 * Fuegt einen Partner in die DB ein.
 *
 * @param PDO   $db
 * @param array $data  Gemappte Partner-Daten
 * @return void
 */
function insert_partner(PDO $db, array $data)
{
    $now = gmdate('Y-m-d\TH:i:s\Z');

    $stmt = $db->prepare("
        INSERT INTO dgd_partners
            (id, name, company, email, phone, specialty, plz, city, address,
             lat, lng, radius_km, rating, review_count, available, verified,
             description, image_url, created_at, updated_at)
        VALUES
            (:id, :name, :company, :email, :phone, :specialty, :plz, :city, :address,
             :lat, :lng, :radius_km, :rating, :review_count, :available, :verified,
             :description, :image_url, :created_at, :updated_at)
    ");

    $stmt->execute(array(
        ':id'           => generate_uuid(),
        ':name'         => isset($data['name']) ? $data['name'] : '',
        ':company'      => isset($data['company']) ? $data['company'] : null,
        ':email'        => isset($data['email']) ? $data['email'] : null,
        ':phone'        => isset($data['phone']) ? $data['phone'] : null,
        ':specialty'    => isset($data['specialty']) ? $data['specialty'] : 'kfz',
        ':plz'          => isset($data['plz']) ? $data['plz'] : '',
        ':city'         => isset($data['city']) ? $data['city'] : '',
        ':address'      => isset($data['address']) ? $data['address'] : null,
        ':lat'          => isset($data['lat']) ? (float) $data['lat'] : 0.0,
        ':lng'          => isset($data['lng']) ? (float) $data['lng'] : 0.0,
        ':radius_km'    => isset($data['radius_km']) ? (int) $data['radius_km'] : 30,
        ':rating'       => isset($data['rating']) ? (float) $data['rating'] : 5.0,
        ':review_count' => isset($data['review_count']) ? (int) $data['review_count'] : 0,
        ':available'    => 1,
        ':verified'     => 1,
        ':description'  => isset($data['description']) ? $data['description'] : null,
        ':image_url'    => isset($data['image_url']) ? $data['image_url'] : null,
        ':created_at'   => $now,
        ':updated_at'   => $now,
    ));
}

/**
 * Aktualisiert einen bestehenden Partner.
 *
 * @param PDO    $db
 * @param string $existing_id
 * @param array  $data  Gemappte Partner-Daten
 * @return void
 */
function update_partner(PDO $db, $existing_id, array $data)
{
    $now = gmdate('Y-m-d\TH:i:s\Z');

    // Nur nicht-leere Felder updaten
    $fields = array('name', 'company', 'email', 'phone', 'specialty',
                    'plz', 'city', 'address', 'lat', 'lng', 'radius_km',
                    'rating', 'review_count', 'description', 'image_url');

    $set_parts = array();
    $params = array(':id' => $existing_id, ':updated_at' => $now);

    foreach ($fields as $field) {
        if (isset($data[$field]) && $data[$field] !== '' && $data[$field] !== null) {
            $set_parts[] = "$field = :$field";
            $params[":$field"] = $data[$field];
        }
    }

    if (empty($set_parts)) {
        return;
    }

    $set_parts[] = 'updated_at = :updated_at';

    $sql = 'UPDATE dgd_partners SET ' . implode(', ', $set_parts) . ' WHERE id = :id';
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
}

/**
 * Validiert einen gemappten Datensatz.
 *
 * @param array $data
 * @param int   $line_num
 * @return array  Liste von Fehlermeldungen (leer = OK)
 */
function validate_partner(array $data, $line_num)
{
    $errors = array();

    if (empty($data['name'])) {
        $errors[] = "Zeile $line_num: Pflichtfeld 'name' fehlt oder ist leer.";
    }
    if (empty($data['plz']) && empty($data['lat'])) {
        $errors[] = "Zeile $line_num: Mindestens 'plz' oder 'lat/lng' muss angegeben sein.";
    }
    if (empty($data['city']) && empty($data['lat'])) {
        $errors[] = "Zeile $line_num: Mindestens 'city' oder 'lat/lng' muss angegeben sein.";
    }

    return $errors;
}

// ============================================================
// Import-Funktionen nach Format
// ============================================================

/**
 * Liest Partner-Daten aus einer CSV-Datei.
 *
 * @param string $filepath
 * @return array  Liste von assoziativen Arrays
 */
function read_csv($filepath)
{
    $rows = array();

    $handle = fopen($filepath, 'r');
    if ($handle === false) {
        cli_log("Kann Datei nicht oeffnen: $filepath", 'error');
        exit(1);
    }

    // BOM entfernen (UTF-8)
    $bom = fread($handle, 3);
    if ($bom !== "\xEF\xBB\xBF") {
        rewind($handle);
    }

    // Header lesen - Trennzeichen automatisch erkennen
    $first_line = fgets($handle);
    if ($first_line === false) {
        cli_log("CSV-Datei ist leer.", 'error');
        fclose($handle);
        exit(1);
    }
    rewind($handle);
    // BOM erneut ueberspringen
    $bom = fread($handle, 3);
    if ($bom !== "\xEF\xBB\xBF") {
        rewind($handle);
    }

    // Trennzeichen erkennen: Semikolon, Komma, Tab
    $delimiter = ',';
    $semicolons = substr_count($first_line, ';');
    $commas = substr_count($first_line, ',');
    $tabs = substr_count($first_line, "\t");

    if ($semicolons > $commas && $semicolons > $tabs) {
        $delimiter = ';';
    } elseif ($tabs > $commas && $tabs > $semicolons) {
        $delimiter = "\t";
    }

    cli_log("CSV-Trennzeichen erkannt: " . ($delimiter === "\t" ? 'TAB' : "'$delimiter'"));

    // Header
    $header = fgetcsv($handle, 0, $delimiter);
    if ($header === false || count($header) === 0) {
        cli_log("CSV-Header konnte nicht gelesen werden.", 'error');
        fclose($handle);
        exit(1);
    }

    // Header bereinigen
    $header = array_map(function ($h) {
        return trim($h, " \t\n\r\0\x0B\"'");
    }, $header);

    cli_log("CSV-Spalten gefunden: " . implode(', ', $header));

    // Zeilen einlesen
    $line_num = 1;
    while (($row = fgetcsv($handle, 0, $delimiter)) !== false) {
        $line_num++;

        // Leere Zeilen ueberspringen
        if (count($row) === 1 && empty(trim($row[0]))) {
            continue;
        }

        // Spaltenanzahl anpassen (mehr Daten als Header -> abschneiden, weniger -> auffuellen)
        if (count($row) < count($header)) {
            $row = array_pad($row, count($header), '');
        } elseif (count($row) > count($header)) {
            $row = array_slice($row, 0, count($header));
        }

        $assoc = array_combine($header, $row);
        if ($assoc === false) {
            cli_log("Zeile $line_num: Spaltenanzahl stimmt nicht ueberein, uebersprungen.", 'warn');
            continue;
        }

        $assoc['_line'] = $line_num;
        $rows[] = $assoc;
    }

    fclose($handle);
    return $rows;
}

/**
 * Liest Partner-Daten aus einer JSON-Datei.
 * Unterstuetzt flaches Array und Firebase-Objekt-Format.
 *
 * @param string $filepath
 * @return array  Liste von assoziativen Arrays
 */
function read_json($filepath)
{
    $content = file_get_contents($filepath);
    if ($content === false) {
        cli_log("Kann Datei nicht lesen: $filepath", 'error');
        exit(1);
    }

    // BOM entfernen
    if (substr($content, 0, 3) === "\xEF\xBB\xBF") {
        $content = substr($content, 3);
    }

    $data = json_decode($content, true);
    if ($data === null && json_last_error() !== JSON_ERROR_NONE) {
        cli_log("JSON-Parse-Fehler: " . json_last_error_msg(), 'error');
        exit(1);
    }

    $rows = array();

    // Fall 1: Array von Objekten  [{"name":"...", ...}, ...]
    if (isset($data[0]) && is_array($data[0])) {
        $line_num = 0;
        foreach ($data as $item) {
            $line_num++;
            if (is_array($item)) {
                $item['_line'] = $line_num;
                $rows[] = $item;
            }
        }
        cli_log("JSON-Format: Array mit " . count($rows) . " Eintraegen.");
        return $rows;
    }

    // Fall 2: Firebase-Objekt  {"key1": {"name":"...", ...}, "key2": {...}}
    if (is_array($data) && !isset($data[0])) {
        $line_num = 0;
        foreach ($data as $key => $item) {
            $line_num++;
            if (is_array($item)) {
                $item['_line'] = $line_num;
                // Firebase-Key als Fallback-ID speichern
                if (!isset($item['firebase_key'])) {
                    $item['firebase_key'] = $key;
                }
                $rows[] = $item;
            }
        }
        cli_log("JSON-Format: Firebase-Objekt mit " . count($rows) . " Eintraegen.");
        return $rows;
    }

    cli_log("Unbekanntes JSON-Format. Erwartet: Array von Objekten oder Firebase-Objekt.", 'error');
    exit(1);
}

/**
 * Parst einen SQL-Dump und extrahiert INSERT-Daten.
 *
 * @param string $filepath
 * @return array  Liste von assoziativen Arrays
 */
function read_sql($filepath)
{
    $content = file_get_contents($filepath);
    if ($content === false) {
        cli_log("Kann Datei nicht lesen: $filepath", 'error');
        exit(1);
    }

    $rows = array();
    $line_num = 0;

    // INSERT INTO ... (...spalten...) VALUES (...werte...) finden
    // Unterstuetzt sowohl einzelne als auch Multi-Row INSERTs
    $pattern = '/INSERT\s+INTO\s+[`"\']?\w+[`"\']?\s*\(([^)]+)\)\s*VALUES\s*/i';

    if (!preg_match_all($pattern, $content, $matches, PREG_OFFSET_CAPTURE)) {
        cli_log("Keine INSERT-Statements im SQL-Dump gefunden.", 'error');
        exit(1);
    }

    foreach ($matches[0] as $idx => $match) {
        $columns_str = $matches[1][$idx][0];
        $insert_end = $match[1] + strlen($match[0]);

        // Spalten extrahieren
        $columns = array_map(function ($c) {
            return trim($c, " \t\n\r\0\x0B`\"'");
        }, explode(',', $columns_str));

        // VALUES-Bereich finden: alles bis zum naechsten Semikolon
        $remaining = substr($content, $insert_end);
        $semi_pos = strpos($remaining, ';');
        if ($semi_pos !== false) {
            $values_block = substr($remaining, 0, $semi_pos);
        } else {
            $values_block = $remaining;
        }

        // Einzelne Value-Gruppen extrahieren: (...), (...)
        preg_match_all('/\(([^)]+)\)/', $values_block, $value_matches);

        foreach ($value_matches[1] as $values_str) {
            $line_num++;

            // Werte parsen (beachtet Strings mit Kommas)
            $values = parse_sql_values($values_str);

            if (count($values) !== count($columns)) {
                cli_log("SQL Zeile $line_num: Spaltenanzahl (" . count($columns) . ") != Werteanzahl (" . count($values) . "), uebersprungen.", 'warn');
                continue;
            }

            $assoc = array_combine($columns, $values);
            $assoc['_line'] = $line_num;
            $rows[] = $assoc;
        }
    }

    cli_log("SQL-Dump: " . count($rows) . " Datensaetze aus INSERT-Statements extrahiert.");
    return $rows;
}

/**
 * Parst einen SQL VALUES-String in einzelne Werte.
 * Beruecksichtigt Strings mit Kommas und Escape-Sequenzen.
 *
 * @param string $str
 * @return array
 */
function parse_sql_values($str)
{
    $values = array();
    $current = '';
    $in_string = false;
    $string_char = '';
    $escaped = false;
    $len = strlen($str);

    for ($i = 0; $i < $len; $i++) {
        $char = $str[$i];

        if ($escaped) {
            $current .= $char;
            $escaped = false;
            continue;
        }

        if ($char === '\\') {
            $escaped = true;
            $current .= $char;
            continue;
        }

        if ($in_string) {
            if ($char === $string_char) {
                // Doppeltes Quote pruefen (SQL-Escape)
                if ($i + 1 < $len && $str[$i + 1] === $string_char) {
                    $current .= $char;
                    $i++; // Ueberspringe das naechste Quote
                } else {
                    $in_string = false;
                }
            }
            $current .= $char;
            continue;
        }

        if ($char === "'" || $char === '"') {
            $in_string = true;
            $string_char = $char;
            $current .= $char;
            continue;
        }

        if ($char === ',') {
            $values[] = clean_sql_value(trim($current));
            $current = '';
            continue;
        }

        $current .= $char;
    }

    // Letzten Wert hinzufuegen
    $last = trim($current);
    if ($last !== '') {
        $values[] = clean_sql_value($last);
    }

    return $values;
}

/**
 * Bereinigt einen einzelnen SQL-Wert (Quotes entfernen, NULL behandeln).
 *
 * @param string $val
 * @return string|null
 */
function clean_sql_value($val)
{
    if (strtoupper($val) === 'NULL') {
        return null;
    }

    // String-Quotes entfernen
    if (strlen($val) >= 2) {
        $first = $val[0];
        $last = $val[strlen($val) - 1];
        if (($first === "'" && $last === "'") || ($first === '"' && $last === '"')) {
            $val = substr($val, 1, -1);
            // Escaped Quotes zurueckwandeln
            $val = str_replace("''", "'", $val);
            $val = str_replace('\\"', '"', $val);
            $val = str_replace("\\'", "'", $val);
            $val = str_replace("\\\\", "\\", $val);
        }
    }

    return $val;
}

// ============================================================
// Haupt-Import-Logik
// ============================================================

/**
 * Verarbeitet eine Liste von Roh-Datensaetzen und importiert sie.
 *
 * @param array $raw_rows   Rohe Datensaetze
 * @param bool  $do_update  Bei Duplikaten aktualisieren statt ueberspringen
 * @param bool  $dry_run    Nur simulieren, keine DB-Aenderungen
 * @return array  Statistiken: imported, updated, skipped, errors, geocoded
 */
function process_import(array $raw_rows, $do_update, $dry_run)
{
    $stats = array(
        'imported'  => 0,
        'updated'   => 0,
        'skipped'   => 0,
        'errors'    => 0,
        'geocoded'  => 0,
        'total'     => count($raw_rows),
    );

    if (count($raw_rows) === 0) {
        cli_log("Keine Datensaetze zum Importieren gefunden.", 'warn');
        return $stats;
    }

    // DB initialisieren (Tabellen anlegen falls noetig)
    init_database();
    $db = get_db();

    // Mapping-Vorschau fuer den ersten Datensatz
    $first_mapped = map_row($raw_rows[0]);
    $unmapped = array();
    foreach ($raw_rows[0] as $key => $val) {
        if ($key === '_line' || $key === 'firebase_key') {
            continue;
        }
        if (map_field($key) === null) {
            $unmapped[] = $key;
        }
    }

    if (!empty($unmapped)) {
        cli_log("Nicht zugeordnete Quell-Spalten: " . implode(', ', $unmapped), 'warn');
        cli_log("Diese Spalten werden ignoriert. Pruefen Sie die Feldnamen.");
    }

    $mapped_fields = array_keys($first_mapped);
    cli_log("Zugeordnete Ziel-Felder: " . implode(', ', $mapped_fields));

    if ($dry_run) {
        cli_log("=== DRY-RUN MODUS - Keine Aenderungen an der Datenbank ===", 'warn');
    }

    // Verarbeitung
    if (!$dry_run) {
        $db->beginTransaction();
    }

    try {
        foreach ($raw_rows as $raw) {
            $line_num = isset($raw['_line']) ? $raw['_line'] : '?';

            // Mapping anwenden
            $data = map_row($raw);

            // Validierung
            $errors = validate_partner($data, $line_num);
            if (!empty($errors)) {
                foreach ($errors as $err) {
                    cli_log($err, 'error');
                }
                $stats['errors']++;
                continue;
            }

            // Geocoding wenn lat/lng fehlt
            $has_lat = isset($data['lat']) && $data['lat'] !== '' && $data['lat'] !== null && (float) $data['lat'] !== 0.0;
            $has_lng = isset($data['lng']) && $data['lng'] !== '' && $data['lng'] !== null && (float) $data['lng'] !== 0.0;

            if (!$has_lat || !$has_lng) {
                $plz_val = isset($data['plz']) ? $data['plz'] : '';
                $city_val = isset($data['city']) ? $data['city'] : '';
                $addr_val = isset($data['address']) ? $data['address'] : '';

                if (!empty($plz_val) || !empty($city_val)) {
                    cli_log("Zeile $line_num: Geocoding fuer PLZ=$plz_val, Stadt=$city_val ...");

                    if (!$dry_run) {
                        $coords = geocode($plz_val, $city_val, $addr_val);
                        if ($coords !== null) {
                            $data['lat'] = $coords['lat'];
                            $data['lng'] = $coords['lng'];
                            $stats['geocoded']++;
                            cli_log("  -> Koordinaten: {$coords['lat']}, {$coords['lng']}", 'ok');
                        } else {
                            cli_log("  -> Geocoding fehlgeschlagen, setze 0.0/0.0", 'warn');
                            $data['lat'] = 0.0;
                            $data['lng'] = 0.0;
                        }
                        // Rate-Limit einhalten
                        usleep(GEOCODE_DELAY_US);
                    } else {
                        cli_log("  -> [DRY-RUN] Geocoding wuerde ausgefuehrt werden.");
                        $data['lat'] = 0.0;
                        $data['lng'] = 0.0;
                    }
                } else {
                    cli_log("Zeile $line_num: Keine Koordinaten und keine PLZ/Stadt fuer Geocoding.", 'warn');
                    $data['lat'] = 0.0;
                    $data['lng'] = 0.0;
                }
            }

            // Duplikat-Pruefung
            $email_val = isset($data['email']) ? $data['email'] : '';
            $name_val = isset($data['name']) ? $data['name'] : '';
            $plz_val = isset($data['plz']) ? $data['plz'] : '';

            $existing = find_existing_partner($db, $email_val, $name_val, $plz_val);

            if ($existing !== null) {
                if ($do_update) {
                    if (!$dry_run) {
                        update_partner($db, $existing['id'], $data);
                    }
                    $stats['updated']++;
                    cli_log("Zeile $line_num: Partner '{$name_val}' aktualisiert.", 'ok');
                } else {
                    $stats['skipped']++;
                    $match_reason = (!empty($email_val) && strtolower($existing['email']) === strtolower($email_val))
                        ? "Email=$email_val"
                        : "Name+PLZ=$name_val/$plz_val";
                    cli_log("Zeile $line_num: Duplikat uebersprungen ($match_reason). Nutze --update zum Aktualisieren.", 'warn');
                }
            } else {
                if (!$dry_run) {
                    insert_partner($db, $data);
                }
                $stats['imported']++;
                cli_log("Zeile $line_num: Partner '{$name_val}' importiert.", 'ok');
            }
        }

        if (!$dry_run) {
            $db->commit();
        }
    } catch (Exception $e) {
        if (!$dry_run) {
            $db->rollBack();
        }
        cli_log("Datenbank-Fehler: " . $e->getMessage(), 'error');
        cli_log("Alle Aenderungen wurden zurueckgerollt.", 'error');
        $stats['errors']++;
    }

    return $stats;
}

/**
 * Gibt die Statistiken formatiert aus.
 *
 * @param array $stats
 * @param bool  $dry_run
 * @return void
 */
function print_stats(array $stats, $dry_run)
{
    fwrite(STDERR, "\n");
    cli_log("========================================");
    if ($dry_run) {
        cli_log("=== ERGEBNIS (DRY-RUN) ===", 'warn');
    } else {
        cli_log("=== ERGEBNIS ===");
    }
    cli_log("----------------------------------------");
    cli_log("Gesamt Datensaetze:   " . $stats['total']);
    cli_log("Importiert:           " . $stats['imported'], 'ok');
    if ($stats['updated'] > 0) {
        cli_log("Aktualisiert:         " . $stats['updated'], 'ok');
    }
    if ($stats['skipped'] > 0) {
        cli_log("Uebersprungen (Dup.): " . $stats['skipped'], 'warn');
    }
    if ($stats['geocoded'] > 0) {
        cli_log("Geocodiert:           " . $stats['geocoded'], 'ok');
    }
    if ($stats['errors'] > 0) {
        cli_log("Fehler:               " . $stats['errors'], 'error');
    }
    cli_log("========================================");

    if (!$dry_run && $stats['imported'] > 0) {
        $db = get_db();
        $total = $db->query("SELECT COUNT(*) FROM dgd_partners")->fetchColumn();
        cli_log("Partner in DB gesamt: $total");
    }
}

/**
 * Zeigt die Hilfe-Nachricht an.
 *
 * @return void
 */
function show_help()
{
    $help = <<<'HELP'

DGD Portal - Partner-Import Script
===================================

Verwendung:
  php import_partners.php <datei>            Import aus CSV oder JSON
  php import_partners.php --sql <datei>      Import aus SQL-Dump

Optionen:
  --update      Bei Duplikaten aktualisieren statt ueberspringen
  --dry-run     Nur simulieren, keine DB-Aenderungen
  --help, -h    Diese Hilfe anzeigen

Unterstuetzte Formate:
  CSV   Automatische Erkennung von Trennzeichen (, ; TAB)
        Erste Zeile = Header mit Spaltennamen
  JSON  Array von Objekten oder Firebase-Objekt
  SQL   INSERT INTO ... VALUES ... Statements

Spalten-Mapping (automatisch):
  name/vollname/full_name            -> name (Pflicht)
  firma/company/unternehmen          -> company
  email/e_mail/mail                  -> email
  telefon/phone/tel                  -> phone
  plz/zip/postleitzahl/postal_code   -> plz (Pflicht wenn kein lat/lng)
  stadt/city/ort                     -> city (Pflicht wenn kein lat/lng)
  strasse/street/address/adresse     -> address
  lat/latitude/breitengrad           -> lat
  lng/lon/longitude/laengengrad      -> lng
  spezialisierung/specialty          -> specialty (Standard: 'kfz')

Beispiele:
  php import_partners.php partners.csv
  php import_partners.php export.json --dry-run
  php import_partners.php --sql appahoi_dump.sql --update
  php import_partners.php firebase_export.json --update --dry-run

HELP;
    fwrite(STDERR, $help);
}

// ============================================================
// CLI Entry Point
// ============================================================

$args = array_slice($argv, 1);

if (count($args) === 0) {
    show_help();
    exit(1);
}

// Flags parsen
$do_update = false;
$dry_run = false;
$sql_mode = false;
$filepath = null;

for ($i = 0; $i < count($args); $i++) {
    $arg = $args[$i];

    if ($arg === '--help' || $arg === '-h') {
        show_help();
        exit(0);
    }

    if ($arg === '--update') {
        $do_update = true;
        continue;
    }

    if ($arg === '--dry-run') {
        $dry_run = true;
        continue;
    }

    if ($arg === '--sql') {
        $sql_mode = true;
        continue;
    }

    // Alles andere ist der Dateipfad
    if ($filepath === null) {
        $filepath = $arg;
    } else {
        cli_log("Unbekanntes Argument: $arg", 'error');
        show_help();
        exit(1);
    }
}

// Validierung
if ($filepath === null) {
    cli_log("Keine Datei angegeben.", 'error');
    show_help();
    exit(1);
}

if (!file_exists($filepath)) {
    cli_log("Datei nicht gefunden: $filepath", 'error');
    exit(1);
}

if (!is_readable($filepath)) {
    cli_log("Datei nicht lesbar: $filepath", 'error');
    exit(1);
}

$filesize = filesize($filepath);
$filesize_mb = round($filesize / 1024 / 1024, 2);
cli_log("Datei: $filepath ($filesize_mb MB)");

// Format erkennen und einlesen
$raw_rows = array();

if ($sql_mode) {
    cli_log("Modus: SQL-Dump Import");
    $raw_rows = read_sql($filepath);
} else {
    $ext = strtolower(pathinfo($filepath, PATHINFO_EXTENSION));

    if ($ext === 'csv' || $ext === 'tsv' || $ext === 'txt') {
        cli_log("Modus: CSV-Import");
        $raw_rows = read_csv($filepath);
    } elseif ($ext === 'json') {
        cli_log("Modus: JSON-Import");
        $raw_rows = read_json($filepath);
    } else {
        // Inhalt pruefen: JSON beginnt mit { oder [
        $first_char = '';
        $fh = fopen($filepath, 'r');
        if ($fh !== false) {
            // BOM ueberspringen
            $start = fread($fh, 3);
            if ($start === "\xEF\xBB\xBF") {
                $first_char = trim(fread($fh, 1));
            } else {
                $first_char = trim($start[0]);
            }
            fclose($fh);
        }

        if ($first_char === '{' || $first_char === '[') {
            cli_log("Dateiendung unbekannt, Inhalt sieht nach JSON aus.");
            $raw_rows = read_json($filepath);
        } elseif (stripos(file_get_contents($filepath, false, null, 0, 1024), 'INSERT') !== false) {
            cli_log("Dateiendung unbekannt, Inhalt sieht nach SQL aus.");
            $raw_rows = read_sql($filepath);
        } else {
            cli_log("Dateiendung unbekannt, versuche CSV-Import.");
            $raw_rows = read_csv($filepath);
        }
    }
}

cli_log("Datensaetze eingelesen: " . count($raw_rows));

if (count($raw_rows) === 0) {
    cli_log("Keine Datensaetze gefunden. Import abgebrochen.", 'error');
    exit(1);
}

// Flags anzeigen
if ($do_update) {
    cli_log("Modus: Duplikate werden aktualisiert (--update)");
}
if ($dry_run) {
    cli_log("Modus: Trockenlauf (--dry-run)");
}

fwrite(STDERR, "\n");

// Import ausfuehren
$stats = process_import($raw_rows, $do_update, $dry_run);

// Statistiken ausgeben
print_stats($stats, $dry_run);

// Exit-Code
if ($stats['errors'] > 0 && $stats['imported'] === 0 && $stats['updated'] === 0) {
    exit(1);
}

exit(0);
