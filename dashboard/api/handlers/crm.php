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
 * Dashboard:
 *   GET    /api/crm/stats                       - CRM KPIs
 *   GET    /api/crm/pipeline                    - Pipeline overview
 *
 * Import:
 *   POST   /api/crm/import/trello               - Import from Trello JSON
 */

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

    $whereStr = implode(' AND ', $where);
    $order = $_GET['sort'] ?? 'updated_at';
    $allowed_sorts = ['name', 'updated_at', 'created_at', 'health_score', 'deal_value', 'pipeline_stage'];
    if (!in_array($order, $allowed_sorts)) $order = 'updated_at';
    $dir = ($_GET['dir'] ?? 'DESC') === 'ASC' ? 'ASC' : 'DESC';

    $stmt = $db->prepare("SELECT * FROM crm_contacts WHERE {$whereStr} ORDER BY {$order} {$dir}");
    $stmt->execute($params);
    $contacts = $stmt->fetchAll();

    // Cast numeric fields
    foreach ($contacts as &$c) {
        $c['deal_value'] = (float)($c['deal_value'] ?? 0);
        $c['health_score'] = (int)($c['health_score'] ?? 100);
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

    $db->prepare("
        INSERT INTO crm_contacts (id, name, email, phone, organization, role, tags, notes,
            pipeline_stage, deal_value, source, assigned_to, next_followup, created_by, created_at, updated_at)
        VALUES (:id, :name, :email, :phone, :org, :role, :tags, :notes,
            :stage, :deal_value, :source, :assigned, :followup, :created_by, :now, :now2)
    ")->execute([
        ':id'         => $id,
        ':name'       => trim($body['name']),
        ':email'      => trim($body['email'] ?? ''),
        ':phone'      => trim($body['phone'] ?? ''),
        ':org'        => trim($body['organization'] ?? ''),
        ':role'       => trim($body['role'] ?? ''),
        ':tags'       => $tags,
        ':notes'      => trim($body['notes'] ?? ''),
        ':stage'      => trim($body['pipeline_stage'] ?? 'lead'),
        ':deal_value' => (float)($body['deal_value'] ?? 0),
        ':source'     => trim($body['source'] ?? 'manual'),
        ':assigned'   => trim($body['assigned_to'] ?? ''),
        ':followup'   => $body['next_followup'] ?? null,
        ':created_by' => $_SESSION['user_id'],
        ':now'        => $now,
        ':now2'       => $now,
    ]);

    json_success('Kontakt erstellt', ['id' => $id]);
}

function handle_update_crm_contact(string $id): void
{
    $body = get_json_body();
    $db   = get_db();

    $existing = $db->prepare("SELECT id FROM crm_contacts WHERE id = :id");
    $existing->execute([':id' => $id]);
    if (!$existing->fetch()) {
        json_error('Kontakt nicht gefunden', 404);
    }

    $fields = [];
    $params = [':id' => $id, ':now' => now_iso()];

    $allowed = ['name', 'email', 'phone', 'organization', 'role', 'notes',
                'pipeline_stage', 'source', 'assigned_to', 'next_followup', 'last_contacted'];
    foreach ($allowed as $f) {
        if (isset($body[$f])) {
            $fields[] = "{$f} = :{$f}";
            $params[":{$f}"] = trim($body[$f]);
        }
    }
    if (isset($body['tags'])) {
        $tags = is_array($body['tags']) ? json_encode($body['tags']) : $body['tags'];
        $fields[] = "tags = :tags";
        $params[':tags'] = $tags;
    }
    if (isset($body['deal_value'])) {
        $fields[] = "deal_value = :deal_value";
        $params[':deal_value'] = (float)$body['deal_value'];
    }
    if (isset($body['health_score'])) {
        $fields[] = "health_score = :health_score";
        $params[':health_score'] = (int)$body['health_score'];
    }

    if (empty($fields)) {
        json_error('Keine Felder zum Aktualisieren', 400);
    }

    $fields[] = "updated_at = :now";
    $setStr = implode(', ', $fields);

    $db->prepare("UPDATE crm_contacts SET {$setStr} WHERE id = :id")->execute($params);

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

    $stageMap = [];
    foreach ($byStage as $s) {
        $stageMap[$s['pipeline_stage']] = (int) $s['count'];
    }

    json_response([
        'total_contacts'  => $total,
        'contacts_by_stage' => $stageMap,
        'open_deals'      => $totalDeals,
        'pipeline_value'  => $pipelineValue,
        'won_value'       => $wonValue,
        'won_count'       => $wonCount,
        'lost_count'      => $lostCount,
        'conversion_rate' => $conversionRate,
        'overdue_followups' => $overdueCount,
    ]);
}

