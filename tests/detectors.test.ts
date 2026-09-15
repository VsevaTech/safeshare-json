import { describe, expect, it } from 'vitest';
import { detectByFieldName, detectByValue, isPhoneLike, normalizeKey } from '../src/core/detectors';

describe('field name detection', () => {
  it.each([
    ['password', 'secret'],
    ['passwd', 'secret'],
    ['api_key', 'secret'],
    ['token', 'token'],
    ['access_token', 'token'],
    ['refresh_token', 'token'],
    ['authorization', 'token'],
    ['email', 'email'],
    ['phone', 'phone'],
    ['mobile', 'phone'],
    ['first_name', 'name'],
    ['last_name', 'name'],
    ['full_name', 'name'],
    ['address', 'address'],
    ['ip', 'ip'],
    ['card_number', 'card'],
    ['pan', 'card'],
    ['cvv', 'cvv'],
  ])('flags %s as %s', (key, category) => {
    expect(detectByFieldName(key)?.category).toBe(category);
  });

  it('normalizes camelCase and separators', () => {
    expect(normalizeKey('Access-Token')).toBe('accesstoken');
    expect(detectByFieldName('accessToken')?.category).toBe('token');
    expect(detectByFieldName('Card-Number')?.category).toBe('card');
  });

  it('treats entity ids as identifiers and derives a label', () => {
    const detection = detectByFieldName('customer_id');
    expect(detection?.category).toBe('identifier');
    expect(detection?.label).toBe('CUSTOMER_ID');
    expect(detectByFieldName('merchant_id')?.label).toBe('MERCHANT_ID');
  });

  it('treats a bare id under an entity object as that entity id', () => {
    expect(detectByFieldName('id', 'customer')?.label).toBe('CUSTOMER_ID');
    expect(detectByFieldName('id', 'payload')).toBeNull();
  });

  it('leaves debugging references alone', () => {
    for (const key of ['payment_id', 'order_id', 'request_id', 'trace_id', 'transaction_id']) {
      expect(detectByFieldName(key)).toBeNull();
    }
  });
});

describe('value detection', () => {
  it('detects emails', () => {
    expect(detectByValue('john@example.com')?.category).toBe('email');
    expect(detectByValue('john.smith+tag@mail.example.co.uk')?.category).toBe('email');
    expect(detectByValue('not-an-email')).toBeNull();
  });

  it('detects IPv4 addresses and rejects impossible octets', () => {
    expect(detectByValue('192.168.1.20')?.category).toBe('ip');
    expect(detectByValue('8.8.8.8')?.category).toBe('ip');
    expect(detectByValue('999.1.1.1')).toBeNull();
    expect(detectByValue('1.0.0', 'version')).toBeNull();
  });

  it('skips value scanning for version-like fields', () => {
    expect(detectByValue('1.2.3.4', 'app_version')).toBeNull();
  });

  it('detects JWTs', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.4pcPyMD09olPSyXnrXCjTwXyr4BsezdI1AVTmud2fU4';
    expect(detectByValue(jwt)?.category).toBe('token');
    expect(detectByValue(jwt)?.reason).toContain('JWT');
  });

  it('detects Bearer authorization headers', () => {
    const detection = detectByValue('Bearer eyJhbGciOiJIUzI1NiJ9.abcdefgh.ijklmnop');
    expect(detection?.category).toBe('token');
    expect(detection?.reason).toContain('Authorization');
  });

  it('detects card numbers only when Luhn passes', () => {
    expect(detectByValue('4539 5787 6362 1486')?.category).toBe('card');
    expect(detectByValue('4539578763621487')).toBeNull();
  });

  it('detects phone-like values without swallowing PANs or short ids', () => {
    expect(detectByValue('+972501234567')?.category).toBe('phone');
    expect(detectByValue('+971 50 987 6543')?.category).toBe('phone');
    expect(detectByValue('050-123-4567')?.category).toBe('phone');
    expect(isPhoneLike('0501234567')).toBe(true);
    expect(isPhoneLike('583921')).toBe(false);
    expect(isPhoneLike('4539578763621486')).toBe(false);
    // a bare numeric business reference must survive untouched
    expect(isPhoneLike('9921004573310')).toBe(false);
    expect(detectByValue('9921004573310')).toBeNull();
  });

  it('ignores empty values', () => {
    expect(detectByValue('')).toBeNull();
    expect(detectByValue('   ')).toBeNull();
  });
});
