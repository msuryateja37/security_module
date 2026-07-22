import nodemailer from 'nodemailer';

// Outbound email (FR-008: notifications by email AND in-system alert).
// Delivery uses the departmental SMTP relay configured via environment:
//   SMTP_HOST, SMTP_PORT (default 587), SMTP_USER, SMTP_PASS, SMTP_FROM
// When SMTP_HOST is not set (local development) sends are logged and skipped,
// so the rest of the notification flow keeps working without a mail server.
//
// MAIL_REDIRECT_TO — UAT/testing safety net. When set, EVERY outbound message is
// delivered to that single address instead of the real recipient, with the intended
// recipient preserved in the subject and body so routing can still be verified.
// This MUST be left unset in production, where mail goes to the real officers.

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

export const EmailService = {
  async send(to: string, subject: string, text: string): Promise<boolean> {
    const transport = getTransporter();
    if (!transport) {
      console.log(`[EmailService] SMTP not configured — skipped email to ${to}: "${subject}"`);
      return false;
    }

    // In redirected (UAT) mode the real recipient is kept visible, not lost
    const redirectTo = process.env.MAIL_REDIRECT_TO;
    const recipient = redirectTo || to;
    const finalSubject = redirectTo ? `[SIMS] [→ ${to}] ${subject}` : `[SIMS] ${subject}`;
    const finalText = redirectTo
      ? `[TEST REDIRECT] This message was addressed to ${to} and was redirected here for verification.\n\n${text}`
      : text;

    try {
      await transport.sendMail({
        from: process.env.SMTP_FROM || 'sims-noreply@dlrrd.gov.za',
        to: recipient,
        subject: finalSubject,
        text: finalText
      });
      if (redirectTo) console.log(`[EmailService] Sent (redirected ${to} → ${redirectTo}): "${subject}"`);
      return true;
    } catch (err) {
      console.error(`[EmailService] Failed to send email to ${recipient}:`, err);
      return false;
    }
  }
};
