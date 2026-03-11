<?php
/**
 * DGD Dashboard - Export / Report API
 *
 * Endpoints:
 *   GET /api/export?type=kpis&format=csv       - CSV of all KPIs
 *   GET /api/export?type=projects&format=csv    - CSV of projects + milestones
 *   GET /api/export?type=goals&format=csv       - CSV of goals + key results
 *   GET /api/export?type=finance&format=csv     - CSV of revenue + expenses
 *   GET /api/export?type=full&format=csv        - Combined report (all data)
 *   GET /api/export?type=<any>&format=json      - JSON export
 */

// ============================================================
//  MAIN HANDLER
// ============================================================

function handle_export(): void
{
    $type   = $_GET['type']   ?? 'kpis';
    $format = $_GET['format'] ?? 'csv';

    $allowed_types   = ['kpis', 'projects', 'goals', 'finance', 'full'];
    $allowed_formats = ['csv', 'json'];

    if (!in_array($type, $allowed_types, true)) {
        json_error('Ungueltiger Exporttyp. Erlaubt: ' . implode(', ', $allowed_types), 400);
    }
    if (!in_array($format, $allowed_formats, true)) {
        json_error('Ungueltiges Format. Erlaubt: csv, json', 400);
    }

    $data = [];

    if ($type === 'full') {
        $data['kpis']     = fetch_kpis_data();
        $data['projects'] = fetch_projects_data();
        $data['goals']    = fetch_goals_data();
        $data['finance']  = fetch_finance_data();
    } else {
        $fetcher = 'fetch_' . $type . '_data';
        $data[$type] = $fetcher();
    }

    if ($format === 'json') {
        send_json_export($data, $type);
    } else {
        send_csv_export($data, $type);
    }
}

// ============================================================
//  DATA FETCHERS
// ============================================================

function fetch_kpis_data(): array
{
    $db   = get_db();
    $stmt = $db->query("SELECT name, category, value, target, unit, status, trend, updated_at FROM kpis ORDER BY category, name");
    return $stmt->fetchAll();
}

function fetch_projects_data(): array
{
    $db = get_db();

    $projects = $db->query("SELECT id, name, status, priority, budget, start_date, end_date, progress, description FROM projects ORDER BY name")->fetchAll();

    foreach ($projects as &$project) {
        $stmt = $db->prepare("SELECT title, status, due_date, progress FROM milestones WHERE project_id = :pid ORDER BY due_date");
        $stmt->execute([':pid' => $project['id']]);
        $project['milestones'] = $stmt->fetchAll();
    }
    unset($project);

    return $projects;
}

function fetch_goals_data(): array
{
    $db = get_db();

    $goals = $db->query("SELECT id, title, category, status, priority, progress, quarter, owner, due_date, created_at FROM goals ORDER BY quarter, category")->fetchAll();

    foreach ($goals as &$goal) {
        $stmt = $db->prepare("SELECT title, current_value, target_value, unit, progress FROM key_results WHERE goal_id = :gid ORDER BY title");
        $stmt->execute([':gid' => $goal['id']]);
        $goal['key_results'] = $stmt->fetchAll();
    }
    unset($goal);

    return $goals;
}

function fetch_finance_data(): array
{
    $db = get_db();

    finance_ensure_tables();

    $revenue  = $db->query("SELECT date, description, amount, source, project_id FROM revenue_entries ORDER BY date DESC")->fetchAll();
    $expenses = $db->query("SELECT date, description, amount, category, project_id FROM project_expenses ORDER BY date DESC")->fetchAll();

    $totalRevenue = 0;
    foreach ($revenue as $r) {
        $totalRevenue += (float) $r['amount'];
    }
    $totalExpenses = 0;
    foreach ($expenses as $e) {
        $totalExpenses += (float) $e['amount'];
    }

    return [
        'revenue'        => $revenue,
        'expenses'       => $expenses,
        'total_revenue'  => $totalRevenue,
        'total_expenses' => $totalExpenses,
        'profit'         => $totalRevenue - $totalExpenses,
    ];
}

// ============================================================
//  JSON EXPORT
// ============================================================

