<?php
/**
 * DGD Dashboard - Database Initialization
 *
 * Creates all tables and inserts seed data on first run.
 * Called automatically from index.php when the DB is missing.
 *
 * Tables: users, invite_codes, projects, milestones, kpis, kpi_history,
 *         goals, key_results, feedback_templates, feedback_responses,
 *         project_expenses, revenue_entries
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/goals.php';
require_once __DIR__ . '/feedback.php';
require_once __DIR__ . '/finance.php';

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
        echo "Users:    " . $db->query("SELECT COUNT(*) FROM users")->fetchColumn() . "\n";
        echo "Projects: " . $db->query("SELECT COUNT(*) FROM projects")->fetchColumn() . "\n";
        echo "KPIs:     " . $db->query("SELECT COUNT(*) FROM kpis")->fetchColumn() . "\n";
        echo "Invites:  " . $db->query("SELECT COUNT(*) FROM invite_codes")->fetchColumn() . "\n";
    } catch (Exception $e) {
        echo "ERROR: " . $e->getMessage() . "\n";
        exit(1);
    }
}
