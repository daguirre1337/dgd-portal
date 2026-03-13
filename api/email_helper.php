<?php
/**
 * DGD Portal - Email Helper
 *
 * Sends HTML notification emails via PHP mail().
 * From: noreply@dgd.digital (Plesk mailbox)
 *
 * Usage:
 *   require_once __DIR__ . '/email_helper.php';
 *   send_notification_email('kontakt@dgd-direkt.de', 'Neue Anfrage', '<p>...</p>');
 */

define('MAIL_FROM_ADDRESS', 'noreply@dgd.digital');
define('MAIL_FROM_NAME', 'DGD Digital Portal');
define('MAIL_NOTIFY_ADDRESS', 'kontakt@dgd-direkt.de');

/**
 * Send an HTML notification email.
 *
 * @param string $to        Recipient email
 * @param string $subject   Email subject
 * @param string $body_html HTML body content (will be wrapped in template)
 * @return bool             True if mail() succeeded
 */
function send_notification_email(string $to, string $subject, string $body_html): bool
{
    $full_html = build_email_template($subject, $body_html);

    $headers  = "From: " . MAIL_FROM_NAME . " <" . MAIL_FROM_ADDRESS . ">\r\n";
    $headers .= "Reply-To: " . MAIL_NOTIFY_ADDRESS . "\r\n";
    $headers .= "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
    $headers .= "X-Mailer: DGD-Portal/1.0\r\n";

    $result = @mail($to, $subject, $full_html, $headers);

    if (!$result) {
        error_log("DGD Email Error: Failed to send email to {$to} - Subject: {$subject}");
    }

    return $result;
}

/**
 * Build HTML email template with DGD branding.
 */
function build_email_template(string $subject, string $body_html): string
{
    $year = date('Y');
    $logo_url = 'https://dgd.digital/img/dgd-logo.png';
    $falcon_url = 'https://dgd.digital/img/dgd-falcon.png';

    return <<<HTML
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{$subject}</title>
</head>
<body style="margin:0; padding:0; background-color:#F4F4F8; font-family:Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F4F4F8; padding:32px 16px;">
        <tr>
            <td align="center">
                <!-- Outer container -->
                <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 24px rgba(26,58,92,0.08);">

                    <!-- Header with gradient -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #1a3a5c 0%, #0f2440 100%); padding:0;">
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <!-- Gold top accent bar -->
                                <tr>
                                    <td style="height:4px; background: linear-gradient(90deg, #D4A843 0%, #b8912e 50%, #D4A843 100%);"></td>
                                </tr>
                                <!-- Logo row -->
                                <tr>
                                    <td style="padding:28px 32px 12px; text-align:center;">
                                        <img src="{$logo_url}" alt="DGD" width="180" style="display:inline-block; max-width:180px; height:auto;" />
                                    </td>
                                </tr>
                                <!-- Tagline -->
                                <tr>
                                    <td style="padding:0 32px 24px; text-align:center;">
                                        <p style="margin:0; font-size:13px; color:#D4A843; letter-spacing:2px; font-weight:600; text-transform:uppercase;">Deutscher Gutachter Dienst</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Subject bar -->
                    <tr>
                        <td style="background-color:#f8f9fa; padding:14px 32px; border-bottom:1px solid #e9ecef;">
                            <p style="margin:0; font-size:14px; color:#1a3a5c; font-weight:600;">
                                {$subject}
                            </p>
                        </td>
                    </tr>

                    <!-- Body -->
                    <tr>
                        <td style="padding:32px;">
                            {$body_html}
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color:#1a3a5c; padding:24px 32px;">
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td style="text-align:center; padding-bottom:12px;">
                                        <img src="{$falcon_url}" alt="" width="28" height="28" style="display:inline-block; opacity:0.6;" />
                                    </td>
                                </tr>
                                <tr>
                                    <td style="text-align:center;">
                                        <p style="margin:0 0 6px; font-size:12px; color:rgba(255,255,255,0.7);">
                                            Diese E-Mail wurde automatisch vom DGD Portal gesendet.
                                        </p>
                                        <p style="margin:0 0 6px; font-size:12px; color:rgba(255,255,255,0.5);">
                                            &copy; {$year} DGD &ndash; Deutscher Gutachter Dienst
                                        </p>
                                        <p style="margin:0;">
                                            <a href="https://dgd.digital" style="color:#D4A843; font-size:12px; text-decoration:none;">dgd.digital</a>
                                            <span style="color:rgba(255,255,255,0.3); margin:0 8px;">&middot;</span>
                                            <a href="https://dgd-direkt.de" style="color:#D4A843; font-size:12px; text-decoration:none;">dgd-direkt.de</a>
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                </table>

                <!-- Below-footer note -->
                <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;">
                    <tr>
                        <td style="padding:16px 32px; text-align:center;">
                            <p style="margin:0; font-size:11px; color:#adb5bd;">
                                DGD &ndash; Ihr unabh&auml;ngiger Kfz-Gutachter. Kostenlos f&uuml;r Gesch&auml;digte.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
HTML;
}

