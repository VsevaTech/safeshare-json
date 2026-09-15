import type { Category, FindingGroup } from './types';

/**
 * Builds the placeholder for one finding group.
 *
 * `index` is the 1-based position of the group inside its own category, in
 * document order, which is what makes the output deterministic: running the
 * same document through SafeShare twice yields byte-identical results.
 */
export function buildReplacement(group: FindingGroup, index: number): string {
  switch (group.category) {
    case 'email':
      return `user_${index}@example.invalid`;
    case 'phone':
      return `PHONE_${index}`;
    case 'identifier':
      return `${group.label}_${index}`;
    case 'name':
      return `NAME_${index}`;
    case 'address':
      return `ADDRESS_${index}`;
    case 'ip':
      // TEST-NET-3 (RFC 5737): a syntactically valid, guaranteed non-routable IP.
      return `203.0.113.${(index % 254) + 1}`;
    case 'card':
      return redacted('CARD', index);
    case 'cvv':
      return redacted('CVV', index);
    case 'token':
      return redacted('TOKEN', index);
    case 'secret':
      return redacted('SECRET', index);
    default:
      return redacted('REDACTED', index);
  }
}

/** `[REDACTED_TOKEN]`, then `[REDACTED_TOKEN_2]`, `[REDACTED_TOKEN_3]`, ... */
function redacted(kind: string, index: number): string {
  const base = kind === 'REDACTED' ? '[REDACTED]' : `[REDACTED_${kind}]`;
  if (index === 1) return base;
  return `${base.slice(0, -1)}_${index}]`;
}

/** Category-scoped counters, so each category numbers from 1. */
export function createCounter(): (category: Category) => number {
  const counters = new Map<Category, number>();
  return (category: Category): number => {
    const next = (counters.get(category) ?? 0) + 1;
    counters.set(category, next);
    return next;
  };
}
