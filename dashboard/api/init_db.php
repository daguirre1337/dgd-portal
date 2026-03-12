<?php
/**
 * DGD Dashboard - Database Initialization
 *
 * Creates all tables and inserts seed data on first run.
 * Called automatically from index.php when the DB is missing.
 *
 * Tables: users, invite_codes, projects, milestones, kpis, kpi_history,
 *         goals, key_results, feedback_templates, feedback_responses,
 *         project_expenses, revenue_entries, elbdesk_cases, elbdesk_revenue
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/handlers/goals.php';
require_once __DIR__ . '/handlers/feedback.php';
require_once __DIR__ . '/handlers/finance.php';

/**
 * Ensure CRM and page_owners tables exist (migration for existing DBs)
 */
function crm_ensure_tables(): void
{
    $db = get_db();

    // page_owners
    $db->exec("
        CREATE TABLE IF NOT EXISTS page_owners (
            view_name TEXT PRIMARY KEY,
            owner_name TEXT NOT NULL DEFAULT 'Daniel',
            updated_by TEXT,
            updated_at TEXT DEFAULT (datetime('now'))
        )
    ");
    $allViews = ['dashboard','timeline','kpis','mitarbeiter','finanzen','ziele','feedback','roadmap','showcase','settings','crm'];
    foreach ($allViews as $v) {
        $db->exec("INSERT OR IGNORE INTO page_owners (view_name, owner_name) VALUES ('{$v}', 'Daniel')");
    }

    // CRM contacts
    $db->exec("
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
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        )
    ");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_crm_contacts_stage ON crm_contacts(pipeline_stage)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_crm_contacts_org ON crm_contacts(organization)");

    // CRM interactions
    $db->exec("
        CREATE TABLE IF NOT EXISTS crm_interactions (
            id TEXT PRIMARY KEY,
            contact_id TEXT NOT NULL,
            type TEXT NOT NULL,
            summary TEXT NOT NULL,
            details TEXT DEFAULT '',
            sentiment TEXT DEFAULT 'neutral',
            created_by TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE CASCADE
        )
    ");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_crm_interactions_contact ON crm_interactions(contact_id)");

    // CRM deals
    $db->exec("
        CREATE TABLE IF NOT EXISTS crm_deals (
            id TEXT PRIMARY KEY,
            contact_id TEXT NOT NULL,
            title TEXT NOT NULL,
            value REAL DEFAULT 0,
            stage TEXT DEFAULT 'lead',
            probability INTEGER DEFAULT 10,
            expected_close TEXT,
            notes TEXT DEFAULT '',
            assigned_to TEXT DEFAULT '',
            created_by TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE CASCADE
        )
    ");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_crm_deals_stage ON crm_deals(stage)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_crm_deals_contact ON crm_deals(contact_id)");
}

