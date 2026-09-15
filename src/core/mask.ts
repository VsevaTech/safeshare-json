import type { Category } from './types';
import { normalizeDigits } from './luhn';

const stars = (n: number): string => '*'.repeat(Math.max(n, 0));

/**
 * Character level masking. Pure and deterministic: the same input always
 * produces the same mask, so repeated values stay linked.
 */
export function maskValue(value: string | number, category: Category): string {
  const raw = String(value);

  switch (category) {
    case 'email': {
      const at = raw.indexOf('@');
      if (at <= 0) return maskGeneric(raw);
      const local = raw.slice(0, at);
      const domain = raw.slice(at + 1);
      const dot = domain.lastIndexOf('.');
      const head = dot > 0 ? domain.slice(0, dot) : domain;
      const tld = dot > 0 ? domain.slice(dot) : '';
      return `${local[0]}${stars(local.length - 1)}@${head[0] ?? ''}${stars(head.length - 1)}${tld}`;
    }
    case 'card': {
      const digits = normalizeDigits(raw);
      if (digits.length < 8) return maskGeneric(raw);
      return `${stars(digits.length - 4)}${digits.slice(-4)}`;
    }
    case 'phone': {
      const plus = raw.trim().startsWith('+') ? '+' : '';
      const digits = raw.replace(/\D/g, '');
      if (digits.length < 4) return maskGeneric(raw);
      return `${plus}${digits.slice(0, 2)}${stars(digits.length - 4)}${digits.slice(-2)}`;
    }
    case 'ip': {
      const parts = raw.split('.');
      if (parts.length !== 4) return maskGeneric(raw);
      return `${parts[0]}.${parts[1]}.*.*`;
    }
    case 'token':
    case 'secret':
      return `${raw.slice(0, 4)}${stars(Math.min(raw.length - 4, 12))}`;
    case 'cvv':
      return stars(raw.length);
    default:
      return maskGeneric(raw);
  }
}

function maskGeneric(raw: string): string {
  if (raw.length <= 1) return stars(raw.length || 1);
  return `${raw[0]}${stars(Math.min(raw.length - 1, 16))}`;
}
