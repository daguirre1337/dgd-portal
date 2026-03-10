<?php
/**
 * DGD Dashboard - KPI Handlers
 *
 * GET  /api/kpis              - List all KPIs
 * POST /api/kpis              - Create or update KPI (upsert)
 * GET  /api/kpis/{id}/history - KPI history for sparkline charts
 */

require_once __DIR__ . '/../crud_helpers.php';

function handle_list_kpis(): void
{
    $db = get_db();

    $stmt = $db->query("SELECT * FROM kpis ORDER BY category, name");
    $kpis = $stmt->fetchAll();

    $kpis = cast_rows($kpis, [
        'value'         => 'float',
        'target'        => 'float_null',
        'warning_low'   => 'float_null',
        'warning_high'  => 'float_null',
        'critical_low'  => 'float_null',
        'critical_high' => 'float_null',
    ]);

    json_response([
        'kpis'  => $kpis,
        'total' => count($kpis),
    ]);
}

function handle_upsert_kpi(): void
{
    $body = get_json_body();

    if (empty($body['name'])) {
        json_error('Name is required', 400);
    }
    if (!isset($body['value'])) {
        json_error('Value is required', 400);
    }

    $db  = get_db();
    $now = now_iso();

    $existingId = $body['id'] ?? null;
    $existing   = null;

    if ($existingId) {
        $stmt = $db->prepare("SELECT id FROM kpis WHERE id = :id");
        $stmt->execute([':id' => $existingId]);
        $existing = $stmt->fetch();
    }

    $kpiParams = [
        ':name'          => trim($body['name']),
        ':category'      => trim($body['category'] ?? 'portal'),
        ':value'         => (float) $body['value'],
        ':unit'          => trim($body['unit'] ?? ''),
        ':target'        => isset($body['target']) ? (float) $body['target'] : null,
        ':trend'         => trim($body['trend'] ?? 'stable'),
        ':icon'          => trim($body['icon'] ?? ''),
        ':data_source'   => trim($body['data_source'] ?? 'manual'),
        ':warning_low'   => isset($body['warning_low']) ? (float) $body['warning_low'] : null,
        ':warning_high'  => isset($body['warning_high']) ? (float) $body['warning_high'] : null,
        ':critical_low'  => isset($body['critical_low']) ? (float) $body['critical_low'] : null,
        ':critical_high' => isset($body['critical_high']) ? (float) $body['critical_high'] : null,
        ':updated_at'    => $now,
    ];

    if ($existing) {
        $kpiParams[':id'] = $existingId;
        $db->prepare("
            UPDATE kpis SET
                name = :name, category = :category, value = :value,
                unit = :unit, target = :target, trend = :trend,
                icon = :icon, data_source = :data_source,
                warning_low = :warning_low, warning_high = :warning_high,
                critical_low = :critical_low, critical_high = :critical_high,
                updated_at = :updated_at
            WHERE id = :id
        ")->execute($kpiParams);
        $kpiId = $existingId;
    } else {
        $kpiId = generate_uuid();
        $kpiParams[':id'] = $kpiId;
        $db->prepare("
            INSERT INTO kpis (id, name, category, value, unit, target, trend, period, source, data_source, icon,
                              warning_low, warning_high, critical_low, critical_high, updated_at)
            VALUES (:id, :name, :category, :value, :unit, :target, :trend, 'monat', 'manual', :data_source, :icon,
                    :warning_low, :warning_high, :critical_low, :critical_high, :updated_at)
        ")->execute($kpiParams);
    }

    // Insert history entry
    $db->prepare("
        INSERT INTO kpi_history (id, kpi_id, value, recorded_at)
        VALUES (:id, :kpi_id, :value, :recorded_at)
    ")->execute([
        ':id'          => generate_uuid(),
        ':kpi_id'      => $kpiId,
        ':value'       => (float) $body['value'],
        ':recorded_at' => $now,
    ]);

    json_success($existing ? 'KPI updated' : 'KPI created', ['id' => $kpiId]);
}

function handle_kpi_history(string $kpiId): void
{
    $db = get_db();

    $kpiStmt = $db->prepare("SELECT id, name, unit FROM kpis WHERE id = :id");
    $kpiStmt->execute([':id' => $kpiId]);
    $kpi = $kpiStmt->fetch();

    if (!$kpi) {
        json_error('KPI not found', 404);
    }

    $limit = min(max((int) ($_GET['limit'] ?? 100), 1), 500);

    $stmt = $db->prepare("
        SELECT id, value, recorded_at
        FROM kpi_history
        WHERE kpi_id = :kpi_id
        ORDER BY recorded_at ASC
        LIMIT :limit
    ");
    $stmt->bindValue(':kpi_id', $kpiId);
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->execute();

    $history = cast_rows($stmt->fetchAll(), ['value' => 'float']);

    json_response([
        'kpi'     => $kpi,
        'history' => $history,
        'total'   => count($history),
    ]);
}