function send_json_export(array $data, string $type): void
{
    $date     = date('Y-m-d');
    $filename = "cortex_{$type}_{$date}.json";

    header('Content-Type: application/json; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');

    echo json_encode([
        'export_type' => $type,
        'export_date' => $date,
        'generated'   => date('Y-m-d\TH:i:s\Z'),
        'data'        => $data,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    exit;
}

// ============================================================
//  CSV EXPORT
// ============================================================

function send_csv_export(array $data, string $type): void
{
    $date     = date('Y-m-d');
    $filename = "cortex_{$type}_{$date}.csv";

    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');

    $output = fopen('php://output', 'w');

    // UTF-8 BOM for Excel compatibility
    fwrite($output, "\xEF\xBB\xBF");

    if ($type === 'full') {
        write_csv_section($output, 'KPIs', $data['kpis'] ?? []);
        fputcsv($output, [], ';');
        write_csv_section($output, 'Projekte', $data['projects'] ?? []);
        fputcsv($output, [], ';');
        write_csv_section($output, 'Ziele', $data['goals'] ?? []);
        fputcsv($output, [], ';');
        write_csv_finance_section($output, $data['finance'] ?? []);
    } elseif ($type === 'kpis') {
        write_csv_kpis($output, $data['kpis'] ?? []);
    } elseif ($type === 'projects') {
        write_csv_projects($output, $data['projects'] ?? []);
    } elseif ($type === 'goals') {
        write_csv_goals($output, $data['goals'] ?? []);
    } elseif ($type === 'finance') {
        write_csv_finance_section($output, $data['finance'] ?? []);
    }

    fclose($output);
    exit;
}

function write_csv_section($output, string $title, array $rows): void
{
    fputcsv($output, ["=== {$title} ==="], ';');

    if ($title === 'KPIs') {
        write_csv_kpis($output, $rows);
    } elseif ($title === 'Projekte') {
        write_csv_projects($output, $rows);
    } elseif ($title === 'Ziele') {
        write_csv_goals($output, $rows);
    }
}

// ---------- KPIs ----------

function write_csv_kpis($output, array $kpis): void
{
    fputcsv($output, ['Bezeichnung', 'Kategorie', 'Aktueller Wert', 'Zielwert', 'Einheit', 'Status', 'Trend', 'Aktualisiert'], ';');

    foreach ($kpis as $kpi) {
        fputcsv($output, [
            $kpi['name']       ?? '',
            $kpi['category']   ?? '',
            $kpi['value']      ?? '',
            $kpi['target']     ?? '',
            $kpi['unit']       ?? '',
            $kpi['status']     ?? '',
            $kpi['trend']      ?? '',
            $kpi['updated_at'] ?? '',
        ], ';');
    }
}

// ---------- Projects ----------

function write_csv_projects($output, array $projects): void
{
    fputcsv($output, ['Projekt', 'Status', 'Prioritaet', 'Budget', 'Startdatum', 'Enddatum', 'Fortschritt', 'Beschreibung'], ';');

    foreach ($projects as $project) {
        fputcsv($output, [
            $project['name']        ?? '',
            $project['status']      ?? '',
            $project['priority']    ?? '',
            $project['budget']      ?? '',
            $project['start_date']  ?? '',
            $project['end_date']    ?? '',
            isset($project['progress']) ? $project['progress'] . '%' : '',
            $project['description'] ?? '',
        ], ';');

        // Milestones as indented sub-rows
        if (!empty($project['milestones'])) {
            fputcsv($output, ['  Meilenstein', 'Status', '', '', 'Faellig', '', 'Fortschritt', ''], ';');
            foreach ($project['milestones'] as $ms) {
                fputcsv($output, [
                    '  ' . ($ms['title'] ?? ''),
                    $ms['status']   ?? '',
                    '',
                    '',
                    $ms['due_date'] ?? '',
                    '',
                    isset($ms['progress']) ? $ms['progress'] . '%' : '',
                    '',
                ], ';');
            }
        }
    }
}

// ---------- Goals ----------

function write_csv_goals($output, array $goals): void
{
    fputcsv($output, ['Ziel', 'Kategorie', 'Status', 'Prioritaet', 'Fortschritt', 'Quartal', 'Verantwortlich', 'Faellig', 'Erstellt'], ';');

    foreach ($goals as $goal) {
        fputcsv($output, [
            $goal['title']      ?? '',
            $goal['category']   ?? '',
            $goal['status']     ?? '',
            $goal['priority']   ?? '',
            isset($goal['progress']) ? $goal['progress'] . '%' : '',
            $goal['quarter']    ?? '',
            $goal['owner']      ?? '',
            $goal['due_date']   ?? '',
            $goal['created_at'] ?? '',
        ], ';');

        // Key Results as sub-rows
        if (!empty($goal['key_results'])) {
            fputcsv($output, ['  Key Result', 'Ist-Wert', 'Ziel-Wert', 'Einheit', 'Fortschritt', '', '', '', ''], ';');
            foreach ($goal['key_results'] as $kr) {
                fputcsv($output, [
                    '  ' . ($kr['title'] ?? ''),
                    $kr['current_value'] ?? '',
                    $kr['target_value']  ?? '',
                    $kr['unit']          ?? '',
                    isset($kr['progress']) ? $kr['progress'] . '%' : '',
                    '', '', '', '',
                ], ';');
            }
        }
    }
}

// ---------- Finance ----------

function write_csv_finance_section($output, array $finance): void
{
    fputcsv($output, ['=== Finanzen ==='], ';');
    fputcsv($output, ['Zusammenfassung'], ';');
    fputcsv($output, ['Gesamtumsatz', number_format($finance['total_revenue'] ?? 0, 2, ',', '.')], ';');
    fputcsv($output, ['Gesamtausgaben', number_format($finance['total_expenses'] ?? 0, 2, ',', '.')], ';');
    fputcsv($output, ['Gewinn', number_format($finance['profit'] ?? 0, 2, ',', '.')], ';');
    fputcsv($output, [], ';');

    // Revenue
    fputcsv($output, ['--- Umsatz ---'], ';');
    fputcsv($output, ['Datum', 'Beschreibung', 'Betrag', 'Quelle', 'Projekt-ID'], ';');
    foreach (($finance['revenue'] ?? []) as $r) {
        fputcsv($output, [
            $r['date']        ?? '',
            $r['description'] ?? '',
            $r['amount']      ?? '',
            $r['source']      ?? '',
            $r['project_id']  ?? '',
        ], ';');
    }

    fputcsv($output, [], ';');

    // Expenses
    fputcsv($output, ['--- Ausgaben ---'], ';');
    fputcsv($output, ['Datum', 'Beschreibung', 'Betrag', 'Kategorie', 'Projekt-ID'], ';');
    foreach (($finance['expenses'] ?? []) as $e) {
        fputcsv($output, [
            $e['date']        ?? '',
            $e['description'] ?? '',
            $e['amount']      ?? '',
            $e['category']    ?? '',
            $e['project_id']  ?? '',
        ], ';');
    }
}
