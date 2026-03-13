<?php
/**
 * DGD Dashboard - CRM Handlers
 *
 * Contacts:
 *   GET    /api/crm/contacts                    - List/search contacts
 *   POST   /api/crm/contacts                    - Create contact
 *   PUT    /api/crm/contacts/{id}               - Update contact
 *   DELETE /api/crm/contacts/{id}               - Delete contact
 *   GET    /api/crm/contacts/{id}/interactions   - Contact interactions
 *   GET    /api/crm/contacts/{id}/activity       - Activity log
 *
 * Deals:
 *   GET    /api/crm/deals                       - List deals
 *   POST   /api/crm/deals                       - Create deal
 *   PUT    /api/crm/deals/{id}                  - Update deal
 *   DELETE /api/crm/deals/{id}                  - Delete deal
 *
 * Interactions:
 *   POST   /api/crm/interactions                - Create interaction
 *
 * Tasks:
 *   GET    /api/crm/tasks/today                 - Today's tasks grouped by category
 *   GET    /api/crm/tasks                       - List tasks (filterable)
 *   POST   /api/crm/tasks                       - Create task
 *   PUT    /api/crm/tasks/{id}                  - Update task
 *
 * Partners:
 *   GET    /api/crm/partners                    - Partners in activation
 *   PUT    /api/crm/partners/{id}               - Update partner timestamps
 *
 * Orders:
 *   GET    /api/crm/orders                      - List orders
 *   POST   /api/crm/orders                      - Create order
 *
 * Reminders:
 *   POST   /api/crm/reminders/process           - Process reminders (Cortex trigger)
 *
 * Reminder Config:
 *   GET    /api/crm/reminder-config             - Get reminder config
 *   PUT    /api/crm/reminder-config/{stage}     - Update reminder config
 *
 * Dashboard:
 *   GET    /api/crm/stats                       - CRM KPIs
 *   GET    /api/crm/pipeline                    - Pipeline overview
 *
 * Import:
 *   POST   /api/crm/import/trello               - Import from Trello JSON
 */

// ---- Internal Helper Functions ----

function crm_log_activity(string $contactId, string $action, array $details, string $user = ''): void
{
    $db = get_db();
    $db->prepare("INSERT INTO crm_activity_log (id, contact_id, action, details, user, created_at) VALUES (:id, :cid, :action, :details, :user, :at)")
       ->execute([':id' => generate_uuid(), ':cid' => $contactId, ':action' => $action, ':details' => json_encode($details), ':user' => $user ?: ($_SESSION['display_name'] ?? 'system'), ':at' => now_iso()]);
}

function crm_create_auto_task(string $contactId, string $title, string $dueDate, string $description = ''): string
{
    $db = get_db();
    $id = generate_uuid();
    $db->prepare("INSERT INTO crm_tasks (id, contact_id, title, description, due_date, status, type, created_by, created_at) VALUES (:id, :cid, :title, :desc, :due, 'pending', 'system', 'system', :at)")
       ->execute([':id' => $id, ':cid' => $contactId, ':title' => $title, ':desc' => $description, ':due' => $dueDate, ':at' => now_iso()]);
    crm_log_activity($contactId, 'task_created', ['task_id' => $id, 'title' => $title, 'due_date' => $dueDate], 'system');
    return $id;
}

function crm_handle_stage_transition(string $contactId, string $oldStage, string $newStage, string $user): void
{
    $db = get_db();
    crm_log_activity($contactId, 'stage_change', ['from' => $oldStage, 'to' => $newStage], $user);

    // Close pending system tasks when stage changes
    $db->prepare("UPDATE crm_tasks SET status = 'done', completed_at = :at WHERE contact_id = :cid AND type = 'system' AND status = 'pending'")
       ->execute([':at' => now_iso(), ':cid' => $contactId]);

    // Get reminder config for new stage
    $config = $db->prepare("SELECT interval_days FROM crm_reminder_config WHERE stage = :s");
    $config->execute([':s' => $newStage]);
    $intervalDays = (int)($config->fetchColumn() ?: 1);

    // Get next_step_date from contact
    $contact = $db->prepare("SELECT next_step_date FROM crm_contacts WHERE id = :id");
    $contact->execute([':id' => $contactId]);
    $nextStepDate = $contact->fetchColumn();

    $now = new DateTime();

    switch ($newStage) {
        case 'neu':
            crm_create_auto_task($contactId, 'Neuen Lead kontaktieren', (clone $now)->modify('+1 hour')->format('Y-m-d H:i:s'));
            break;
        case 'nicht_erreicht':
            crm_create_auto_task($contactId, 'Erneut anrufen', (clone $now)->modify("+{$intervalDays} day")->format('Y-m-d'));
            break;
        case 'quali_terminiert':
            $due = $nextStepDate ?: (clone $now)->modify('+1 day')->format('Y-m-d');
            crm_create_auto_task($contactId, 'Qualigespräch durchführen', $due);
            break;
        case 'no_show_quali':
            crm_create_auto_task($contactId, 'No-Show Follow-up Quali', (clone $now)->modify("+{$intervalDays} day")->format('Y-m-d'));
            break;
        case 'quali_gefuehrt':
            crm_create_auto_task($contactId, 'Abschlussgespräch terminieren', (clone $now)->modify('+1 day')->format('Y-m-d'));
            break;
        case 'abschluss_terminiert':
            $due = $nextStepDate ?: (clone $now)->modify('+1 day')->format('Y-m-d');
            crm_create_auto_task($contactId, 'Abschlussgespräch durchführen', $due);
            break;
        case 'no_show_abschluss':
            crm_create_auto_task($contactId, 'No-Show Follow-up Abschluss', (clone $now)->modify("+{$intervalDays} day")->format('Y-m-d'));
            break;
        case 'abschluss_gefuehrt':
            crm_create_auto_task($contactId, 'Entscheidung einholen', (clone $now)->modify('+1 day')->format('Y-m-d'));
            break;
        case 'entscheidung':
            crm_create_auto_task($contactId, 'Nachfassen Entscheidung', (clone $now)->modify("+{$intervalDays} day")->format('Y-m-d'));
            break;
        case 'gewonnen':
            $db->prepare("UPDATE crm_contacts SET is_partner = 1 WHERE id = :id")->execute([':id' => $contactId]);
            crm_create_auto_task($contactId, 'Onboarding starten', (clone $now)->modify('+1 day')->format('Y-m-d'));
            break;
        case 'verloren':
            // Close all pending tasks
            $db->prepare("UPDATE crm_tasks SET status = 'done', completed_at = :at WHERE contact_id = :cid AND status = 'pending'")
               ->execute([':at' => now_iso(), ':cid' => $contactId]);
            break;
        case 'stillgelegt':
            $due = $nextStepDate ?: (clone $now)->modify("+{$intervalDays} day")->format('Y-m-d');
            crm_create_auto_task($contactId, 'Wiedervorlage', $due);
            break;
    }
}