/**
 * Build email body for a new damage report (Schadenfall).
 */
function build_case_email_body(array $data): string
{
    $name = htmlspecialchars($data['name'] ?? '');
    $email = htmlspecialchars($data['email'] ?? '');
    $phone = htmlspecialchars($data['phone'] ?? '');
    $ref = htmlspecialchars($data['reference_id'] ?? '');
    $date = htmlspecialchars($data['accident_date'] ?? 'Nicht angegeben');
    $location = htmlspecialchars($data['accident_location'] ?? 'Nicht angegeben');
    $description = nl2br(htmlspecialchars($data['accident_description'] ?? 'Keine Beschreibung'));
    $plate = htmlspecialchars($data['license_plate'] ?? '-');
    $brand = htmlspecialchars($data['vehicle_brand'] ?? '-');
    $model = htmlspecialchars($data['vehicle_model'] ?? '-');
    $insurance = htmlspecialchars($data['insurance_opponent'] ?? '-');
    $claim = htmlspecialchars($data['claim_number'] ?? '-');

    return <<<HTML
<h2 style="color:#1a3a5c; margin:0 0 16px; font-size:20px;">Neue Schadensmeldung</h2>
<p style="color:#333; margin:0 0 8px;">Referenz-Nr.: <strong style="color:#D4A843;">{$ref}</strong></p>

<table width="100%" cellpadding="8" cellspacing="0" style="margin:16px 0; border-collapse:collapse;">
    <tr style="background-color:#f8f9fa;">
        <td style="border:1px solid #dee2e6; font-weight:bold; width:40%; color:#495057;">Name</td>
        <td style="border:1px solid #dee2e6; color:#333;">{$name}</td>
    </tr>
    <tr>
        <td style="border:1px solid #dee2e6; font-weight:bold; color:#495057;">E-Mail</td>
        <td style="border:1px solid #dee2e6; color:#333;"><a href="mailto:{$email}" style="color:#1a3a5c;">{$email}</a></td>
    </tr>
    <tr style="background-color:#f8f9fa;">
        <td style="border:1px solid #dee2e6; font-weight:bold; color:#495057;">Telefon</td>
        <td style="border:1px solid #dee2e6; color:#333;">{$phone}</td>
    </tr>
    <tr>
        <td style="border:1px solid #dee2e6; font-weight:bold; color:#495057;">Unfalldatum</td>
        <td style="border:1px solid #dee2e6; color:#333;">{$date}</td>
    </tr>
    <tr style="background-color:#f8f9fa;">
        <td style="border:1px solid #dee2e6; font-weight:bold; color:#495057;">Unfallort</td>
        <td style="border:1px solid #dee2e6; color:#333;">{$location}</td>
    </tr>
    <tr>
        <td style="border:1px solid #dee2e6; font-weight:bold; color:#495057;">Kennzeichen</td>
        <td style="border:1px solid #dee2e6; color:#333;">{$plate}</td>
    </tr>
    <tr style="background-color:#f8f9fa;">
        <td style="border:1px solid #dee2e6; font-weight:bold; color:#495057;">Fahrzeug</td>
        <td style="border:1px solid #dee2e6; color:#333;">{$brand} {$model}</td>
    </tr>
    <tr>
        <td style="border:1px solid #dee2e6; font-weight:bold; color:#495057;">Versicherung Gegenseite</td>
        <td style="border:1px solid #dee2e6; color:#333;">{$insurance}</td>
    </tr>
    <tr style="background-color:#f8f9fa;">
        <td style="border:1px solid #dee2e6; font-weight:bold; color:#495057;">Schadennummer</td>
        <td style="border:1px solid #dee2e6; color:#333;">{$claim}</td>
    </tr>
</table>

<h3 style="color:#1a3a5c; margin:16px 0 8px; font-size:16px;">Beschreibung</h3>
<div style="background-color:#f8f9fa; padding:12px 16px; border-radius:4px; border-left:4px solid #D4A843; color:#333;">
    {$description}
</div>
HTML;
}

/**
 * Build email body for a new partner application (B2B).
 */
