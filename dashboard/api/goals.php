<?php
/**
 * DGD Dashboard - Goals / OKR API
 *
 * Endpoints:
 *   GET    /api/goals                     - List goals (filter: type, quarter, year, status, owner)
 *   GET    /api/goals/stats               - Aggregated stats
 *   GET    /api/goals/{id}                - Single goal with key_results
 *   POST   /api/goals                     - Create goal
 *   PUT    /api/goals/{id}                - Update goal
 *   DELETE /api/goals/{id}                - Delete goal (cascade key_results)
 *   POST   /api/goals/{id}/key-results    - Create key result
 *   PUT    /api/key-results/{id}          - Update key result
 *   DELETE /api/key-results/{id}          - Delete key result
 */

require_once __DIR__ . '/config.php';


// ============================================================
//  TABLE SETUP
// ============================================================

function goals_ensure_tables(): void
{
    $db = get_db();

    $db->exec("
        CREATE TABLE IF NOT EXISTS goals (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            type TEXT NOT NULL DEFAULT 'company',
            owner TEXT,
            quarter INTEGER,
            year INTEGER,
            status TEXT NOT NULL DEFAULT 'on_track',
            progress REAL DEFAULT 0,
            parent_goal_id TEXT,
            created_by TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (parent_goal_id) REFERENCES goals(id),
            FOREIGN KEY (created_by) REFERENCES users(id)
        )
    ");

    $db->exec("
        CREATE TABLE IF NOT EXISTS key_results (
            id TEXT PRIMARY KEY,
            goal_id TEXT NOT NULL,
            title TEXT NOT NULL,
            metric TEXT,
            current_value REAL DEFAULT 0,
            target_value REAL NOT NULL,
            unit TEXT DEFAULT '',
            kpi_id TEXT,
            status TEXT NOT NULL DEFAULT 'on_track',
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE,
            FOREIGN KEY (kpi_id) REFERENCES kpis(id)
        )
    ");

    $db->exec("CREATE INDEX IF NOT EXISTS idx_goals_type     ON goals(type)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_goals_status   ON goals(status)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_goals_quarter  ON goals(quarter, year)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_goals_owner    ON goals(owner)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_goals_parent   ON goals(parent_goal_id)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_kr_goal        ON key_results(goal_id)");
}


// ============================================================
//  HANDLERS
// ============================================================

/**
 * GET /api/goals
 * Query params: ?type=company&quarter=1&year=2026&status=on_track&owner=David
 */
function handle_list_goals(): void
{
    requireAuth();
    goals_ensure_tables();
    $db = get_db();

    $where  = [];
    $params = [];

    if (!empty($_GET['type'])) {
        $where[]           = 'g.type = :type';
        $params[':type']   = $_GET['type'];
    }
    if (!empty($_GET['quarter'])) {
        $where[]              = 'g.quarter = :quarter';
        $params[':quarter']   = (int) $_GET['quarter'];
    }
    if (!empty($_GET['year'])) {
        $where[]           = 'g.year = :year';
        $params[':year']   = (int) $_GET['year'];
    }
    if (!empty($_GET['status'])) {
        $where[]             = 'g.status = :status';
        $params[':status']   = $_GET['status'];
    }
    if (!empty($_GET['owner'])) {
        $where[]            = 'g.owner = :owner';
        $params[':owner']   = $_GET['owner'];
    }

    $whereClause = count($where) > 0 ? 'WHERE ' . implode(' AND ', $where) : '';

    $stmt = $db->prepare("
        SELECT g.* FROM goals g
        {$whereClause}
        ORDER BY g.year DESC, g.quarter DESC, g.type,
            CASE g.status
                WHEN 'on_track'  THEN 1
                WHEN 'at_risk'   THEN 2
                WHEN 'behind'    THEN 3
                WHEN 'completed' THEN 4
                ELSE 5
            END
    ");
    $stmt->execute($params);
    $goals = $stmt->fetchAll();

    // Fetch ALL key results in one query (N+1 fix)
    $goalIds = array_column($goals, 'id');
    $krByGoal = [];

    if (!empty($goalIds)) {
        $placeholders = implode(',', array_fill(0, count($goalIds), '?'));
        $krStmt = $db->prepare("
            SELECT * FROM key_results
            WHERE goal_id IN ({$placeholders})
            ORDER BY created_at ASC
        ");
        $krStmt->execute($goalIds);
        $allKrs = $krStmt->fetchAll();

        foreach ($allKrs as &$kr) {
            $kr['current_value'] = (float) $kr['current_value'];
            $kr['target_value']  = (float) $kr['target_value'];
        }

        foreach ($allKrs as $kr) {
            $krByGoal[$kr['goal_id']][] = $kr;
        }
    }

    foreach ($goals as &$goal) {
        $goal['progress'] = (float) $goal['progress'];
        $goal['quarter']  = $goal['quarter'] !== null ? (int) $goal['quarter'] : null;
        $goal['year']     = $goal['year'] !== null ? (int) $goal['year'] : null;
        $goal['key_results'] = $krByGoal[$goal['id']] ?? [];
    }

    json_response([
        'goals' => $goals,
        'total' => count($goals),
    ]);
}

/**
 * GET /api/goals/stats
 */
function handle_goals_stats(): void
{
    requireAuth();
    goals_ensure_tables();
    $db = get_db();

    $total = (int) $db->query("SELECT COUNT(*) FROM goals")->fetchColumn();

    // By status
    $byStatus = [];
    $stmt = $db->query("SELECT status, COUNT(*) as count FROM goals GROUP BY status");
    while ($row = $stmt->fetch()) {
        $byStatus[$row['status']] = (int) $row['count'];
    }

    // By type
    $byType = [];
    $stmt = $db->query("SELECT type, COUNT(*) as count FROM goals GROUP BY type");
    while ($row = $stmt->fetch()) {
        $byType[$row['type']] = (int) $row['count'];
    }

    // Average progress
    $avgProgress = (float) $db->query("SELECT COALESCE(AVG(progress), 0) FROM goals")->fetchColumn();

    json_response([
        'total'        => $total,
        'by_status'    => $byStatus,
        'by_type'      => $byType,
        'avg_progress' => round($avgProgress, 1),
    ]);
}

/**
 * GET /api/goals/{id}
 */
function handle_get_goal(string $id): void
{
    requireAuth();
    goals_ensure_tables();
    $db = get_db();

    $stmt = $db->prepare("SELECT * FROM goals WHERE id = :id");
    $stmt->execute([':id' => $id]);
    $goal = $stmt->fetch();

    if (!$goal) {
        json_error('Goal not found', 404);
    }

    $goal['progress'] = (float) $goal['progress'];
    $goal['quarter']  = $goal['quarter'] !== null ? (int) $goal['quarter'] : null;
    $goal['year']     = $goal['year'] !== null ? (int) $goal['year'] : null;

    // Key results
    $krStmt = $db->prepare("SELECT * FROM key_results WHERE goal_id = :gid ORDER BY created_at ASC");
    $krStmt->execute([':gid' => $id]);
    $krs = $krStmt->fetchAll();
    foreach ($krs as &$kr) {
        $kr['current_value'] = (float) $kr['current_value'];
        $kr['target_value']  = (float) $kr['target_value'];
    }
    $goal['key_results'] = $krs;

    // Child goals
    $childStmt = $db->prepare("SELECT id, title, status, progress FROM goals WHERE parent_goal_id = :pid");
    $childStmt->execute([':pid' => $id]);
    $goal['child_goals'] = $childStmt->fetchAll();

    json_response(['goal' => $goal]);
}

/**
 * POST /api/goals
 * Body: { title, description?, type?, owner?, quarter?, year?, status?, progress?, parent_goal_id? }
 */
function handle_create_goal(): void
{
    requireAuth();
    goals_ensure_tables();
    $body = get_json_body();

    if (empty($body['title'])) {
        json_error('Title is required', 400);
    }

    $db  = get_db();
    $id  = generate_uuid();
    $now = now_iso();

    // Validate parent goal if provided
    if (!empty($body['parent_goal_id'])) {
        $pStmt = $db->prepare("SELECT id FROM goals WHERE id = :id");
        $pStmt->execute([':id' => $body['parent_goal_id']]);
        if (!$pStmt->fetch()) {
            json_error('Parent goal not found', 404);
        }
    }

    $db->prepare("
        INSERT INTO goals (id, title, description, type, owner, quarter, year, status, progress, parent_goal_id, created_by, created_at, updated_at)
        VALUES (:id, :title, :description, :type, :owner, :quarter, :year, :status, :progress, :parent_goal_id, :created_by, :created_at, :updated_at)
    ")->execute([
        ':id'              => $id,
        ':title'           => trim($body['title']),
        ':description'     => trim($body['description'] ?? ''),
        ':type'            => trim($body['type'] ?? 'company'),
        ':owner'           => trim($body['owner'] ?? ''),
        ':quarter'         => isset($body['quarter']) ? (int) $body['quarter'] : null,
        ':year'            => isset($body['year']) ? (int) $body['year'] : null,
        ':status'          => trim($body['status'] ?? 'on_track'),
        ':progress'        => (float) ($body['progress'] ?? 0),
        ':parent_goal_id'  => $body['parent_goal_id'] ?? null,
        ':created_by'      => $_SESSION['user_id'],
        ':created_at'      => $now,
        ':updated_at'      => $now,
    ]);

    json_success('Goal created', ['id' => $id]);
}

/**
 * PUT /api/goals/{id}
 * Body: partial update fields
 */
function handle_update_goal(string $id): void
{
    requireAuth();
    goals_ensure_tables();
    $body = get_json_body();

    $db = get_db();

    $exists = $db->prepare("SELECT id FROM goals WHERE id = :id");
    $exists->execute([':id' => $id]);
    if (!$exists->fetch()) {
        json_error('Goal not found', 404);
    }

    $allowed = ['title', 'description', 'type', 'owner', 'quarter', 'year', 'status', 'progress', 'parent_goal_id'];
    $sets    = [];
    $params  = [':id' => $id, ':updated_at' => now_iso()];

    foreach ($allowed as $field) {
        if (array_key_exists($field, $body)) {
            $sets[]              = "{$field} = :{$field}";
            if (in_array($field, ['quarter', 'year'])) {
                $params[":{$field}"] = $body[$field] !== null ? (int) $body[$field] : null;
            } elseif ($field === 'progress') {
                $params[":{$field}"] = (float) $body[$field];
            } else {
                $params[":{$field}"] = $body[$field] !== null ? trim((string) $body[$field]) : null;
            }
        }
    }

    if (empty($sets)) {
        json_error('No fields to update', 400);
    }

    $sets[] = 'updated_at = :updated_at';
    $sql = "UPDATE goals SET " . implode(', ', $sets) . " WHERE id = :id";
    $db->prepare($sql)->execute($params);

    json_success('Goal updated');
}

/**
 * DELETE /api/goals/{id}
 */
function handle_delete_goal(string $id): void
{
    requireAuth();
    goals_ensure_tables();
    $db = get_db();

    $exists = $db->prepare("SELECT id FROM goals WHERE id = :id");
    $exists->execute([':id' => $id]);
    if (!$exists->fetch()) {
        json_error('Goal not found', 404);
    }

    // key_results cascade via FK ON DELETE CASCADE
    $db->prepare("DELETE FROM goals WHERE id = :id")->execute([':id' => $id]);

    json_success('Goal deleted');
}

/**
 * POST /api/goals/{id}/key-results
 * Body: { title, metric?, current_value?, target_value, unit?, kpi_id?, status? }
 */
function handle_create_key_result(string $goalId): void
{
    requireAuth();
    goals_ensure_tables();
    $body = get_json_body();

    if (empty($body['title'])) {
        json_error('Title is required', 400);
    }
    if (!isset($body['target_value'])) {
        json_error('target_value is required', 400);
    }

    $db = get_db();

    // Verify goal exists
    $exists = $db->prepare("SELECT id FROM goals WHERE id = :id");
    $exists->execute([':id' => $goalId]);
    if (!$exists->fetch()) {
        json_error('Goal not found', 404);
    }

    $id  = generate_uuid();
    $now = now_iso();

    $db->prepare("
        INSERT INTO key_results (id, goal_id, title, metric, current_value, target_value, unit, kpi_id, status, created_at, updated_at)
        VALUES (:id, :goal_id, :title, :metric, :current_value, :target_value, :unit, :kpi_id, :status, :created_at, :updated_at)
    ")->execute([
        ':id'            => $id,
        ':goal_id'       => $goalId,
        ':title'         => trim($body['title']),
        ':metric'        => trim($body['metric'] ?? ''),
        ':current_value' => (float) ($body['current_value'] ?? 0),
        ':target_value'  => (float) $body['target_value'],
        ':unit'          => trim($body['unit'] ?? ''),
        ':kpi_id'        => $body['kpi_id'] ?? null,
        ':status'        => trim($body['status'] ?? 'on_track'),
        ':created_at'    => $now,
        ':updated_at'    => $now,
    ]);

    // Recalculate goal progress from key results
    goals_recalc_progress($db, $goalId);

    json_success('Key result created', ['id' => $id]);
}

/**
 * PUT /api/key-results/{id}
 * Body: partial update fields
 */
function handle_update_key_result(string $id): void
{
    requireAuth();
    goals_ensure_tables();
    $body = get_json_body();

    $db = get_db();

    $stmt = $db->prepare("SELECT id, goal_id FROM key_results WHERE id = :id");
    $stmt->execute([':id' => $id]);
    $kr = $stmt->fetch();

    if (!$kr) {
        json_error('Key result not found', 404);
    }

    $allowed = ['title', 'metric', 'current_value', 'target_value', 'unit', 'kpi_id', 'status'];
    $sets    = [];
    $params  = [':id' => $id, ':updated_at' => now_iso()];

    foreach ($allowed as $field) {
        if (array_key_exists($field, $body)) {
            $sets[] = "{$field} = :{$field}";
            if (in_array($field, ['current_value', 'target_value'])) {
                $params[":{$field}"] = (float) $body[$field];
            } else {
                $params[":{$field}"] = $body[$field] !== null ? trim((string) $body[$field]) : null;
            }
        }
    }

    if (empty($sets)) {
        json_error('No fields to update', 400);
    }

    $sets[] = 'updated_at = :updated_at';
    $sql = "UPDATE key_results SET " . implode(', ', $sets) . " WHERE id = :id";
    $db->prepare($sql)->execute($params);

    // Recalculate goal progress
    goals_recalc_progress($db, $kr['goal_id']);

    json_success('Key result updated');
}

/**
 * DELETE /api/key-results/{id}
 */
function handle_delete_key_result(string $id): void
{
    requireAuth();
    goals_ensure_tables();
    $db = get_db();

    $stmt = $db->prepare("SELECT id, goal_id FROM key_results WHERE id = :id");
    $stmt->execute([':id' => $id]);
    $kr = $stmt->fetch();

    if (!$kr) {
        json_error('Key result not found', 404);
    }

    $db->prepare("DELETE FROM key_results WHERE id = :id")->execute([':id' => $id]);

    // Recalculate goal progress
    goals_recalc_progress($db, $kr['goal_id']);

    json_success('Key result deleted');
}


// ============================================================
//  HELPERS
// ============================================================

/**
 * Recalculate goal progress as average of key result progress percentages.
 */
function goals_recalc_progress(PDO $db, string $goalId): void
{
    $stmt = $db->prepare("
        SELECT current_value, target_value FROM key_results WHERE goal_id = :gid
    ");
    $stmt->execute([':gid' => $goalId]);
    $krs = $stmt->fetchAll();

    if (empty($krs)) {
        return;
    }

    $totalPct = 0;
    foreach ($krs as $kr) {
        $target = (float) $kr['target_value'];
        if ($target > 0) {
            $pct = min(100, ((float) $kr['current_value'] / $target) * 100);
        } else {
            $pct = 0;
        }
        $totalPct += $pct;
    }

    $avgProgress = round($totalPct / count($krs), 1);

    $db->prepare("UPDATE goals SET progress = :progress, updated_at = :now WHERE id = :id")
       ->execute([':progress' => $avgProgress, ':now' => now_iso(), ':id' => $goalId]);
}


// ============================================================
//  SEED DATA
// ============================================================

function goals_seed_data(string $adminId): void
{
    $db  = get_db();
    $now = now_iso();

    $goals = [
        [
            'title'       => 'Umsatz auf 100k EUR steigern',
            'description' => 'Quartalsumsatz auf 100.000 EUR bringen durch Neukundengewinnung und Partnerausbau.',
            'type'        => 'company',
            'owner'       => 'David',
            'quarter'     => 2,
            'year'        => 2026,
            'status'      => 'on_track',
            'progress'    => 35,
            'key_results' => [
                ['title' => '50 aktive Partner', 'metric' => 'Partner-Anzahl', 'current_value' => 12, 'target_value' => 50, 'unit' => 'Partner'],
                ['title' => '200 Schadenfaelle pro Monat', 'metric' => 'Monatliche Faelle', 'current_value' => 47, 'target_value' => 200, 'unit' => 'Faelle'],
                ['title' => 'Durchschnittlicher Gutachtenwert 3.500 EUR', 'metric' => 'Gutachtenwert', 'current_value' => 2800, 'target_value' => 3500, 'unit' => 'EUR'],
            ],
        ],
        [
            'title'       => 'Portal Conversion Rate auf 5% erhoehen',
            'description' => 'Optimierung des Kundenportals fuer hoehere Conversion Rate bei Schadenmeldungen.',
            'type'        => 'team',
            'owner'       => 'Produkt Team',
            'quarter'     => 2,
            'year'        => 2026,
            'status'      => 'at_risk',
            'progress'    => 64,
            'key_results' => [
                ['title' => 'Conversion Rate 5%', 'metric' => 'Conversion', 'current_value' => 3.2, 'target_value' => 5.0, 'unit' => '%'],
                ['title' => '5.000 Besucher pro Monat', 'metric' => 'Besucher', 'current_value' => 1250, 'target_value' => 5000, 'unit' => 'Besucher'],
            ],
        ],
        [
            'title'       => 'Kundenzufriedenheit auf 4.8 steigern',
            'description' => 'Verbesserung des Kundenerlebnisses durch schnellere Bearbeitungszeiten und bessere Kommunikation.',
            'type'        => 'company',
            'owner'       => 'David',
            'quarter'     => 1,
            'year'        => 2026,
            'status'      => 'completed',
            'progress'    => 100,
            'key_results' => [
                ['title' => 'Kundenzufriedenheit 4.8/5', 'metric' => 'Rating', 'current_value' => 4.8, 'target_value' => 4.8, 'unit' => '/5'],
                ['title' => 'Bearbeitungszeit unter 48h', 'metric' => 'Bearbeitungszeit', 'current_value' => 36, 'target_value' => 48, 'unit' => 'Stunden'],
            ],
        ],
        [
            'title'       => 'Schadenfall-Automatisierung live schalten',
            'description' => 'KI-gestuetzte Automatisierung der Schadenfall-Erfassung und Gutachter-Zuweisung.',
            'type'        => 'personal',
            'owner'       => 'David',
            'quarter'     => 3,
            'year'        => 2026,
            'status'      => 'on_track',
            'progress'    => 20,
            'key_results' => [
                ['title' => 'Parser-Genauigkeit 95%', 'metric' => 'Genauigkeit', 'current_value' => 78, 'target_value' => 95, 'unit' => '%'],
                ['title' => 'Auto-Zuweisung fuer 80% der Faelle', 'metric' => 'Automatisierungsrate', 'current_value' => 0, 'target_value' => 80, 'unit' => '%'],
                ['title' => 'Bearbeitungszeit -50%', 'metric' => 'Zeitersparnis', 'current_value' => 10, 'target_value' => 50, 'unit' => '%'],
            ],
        ],
    ];

    $goalStmt = $db->prepare("
        INSERT INTO goals (id, title, description, type, owner, quarter, year, status, progress, parent_goal_id, created_by, created_at, updated_at)
        VALUES (:id, :title, :description, :type, :owner, :quarter, :year, :status, :progress, NULL, :created_by, :created_at, :updated_at)
    ");

    $krStmt = $db->prepare("
        INSERT INTO key_results (id, goal_id, title, metric, current_value, target_value, unit, kpi_id, status, created_at, updated_at)
        VALUES (:id, :goal_id, :title, :metric, :current_value, :target_value, :unit, NULL, 'on_track', :created_at, :updated_at)
    ");

    foreach ($goals as $g) {
        $goalId = generate_uuid();
        $goalStmt->execute([
            ':id'          => $goalId,
            ':title'       => $g['title'],
            ':description' => $g['description'],
            ':type'        => $g['type'],
            ':owner'       => $g['owner'],
            ':quarter'     => $g['quarter'],
            ':year'        => $g['year'],
            ':status'      => $g['status'],
            ':progress'    => $g['progress'],
            ':created_by'  => $adminId,
            ':created_at'  => $now,
            ':updated_at'  => $now,
        ]);

        foreach ($g['key_results'] as $kr) {
            $krStmt->execute([
                ':id'            => generate_uuid(),
                ':goal_id'       => $goalId,
                ':title'         => $kr['title'],
                ':metric'        => $kr['metric'],
                ':current_value' => $kr['current_value'],
                ':target_value'  => $kr['target_value'],
                ':unit'          => $kr['unit'],
                ':created_at'    => $now,
                ':updated_at'    => $now,
            ]);
        }
    }
}