function process_overdue_tasks(): void
{
    $db = get_db();
    $now = now_iso();
    // Mark overdue tasks
    $db->prepare("UPDATE crm_tasks SET status = 'overdue' WHERE status = 'pending' AND due_date < :now")
       ->execute([':now' => substr($now, 0, 10)]);
}

// ---- Contacts ----

function handle_list_crm_contacts(): void
{
    $db = get_db();

    $where = ['1=1'];
    $params = [];

    if (!empty($_GET['search'])) {
        $s = '%' . $_GET['search'] . '%';
        $where[] = "(name LIKE :s OR email LIKE :s2 OR organization LIKE :s3 OR phone LIKE :s4)";
        $params[':s'] = $s;
        $params[':s2'] = $s;
        $params[':s3'] = $s;
        $params[':s4'] = $s;
    }
    if (!empty($_GET['stage'])) {
        $where[] = "pipeline_stage = :stage";
        $params[':stage'] = $_GET['stage'];
    }
    if (!empty($_GET['assigned_to'])) {
        $where[] = "assigned_to = :assigned";
        $params[':assigned'] = $_GET['assigned_to'];
    }
    if (!empty($_GET['partner_type'])) {
        $where[] = "partner_type = :partner_type";
        $params[':partner_type'] = $_GET['partner_type'];
    }
    if (!empty($_GET['leadquelle'])) {
        $where[] = "leadquelle = :leadquelle";
        $params[':leadquelle'] = $_GET['leadquelle'];
    }
    if (isset($_GET['is_partner'])) {
        $where[] = "is_partner = :is_partner";
        $params[':is_partner'] = (int)$_GET['is_partner'];
    }

    $whereStr = implode(' AND ', $where);
    $order = $_GET['sort'] ?? 'updated_at';
    $allowed_sorts = ['name', 'updated_at', 'created_at', 'health_score', 'deal_value', 'pipeline_stage', 'prioritaet', 'umsatzpotenzial', 'next_step_date'];
    if (!in_array($order, $allowed_sorts)) $order = 'updated_at';
    $dir = ($_GET['dir'] ?? 'DESC') === 'ASC' ? 'ASC' : 'DESC';

    $stmt = $db->prepare("SELECT * FROM crm_contacts WHERE {$whereStr} ORDER BY {$order} {$dir}");
    $stmt->execute($params);
    $contacts = $stmt->fetchAll();

    // Cast numeric fields
    foreach ($contacts as &$c) {
        $c['deal_value'] = (float)($c['deal_value'] ?? 0);
        $c['health_score'] = (int)($c['health_score'] ?? 100);
        $c['ga_count'] = (int)($c['ga_count'] ?? 0);
        $c['umsatzpotenzial'] = (float)($c['umsatzpotenzial'] ?? 0);
        $c['is_partner'] = (int)($c['is_partner'] ?? 0);
        $c['onboarding_email_sent'] = (int)($c['onboarding_email_sent'] ?? 0);
    }

    json_response(['contacts' => $contacts, 'total' => count($contacts)]);
}

function handle_create_crm_contact(): void
{
    $body = get_json_body();

    if (empty(trim($body['name'] ?? ''))) {
        json_error('Name ist erforderlich', 400);
    }

    $db  = get_db();
    $id  = generate_uuid();
    $now = now_iso();

    $tags = $body['tags'] ?? '[]';
    if (is_array($tags)) $tags = json_encode($tags);

    // Auto-compute: if partner_type = 'profi' AND ga_count > 10, add 'Top-Potential' to tags
    $partnerType = trim($body['partner_type'] ?? '');
    $gaCount = (int)($body['ga_count'] ?? 0);
    if ($partnerType === 'profi' && $gaCount > 10) {
        $tagsArr = json_decode($tags, true) ?: [];
        if (!in_array('Top-Potential', $tagsArr)) {
            $tagsArr[] = 'Top-Potential';
        }
        $tags = json_encode($tagsArr);
    }

    $initialStage = trim($body['pipeline_stage'] ?? 'neu');

    $db->prepare("
        INSERT INTO crm_contacts (id, name, email, phone, organization, role, tags, notes,
            pipeline_stage, deal_value, source, assigned_to, next_followup, created_by, created_at, updated_at,
            street, zip, city, state, website, job_title, business_type, ga_count, trello_card_id,
            leadquelle, umsatzpotenzial, prioritaet, next_step, next_step_date,
            onboarding_email_sent, ai_research, firmeninfos, geschaeftsfuehrer, gf_match,
            partner_type, is_partner, registered_at, verified_at, test_order_at, first_real_order_at)
        VALUES (:id, :name, :email, :phone, :org, :role, :tags, :notes,
            :stage, :deal_value, :source, :assigned, :followup, :created_by, :now, :now2,
            :street, :zip, :city, :state, :website, :job_title, :business_type, :ga_count, :trello_card_id,
            :leadquelle, :umsatzpotenzial, :prioritaet, :next_step, :next_step_date,
            :onboarding_email_sent, :ai_research, :firmeninfos, :geschaeftsfuehrer, :gf_match,
            :partner_type, :is_partner, :registered_at, :verified_at, :test_order_at, :first_real_order_at)
    ")->execute([
        ':id'                    => $id,
        ':name'                  => trim($body['name']),
        ':email'                 => trim($body['email'] ?? ''),
        ':phone'                 => trim($body['phone'] ?? ''),
        ':org'                   => trim($body['organization'] ?? ''),
        ':role'                  => trim($body['role'] ?? ''),
        ':tags'                  => $tags,
        ':notes'                 => trim($body['notes'] ?? ''),
        ':stage'                 => $initialStage,
        ':deal_value'            => (float)($body['deal_value'] ?? 0),
        ':source'                => trim($body['source'] ?? 'manual'),
        ':assigned'              => trim($body['assigned_to'] ?? ''),
        ':followup'              => $body['next_followup'] ?? null,
        ':created_by'            => $_SESSION['user_id'],
        ':now'                   => $now,
        ':now2'                  => $now,
        ':street'                => trim($body['street'] ?? ''),
        ':zip'                   => trim($body['zip'] ?? ''),
        ':city'                  => trim($body['city'] ?? ''),
        ':state'                 => trim($body['state'] ?? ''),
        ':website'               => trim($body['website'] ?? ''),
        ':job_title'             => trim($body['job_title'] ?? ''),
        ':business_type'         => trim($body['business_type'] ?? ''),
        ':ga_count'              => $gaCount,
        ':trello_card_id'        => trim($body['trello_card_id'] ?? ''),
        ':leadquelle'            => trim($body['leadquelle'] ?? ''),
        ':umsatzpotenzial'       => (float)($body['umsatzpotenzial'] ?? 0),
        ':prioritaet'            => trim($body['prioritaet'] ?? ''),
        ':next_step'             => trim($body['next_step'] ?? ''),
        ':next_step_date'        => $body['next_step_date'] ?? null,
        ':onboarding_email_sent' => (int)($body['onboarding_email_sent'] ?? 0),
        ':ai_research'           => trim($body['ai_research'] ?? ''),
        ':firmeninfos'           => trim($body['firmeninfos'] ?? ''),
        ':geschaeftsfuehrer'     => trim($body['geschaeftsfuehrer'] ?? ''),
        ':gf_match'              => trim($body['gf_match'] ?? ''),
        ':partner_type'          => $partnerType,
        ':is_partner'            => (int)($body['is_partner'] ?? 0),
        ':registered_at'         => $body['registered_at'] ?? null,
        ':verified_at'           => $body['verified_at'] ?? null,
        ':test_order_at'         => $body['test_order_at'] ?? null,
        ':first_real_order_at'   => $body['first_real_order_at'] ?? null,
    ]);

    // Log creation
    crm_log_activity($id, 'contact_created', ['name' => trim($body['name']), 'stage' => $initialStage]);

    // Handle initial stage transition (create auto tasks)
    crm_handle_stage_transition($id, '', $initialStage, $_SESSION['display_name'] ?? 'system');

    json_success('Kontakt erstellt', ['id' => $id]);
}

