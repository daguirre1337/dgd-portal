<?php
/**
 * DGD Portal - GitHub Auto-Deploy Webhook
 *
 * Empfaengt GitHub Push-Events und fuehrt automatisch git pull aus.
 * Nur der master-Branch wird deployed, alle anderen werden ignoriert.
 *
 * SETUP:
 * 1. Auf GitHub: Settings -> Webhooks -> Add webhook
 *    URL: https://dgd.digital/api/webhook.php
 *    Content type: application/json
 *    Secret: (gleicher Wert wie WEBHOOK_SECRET unten / Environment Variable)
 *    Events: Just the push event
 * 2. Fertig! Jeder Push auf master deployed automatisch.
 *
 * FALLBACK (falls git pull auf Plesk Shared Hosting nicht funktioniert):
 * - Das Script schreibt eine Touch-Datei (data/.deploy_trigger)
 * - Ein Cron-Job prueft alle 1-2 Minuten ob die Datei existiert:
 *   * * * * * [ -f /path/to/data/.deploy_trigger ] && cd /path/to/repo && git pull origin master && rm /path/to/data/.deploy_trigger
 * - Alternativ: Plesk Git-Deployment manuell oder per Plesk API triggern
 *
 * PHP 7.3+ kompatibel.
 *
 * @author  DGD Digital
 * @version 1.0.0
 */

// ============================================================
//  CONFIGURATION
// ============================================================

// Webhook-Secret (muss identisch sein mit dem auf GitHub konfigurierten Secret)
// Bevorzugt aus Environment Variable lesen, Fallback auf Default
$WEBHOOK_SECRET = getenv('WEBHOOK_SECRET');
if ($WEBHOOK_SECRET === false || $WEBHOOK_SECRET === '') {
    $WEBHOOK_SECRET = 'dgd-deploy-2026';
}

// Branch der deployed werden soll
$DEPLOY_BRANCH = 'master';

// Repository-Pfad auf dem Server (Verzeichnis in dem .git liegt)
// Wird automatisch ermittelt: ein Verzeichnis ueber /api/
$REPO_PATH = realpath(__DIR__ . '/..');

// Log-Datei
$LOG_FILE = __DIR__ . '/../data/webhook.log';

// Rate-Limiting: Mindestabstand zwischen Deployments in Sekunden
$RATE_LIMIT_SECONDS = 10;

// Rate-Limit State-Datei
$RATE_LIMIT_FILE = __DIR__ . '/../data/.webhook_last_deploy';

// Deploy-Trigger-Datei (Fallback fuer Shared Hosting)
$DEPLOY_TRIGGER_FILE = __DIR__ . '/../data/.deploy_trigger';

// Maximale Log-Datei-Groesse in Bytes (1 MB)
$MAX_LOG_SIZE = 1048576;

// ============================================================
//  HELPER FUNCTIONS
// ============================================================

/**
 * Schreibt eine Log-Zeile in die Webhook-Log-Datei.
 *
 * @param string $message Log-Nachricht
 * @param string $level   Log-Level (INFO, WARN, ERROR, SUCCESS)
 * @return void
 */
function webhook_log($message, $level = 'INFO')
{
    global $LOG_FILE, $MAX_LOG_SIZE;

    $log_dir = dirname($LOG_FILE);
    if (!is_dir($log_dir)) {
        mkdir($log_dir, 0755, true);
    }

    // Log-Rotation: wenn Datei zu gross, alte Eintraege abschneiden
    if (file_exists($LOG_FILE) && filesize($LOG_FILE) > $MAX_LOG_SIZE) {
        $lines = file($LOG_FILE);
        if ($lines !== false && count($lines) > 100) {
            // Behalte die letzten 50 Zeilen
            $lines = array_slice($lines, -50);
            file_put_contents($LOG_FILE, implode('', $lines), LOCK_EX);
        }
    }

    $timestamp = date('Y-m-d H:i:s');
    $ip = get_client_ip();
    $line = sprintf("[%s] [%s] [%s] %s\n", $timestamp, $level, $ip, $message);

    file_put_contents($LOG_FILE, $line, FILE_APPEND | LOCK_EX);
}

/**
 * Ermittelt die Client-IP (unterstuetzt Reverse Proxies).
 *
 * @return string
 */
function get_client_ip()
{
    // Cloudflare
    if (!empty($_SERVER['HTTP_CF_CONNECTING_IP'])) {
        return $_SERVER['HTTP_CF_CONNECTING_IP'];
    }
    // Standard Proxy
    if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $ips = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
        return trim($ips[0]);
    }
    // Direct
    return isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : 'unknown';
}

