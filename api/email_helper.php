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
    return <<<HTML
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{$subject}</title>
</head>
<body style="margin:0; padding:0; background-color:#f5f5f5; font-family:Arial, Helvetica, sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5; padding:20px 0;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="background-color:#1A365D; padding:24px 32px; text-align:center;">
                            <h1 style="color:#D4A843; margin:0; font-size:24px; font-weight:bold;">DGD Digital</h1>
                            <p style="color:#ffffff; margin:4px 0 0; font-size:13px; opacity:0.8;">Deutscher Gutachter Dienst</p>
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
                        <td style="background-color:#f8f9fa; padding:20px 32px; border-top:1px solid #e9ecef;">
                            <p style="margin:0; font-size:12px; color:#6c757d; text-align:center;">
                                Diese E-Mail wurde automatisch vom DGD Portal gesendet.<br>
                                &copy; {$year} DGD Digital &middot; <a href="https://dgd.digital" style="color:#1A365D;">dgd.digital</a>
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
<h2 style="color:#1A365D; margin:0 0 16px; font-size:20px;">Neue Schadensmeldung</h2>
<p style="color:#333; margin:0 0 8px;">Referenz-Nr.: <strong style="color:#D4A843;">{$ref}</strong></p>

<table width="100%" cellpadding="8" cellspacing="0" style="margin:16px 0; border-collapse:collapse;">
    <tr style="background-color:#f8f9fa;">
        <td style="border:1px solid #dee2e6; font-weight:bold; width:40%; color:#495057;">Name</td>
        <td style="border:1px solid #dee2e6; color:#333;">{$name}</td>
    </tr>
    <tr>
        <td style="border:1px solid #dee2e6; font-weight:bold; color:#495057;">E-Mail</td>
        <td style="border:1px solid #dee2e6; color:#333;"><a href="mailto:{$email}" style="color:#1A365D;">{$email}</a></td>
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

<h3 style="color:#1A365D; margin:16px 0 8px; font-size:16px;">Beschreibung</h3>
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
<h3 style="color:#1A365D; margin:16px 0 8px; font-size:16px;">Nachricht</h3>
<div style="background-color:#f8f9fa; padding:12px 16px; border-radius:4px; border-left:4px solid #D4A843; color:#333;">
    {$message}
</div>
HTML;
    }

    return <<<HTML
<h2 style="color:#1A365D; margin:0 0 16px; font-size:20px;">{$title}</h2>

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
        <td style="border:1px solid #dee2e6; color:#333;"><a href="mailto:{$email}" style="color:#1A365D;">{$email}</a></td>
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