function handle_update_crm_contact(string $id): void
{
    $body = get_json_body();
    $db   = get_db();

    $existing = $db->prepare("SELECT id, pipeline_stage FROM crm_contacts WHERE id = :id");
    $existing->execute([':id' => $id]);
    $row = $existing->fetch();
    if (!$row) {
        json_error('Kontakt nicht gefunden', 404);
    }
    $oldStage = $row['pipeline_stage'] ?? '';

    $fields = [];
    $params = [':id' => $id, ':now' => now_iso()];

    $allowed = ['name', 'email', 'phone', 'organization', 'role', 'notes',
                'pipeline_stage', 'source', 'assigned_to', 'next_followup', 'last_contacted',
                'street', 'zip', 'city', 'state', 'website', 'job_title', 'business_type', 'trello_card_id',
                'leadquelle', 'prioritaet', 'next_step', 'next_step_date',
                'ai_research', 'firmeninfos', 'geschaeftsfuehrer', 'gf_match',
                'partner_type'];
    $changedFields = [];
    foreach ($allowed as $f) {
        if (isset($body[$f])) {
            $fields[] = "{$f} = :{$f}";
            $params[":{$f}"] = trim($body[$f]);
            $changedFields[$f] = trim($body[$f]);
        }
    }
    if (isset($body['tags'])) {
        $tags = is_array($body['tags']) ? json_encode($body['tags']) : $body['tags'];
        $fields[] = "tags = :tags";
        $params[':tags'] = $tags;
        $changedFields['tags'] = $tags;
    }
    if (isset($body['deal_value'])) {
        $fields[] = "deal_value = :deal_value";
        $params[':deal_value'] = (float)$body['deal_value'];
        $changedFields['deal_value'] = (float)$body['deal_value'];
    }
    if (isset($body['health_score'])) {
        $fields[] = "health_score = :health_score";
        $params[':health_score'] = (int)$body['health_score'];
        $changedFields['health_score'] = (int)$body['health_score'];
    }
    if (isset($body['ga_count'])) {
        $fields[] = "ga_count = :ga_count";
        $params[':ga_count'] = (int)$body['ga_count'];
        $changedFields['ga_count'] = (int)$body['ga_count'];
    }
    if (isset($body['umsatzpotenzial'])) {
        $fields[] = "umsatzpotenzial = :umsatzpotenzial";
        $params[':umsatzpotenzial'] = (float)$body['umsatzpotenzial'];
        $changedFields['umsatzpotenzial'] = (float)$body['umsatzpotenzial'];
    }
    if (isset($body['onboarding_email_sent'])) {
        $fields[] = "onboarding_email_sent = :onboarding_email_sent";
        $params[':onboarding_email_sent'] = (int)$body['onboarding_email_sent'];
        $changedFields['onboarding_email_sent'] = (int)$body['onboarding_email_sent'];
    }
    if (isset($body['is_partner'])) {
        $fields[] = "is_partner = :is_partner";
        $params[':is_partner'] = (int)$body['is_partner'];
        $changedFields['is_partner'] = (int)$body['is_partner'];
    }
    if (isset($body['registered_at'])) {
        $fields[] = "registered_at = :registered_at";
        $params[':registered_at'] = $body['registered_at'];
        $changedFields['registered_at'] = $body['registered_at'];
    }
    if (isset($body['verified_at'])) {
        $fields[] = "verified_at = :verified_at";
        $params[':verified_at'] = $body['verified_at'];
        $changedFields['verified_at'] = $body['verified_at'];
    }
    if (isset($body['test_order_at'])) {
        $fields[] = "test_order_at = :test_order_at";
        $params[':test_order_at'] = $body['test_order_at'];
        $changedFields['test_order_at'] = $body['test_order_at'];
    }
    if (isset($body['first_real_order_at'])) {
        $fields[] = "first_real_order_at = :first_real_order_at";
        $params[':first_real_order_at'] = $body['first_real_order_at'];
        $changedFields['first_real_order_at'] = $body['first_real_order_at'];
    }

    if (empty($fields)) {
        json_error('Keine Felder zum Aktualisieren', 400);
    }

    $fields[] = "updated_at = :now";
    $setStr = implode(', ', $fields);

    $db->prepare("UPDATE crm_contacts SET {$setStr} WHERE id = :id")->execute($params);

    // Log field changes
    if (!empty($changedFields)) {
        crm_log_activity($id, 'contact_updated', $changedFields);
    }

    // Detect stage change
    $newStage = $changedFields['pipeline_stage'] ?? null;
    if ($newStage !== null && $newStage !== $oldStage) {
        crm_handle_stage_transition($id, $oldStage, $newStage, $_SESSION['display_name'] ?? 'system');
    }

    json_success('Kontakt aktualisiert');
}

function handle_delete_crm_contact(string $id): void
{
    $db = get_db();
    $stmt = $db->prepare("DELETE FROM crm_contacts WHERE id = :id");
    $stmt->execute([':id' => $id]);

    if ($stmt->rowCount() === 0) {
        json_error('Kontakt nicht gefunden', 404);
    }

    json_success('Kontakt geloescht');
}

