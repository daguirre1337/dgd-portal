<?php
/**
 * DGD Dashboard - Project & Milestone Handlers
 *
 * GET    /api/projects                    - List projects (optional ?status=&category=)
 * POST   /api/projects                    - Create project
 * PUT    /api/projects/{id}               - Update project
 * DELETE /api/projects/{id}               - Delete project + milestones
 * POST   /api/projects/{id}/milestones    - Create milestone
 * PUT    /api/milestones/{id}             - Update milestone
 */

require_once __DIR__ . '/../crud_helpers.php';

/**
 * GET /api/projects
 * N+1 fix: fetch all milestones in one query, then group by project_id.
 */
function handle_list_projects(): void
{
    $db = get_db();

    $wc = build_where_clause([
        'p.status'   => $_GET['status'] ?? null,
        'p.category' => $_GET['category'] ?? null,
    ], ['p.status', 'p.category']);

    $stmt = $db->prepare("
        SELECT p.* FROM projects p
        {$wc['clause']}
        ORDER BY
            CASE p.status
                WHEN 'aktiv' THEN 1
                WHEN 'geplant' THEN 2
                WHEN 'abgeschlossen' THEN 3
                WHEN 'pausiert' THEN 4
                ELSE 5
            END,
            p.start_date DESC
    ");
    $stmt->execute($wc['params']);
    $projects = $stmt->fetchAll();

    // Fetch ALL milestones at once (N+1 fix)
    $projectIds = array_column($projects, 'id');
    $milestonesByProject = [];

    if (!empty($projectIds)) {
        $placeholders = implode(',', array_fill(0, count($projectIds), '?'));
        $msStmt = $db->prepare("
            SELECT * FROM milestones
            WHERE project_id IN ({$placeholders})
            ORDER BY date ASC
        ");
        $msStmt->execute($projectIds);
        $allMs = $msStmt->fetchAll();

        foreach ($allMs as &$ms) {
            $ms['completed'] = (int) $ms['completed'];
        }
        $milestonesByProject = group_children($allMs, 'project_id');
    }

    foreach ($projects as &$proj) {
        $proj['progress']   = (int) $proj['progress'];
        $proj['milestones'] = $milestonesByProject[$proj['id']] ?? [];
    }

    json_response([
        'projects' => $projects,
        'total'    => count($projects),
    ]);
}

function handle_create_project(): void
{
    $body = get_json_body();

    if (empty($body['title'])) {
        json_error('Title is required', 400);
    }

    $db  = get_db();
    $id  = generate_uuid();
    $now = now_iso();

    $db->prepare("
        INSERT INTO projects (id, title, description, category, status, priority, start_date, end_date, progress, owner, tags, created_by, created_at, updated_at)
        VALUES (:id, :title, :description, :category, :status, :priority, :start_date, :end_date, :progress, :owner, :tags, :created_by, :created_at, :updated_at)
    ")->execute([
        ':id'          => $id,
        ':title'       => trim($body['title']),
        ':description' => trim($body['description'] ?? ''),
        ':category'    => trim($body['category'] ?? 'intern'),
        ':status'      => trim($body['status'] ?? 'geplant'),
        ':priority'    => trim($body['priority'] ?? 'mittel'),
        ':start_date'  => $body['start_date'] ?? null,
        ':end_date'    => $body['end_date'] ?? null,
        ':progress'    => (int) ($body['progress'] ?? 0),
        ':owner'       => trim($body['owner'] ?? ''),
        ':tags'        => trim($body['tags'] ?? ''),
        ':created_by'  => $_SESSION['user_id'],
        ':created_at'  => $now,
        ':updated_at'  => $now,
    ]);

    json_success('Project created', ['id' => $id]);
}

function handle_update_project(string $id): void
{
    $body = get_json_body();
    $db   = get_db();

    require_exists($db, 'projects', $id, 'Project');

    $allowed = ['title', 'description', 'category', 'status', 'priority', 'start_date', 'end_date', 'progress', 'owner', 'tags'];
    $update  = build_update($body, $allowed, ['progress' => 'int'], $id);

    if (!$update) {
        json_error('No fields to update', 400);
    }

    $db->prepare("UPDATE projects SET {$update['sql_sets']} WHERE id = :id")
       ->execute($update['params']);

    json_success('Project updated');
}

function handle_delete_project(string $id): void
{
    $db = get_db();
    require_exists($db, 'projects', $id, 'Project');

    $db->prepare("DELETE FROM projects WHERE id = :id")->execute([':id' => $id]);
    json_success('Project deleted');
}

function handle_create_milestone(string $projectId): void
{
    $body = get_json_body();

    if (empty($body['title']) || empty($body['date'])) {
        json_error('Title and date are required', 400);
    }

    $db = get_db();
    require_exists($db, 'projects', $projectId, 'Project');

    $id  = generate_uuid();
    $now = now_iso();

    $db->prepare("
        INSERT INTO milestones (id, project_id, title, date, completed, created_at)
        VALUES (:id, :project_id, :title, :date, :completed, :created_at)
    ")->execute([
        ':id'         => $id,
        ':project_id' => $projectId,
        ':title'      => trim($body['title']),
        ':date'       => trim($body['date']),
        ':completed'  => (int) ($body['completed'] ?? 0),
        ':created_at' => $now,
    ]);

    json_success('Milestone created', ['id' => $id]);
}

function handle_update_milestone(string $id): void
{
    $body = get_json_body();
    $db   = get_db();

    require_exists($db, 'milestones', $id, 'Milestone');

    $allowed = ['title', 'date', 'completed'];
    $update  = build_update($body, $allowed, ['completed' => 'int'], $id);

    if (!$update) {
        json_error('No fields to update', 400);
    }

    $db->prepare("UPDATE milestones SET {$update['sql_sets']} WHERE id = :id")
       ->execute($update['params']);

    json_success('Milestone updated');
}
