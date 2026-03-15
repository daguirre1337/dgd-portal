<?php
/**
 * DGD Dashboard - Finance / Budget Handlers
 *
 * Endpoints:
 *   GET    /api/finance/summary             - P&L summary (total revenue, costs, profit)
 *   GET    /api/finance/monthly             - Monthly breakdown for charts
 *   POST   /api/finance/expenses            - Create expense
 *   GET    /api/finance/expenses             - List expenses (filter: project_id, category, from, to)
 *   PUT    /api/finance/expenses/{id}       - Update expense
 *   DELETE /api/finance/expenses/{id}       - Delete expense
 *   POST   /api/finance/revenue             - Create revenue entry
 *   GET    /api/finance/revenue             - List revenue entries
 *   GET    /api/finance/projects            - Projects with budget vs spent
 *   POST   /api/finance/import              - Import bank CSV (Sparkasse format)
 *   GET    /api/finance/transactions        - List bank transactions (filter, paginate)
 *   GET    /api/finance/transaction-stats   - Monthly aggregation & category stats
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../crud_helpers.php';


// ============================================================
//  TABLE SETUP
// ============================================================

function finance_ensure_tables(): void
{
    $db = get_db();

    $db->exec("
        CREATE TABLE IF NOT EXISTS project_expenses (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            date TEXT NOT NULL,
            description TEXT NOT NULL,
            amount REAL NOT NULL,
            category TEXT NOT NULL DEFAULT 'other',
            created_by TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (project_id) REFERENCES projects(id),
            FOREIGN KEY (created_by) REFERENCES users(id)
        )
    ");

    $db->exec("
        CREATE TABLE IF NOT EXISTS revenue_entries (
            id TEXT PRIMARY KEY,
            date TEXT NOT NULL,
            description TEXT NOT NULL,
            amount REAL NOT NULL,
            source TEXT NOT NULL DEFAULT 'manual',
            project_id TEXT,
            created_by TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (project_id) REFERENCES projects(id),
            FOREIGN KEY (created_by) REFERENCES users(id)
        )
    ");

    $db->exec("CREATE INDEX IF NOT EXISTS idx_expenses_project  ON project_expenses(project_id)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_expenses_date     ON project_expenses(date)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_expenses_category ON project_expenses(category)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_revenue_date      ON revenue_entries(date)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_revenue_source    ON revenue_entries(source)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_revenue_project   ON revenue_entries(project_id)");

    // Bank transactions table
    $db->exec("
        CREATE TABLE IF NOT EXISTS bank_transactions (
            id TEXT PRIMARY KEY,
            date TEXT,
            valuta_date TEXT,
            description TEXT,
            amount REAL,
            currency TEXT DEFAULT 'EUR',
            iban_sender TEXT,
            iban_receiver TEXT,
            booking_type TEXT,
            reference TEXT,
            category TEXT DEFAULT 'uncategorized',
            import_batch_id TEXT,
            hash TEXT UNIQUE,
            created_at TEXT
        )
    ");

    $db->exec("CREATE INDEX IF NOT EXISTS idx_bt_date           ON bank_transactions(date)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_bt_category       ON bank_transactions(category)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_bt_import_batch   ON bank_transactions(import_batch_id)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_bt_amount         ON bank_transactions(amount)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_bt_hash           ON bank_transactions(hash)");

    // Import batches table
    $db->exec("
        CREATE TABLE IF NOT EXISTS import_batches (
            id TEXT PRIMARY KEY,
            filename TEXT,
            row_count INTEGER,
            created_by TEXT,
            created_at TEXT,
            FOREIGN KEY (created_by) REFERENCES users(id)
        )
    ");

    // Add budget columns to projects if not present
    finance_ensure_project_columns($db);
}

/**
 * Safely add budget/spent/revenue columns to existing projects table.
 */
function finance_ensure_project_columns(PDO $db): void
{
    // Check which columns exist
    $cols = [];
    $result = $db->query("PRAGMA table_info(projects)");
    while ($row = $result->fetch()) {
        $cols[] = $row['name'];
    }

    if (!in_array('budget_eur', $cols)) {
        $db->exec("ALTER TABLE projects ADD COLUMN budget_eur REAL DEFAULT 0");
    }
    if (!in_array('spent_eur', $cols)) {
        $db->exec("ALTER TABLE projects ADD COLUMN spent_eur REAL DEFAULT 0");
    }
    if (!in_array('revenue_eur', $cols)) {
        $db->exec("ALTER TABLE projects ADD COLUMN revenue_eur REAL DEFAULT 0");
    }
}


// ============================================================
//  HANDLERS
// ============================================================

/**
 * GET /api/finance/summary
 * Query params: ?from=2026-01-01&to=2026-12-31
 */