function handle_crm_contact_interactions(string $contactId): void
{
    $db = get_db();
    $stmt = $db->prepare("
        SELECT * FROM crm_interactions
        WHERE contact_id = :cid
        ORDER BY created_at DESC
    ");
    $stmt->execute([':cid' => $contactId]);

    json_response(['interactions' => $stmt->fetchAll()]);
}

// ---- Deals ----

function handle_list_crm_deals(): void
{
    $db = get_db();

    $where = ['1=1'];
    $params = [];

    if (!empty($_GET['stage'])) {
        $where[] = "d.stage = :stage";
        $params[':stage'] = $_GET['stage'];
    }
    if (!empty($_GET['contact_id'])) {
        $where[] = "d.contact_id = :cid";
        $params[':cid'] = $_GET['contact_id'];
    }

    $whereStr = implode(' AND ', $where);

    $stmt = $db->prepare("
        SELECT d.*, c.name AS contact_name, c.organization AS contact_org
        FROM crm_deals d
        LEFT JOIN crm_contacts c ON d.contact_id = c.id
        WHERE {$whereStr}
        ORDER BY d.updated_at DESC
    ");
    $stmt->execute($params);
    $deals = $stmt->fetchAll();

    foreach ($deals as &$d) {
        $d['value'] = (float)($d['value'] ?? 0);
        $d['probability'] = (int)($d['probability'] ?? 10);
    }

    json_response(['deals' => $deals, 'total' => count($deals)]);
}

function handle_create_crm_deal(): void
{
    $body = get_json_body();

    if (empty(trim($body['title'] ?? '')) || empty($body['contact_id'] ?? '')) {
        json_error('title und contact_id sind erforderlich', 400);
    }

    $db  = get_db();
    $id  = generate_uuid();
    $now = now_iso();

    $db->prepare("
        INSERT INTO crm_deals (id, contact_id, title, value, stage, probability,
            expected_close, notes, assigned_to, created_by, created_at, updated_at)
        VALUES (:id, :cid, :title, :value, :stage, :prob, :close, :notes, :assigned, :created_by, :now, :now2)
    ")->execute([
        ':id'         => $id,
        ':cid'        => $body['contact_id'],
        ':title'      => trim($body['title']),
        ':value'      => (float)($body['value'] ?? 0),
        ':stage'      => trim($body['stage'] ?? 'lead'),
        ':prob'       => (int)($body['probability'] ?? 10),
        ':close'      => $body['expected_close'] ?? null,
        ':notes'      => trim($body['notes'] ?? ''),
        ':assigned'   => trim($body['assigned_to'] ?? ''),
        ':created_by' => $_SESSION['user_id'],
        ':now'        => $now,
        ':now2'       => $now,
    ]);

    json_success('Deal erstellt', ['id' => $id]);
}

function handle_update_crm_deal(string $id): void
{
    $body = get_json_body();
    $db   = get_db();

    $existing = $db->prepare("SELECT id FROM crm_deals WHERE id = :id");
    $existing->execute([':id' => $id]);
    if (!$existing->fetch()) {
        json_error('Deal nicht gefunden', 404);
    }

    $fields = [];
    $params = [':id' => $id, ':now' => now_iso()];

    $strFields = ['title', 'stage', 'expected_close', 'notes', 'assigned_to', 'contact_id'];
    foreach ($strFields as $f) {
        if (isset($body[$f])) {
            $fields[] = "{$f} = :{$f}";
            $params[":{$f}"] = trim($body[$f]);
        }
    }
    if (isset($body['value'])) {
        $fields[] = "value = :value";
        $params[':value'] = (float)$body['value'];
    }
    if (isset($body['probability'])) {
        $fields[] = "probability = :probability";
        $params[':probability'] = (int)$body['probability'];
    }

    if (empty($fields)) {
        json_error('Keine Felder zum Aktualisieren', 400);
    }

    $fields[] = "updated_at = :now";
    $setStr = implode(', ', $fields);

    $db->prepare("UPDATE crm_deals SET {$setStr} WHERE id = :id")->execute($params);

    json_success('Deal aktualisiert');
}

function handle_delete_crm_deal(string $id): void
{
    $db = get_db();
    $stmt = $db->prepare("DELETE FROM crm_deals WHERE id = :id");
    $stmt->execute([':id' => $id]);

    if ($stmt->rowCount() === 0) {
        json_error('Deal nicht gefunden', 404);
    }

    json_success('Deal geloescht');
}

// ---- Interactions ----

function handle_create_crm_interaction(): void
{
    $body = get_json_body();

    if (empty($body['contact_id'] ?? '') || empty(trim($body['summary'] ?? ''))) {
        json_error('contact_id und summary sind erforderlich', 400);
    }

    $db  = get_db();
    $id  = generate_uuid();
    $now = now_iso();

    $db->prepare("
        INSERT INTO crm_interactions (id, contact_id, type, summary, details, sentiment, created_by, created_at)
        VALUES (:id, :cid, :type, :summary, :details, :sentiment, :created_by, :now)
    ")->execute([
        ':id'         => $id,
        ':cid'        => $body['contact_id'],
        ':type'       => trim($body['type'] ?? 'note'),
        ':summary'    => trim($body['summary']),
        ':details'    => trim($body['details'] ?? ''),
        ':sentiment'  => trim($body['sentiment'] ?? 'neutral'),
        ':created_by' => $_SESSION['user_id'],
        ':now'        => $now,
    ]);

    // Update contact last_contacted and interaction count
    $db->prepare("
        UPDATE crm_contacts
        SET last_contacted = :now, health_score = 100,
            interaction_count = COALESCE(interaction_count, 0) + 1,
            updated_at = :now2
        WHERE id = :cid
    ")->execute([':now' => $now, ':now2' => $now, ':cid' => $body['contact_id']]);

    json_success('Interaktion erstellt', ['id' => $id]);
}

// ---- Tasks ----

function handle_crm_tasks_today(): void
{
    $db = get_db();

    // Process overdue tasks first
    process_overdue_tasks();

    $today = substr(now_iso(), 0, 10);

    $stmt = $db->prepare("
        SELECT t.*, c.name AS contact_name, c.organization AS contact_org, c.pipeline_stage AS contact_stage
        FROM crm_tasks t
        LEFT JOIN crm_contacts c ON t.contact_id = c.id
        WHERE (t.due_date LIKE :today OR t.status = 'overdue')
          AND t.status != 'done'
        ORDER BY t.status DESC, t.due_date ASC
    ");
    $stmt->execute([':today' => $today . '%']);
    $tasks = $stmt->fetchAll();

    // Define categories
    $categories = [
        'overdue'       => ['label' => 'Überfällig',     'color' => '#e53e3e', 'tasks' => []],
        'quali'         => ['label' => 'Qualigespräche',  'color' => '#3182ce', 'tasks' => []],
        'abschluss'     => ['label' => 'Abschlüsse',      'color' => '#38a169', 'tasks' => []],
        'erstkontakt'   => ['label' => 'Erstkontakt',     'color' => '#d69e2e', 'tasks' => []],
        'aktivierung'   => ['label' => 'Aktivierung',     'color' => '#805ad5', 'tasks' => []],
        'sonstige'      => ['label' => 'Sonstige',        'color' => '#718096', 'tasks' => []],
    ];

    foreach ($tasks as $task) {
        $title = strtolower($task['title'] ?? '');
        if ($task['status'] === 'overdue') {
            $categories['overdue']['tasks'][] = $task;
        } elseif (strpos($title, 'qualigespräch') !== false || strpos($title, 'qualigespr') !== false) {
            $categories['quali']['tasks'][] = $task;
        } elseif (strpos($title, 'abschluss') !== false || strpos($title, 'abschlussgespräch') !== false || strpos($title, 'abschlussgespr') !== false) {
            $categories['abschluss']['tasks'][] = $task;
        } elseif (strpos($title, 'kontaktieren') !== false || strpos($title, 'anrufen') !== false) {
            $categories['erstkontakt']['tasks'][] = $task;
        } elseif (strpos($title, 'onboarding') !== false || strpos($title, 'wiedervorlage') !== false) {
            $categories['aktivierung']['tasks'][] = $task;
        } else {
            $categories['sonstige']['tasks'][] = $task;
        }
    }

    // Build response array
    $result = [];
    foreach ($categories as $key => $cat) {
        $result[] = [
            'key'   => $key,
            'label' => $cat['label'],
            'color' => $cat['color'],
            'tasks' => $cat['tasks'],
        ];
    }

    json_response(['categories' => $result]);
}

function handle_list_crm_tasks(): void
{
    $db = get_db();

    $where = ['1=1'];
    $params = [];

    if (!empty($_GET['status'])) {
        $where[] = "t.status = :status";
        $params[':status'] = $_GET['status'];
    }
    if (!empty($_GET['contact_id'])) {
        $where[] = "t.contact_id = :cid";
        $params[':cid'] = $_GET['contact_id'];
    }
    if (!empty($_GET['overdue'])) {
        process_overdue_tasks();
        $where[] = "t.status = 'overdue'";
    }

    $whereStr = implode(' AND ', $where);

    $stmt = $db->prepare("
        SELECT t.*, c.name AS contact_name, c.organization AS contact_org
        FROM crm_tasks t
        LEFT JOIN crm_contacts c ON t.contact_id = c.id
        WHERE {$whereStr}
        ORDER BY t.due_date ASC
    ");
    $stmt->execute($params);
    $tasks = $stmt->fetchAll();

    json_response(['tasks' => $tasks, 'total' => count($tasks)]);
}

function handle_create_crm_task(): void
{
    $body = get_json_body();

    if (empty($body['contact_id'] ?? '') || empty(trim($body['title'] ?? '')) || empty($body['due_date'] ?? '')) {
        json_error('contact_id, title und due_date sind erforderlich', 400);
    }

    $db  = get_db();
    $id  = generate_uuid();
    $now = now_iso();

    $db->prepare("
        INSERT INTO crm_tasks (id, contact_id, title, description, due_date, status, type, created_by, created_at)
        VALUES (:id, :cid, :title, :desc, :due, 'pending', 'manual', :created_by, :at)
    ")->execute([
        ':id'         => $id,
        ':cid'        => $body['contact_id'],
        ':title'      => trim($body['title']),
        ':desc'       => trim($body['description'] ?? ''),
        ':due'        => $body['due_date'],
        ':created_by' => $_SESSION['user_id'] ?? 'system',
        ':at'         => $now,
    ]);

    crm_log_activity($body['contact_id'], 'task_created', [
        'task_id'  => $id,
        'title'    => trim($body['title']),
        'due_date' => $body['due_date'],
    ]);

    json_success('Aufgabe erstellt', ['id' => $id]);
}

function handle_update_crm_task(string $taskId): void
{
    $body = get_json_body();
    $db   = get_db();

    $existing = $db->prepare("SELECT id, contact_id, status FROM crm_tasks WHERE id = :id");
    $existing->execute([':id' => $taskId]);
    $task = $existing->fetch();
    if (!$task) {
        json_error('Aufgabe nicht gefunden', 404);
    }

    $fields = [];
    $params = [':id' => $taskId];
    $changes = [];

    if (isset($body['status'])) {
        $fields[] = "status = :status";
        $params[':status'] = $body['status'];
        $changes['status'] = $body['status'];

        if ($body['status'] === 'done') {
            $fields[] = "completed_at = :completed_at";
            $params[':completed_at'] = now_iso();
        }
    }
    if (isset($body['due_date'])) {
        $fields[] = "due_date = :due_date";
        $params[':due_date'] = $body['due_date'];
        $changes['due_date'] = $body['due_date'];
    }

    if (empty($fields)) {
        json_error('Keine Felder zum Aktualisieren', 400);
    }

    $setStr = implode(', ', $fields);
    $db->prepare("UPDATE crm_tasks SET {$setStr} WHERE id = :id")->execute($params);

    crm_log_activity($task['contact_id'], 'task_updated', array_merge(['task_id' => $taskId], $changes));

    json_success('Aufgabe aktualisiert');
}

// ---- Activity Log ----

function handle_crm_activity_log(string $contactId): void
{
    $db = get_db();

    $stmt = $db->prepare("
        SELECT * FROM crm_activity_log
        WHERE contact_id = :cid
        ORDER BY created_at DESC
    ");
    $stmt->execute([':cid' => $contactId]);

    json_response(['activities' => $stmt->fetchAll()]);
}

// ---- Partners ----

function handle_crm_partners(): void
{
    $db = get_db();

    $stmt = $db->prepare("
        SELECT * FROM crm_contacts
        WHERE is_partner = 1 AND first_real_order_at IS NULL
        ORDER BY updated_at DESC
    ");
    $stmt->execute();
    $partners = $stmt->fetchAll();

    // Group by activation stage based on timestamps
    $stages = [
        'registered'  => ['label' => 'Registriert',       'partners' => []],
        'verified'    => ['label' => 'Verifiziert',        'partners' => []],
        'test_order'  => ['label' => 'Testauftrag',        'partners' => []],
        'pending'     => ['label' => 'Noch nicht gestartet', 'partners' => []],
    ];

    foreach ($partners as $p) {
        $p['deal_value'] = (float)($p['deal_value'] ?? 0);
        $p['ga_count'] = (int)($p['ga_count'] ?? 0);
        $p['is_partner'] = (int)($p['is_partner'] ?? 0);

        if (!empty($p['test_order_at'])) {
            $stages['test_order']['partners'][] = $p;
        } elseif (!empty($p['verified_at'])) {
            $stages['verified']['partners'][] = $p;
        } elseif (!empty($p['registered_at'])) {
            $stages['registered']['partners'][] = $p;
        } else {
            $stages['pending']['partners'][] = $p;
        }
    }

    $result = [];
    foreach ($stages as $key => $stage) {
        $result[] = [
            'key'      => $key,
            'label'    => $stage['label'],
            'partners' => $stage['partners'],
        ];
    }

    json_response(['stages' => $result]);
}

function handle_update_crm_partner(string $partnerId): void
{
    $body = get_json_body();
    $db   = get_db();

    $existing = $db->prepare("SELECT id FROM crm_contacts WHERE id = :id");
    $existing->execute([':id' => $partnerId]);
    if (!$existing->fetch()) {
        json_error('Partner nicht gefunden', 404);
    }

    $fields = [];
    $params = [':id' => $partnerId, ':now' => now_iso()];
    $changes = [];

    $timestampFields = ['registered_at', 'verified_at', 'test_order_at', 'first_real_order_at'];
    foreach ($timestampFields as $f) {
        if (isset($body[$f])) {
            $fields[] = "{$f} = :{$f}";
            $params[":{$f}"] = $body[$f];
            $changes[$f] = $body[$f];
        }
    }

    if (empty($fields)) {
        json_error('Keine Felder zum Aktualisieren', 400);
    }

    $fields[] = "updated_at = :now";
    $setStr = implode(', ', $fields);

    $db->prepare("UPDATE crm_contacts SET {$setStr} WHERE id = :id")->execute($params);

    crm_log_activity($partnerId, 'partner_updated', $changes);

    json_success('Partner aktualisiert');
}

// ---- Orders ----

function handle_list_crm_orders(): void
{
    $db = get_db();

    $where = ['1=1'];
    $params = [];

    if (!empty($_GET['partner_id'])) {
        $where[] = "o.partner_id = :pid";
        $params[':pid'] = $_GET['partner_id'];
    }
    if (!empty($_GET['type'])) {
        $where[] = "o.type = :type";
        $params[':type'] = $_GET['type'];
    }

    $whereStr = implode(' AND ', $where);

    $stmt = $db->prepare("
        SELECT o.*, c.name AS partner_name, c.organization AS partner_org
        FROM crm_orders o
        LEFT JOIN crm_contacts c ON o.partner_id = c.id
        WHERE {$whereStr}
        ORDER BY o.created_at DESC
    ");
    $stmt->execute($params);
    $orders = $stmt->fetchAll();

    json_response(['orders' => $orders, 'total' => count($orders)]);
}

function handle_create_crm_order(): void
{
    $body = get_json_body();

    if (empty($body['partner_id'] ?? '')) {
        json_error('partner_id ist erforderlich', 400);
    }

    $db  = get_db();
    $id  = generate_uuid();
    $now = now_iso();

    $type = trim($body['type'] ?? 'test');

    $db->prepare("
        INSERT INTO crm_orders (id, partner_id, type, submitted_at, status, result, created_by, created_at)
        VALUES (:id, :pid, :type, :submitted, :status, :result, :created_by, :at)
    ")->execute([
        ':id'         => $id,
        ':pid'        => $body['partner_id'],
        ':type'       => $type,
        ':submitted'  => $body['submitted_at'] ?? $now,
        ':status'     => trim($body['status'] ?? 'pending'),
        ':result'     => trim($body['result'] ?? ''),
        ':created_by' => $_SESSION['user_id'] ?? 'system',
        ':at'         => $now,
    ]);

    // If type = 'real' and first real order for this partner: set first_real_order_at
    if ($type === 'real') {
        $check = $db->prepare("SELECT first_real_order_at FROM crm_contacts WHERE id = :pid");
        $check->execute([':pid' => $body['partner_id']]);
        $existingDate = $check->fetchColumn();
        if (empty($existingDate)) {
            $db->prepare("UPDATE crm_contacts SET first_real_order_at = :at, updated_at = :now WHERE id = :pid")
               ->execute([':at' => $body['submitted_at'] ?? $now, ':now' => $now, ':pid' => $body['partner_id']]);
        }
    }

    crm_log_activity($body['partner_id'], 'order_created', [
        'order_id' => $id,
        'type'     => $type,
        'status'   => trim($body['status'] ?? 'pending'),
    ]);

    json_success('Auftrag erstellt', ['id' => $id]);
}

// ---- Reminders (Cortex trigger) ----

function handle_crm_process_reminders(): void
{
    // Auth via token
    $token = $_GET['token'] ?? '';
    if ($token !== 'dgd-cortex-reminder-2026') {
        json_error('Unauthorized', 401);
    }

    $db = get_db();

    // Process overdue tasks
    process_overdue_tasks();

    $processed = 0;
    $remindersCreated = 0;

    // For partners (is_partner=1, first_real_order_at IS NULL): check if they have pending tasks
    $stmt = $db->prepare("
        SELECT c.id, c.name FROM crm_contacts c
        WHERE c.is_partner = 1 AND c.first_real_order_at IS NULL
    ");
    $stmt->execute();
    $partners = $stmt->fetchAll();

    foreach ($partners as $partner) {
        $processed++;

        // Check if partner has any pending/overdue tasks
        $taskCheck = $db->prepare("
            SELECT COUNT(*) FROM crm_tasks
            WHERE contact_id = :cid AND status IN ('pending', 'overdue')
        ");
        $taskCheck->execute([':cid' => $partner['id']]);
        $pendingCount = (int)$taskCheck->fetchColumn();

        if ($pendingCount === 0) {
            // Create a recurring reminder
            $now = new DateTime();
            crm_create_auto_task(
                $partner['id'],
                'Aktivierung nachfassen: ' . $partner['name'],
                (clone $now)->modify('+1 day')->format('Y-m-d'),
                'Automatischer Reminder: Partner hat keine offenen Aufgaben.'
            );
            $remindersCreated++;
        }
    }

    json_response([
        'processed'         => $processed,
        'reminders_created' => $remindersCreated,
    ]);
}

// ---- Reminder Config ----

function handle_crm_reminder_config(): void
{
    $db = get_db();

    $stmt = $db->query("SELECT * FROM crm_reminder_config ORDER BY stage");
    $config = $stmt->fetchAll();

    json_response(['config' => $config]);
}

function handle_update_reminder_config(string $stage): void
{
    $body = get_json_body();
    $db   = get_db();

    $fields = [];
    $params = [':stage' => $stage];

    if (isset($body['interval_days'])) {
        $fields[] = "interval_days = :interval_days";
        $params[':interval_days'] = (int)$body['interval_days'];
    }
    if (isset($body['auto_create'])) {
        $fields[] = "auto_create = :auto_create";
        $params[':auto_create'] = (int)$body['auto_create'];
    }

    if (empty($fields)) {
        json_error('Keine Felder zum Aktualisieren', 400);
    }

    $setStr = implode(', ', $fields);
    $stmt = $db->prepare("UPDATE crm_reminder_config SET {$setStr} WHERE stage = :stage");
    $stmt->execute($params);

    if ($stmt->rowCount() === 0) {
        json_error('Stage nicht gefunden', 404);
    }

    json_success('Reminder-Konfiguration aktualisiert');
}

// ---- Stats & Pipeline ----

function handle_crm_stats(): void
{
    $db = get_db();

    $total = (int) $db->query("SELECT COUNT(*) FROM crm_contacts")->fetchColumn();
    $byStage = $db->query("
        SELECT pipeline_stage, COUNT(*) as count FROM crm_contacts GROUP BY pipeline_stage
    ")->fetchAll();

    $totalDeals = (int) $db->query("SELECT COUNT(*) FROM crm_deals WHERE stage NOT IN ('gewonnen','verloren')")->fetchColumn();
    $pipelineValue = (float) $db->query("SELECT COALESCE(SUM(value), 0) FROM crm_deals WHERE stage NOT IN ('gewonnen','verloren')")->fetchColumn();
    $wonValue = (float) $db->query("SELECT COALESCE(SUM(value), 0) FROM crm_deals WHERE stage = 'gewonnen'")->fetchColumn();
    $wonCount = (int) $db->query("SELECT COUNT(*) FROM crm_deals WHERE stage = 'gewonnen'")->fetchColumn();
    $lostCount = (int) $db->query("SELECT COUNT(*) FROM crm_deals WHERE stage = 'verloren'")->fetchColumn();

    $conversionRate = ($wonCount + $lostCount) > 0
        ? round($wonCount / ($wonCount + $lostCount) * 100, 1)
        : 0;

    $overdueCount = (int) $db->query("
        SELECT COUNT(*) FROM crm_contacts
        WHERE next_followup IS NOT NULL AND next_followup < datetime('now') AND pipeline_stage NOT IN ('gewonnen','verloren')
    ")->fetchColumn();

    // New stats: overdue tasks, today's tasks, partners in activation
    $today = substr(now_iso(), 0, 10);
    $overdueTasks = (int) $db->query("SELECT COUNT(*) FROM crm_tasks WHERE status = 'overdue' OR (status = 'pending' AND due_date < '{$today}')")->fetchColumn();
    $todayTasks = (int) $db->query("SELECT COUNT(*) FROM crm_tasks WHERE due_date LIKE '{$today}%' AND status != 'done'")->fetchColumn();
    $partnersInActivation = (int) $db->query("SELECT COUNT(*) FROM crm_contacts WHERE is_partner = 1 AND first_real_order_at IS NULL")->fetchColumn();

    $stageMap = [];
    foreach ($byStage as $s) {
        $stageMap[$s['pipeline_stage']] = (int) $s['count'];
    }

    json_response([
        'total_contacts'        => $total,
        'contacts_by_stage'     => $stageMap,
        'open_deals'            => $totalDeals,
        'pipeline_value'        => $pipelineValue,
        'won_value'             => $wonValue,
        'won_count'             => $wonCount,
        'lost_count'            => $lostCount,
        'conversion_rate'       => $conversionRate,
        'overdue_followups'     => $overdueCount,
        'overdue_tasks'         => $overdueTasks,
        'today_tasks'           => $todayTasks,
        'partners_in_activation' => $partnersInActivation,
    ]);
}

function handle_crm_pipeline(): void
{
    $db = get_db();

    $stages = ['neu', 'nicht_erreicht', 'quali_terminiert', 'no_show_quali', 'quali_gefuehrt', 'abschluss_terminiert', 'no_show_abschluss', 'abschluss_gefuehrt', 'entscheidung', 'gewonnen', 'verloren', 'stillgelegt'];
    $pipeline = [];

    foreach ($stages as $stage) {
        $stmt = $db->prepare("
            SELECT * FROM crm_contacts
            WHERE pipeline_stage = :stage
            ORDER BY updated_at DESC
        ");
        $stmt->execute([':stage' => $stage]);
        $contacts = $stmt->fetchAll();

        foreach ($contacts as &$c) {
            $c['deal_value'] = (float)($c['deal_value'] ?? 0);
            $c['ga_count'] = (int)($c['ga_count'] ?? 0);
            $c['is_partner'] = (int)($c['is_partner'] ?? 0);
        }

        $totalValue = array_sum(array_column($contacts, 'deal_value'));

        $pipeline[] = [
            'stage'       => $stage,
            'contacts'    => $contacts,
            'count'       => count($contacts),
            'total_value' => $totalValue,
        ];
    }

    json_response(['pipeline' => $pipeline]);
}

// ---- Trello Import ----

function handle_crm_import_trello(): void
{
    $body = get_json_body();
    $board = $body['board'] ?? $body;

    $cards = $board['cards'] ?? [];
    $lists = $board['lists'] ?? [];

    if (empty($cards)) {
        json_error('Keine Karten im Trello-Export gefunden', 400);
    }

    // Build list ID -> name map
    $listMap = [];
    foreach ($lists as $list) {
        if (!($list['closed'] ?? false)) {
            $listMap[$list['id']] = $list['name'];
        }
    }

    // Stage mapping: Trello list name keywords -> CRM stages (updated to new stages)
    $stageMapping = $body['stage_mapping'] ?? [];
    if (empty($stageMapping)) {
        $stageMapping = [
            'neu'                  => ['lead', 'leads', 'neue leads', 'new', 'neu', 'eingang', 'backlog', 'zukunft', 'adyoucate'],
            'nicht_erreicht'       => ['anrufen', 'wiedervorlage', 'wv', 'setting', 'kontakt', 'kontaktiert', 'vor-ort'],
            'quali_terminiert'     => ['registriert', 'quali'],
            'quali_gefuehrt'       => ['verifiziert', 'geprueft', 'geprüft', 'mustergutachten'],
            'abschluss_terminiert' => ['abschluss'],
            'gewonnen'             => ['aktiviert', ' ga'],
            'stillgelegt'          => ['plan b', 'reaktivieren'],
            'verloren'             => ['verloren', 'lost', 'ungeeignet', 'abgelehnt', 'kein interesse'],
        ];
    }

    // GA count mapping: extract number from list name like "5 GA", "10 GAs", etc.
    $gaPattern = '/(\d+)\s*GAs?/i';

    // Build member ID -> name map
    $memberMap = [];
    foreach ($board['members'] ?? [] as $member) {
        $memberMap[$member['id']] = $member['fullName'] ?? $member['username'] ?? '';
    }

    $db  = get_db();
    $now = now_iso();
    $imported = 0;
    $skipped = 0;
    $updated = 0;

    $contactStmt = $db->prepare("
        INSERT INTO crm_contacts (id, name, email, phone, organization, tags, notes,
            pipeline_stage, assigned_to, next_followup, source, created_by, created_at, updated_at,
            street, zip, city, state, website, job_title, business_type, ga_count, trello_card_id)
        VALUES (:id, :name, :email, :phone, :org, :tags, :notes,
            :stage, :assigned, :followup, 'trello', :created_by, :created_at, :updated_at,
            :street, :zip, :city, :state, :website, :job_title, :business_type, :ga_count, :trello_card_id)
    ");

    foreach ($cards as $card) {
        if ($card['closed'] ?? false) {
            $skipped++;
            continue;
        }

        $name = trim($card['name'] ?? '');
        if (empty($name) || $name === '---') {
            $skipped++;
            continue;
        }

        $cardId = $card['id'] ?? '';

        // Check duplicate by trello_card_id first, then by name
        if (!empty($cardId)) {
            $dup = $db->prepare("SELECT id FROM crm_contacts WHERE trello_card_id = :tid");
            $dup->execute([':tid' => $cardId]);
            if ($dup->fetch()) {
                $skipped++;
                continue;
            }
        }
        $dup = $db->prepare("SELECT id FROM crm_contacts WHERE name = :name");
        $dup->execute([':name' => $name]);
        if ($dup->fetch()) {
            $skipped++;
            continue;
        }

        // --- Extract Crmble contact fields from pluginData ---
        $crmbleFields = [];
        foreach ($card['pluginData'] ?? [] as $pd) {
            $val = $pd['value'] ?? '';
            if (is_string($val) && strpos($val, 'CRMBLE_CARD_CONTACT') !== false) {
                $parsed = json_decode($val, true);
                $contact = $parsed['CRMBLE_CARD_CONTACT'] ?? [];
                foreach ($contact['crmbleFieldsValues'] ?? [] as $field) {
                    $fid = $field['id'] ?? '';
                    $fval = trim($field['value'] ?? '');
                    if (!empty($fval)) {
                        $crmbleFields[$fid] = $fval;
                    }
                }
                break;
            }
        }

        // Build contact data from Crmble fields (priority) + fallback from description
        $desc = $card['desc'] ?? '';
        $email = $crmbleFields['email'] ?? '';
        $phone = $crmbleFields['phone'] ?? '';
        $org = $crmbleFields['company'] ?? '';
        $jobTitle = $crmbleFields['jobTitle'] ?? '';
        $street = $crmbleFields['_90b3'] ?? '';
        $hausnr = $crmbleFields['_9520'] ?? '';
        if (!empty($hausnr)) $street = $street ? "{$street} {$hausnr}" : $hausnr;
        $zip = $crmbleFields['_9e4e'] ?? '';
        $city = $crmbleFields['_bafd'] ?? '';
        $state = $crmbleFields['_ab85'] ?? '';
        $website = $crmbleFields['_af5b'] ?? '';
        $businessType = $crmbleFields['_b8a5'] ?? '';

        // Use firstName + lastName from Crmble if card name looks generic
        $crmbleName = trim(($crmbleFields['firstName'] ?? '') . ' ' . ($crmbleFields['lastName'] ?? ''));
        if (!empty($crmbleName) && strlen($crmbleName) > 2) {
            // Keep original card name (usually already a person name)
        }

        // Fallback: extract from description if Crmble fields empty
        if (empty($email) && preg_match('/[\w.+-]+@[\w-]+\.[\w.]+/', $desc, $m)) {
            $email = $m[0];
        }
        if (empty($phone) && preg_match('/(?:\+?\d[\d\s\/-]{6,}|\d{3,5}[\s\/-]\d{3,})/', $desc, $m)) {
            $phone = trim($m[0]);
        }
        if (empty($org) && preg_match('/(?:firma|unternehmen|company|org)[:\s]+(.+)/i', $desc, $m)) {
            $org = trim($m[1]);
        }

        // Determine stage from list name
        $listName = $listMap[$card['idList'] ?? ''] ?? '';
        $listNameLower = strtolower($listName);
        $stage = 'neu';
        foreach ($stageMapping as $stageKey => $keywords) {
            foreach ($keywords as $kw) {
                if (strpos($listNameLower, strtolower($kw)) !== false) {
                    $stage = $stageKey;
                    break 2;
                }
            }
        }

        // Extract GA count from list name
        $gaCount = 0;
        if (preg_match($gaPattern, $listName, $gaMatch)) {
            $gaCount = (int)$gaMatch[1];
            if ($stage === 'neu') $stage = 'gewonnen'; // GA lists = gewonnen (active partners)
        }

        // Labels -> tags
        $tags = [];
        foreach ($card['labels'] ?? [] as $label) {
            if (!empty($label['name'])) {
                $tags[] = $label['name'];
            }
        }
        // Add list name as tag for context
        if (!empty($listName)) {
            $tags[] = 'trello:' . $listName;
        }

        // Assignee from card members
        $assigned = '';
        $memberIds = $card['idMembers'] ?? [];
        if (!empty($memberIds)) {
            $assigned = $memberMap[$memberIds[0]] ?? '';
        }

        // Due date -> next_followup
        $followup = null;
        if (!empty($card['due'])) {
            $followup = substr($card['due'], 0, 10);
        }

        // Card creation date
        $createdAt = $now;
        if (!empty($card['dateLastActivity'])) {
            $createdAt = str_replace('T', ' ', substr($card['dateLastActivity'], 0, 19));
        }

        $contactStmt->execute([
            ':id'             => generate_uuid(),
            ':name'           => $name,
            ':email'          => $email,
            ':phone'          => $phone,
            ':org'            => $org,
            ':tags'           => json_encode($tags),
            ':notes'          => $desc,
            ':stage'          => $stage,
            ':assigned'       => $assigned,
            ':followup'       => $followup,
            ':created_by'     => $_SESSION['user_id'],
            ':created_at'     => $createdAt,
            ':updated_at'     => $now,
            ':street'         => $street,
            ':zip'            => $zip,
            ':city'           => $city,
            ':state'          => $state,
            ':website'        => $website,
            ':job_title'      => $jobTitle,
            ':business_type'  => $businessType,
            ':ga_count'       => $gaCount,
            ':trello_card_id' => $cardId,
        ]);

        $imported++;
    }

    json_success("Trello-Import abgeschlossen", [
        'imported' => $imported,
        'skipped'  => $skipped,
        'updated'  => $updated,
        'total'    => count($cards),
    ]);
}

// ---- Cleanup Duplicates ----

function handle_crm_cleanup_dupes(): void
{
    $db = get_db();

    $totalBefore = (int) $db->query("SELECT COUNT(*) FROM crm_contacts WHERE source='trello'")->fetchColumn();

    $dupeGroups = (int) $db->query("
        SELECT COUNT(*) FROM (
            SELECT trello_card_id FROM crm_contacts
            WHERE source='trello' AND trello_card_id != '' AND trello_card_id IS NOT NULL
            GROUP BY trello_card_id HAVING COUNT(*) > 1
        )
    ")->fetchColumn();

    // Delete older duplicates, keep highest id per trello_card_id
    $stmt = $db->prepare("
        DELETE FROM crm_contacts
        WHERE source='trello'
          AND trello_card_id != ''
          AND trello_card_id IS NOT NULL
          AND id NOT IN (
              SELECT MAX(id) FROM crm_contacts
              WHERE source='trello' AND trello_card_id != '' AND trello_card_id IS NOT NULL
              GROUP BY trello_card_id
          )
    ");
    $stmt->execute();
    $deleted = $stmt->rowCount();

    $totalAfter = (int) $db->query("SELECT COUNT(*) FROM crm_contacts WHERE source='trello'")->fetchColumn();

    json_success("Duplikate bereinigt", [
        'total_before'    => $totalBefore,
        'duplicate_groups' => $dupeGroups,
        'deleted'          => $deleted,
        'total_after'      => $totalAfter,
    ]);
}
