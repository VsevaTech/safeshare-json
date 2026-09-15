/**
 * Luhn (mod 10) checksum.
 *
 * Used so that only plausible card numbers are reported as PANs; a random
 * 16 digit order reference is left alone.
 */
export function luhnCheck(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

/** Strips the separators humans and payment systems put inside a PAN. */
export function normalizeDigits(value: string): string {
  return value.replace(/[\s-]/g, '');
}

/** `true` for 13..19 digit strings that pass Luhn. */
export function isCardLike(value: string): boolean {
  const digits = normalizeDigits(value);
  if (!/^\d{13,19}$/.test(digits)) return false;
  return luhnCheck(digits);
}
