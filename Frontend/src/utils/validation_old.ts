// Shared validation utilities for email and phone numbers
// Email domains allowed: .co, .com, .in, .net (mirrors RegisterUser component)
export const emailPattern = /^[^\s@]+@[^\s@]+\.(?:co|com|in|net)$/i;
export function isValidEmail(email: string): boolean {
  return emailPattern.test(email.trim());
}

// Phone: local 10 digit (India) before adding +91 prefix
export const phonePattern = /^\d{10}$/;
export function normalizePhone(raw: string): { cleaned: string; prefixed: string } {
  const cleaned = raw.replace(/\D/g, '').slice(0, 10);
  return { cleaned, prefixed: cleaned ? `+91${cleaned}` : '' };
}
export function isValidPhone(raw: string): boolean {
  return phonePattern.test(raw);
}