/**
 * Sendet eine JSON-Antwort und beendet das Script.
 *
 * @param array $data    Response-Daten
 * @param int   $status  HTTP Status-Code
 * @return void
 */
function webhook_response($data, $status = 200)
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/**
 * Sendet eine Fehler-Antwort, loggt den Fehler und beendet das Script.
 *
 * @param string $message Fehlermeldung
 * @param int    $status  HTTP Status-Code
 * @return void
 */
function webhook_error($message, $status = 400)
{
    webhook_log($message, 'ERROR');
    webhook_response(['error' => true, 'message' => $message], $status);
}

// ============================================================
//  MAIN WEBHOOK HANDLER
// ============================================================

// --- Nur POST-Requests erlauben ---
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    // GET-Requests bekommen eine einfache Status-Seite (kein Fehler-Logging)
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        webhook_response([
            'status'  => 'ok',
            'service' => 'DGD Portal Auto-Deploy Webhook',
            'hint'    => 'Send a POST request from GitHub to trigger deployment.',
        ]);
    }
    webhook_error('Method not allowed. Only POST requests accepted.', 405);
}

// --- Rate-Limiting pruefen ---
if (file_exists($RATE_LIMIT_FILE)) {
    $last_deploy = (int) file_get_contents($RATE_LIMIT_FILE);
    $elapsed = time() - $last_deploy;
    if ($elapsed < $RATE_LIMIT_SECONDS) {
        $wait = $RATE_LIMIT_SECONDS - $elapsed;
        webhook_log("Rate-limited. Last deploy {$elapsed}s ago, must wait {$wait}s more.", 'WARN');
        webhook_response([
            'error'   => true,
            'message' => "Rate limited. Please wait {$wait} seconds.",
        ], 429);
    }
}

// --- Payload lesen ---
$raw_payload = file_get_contents('php://input');
if (empty($raw_payload)) {
    webhook_error('Empty payload received.', 400);
}

// --- GitHub-Signatur verifizieren (HMAC-SHA256) ---
$signature_header = isset($_SERVER['HTTP_X_HUB_SIGNATURE_256'])
    ? $_SERVER['HTTP_X_HUB_SIGNATURE_256']
    : '';

if (empty($signature_header)) {
    webhook_error('Missing X-Hub-Signature-256 header. Unauthorized.', 401);
}

// Signatur-Format: "sha256=<hex>"
$expected_signature = 'sha256=' . hash_hmac('sha256', $raw_payload, $WEBHOOK_SECRET);

// Timing-safe Vergleich (verhindert Timing-Attacks)
if (!hash_equals($expected_signature, $signature_header)) {
    webhook_log("Signature mismatch! Expected: {$expected_signature}, Got: {$signature_header}", 'ERROR');
    webhook_error('Invalid signature. Unauthorized.', 403);
}

// --- Payload parsen ---
$payload = json_decode($raw_payload, true);
if ($payload === null) {
    webhook_error('Invalid JSON payload.', 400);
}

// --- Event-Typ pruefen ---
$event = isset($_SERVER['HTTP_X_GITHUB_EVENT']) ? $_SERVER['HTTP_X_GITHUB_EVENT'] : 'unknown';
webhook_log("Received GitHub event: {$event}");

if ($event === 'ping') {
    // GitHub sendet einen Ping beim Erstellen des Webhooks
    $zen = isset($payload['zen']) ? $payload['zen'] : 'pong';
    webhook_log("Ping received: {$zen}", 'SUCCESS');
    webhook_response([
        'success' => true,
        'message' => 'Webhook configured successfully!',
        'zen'     => $zen,
    ]);
}

if ($event !== 'push') {
    webhook_log("Ignoring non-push event: {$event}", 'INFO');
    webhook_response([
        'success' => true,
        'message' => "Event '{$event}' ignored. Only push events trigger deployment.",
    ]);
}

// --- Branch pruefen ---
$ref = isset($payload['ref']) ? $payload['ref'] : '';
$branch = str_replace('refs/heads/', '', $ref);

if ($branch !== $DEPLOY_BRANCH) {
    webhook_log("Push to branch '{$branch}' ignored (only '{$DEPLOY_BRANCH}' triggers deploy).", 'INFO');
    webhook_response([
        'success' => true,
        'message' => "Push to '{$branch}' ignored. Only '{$DEPLOY_BRANCH}' triggers deployment.",
        'branch'  => $branch,
    ]);
}

