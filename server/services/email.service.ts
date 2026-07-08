import nodemailer from 'nodemailer';

// Outbound email (FR-008: notifications by email AND in-system alert).
// Delivery uses the departmental SMTP relay configured via environment:
//   SMTP_HOST, SMTP_PORT (default 587), SMTP_USER, SMTP_PASS, SMTP_FROM
// When SMTP_HOST is not set (local development) sends are logged and skipped,
// so the rest of the notification flow keeps working without a mail server.

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

    try {
      await transport.sendMail({
        from: process.env.SMTP_FROM || 'sims-noreply@dlrrd.gov.za',
        to,
        subject: `[SIMS] ${subject}`,
        text
      });
      return true;
    } catch (err) {
      console.error(`[EmailService] Failed to send email to ${to}:`, err);
      return false;
    }
  }
};
