import nodemailer from 'nodemailer';

// Outbound email (FR-008: notifications by email AND in-system alert).
// Delivery uses the departmental SMTP relay configured via environment:
//   SMTP_HOST, SMTP_PORT (default 587), SMTP_USER, SMTP_PASS, SMTP_FROM
// When SMTP_HOST is not set (local development) sends are logged and skipped,
// so the rest of the notification flow keeps working without a mail server.
//
// APP_BASE_URL — public origin of the SIMS portal, used to turn an in-app deep
// link (e.g. `#/case/<id>`) into an absolute URL for the email call-to-action
// button. Change this one value to re-point every email link (e.g. to the
// mobile application) without touching code. Defaults to the local Vite origin.
// EMAIL_LOGO_URL — optional override for the header logo; defaults to the
// portal's own /logo_with_name.png served from APP_BASE_URL.
//
// MAIL_REDIRECT_TO — UAT/testing safety net. When set, EVERY outbound message is
// delivered to that single address instead of the real recipient, with the intended
// recipient preserved in the subject (e.g. "[→ real@dlrrd.gov.za]") so routing can
// still be verified. This MUST be left unset in production, where mail goes to the
// real officers.

let transporter: nodemailer.Transporter | null = null;

const getTransporter = (): nodemailer.Transporter | null => {
  if (!process.env.SMTP_HOST) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_PORT === '465',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' }
        : undefined
    });
  }
  return transporter;
};

// ── Link + asset helpers ────────────────────────────────────────────────────

/** Portal origin, no trailing slash. Single source of truth for every email link. */
export const appBaseUrl = (): string =>
  (process.env.APP_BASE_URL || 'http://localhost:5173').replace(/\/+$/, '');

const logoUrl = (): string => process.env.EMAIL_LOGO_URL || `${appBaseUrl()}/logo_with_name.png`;

/**
 * Turn an in-app link (a hash route such as `#/case/<id>`, or an absolute URL)
 * into a fully-qualified URL a mail client can open. Returns undefined for an
 * empty link so callers can conditionally render the button.
 */
