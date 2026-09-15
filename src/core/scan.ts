import type { Category, Finding, FindingGroup, JsonPath, JsonValue, ScanResult } from './types';
import { detectByFieldName, detectByValue } from './detectors';
import { formatPointer } from './pointer';

const DEFAULT_LABELS: Record<Category, string> = {
  email: 'EMAIL',
  phone: 'PHONE',
  identifier: 'ID',
  name: 'NAME',
  address: 'ADDRESS',
  ip: 'IP',
  card: 'CARD',
  cvv: 'CVV',
  token: 'TOKEN',
  secret: 'SECRET',
  other: 'REDACTED',
};

/** Default decision per category. Nothing is silently kept. */
export const DEFAULT_ACTIONS: Record<Category, 'mask' | 'replace' | 'keep'> = {
  email: 'replace',
  phone: 'replace',
  identifier: 'replace',
  name: 'replace',
  address: 'replace',
  ip: 'replace',
  card: 'mask',
  cvv: 'replace',
  token: 'replace',
  secret: 'replace',
  other: 'replace',
};

function isScalar(value: JsonValue): value is string | number {
  return typeof value === 'string' || typeof value === 'number';
}

/**
 * Walks the document in document order and reports every sensitive leaf.
 *
 * Field-name rules win over value rules, because the field name is the more
 * reliable signal (`"phone": "0000000000"` is still a phone field).
 */
export function scan(document: JsonValue): ScanResult {
  const findings: Finding[] = [];
  const groupIndex = new Map<string, FindingGroup>();
  const byPointer = new Map<string, Finding>();

  const visit = (value: JsonValue, path: JsonPath, key: string, parentKey?: string): void => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, [...path, index], key, parentKey));
      return;
    }
    if (value !== null && typeof value === 'object') {
      for (const [childKey, childValue] of Object.entries(value)) {
        visit(childValue, [...path, childKey], childKey, key);
      }
      return;
    }
    if (!isScalar(value)) return; // booleans and nulls are never sensitive

    const detection = detectByFieldName(key, parentKey) ?? detectByValue(value, key);
    if (!detection) return;

    const pointer = formatPointer(path);
    const groupKey = `${detection.category}:${String(value)}`;
    const finding: Finding = {
      id: pointer,
      path,
      pointer,
      key,
      value,
      category: detection.category,
      detectedBy: detection.detectedBy,
      reason: detection.reason,
      groupKey,
    };
    findings.push(finding);
    byPointer.set(pointer, finding);

    const existing = groupIndex.get(groupKey);
    if (existing) {
      existing.findings.push(finding);
    } else {
      groupIndex.set(groupKey, {
        groupKey,
        category: detection.category,
        value,
        reason: detection.reason,
        detectedBy: detection.detectedBy,
        label: detection.label ?? DEFAULT_LABELS[detection.category],
        findings: [finding],
        action: DEFAULT_ACTIONS[detection.category],
      });
    }
  };

  // The root has no key of its own.
  if (Array.isArray(document)) {
    document.forEach((item, index) => visit(item, [index], String(index)));
  } else if (document !== null && typeof document === 'object') {
    for (const [childKey, childValue] of Object.entries(document)) {
      visit(childValue, [childKey], childKey);
    }
  }

  return { findings, groups: [...groupIndex.values()], byPointer };
}
