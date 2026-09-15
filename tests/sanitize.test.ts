import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { scan } from '../src/core/scan';
import { sanitize, setAllActions } from '../src/core/sanitize';
import type { JsonValue } from '../src/core/types';

const run = (doc: JsonValue): JsonValue => {
  const result = scan(doc);
  return sanitize(doc, result).value;
};

const get = (doc: JsonValue, path: string): unknown =>
  path.split('.').reduce<unknown>((node, key) => (node as Record<string, unknown>)[key], doc);

describe('sanitize', () => {
  it('replaces an email with a deterministic pseudonym', () => {
    expect(run({ email: 'john@example.com' })).toEqual({ email: 'user_1@example.invalid' });
  });

  it('replaces phones and identifiers with readable placeholders', () => {
    const out = run({ phone: '+972501234567', customer_id: '583921' });
    expect(out).toEqual({ phone: 'PHONE_1', customer_id: 'CUSTOMER_ID_1' });
  });

  it('redacts tokens and Bearer authorization data', () => {
    const out = run({
      authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJhIjoxfQ.sig-value-here',
      api_key: 'sk_live_51H8xQ2LkJ9dPmR4tYvB',
    });
    expect(out).toEqual({ authorization: '[REDACTED_TOKEN]', api_key: '[REDACTED_SECRET]' });
  });

  it('keeps the same sensitive value identical in all five locations', () => {
    const doc: JsonValue = {
      customer_id: '583921',
      order: { customer_id: '583921' },
      audit: [{ customer_id: '583921' }, { customer_id: '583921' }],
      nested: { deep: { deeper: { customer_id: '583921' } } },
    };
    const out = run(doc) as Record<string, JsonValue>;
    const values = [
      get(out, 'customer_id'),
      get(out, 'order.customer_id'),
      (out['audit'] as Array<Record<string, unknown>>)[0]?.['customer_id'],
      (out['audit'] as Array<Record<string, unknown>>)[1]?.['customer_id'],
      get(out, 'nested.deep.deeper.customer_id'),
    ];
    expect(values).toHaveLength(5);
    expect(new Set(values).size).toBe(1);
    expect(values[0]).toBe('CUSTOMER_ID_1');
  });

  it('links a value across different keys of the same category', () => {
    const doc: JsonValue = { customer: { id: '583921' }, related: { customer_id: '583921' } };
    const out = run(doc);
    expect(get(out, 'customer.id')).toBe(get(out, 'related.customer_id'));
  });

  it('gives different values different placeholders', () => {
    const out = run({ a: 'one@example.com', b: 'two@example.com', c: 'one@example.com' });
    expect(get(out, 'a')).toBe('user_1@example.invalid');
    expect(get(out, 'b')).toBe('user_2@example.invalid');
    expect(get(out, 'c')).toBe('user_1@example.invalid');
  });

  it('is deterministic across runs', () => {
    const doc: JsonValue = {
      customer: { email: 'a@example.com', phone: '+972501234567', id: '583921' },
      agent: { email: 'b@example.com' },
    };
    expect(JSON.stringify(run(doc))).toBe(JSON.stringify(run(doc)));
  });

  it('masks card numbers by default, preserving the last four digits', () => {
    const out = run({ card_number: '4539578763621486' });
    expect(out).toEqual({ card_number: '************1486' });
  });

  it('never mutates the original document', () => {
    const doc: JsonValue = {
      customer: { email: 'john@example.com', tags: ['vip'] },
      amount: 10,
    };
    const snapshot = JSON.stringify(doc);
    const result = scan(doc);
    const out = sanitize(doc, result);
    expect(JSON.stringify(doc)).toBe(snapshot);
    expect(out.value).not.toBe(doc);
    expect(get(doc, 'customer.email')).toBe('john@example.com');
  });

  it('preserves nulls, booleans, numbers and untouched strings', () => {
    const doc: JsonValue = {
      email: 'john@example.com',
      amount: 129.9,
      currency: 'ILS',
      captured: true,
      refunded: false,
      deleted_at: null,
      items: [1, 2, 3],
      empty_object: {},
      empty_array: [],
    };
    const out = run(doc) as Record<string, JsonValue>;
    expect(out['amount']).toBe(129.9);
    expect(out['currency']).toBe('ILS');
    expect(out['captured']).toBe(true);
    expect(out['refunded']).toBe(false);
    expect(out['deleted_at']).toBeNull();
    expect(out['items']).toEqual([1, 2, 3]);
    expect(out['empty_object']).toEqual({});
    expect(out['empty_array']).toEqual([]);
    expect(out['email']).toBe('user_1@example.invalid');
  });

  it('honours Keep and Mask decisions per group', () => {
    const doc: JsonValue = { email: 'john@example.com', phone: '+972501234567' };
    const result = scan(doc);
    setAllActions(result, 'keep');
    expect(sanitize(doc, result).value).toEqual(doc);

    setAllActions(result, 'mask');
    const masked = sanitize(doc, result).value as Record<string, string>;
    expect(masked['email']).toBe('j***@e******.com');
    expect(masked['phone']).toBe('+97********67');
  });

  it('reports what changed and the applied mapping', () => {
    const doc: JsonValue = { customer_id: '583921', order: { customer_id: '583921' } };
    const out = sanitize(doc, scan(doc));
    expect([...out.changed.keys()]).toEqual(['customer_id', 'order.customer_id']);
    expect(out.mapping).toEqual([{ from: '583921', to: 'CUSTOMER_ID_1', category: 'identifier' }]);
  });

  it('sanitizes numbers stored as JSON numbers too', () => {
    const out = run({ customer_id: 583921 });
    expect(out).toEqual({ customer_id: 'CUSTOMER_ID_1' });
  });
});

describe('demo payload', () => {
  const raw = readFileSync(new URL('../examples/payment-event.json', import.meta.url), 'utf8');
  const doc = JSON.parse(raw) as JsonValue;

  it('detects more than ten sensitive values', () => {
    expect(scan(doc).findings.length).toBeGreaterThan(10);
  });

  it('keeps business fields intact and removes the obvious secrets', () => {
    const out = run(doc);
    expect(get(out, 'payment.amount')).toBe(129.9);
    expect(get(out, 'payment.currency')).toBe('ILS');
    expect(get(out, 'payment.captured')).toBe(true);
    expect(get(out, 'payment_id')).toBe('pay_839201');
    expect(get(out, 'order_id')).toBe('ORD-2026-000412');
    expect(get(out, 'customer.deleted_at')).toBeNull();
    // 13 digit acquirer reference: fails Luhn, so it is not treated as a PAN
    expect(get(out, 'payment.acquirer_reference')).toBe('9921004573310');
    expect(get(out, 'payment.card.last4')).toBe('1486');

    const text = JSON.stringify(out);
    expect(text).not.toContain('john.smith@example.com');
    expect(text).not.toContain('+972501234567');
    expect(text).not.toContain('4539578763621486');
    expect(text).not.toContain('583921');
    expect(text).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    expect(text).not.toContain('sk_live_51H8xQ2LkJ9dPmR4tYvB');
  });

  it('replaces the repeated customer id identically in all five locations', () => {
    const out = run(doc);
    const expected = get(out, 'customer.id');
    expect(expected).toBe('CUSTOMER_ID_1');
    expect(get(out, 'audit_trail.0.customer_id')).toBe(expected);
    expect(get(out, 'audit_trail.1.customer_id')).toBe(expected);
    expect(get(out, 'audit_trail.2.customer_id')).toBe(expected);
    expect(get(out, 'related.previous_payment.customer_id')).toBe(expected);
  });
});