function handle_finance_summary(): void
{
    requireAuth();
    finance_ensure_tables();
    $db = get_db();

    $where_exp  = [];
    $where_rev  = [];
    $params_exp = [];
    $params_rev = [];

    if (!empty($_GET['from'])) {
        $where_exp[]          = 'date >= :from_date';
        $where_rev[]          = 'date >= :from_date';
        $params_exp[':from_date'] = $_GET['from'];
        $params_rev[':from_date'] = $_GET['from'];
    }
    if (!empty($_GET['to'])) {
        $where_exp[]        = 'date <= :to_date';
        $where_rev[]        = 'date <= :to_date';
        $params_exp[':to_date'] = $_GET['to'];
        $params_rev[':to_date'] = $_GET['to'];
    }

    $expWhere = count($where_exp) > 0 ? 'WHERE ' . implode(' AND ', $where_exp) : '';
    $revWhere = count($where_rev) > 0 ? 'WHERE ' . implode(' AND ', $where_rev) : '';

    // Total expenses
    $stmt = $db->prepare("SELECT COALESCE(SUM(amount), 0) FROM project_expenses {$expWhere}");
    $stmt->execute($params_exp);
    $totalExpenses = (float) $stmt->fetchColumn();

    // Expenses by category
    $stmt = $db->prepare("SELECT category, SUM(amount) as total FROM project_expenses {$expWhere} GROUP BY category ORDER BY total DESC");
    $stmt->execute($params_exp);
    $expensesByCategory = [];
    while ($row = $stmt->fetch()) {
        $expensesByCategory[$row['category']] = round((float) $row['total'], 2);
    }

    // Total revenue
    $stmt = $db->prepare("SELECT COALESCE(SUM(amount), 0) FROM revenue_entries {$revWhere}");
    $stmt->execute($params_rev);
    $totalRevenue = (float) $stmt->fetchColumn();

    // Revenue by source
    $stmt = $db->prepare("SELECT source, SUM(amount) as total FROM revenue_entries {$revWhere} GROUP BY source ORDER BY total DESC");
    $stmt->execute($params_rev);
    $revenueBySource = [];
    while ($row = $stmt->fetch()) {
        $revenueBySource[$row['source']] = round((float) $row['total'], 2);
    }

    json_response([
        'total_revenue'       => round($totalRevenue, 2),
        'total_expenses'      => round($totalExpenses, 2),
        'profit'              => round($totalRevenue - $totalExpenses, 2),
        'margin_pct'          => $totalRevenue > 0 ? round((($totalRevenue - $totalExpenses) / $totalRevenue) * 100, 1) : 0,
        'expenses_by_category' => $expensesByCategory,
        'revenue_by_source'   => $revenueBySource,
    ]);
}

/**
 * GET /api/finance/monthly
 * Query params: ?year=2026
 */