function handle_crm_pipeline(): void
{
    $db = get_db();

    $stages = ['lead', 'kontakt', 'angebot', 'verhandlung', 'gewonnen', 'verloren'];
    $pipeline = [];

    foreach ($stages as $stage) {
        $stmt = $db->prepare("
            SELECT d.*, c.name AS contact_name, c.organization AS contact_org
            FROM crm_deals d
            LEFT JOIN crm_contacts c ON d.contact_id = c.id
            WHERE d.stage = :stage
            ORDER BY d.updated_at DESC
        ");
        $stmt->execute([':stage' => $stage]);
        $deals = $stmt->fetchAll();

        foreach ($deals as &$d) {
            $d['value'] = (float)($d['value'] ?? 0);
            $d['probability'] = (int)($d['probability'] ?? 10);
        }

        $total = array_sum(array_column($deals, 'value'));

        $pipeline[] = [
            'stage' => $stage,
            'deals' => $deals,
            'count' => count($deals),
            'total_value' => $total,
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

    // Stage mapping (configurable via body)
    $stageMapping = $body['stage_mapping'] ?? [];
    if (empty($stageMapping)) {
        // Default mapping
        $stageMapping = [
            'lead'         => ['lead', 'leads', 'neue kontakte', 'new', 'neu', 'eingang', 'backlog'],
            'kontakt'      => ['kontakt', 'kontaktiert', 'contacted', 'in kontakt', 'angesprochen'],
            'angebot'      => ['angebot', 'angebote', 'proposal', 'quote', 'offerte'],
            'verhandlung'  => ['verhandlung', 'negotiation', 'in verhandlung', 'review'],
            'gewonnen'     => ['gewonnen', 'won', 'deal', 'kunde', 'abgeschlossen', 'done', 'fertig'],
            'verloren'     => ['verloren', 'lost', 'abgesagt', 'rejected'],
        ];
    }

    $db  = get_db();
    $now = now_iso();
    $imported = 0;
    $skipped = 0;

    $contactStmt = $db->prepare("
        INSERT INTO crm_contacts (id, name, email, phone, organization, tags, notes,
            pipeline_stage, assigned_to, next_followup, source, created_by, created_at, updated_at)
        VALUES (:id, :name, :email, :phone, :org, :tags, :notes,
            :stage, :assigned, :followup, 'trello', :created_by, :created_at, :updated_at)
    ");

    foreach ($cards as $card) {
        if ($card['closed'] ?? false) {
            $skipped++;
            continue;
        }

        $name = trim($card['name'] ?? '');
        if (empty($name)) {
            $skipped++;
            continue;
        }

        // Check duplicate by name
        $dup = $db->prepare("SELECT id FROM crm_contacts WHERE name = :name");
        $dup->execute([':name' => $name]);
        if ($dup->fetch()) {
            $skipped++;
            continue;
        }

        // Determine stage from list name
        $listName = strtolower($listMap[$card['idList'] ?? ''] ?? '');
        $stage = 'lead';
        foreach ($stageMapping as $stageKey => $keywords) {
            foreach ($keywords as $kw) {
                if (strpos($listName, strtolower($kw)) !== false) {
                    $stage = $stageKey;
                    break 2;
                }
            }
        }

        // Extract info from description
        $desc = $card['desc'] ?? '';
        $email = '';
        $phone = '';
        $org = '';

        // Try to extract email
        if (preg_match('/[\w.+-]+@[\w-]+\.[\w.]+/', $desc, $m)) {
            $email = $m[0];
        }
        // Try to extract phone
        if (preg_match('/(?:\+?\d[\d\s\/-]{6,}|\d{3,5}[\s\/-]\d{3,})/', $desc, $m)) {
            $phone = trim($m[0]);
        }
        // Try to extract organization (line starting with "Firma:" or "Unternehmen:" or "Company:")
        if (preg_match('/(?:firma|unternehmen|company|org)[:\s]+(.+)/i', $desc, $m)) {
            $org = trim($m[1]);
        }

        // Labels -> tags
        $tags = [];
        foreach ($card['labels'] ?? [] as $label) {
            if (!empty($label['name'])) {
                $tags[] = $label['name'];
            }
        }

        // Assignee
        $assigned = '';
        if (!empty($card['members'])) {
            $assigned = $card['members'][0]['fullName'] ?? $card['members'][0]['username'] ?? '';
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
            ':id'         => generate_uuid(),
            ':name'       => $name,
            ':email'      => $email,
            ':phone'      => $phone,
            ':org'        => $org,
            ':tags'       => json_encode($tags),
            ':notes'      => $desc,
            ':stage'      => $stage,
            ':assigned'   => $assigned,
            ':followup'   => $followup,
            ':created_by' => $_SESSION['user_id'],
            ':created_at' => $createdAt,
            ':updated_at' => $now,
        ]);

        $imported++;
    }

    json_success("Trello-Import abgeschlossen", [
        'imported' => $imported,
        'skipped'  => $skipped,
        'total'    => count($cards),
    ]);
}
