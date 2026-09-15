import type { Category, DetectionSource } from './types';
import { isCardLike, normalizeDigits } from './luhn';

export interface Detection {
  readonly category: Category;
  readonly detectedBy: DetectionSource;
  readonly reason: string;
  /** Label used when building placeholders (identifiers only). */
  readonly label?: string;
}

/** `Customer-ID `, `customerId`, `customer_id` all normalize to `customerid`. */
export function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Field names that are sensitive on their own, whatever the value looks like.
 * Keys are normalized (lowercase, separators removed).
 */
const FIELD_RULES: Array<{ keys: string[]; category: Category }> = [
  {
    category: 'secret',
    keys: [
      'password', 'passwd', 'pwd', 'secret', 'clientsecret', 'apikey', 'apisecret',
      'privatekey', 'signature', 'pin',
    ],
  },
  {
    category: 'token',
    keys: [
      'token', 'accesstoken', 'refreshtoken', 'idtoken', 'authorization', 'auth',
      'authtoken', 'bearer', 'jwt', 'sessiontoken', 'sessionid', 'cookie', 'setcookie',
    ],
  },
  { category: 'email', keys: ['email', 'emailaddress', 'mail', 'useremail', 'contactemail'] },
  { category: 'phone', keys: ['phone', 'phonenumber', 'mobile', 'mobilephone', 'msisdn', 'tel', 'telephone'] },
  {
    category: 'name',
    keys: ['firstname', 'lastname', 'fullname', 'middlename', 'surname', 'givenname', 'familyname', 'customername', 'holdername', 'cardholder', 'cardholdername', 'name'],
  },
  {
    category: 'address',
    keys: ['address', 'address1', 'address2', 'addressline1', 'addressline2', 'street', 'streetaddress', 'billingaddress', 'shippingaddress', 'postcode', 'postalcode', 'zip', 'zipcode'],
  },
  { category: 'ip', keys: ['ip', 'ipaddress', 'clientip', 'remoteip', 'remoteaddr', 'userip'] },
  { category: 'card', keys: ['cardnumber', 'pan', 'card', 'cardno', 'accountnumber', 'iban'] },
  { category: 'cvv', keys: ['cvv', 'cvc', 'cvv2', 'cvc2', 'csc', 'securitycode'] },
];

const FIELD_INDEX = new Map<string, Category>();
for (const rule of FIELD_RULES) {
  for (const key of rule.keys) FIELD_INDEX.set(key, rule.category);
}

/** Identity fields that link a payload to a real person or merchant. */
const ENTITY_ID_KEYS = new Set([
  'customerid', 'clientid', 'merchantid', 'userid', 'accountid', 'buyerid', 'payerid',
  'subscriberid', 'terminalid', 'deviceid', 'externalid', 'personid', 'shopid', 'storeid',
  'cardid', 'walletid', 'taxid', 'vatid', 'passportid',
]);

/** Parent objects under which a bare `id` means "this person / this merchant". */
const ENTITY_PARENTS = new Set([
  'customer', 'client', 'merchant', 'user', 'account', 'buyer', 'payer', 'subscriber',
  'terminal', 'device', 'shop', 'store', 'person', 'holder',
]);

/**
 * Reference fields that are *not* treated as personal identifiers: they are the
 * fields support and QA actually need in order to debug the payload.
 */
const DEBUG_REFERENCE_KEYS = new Set([
  'paymentid', 'orderid', 'transactionid', 'invoiceid', 'requestid', 'traceid',
  'correlationid', 'spanid', 'eventid', 'refundid', 'subscriptionid', 'id',
]);

/** Keys whose values look like an IP or a phone but never are. */
const VALUE_SCAN_DENY = new Set(['version', 'appversion', 'apiversion', 'ver', 'schemaversion', 'sdkversion', 'buildnumber', 'amount', 'currency', 'timestamp', 'createdat', 'updatedat']);

export const EMAIL_RE = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;
export const IPV4_RE = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
export const JWT_RE = /^ey[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]*$/;
export const BEARER_RE = /^(?:Bearer|Basic|Token)\s+\S{8,}$/i;
const PHONE_SHAPE_RE = /^\+?\d[\d\s\-().]{6,20}$/;

/**
 * Cautious phone heuristic. A bare run of digits is only treated as a phone
 * number when it really looks like one, so numeric business references
 * (acquirer references, batch numbers) survive sanitization untouched.
 */
export function isPhoneLike(value: string): boolean {
  const trimmed = value.trim();
  if (!PHONE_SHAPE_RE.test(trimmed)) return false;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return false;
  if (isCardLike(trimmed)) return false;

  const hasCountryPrefix = trimmed.startsWith('+');
  const hasSeparators = /[\s\-().]/.test(trimmed);
  const looksNational = digits.length >= 9 && digits.length <= 11 && digits.startsWith('0');
  return hasCountryPrefix || hasSeparators || looksNational;
}

/** Field-name based detection. `parentKey` enables the bare `id` rule. */
export function detectByFieldName(key: string, parentKey?: string): Detection | null {
  const norm = normalizeKey(key);

  if (ENTITY_ID_KEYS.has(norm)) {
    return {
      category: 'identifier',
      detectedBy: 'field-name',
      reason: `identity field "${key}"`,
      label: norm.replace(/id$/, '_id').toUpperCase(),
    };
  }

  if (norm === 'id' && parentKey && ENTITY_PARENTS.has(normalizeKey(parentKey))) {
    return {
      category: 'identifier',
      detectedBy: 'field-name',
      reason: `identity field "${parentKey}.${key}"`,
      label: `${normalizeKey(parentKey).toUpperCase()}_ID`,
    };
  }

  if (DEBUG_REFERENCE_KEYS.has(norm)) return null;

  const category = FIELD_INDEX.get(norm);
  if (category) {
    return { category, detectedBy: 'field-name', reason: `sensitive field name "${key}"` };
  }
  return null;
}

/** Value based detection. Deliberately conservative; order matters. */
export function detectByValue(value: string | number, key?: string): Detection | null {
  if (key && VALUE_SCAN_DENY.has(normalizeKey(key))) return null;
  const raw = typeof value === 'number' ? String(value) : value.trim();
  if (raw.length === 0) return null;

  if (EMAIL_RE.test(raw)) {
    return { category: 'email', detectedBy: 'value-pattern', reason: 'value looks like an email address' };
  }
  if (JWT_RE.test(raw)) {
    return { category: 'token', detectedBy: 'value-pattern', reason: 'value looks like a JWT' };
  }
  if (BEARER_RE.test(raw)) {
    return { category: 'token', detectedBy: 'value-pattern', reason: 'value looks like an Authorization header' };
  }
  if (IPV4_RE.test(raw)) {
    return { category: 'ip', detectedBy: 'value-pattern', reason: 'value looks like an IPv4 address' };
  }
  if (/^[\d\s-]+$/.test(raw) && isCardLike(raw)) {
    return {
      category: 'card',
      detectedBy: 'value-pattern',
      reason: `${normalizeDigits(raw).length} digit number passing the Luhn check`,
    };
  }
  if (typeof value === 'string' && isPhoneLike(raw)) {
    return { category: 'phone', detectedBy: 'value-pattern', reason: 'value looks like a phone number' };
  }
  return null;
}

export const CATEGORY_LABELS: Record<Category, string> = {
  email: 'emails',
  phone: 'phones',
  identifier: 'customer identifiers',
  name: 'names',
  address: 'addresses',
  ip: 'IP addresses',
  card: 'card numbers',
  cvv: 'card security codes',
  token: 'tokens / authorization data',
  secret: 'secrets',
  other: 'other sensitive fields',
};