export const absoluteAppUrl = (link?: string | null): string | undefined => {
  if (!link) return undefined;
  if (/^https?:\/\//i.test(link)) return link; // already absolute
  const base = appBaseUrl();
  if (link.startsWith('#')) return `${base}/${link}`;
  if (link.startsWith('/')) return `${base}${link}`;
  return `${base}/${link}`;
};

// ── Template ─────────────────────────────────────────────────────────────────

export interface EmailOptions {
  to: string;
  subject: string;
  /** Greeting name — renders "Dear {recipientName}," when present. */
  recipientName?: string;
  /** Prominent heading inside the email body. Defaults to the subject. */
  heading?: string;
  /** Main body copy. Blank lines start new paragraphs; single newlines break lines. */
  message: string;
  /** Absolute URL for the call-to-action button (already resolved via absoluteAppUrl). */
  actionUrl?: string;
  /** Button label. Defaults to "Open SIMS Portal". */
  actionLabel?: string;
  /** Small print rendered under the button (e.g. link expiry, confidentiality). */
  footnote?: string;
}

const BRAND = '#744727';       // DLRRD brown
const BRAND_DARK = '#5c3820';
const TEXT = '#39332e';
const MUTED = '#8a8178';
const BG = '#f4f5f7';
const BORDER = '#e7e2dc';

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const htmlParagraphs = (message: string): string =>
  message
    .split(/\n{2,}/)
    .map(block =>
      `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:${TEXT};">${escapeHtml(block).replace(/\n/g, '<br/>')}</p>`
    )
    .join('');

const buildHtml = (o: EmailOptions): string => {
  const heading = o.heading || o.subject;
  const greeting = o.recipientName
    ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:${TEXT};">Dear ${escapeHtml(o.recipientName)},</p>`
    : '';

  const button = o.actionUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 6px;">
         <tr>
           <td align="center" bgcolor="${BRAND}" style="border-radius:8px;">
             <a href="${o.actionUrl}" target="_blank"
                style="display:inline-block;padding:13px 28px;font-family:Segoe UI,Arial,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;background:${BRAND};">
               ${escapeHtml(o.actionLabel || 'Open SIMS Portal')} &rarr;
             </a>
           </td>
         </tr>
       </table>
       <p style="margin:10px 0 0;font-size:12px;line-height:1.5;color:${MUTED};">
         If the button does not work, copy and paste this link into your browser:<br/>
         <a href="${o.actionUrl}" style="color:${BRAND};word-break:break-all;">${escapeHtml(o.actionUrl)}</a>
       </p>`
    : '';

  const footnote = o.footnote
    ? `<p style="margin:18px 0 0;font-size:12.5px;line-height:1.5;color:${MUTED};">${escapeHtml(o.footnote)}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="color-scheme" content="light"/>
  <title>${escapeHtml(o.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${BG};-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(heading)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BG};padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
               style="width:600px;max-width:100%;background:#ffffff;border:1px solid ${BORDER};border-radius:14px;overflow:hidden;font-family:Segoe UI,Roboto,Arial,sans-serif;">

          <!-- Header -->
          <tr>
            <td style="padding:22px 32px 18px;background:#ffffff;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="left" style="vertical-align:middle;">
                    <img src="${logoUrl()}" alt="Department of Land Reform and Rural Development"
                         height="46" style="display:block;height:46px;width:auto;border:0;outline:none;"/>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="font-size:11px;font-weight:700;letter-spacing:0.14em;color:${BRAND};text-transform:uppercase;">SIMS Portal</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr><td style="height:4px;line-height:4px;font-size:0;background:${BRAND};">&nbsp;</td></tr>

          <!-- Body -->
          <tr>
            <td style="padding:26px 32px 30px;">
              <h1 style="margin:0 0 18px;font-size:19px;line-height:1.35;font-weight:700;color:${BRAND_DARK};">${escapeHtml(heading)}</h1>
              ${greeting}
              ${htmlParagraphs(o.message)}
              ${button}
              ${footnote}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px 26px;background:#faf8f6;border-top:1px solid ${BORDER};">
              <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:${TEXT};">SIMS — Security Incident Management System</p>
              <p style="margin:0 0 10px;font-size:12px;line-height:1.55;color:${MUTED};">
                Department of Land Reform and Rural Development · Republic of South Africa
              </p>
              <p style="margin:0 0 12px;font-size:11.5px;line-height:1.55;color:${MUTED};">
                This is an automated message; please do not reply.
              </p>
              <div style="border-top:1px solid ${BORDER};padding-top:12px;">
                <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.04em;color:${TEXT};text-transform:uppercase;">
                  Security &amp; Confidentiality Notice
                </p>
                <p style="margin:0;font-size:11px;line-height:1.6;color:${MUTED};">
                  This email and any attachments are intended solely for the named recipient and may
                  contain privileged, confidential or restricted information protected under POPIA.
                  If you are not the intended recipient, you are notified that any disclosure, copying,
                  distribution, forwarding or reliance on this message is strictly prohibited and may
                  be unlawful. Please refrain from acting on its contents, notify the sender
                  immediately, and permanently delete this message and all copies from your system.
                </p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

const buildText = (o: EmailOptions): string => {
  const lines: string[] = [];
  if (o.recipientName) lines.push(`Dear ${o.recipientName},`, '');
  lines.push(o.message.trim());
  if (o.actionUrl) {
    lines.push('', `${o.actionLabel || 'Open SIMS Portal'}: ${o.actionUrl}`);
  }
  if (o.footnote) lines.push('', o.footnote);
  lines.push(
    '',
    '—',
    'SIMS — Security Incident Management System',
    'Department of Land Reform and Rural Development, Republic of South Africa',
    'This is an automated message; please do not reply.',
    '',
    'SECURITY & CONFIDENTIALITY NOTICE',
    'This email and any attachments are intended solely for the named recipient and may contain ' +
      'privileged, confidential or restricted information protected under POPIA. If you are not the ' +
      'intended recipient, any disclosure, copying, distribution, forwarding or reliance on this ' +
      'message is strictly prohibited and may be unlawful. Please refrain from acting on its ' +
      'contents, notify the sender immediately, and permanently delete this message and all copies ' +
      'from your system.'
  );
  return lines.join('\n');
};

/** Render the branded HTML body without sending — used by tests and previews. */
export const renderEmailHtml = (options: EmailOptions): string =>
  buildHtml(options);

/** Render the plain-text body without sending — used by tests and previews. */
export const renderEmailText = (options: EmailOptions): string =>
  buildText(options);

export const EmailService = {
  /**
   * Send a branded HTML email (with plain-text fallback). Never throws.
   * Accepts a structured payload so the header, footer and call-to-action
   * button are consistent across every notification.
   */
  async send(options: EmailOptions): Promise<boolean> {
    const transport = getTransporter();
    if (!transport) {
      console.log(`[EmailService] SMTP not configured — skipped email to ${options.to}: "${options.subject}"`);
      return false;
    }

    // In redirected (UAT) mode the real recipient is kept visible in the subject, not lost
    const redirectTo = process.env.MAIL_REDIRECT_TO;
    const recipient = redirectTo || options.to;
    const finalSubject = redirectTo ? `[SIMS] [→ ${options.to}] ${options.subject}` : `[SIMS] ${options.subject}`;

    try {
      await transport.sendMail({
        from: process.env.SMTP_FROM || 'sims-noreply@dlrrd.gov.za',
        to: recipient,
        subject: finalSubject,
        text: buildText(options),
        html: buildHtml(options)
      });
      if (redirectTo) console.log(`[EmailService] Sent (redirected ${options.to} → ${redirectTo}): "${options.subject}"`);
      return true;
    } catch (err) {
      console.error(`[EmailService] Failed to send email to ${recipient}:`, err);
      return false;
    }
  }
};
