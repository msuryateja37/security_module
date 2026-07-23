import { EmailService } from './email.service.js';

// One-time PIN for digital signatures (TRA checklist assessor/manager sign-off).
// A signer draws their signature, then must confirm a 4-digit PIN emailed to
// their departmental address before the signature is accepted — a lightweight
// second factor that binds the signature to the authenticated identity.
//
// PINs are held in memory keyed by username (a signer confirms one signature at
// a time). They expire after TTL and are consumed on successful verification.
// Production always emails the PIN; when SMTP is not configured (local dev) the
// PIN is returned to the caller so the flow remains testable without a relay.

interface PendingPin {
  pin: string;
  expiresAt: number;
  attempts: number;
}

const PIN_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

const pending = new Map<string, PendingPin>();

const generatePin = (): string => String(Math.floor(1000 + Math.random() * 9000));

export const SignatureOtpService = {
  /**
   * Generate a PIN for the given user and email it. Returns whether the email
   * was actually delivered; in non-production environments where SMTP is not
   * configured the PIN itself is returned so the signer can proceed.
   */
  async request(username: string, email: string, purpose: string): Promise<{ emailed: boolean; devPin?: string }> {
    const pin = generatePin();
    pending.set(username, { pin, expiresAt: Date.now() + PIN_TTL_MS, attempts: 0 });

    const subject = 'Your signature confirmation PIN';
    const message =
      `Your one-time PIN to confirm your ${purpose} is:\n\n` +
      `${pin}\n\n` +
      `Enter this PIN in the portal to complete your signature.`;

    const emailed = email
      ? await EmailService.send({
          to: email,
          subject,
          message,
          footnote: 'This PIN expires in 10 minutes. If you did not initiate a signature, please ignore this email and notify your security administrator.'
        })
      : false;

    // Only expose the PIN when it could not be delivered by email AND we are not
    // running in production — this keeps the flow usable in local development.
    const isProd = process.env.NODE_ENV === 'production';
    return { emailed, devPin: !emailed && !isProd ? pin : undefined };
  },

  /**
   * Verify and consume the PIN for a user. Returns an error string on failure,
   * or null on success (PIN is removed so it cannot be reused).
   */
  verify(username: string, pin: string): { ok: true } | { ok: false; error: string } {
    const entry = pending.get(username);
    if (!entry) {
      return { ok: false, error: 'No pending PIN. Please request a new one.' };
    }
    if (Date.now() > entry.expiresAt) {
      pending.delete(username);
      return { ok: false, error: 'PIN expired. Please request a new one.' };
    }
    if (entry.attempts >= MAX_ATTEMPTS) {
      pending.delete(username);
      return { ok: false, error: 'Too many attempts. Please request a new PIN.' };
    }
    if (entry.pin !== String(pin).trim()) {
      entry.attempts += 1;
      return { ok: false, error: 'Incorrect PIN. Please try again.' };
    }
    pending.delete(username);
    return { ok: true };
  }
};