// --- Commit-Info loggen ---
$pusher = isset($payload['pusher']['name']) ? $payload['pusher']['name'] : 'unknown';
$commit_count = isset($payload['commits']) ? count($payload['commits']) : 0;
$head_commit_msg = isset($payload['head_commit']['message'])
    ? substr($payload['head_commit']['message'], 0, 100)
    : 'no message';

webhook_log("Deploy triggered by {$pusher}: {$commit_count} commit(s), latest: \"{$head_commit_msg}\"", 'INFO');

// --- Repository-Pfad validieren ---
if (empty($REPO_PATH) || !is_dir($REPO_PATH)) {
    webhook_error("Repository path not found: {$REPO_PATH}", 500);
}

// Hinweis: Auf Plesk Shared Hosting liegt .git NICHT in httpdocs.
// Plesk kopiert Dateien aus einem internen Repo nach httpdocs.
// Daher kein .git Check - execute_deploy() hat Fallback-Methoden.

// --- Deployment ausfuehren ---
$deploy_result = execute_deploy($REPO_PATH, $DEPLOY_BRANCH);

// --- Rate-Limit Timestamp aktualisieren ---
$rate_dir = dirname($RATE_LIMIT_FILE);
if (!is_dir($rate_dir)) {
    mkdir($rate_dir, 0755, true);
}
file_put_contents($RATE_LIMIT_FILE, (string) time(), LOCK_EX);

// --- Ergebnis zurueckgeben ---
if ($deploy_result['success']) {
    webhook_log("Deploy successful! Output: " . substr($deploy_result['output'], 0, 500), 'SUCCESS');
    webhook_response([
        'success' => true,
        'message' => 'Deployment successful.',
        'branch'  => $branch,
        'pusher'  => $pusher,
        'commits' => $commit_count,
        'output'  => $deploy_result['output'],
        'method'  => $deploy_result['method'],
    ]);
} else {
    webhook_log("Deploy FAILED! Error: " . $deploy_result['output'], 'ERROR');
    webhook_response([
        'error'   => true,
        'message' => 'Deployment failed.',
        'output'  => $deploy_result['output'],
        'method'  => $deploy_result['method'],
        'hint'    => $deploy_result['hint'],
    ], 500);
}


// ============================================================
//  DEPLOYMENT EXECUTION
// ============================================================

/**
 * Fuehrt das Deployment aus.
 *
 * Versucht zunaechst git pull. Falls das fehlschlaegt (z.B. auf Shared Hosting),
 * wird eine Touch-Datei geschrieben die ein Cron-Job abarbeiten kann.
 *
 * @param string $repo_path Absoluter Pfad zum Repository
 * @param string $branch    Branch-Name
 * @return array ['success' => bool, 'output' => string, 'method' => string, 'hint' => string]
 */