function build_partner_email_body(array $data, string $type = 'partner'): string
{
    $name = htmlspecialchars($data['name'] ?? '');
    $email = htmlspecialchars($data['email'] ?? '');
    $phone = htmlspecialchars($data['phone'] ?? '');
    $company = htmlspecialchars($data['company'] ?? '-');

    $title = $type === 'rente'
        ? 'Neuer Empfehlungspartner (Rente)'
        : 'Neue Partner-Bewerbung';

    $rows = '';

    if ($type === 'partner') {
        $specialty = htmlspecialchars($data['specialty'] ?? '-');
        $plz = htmlspecialchars($data['plz'] ?? '-');
        $city = htmlspecialchars($data['city'] ?? '-');
        $experience = htmlspecialchars($data['experience_years'] ?? '-');
        $message = nl2br(htmlspecialchars($data['message'] ?? ''));

        $rows = <<<HTML
    <tr style="background-color:#f8f9fa;">
        <td style="border:1px solid #dee2e6; font-weight:bold; color:#495057;">Fachgebiet</td>
        <td style="border:1px solid #dee2e6; color:#333;">{$specialty}</td>
    </tr>
    <tr>
        <td style="border:1px solid #dee2e6; font-weight:bold; color:#495057;">PLZ / Stadt</td>
        <td style="border:1px solid #dee2e6; color:#333;">{$plz} {$city}</td>
    </tr>
    <tr style="background-color:#f8f9fa;">
        <td style="border:1px solid #dee2e6; font-weight:bold; color:#495057;">Erfahrung (Jahre)</td>
        <td style="border:1px solid #dee2e6; color:#333;">{$experience}</td>
    </tr>
HTML;
    } else {
        $plz = htmlspecialchars($data['plz'] ?? '-');
        $experience = htmlspecialchars($data['experience_years'] ?? '-');
        $retirement = htmlspecialchars($data['retirement_date'] ?? '-');
        $message = nl2br(htmlspecialchars($data['message'] ?? ''));

        $rows = <<<HTML
    <tr style="background-color:#f8f9fa;">
        <td style="border:1px solid #dee2e6; font-weight:bold; color:#495057;">PLZ</td>
        <td style="border:1px solid #dee2e6; color:#333;">{$plz}</td>
    </tr>
    <tr>
        <td style="border:1px solid #dee2e6; font-weight:bold; color:#495057;">Erfahrung (Jahre)</td>
        <td style="border:1px solid #dee2e6; color:#333;">{$experience}</td>
    </tr>
    <tr style="background-color:#f8f9fa;">
        <td style="border:1px solid #dee2e6; font-weight:bold; color:#495057;">Renteneintritt</td>
        <td style="border:1px solid #dee2e6; color:#333;">{$retirement}</td>
    </tr>
HTML;
    }

    $message_section = '';
    if (!empty(trim($data['message'] ?? ''))) {
        $message = nl2br(htmlspecialchars($data['message']));
        $message_section = <<<HTML
<h3 style="color:#1a3a5c; margin:16px 0 8px; font-size:16px;">Nachricht</h3>
<div style="background-color:#f8f9fa; padding:12px 16px; border-radius:4px; border-left:4px solid #D4A843; color:#333;">
    {$message}
</div>
HTML;
    }

    return <<<HTML
<h2 style="color:#1a3a5c; margin:0 0 16px; font-size:20px;">{$title}</h2>

<table width="100%" cellpadding="8" cellspacing="0" style="margin:16px 0; border-collapse:collapse;">
    <tr>
        <td style="border:1px solid #dee2e6; font-weight:bold; width:40%; color:#495057;">Name</td>
        <td style="border:1px solid #dee2e6; color:#333;">{$name}</td>
    </tr>
    <tr style="background-color:#f8f9fa;">
        <td style="border:1px solid #dee2e6; font-weight:bold; color:#495057;">Unternehmen</td>
        <td style="border:1px solid #dee2e6; color:#333;">{$company}</td>
    </tr>
    <tr>
        <td style="border:1px solid #dee2e6; font-weight:bold; color:#495057;">E-Mail</td>
        <td style="border:1px solid #dee2e6; color:#333;"><a href="mailto:{$email}" style="color:#1a3a5c;">{$email}</a></td>
    </tr>
    <tr style="background-color:#f8f9fa;">
        <td style="border:1px solid #dee2e6; font-weight:bold; color:#495057;">Telefon</td>
        <td style="border:1px solid #dee2e6; color:#333;">{$phone}</td>
    </tr>
    {$rows}
</table>

{$message_section}
HTML;
}
