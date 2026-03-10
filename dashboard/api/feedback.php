<?php
/**
 * DGD Dashboard - Feedback System API
 *
 * Endpoints:
 *   GET  /api/feedback/templates              - List templates (filter: type, active)
 *   GET  /api/feedback/templates/{id}         - Single template
 *   POST /api/feedback/templates              - Create template
 *   PUT  /api/feedback/templates/{id}         - Update template (toggle active)
 *   POST /api/feedback/responses              - Submit response
 *   GET  /api/feedback/results/{template_id}  - Aggregated results
 *   GET  /api/feedback/pulse-status           - Check if user needs pulse survey
 *   GET  /api/feedback/trends                 - Pulse survey trends over time
 */

require_once __DIR__ . '/config.php';


// ============================================================
//  TABLE SETUP
// ============================================================

function feedback_ensure_tables(): void
{
    $db = get_db();

    $db->exec("
        CREATE TABLE IF NOT EXISTS feedback_templates (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            questions TEXT NOT NULL,
            type TEXT NOT NULL DEFAULT 'pulse',
            active INTEGER DEFAULT 1,
            created_by TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (created_by) REFERENCES users(id)
        )
    ");

    $db->exec("
        CREATE TABLE IF NOT EXISTS feedback_responses (
            id TEXT PRIMARY KEY,
            template_id TEXT NOT NULL,
            respondent_id TEXT,
            target_id TEXT,
            answers TEXT NOT NULL,
            anonymous INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (template_id) REFERENCES feedback_templates(id)
        )
    ");

    $db->exec("CREATE INDEX IF NOT EXISTS idx_fb_tmpl_type     ON feedback_templates(type)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_fb_tmpl_active   ON feedback_templates(active)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_fb_resp_tmpl     ON feedback_responses(template_id)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_fb_resp_user     ON feedback_responses(respondent_id)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_fb_resp_created  ON feedback_responses(created_at)");
}


// ============================================================
//  HANDLERS
// ============================================================

/**
 * GET /api/feedback/templates
 * Query params: ?type=pulse&active=1
 */
function handle_list_feedback_templates(): void
{
    requireAuth();
    feedback_ensure_tables();
    $db = get_db();

    $where  = [];
    $params = [];

    if (!empty($_GET['type'])) {
        $where[]           = 't.type = :type';
        $params[':type']   = $_GET['type'];
    }
    if (isset($_GET['active']) && $_GET['active'] !== '') {
        $where[]             = 't.active = :active';
        $params[':active']   = (int) $_GET['active'];
    }

    $whereClause = count($where) > 0 ? 'WHERE ' . implode(' AND ', $where) : '';

    $stmt = $db->prepare("
        SELECT t.*,
            (SELECT COUNT(*) FROM feedback_responses r WHERE r.template_id = t.id) as response_count
        FROM feedback_templates t
        {$whereClause}
        ORDER BY t.created_at DESC
    ");
    $stmt->execute($params);
    $templates = $stmt->fetchAll();

    foreach ($templates as &$tmpl) {
        $tmpl['active']         = (int) $tmpl['active'];
        $tmpl['response_count'] = (int) $tmpl['response_count'];
        $tmpl['questions']      = json_decode($tmpl['questions'], true) ?? [];
    }

    json_response([
        'templates' => $templates,
        'total'     => count($templates),
    ]);
}

/**
 * GET /api/feedback/templates/{id}
 */
function handle_get_feedback_template(string $id): void
{
    requireAuth();
    feedback_ensure_tables();
    $db = get_db();

    $stmt = $db->prepare("SELECT * FROM feedback_templates WHERE id = :id");
    $stmt->execute([':id' => $id]);
    $tmpl = $stmt->fetch();

    if (!$tmpl) {
        json_error('Template not found', 404);
    }

    $tmpl['active']    = (int) $tmpl['active'];
    $tmpl['questions'] = json_decode($tmpl['questions'], true) ?? [];

    // Response count
    $countStmt = $db->prepare("SELECT COUNT(*) FROM feedback_responses WHERE template_id = :id");
    $countStmt->execute([':id' => $id]);
    $tmpl['response_count'] = (int) $countStmt->fetchColumn();

    json_response(['template' => $tmpl]);
}

/**
 * POST /api/feedback/templates
 * Body: { title, description?, questions: [{question, type, options?}], type?, active? }
 */
function handle_create_feedback_template(): void
{
    requireAuth();
    feedback_ensure_tables();
    $body = get_json_body();

    if (empty($body['title'])) {
        json_error('Title is required', 400);
    }
    if (empty($body['questions']) || !is_array($body['questions'])) {
        json_error('Questions array is required', 400);
    }

    // Validate questions
    foreach ($body['questions'] as $i => $q) {
        if (empty($q['question'])) {
            json_error("Question at index {$i} is missing 'question' field", 400);
        }
        if (empty($q['type']) || !in_array($q['type'], ['scale', 'text', 'choice'])) {
            json_error("Question at index {$i} must have type: scale, text, or choice", 400);
        }
    }

    $db  = get_db();
    $id  = generate_uuid();
    $now = now_iso();

    $validTypes = ['pulse', '360', 'exit', 'custom'];
    $type = trim($body['type'] ?? 'pulse');
    if (!in_array($type, $validTypes)) {
        json_error('Invalid type. Valid: ' . implode(', ', $validTypes), 400);
    }

    $db->prepare("
        INSERT INTO feedback_templates (id, title, description, questions, type, active, created_by, created_at)
        VALUES (:id, :title, :description, :questions, :type, :active, :created_by, :created_at)
    ")->execute([
        ':id'          => $id,
        ':title'       => trim($body['title']),
        ':description' => trim($body['description'] ?? ''),
        ':questions'   => json_encode($body['questions'], JSON_UNESCAPED_UNICODE),
        ':type'        => $type,
        ':active'      => (int) ($body['active'] ?? 1),
        ':created_by'  => $_SESSION['user_id'],
        ':created_at'  => $now,
    ]);

    json_success('Template created', ['id' => $id]);
}

/**
 * PUT /api/feedback/templates/{id}
 * Body: { title?, description?, questions?, type?, active? }
 */
function handle_update_feedback_template(string $id): void
{
    requireAuth();
    feedback_ensure_tables();
    $body = get_json_body();

    $db = get_db();

    $exists = $db->prepare("SELECT id FROM feedback_templates WHERE id = :id");
    $exists->execute([':id' => $id]);
    if (!$exists->fetch()) {
        json_error('Template not found', 404);
    }

    $sets   = [];
    $params = [':id' => $id];

    if (array_key_exists('title', $body)) {
        $sets[]            = 'title = :title';
        $params[':title']  = trim($body['title']);
    }
    if (array_key_exists('description', $body)) {
        $sets[]                  = 'description = :description';
        $params[':description']  = trim($body['description']);
    }
    if (array_key_exists('questions', $body) && is_array($body['questions'])) {
        $sets[]                = 'questions = :questions';
        $params[':questions']  = json_encode($body['questions'], JSON_UNESCAPED_UNICODE);
    }
    if (array_key_exists('type', $body)) {
        $sets[]           = 'type = :type';
        $params[':type']  = trim($body['type']);
    }
    if (array_key_exists('active', $body)) {
        $sets[]             = 'active = :active';
        $params[':active']  = (int) $body['active'];
    }

    if (empty($sets)) {
        json_error('No fields to update', 400);
    }

    $sql = "UPDATE feedback_templates SET " . implode(', ', $sets) . " WHERE id = :id";
    $db->prepare($sql)->execute($params);

    json_success('Template updated');
}

/**
 * POST /api/feedback/responses
 * Body: { template_id, answers: [...], target_id?, anonymous? }
 */
function handle_submit_feedback_response(): void
{
    requireAuth();
    feedback_ensure_tables();
    $body = get_json_body();

    if (empty($body['template_id'])) {
        json_error('template_id is required', 400);
    }
    if (!isset($body['answers']) || !is_array($body['answers'])) {
        json_error('answers array is required', 400);
    }

    $db = get_db();

    // Verify template exists and is active
    $tmplStmt = $db->prepare("SELECT id, questions, active FROM feedback_templates WHERE id = :id");
    $tmplStmt->execute([':id' => $body['template_id']]);
    $tmpl = $tmplStmt->fetch();

    if (!$tmpl) {
        json_error('Template not found', 404);
    }
    if (!(int) $tmpl['active']) {
        json_error('Template is no longer active', 400);
    }

    // Validate answer count matches question count
    $questions = json_decode($tmpl['questions'], true) ?? [];
    if (count($body['answers']) !== count($questions)) {
        json_error('Answer count (' . count($body['answers']) . ') does not match question count (' . count($questions) . ')', 400);
    }

    $id        = generate_uuid();
    $now       = now_iso();
    $anonymous = (int) ($body['anonymous'] ?? 0);

    $db->prepare("
        INSERT INTO feedback_responses (id, template_id, respondent_id, target_id, answers, anonymous, created_at)
        VALUES (:id, :template_id, :respondent_id, :target_id, :answers, :anonymous, :created_at)
    ")->execute([
        ':id'            => $id,
        ':template_id'   => $body['template_id'],
        ':respondent_id' => $anonymous ? null : $_SESSION['user_id'],
        ':target_id'     => $body['target_id'] ?? null,
        ':answers'       => json_encode($body['answers'], JSON_UNESCAPED_UNICODE),
        ':anonymous'     => $anonymous,
        ':created_at'    => $now,
    ]);

    json_success('Response submitted', ['id' => $id]);
}

/**
 * GET /api/feedback/results/{template_id}
 */
function handle_feedback_results(string $templateId): void
{
    requireAuth();
    feedback_ensure_tables();
    $db = get_db();

    // Get template with questions
    $tmplStmt = $db->prepare("SELECT * FROM feedback_templates WHERE id = :id");
    $tmplStmt->execute([':id' => $templateId]);
    $tmpl = $tmplStmt->fetch();

    if (!$tmpl) {
        json_error('Template not found', 404);
    }

    $questions = json_decode($tmpl['questions'], true) ?? [];

    // Get all responses
    $respStmt = $db->prepare("
        SELECT answers, created_at FROM feedback_responses
        WHERE template_id = :tid
        ORDER BY created_at ASC
    ");
    $respStmt->execute([':tid' => $templateId]);
    $responses = $respStmt->fetchAll();

    $responseCount = count($responses);

    // Aggregate per question
    $results = [];
    foreach ($questions as $qi => $q) {
        $result = [
            'question' => $q['question'],
            'type'     => $q['type'],
        ];

        if ($q['type'] === 'scale') {
            $values = [];
            foreach ($responses as $resp) {
                $answers = json_decode($resp['answers'], true) ?? [];
                if (isset($answers[$qi]) && is_numeric($answers[$qi])) {
                    $values[] = (float) $answers[$qi];
                }
            }
            $result['avg']   = count($values) > 0 ? round(array_sum($values) / count($values), 2) : null;
            $result['min']   = count($values) > 0 ? min($values) : null;
            $result['max']   = count($values) > 0 ? max($values) : null;
            $result['count'] = count($values);
        } elseif ($q['type'] === 'text') {
            $texts = [];
            foreach ($responses as $resp) {
                $answers = json_decode($resp['answers'], true) ?? [];
                if (!empty($answers[$qi])) {
                    $texts[] = $answers[$qi];
                }
            }
            $result['responses'] = $texts;
            $result['count']     = count($texts);
        } elseif ($q['type'] === 'choice') {
            $distribution = [];
            foreach ($responses as $resp) {
                $answers = json_decode($resp['answers'], true) ?? [];
                if (isset($answers[$qi])) {
                    $val = (string) $answers[$qi];
                    $distribution[$val] = ($distribution[$val] ?? 0) + 1;
                }
            }
            $result['distribution'] = $distribution;
            $result['count']        = array_sum($distribution);
        }

        $results[] = $result;
    }

    json_response([
        'template_id'    => $templateId,
        'template_title' => $tmpl['title'],
        'response_count' => $responseCount,
        'results'        => $results,
    ]);
}

/**
 * GET /api/feedback/pulse-status
 * Checks if the current user has already submitted a pulse survey this week.
 */
function handle_pulse_status(): void
{
    requireAuth();
    feedback_ensure_tables();
    $db = get_db();

    // Find active pulse template
    $tmplStmt = $db->query("
        SELECT id, title FROM feedback_templates
        WHERE type = 'pulse' AND active = 1
        ORDER BY created_at DESC
        LIMIT 1
    ");
    $template = $tmplStmt->fetch();

    if (!$template) {
        json_response([
            'needs_response' => false,
            'reason'         => 'No active pulse survey',
        ]);
        return;
    }

    // Check if user responded this week (Monday-Sunday)
    $weekStart = date('Y-m-d', strtotime('monday this week')) . 'T00:00:00Z';

    $respStmt = $db->prepare("
        SELECT id FROM feedback_responses
        WHERE template_id = :tid AND respondent_id = :uid AND created_at >= :week_start
        LIMIT 1
    ");
    $respStmt->execute([
        ':tid'        => $template['id'],
        ':uid'        => $_SESSION['user_id'],
        ':week_start' => $weekStart,
    ]);
    $alreadyDone = (bool) $respStmt->fetch();

    json_response([
        'needs_response' => !$alreadyDone,
        'template_id'    => $template['id'],
        'template_title' => $template['title'],
        'week_start'     => $weekStart,
    ]);
}

/**
 * GET /api/feedback/trends
 * Returns weekly pulse survey averages over time.
 * Query params: ?weeks=12
 */
function handle_feedback_trends(): void
{
    requireAuth();
    feedback_ensure_tables();
    $db = get_db();

    $weeks = min(max((int) ($_GET['weeks'] ?? 12), 1), 52);

    // Find active pulse template
    $tmplStmt = $db->query("
        SELECT id, title, questions FROM feedback_templates
        WHERE type = 'pulse' AND active = 1
        ORDER BY created_at DESC
        LIMIT 1
    ");
    $template = $tmplStmt->fetch();

    if (!$template) {
        json_response([
            'trends'  => [],
            'message' => 'No active pulse survey',
        ]);
        return;
    }

    $questions = json_decode($template['questions'], true) ?? [];
    $startDate = date('Y-m-d', strtotime("-{$weeks} weeks monday")) . 'T00:00:00Z';

    $respStmt = $db->prepare("
        SELECT answers, created_at FROM feedback_responses
        WHERE template_id = :tid AND created_at >= :start
        ORDER BY created_at ASC
    ");
    $respStmt->execute([':tid' => $template['id'], ':start' => $startDate]);
    $responses = $respStmt->fetchAll();

    // Group by ISO week
    $weeklyData = [];
    foreach ($responses as $resp) {
        $weekKey = date('o-W', strtotime($resp['created_at']));
        if (!isset($weeklyData[$weekKey])) {
            $weeklyData[$weekKey] = [];
        }
        $weeklyData[$weekKey][] = json_decode($resp['answers'], true) ?? [];
    }

    // Calculate averages per week for scale questions
    $trends = [];
    foreach ($weeklyData as $week => $answersArr) {
        $weekResult = [
            'week'           => $week,
            'response_count' => count($answersArr),
            'averages'       => [],
        ];

        foreach ($questions as $qi => $q) {
            if ($q['type'] === 'scale') {
                $values = [];
                foreach ($answersArr as $ans) {
                    if (isset($ans[$qi]) && is_numeric($ans[$qi])) {
                        $values[] = (float) $ans[$qi];
                    }
                }
                $weekResult['averages'][] = [
                    'question' => $q['question'],
                    'avg'      => count($values) > 0 ? round(array_sum($values) / count($values), 2) : null,
                    'count'    => count($values),
                ];
            }
        }

        $trends[] = $weekResult;
    }

    json_response([
        'template_id'    => $template['id'],
        'template_title' => $template['title'],
        'weeks'          => $weeks,
        'trends'         => $trends,
    ]);
}


// ============================================================
//  SEED DATA
// ============================================================

function feedback_seed_data(string $adminId): void
{
    $db  = get_db();
    $now = now_iso();

    // Pulse Survey Template
    $pulseId = generate_uuid();
    $pulseQuestions = json_encode([
        ['question' => 'Wie zufrieden bist du diese Woche mit deiner Arbeit?', 'type' => 'scale', 'options' => ['min' => 1, 'max' => 5]],
        ['question' => 'Wie gut fuehlt sich die Team-Zusammenarbeit an?', 'type' => 'scale', 'options' => ['min' => 1, 'max' => 5]],
        ['question' => 'Hast du alles was du brauchst um produktiv zu sein?', 'type' => 'choice', 'options' => ['Ja', 'Teilweise', 'Nein']],
        ['question' => 'Was koennen wir verbessern?', 'type' => 'text'],
    ], JSON_UNESCAPED_UNICODE);

    $db->prepare("
        INSERT INTO feedback_templates (id, title, description, questions, type, active, created_by, created_at)
        VALUES (:id, :title, :description, :questions, :type, 1, :created_by, :created_at)
    ")->execute([
        ':id'          => $pulseId,
        ':title'       => 'Woechentlicher Pulse Check',
        ':description' => 'Kurzer wochentlicher Check-In zur Team-Stimmung und Produktivitaet.',
        ':questions'   => $pulseQuestions,
        ':type'        => 'pulse',
        ':created_by'  => $adminId,
        ':created_at'  => $now,
    ]);

    // 360 Feedback Template
    $review360Id = generate_uuid();
    $review360Questions = json_encode([
        ['question' => 'Wie bewertest du die fachliche Kompetenz?', 'type' => 'scale', 'options' => ['min' => 1, 'max' => 5]],
        ['question' => 'Wie gut ist die Kommunikation?', 'type' => 'scale', 'options' => ['min' => 1, 'max' => 5]],
        ['question' => 'Wie zuverlaessig ist die Person?', 'type' => 'scale', 'options' => ['min' => 1, 'max' => 5]],
        ['question' => 'Wie gut arbeitet die Person im Team?', 'type' => 'scale', 'options' => ['min' => 1, 'max' => 5]],
        ['question' => 'Was sind die groessten Staerken?', 'type' => 'text'],
        ['question' => 'Was kann verbessert werden?', 'type' => 'text'],
    ], JSON_UNESCAPED_UNICODE);

    $db->prepare("
        INSERT INTO feedback_templates (id, title, description, questions, type, active, created_by, created_at)
        VALUES (:id, :title, :description, :questions, :type, 1, :created_by, :created_at)
    ")->execute([
        ':id'          => $review360Id,
        ':title'       => '360-Grad Feedback',
        ':description' => 'Umfassende Bewertung durch Kollegen, Vorgesetzte und direkte Berichte.',
        ':questions'   => $review360Questions,
        ':type'        => '360',
        ':created_by'  => $adminId,
        ':created_at'  => $now,
    ]);

    // Exit Interview Template
    $exitId = generate_uuid();
    $exitQuestions = json_encode([
        ['question' => 'Was ist der Hauptgrund fuer deinen Wechsel?', 'type' => 'choice', 'options' => ['Karriereentwicklung', 'Gehaltsbedingt', 'Unternehmenskultur', 'Work-Life-Balance', 'Andere']],
        ['question' => 'Wie zufrieden warst du insgesamt?', 'type' => 'scale', 'options' => ['min' => 1, 'max' => 5]],
        ['question' => 'Wuerdest du DGD als Arbeitgeber weiterempfehlen?', 'type' => 'choice', 'options' => ['Ja, definitiv', 'Eher ja', 'Eher nein', 'Nein']],
        ['question' => 'Was hat dir am besten gefallen?', 'type' => 'text'],
        ['question' => 'Was sollten wir veraendern?', 'type' => 'text'],
    ], JSON_UNESCAPED_UNICODE);

    $db->prepare("
        INSERT INTO feedback_templates (id, title, description, questions, type, active, created_by, created_at)
        VALUES (:id, :title, :description, :questions, :type, 1, :created_by, :created_at)
    ")->execute([
        ':id'          => $exitId,
        ':title'       => 'Exit Interview',
        ':description' => 'Strukturiertes Interview beim Austritt aus dem Unternehmen.',
        ':questions'   => $exitQuestions,
        ':type'        => 'exit',
        ':created_by'  => $adminId,
        ':created_at'  => $now,
    ]);

    // Seed some pulse responses for trend data (last 6 weeks)
    $respStmt = $db->prepare("
        INSERT INTO feedback_responses (id, template_id, respondent_id, target_id, answers, anonymous, created_at)
        VALUES (:id, :template_id, :respondent_id, NULL, :answers, 0, :created_at)
    ");

    for ($w = 5; $w >= 0; $w--) {
        $weekDate = date('Y-m-d\TH:i:s\Z', strtotime("-{$w} weeks wednesday"));
        // Simulate improving trend
        $satisfaction = min(5, 3.5 + (5 - $w) * 0.2 + (rand(-5, 5) / 10));
        $teamwork    = min(5, 3.8 + (5 - $w) * 0.15 + (rand(-5, 5) / 10));
        $answers = json_encode([
            round($satisfaction, 1),
            round($teamwork, 1),
            rand(0, 10) > 3 ? 'Ja' : 'Teilweise',
            '',
        ]);

        $respStmt->execute([
            ':id'            => generate_uuid(),
            ':template_id'   => $pulseId,
            ':respondent_id' => $adminId,
            ':answers'       => $answers,
            ':created_at'    => $weekDate,
        ]);
    }
}
