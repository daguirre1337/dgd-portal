<?php
/**
 * One-time cleanup: remove duplicate Trello contacts.
 * Keeps the newest entry (highest id) per trello_card_id.
 * Run via: https://dgd.digital/dashboard/api/cleanup_dupes.php?key=dGdkLWNsZWFudXAtMjAyNg
 */

if (($_GET['key'] ?? '') !== 'dGdkLWNsZWFudXAtMjAyNg') {
    http_response_code(403);
    die(json_encode(['error' => 'Forbidden']));
}

require_once __DIR__ . '/config.php';

header('Content-Type: application/json');

$db = get_db();

$total_before = $db->query("SELECT COUNT(*) FROM crm_contacts WHERE source='trello'")->fetchColumn();

$dupes = $db->query("
    SELECT trello_card_id, COUNT(*) as cnt
    FROM crm_contacts
    WHERE source='trello' AND trello_card_id != '' AND trello_card_id IS NOT NULL
    GROUP BY trello_card_id
    HAVING cnt > 1
")->fetchAll(PDO::FETCH_ASSOC);

$dupe_count = count($dupes);

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

$total_after = $db->query("SELECT COUNT(*) FROM crm_contacts WHERE source='trello'")->fetchColumn();

echo json_encode([
    'success' => true,
    'total_before' => (int)$total_before,
    'duplicate_groups' => $dupe_count,
    'deleted' => $deleted,
    'total_after' => (int)$total_after,
], JSON_PRETTY_PRINT);
