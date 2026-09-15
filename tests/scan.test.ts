import { describe, expect, it } from 'vitest';
import { scan } from '../src/core/scan';
import { summarize } from '../src/core/summary';
import type { JsonValue } from '../src/core/types';

describe('scan', () => {
  it('walks nested objects and reports readable pointers', () => {
    const doc: JsonValue = {
      customer: { profile: { contact: { email: 'a@example.com' } } },
    };
    const result = scan(doc);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.pointer).toBe('customer.profile.contact.email');
  });

  it('walks arrays, including arrays of scalars', () => {
    const doc: JsonValue = {
      recipients: ['a@example.com', 'b@example.com'],
      users: [{ email: 'c@example.com' }],
    };
    const pointers = scan(doc).findings.map((finding) => finding.pointer);
    expect(pointers).toEqual(['recipients[0]', 'recipients[1]', 'users[0].email']);
  });

  it('handles a root level array', () => {
    const doc: JsonValue = [{ email: 'a@example.com' }, { email: 'b@example.com' }];
    expect(scan(doc).findings.map((f) => f.pointer)).toEqual(['[0].email', '[1].email']);
  });

  it('handles deeply nested documents', () => {
    let node: JsonValue = { email: 'deep@example.com' };
    for (let i = 0; i < 40; i += 1) node = { level: node };
    const result = scan(node);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.pointer.split('.').length).toBe(41);
  });

  it('never flags booleans, nulls or ordinary business fields', () => {
    const doc: JsonValue = {
      amount: 129.9,
      currency: 'ILS',
      captured: true,
      refunded: false,
      deleted_at: null,
      installments: 3,
    };
    expect(scan(doc).findings).toHaveLength(0);
  });

  it('groups the same value under one decision', () => {
    const doc: JsonValue = { customer_id: '583921', order: { customer_id: '583921' } };
    const result = scan(doc);
    expect(result.findings).toHaveLength(2);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.findings).toHaveLength(2);
  });

  it('prefers the field name over the value pattern', () => {
    const result = scan({ phone: '0000000000' } as JsonValue);
    expect(result.findings[0]?.detectedBy).toBe('field-name');
    expect(result.findings[0]?.category).toBe('phone');
  });

  it('summarizes findings by category', () => {
    const doc: JsonValue = {
      a: 'x@example.com',
      b: 'y@example.com',
      phone: '+972501234567',
      customer_id: '583921',
      order: { customer_id: '583921' },
      card_number: '4539578763621486',
    };
    const summary = summarize(scan(doc));
    expect(summary.total).toBe(6);
    const byCategory = Object.fromEntries(summary.lines.map((line) => [line.category, line.occurrences]));
    expect(byCategory['email']).toBe(2);
    expect(byCategory['phone']).toBe(1);
    expect(byCategory['identifier']).toBe(2);
    expect(byCategory['card']).toBe(1);
    expect(summary.lines.find((line) => line.category === 'identifier')?.distinctValues).toBe(1);
  });
});
