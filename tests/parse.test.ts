import { describe, expect, it } from 'vitest';
import { parseJson } from '../src/core/parse';

describe('parseJson', () => {
  it('parses a valid document', () => {
    const result = parseJson('{"a": 1}');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ a: 1 });
  });

  it('reports invalid JSON instead of throwing', () => {
    const result = parseJson('{"a": 1,}');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Invalid JSON');
  });

  it('reports empty input', () => {
    expect(parseJson('   ').ok).toBe(false);
  });
});
