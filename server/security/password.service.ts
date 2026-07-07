import crypto from 'crypto';

// Portal credential hashing (scrypt, Node built-in — no external dependency).
// NOTE: production authentication is Active Directory SSO (FR-031); this local
// credential exists for the development/pre-SSO login flow only.

const SCRYPT_KEYLEN = 64;

export const hashPassword = (plain: string): string => {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(plain, salt, SCRYPT_KEYLEN).toString('hex');
  return `${salt}:${derived}`;
};

export const verifyPassword = (plain: string, stored: string): boolean => {
  const [salt, expected] = stored.split(':');
  if (!salt || !expected) return false;
  const derived = crypto.scryptSync(plain, salt, SCRYPT_KEYLEN).toString('hex');
  const a = Buffer.from(derived, 'hex');
  const b = Buffer.from(expected, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

/**
 * Departmental password policy (aligned to the DLRRD ICT security chapter /
 * MISS-conservative defaults). Returns a list of violations; empty = compliant.
 */
export const validatePasswordPolicy = (password: string, username: string): string[] => {
  const violations: string[] = [];
  if (password.length < 8) violations.push('At least 8 characters');
  if (!/[A-Z]/.test(password)) violations.push('At least one uppercase letter');
  if (!/[a-z]/.test(password)) violations.push('At least one lowercase letter');
  if (!/[0-9]/.test(password)) violations.push('At least one number');
  if (!/[^A-Za-z0-9]/.test(password)) violations.push('At least one special character');
  if (username && password.toLowerCase().includes(username.toLowerCase())) {
    violations.push('Must not contain your username');
  }
  if (/^password/i.test(password)) violations.push('Must not be a variation of "password"');
  return violations;
};
