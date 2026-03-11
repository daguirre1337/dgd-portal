<?php
/**
 * DGD Dashboard - CRUD Helper Utilities
 *
 * Shared patterns for building queries, partial updates, and response formatting.
 * Eliminates repeated boilerplate across handlers.
 */

/**
 * Build WHERE clause from query params.
 *
 * @param array $filters  ['column' => 'param_value', ...]
 * @return array ['clause' => 'WHERE ...', 'params' => [...]]
 */
function build_where_clause(array $filters, array $allowed_columns = []): array
{
    $where  = [];
    $params = [];
    foreach ($filters as $column => $value) {
        // Skip columns not in whitelist (when provided)
        if (!empty($allowed_columns) && !in_array($column, $allowed_columns, true)) {
            continue;
        }
        if ($value !== null && $value !== '') {
            $placeholder = ':' . str_replace('.', '_', $column);
            $where[]     = "{$column} = {$placeholder}";
            $params[$placeholder] = $value;
        }
    }
    $clause = count($where) > 0 ? 'WHERE ' . implode(' AND ', $where) : '';
    return ['clause' => $clause, 'params' => $params];
}

/**
 * Build a partial UPDATE from allowed fields.
 *
 * @param array  $body     Request body
 * @param array  $allowed  Allowed field names
 * @param array  $casts    Field => type ('int', 'float', 'bool')
 * @param string $id       Row ID
 * @return array ['sql_sets' => 'field=:field,...', 'params' => [...]] or null if empty
 */
function build_update(array $body, array $allowed, array $casts, string $id): ?array
{
    $sets   = [];
    $params = [':id' => $id, ':updated_at' => now_iso()];

    foreach ($allowed as $field) {
        if (array_key_exists($field, $body)) {
            $sets[]              = "{$field} = :{$field}";
            $val = $body[$field];
            if (isset($casts[$field])) {
                switch ($casts[$field]) {
                    case 'int':      $val = (int) $val; break;
                    case 'int_null': $val = $val !== null && $val !== '' ? (int) $val : null; break;
                    case 'float':    $val = (float) $val; break;
                    case 'float_null': $val = $val !== null && $val !== '' ? (float) $val : null; break;
                    case 'bool':     $val = (bool) $val ? 1 : 0; break;
                    default:         $val = trim((string) $val); break;
                }
            } else {
                $val = is_string($val) ? trim($val) : $val;
            }
            $params[":{$field}"] = $val;
        }
    }

    if (empty($sets)) {
        return null;
    }

    $sets[] = 'updated_at = :updated_at';
    return ['sql_sets' => implode(', ', $sets), 'params' => $params];
}

/**
 * Cast numeric fields in result rows.
 *
 * @param array $rows   Result rows
 * @param array $casts  Field => type ('int', 'float', 'bool')
 * @return array Modified rows
 */
function cast_rows(array $rows, array $casts): array
{
    foreach ($rows as &$row) {
        foreach ($casts as $field => $type) {
            if (!array_key_exists($field, $row)) continue;
            switch ($type) {
                case 'int':        $row[$field] = (int) $row[$field]; break;
                case 'int_null':   $row[$field] = $row[$field] !== null ? (int) $row[$field] : null; break;
                case 'float':      $row[$field] = (float) $row[$field]; break;
                case 'float_null': $row[$field] = $row[$field] !== null ? (float) $row[$field] : null; break;
                case 'bool':       $row[$field] = (bool) $row[$field]; break;
            }
        }
    }
    return $rows;
}

/**
 * Assert a record exists, or return 404.
 *
 * @param PDO    $db     Database connection
 * @param string $table  Table name (safe - never from user input)
 * @param string $id     Record ID
 * @param string $label  Human-readable label for error message
 * @return array The found row
 */
function require_exists(PDO $db, string $table, string $id, string $label = 'Record'): array
{
    $stmt = $db->prepare("SELECT * FROM {$table} WHERE id = :id");
    $stmt->execute([':id' => $id]);
    $row = $stmt->fetch();
    if (!$row) {
        json_error("{$label} not found", 404);
    }
    return $row;
}

/**
 * Group child rows by parent ID.
 * Used to resolve N+1 queries: fetch parents + children in two queries,
 * then attach children to parents in PHP.
 *
 * @param array  $children  Child rows from a JOIN or separate query
 * @param string $parentKey Column name that references the parent ID
 * @return array  [parentId => [child1, child2, ...], ...]
 */
function group_children(array $children, string $parentKey): array
{
    $grouped = [];
    foreach ($children as $child) {
        $pid = $child[$parentKey];
        unset($child[$parentKey]);
        $grouped[$pid][] = $child;
    }
    return $grouped;
}
