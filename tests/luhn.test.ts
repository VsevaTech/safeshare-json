import { describe, expect, it } from 'vitest';
import { isCardLike, luhnCheck, normalizeDigits } from '../src/core/luhn';

describe('luhn', () => {
  it('accepts well known valid test PANs', () => {
    expect(luhnCheck('4539578763621486')).toBe(true);
    expect(luhnCheck('4111111111111111')).toBe(true);
    expect(luhnCheck('5500005555555559')).toBe(true);
  });

  it('rejects a long digit sequence that fails the check', () => {
    expect(luhnCheck('4539578763621487')).toBe(false);
    expect(luhnCheck('1234567812345678')).toBe(false);
  });

  it('ignores spaces and dashes inside a PAN', () => {
    expect(normalizeDigits('4539 5787 6362 1486')).toBe('4539578763621486');
    expect(isCardLike('4539-5787-6362-1486')).toBe(true);
  });

  it('does not treat short or non numeric strings as cards', () => {
    expect(isCardLike('4111')).toBe(false);
    expect(isCardLike('41111111111111111111')).toBe(false);
    expect(isCardLike('not a card')).toBe(false);
  });
});