function execute_deploy($repo_path, $branch)
{
    global $DEPLOY_TRIGGER_FILE;

    // --- Methode 1: Plesk Git-Repo Pfade durchsuchen ---
    // Auf Plesk liegt das echte Git-Repo woanders als httpdocs
    $plesk_git_paths = array();

    // Versuche domain-spezifische Pfade zu finden
    $vhost_path = realpath($repo_path . '/..');
    if ($vhost_path) {
        $plesk_git_paths[] = $vhost_path . '/git/dgd-portal.git';
        $plesk_git_paths[] = $vhost_path . '/repositories/dgd-portal';
        $plesk_git_paths[] = $vhost_path . '/.git-hosting/dgd-portal';
    }

    $git_binary = find_git_binary();

    // Versuche git pull in bekannten Plesk-Repo-Pfaden
    if ($git_binary !== null) {
        // Zuerst: httpdocs selbst (falls es doch ein git repo ist)
        $git_dir = $repo_path . DIRECTORY_SEPARATOR . '.git';
        if (is_dir($git_dir) || is_file($git_dir)) {
            array_unshift($plesk_git_paths, $repo_path);
        }

        foreach ($plesk_git_paths as $try_path) {
            if (!is_dir($try_path)) {
                continue;
            }
            $cmd = sprintf(
                'cd %s && %s pull origin %s 2>&1',
                escapeshellarg($try_path),
                escapeshellarg($git_binary),
                escapeshellarg($branch)
            );

            $output_lines = array();
            $return_code = -1;
            @exec($cmd, $output_lines, $return_code);
            $output = implode("\n", $output_lines);

            if ($return_code === 0) {
                return array(
                    'success' => true,
                    'output'  => "Pulled from {$try_path}: {$output}",
                    'method'  => 'git_pull',
                    'hint'    => '',
                );
            }
            webhook_log("git pull in {$try_path} failed (exit {$return_code}): {$output}", 'WARN');
        }

        // Fallback: git pull in httpdocs selbst versuchen
        if (!in_array($repo_path, $plesk_git_paths)) {
            $cmd = sprintf(
                'cd %s && %s pull origin %s 2>&1',
                escapeshellarg($repo_path),
                escapeshellarg($git_binary),
                escapeshellarg($branch)
            );
            $output_lines = array();
            $return_code = -1;
            @exec($cmd, $output_lines, $return_code);
            $output = implode("\n", $output_lines);

            if ($return_code === 0) {
                return array(
                    'success' => true,
                    'output'  => $output,
                    'method'  => 'git_pull',
                    'hint'    => '',
                );
            }
            webhook_log("git pull in httpdocs failed (exit {$return_code}): {$output}", 'WARN');
        }
    } else {
        webhook_log("git binary not found on server.", 'WARN');
    }

    // --- Methode 2: Plesk CLI (falls verfuegbar) ---
    $plesk_cmds = array(
        'plesk bin site --update-git-repo dgd.digital 2>&1',
        '/usr/sbin/plesk bin site --update-git-repo dgd.digital 2>&1',
    );

    foreach ($plesk_cmds as $pcmd) {
        $output_lines = array();
        $return_code = -1;
        @exec($pcmd, $output_lines, $return_code);
        if ($return_code === 0) {
            $output = implode("\n", $output_lines);
            return array(
                'success' => true,
                'output'  => "Plesk CLI deploy: {$output}",
                'method'  => 'plesk_cli',
                'hint'    => '',
            );
        }
    }

    // --- Methode 3: Fallback - Touch-Datei fuer Cron-Job ---
    $trigger_dir = dirname($DEPLOY_TRIGGER_FILE);
    if (!is_dir($trigger_dir)) {
        mkdir($trigger_dir, 0755, true);
    }

    $trigger_data = json_encode(array(
        'branch'    => $branch,
        'timestamp' => date('Y-m-d H:i:s'),
        'repo_path' => $repo_path,
    ), JSON_UNESCAPED_SLASHES);

    $write_ok = file_put_contents($DEPLOY_TRIGGER_FILE, $trigger_data, LOCK_EX);

    if ($write_ok !== false) {
        $hint = "git pull fehlgeschlagen oder nicht verfuegbar. "
              . "Deploy-Trigger geschrieben: {$DEPLOY_TRIGGER_FILE}. "
              . "Richte einen Cron-Job ein: "
              . "* * * * * [ -f {$DEPLOY_TRIGGER_FILE} ] "
              . "&& cd {$repo_path} && git pull origin {$branch} "
              . "&& rm {$DEPLOY_TRIGGER_FILE}";

        return array(
            'success' => true,
            'output'  => "Deploy-Trigger file written. Waiting for cron job.",
            'method'  => 'trigger_file',
            'hint'    => $hint,
        );
    }

    // --- Alles fehlgeschlagen ---
    return array(
        'success' => false,
        'output'  => "Neither git pull nor trigger-file fallback worked.",
        'method'  => 'none',
        'hint'    => "Pruefe: (1) git auf dem Server installiert? "
                   . "(2) Web-User hat Schreibrechte auf {$trigger_dir}? "
                   . "(3) Repository-Pfad korrekt: {$repo_path}?",
    );
}

/**
 * Sucht die git-Binary auf dem Server.
 *
 * @return string|null Pfad zur git-Binary oder null wenn nicht gefunden
 */
function find_git_binary()
{
    // Standard-Pfade pruefen
    $candidates = array(
        '/usr/bin/git',
        '/usr/local/bin/git',
        '/opt/plesk/git/bin/git',
        'git',  // Falls im PATH
    );

    foreach ($candidates as $candidate) {
        // Pruefen ob ausfuehrbar
        $check_cmd = sprintf('which %s 2>/dev/null || command -v %s 2>/dev/null',
            escapeshellarg($candidate),
            escapeshellarg($candidate)
        );
        $result = @exec($check_cmd, $output, $return_code);

        if ($return_code === 0 && !empty($result)) {
            return trim($result);
        }
    }

    // Letzter Versuch: einfach "git" verwenden und schauen ob es klappt
    $version_output = array();
    @exec('git --version 2>&1', $version_output, $return_code);
    if ($return_code === 0) {
        return 'git';
    }

    return null;
}