function init_database(): void
{
    $db = get_db();

    // ---- users table ----
    $db->exec("
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            display_name TEXT NOT NULL,
            role TEXT DEFAULT 'member',
            invite_code_used TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            last_login TEXT
        )
    ");

    // ---- invite_codes table ----
    $db->exec("
        CREATE TABLE IF NOT EXISTS invite_codes (
            id TEXT PRIMARY KEY,
            code TEXT UNIQUE NOT NULL,
            created_by TEXT,
            used_by TEXT,
            invited_email TEXT,
            invited_name TEXT,
            expires_at TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (created_by) REFERENCES users(id),
            FOREIGN KEY (used_by) REFERENCES users(id)
        )
    ");

    // Migration: add columns if table already existed without them
    $cols = $db->query("PRAGMA table_info(invite_codes)")->fetchAll();
    $colNames = array_column($cols, 'name');
    if (!in_array('invited_email', $colNames)) {
        $db->exec("ALTER TABLE invite_codes ADD COLUMN invited_email TEXT");
    }
    if (!in_array('invited_name', $colNames)) {
        $db->exec("ALTER TABLE invite_codes ADD COLUMN invited_name TEXT");
    }

    // ---- projects table ----
    $db->exec("
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            category TEXT DEFAULT 'intern',
            status TEXT DEFAULT 'aktiv',
            priority TEXT DEFAULT 'mittel',
            start_date TEXT,
            end_date TEXT,
            progress INTEGER DEFAULT 0,
            owner TEXT,
            tags TEXT,
            created_by TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (created_by) REFERENCES users(id)
        )
    ");

    // ---- milestones table ----
    $db->exec("
        CREATE TABLE IF NOT EXISTS milestones (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            title TEXT NOT NULL,
            date TEXT NOT NULL,
            completed INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
    ");

    // ---- kpis table ----
    $db->exec("
        CREATE TABLE IF NOT EXISTS kpis (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            category TEXT DEFAULT 'portal',
            value REAL DEFAULT 0,
            unit TEXT DEFAULT '',
            target REAL,
            trend TEXT DEFAULT 'stable',
            period TEXT DEFAULT 'monat',
            source TEXT DEFAULT 'manual',
            data_source TEXT DEFAULT 'manual',
            icon TEXT DEFAULT '',
            warning_low REAL,
            warning_high REAL,
            critical_low REAL,
            critical_high REAL,
            updated_at TEXT DEFAULT (datetime('now'))
        )
    ");

    // ---- kpi_history table ----
    $db->exec("
        CREATE TABLE IF NOT EXISTS kpi_history (
            id TEXT PRIMARY KEY,
            kpi_id TEXT NOT NULL,
            value REAL NOT NULL,
            recorded_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (kpi_id) REFERENCES kpis(id) ON DELETE CASCADE
        )
    ");

    // ---- indexes ----
    $db->exec("CREATE INDEX IF NOT EXISTS idx_users_username    ON users(username)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_users_email       ON users(email)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_invite_code       ON invite_codes(code)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_projects_status   ON projects(status)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_projects_category ON projects(category)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_milestones_proj   ON milestones(project_id)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_kpi_history_kpi   ON kpi_history(kpi_id)");

    // ---- elbdesk_cases table ----
    $db->exec("
        CREATE TABLE IF NOT EXISTS elbdesk_cases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            case_id TEXT UNIQUE NOT NULL,
            customer_name TEXT NOT NULL,
            customer_email TEXT,
            customer_phone TEXT,
            damage_type TEXT NOT NULL,
            damage_description TEXT,
            location_street TEXT,
            location_plz TEXT,
            location_city TEXT,
            estimated_value_eur REAL DEFAULT 0,
            actual_value_eur REAL DEFAULT 0,
            gutachter_id TEXT,
            gutachter_name TEXT,
            status TEXT DEFAULT 'offen',
            priority TEXT DEFAULT 'normal',
            phase INTEGER DEFAULT 1,
            phase_label TEXT DEFAULT 'Eingang',
            incident_date TEXT,
            report_date TEXT,
            assignment_date TEXT,
            inspection_date TEXT,
            completion_date TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            synced_at TEXT
        )
    ");

    // ---- elbdesk_revenue table ----
    $db->exec("
        CREATE TABLE IF NOT EXISTS elbdesk_revenue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            case_id TEXT,
            month TEXT NOT NULL,
            description TEXT,
            amount_eur REAL NOT NULL,
            type TEXT DEFAULT 'gutachten',
            source TEXT DEFAULT 'elbdesk',
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (case_id) REFERENCES elbdesk_cases(case_id)
        )
    ");

    // ---- elbdesk indexes ----
    $db->exec("CREATE INDEX IF NOT EXISTS idx_elbdesk_cases_status ON elbdesk_cases(status)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_elbdesk_cases_damage ON elbdesk_cases(damage_type)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_elbdesk_revenue_month ON elbdesk_revenue(month)");

    // ---- page_owners table ----
    $db->exec("
        CREATE TABLE IF NOT EXISTS page_owners (
            view_name TEXT PRIMARY KEY,
            owner_name TEXT NOT NULL DEFAULT 'Daniel',
            updated_by TEXT,
            updated_at TEXT DEFAULT (datetime('now'))
        )
    ");

    // Seed page_owners with Daniel for all views
    $allViews = ['dashboard','timeline','kpis','mitarbeiter','finanzen','ziele','feedback','roadmap','showcase','settings','crm'];
    foreach ($allViews as $v) {
        $db->exec("INSERT OR IGNORE INTO page_owners (view_name, owner_name) VALUES ('{$v}', 'Daniel')");
    }

    // ---- CRM tables ----
    $db->exec("
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
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        )
    ");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_crm_contacts_stage ON crm_contacts(pipeline_stage)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_crm_contacts_org ON crm_contacts(organization)");

    $db->exec("
        CREATE TABLE IF NOT EXISTS crm_interactions (
            id TEXT PRIMARY KEY,
            contact_id TEXT NOT NULL,
            type TEXT NOT NULL,
            summary TEXT NOT NULL,
            details TEXT DEFAULT '',
            sentiment TEXT DEFAULT 'neutral',
            created_by TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE CASCADE
        )
    ");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_crm_interactions_contact ON crm_interactions(contact_id)");

    $db->exec("
        CREATE TABLE IF NOT EXISTS crm_deals (
            id TEXT PRIMARY KEY,
            contact_id TEXT NOT NULL,
            title TEXT NOT NULL,
            value REAL DEFAULT 0,
            stage TEXT DEFAULT 'lead',
            probability INTEGER DEFAULT 10,
            expected_close TEXT,
            notes TEXT DEFAULT '',
            assigned_to TEXT DEFAULT '',
            created_by TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE CASCADE
        )
    ");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_crm_deals_stage ON crm_deals(stage)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_crm_deals_contact ON crm_deals(contact_id)");

    // ---- goals, feedback, finance tables ----
    goals_ensure_tables();
    feedback_ensure_tables();
    finance_ensure_tables();

    // ---- seed data (only if users table is empty) ----
    $count = (int) $db->query("SELECT COUNT(*) FROM users")->fetchColumn();
    if ($count > 0) {
        return; // already seeded
    }

    $now = now_iso();

    $db->beginTransaction();
    try {
        // --- Admin user ---
        $adminId = generate_uuid();
        $adminHash = password_hash('Dklf-dfmdf-7df9j', PASSWORD_DEFAULT);

        $db->prepare("
            INSERT INTO users (id, username, email, password_hash, display_name, role, created_at)
            VALUES (:id, :username, :email, :hash, :display_name, 'admin', :created_at)
        ")->execute([
            ':id'           => $adminId,
            ':username'     => 'daguirre',
            ':email'        => 'd.aguirre@dgd-direkt.de',
            ':hash'         => $adminHash,
            ':display_name' => 'Daniel L. Aguirre',
            ':created_at'   => $now,
        ]);

        // --- Invite codes ---
        // Load from environment or use secure defaults
        $envCodes = getenv('DGD_INVITE_CODES');
        $inviteCodes = $envCodes
            ? array_map('trim', explode(',', $envCodes))
            : ['DGD-' . strtoupper(bin2hex(random_bytes(4))), 'DGD-' . strtoupper(bin2hex(random_bytes(4)))];
        $inviteStmt = $db->prepare("
            INSERT INTO invite_codes (id, code, created_by, created_at)
            VALUES (:id, :code, :created_by, :created_at)
        ");
        foreach ($inviteCodes as $code) {
            $inviteStmt->execute([
                ':id'         => generate_uuid(),
                ':code'       => $code,
                ':created_by' => $adminId,
                ':created_at' => $now,
            ]);
        }

        // --- Projects ---
        $projects = [
            [
                'id'          => generate_uuid(),
                'title'       => 'DGD Portal Launch',
                'description' => 'Entwicklung und Launch des DGD Kundenportals mit Partner-Suche, Warteliste und responsivem Design.',
                'category'    => 'portal',
                'status'      => 'abgeschlossen',
                'priority'    => 'hoch',
                'start_date'  => '2026-01-01',
                'end_date'    => '2026-01-31',
                'progress'    => 100,
                'owner'       => 'David',
                'tags'        => 'portal,launch,php,sqlite',
                'milestones'  => [
                    ['title' => 'Backend API fertig',       'date' => '2026-01-15', 'completed' => 1],
                    ['title' => 'Frontend Design fertig',   'date' => '2026-01-25', 'completed' => 1],
                    ['title' => 'Go-Live',                  'date' => '2026-01-31', 'completed' => 1],
                ],
            ],
            [
                'id'          => generate_uuid(),
                'title'       => 'Partner-Netzwerk Ausbau',
                'description' => 'Akquise und Onboarding neuer Gutachter-Partner in ganz Deutschland. Ziel: 50 aktive Partner bis Q2.',
                'category'    => 'partner',
                'status'      => 'aktiv',
                'priority'    => 'hoch',
                'start_date'  => '2026-02-01',
                'end_date'    => '2026-06-30',
                'progress'    => 45,
                'owner'       => 'David',
                'tags'        => 'partner,akquise,netzwerk',
                'milestones'  => [
                    ['title' => '20 Partner onboarded',     'date' => '2026-03-15', 'completed' => 1],
                    ['title' => '35 Partner onboarded',     'date' => '2026-05-01', 'completed' => 0],
                    ['title' => '50 Partner Ziel erreicht', 'date' => '2026-06-30', 'completed' => 0],
                ],
            ],
            [
                'id'          => generate_uuid(),
                'title'       => 'Marketing Kampagne Q2',
                'description' => 'Social Media Kampagne, Google Ads und Content Marketing fuer die Bekanntmachung von DGD.',
                'category'    => 'marketing',
                'status'      => 'geplant',
                'priority'    => 'mittel',
                'start_date'  => '2026-04-01',
                'end_date'    => '2026-06-30',
                'progress'    => 0,
                'owner'       => 'Marketing Team',
                'tags'        => 'marketing,ads,social-media',
                'milestones'  => [
                    ['title' => 'Kampagnen-Strategie fertig', 'date' => '2026-04-15', 'completed' => 0],
                    ['title' => 'Erste Ads live',             'date' => '2026-05-01', 'completed' => 0],
                ],
            ],
            [
                'id'          => generate_uuid(),
                'title'       => 'Schadenfall-Automatisierung',
                'description' => 'Automatisierung der Schadenfall-Erfassung und Zuweisung an Gutachter mittels KI-gestuetzter Analyse.',
                'category'    => 'intern',
                'status'      => 'aktiv',
                'priority'    => 'hoch',
                'start_date'  => '2026-03-01',
                'end_date'    => '2026-08-31',
                'progress'    => 20,
                'owner'       => 'David',
                'tags'        => 'automatisierung,ki,schadenfall',
                'milestones'  => [
                    ['title' => 'Prototyp Schadenfall-Parser',    'date' => '2026-04-15', 'completed' => 0],
                    ['title' => 'Auto-Zuweisung Beta',            'date' => '2026-06-01', 'completed' => 0],
                    ['title' => 'Produktionsreife',               'date' => '2026-08-31', 'completed' => 0],
                ],
            ],
            [
                'id'          => generate_uuid(),
                'title'       => 'Kundenportal v2',
                'description' => 'Naechste Version des Kundenportals mit Login-Bereich, Schadenfall-Tracking und Partner-Bewertungen.',
                'category'    => 'portal',
                'status'      => 'geplant',
                'priority'    => 'mittel',
                'start_date'  => '2026-07-01',
                'end_date'    => '2026-12-31',
                'progress'    => 0,
                'owner'       => 'David',
                'tags'        => 'portal,v2,login,tracking',
                'milestones'  => [
                    ['title' => 'UX-Konzept abgeschlossen',  'date' => '2026-07-31', 'completed' => 0],
                    ['title' => 'Alpha Release',              'date' => '2026-10-15', 'completed' => 0],
                    ['title' => 'v2 Launch',                  'date' => '2026-12-31', 'completed' => 0],
                ],
            ],
        ];

        $projStmt = $db->prepare("
            INSERT INTO projects (id, title, description, category, status, priority, start_date, end_date, progress, owner, tags, created_by, created_at, updated_at)
            VALUES (:id, :title, :description, :category, :status, :priority, :start_date, :end_date, :progress, :owner, :tags, :created_by, :created_at, :updated_at)
        ");

        $msStmt = $db->prepare("
            INSERT INTO milestones (id, project_id, title, date, completed, created_at)
            VALUES (:id, :project_id, :title, :date, :completed, :created_at)
        ");

        foreach ($projects as $p) {
            $projStmt->execute([
                ':id'          => $p['id'],
                ':title'       => $p['title'],
                ':description' => $p['description'],
                ':category'    => $p['category'],
                ':status'      => $p['status'],
                ':priority'    => $p['priority'],
                ':start_date'  => $p['start_date'],
                ':end_date'    => $p['end_date'],
                ':progress'    => $p['progress'],
                ':owner'       => $p['owner'],
                ':tags'        => $p['tags'],
                ':created_by'  => $adminId,
                ':created_at'  => $now,
                ':updated_at'  => $now,
            ]);

            foreach ($p['milestones'] as $ms) {
                $msStmt->execute([
                    ':id'         => generate_uuid(),
                    ':project_id' => $p['id'],
                    ':title'      => $ms['title'],
                    ':date'       => $ms['date'],
                    ':completed'  => $ms['completed'],
                    ':created_at' => $now,
                ]);
            }
        }

        // --- KPIs ---
        $kpis = [
            [
                'name'     => 'Schadensfälle/Monat',
                'category' => 'kunden',
                'value'    => 47,
                'unit'     => 'Fälle',
                'target'   => 100,
                'trend'    => 'up',
                'icon'     => 'fa-file-alt',
            ],
            [
                'name'     => 'Partner aktiv',
                'category' => 'partner',
                'value'    => 12,
                'unit'     => 'Partner',
                'target'   => 50,
                'trend'    => 'up',
                'icon'     => 'fa-handshake',
            ],
            [
                'name'     => 'Umsatz Q1',
                'category' => 'umsatz',
                'value'    => 28500,
                'unit'     => '€',
                'target'   => 50000,
                'trend'    => 'up',
                'icon'     => 'fa-euro-sign',
            ],
            [
                'name'     => 'Portal-Besucher/Monat',
                'category' => 'portal',
                'value'    => 1250,
                'unit'     => 'Besucher',
                'target'   => 5000,
                'trend'    => 'up',
                'icon'     => 'fa-chart-line',
            ],
            [
                'name'     => 'Conversion Rate',
                'category' => 'portal',
                'value'    => 3.2,
                'unit'     => '%',
                'target'   => 5,
                'trend'    => 'stable',
                'icon'     => 'fa-percentage',
            ],
            [
                'name'     => 'Durchschn. Gutachten-Wert',
                'category' => 'kunden',
                'value'    => 2800,
                'unit'     => '€',
                'target'   => 3000,
                'trend'    => 'up',
                'icon'     => 'fa-calculator',
            ],
            [
                'name'     => 'Partner-Bewerbungen',
                'category' => 'partner',
                'value'    => 8,
                'unit'     => 'Bewerbungen',
                'target'   => 20,
                'trend'    => 'up',
                'icon'     => 'fa-user-plus',
            ],
            [
                'name'     => 'Kundenzufriedenheit',
                'category' => 'kunden',
                'value'    => 4.7,
                'unit'     => '/5',
                'target'   => 4.8,
                'trend'    => 'stable',
                'icon'     => 'fa-star',
            ],
        ];

        $kpiStmt = $db->prepare("
            INSERT INTO kpis (id, name, category, value, unit, target, trend, period, source, icon, updated_at)
            VALUES (:id, :name, :category, :value, :unit, :target, :trend, 'monat', 'manual', :icon, :updated_at)
        ");

        $kpiHistStmt = $db->prepare("
            INSERT INTO kpi_history (id, kpi_id, value, recorded_at)
            VALUES (:id, :kpi_id, :value, :recorded_at)
        ");

        foreach ($kpis as $kpi) {
            $kpiId = generate_uuid();
            $kpiStmt->execute([
                ':id'         => $kpiId,
                ':name'       => $kpi['name'],
                ':category'   => $kpi['category'],
                ':value'      => $kpi['value'],
                ':unit'       => $kpi['unit'],
                ':target'     => $kpi['target'],
                ':trend'      => $kpi['trend'],
                ':icon'       => $kpi['icon'],
                ':updated_at' => $now,
            ]);

            // Insert initial history entry
            $kpiHistStmt->execute([
                ':id'          => generate_uuid(),
                ':kpi_id'      => $kpiId,
                ':value'       => $kpi['value'],
                ':recorded_at' => $now,
            ]);
        }

        // --- Goals, Feedback, Finance seed data ---
        goals_seed_data($adminId);
        feedback_seed_data($adminId);
        finance_seed_data($adminId);

        // --- ELBDESK Cases seed data ---
        $elbdeskCount = (int) $db->query("SELECT COUNT(*) FROM elbdesk_cases")->fetchColumn();
        if ($elbdeskCount === 0) {
            $gutachter = [
                ['id' => 'GA-001', 'name' => 'Thomas Weber'],
                ['id' => 'GA-002', 'name' => 'Lisa Hartmann'],
                ['id' => 'GA-003', 'name' => 'Markus Klein'],
                ['id' => 'GA-004', 'name' => 'Sandra Mueller'],
                ['id' => 'GA-005', 'name' => 'Jens Brandt'],
            ];

            $caseStmt = $db->prepare("
                INSERT INTO elbdesk_cases (
                    case_id, customer_name, customer_email, customer_phone,
                    damage_type, damage_description, location_street, location_plz, location_city,
                    estimated_value_eur, actual_value_eur, gutachter_id, gutachter_name,
                    status, priority, phase, phase_label,
                    incident_date, report_date, assignment_date, inspection_date, completion_date,
                    created_at, updated_at
                ) VALUES (
                    :case_id, :customer_name, :customer_email, :customer_phone,
                    :damage_type, :damage_description, :location_street, :location_plz, :location_city,
                    :estimated_value_eur, :actual_value_eur, :gutachter_id, :gutachter_name,
                    :status, :priority, :phase, :phase_label,
                    :incident_date, :report_date, :assignment_date, :inspection_date, :completion_date,
                    :created_at, :updated_at
                )
            ");

            $elbdeskCases = [
                // --- 8x offen (phase 1 - Eingang) ---
                ['ELB-2026-0031', 'Maria Schmidt', 'maria.schmidt@gmx.de', '040-55512301', 'Wasserschaden', 'Rohrbruch in der Kueche, Wasser unter Parkett gelaufen', 'Eppendorfer Weg 42', '20259', 'Hamburg', 3200, 0, null, null, 'offen', 'hoch', 1, 'Eingang', '2026-03-08', '2026-03-09', null, null, null],
                ['ELB-2026-0032', 'Klaus Petersen', 'k.petersen@web.de', '040-55512302', 'Brandschaden', 'Kuechenbrand durch defekten Herd, Russ an Decke und Waenden', 'Alsterchaussee 15', '20149', 'Hamburg', 8500, 0, null, null, 'offen', 'hoch', 1, 'Eingang', '2026-03-07', '2026-03-08', null, null, null],
                ['ELB-2026-0033', 'Sabine Richter', 's.richter@outlook.de', '040-55512303', 'Sturmschaden', 'Dachziegel abgedeckt nach Sturm, Wasser eindringt', 'Wandsbeker Chaussee 89', '22089', 'Hamburg', 4100, 0, null, null, 'offen', 'normal', 1, 'Eingang', '2026-03-06', '2026-03-07', null, null, null],
                ['ELB-2026-0034', 'Hans-Peter Braun', 'hp.braun@t-online.de', '040-55512304', 'Wasserschaden', 'Ueberflutung im Keller nach Starkregen', 'Bergedorfer Str. 112', '21033', 'Hamburg', 2800, 0, null, null, 'offen', 'normal', 1, 'Eingang', '2026-03-09', '2026-03-10', null, null, null],
                ['ELB-2026-0035', 'Annika Vogt', 'a.vogt@gmail.com', '040-55512305', 'Schimmel', 'Grossflaechiger Schimmelbefall im Schlafzimmer', 'Barmbeker Str. 55', '22303', 'Hamburg', 1900, 0, null, null, 'offen', 'normal', 1, 'Eingang', '2026-03-10', '2026-03-10', null, null, null],
                ['ELB-2026-0036', 'Florian Engel', 'f.engel@yahoo.de', '040-55512306', 'Baumaengel', 'Risse in tragender Wand nach Neubau', 'Luruper Hauptstr. 78', '22547', 'Hamburg', 5500, 0, null, null, 'offen', 'hoch', 1, 'Eingang', '2026-03-08', '2026-03-09', null, null, null],
                ['ELB-2026-0037', 'Petra Lange', 'p.lange@gmx.de', '040-55512307', 'Wasserschaden', 'Waschmaschine ausgelaufen, Laminat aufgequollen', 'Osdorfer Landstr. 200', '22549', 'Hamburg', 1500, 0, null, null, 'offen', 'niedrig', 1, 'Eingang', '2026-03-11', '2026-03-11', null, null, null],
                ['ELB-2026-0038', 'Ralf Zimmermann', 'r.zimmermann@web.de', '040-55512308', 'Sturmschaden', 'Baum auf Garage gefallen, Dach beschaedigt', 'Rahlstedter Weg 33', '22143', 'Hamburg', 6200, 0, null, null, 'offen', 'hoch', 1, 'Eingang', '2026-03-07', '2026-03-08', null, null, null],

                // --- 7x in_bearbeitung (phase 2 - Gutachter beauftragt) ---
                ['ELB-2026-0021', 'Juergen Hoffmann', 'j.hoffmann@gmx.de', '040-55512201', 'Wasserschaden', 'Wasserschaden durch undichte Dachrinne im Obergeschoss', 'Altona Str. 23', '22765', 'Hamburg', 3800, 0, 'GA-001', 'Thomas Weber', 'in_bearbeitung', 'normal', 2, 'Gutachter beauftragt', '2026-02-28', '2026-03-01', '2026-03-03', null, null],
                ['ELB-2026-0022', 'Monika Fischer', 'm.fischer@outlook.de', '040-55512202', 'Brandschaden', 'Schwelbrand im Dachstuhl, erhebliche Russschaeden', 'Hohenzollernring 8', '22763', 'Hamburg', 12000, 0, 'GA-002', 'Lisa Hartmann', 'in_bearbeitung', 'hoch', 2, 'Gutachter beauftragt', '2026-02-25', '2026-02-26', '2026-03-01', null, null],
                ['ELB-2026-0023', 'Dirk Schaefer', 'd.schaefer@t-online.de', '040-55512203', 'Sturmschaden', 'Fassadenschaden durch Sturm Xaver II', 'Harburger Ring 44', '21073', 'Hamburg', 4500, 0, 'GA-003', 'Markus Klein', 'in_bearbeitung', 'normal', 2, 'Gutachter beauftragt', '2026-02-20', '2026-02-21', '2026-02-28', null, null],
                ['ELB-2026-0024', 'Kathrin Bauer', 'k.bauer@gmail.com', '040-55512204', 'Schimmel', 'Schimmel in Bad und Kueche, Mietminderung angedroht', 'Winterhuder Weg 67', '22085', 'Hamburg', 2200, 0, 'GA-004', 'Sandra Mueller', 'in_bearbeitung', 'normal', 2, 'Gutachter beauftragt', '2026-03-01', '2026-03-02', '2026-03-05', null, null],
                ['ELB-2026-0025', 'Sven Krause', 's.krause@web.de', '040-55512205', 'Wasserschaden', 'Heizungsrohr geplatzt im Winter, Estrich durchnaesst', 'Bramfelder Str. 99', '22305', 'Hamburg', 5100, 0, 'GA-005', 'Jens Brandt', 'in_bearbeitung', 'hoch', 2, 'Gutachter beauftragt', '2026-02-15', '2026-02-16', '2026-02-25', null, null],
                ['ELB-2026-0026', 'Eva Wolff', 'e.wolff@gmx.de', '040-55512206', 'Baumaengel', 'Feuchtigkeitseintritt durch mangelhafte Abdichtung', 'Billstedter Hauptstr. 12', '22111', 'Hamburg', 3400, 0, 'GA-001', 'Thomas Weber', 'in_bearbeitung', 'normal', 2, 'Gutachter beauftragt', '2026-03-02', '2026-03-03', '2026-03-06', null, null],
                ['ELB-2026-0027', 'Torsten Beck', 't.beck@yahoo.de', '040-55512207', 'Wasserschaden', 'Rueckstau aus Kanalisation im Kellergeschoss', 'Poppenbütteler Weg 5', '22399', 'Hamburg', 2900, 0, 'GA-002', 'Lisa Hartmann', 'in_bearbeitung', 'normal', 2, 'Gutachter beauftragt', '2026-03-04', '2026-03-05', '2026-03-08', null, null],

                // --- 5x termin (phase 3 - Termin vereinbart) ---
                ['ELB-2026-0016', 'Werner Scholz', 'w.scholz@t-online.de', '040-55512101', 'Sturmschaden', 'Schornstein beschaedigt, lose Ziegel auf Dach', 'Blankenese Hauptstr. 3', '22587', 'Hamburg', 3600, 0, 'GA-003', 'Markus Klein', 'termin', 'normal', 3, 'Termin vereinbart', '2026-02-10', '2026-02-11', '2026-02-18', '2026-03-14', null],
                ['ELB-2026-0017', 'Inge Hartmann', 'i.hartmann@gmx.de', '040-55512102', 'Wasserschaden', 'Wasserfleck an Decke breitet sich aus, Quelle unbekannt', 'Eimsbuetteler Str. 71', '20259', 'Hamburg', 2400, 0, 'GA-004', 'Sandra Mueller', 'termin', 'normal', 3, 'Termin vereinbart', '2026-02-08', '2026-02-09', '2026-02-15', '2026-03-12', null],
                ['ELB-2026-0018', 'Oliver Neumann', 'o.neumann@outlook.de', '040-55512103', 'Schimmel', 'Schimmel hinter Einbauschrank, gesundheitliche Bedenken', 'Uhlenhorster Weg 19', '22085', 'Hamburg', 1800, 0, 'GA-005', 'Jens Brandt', 'termin', 'hoch', 3, 'Termin vereinbart', '2026-02-12', '2026-02-13', '2026-02-20', '2026-03-15', null],
                ['ELB-2026-0019', 'Christine Maier', 'c.maier@web.de', '040-55512104', 'Brandschaden', 'Kaminbrand mit Folgeschaeden an Schornstein und Wand', 'Nienstedtener Marktplatz 7', '22609', 'Hamburg', 7200, 0, 'GA-001', 'Thomas Weber', 'termin', 'hoch', 3, 'Termin vereinbart', '2026-02-05', '2026-02-06', '2026-02-14', '2026-03-13', null],
                ['ELB-2026-0020', 'Martin Schulze', 'm.schulze@gmail.com', '040-55512105', 'Sturmschaden', 'Wintergarten-Verglasung durch Hagel zerstoert', 'Sasel Weg 88', '22393', 'Hamburg', 4800, 0, 'GA-002', 'Lisa Hartmann', 'termin', 'normal', 3, 'Termin vereinbart', '2026-02-15', '2026-02-16', '2026-02-22', '2026-03-16', null],

                // --- 10x abgeschlossen (phase 4 - Fertig) ---
                ['ELB-2025-0001', 'Andrea Koenig', 'a.koenig@gmx.de', '040-55511001', 'Wasserschaden', 'Rohrbruch in Badezimmer, komplette Sanierung', 'Grindelallee 45', '20146', 'Hamburg', 4200, 4350, 'GA-001', 'Thomas Weber', 'abgeschlossen', 'normal', 4, 'Fertig', '2025-09-15', '2025-09-16', '2025-09-20', '2025-10-05', '2025-10-20'],
                ['ELB-2025-0002', 'Stefan Huber', 's.huber@web.de', '040-55511002', 'Brandschaden', 'Zimmerbrand durch Kurzschluss, Wiederaufbau EG', 'Rothenbaumchaussee 12', '20148', 'Hamburg', 15000, 14800, 'GA-002', 'Lisa Hartmann', 'abgeschlossen', 'hoch', 4, 'Fertig', '2025-10-01', '2025-10-02', '2025-10-05', '2025-10-20', '2025-11-15'],
                ['ELB-2025-0003', 'Birgit Lorenz', 'b.lorenz@t-online.de', '040-55511003', 'Sturmschaden', 'Komplette Dachsanierung nach Sturmschaden', 'Elbchaussee 210', '22605', 'Hamburg', 8900, 9200, 'GA-003', 'Markus Klein', 'abgeschlossen', 'hoch', 4, 'Fertig', '2025-10-20', '2025-10-21', '2025-10-25', '2025-11-10', '2025-12-01'],
                ['ELB-2025-0004', 'Thomas Berger', 't.berger@yahoo.de', '040-55511004', 'Schimmel', 'Schimmelsanierung Keller und EG', 'Mundsburger Damm 30', '22087', 'Hamburg', 3100, 3050, 'GA-004', 'Sandra Mueller', 'abgeschlossen', 'normal', 4, 'Fertig', '2025-11-01', '2025-11-02', '2025-11-05', '2025-11-20', '2025-12-10'],
                ['ELB-2025-0005', 'Nicole Wagner', 'n.wagner@gmail.com', '040-55511005', 'Wasserschaden', 'Leitungswasserschaden Dachgeschoss, 3 Zimmer betroffen', 'Sierichstr. 56', '22301', 'Hamburg', 6500, 6800, 'GA-005', 'Jens Brandt', 'abgeschlossen', 'hoch', 4, 'Fertig', '2025-11-10', '2025-11-11', '2025-11-15', '2025-12-01', '2025-12-20'],
                ['ELB-2025-0006', 'Frank Meyer', 'f.meyer@gmx.de', '040-55511006', 'Baumaengel', 'Risse in Fassade und Keller eines Neubaus', 'Habichtstr. 22', '22305', 'Hamburg', 4800, 4600, 'GA-001', 'Thomas Weber', 'abgeschlossen', 'normal', 4, 'Fertig', '2025-12-01', '2025-12-02', '2025-12-05', '2025-12-18', '2026-01-10'],
                ['ELB-2026-0007', 'Heike Fuchs', 'h.fuchs@outlook.de', '040-55511007', 'Wasserschaden', 'Frostschaden an Wasserleitung, Keller ueberschwemmt', 'Dehnhaide 88', '22081', 'Hamburg', 3500, 3650, 'GA-002', 'Lisa Hartmann', 'abgeschlossen', 'normal', 4, 'Fertig', '2026-01-05', '2026-01-06', '2026-01-10', '2026-01-22', '2026-02-05'],
                ['ELB-2026-0008', 'Robert Haas', 'r.haas@t-online.de', '040-55511008', 'Wasserschaden', 'Wassereinbruch durch defekte Dachentwasserung', 'Tonndorfer Weg 14', '22045', 'Hamburg', 5200, 5400, 'GA-003', 'Markus Klein', 'abgeschlossen', 'normal', 4, 'Fertig', '2026-01-15', '2026-01-16', '2026-01-20', '2026-02-01', '2026-02-15'],
                ['ELB-2026-0009', 'Susanne Vogel', 's.vogel@web.de', '040-55511009', 'Wasserschaden', 'Badezimmer-Abdichtung defekt, Schaden in Wohnung darunter', 'Ohlsdorfer Str. 40', '22297', 'Hamburg', 2800, 2950, 'GA-004', 'Sandra Mueller', 'abgeschlossen', 'normal', 4, 'Fertig', '2026-02-01', '2026-02-02', '2026-02-05', '2026-02-18', '2026-03-01'],
                ['ELB-2026-0010', 'Matthias Ernst', 'm.ernst@gmail.com', '040-55511010', 'Brandschaden', 'Wohnungsbrand OG, Statik-Gutachten erforderlich', 'Hammer Steindamm 65', '20535', 'Hamburg', 11000, 10800, 'GA-005', 'Jens Brandt', 'abgeschlossen', 'hoch', 4, 'Fertig', '2026-02-05', '2026-02-06', '2026-02-10', '2026-02-22', '2026-03-05'],
            ];

            foreach ($elbdeskCases as $c) {
                $caseStmt->execute([
                    ':case_id'             => $c[0],
                    ':customer_name'       => $c[1],
                    ':customer_email'      => $c[2],
                    ':customer_phone'      => $c[3],
                    ':damage_type'         => $c[4],
                    ':damage_description'  => $c[5],
                    ':location_street'     => $c[6],
                    ':location_plz'        => $c[7],
                    ':location_city'       => $c[8],
                    ':estimated_value_eur' => $c[9],
                    ':actual_value_eur'    => $c[10],
                    ':gutachter_id'        => $c[11],
                    ':gutachter_name'      => $c[12],
                    ':status'              => $c[13],
                    ':priority'            => $c[14],
                    ':phase'               => $c[15],
                    ':phase_label'         => $c[16],
                    ':incident_date'       => $c[17],
                    ':report_date'         => $c[18],
                    ':assignment_date'     => $c[19],
                    ':inspection_date'     => $c[20],
                    ':completion_date'     => $c[21],
                    ':created_at'          => $now,
                    ':updated_at'          => $now,
                ]);
            }

            // --- ELBDESK Revenue seed data (6 months: 2025-10 to 2026-03, ~45,000 EUR total) ---
            $revStmt = $db->prepare("
                INSERT INTO elbdesk_revenue (case_id, month, description, amount_eur, type, source, created_at)
                VALUES (:case_id, :month, :description, :amount_eur, :type, :source, :created_at)
            ");

            $elbdeskRevenue = [
                // 2025-10: 2 completed cases
                ['ELB-2025-0001', '2025-10', 'Gutachten Wasserschaden - Rohrbruch Grindelallee', 2850.00, 'gutachten', 'elbdesk'],
                ['ELB-2025-0002', '2025-10', 'Gutachten Brandschaden - Zimmerbrand Rothenbaumchaussee (Abschlag)', 3200.00, 'gutachten', 'elbdesk'],

                // 2025-11: remaining + new completions
                ['ELB-2025-0002', '2025-11', 'Gutachten Brandschaden - Rothenbaumchaussee (Restbetrag)', 3400.00, 'gutachten', 'elbdesk'],
                ['ELB-2025-0003', '2025-11', 'Gutachten Sturmschaden - Dachsanierung Elbchaussee', 5800.00, 'gutachten', 'elbdesk'],

                // 2025-12: winter completions
                ['ELB-2025-0004', '2025-12', 'Gutachten Schimmelsanierung - Mundsburger Damm', 1950.00, 'gutachten', 'elbdesk'],
                ['ELB-2025-0005', '2025-12', 'Gutachten Wasserschaden - Leitungswasser Sierichstr.', 4600.00, 'gutachten', 'elbdesk'],
                ['ELB-2025-0006', '2025-12', 'Gutachten Baumaengel - Fassadenrisse Habichtstr.', 2750.00, 'gutachten', 'elbdesk'],

                // 2026-01: new year completions
                ['ELB-2026-0007', '2026-01', 'Gutachten Wasserschaden - Frostschaden Dehnhaide', 2450.00, 'gutachten', 'elbdesk'],
                ['ELB-2026-0008', '2026-01', 'Gutachten Wasserschaden - Dachentwasserung Tonndorfer Weg', 3100.00, 'gutachten', 'elbdesk'],

                // 2026-02: Q1 continued
                ['ELB-2026-0009', '2026-02', 'Gutachten Wasserschaden - Badabdichtung Ohlsdorfer Str.', 1850.00, 'gutachten', 'elbdesk'],
                ['ELB-2026-0008', '2026-02', 'Nachgutachten Dachentwasserung Tonndorfer Weg', 1200.00, 'gutachten', 'elbdesk'],
                ['ELB-2026-0010', '2026-02', 'Gutachten Brandschaden - Wohnungsbrand Hammer Steindamm (Abschlag)', 4800.00, 'gutachten', 'elbdesk'],

                // 2026-03: current month
                ['ELB-2026-0010', '2026-03', 'Gutachten Brandschaden - Hammer Steindamm (Restbetrag)', 4600.00, 'gutachten', 'elbdesk'],
                ['ELB-2026-0009', '2026-03', 'Nachbericht Badabdichtung Ohlsdorfer Str.', 1650.00, 'gutachten', 'elbdesk'],
            ];

            foreach ($elbdeskRevenue as $r) {
                $revStmt->execute([
                    ':case_id'     => $r[0],
                    ':month'       => $r[1],
                    ':description' => $r[2],
                    ':amount_eur'  => $r[3],
                    ':type'        => $r[4],
                    ':source'      => $r[5],
                    ':created_at'  => $now,
                ]);
            }
        }

        $db->commit();

        // Print admin password when running from CLI
        if (php_sapi_name() === 'cli') {
            echo "=== ADMIN CREDENTIALS ===\n";
            echo "Username: admin\n";
            echo "Password: {$adminPassword}\n";
            echo "=========================\n";
        }

    } catch (Exception $e) {
        $db->rollBack();
        throw $e;
    }
}

// Run when called directly: php init_db.php
if (php_sapi_name() === 'cli' && basename(__FILE__) === basename($argv[0] ?? '')) {
    try {
        init_database();
        echo "\nDatabase initialized successfully at " . DB_PATH . "\n";
        $db = get_db();
        echo "Users:           " . $db->query("SELECT COUNT(*) FROM users")->fetchColumn() . "\n";
        echo "Projects:        " . $db->query("SELECT COUNT(*) FROM projects")->fetchColumn() . "\n";
        echo "KPIs:            " . $db->query("SELECT COUNT(*) FROM kpis")->fetchColumn() . "\n";
        echo "Invites:         " . $db->query("SELECT COUNT(*) FROM invite_codes")->fetchColumn() . "\n";
        echo "ELBDESK Cases:   " . $db->query("SELECT COUNT(*) FROM elbdesk_cases")->fetchColumn() . "\n";
        echo "ELBDESK Revenue: " . $db->query("SELECT COUNT(*) FROM elbdesk_revenue")->fetchColumn() . "\n";
    } catch (Exception $e) {
        echo "ERROR: " . $e->getMessage() . "\n";
        exit(1);
    }
}