function handle_finance_monthly(): void
{
    requireAuth();
    finance_ensure_tables();
    $db = get_db();

    $year = (int) ($_GET['year'] ?? date('Y'));

    // Monthly expenses
    $stmt = $db->prepare("
        SELECT strftime('%m', date) as month, SUM(amount) as total
        FROM project_expenses
        WHERE strftime('%Y', date) = :year
        GROUP BY month
        ORDER BY month
    ");
    $stmt->execute([':year' => (string) $year]);
    $monthlyExpenses = [];
    while ($row = $stmt->fetch()) {
        $monthlyExpenses[(int) $row['month']] = round((float) $row['total'], 2);
    }

    // Monthly revenue
    $stmt = $db->prepare("
        SELECT strftime('%m', date) as month, SUM(amount) as total
        FROM revenue_entries
        WHERE strftime('%Y', date) = :year
        GROUP BY month
        ORDER BY month
    ");
    $stmt->execute([':year' => (string) $year]);
    $monthlyRevenue = [];
    while ($row = $stmt->fetch()) {
        $monthlyRevenue[(int) $row['month']] = round((float) $row['total'], 2);
    }

    // Build 12-month array
    $months = [];
    for ($m = 1; $m <= 12; $m++) {
        $rev = $monthlyRevenue[$m] ?? 0;
        $exp = $monthlyExpenses[$m] ?? 0;
        $months[] = [
            'month'    => $m,
            'label'    => date('M', mktime(0, 0, 0, $m, 1)),
            'revenue'  => $rev,
            'expenses' => $exp,
            'profit'   => round($rev - $exp, 2),
        ];
    }

    json_response([
        'year'   => $year,
        'months' => $months,
    ]);
}

/**
 * POST /api/finance/expenses
 * Body: { project_id, date, description, amount, category? }
 */
function handle_create_expense(): void
{
    requireAuth();
    finance_ensure_tables();
    $body = get_json_body();

    $missing = [];
    if (empty($body['project_id']))  $missing[] = 'project_id';
    if (empty($body['date']))        $missing[] = 'date';
    if (empty($body['description'])) $missing[] = 'description';
    if (!isset($body['amount']))     $missing[] = 'amount';
    if (count($missing) > 0) {
        json_error('Missing required fields: ' . implode(', ', $missing), 400);
    }

    $validCategories = ['personnel', 'tools', 'marketing', 'infrastructure', 'other'];
    $category = trim($body['category'] ?? 'other');
    if (!in_array($category, $validCategories)) {
        json_error('Invalid category. Valid: ' . implode(', ', $validCategories), 400);
    }

    require_exists('projects', $body['project_id'], 'Project');

    $db  = get_db();
    $id  = generate_uuid();
    $now = now_iso();

    $db->prepare("
        INSERT INTO project_expenses (id, project_id, date, description, amount, category, created_by, created_at)
        VALUES (:id, :project_id, :date, :description, :amount, :category, :created_by, :created_at)
    ")->execute([
        ':id'          => $id,
        ':project_id'  => $body['project_id'],
        ':date'        => trim($body['date']),
        ':description' => trim($body['description']),
        ':amount'      => (float) $body['amount'],
        ':category'    => $category,
        ':created_by'  => $_SESSION['user_id'],
        ':created_at'  => $now,
    ]);

    // Update project spent_eur
    finance_recalc_project_spent($db, $body['project_id']);

    json_success('Expense created', ['id' => $id]);
}

/**
 * GET /api/finance/expenses
 * Query params: ?project_id=&category=&from=&to=
 */
function handle_list_expenses(): void
{
    requireAuth();
    finance_ensure_tables();
    $db = get_db();

    $where  = [];
    $params = [];

    if (!empty($_GET['project_id'])) {
        $where[]                = 'e.project_id = :project_id';
        $params[':project_id']  = $_GET['project_id'];
    }
    if (!empty($_GET['category'])) {
        $where[]              = 'e.category = :category';
        $params[':category']  = $_GET['category'];
    }
    if (!empty($_GET['from'])) {
        $where[]              = 'e.date >= :from_date';
        $params[':from_date'] = $_GET['from'];
    }
    if (!empty($_GET['to'])) {
        $where[]            = 'e.date <= :to_date';
        $params[':to_date'] = $_GET['to'];
    }

    $whereClause = count($where) > 0 ? 'WHERE ' . implode(' AND ', $where) : '';

    $stmt = $db->prepare("
        SELECT e.*, p.title as project_title
        FROM project_expenses e
        LEFT JOIN projects p ON e.project_id = p.id
        {$whereClause}
        ORDER BY e.date DESC
    ");
    $stmt->execute($params);
    $expenses = $stmt->fetchAll();

    foreach ($expenses as &$exp) {
        $exp['amount'] = (float) $exp['amount'];
    }

    $totalStmt = $db->prepare("SELECT COALESCE(SUM(e.amount), 0) FROM project_expenses e {$whereClause}");
    $totalStmt->execute($params);
    $totalAmount = (float) $totalStmt->fetchColumn();

    json_response([
        'expenses'     => $expenses,
        'total'        => count($expenses),
        'total_amount' => round($totalAmount, 2),
    ]);
}

/**
 * PUT /api/finance/expenses/{id}
 * Body: partial update fields
 */
function handle_update_expense(string $id): void
{
    requireAuth();
    finance_ensure_tables();
    $body = get_json_body();

    $db = get_db();

    $stmt = $db->prepare("SELECT id, project_id FROM project_expenses WHERE id = :id");
    $stmt->execute([':id' => $id]);
    $expense = $stmt->fetch();

    if (!$expense) {
        json_error('Expense not found', 404);
    }

    // project_expenses has no updated_at column, so manual partial update
    $allowed = ['date', 'description', 'amount', 'category'];
    $sets    = [];
    $params  = [':id' => $id];

    foreach ($allowed as $field) {
        if (array_key_exists($field, $body)) {
            $sets[] = "{$field} = :{$field}";
            if ($field === 'amount') {
                $params[":{$field}"] = (float) $body[$field];
            } else {
                $params[":{$field}"] = trim((string) $body[$field]);
            }
        }
    }

    if (empty($sets)) {
        json_error('No fields to update', 400);
    }

    $sql = "UPDATE project_expenses SET " . implode(', ', $sets) . " WHERE id = :id";
    $db->prepare($sql)->execute($params);

    // Recalculate project spent
    finance_recalc_project_spent($db, $expense['project_id']);

    json_success('Expense updated');
}

/**
 * DELETE /api/finance/expenses/{id}
 */
function handle_delete_expense(string $id): void
{
    requireAuth();
    finance_ensure_tables();
    $db = get_db();

    $stmt = $db->prepare("SELECT id, project_id FROM project_expenses WHERE id = :id");
    $stmt->execute([':id' => $id]);
    $expense = $stmt->fetch();

    if (!$expense) {
        json_error('Expense not found', 404);
    }

    $db->prepare("DELETE FROM project_expenses WHERE id = :id")->execute([':id' => $id]);

    // Recalculate project spent
    finance_recalc_project_spent($db, $expense['project_id']);

    json_success('Expense deleted');
}

/**
 * POST /api/finance/revenue
 * Body: { date, description, amount, source?, project_id? }
 */
function handle_create_revenue(): void
{
    requireAuth();
    finance_ensure_tables();
    $body = get_json_body();

    $missing = [];
    if (empty($body['date']))        $missing[] = 'date';
    if (empty($body['description'])) $missing[] = 'description';
    if (!isset($body['amount']))     $missing[] = 'amount';
    if (count($missing) > 0) {
        json_error('Missing required fields: ' . implode(', ', $missing), 400);
    }

    $db  = get_db();
    $id  = generate_uuid();
    $now = now_iso();

    // Verify project if provided
    if (!empty($body['project_id'])) {
        $pStmt = $db->prepare("SELECT id FROM projects WHERE id = :id");
        $pStmt->execute([':id' => $body['project_id']]);
        if (!$pStmt->fetch()) {
            json_error('Project not found', 404);
        }
    }

    $db->prepare("
        INSERT INTO revenue_entries (id, date, description, amount, source, project_id, created_by, created_at)
        VALUES (:id, :date, :description, :amount, :source, :project_id, :created_by, :created_at)
    ")->execute([
        ':id'          => $id,
        ':date'        => trim($body['date']),
        ':description' => trim($body['description']),
        ':amount'      => (float) $body['amount'],
        ':source'      => trim($body['source'] ?? 'manual'),
        ':project_id'  => $body['project_id'] ?? null,
        ':created_by'  => $_SESSION['user_id'],
        ':created_at'  => $now,
    ]);

    // Update project revenue if linked
    if (!empty($body['project_id'])) {
        finance_recalc_project_revenue($db, $body['project_id']);
    }

    json_success('Revenue entry created', ['id' => $id]);
}

/**
 * GET /api/finance/revenue
 * Query params: ?source=&project_id=&from=&to=
 */
function handle_list_revenue(): void
{
    requireAuth();
    finance_ensure_tables();
    $db = get_db();

    $where  = [];
    $params = [];

    if (!empty($_GET['source'])) {
        $where[]            = 'r.source = :source';
        $params[':source']  = $_GET['source'];
    }
    if (!empty($_GET['project_id'])) {
        $where[]                = 'r.project_id = :project_id';
        $params[':project_id']  = $_GET['project_id'];
    }
    if (!empty($_GET['from'])) {
        $where[]              = 'r.date >= :from_date';
        $params[':from_date'] = $_GET['from'];
    }
    if (!empty($_GET['to'])) {
        $where[]            = 'r.date <= :to_date';
        $params[':to_date'] = $_GET['to'];
    }

    $whereClause = count($where) > 0 ? 'WHERE ' . implode(' AND ', $where) : '';

    $stmt = $db->prepare("
        SELECT r.*, p.title as project_title
        FROM revenue_entries r
        LEFT JOIN projects p ON r.project_id = p.id
        {$whereClause}
        ORDER BY r.date DESC
    ");
    $stmt->execute($params);
    $entries = $stmt->fetchAll();

    foreach ($entries as &$entry) {
        $entry['amount'] = (float) $entry['amount'];
    }

    $totalStmt = $db->prepare("SELECT COALESCE(SUM(r.amount), 0) FROM revenue_entries r {$whereClause}");
    $totalStmt->execute($params);
    $totalAmount = (float) $totalStmt->fetchColumn();

    json_response([
        'revenue'      => $entries,
        'total'        => count($entries),
        'total_amount' => round($totalAmount, 2),
    ]);
}

/**
 * GET /api/finance/projects
 * Returns projects with budget, spent, revenue overview.
 */
function handle_finance_projects(): void
{
    requireAuth();
    finance_ensure_tables();
    $db = get_db();

    $stmt = $db->query("
        SELECT
            p.id, p.title, p.status, p.category,
            COALESCE(p.budget_eur, 0) as budget_eur,
            COALESCE(p.spent_eur, 0) as spent_eur,
            COALESCE(p.revenue_eur, 0) as revenue_eur
        FROM projects p
        ORDER BY p.status, p.title
    ");
    $projects = $stmt->fetchAll();

    foreach ($projects as &$proj) {
        $proj['budget_eur']  = (float) $proj['budget_eur'];
        $proj['spent_eur']   = (float) $proj['spent_eur'];
        $proj['revenue_eur'] = (float) $proj['revenue_eur'];
        $proj['remaining']   = round($proj['budget_eur'] - $proj['spent_eur'], 2);
        $proj['budget_pct']  = $proj['budget_eur'] > 0
            ? round(($proj['spent_eur'] / $proj['budget_eur']) * 100, 1)
            : 0;
    }

    json_response([
        'projects' => $projects,
        'total'    => count($projects),
    ]);
}


// ============================================================
//  BANK TRANSACTION HANDLERS
// ============================================================

/**
 * Auto-categorize a bank transaction based on description keywords.
 */
function categorize_transaction(string $description): string
{
    $desc = mb_strtolower($description, 'UTF-8');

    $rules = [
        'personnel'  => ['gehalt', 'lohn', 'vergütung', 'vergut'],
        'rent'       => ['miete', 'mietvertrag', 'kaltmiete', 'warmmiete'],
        'insurance'  => ['versicherung', 'allianz', 'huk', 'devk', 'generali'],
        'fuel'       => ['tankstelle', 'shell', 'aral', 'jet', 'total', 'diesel'],
        'groceries'  => ['rewe', 'edeka', 'aldi', 'lidl', 'penny', 'netto', 'kaufland'],
        'utilities'  => ['strom', 'gas', 'stadtwerke', 'energie', 'enbw'],
        'telecom'    => ['telekom', 'vodafone', 'o2', '1&1', 'internet'],
        'tax'        => ['finanzamt', 'steuer', 'elster', 'ihk', 'kammer'],
    ];

    foreach ($rules as $category => $keywords) {
        foreach ($keywords as $kw) {
            if (mb_strpos($desc, $kw) !== false) {
                return $category;
            }
        }
    }

    return 'uncategorized';
}

/**
 * Parse a German-format number string to float.
 * "1.234,56" → 1234.56 | "-1.234,56" → -1234.56
 */
function parse_german_amount(string $raw): float
{
    $raw = trim($raw);
    // Remove thousand separators (dots), replace decimal comma with dot
    $raw = str_replace('.', '', $raw);
    $raw = str_replace(',', '.', $raw);
    return (float) $raw;
}

/**
 * Convert DD.MM.YYYY to YYYY-MM-DD (ISO).
 */
function parse_german_date(string $raw): string
{
    $raw = trim($raw);
    $parts = explode('.', $raw);
    if (count($parts) === 3) {
        return sprintf('%s-%s-%s', $parts[2], $parts[1], $parts[0]);
    }
    return $raw; // Return as-is if not parseable
}

/**
 * POST /api/finance/import
 * Accepts multipart/form-data with a 'file' field (CSV, Sparkasse format).
 */
function handle_import_bank_csv(): void
{
    requireAuth();
    checkRateLimit('csv_import', 5, 3600); // max 5 CSV imports per hour
    finance_ensure_tables();

    if (empty($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        json_error('No file uploaded or upload error', 400);
    }

    $tmpPath  = $_FILES['file']['tmp_name'];
    $filename = $_FILES['file']['name'] ?? 'unknown.csv';

    // Read file content and handle encoding
    $content = file_get_contents($tmpPath);
    if ($content === false) {
        json_error('Failed to read uploaded file', 500);
    }

    $encoding = mb_detect_encoding($content, ['UTF-8', 'ISO-8859-1', 'Windows-1252'], true);
    if ($encoding && $encoding !== 'UTF-8') {
        $content = mb_convert_encoding($content, 'UTF-8', $encoding);
    }

    // Write converted content to temp file for fgetcsv
    $tmpConverted = tempnam(sys_get_temp_dir(), 'csv_');
    file_put_contents($tmpConverted, $content);

    $fh = fopen($tmpConverted, 'r');
    if (!$fh) {
        @unlink($tmpConverted);
        json_error('Failed to open CSV file', 500);
    }

    $db      = get_db();
    $batchId = generate_uuid();
    $now     = now_iso();

    $imported  = 0;
    $skipped   = 0;
    $categories = [];
    $headerSkipped = false;

    $rows = [];
    while (($line = fgetcsv($fh, 0, ';')) !== false) {
        // Skip empty lines
        if (count($line) < 9) {
            continue;
        }

        // Auto-detect header: if first column looks like a header label, skip
        if (!$headerSkipped) {
            // Check if the amount column (8) is NOT numeric → likely a header
            $testAmount = trim($line[8] ?? '');
            $testAmount = str_replace(['.', ',', '-', ' '], '', $testAmount);
            if (!is_numeric($testAmount) || mb_strtolower($line[0]) === 'auftragskonto') {
                $headerSkipped = true;
                continue;
            }
            $headerSkipped = true;
        }

        $rows[] = $line;
    }
    fclose($fh);
    @unlink($tmpConverted);

    // Begin transaction for batch insert
    $db->beginTransaction();

    try {
        // Create import batch
        $db->prepare("
            INSERT INTO import_batches (id, filename, row_count, created_by, created_at)
            VALUES (:id, :filename, :row_count, :created_by, :created_at)
        ")->execute([
            ':id'         => $batchId,
            ':filename'   => $filename,
            ':row_count'  => count($rows),
            ':created_by' => $_SESSION['user_id'],
            ':created_at' => $now,
        ]);

        $insertStmt = $db->prepare("
            INSERT INTO bank_transactions
                (id, date, valuta_date, description, amount, currency,
                 iban_sender, iban_receiver, booking_type, reference,
                 category, import_batch_id, hash, created_at)
            VALUES
                (:id, :date, :valuta_date, :description, :amount, :currency,
                 :iban_sender, :iban_receiver, :booking_type, :reference,
                 :category, :import_batch_id, :hash, :created_at)
        ");

        foreach ($rows as $line) {
            $dateRaw      = trim($line[1] ?? '');
            $valutaRaw    = trim($line[2] ?? '');
            $bookingType  = trim($line[3] ?? '');
            $reference    = trim($line[4] ?? '');
            $beneficiary  = trim($line[5] ?? '');
            $accountNr    = trim($line[6] ?? '');
            $blz          = trim($line[7] ?? '');
            $amountRaw    = trim($line[8] ?? '0');
            $currency     = trim($line[9] ?? 'EUR');

            $date       = parse_german_date($dateRaw);
            $valutaDate = parse_german_date($valutaRaw);
            $amount     = parse_german_amount($amountRaw);

            // Build description from beneficiary + reference
            $description = trim($beneficiary);
            if (!empty($reference)) {
                $description .= ' - ' . $reference;
            }
            if (empty($description)) {
                $description = $bookingType;
            }

            // Duplicate hash: SHA256 of date + amount + reference
            $hashInput = $date . '|' . $amount . '|' . $reference;
            $hash = hash('sha256', $hashInput);

            // Auto-categorize
            $category = categorize_transaction($description);

            try {
                $insertStmt->execute([
                    ':id'              => generate_uuid(),
                    ':date'            => $date,
                    ':valuta_date'     => $valutaDate,
                    ':description'     => $description,
                    ':amount'          => $amount,
                    ':currency'        => $currency ?: 'EUR',
                    ':iban_sender'     => trim($line[0] ?? ''),
                    ':iban_receiver'   => $accountNr,
                    ':booking_type'    => $bookingType,
                    ':reference'       => $reference,
                    ':category'        => $category,
                    ':import_batch_id' => $batchId,
                    ':hash'            => $hash,
                    ':created_at'      => $now,
                ]);
                $imported++;
                $categories[$category] = ($categories[$category] ?? 0) + 1;
            } catch (PDOException $e) {
                // UNIQUE constraint on hash → duplicate
                if (strpos($e->getMessage(), 'UNIQUE') !== false) {
                    $skipped++;
                } else {
                    throw $e;
                }
            }
        }

        $db->commit();
    } catch (Exception $e) {
        $db->rollBack();
        json_error('Import failed: ' . $e->getMessage(), 500);
    }

    json_response([
        'imported'   => $imported,
        'skipped'    => $skipped,
        'batch_id'   => $batchId,
        'categories' => $categories,
    ]);
}

/**
 * GET /api/finance/transactions
 * Query params: ?from=&to=&category=&min_amount=&max_amount=&q=&limit=50&offset=0
 */
function handle_list_bank_transactions(): void
{
    requireAuth();
    finance_ensure_tables();
    $db = get_db();

    $where  = [];
    $params = [];

    if (!empty($_GET['from'])) {
        $where[]              = 'date >= :from_date';
        $params[':from_date'] = $_GET['from'];
    }
    if (!empty($_GET['to'])) {
        $where[]            = 'date <= :to_date';
        $params[':to_date'] = $_GET['to'];
    }
    if (!empty($_GET['category'])) {
        $where[]              = 'category = :category';
        $params[':category']  = $_GET['category'];
    }
    if (isset($_GET['min_amount']) && $_GET['min_amount'] !== '') {
        $where[]                = 'amount >= :min_amount';
        $params[':min_amount']  = (float) $_GET['min_amount'];
    }
    if (isset($_GET['max_amount']) && $_GET['max_amount'] !== '') {
        $where[]                = 'amount <= :max_amount';
        $params[':max_amount']  = (float) $_GET['max_amount'];
    }
    if (!empty($_GET['q'])) {
        $where[]        = 'description LIKE :q';
        $params[':q']   = '%' . $_GET['q'] . '%';
    }

    $whereClause = count($where) > 0 ? 'WHERE ' . implode(' AND ', $where) : '';

    $limit  = max(1, min(500, (int) ($_GET['limit']  ?? 50)));
    $offset = max(0, (int) ($_GET['offset'] ?? 0));

    // Get total count
    $countStmt = $db->prepare("SELECT COUNT(*) FROM bank_transactions {$whereClause}");
    $countStmt->execute($params);
    $total = (int) $countStmt->fetchColumn();

    // Get transactions
    $stmt = $db->prepare("
        SELECT * FROM bank_transactions
        {$whereClause}
        ORDER BY date DESC
        LIMIT :limit OFFSET :offset
    ");
    // Bind params (PDO needs special handling for LIMIT/OFFSET)
    foreach ($params as $key => $val) {
        $stmt->bindValue($key, $val);
    }
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();
    $transactions = $stmt->fetchAll();

    // Cast amounts
    foreach ($transactions as &$t) {
        $t['amount'] = (float) $t['amount'];
    }

    // Income / expense stats for filtered set
    $amountFilter = empty($whereClause) ? 'WHERE' : $whereClause . ' AND';
    $incomeStmt = $db->prepare("SELECT COALESCE(SUM(amount), 0) FROM bank_transactions {$amountFilter} amount > 0");
    $expenseStmt = $db->prepare("SELECT COALESCE(SUM(amount), 0) FROM bank_transactions {$amountFilter} amount < 0");
    if (empty($whereClause)) {
        $incomeStmt->execute();
        $expenseStmt->execute();
    } else {
        $incomeStmt->execute($params);
        $expenseStmt->execute($params);
    }

    $income  = (float) $incomeStmt->fetchColumn();
    $expense = (float) $expenseStmt->fetchColumn();

    json_response([
        'transactions' => $transactions,
        'total'        => $total,
        'stats'        => [
            'income'  => round($income, 2),
            'expense' => round(abs($expense), 2),
        ],
    ]);
}

/**
 * GET /api/finance/transaction-stats
 * Monthly aggregation, top categories, balance trend (last 12 months).
 */
function handle_get_transaction_stats(): void
{
    requireAuth();
    finance_ensure_tables();
    $db = get_db();

    // Last 12 months boundary
    $twelveMonthsAgo = date('Y-m-d', strtotime('-12 months'));

    // Monthly income/expense aggregation
    $stmt = $db->prepare("
        SELECT
            strftime('%Y-%m', date) as month,
            SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as income,
            SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END) as expense
        FROM bank_transactions
        WHERE date >= :since
        GROUP BY month
        ORDER BY month
    ");
    $stmt->execute([':since' => $twelveMonthsAgo]);
    $monthly = [];
    while ($row = $stmt->fetch()) {
        $monthly[] = [
            'month'   => $row['month'],
            'income'  => round((float) $row['income'], 2),
            'expense' => round(abs((float) $row['expense']), 2),
            'net'     => round((float) $row['income'] + (float) $row['expense'], 2),
        ];
    }

    // Top categories by absolute sum
    $stmt = $db->prepare("
        SELECT category, SUM(ABS(amount)) as total, COUNT(*) as count
        FROM bank_transactions
        WHERE date >= :since
        GROUP BY category
        ORDER BY total DESC
    ");
    $stmt->execute([':since' => $twelveMonthsAgo]);
    $categoriesArr = [];
    while ($row = $stmt->fetch()) {
        $categoriesArr[] = [
            'category' => $row['category'],
            'total'    => round((float) $row['total'], 2),
            'count'    => (int) $row['count'],
        ];
    }

    // Balance trend (cumulative by month)
    $balanceTrend = [];
    $cumulative   = 0;
    foreach ($monthly as $m) {
        $cumulative += $m['net'];
        $balanceTrend[] = [
            'month'   => $m['month'],
            'balance' => round($cumulative, 2),
        ];
    }

    json_response([
        'monthly'       => $monthly,
        'categories'    => $categoriesArr,
        'balance_trend' => $balanceTrend,
    ]);
}


// ============================================================
//  HELPERS
// ============================================================

/**
 * Recalculate project.spent_eur from project_expenses.
 */
function finance_recalc_project_spent(PDO $db, string $projectId): void
{
    $stmt = $db->prepare("SELECT COALESCE(SUM(amount), 0) FROM project_expenses WHERE project_id = :pid");
    $stmt->execute([':pid' => $projectId]);
    $total = (float) $stmt->fetchColumn();

    $db->prepare("UPDATE projects SET spent_eur = :spent, updated_at = :now WHERE id = :id")
       ->execute([':spent' => $total, ':now' => now_iso(), ':id' => $projectId]);
}

/**
 * Recalculate project.revenue_eur from revenue_entries.
 */
function finance_recalc_project_revenue(PDO $db, string $projectId): void
{
    $stmt = $db->prepare("SELECT COALESCE(SUM(amount), 0) FROM revenue_entries WHERE project_id = :pid");
    $stmt->execute([':pid' => $projectId]);
    $total = (float) $stmt->fetchColumn();

    $db->prepare("UPDATE projects SET revenue_eur = :revenue, updated_at = :now WHERE id = :id")
       ->execute([':revenue' => $total, ':now' => now_iso(), ':id' => $projectId]);
}


// ============================================================
//  SEED DATA
// ============================================================

function finance_seed_data(string $adminId): void
{
    $db  = get_db();
    $now = now_iso();

    // Get project IDs for linking
    $projects = $db->query("SELECT id, title FROM projects")->fetchAll();
    $projectMap = [];
    foreach ($projects as $p) {
        $projectMap[$p['title']] = $p['id'];
    }

    // Set budgets on existing projects
    $budgets = [
        'DGD Portal Launch'          => 15000,
        'Partner-Netzwerk Ausbau'    => 25000,
        'Marketing Kampagne Q2'      => 20000,
        'Schadenfall-Automatisierung' => 35000,
        'Kundenportal v2'            => 40000,
    ];

    $budgetStmt = $db->prepare("UPDATE projects SET budget_eur = :budget WHERE id = :id");
    foreach ($budgets as $title => $budget) {
        if (isset($projectMap[$title])) {
            $budgetStmt->execute([':budget' => $budget, ':id' => $projectMap[$title]]);
        }
    }

    // Seed expenses
    $expenseStmt = $db->prepare("
        INSERT INTO project_expenses (id, project_id, date, description, amount, category, created_by, created_at)
        VALUES (:id, :project_id, :date, :description, :amount, :category, :created_by, :created_at)
    ");

    $expenses = [
        ['project' => 'DGD Portal Launch',          'date' => '2026-01-10', 'desc' => 'Server-Hosting Hetzner (3 Monate)',     'amount' => 89.70,   'cat' => 'infrastructure'],
        ['project' => 'DGD Portal Launch',          'date' => '2026-01-15', 'desc' => 'Domain dgd.digital (1 Jahr)',           'amount' => 35.00,   'cat' => 'infrastructure'],
        ['project' => 'DGD Portal Launch',          'date' => '2026-01-20', 'desc' => 'SSL-Zertifikat',                        'amount' => 0,       'cat' => 'infrastructure'],
        ['project' => 'DGD Portal Launch',          'date' => '2026-01-25', 'desc' => 'Freelancer Frontend-Design',            'amount' => 2500.00, 'cat' => 'personnel'],
        ['project' => 'Partner-Netzwerk Ausbau',    'date' => '2026-02-01', 'desc' => 'CRM-Tool Lizenz (Jahreslizenz)',        'amount' => 480.00,  'cat' => 'tools'],
        ['project' => 'Partner-Netzwerk Ausbau',    'date' => '2026-02-15', 'desc' => 'Partner-Onboarding Material Druck',     'amount' => 320.00,  'cat' => 'marketing'],
        ['project' => 'Partner-Netzwerk Ausbau',    'date' => '2026-03-01', 'desc' => 'Reisekosten Partnerbesuche',            'amount' => 780.00,  'cat' => 'other'],
        ['project' => 'Schadenfall-Automatisierung', 'date' => '2026-03-05', 'desc' => 'Claude API Credits',                   'amount' => 150.00,  'cat' => 'tools'],
        ['project' => 'Schadenfall-Automatisierung', 'date' => '2026-03-01', 'desc' => 'GPU Cloud (RTX A6000 Stunden)',        'amount' => 420.00,  'cat' => 'infrastructure'],
    ];

    foreach ($expenses as $e) {
        if (!isset($projectMap[$e['project']])) continue;
        $expenseStmt->execute([
            ':id'          => generate_uuid(),
            ':project_id'  => $projectMap[$e['project']],
            ':date'        => $e['date'],
            ':description' => $e['desc'],
            ':amount'      => $e['amount'],
            ':category'    => $e['cat'],
            ':created_by'  => $adminId,
            ':created_at'  => $now,
        ]);
    }

    // Seed revenue
    $revenueStmt = $db->prepare("
        INSERT INTO revenue_entries (id, date, description, amount, source, project_id, created_by, created_at)
        VALUES (:id, :date, :description, :amount, :source, :project_id, :created_by, :created_at)
    ");

    $revenues = [
        ['date' => '2026-01-15', 'desc' => 'Gutachten #1001-1015',          'amount' => 8400.00,  'source' => 'elbdesk', 'project' => 'Partner-Netzwerk Ausbau'],
        ['date' => '2026-01-31', 'desc' => 'Gutachten #1016-1032',          'amount' => 9200.00,  'source' => 'elbdesk', 'project' => 'Partner-Netzwerk Ausbau'],
        ['date' => '2026-02-15', 'desc' => 'Gutachten #1033-1055',          'amount' => 10900.00, 'source' => 'elbdesk', 'project' => 'Partner-Netzwerk Ausbau'],
        ['date' => '2026-02-28', 'desc' => 'Beratungshonorar Versicherung', 'amount' => 3500.00,  'source' => 'manual',  'project' => null],
        ['date' => '2026-03-05', 'desc' => 'Gutachten #1056-1070',          'amount' => 6500.00,  'source' => 'elbdesk', 'project' => 'Partner-Netzwerk Ausbau'],
    ];

    foreach ($revenues as $r) {
        $projId = $r['project'] && isset($projectMap[$r['project']]) ? $projectMap[$r['project']] : null;
        $revenueStmt->execute([
            ':id'          => generate_uuid(),
            ':date'        => $r['date'],
            ':description' => $r['desc'],
            ':amount'      => $r['amount'],
            ':source'      => $r['source'],
            ':project_id'  => $projId,
            ':created_by'  => $adminId,
            ':created_at'  => $now,
        ]);
    }

    // Recalculate spent/revenue on projects
    foreach ($projectMap as $pid) {
        finance_recalc_project_spent($db, $pid);
        finance_recalc_project_revenue($db, $pid);
    }
}
