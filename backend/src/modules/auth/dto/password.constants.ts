/**
 * Password policy — enforced by every DTO that accepts a new password.
 * Minimum 10 chars, must contain a lowercase, uppercase, digit and symbol.
 */
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{10,128}$/;

export const PASSWORD_POLICY_MESSAGE =
  'Password must be 10–128 characters and contain at least one lowercase letter, one uppercase letter, one digit and one symbol.';

export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCK_DURATION_MINUTES = 15;
